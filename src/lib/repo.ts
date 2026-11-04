/**
 * Nubby's data model on disk (all plain JSON you can open and back up):
 *
 *   shelf.json                       { order: [notebookId…] }
 *   board.json                       loose sticky notes board
 *   board/assets/<file>              pictures on the board
 *   notebooks/<id>/notebook.json     Notebook
 *   notebooks/<id>/pages/<id>.json   Page
 *   notebooks/<id>/assets/<file>     pictures used on that notebook's pages
 *   Exports/                         PNG exports
 */
import { fsStore } from "./storage";
import type { Board, CanvasItem, Notebook, Page, SearchHit } from "./types";
import { newId, sleep } from "./util";

/* ------------------------------------------------------------------ */
/* Write queue: one writer per file, always the newest content, with   */
/* retries. Combined with the atomic write on the Rust side this means */
/* a crash can at worst lose the last half-second of typing.           */
/* ------------------------------------------------------------------ */

const latest = new Map<string, string>();
const running = new Set<string>();
type SaveListener = (state: "saving" | "saved" | "error", detail?: string) => void;
let saveListener: SaveListener = () => {};
export function onSaveState(fn: SaveListener) {
  saveListener = fn;
}

async function pump(rel: string) {
  if (running.has(rel)) return;
  running.add(rel);
  saveListener("saving");
  try {
    let attempts = 0;
    while (latest.has(rel)) {
      const contents = latest.get(rel)!;
      latest.delete(rel);
      try {
        await fsStore.writeText(rel, contents);
        attempts = 0;
      } catch (err) {
        attempts++;
        if (!latest.has(rel)) latest.set(rel, contents);
        saveListener("error", String(err));
        if (attempts > 6) {
          latest.delete(rel);
          break;
        }
        await sleep(800 * attempts);
      }
    }
  } finally {
    running.delete(rel);
    if (running.size === 0 && latest.size === 0) saveListener("saved");
  }
}

export function writeJson(rel: string, data: unknown) {
  latest.set(rel, JSON.stringify(data, null, 1));
  void pump(rel);
}

/** Resolves once every queued write has reached the disk. */
export async function flushWrites(timeoutMs = 4000) {
  const start = Date.now();
  while ((running.size > 0 || latest.size > 0) && Date.now() - start < timeoutMs) {
    for (const rel of latest.keys()) void pump(rel);
    await sleep(25);
  }
}

async function readJson<T>(rel: string): Promise<T | null> {
  const raw = latest.get(rel) ?? (await fsStore.readText(rel));
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn("Could not parse", rel);
    return null;
  }
}

/* --------------------------- notebooks --------------------------- */

export const nbDir = (id: string) => `notebooks/${id}`;
export const nbFile = (id: string) => `notebooks/${id}/notebook.json`;
export const pageFile = (nb: string, page: string) => `notebooks/${nb}/pages/${page}.json`;
export const nbAssets = (id: string) => `notebooks/${id}/assets`;
export const BOARD_ASSETS = "board/assets";

function normalizeNotebook(raw: Partial<Notebook> & { id: string }): Notebook {
  const now = Date.now();
  return {
    v: 1,
    id: raw.id,
    title: raw.title ?? "Untitled",
    subtitle: raw.subtitle ?? "",
    cover: raw.cover ?? "linen",
    paper: raw.paper ?? "cream",
    pageType: raw.pageType ?? "dotted",
    font: raw.font ?? "patrick",
    numbered: raw.numbered ?? true,
    pages: Array.isArray(raw.pages) ? raw.pages : [],
    pageInfo: raw.pageInfo ?? {},
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    openedAt: raw.openedAt ?? raw.updatedAt ?? now,
    lastPageId: raw.lastPageId ?? null,
    trashedAt: raw.trashedAt ?? null,
  };
}

export async function loadNotebooks(): Promise<Notebook[]> {
  const dirs = await fsStore.list("notebooks");
  const out: Notebook[] = [];
  await Promise.all(
    dirs
      .filter((d) => d.dir)
      .map(async (d) => {
        const raw = await readJson<Notebook>(nbFile(d.name));
        if (raw) out.push(normalizeNotebook({ ...raw, id: d.name }));
      }),
  );
  return out;
}

export function saveNotebook(nb: Notebook) {
  writeJson(nbFile(nb.id), nb);
}

export async function loadShelfOrder(): Promise<string[]> {
  const s = await readJson<{ order?: string[] }>("shelf.json");
  return s?.order ?? [];
}
export function saveShelfOrder(order: string[]) {
  writeJson("shelf.json", { v: 1, order });
}

export function blankPage(id = newId()): Page {
  const now = Date.now();
  return {
    v: 1,
    id,
    doc: null,
    items: [],
    paper: null,
    pageType: null,
    text: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function createNotebook(
  fields: Pick<Notebook, "title" | "subtitle" | "cover" | "paper" | "pageType" | "font" | "numbered">,
): { notebook: Notebook; page: Page } {
  const now = Date.now();
  const page = blankPage();
  const notebook: Notebook = {
    v: 1,
    id: newId(),
    ...fields,
    pages: [page.id],
    pageInfo: { [page.id]: { title: "", createdAt: now, updatedAt: now } },
    createdAt: now,
    updatedAt: now,
    openedAt: now,
    lastPageId: page.id,
    trashedAt: null,
  };
  saveNotebook(notebook);
  savePage(notebook.id, page);
  return { notebook, page };
}

export async function deleteNotebookForever(id: string) {
  latest.delete(nbFile(id));
  await fsStore.remove(nbDir(id));
}

/* ------------------------------ pages ------------------------------ */

export async function loadPage(nbId: string, pageId: string): Promise<Page> {
  const raw = await readJson<Page>(pageFile(nbId, pageId));
  if (!raw) return blankPage(pageId);
  return {
    ...blankPage(pageId),
    ...raw,
    id: pageId,
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

export function savePage(nbId: string, page: Page) {
  writeJson(pageFile(nbId, page.id), page);
}

export async function deletePageFile(nbId: string, pageId: string) {
  latest.delete(pageFile(nbId, pageId));
  await fsStore.remove(pageFile(nbId, pageId));
}

/* ------------------------------ board ------------------------------ */

export async function loadBoard(): Promise<Board> {
  const raw = await readJson<Board>("board.json");
  return { v: 1, items: raw?.items ?? [], updatedAt: raw?.updatedAt ?? Date.now() };
}
export function saveBoard(items: CanvasItem[]) {
  writeJson("board.json", { v: 1, items, updatedAt: Date.now() });
}

/* ------------------------------ assets ------------------------------ */

const blobUrls = new Map<string, string>();

export async function saveAsset(dir: string, bytes: Uint8Array, ext: string): Promise<string> {
  const name = `${newId()}.${ext}`;
  await fsStore.writeBytes(`${dir}/${name}`, bytes);
  return name;
}

/** Returns a blob: URL for a stored picture (cached for the session). */
export async function assetUrl(dir: string, name: string, mime: string): Promise<string> {
  const key = `${dir}/${name}`;
  const hit = blobUrls.get(key);
  if (hit) return hit;
  const bytes = await fsStore.readBytes(key);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  blobUrls.set(key, url);
  return url;
}

export function primeAssetUrl(dir: string, name: string, url: string) {
  blobUrls.set(`${dir}/${name}`, url);
}

/* ------------------------------ misc ------------------------------ */

export const storageRoot = () => fsStore.root();
export const searchPages = (q: string): Promise<SearchHit[]> => fsStore.search(q);
export const writeExport = (name: string, bytes: Uint8Array) =>
  fsStore.writeBytes(`Exports/${name}`, bytes);
