/**
 * The editor is TipTap (ProseMirror). Most of Nubby's "paper" look comes from
 * a handful of small custom pieces defined here:
 *
 *  - FontSize          per-selection text size
 *  - LabelTag          the tilted green "L.P." tag      (Ctrl+Shift+L, or type "LP: ")
 *  - Spaced            wide letter spacing, like the coloured lines in real notes
 *  - DashedBox         dashed green box around a Q&A     (toolbar, or type "> ")
 *  - GreyBox           the clean grey callout box
 *  - Sticker           tiny inline stickers (the sunglasses kid …)
 *  - InkShortcuts      Ctrl+1…5 switch ink colour
 *  - Arrows            "->" becomes "→"
 */
import {
  Extension,
  InputRule,
  Mark,
  Node,
  mergeAttributes,
  textInputRule,
  wrappingInputRule,
  type Extensions,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import { INKS } from "../lib/catalog";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    labelTag: { toggleLabelTag: () => ReturnType };
    spaced: { toggleSpaced: () => ReturnType };
    dashedBox: { toggleDashedBox: () => ReturnType };
    greyBox: { toggleGreyBox: () => ReturnType };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export const LabelTag = Mark.create({
  name: "labelTag",
  inclusive: false,
  parseHTML() {
    return [{ tag: "span[data-tag]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-tag": "", class: "nb-tag" }), 0];
  },
  addCommands() {
    return {
      toggleLabelTag:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-l": () => this.editor.commands.toggleLabelTag() };
  },
  addInputRules() {
    const type = this.type;
    return [
      new InputRule({
        // "LP: " or "L.P. " at the start of a line becomes the green tag.
        find: /^(?:LP:|L\.P\.:?)\s$/i,
        handler: ({ state, range }) => {
          const { tr } = state;
          const start = range.from;
          tr.insertText("L.P.", start, range.to);
          tr.addMark(start, start + 4, type.create());
          tr.insertText(" ", start + 4);
          tr.removeStoredMark(type);
        },
      }),
    ];
  },
});

export const Spaced = Mark.create({
  name: "spaced",
  parseHTML() {
    return [{ tag: "span[data-spaced]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-spaced": "", class: "nb-spaced" }), 0];
  },
  addCommands() {
    return {
      toggleSpaced:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

export const DashedBox = Node.create({
  name: "dashedBox",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-box="dashed"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-box": "dashed", class: "nb-box nb-box--dashed" }),
      0,
    ];
  },
  addCommands() {
    return {
      toggleDashedBox:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*>\s$/, type: this.type, keepMarks: true, editor: this.editor })];
  },
});

export const GreyBox = Node.create({
  name: "greyBox",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-box="grey"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-box": "grey", class: "nb-box nb-box--grey" }),
      0,
    ];
  },
  addCommands() {
    return {
      toggleGreyBox:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});

/** Inline stickers. Only images we created ourselves (data-sticker) are accepted. */
export const Sticker = Image.extend({
  name: "sticker",
  parseHTML() {
    return [{ tag: "img[data-sticker]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(HTMLAttributes, { "data-sticker": "", class: "nb-sticker", draggable: "false" }),
    ];
  },
}).configure({ inline: true, allowBase64: false });

export const InkShortcuts = Extension.create({
  name: "inkShortcuts",
  addKeyboardShortcuts() {
    const set = (color: string | null) => () =>
      color
        ? this.editor.chain().focus().setColor(color).run()
        : this.editor.chain().focus().unsetColor().run();
    return {
      "Mod-1": set(null),
      "Mod-2": set(INKS[1].color),
      "Mod-3": set(INKS[2].color),
      "Mod-4": set(INKS[3].color),
      "Mod-5": set(INKS[4].color),
    };
  },
});

export const Arrows = Extension.create({
  name: "arrows",
  addInputRules() {
    return [
      textInputRule({ find: /->$/, replace: "→" }),
      textInputRule({ find: /<-$/, replace: "←" }),
      textInputRule({ find: /=>$/, replace: "⇒" }),
    ];
  },
});

export function nubbyExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      blockquote: false,
      // Typing "1. " or "- " keeps the ink colour / bold you already picked.
      // (keepAttributes is left off on purpose: it clears the kept marks again.)
      bulletList: { keepMarks: true },
      orderedList: { keepMarks: true },
    }),
    Underline,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { class: "nb-link", rel: "noopener noreferrer", target: null },
    }),
    Placeholder.configure({ placeholder }),
    LabelTag,
    Spaced,
    DashedBox,
    GreyBox,
    Sticker,
    InkShortcuts,
    Arrows,
  ];
}

/** Pasted text should take on the notebook's handwriting, not the web page's fonts. */
export function cleanPastedHTML(html: string): string {
  return html
    .replace(/font-family\s*:[^;"']*;?/gi, "")
    .replace(/font-size\s*:[^;"']*;?/gi, "")
    .replace(/line-height\s*:[^;"']*;?/gi, "")
    .replace(/background(-color)?\s*:[^;"']*;?/gi, "");
}
