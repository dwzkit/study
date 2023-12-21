"use client";
import { Schema } from "prosemirror-model";
import { schema as BasciSchema } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import "prosemirror-view/style/prosemirror.css";
import React, { useState } from "react";
import { addListNodes } from "prosemirror-schema-list";
import { exampleSetup } from "prosemirror-example-setup";
import { ProseMirror } from "@nytimes/react-prosemirror";

const mySchema = new Schema({
  nodes: addListNodes(BasciSchema.spec.nodes, "paragraph block*", "block"),
  marks: BasciSchema.spec.marks,
});

import { toggleMark } from "prosemirror-commands";
import { useEditorEventCallback } from "@nytimes/react-prosemirror";

function Menu() {
  return (
    <div className="flex justify-between items-center border border-gray-300">
      <div className="flex items-center">
        <BoldButton />
        <button>Italic</button>
      </div>
    </div>
  );
}

function BoldButton() {
  const onClick = useEditorEventCallback((view) => {
    if (view) {
      const toggleBoldMark = toggleMark(view.state.schema.marks.strong);
      toggleBoldMark(view.state, view.dispatch, view);
      view.focus(); // 重新聚焦编辑器
    }
  });

  return <button onClick={onClick}>Bold</button>;
}

export default function Home() {
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [editorState, setEditorState] = useState(
    EditorState.create({
      schema: mySchema,
      plugins: exampleSetup({ schema: mySchema }),
    })
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24 border border-black gap-4">
      <h1>React ProseMirror Demo</h1>
      <ProseMirror
        mount={mount}
        state={editorState}
        dispatchTransaction={(tr) => {
          setEditorState((s) => s.apply(tr));
        }}
      >
        <Menu />
        <div
          ref={setMount}
          className="border border-gray-300 focus:outline-none w-1/1"
        />
        <button
          onClick={() => {
            const content = editorState.doc.toJSON();
            console.log(content);
          }}
        >
          打印
        </button>
      </ProseMirror>
    </main>
  );
}
