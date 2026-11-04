import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotebookSheet, type NotebookFields } from "./components/NotebookSheet";
import { NotebookView } from "./components/NotebookView";
import { HelpSheet, SearchPalette, SettingsSheet } from "./components/Overlays";
import { Shelf } from "./components/Shelf";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { Toasts } from "./components/Toasts";
import { BoardView, RecentView, TrashView } from "./components/Views";
import { FILE_APP, miniWindow, revealInFolder, windowControls } from "./lib/platform";
import {
  createNotebook,
  deleteNotebookForever,
  flushWrites,
  loadNotebooks,
  loadShelfOrder,
  onSaveState,
  saveNotebook,
  saveShelfOrder,
  storageRoot,
} from "./lib/repo";
import { isTauri } from "./lib/storage";
import { toast } from "./lib/toasts";
import type { Notebook, View } from "./lib/types";
import { isTypingTarget } from "./lib/util";

const pref = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const setPref = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export default function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const notebooksRef = useRef<Notebook[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ name: "shelf" });
  const [night, setNightState] = useState(() => pref("nubby.night", "0") === "1");
  const [railInNotebook, setRailInNotebook] = useState(() => pref("nubby.railNotebook", "1") === "1");
  const [railElsewhere, setRailElsewhere] = useState(() => pref("nubby.railElsewhere", "0") === "1");
  const [sheet, setSheet] = useState<null | { mode: "new" } | { mode: "edit"; id: string }>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tipVisible, setTipVisible] = useState(() => pref("nubby.tip", "on") !== "off");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  // Pop-out mini window: just the page, small and (optionally) on top of other windows.
  const [mini, setMini] = useState(false);
  const [onTop, setOnTopState] = useState(() => pref("nubby.mini.onTop", "1") === "1");
  const miniBusy = useRef(false);
  const nbTimers = useRef(new Map<string, number>());

  /* ---------------------------- loading & saving ---------------------------- */

  useEffect(() => {
    (async () => {
      try {
        const [nbs, ord] = await Promise.all([loadNotebooks(), loadShelfOrder()]);
        notebooksRef.current = nbs;
        setNotebooks(nbs);
        setOrder(ord);
      } catch (err) {
        console.error(err);
        toast({ text: "Couldn't open your notebooks folder", kind: "error" });
      } finally {
        setLoaded(true);
      }
    })();
    onSaveState((s) => setSaveState(s === "error" ? "error" : "saved"));
  }, []);

  const flushNotebookSaves = useCallback(() => {
    for (const [id, t] of nbTimers.current) {
      window.clearTimeout(t);
      const nb = notebooksRef.current.find((n) => n.id === id);
      if (nb) saveNotebook(nb);
    }
    nbTimers.current.clear();
  }, []);

  // Make sure everything is on disk before the window closes.
  useEffect(() => {
    let off: (() => void) | undefined;
    windowControls
      .onCloseRequested(async () => {
        window.dispatchEvent(new Event("nubby:flush"));
        flushNotebookSaves();
        await flushWrites();
      })
      .then((un) => (off = un));
    const before = () => flushNotebookSaves();
    window.addEventListener("beforeunload", before);
    return () => {
      off?.();
      window.removeEventListener("beforeunload", before);
    };
  }, [flushNotebookSaves]);

  const commitNotebooks = (list: Notebook[]) => {
    notebooksRef.current = list;
    setNotebooks(list);
  };

  const scheduleSave = (id: string) => {
    window.clearTimeout(nbTimers.current.get(id));
    nbTimers.current.set(
      id,
      window.setTimeout(() => {
        nbTimers.current.delete(id);
        const nb = notebooksRef.current.find((n) => n.id === id);
        if (nb) saveNotebook(nb);
      }, 450),
    );
  };

  const updateNotebook = useCallback((id: string, fn: (nb: Notebook) => Notebook) => {
    const cur = notebooksRef.current.find((n) => n.id === id);
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    commitNotebooks(notebooksRef.current.map((n) => (n.id === id ? next : n)));
    scheduleSave(id);
  }, []);

  /* ------------------------------- theme ------------------------------- */

  const setNight = (n: boolean) => {
    setNightState(n);
    setPref("nubby.night", n ? "1" : "0");
  };
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
  }, [night]);

  /* ------------------------------ actions ------------------------------ */

  const live = useMemo(() => notebooks.filter((n) => !n.trashedAt), [notebooks]);
  const trashed = useMemo(
    () => notebooks.filter((n) => n.trashedAt).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [notebooks],
  );

  const openNotebook = (nb: Notebook, pageId?: string | null) =>
    setView({ name: "notebook", notebookId: nb.id, pageId: pageId ?? nb.lastPageId ?? nb.pages[0] ?? null });

  const createFromSheet = (f: NotebookFields) => {
    const { notebook } = createNotebook(f);
    commitNotebooks([notebook, ...notebooksRef.current]);
    const nextOrder = [notebook.id, ...order.filter((id) => id !== notebook.id)];
    setOrder(nextOrder);
    saveShelfOrder(nextOrder);
    setSheet(null);
    toast({ text: `“${notebook.title}” is on your shelf` });
    openNotebook(notebook, notebook.pages[0]);
  };

  const editFromSheet = (id: string, f: NotebookFields) => {
    updateNotebook(id, (nb) => ({ ...nb, ...f, updatedAt: Date.now() }));
    setSheet(null);
  };

  const trashNotebook = (nb: Notebook) => {
    updateNotebook(nb.id, (n) => ({ ...n, trashedAt: Date.now() }));
    if (view.name === "notebook" && view.notebookId === nb.id) setView({ name: "shelf" });
    toast({
      text: `“${nb.title}” moved to Trash`,
      kind: "info",
      action: { label: "Undo", run: () => updateNotebook(nb.id, (n) => ({ ...n, trashedAt: null })) },
    });
  };

  const restoreNotebook = (nb: Notebook) => {
    updateNotebook(nb.id, (n) => ({ ...n, trashedAt: null }));
    toast({ text: `“${nb.title}” is back on the shelf` });
  };

  const deleteForever = async (nb: Notebook) => {
    window.clearTimeout(nbTimers.current.get(nb.id));
    nbTimers.current.delete(nb.id);
    commitNotebooks(notebooksRef.current.filter((n) => n.id !== nb.id));
    const nextOrder = order.filter((id) => id !== nb.id);
    setOrder(nextOrder);
    saveShelfOrder(nextOrder);
    try {
      await deleteNotebookForever(nb.id);
    } catch (err) {
      console.error(err);
      toast({ text: "Couldn't delete every file — some may remain in the Nubby folder", kind: "error" });
    }
  };

  const reorder = (ids: string[]) => {
    setOrder(ids);
    saveShelfOrder(ids);
  };

  const openFolder = async () => {
    if (!isTauri) return toast({ text: "Folders open in the desktop app", kind: "info" });
    try {
      await revealInFolder(await storageRoot());
    } catch {
      toast({ text: `Couldn't open ${FILE_APP}`, kind: "error" });
    }
  };

  /* ------------------------ pop-out mini window ------------------------ */

  const popOut = async () => {
    if (mini || miniBusy.current || view.name !== "notebook") return;
    miniBusy.current = true;
    setMini(true); // switch the page layout first, then shrink the window
    try {
      await miniWindow.enter(onTop);
    } catch (err) {
      console.error(err);
    } finally {
      miniBusy.current = false;
    }
  };
  const popIn = async () => {
    if (!mini || miniBusy.current) return;
    miniBusy.current = true;
    try {
      await miniWindow.exit(); // grow the window back first, then bring the full app back
    } catch (err) {
      console.error(err);
    } finally {
      miniBusy.current = false;
      setMini(false);
    }
  };
  const toggleOnTop = () => {
    const next = !onTop;
    setOnTopState(next);
    setPref("nubby.mini.onTop", next ? "1" : "0");
    void miniWindow.setOnTop(next);
  };
  // The mini window only ever shows a notebook page.
  useEffect(() => {
    if (mini && view.name !== "notebook") void popIn();
  });

  /* ---------------------------- shortcuts ---------------------------- */

  const collapsed = view.name === "notebook" ? railInNotebook : railElsewhere;
  const toggleSidebar = () => {
    if (view.name === "notebook") {
      setRailInNotebook(!railInNotebook);
      setPref("nubby.railNotebook", !railInNotebook ? "1" : "0");
    } else {
      setRailElsewhere(!railElsewhere);
      setPref("nubby.railElsewhere", !railElsewhere ? "1" : "0");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "n" && view.name !== "notebook") {
        e.preventDefault();
        setSheet({ mode: "new" });
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "m" && (mini || view.name === "notebook")) {
        e.preventDefault();
        void (mini ? popIn() : popOut());
      } else if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (isTauri && (e.key === "F5" || (mod && e.key.toLowerCase() === "r"))) {
        e.preventDefault(); // no accidental reloads in the desktop app
      } else if (e.key === "/" && !isTypingTarget(document.activeElement) && view.name !== "notebook") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Block the browser's own context menu everywhere except text fields.
  useEffect(() => {
    if (!isTauri) return;
    const block = (e: MouseEvent) => {
      if (!isTypingTarget(e.target as Element) && !(e.target as Element).closest?.(".ProseMirror")) e.preventDefault();
    };
    window.addEventListener("contextmenu", block);
    return () => window.removeEventListener("contextmenu", block);
  }, []);

  /* ------------------------------- render ------------------------------- */

  const activeNb =
    view.name === "notebook" ? live.find((n) => n.id === view.notebookId) ?? null : null;
  const updateActive = useCallback(
    (fn: (nb: Notebook) => Notebook) => {
      if (view.name === "notebook") updateNotebook(view.notebookId, fn);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.name === "notebook" ? view.notebookId : null, updateNotebook],
  );
  const goPage = useCallback(
    (pageId: string) => setView((v) => (v.name === "notebook" ? { ...v, pageId } : v)),
    [],
  );

  let content: React.ReactNode = null;
  if (!loaded) {
    content = <div className="loading">Opening your shelf…</div>;
  } else if (view.name === "notebook" && activeNb) {
    content = (
      <NotebookView
        key={activeNb.id}
        notebook={activeNb}
        pageId={view.pageId}
        night={night}
        update={updateActive}
        goPage={goPage}
        onBack={() => setView({ name: "shelf" })}
        onEditNotebook={() => setSheet({ mode: "edit", id: activeNb.id })}
        mini={mini}
        onPopOut={() => void popOut()}
        onPopIn={() => void popIn()}
        onTop={onTop}
        onToggleOnTop={toggleOnTop}
      />
    );
  } else if (view.name === "recent") {
    content = <RecentView notebooks={live} onOpen={(nb, pageId) => openNotebook(nb, pageId)} />;
  } else if (view.name === "board") {
    content = <BoardView />;
  } else if (view.name === "trash") {
    content = <TrashView notebooks={trashed} onRestore={restoreNotebook} onDeleteForever={(nb) => void deleteForever(nb)} />;
  } else {
    content = (
      <Shelf
        notebooks={live}
        order={order}
        onOpen={openNotebook}
        onNew={() => setSheet({ mode: "new" })}
        onEdit={(nb) => setSheet({ mode: "edit", id: nb.id })}
        onTrash={trashNotebook}
        onReorder={reorder}
        onOpenFolder={() => void openFolder()}
      />
    );
  }

  const editing = sheet?.mode === "edit" ? notebooks.find((n) => n.id === sheet.id) : undefined;

  return (
    <div className={`app ${night ? "app--night" : ""} ${mini ? "app--mini" : ""}`}>
      {!mini && (
        <TitleBar
          night={night}
          onToggleNight={() => setNight(!night)}
          onToggleSidebar={toggleSidebar}
          onPopOut={view.name === "notebook" ? () => void popOut() : undefined}
          saveState={saveState}
        />
      )}
      <div className="app__body">
        {!mini && <Sidebar
          view={view}
          collapsed={collapsed}
          go={(v) => setView(v)}
          onSearch={() => setSearchOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onHelp={() => setHelpOpen(true)}
          trashCount={trashed.length}
          tipVisible={tipVisible}
          onDismissTip={() => {
            setTipVisible(false);
            setPref("nubby.tip", "off");
          }}
        />}
        <main className={`sheet ${view.name === "notebook" ? "sheet--desk" : ""}`}>{content}</main>
      </div>
      <Toasts />
      {sheet && (
        <NotebookSheet
          initial={editing}
          onCancel={() => setSheet(null)}
          onSubmit={(f) => (sheet.mode === "edit" ? editFromSheet(sheet.id, f) : createFromSheet(f))}
        />
      )}
      {searchOpen && (
        <SearchPalette notebooks={live} onClose={() => setSearchOpen(false)} onOpen={(nb, pageId) => openNotebook(nb, pageId)} />
      )}
      {settingsOpen && <SettingsSheet night={night} setNight={setNight} onClose={() => setSettingsOpen(false)} />}
      {helpOpen && <HelpSheet onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
