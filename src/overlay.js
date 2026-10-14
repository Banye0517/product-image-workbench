import Konva from 'konva';
import { frameLayout } from '../shared/model';
import { loadImage } from './api';

export async function addOverlay(layer, card, height, handlers = {}) {
  if (['combo', 'outfit'].includes(card.type)) {
    await document.fonts.load('700 72px "SourceHanSansCN-Bold"');
    const position = card.titlePosition ?? { x: 40, y: 80 };
    const node = new Konva.Text({ x: position.x, y: position.y, width: 670, height: 120, text: card.type === 'outfit' ? (card.text?.value ?? card.title ?? '搭配推荐') : (card.title ?? '细节展示'), fontSize: 72, fontFamily: 'SourceHanSansCN-Bold', fontStyle: 'bold', fill: card.text?.color ?? card.titleColor ?? '#111111', align: card.type === 'outfit' ? (card.text?.align ?? 'center') : 'left', lineHeight: 1.25, visible: handlers.editing !== 'title', editorKey: 'title' });
    layer.add(node); layer.draw(); return;
  }
  for (const key of ['text', 'subtitle']) if (card[key]) {
    await document.fonts.load('700 72px "SourceHanSansCN-Bold"');
    const text = card[key], move = key === 'text' ? handlers.onTextMove : handlers.onSubtitleMove;
    const node = new Konva.Text({ x: text.x, y: text.y, text: text.value, width: text.width ?? 670, fontSize: key === 'text' ? 72 : 36, fontFamily: 'SourceHanSansCN-Bold', fontStyle: 'bold', fill: text.color ?? '#111111', align: text.align ?? 'center', lineHeight: 1.25, editorKey: key, draggable: false, visible: handlers.editing !== key });
    node.on('dragend', () => move?.({ x: Math.max(0, Math.min(710, node.x())), y: Math.max(40, Math.min(height - 40, node.y())) }));
    node.on('dblclick dbltap', () => key === 'text' ? handlers.onEdit?.() : handlers.onSubtitleEdit?.());
    layer.add(node);
  }
  if (card.logo) {
    const logo = card.logo;
    const image = await loadImage(logo.url);
    const node = new Konva.Image({ image, x: logo.x ?? 28, y: Math.max(40, logo.y ?? 68), width: logo.width ?? 200, height: (logo.width ?? 200) * logo.ratio, editorKey: 'logo', draggable: false });
    node.on('dragend', () => handlers.onLogoMove?.({ x: Math.max(0, Math.min(750 - node.width(), node.x())), y: Math.max(40, Math.min(height - node.height(), node.y())) }));
    layer.add(node);
  }
  layer.draw();
}
export async function exportOverlay(card) {
  if (card.type === 'single' && (!card.text && !card.subtitle && !card.logo)) return undefined;
  await document.fonts.ready;
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: 750, height: frameLayout(card.type).height });
  const layer = new Konva.Layer(); stage.add(layer);
  try {
    if (card.type === 'combo' || card.type === 'outfit') {
      await document.fonts.load('700 72px "SourceHanSansCN-Bold"');
      layer.add(new Konva.Text({ x: card.titlePosition?.x ?? 40, y: card.titlePosition?.y ?? 80, width: 670, height: 120, text: card.type === 'outfit' ? (card.text?.value ?? card.title ?? '搭配推荐') : (card.title ?? '细节展示'), fontSize: 72, fontFamily: 'SourceHanSansCN-Bold', fontStyle: 'bold', fill: card.text?.color ?? card.titleColor ?? '#111111', align: card.type === 'outfit' ? (card.text?.align ?? 'center') : 'left', lineHeight: 1.25 })); layer.draw();
    if (card.type === 'outfit') for (const [index, box] of frameLayout(card.type).boxes.slice(1).entries()) if (card.ctaEnabled[index]) layer.add(new Konva.Text({x:box.left,y:box.top+box.height-60,width:box.width,height:60,text:'即刻查看>',fontSize:30,fontFamily:'SourceHanSansCN-Bold',fontStyle:'bold',fill:card.ctaColors[index],align:'center',verticalAlign:'middle'})); layer.draw();
    } else await addOverlay(layer, card, frameLayout(card.type).height); return stage.toDataURL({ pixelRatio: 1 }); }
  finally { stage.destroy(); }
}
