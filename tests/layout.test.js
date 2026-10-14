import test from 'node:test';
import assert from 'node:assert/strict';
import { imageRect, validateModel } from '../shared/model.js';
test('image placement preserves cover default and allows zoom and exposed background', () => {
 assert.deepEqual(imageRect(750,1500,750,800,{x:.5,y:.5}),{left:0,top:-350,width:750,height:1500});
 assert.deepEqual(imageRect(750,1500,750,1500,{x:.5,y:.5,scale:.5,dx:.1,dy:0}),{left:263,top:375,width:375,height:750});
});
test('model rejects unsafe scale and invalid background color',()=>{
 const model={copy:'',cards:[{id:'one',type:'single',name:'01',imageIds:['a'],crops:[{x:.5,y:.5,scale:20}],background:'#ffffff'}]};
 assert.throws(()=>validateModel(model,['a']));
 model.cards[0].crops[0].scale=1;model.cards[0].background='bad';assert.throws(()=>validateModel(model,['a']));
});

test('exported single and combination retain background exposed by image transforms',async()=>{
 const fs=await import('node:fs/promises'), os=await import('node:os'), path=await import('node:path'), sharp=(await import('sharp')).default;
 const {renderCard}=await import('../server/render.js');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'layout-'));
 try {
 const file=path.join(root,'image.png');await sharp({create:{width:750,height:1500,channels:3,background:'#ff0000'}}).png().toFile(file);
 const asset={id:'a',width:750,height:1500};const store={available:()=>[asset],assetPath:()=>file};
 for(const type of ['single','combo']) {
 const card={type,imageIds:type==='single'?['a']:['a','a','a'],background:'#00ff00',crops:[{x:.5,y:.5,scale:.5},{x:.5,y:.5,scale:.25},{x:.5,y:.5,scale:.25}]};
 const out=await renderCard(store,{},card);const {data,info}=await sharp(out).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,750);assert.equal(info.height,type==='single'?1260:1600);if(type==='single'){assert.ok(data[0]>240&&data[1]>240&&data[2]>240);const edge=(80*750+375)*info.channels;assert.ok(data[edge+1]>240&&data[edge]<15);}else assert.ok(data[1]>240&&data[0]<15);
 const middle=((type==='single'?650:670)*750+375)*info.channels;assert.ok(data[middle]>240&&data[middle+1]<15);
 }
 } finally {await fs.rm(root,{recursive:true});}
});

test('reimport of changed source preserves selection with replacement asset id',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),sharp=(await import('sharp')).default;
 const {Store}=await import('../server/store.js');const {newCard}=await import('../shared/model.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'selection-reimport-'));
 try {const source=path.join(root,'source');await fs.mkdir(source);const file=path.join(source,'one.png');await sharp({create:{width:100,height:200,channels:3,background:'#ff0000'}}).png().toFile(file);
 const store=await new Store(path.join(root,'data')).init();const [p]=await store.importPaths([source]);await store.idle();const old=p.assets[0].id;await store.save(p.id,{copy:'',auto:false,selectedIds:[old],selectionDone:true,cards:[newCard('single',[old])]},true);
 await sharp({create:{width:100,height:201,channels:3,background:'#0000ff'}}).png().toFile(file);await store.importPaths([source]);await store.idle();assert.notEqual(p.assets[0].id,old);assert.deepEqual(p.model.selectedIds,[p.assets[0].id]);await store.save(p.id,p.model,true);
 }finally{await fs.rm(root,{recursive:true});}
});
