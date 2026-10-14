import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderPlus, Search, Folder, Check, Download, Save, Plus, Images, Image, Type, ChevronDown, CheckCircle2, AlertCircle, X, ArrowUpRight, RotateCcw, LoaderCircle, SlidersHorizontal, FolderOpen, Trash2 } from 'lucide-react';
import Card from './Card';
import OutfitCard from './OutfitCard';
import Selection from './Selection';
import MainCard from './MainCard';
import { exportMainOverlay } from './main-overlay';
import { applyMainEdit, renderSpec, createMainCards, newMainCard, validateMainCards } from '../shared/main-model';
import { api, imageUrl } from './api';
import { exportOverlay } from './overlay';
import { splitCopy, newCard, validateModel, nextCopy } from '../shared/model';

function Modal({ title, subtitle, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button aria-label="关闭" onClick={onClose}><X size={20}/></button></header>{children}</section></div>;
}

export default function App() {
  const [list, setList] = useState([]), [project, setProject] = useState(null), [model, setModel] = useState(null);
  const [search, setSearch] = useState(''), [checked, setChecked] = useState(new Set()), [dirty, setDirty] = useState(new Set());
  const [toast, setToast] = useState(null), [busy, setBusy] = useState(null), [output, setOutput] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [exportWarning, setExportWarning] = useState(null);
  const [pageScope, setPageScope] = useState('detail'), [mainFormat, setMainFormat] = useState('800'), [activeMainId, setActiveMainId] = useState(null);
  const [selectionOpen, setSelectionOpen] = useState(false), [zoom, setZoom] = useState(null), [largeCandidates, setLargeCandidates] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false), [keep, setKeep] = useState(new Set());
  const [picker, setPicker] = useState(null), [issues, setIssues] = useState(false), [logo, setLogo] = useState({ url: '/brand-logo.png', ratio: 65 / 299 });
  const drafts = useRef(new Map()), timer = useRef(), saveChain = useRef(Promise.resolve()), openSequence = useRef(0), workState = useRef({ busy: null, list: [] }), latest = useRef({ project: null, model: null });
  latest.current = { project, model };
  workState.current = { busy, list };
  const notify = useCallback((message, error = false) => setToast({ message, error, time: Date.now() }), []);
  const onError = useCallback(e => notify(e.message || String(e), true), [notify]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), toast.error ? 9000 : 6000); return () => clearTimeout(id); }, [toast]);
  const refreshList = useCallback(async () => { const rows = await api('/projects'); setList(previous => JSON.stringify(previous) === JSON.stringify(rows) ? previous : rows); return rows; }, []);
  const persistDraft = useCallback((id, value, complete = false, scope = 'detail') => {
    const action = saveChain.current.catch(() => {}).then(() => api(`/projects/${id}/save`, { model: value, complete, scope }));
    saveChain.current = action; return action;
  }, []);
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const { project: p, model: m } = latest.current;
    if (p && m && drafts.current.has(p.id)) { await persistDraft(p.id, m, false); if (drafts.current.get(p.id) === m) drafts.current.delete(p.id); }
  }, [persistDraft]);
  const openProject = useCallback(async (id, force = false) => {
    const sequence = ++openSequence.current;
    try {
      if (latest.current.project?.id === id && !force) return;
      await flush();
      const p = await api('/projects/' + id);
      if (sequence !== openSequence.current) return;
      const hydrated = { ...p.model, detailSaved: p.detailSaved ?? p.saved, mainSaved: p.mainSaved ?? false };
      latest.current = { project: p, model: hydrated };
      setProject(p); setModel(hydrated); setSelectionOpen(!p.model.selectionDone); setDuplicateOpen(false); setPicker(null);
    } catch (e) { onError(e); }
  }, [flush, onError]);
  useEffect(() => {
    let stopped = false;
    refreshList().then(rows => { if (!stopped && rows.length) openProject(rows[0].id); }).catch(onError);
    const interval = setInterval(() => refreshList().catch(onError), 1800);
    return () => { stopped = true; clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (project?.status !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const p = await api('/projects/' + project.id);
        if (latest.current.project?.id !== p.id) return;
        setProject(p);
        if (!drafts.current.has(p.id) && latest.current.model?.auto) setModel(p.model);
      } catch (e) { onError(e); }
    }, 550);
    return () => clearInterval(interval);
  }, [project?.id, project?.status]);
  useEffect(() => {
    const onUnload = event => { if (drafts.current.size || workState.current.busy || workState.current.list.some(p => p.status === 'processing')) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload); return () => window.removeEventListener('beforeunload', onUnload);
  }, []);
  const changeModel = useCallback(updater => {
    const { project: p, model: current } = latest.current;
    if (!p || !current) return;
    const next = { ...(typeof updater === 'function' ? updater(current) : updater) };
    if (next.cards !== current.cards) next.auto = false;
    if (next.cards !== current.cards || next.selectedIds !== current.selectedIds || next.copy !== current.copy) next.detailSaved = false;
    if (next.mainCards !== current.mainCards || next.copy !== current.copy) next.mainSaved = false;
    latest.current = { project: p, model: next }; setModel(next);
    drafts.current.set(p.id, next); setDirty(previous => new Set(previous).add(p.id));
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await persistDraft(p.id, next, false);
        if (drafts.current.get(p.id) === next) drafts.current.delete(p.id);
      } catch (e) { onError(e); }
    }, 700);
  }, [persistDraft, onError]);
  const changeCard = useCallback(card => changeModel(current => ({ ...current, cards: current.cards.map(c => c.id === card.id ? card : c) })), [changeModel]);
  const deleteCard = useCallback(id => changeModel(current => ({ ...current, cards: current.cards.filter(c => c.id !== id) })), [changeModel]);
  const allAssets = useMemo(() => project?.assets.filter(a => !a.excluded) ?? [], [project?.assets]);
  const assets = useMemo(() => model?.selectedIds ? allAssets.filter(a => model.selectedIds.includes(a.id)) : allAssets, [allAssets, model?.selectedIds]);
  const visible = useMemo(() => list.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [list, search]);
  const group = duplicateOpen ? project?.groups.find(g => !g.resolved) : null;
  useEffect(() => { if (group) setKeep(new Set([group.ids[0]])); }, [group?.id]);
  const importFolders = async () => {
    try {
      setBusy({ type: 'import', label: '选择文件夹…' });
      const { paths } = await api('/choose', { kind: 'import' });
      if (!paths.length) return;
      const { ids } = await api('/import', { paths });
      await refreshList(); await openProject(ids[0], true); notify('文件夹已添加，图片正在后台自动处理');
    } catch (e) { onError(e); } finally { setBusy(null); }
  };
  const addText = useCallback(card => {
    changeCard({ ...card, text: nextCopy(latest.current.model, 'main') });
  }, [changeCard]);
  const addSubtitle = useCallback(card => {
    changeCard({ ...card, subtitle: nextCopy(latest.current.model, 'subtitle') });
  }, [changeCard]);
  const removeProject = async () => {
    const target = removeTarget; if (!target) return;
    try {
      await flush(); await api(`/projects/${target.id}/archive`, {}); drafts.current.delete(target.id);
      setChecked(previous => { const next = new Set(previous); next.delete(target.id); return next; });
      setDirty(previous => { const next = new Set(previous); next.delete(target.id); return next; });
      if (latest.current.project?.id === target.id) { ++openSequence.current; latest.current = { project: null, model: null }; setProject(null); setModel(null); setSelectionOpen(false); setDuplicateOpen(false); setPicker(null); }
      setRemoveTarget(null); const rows = await refreshList(); if (!latest.current.project && rows.length) await openProject(rows[0].id);
      notify('已从工作台移除，摄影原文件保留；重新添加目录可恢复记录');
    } catch (e) { onError(e); }
  };
  const addLogo = useCallback(async card => {
    try {
      let image = logo;
      if (!image) { image = await api('/logo', {}); if (image.canceled) return; setLogo(image); }
      changeCard({ ...card, logo: { ...image, x: 28, y: 68, width: 200 } });
    } catch (e) { onError(e); }
  }, [logo, changeCard, onError]);
  const save = async () => {
    try {
      setBusy({ type: 'save', label: '保存中…' }); clearTimeout(timer.current);
      const { project: p, model: value } = latest.current;
      const saved = await persistDraft(p.id, value, true, pageScope);
      const current = latest.current;
      const unchanged = current.project?.id === p.id && current.model === value;
      if (drafts.current.get(p.id) === value) drafts.current.delete(p.id);
      if (unchanged) {
        const hydrated = { ...saved.model, detailSaved: saved.detailSaved ?? saved.saved, mainSaved: saved.mainSaved ?? false }; latest.current = { project: saved, model: hydrated }; setProject(saved); setModel(hydrated);
        setDirty(previous => { const next = new Set(previous); next.delete(p.id); return next; });
      }
      await refreshList(); notify(unchanged ? '当前页面已保存，按钮已更新为蓝色' : '保存完成；后续修改仍待保存');
    } catch (e) { onError(e); } finally { setBusy(null); }
  };
  const chooseOutput = async () => {
    const { paths } = await api('/choose', { kind: 'output' });
    if (paths[0]) { setOutput(paths[0]); return paths[0]; }
    return null;
  };
  const exportProjects = async (ids, scope = pageScope) => {
    if (!ids.length) return notify('请先勾选需要导出的产品', true);
    try {
      setBusy({ type: 'export', label: '准备导出…' });
      const snapshots = [];
      for (const id of ids) {
        const p = id === latest.current.project?.id ? latest.current.project : await api('/projects/' + id);
        const m = structuredClone(id === latest.current.project?.id ? latest.current.model : { ...p.model, detailSaved: p.detailSaved ?? p.saved, mainSaved: p.mainSaved ?? false });
        if (scope !== 'detail') validateMainCards(m.mainCards || [], p.assets.filter(a => !a.excluded).map(a => a.id));
        if (scope !== 'main') validateModel(m, p.assets.filter(a => !a.excluded).map(a => a.id));
        if (p.status === 'processing') throw new Error('请等待所有勾选的产品处理完成');
        if (scope !== 'all' && ((scope !== 'detail' && !m.mainCards?.length) || (scope !== 'main' && !m.cards?.length))) throw new Error(p.name + '没有可导出的卡片');
        snapshots.push({ p, m });
      }
      if (scope === 'all') {
        const pending = snapshots.flatMap(({ p, m }) => {
          const pages = [];
          if (!(m.detailSaved ?? p.detailSaved ?? p.saved)) pages.push('详情页');
          if (!(m.mainSaved ?? p.mainSaved)) pages.push('主图');
          return pages.length ? [`${p.name}：${pages.join('、')}未保存`] : [];
        });
        if (pending.length) { setExportWarning(pending); return; }
        const empty = snapshots.find(({ m }) => !m.cards?.length || !m.mainCards?.length);
        if (empty) throw new Error(empty.p.name + '缺少详情图或主图，请先完成编排');
      }
      const destination = await chooseOutput(); if (!destination) return;
      let completed = 0;
      const total = snapshots.reduce((n, item) => n + ((scope !== 'detail' ? item.m.mainCards.length * 2 : 0) + (scope !== 'main' ? item.m.cards.length : 0)), 0);
      for (const { p, m } of snapshots) {
        const overlays = {};
        if (scope !== 'detail') { for (const card of m.mainCards) for (const format of ['800', '750']) overlays[`${card.id}:${format}`] = await exportMainOverlay(card, format); }
        if (scope !== 'main') for (const card of m.cards) { const asset = p.assets.find(a => a.id === card.imageIds[0]); const overlay = await exportOverlay(card, asset); if (overlay) overlays[card.id] = overlay; }
        const { id: jobId } = await api('/export', { destination, scope, projects: [{ id: p.id, model: m, overlays }] });
        for (;;) {
          const job = await api('/jobs/' + jobId);
          setBusy({ type: 'export', label: `导出 ${completed + job.processed} / ${total}`, progress: (completed + job.processed) / total });
          if (job.status === 'failed') throw new Error(job.error);
          if (job.status === 'done') break;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        completed += (scope !== 'detail' ? m.mainCards.length * 2 : 0) + (scope !== 'main' ? m.cards.length : 0);
      }
      notify(`已导出 ${completed} 张图片至 ${destination}，按产品文件夹归档`);
    } catch (e) { onError(e); } finally { setBusy(null); }
  };
  const resolve = async () => {
    try {
      await flush();
      const p = await api(`/projects/${project.id}/resolve`, { groupId: group.id, keep: [...keep] });
      setProject(p); setModel(p.model); setDirty(previous => new Set(previous).add(p.id)); await refreshList();
      if (!p.groups.some(g => !g.resolved)) { setDuplicateOpen(false); notify('重复候选已整理，原图保持完整'); }
    } catch (e) { onError(e); }
  };
  const pick = useCallback((cardId, slot) => setPicker({ cardId, slot, scope: 'detail' }), []);
  const addCard = type => changeModel(current => {
    const card = newCard(type, assets.map(a => a.id), current.cards.length);
    const names = new Set(current.cards.map(c => c.name)); let index = current.cards.length + 1;
    while (names.has(String(index).padStart(2, '0'))) index++;
    card.name = String(index).padStart(2, '0');
    return { ...current, cards: [...current.cards, card] };
  });
  const unresolved = project?.groups.filter(g => !g.resolved).length ?? 0;
  const saved = pageScope === 'main' ? model?.mainSaved : (model?.detailSaved ?? (project?.saved && !dirty.has(project.id)));
  const activeCards = pageScope === 'main' ? model?.mainCards || [] : model?.cards || [];
  const switchScope = scope => { setPageScope(scope); if (scope === 'main' && !latest.current.model.mainInitialized && !latest.current.model.mainCards?.length) changeModel(current => ({ ...current, mainInitialized: true, mainCards: createMainCards(allAssets.map(a => a.id), current.copy, logo) })); };
  const changeMainCard = (card, format = mainFormat) => changeModel(current => ({ ...current, mainCards: (current.mainCards || []).map(c => c.id === card.id ? applyMainEdit(c, card, format) : c) }));
  const addMainCard = kind => changeModel(current => { const cards = current.mainCards || [], card = newMainCard(kind, allAssets.map(a => a.id), cards.length, current.copy, logo); let index = cards.length + 1; while (cards.some(c => c.name === String(index).padStart(2, '0'))) index++; card.name = String(index).padStart(2, '0'); return { ...current, mainCards: [...cards, card] }; });
  const cutoutMain = async cardId => {
    const initial = latest.current, format = mainFormat, sourceCard = initial.model.mainCards.find(c => c.id === cardId), card = sourceCard && renderSpec(sourceCard, format);
    if (!card) return;
    try {
      setBusy({ type: 'cutout', label: '后台抠图中…' });
      const result = await api(`/projects/${initial.project.id}/cutout`, { assetId: card.imageId });
      const jobId = result.id || result.jobId;
      for (;;) { const job = await api('/jobs/' + jobId); if (job.status === 'failed') throw new Error(job.error); if (job.status === 'done') break; await new Promise(resolve => setTimeout(resolve, 450)); }
      const updated = await api('/projects/' + initial.project.id);
      if (latest.current.project?.id === initial.project.id) { const current = latest.current; latest.current = { project: updated, model: current.model }; setProject(updated); const baseCard = current.model.mainCards.find(c => c.id === cardId), currentCard = baseCard && renderSpec(baseCard, format); if (currentCard?.imageId === card.imageId && updated.assets.find(a => a.id === card.imageId)?.cutoutUrl) changeMainCard({ ...currentCard, useCutout: true }, format); }
      notify('抠图已完成，可在白底图选图中查看结果；原图保留');
    } catch (e) { onError(e); } finally { setBusy(null); }
  };
  const cutoutDetail = async (cardId, slot) => {
    const initial = latest.current, card = initial.model.cards.find(c => c.id === cardId), assetId = card?.imageIds[slot];
    if (!assetId || slot < 1) return;
    try {
      setBusy({ type: 'cutout', label: '搭配商品抠图中…' });
      const { id } = await api(`/projects/${initial.project.id}/cutout`, { assetId });
      for (;;) { const job = await api('/jobs/' + id); if (job.status === 'failed') throw new Error(job.error); if (job.status === 'done') break; await new Promise(resolve => setTimeout(resolve, 450)); }
      const updated = await api('/projects/' + initial.project.id);
      if (latest.current.project?.id === initial.project.id) { const current = latest.current; latest.current = { project: updated, model: current.model }; setProject(updated); const target = current.model.cards.find(c => c.id === cardId); if (target?.imageIds[slot] === assetId) { const useCutouts = [...target.useCutouts]; useCutouts[slot] = true; changeCard({ ...target, useCutouts }); } }
      notify('抠图完成，可关闭使用抠图结果以恢复照片');
    } catch (error) { onError(error); } finally { setBusy(null); }
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Images size={19}/></span><div><strong>商品图工作台</strong><span>本地素材 · 批量出图</span></div></div>
      <div className="sidebar-head"><span>产品文件夹</span><span className="muted">{list.length}</span></div>
      <button className="add-folder" onClick={importFolders} disabled={!!busy}><FolderPlus size={16}/> 添加文件夹 <Plus size={14}/></button>
      <label className="search"><Search size={15}/><input aria-label="搜索文件夹" placeholder="搜索完整文件夹名称" value={search} onChange={event => setSearch(event.target.value)}/></label>
      <div className="selection-row"><label><input type="checkbox" checked={visible.length > 0 && visible.every(p => checked.has(p.id))} onChange={event => setChecked(previous => { const next = new Set(previous); visible.forEach(p => event.target.checked ? next.add(p.id) : next.delete(p.id)); return next; })}/> 全选</label><span>已选 {checked.size}</span></div>
      <nav className="folder-list" aria-label="产品文件夹">{visible.map(p => <div className={'folder-row ' + (project?.id === p.id ? 'selected' : '')} key={p.id}><input aria-label={`勾选${p.name}`} type="checkbox" checked={checked.has(p.id)} onChange={event => setChecked(previous => { const next = new Set(previous); event.target.checked ? next.add(p.id) : next.delete(p.id); return next; })}/><button onClick={() => openProject(p.id)}><Folder size={15}/><span><strong>{p.name}</strong><small>{p.status === 'processing' ? `处理 ${p.processed}/${p.total}` : `${p.count} 张素材`}{p.groups > 0 && ` · ${p.groups} 组待整理`}</small></span><i className={'status-dot ' + (p.saved && !dirty.has(p.id) ? 'green' : 'red')} title={p.saved && !dirty.has(p.id) ? '已保存' : '未保存'}/></button><div className="folder-tools"><button title="打开原素材文件夹" aria-label={`打开${p.name}文件夹`} onClick={async () => { try { await api(`/projects/${p.id}/open`, {}); } catch (e) { onError(e); } }}><FolderOpen size={14}/></button><button title="从工作台移除，原图保留" aria-label={`移除${p.name}`} disabled={p.status === 'processing' || !!busy} onClick={() => setRemoveTarget(p)}><Trash2 size={14}/></button></div></div>)}</nav>
      {!list.length && <p className="sidebar-empty">添加一个产品文件夹，<br/>或包含多个产品的总目录。</p>}
      <div className="sidebar-bottom"><div className="status-legend"><span><i className="status-dot green"/> 已保存</span><span><i className="status-dot red"/> 未保存</span></div><button className="batch-export" disabled={!checked.size || !!busy} onClick={() => exportProjects([...checked], 'all')}><Download size={16}/> 导出勾选产品 <span>{checked.size}</span></button><p>摄影原图只读 · 无需上传</p></div>
    </aside>
    <main className={pageScope === 'main' ? 'main-workspace' : ''}>
      <header className="workspace-header"><div><div className="breadcrumb">工作台 <span>/</span> {project ? '产品编辑' : '开始使用'}</div><h1>{project?.name || '把素材，变成成品。'}</h1></div><div className="header-state"><span className="local-indicator"/><span>本机处理</span></div></header>
      {project && model ? <>
        <section className="copy-panel"><div className="section-title"><div><Type size={16}/><strong>产品文案</strong><span>按卖点拆分，点击图片上方「T」自动填入</span></div><span className="copy-count">{splitCopy(model.copy).length} 段文案</span></div><textarea aria-label="产品整段文案" placeholder="粘贴这个产品的完整文案。每个卖点可换行；程序也会按句号、分号拆分。" value={model.copy} onChange={event => changeModel({ ...model, copy: event.target.value })}/><div className="copy-bottom"><span>图片内双击改字，拖动文字或 Logo 调整位置</span><label>统一字体：SourceHanSansCN-Bold</label><button className="text-button" onClick={async () => { try { const value = await api('/logo', {}); if (!value.canceled) { setLogo(value); notify('Logo已设置，点击卡片Logo按钮添加'); } } catch (e) { onError(e); } }}><ImagePlusIcon/> {logo ? '更换公共 Logo' : '设置公共 Logo'}</button></div></section>
        <div className="page-scope-tabs" role="group" aria-label="编辑页面"><button className={(model.detailSaved ?? project.saved) ? 'complete' : 'incomplete'} aria-pressed={pageScope === 'detail'} onClick={() => switchScope('detail')}>详情页<span>{(model.detailSaved ?? project.saved) ? '已保存' : '待保存'}</span></button><button className={model.mainSaved ? 'complete' : 'incomplete'} aria-pressed={pageScope === 'main'} onClick={() => switchScope('main')}>主图<span>{model.mainSaved ? '已保存' : '待保存'}</span></button></div>
        {pageScope === 'detail' ? <section className="gallery-section"><div className="gallery-heading"><div><h2>图片编排 <span>{model.cards.length}</span></h2><p>宽度 750 px · 单图1260高 · 组合1600高 · 搭配1000高 · 放大上限1.6倍</p></div><div className="gallery-actions"><button onClick={() => setSelectionOpen(true)}>分组选图</button>{unresolved > 0 && <button className="review-button" onClick={() => setDuplicateOpen(true)}><Images size={14}/> 整理重复图 <span>{unresolved}</span></button>}<button onClick={() => setIssues(true)} title="查看导入结果"><SlidersHorizontal size={15}/></button></div></div>
          {project.status === 'processing' && <div className="import-progress"><LoaderCircle className="spin" size={15}/><span>后台处理中 {project.processed} / {project.total}，已完成图片可预览</span><progress value={project.processed} max={project.total}/></div>}
          <div className="card-grid">{model.cards.map((card, index) => card.type === 'outfit' ? <OutfitCard key={card.id} card={card} assets={assets} index={index} onChange={changeCard} onDelete={deleteCard} onAddText={addText} onPick={pick} onCutout={cutoutDetail} busy={!!busy} onError={onError}/> : <Card key={card.id} card={card} assets={assets} index={index} onChange={changeCard} onDelete={deleteCard} onAddText={addText} onAddSubtitle={addSubtitle} firstSingle={card.id === model.cards.find(c => c.type === 'single')?.id} onAddLogo={addLogo} onPick={pick} onError={onError}/>)}</div>
          {!assets.length && project.status !== 'processing' && <div className="no-images"><AlertCircle size={24}/><p>没有可用的图片，请查看导入结果。</p><button onClick={() => setIssues(true)}>查看原因</button></div>}
          <div className="add-card-row"><button disabled={!assets.length || !!busy} onClick={() => addCard('single')}><Plus size={16}/><Image size={16}/> 新增单张大图</button><button disabled={!assets.length || !!busy} onClick={() => addCard('combo')}><Plus size={16}/><Images size={16}/> 新增三图组合</button><button disabled={!assets.length || !!busy} onClick={() => addCard('outfit')}><Plus size={16}/><Images size={16}/> 新增搭配推荐</button></div>
        </section> : <section className="gallery-section"><div className="gallery-heading"><div><h2>主图编排 <span>{activeCards.length}</span></h2><p>800同步到750 · 调整750不影响800</p></div><div className="main-format-tabs"><button aria-pressed={mainFormat === '800'} onClick={() => setMainFormat('800')}>800 × 800</button><button aria-pressed={mainFormat === '750'} onClick={() => setMainFormat('750')}>750 × 1000</button></div></div><div className="main-template-tabs" aria-label="主图模板">{activeCards.map((card,index) => <button key={card.id} aria-pressed={card.id === (activeCards.some(c=>c.id===activeMainId)?activeMainId:activeCards[0]?.id)} onClick={()=>setActiveMainId(card.id)}>{String(index+1).padStart(2,'0')} · {{hero:'首图',fabric:'面料卖点',color:'颜色展示',white:'白底商品'}[card.kind]}</button>)}</div><div className="main-editor-grid">{activeCards.filter(card => card.id === (activeCards.some(c=>c.id===activeMainId)?activeMainId:activeCards[0]?.id)).map(card => <MainCard key={card.id} card={renderSpec(card, mainFormat)} assets={allAssets} format={mainFormat} onChange={changeMainCard} onDelete={id => changeModel(current => ({ ...current, mainCards: current.mainCards.filter(c => c.id !== id) }))} onPick={id => setPicker({ cardId: id, scope: 'main', format: mainFormat })} onCutout={() => cutoutMain(card.id)} onError={onError} logo={logo}/>)}</div><div className="add-card-row">{[['hero', '首图'], ['fabric', '面料卖点'], ['color', '颜色展示'], ['white', '白底商品']].map(([kind, label]) => <button key={kind} disabled={!allAssets.length || !!busy || (!['color', 'white'].includes(kind) && activeCards.some(c => c.kind === kind))} onClick={() => addMainCard(kind)}><Plus size={14}/>{label}</button>)}</div></section>}
      </> : <section className="welcome"><div className="welcome-illustration"><FolderOpen size={52} strokeWidth={1.2}/><span><Images size={24}/></span></div><h2>从一个产品文件夹开始</h2><p>自动缩图、整理重复素材，<br/>把文案和 Logo 放进现成摄影图。</p><button className="primary" onClick={importFolders} disabled={!!busy}><FolderPlus size={17}/> 添加产品文件夹</button><div className="welcome-flow"><span>01 导入素材</span><span>02 图片编排</span><span>03 批量导出</span></div></section>}
      <footer className="workspace-footer"><div className="footer-info">{project && <span className={'save-state ' + (saved ? 'saved' : '')}>{saved ? <CheckCircle2 size={15}/> : <span className="status-dot red"/>}{saved ? '已保存' : '未保存'}</span>}<button className="output-path" title={output || '选择独立的成品保存目录'} onClick={() => chooseOutput().catch(onError)}><FolderOpen size={14}/>{output || '选择导出位置'}<ChevronDown size={13}/></button></div><div className="footer-actions">{busy && <span className="busy-label"><LoaderCircle size={14} className="spin"/>{busy.label}</span>}<button disabled={!project || !activeCards.length || !!busy || project?.status === 'processing'} onClick={save}><Save size={16}/> 保存</button><button className="primary" disabled={!project || !activeCards.length || !!busy || project?.status === 'processing'} onClick={() => exportProjects([project.id])}><Download size={16}/> 导出当前产品</button></div></footer>
    </main>
    {removeTarget && <Modal title="从工作台移除产品" subtitle={`${removeTarget.name}：只移除列表记录，原摄影文件保留。重新添加同一目录可恢复编辑记录。`} onClose={() => setRemoveTarget(null)}><div className="modal-footer"><button onClick={() => setRemoveTarget(null)}>取消</button><button onClick={removeProject}>确认移除</button></div></Modal>}
    {toast && <div className={'toast ' + (toast.error ? 'error' : '')} role="status">{toast.error ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}<span>{toast.message}</span><button aria-label="关闭通知" onClick={() => setToast(null)}><X size={14}/></button></div>}
    {selectionOpen && project && pageScope === 'detail' && <Selection key={project.id} project={project} selectedIds={model.selectedIds} onClose={() => setSelectionOpen(false)} onConfirm={ids => {
      const cards = ids.map((id, index) => { const old = model.cards.find(c => c.type === 'single' && c.imageIds[0] === id); return old ? { ...old, name: String(index + 1).padStart(2, '0') } : newCard('single', [id], index); });
      for (const card of model.cards.filter(c => c.type === 'combo' && c.imageIds.every(id => ids.includes(id)))) cards.push({ ...card, name: String(cards.length + 1).padStart(2, '0') });
      if (cards.length > 100) return notify('最多100个成品框，请减少所选图片或组合', true);
      changeModel({ ...model, cards, selectedIds: ids, selectionDone: true, auto: false }); setSelectionOpen(false); notify(`已选 ${ids.length} 张，已填入工作台`);
    }}/>}
    {zoom && <div className="lightbox" role="dialog" aria-label="图片放大查看" onClick={() => setZoom(null)}><button>关闭大图</button><img src={imageUrl(zoom.id)} alt={zoom.name}/></div>}
    {group && <Modal title={group.kind === 'exact' ? '选择要保留的重复图片' : '这些图片相似，请比较后保留'} subtitle="勾选保留项，其他项从工作素材中移除；摄影原图不会删除。相似图允许保留多张。" onClose={() => setDuplicateOpen(false)}><div className="selection-toolbar"><button onClick={() => setLargeCandidates(!largeCandidates)}>{largeCandidates ? '切换小图' : '切换大图'}</button></div><div className="duplicate-grid" style={{ gridTemplateColumns: largeCandidates ? 'repeat(2,minmax(0,1fr))' : undefined }}>{group.ids.map(id => { const a = project.assets.find(a => a.id === id); return a && <button className={'candidate ' + (keep.has(id) ? 'chosen' : '')} key={id} onClick={() => setKeep(previous => { if (group.kind === 'exact') return new Set([id]); const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; })}><img src={imageUrl(id, !largeCandidates)} alt={a.name} onClick={event => { event.stopPropagation(); setZoom(a); }}/><span>{a.name}</span><i>{keep.has(id) && <Check size={13}/>}</i></button>; })}</div><div className="modal-footer"><span>已选 {keep.size} 张 · 剩余 {unresolved} 组</span><button className="primary" disabled={!keep.size} onClick={resolve}>保留所选，处理下一组</button></div></Modal>}
    {picker && <Modal title="选择这个位置的图片" subtitle={`${(picker.scope === 'main' ? allAssets : assets).length} 张可用图片`} onClose={() => setPicker(null)}><div className="picker-grid">{(picker.scope === 'main' ? allAssets : assets).map(a => <button key={a.id} onClick={() => { if (picker.scope === 'main') { const baseCard = latest.current.model.mainCards.find(c => c.id === picker.cardId), card = baseCard && renderSpec(baseCard, picker.format); if (!card) return; changeMainCard({ ...card, imageId: a.id, useCutout: card.kind === 'white' && !!a.cutoutUrl, views: Object.fromEntries(Object.entries(card.views).map(([format, view]) => [format, { ...view, crop: { x: 0.5, y: 0.5, scale: 1 } }])) }, picker.format); setPicker(null); return; } const card = model.cards.find(c => c.id === picker.cardId); const ids = [...card.imageIds]; ids[picker.slot] = a.id; const crops = [...card.crops]; crops[picker.slot] = { x: 0.5, y: 0.5 }; const useCutouts = card.useCutouts ? [...card.useCutouts] : undefined; if (useCutouts) useCutouts[picker.slot] = false; changeCard({ ...card, imageIds: ids, crops, ...(useCutouts ? { useCutouts } : {}) }); setPicker(null); }}><img src={imageUrl(a.id, true)} alt={a.name}/><span>{a.name}</span></button>)}</div></Modal>}
    {exportWarning && <Modal title="部分页面尚未保存" subtitle="勾选导出会同时保存详情图和两种尺寸的主图。请先保存以下页面，再重新导出。" onClose={() => setExportWarning(null)}><div className="issues-list">{exportWarning.map((message, index) => <p key={index}>{message}</p>)}</div><div className="modal-footer"><span>本次尚未导出任何图片</span><button className="primary" onClick={() => setExportWarning(null)}>返回编辑</button></div></Modal>}
    {issues && <Modal title="导入与素材记录" subtitle="导入接受竖图、方图和横图；可以恢复之前排除的重复候选。" onClose={() => setIssues(false)}><div className="issue-summary"><span>{assets.length} 张可用</span><span>{project?.skipped.length ?? 0} 张跳过素材</span><span>{project?.errors.length ?? 0} 张读取失败</span></div><div className="issues-list">{project?.skipped.map((a, i) => <p key={'s' + i}><strong>{a.name}</strong><span>{a.reason}</span></p>)}{project?.errors.map((a, i) => <p key={'e' + i}><strong>{a.name}</strong><span>{a.message}</span></p>)}{!project?.errors.length && !project?.skipped.length && <p>所有素材已正常读取。</p>}</div><div className="modal-footer"><span>原图位于 {project?.source}</span><button onClick={async () => { try { await flush(); const p = await api(`/projects/${project.id}/restore`, {}); setProject(p); setModel(p.model); setDirty(previous => new Set(previous).add(p.id)); await refreshList(); setIssues(false); } catch (e) { onError(e); } }}><RotateCcw size={14}/> 恢复排除素材</button></div></Modal>}
  </div>;
}
function ImagePlusIcon() { return <Image size={13}/>; }
