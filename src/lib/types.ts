import type { JSONContent } from "@tiptap/core";

export type CoverId =
  | "linen"
  | "kraft"
  | "leather"
  | "sage"
  | "coral"
  | "mustard"
  | "blush"
  | "charcoal";
export type PaperColor = "cream" | "white";
export type PageType = "dotted" | "ruled" | "grid" | "blank" | "cornell";
export type FontId =
  | "patrick"
  | "kalam"
  | "gochi"
  | "caveat"
  | "shadows"
  | "questrial"
  | "inter"
  | "garamond";
export type StickyColor = "yellow" | "pink" | "mint" | "blue";

/** Small summary of a page, kept inside notebook.json so lists never need to open every page. */
export interface PageInfo {
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  v: 1;
  id: string;
  title: string;
  /** The small handwritten second line on the cover label. */
  subtitle: string;
  cover: CoverId;
  paper: PaperColor;
  pageType: PageType;
  font: FontId;
  numbered: boolean;
  /** Page ids in reading order. */
  pages: string[];
  pageInfo: Record<string, PageInfo>;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
  lastPageId: string | null;
  trashedAt: number | null;
}

interface ItemBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in degrees. Sticky notes sit a few degrees off. */
  rot: number;
  z: number;
}

export interface ImageItem extends ItemBase {
  kind: "image";
  /** File name inside the owner's assets folder. */
  asset: string;
  /** width / height of the original picture. */
  ratio: number;
}

export interface StickyItem extends ItemBase {
  kind: "sticky";
  color: StickyColor;
  text: string;
  /** Folded up into its glued strip, so the page underneath shows. */
  folded?: boolean;
}

export type CanvasItem = ImageItem | StickyItem;

export interface Page {
  v: 1;
  id: string;
  doc: JSONContent | null;
  items: CanvasItem[];
  /** null = follow the notebook's default */
  paper: PaperColor | null;
  pageType: PageType | null;
  /** Plain text copy of the page, used for search. */
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface Board {
  v: 1;
  items: CanvasItem[];
  updatedAt: number;
}

export interface SearchHit {
  notebookId: string;
  pageId: string;
  snippet: string;
}

export type View =
  | { name: "shelf" }
  | { name: "recent" }
  | { name: "board" }
  | { name: "trash" }
  | { name: "notebook"; notebookId: string; pageId: string | null };
