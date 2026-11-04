import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { cleanPastedHTML, nubbyExtensions } from "../editor/extensions";
import { openExternal } from "../lib/platform";
import type { Page } from "../lib/types";

/** The typed layer of a page. One editor per page (the parent keys it by page id). */
export function PageEditor({
  page,
  onChange,
  onReady,
}: {
  page: Page;
  onChange: (doc: JSONContent, text: string) => void;
  onReady: (editor: Editor | null) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const extensions = useMemo(
    () => nubbyExtensions("Start typing… (# and a space makes a heading)"),
    [],
  );

  const editor = useEditor({
    extensions,
    content: page.doc ?? "",
    autofocus: page.doc ? false : "end",
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "nb-prose", spellcheck: "true" },
      transformPastedHTML: cleanPastedHTML,
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement).closest("a[href]");
        if (a && (event.ctrlKey || event.metaKey)) {
          void openExternal(a.getAttribute("href") || "");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getJSON(), editor.getText({ blockSeparator: "\n" }));
    },
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  return <EditorContent editor={editor} className="nb-editor" />;
}
