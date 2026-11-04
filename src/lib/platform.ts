/** Thin wrappers over the desktop shell, with harmless browser fallbacks. */
import { LogicalPosition, LogicalSize, availableMonitors, currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./storage";

const appWindow = isTauri ? getCurrentWindow() : null;

export const windowControls = {
  minimize: () => appWindow?.minimize(),
  toggleMaximize: () => appWindow?.toggleMaximize(),
  close: () => (appWindow ? appWindow.close() : undefined),
  startDragging: () => appWindow?.startDragging(),
  isMaximized: async () => (appWindow ? appWindow.isMaximized() : false),
  onResized: async (fn: () => void) => (appWindow ? appWindow.onResized(fn) : () => {}),
  onCloseRequested: async (fn: () => Promise<void>) =>
    appWindow ? appWindow.onCloseRequested(async () => fn()) : () => {},
};

/* ------------------------- the pop-out mini window ------------------------- */

const MINI_GEO_KEY = "nubby.mini.geo";
const FULL_MIN = { w: 1000, h: 620 };
const MINI_MIN = { w: 380, h: 420 };

interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Where the full window was before popping out, to go back to exactly. */
let fullGeo: (Geo & { maximized: boolean }) | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function windowGeo(): Promise<Geo> {
  const win = appWindow!;
  const f = await win.scaleFactor();
  const pos = (await win.outerPosition()).toLogical(f);
  const size = (await win.innerSize()).toLogical(f);
  return { x: Math.round(pos.x), y: Math.round(pos.y), w: Math.round(size.width), h: Math.round(size.height) };
}

function savedMiniGeo(): Geo | null {
  try {
    const g = JSON.parse(localStorage.getItem(MINI_GEO_KEY) ?? "null");
    return g && [g.x, g.y, g.w, g.h].every((n) => typeof n === "number" && Number.isFinite(n)) ? g : null;
  } catch {
    return null;
  }
}

/** The last mini window spot if it's still on a screen, else a tall window at the right of this screen. */
async function miniGeo(): Promise<Geo> {
  const saved = savedMiniGeo();
  const screens = (await availableMonitors().catch(() => [])).map((m) => {
    const f = m.scaleFactor;
    return {
      x: m.workArea.position.x / f,
      y: m.workArea.position.y / f,
      w: m.workArea.size.width / f,
      h: m.workArea.size.height / f,
    };
  });
  if (saved) {
    const cx = saved.x + saved.w / 2;
    const cy = saved.y + 20;
    if (screens.some((s) => cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h)) return saved;
  }
  const mon = await currentMonitor().catch(() => null);
  const f = mon?.scaleFactor ?? 1;
  const wa = mon
    ? { x: mon.workArea.position.x / f, y: mon.workArea.position.y / f, w: mon.workArea.size.width / f, h: mon.workArea.size.height / f }
    : { x: 0, y: 0, w: 1366, h: 728 };
  // A bit over a third of the screen: room for a video beside it, page text still readable.
  const w = Math.round(Math.min(saved?.w ?? Math.min(680, Math.max(480, wa.w * 0.42)), wa.w - 40));
  const h = Math.round(Math.min(saved?.h ?? 820, wa.h - 40));
  return { x: Math.round(wa.x + wa.w - w - 20), y: Math.round(wa.y + 20), w, h };
}

/**
 * Turns Nubby's window into a small page-only window and back. The page itself
 * (the CSS side) is handled by the app; this only moves and sizes the window.
 */
export const miniWindow = {
  async enter(onTop: boolean) {
    const win = appWindow;
    if (!win) return;
    const maximized = await win.isMaximized();
    if (maximized) {
      await win.unmaximize();
      await sleep(150); // let Windows put the window back to its normal size first
    }
    fullGeo = { ...(await windowGeo()), maximized };
    const g = await miniGeo();
    await win.setMinSize(new LogicalSize(MINI_MIN.w, MINI_MIN.h));
    await win.setSize(new LogicalSize(g.w, g.h));
    await win.setPosition(new LogicalPosition(g.x, g.y));
    await win.setAlwaysOnTop(onTop);
  },
  async exit() {
    const win = appWindow;
    if (!win) return;
    if (await win.isMaximized()) await win.unmaximize();
    else localStorage.setItem(MINI_GEO_KEY, JSON.stringify(await windowGeo()));
    await win.setAlwaysOnTop(false);
    const full = fullGeo ?? { x: 0, y: 0, w: 1280, h: 780, maximized: false };
    await win.setSize(new LogicalSize(Math.max(full.w, FULL_MIN.w), Math.max(full.h, FULL_MIN.h)));
    if (fullGeo) await win.setPosition(new LogicalPosition(full.x, full.y));
    else await win.center();
    await win.setMinSize(new LogicalSize(FULL_MIN.w, FULL_MIN.h));
    if (full.maximized) await win.maximize();
  },
  setOnTop: (on: boolean) => appWindow?.setAlwaysOnTop(on),
};

export async function openExternal(url: string) {
  if (!/^(https?:|mailto:|tel:)/i.test(url)) url = "https://" + url;
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

/** Opens File Explorer with the given file or folder selected. */
export async function revealInFolder(absPath: string) {
  if (!isTauri) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(absPath);
}
