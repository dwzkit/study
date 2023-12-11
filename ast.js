import { remark } from 'remark';

const markdown = `
**真，**&ZeroWidthSpace;她。
`;
// **真，**她。
const ast = remark().parse(markdown);

console.log(JSON.stringify(ast, null, 2));
