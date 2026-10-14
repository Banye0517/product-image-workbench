import React, { useMemo, useState } from 'react';
import { imageUrl } from './api';
export default function Selection({ project, selectedIds, onConfirm, onClose }) {
 const [selected, setSelected] = useState(new Set(selectedIds ?? [])), [large, setLarge] = useState(false), [zoom, setZoom] = useState(null);
 const rows = useMemo(() => {
  const assets = project.assets.filter(a => !a.excluded), seen = new Set(), result = [];
  for (const [index, group] of project.groups.filter(g => !g.resolved).entries()) for (const id of group.ids) {
   const asset = assets.find(a => a.id === id); if (asset && !seen.has(id)) { seen.add(id); result.push({ ...asset, group: `${group.kind === 'exact' ? '重复' : '相似'}组 ${index + 1}` }); }
  }
  return [...result, ...assets.filter(a => !seen.has(a.id))];
 }, [project]);
 return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="分组选图"><header><div><h2>分组选图</h2><p>先比较，再勾选需要的图片。点击照片放大；同组可保留多张。原摄影文件保留。</p></div><button onClick={onClose}>关闭</button></header><div className="selection-toolbar"><span>{project.status === 'processing' ? `缩图和分组中 ${project.processed}/${project.total} · 可先浏览` : `分组完成 · ${rows.length} 张素材`} · 已选 {selected.size} 张</span><button onClick={() => setLarge(false)} disabled={!large}>小图</button><button onClick={() => setLarge(true)} disabled={large}>大图</button></div><div className={'selection-grid' + (large ? ' large' : '')}>{rows.map(a => <div key={a.id} className={'selection-item' + (selected.has(a.id) ? ' chosen' : '')}><img src={imageUrl(a.id, !large)} alt={a.name} onClick={() => setZoom(a)}/><label><input type="checkbox" checked={selected.has(a.id)} onChange={() => setSelected(previous => { const next = new Set(previous); next.has(a.id) ? next.delete(a.id) : next.add(a.id); return next; })}/>{a.name}</label><small>{a.group ?? '独立照片'}</small></div>)}</div><div className="modal-footer"><span>确认后生成单图卡片；组合卡片可以在工作台新增。</span><button className="primary" disabled={!selected.size || project.status === 'processing'} onClick={() => onConfirm(rows.filter(a => selected.has(a.id)).map(a => a.id))}>用所选 {selected.size} 张进入编辑</button></div></section>{zoom && <div className="lightbox" role="dialog" aria-label="图片放大查看" onClick={() => setZoom(null)}><button onClick={() => setZoom(null)}>关闭大图</button><img src={imageUrl(zoom.id)} alt={zoom.name}/></div>}</div>;
}
