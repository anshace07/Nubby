import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { Notebook } from "../lib/types";
import { timeAgo } from "../lib/util";
import { Cover } from "./Cover";
import { Icon } from "./Icon";
import { Menu, type MenuItem } from "./Menu";

type Sort = "shelf" | "recent" | "az";
const COVER_W = 146;
const GAP = 34;

export function Shelf({
  notebooks,
  order,
  onOpen,
  onNew,
  onEdit,
  onTrash,
  onReorder,
  onOpenFolder,
}: {
  notebooks: Notebook[];
  order: string[];
  onOpen: (nb: Notebook, pageId?: string | null) => void;
  onNew: () => void;
  onEdit: (nb: Notebook) => void;
  onTrash: (nb: Notebook) => void;
  onReorder: (ids: string[]) => void;
  onOpenFolder: () => void;
}) {
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem("nubby.sort") as Sort) || "shelf");
  const [heroHidden, setHeroHidden] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [cols, setCols] = useState(6);
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => localStorage.setItem("nubby.sort", sort), [sort]);

  useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 24;
      setCols(Math.max(2, Math.floor((w + GAP) / (COVER_W + GAP))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() => {
    const list = [...notebooks];
    if (sort === "recent") list.sort((a, b) => b.openedAt - a.openedAt);
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    else {
      const idx = new Map(order.map((id, i) => [id, i]));
      list.sort((a, b) => (idx.get(a.id) ?? -1) - (idx.get(b.id) ?? -1) || b.createdAt - a.createdAt);
    }
    return list;
  }, [notebooks, order, sort]);

  const recent = useMemo(
    () => [...notebooks].sort((a, b) => b.openedAt - a.openedAt)[0] ?? null,
    [notebooks],
  );

  const open = (nb: Notebook, pageId?: string | null) => {
    if (opening) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return onOpen(nb, pageId);
    setOpening(nb.id);
    setTimeout(() => {
      setOpening(null);
      onOpen(nb, pageId);
    }, 380);
  };

  const coverMenu = (nb: Notebook, x: number, y: number) =>
    setMenu({
      x,
      y,
      items: [
        { label: "Open", icon: "book", onClick: () => open(nb) },
        { label: "Edit name & cover", icon: "settings", onClick: () => onEdit(nb) },
        { label: "Move to Trash", icon: "trash", danger: true, onClick: () => onTrash(nb) },
      ],
    });

  // Rows of covers, each sitting on its own wooden plank.
  const cells: (Notebook | "new")[] = [...sorted, "new"];
  const rows: (Notebook | "new")[][] = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));

  const onDrop = (e: DragEvent, target: Notebook) => {
    e.preventDefault();
    if (!dragId || dragId === target.id) return;
    const ids = sorted.map((n) => n.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(target.id), 0, dragId);
    onReorder(ids);
    setDragId(null);
  };

  const recentPages = recent
    ? Object.entries(recent.pageInfo)
        .filter(([id]) => recent.pages.includes(id))
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
        .slice(0, 3)
    : [];
  const lastTitle =
    recent && recent.lastPageId ? recent.pageInfo[recent.lastPageId]?.title || "a fresh page" : "";

  return (
    <div className="sheet-scroll">
      <div className="column">
        <header className="shelf-head">
          <h1 className="h-ui">Notebooks</h1>
          <div className="row gap-12">
            <button className="btn" onClick={onOpenFolder} title="Open the Nubby folder in File Explorer">
              <Icon name="folder" size={17} /> Open folder
            </button>
            <button className="btn btn--primary" onClick={onNew}>
              <Icon name="plus" size={16} stroke={3} /> New notebook
            </button>
          </div>
        </header>

        <div className="row space-between mt-22">
          <div className="seg" role="tablist" aria-label="Sort notebooks">
            {(
              [
                ["shelf", "Shelf order"],
                ["recent", "Recent"],
                ["az", "A–Z"],
              ] as [Sort, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={sort === k}
                className={`seg__btn ${sort === k ? "seg__btn--on" : ""}`}
                onClick={() => setSort(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="muted small">
            {notebooks.length} notebook{notebooks.length === 1 ? "" : "s"}
            {sort === "shelf" && notebooks.length > 1 ? " · drag covers to reorder" : ""}
          </span>
        </div>

        {!heroHidden && (
          <section className="hero mt-22" aria-label={recent ? "Continue where you left off" : "Welcome"}>
            <div className="hero__blob hero__blob--a" />
            <div className="hero__blob hero__blob--b" />
            <div className="hero__blob hero__blob--c" />
            <div className="hero__blob hero__blob--d" />
            <div className="hero__veil" />
            <button className="hero__x" aria-label="Hide" onClick={() => setHeroHidden(true)}>
              <Icon name="x" size={12} stroke={2.2} />
            </button>
            <div className="hero__pages" aria-hidden>
              <div className="hero__page hero__page--back" />
              <div className="hero__page">
                <i className="hp-pill" />
                <i className="hp-line hp-purple" style={{ width: 168 }} />
                <i className="hp-line hp-purple" style={{ width: 146 }} />
                <i className="hp-pill" style={{ width: 84, marginTop: 9 }} />
                <i className="hp-line hp-red hp-center" style={{ width: 158 }} />
                <i className="hp-line hp-red hp-center" style={{ width: 126 }} />
                <span className="hp-row">
                  <i className="hp-img" />
                  <i className="hp-box" />
                </span>
              </div>
            </div>
            <div className="hero__text">
              {recent ? (
                <>
                  <h2 className="h-serif">
                    Pick up <em>where you left off</em>.
                  </h2>
                  <p className="hero__sub">
                    {recent.title} — {lastTitle ? `“${lastTitle}”` : "a fresh page"}, edited {timeAgo(recent.updatedAt)}.
                  </p>
                  {recentPages.length > 0 && (
                    <div className="chips">
                      {recentPages.map(([id, info]) => (
                        <button
                          key={id}
                          className={`chip ${id === recent.lastPageId ? "chip--on" : ""}`}
                          onClick={() => open(recent, id)}
                        >
                          <span className="chip__title">“{info.title || "Untitled page"}”</span>
                          <span className="chip__meta">p.{recent.pages.indexOf(id) + 1}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="btn btn--primary mt-18" onClick={() => open(recent, recent.lastPageId)}>
                    Continue writing <Icon name="arrowRight" size={16} stroke={2.6} />
                  </button>
                </>
              ) : (
                <>
                  <h2 className="h-serif">
                    A notebook that <em>feels like paper</em>.
                  </h2>
                  <p className="hero__sub">Typed notes, handwriting fonts, ink colours, sticky notes and pictures anywhere. All saved on this PC.</p>
                  <button className="btn btn--primary mt-18" onClick={onNew}>
                    Make your first notebook <Icon name="arrowRight" size={16} stroke={2.6} />
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        <section className="shelf mt-30" aria-label="On the shelf" ref={shelfRef}>
          <h2 className="h-section">
            On the shelf <span className="muted">· {notebooks.length}</span>
          </h2>
          {rows.map((row, ri) => (
            <div className="shelf-row" key={ri}>
              <div className="shelf-row__covers" style={{ gridTemplateColumns: `repeat(${cols}, ${COVER_W}px)` }}>
                {row.map((cell) =>
                  cell === "new" ? (
                    <button key="new" className="cover-new" onClick={onNew}>
                      <span className="cover-new__plus">
                        <Icon name="plus" size={20} stroke={3} />
                      </span>
                      New notebook
                    </button>
                  ) : (
                    <div
                      key={cell.id}
                      className={`cover-cell ${opening === cell.id ? "is-opening" : ""} ${dragId === cell.id ? "is-dragging" : ""}`}
                      draggable={sort === "shelf"}
                      onDragStart={(e) => {
                        setDragId(cell.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => dragId && e.preventDefault()}
                      onDrop={(e) => onDrop(e, cell)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        coverMenu(cell, e.clientX, e.clientY);
                      }}
                    >
                      <button className="cover-btn" aria-label={`Open ${cell.title}`} onClick={() => open(cell, cell.lastPageId)}>
                        <Cover cover={cell.cover} title={cell.title} subtitle={cell.subtitle} width={COVER_W} />
                      </button>
                      <button
                        className="cover-more"
                        aria-label={`More for ${cell.title}`}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          coverMenu(cell, r.left, r.bottom + 4);
                        }}
                      >
                        <Icon name="more" size={16} stroke={2.4} />
                      </button>
                    </div>
                  ),
                )}
              </div>
              <div className="plank" />
              <div className="shelf-row__captions" style={{ gridTemplateColumns: `repeat(${cols}, ${COVER_W}px)` }}>
                {row.map((cell) =>
                  cell === "new" ? (
                    <div key="new" />
                  ) : (
                    <div key={cell.id} className="caption">
                      <div className="caption__title">{cell.title || "Untitled"}</div>
                      <div className="caption__meta">
                        {cell.pages.length} page{cell.pages.length === 1 ? "" : "s"} · {timeAgo(cell.updatedAt)}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </section>
        <div style={{ height: 60 }} />
      </div>
      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
