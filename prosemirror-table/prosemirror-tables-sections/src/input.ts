// This file defines a number of helpers for wiring up user input to
// table-related functionality.

import {
  Fragment,
  ResolvedPos,
  Slice,
} from 'prosemirror-model';
import {
  Command,
  EditorState,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import { keydownHandler } from 'prosemirror-keymap';

import {
  cellAround,
  inSameTable,
  isInTable,
  tableEditingKey,
  nextCell,
  selectionCell,
  tableDepth,
  tableHasCaption,
} from './util';
import { CellSelection } from './cellselection';
import { TableMap } from './tablemap';
import { clipCells, fitSlice, insertCells, pastedCells } from './copypaste';
import { tableNodeTypes } from './schema';
import { EditorView } from 'prosemirror-view';

type Axis = 'horiz' | 'vert';

/**
 * @src
 */
export type Direction = -1 | 1;

export const handleKeyDown = keydownHandler({
  ArrowLeft: arrow('horiz', -1),
  ArrowRight: arrow('horiz', 1),
  ArrowUp: arrow('vert', -1),
  ArrowDown: arrow('vert', 1),

  Tab: tabulation(1),
  'Shift-Tab': tabulation(-1),

  'Shift-ArrowLeft': shiftArrow('horiz', -1),
  'Shift-ArrowRight': shiftArrow('horiz', 1),
  'Shift-ArrowUp': shiftArrow('vert', -1),
  'Shift-ArrowDown': shiftArrow('vert', 1),

  Backspace: deleteCellSelection,
  'Mod-Backspace': deleteCellSelection,
  Delete: deleteCellSelection,
  'Mod-Delete': deleteCellSelection,
});

function maybeSetSelection(
  state: EditorState,
  dispatch: undefined | ((tr: Transaction) => void),
  selection: Selection,
): boolean {
  if (selection.eq(state.selection)) return false;
  if (dispatch) dispatch(state.tr.setSelection(selection).scrollIntoView());
  return true;
}

function tabulation(dir: Direction): Command {
  return (state, dispatch, view) => {
    if (!view) return false;
    const sel = state.selection;
    const r = state.doc.resolve(sel.head);
    let d = r.depth;
    let inCaption = false;
    for (; d > 0; d--) {
      const role = r.node(d).type.spec.tableRole;
      if (role === 'row') break;
      if (role === 'caption' && dir > 0) {
        inCaption = true;
        break;
      }
    }
    const tableDepth = d - (inCaption ? 1 : 2);
    const table = r.node(tableDepth);
    if (!table || table.type.spec.tableRole != 'table') return false;
    const tableStart = r.start(tableDepth);
    const tmap = TableMap.get(table);
    let nextCellPos;
    if (inCaption) {
      nextCellPos = tmap.map[0];
    } else {
      const map = tmap.map;
      const cellStart = inCaption
        ? tmap.positionAt(0, 0, table)
        : r.start(d + 1);
      const cellPos = cellStart - tableStart - 1;
      let i;
      for (
        i = dir < 0 ? 0 : map.length - 1;
        i >= 0 && i < map.length;
        i -= dir
      ) {
        if (cellPos == map[i]) break;
      }
      if (i < 0 || i >= map.length) return false;
      i += dir;
      if (i < 0 || i >= map.length) return false;
      nextCellPos = map[i];
    }
    if (nextCellPos) {
      const cell = table.nodeAt(nextCellPos);
      if (!cell) return false;
      if (dispatch) {
        const from = tableStart + nextCellPos;
        const to = from + cell.nodeSize - 1;
        dispatch(
          state.tr.setSelection(TextSelection.create(state.doc, from, to)),
        );
      }
      return true;
    }
    return false;
  };
}

function arrow(axis: Axis, dir: Direction): Command {
  return (state, dispatch, view) => {
    if (!view) return false;
    const sel = state.selection;
    if (sel instanceof CellSelection) {
      return maybeSetSelection(
        state,
        dispatch,
        Selection.near(sel.$headCell, dir),
      );
    }
    if (axis != 'horiz' && !sel.empty) return false;
    const end = atEndOfCell(view, axis, dir, true); // the last parameter is to check also caption
    if (axis == 'horiz') {
      return maybeSetSelection(
        state,
        dispatch,
        Selection.near(state.doc.resolve(sel.head + dir), dir),
      );
    } else {
      let newSel;
      if (end) {
        const $cell = state.doc.resolve(end);
        if ($cell.node().type.spec.tableRole === 'row') {
          // cursor is in cell
          const $next = nextCell($cell, axis, dir);
          if ($next) newSel = Selection.near($next, 1);
          else if (dir < 0) {
            const table = $cell.node(-2);
            if (tableHasCaption(table))
              newSel = Selection.near(state.doc.resolve($cell.start(-2)), 1);
            else
              newSel = Selection.near(state.doc.resolve($cell.before(-2)), -1);
          } else newSel = Selection.near(state.doc.resolve($cell.after(-2)), 1);
        } else {
          // cursor is in caption
          if (dir < 0) {
            newSel = Selection.near(state.doc.resolve($cell.before()), -1);
          } else {
            const table = $cell.node();
            const map = TableMap.get(table);
            const pos = $cell.start() + map.positionAt(0, 0, table);
            newSel = Selection.near(state.doc.resolve(pos), 1);
          }
        }
      } else {
        // check whether we are entering the table
        if (dir > 0) {
          const pos = sel.$anchor.after();
          const table = state.doc.nodeAt(pos);
          if (table && table.type.spec.tableRole === 'table')
            newSel = Selection.near(state.doc.resolve(pos), 1);
        } else {
          newSel = Selection.near(state.doc.resolve(sel.$anchor.before()), -1);
          const d = tableDepth(newSel.$anchor);
          if (d >= 0) {
            const table = newSel.$anchor.node(d);
            const map = TableMap.get(table);
            const pos =
              newSel.$anchor.start(d) +
              map.positionAt(map.height - 1, 0, table);
            newSel = Selection.near(state.doc.resolve(pos), 1);
          }
        }
      }
      return newSel ? maybeSetSelection(state, dispatch, newSel) : false;
    }
  };
}

function shiftArrow(axis: Axis, dir: Direction): Command {
  return (state, dispatch, view) => {
    if (!view) return false;
    const sel = state.selection;
    let cellSel: CellSelection;
    if (sel instanceof CellSelection) {
      cellSel = sel;
    } else {
      const end = atEndOfCell(view, axis, dir);
      if (end == null) return false;
      cellSel = new CellSelection(state.doc.resolve(end));
    }

    const $head = nextCell(cellSel.$headCell, axis, dir);
    if (!$head) return false;
    return maybeSetSelection(
      state,
      dispatch,
      new CellSelection(cellSel.$anchorCell, $head),
    );
  };
}

function deleteCellSelection(
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
): boolean {
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) return false;
  if (dispatch) {
    const tr = state.tr;
    const baseContent = tableNodeTypes(state.schema).cell.createAndFill()!
      .content;
    sel.forEachCell((cell, pos) => {
      if (!cell.content.eq(baseContent))
        tr.replace(
          tr.mapping.map(pos + 1),
          tr.mapping.map(pos + cell.nodeSize - 1),
          new Slice(baseContent, 0, 0),
        );
    });
    if (tr.docChanged) dispatch(tr);
  }
  return true;
}

export function handleTripleClick(view: EditorView, pos: number): boolean {
  const doc = view.state.doc,
    $cell = cellAround(doc.resolve(pos));
  if (!$cell) return false;
  view.dispatch(view.state.tr.setSelection(new CellSelection($cell)));
  return true;
}

/**
 * @src
 */
export function handlePaste(
  view: EditorView,
  _: ClipboardEvent,
  slice: Slice,
): boolean {
  if (!isInTable(view.state)) return false;
  let cells = pastedCells(slice);
  const sel = view.state.selection;
  if (sel instanceof CellSelection) {
    if (!cells)
      cells = {
        width: 1,
        height: 1,
        rows: [
          Fragment.from(
            fitSlice(tableNodeTypes(view.state.schema).cell, slice),
          ),
        ],
      };
    const table = sel.$anchorCell.node(-2);
    const start = sel.$anchorCell.start(-2);
    const rect = TableMap.get(table).rectBetween(
      sel.$anchorCell.pos - start,
      sel.$headCell.pos - start,
    );
    cells = clipCells(cells, rect.right - rect.left, rect.bottom - rect.top);
    insertCells(view.state, view.dispatch, start, rect, cells);
    return true;
  } else if (cells) {
    const $cell = selectionCell(view.state);
    const start = $cell.start(-2);
    insertCells(
      view.state,
      view.dispatch,
      start,
      TableMap.get($cell.node(-2)).findCell($cell.pos - start),
      cells,
    );
    return true;
  } else {
    return false;
  }
}

export function handleMouseDown(
  view: EditorView,
  startEvent: MouseEvent,
): void {
  if (startEvent.ctrlKey || startEvent.metaKey) return;

  const startDOMCell = domInCell(view, startEvent.target as Node);
  let $anchor;
  if (startEvent.shiftKey && view.state.selection instanceof CellSelection) {
    // Adding to an existing cell selection
    setCellSelection(view.state.selection.$anchorCell, startEvent);
    startEvent.preventDefault();
  } else if (
    startEvent.shiftKey &&
    startDOMCell &&
    ($anchor = cellAround(view.state.selection.$anchor)) != null &&
    cellUnderMouse(view, startEvent)?.pos != $anchor.pos
  ) {
    // Adding to a selection that starts in another cell (causing a
    // cell selection to be created).
    setCellSelection($anchor, startEvent);
    startEvent.preventDefault();
  } else if (!startDOMCell) {
    // Not in a cell, let the default behavior happen.
    return;
  }

  // Create and dispatch a cell selection between the given anchor and
  // the position under the mouse.
  function setCellSelection($anchor: ResolvedPos, event: MouseEvent): void {
    let $head = cellUnderMouse(view, event);
    const starting = tableEditingKey.getState(view.state) == null;
    if (!$head || !inSameTable($anchor, $head)) {
      if (starting) $head = $anchor;
      else return;
    }
    const selection = new CellSelection($anchor, $head);
    if (starting || !view.state.selection.eq(selection)) {
      const tr = view.state.tr.setSelection(selection);
      if (starting) tr.setMeta(tableEditingKey, $anchor.pos);
      view.dispatch(tr);
    }
  }

  // Stop listening to mouse motion events.
  function stop(): void {
    view.root.removeEventListener('mouseup', stop);
    view.root.removeEventListener('dragstart', stop);
    view.root.removeEventListener('mousemove', move);
    if (tableEditingKey.getState(view.state) != null)
      view.dispatch(view.state.tr.setMeta(tableEditingKey, -1));
  }

  function move(_event: Event): void {
    const event = _event as MouseEvent;
    const anchor = tableEditingKey.getState(view.state);
    let $anchor;
    if (anchor != null) {
      // Continuing an existing cross-cell selection
      $anchor = view.state.doc.resolve(anchor);
    } else if (domInCell(view, event.target as Node) != startDOMCell) {
      // Moving out of the initial cell -- start a new cell selection
      $anchor = cellUnderMouse(view, startEvent);
      if (!$anchor) return stop();
    }
    if ($anchor) setCellSelection($anchor, event);
  }

  view.root.addEventListener('mouseup', stop);
  view.root.addEventListener('dragstart', stop);
  view.root.addEventListener('mousemove', move);
}

// Check whether the cursor is at the end of a cell (so that further
// motion would move out of the cell)
function atEndOfCell(
  view: EditorView,
  axis: Axis,
  dir: number,
  checkCaption: boolean = false,
): null | number {
  if (!(view.state.selection instanceof TextSelection)) return null;
  const { $head } = view.state.selection;
  for (let d = $head.depth - 1; d >= 0; d--) {
    const parent = $head.node(d),
      index = dir < 0 ? $head.index(d) : $head.indexAfter(d);
    if (index != (dir < 0 ? 0 : parent.childCount)) return null;
    const alsoInCaption =
      checkCaption && parent.type.spec.tableRole == 'caption';
    if (
      parent.type.spec.tableRole == 'cell' ||
      parent.type.spec.tableRole == 'header_cell' ||
      alsoInCaption
    ) {
      const cellPos = $head.before(d);
      const dirStr: 'up' | 'down' | 'left' | 'right' =
        axis == 'vert' ? (dir > 0 ? 'down' : 'up') : dir > 0 ? 'right' : 'left';
      return view.endOfTextblock(dirStr) ? cellPos : null;
    }
  }
  return null;
}

function domInCell(view: EditorView, dom: Node | null): Node | null {
  for (; dom && dom != view.dom; dom = dom.parentNode) {
    if (dom.nodeName == 'TD' || dom.nodeName == 'TH') {
      return dom;
    }
  }
  return null;
}

function cellUnderMouse(
  view: EditorView,
  event: MouseEvent,
): ResolvedPos | null {
  const mousePos = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  if (!mousePos) return null;
  return mousePos ? cellAround(view.state.doc.resolve(mousePos.pos)) : null;
}
