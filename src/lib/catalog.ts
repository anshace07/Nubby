import type { CSSProperties } from "react";
import type { CoverId, FontId, PageType, PaperColor, StickyColor } from "./types";

/* ---------- fonts (all bundled, all SIL Open Font License) ---------- */

export interface FontDef {
  id: FontId;
  name: string;
  css: string;
  /** Some handwriting fonts run small; this nudges their default size. */
  scale: number;
  kind: "hand" | "clean";
}

export const FONTS: FontDef[] = [
  { id: "patrick", name: "Patrick Hand", css: "'Patrick Hand', 'Segoe Print', cursive", scale: 1, kind: "hand" },
  { id: "kalam", name: "Kalam", css: "'Kalam', 'Segoe Print', cursive", scale: 0.92, kind: "hand" },
  { id: "gochi", name: "Gochi Hand", css: "'Gochi Hand', 'Segoe Print', cursive", scale: 1, kind: "hand" },
  { id: "caveat", name: "Caveat", css: "'Caveat', 'Segoe Print', cursive", scale: 1.18, kind: "hand" },
  { id: "shadows", name: "Shadows Into Light", css: "'Shadows Into Light', 'Segoe Print', cursive", scale: 1, kind: "hand" },
  { id: "questrial", name: "Questrial", css: "'Questrial', 'Segoe UI', sans-serif", scale: 0.86, kind: "clean" },
  { id: "inter", name: "Inter (system)", css: "'Inter', 'Segoe UI', system-ui, sans-serif", scale: 0.82, kind: "clean" },
  { id: "garamond", name: "EB Garamond", css: "'EB Garamond', Georgia, serif", scale: 0.95, kind: "clean" },
];

export const fontById = (id: FontId | string | null | undefined): FontDef =>
  FONTS.find((f) => f.id === id) ?? FONTS[0];

/* ---------- ink ---------- */

export const INKS = [
  { id: "black", name: "Black", color: "#1a1a1a", night: "#1a1a1a" },
  { id: "blue", name: "Blue", color: "#2B4BC9", night: "#2B4BC9" },
  { id: "red", name: "Red", color: "#E2231A", night: "#E2231A" },
  { id: "purple", name: "Purple", color: "#6A3FB5", night: "#6A3FB5" },
  { id: "green", name: "Green", color: "#2E9E5B", night: "#2E9E5B" },
] as const;

export const HIGHLIGHTS = [
  { id: "peach", name: "Peach", color: "#F7E2C7" },
  { id: "yellow", name: "Yellow", color: "#FFF08A" },
  { id: "mint", name: "Mint", color: "#D3EEE8" },
  { id: "lilac", name: "Lilac", color: "#DCCCF5" },
  { id: "grey", name: "Grey", color: "#E5E5E5" },
] as const;

export const STICKY_COLORS: { id: StickyColor; name: string; color: string }[] = [
  { id: "yellow", name: "Yellow", color: "#FFE873" },
  { id: "pink", name: "Pink", color: "#FFC3D3" },
  { id: "mint", name: "Mint", color: "#BFEBD3" },
  { id: "blue", name: "Blue", color: "#C6DBFF" },
];

/* ---------- paper ---------- */

export const PAPERS: { id: PaperColor; name: string; color: string }[] = [
  { id: "cream", name: "Cream", color: "#F9F6EA" },
  { id: "white", name: "White", color: "#FFFFFF" },
];

export const PAGE_TYPES: { id: PageType; name: string }[] = [
  { id: "dotted", name: "Dotted" },
  { id: "ruled", name: "Ruled" },
  { id: "grid", name: "Grid" },
  { id: "blank", name: "Blank" },
  { id: "cornell", name: "Cornell" },
];

/** Line pitch of the page; text lines sit on it. */
export const PITCH = 32;

/**
 * CSS background for a sheet of paper. `step` lets thumbnails use a
 * smaller pattern than the real page.
 */
export function paperBackground(
  paper: PaperColor,
  type: PageType,
  step = PITCH,
  dot = 1.2,
): CSSProperties {
  const white = paper === "white";
  const base = white ? "#FFFFFF" : "#F9F6EA";
  const dotC = white ? "#D0CEC6" : "#C2C0B3";
  const line = white ? "#E7E5DF" : "#E3DCC8";
  const margin = "#EBA8A3";
  // Text baselines land on (offset + n * step); see page.css padding.
  const off = Math.round(step * 0.56);
  switch (type) {
    case "dotted":
      return {
        backgroundColor: base,
        backgroundImage: `radial-gradient(circle, ${dotC} ${dot}px, transparent ${dot + 0.5}px)`,
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: `${Math.round(step * 0.875)}px ${Math.round(step * 0.94)}px`,
      };
    case "ruled":
      return {
        backgroundColor: base,
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0 ${off - 1}px, ${line} ${off - 1}px ${off}px, transparent ${off}px ${step}px)`,
      };
    case "grid":
      return {
        backgroundColor: base,
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: `${Math.round(step * 0.375)}px ${off}px`,
      };
    case "cornell":
      return {
        backgroundColor: base,
        backgroundImage: `linear-gradient(90deg, transparent ${step * 5.4}px, ${margin} ${step * 5.4}px, ${margin} ${step * 5.4 + 1.5}px, transparent ${step * 5.4 + 1.5}px), repeating-linear-gradient(180deg, transparent 0 ${off - 1}px, ${line} ${off - 1}px ${off}px, transparent ${off}px ${step}px)`,
      };
    default:
      return { backgroundColor: base };
  }
}

/* ---------- covers ---------- */

export interface CoverDef {
  id: CoverId;
  name: string;
  /** background of the cover board */
  style: CSSProperties;
  /** how the title is drawn */
  label: "card" | "tape" | "leather" | "round" | "tilted";
  spine: string;
}

export const COVERS: CoverDef[] = [
  {
    id: "linen",
    name: "Linen",
    label: "card",
    spine: "rgba(0,0,0,.25)",
    style: {
      backgroundColor: "#2F4A7A",
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px)",
    },
  },
  {
    id: "kraft",
    name: "Kraft",
    label: "tape",
    spine: "rgba(80,50,20,.18)",
    style: {
      backgroundColor: "#C9A47B",
      backgroundImage:
        "radial-gradient(circle at 30% 40%, rgba(90,58,28,.28) .8px, transparent 1.4px), radial-gradient(circle at 70% 70%, rgba(255,240,215,.35) .8px, transparent 1.4px)",
      backgroundSize: "11px 13px, 17px 9px",
    },
  },
  {
    id: "leather",
    name: "Leather",
    label: "leather",
    spine: "rgba(0,0,0,.28)",
    style: {
      backgroundColor: "#6B3B22",
      backgroundImage:
        "radial-gradient(circle at 50% 50%, rgba(255,210,170,.08) 1px, transparent 2px), radial-gradient(ellipse at 30% 20%, rgba(255,200,150,.18), transparent 60%)",
      backgroundSize: "6px 6px, 100% 100%",
    },
  },
  { id: "sage", name: "Sage", label: "round", spine: "rgba(0,0,0,.14)", style: { backgroundColor: "#A3C09B" } },
  { id: "coral", name: "Coral", label: "tilted", spine: "rgba(0,0,0,.14)", style: { backgroundColor: "#EF8B6D" } },
  { id: "mustard", name: "Mustard", label: "card", spine: "rgba(0,0,0,.14)", style: { backgroundColor: "#E8B94A" } },
  { id: "blush", name: "Blush", label: "round", spine: "rgba(0,0,0,.12)", style: { backgroundColor: "#F4B6C2" } },
  {
    id: "charcoal",
    name: "Felt",
    label: "tape",
    spine: "rgba(0,0,0,.3)",
    style: {
      backgroundColor: "#3B3A3F",
      backgroundImage:
        "radial-gradient(circle at 40% 30%, rgba(255,255,255,.06) .8px, transparent 1.6px)",
      backgroundSize: "5px 7px",
    },
  },
];

export const coverById = (id: CoverId | string): CoverDef =>
  COVERS.find((c) => c.id === id) ?? COVERS[0];
