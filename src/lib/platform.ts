/** Thin wrappers over the desktop shell, with harmless browser fallbacks. */
import { getCurrentWindow } from "@tauri-apps/api/window";
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
