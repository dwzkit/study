"use client";
import { EditorState } from "prosemirror-state";
import "prosemirror-view/style/prosemirror.css";
import React, { useRef, useEffect } from "react";
import { exampleSetup } from "prosemirror-example-setup";
import { EditorView } from "prosemirror-view";
import { toggleMark } from "prosemirror-commands";

import * as Y from "yjs";
// @ts-ignore
import { WebsocketProvider } from "y-websocket";
// @ts-ignore
import { ySyncPlugin } from "y-prosemirror";
// @ts-ignore
import { yCursorPlugin } from "y-prosemirror";
// @ts-ignore
import { yUndoPlugin, undo, redo } from "y-prosemirror";
import { schema as yschema } from "../../components/editor/shcema/schema";
import { keymap } from "prosemirror-keymap";
import "./ystyle.css";

const toggleBold = toggleMark(yschema.marks.strong);

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  "ws://localhost:1234",
  "prosemirror",
  ydoc
);
const type = ydoc.getXmlFragment("prosemirror");

export default function Home() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    editorViewRef.current = new EditorView(editorRef.current, {
      state: EditorState.create({
        schema: yschema,
        plugins: exampleSetup({ schema: yschema }).concat([
          ySyncPlugin(type),
          yCursorPlugin(provider.awareness),
          yUndoPlugin(),
          keymap({
            "Mod-z": undo,
            "Mod-y": redo,
            "Mod-Shift-z": redo,
          }),
        ]),
      }),
    });

    return () => {
      // 清理工作，在组件卸载时销毁编辑器以避免内存泄漏
      editorViewRef.current?.destroy();
    };
  }, []);

  const printContentAsJSON = () => {
    const editorView = editorViewRef.current;
    if (editorView) {
      const content = editorView.state.doc.toJSON();
      console.log(content);
    }
  };

  const applyBold = () => {
    const editorView = editorViewRef.current;
    if (editorView) {
      toggleBold(editorView.state, editorView.dispatch, editorView);
      editorView.focus(); // 重新聚焦编辑器
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24 border border-black gap-4">
      <h1>React ProseMirror Demo</h1>
      <button onClick={applyBold}>Bold</button>
      <div ref={editorRef} className="w-4/5" />
      <button onClick={printContentAsJSON}>Print JSON</button>
    </main>
  );
}
