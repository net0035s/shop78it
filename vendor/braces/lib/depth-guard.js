'use strict';

// Local mitigation for GHSA-vfj7-8cjw-p6xm. Fixed ceiling, not caller configurable.
const MAX_DEPTH = 64;
const reject = () => {
  const error = new RangeError('Brace nesting exceeds the safe limit');
  error.code = 'ERR_BRACES_DEPTH';
  throw error;
};

function guard(ast) {
  const active = new Set();
  const stack = [{ node: ast, depth: 0, exit: false }];
  while (stack.length) {
    const entry = stack.pop();
    const { node, depth } = entry;
    if (!node || typeof node !== 'object') continue;
    if (entry.exit) { active.delete(node); continue; }
    if (depth > MAX_DEPTH || active.has(node)) reject();
    active.add(node);
    stack.push({ node, depth, exit: true });
    if (Array.isArray(node.nodes)) {
      for (let i = node.nodes.length - 1; i >= 0; i--) {
        stack.push({ node: node.nodes[i], depth: depth + 1, exit: false });
      }
    }
  }
}
guard.checkStack = size => { if (size > MAX_DEPTH) reject(); };
module.exports = guard;
