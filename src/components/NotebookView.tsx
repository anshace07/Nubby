import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { toPng } from "html-to-image";
import { PAGE_TYPES, PAPERS, fontById, paperBackground } from "../lib/catalog";
import { TURN, isMac, keys, notesPath, revealInFolder, windowControls } from "../lib/platform";
import {
  assetUrl,
  blankPage,
  deletePageFile,
  loadPage,
  nbAssets,
  primeAssetUrl,
  saveAsset,
  savePage,
  writeExport,
} from "../lib/repo";
import { isTauri } from "../lib/storage";
import { toast } from "../lib/toasts";
import type { CanvasItem, Notebook, Page, PageType, PaperColor, StickyItem } from "../lib/types";
import {
  clamp,
  extFromMime,
  isTypingTarget,
  mimeFromName,
  newId,
  pageDate,
  safeName,
  sleep,
  titleFromDoc,
} from "../lib/util";
import { CanvasLayer } from "./CanvasLayer";
import { Icon } from "./Icon";
import { Menu, type MenuItem } from "./Menu";
import { PageEditor } from "./PageEditor";
import { Toolbar } from "./Toolbar";

export const PAGE_W = 920;
const MARGIN = 48;
const MIN_PAGE_H = 1180;
const BASE_SIZE = 22;

type Dir = "next" | "prev" | "none";

function naturalSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 320, h: img.naturalHeight || 220 });
    img.onerror = () => resolve({ w: 320, h: 220 });
    img.src = url;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function toPngBlob(url: string): Promise<Blob> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}

export function NotebookView({
  notebook,
  pageId,
  night,
  update,
  goPage,
  onBack,
  onEditNotebook,
  mini = false,
  onPopOut,
  onPopIn,
  onTop = true,
  onToggleOnTop,
}: {
  notebook: Notebook;
  pageId: string | null;
  night: boolean;
  update: (fn: (nb: Notebook) => Notebook) => void;
  goPage: (pageId: string) => void;
  onBack: () => void;
  onEditNotebook: () => void;
  /** Page-only pop-out window: no side columns, page scaled to fit, compact tools. */
  mini?: boolean;
  onPopOut?: () => void;
  onPopIn?: () => void;
  onTop?: boolean;
  onToggleOnTop?: () => void;
}) {
  const currentId =
    pageId && notebook.pages.includes(pageId)
      ? pageId
      : notebook.lastPageId && notebook.pages.includes(notebook.lastPageId)
        ? notebook.lastPageId
        : notebook.pages[0];
  const idx = notebook.pages.indexOf(currentId);

  const [page, setPage] = useState<Page | null>(null);
  const pageRef = useRef<Page | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dir, setDir] = useState<Dir>("none");
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [dragPage, setDragPage] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState(false);
  const deskRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const copied = useRef<CanvasItem | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const metaTimer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);
  const stickyColor = useRef<StickyItem["color"]>("yellow");

  // In the mini window the whole page is scaled to fit the window's width.
  const [zoom, setZoom] = useState(1);
  const z = mini ? zoom : 1;
  useLayoutEffect(() => {
    const el = deskRef.current;
    if (!mini || !el) {
      setZoom(1);
      return;
    }
    const fit = () => setZoom(Math.round(clamp((el.clientWidth - 24) / PAGE_W, 0.3, 1.25) * 1000) / 1000);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mini]);

  const font = fontById(notebook.font);
  const baseSize = Math.round(BASE_SIZE * font.scale);
  const assetsDir = nbAssets(notebook.id);
  const paper: PaperColor = page?.paper ?? notebook.paper;
  const pageType: PageType = page?.pageType ?? notebook.pageType;

  /* ------------------------------ saving ------------------------------ */

  const flushSave = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    if (dirty.current && pageRef.current) {
      savePage(notebook.id, pageRef.current);
      dirty.current = false;
    }
  }, [notebook.id]);

  const touchMeta = useCallback(
    (delay = 900) => {
      window.clearTimeout(metaTimer.current);
      metaTimer.current = window.setTimeout(() => {
        const p = pageRef.current;
        if (!p) return;
        const title = titleFromDoc(p.doc, p.text);
        const now = Date.now();
        update((nb) => ({
          ...nb,
          updatedAt: now,
          pageInfo: {
            ...nb.pageInfo,
            [p.id]: { title, createdAt: p.createdAt, updatedAt: now },
          },
        }));
      }, delay);
    },
    [update],
  );

  const commitPage = useCallback(
    (next: Page, render = true) => {
      pageRef.current = next;
      if (render) setPage(next);
      dirty.current = true;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flushSave, 300);
    },
    [flushSave],
  );

  // The app asks every open page to save right before the window closes.
  useEffect(() => {
    const onFlush = () => flushSave();
    window.addEventListener("nubby:flush", onFlush);
    return () => window.removeEventListener("nubby:flush", onFlush);
  }, [flushSave]);

  /* ------------------------------ loading ----------------------------- */

  useEffect(() => {
    let alive = true;
    setSelectedId(null);
    setFocusId(null); // "type into the new sticky" is a one-off, not for every later visit
    loadPage(notebook.id, currentId).then((p) => {
      if (!alive) return;
      pageRef.current = p;
      setPage(p);
      deskRef.current?.scrollTo({ top: 0 });
    });
    update((nb) => (nb.lastPageId === currentId ? { ...nb, openedAt: Date.now() } : { ...nb, openedAt: Date.now(), lastPageId: currentId }));
    return () => {
      alive = false;
      flushSave();
      window.clearTimeout(metaTimer.current);
      const p = pageRef.current;
      if (p) {
        // keep the page list title fresh when leaving a page
        const title = titleFromDoc(p.doc, p.text);
        update((nb) =>
          nb.pageInfo[p.id]?.title === title
            ? nb
            : { ...nb, pageInfo: { ...nb.pageInfo, [p.id]: { title, createdAt: p.createdAt, updatedAt: p.updatedAt } } },
        );
      }
      pageRef.current = null;
      setPage(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebook.id, currentId]);

  /* ------------------------------ editing ----------------------------- */

  const onDoc = useCallback(
    (doc: JSONContent, text: string) => {
      const p = pageRef.current;
      if (!p) return;
      commitPage({ ...p, doc, text, updatedAt: Date.now() }, false);
      touchMeta();
    },
    [commitPage, touchMeta],
  );

  const onItems = useCallback(
    (items: CanvasItem[], commit: boolean) => {
      const p = pageRef.current;
      if (!p) return;
      const next = { ...p, items, updatedAt: Date.now() };
      if (commit) {
        commitPage(next);
        touchMeta(1500);
      } else {
        pageRef.current = next;
        setPage(next);
      }
    },
    [commitPage, touchMeta],
  );

  const items = page?.items ?? [];
  const maxZ = items.reduce((m, i) => Math.max(m, i.z), 0);
  const pageMinH = Math.max(MIN_PAGE_H, ...items.map((i) => i.y + i.h + 160));

  /* --------------------------- pages & turning ------------------------- */

  const go = (id: string, d: Dir) => {
    if (!id || id === currentId) return;
    flushSave();
    setDir(d);
    goPage(id);
  };

  const addPage = () => {
    flushSave();
    const p = blankPage();
    savePage(notebook.id, p);
    update((nb) => {
      const pages = [...nb.pages];
      pages.splice(pages.indexOf(currentId) + 1, 0, p.id);
      return {
        ...nb,
        pages,
        updatedAt: Date.now(),
        pageInfo: { ...nb.pageInfo, [p.id]: { title: "", createdAt: p.createdAt, updatedAt: p.createdAt } },
      };
    });
    setDir("next");
    goPage(p.id);
  };

  const prev = () => idx > 0 && go(notebook.pages[idx - 1], "prev");
  const next = () => (idx < notebook.pages.length - 1 ? go(notebook.pages[idx + 1], "next") : addPage());

  const deletePage = (id: string) => {
    if (notebook.pages.length <= 1) {
      toast({ text: "A notebook needs at least one page.", kind: "info" });
      return;
    }
    const at = notebook.pages.indexOf(id);
    flushSave();
    if (id === currentId) {
      const neighbour = notebook.pages[at + 1] ?? notebook.pages[at - 1];
      setDir(notebook.pages[at + 1] ? "next" : "prev");
      goPage(neighbour);
    }
    update((nb) => ({ ...nb, pages: nb.pages.filter((p) => p !== id), updatedAt: Date.now() }));
    let undone = false;
    toast({
      text: `Page ${at + 1} deleted`,
      kind: "info",
      action: {
        label: "Undo",
        run: () => {
          undone = true;
          update((nb) => {
            const pages = nb.pages.filter((p) => p !== id);
            pages.splice(Math.min(at, pages.length), 0, id);
            return { ...nb, pages };
          });
          goPage(id);
        },
      },
    });
    window.setTimeout(() => {
      if (!undone) void deletePageFile(notebook.id, id);
    }, 9000);
  };

  const pageMenu = (id: string, x: number, y: number) =>
    setMenu({
      x,
      y,
      items: [
        { label: "Open", icon: "book", onClick: () => go(id, notebook.pages.indexOf(id) > idx ? "next" : "prev") },
        { label: "New page after", icon: "plus", onClick: () => (id === currentId ? addPage() : go(id, "none")) },
        { label: "Delete page", icon: "trash", danger: true, onClick: () => deletePage(id) },
      ],
    });

  const onPageDrop = (e: DragEvent, target: string) => {
    e.preventDefault();
    if (!dragPage || dragPage === target) return;
    update((nb) => {
      const pages = nb.pages.filter((p) => p !== dragPage);
      pages.splice(pages.indexOf(target), 0, dragPage);
      return { ...nb, pages };
    });
    setDragPage(null);
  };

  /* ----------------------------- canvas items ---------------------------- */

  const visibleCenter = () => {
    const desk = deskRef.current;
    const pg = paperRef.current;
    if (!desk || !pg) return { x: PAGE_W / 2, y: 320 };
    const d = desk.getBoundingClientRect();
    const r = pg.getBoundingClientRect();
    const top = Math.max(d.top, r.top);
    const bottom = Math.min(d.bottom - 90, r.bottom);
    return { x: PAGE_W / 2, y: Math.max(120, ((top + bottom) / 2 - r.top) / z) };
  };

  /**
   * Where a pasted picture should land: just under the line you're typing
   * (if it's on screen), otherwise in the middle of what you can see.
   * Returns the top-centre point of the picture, in page coordinates.
   */
  const pastePoint = (): { x: number; y: number; anchor: "top" | "center" } => {
    const desk = deskRef.current;
    const pg = paperRef.current;
    if (editor && desk && pg) {
      try {
        const caret = editor.view.coordsAtPos(editor.state.selection.head);
        const d = desk.getBoundingClientRect();
        const r = pg.getBoundingClientRect();
        if (caret.bottom > d.top + 40 && caret.bottom < d.bottom - 160) {
          return { x: PAGE_W / 2, y: (caret.bottom - r.top) / z + 12, anchor: "top" };
        }
      } catch {
        /* fall through */
      }
    }
    return { ...visibleCenter(), anchor: "center" };
  };

  const addImages = async (
    files: File[],
    label: string,
    at?: { x: number; y: number; anchor: "top" | "center" },
  ) => {
    const p = pageRef.current;
    if (!p || files.length === 0) return;
    const added: CanvasItem[] = [];
    let offset = 0;
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const ext = extFromMime(file.type || mimeFromName(file.name));
        const name = await saveAsset(assetsDir, bytes, ext);
        const url = URL.createObjectURL(new Blob([bytes], { type: file.type || mimeFromName(name) }));
        primeAssetUrl(assetsDir, name, url);
        const nat = await naturalSize(url);
        const ratio = nat.w / nat.h || 1.5;
        let w = Math.min(nat.w, 440, PAGE_W - 2 * MARGIN);
        if (w < 80) w = Math.min(nat.w * 2, 160);
        const h = w / ratio;
        const c = at ?? pastePoint();
        const top = c.anchor === "top" ? c.y : c.y - h / 2;
        added.push({
          id: newId(),
          kind: "image",
          x: Math.round(clamp(c.x - w / 2 + offset, 8, PAGE_W - w - 8)),
          y: Math.round(Math.max(8, top + offset)),
          w: Math.round(w),
          h: Math.round(h),
          rot: 0,
          z: maxZ + 1 + added.length,
          asset: name,
          ratio,
        });
        offset += 26;
      } catch (err) {
        console.error(err);
        toast({ text: `Couldn't add ${file.name || "that picture"}`, kind: "error" });
      }
    }
    if (!added.length) return;
    onItems([...(pageRef.current?.items ?? []), ...added], true);
    setSelectedId(added[added.length - 1].id);
    toast({ text: added.length > 1 ? `${label} ${added.length} pictures` : label });
  };

  const addSticky = () => {
    const c = visibleCenter();
    const w = 210;
    const h = 180;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const item: StickyItem = {
      id: newId(),
      kind: "sticky",
      x: Math.round(PAGE_W - w - 64 + (Math.random() * 40 - 20)),
      y: Math.round(Math.max(40, c.y - h / 2 + (Math.random() * 60 - 30))),
      w,
      h,
      rot: Number((sign * (1.5 + Math.random() * 2)).toFixed(1)),
      z: maxZ + 1,
      color: stickyColor.current,
      text: "",
    };
    onItems([...(pageRef.current?.items ?? []), item], true);
    setSelectedId(item.id);
    setFocusId(item.id);
  };

  const deleteItem = (item: CanvasItem) => {
    const before = pageRef.current?.items ?? [];
    onItems(before.filter((i) => i.id !== item.id), true);
    setSelectedId(null);
    toast({
      text: item.kind === "image" ? "Picture removed" : "Sticky note removed",
      kind: "info",
      action: {
        label: "Undo",
        run: () => onItems([...(pageRef.current?.items ?? []), item], true),
      },
    });
  };

  const duplicateItem = (item: CanvasItem) => {
    const copy = { ...item, id: newId(), x: item.x + 24, y: item.y + 24, z: maxZ + 1 } as CanvasItem;
    onItems([...(pageRef.current?.items ?? []), copy], true);
    setSelectedId(copy.id);
  };

  const copyItem = async (item: CanvasItem) => {
    copied.current = item;
    if (item.kind === "image") {
      try {
        const url = await assetUrl(assetsDir, item.asset, mimeFromName(item.asset));
        const blob = item.asset.endsWith(".png") ? await (await fetch(url)).blob() : await toPngBlob(url);
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast({ text: keys("Picture copied — paste it anywhere with Ctrl+V") });
      } catch {
        toast({ text: keys("Copied — paste with Ctrl+V") });
      }
    } else {
      try {
        await navigator.clipboard.writeText(item.text);
      } catch {
        /* ignore */
      }
      toast({ text: "Sticky note copied" });
    }
  };

  // Ctrl+V: pictures from the clipboard land on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!pageRef.current) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        e.stopPropagation();
        void addImages(files, "Pasted ✓");
        return;
      }
      if (copied.current && copied.current.kind === "sticky" && !isTypingTarget(document.activeElement)) {
        e.preventDefault();
        duplicateItem(copied.current);
      }
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  });

  /* ------------------------------ paper ------------------------------ */

  const setPaper = (p: PaperColor) => {
    const cur = pageRef.current;
    if (cur) commitPage({ ...cur, paper: p });
  };
  const setPageType = (t: PageType) => {
    const cur = pageRef.current;
    if (cur) commitPage({ ...cur, pageType: t });
  };
  const applyToAll = async () => {
    const cur = pageRef.current;
    if (!cur) return;
    update((nb) => ({ ...nb, paper, pageType }));
    commitPage({ ...cur, paper: null, pageType: null });
    for (const id of notebook.pages) {
      if (id === cur.id) continue;
      const p = await loadPage(notebook.id, id);
      if (p.paper || p.pageType) savePage(notebook.id, { ...p, paper: null, pageType: null });
    }
    toast({ text: "Every page now uses this paper" });
  };

  /* ------------------------------ export ------------------------------ */

  const exportPng = async () => {
    const el = paperRef.current;
    if (!el) return;
    setSelectedId(null);
    await sleep(60);
    try {
      // Crop to the part of the page that has something on it.
      const top = el.getBoundingClientRect().top;
      let bottom = 0;
      el.querySelectorAll(".nb-prose > *, .item").forEach((n) => {
        bottom = Math.max(bottom, ((n as HTMLElement).getBoundingClientRect().bottom - top) / z);
      });
      const height = Math.round(Math.min(el.offsetHeight, Math.max(560, bottom + 72)));
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        height,
        style: { boxShadow: "none", borderRadius: "0" },
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains("nb-noexport")),
      });
      const name = `${safeName(notebook.title)} - page ${idx + 1}.png`;
      if (isTauri) {
        const abs = await writeExport(name, dataUrlToBytes(dataUrl));
        toast({ text: `Saved “${name}” in ${notesPath("Exports")}`, action: { label: "Show", run: () => void revealInFolder(abs) } });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = name;
        a.click();
      }
    } catch (err) {
      console.error(err);
      toast({ text: "Couldn't export this page", kind: "error" });
    }
  };

  const exportPdf = () => {
    setSelectedId(null);
    setTimeout(() => window.print(), 80);
  };

  /* ---------------------------- keyboard ---------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const turn = isMac ? e.altKey && e.metaKey : e.altKey;
      if ((mod && e.key === "PageDown") || (turn && e.key === "ArrowRight")) {
        e.preventDefault();
        next();
      } else if ((mod && e.key === "PageUp") || (turn && e.key === "ArrowLeft")) {
        e.preventDefault();
        prev();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addPage();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addSticky();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        exportPdf();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        void exportPng();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        fileInput.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ------------------------------ render ------------------------------ */

  const paperStyle = useMemo(
    () =>
      ({
        ...paperBackground(paper, pageType),
        minHeight: pageMinH,
        "--nb-font": font.css,
        "--nb-size": `${baseSize}px`,
      }) as CSSProperties,
    [paper, pageType, pageMinH, font.css, baseSize],
  );

  const exportMenu = (x: number, y: number) =>
    setMenu({
      x,
      y,
      items: [
        { label: "Save page as PDF…", icon: "print", hint: keys("Ctrl+P"), onClick: exportPdf },
        { label: "Save page as PNG", icon: "download", hint: keys("Ctrl+Shift+E"), onClick: () => void exportPng() },
      ],
    });
  const moreMenu = (x: number, y: number, withExport = false) =>
    setMenu({
      x,
      y,
      items: [
        mini
          ? { label: "Back to full Nubby", icon: "popIn", hint: keys("Ctrl+Shift+M"), onClick: () => onPopIn?.() }
          : { label: "Pop out page (mini window)", icon: "popOut", hint: keys("Ctrl+Shift+M"), onClick: () => onPopOut?.() },
        { label: "New page", icon: "plus", hint: keys("Ctrl+N"), onClick: addPage },
        ...(withExport
          ? [
              { label: "Save page as PDF…", icon: "print", hint: keys("Ctrl+P"), onClick: exportPdf },
              { label: "Save page as PNG", icon: "download", hint: keys("Ctrl+Shift+E"), onClick: () => void exportPng() },
            ]
          : []),
        { label: "Name, cover & paper…", icon: "settings", onClick: onEditNotebook },
        { label: "Delete this page", icon: "trash", danger: true, onClick: () => deletePage(currentId) },
      ],
    });

  return (
    <div className={`desk ${night ? "desk--night" : ""} ${mini ? "desk--mini" : ""}`}>
      {mini && (
        <div
          className="mini-bar"
          onMouseDown={(e) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
            if (e.detail === 2) void windowControls.toggleMaximize();
            else void windowControls.startDragging();
          }}
        >
          <button className="mini-btn" aria-label="Previous page" title={`Previous page (${TURN.prev})`} disabled={idx <= 0} onClick={prev}>
            <Icon name="chevronLeft" size={16} stroke={2.4} />
          </button>
          <button
            className="mini-btn"
            aria-label={idx >= notebook.pages.length - 1 ? "New page" : "Next page"}
            title={idx >= notebook.pages.length - 1 ? keys("New page (Ctrl+N)") : `Next page (${TURN.next})`}
            onClick={next}
          >
            <Icon name={idx >= notebook.pages.length - 1 ? "plus" : "chevronRight"} size={16} stroke={2.4} />
          </button>
          <div className="mini-bar__title" title={`${notebook.title} · page ${idx + 1} of ${notebook.pages.length}`}>
            <b>{notebook.title}</b> · {idx + 1}/{notebook.pages.length}
          </div>
          <button
            className={`mini-btn ${onTop ? "mini-btn--on" : ""}`}
            aria-pressed={onTop}
            aria-label="Keep on top of other windows"
            title={onTop ? "Staying on top of other windows (click to let them cover it)" : "Keep on top of other windows"}
            onClick={onToggleOnTop}
          >
            <Icon name="pin" size={16} />
          </button>
          <button className="mini-btn mini-btn--full" title={keys("Back to full Nubby (Ctrl+Shift+M)")} onClick={onPopIn}>
            <Icon name="popIn" size={15} stroke={2.2} />
            <span>Full</span>
          </button>
          {isTauri && !isMac && (
            <div className="winctl winctl--mini">
              <button aria-label="Minimise" onClick={() => windowControls.minimize()}>
                <Icon name="minimize" size={13} stroke={1.5} />
              </button>
              <button className="winctl__close" aria-label="Close" onClick={() => windowControls.close()}>
                <Icon name="x" size={13} stroke={1.5} />
              </button>
            </div>
          )}
        </div>
      )}
      <div className="desk-scroll" ref={deskRef}>
        {!mini && (
        <aside className="pages-col" aria-label="Pages">
          <button className="crumb" onClick={onBack}>
            <Icon name="chevronLeft" size={14} stroke={2.4} /> Shelf
          </button>
          <h1 className="pages-col__title h-serif">{notebook.title}</h1>
          <p className="pages-col__meta">
            <span className="dot dot--ok" /> Page {idx + 1} of {notebook.pages.length} · saved on this PC
          </p>
          <div className="pages-col__actions">
            <button className="btn btn--sm" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); exportMenu(r.left, r.bottom + 6); }}>
              <Icon name="download" size={15} /> Export
            </button>
            <button className="icon-btn icon-btn--ink icon-btn--sm" aria-label="More page actions" title="More" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); moreMenu(r.left, r.bottom + 6); }}>
              <Icon name="more" size={15} stroke={2.4} />
            </button>
          </div>
          <div className="thumbs">
            {notebook.pages.map((id, i) => {
              const info = notebook.pageInfo[id];
              const on = id === currentId;
              return (
                <button
                  key={id}
                  className={`thumb ${on ? "thumb--on" : ""} ${dragPage === id ? "is-dragging" : ""}`}
                  aria-current={on ? "page" : undefined}
                  draggable
                  onDragStart={() => setDragPage(id)}
                  onDragEnd={() => setDragPage(null)}
                  onDragOver={(e) => dragPage && e.preventDefault()}
                  onDrop={(e) => onPageDrop(e, id)}
                  onClick={() => go(id, i > idx ? "next" : "prev")}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    pageMenu(id, e.clientX, e.clientY);
                  }}
                >
                  <span className="thumb__paper" style={paperBackground(notebook.paper, notebook.pageType, 8, 0.8)}>
                    <span className="thumb__title">{info?.title || (on ? "this page" : "")}</span>
                    <span className="thumb__n">{i + 1}</span>
                  </span>
                </button>
              );
            })}
            <button className="thumb thumb--new" onClick={addPage} title={keys("New page (Ctrl+N)")}>
              <span className="thumb__paper thumb__paper--new">
                <Icon name="plus" size={18} stroke={2.6} />
                <span className="thumb__new">New page</span>
              </span>
            </button>
          </div>
        </aside>
        )}

        <div className="stage">
          {!mini && (
          <div className="turns" style={{ width: PAGE_W }}>
            <button className="turn turn--prev" aria-label="Previous page" disabled={idx <= 0} onClick={prev} title={`Previous page (${TURN.prev})`}>
              <Icon name="chevronLeft" size={18} stroke={2.6} />
            </button>
            <button
              className="turn turn--next"
              aria-label={idx >= notebook.pages.length - 1 ? "New page" : "Next page"}
              onClick={next}
              title={idx >= notebook.pages.length - 1 ? keys("New page (Ctrl+N)") : `Next page (${TURN.next})`}
            >
              <Icon name={idx >= notebook.pages.length - 1 ? "plus" : "chevronRight"} size={18} stroke={2.6} />
            </button>
          </div>
          )}
          <div className="stack" style={{ width: PAGE_W, zoom: mini ? zoom : undefined }}>
            <div className="stack__under stack__under--2" />
            <div className="stack__under stack__under--1" />
            <div
              key={currentId}
              ref={paperRef}
              className={`paper paper--${paper} enter-${dir} ${dropHint ? "paper--drop" : ""}`}
              style={paperStyle}
              onPointerDown={(e) => {
                const t = e.target as HTMLElement;
                if (!t.closest(".item, .item-tools")) setSelectedId(null);
                if ((t === e.currentTarget || t.classList.contains("paper-head") || t.classList.contains("nb-editor")) && editor) {
                  e.preventDefault();
                  editor.commands.focus("end");
                }
              }}
              onDragOverCapture={(e) => {
                if (e.dataTransfer.types.includes("Files")) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                  setDropHint(true);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHint(false);
              }}
              onDropCapture={(e) => {
                const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
                setDropHint(false);
                if (!files.length) return;
                e.preventDefault();
                e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                void addImages(files, "Dropped in ✓", { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z, anchor: "center" });
              }}
            >
              <div className="paper-grain nb-noexport" aria-hidden />
              <div className="paper-head">
                <span>{page ? pageDate(page.createdAt) : ""}</span>
                {notebook.numbered && <span className="paper-head__n">{idx + 1}</span>}
              </div>
              {page ? (
                <PageEditor key={page.id} page={page} onChange={onDoc} onReady={setEditor} />
              ) : (
                <div className="nb-editor nb-editor--loading" />
              )}
              {page && (
                <CanvasLayer
                  items={items}
                  assetDir={assetsDir}
                  width={PAGE_W}
                  margin={MARGIN}
                  scale={z}
                  selectedId={selectedId}
                  focusId={focusId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    const it = items.find((i) => i.id === id);
                    if (it?.kind === "sticky") stickyColor.current = it.color;
                  }}
                  onChange={onItems}
                  onDelete={deleteItem}
                  onCopy={(it) => void copyItem(it)}
                  onDuplicate={duplicateItem}
                />
              )}
              {night && <div className="paper-lamp nb-noexport" aria-hidden />}
            </div>
          </div>
        </div>

        {!mini && (
        <aside className="side-col" aria-label="Page settings">
          <div className="side-col__group">
            <span className="side-col__label">Paper</span>
            <div className="seg seg--full">
              {PAPERS.map((p) => (
                <button key={p.id} className={`seg__btn ${paper === p.id ? "seg__btn--on" : ""}`} aria-pressed={paper === p.id} onClick={() => setPaper(p.id)}>
                  <span className="dot" style={{ background: p.color }} />
                  <span className="seg__label">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="side-col__group">
            <span className="side-col__label">
              Page <span className="muted">· {PAGE_TYPES.find((t) => t.id === pageType)?.name}</span>
            </span>
            <div className="row gap-6 wrap">
              {PAGE_TYPES.map((t) => (
                <button
                  key={t.id}
                  className={`mini-ptile ${pageType === t.id ? "mini-ptile--on" : ""}`}
                  aria-label={`${t.name} page`}
                  title={t.name}
                  aria-pressed={pageType === t.id}
                  style={paperBackground(paper, t.id, 8, 0.9)}
                  onClick={() => setPageType(t.id)}
                />
              ))}
            </div>
          </div>
          <p className="side-col__hint">
            {TURN.both} turns the page.
            <br />
            {keys("Paste a picture anywhere with Ctrl V.")}
          </p>
        </aside>
        )}
      </div>

      <Toolbar
        editor={editor}
        notebookFont={notebook.font}
        baseSize={baseSize}
        paper={paper}
        pageType={pageType}
        onPaper={setPaper}
        onPageType={setPageType}
        onApplyToAll={() => void applyToAll()}
        onAddSticky={addSticky}
        onImport={() => fileInput.current?.click()}
        onMore={(r) => moreMenu(r.left, r.top - 8, true)}
        compact={mini}
      />

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
          void addImages(files, files.length > 1 ? "Imported" : "Picture added ✓");
        }}
      />
      {menu && <Menu {...menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
