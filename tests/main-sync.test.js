import test from 'node:test';
import assert from 'node:assert/strict';
import {newMainCard,renderSpec,applyMainEdit,validateMainCards} from '../shared/main-model.js';
test('750 edits never change 800 photo, copy, size, logo, colors or layout',()=>{
 const base=newMainCard('hero',['a','b'],0,'原文。副文。标签');
 const before=structuredClone(renderSpec(base,'800'));
 const next=structuredClone(renderSpec(base,'750'));next.imageId='b';next.text1={...next.text1,text:'750文案',size:42};next.logo.width=180;next.background='#ffffff';next.icons=['soft'];next.views['750'].crop.scale=1.4;next.views['750'].elements.text1.x=130;
 const edited=applyMainEdit(base,next,'750');
 assert.deepEqual(renderSpec(edited,'800').text1,before.text1);assert.deepEqual(renderSpec(edited,'800').logo,before.logo);assert.equal(renderSpec(edited,'800').imageId,'a');assert.deepEqual(renderSpec(edited,'800').elements,before.elements);assert.equal(renderSpec(edited,'800').crop.scale,1);
 assert.equal(renderSpec(edited,'750').text1.size,42);assert.equal(renderSpec(edited,'750').imageId,'b');assert.equal(renderSpec(edited,'750').crop.scale,1.4);assert.equal(renderSpec(edited,'750').logo.width,180);assert.doesNotThrow(()=>validateMainCards([edited],['a','b']));
 const restored=JSON.parse(JSON.stringify(edited));assert.equal(renderSpec(restored,'750').text1.text,'750文案');
});
test('800 edits sync only changed fields forward and adapt position without backflow',()=>{
 let c=newMainCard('hero',['a','b'],0,'原文');let v=structuredClone(renderSpec(c,'750'));v.text1.text='竖版';v.text1.size=48;v.tag.text='竖版标签';c=applyMainEdit(c,v,'750');
 const next=structuredClone(renderSpec(c,'800'));next.text1.text='新版';next.views['800'].elements.text1.x+=80;next.views['800'].crop.scale=1.2;
 const edited=applyMainEdit(c,next,'800');assert.equal(renderSpec(edited,'750').text1.text,'新版');assert.equal(renderSpec(edited,'750').text1.size,48);assert.equal(renderSpec(edited,'750').tag.text,'竖版标签');assert.equal(renderSpec(edited,'750').elements.text1.x,125);assert.equal(renderSpec(edited,'750').crop.scale,1.2);
});
test('750 invalid asset or size is rejected and legacy cards still render both sizes',()=>{
 const c=newMainCard('hero',['a']);assert.equal(renderSpec(c,'750').imageId,'a');const next=structuredClone(renderSpec(c,'750'));next.imageId='missing';const bad=applyMainEdit(c,next,'750');assert.throws(()=>validateMainCards([bad],['a']));next.imageId='a';next.text1.size=999;assert.throws(()=>validateMainCards([applyMainEdit(c,next,'750')],['a']));
});
test('export renders each format with its own selected working-cache photo',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),{default:sharp}=await import('sharp'),{renderCard}=await import('../server/render.js');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'main-one-way-'));
 try{
  for(const [id,color]of [['a','#ff0000'],['b','#0000ff']])await sharp({create:{width:1200,height:1200,channels:3,background:color}}).jpeg().toFile(path.join(root,id+'.jpg'));
  const base=newMainCard('color',['a','b']),next=structuredClone(renderSpec(base,'750'));next.imageId='b';const card=applyMainEdit(base,next,'750');
  const store={available:()=>[{id:'a'},{id:'b'}],assetPath:id=>path.join(root,id+'.jpg')};
  for(const [format,width,height,channel]of [['800',800,800,0],['750',750,1000,2]]){
   const {data,info}=await sharp(await renderCard(store,{},card,undefined,format)).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,width);assert.equal(info.height,height);const at=((height/2)*width+width/2)*info.channels;assert.ok(data[at+channel]>240);
  }
 }finally{await fs.rm(root,{recursive:true});}
});
test('800 scale changes retain independent 750 offsets',()=>{
 let card=newMainCard('hero',['a']);let next=structuredClone(renderSpec(card,'750'));next.views['750'].crop.dx=.3;card=applyMainEdit(card,next,'750');next=structuredClone(renderSpec(card,'800'));next.views['800'].crop.scale=1.2;card=applyMainEdit(card,next,'800');assert.equal(renderSpec(card,'750').crop.dx,.3);assert.equal(renderSpec(card,'750').crop.scale,1.2);
});
test('duplicate resolution replaces an excluded independent 750 photo',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),{default:sharp}=await import('sharp'),{Store}=await import('../server/store.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'main-independent-duplicate-'));
 try{
  const source=path.join(root,'source');await fs.mkdir(source);const image=await sharp({create:{width:100,height:150,channels:3,background:'#ff0000'}}).jpeg().toBuffer();await fs.writeFile(path.join(source,'a.jpg'),image);await fs.writeFile(path.join(source,'b.jpg'),image);const store=await new Store(path.join(root,'data')).init();const [p]=await store.importPaths([source]);await store.idle();const ids=p.assets.map(a=>a.id);let card=newMainCard('hero',ids);const next=structuredClone(renderSpec(card,'750'));next.imageId=ids[1];card=applyMainEdit(card,next,'750');p.model.mainCards=[card];await store.resolve(p.id,p.groups[0].id,[ids[0]]);assert.equal(renderSpec(p.model.mainCards[0],'750').imageId,ids[0]);assert.doesNotThrow(()=>validateMainCards(p.model.mainCards,[ids[0]]));
 }finally{await fs.rm(root,{recursive:true});}
});
