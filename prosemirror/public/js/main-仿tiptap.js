import {EditorState} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {Schema, DOMParser, DOMSerializer} from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

const node_view = {
    content: "inline*",
    group: "block",
    selectable: true,
    parseDOM: [{
        tag: 'node-view',
    }],
    toDOM(node) {
        return ["node-view", undefined, 0];
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


        this.dom = document.createElement('div')
        this.dom.classList.add('node-view')

        this.contentDOM = document.createElement('div')
        this.contentDOM.classList.add('content')

        const label = document.createElement('span')

        label.classList.add('label')
        label.innerHTML = 'Node view'
        label.contentEditable = false

        // 分别添加 label 和 contentDOM 到 dom
        this.dom.appendChild(label);
        this.dom.appendChild(this.contentDOM);
    }

}

window.view = new EditorView(document.querySelector('#editor'), {
    state: EditorState.create({
        doc: DOMParser.fromSchema(mySchema).parse(document.querySelector('#content')),
        plugins: exampleSetup({ schema: mySchema }),
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
                    ]
                },
                // {
                //     "type": "node_view",
                //     "content": [
                //         {
                //             "type": "paragraph",
                //             "content": [
                //                 {
                //                     "type": "text",
                //                     "text": "This is editable."
                //                 }
                //             ]
                //         }
                //     ]
                // },
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
// 将 JSON 数据转换为 ProseMirror 节点
        const nodes = jsonData.map((node) =>
            view.state.schema.nodeFromJSON(node)
        );

        // 创建一个事务并插入节点
        const tr = view.state.tr;
        nodes.forEach((node) => {
            tr.insert(0, node); // pos 是你想要插入节点的位置
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
