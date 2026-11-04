import { useEffect, useRef, useState } from "react";
import { COVERS, PAGE_TYPES, PAPERS, fontById, paperBackground } from "../lib/catalog";
import type { CoverId, FontId, Notebook, PageType, PaperColor } from "../lib/types";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

export interface NotebookFields {
  title: string;
  subtitle: string;
  cover: CoverId;
  paper: PaperColor;
  pageType: PageType;
  font: FontId;
  numbered: boolean;
}

const SHEET_FONTS: FontId[] = ["patrick", "kalam", "caveat", "inter", "garamond"];

/** The "A fresh notebook." sheet — also used to edit an existing notebook. */
export function NotebookSheet({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Notebook;
  onCancel: () => void;
  onSubmit: (f: NotebookFields) => void;
}) {
  const [f, setF] = useState<NotebookFields>(() => ({
    title: initial?.title ?? "",
    subtitle: initial?.subtitle ?? "",
    cover: initial?.cover ?? "kraft",
    paper: initial?.paper ?? "cream",
    pageType: initial?.pageType ?? "dotted",
    font: initial?.font ?? "patrick",
    numbered: initial?.numbered ?? true,
  }));
  const nameRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof NotebookFields>(k: K, v: NotebookFields[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    nameRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);

  const submit = () => onSubmit({ ...f, title: f.title.trim() || "Untitled", subtitle: f.subtitle.trim() });
  const font = fontById(f.font);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <section className="nsheet rise-in" role="dialog" aria-modal="true" aria-labelledby="nsheet-title">
        <div className="nsheet__preview">
          <div className="hero__blob hero__blob--a" />
          <div className="hero__blob hero__blob--c" style={{ left: 150, top: 260 }} />
          <div className="hero__blob hero__blob--d" style={{ left: -40, top: 480 }} />
          <p className="eyebrow">Preview</p>
          <div className="nsheet__stage">
            <div className="nsheet__page" style={paperBackground(f.paper, f.pageType, 22, 1.1)}>
              <span className="nsheet__pill">#{(f.title.trim() || "notes").toUpperCase()}:</span>
              <p style={{ fontFamily: font.css, color: "#2B4BC9" }}>• typed, not scribbled</p>
              <p style={{ fontFamily: font.css, color: "#2B4BC9" }}>• neat on every page</p>
              <p style={{ fontFamily: font.css, color: "#E2231A", textAlign: "center" }}>and still feels like paper.</p>
              {f.numbered && <span className="nsheet__num">1</span>}
            </div>
            <Cover
              cover={f.cover}
              title={f.title || "Untitled"}
              subtitle={f.subtitle}
              width={186}
              className="nsheet__cover"
            />
          </div>
          <p className="nsheet__summary">
            {COVERS.find((c) => c.id === f.cover)?.name} cover · {f.paper} paper ·{" "}
            {PAGE_TYPES.find((t) => t.id === f.pageType)?.name.toLowerCase()} pages · {font.name}
          </p>
        </div>

        <form
          className="nsheet__form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="row space-between align-start">
            <h1 id="nsheet-title" className="h-serif h-serif--sheet">
              {initial ? (
                <>
                  Your <em>notebook</em>.
                </>
              ) : (
                <>
                  A <em>fresh</em> notebook.
                </>
              )}
            </h1>
            <button type="button" className="icon-btn icon-btn--ink" aria-label="Close" onClick={onCancel}>
              <Icon name="x" size={14} stroke={2.4} />
            </button>
          </div>

          <div className="row gap-14">
            <label className="field grow">
              <span className="field__label">Name</span>
              <input
                ref={nameRef}
                className="input input--hand"
                value={f.title}
                maxLength={40}
                placeholder="Physics"
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
            <label className="field" style={{ width: 170 }}>
              <span className="field__label">Label line</span>
              <input
                className="input input--hand"
                value={f.subtitle}
                maxLength={22}
                placeholder="class 9"
                onChange={(e) => set("subtitle", e.target.value)}
              />
            </label>
          </div>

          <fieldset className="field">
            <legend className="field__label">Cover</legend>
            <div className="row gap-12 wrap">
              {COVERS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`swatch ${f.cover === c.id ? "swatch--on" : ""}`}
                  aria-pressed={f.cover === c.id}
                  onClick={() => set("cover", c.id)}
                >
                  <span className="swatch__cover" style={c.style} />
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="row gap-30 wrap">
            <fieldset className="field">
              <legend className="field__label">Paper</legend>
              <div className="seg">
                {PAPERS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`seg__btn ${f.paper === p.id ? "seg__btn--on" : ""}`}
                    aria-pressed={f.paper === p.id}
                    onClick={() => set("paper", p.id)}
                  >
                    <span className="dot" style={{ background: p.color }} /> {p.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend className="field__label">
                Default font <span className="muted">· {font.name}</span>
              </legend>
              <div className="row gap-8">
                {SHEET_FONTS.map((id) => {
                  const d = fontById(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      title={d.name}
                      aria-label={d.name}
                      aria-pressed={f.font === id}
                      className={`font-tile ${f.font === id ? "font-tile--on" : ""}`}
                      style={{ fontFamily: d.css }}
                      onClick={() => set("font", id)}
                    >
                      Aa
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <fieldset className="field">
            <legend className="field__label">Page type</legend>
            <div className="row gap-14">
              {PAGE_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`ptile ${f.pageType === t.id ? "ptile--on" : ""}`}
                  aria-pressed={f.pageType === t.id}
                  onClick={() => set("pageType", t.id)}
                >
                  <span className="ptile__paper" style={paperBackground(f.paper, t.id, 10, 1)} />
                  {t.name}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            role="switch"
            aria-checked={f.numbered}
            className="switch-row"
            onClick={() => set("numbered", !f.numbered)}
          >
            <span className={`switch ${f.numbered ? "switch--on" : ""}`}>
              <span className="switch__knob" />
            </span>
            Number the pages
          </button>

          <div className="grow" />
          <div className="row space-between">
            <span className="muted small">Paper and page type can change later, page by page.</span>
            <div className="row gap-12">
              <button type="button" className="btn btn--ghost" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {initial ? "Save" : "Create notebook"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
