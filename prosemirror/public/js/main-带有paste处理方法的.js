import {EditorState, TextSelection} from 'prosemirror-state';
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
        console.log("加载成功")
        // 监听按键事件 https://chat.openai.com/c/ee4853cd-f1f8-447c-b29f-e1cfd5883959
        // this.contentDOM.addEventListener('keydown', this.handleKeyDown.bind(this));
        // 添加粘贴事件监听器
        // this.contentDOM.addEventListener('paste', this.handlePaste.bind(this));
    }

    // 处理粘贴事件的方法
    handlePaste(event) {
        const clipboardData = event.clipboardData || window.clipboardData;
        if (!clipboardData) {
            // 如果没有剪贴板数据，保持默认行为
            return;
        }

        const pastedData = clipboardData.getData('text/html');


        console.log("pastedData:",pastedData)
        try {
            // 创建一个新的 div 元素来解析 HTML 内容
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = pastedData;

            // 使用 ProseMirror 的 DOMParser 解析 HTML
            const parsedContent = DOMParser.fromSchema(mySchema).parseSlice(tempDiv);
            console.log("parsedContent",parsedContent)

            // 提取所有文本内容作为一个内联节点
            let textContent = '';
            parsedContent.content.forEach(node => {
                textContent += node.textContent;
            });

            const { state, dispatch } = this.view;
            const { tr } = state;
            let insertPos = this.isEmpty() ? this.getPos() + 1 : state.selection.$head.pos;

            // 创建文本节点并插入
            const textNode = mySchema.text(textContent);
            tr.insert(insertPos, textNode);

            // 更新事务以移动光标到新插入内容的末尾
            const endPos = insertPos + textContent.length;
            tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)));

            // 应用事务
            dispatch(tr);
            this.update(this.node)
            event.preventDefault(); // 只有在成功插入后阻止默认行为
        } catch (e) {
            console.error("Error parsing pasted content: ", e);
            // 如果解析失败，允许默认粘贴行为
        }
    }

    // 重写 stopEvent 方法
    stopEvent(event) {
        // 如果是 Backspace 或 Delete 并且内容为空，则拦截事件
        if ((event.key === 'Backspace' || event.key === 'Delete') && this.isEmpty()) {
            event.preventDefault();
            return true; // 拦截事件，不让编辑器处理
        }
        // 对于其他事件，返回 false 让编辑器正常处理
        return false;
    }

    update(node) {
        // 检查传入的 node 是否与当前 node 视图兼容
        if (!node.sameMarkup(this.node)) {
            return false;
        }

        // 更新内部 node 引用
        this.node = node;

        // 返回 true 表示该节点已被更新
        return true;
    }

    destroy() {
        // 移除事件监听器
        this.contentDOM.removeEventListener('keydown', this.handleKeyDown);

        // 执行其他清理工作（如果有）
    }

    // 新增方法：处理按键事件
    handleKeyDown(event) {
        if ((event.key === 'Backspace' || event.key === 'Delete') && this.isEmpty()) {
            event.preventDefault();
        }
    }

    // 新增方法：检查内容是否为空
    isEmpty() {
        return this.contentDOM.textContent.trim() === '';
    }

    createContainer() {
        const dom = document.createElement("span");
        dom.contentEditable = false  // 需要加上这句话，否则在chrome\safari\edge浏览器移动光标时候会出现偏差
        // dom.style.display = "inline-block" // 需要加上这句话，否则在chrome\safari\edge浏览器移动光标时候会出现偏差
        dom.setAttribute("data-type", this.node.attrs["data-type"] || "");
        return dom;
    }

    createContentArea(node) {
        const contentDOM = document.createElement("input");
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
            this.contentDOM.setAttribute("data-placeholder",this.node.attrs["data-placeholder"]|| "请输入内容")
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

function insertinput_node(nodeType, placeholder) {
    return (state, dispatch) => {
        const { selection } = state;
        const position = selection.$cursor ? selection.$cursor.pos : selection.$to.pos;

        // const initialContent = mySchema.text("重要客户")
        const initialContent = ""
        const node = nodeType.create({ "data-placeholder": placeholder }, initialContent);

        const transaction = state.tr.insert(position, node);

        if (dispatch) {
            dispatch(transaction);
        }

        return true;
    };
}

const insertCommand = insertinput_node(mySchema.nodes.input_node,"VIP客户");

document.querySelector('#myButton').addEventListener('click', () => {
    const { state, dispatch } = window.view;
    insertCommand(state, dispatch);
});

function findinput_nodeNearPos(doc, pos) {
    let $pos = doc.resolve(pos);
    for (let d = $pos.depth; d > 0; d--) {
        if ($pos.node(d).type.name === 'input_node') {
            return $pos.node(d);
        }
    }
    return null;
}

function addContentToinput_node() {
    const { state, dispatch } = window.view;
    const { selection } = state;
    const position = selection.$anchor.pos;
    const input_node = findinput_nodeNearPos(state.doc, position);

    if (input_node) {
        const startPos = state.doc.resolve(selection.$anchor.before()).start();
        const endPos = startPos + input_node.nodeSize;
        const textNode = mySchema.text('测试');
        const transaction = state.tr.insert(endPos - 2, textNode); // -2 是因为我们要在节点内部的末尾插入，而不是在节点边界之外
        dispatch(transaction);
    }
}

document.querySelector('#addContentButton').addEventListener('click', addContentToinput_node);

function getPosition() {
    console.log("from",window.view.state.selection.from)
    console.log("to",window.view.state.selection.to)
    console.log("anchor",window.view.state.selection.anchor)
    console.log("$anchor",window.view.state.selection.$anchor)
    console.log(".state.doc.resolve(pos)",window.view.state.doc.resolve(window.view.state.selection.anchor))
    window.view.focus()

    console.log("test",JSON.stringify(window.view.state.doc.content.toJSON()))
    const view  = window.view
    const jsonData = [
        {
            type: "paragraph",
            content: [
                {
                    type: "text",
                    text: "现在你扮演会务行政专家，帮",
                },
                {
                    type: "input_node",
                    attrs: {
                        "data-type": "input",
                        "data-placeholder": "VIP客户",
                    },
                },
                { type: "text", text: "我撰写一封给的邀请函" },
            ],
        },
    ];
    console.log(
        "view.state.schema",
        view.state.schema
    );
    // 将 JSON 数据转换为 ProseMirror 节点
    const nodes = jsonData.map((node) =>
        view.state.schema.nodeFromJSON(node)
    );

    // 创建一个事务并插入节点
    const tr = view.state.tr;
    nodes.forEach((node) => {
        tr.insert(0, node); // pos 是你想要插入节点的位置
    });

    // 应用事务
    view.dispatch(tr);

    view.focus();
}

document.querySelector('#getpos').addEventListener('click', getPosition);
