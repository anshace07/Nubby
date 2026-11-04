/**
 * Low-level file access.
 *
 * Inside the desktop app every call goes to the small Rust file store
 * (src-tauri/src/lib.rs), which keeps everything under Documents\Nubby.
 * In a plain browser (used only for development) the same API is backed by
 * localStorage so the UI can be worked on without the desktop shell.
 */
import { invoke } from "@tauri-apps/api/core";
import type { SearchHit } from "./types";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface FsEntry {
  name: string;
  dir: boolean;
}

export interface FileStore {
  root(): Promise<string>;
  readText(rel: string): Promise<string | null>;
  writeText(rel: string, contents: string): Promise<void>;
  list(rel: string): Promise<FsEntry[]>;
  remove(rel: string): Promise<void>;
  /** Returns the absolute path written. */
  writeBytes(rel: string, bytes: Uint8Array): Promise<string>;
  readBytes(rel: string): Promise<Uint8Array>;
  search(query: string): Promise<SearchHit[]>;
}

const tauriStore: FileStore = {
  root: () => invoke<string>("storage_root"),
  readText: (rel) => invoke<string | null>("read_text", { rel }),
  writeText: (rel, contents) => invoke<void>("write_text", { rel, contents }),
  list: (rel) => invoke<FsEntry[]>("list_dir", { rel }),
  remove: (rel) => invoke<void>("remove_path", { rel }),
  writeBytes: (rel, bytes) =>
    invoke<string>("write_bytes", bytes, {
      headers: { "x-nubby-path": encodeURIComponent(rel) },
    }),
  readBytes: async (rel) => {
    const buf = await invoke<ArrayBuffer | number[]>("read_bytes", { rel });
    return buf instanceof ArrayBuffer ? new Uint8Array(buf) : Uint8Array.from(buf);
  },
  search: (query) => invoke<SearchHit[]>("search_pages", { query }),
};

/* ---------------- browser fallback (development only) ---------------- */

const PREFIX = "nubby-dev-fs:";
const bytesMem = new Map<string, Uint8Array>();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function allKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
  }
  return keys;
}

const browserStore: FileStore = {
  root: async () => "Browser storage (development)",
  readText: async (rel) => localStorage.getItem(PREFIX + rel),
  writeText: async (rel, contents) => {
    localStorage.setItem(PREFIX + rel, contents);
  },
  list: async (rel) => {
    const base = rel ? rel.replace(/\/$/, "") + "/" : "";
    const seen = new Map<string, boolean>();
    for (const k of [...allKeys(), ...bytesMem.keys()]) {
      if (!k.startsWith(base)) continue;
      const rest = k.slice(base.length);
      const [head, ...tail] = rest.split("/");
      if (!head) continue;
      seen.set(head, (seen.get(head) ?? false) || tail.length > 0);
    }
    return [...seen.entries()].map(([name, dir]) => ({ name, dir }));
  },
  remove: async (rel) => {
    for (const k of allKeys()) {
      if (k === rel || k.startsWith(rel + "/")) localStorage.removeItem(PREFIX + k);
    }
    for (const k of [...bytesMem.keys()]) {
      if (k === rel || k.startsWith(rel + "/")) bytesMem.delete(k);
    }
  },
  writeBytes: async (rel, bytes) => {
    bytesMem.set(rel, bytes);
    try {
      localStorage.setItem(PREFIX + "__bytes/" + rel, toB64(bytes));
    } catch {
      /* quota — fine for development */
    }
    return rel;
  },
  readBytes: async (rel) => {
    const mem = bytesMem.get(rel);
    if (mem) return mem;
    const b64 = localStorage.getItem(PREFIX + "__bytes/" + rel);
    if (!b64) throw new Error("missing " + rel);
    return fromB64(b64);
  },
  search: async (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const k of allKeys()) {
      const m = /^notebooks\/([^/]+)\/pages\/([^/]+)\.json$/.exec(k);
      if (!m) continue;
      try {
        const page = JSON.parse(localStorage.getItem(PREFIX + k) || "{}");
        const text: string = page.text || "";
        const pos = text.toLowerCase().indexOf(q);
        if (pos < 0) continue;
        const start = Math.max(0, pos - 40);
        const end = Math.min(text.length, pos + q.length + 90);
        let snippet = text.slice(start, end).replace(/\s+/g, " ");
        if (start > 0) snippet = "…" + snippet;
        if (end < text.length) snippet += "…";
        hits.push({ notebookId: m[1], pageId: m[2], snippet });
      } catch {
        /* ignore */
      }
    }
    return hits;
  },
};

export const fsStore: FileStore = isTauri ? tauriStore : browserStore;
