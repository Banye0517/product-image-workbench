import {safeName,splitCopy} from './model.js';
export const MAIN_KINDS = ['hero','fabric','color','white'];
export const MAIN_LABELS = {hero:'首图',fabric:'面料卖点图',color:'颜色展示图',white:'白底商品图'};
export const MAIN_ICONS = [
 {id:'antibacterial',name:'5A抗菌',file:'antibacterial.png'},
 {id:'water',name:'防泼水',file:'water.png'}, {id:'skin',name:'保暖亲肤',file:'skin.png'},
 {id:'stain',name:'拒污防水',file:'stain.png'}, {id:'a-class',name:'A类面料',file:'a-class.png'},
 {id:'static',name:'抗静电',file:'static.png'}, {id:'soft',name:'柔软舒适',file:'soft.png'}
];
export function mainLayout(kind,format='800') {
 const tall=String(format)==='750',width=tall?750:800,height=tall?1000:800;
 return {width,height,boxes:[kind==='fabric'?{left:tall?30:28,top:tall?344:226,width:tall?690:744,height:tall?605:530,radius:20}:{left:0,top:0,width,height,radius:0}],contain:kind==='white'};
}
function elements(format,kind) {
 const tall=format==='750';
 return {logo:{x:56,y:tall?58:43,width:240},text1:{x:kind==='fabric'?(tall?52:38):50,y:kind==='fabric'?(tall?156:139):(tall?237:168),width:kind==='fabric'?(tall?655:724):325},text2:{x:110,y:tall?365:280,width:285},tag:kind==='hero'?{x:56,y:tall?476:384,width:tall?321:294,height:tall?71:65}:{x:tall?526:551,y:tall?866:666,width:183,height:53},icons:{x:56,y:tall?616:513,width:tall?98:89,gap:tall?28:27},gradient:{x:0,y:0,width:tall?420:450,height:tall?1000:800}};
}
export function newMainCard(kind,ids,index=0,copy='',logo={url:'/brand-logo.png',ratio:65/299}) {
 const parts=splitCopy(copy);
 return {id:globalThis.crypto.randomUUID(),kind,name:String(index+1).padStart(2,'0'),imageId:ids[index%ids.length],background:kind==='fabric'?'#eeeeee':'#ffffff',logo:{...logo,width:240},text1:{text:kind==='hero'?(parts[0]??''):kind==='fabric'?(parts[3]??parts[0]??''):'',size:kind==='hero'?110:56,color:'#111111'},text2:{text:kind==='hero'?(parts[1]??''):'',size:80,color:'#111111'},tag:{text:kind==='hero'?(parts[2]??''):'',size:kind==='hero'?36:30,color:'#111111'},tagColor:'#007ab0',icons:[],gradient:{enabled:false,color:'#dddddd',width:450,opacity:1},views:{'800':{crop:{x:.5,y:.5,scale:1},elements:elements('800',kind)},'750':{crop:{x:.5,y:.5,scale:1},elements:elements('750',kind)}}};
}
export function createMainCards(ids,copy='',logo) {return ids.length?MAIN_KINDS.map((kind,i)=>newMainCard(kind,ids,i,copy,logo)):[];}
const CONTENT_KEYS = ['imageId','useCutout','background','logo','text1','text2','tag','tagColor','icons','gradient'];
export function renderSpec(card,format='800') {const view=card.views[String(format)];return {...card,...(String(format)==='750'?view.content:{}),crop:view.crop,elements:view.elements};}
export function applyMainEdit(card, next, format='800') {
 const f=String(format), previous=renderSpec(card,f), result={...card,name:next.name,views:{...card.views}}, changed={};
 for(const key of CONTENT_KEYS)if(JSON.stringify(previous[key])!==JSON.stringify(next[key]))changed[key]=structuredClone(next[key]);
 if(f==='750') result.views['750']={...card.views['750'],content:{...card.views['750'].content,...changed}};
 else {
  Object.assign(result,changed);
  const content={...card.views['750'].content};
  for(const key of Object.keys(changed)){
   const value=changed[key],old=card[key];
   if(value&&old&&content[key]&&typeof value==='object'&&!Array.isArray(value)){
    content[key]={...content[key]};
    for(const prop of Object.keys(value))if(JSON.stringify(old[prop])!==JSON.stringify(value[prop]))content[key][prop]=structuredClone(value[prop]);
    if(JSON.stringify(content[key])===JSON.stringify(value))delete content[key];
   }else delete content[key];
  }
  result.views['750']={...card.views['750'],content};
 }
 const view=next.views[f],before=card.views[f];
 if(changed.imageId!==undefined||JSON.stringify(view.crop)!==JSON.stringify(before.crop)) {
  result.views[f]={...result.views[f],crop:structuredClone(view.crop)};
  if(f==='800'){
   const crop={...result.views['750'].crop},defaults={x:.5,y:.5,scale:1,dx:0,dy:0};
   if(changed.imageId!==undefined)Object.assign(crop,defaults,view.crop);
   else for(const prop of Object.keys(defaults))if((view.crop[prop]??defaults[prop])!==(before.crop[prop]??defaults[prop]))crop[prop]=view.crop[prop]??defaults[prop];
   result.views['750']={...result.views['750'],crop};
  }
 }
 const edited={...before.elements};
 for(const key of Object.keys(before.elements))if(JSON.stringify(view.elements[key])!==JSON.stringify(before.elements[key])){
  edited[key]=structuredClone(view.elements[key]);
  if(f==='800'){
   const a=elements('800',card.kind)[key],b=elements('750',card.kind)[key],mapped={...result.views['750'].elements[key]};
   for(const [prop,value]of Object.entries(view.elements[key]))if(value!==before.elements[key][prop])mapped[prop]=(b[prop]??0)+(value-(a[prop]??0))*(prop==='y'||prop==='height'?1.25:750/800);
   result.views['750']={...result.views['750'],elements:{...result.views['750'].elements,[key]:mapped}};
  }
 }
 result.views[f]={...result.views[f],elements:edited};
 return result;
}
const color=value=>/^#[0-9a-f]{6}$/i.test(value);
function validateAppearance(c,available) {
  if(!available.includes(c.imageId))throw new Error('主图素材不存在或被排除');
  if(!color(c.background)||!color(c.tagColor)||!color(c.gradient?.color))throw new Error('主图颜色不合法');
  if(!Array.isArray(c.icons)||c.icons.length>3||new Set(c.icons).size!==c.icons.length||c.icons.some(id=>!MAIN_ICONS.some(i=>i.id===id)))throw new Error('最多选择3个有效icon');
  for(const k of ['text1','text2','tag'])if(typeof c[k]?.text!=='string'||c[k].text.length>2000||!Number.isFinite(c[k].size)||c[k].size<8||c[k].size>180||!color(c[k].color))throw new Error('主图文字或字号不合法');
  if(!Number.isFinite(c.gradient.width)||c.gradient.width<1||c.gradient.width>800||!Number.isFinite(c.gradient.opacity)||c.gradient.opacity<0||c.gradient.opacity>1)throw new Error('渐变大小或透明度不合法');
  if(c.logo&&(!Number.isFinite(c.logo.width)||c.logo.width<20||c.logo.width>750||!Number.isFinite(c.logo.ratio)||c.logo.ratio<=0||c.logo.ratio>10||!/^\/(brand-logo\.png|media\/[a-f0-9-]{36}\.png)$/.test(c.logo.url)))throw new Error('主图Logo不合法');
}
export function validateMainCards(cards=[],available=[]) {
 if(!Array.isArray(cards)||cards.length>100)throw new Error('主图数量不合法');
 const ids=new Set(),names=new Set(),unique=new Set();
 for(const c of cards){
  if(!MAIN_KINDS.includes(c.kind)||typeof c.id!=='string'||ids.has(c.id))throw new Error('主图类型或标识不合法');ids.add(c.id);
  if(!['color','white'].includes(c.kind)&&unique.has(c.kind))throw new Error('此主图模板只能有一张');unique.add(c.kind);
  const name=safeName(c.name).toLowerCase();if(names.has(name))throw new Error('主图文件名重复');names.add(name);
  const override=c.views?.['750']?.content;
  if(override!==undefined&&(!override||typeof override!=='object'||Array.isArray(override)||Object.keys(override).some(key=>!CONTENT_KEYS.includes(key))))throw new Error('750主图独立内容不合法');
  for(const content of [c,renderSpec(c,'750')])validateAppearance(content,available);
  for(const f of ['800','750']){
   const v=c.views?.[f],r=v?.crop;
   if(!r||[r.x,r.y].some(n=>!Number.isFinite(n)||n<0||n>1)||!Number.isFinite(r.scale)||r.scale<.25||r.scale>1.6||[r.dx??0,r.dy??0].some(n=>!Number.isFinite(n)||Math.abs(n)>3))throw new Error('主图图片位置不合法');
   for(const key of ['logo','text1','text2','tag','icons','gradient']){const p=v.elements?.[key];if(!p||[p.x,p.y,p.width,p.height??1,p.gap??0].some(n=>!Number.isFinite(n)||Math.abs(n)>3000)||p.width<=0)throw new Error('主图图层位置不合法');}
  }
 }
 return cards;
}
