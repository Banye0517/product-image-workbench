import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { newMainCard } from '../shared/main-model.js';
import { startServer } from '../server/index.js';

test('local API blocks foreign origins and exports into named independent folders without overwriting', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-api-'));
  let instance;
  try {
    const source = path.join(root, '产品完整名称'); await fs.mkdir(source);
    await sharp({ create: { width: 1000, height: 1600, channels: 3, background: '#abc' } }).jpeg().toFile(path.join(source, 'original.jpg'));
    instance = await startServer({ root: path.join(root, '.data'), port: 0 });
    const request = (route, body, origin = instance.url) => fetch(instance.url + route, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
    assert.equal((await request('/api/import', { paths: [source] }, 'https://evil.example')).status, 403);
    const imported = await (await request('/api/import', { paths: [source] })).json();
    await instance.store.idle();
    const p = instance.store.get(imported.ids[0]);
    assert.equal((await fetch(instance.url + '/media/' + p.assets[0].id + '.jpg')).status, 200);
    assert.equal((await fetch(instance.url + '/media/' + p.assets[0].id + '.jpg', { method: 'HEAD' })).status, 200);
    const exportBody = { destination: path.join(root, 'output'), projects: [{ id: p.id, model: p.model, overlays: {} }] };
    const first = await (await request('/api/export', exportBody)).json();
    await instance.waitJob(first.id);
    assert.equal(instance.jobs.get(first.id).status, 'done');
    const files = await fs.readdir(path.join(root, 'output', p.name));
    assert.deepEqual(files, ['01.jpg']);
    assert.equal((await sharp(path.join(root, 'output', p.name, files[0])).metadata()).width, 750);
    const second = await (await request('/api/export', exportBody)).json();
    await instance.waitJob(second.id);
    assert.equal((await fs.readdir(path.join(root, 'output'))).length, 2);
    assert.equal((await request('/api/export', { ...exportBody, destination: source })).status, 400);
    const main = newMainCard('color', [p.assets[0].id]);
    p.model.mainCards = [main];
    const overlays = {};
    for (const [format, width, height] of [['800',800,800],['750',750,1000]]) overlays[main.id + ':' + format] = 'data:image/png;base64,' + (await sharp({create:{width,height,channels:4,background:'#00000000'}}).png().toBuffer()).toString('base64');
    const allBody = { ...exportBody, scope:'all', projects:[{id:p.id,model:p.model,overlays}] };
    assert.equal((await request('/api/export',allBody)).status,400);
    p.detailSaved = true;
    assert.equal((await request('/api/export',allBody)).status,400);
    p.mainSaved = true;
    const all = await (await request('/api/export',allBody)).json();
    await instance.waitJob(all.id);
    const job = instance.jobs.get(all.id);assert.equal(job.status,'done');assert.equal(job.processed,3);
    const folder = job.folders[0];
    assert.deepEqual(await fs.readdir(folder),['01.jpg','主图']);
    for (const [format,width,height] of [['800x800',800,800],['750x1000',750,1000]]) {const metadata=await sharp(path.join(folder,'主图',format,'01.jpg')).metadata();assert.equal(metadata.width,width);assert.equal(metadata.height,height);}

  } finally { if (instance) await instance.close(); await fs.rm(root, { recursive: true, force: true }); }
});
