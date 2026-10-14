export function splitCopy(copy = '') {
  return copy.split(/[\r\n。！？；;]+/u).map(s => s.trim()).filter(Boolean);
}
export function safeName(value) {
  const name = String(value ?? '').trim().replace(/\.(jpe?g|png|webp)$/i, '').replace(/[\\/<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
  if (!name || name === '.' || name === '..' || name.length > 120) throw new Error('文件名为空或过长');
  return name;
}
export function cropRect(iw, ih, ow, oh, position = {}) {
  const ratio = ow / oh;
  const width = Math.min(iw, Math.round(ih * ratio));
  const height = Math.min(ih, Math.round(iw / ratio));
  const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0.5));
  return { left: Math.round((iw - width) * clamp(position.x)), top: Math.round((ih - height) * clamp(position.y)), width, height };
}
export function newCard(type, ids, index = 0) {
  return { id: globalThis.crypto.randomUUID(), type, name: String(index + 1).padStart(2, '0'), imageIds: Array.from({ length: type === 'single' ? 1 : 3 }, (_, i) => ids[(index + i) % ids.length]), crops: Array.from({ length: 3 }, () => ({ x: 0.5, y: 0.5 })), text: null, logo: null, background: ['combo', 'outfit'].includes(type) ? '#f7f7f7' : '#ffffff', title: type === 'outfit' ? '搭配推荐' : type === 'combo' ? '细节展示' : undefined, ...(type === 'outfit' ? { useCutouts: [false, false, false], ctaEnabled: [true, true], ctaTexts: ['即刻查看>', '即刻查看>'], ctaColors: ['#111111', '#111111'] } : {}) };
}
export function createCards(ids) {
  if (!ids.length) return [];
  const singles = Array.from({ length: Math.min(12, ids.length) }, (_, i) => newCard('single', ids, i));
  if (ids.length >= 3) for (let i = 0; i < 2; i++) singles.push(newCard('combo', ids, singles.length));
  return singles;
}
export function mergeDuplicateGroups(groups, assets) {
  const finished = groups.filter(g => g.resolved), pending = [];
  const hashes = new Map(assets.map(a => [a.id, a.hash]));
  for (const group of groups.filter(g => !g.resolved)) {
    const merged = { ...group, ids: [...new Set(group.ids)] };
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].ids.some(id => merged.ids.includes(id))) {
      const previous = pending.splice(i, 1)[0];
      merged.id = previous.id;
      merged.ids = [...new Set([...previous.ids, ...merged.ids])];
      i = pending.length;
    }
    merged.kind = new Set(merged.ids.map(id => hashes.get(id))).size === 1 ? 'exact' : 'similar';
    pending.push(merged);
  }
  return [...finished, ...pending];
}
export function validateModel(model, available) {
  if (!model || !Array.isArray(model.cards) || model.cards.length > 100 || typeof (model.copy ?? '') !== 'string' || (model.copy ?? '').length > 30000) throw new Error('项目内容不合法');
  if (model.selectedIds && (!Array.isArray(model.selectedIds) || model.selectedIds.some(id => !available.includes(id)))) throw new Error('所选素材不存在');
  const images = new Set(available), names = new Set(), ids = new Set();
  for (const card of model.cards) {
    const name = safeName(card.name).toLowerCase();
    if (names.has(name)) throw new Error('导出文件名重复，请修改');
    names.add(name);
    if (typeof card.id !== 'string' || ids.has(card.id)) throw new Error('卡片标识不合法');
    ids.add(card.id);
    if (!['single', 'combo', 'outfit'].includes(card.type) || !Array.isArray(card.imageIds) || card.imageIds.length !== (card.type === 'single' ? 1 : 3) || card.imageIds.some(id => !images.has(id))) throw new Error('卡片图片不存在或已被排除');
    for (const crop of card.crops ?? []) if (![crop.x, crop.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('裁切位置不合法');
    if (card.type === 'outfit') {
      if (!Array.isArray(card.useCutouts) || card.useCutouts.length !== 3 || card.useCutouts[0] || card.useCutouts.some(value => typeof value !== 'boolean')) throw new Error('搭配图抠图状态不合法');
      if (!Array.isArray(card.ctaEnabled) || card.ctaEnabled.length !== 2 || card.ctaEnabled.some(value => typeof value !== 'boolean') || !Array.isArray(card.ctaTexts) || card.ctaTexts.length !== 2 || card.ctaTexts.some(value => typeof value !== 'string' || value.length > 80) || !Array.isArray(card.ctaColors) || card.ctaColors.length !== 2 || card.ctaColors.some(value => !/^#[0-9a-f]{6}$/i.test(value))) throw new Error('搭配图小文案不合法');
    }
    if (card.titlePosition && [card.titlePosition.x, card.titlePosition.y].some(n => !Number.isFinite(n) || n < 0 || n > 3000)) throw new Error('标题位置不合法');
    if (card.title !== undefined && (typeof card.title !== 'string' || card.title.length > 80)) throw new Error('组合标题最多80字');
    if (card.background && !/^#[0-9a-f]{6}$/i.test(card.background)) throw new Error('背景颜色不合法');
    for (const crop of card.crops ?? []) if ((crop.scale !== undefined && (!Number.isFinite(crop.scale) || crop.scale < .25 || crop.scale > 1.6)) || [crop.dx ?? 0, crop.dy ?? 0].some(n => !Number.isFinite(n) || Math.abs(n) > 3)) throw new Error('图片缩放或移动不合法');
    if (card.gradient && (card.type !== 'single' || typeof card.gradient.enabled !== 'boolean' || !/^#[0-9a-f]{6}$/i.test(card.gradient.color) || !Number.isInteger(card.gradient.height) || card.gradient.height < 1 || card.gradient.height > 1220)) throw new Error('单图渐变参数不合法');
    for (const color of [card.titleColor, card.text?.color, card.subtitle?.color].filter(v => v !== undefined)) if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('文字颜色不合法');
    if (card.subtitle && (typeof card.subtitle.value !== 'string' || card.subtitle.value.length > 2000)) throw new Error('副文案不合法');
    if (card.text && (typeof card.text.value !== 'string' || card.text.value.length > 2000 || !Number.isFinite(card.text.size) || card.text.size < 8 || card.text.size > 160)) throw new Error('文字内容或字号不合法');
  }
  return model;
}

export function imageRect(iw, ih, ow, oh, crop = {}) {
  const factor = Math.max(ow / iw, oh / ih) * (crop.scale ?? 1);
  const width = Math.max(1, Math.round(iw * factor)), height = Math.max(1, Math.round(ih * factor));
  return { left: Math.round((ow - width) * (crop.x ?? .5) + (crop.dx ?? 0) * ow), top: Math.round((oh - height) * (crop.y ?? .5) + (crop.dy ?? 0) * oh), width, height };
}

export function frameLayout(type) {
  if (type === 'outfit') return { width: 750, height: 1000, boxes: [{left:15,top:220,width:352,height:721,radius:20},{left:382,top:220,width:353,height:353,radius:20},{left:382,top:588,width:353,height:353,radius:20}] };
  return type === 'combo' ? { width: 750, height: 1600, boxes: [{ left: 15, top: 220, width: 720, height: 895, radius: 20 }, { left: 15, top: 1130, width: 352, height: 455, radius: 20 }, { left: 382, top: 1130, width: 353, height: 455, radius: 20 }] } : { width: 750, height: 1260, boxes: [{ left: 0, top: 40, width: 750, height: 1220, radius: 20 }] };
}

export function defaultCopy(kind, value = '', source) {
  return { value, source, x: 40, y: kind === 'subtitle' ? 340 : 150, width: 670, size: kind === 'subtitle' ? 36 : 72, color: '#111111', align: 'center', font: 'SourceHanSansCN-Bold', bold: true };
}

export function nextCopy(model, kind = 'main') {
  const parts = splitCopy(model.copy);
  if (!parts.length) return defaultCopy(kind);
  const assigned = model.cards.flatMap(card => [card.text?.source, card.subtitle?.source]).filter(index => Number.isInteger(index) && index >= 0 && index < parts.length);
  let source = parts.findIndex((_, index) => !assigned.includes(index));
  if (source < 0) source = assigned.length % parts.length;
  const value = kind === 'main' && parts[source].length > 16 ? parts[source].replace(/[，,]/, '\n') : parts[source];
  return defaultCopy(kind, value, source);
}
