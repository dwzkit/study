import { Attrs, Node, ResolvedPos, Schema } from 'prosemirror-model';
import { schema as baseSchema } from 'prosemirror-schema-basic';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { builders, eq } from 'prosemirror-test-builder';
import { cellAround, CellSelection, tableNodes } from '../src/';

export type TaggedNode = Node & { tag: Record<string, number> };

const schema = new Schema({
  nodes: baseSchema.spec.nodes.append(
    tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {
        test: { default: 'default' },
      },
    }),
  ),
  marks: baseSchema.spec.marks,
});

function resolveCell(
  doc: Node,
  tag: number | null | undefined,
): ResolvedPos | null {
  if (tag == null) return null;
  return cellAround(doc.resolve(tag));
}

type TaggedNodeBuilder = (
  attrsOrFirstChild?: Attrs | Node | string,
  ...children: (Node | string)[]
) => TaggedNode;

// @ts-expect-error: the return type of builders is not correct
const nodeBuilders = builders(schema, {
  p: { nodeType: 'paragraph' },
  table: { nodeType: 'table' },
  caption: { nodeType: 'table_caption' },
  thead: { nodeType: 'table_head' },
  tbody: { nodeType: 'table_body' },
  tfoot: { nodeType: 'table_foot' },
  tr: { nodeType: 'table_row' },
  td: { nodeType: 'table_cell' },
  th: { nodeType: 'table_header' },
}) as Record<string, TaggedNodeBuilder>;

export const { doc, table, caption, thead, tbody, tfoot, tr, p, td, th } =
  nodeBuilders;

export function c(colspan: number, rowspan: number) {
  return td({ colspan, rowspan }, p('x'));
}

export const c11 = c(1, 1);
export const cEmpty = td(p());
export const cCursor = td(p('x<cursor>'));
export const cAnchor = td(p('x<anchor>'));
export const cHead = td(p('x<head>'));

export function h(colspan: number, rowspan: number) {
  return th({ colspan, rowspan }, p('x'));
}
export const h11 = h(1, 1);
export const hEmpty = th(p());
export const hCursor = th(p('x<cursor>'));
export const hAnchor = th(p('x<anchor>'));
export const hHead = th(p('x<head>'));

export function selectionFor(doc: TaggedNode) {
  const cursor = doc.tag.cursor;
  if (cursor != null) {
    return new TextSelection(doc.resolve(cursor));
  }

  const $anchor = resolveCell(doc, doc.tag.anchor);
  if ($anchor) {
    return new CellSelection(
      $anchor,
      resolveCell(doc, doc.tag.head) || undefined,
    );
  }

  const node = doc.tag.node;
  if (node != null) {
    return new NodeSelection(doc.resolve(node));
  }

  throw new Error(
    'No selection found in document. Please tag the document with <cursor>, <node> or <anchor> and <head>',
  );
}

export { eq };
