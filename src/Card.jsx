import React, { memo, useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { ChevronLeft, ChevronRight, Type, ImagePlus, Trash2, Pencil, Grip, Images, X } from 'lucide-react';
import { imageUrl, loadImage } from './api';
import { addOverlay } from './overlay';
import AlignmentGuides from './AlignmentGuides';
import { bindOverlayDrag } from './editor-drag';
import { snapCrop } from '../shared/alignment';
import { imageRect, frameLayout } from '../shared/model';

export function PhotoSlot({ asset, slot, combo, crop, onCrop, onStep, onPick, moving, sampling, onSample, background, onError, source, contain = false }) {
  const drag = useRef(null), element = useRef(null);
  const [guides, setGuides] = useState({});
  const [box, setBox] = useState({ width: 250, height: 400 });
  useEffect(() => { const observer = new ResizeObserver(entries => setBox({ width: entries[0].contentRect.width, height: entries[0].contentRect.height })); observer.observe(element.current); return () => observer.disconnect(); }, []);
  const containScale = Math.min(box.width / asset.width, box.height / asset.height) / Math.max(box.width / asset.width, box.height / asset.height) * .86;
  const rect = imageRect(asset.width, asset.height, box.width, box.height, contain ? { ...crop, scale: (crop.scale ?? 1) * containScale } : crop);
  const sample = async event => {
    const bounds = element.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left - rect.left) / rect.width, y = (event.clientY - bounds.top - rect.top) / rect.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return;
    const image = await loadImage(source ?? imageUrl(asset.id));
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d'); context.drawImage(image, Math.floor(x * image.naturalWidth), Math.floor(y * image.naturalHeight), 1, 1, 0, 0, 1, 1);
    const rgb = context.getImageData(0, 0, 1, 1).data;
    onSample('#' + [...rgb].slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join(''));
  };
  return <div ref={element} className={'photo-slot crop-slot' + (sampling ? ' sampling' : '')} style={{ background }} onPointerDown={event => {
    if (event.target.closest('button,input')) return;
    if (sampling) { sample(event).catch(onError); return; }
    if (!moving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, dx: crop.dx ?? 0, dy: crop.dy ?? 0 };
  }} onPointerMove={event => {
    const d = drag.current; if (!d) return;
    const bound = n => Math.max(-3, Math.min(3, n));
    const result = snapCrop({ ...crop, dx: bound(d.dx + (event.clientX - d.x) / box.width), dy: bound(d.dy + (event.clientY - d.y) / box.height) }, asset.width, asset.height, box.width, box.height, contain, 6, event.altKey);
    setGuides(result.guides); onCrop(result.crop);
  }} onPointerUp={() => { drag.current = null; setGuides({}); }} onPointerCancel={() => { drag.current = null; setGuides({}); }}>
    <img draggable="false" src={source ?? imageUrl(asset.id)} alt={asset.name} style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height }} decoding="async"/>
    <AlignmentGuides guides={guides} width={box.width} height={box.height}/>
    <div className="photo-navigation"><button title="上一张" aria-label={`位置${slot + 1}上一张`} onClick={() => onStep(-1)}><ChevronLeft size={17}/></button><button className="photo-source" title={asset.name} onClick={onPick}>{combo ? `位置 ${slot + 1}` : '选图'}</button><button title="下一张" aria-label={`位置${slot + 1}下一张`} onClick={() => onStep(1)}><ChevronRight size={17}/></button></div>
    {moving && <div className="slot-zoom"><span>{slot + 1}</span><input aria-label={`位置${slot + 1}图片缩放`} type="range" min=".25" max="1.6" step=".01" value={crop.scale ?? 1} onChange={event => onCrop({ ...crop, scale: Number(event.target.value) })}/><button title="重置图片位置" onClick={() => onCrop({ x: .5, y: .5 })}>重置</button></div>}
  </div>;
}

function Card({ card, assets, index, onChange, onDelete, onAddText, onAddSubtitle, firstSingle, onAddLogo, onPick, onError }) {
  const combo = card.type === 'combo';
  const assetMap = new Map(assets.map(a => [a.id, a]));
  const chosen = card.imageIds.map(id => assetMap.get(id)).filter(Boolean);
  const canvas = useRef(), preview = useRef(), stageRef = useRef(), latestCard = useRef(card);
  latestCard.current = card;
  const samplingRef = useRef(false);
  const [width, setWidth] = useState(250), [editing, setEditing] = useState(false), [guides, setGuides] = useState({}), [sampling, setSampling] = useState(false), [gradientInput, setGradientInput] = useState(card.gradient?.color ?? '#ffffff');
  useEffect(() => setGradientInput(card.gradient?.color ?? '#ffffff'), [card.gradient?.color]);
  samplingRef.current = sampling;
  const layout = frameLayout(card.type), height = layout.height;
  useEffect(() => {
    if (!preview.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(preview.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!canvas.current || !chosen.length) return;
    const stage = new Konva.Stage({ container: canvas.current, width, height: height * width / 750, scaleX: width / 750, scaleY: width / 750 });
    stageRef.current = stage;
    const layer = new Konva.Layer(); stage.add(layer);
    let active = true;
    const unbind = bindOverlayDrag(stage, preview.current, { bounds: { left: 0, top: combo ? 0 : 40, width: 750, height: combo ? height : height - 40 }, enabled: () => !samplingRef.current, onGuides: setGuides, onEdit: key => { if (['text', 'subtitle', 'title'].includes(key)) setEditing(key); }, onMove: (key, position) => { const c = latestCard.current; onChange(key === 'title' ? { ...c, titlePosition: position } : { ...c, [key]: { ...c[key], ...position } }); } });
    addOverlay(layer, card, height, { editing, onEdit: () => setEditing('text'), onSubtitleEdit: () => setEditing('subtitle'), onSubtitleMove: position => onChange({ ...latestCard.current, subtitle: { ...latestCard.current.subtitle, ...position } }), onTextMove: position => onChange({ ...latestCard.current, text: { ...latestCard.current.text, ...position } }), onLogoMove: position => onChange({ ...latestCard.current, logo: { ...latestCard.current.logo, ...position } }) }).then(() => { if (!active) stage.destroy(); }).catch(onError);
    return () => { active = false; unbind(); stage.destroy(); };
  }, [card.text, card.subtitle, card.logo, card.title, card.titlePosition, card.titleColor, combo, height, width, editing]);
  useEffect(() => {
    const warm = [];
    for (const id of card.imageIds) {
      const i = assets.findIndex(a => a.id === id);
      for (const offset of [-2, -1, 0, 1, 2]) if (assets.length) warm.push(assets[(i + offset + assets.length) % assets.length].id);
    }
    [...new Set(warm)].forEach(id => loadImage(imageUrl(id)).catch(() => {}));
  }, [card.imageIds, assets]);
  const step = async (slot, direction) => {
    if (!assets.length) return;
    const current = assets.findIndex(a => a.id === card.imageIds[slot]);
    const asset = assets[(current + direction + assets.length) % assets.length];
    try {
      await loadImage(imageUrl(asset.id));
      const ids = [...card.imageIds]; ids[slot] = asset.id;
      const crops = [...card.crops]; crops[slot] = { x: 0.5, y: 0.5 };
      onChange({ ...card, imageIds: ids, crops });
    } catch (e) { onError(e); }
  };
  if (!chosen.length) return null;
  const activeText = editing === 'subtitle' ? card.subtitle : card.text;
  const changeActiveText = patch => onChange({ ...card, [editing || 'text']: { ...activeText, ...patch } });
  const changeText = patch => onChange({ ...card, text: { ...card.text, ...patch } });
  return <article className="image-card" tabIndex="0" data-card-id={card.id} onKeyDown={event => { if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return; if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); step(0, event.key === 'ArrowLeft' ? -1 : 1); } }}>
    <div className="card-toolbar"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="card-type">{combo ? '三图组合' : '单张大图'}</span><div className="card-tools">{!combo && <><button className={card.text ? 'active' : ''} title="添加或编辑文案" aria-label={`卡片${index + 1}添加文案`} onClick={() => { if (!card.text) onAddText(card); setEditing('text'); }}><Type size={15}/></button><button className={card.logo ? 'active' : ''} title={card.logo ? '移除Logo' : '添加Logo'} aria-label={`卡片${index + 1}添加Logo`} onClick={() => card.logo ? onChange({ ...card, logo: null }) : onAddLogo(card)}><ImagePlus size={15}/></button></>}<button title="删除卡片" aria-label={`删除卡片${index + 1}`} onClick={() => onDelete(card.id)}><Trash2 size={14}/></button></div></div>
    <div className={'card-preview ' + (combo ? 'combo-preview' : '')} ref={preview} style={{ aspectRatio: `750 / ${height}`, background: combo ? (card.background ?? '#ffffff') : '#ffffff' }}>
      {chosen.map((asset, slot) => <div key={slot} className="frame-slot" style={{ position: 'absolute', left: layout.boxes[slot].left / 750 * 100 + '%', top: layout.boxes[slot].top / height * 100 + '%', width: layout.boxes[slot].width / 750 * 100 + '%', height: layout.boxes[slot].height / height * 100 + '%', borderRadius: 20 * width / 750, overflow: 'hidden' }}><PhotoSlot key={slot} asset={asset} slot={slot} combo={combo} onError={onError} moving sampling={sampling} background={card.background ?? '#ffffff'} onSample={color => { onChange(sampling === 'gradient' ? { ...card, gradient: { ...card.gradient, color } } : { ...card, background: color }); setSampling(false); }} crop={card.crops?.[slot] ?? { x: 0.5, y: 0.5 }} onCrop={crop => { const crops = [...card.crops]; crops[slot] = crop; onChange({ ...card, crops }); }} onStep={direction => step(slot, direction)} onPick={() => onPick(card.id, slot)}/>{!combo && card.gradient?.enabled && <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: card.gradient.height / 1220 * 100 + '%', background: `linear-gradient(to bottom, ${card.gradient.color}, ${card.gradient.color}00)`, pointerEvents: 'none' }}/>}</div>)}
      {combo && editing === 'title' && <textarea className="combo-title inline-copy" autoFocus aria-label="组合图标题" maxLength={80} value={card.title ?? '细节展示'} style={{ left: (card.titlePosition?.x ?? 40) / 750 * 100 + '%', top: (card.titlePosition?.y ?? 80) / height * 100 + '%', width: 670 / 750 * 100 + '%', height: 120 / height * 100 + '%', fontSize: 72 * width / 750, color: card.titleColor ?? '#111111' }} onChange={event => onChange({ ...card, title: event.target.value })} onBlur={() => setEditing(false)} onKeyDown={event => { if (event.key === 'Escape') setEditing(false); }}/ >}
      <div className="text-canvas" ref={canvas} style={{ pointerEvents: 'none' }}/>
      <AlignmentGuides guides={guides} width={750} height={height}/>
      {!combo && activeText && editing && <textarea className="inline-copy" autoFocus aria-label={editing === 'subtitle' ? '直接修改图片副文案' : '直接修改图片文案'} style={{ left: activeText.x / 750 * 100 + '%', top: activeText.y / height * 100 + '%', width: (activeText.width ?? 670) / 750 * 100 + '%', fontSize: (editing === 'subtitle' ? 36 : 72) * width / 750, color: activeText.color, fontWeight: 700, textAlign: activeText.align, fontFamily: 'SourceHanSansCN-Bold' }} value={activeText.value} onChange={event => changeActiveText({ value: event.target.value })} onBlur={() => setEditing(false)} onKeyDown={event => { if (event.key === 'Escape') setEditing(false); }}/ >}
    </div>
    <div className="image-options"><button className={sampling ? 'active' : ''} onClick={() => setSampling(!sampling)}>{sampling ? '点击照片吸色' : '背景吸色'}</button><input aria-label="画布背景颜色" type="color" value={card.background ?? '#ffffff'} onChange={event => onChange({ ...card, background: event.target.value })}/></div>
    {!combo && <div className="image-options detail-gradient-controls"><label><input aria-label="添加详情渐变层" type="checkbox" checked={card.gradient?.enabled ?? false} onChange={event => onChange({ ...card, gradient: { color: card.background ?? '#ffffff', height: 500, ...card.gradient, enabled: event.target.checked } })}/> 添加上色下透明渐变</label>{card.gradient?.enabled && <><input type="color" aria-label="渐变顶部颜色" value={card.gradient.color} onChange={event => onChange({ ...card, gradient: { ...card.gradient, color: event.target.value } })}/><input aria-label="渐变色号" value={gradientInput} maxLength={7} onBlur={() => setGradientInput(card.gradient.color)} onChange={event => { setGradientInput(event.target.value); if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange({ ...card, gradient: { ...card.gradient, color: event.target.value } }); }}/><button onClick={() => setSampling(sampling === 'gradient' ? false : 'gradient')}>渐变吸色</button><label>高度 {card.gradient.height}px<input aria-label="渐变高度" type="range" min="1" max="1220" value={card.gradient.height} onChange={event => onChange({ ...card, gradient: { ...card.gradient, height: Number(event.target.value) } })}/></label></>}</div>}
    {combo && <div className="text-options"><span>标题颜色</span>{['#111111', '#ffffff'].map(color => <button key={color} onClick={() => onChange({ ...card, titleColor: color })}>{color === '#ffffff' ? '白色' : '黑色'}</button>)}</div>}
    <div className="card-filename"><Pencil size={12}/><input aria-label={`卡片${index + 1}导出文件名`} value={card.name} onChange={event => onChange({ ...card, name: event.target.value })}/><span>.jpg</span></div>
    {!combo && card.text && <div className="text-options"><select aria-label="文字对齐" value={card.text.align} onChange={event => changeText({ align: event.target.value, x: 40, width: 670 })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select><span>72号</span><input type="color" aria-label="文字颜色" value={card.text.color} onChange={event => changeText({ color: event.target.value })}/>{['#111111', '#ffffff'].map(color => <button key={color} onClick={() => changeText({ color })}>{color === '#ffffff' ? '白色' : '黑色'}</button>)}<button title="编辑文字" onClick={() => setEditing('text')}><Pencil size={12}/></button><button title="移除文案" onClick={() => onChange({ ...card, text: null })}><X size={12}/></button></div>}
    {!combo && (firstSingle || card.subtitle) && <div className="subtitle-options"><span>副文案 · 36号</span>{card.subtitle ? <><textarea aria-label="副文案内容" value={card.subtitle.value} onChange={event => onChange({ ...card, subtitle: { ...card.subtitle, value: event.target.value } })}/><select aria-label="副文案对齐" value={card.subtitle.align ?? 'center'} onChange={event => onChange({ ...card, subtitle: { ...card.subtitle, x: 40, width: 670, align: event.target.value } })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select>{['#111111', '#ffffff'].map(color => <button key={color} onClick={() => onChange({ ...card, subtitle: { ...card.subtitle, color } })}>{color === '#ffffff' ? '白色' : '黑色'}</button>)}<button onClick={() => { setEditing('subtitle'); }}>图上编辑</button><button onClick={() => onChange({ ...card, subtitle: null })}>移除</button></> : <button onClick={() => { onAddSubtitle(card); setEditing('subtitle'); }}>添加副文案</button>}</div>}
    {!combo && card.logo && <div className="logo-options"><span>Logo 大小</span><input aria-label="Logo大小" type="range" min="60" max="450" value={card.logo.width} onChange={event => onChange({ ...card, logo: { ...card.logo, width: Number(event.target.value) } })}/></div>}
  </article>;
}
export default memo(Card);
