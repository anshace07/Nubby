import { useEffect, useState, type MouseEvent } from "react";
import { isMac, keys, windowControls } from "../lib/platform";
import { isTauri } from "../lib/storage";
import { Icon } from "./Icon";

/** Custom title bar: sidebar toggle on the left, theme + window buttons on the right. */
export function TitleBar({
  night,
  onToggleNight,
  onToggleSidebar,
  onPopOut,
  saveState,
}: {
  night: boolean;
  onToggleNight: () => void;
  onToggleSidebar: () => void;
  /** Shown while a notebook is open: shrink to the page-only mini window. */
  onPopOut?: () => void;
  saveState: "saved" | "saving" | "error";
}) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let off: (() => void) | undefined;
    const sync = () => windowControls.isMaximized().then(setMaximized).catch(() => {});
    sync();
    windowControls.onResized(sync).then((un) => (off = un));
    return () => off?.();
  }, []);

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (e.detail === 2) void windowControls.toggleMaximize();
    else void windowControls.startDragging();
  };

  return (
    <div className="titlebar" onMouseDown={onMouseDown}>
      <button className="tb-btn" aria-label="Toggle sidebar" title={keys("Toggle sidebar (Ctrl+\\)")} onClick={onToggleSidebar}>
        <Icon name="sidebar" size={18} />
      </button>
      <div className="titlebar__save" aria-live="polite">
        {saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn't save — retrying" : ""}
      </div>
      <div className="titlebar__right">
        {onPopOut && (
          <button className="tb-pill" title={keys("Pop the page out into a small window you can keep beside a video (Ctrl+Shift+M)")} onClick={onPopOut}>
            <Icon name="popOut" size={15} stroke={2} />
            Pop out
          </button>
        )}
        <button
          className="tb-btn"
          aria-label={night ? "Switch to day desk" : "Switch to night desk"}
          title={night ? "Day desk" : "Night desk"}
          onClick={onToggleNight}
        >
          <Icon name={night ? "sun" : "moon"} size={18} />
        </button>
        {isTauri && !isMac && (
          <div className="winctl">
            <button aria-label="Minimise" onClick={() => windowControls.minimize()}>
              <Icon name="minimize" size={14} stroke={1.5} />
            </button>
            <button aria-label={maximized ? "Restore" : "Maximise"} onClick={() => windowControls.toggleMaximize()}>
              <Icon name={maximized ? "restore" : "maximize"} size={13} stroke={1.5} />
            </button>
            <button className="winctl__close" aria-label="Close" onClick={() => windowControls.close()}>
              <Icon name="x" size={14} stroke={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
