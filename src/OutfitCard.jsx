import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { addOverlay } from './overlay';
import { bindOverlayDrag } from './editor-drag';
import AlignmentGuides from './AlignmentGuides';
import { Type, Trash2, Pencil } from 'lucide-react';
import { PhotoSlot } from './Card';
import { frameLayout } from '../shared/model';
import { imageUrl, loadImage } from './api';

export default function OutfitCard({ card, assets, index, onChange, onDelete, onAddText, onPick, onCutout, busy, onError }) {
  const preview = useRef(), title = useRef(), canvas = useRef(), latestCard = useRef(card), stepRequests = useRef([0,0,0]);
  latestCard.current = card;
  const [editing, setEditing] = useState(false), [guides, setGuides] = useState({});
  const [width, setWidth] = useState(250), [sampling, setSampling] = useState(null);
  useEffect(() => { const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width)); observer.observe(preview.current); return () => observer.disconnect(); }, []);
  const boxes = frameLayout('outfit').boxes, factor = width / 750;
  useEffect(() => { const warm = new Set(); for (const id of card.imageIds) { const at = assets.findIndex(a => a.id === id); for (const offset of [-2,-1,0,1,2]) if (assets.length) warm.add(assets[(at + offset + assets.length) % assets.length].id); } for (const id of warm) loadImage(imageUrl(id)).catch(() => {}); }, [card.imageIds, assets]);
  const patchArray = (key, slot, value) => { const current = latestCard.current, values = [...current[key]]; values[slot] = value; onChange({ ...current, [key]: values }); };
  const changeTitle = value => onChange(card.text ? { ...card, text: { ...card.text, value } } : { ...card, title: value });
  const samplingRef = useRef(null); samplingRef.current = sampling;
  useEffect(() => {
    const stage = new Konva.Stage({ container: canvas.current, width, height: 1000 * width / 750, scaleX: width / 750, scaleY: width / 750 });
    const layer = new Konva.Layer(); stage.add(layer); let active = true;
    const unbind = bindOverlayDrag(stage, preview.current, { bounds: { left: 0, top: 0, width: 750, height: 1000 }, enabled: () => !samplingRef.current, onGuides: setGuides, onEdit: () => setEditing(true), onMove: (_, position) => onChange({ ...latestCard.current, titlePosition: position }) });
    addOverlay(layer, card, 1000, { editing: editing ? 'title' : false }).then(() => { if (!active) stage.destroy(); }).catch(onError);
    return () => { active = false; unbind(); stage.destroy(); };
  }, [card.text, card.title, card.titleColor, card.titlePosition, width, editing]);
  const step = async (slot, direction) => {
    const initialId = latestCard.current.imageIds[slot], request = ++stepRequests.current[slot];
    const current = assets.findIndex(asset => asset.id === initialId), asset = assets[(current + direction + assets.length) % assets.length];
    if (!asset) return;
    try {
      await loadImage(imageUrl(asset.id));
      if (request !== stepRequests.current[slot] || latestCard.current.imageIds[slot] !== initialId) return;
      const currentCard = latestCard.current, imageIds = [...currentCard.imageIds], crops = [...currentCard.crops], useCutouts = [...currentCard.useCutouts];
      imageIds[slot] = asset.id; crops[slot] = { x: .5, y: .5 }; useCutouts[slot] = false;
      onChange({ ...currentCard, imageIds, crops, useCutouts });
    } catch (error) { if (request === stepRequests.current[slot]) onError(error); }
  };
  return <article className="image-card outfit-card" data-card-id={card.id}>
    <div className="card-toolbar"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="card-type">搭配推荐</span><div className="card-tools"><button aria-label={`卡片${index + 1}添加文案`} title="添加或编辑标题" onClick={() => { if (!card.text) onAddText(card); setEditing(true); }}><Type size={15}/></button><button aria-label={`删除卡片${index + 1}`} onClick={() => onDelete(card.id)}><Trash2 size={14}/></button></div></div>
    <div className="card-preview outfit-preview" ref={preview} style={{ aspectRatio: '750 / 1000', background: '#ffffff' }}>
      {editing && <textarea ref={title} className="outfit-title inline-copy" autoFocus aria-label="搭配推荐标题" maxLength={2000} value={card.text?.value ?? card.title} style={{ left: (card.titlePosition?.x ?? 40) * factor, top: (card.titlePosition?.y ?? 80) * factor, width: 670 * factor, height: 120 * factor, fontSize: 72 * factor, color: card.text?.color ?? card.titleColor ?? '#111111', textAlign: card.text?.align ?? 'center' }} onChange={event => changeTitle(event.target.value)} onBlur={() => setEditing(false)} onKeyDown={event => { if (event.key === 'Escape') setEditing(false); }}/>}
      {boxes.map((box, slot) => {
        const asset = assets.find(a => a.id === card.imageIds[slot]); if (!asset) return null;
        const source = card.useCutouts[slot] ? asset.cutoutUrl : asset.alphaUrl;
        const displayAsset = source ? { ...asset, width: card.useCutouts[slot] ? asset.cutoutWidth : asset.alphaWidth, height: card.useCutouts[slot] ? asset.cutoutHeight : asset.alphaHeight } : asset;
        const caption = slot > 0 && card.ctaEnabled[slot - 1], imageHeight = box.height;
        return <div className="frame-slot" key={slot} style={{ position: 'absolute', left: box.left * factor, top: box.top * factor, width: box.width * factor, height: box.height * factor, borderRadius: 20 * factor, overflow: 'hidden', background: card.background }}><div style={{ height: imageHeight * factor }}><PhotoSlot asset={displayAsset} source={source} contain={slot > 0} slot={slot} crop={card.crops[slot]} moving sampling={sampling === slot} onSample={color => { onChange({ ...latestCard.current, background: color }); setSampling(null); }} background={card.background} onCrop={crop => patchArray('crops', slot, crop)} onStep={direction => step(slot, direction)} onPick={() => onPick(card.id, slot)} onError={onError}/></div>{caption && <div className="outfit-caption" style={{ height: 60 * factor, fontSize: 30 * factor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.ctaColors[slot - 1] }}>即刻查看&gt;</div>}</div>;
      })}
      <div className="text-canvas" ref={canvas} style={{ pointerEvents: 'none' }}/>
      <AlignmentGuides guides={guides} width={750} height={1000}/>
    </div>
    <div className="text-options"><span>标题72号</span>{['#111111', '#ffffff'].map(color => <button key={color} onClick={() => onChange(card.text ? { ...card, text: { ...card.text, color } } : { ...card, titleColor: color })}>{color === '#ffffff' ? '白色' : '黑色'}</button>)}<select aria-label="搭配标题对齐" value={card.text?.align ?? 'center'} onChange={event => onChange({ ...card, text: { ...(card.text ?? { value: card.title, size: 72, color: card.titleColor ?? '#111111' }), align: event.target.value } })}><option value="center">居中</option><option value="left">左对齐</option><option value="right">右对齐</option></select></div>
    {[1, 2].map(slot => { const asset = assets.find(a => a.id === card.imageIds[slot]); return <div className="outfit-controls" key={slot}><strong>右侧{slot === 1 ? '上图' : '下图'}</strong><button disabled={busy || !asset} onClick={() => onCutout(card.id, slot)}>本机抠图</button><label><input type="checkbox" aria-label={`右侧${slot === 1 ? '上' : '下'}使用抠图结果`} disabled={!asset?.cutoutUrl} checked={card.useCutouts[slot]} onChange={event => patchArray('useCutouts', slot, event.target.checked)}/>使用抠图结果</label><label><input type="checkbox" aria-label={`右侧${slot === 1 ? '上' : '下'}显示即刻查看`} checked={card.ctaEnabled[slot - 1]} onChange={event => patchArray('ctaEnabled', slot - 1, event.target.checked)}/>显示即刻查看</label></div>; })}
    <div className="image-options"><span>背景</span><input aria-label="搭配图片背景色" type="color" value={card.background} onChange={event => onChange({ ...card, background: event.target.value })}/>{[0,1,2].map(slot => <button key={slot} onClick={() => setSampling(sampling === slot ? null : slot)}>位置{slot + 1}吸色</button>)}</div>
    <div className="card-filename"><Pencil size={12}/><input aria-label={`卡片${index + 1}导出文件名`} value={card.name} onChange={event => onChange({ ...card, name: event.target.value })}/><span>.jpg</span></div>
  </article>;
}
