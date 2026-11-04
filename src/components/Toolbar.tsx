import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { FONTS, HIGHLIGHTS, INKS, PAGE_TYPES, PAPERS, fontById, paperBackground } from "../lib/catalog";
import type { FontId, PageType, PaperColor } from "../lib/types";
import {
  DashedBoxGlyph,
  GreyBoxGlyph,
  HeadingGlyph,
  Icon,
  KidGlyph,
  StickyGlyph,
  TagGlyph,
} from "./Icon";
import { Popover } from "./Menu";
import { keys } from "../lib/platform";

export const STICKERS = [
  { src: "/stickers/kid.svg", name: "Kid in sunglasses" },
  { src: "/stickers/star.svg", name: "Star" },
  { src: "/stickers/tick.svg", name: "Tick" },
  { src: "/stickers/bang.svg", name: "Important" },
  { src: "/stickers/heart.svg", name: "Heart" },
  { src: "/stickers/bulb.svg", name: "Idea" },
];

/** The three heading styles, biggest first (h2 is the big title, h1 the # pill, h3 the subheading). */
const HEADINGS: { id: string; level: 1 | 2 | 3 | null; name: string; sample: string; hint: string }[] = [
  { id: "title", level: 2, name: "Title", sample: "Title", hint: "## and space" },
  { id: "pill", level: 1, name: "Heading pill", sample: "HEADING:", hint: "# and space" },
  { id: "sub", level: 3, name: "Subheading", sample: "Subheading", hint: "### and space" },
  { id: "text", level: null, name: "Normal text", sample: "Text", hint: "Ctrl Alt 0" },
];

type Pop = "font" | "highlight" | "heading" | "box" | "list" | "align" | "sticker" | "page" | "ink" | "more" | null;

function ToolBtn({
  label,
  on,
  onClick,
  children,
  btnRef,
  disabled,
  optional,
}: {
  label: string;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
  btnRef?: (el: HTMLButtonElement | null) => void;
  disabled?: boolean;
  /** Dropped first when the compact bar runs out of room (it has a shortcut). */
  optional?: boolean;
}) {
  return (
    <button
      ref={btnRef}
      className={`tool ${on ? "tool--on" : ""} ${optional ? "tool--opt" : ""}`}
      aria-label={keys(label)}
      aria-pressed={on}
      title={keys(label)}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  editor,
  notebookFont,
  baseSize,
  paper,
  pageType,
  onPaper,
  onPageType,
  onApplyToAll,
  onAddSticky,
  onImport,
  onMore,
  compact = false,
}: {
  editor: Editor | null;
  notebookFont: FontId;
  baseSize: number;
  paper: PaperColor;
  pageType: PageType;
  onPaper: (p: PaperColor) => void;
  onPageType: (t: PageType) => void;
  onApplyToAll: () => void;
  onAddSticky: () => void;
  onImport: () => void;
  onMore: (anchor: DOMRect) => void;
  /** The pop-out mini window: the essentials only, the rest under More. */
  compact?: boolean;
}) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [pop, setPop] = useState<Pop>(null);
  const anchors = useRef<Record<string, HTMLButtonElement | null>>({});
  const colorInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", force);
    editor.on("focus", force);
    return () => {
      editor.off("transaction", force);
      editor.off("focus", force);
    };
  }, [editor]);

  const ed = editor;
  const style = ed?.getAttributes("textStyle") ?? {};
  const currentFont =
    FONTS.find((f) => style.fontFamily && f.css.split(",")[0].replace(/'/g, "") === String(style.fontFamily).split(",")[0].replace(/['"]/g, "").trim()) ??
    fontById(notebookFont);
  const size = style.fontSize ? parseInt(String(style.fontSize), 10) : baseSize;
  const color: string | undefined = style.color;
  const is = (name: string, attrs?: Record<string, unknown>) => !!ed?.isActive(name, attrs);

  const run = (fn: (e: Editor) => void) => {
    if (!ed) return;
    fn(ed);
  };
  const toggle = (p: Pop) => setPop((cur) => (cur === p ? null : p));
  const close = () => setPop(null);
  const anchor = (k: string) => (el: HTMLButtonElement | null) => {
    anchors.current[k] = el;
  };
  // In the compact bar some buttons live under More, so their popovers open from there.
  const anchorFor = (k: string) => anchors.current[k] ?? anchors.current.more ?? null;

  const setSize = (n: number) =>
    run((e) => e.chain().focus().setFontSize(`${Math.max(12, Math.min(72, n))}px`).run());

  const listIcon = is("taskList") ? "checklist" : is("orderedList") ? "numbers" : "bullets";
  const alignIcon = is("paragraph", { textAlign: "center" }) || is("heading", { textAlign: "center" })
    ? "alignCenter"
    : is("paragraph", { textAlign: "right" }) || is("heading", { textAlign: "right" })
      ? "alignRight"
      : "alignLeft";

  const inkGroup = (after?: () => void) => (
    <div className="inks" role="group" aria-label="Ink colour">
      {INKS.map((ink, i) => {
        const on = i === 0 ? !color : color?.toLowerCase() === ink.color.toLowerCase();
        return (
          <button
            key={ink.id}
            className={`ink ${on ? "ink--on" : ""}`}
            style={{ background: ink.color }}
            aria-label={keys(`${ink.name} ink (Ctrl+${i + 1})`)}
            aria-pressed={on}
            title={keys(`${ink.name} ink · Ctrl+${i + 1}`)}
            onClick={() => {
              run((e) =>
                i === 0 ? e.chain().focus().unsetColor().run() : e.chain().focus().setColor(ink.color).run(),
              );
              after?.();
            }}
          />
        );
      })}
      <button
        className={`ink ink--custom ${color && !INKS.some((k) => k.color.toLowerCase() === color.toLowerCase()) ? "ink--on" : ""}`}
        aria-label="Custom ink colour"
        title="Custom ink colour"
        onClick={() => colorInput.current?.click()}
      >
        <span>+</span>
      </button>
      <input
        ref={colorInput}
        type="color"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden
        defaultValue="#C2410C"
        onChange={(ev) => run((e) => e.chain().focus().setColor(ev.target.value).run())}
      />
    </div>
  );

  return (
    <div
      className={`toolbar ${compact ? "toolbar--compact" : ""}`}
      role="toolbar"
      aria-label="Formatting"
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
      }}
    >
      {compact ? (
        <>
      <button
        ref={anchor("ink")}
        className={`tool tool--ink ${pop === "ink" ? "tool--on" : ""}`}
        aria-label="Ink colour"
        title={keys("Ink colour (Ctrl+1 … 5)")}
        onClick={() => toggle("ink")}
      >
        <span className="tool-ink" style={{ background: color ?? INKS[0].color }} />
      </button>
      <ToolBtn label="Bold (Ctrl+B)" on={is("bold")} onClick={() => run((e) => e.chain().focus().toggleBold().run())}>
        <b className="glyph-b">B</b>
      </ToolBtn>
      <ToolBtn label="Italic (Ctrl+I)" on={is("italic")} optional onClick={() => run((e) => e.chain().focus().toggleItalic().run())}>
        <i className="glyph-i">I</i>
      </ToolBtn>
      <ToolBtn label="Underline (Ctrl+U)" on={is("underline")} optional onClick={() => run((e) => e.chain().focus().toggleUnderline().run())}>
        <u className="glyph-u">U</u>
      </ToolBtn>
      <span className="tool-sep" />
      <ToolBtn btnRef={anchor("highlight")} label="Highlight (Ctrl+Shift+H)" on={is("highlight") || pop === "highlight"} onClick={() => toggle("highlight")}>
        <Icon name="highlight" size={20} />
      </ToolBtn>
      <ToolBtn btnRef={anchor("heading")} label="Headings" on={is("heading") || pop === "heading"} onClick={() => toggle("heading")}>
        <HeadingGlyph />
      </ToolBtn>
      <ToolBtn label="Label tag (Ctrl+Shift+L)" on={is("labelTag")} optional onClick={() => run((e) => e.chain().focus().toggleLabelTag().run())}>
        <TagGlyph />
      </ToolBtn>
      <ToolBtn btnRef={anchor("box")} label="Boxes" on={is("dashedBox") || is("greyBox") || pop === "box"} onClick={() => toggle("box")}>
        {is("greyBox") ? <GreyBoxGlyph /> : <DashedBoxGlyph />}
      </ToolBtn>
      <ToolBtn btnRef={anchor("list")} label="Lists" on={is("bulletList") || is("orderedList") || is("taskList") || pop === "list"} onClick={() => toggle("list")}>
        <Icon name={listIcon} size={20} />
      </ToolBtn>
      <span className="tool-sep" />
      <ToolBtn label="Sticky note (Ctrl+Shift+N)" onClick={onAddSticky}>
        <StickyGlyph />
      </ToolBtn>
      <ToolBtn label="Import picture (or paste with Ctrl+V)" onClick={onImport}>
        <Icon name="image" size={20} />
      </ToolBtn>
      <ToolBtn btnRef={anchor("more")} label="More: font, size, align, stickers, paper, export" on={pop === "more"} onClick={() => toggle("more")}>
        <Icon name="more" size={20} stroke={2.4} />
      </ToolBtn>
        </>
      ) : (
        <>
      <button
        ref={anchor("font")}
        className={`tool tool--font ${pop === "font" ? "tool--on" : ""}`}
        style={{ fontFamily: currentFont.css }}
        onClick={() => toggle("font")}
        title="Font"
      >
        {currentFont.name.replace(" (system)", "")}
        <Icon name="chevronDown" size={12} stroke={2.6} />
      </button>
      <div className="tool-size">
        <button className="tool tool--slim" aria-label="Smaller text" title="Smaller text" onClick={() => setSize(size - 2)}>
          −
        </button>
        <span className="tool-size__n" title="Text size">
          {size}
        </span>
        <button className="tool tool--slim" aria-label="Bigger text" title="Bigger text" onClick={() => setSize(size + 2)}>
          +
        </button>
      </div>
      <span className="tool-sep" />
      <ToolBtn label="Bold (Ctrl+B)" on={is("bold")} onClick={() => run((e) => e.chain().focus().toggleBold().run())}>
        <b className="glyph-b">B</b>
      </ToolBtn>
      <ToolBtn label="Italic (Ctrl+I)" on={is("italic")} onClick={() => run((e) => e.chain().focus().toggleItalic().run())}>
        <i className="glyph-i">I</i>
      </ToolBtn>
      <ToolBtn label="Underline (Ctrl+U)" on={is("underline")} onClick={() => run((e) => e.chain().focus().toggleUnderline().run())}>
        <u className="glyph-u">U</u>
      </ToolBtn>
      <span className="tool-sep" />
      {inkGroup()}
      <span className="tool-sep" />
      <ToolBtn btnRef={anchor("highlight")} label="Highlight (Ctrl+Shift+H)" on={is("highlight") || pop === "highlight"} onClick={() => toggle("highlight")}>
        <Icon name="highlight" size={20} />
      </ToolBtn>
      <ToolBtn btnRef={anchor("heading")} label="Headings" on={is("heading") || pop === "heading"} onClick={() => toggle("heading")}>
        <HeadingGlyph />
      </ToolBtn>
      <ToolBtn label="Label tag (Ctrl+Shift+L)" on={is("labelTag")} onClick={() => run((e) => e.chain().focus().toggleLabelTag().run())}>
        <TagGlyph />
      </ToolBtn>
      <ToolBtn btnRef={anchor("box")} label="Boxes" on={is("dashedBox") || is("greyBox") || pop === "box"} onClick={() => toggle("box")}>
        {is("greyBox") ? <GreyBoxGlyph /> : <DashedBoxGlyph />}
      </ToolBtn>
      <span className="tool-sep" />
      <ToolBtn btnRef={anchor("list")} label="Lists" on={is("bulletList") || is("orderedList") || is("taskList") || pop === "list"} onClick={() => toggle("list")}>
        <Icon name={listIcon} size={20} />
      </ToolBtn>
      <ToolBtn btnRef={anchor("align")} label="Alignment" on={pop === "align"} onClick={() => toggle("align")}>
        <Icon name={alignIcon} size={20} />
      </ToolBtn>
      <span className="tool-sep" />
      <ToolBtn label="Sticky note" onClick={onAddSticky}>
        <StickyGlyph />
      </ToolBtn>
      <ToolBtn btnRef={anchor("sticker")} label="Sticker" on={pop === "sticker"} onClick={() => toggle("sticker")}>
        <KidGlyph size={22} />
      </ToolBtn>
      <ToolBtn label="Import picture (or paste with Ctrl+V)" onClick={onImport}>
        <Icon name="image" size={20} />
      </ToolBtn>
      <ToolBtn btnRef={anchor("page")} label="Paper & page type" on={pop === "page"} onClick={() => toggle("page")}>
        <Icon name="page" size={20} />
      </ToolBtn>
      <button
        className="tool"
        aria-label="More: export, new page, notebook settings"
        title="More"
        onClick={(e) => onMore(e.currentTarget.getBoundingClientRect())}
      >
        <Icon name="more" size={20} stroke={2.4} />
      </button>
        </>
      )}

      {pop === "ink" && (
        <Popover anchor={anchors.current.ink ?? null} onClose={close}>
          <p className="pop__label">Ink</p>
          {inkGroup(close)}
        </Popover>
      )}

      {pop === "more" && (
        <Popover anchor={anchors.current.more ?? null} onClose={close} className="pop-more">
          <p className="pop__label">Text</p>
          <button className="pop-row" style={{ fontFamily: currentFont.css, fontSize: 17 }} onClick={() => setPop("font")}>
            {currentFont.name.replace(" (system)", "")}
            <span className="pop-row__hint">
              <Icon name="chevronRight" size={14} stroke={2.4} />
            </span>
          </button>
          <div className="more-row">
            <div className="tool-size">
              <button className="tool tool--slim" aria-label="Smaller text" title="Smaller text" onClick={() => setSize(size - 2)}>
                −
              </button>
              <span className="tool-size__n" title="Text size">
                {size}
              </span>
              <button className="tool tool--slim" aria-label="Bigger text" title="Bigger text" onClick={() => setSize(size + 2)}>
                +
              </button>
            </div>
            <span className="tool-sep" />
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                className={`tool ${alignIcon === "align" + a[0].toUpperCase() + a.slice(1) ? "tool--on" : ""}`}
                aria-label={`Align ${a}`}
                title={`Align ${a}`}
                onClick={() => run((e) => e.chain().focus().setTextAlign(a).run())}
              >
                <Icon name={a === "left" ? "alignLeft" : a === "center" ? "alignCenter" : "alignRight"} size={18} />
              </button>
            ))}
          </div>
          <div className="pop__rule" />
          <button className="pop-row" onClick={() => setPop("sticker")}>
            <KidGlyph size={20} /> Stickers
          </button>
          <button className="pop-row" onClick={() => setPop("page")}>
            <Icon name="page" size={18} /> Paper &amp; page type
          </button>
          <button
            className="pop-row"
            onClick={() => {
              const r = anchors.current.more?.getBoundingClientRect();
              close();
              if (r) onMore(r);
            }}
          >
            <Icon name="more" size={18} stroke={2.4} /> New page, export…
          </button>
        </Popover>
      )}

      {pop === "font" && (
        <Popover anchor={anchorFor("font")} onClose={close} className="pop-fonts">
          <p className="pop__label">Font</p>
          {FONTS.map((f) => {
            const on = f.id === currentFont.id;
            return (
              <button
                key={f.id}
                className={`font-row ${on ? "font-row--on" : ""}`}
                style={{ fontFamily: f.css, fontSize: f.kind === "hand" ? 21 * f.scale : 16 }}
                onClick={() => {
                  run((e) =>
                    f.id === notebookFont
                      ? e.chain().focus().unsetFontFamily().run()
                      : e.chain().focus().setFontFamily(f.css).run(),
                  );
                  close();
                }}
              >
                <span>{f.name}</span>
                {f.id === notebookFont && <span className="font-row__tag">notebook</span>}
                {on && <Icon name="check" size={16} stroke={3} />}
              </button>
            );
          })}
          <div className="pop__rule" />
          <button
            className={`font-row font-row--option ${is("spaced") ? "font-row--on" : ""}`}
            onClick={() => run((e) => e.chain().focus().toggleSpaced().run())}
          >
            <span style={{ letterSpacing: "0.14em" }}>Wide spacing</span>
            {is("spaced") && <Icon name="check" size={16} stroke={3} />}
          </button>
        </Popover>
      )}

      {pop === "highlight" && (
        <Popover anchor={anchors.current.highlight ?? null} onClose={close}>
          <p className="pop__label">Highlighter</p>
          <div className="row gap-8">
            {HIGHLIGHTS.map((h) => (
              <button
                key={h.id}
                className={`hl-swatch ${is("highlight", { color: h.color }) ? "hl-swatch--on" : ""}`}
                style={{ background: h.color }}
                aria-label={`${h.name} highlight`}
                title={h.name}
                onClick={() => {
                  run((e) => e.chain().focus().toggleHighlight({ color: h.color }).run());
                  close();
                }}
              />
            ))}
            <button
              className="hl-swatch hl-swatch--none"
              aria-label="Remove highlight"
              title="None"
              onClick={() => {
                run((e) => e.chain().focus().unsetHighlight().run());
                close();
              }}
            >
              <Icon name="x" size={14} stroke={2.4} />
            </button>
          </div>
        </Popover>
      )}

      {pop === "heading" && (
        <Popover anchor={anchors.current.heading ?? null} onClose={close} className="pop-headings">
          <p className="pop__label">Headings</p>
          {HEADINGS.map((h) => {
            const on = h.level ? is("heading", { level: h.level }) : !is("heading");
            return (
              <button
                key={h.name}
                className={`pop-row hd-row ${on ? "pop-row--on" : ""}`}
                onClick={() => {
                  run((e) => {
                    const c = e.chain().focus();
                    (h.level ? c.setHeading({ level: h.level }) : c.setParagraph()).run();
                  });
                  close();
                }}
              >
                <span className="hd-row__paper">
                  <span className={`hd-sample hd-sample--${h.id}`} style={{ fontFamily: fontById(notebookFont).css }}>
                    {h.sample}
                  </span>
                </span>
                <span className="hd-row__name">{h.name}</span>
                <span className="pop-row__hint">{keys(h.hint)}</span>
              </button>
            );
          })}
        </Popover>
      )}

      {pop === "box" && (
        <Popover anchor={anchors.current.box ?? null} onClose={close}>
          <p className="pop__label">Boxes</p>
          <button className={`pop-row ${is("dashedBox") ? "pop-row--on" : ""}`} onClick={() => { run((e) => e.chain().focus().toggleDashedBox().run()); close(); }}>
            <DashedBoxGlyph /> Dashed box <span className="pop-row__hint">type &gt; and space</span>
          </button>
          <button className={`pop-row ${is("greyBox") ? "pop-row--on" : ""}`} onClick={() => { run((e) => e.chain().focus().toggleGreyBox().run()); close(); }}>
            <GreyBoxGlyph /> Grey box
          </button>
        </Popover>
      )}

      {pop === "list" && (
        <Popover anchor={anchors.current.list ?? null} onClose={close}>
          <p className="pop__label">Lists</p>
          <button className={`pop-row ${is("bulletList") ? "pop-row--on" : ""}`} onClick={() => { run((e) => e.chain().focus().toggleBulletList().run()); close(); }}>
            <Icon name="bullets" size={18} /> Bullets <span className="pop-row__hint">type - and space</span>
          </button>
          <button className={`pop-row ${is("orderedList") ? "pop-row--on" : ""}`} onClick={() => { run((e) => e.chain().focus().toggleOrderedList().run()); close(); }}>
            <Icon name="numbers" size={18} /> Numbered <span className="pop-row__hint">type 1. and space</span>
          </button>
          <button className={`pop-row ${is("taskList") ? "pop-row--on" : ""}`} onClick={() => { run((e) => e.chain().focus().toggleTaskList().run()); close(); }}>
            <Icon name="checklist" size={18} /> Checklist <span className="pop-row__hint">{keys("Ctrl+Shift+9")}</span>
          </button>
        </Popover>
      )}

      {pop === "align" && (
        <Popover anchor={anchorFor("align")} onClose={close}>
          <p className="pop__label">Align</p>
          <div className="row gap-6">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                className={`tool ${alignIcon === "align" + a[0].toUpperCase() + a.slice(1) ? "tool--on" : ""}`}
                aria-label={`Align ${a}`}
                title={`Align ${a}`}
                onClick={() => {
                  run((e) => e.chain().focus().setTextAlign(a).run());
                  close();
                }}
              >
                <Icon name={a === "left" ? "alignLeft" : a === "center" ? "alignCenter" : "alignRight"} size={20} />
              </button>
            ))}
          </div>
        </Popover>
      )}

      {pop === "sticker" && (
        <Popover anchor={anchorFor("sticker")} onClose={close}>
          <p className="pop__label">Stickers</p>
          <div className="sticker-grid">
            {STICKERS.map((s) => (
              <button
                key={s.src}
                className="sticker-btn"
                aria-label={s.name}
                title={s.name}
                onClick={() => {
                  run((e) => e.chain().focus().setImage({ src: s.src, alt: s.name }).run());
                  close();
                }}
              >
                <img src={s.src} alt="" />
              </button>
            ))}
          </div>
        </Popover>
      )}

      {pop === "page" && (
        <Popover anchor={anchorFor("page")} onClose={close} className="pop-page">
          <p className="pop__label">Paper</p>
          <div className="seg">
            {PAPERS.map((p) => (
              <button key={p.id} className={`seg__btn ${paper === p.id ? "seg__btn--on" : ""}`} onClick={() => onPaper(p.id)}>
                <span className="dot" style={{ background: p.color }} />
                  <span className="seg__label">{p.name}</span>
              </button>
            ))}
          </div>
          <p className="pop__label mt-14">Page</p>
          <div className="row gap-10">
            {PAGE_TYPES.map((t) => (
              <button
                key={t.id}
                className={`ptile ptile--sm ${pageType === t.id ? "ptile--on" : ""}`}
                onClick={() => onPageType(t.id)}
              >
                <span className="ptile__paper" style={paperBackground(paper, t.id, 8, 0.9)} />
                {t.name}
              </button>
            ))}
          </div>
          <button className="btn btn--sm mt-14" onClick={() => { onApplyToAll(); close(); }}>
            Use for every page in this notebook
          </button>
        </Popover>
      )}
    </div>
  );
}
