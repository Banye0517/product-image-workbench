import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { validateMainCards, renderSpec } from '../shared/main-model.js';
import { Store } from './store.js';
import { renderCard } from './render.js';
import { safeName, validateModel } from '../shared/model.js';

const exec = promisify(execFile);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function nativeChoose(kind) {
  if (process.platform !== 'darwin') throw new Error('请通过桌面应用选择文件夹');
  const script = kind === 'logo' ? 'POSIX path of (choose file with prompt "选择透明PNG Logo")' : 'POSIX path of (choose folder with prompt "选择文件夹")';
  try { const { stdout } = await exec('osascript', ['-e', script]); return [stdout.trim()]; }
  catch (e) { if (e.stderr?.includes('-128')) return []; throw new Error('无法打开文件选择窗口'); }
}
const inside = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };

export async function startServer({ root = path.join(os.homedir(), 'Library', 'Application Support', 'ProductImageWorkbench'), port = 4317, choose = nativeChoose, cutoutBinary = path.join(base, 'desktop', 'bin', 'cutout'), cutoutProcessor, openFolder = async source => { if (process.platform !== 'darwin') throw new Error('请通过桌面应用打开目录'); await exec('open', [source]); } } = {}) {
  const store = await new Store(root).init();
  const app = express(), jobs = new Map(), tasks = new Map();
  let url;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.headers.host?.split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return res.status(403).json({ error: '仅允许本机访问' });
    if (req.headers.origin && ![url, 'http://127.0.0.1:5173', 'http://localhost:5173'].includes(req.headers.origin)) return res.status(403).json({ error: '拒绝外部页面请求' });
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['content-type']?.split(';')[0] !== 'application/json') return res.status(415).json({ error: '请求类型不合法' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '50mb' }));
  app.get('/api/projects', (req, res) => res.json(store.summaries()));
  app.get('/api/projects/:id', (req, res) => res.json(store.get(req.params.id)));
  app.post('/api/choose', async (req, res) => {
    if (!['import', 'output', 'logo'].includes(req.body.kind)) throw new Error('选择类型不合法');
    res.json({ paths: await choose(req.body.kind) });
  });
  app.post('/api/import', async (req, res) => {
    if (!Array.isArray(req.body.paths) || !req.body.paths.length || req.body.paths.length > 150 || req.body.paths.some(p => typeof p !== 'string' || !path.isAbsolute(p))) throw new Error('请选择有效文件夹');
    const imported = await store.importPaths(req.body.paths); res.json({ ids: imported.map(p => p.id) });
  });
  app.post('/api/projects/:id/archive', async (req, res) => res.json(await store.archive(req.params.id)));
  app.post('/api/projects/:id/open', async (req, res) => { const p = store.get(req.params.id); await fs.access(p.source); await openFolder(p.source); res.json({ opened: true }); });
  app.post('/api/projects/:id/save', async (req, res) => res.json(await store.save(req.params.id, req.body.model, req.body.complete === true, req.body.scope ?? 'detail')));
  app.post('/api/projects/:id/resolve', async (req, res) => res.json(await store.resolve(req.params.id, req.body.groupId, req.body.keep)));
  app.post('/api/projects/:id/restore', async (req, res) => res.json(await store.restore(req.params.id)));
  app.get('/media/:name', async (req, res) => {
    const name = req.params.name;
    if (!/^[a-f0-9-]{36}(-thumb|-cutout|-alpha)?\.(jpg|png)$/.test(name)) return res.status(400).end();
    const known = name.endsWith('.png') ? await fs.stat(path.join(root, 'media', name)).catch(() => null) : store.projects.some(p => p.assets.some(a => name.startsWith(a.id)));
    if (!known) return res.status(404).end();
    res.sendFile(path.join(root, 'media', name), { dotfiles: 'allow', maxAge: '1y', immutable: true });
  });
  app.post('/api/logo', async (req, res) => {
    const [file] = await choose('logo');
    if (!file) return res.json({ canceled: true });
    const m = await sharp(file, { limitInputPixels: 20000000 }).metadata();
    if (m.format !== 'png' || !m.hasAlpha) throw new Error('请选择带透明通道的PNG Logo');
    const id = crypto.randomUUID();
    await sharp(file).resize({ width: 600, withoutEnlargement: true }).png().toFile(path.join(root, 'media', id + '.png'));
    res.json({ id, url: '/media/' + id + '.png', ratio: m.height / m.width });
  });
  app.get('/api/jobs/:id', (req, res) => { const job = jobs.get(req.params.id); if (!job) return res.status(404).json({ error: '任务不存在' }); res.json(job); });
  let cutoutChain = Promise.resolve();
  app.post('/api/projects/:id/cutout', async (req, res) => {
    if (!cutoutProcessor && process.platform !== 'darwin') throw new Error('快速抠图组件未加载，请使用完整版工作台');
    const p = store.get(req.params.id), asset = p.assets.find(a => a.id === req.body.assetId && !a.excluded);
    if (!asset) throw new Error('图片不存在');
    const id = crypto.randomUUID(), job = { id, status: 'running', processed: 0, total: 1 };
    jobs.set(id, job);
    const task = cutoutChain.catch(() => {}).then(async () => {
      if (path.basename(asset.name) !== asset.name) throw new Error('原图文件名不合法');
      const source = cutoutProcessor ? store.assetPath(asset.id) : path.join(p.source, asset.name);
      if (!cutoutProcessor) { const stat = await fs.stat(source); if (stat.size !== asset.bytes || stat.mtimeMs !== asset.modified) throw new Error('原图已变化，请重新添加目录'); }
      if (!asset.cutoutUrl || (cutoutProcessor && asset.cutoutEngine !== 'silueta')) {
        const name = crypto.randomUUID() + '-cutout.png', output = path.join(root, 'media', name);
        if (cutoutProcessor) await cutoutProcessor(source, output);
        else await exec(cutoutBinary, [source, output], { timeout: 120000 });
        const metadata = await sharp(output).metadata();
        if (!metadata.hasAlpha) throw new Error('抠图结果没有透明通道');
        asset.cutoutEngine = cutoutProcessor ? 'silueta' : 'vision'; asset.cutoutUrl = '/media/' + name; asset.cutoutWidth = metadata.width; asset.cutoutHeight = metadata.height;
        await store.persist();
      }
      job.cutoutUrl = asset.cutoutUrl; job.status = 'done'; job.processed = 1;
    }).catch(error => { job.status = 'failed'; job.error = '本机抠图失败：' + error.message; });
    cutoutChain = task; tasks.set(id, task); res.json({ id });
  });
  app.post('/api/export', async (req, res) => {
    const { destination, projects, scope = 'detail' } = req.body;
    if (!['detail', 'main', 'all'].includes(scope)) throw new Error('导出类型不合法');
    if (typeof destination !== 'string' || !path.isAbsolute(destination) || !Array.isArray(projects) || !projects.length || projects.length > 150) throw new Error('请选择导出目录和产品');
    await fs.mkdir(destination, { recursive: true });
    const output = await fs.realpath(destination);
    if (store.projects.some(p => inside(p.source, output))) throw new Error('导出目录必须在原素材文件夹之外');
    const snapshots = projects.map(item => {
      const p = store.get(item.id);
      if (p.status === 'processing') throw new Error('请等待图片处理完成');
      const model = structuredClone(item.model ?? p.model);
      validateModel(model, store.available(p).map(a => a.id));
      if (scope !== 'detail') validateMainCards(model.mainCards ?? [], store.available(p).map(a => a.id));
      if (scope === 'all' && (!p.detailSaved || !p.mainSaved)) throw new Error(p.name + '的详情页或主图未保存，请先保存再导出');
      const cards = scope === 'main' ? model.mainCards : model.cards;
      if (scope === 'all' && !model.mainCards?.length) throw new Error(p.name + '没有可导出的主图');
      if (scope !== 'detail') for (const baseCard of model.mainCards) for (const format of ['800','750']) { const card = renderSpec(baseCard, format); if (card.kind === 'white') { const asset = store.available(p).find(a => a.id === card.imageId); if (card.useCutout ? !asset?.cutoutUrl : !asset?.hasAlpha) throw new Error('白底商品图请先抠图或选择透明PNG；也可删除该模板后导出'); } }
      if (!cards.length) throw new Error('没有可导出的卡片');
      if (scope !== 'detail') for (const card of model.mainCards) for (const format of ['800', '750']) { if (!item.overlays?.[card.id + ':' + format]) throw new Error('缺少主图图层，请重新导出'); }
      if (scope !== 'main') for (const card of model.cards) if ((['combo','outfit'].includes(card.type) || card.text || card.subtitle || card.logo) && !item.overlays?.[card.id]) throw new Error('缺少文字或Logo图层，请重新导出');
      return { project: structuredClone(p), model, overlays: item.overlays ?? {} };
    });
    const id = crypto.randomUUID();
    const total = snapshots.reduce((sum, p) => sum + ((scope !== 'detail' ? p.model.mainCards.length * 2 : 0) + (scope !== 'main' ? p.model.cards.length : 0)), 0);
    const job = { id, status: 'running', processed: 0, total, folders: [], destination: output };
    jobs.set(id, job);
    const task = (async () => {
      for (const { project, model, overlays } of snapshots) {
        const name = safeName(project.name);
        let dir;
        for (let i = 0; ; i++) {
          dir = path.join(output, name + (i ? ` (${i + 1})` : ''));
          try { await fs.mkdir(dir); break; } catch (e) { if (e.code !== 'EEXIST') throw e; }
        }
        const temporary = path.join(dir, '.exporting');
        await fs.writeFile(temporary, 'Export in progress');
        const entries = [
          ...(scope !== 'main' ? model.cards.map(card => ({ card })) : []),
          ...(scope !== 'detail' ? model.mainCards.flatMap(card => ['800', '750'].map(format => ({ card, format }))) : [])
        ];
        for (const { card, format } of entries) {
          const buffer = await renderCard(store, project, card, overlays[format ? card.id + ':' + format : card.id], format);
          const target = format ? path.join(dir, '主图', format === '800' ? '800x800' : '750x1000') : dir;
          await fs.mkdir(target, { recursive: true });
          const file = path.join(target, safeName(card.name) + '.jpg');
          await fs.writeFile(file + '.tmp', buffer); await fs.rename(file + '.tmp', file);
          job.processed++;
        }
        await fs.unlink(temporary); job.folders.push(dir);
      }
      job.status = 'done';
    })().catch(e => { job.status = 'failed'; job.error = e.message; });
    tasks.set(id, task);
    res.json({ id });
  });
  app.use(express.static(path.join(base, 'dist')));
  app.use((err, req, res, next) => res.status(400).json({ error: err.type === 'entity.too.large' ? '导出内容过大，请减少一次勾选的产品数量' : err.message }));
  const server = await new Promise(resolve => { const s = app.listen(port, '127.0.0.1', () => resolve(s)); });
  url = `http://127.0.0.1:${server.address().port}`;
  return { url, store, jobs, waitJob: id => tasks.get(id), close: async () => { await store.idle(); await Promise.all(tasks.values()); await new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const instance = await startServer({ root: process.env.WORKBENCH_DATA_DIR || undefined, port: Number(process.env.WORKBENCH_PORT || 4317) });
  console.log('Workbench ready: ' + instance.url);
}
