import {EditorState,Plugin,PluginKey,TextSelection} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {Schema, DOMParser} from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

import {computePosition, flip, offset, shift,autoUpdate} from "@floating-ui/dom";

const node_view = {
    attrs: {
        "data-type": { default: "input" },
        "options": { default: [] }, // 存储选项的属性
        "data-placeholder": {}
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
            "data-placeholder": dom.getAttribute("data-placeholder") || "",
            "options": JSON.parse(dom.getAttribute("options") || "[]")
        })
    }],
    toDOM(node) {
        return ["span", { class: 'node-view',
            "data-type": node.attrs["data-type"],
            "data-placeholder": node.attrs["data-placeholder"],
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
        this.contentDOM.setAttribute("data-placeholder",node.attrs["data-placeholder"] || "")
        this.contentDOM.contentEditable = true

        // 添加零宽空格和内容元素
        this.dom.appendChild(this.createZeroWidthSpace());
        this.dom.appendChild(this.contentDOM);
        this.dom.appendChild(this.createZeroWidthSpace());

        this.dataType = node.attrs["data-type"];
        this.options = node.attrs["options"];
        this.dom.setAttribute('data-type',this.dataType)
        this.dom.setAttribute('options',this.options)
        this.dropdownMenu = null;
        if (this.dataType === "radio" || this.dataType === "checkbox") {
            // 绑定方法的原因：https://chat.openai.com/c/d9c05aa1-a512-42d9-b749-7b1b6677e8b3
            this.hideDropdownBound = this.hideDropdown.bind(this);

            this.createDropdownMenu(this.options);
            this.cleanup = autoUpdate(
                this.contentDOM,
                this.dropdownMenu,
                this.updateDropdownFloatingPostion
            );
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

        const fragment = document.createDocumentFragment();
        options.forEach(option => {
            const item = this.createDropdownItem(option);
            fragment.appendChild(item);
        });
        this.dropdownMenu.appendChild(fragment);
        this.updateDropdownSelection(this.node.textContent);

        this.setupDropdownInteractions();
        document.body.appendChild(this.dropdownMenu);
    }

    // 设置下拉菜单的交互
    setupDropdownInteractions() {
        this.contentDOM.addEventListener("click",()=>this.showDropdown());
        document.addEventListener('click', this.hideDropdownBound, true);
    }

    // 改用箭头函数的原因：https://chat.openai.com/c/d9c05aa1-a512-42d9-b749-7b1b6677e8b3
    updateDropdownFloatingPostion = () => {
        computePosition(this.contentDOM, this.dropdownMenu, {placement: 'bottom-start',
            middleware: [offset(5), flip(), shift()]}).then(({x, y, placement, middlewareData}) => {
            Object.assign(this.dropdownMenu.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
        });
    }

    showDropdown() {
        this.dropdownMenu.style.display = 'flex';
        this.updateDropdownFloatingPostion();
    }

    hideDropdown(event) {
        switch (this.dataType) {
            case "radio":
                if (!this.dom.contains(event.target)) {
                    this.dropdownMenu.style.display = '';
                }
                break;
            case "checkbox":
                if (!this.dom.contains(event.target) && !this.dropdownMenu.contains(event.target)) {
                    this.dropdownMenu.style.display = '';
                }
                break;
        }
    }

    createDropdownItem(option) {
        const item = document.createElement('div');
        item.classList.add('dropdown-item')

        switch (this.dataType) {
            case "radio":
                const statusElement = document.createElement('span')
                statusElement.classList.add('status-element')

                item.appendChild(statusElement);
                item.appendChild(document.createTextNode(option));
                item.onclick = () => this.handleRadioSelect(option);
                break;
            case 'checkbox':
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = option;
                // checkbox.onchange = () => this.handleCheckboxSelect(checkbox, option);

                const text = document.createTextNode(option);

                item.appendChild(checkbox);
                item.appendChild(text);

                // 点击item时处理checkbox状态
                item.onclick = (event) => {
                    if (event.target !== checkbox) {
                        // 如果不是直接点击checkbox，则手动切换状态
                        checkbox.checked = !checkbox.checked;
                    }
                    // 调用处理函数
                    this.handleCheckboxSelect(checkbox, option);
                };

                break;
        }
        return item;
    }

    handleCheckboxSelect(checkbox, option) {
        if (checkbox.checked) {
            // 选中操作
            console.log(`选中了选项: ${option}`);
            const pos = this.getPos() + this.node.nodeSize - 1;

            // 创建一个文档片段包含新内容
            const content = this.view.state.schema.text(this.node.textContent === "" ? option : "、"+ option);
            // 创建并分派事务
            const tr = this.view.state.tr.insert(pos, content);
            this.view.dispatch(tr);
        } else {
            // 取消选中操作
            console.log(`取消了选项: ${option}`);
            const textToRemove = option;
            const startPos = this.getPos() + 1;
            const endPos = startPos + this.node.nodeSize -1 ;

            // 从右向左搜索匹配的文本
            this.view.state.doc.nodesBetween(startPos, endPos, (node, pos) => {
                console.log("node",node,"pos",pos)
                if (node.type.name === this.node.type.name ) {
                    const textContent = node.textContent;
                    const indexToRemove = textContent.lastIndexOf(textToRemove);
                    if (indexToRemove !== -1) {
                        let start = pos + indexToRemove + 1;
                        let end = start + textToRemove.length;

                        // 如果textToRemove前面有顿号，则更新删除的起始位置
                        if (indexToRemove > 0 && textContent[indexToRemove - 1] === '、') {
                            start -= 1; // 向前移动一个字符位置以包括顿号
                        } else if (indexToRemove === 0 && textContent[indexToRemove + textToRemove.length] === '、') {
                            end += 1; // 向后移动一个字符位置以包括顿号
                        }

                        const tr = this.view.state.tr.delete(start, end);
                        this.view.dispatch(tr);
                        return false; // 找到并删除后停止搜索
                    }
                }
            });
        }
    }

    handleRadioSelect(option) {
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
        switch (this.dataType) {
            case "radio":
                Array.from(this.dropdownMenu.children).forEach((elem, index) => {
                    // 选择每个elem中的.status-element子元素
                    const statusElement = elem.querySelector('.status-element');
                    if (statusElement) {
                        // 切换selected类，基于currentText和this.options的比较
                        statusElement.classList.toggle('selected', currentText === this.options[index]);
                    }
                });
                break;
            case "checkbox":
                // 将currentText分割成数组
                const selectedOptions = currentText.split('、');

                // 遍历this.dropdownMenu的子元素
                Array.from(this.dropdownMenu.children).forEach((item, index) => {
                    // 假设每个子元素中的第一个input元素是checkbox
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        // 检查是否选项在selectedOptions中
                        checkbox.checked = selectedOptions.includes(this.options[index]);
                    }
                });
                break;
        }
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
        console.log("被销毁")
        if (this.dropdownMenu) {
            this.cleanup();
            document.removeEventListener('click', this.hideDropdownBound, true);
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
                                "data-placeholder": "请选择",
                                "data-type": "radio",  // 或 "checkbox"
                                "options": ["选项1", "选项2", "选项3"]
                            },
                            "content": [
                                {
                                    "type": "text",
                                    "text": "选项2"
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
                                "data-placeholder": "请选择",
                                "data-type": "radio",  // 或 "checkbox"
                                "options": ["选项1", "选项2", "选项3"]
                            },
                        },
                        {
                            "type": "node_view",
                            "attrs": {
                                "data-placeholder": "请输入内容",
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
                            "text": "Did you see that? "
                        },
                        {
                            "type": "node_view",
                            "attrs": {
                                "data-placeholder": "请选择",
                                "data-type": "checkbox",
                                "options": ["选项1", "选项2", "选项3"]
                            },
                            "content": [
                                {
                                    "type": "text",
                                    "text": "选项1、选项3"
                                }
                            ]
                        },
                        {
                            "type": "text",
                            "text": "That’s a JavaScript node view. We are really living in the future."
                        },
                        {
                            "type": "node_view",
                            "attrs": {
                                "data-placeholder": "请选择",
                                "data-type": "checkbox",
                                "options": ["选项1", "选项2", "选项3"]
                            },
                            "content": [
                                {
                                    "type": "text",
                                    "text": "选项2"
                                }
                            ]
                        },
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
    console.log("内容",window.view.state.doc.toJSON())
    console.log("内容",window.view.state.doc.content)
    console.log("内容",window.view.state.doc.textContent)
    console.log("内容",convertToText(window.view.state.doc))
    window.view.focus()
}

function convertToText(doc) {
    let textOutput = '';

    doc.descendants((node, pos) => {
        console.log("node",node)
        if (node.type.name === "text") {
            textOutput += node.text;
        } else if (node.type.name === "node_view") {
            if (node.content.size === 0) {
                const dataType = node.attrs['data-type'];
                if (dataType === 'input') {
                    textOutput += node.attrs['data-placeholder'] || '';
                } else if (dataType === 'radio' || dataType === 'checkbox') {
                    textOutput += node.attrs.options?.[0] || '';
                }
            }
        }
        // 您可以根据需要在这里添加其他节点类型的处理逻辑
    });

    return textOutput;
}

document.querySelector('#getpos').addEventListener('click', getPosition);
