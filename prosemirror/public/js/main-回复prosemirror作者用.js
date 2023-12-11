import {EditorState,Plugin,PluginKey,TextSelection} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {Schema, DOMParser} from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

const node_view = {
    content: "inline*",
    inline:true,
    isolating:true,
    group:"inline",
    selectable: true,
    parseDOM: [{
        tag: 'span.node-view',
    }],
    toDOM(node) {
        return ["span", { class: 'node-view' }, 0];  // 调整为适合您的 DOM 结构
    }
};

const mySchema = new Schema({
    nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block').append({
        node_view,
    }),
    marks: basicSchema.spec.marks,
});

class InputNodeView  {
    constructor(node, view, getPos) {
        this.node = node
        this.getPos = getPos
        this.view = view;

        this.dom = document.createElement('span')
        // this.dom.contentEditable = true
        this.dom.classList.add('node-view')

        this.contentDOM = document.createElement('span')
        this.contentDOM.contentEditable = true
        this.contentDOM.classList.add('content')

        /*
            Add zero-width spaces to both sides of the contentDOM.
            This approach, to some extent, unifies the behavior in Chrome, Edge, Firefox, and Safari
            when moving the cursor into the contentDOM from its edges, which otherwise causes misplaced cursor positions.
         */
        const zeroWidthSpaceLeft = document.createElement('span')
        zeroWidthSpaceLeft.innerHTML = '&#8203;';
        zeroWidthSpaceLeft.contentEditable = false

        this.dom.appendChild(zeroWidthSpaceLeft);
        this.dom.appendChild(this.contentDOM);

        const zeroWidthSpaceRight = document.createElement('span')
        zeroWidthSpaceRight.innerHTML = '&#8203;';
        zeroWidthSpaceRight.contentEditable = false

        this.dom.appendChild(zeroWidthSpaceRight);
    }
    // stopEvent(event) {
    //     console.log("event",event)
    //     if ((event.key === 'Backspace' || event.key === 'Delete') && this.isEmpty()) {
    //         event.preventDefault();
    //         return true;
    //     }
    //     return false;
    // }
}

export const reactPropsKey = new PluginKey("reactProps");

const keydownPlugin = new Plugin({
    key: reactPropsKey,
    props: {
        handleKeyDown(view, event) {
            if (event.key === "Backspace") {
                const { head } = view.state.selection;
                const node = view.state.doc.nodeAt(head);
                const prevNode = view.state.doc.nodeAt(head - 1);
                const prev2Node = view.state.doc.nodeAt(head - 2);

                if ((prevNode && prevNode.type.name === "node_view" || prev2Node && prev2Node.type.name === "node_view")) {
                    const dom = node ? view.nodeDOM(head) :prevNode? view.nodeDOM(head - 1): view.nodeDOM(head - 2);
                    console.log("dom",dom && dom.nodeType)
                    if (dom && dom.nodeType === Node.ELEMENT_NODE) {
                        const contentDOM = dom.querySelector('.content'); // 假设您的 contentDOM 有 'content' 类
                        console.log("contentDOM",contentDOM)
                        if (contentDOM && contentDOM.textContent.trim() === '') {
                            /*
                                we encountered a cross-browser compatibility issue.
                                In Safari, we implemented a preventative measure to avoid
                                the inexplicable appearance of multiple node_views under certain circumstances.
                                However, in Firefox, when the last letter in a node_view is deleted,
                                the entire node_view unexpectedly disappears.
                                In contrast, Chrome and Edge browsers behave normally even without this preventative measure.
                                They can maintain the node_view properly even when a deletion operation is performed.
                             */
                            event.preventDefault();
                            return true; // Prevent the event from further propagation
                        }
                    } else if (dom && dom.nodeType === Node.TEXT_NODE) {
                        /*
                            Implement the logic to delete the last character,
                            to prevent the entire node_view from being lost in Firefox when the last letter is deleted.
                        */
                        let tr = view.state.tr;
                        if (tr.doc.content.size > 1) {
                            tr.delete(head - 1, head);
                            view.dispatch(tr);
                        }
                        return true
                    }
                }
            } else if (event.key === "ArrowLeft") {
                /*
                    Detect ArrowLeft and ArrowRight at the edge of the node_view, and use ProseMirror's transactions
                    to replace the browser's own cursor movement behavior. This is done to prevent the cursor from being
                    misplaced at the edges of elements with contentEditable=true
                 */
                const { head, $head } = view.state.selection;
                const parentNode = $head.parent;
                const parentNodeType = parentNode.type.name;
                if (parentNodeType === "node_view") {
                    const offsetInParent = $head.parentOffset;
                    console.log("offsetInParent",offsetInParent)
                    if (offsetInParent === 0) {
                        event.preventDefault();
                        const newPos = head - 1;
                        const newSelection = TextSelection.create(view.state.doc, newPos);
                        const tr = view.state.tr.setSelection(newSelection);
                        view.dispatch(tr);

                        return true;
                    }
                }
            } else if (event.key === "ArrowRight") {
                /*
                    Detect ArrowLeft and ArrowRight at the edge of the node_view, and use ProseMirror's transactions
                    to replace the browser's own cursor movement behavior. This is done to prevent the cursor from being
                    misplaced at the edges of elements with contentEditable=true
                 */
                const { head, $head } = view.state.selection;
                const parentNode = $head.parent;
                const parentNodeType = parentNode.type.name;
                if (parentNodeType === "node_view") {
                    const offsetInParent = $head.parentOffset;
                    console.log("parentNodeType",parentNodeType,"offsetInParent",offsetInParent,"parentNode.content.size",parentNode.content.size)
                    if (offsetInParent === parentNode.content.size) {
                        event.preventDefault();
                        const newPos = head + 1;
                        const newSelection = TextSelection.create(view.state.doc, newPos);
                        const tr = view.state.tr.setSelection(newSelection);
                        view.dispatch(tr);
                        return true;
                    }
                }
            }
            return false;
        }
    }
});

window.view = new EditorView(document.querySelector('#editor'), {
    state: EditorState.create({
        doc: DOMParser.fromSchema(mySchema).parse(document.querySelector('#content')),
        plugins: exampleSetup({ schema: mySchema }).concat(keydownPlugin),
    }),
    nodeViews: {
        node_view(node, view, getPos) {
            return new InputNodeView(node, view, getPos);
        },
    },
});

function insertnode_view() {
    return (state, dispatch) => {
        const { selection } = state;
        let position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos;
        const view  = window.view
        const jsonData = [{
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "This is still the text editor you’re used to, but enriched with node views."
                        },
                        {
                            "type": "node_view",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "This is editable."
                                }
                            ]
                        },
                        {
                            "type": "text",
                            "text": "This is still the text editor you’re used to, but enriched with node views."
                        },
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "Did you see that? That’s a JavaScript node view. We are really living in the future."
                        }
                    ]
                }
            ]
        }]

        const nodes = jsonData.map((node) =>
            view.state.schema.nodeFromJSON(node)
        );

        const tr = view.state.tr;
        nodes.forEach((node) => {
            tr.insert(0, node);
        });
        view.dispatch(tr);
        view.focus();
    };
}

const insertCommand = insertnode_view();

document.querySelector('#myButton').addEventListener('click', () => {
    const { state, dispatch } = window.view;
    insertCommand(state, dispatch);
});
function getPosition() {
    console.log("from",window.view.state.selection.from)
    console.log("to",window.view.state.selection.to)
    console.log("anchor",window.view.state.selection.anchor)
    console.log("$anchor",window.view.state.selection.$anchor)
    console.log(".state.doc.resolve(pos)",window.view.state.doc.resolve(window.view.state.selection.anchor))
    window.view.focus()
}

document.querySelector('#getpos').addEventListener('click', getPosition);
