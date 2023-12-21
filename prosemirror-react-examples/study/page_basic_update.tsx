"use client";
import { Schema } from "prosemirror-model";
import { schema as BasciSchema } from "prosemirror-schema-basic";
import { EditorState, Plugin } from "prosemirror-state";
import "prosemirror-view/style/prosemirror.css";
import React, { useState, useRef, useEffect } from "react";
import { addListNodes } from "prosemirror-schema-list";
import { exampleSetup } from "prosemirror-example-setup";
import { EditorView } from "prosemirror-view";
import { toggleMark } from "prosemirror-commands";
import "../components/ystyle.css";
const mySchema = new Schema({
  nodes: addListNodes(BasciSchema.spec.nodes, "paragraph block*", "block"),
  marks: BasciSchema.spec.marks,
});

const toggleBold = toggleMark(mySchema.marks.strong);

// 新增一个插件来监听选区变化
const selectionPlugin = new Plugin({
  view(editorView) {
    return {
      update(view, prevState) {
        if (
          (prevState &&
            prevState.doc.eq(view.state.doc) &&
            prevState.selection.eq(view.state.selection)) ||
          view.state.selection.empty
        ) {
          console.log("#1");
        } else {
          console.log("#2");
        }
      },
    };
  },
});
export default function Home() {
  console.log("渲染");
  const editorRef = useRef<HTMLDivElement | null>(null);
  let editorView: any = null;

  useEffect(() => {
    editorView = new EditorView(editorRef.current, {
      state: EditorState.create({
        schema: mySchema,
        plugins: exampleSetup({ schema: mySchema }).concat([selectionPlugin]),
      }),
    });

    return () => {
      // 清理工作，在组件卸载时销毁编辑器以避免内存泄漏
      editorView.destroy();
    };
  }, []);

  const printContentAsJSON = () => {
    if (editorView) {
      const content = editorView.state.doc.toJSON();
      console.log(content);
    }
  };

  const applyBold = () => {
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
