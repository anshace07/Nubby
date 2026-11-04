/**
 * Developer-only smoke test for the desktop shell (never included in release
 * builds). Start with:  npm run tauri dev -- --config '{"build":{"devUrl":"http://localhost:1420/?selftest=1"}}'
 * It exercises every Rust command and window permission, writes
 * Nubby/selftest/result.json and closes the window.
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fsStore } from "./lib/storage";

export async function runSelfTest() {
  const results: Record<string, { ok: boolean; value?: unknown; error?: string }> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      results[name] = { ok: true, value: await fn() };
    } catch (e) {
      results[name] = { ok: false, error: String(e) };
    }
  };
  const win = getCurrentWindow();
  await step("root", () => fsStore.root());
  await step("writeText", () => fsStore.writeText("selftest/a.json", JSON.stringify({ hello: "wörld ✓" })));
  await step("readText", () => fsStore.readText("selftest/a.json"));
  await step("readMissing", () => fsStore.readText("selftest/missing.json"));
  await step("list", () => fsStore.list("selftest"));
  const bytes = new Uint8Array([137, 80, 78, 71, 0, 1, 2, 255]);
  await step("writeBytes", () => fsStore.writeBytes("selftest/assets/x y ✓.png", bytes));
  await step("readBytes", async () => Array.from(await fsStore.readBytes("selftest/assets/x y ✓.png")));
  await step("seedPage", () =>
    fsStore.writeText(
      "notebooks/selftestnb/pages/p1.json",
      JSON.stringify({ text: "Unbalanced forces are like a friendly Tug of War between two teams." }),
    ),
  );
  await step("search", () => fsStore.search("tug of"));
  await step("traversalBlocked", async () => {
    try {
      await fsStore.readText("../outside.txt");
      return "NOT BLOCKED";
    } catch (e) {
      return "blocked: " + String(e);
    }
  });
  await step("removeNotebook", () => fsStore.remove("notebooks/selftestnb"));
  await step("removeAssets", () => fsStore.remove("selftest/assets"));
  await step("isMaximized", () => win.isMaximized());
  await step("toggleMaximize", () => win.toggleMaximize());
  await step("isMaximizedAfter", () => win.isMaximized());
  await step("opener", async () => {
    const mod = await import("@tauri-apps/plugin-opener");
    return typeof mod.openUrl;
  });
  await fsStore.writeText("selftest/result.json", JSON.stringify(results, null, 2));
  // Goes through the app's close handler (saves everything, then destroys the window).
  setTimeout(() => void win.close(), 300);
}
