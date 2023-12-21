"use client";
import Editor from "@/components/editor/editor/editorYjs/editor";
import { selectionPlugin } from "@/components/editor/plugin/selectionPlugin";
import { schema } from "@/components/editor/shcema/schema";
import { toggleMark, baseKeymap } from "prosemirror-commands";
import { history } from "prosemirror-history";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { buildKeymap } from "@/components/editor/plugin/keymap";
import { buildInputRules } from "@/components/editor/plugin/inputrules";
import { placeholder } from "@/components/editor/plugin/placeholder";
import { wordCount } from "@/components/editor/plugin/wordCount";
import { setCursorToStart } from "@/components/editor/utils/utils";
import { contentChange } from "@/components/editor/plugin/contentChange";
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
// ################# Yjs #################
import { keymap } from "prosemirror-keymap";
export default function Home() {
  const [selectionRange, setSelectionRange] = useState<any>(null);

  const selectionRangeHandler = (selectionRange: any) => {
    setSelectionRange(selectionRange);
  };

  const pluginsConfig = useMemo(() => {
    return [
      // ...exampleSetup({ schema, menuBar: false}),
      buildInputRules(schema),
      keymap(buildKeymap(schema)),
      keymap(baseKeymap),
      history(),
      dropCursor(),
      gapCursor(),
      placeholder(),
      // selectionPlugin(),
      // wordCount(),
      // titleChange(),
      // 其他自定义插件...
    ];
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24 border border-black gap-4">
      <h1>React ProseMirror Demo</h1>
      <Editor
        actions={{
          onSelectionRange: selectionRangeHandler,
          // onWordCountUpdate: wordCountHandler,
          // onTableOfContentUpdate: outlineContentHandler,
          // onTitleChange: titleChangeHandler,
        }}
        plugins={pluginsConfig}
        schema={schema}
        // getEditorView={editorViewHandler}
        // scrollParent={editorContentRef.current}
        builtInPlugins={{
          tableOfContent: {
            open: false,
          },
          // yjs: {
          //   open: false,
          //   roomName: "",
          // },
        }}
      />
    </main>
  );
}
