import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { STICKY_COLORS } from "../lib/catalog";
import { assetUrl } from "../lib/repo";
import type { CanvasItem, StickyColor, StickyItem } from "../lib/types";
import { clamp, isTypingTarget, mimeFromName } from "../lib/util";
import { Icon } from "./Icon";

type Corner = "nw" | "ne" | "sw" | "se";
interface Guides {
  v: number[];
  h: number[];
}

const SNAP = 6;

/** Height of a sticky note's glued strip: all that stays on the page when it's folded up. */
export const STICKY_TAB = 36;

/** Height an item actually covers on the page (a folded sticky is just its strip). */
export const visibleH = (i: CanvasItem) => (i.kind === "sticky" && i.folded ? STICKY_TAB : i.h);

/** Picture stored in the notebook's assets folder, shown through a blob: URL. */
export function AssetImage({ dir, name }: { dir: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    assetUrl(dir, name, mimeFromName(name))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(""));
    return () => {
      alive = false;
    };
  }, [dir, name]);
  if (url === null) return <div className="item-img__loading" />;
  if (url === "") return <div className="item-img__missing">picture missing</div>;
  return <img src={url} alt="" draggable={false} />;
}

function snapMove(
  x: number,
  y: number,
  w: number,
  h: number,
  others: CanvasItem[],
  width: number,
  margin: number,
): { x: number; y: number; guides: Guides } {
  const vT = [width / 2, margin, width - margin];
  const hT: number[] = [];
  for (const o of others) {
    const oh = visibleH(o);
    vT.push(o.x, o.x + o.w, o.x + o.w / 2);
    hT.push(o.y, o.y + oh, o.y + oh / 2);
  }
  let dx = Infinity;
  let vLine: number | null = null;
  for (const t of vT) {
    for (const edge of [x, x + w, x + w / 2]) {
      const d = t - edge;
      if (Math.abs(d) <= SNAP && Math.abs(d) < Math.abs(dx)) {
        dx = d;
        vLine = t;
      }
    }
  }
  let dy = Infinity;
  let hLine: number | null = null;
  for (const t of hT) {
    for (const edge of [y, y + h, y + h / 2]) {
      const d = t - edge;
      if (Math.abs(d) <= SNAP && Math.abs(d) < Math.abs(dy)) {
        dy = d;
        hLine = t;
      }
    }
  }
  return {
    x: x + (Number.isFinite(dx) ? dx : 0),
    y: y + (Number.isFinite(dy) ? dy : 0),
    guides: { v: vLine == null ? [] : [vLine], h: hLine == null ? [] : [hLine] },
  };
}

export function CanvasLayer({
  items,
  assetDir,
  width,
  margin,
  scale = 1,
  selectedId,
  focusId,
  onSelect,
  onChange,
  onDelete,
  onCopy,
  onDuplicate,
}: {
  items: CanvasItem[];
  assetDir: string;
  width: number;
  margin: number;
  /** How much the page is scaled on screen (the mini window shrinks it to fit). */
  scale?: number;
  selectedId: string | null;
  /** sticky note whose text box should take focus once (just created) */
  focusId: string | null;
  onSelect: (id: string | null) => void;
  /** `commit` = the change is finished (drop, resize end, typing) and should be saved */
  onChange: (items: CanvasItem[], commit: boolean) => void;
  onDelete: (item: CanvasItem) => void;
  onCopy: (item: CanvasItem) => void;
  onDuplicate: (item: CanvasItem) => void;
}) {
  const [draft, setDraft] = useState<CanvasItem | null>(null);
  const [guides, setGuides] = useState<Guides | null>(null);
  const [wobble, setWobble] = useState<string | null>(null);
  const textRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const shown = useMemo(() => {
    const list = draft ? items.map((i) => (i.id === draft.id ? draft : i)) : items;
    return [...list].sort((a, b) => a.z - b.z);
  }, [items, draft]);

  const selected = shown.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => textRefs.current.get(focusId)?.focus(), 30);
    return () => clearTimeout(t);
  }, [focusId]);

  const replace = (next: CanvasItem, commit: boolean) =>
    onChange(
      itemsRef.current.map((i) => (i.id === next.id ? next : i)),
      commit,
    );

  // Keyboard: delete, nudge, copy, duplicate, deselect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (isTypingTarget(document.activeElement)) return;
      const item = itemsRef.current.find((i) => i.id === selectedId);
      if (!item) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete(item);
      } else if (e.key === "Escape") {
        onSelect(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        onCopy(item);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        onDuplicate(item);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        replace({ ...item, x: item.x + dx, y: Math.max(0, item.y + dy) }, true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const startMove = (e: RPointerEvent<HTMLDivElement>, item: CanvasItem) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".item-handle, .item-tools, .sticky__ear, .sticky__unfold")) return;
    // Clicking into a focused sticky's text should select text, not drag.
    if (target.tagName === "TEXTAREA" && document.activeElement === target) return;
    e.preventDefault();
    e.stopPropagation();
    // Let Delete / arrows / Ctrl+C act on this item, not on the text behind it.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== target && isTypingTarget(active)) active.blur();
    onSelect(item.id);
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { ...item };
    const others = itemsRef.current.filter((i) => i.id !== item.id);
    let moved = false;
    let last: CanvasItem = orig;
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      moved = true;
      let x = orig.x + dx;
      let y = orig.y + dy;
      if (!ev.altKey) {
        const s = snapMove(x, y, orig.w, visibleH(orig), others, width, margin);
        x = s.x;
        y = s.y;
        setGuides(s.guides.v.length || s.guides.h.length ? s.guides : null);
      } else setGuides(null);
      x = clamp(x, -orig.w + 40, width - 40);
      y = Math.max(0, y);
      last = { ...orig, x: Math.round(x), y: Math.round(y) };
      setDraft(last);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setGuides(null);
      setDraft(null);
      if (moved) {
        replace(last, true);
        if (orig.kind === "sticky") {
          setWobble(orig.id);
          setTimeout(() => setWobble((w) => (w === orig.id ? null : w)), 420);
        }
      } else if (orig.kind === "sticky" && !orig.folded) {
        textRefs.current.get(orig.id)?.focus();
      }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const startResize = (e: RPointerEvent<HTMLSpanElement>, item: CanvasItem, corner: Corner) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { ...item };
    const minW = orig.kind === "image" ? 48 : 130;
    const minH = orig.kind === "image" ? 30 : 100;
    let last: CanvasItem = orig;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      const left = corner === "nw" || corner === "sw";
      const top = corner === "nw" || corner === "ne";
      let w = Math.max(minW, orig.w + (left ? -dx : dx));
      let h: number;
      if (orig.kind === "image") {
        h = w / (orig.ratio || orig.w / orig.h);
      } else {
        h = Math.max(minH, orig.h + (top ? -dy : dy));
      }
      w = Math.min(w, width * 1.2);
      const x = left ? orig.x + orig.w - w : orig.x;
      const y = top ? orig.y + orig.h - h : orig.y;
      last = { ...orig, x: Math.round(x), y: Math.round(Math.max(0, y)), w: Math.round(w), h: Math.round(h) };
      setDraft(last);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDraft(null);
      replace(last, true);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const setFolded = (item: StickyItem, folded: boolean) => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".item-sticky")) active.blur();
    replace({ ...item, folded }, true);
  };

  // Undo the page's scaling for the selection chrome so it stays easy to hit.
  const unzoom = scale !== 1 ? 1 / scale : undefined;

  // Keep the item's tool pill over the page, even for items at the edge of a narrow window.
  const toolsEl = useRef<HTMLDivElement>(null);
  const [toolsW, setToolsW] = useState(0);
  useLayoutEffect(() => {
    setToolsW(toolsEl.current?.offsetWidth ?? 0);
  }, [selectedId, selected?.kind, scale, draft === null]);
  const toolsLeft = (it: CanvasItem) => {
    const layerW = width * scale;
    const half = toolsW / 2 + 4;
    const c = (it.x + it.w / 2) * scale;
    return layerW <= 2 * half ? layerW / 2 : clamp(c, half, layerW - half);
  };

  const bringFront = (item: CanvasItem) => {
    const maxZ = Math.max(0, ...itemsRef.current.map((i) => i.z));
    replace({ ...item, z: maxZ + 1 }, true);
  };

  return (
    <div className="canvas-layer">
      {shown.map((item) => {
        const isSel = item.id === selectedId;
        const dragging = draft?.id === item.id;
        const style = {
          left: item.x,
          top: item.y,
          width: item.w,
          height: item.h,
          zIndex: 10 + item.z,
          "--rot": `${item.rot}deg`,
        } as React.CSSProperties;
        if (item.kind === "image") {
          return (
            <div
              key={item.id}
              className={`item item-img ${isSel ? "is-selected" : ""} ${dragging ? "is-dragging" : ""}`}
              style={style}
              onPointerDown={(e) => startMove(e, item)}
            >
              <AssetImage dir={assetDir} name={item.asset} />
              {isSel && <Handles item={item} onResize={startResize} unzoom={unzoom} />}
            </div>
          );
        }
        return (
          <div
            key={item.id}
            className={`item item-sticky item-sticky--${item.color} ${item.folded ? "is-folded" : ""} ${isSel ? "is-selected" : ""} ${dragging ? "is-dragging" : ""} ${wobble === item.id ? "wobble" : ""}`}
            style={{
              ...style,
              height: visibleH(item),
              // Turn around the whole note's centre, folded or not, so folding never shifts it.
              transformOrigin: `${item.w / 2}px ${item.h / 2}px`,
            }}
            onPointerDown={(e) => startMove(e, item)}
            onDoubleClick={() => item.folded && setFolded(item, false)}
          >
            <StickyNote
              item={item}
              textRef={(el) => {
                if (el) textRefs.current.set(item.id, el);
                else textRefs.current.delete(item.id);
              }}
              onFocusText={() => onSelect(item.id)}
              onText={(text) => replace({ ...item, text }, true)}
              onFold={(folded) => setFolded(item, folded)}
            />
            {isSel && <Handles item={item} onResize={startResize} resizable={!item.folded} unzoom={unzoom} />}
          </div>
        );
      })}

      {selected && !draft && (
        <div
          ref={toolsEl}
          className="item-tools nb-noexport"
          style={{
            left: toolsLeft(selected),
            top: Math.max(4, selected.y * scale - 50),
            zIndex: 100000,
            zoom: unzoom,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {selected.kind === "sticky" &&
            STICKY_COLORS.map((c) => (
              <button
                key={c.id}
                className={`item-tools__dot ${selected.color === c.id ? "is-on" : ""}`}
                style={{ background: c.color }}
                aria-label={`${c.name} sticky note`}
                title={c.name}
                onClick={() => replace({ ...selected, color: c.id as StickyColor }, true)}
              />
            ))}
          {selected.kind === "sticky" && (
            <button
              className="item-tools__btn"
              title={selected.folded ? "Unfold (or double-click the note)" : "Fold up, to see the page underneath"}
              aria-label={selected.folded ? "Unfold sticky note" : "Fold up sticky note"}
              onClick={() => setFolded(selected, !selected.folded)}
            >
              <Icon name={selected.folded ? "foldDown" : "foldUp"} size={17} />
            </button>
          )}
          {selected.kind === "image" && (
            <button className="item-tools__btn" title="Copy picture (Ctrl+C)" onClick={() => onCopy(selected)}>
              <Icon name="copy" size={16} />
            </button>
          )}
          <button className="item-tools__btn" title="Duplicate (Ctrl+D)" onClick={() => onDuplicate(selected)}>
            <Icon name="plus" size={16} />
          </button>
          <button className="item-tools__btn" title="Bring to front" onClick={() => bringFront(selected)}>
            <Icon name="front" size={16} />
          </button>
          <button className="item-tools__btn item-tools__btn--danger" title="Delete (Del)" onClick={() => onDelete(selected)}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      )}

      {guides && (
        <div className="guides nb-noexport" aria-hidden>
          {guides.v.map((x) => (
            <div key={`v${x}`} className="guide guide--v" style={{ left: x }} />
          ))}
          {guides.h.map((y) => (
            <div key={`h${y}`} className="guide guide--h" style={{ top: y }} />
          ))}
        </div>
      )}
      {draft && (draft.kind === "image" || (selectedId === draft.id && !draft.folded)) && (
        <div
          className="size-chip nb-noexport"
          style={{ left: draft.x + draft.w, top: draft.y + visibleH(draft) + 10, zIndex: 100001 }}
        >
          {Math.round(draft.w)} × {Math.round(draft.h)}
        </div>
      )}
    </div>
  );
}

function Handles({
  item,
  onResize,
  resizable = true,
  unzoom,
}: {
  item: CanvasItem;
  onResize: (e: RPointerEvent<HTMLSpanElement>, item: CanvasItem, corner: Corner) => void;
  resizable?: boolean;
  unzoom?: number;
}) {
  return (
    <>
      <span className="item-outline nb-noexport" style={{ zoom: unzoom }} />
      {resizable && (["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
        <span
          key={c}
          style={{ zoom: unzoom }}
          className={`item-handle item-handle--${c} nb-noexport`}
          onPointerDown={(e) => onResize(e, item, c)}
        />
      ))}
    </>
  );
}

/**
 * A paper sticky note. Open, it's a sheet you type on with a curled-up corner;
 * click the corner (or Fold in the tools) and it folds up like an accordion into
 * its glued strip, so whatever is written underneath shows through again.
 *
 * While folding, the sheet is drawn as three slices of the same paper: the glued
 * strip, and two panels hinged in 3D. The top panel tips towards you and the
 * bottom one folds back the other way, so the bottom edge slides up along the
 * page and the crease pops out (a tent fold). Everything is driven by one
 * animated number, --fold (0 = open, 1 = folded), in page.css.
 */
function StickyNote({
  item,
  textRef,
  onFocusText,
  onText,
  onFold,
}: {
  item: StickyItem;
  textRef: (el: HTMLTextAreaElement | null) => void;
  onFocusText: () => void;
  onText: (text: string) => void;
  onFold: (folded: boolean) => void;
}) {
  const folded = !!item.folded;
  // Keep the 3D panels on screen while the fold or unfold is playing.
  const [shownFolded, setShownFolded] = useState(folded);
  const [moving, setMoving] = useState(false);
  if (shownFolded !== folded) {
    setShownFolded(folded);
    setMoving(true);
  }
  useEffect(() => {
    if (!moving) return;
    const t = window.setTimeout(() => setMoving(false), 1200); // in case transitionend never comes
    return () => window.clearTimeout(t);
  }, [moving, folded]);

  const body = item.h - STICKY_TAB;
  const topH = Math.round(body / 2);
  const bottomH = body - topH;

  /** The whole note's paper and words, shifted up so a window `offset` px down shows its part. */
  const slice = (offset: number) => (
    <div className="sticky__slice" style={{ top: -offset, height: item.h }} aria-hidden>
      <div className="sticky__text sticky__text--static">{item.text}</div>
    </div>
  );

  return (
    <div
      className="sticky"
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && e.propertyName === "--fold") setMoving(false);
      }}
    >
      {!folded && !moving ? (
        <>
          <div className="sticky__paper">
            <textarea
              ref={textRef}
              className="sticky__text"
              value={item.text}
              placeholder="write something…"
              spellCheck
              onFocus={onFocusText}
              onChange={(e) => onText(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="sticky__ear"
            title="Fold up, to see the page underneath"
            aria-label="Fold up sticky note"
            onClick={() => onFold(true)}
          />
        </>
      ) : (
        <>
          <div className="sticky__tab">
            {slice(0)}
            <i className="sticky__crease" />
          </div>
          {moving && (
            <div className="sticky__flap sticky__flap--top" style={{ height: topH }}>
              <div className="sticky__face">
                {slice(STICKY_TAB)}
                <i className="sticky__shade" />
              </div>
              <div className="sticky__flap sticky__flap--bottom" style={{ height: bottomH }}>
                <div className="sticky__face sticky__face--corner">
                  {slice(STICKY_TAB + topH)}
                  <i className="sticky__shade" />
                </div>
                <i className="sticky__ear sticky__ear--still" />
              </div>
            </div>
          )}
          {folded && (
            <button
              type="button"
              className="sticky__unfold nb-noexport"
              title="Unfold (or double-click the note)"
              aria-label="Unfold sticky note"
              onClick={() => onFold(false)}
            >
              <Icon name="chevronDown" size={15} stroke={2.6} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
