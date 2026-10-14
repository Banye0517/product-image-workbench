import test from 'node:test';
import assert from 'node:assert/strict';
import { splitCopy, safeName, cropRect, createCards, validateModel, mergeDuplicateGroups } from '../shared/model.js';

test('copy remains grounded in supplied text and keeps short clauses together', () => {
  assert.deepEqual(splitCopy('面料柔软舒适，宝宝日常休闲款。\n专为中国宝宝研发；H版型 不挑身材'), ['面料柔软舒适，宝宝日常休闲款', '专为中国宝宝研发', 'H版型 不挑身材']);
});
test('names cannot escape export directory or silently collide', () => {
  assert.equal(safeName('../商品/01.jpg'), '.._商品_01');
  assert.throws(() => validateModel({ cards: [{ id: 'a', name: '01', type: 'single', imageIds: ['x'] }, { id: 'b', name: '01.jpg', type: 'single', imageIds: ['x'] }] }, ['x']), /重复/);
  assert.throws(() => validateModel({ cards: [{ id: 'a', name: '01', type: 'single', imageIds: ['missing'] }] }, ['x']), /图片/);
});
test('cover crop honors requested edge and remains inside portrait image', () => {
  assert.deepEqual(cropRect(750, 1500, 375, 400, { x: 0.5, y: 1 }), { left: 0, top: 700, width: 750, height: 800 });
});
test('initial cards fill in order and composition holds three independent slots', () => {
  const cards = createCards(['a', 'b', 'c', 'd']);
  assert.deepEqual(cards.slice(0, 4).map(c => c.imageIds[0]), ['a', 'b', 'c', 'd']);
  assert.equal(cards[4].type, 'combo');
  assert.equal(cards[4].imageIds.length, 3);
});
test('overlapping exact and similar candidates become one decision without reviving exclusions', () => {
  const groups = mergeDuplicateGroups([{ id: 'g1', kind: 'similar', ids: ['a', 'b'], resolved: false }, { id: 'g2', kind: 'exact', ids: ['b', 'c'], resolved: false }], [{ id: 'a', hash: 'h1' }, { id: 'b', hash: 'h2' }, { id: 'c', hash: 'h2' }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, 'similar');
  assert.deepEqual(groups[0].ids, ['a', 'b', 'c']);
});
