
import {EditorState} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {Schema, DOMParser, DOMSerializer} from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

const input_node = {
    attrs: {
        "data-type":{default:"input"},
        "data-placeholder":{}
    },
    inline: true,
    content: "inline*",
    group: "inline",
    selectable: true,
    parseDOM: [{
        tag: 'span[data-type="input"]',
        getAttrs: dom => ({
            "data-type":dom.getAttribute("data-type") || "",
            "data-placeholder": dom.getAttribute("data-placeholder") || ""
        })
    }],
    toDOM(node) {
        return ["span", {"data-type": node.attrs["data-type"] || "", "data-placeholder": node.attrs["data-placeholder"] || ""}, 0];
    }
};

const mySchema = new Schema({
    nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block').append({
        input_node,
    }),
    marks: basicSchema.spec.marks,
});

class InputNodeView  {
    constructor(node, view, getPos) {
        this.node = node
        this.getPos = getPos
        this.dom = this.createContainer();
        this.view = view;
        this.contentDOM = this.createContentArea(node);
        this.dom.appendChild(this.contentDOM);
        this.updateContent(node);
    }

    stopEvent(event) {
        if ((event.key === 'Backspace' || event.key === 'Delete') && this.isEmpty()) {
            event.preventDefault();
            return true;
        }
        return false;
    }

    update(node) {
        if (!node.sameMarkup(this.node)) {
            return false;
        }

        this.node = node;

        return true;
    }

    destroy() {
    }

    isEmpty() {
        return this.contentDOM.textContent.trim() === '';
    }

    createContainer() {
        const dom = document.createElement("span");
        dom.contentEditable = false
        dom.setAttribute("data-type", this.node.attrs["data-type"] || "");
        return dom;
    }

    createContentArea(node) {
        const contentDOM = document.createElement("span");
        contentDOM.contentEditable = true;
        contentDOM.classList.add("ai-input-area")
        return contentDOM;
    }

    updateContent(node) {
        this.contentDOM.textContent = '';
        const fragment = DOMSerializer.fromSchema(mySchema).serializeFragment(node.content);
        this.contentDOM.appendChild(fragment);
        this.updateContentEmptyState()
    }

    updateContentEmptyState() {
        if (this.contentDOM.textContent.trim() === "") {
            this.contentDOM.setAttribute("data-placeholder",this.node.attrs["data-placeholder"]|| "please input something")
        } else {
        }
    }
}

window.view = new EditorView(document.querySelector('#editor'), {
    state: EditorState.create({
        doc: DOMParser.fromSchema(mySchema).parse(document.querySelector('#content')),
        plugins: exampleSetup({ schema: mySchema }),
    }),
    nodeViews: {
        input_node(node, view, getPos) {
            return new InputNodeView(node, view, getPos);
        },
    },
});

function insertinput_node() {
    return (state, dispatch) => {
        const { selection } = state;
        let position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos;
        const view  = window.view
        const jsonData = [
            {
                type: "text",
                text: "Now you are playing the role of a conference administration expert, help me write an invitation letter to a ",
            },
            {
                type: "input_node",
                attrs: {
                    "data-type": "input",
                    "data-placeholder": "VIP client",
                },
            },
            {
                type: "text",
                text: ".",
            },
        ];

        const nodes = jsonData.map((node) => {
            if (node.type === 'text') {
                return state.schema.text(node.text);
            } else {
                return view.state.schema.nodeFromJSON(node);
            }
        });

        const tr = view.state.tr;
        nodes.forEach((node) => {
            tr.insert(position, node);
            position += node.nodeSize;
        });

        view.dispatch(tr);
        view.focus();
    };
}

const insertCommand = insertinput_node();

document.querySelector('#myButton').addEventListener('click', () => {
    const { state, dispatch } = window.view;
    insertCommand(state, dispatch);
});
