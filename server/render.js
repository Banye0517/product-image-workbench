import sharp from 'sharp';
import path from 'node:path';
import { mainLayout, renderSpec } from '../shared/main-model.js';
import { imageRect, frameLayout } from '../shared/model.js';

sharp.concurrency(2);
sharp.cache({ memory: 64, files: 20, items: 80 });

export async function renderCard(store, project, card, overlay, format) {
  const main = Boolean(format);
  if (main) card = renderSpec(card, format);
  const assets = new Map(store.available(project).map(a => [a.id, a]));
  const imageIds = main ? [card.imageId] : card.imageIds;
  if (imageIds.some(id => !assets.has(id))) throw new Error('导出图片不存在');
  const { width: outputWidth, height, boxes } = main ? mainLayout(card.kind, format) : frameLayout(card.type);
  const pieces = await Promise.all(boxes.map(async (box, i) => {
    const asset = assets.get(imageIds[i]);
    let source = store.assetPath(asset.id);
    if (asset.hasAlpha && asset.alphaUrl) {
      const name = path.basename(asset.alphaUrl);
      if (!/^[a-f0-9-]{36}-alpha\.png$/.test(name)) throw new Error('透明图片缓存不合法');
      source = path.join(store.root, 'media', name);
    }
    if ((main && card.kind === 'white' && card.useCutout) || (!main && card.type === 'outfit' && card.useCutouts?.[i])) {
      if (!asset.cutoutUrl || !/^[a-f0-9-]{36}-cutout\.png$/.test(path.basename(asset.cutoutUrl))) throw new Error('请先完成抠图或选择透明PNG');
      source = path.join(store.root, 'media', path.basename(asset.cutoutUrl));
    }
    const metadata = await sharp(source, { limitInputPixels: 160000000 }).metadata();
    if (main && card.kind === 'white' && !metadata.hasAlpha) throw new Error('白底商品图请先抠图或选择透明PNG');
    const swapped = [5, 6, 7, 8].includes(metadata.orientation);
    const iw = swapped ? metadata.height : metadata.width, ih = swapped ? metadata.width : metadata.height;
    const crop = main ? (card.crop ?? card.views?.[format]?.crop ?? {}) : card.crops?.[i];
    const imageHeight = box.height;
    let rect = imageRect(iw, ih, box.width, imageHeight, crop);
    if ((main && card.kind === 'white') || (!main && card.type === 'outfit' && i > 0)) {
      const factor = Math.min(box.width / iw, imageHeight / ih) * .86 * (crop.scale ?? 1);
      rect = { width: Math.max(1, Math.round(iw * factor)), height: Math.max(1, Math.round(ih * factor)) };
      rect.left = Math.round((box.width - rect.width) * (crop.x ?? .5) + (crop.dx ?? 0) * box.width);
      rect.top = Math.round((imageHeight - rect.height) * (crop.y ?? .5) + (crop.dy ?? 0) * imageHeight);
    }
    const left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    const width = Math.min(box.width, rect.left + rect.width) - left;
    const h = Math.min(imageHeight, rect.top + rect.height) - top;
    if (width <= 0 || h <= 0) return null;
    const sourceLeft = Math.max(0, Math.floor((left - rect.left) / rect.width * iw));
    const sourceTop = Math.max(0, Math.floor((top - rect.top) / rect.height * ih));
    const sourceWidth = Math.min(iw - sourceLeft, Math.max(1, Math.ceil(width / rect.width * iw)));
    const sourceHeight = Math.min(ih - sourceTop, Math.max(1, Math.ceil(h / rect.height * ih)));
    const cropped = await sharp(source, { limitInputPixels: 160000000 }).autoOrient().extract({ left: sourceLeft, top: sourceTop, width: sourceWidth, height: sourceHeight }).resize(width, h, { fit: 'fill' }).toColourspace('srgb').png().toBuffer();
    let slot = await sharp({ create: { width: box.width, height: box.height, channels: 4, background: !main && ['single','outfit'].includes(card.type) ? (card.background ?? '#ffffff') : '#00000000' } }).composite([{ input: cropped, left, top }]).png().toBuffer();
    if (!main && card.type === 'single' && card.gradient?.enabled) {
      const gradient = Buffer.from(`<svg width="750" height="${card.gradient.height}"><defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${card.gradient.color}"/><stop offset="1" stop-color="${card.gradient.color}" stop-opacity="0"/></linearGradient></defs><rect width="750" height="${card.gradient.height}" fill="url(#fade)"/></svg>`);
      slot = await sharp(slot).composite([{ input: gradient, left: 0, top: 0 }]).png().toBuffer();
    }
    const mask = Buffer.from(`<svg width="${box.width}" height="${box.height}"><rect width="${box.width}" height="${box.height}" rx="${box.radius ?? 0}" fill="white"/></svg>`);
    const input = await sharp(slot).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    return { input, left: box.left, top: box.top };
  }));
  const buffer = await sharp({ create: { width: outputWidth, height, channels: 3, background: !main && ['single','outfit'].includes(card.type) ? '#ffffff' : (card.background ?? (card.type === 'combo' ? '#f7f7f7' : '#ffffff')) } }).composite(pieces.filter(Boolean)).png().toBuffer();
  let output = sharp(buffer);
  if (overlay) {
    const image = Buffer.from(overlay.replace(/^data:image\/png;base64,/, ''), 'base64');
    const metadata = await sharp(image).metadata();
    if (metadata.width !== outputWidth || metadata.height !== height || metadata.format !== 'png') throw new Error('文字图层尺寸不匹配');
    output = output.composite([{ input: image, left: 0, top: 0 }]);
  }
  return output.jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
}
