// schema{
import { schema as basicSchema } from "prosemirror-schema-basic";
import { Schema } from "prosemirror-model";

const footnoteSpec = {
    group: "inline",
    content: "text*", // 这里如果设置为text*，当光标尝试从nodeview向左移出时，光标位置都是会不对，会多出一个字符的间距。通过设置一个setTimeout可以解决这个问题。但是原因未知
    // content: "paragraph*", // 这里如果设置为text*，当光标尝试从nodeview向左移出时，光标位置都是会不对，会多出一个字符的间距。。。原因未知。
    inline: true,
    atom: true,
    toDOM: () => ["div",{class: 'footnote'}, 0], //这里原本是用的自定义标签footnote，但是自定义标签存在一个问题是上下移动光标时候，光标定位失准，所以这里改成了用div class="footnote"的写法，并且不能再用><p>来包括div了
    parseDOM: [{tag: "div.footnote"}]
};

const footnoteSchema = new Schema({
    nodes: basicSchema.spec.nodes.addBefore("image", "footnote", footnoteSpec),
    marks: basicSchema.spec.marks
});
// }

// menu{
import {insertPoint} from "prosemirror-transform"
import {MenuItem} from "prosemirror-menu"
import {buildMenuItems} from "prosemirror-example-setup"
import {Fragment} from "prosemirror-model"

let menu = buildMenuItems(footnoteSchema)
menu.insertMenu.content.push(new MenuItem({
    title: "Insert footnote",
    label: "Footnote",
    select(state) {
        return insertPoint(state.doc, state.selection.from, footnoteSchema.nodes.footnote) != null
    },
    run(state, dispatch) {
        let {empty, $from, $to} = state.selection, content = Fragment.empty
        if (!empty && $from.sameParent($to) && $from.parent.inlineContent)
            content = $from.parent.content.cut($from.parentOffset, $to.parentOffset)
        dispatch(state.tr.replaceSelectionWith(footnoteSchema.nodes.footnote.create(null, content)))
    }
}))
// }

// nodeview_start{
import {StepMap} from "prosemirror-transform"
import {keymap} from "prosemirror-keymap"
import {undo, redo} from "prosemirror-history"

class FootnoteView {
    constructor(node, view, getPos) {
        // We'll need these later
        this.node = node
        this.outerView = view
        this.getPos = getPos

        // The node's representation in the editor (empty, for now)
        this.dom = document.createElement("div")
        // this.dom.classList.add("footnote")
        let footnote = document.createElement("div")
        footnote.classList.add("footnote")
        this.dom = footnote
        this.innerView = new EditorView(footnote, {
            // You can use any node as an editor document
            state: EditorState.create({
                doc: this.node,
                plugins: [keymap({
                    "Mod-z": () => undo(this.outerView.state, this.outerView.dispatch),
                    "Mod-y": () => redo(this.outerView.state, this.outerView.dispatch),
                    "ArrowUp": () => this.maybeEscape("line", -1),
                    "ArrowDown":() => this.maybeEscape("line", 1),
                    "ArrowLeft": () => this.maybeEscape("char", -1),
                    "ArrowRight": () => this.maybeEscape("char", 1)
                })]
            }),
            // This is the magic part
            dispatchTransaction: this.dispatchInner.bind(this),
            handleDOMEvents: {
                mousedown: () => {
                    // Kludge to prevent issues due to the fact that the whole
                    // footnote is node-selected (and thus DOM-selected) when
                    // the parent editor is focused.
                    if (this.outerView.hasFocus()) this.innerView.focus()
                },
                focus:()=>{
                    console.log("focus")
                }
            }
        })
    }
// }

// nodeview_dispatchInner{
    dispatchInner(tr) {
        console.log("dispatchInner")
        let {state, transactions} = this.innerView.state.applyTransaction(tr)
        this.innerView.updateState(state)

        if (!tr.getMeta("fromOutside")) {
            let outerTr = this.outerView.state.tr, offsetMap = StepMap.offset(this.getPos() + 1)
            for (let i = 0; i < transactions.length; i++) {
                let steps = transactions[i].steps
                for (let j = 0; j < steps.length; j++)
                    outerTr.step(steps[j].map(offsetMap))
            }
            if (outerTr.docChanged) this.outerView.dispatch(outerTr)
        }
    }
// }
// nodeview_update{
    update(node) {
        console.log("update",node)
        if (!node.sameMarkup(this.node)) return false
        this.node = node
        if (this.innerView) {
            let state = this.innerView.state
            let start = node.content.findDiffStart(state.doc.content)
            if (start != null) {
                let {a: endA, b: endB} = node.content.findDiffEnd(state.doc.content)
                let overlap = start - Math.min(endA, endB)
                if (overlap > 0) { endA += overlap; endB += overlap }
                this.innerView.dispatch(
                    state.tr
                        .replace(start, endB, node.slice(start, endA))
                        .setMeta("fromOutside", true))
            }
        }
        return true
    }
// }

// nodeview_setSelection{
    setSelection(anchor, head) {
        console.log("#4setSelection",anchor,head)

        // 确保anchor和head是有效的位置
        const doc = this.innerView.state.doc;
        if (anchor < 0 || anchor > doc.content.size || head < 0 || head > doc.content.size) {
            console.error('Invalid anchor or head position');
            return;
        }

        // 创建一个新的TextSelection
        const selection = TextSelection.create(this.innerView.state.doc, anchor, head);

        // 更新编辑器的状态
        this.innerView.dispatch(
            this.innerView.state.tr.setSelection(selection)
        );

        // 聚焦到编辑器
        this.innerView.focus();
    }
// }

// nodeview_end{
    destroy() {
        if (this.innerView) {
            this.innerView.destroy()
            this.innerView = null
        }
    }

    stopEvent(event) {
        console.log("stopEvent",this.innerView && this.innerView.dom.contains(event.target))
        return this.innerView && this.innerView.dom.contains(event.target)
    }

    ignoreMutation() {
        console.log("ignoreMutation")
        return true
    }

    maybeEscape(unit, dir) {
        let { state } = this.innerView;
        let { selection } = state;

        // 检查选择区域是否为空
        if (!selection.empty) return false;

        let setSelectionFlag = false;
        if (dir > 0) {
            if (state.selection.anchor === state.doc.content.size) {
                setSelectionFlag = true;
            }
        } else {
            if (state.selection.anchor === 0 ) {
                setSelectionFlag = true;
            }
        }

        if (setSelectionFlag) {
            let targetPos = this.getPos() + (dir < 0 ? 0 : this.node.nodeSize);
            let targetSelection = Selection.near(this.outerView.state.doc.resolve(targetPos), dir);
            console.log("targetSelection",targetSelection)

            setTimeout(()=>{
                let tr = this.outerView.state.tr.setSelection(targetSelection);
                this.outerView.dispatch(tr);
                this.outerView.focus();
            },0)
        }
    }
}
// }

// editor{
import {EditorState,Selection,TextSelection} from "prosemirror-state"
import {DOMParser} from "prosemirror-model"
import {EditorView} from "prosemirror-view"
import {exampleSetup} from "prosemirror-example-setup"

function arrowHandler(dir) {
    return (state, dispatch, view) => {
    // && view.endOfTextblock(dir)
        if (state.selection.empty) {
            let $head = state.selection.$head;
            let ahead, behind;

            // 如果向右或向下，检查光标前一个位置
            if (dir === "right" || dir === "down") {
                ahead = $head.nodeAfter;
            }

            // 如果向左或向上，检查光标后一个位置
            if (dir === "left" || dir === "up") {
                behind = $head.nodeBefore;
            }
            console.log("ahead && ahead.type.name === \"footnote\"：",ahead && ahead.type.name,"behind && behind.type.name === \"footnote\"：",behind && behind.type.name)
            // 检查前后节点是否是footnote类型
            if ((ahead && ahead.type.name === "footnote") || (behind && behind.type.name === "footnote")) {
                let side = dir === "left" || dir === "up" ? -1 : 1
                let pos = $head.pos + side;

                console.log("pos",pos)
                let nextPos = Selection.near(state.doc.resolve(pos), side);

                setTimeout(()=>{
                    dispatch(state.tr.setSelection(nextPos));
                    view.focus();
                },0)
                return true;
            }
        }
        return false;
    }
}

// 将处理函数绑定到箭头键
const arrowHandlers = keymap({
    ArrowLeft: arrowHandler("left"),
    ArrowRight: arrowHandler("right"),
    // ArrowUp: arrowHandler("up"),
    // ArrowDown: arrowHandler("down")
});

window.view = new EditorView(document.querySelector("#editor"), {
    state: EditorState.create({
        doc: DOMParser.fromSchema(footnoteSchema).parse(document.querySelector("#content")),
        // plugins: [...exampleSetup({schema: footnoteSchema, menuContent: menu.fullMenu})]
        plugins: [arrowHandlers]
    }),
    nodeViews: {
        footnote(node, view, getPos) { return new FootnoteView(node, view, getPos) }
    }
})
// }

function getPosition() {
    console.log("位置",window.view.state.selection.anchor)
    window.view.focus()
}

function setPosition() {
    let tr = window.view.state.tr.setSelection(TextSelection.create(window.view.state.doc, 38));
    window.view.dispatch(tr);
    window.view.focus();
}

document.querySelector('#getpos').addEventListener('click', getPosition);
document.querySelector('#setpos').addEventListener('click', setPosition);
