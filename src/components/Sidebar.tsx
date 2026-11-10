import type { View } from "../lib/types";
import { keys } from "../lib/platform";
import { Icon } from "./Icon";

type NavKey = "shelf" | "recent" | "board" | "trash";

const NAV: { key: NavKey; label: string; icon: string }[] = [
  { key: "shelf", label: "Notebooks", icon: "book" },
  { key: "recent", label: "Recent", icon: "clock" },
  { key: "board", label: "Sticky board", icon: "sticky" },
];

export function Sidebar({
  view,
  collapsed,
  go,
  onSearch,
  onSettings,
  onHelp,
  trashCount,
  tipVisible,
  onDismissTip,
}: {
  view: View;
  collapsed: boolean;
  go: (v: View) => void;
  onSearch: () => void;
  onSettings: () => void;
  onHelp: () => void;
  trashCount: number;
  tipVisible: boolean;
  onDismissTip: () => void;
}) {
  const active: NavKey | null =
    view.name === "notebook" ? "shelf" : (view.name as NavKey);

  const item = (key: NavKey, label: string, icon: string, extra?: React.ReactNode) => (
    <button
      key={key}
      className={`nav ${active === key ? "nav--on" : ""}`}
      aria-current={active === key ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={() => go({ name: key } as View)}
    >
      <Icon name={icon} size={19} />
      {!collapsed && <span className="nav__label">{label}</span>}
      {!collapsed && extra}
    </button>
  );

  return (
    <nav className={`sidebar ${collapsed ? "sidebar--rail" : ""}`} aria-label="Main">
      <button className="brand" onClick={() => go({ name: "shelf" })} aria-label="Nubby — go to shelf">
        <img src="/nubby-mark-96.png" alt="" width={30} height={30} />
        {!collapsed && <span className="brand__word">Nubby</span>}
      </button>

      {NAV.map((n) => item(n.key, n.label, n.icon))}
      <button className="nav" title={collapsed ? keys("Search (Ctrl+K)") : undefined} onClick={onSearch}>
        <Icon name="search" size={19} />
        {!collapsed && <span className="nav__label">Search</span>}
        {!collapsed && <kbd className="kbd">{keys("Ctrl K")}</kbd>}
      </button>
      {item(
        "trash",
        "Trash",
        "trash",
        trashCount > 0 ? <span className="nav__count">{trashCount}</span> : null,
      )}

      <div className="sidebar__spacer" />

      {!collapsed && tipVisible && (
        <aside className="tipcard" aria-label="Tip">
          <button className="tipcard__x" aria-label="Dismiss tip" onClick={onDismissTip}>
            <Icon name="x" size={12} stroke={2.2} />
          </button>
          <p className="tipcard__title">Type, don't click</p>
          <p className="tipcard__body">
            Start a line with <kbd className="kbd kbd--ink">#</kbd> and a space for a peach heading,{" "}
            <kbd className="kbd kbd--ink">##</kbd> for a big title.{" "}
            <kbd className="kbd kbd--ink">LP:</kbd> makes a green tag. <kbd className="kbd kbd--ink">{keys("Ctrl V")}</kbd> drops a picture anywhere.
          </p>
          <button className="btn btn--sm" onClick={onHelp}>
            All shortcuts
          </button>
        </aside>
      )}

      <div className="sidebar__rule" />
      <button className="nav" title={collapsed ? "Settings" : undefined} onClick={onSettings}>
        <Icon name="settings" size={19} />
        {!collapsed && <span className="nav__label">Settings</span>}
      </button>
      <button className="nav" title={collapsed ? "Help & shortcuts" : undefined} onClick={onHelp}>
        <Icon name="help" size={19} />
        {!collapsed && <span className="nav__label">Help</span>}
      </button>
    </nav>
  );
}
