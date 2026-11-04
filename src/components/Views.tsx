import { useEffect, useMemo, useRef, useState } from "react";
import { STICKY_COLORS } from "../lib/catalog";
import { BOARD_ASSETS, loadBoard, primeAssetUrl, saveAsset, saveBoard } from "../lib/repo";
import { toast } from "../lib/toasts";
import type { CanvasItem, Notebook, StickyItem } from "../lib/types";
import { extFromMime, mimeFromName, newId, timeAgo } from "../lib/util";
import { CanvasLayer } from "./CanvasLayer";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

/* ------------------------------- Recent ------------------------------- */

export function RecentView({
  notebooks,
  onOpen,
}: {
  notebooks: Notebook[];
  onOpen: (nb: Notebook, pageId: string) => void;
}) {
  const rows = useMemo(() => {
    const out: { nb: Notebook; id: string; title: string; updatedAt: number; n: number }[] = [];
    for (const nb of notebooks) {
      nb.pages.forEach((id, i) => {
        const info = nb.pageInfo[id];
        if (info) out.push({ nb, id, title: info.title, updatedAt: info.updatedAt, n: i + 1 });
      });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
  }, [notebooks]);

  return (
    <div className="sheet-scroll">
      <div className="column column--narrow">
        <h1 className="h-serif h-serif--page">
          Recently <em>written</em>.
        </h1>
        <p className="muted mt-6">Your last 40 pages, newest first.</p>
        <div className="list mt-22">
          {rows.length === 0 && <p className="empty">Nothing here yet — open a notebook and start typing.</p>}
          {rows.map((r) => (
            <button key={r.nb.id + r.id} className="list-row" onClick={() => onOpen(r.nb, r.id)}>
              <Cover cover={r.nb.cover} title={r.nb.title} width={34} className="cover--mini" />
              <span className="list-row__main">
                <span className="list-row__title">{r.title || "Untitled page"}</span>
                <span className="list-row__meta">
                  {r.nb.title} · page {r.n}
                </span>
              </span>
              <span className="list-row__time">{timeAgo(r.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Trash -------------------------------- */

export function TrashView({
  notebooks,
  onRestore,
  onDeleteForever,
}: {
  notebooks: Notebook[];
  onRestore: (nb: Notebook) => void;
  onDeleteForever: (nb: Notebook) => void;
}) {
  const [confirm, setConfirm] = useState<Notebook | "all" | null>(null);
  return (
    <div className="sheet-scroll">
      <div className="column column--narrow">
        <div className="row space-between align-end">
          <div>
            <h1 className="h-serif h-serif--page">
              The <em>bin</em>.
            </h1>
            <p className="muted mt-6">Notebooks you threw away. Nothing is deleted until you say so.</p>
          </div>
          {notebooks.length > 0 && (
            <button className="btn" onClick={() => setConfirm("all")}>
              <Icon name="trash" size={16} /> Empty trash
            </button>
          )}
        </div>
        <div className="list mt-22">
          {notebooks.length === 0 && <p className="empty">The trash is empty.</p>}
          {notebooks.map((nb) => (
            <div key={nb.id} className="list-row list-row--static">
              <Cover cover={nb.cover} title={nb.title} width={34} className="cover--mini" />
              <span className="list-row__main">
                <span className="list-row__title">{nb.title}</span>
                <span className="list-row__meta">
                  {nb.pages.length} pages · thrown away {timeAgo(nb.trashedAt ?? nb.updatedAt)}
                </span>
              </span>
              <button className="btn btn--sm" onClick={() => onRestore(nb)}>
                Restore
              </button>
              <button className="btn btn--sm btn--danger" onClick={() => setConfirm(nb)}>
                Delete forever
              </button>
            </div>
          ))}
        </div>
      </div>
      {confirm && (
        <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="dialog rise-in" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title" className="h-serif h-serif--dialog">
              Delete <em>for good</em>?
            </h2>
            <p className="muted">
              {confirm === "all"
                ? `All ${notebooks.length} notebooks in the trash, with their pages and pictures, will be removed from this PC.`
                : `“${confirm.title}”, its pages and its pictures will be removed from this PC.`}{" "}
              This can't be undone.
            </p>
            <div className="row gap-12 justify-end mt-22">
              <button className="btn btn--ghost" onClick={() => setConfirm(null)}>
                Keep
              </button>
              <button
                className="btn btn--danger-solid"
                onClick={() => {
                  if (confirm === "all") notebooks.forEach(onDeleteForever);
                  else onDeleteForever(confirm);
                  setConfirm(null);
                }}
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Sticky board ----------------------------- */

const BOARD_W = 1600;
const BOARD_H = 1100;

export function BoardView() {
  const [items, setItems] = useState<CanvasItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const itemsRef = useRef<CanvasItem[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let loadedOk = false;
    loadBoard().then((b) => {
      loadedOk = true;
      itemsRef.current = b.items;
      setItems(b.items);
    });
    const onFlush = () => loadedOk && saveBoard(itemsRef.current);
    window.addEventListener("nubby:flush", onFlush);
    return () => {
      window.removeEventListener("nubby:flush", onFlush);
      window.clearTimeout(timer.current);
      if (loadedOk) saveBoard(itemsRef.current);
    };
  }, []);

  const change = (next: CanvasItem[], commit: boolean) => {
    itemsRef.current = next;
    setItems(next);
    if (commit) {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => saveBoard(itemsRef.current), 300);
    }
  };

  const maxZ = (items ?? []).reduce((m, i) => Math.max(m, i.z), 0);

  const addSticky = (color: StickyItem["color"]) => {
    const n = (items ?? []).length;
    const item: StickyItem = {
      id: newId(),
      kind: "sticky",
      x: 60 + ((n * 230) % 1300),
      y: 60 + Math.floor((n * 230) / 1300) * 220,
      w: 210,
      h: 180,
      rot: Number(((Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2)).toFixed(1)),
      z: maxZ + 1,
      color,
      text: "",
    };
    change([...(items ?? []), item], true);
    setSelectedId(item.id);
    setFocusId(item.id);
  };

  const addImages = async (files: File[]) => {
    const added: CanvasItem[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = await saveAsset(BOARD_ASSETS, bytes, extFromMime(file.type || mimeFromName(file.name)));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.type || mimeFromName(name) }));
      primeAssetUrl(BOARD_ASSETS, name, url);
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.4;
      const w = Math.min(img.naturalWidth || 320, 360);
      added.push({ id: newId(), kind: "image", x: 80 + added.length * 30, y: 80 + added.length * 30, w, h: Math.round(w / ratio), rot: 0, z: maxZ + 1 + added.length, asset: name, ratio });
    }
    if (added.length) {
      change([...(itemsRef.current ?? []), ...added], true);
      toast({ text: "Pasted ✓" });
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      void addImages(files);
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  });

  return (
    <div className="sheet-scroll board-wrap">
      <div className="column">
        <div className="row space-between align-end">
          <div>
            <h1 className="h-serif h-serif--page">
              Sticky <em>board</em>.
            </h1>
            <p className="muted mt-6">Loose notes that don't belong to any notebook yet.</p>
          </div>
          <div className="row gap-8">
            {STICKY_COLORS.map((c) => (
              <button key={c.id} className="btn btn--sm" onClick={() => addSticky(c.id)} title={`New ${c.name.toLowerCase()} sticky note`}>
                <span className="dot dot--lg" style={{ background: c.color }} /> {c.name}
              </button>
            ))}
            <button className="btn btn--sm" onClick={() => fileInput.current?.click()}>
              <Icon name="image" size={16} /> Picture
            </button>
          </div>
        </div>
      </div>
      <div className="board" style={{ width: BOARD_W, height: BOARD_H }} onPointerDown={(e) => !(e.target as HTMLElement).closest(".item, .item-tools") && setSelectedId(null)}>
        {items && items.length === 0 && (
          <p className="board__empty">Pick a colour above to drop your first sticky note.</p>
        )}
        {items && (
          <CanvasLayer
            items={items}
            assetDir={BOARD_ASSETS}
            width={BOARD_W}
            margin={40}
            selectedId={selectedId}
            focusId={focusId}
            onSelect={setSelectedId}
            onChange={change}
            onDelete={(item) => {
              change(itemsRef.current.filter((i) => i.id !== item.id), true);
              setSelectedId(null);
              toast({ text: "Removed", kind: "info", action: { label: "Undo", run: () => change([...itemsRef.current, item], true) } });
            }}
            onCopy={() => toast({ text: "Use Duplicate to copy on the board", kind: "info" })}
            onDuplicate={(item) => change([...itemsRef.current, { ...item, id: newId(), x: item.x + 24, y: item.y + 24, z: maxZ + 1 } as CanvasItem], true)}
          />
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addImages(files);
        }}
      />
    </div>
  );
}
