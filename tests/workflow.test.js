import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { Store } from '../server/store.js';
import { renderCard } from '../server/render.js';

test('imports all image orientations, resolves duplicates, saves and restores without touching originals', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-test-'));
  try {
    const input = path.join(root, '商品全名测试');
    await fs.mkdir(input);
    await sharp({ create: { width: 1600, height: 2400, channels: 3, background: '#dac1a4' } }).jpeg().toFile(path.join(input, 'a.jpg'));
    await fs.copyFile(path.join(input, 'a.jpg'), path.join(input, 'duplicate.jpg'));
    await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#eee' } }).jpeg().toFile(path.join(input, 'landscape.jpg'));
    const store = await new Store(path.join(root, 'data')).init();
    const [project] = await store.importPaths([input]);
    await store.idle();
    const p = store.get(project.id);
    assert.equal(p.assets.length, 3);
    assert.equal(p.skipped.length, 0);
    assert.ok(p.groups.some(g => g.ids.includes(p.assets.find(a => a.name === 'duplicate.jpg').id)));
    assert.equal((await sharp(store.assetPath(p.assets[0].id)).metadata()).width, 1200);
    await store.resolve(p.id, p.groups[0].id, [p.assets[0].id]);
    assert.equal(store.available(p).length, 1);
    assert.equal((await fs.readdir(input)).length, 3);
    const model = { ...p.model, copy: '柔软舒适', cards: p.model.cards.slice(0, 1) };
    await store.save(p.id, model, true);
    assert.equal(p.saved, true);
    const png = await renderCard(store, p, model.cards[0]);
    assert.equal((await sharp(png).metadata()).width, 750);
    const combo = { id: 'combo', name: '02', type: 'combo', imageIds: [p.assets[0].id, p.assets[0].id, p.assets[0].id], crops: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }] };
    assert.deepEqual(await sharp(await renderCard(store, p, combo)).metadata().then(m => [m.width, m.height]), [750, 1600]);
    const restored = await new Store(path.join(root, 'data')).init();
    assert.equal(restored.get(p.id).model.copy, '柔软舒适');
    assert.equal(restored.get(p.id).saved, true);
    await restored.save(p.id, { ...model, copy: '修改' }, false);
    assert.equal(restored.get(p.id).saved, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('concurrent imports of the same real folder create exactly one project', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-concurrent-'));
  try {
    const source = path.join(root, 'source'); await fs.mkdir(source);
    await sharp({ create: { width: 1000, height: 1600, channels: 3, background: '#faf' } }).jpeg().toFile(path.join(source, 'a.jpg'));
    const store = await new Store(path.join(root, 'data')).init();
    await Promise.all([store.importPaths([source]), store.importPaths([source])]);
    await store.idle();
    assert.equal(store.projects.length, 1);
    assert.equal(store.projects[0].assets.length, 1);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('late copy draft captured during import cannot remove newly generated cards', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-late-copy-'));
  try {
    const source = path.join(root, 'source'); await fs.mkdir(source);
    for (const [i, background] of ['#afc', '#acf', '#fac'].entries()) await sharp({ create: { width: 1000, height: 1600, channels: 3, background } }).jpeg().toFile(path.join(source, `${i}.jpg`));
    const store = await new Store(path.join(root, 'data')).init();
    const [p] = await store.importPaths([source]); await store.idle();
    const late = { copy: '导入时输入的文案', cards: p.model.cards.slice(0, 1), auto: true };
    await store.save(p.id, late, false);
    assert.equal(p.model.cards.length, 5);
    assert.equal(p.model.copy, late.copy);
    assert.equal(p.model.auto, true);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
