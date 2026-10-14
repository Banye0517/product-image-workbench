import { imageRect } from './model.js';
export function snapRect(rect, bounds, threshold = 6, disabled = false) {
  let { left, top } = rect;
  const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2, guides = {};
  if (!disabled && Math.abs(left + rect.width / 2 - x) <= threshold) { left = x - rect.width / 2; guides.x = x; }
  if (!disabled && Math.abs(top + rect.height / 2 - y) <= threshold) { top = y - rect.height / 2; guides.y = y; }
  return { left, top, guides };
}
export function snapCrop(crop, iw, ih, width, height, contain = false, threshold = 6, disabled = false) {
  const fit = contain ? Math.min(width / iw, height / ih) / Math.max(width / iw, height / ih) * .86 : 1;
  const rect = imageRect(iw, ih, width, height, { ...crop, scale: (crop.scale ?? 1) * fit });
  const snapped = snapRect(rect, { left: 0, top: 0, width, height }, threshold, disabled);
  return { crop: { ...crop, dx: (crop.dx ?? 0) + (snapped.left - rect.left) / width, dy: (crop.dy ?? 0) + (snapped.top - rect.top) / height }, guides: snapped.guides };
}
