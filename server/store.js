import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { validateMainCards } from '../shared/main-model.js';
import { createCards, validateModel, mergeDuplicateGroups } from '../shared/model.js';

const imagePattern = /\.(jpe?g|png|webp|tiff?|heic|heif)$/i;
const hashFile = file => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = createReadStream(file);
  stream.on('error', reject); stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex')));
});
const distance = (a, b) => { let n = BigInt('0x' + a) ^ BigInt('0x' + b), count = 0; while (n) { count++; n &= n - 1n; } return count; };

export class Store {
  constructor(root) { this.root = root; this.projects = []; this.queue = []; this.running = 0; this.waiters = []; this.persistChain = Promise.resolve(); this.importChain = Promise.resolve(); }
  async init() {
    await fs.mkdir(path.join(this.root, 'media'), { recursive: true });
    try { this.projects = JSON.parse(await fs.readFile(path.join(this.root, 'projects.json'), 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('项目记录无法读取，请保留数据目录并联系维护者'); }
    for (const p of this.projects) {
      p.mainSaved ??= false; p.detailSaved ??= p.saved === true; p.model.mainCards ??= [];
      p.groups = mergeDuplicateGroups(p.groups, p.assets);
      if (p.status === 'processing') { p.status = 'interrupted'; p.errors.push({ name: '上次导入', message: '导入中断，请重新添加同一文件夹继续处理' }); }
    }
    const upgrade = this.projects.filter(p => !p.archived && (p.skipped.some(a => a.reason === '横图或方图') || p.assets.some(a => a.width !== 1200 || a.hasAlpha === undefined || (a.hasAlpha && !a.alphaUrl))));
    for (const p of this.projects) for (const card of p.model.cards) for (const crop of card.crops ?? []) if (crop.scale > 1.6) { crop.scale = 1.6; p.saved = false; }
    for (const p of upgrade) { try { await this.importPaths([p.source]); } catch { p.errors.push({ name: '缓存升级', message: '原素材目录不可用，请连接后重新添加目录升级1200缓存' }); } }
    for (const p of this.projects) if (p.model.layoutVersion !== 3) { p.model.layoutVersion = 3; p.saved = false; for (const card of p.model.cards) { card.background ??= card.type === 'combo' ? '#f7f7f7' : '#ffffff'; if (card.type === 'combo') card.title ??= '细节展示'; } }
    for (const p of this.projects) for (const card of p.model.cards) { if (card.text && card.text.size !== 72) { card.text.size = 72; p.saved = false; } if (card.subtitle) card.subtitle.size = 36; if (card.logo && card.logo.y < 40) { card.logo.y = 68; p.saved = false; } }
    await this.persist();
    return this;
  }
  persist() {
    const data = JSON.stringify(this.projects);
    this.persistChain = this.persistChain.catch(() => {}).then(async () => {
      const temp = path.join(this.root, 'projects.tmp');
      await fs.writeFile(temp, data); await fs.rename(temp, path.join(this.root, 'projects.json'));
    });
    return this.persistChain;
  }
  get(id) { const p = this.projects.find(p => p.id === id); if (!p) throw new Error('产品不存在'); return p; }
  available(p) { return p.assets.filter(a => !a.excluded); }
  assetPath(id, thumb = false) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('图片标识不合法');
    return path.join(this.root, 'media', `${id}${thumb ? '-thumb' : ''}.jpg`);
  }
  summaries() { return this.projects.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name, status: p.status, saved: p.saved, mainSaved: p.mainSaved, detailSaved: p.detailSaved, total: p.total, processed: p.processed, count: this.available(p).length, groups: p.groups.filter(g => !g.resolved).length, errors: p.errors.length, skipped: p.skipped.length })); }
  importPaths(paths) {
    const task = this.importChain.catch(() => {}).then(() => this.importDirectories(paths));
    this.importChain = task; return task;
  }
  async importDirectories(paths) {
    const directories = [];
    for (const dir of paths) {
      const full = await fs.realpath(dir);
      const entries = await fs.readdir(full, { withFileTypes: true });
      if (entries.some(e => e.isFile() && imagePattern.test(e.name))) directories.push(full);
      else for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const child = path.join(full, entry.name);
        if ((await fs.readdir(child)).some(n => imagePattern.test(n))) directories.push(child);
      }
    }
    if (!directories.length) throw new Error('没有找到支持的图片文件夹');
    const imported = [];
    for (const dir of [...new Set(directories)]) {
      let p = this.projects.find(p => p.source === dir);
      if (p?.status === 'processing') { imported.push(p); continue; }
      const files = (await fs.readdir(dir, { withFileTypes: true })).filter(e => e.isFile() && imagePattern.test(e.name)).map(e => e.name).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
      if (!p) { p = { id: crypto.randomUUID(), name: path.basename(dir), source: dir, assets: [], skipped: [], errors: [], groups: [], saved: false, mainSaved: false, detailSaved: false, model: { copy: '', cards: [], mainCards: [], auto: true, layoutVersion: 3 } }; this.projects.push(p); }
      p.archived = false;
      p.total = files.length; p.processed = 0; p.status = 'processing'; p.errors = []; p.skipped = [];
      imported.push(p);
      for (const [order, name] of files.entries()) this.queue.push(() => this.process(p, name, order));
    }
    await this.persist(); this.drain(); return imported;
  }
  drain() {
    while (this.running < 2 && this.queue.length) {
      this.running++;
      this.queue.shift()().catch(e => { this.lastError = e.message; }).finally(() => {
        this.running--; this.drain();
        if (!this.running && !this.queue.length) { const waiters = this.waiters.splice(0); Promise.resolve(this.persistChain).then(() => waiters.forEach(resolve => resolve())); }
      });
    }
  }
  idle() { return !this.running && !this.queue.length ? this.persistChain : new Promise(resolve => this.waiters.push(resolve)); }
  async process(p, name, order) {
    const source = path.join(p.source, name);
    try {
      const stat = await fs.stat(source);
      const old = p.assets.find(a => a.name === name && a.bytes === stat.size && a.modified === stat.mtimeMs);
      if (old?.width === 1200 && old.hasAlpha !== undefined && (!old.hasAlpha || old.alphaUrl)) { old.order = order; return; }
      const metadata = await sharp(source, { limitInputPixels: 160000000 }).metadata();
      const swapped = [5, 6, 7, 8].includes(metadata.orientation);
      const iw = swapped ? metadata.height : metadata.width, ih = swapped ? metadata.width : metadata.height;
      if (!iw || !ih) throw new Error('无法读取图片尺寸');
      const id = old?.id ?? crypto.randomUUID();
      let alpha = {};
      if (metadata.hasAlpha) {
        const alphaName = crypto.randomUUID() + '-alpha.png';
        const info = await sharp(source, { limitInputPixels: 160000000 }).autoOrient().resize({ width: 1200 }).toColourspace('srgb').png().toFile(path.join(this.root, 'media', alphaName));
        alpha = { alphaUrl: '/media/' + alphaName, alphaWidth: info.width, alphaHeight: info.height };
      }
      const working = await sharp(source, { limitInputPixels: 160000000 }).autoOrient().resize({ width: 1200 }).toColourspace('srgb').jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
      await fs.writeFile(this.assetPath(id), working);
      const [hash, pixels] = await Promise.all([
        hashFile(source),
        sharp(working).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer(),
        sharp(working).resize({ width: 300 }).jpeg({ quality: 80 }).toFile(this.assetPath(id, true))
      ]);
      const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
      const perceptual = pixels.reduce((bits, value) => (bits << 1n) | BigInt(value >= mean ? 1 : 0), 0n).toString(16).padStart(16, '0');
      const m = await sharp(working).metadata();
      const asset = { id, name, order, width: 1200, height: m.height, hash, perceptual, bytes: stat.size, modified: stat.mtimeMs, excluded: old?.excluded ?? false, hasAlpha: metadata.hasAlpha === true, ...alpha, ...(old?.cutoutUrl ? {cutoutUrl:old.cutoutUrl,cutoutWidth:old.cutoutWidth,cutoutHeight:old.cutoutHeight,cutoutEngine:old.cutoutEngine} : {}) };
      const previous = p.assets.find(a => a.name === name);
      if (previous) { if (p.model.selectedIds) p.model.selectedIds = [...new Set(p.model.selectedIds.map(v => v === previous.id ? id : v))]; p.assets = p.assets.filter(a => a.id !== previous.id); for (const c of p.model.mainCards ?? []) { if (c.imageId === previous.id) { c.imageId = id; c.useCutout = false; } const content = c.views?.['750']?.content; if (content?.imageId === previous.id) { content.imageId = id; content.useCutout = false; } } for (const c of p.model.cards) c.imageIds = c.imageIds.map((v, slot) => { if (v === previous.id && c.useCutouts) c.useCutouts[slot] = false; return v === previous.id ? id : v; }); p.groups = p.groups.filter(g => !g.ids.includes(previous.id)); }
      const match = p.assets.find(a => !a.excluded && a.hash === hash) ?? p.assets.find(a => !a.excluded && distance(a.perceptual, perceptual) <= 3);
      if (match) {
        const kind = match.hash === hash ? 'exact' : 'similar';
        let group = p.groups.find(g => !g.resolved && g.kind === kind && g.ids.includes(match.id));
        if (!group) { group = { id: crypto.randomUUID(), kind, ids: [match.id], resolved: false }; p.groups.push(group); }
        group.ids.push(id);
      }
      p.assets.push(asset); p.assets.sort((a, b) => a.order - b.order);
      p.groups = mergeDuplicateGroups(p.groups, p.assets);
      if (p.model.auto) p.model.cards = createCards(this.available(p).map(a => a.id));
      p.saved = false; p.detailSaved = false; p.mainSaved = false;
    } catch (e) { p.errors.push({ name, message: e.message.slice(0, 240) }); }
    finally { p.processed++; if (p.processed === p.total) p.status = 'ready'; await this.persist(); }
  }
  async save(id, model, complete, scope = 'detail') {
    if (!['detail', 'main'].includes(scope)) throw new Error('保存类型不合法');
    const p = this.get(id);
    const available = this.available(p).map(a => a.id);
    const next = !complete && model?.auto === true ? { ...model, cards: p.model.auto ? p.model.cards : createCards(available) } : model;
    validateModel(next, available);
    validateMainCards(next.mainCards ?? [], available);
    const copyChanged = p.model.copy !== next.copy;
    if (copyChanged || JSON.stringify(p.model.cards) !== JSON.stringify(next.cards)) p.detailSaved = false;
    if (copyChanged || JSON.stringify(p.model.mainCards ?? []) !== JSON.stringify(next.mainCards ?? [])) p.mainSaved = false;
    if (complete) p[scope === 'main' ? 'mainSaved' : 'detailSaved'] = true;
    p.model = { ...next, mainCards: next.mainCards ?? [], auto: complete ? false : model.auto === true }; p.saved = p.detailSaved; p.savedAt = complete ? new Date().toISOString() : p.savedAt;
    await this.persist(); return p;
  }
  async resolve(id, groupId, keep) {
    const p = this.get(id), group = p.groups.find(g => g.id === groupId);
    if (!group || !Array.isArray(keep) || !keep.length || keep.some(id => !group.ids.includes(id))) throw new Error('请选择至少一张保留图片');
    for (const imageId of group.ids) { const asset = p.assets.find(a => a.id === imageId); if (asset) asset.excluded = !keep.includes(imageId); }
    const available = this.available(p).map(a => a.id);
    for (const card of p.model.cards) card.imageIds = card.imageIds.map((imageId, slot) => { if (!available.includes(imageId) && card.useCutouts) card.useCutouts[slot] = false; return available.includes(imageId) ? imageId : keep[0]; });
    if (p.model.selectedIds) p.model.selectedIds = [...new Set(p.model.cards.flatMap(card => card.imageIds).concat(p.model.selectedIds.filter(id => available.includes(id))))];
    for (const card of p.model.mainCards ?? []) { if (!available.includes(card.imageId)) { card.imageId = keep[0]; card.useCutout = Boolean(p.assets.find(a => a.id === keep[0])?.cutoutUrl); } const content=card.views?.['750']?.content; if(content?.imageId&&!available.includes(content.imageId)){content.imageId=keep[0];content.useCutout=Boolean(p.assets.find(a=>a.id===keep[0])?.cutoutUrl);} }
    group.resolved = true; group.keep = keep; p.saved = false; p.mainSaved = false; p.detailSaved = false;
    await this.persist(); return p;
  }
  async archive(id) { const p = this.get(id); if (p.status === 'processing') throw new Error('请等待导入完成后移除'); p.archived = true; await this.persist(); return { removed: true }; }
  async restore(id) { const p = this.get(id); p.assets.forEach(a => { a.excluded = false; }); p.groups.forEach(g => { g.resolved = false; }); p.groups = mergeDuplicateGroups(p.groups, p.assets); p.saved = false; p.mainSaved = false; p.detailSaved = false; await this.persist(); return p; }
}
