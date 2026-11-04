import type { JSONContent } from "@tiptap/core";

/** Short, sortable, filename-safe id. */
export function newId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${t}${r}`;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** "Thursday · 5 Nov" — the date line at the top of every page. */
export function pageDate(ts: number): string {
  const d = new Date(ts);
  return `${weekday.format(d)} · ${dayMonth.format(d)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 50) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)} h ago`;
  const d = h / 24;
  if (d < 1.5) return "yesterday";
  if (d < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(ts);
  return dayMonth.format(ts);
}

/** First heading, else first non-empty line, of a page. */
export function titleFromDoc(doc: JSONContent | null | undefined, text: string): string {
  const firstText = (node: JSONContent | undefined): string => {
    if (!node) return "";
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(firstText).join("");
  };
  const heading = doc?.content?.find((n) => n.type === "heading");
  const raw = (heading ? firstText(heading) : "") || text.split("\n").find((l) => l.trim()) || "";
  const clean = raw.replace(/\s+/g, " ").trim().replace(/^#+\s*/, "");
  return clean.length > 48 ? clean.slice(0, 47) + "…" : clean;
}

/** File-name-safe version of a title. */
export function safeName(s: string): string {
  const cleaned = s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 60) || "Nubby";
}

export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

export function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp")) return "webp";
  if (m.includes("bmp")) return "bmp";
  if (m.includes("svg")) return "svg";
  return "png";
}

export function mimeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}
