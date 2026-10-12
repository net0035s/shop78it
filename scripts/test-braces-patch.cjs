const assert = require('node:assert/strict');
const fs = require('node:fs');
const braces = require('braces');
assert.equal(require('braces/package.json').version, '3.0.4-shop78it.1');
const cases = [
  ['src/**/*.{ts,tsx}', ['src/**/*.ts', 'src/**/*.tsx']],
  ['a/{b,{c,d}}/e', ['a/b/e', 'a/c/e', 'a/d/e']],
  ['file{1..3}.txt', ['file1.txt', 'file2.txt', 'file3.txt']],
  ['{a,b}/{1,2}', ['a/1', 'a/2', 'b/1', 'b/2']],
  ['abc', ['abc']], ['{b,a,b}', ['b', 'a', 'b']],
];
for (const [pattern, expected] of cases) assert.deepEqual(braces.expand(pattern), expected);
let compatibilityCases = 0;
if (fs.existsSync('.cache/braces-upstream/index.js')) {
  const original = require('../.cache/braces-upstream');
  const patterns = cases.map(([p]) => p).concat(['', '{}', '{foo}', '{a,}', '{01..05}', '{a..f..2}', 'x\\{a,b}', 'a/(b|c)/d', 'a/{b,c', '{a,{b,c},d}', 'src/{app,lib}/**/*.{js,ts}', '{-3..3}', '[{a,b}]']);
  for (const pattern of patterns) for (const options of [{}, {expand:true}, {expand:true,nodupes:true}, {escapeInvalid:true}]) {
    assert.deepEqual(braces(pattern, options), original(pattern, options)); compatibilityCases++;
  }
}
const rejects = fn => assert.throws(fn, e => e.code === 'ERR_BRACES_DEPTH' && !/call stack/i.test(e.message));
let depthCases = 0;
for (const pattern of ['{'.repeat(4000)+'a,b'+'}'.repeat(4000), '{'.repeat(4000)+'a,b', '('.repeat(4000)+'x'+')'.repeat(4000)]) {
  for (const method of ['parse', 'compile', 'expand', 'stringify']) { rejects(() => braces[method](pattern)); depthCases++; }
  rejects(() => braces(pattern)); depthCases++;
  rejects(() => braces(pattern, {expand:true, maxDepth:Infinity})); depthCases++;
}
for (const shape of ['deep', 'cycle']) {
  const ast = {type:'root',nodes:[]}; let node = ast;
  for(let i=0;i<1000;i++) { const child={type:'brace',nodes:[]}; node.nodes.push(child); node=child; }
  if(shape==='cycle') { ast.nodes=[ast]; }
  for(const method of ['compile','expand','stringify']) { rejects(() => braces[method](ast)); depthCases++; }
  for(const method of ['compile','expand','stringify']) { rejects(() => require('braces/lib/'+method)(ast)); depthCases++; }
}
assert.deepEqual(braces.expand('{a,b}'), ['a','b']);
console.log(JSON.stringify({passed:true,localFork:true,compatibilityCases,depthCases,ordinaryFixtures:cases.length}));
