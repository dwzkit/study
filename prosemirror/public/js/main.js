import {EditorState,Plugin,PluginKey,TextSelection} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {Schema, DOMParser} from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

const node_view = {
    attrs: {
        "data-type": { default: "input" },
        "options": { default: [] }, // 存储选项的属性
        // 可以添加其他属性
    },
    content: "inline*",
    inline:true,
    group:"inline",
    selectable: true,
    parseDOM: [{
        tag: 'span.node-view',  // 适用于您的 DOM 结构
        getAttrs: dom => ({
            "data-type": dom.getAttribute("data-type") || "input",
            "options": JSON.parse(dom.getAttribute("options") || "[]")
        })
    }],
    toDOM(node) {
        return ["span", { class: 'node-view',
            "data-type": node.attrs["data-type"],
            "options": JSON.stringify(node.attrs["options"]) }, 0];  // 调整为适合您的 DOM 结构
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
        this.dom.classList.add('node-view')

        this.contentDOM = document.createElement('span')
        this.contentDOM.classList.add('content')
        this.contentDOM.contentEditable = true

        // 添加零宽空格和内容元素
        this.dom.appendChild(this.createZeroWidthSpace());
        this.dom.appendChild(this.contentDOM);
        this.dom.appendChild(this.createZeroWidthSpace());

        const dataType = node.attrs["data-type"];
        this.options = node.attrs["options"];
        this.dom.setAttribute('data-type',dataType)
        this.dom.setAttribute('options',this.options)

        switch (dataType) {
            case 'radio':
                this.dropdownMenu = null; // 初始化下拉菜单引用为 null
                this.createDropdownMenu(this.options);
                break;
            case 'checkbox':
                break;
            case 'default':
                break;
        }
    }

    // 创建零宽空格元素
    createZeroWidthSpace() {
        const zeroWidthSpace = document.createElement('span');
        zeroWidthSpace.innerHTML = '&#8203;';
        zeroWidthSpace.contentEditable = false;
        return zeroWidthSpace;
    }

    // 创建下拉菜单
    createDropdownMenu(options) {
        // 创建下拉菜单元素
        this.dropdownMenu = document.createElement('div');
        this.dropdownMenu.classList.add('dropdown-menu');
        this.dropdownMenu.style.display = 'none'; // 初始隐藏

        // 添加单选项
        options.forEach(option => {
            const item = this.createDropdownItem(option);
            this.dropdownMenu.appendChild(item);
        });

        // 将下拉菜单添加到 DOM
        document.body.appendChild(this.dropdownMenu);
        this.setupDropdownInteractions(this.dropdownMenu);
        // 更新下拉菜单的选中状态
        this.updateDropdownSelection(this.node.textContent);
    }

    // 创建下拉菜单项
    createDropdownItem(option) {
        const item = document.createElement('div');
        item.classList.add('dropdown-item')

        const statusElement = document.createElement('span')
        statusElement.classList.add('status-element')

        item.appendChild(statusElement);
        item.appendChild(document.createTextNode(option));
        item.onclick = () => this.handleSelectOption(option);
        return item;
    }

    // contentDOM的click事件
    handleContentDOMClickInteraction = (dropdownMenu) => {
        const rect = this.contentDOM.getBoundingClientRect();
        dropdownMenu.style.left = `${rect.left}px`;
        dropdownMenu.style.top = `${rect.bottom}px`;
        dropdownMenu.style.display = 'block';
    }

    // document的click事件
    handleDocumentClick = (event,dropdownMenu) => {
        if (!this.dom.contains(event.target)) {
            dropdownMenu.style.display = 'none';
        }
    }

    // 设置下拉菜单的交互
    setupDropdownInteractions(dropdownMenu) {
        this.contentDOM.addEventListener('click', () => this.handleContentDOMClickInteraction(dropdownMenu));

        document.addEventListener('click', (event) => this.handleDocumentClick(event, dropdownMenu), true);
    }

    handleSelectOption(option) {
        // 获取当前节点的位置
        const pos = this.getPos();

        // 创建一个文档片段包含新内容
        const content = this.view.state.schema.text(option);
        console.log("pos",pos,"pos + this.node.nodeSize",pos + this.node.nodeSize)
        // 创建并分派事务
        const tr = this.view.state.tr.replaceWith(pos+1, pos + this.node.nodeSize-1, content);
        this.view.dispatch(tr);
        this.updateDropdownSelection(option);
        console.log(`选中了选项: ${option}`);
    }

    updateDropdownSelection(currentText) {
        document.querySelectorAll('.dropdown-item .status-element').forEach((elem, index) => {
            elem.classList.toggle('selected', currentText === this.options[index]);
        });
    }

    update(node, decorations) {
        // 检查节点是否已经改变
        if (node.type !== this.node.type) {
            return false; // 返回 false 表示这个 NodeView 不能用于新的节点，ProseMirror 将会创建一个新的 NodeView
        }

        this.node = node;

        // 更新下拉菜单的选中状态
        this.updateDropdownSelection(node.textContent);

        return true; // 返回 true 表示 NodeView 已成功更新
    }

    destroy() {
        // 执行其他清理工作（如果有）
         // dropdown元素也应该销毁
        // 如果存在下拉菜单，从 DOM 中移除它
        console.log("被销毁")
        if (this.dropdownMenu) {
            document.removeEventListener('click', this.handleContentDOMClickInteraction);
            this.contentDOM.removeEventListener('click', this.handleDocumentClick);
            this.dropdownMenu.parentNode.removeChild(this.dropdownMenu);
            this.dropdownMenu = null;
        }
    }
}

export const reactPropsKey = new PluginKey("reactProps");

const keydownPlugin = new Plugin({
    key: reactPropsKey,
    props: {
        handleKeyDown(view, event) {
            console.log("endOfTextblock-forward",view.endOfTextblock("forward"))
            console.log("endOfTextblock-backward",view.endOfTextblock("backward"))
            // 检查当前焦点是否在您的自定义节点内
            if (event.key === "Backspace") {
                // 获取当前选择的头部位置
                const { head } = view.state.selection;
                // 获取该位置的节点及其前一个节点
                const node = view.state.doc.nodeAt(head);
                const prevNode = view.state.doc.nodeAt(head - 1);
                const prev2Node = view.state.doc.nodeAt(head - 2);

                console.log("node && node.type.name",node && node.type.name)
                console.log("prevNode && prevNode.type.name",prevNode && prevNode.type.name)
                console.log("prev2Node && prev2Node.type.name",prev2Node && prev2Node.type.name)

                // 检查当前节点或前一个节点是否是 node_view 类型
                if ((prevNode && prevNode.type.name === "node_view" || prev2Node && prev2Node.type.name === "node_view")) {
                    // 获取 node_view 的 DOM 表示
                    const dom = node ? view.nodeDOM(head) :prevNode? view.nodeDOM(head - 1): view.nodeDOM(head - 2);
                    console.log("dom",dom && dom.nodeType)
                    if (dom && dom.nodeType === Node.ELEMENT_NODE) {
                        const contentDOM = dom.querySelector('.content'); // 假设您的 contentDOM 有 'content' 类
                        console.log("contentDOM",contentDOM)
                        // 检查 contentDOM 是否为空
                        if (contentDOM && contentDOM.textContent.trim() === '') {
                            event.preventDefault();  // 2023年12月9日 阻止传播的目的是为了防止safari莫名其妙的出现多个node_view，但是firforx当删掉最后一个字母的时候整个node_view就会丢失掉。而chrome和edge就算不需要这个阻止，也不会有问题，执行删除这个node_view依然 会正常的被保留
                            return true; // 阻止事件继续传播
                        }
                    } else if (dom && dom.nodeType === Node.TEXT_NODE) {
                        // 实现删除最后一个字符的逻辑，避免firfox当删掉最后一个字母的时候整个node_view跟着丢失
                        let tr = view.state.tr;
                        if (tr.doc.content.size > 1) {
                            tr.delete(head - 1, head);
                            view.dispatch(tr);
                        }
                        return true // 阻止事件继续传播
                    }
                }
            }  else if (event.key === "ArrowLeft") {
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
                const { head, $head } = view.state.selection;
                // 检查光标所在位置的父节点
                const parentNode = $head.parent;
                const parentNodeType = parentNode.type.name;
                // 如果光标所在的父节点是我们关心的 node_view
                if (parentNodeType === "node_view") {
                    // 获取光标在父节点中的相对位置
                    const offsetInParent = $head.parentOffset;

                    console.log("parentNodeType",parentNodeType,"offsetInParent",offsetInParent,"parentNode.content.size",parentNode.content.size)
                    // 如果光标在父节点内的偏移量等于父节点内容的长度
                    // 则光标位于 node_view 的末尾
                    if (offsetInParent === parentNode.content.size) {
                        event.preventDefault();

                        // 计算新的光标位置
                        const newPos = head + 1;

                        // 创建一个新的文本选择
                        const newSelection = TextSelection.create(view.state.doc, newPos);

                        // 创建并分发一个事务来更新选择
                        const tr = view.state.tr.setSelection(newSelection);
                        view.dispatch(tr);

                        return true;
                    }
                }
                // 其他键盘事件处理逻辑
            }
            // 返回 false 以允许 ProseMirror 继续处理事件
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
                            "attrs": {
                                "data-type": "radio",  // 或 "checkbox"
                                "options": ["选项1", "选项2", "选项3"]
                            },
                            "content": [
                                {
                                    "type": "text",
                                    "text": "A"
                                }
                            ]
                        },
                        {
                            "type": "text",
                            "text": "This is still the text editor you’re used to, but enriched with node views."
                        },
                        {
                            "type": "node_view",
                            "attrs": {
                                "data-type": "input",
                            },
                            "content": [
                                {
                                    "type": "text",
                                    "text": "这是一个纯输入框"
                                }
                            ]
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
function getPosition() {
    // console.log("from",window.view.state.selection.from)
    // console.log("to",window.view.state.selection.to)
    // console.log("anchor",window.view.state.selection.anchor)
    // console.log("$anchor",window.view.state.selection.$anchor)
    // console.log(".state.doc.resolve(pos)",window.view.state.doc.resolve(window.view.state.selection.anchor))
    console.log("内容",window.view.state.doc.toJSON())
    window.view.focus()
}

document.querySelector('#getpos').addEventListener('click', getPosition);

// // 获取当前选择的头部位置
// const { head } = view.state.selection;
// // 获取该位置的节点及其前一个节点
// const node = view.state.doc.nodeAt(head);
// const prevNode = view.state.doc.nodeAt(head - 1);
//
// console.log("node && node.type.name",node && node.type.name)
// console.log("prevNode && prevNode.type.name",prevNode && prevNode.type.name)
//
// // 检查当前节点或前一个节点是否是 node_view 类型
// if ((node && node.type.name === "node_view") || (prevNode && prevNode.type.name === "node_view")) {
//     event.preventDefault();
//
//     // 计算新的光标位置
//     const newPos = head - 1;
//
//     // 创建一个新的文本选择
//     const newSelection = TextSelection.create(view.state.doc, newPos);
//
//     // 创建并分发一个事务来更新选择
//     const tr = view.state.tr.setSelection(newSelection);
//     view.dispatch(tr);
//
//     return true; // 阻止事件继续传播
// }
