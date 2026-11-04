import { useEffect, useMemo, useRef, useState } from "react";
import { searchPages, storageRoot } from "../lib/repo";
import { isTauri } from "../lib/storage";
import { TURN, isMac, keys, revealInFolder } from "../lib/platform";
import type { Notebook, SearchHit } from "../lib/types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

/* ------------------------------ Search ------------------------------ */

type Result =
  | { kind: "notebook"; nb: Notebook }
  | { kind: "page"; nb: Notebook; pageId: string; snippet: string; title: string };

function Highlighted({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchPalette({
  notebooks,
  onClose,
  onOpen,
}: {
  notebooks: Notebook[];
  onClose: () => void;
  onOpen: (nb: Notebook, pageId: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) return setHits([]);
      searchPages(q).then(setHits).catch(() => setHits([]));
    }, 140);
    return () => clearTimeout(t);
  }, [q]);

  const byId = useMemo(() => new Map(notebooks.map((n) => [n.id, n])), [notebooks]);
  const results: Result[] = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out: Result[] = [];
    if (ql) {
      for (const nb of notebooks) if (nb.title.toLowerCase().includes(ql)) out.push({ kind: "notebook", nb });
    }
    for (const h of hits) {
      const nb = byId.get(h.notebookId);
      if (!nb || !nb.pages.includes(h.pageId)) continue;
      out.push({ kind: "page", nb, pageId: h.pageId, snippet: h.snippet, title: nb.pageInfo[h.pageId]?.title || "Untitled page" });
    }
    return out.slice(0, 50);
  }, [q, hits, notebooks, byId]);

  useEffect(() => setSel(0), [q]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    if (r.kind === "notebook") onOpen(r.nb, r.nb.lastPageId);
    else onOpen(r.nb, r.pageId);
  };

  return (
    <div className="scrim scrim--top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette rise-in" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette__input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search every page…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") choose(results[sel]);
            }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div className="palette__list">
          {!q.trim() && <p className="empty">Type a word you remember writing.</p>}
          {q.trim() && results.length === 0 && <p className="empty">No pages mention “{q}”.</p>}
          {results.map((r, i) => (
            <button
              key={r.kind === "notebook" ? "n" + r.nb.id : r.nb.id + r.pageId}
              className={`palette__row ${i === sel ? "is-sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(r)}
            >
              <Cover cover={r.nb.cover} title={r.nb.title} width={30} className="cover--mini" />
              {r.kind === "notebook" ? (
                <span className="palette__main">
                  <span className="palette__title">
                    <Highlighted text={r.nb.title} q={q} />
                  </span>
                  <span className="palette__meta">Notebook · {r.nb.pages.length} pages</span>
                </span>
              ) : (
                <span className="palette__main">
                  <span className="palette__title">{r.title}</span>
                  <span className="palette__snippet">
                    <Highlighted text={r.snippet} q={q.trim()} />
                  </span>
                  <span className="palette__meta">
                    {r.nb.title} · page {r.nb.pages.indexOf(r.pageId) + 1}
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Settings ------------------------------ */

export function SettingsSheet({
  night,
  setNight,
  onClose,
}: {
  night: boolean;
  setNight: (n: boolean) => void;
  onClose: () => void;
}) {
  const [root, setRoot] = useState("");
  useEffect(() => {
    storageRoot().then(setRoot).catch(() => setRoot(""));
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog--wide rise-in" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="row space-between align-start">
          <h2 id="settings-title" className="h-serif h-serif--dialog">
            <em>Settings</em>.
          </h2>
          <button className="icon-btn icon-btn--ink" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={14} stroke={2.4} />
          </button>
        </div>

        <div className="setting">
          <div>
            <p className="setting__title">Desk</p>
            <p className="setting__sub">Night desk dims the room. The paper stays paper.</p>
          </div>
          <div className="seg">
            <button className={`seg__btn ${!night ? "seg__btn--on" : ""}`} onClick={() => setNight(false)}>
              <Icon name="sun" size={15} /> Day
            </button>
            <button className={`seg__btn ${night ? "seg__btn--on" : ""}`} onClick={() => setNight(true)}>
              <Icon name="moon" size={15} /> Night
            </button>
          </div>
        </div>

        <div className="setting">
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="setting__title">Where your notes live</p>
            <p className="setting__sub">Plain files you own — one folder per notebook, one file per page. Back this folder up and you've backed up everything.</p>
            <code className="path">{root || "…"}</code>
          </div>
          {isTauri && (
            <button className="btn" onClick={() => root && revealInFolder(root)}>
              <Icon name="folder" size={16} /> Open folder
            </button>
          )}
        </div>

        <div className="setting setting--last">
          <div>
            <p className="setting__title">About Nubby</p>
            <p className="setting__sub">Version 0.1.3 · free, local and offline · no accounts, no tracking.</p>
          </div>
          <img src="/nubby-mark-96.png" alt="" width={44} height={44} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Help -------------------------------- */

const SHORTCUTS: [string, string][] = [
  ["## then space", "Big title with a marker swipe"],
  ["# then space", "Peach heading pill"],
  ["### then space", "Subheading with a wavy line"],
  ["Ctrl Alt 0", "Back to normal text"],
  ["LP: then space", "Green L.P. tag"],
  ["> then space", "Dashed box"],
  ["- then space", "Bullet list"],
  ["1. then space", "Numbered list"],
  ["[ ] then space", "Checklist"],
  ["->", "Arrow →"],
  ["Ctrl B / I / U", "Bold, italic, underline"],
  ["Ctrl 1 … 5", "Black, blue, red, purple, green ink"],
  ["Ctrl Shift H", "Highlight"],
  ["Ctrl Shift L", "Label tag"],
  ["Ctrl V", "Paste a picture onto the page"],
  ["Ctrl Shift I", "Import a picture"],
  ["Ctrl Shift N", "New sticky note"],
  ["Click its corner", "Fold a sticky up to see under it"],
  ["Double-click", "Open a folded sticky again"],
  ["Ctrl N", "New page"],
  ["Ctrl Shift M", "Pop the page out into a mini window, and back"],
  ["Alt ← / →", "Turn the page"],
  ["Ctrl K", "Search every page"],
  ["Ctrl P", "Save page as PDF"],
  ["Ctrl Shift E", "Save page as PNG"],
  ["Ctrl click", "Open a link"],
  ["Del", "Delete the selected picture / sticky"],
  ["Ctrl + / Ctrl −", "Zoom the whole app"],
];

export function HelpSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog--wide rise-in" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="row space-between align-start">
          <h2 id="help-title" className="h-serif h-serif--dialog">
            Type, <em>don't click</em>.
          </h2>
          <button className="icon-btn icon-btn--ink" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={14} stroke={2.4} />
          </button>
        </div>
        <div className="shortcuts">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="shortcut">
              <kbd className="kbd kbd--ink">{k === "Alt ← / →" ? TURN.both : k === "Del" && isMac ? "⌫" : keys(k)}</kbd>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
