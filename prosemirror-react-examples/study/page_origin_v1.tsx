"use client";
import { EditorState } from "prosemirror-state";
import "prosemirror-view/style/prosemirror.css";
import React, { useRef, useEffect } from "react";
import { exampleSetup } from "prosemirror-example-setup";
import { EditorView } from "prosemirror-view";
import { toggleMark } from "prosemirror-commands";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { ySyncPlugin } from "y-prosemirror";
import { yCursorPlugin } from "y-prosemirror";
import { yUndoPlugin, undo, redo } from "y-prosemirror";

import { schema as yschema } from "../../components/editor/shcema/schema";
import { keymap } from "prosemirror-keymap";
import "./ystyle.css";

const toggleBold = toggleMark(yschema.marks.strong);

const ydoc = new Y.Doc();
const provider = new WebsocketProvider("ws://192.168.31.66:8888", "aaa", ydoc);
const type = ydoc.getXmlFragment("bbb");

// 设置用户名
const userName = "申申"; // 你可以将这个替换成任何需要的用户名

// 设置 awareness 信息
provider.awareness.setLocalStateField("user", {
  name: userName,
});

function setAlignment(alignment: any) {
  return (state: any, dispatch: any) => {
    let { from, to } = state.selection;
    let { tr } = state;
    state.doc.nodesBetween(from, to, (node: any, pos: any) => {
      if (node.type.name === "paragraph") {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, align: alignment });
      }
    });
    if (tr.docChanged) {
      dispatch && dispatch(tr);
      return true;
    }
    return false;
  };
}

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

  const applyAlignment = (alignment: any) => {
    const editorView = editorViewRef.current;
    if (editorView) {
      alignment(editorView.state, editorView.dispatch);
      editorView.focus();
    }
  };
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24 border border-black gap-4">
      <h1>React ProseMirror Demo</h1>
      <button onClick={applyBold}>Bold</button>
      <button onClick={() => applyAlignment(setAlignment("left"))}>
        Align Left
      </button>
      <button onClick={() => applyAlignment(setAlignment("center"))}>
        Align Center
      </button>
      <button onClick={() => applyAlignment(setAlignment("right"))}>
        Align Right
      </button>
      <div ref={editorRef} className="w-4/5" />
      <button onClick={printContentAsJSON}>Print JSON</button>
    </main>
  );
}
