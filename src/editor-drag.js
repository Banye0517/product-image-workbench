import { snapRect } from '../shared/alignment.js';
export function bindOverlayDrag(stage, preview, { bounds, onMove, onEdit, onGuides, enabled = () => true }) {
  let drag;
  const scale = () => stage.scaleX();
  const point = event => { const r = preview.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
  const hit = event => {
    let node = stage.getIntersection(point(event));
    while (node && !node.getAttr('editorKey')) node = node.getParent();
    return node?.getAttr('editorKey') ? node : null;
  };
  const down = event => {
    if (!enabled() || event.button !== 0 || event.target.closest('button,input,textarea,select')) return;
    const node = hit(event); if (!node) return;
    event.stopPropagation(); event.preventDefault(); preview.setPointerCapture(event.pointerId);
    const p = point(event), rect = node.getClientRect({ relativeTo: node.getLayer() });
    drag = { node, pointerId: event.pointerId, p, x: node.x(), y: node.y(), rect, moved: false };
  };
  const move = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    const p = point(event), dx = (p.x - drag.p.x) / scale(), dy = (p.y - drag.p.y) / scale();
    if (Math.hypot(p.x - drag.p.x, p.y - drag.p.y) < 3 && !drag.moved) return;
    drag.moved = true;
    const snapped = snapRect({ ...drag.rect, left: drag.rect.x + dx, top: drag.rect.y + dy }, bounds, 6 / scale(), event.altKey);
    drag.node.position({ x: drag.x + snapped.left - drag.rect.x, y: drag.y + snapped.top - drag.rect.y });
    drag.node.getLayer().batchDraw(); onGuides(snapped.guides);
  };
  const end = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    const d = drag; drag = null;
    if (event.type === 'pointercancel') { d.node.position({ x: d.x, y: d.y }); d.node.getLayer().batchDraw(); }
    else if (d.moved) onMove(d.node.getAttr('editorKey'), { x: Math.max(0, Math.min(bounds.width - 20, d.node.x())), y: Math.max(bounds.top, Math.min(bounds.top + bounds.height - 20, d.node.y())) });
    if (preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId);
    onGuides({});
  };
  const edit = event => {
    if (!enabled() || event.target.closest('button,input,textarea,select')) return;
    const node = hit(event); if (node && onEdit) { event.stopPropagation(); onEdit(node.getAttr('editorKey')); }
  };
  const events = [['pointerdown', down], ['pointermove', move], ['pointerup', end], ['pointercancel', end], ['dblclick', edit]];
  events.forEach(([type, fn]) => preview.addEventListener(type, fn, true));
  return () => { events.forEach(([type, fn]) => preview.removeEventListener(type, fn, true)); onGuides({}); };
}
