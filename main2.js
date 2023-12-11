import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';

window.addEventListener('DOMContentLoaded', (event) => {
    console.log("2");

    const editorNode = document.getElementById('mad_interactive_editor');

    const state = EditorState.create({
        schema,
    });

    const view = new EditorView(editorNode, {
        state,
    });
});
