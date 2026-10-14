import Konva from 'konva';
import {mainLayout,renderSpec,MAIN_ICONS} from '../shared/main-model';
import {loadImage} from './api';
export async function addMainOverlay(layer,card,format,handlers={}){
 card=renderSpec(card,format);
 const spec=renderSpec(card,format),{width,height}=mainLayout(card.kind,format),pos=spec.elements;
 await document.fonts.load('700 72px "SourceHanSansCN-Bold"');
 const movable=(node,key)=>{node.setAttr('editorKey',key);node.draggable(false);node.on('dragend',()=>handlers.onMove?.(key,{x:Math.max(0,Math.min(width-20,node.x())),y:Math.max(0,Math.min(height-20,node.y()))}));return node;};
 if(card.kind==='hero'&&card.gradient.enabled){
  const p=pos.gradient,w=card.gradient.width*width/800;
  layer.add(movable(new Konva.Rect({x:p.x,y:p.y,width:w,height:p.height,opacity:card.gradient.opacity,fillLinearGradientStartPoint:{x:0,y:0},fillLinearGradientEndPoint:{x:w,y:0},fillLinearGradientColorStops:[0,card.gradient.color,1,'rgba(255,255,255,0)']}),'gradient').listening(false));
 }
 if(card.logo){const p=pos.logo;const image=await loadImage(card.logo.url);layer.add(movable(new Konva.Image({image,x:p.x,y:p.y,width:card.logo.width,height:card.logo.width*card.logo.ratio}),'logo'));}
 for(const key of ['text1','text2']){
  if((card.kind!=='hero'&&!(card.kind==='fabric'&&key==='text1'))||!card[key].text)continue;
  const p=pos[key],t=card[key];layer.add(movable(new Konva.Text({x:p.x,y:p.y,width:p.width,text:t.text,fontSize:t.size,fontFamily:'SourceHanSansCN-Bold',fontStyle:'bold',fill:t.color,lineHeight:1.2,align:t.align??'left',visible:handlers.editing!==key}),key));
 }
 if(card.kind!=='fabric'&&card.tag.text){const p=pos.tag;const group=new Konva.Group({x:p.x,y:p.y});group.add(new Konva.Rect({width:p.width,height:p.height,cornerRadius:p.height/2,fill:card.tagColor}));group.add(new Konva.Text({width:p.width,height:p.height,text:card.tag.text,fontSize:card.tag.size,fontFamily:'SourceHanSansCN-Bold',fontStyle:'bold',fill:card.tag.color,align:'center',verticalAlign:'middle',padding:5,visible:handlers.editing!=='tag'}));layer.add(movable(group,'tag'));}
 if(card.kind==='hero'&&card.icons.length){const p=pos.icons;const group=new Konva.Group({x:p.x,y:p.y});for(const [i,id]of card.icons.entries()){const icon=MAIN_ICONS.find(v=>v.id===id),image=await loadImage('/main-icons/'+icon.file);group.add(new Konva.Image({image,x:i*(p.width+p.gap),width:p.width,height:p.width*image.naturalHeight/image.naturalWidth}));}layer.add(movable(group,'icons'));}
 layer.draw();
}
export async function exportMainOverlay(card,format){
 await document.fonts.ready;const {width,height}=mainLayout(card.kind,format),stage=new Konva.Stage({container:document.createElement('div'),width,height}),layer=new Konva.Layer();stage.add(layer);
 try{await addMainOverlay(layer,card,format);return stage.toDataURL({pixelRatio:1});}finally{stage.destroy();}
}
