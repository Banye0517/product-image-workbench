import test from 'node:test';
import assert from 'node:assert/strict';
import { frameLayout, validateModel } from '../shared/model.js';
test('new frames use exact portrait dimensions, margins and radii',()=>{
 const single=frameLayout('single');assert.equal(single.height,1260);assert.deepEqual(single.boxes[0],{left:0,top:40,width:750,height:1220,radius:20});
 const combo=frameLayout('combo');assert.equal(combo.height,1600);assert.equal(combo.boxes[0].left,15);assert.equal(combo.boxes[2].left-combo.boxes[1].left-combo.boxes[1].width,15);assert.equal(1600-combo.boxes[2].top-combo.boxes[2].height,15);
});
test('scale above 1.6 is refused',()=>assert.throws(()=>validateModel({copy:'',cards:[{id:'a',name:'01',type:'single',imageIds:['a'],crops:[{x:.5,y:.5,scale:1.61}]}]},['a'])));

test('export uses working cache with original offline and preserves rounded corners and gaps',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),sharp=(await import('sharp')).default;
 const {renderCard}=await import('../server/render.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'original-export-'));
 try{const original=path.join(root,'original.png'),preview=path.join(root,'preview.png');
 await sharp({create:{width:2400,height:3600,channels:3,background:'#ff0000'}}).png().toFile(original);await sharp({create:{width:1200,height:1800,channels:3,background:'#0000ff'}}).png().toFile(preview);const stat=await fs.stat(original);
 const asset={id:'a',name:'original.png',bytes:stat.size,modified:stat.mtimeMs,width:1200,height:1800};const store={available:()=>[asset],assetPath:()=>preview};await fs.unlink(original);
 for(const type of ['single','combo']){const card={type,imageIds:type==='single'?['a']:['a','a','a'],background:'#00ff00',crops:[{x:.5,y:.5,scale:1.6}]};const {data,info}=await sharp(await renderCard(store,{source:root},card)).raw().toBuffer({resolveWithObject:true});const pixel=(x,y)=>[...data.slice((y*750+x)*info.channels,(y*750+x)*info.channels+3)];assert.equal(info.height,type==='single'?1260:1600);assert.ok(pixel(375,type==='single'?500:600)[2]>240);assert.ok(pixel(type==='single'?0:15,type==='single'?40:220)[1]>240);if(type==='combo')assert.ok(pixel(375,1300)[1]>240);}
 }finally{await fs.rm(root,{recursive:true});}
});

test('upgrading old preview keeps selected asset ids and exclusions',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),sharp=(await import('sharp')).default;const {Store}=await import('../server/store.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'preview-upgrade-'));
 try{const source=path.join(root,'source');await fs.mkdir(source);await sharp({create:{width:1800,height:2700,channels:3,background:'#ffaabb'}}).png().toFile(path.join(source,'one.png'));const data=path.join(root,'data');const store=await new Store(data).init();const [p]=await store.importPaths([source]);await store.idle();const id=p.assets[0].id;p.assets[0].width=750;p.assets[0].height=1125;p.assets[0].excluded=true;p.model.selectedIds=[];await store.persist();const next=await new Store(data).init();await next.idle();assert.equal(next.projects[0].assets[0].id,id);assert.equal(next.projects[0].assets[0].width,1200);assert.equal(next.projects[0].assets[0].excluded,true);assert.deepEqual(next.projects[0].model.selectedIds,[]);
 }finally{await fs.rm(root,{recursive:true});}
});

test('single image background stays inside rounded photo region and top remains white',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),sharp=(await import('sharp')).default,{renderCard}=await import('../server/render.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'single-margin-'));
 try{const file=path.join(root,'one.png');await sharp({create:{width:800,height:1200,channels:3,background:'#ff0000'}}).png().toFile(file);const asset={id:'a'},store={available:()=>[asset],assetPath:()=>file};
 const {data,info}=await sharp(await renderCard(store,{}, {type:'single',imageIds:['a'],background:'#00ff00',crops:[{x:.5,y:.5,scale:.25,dy:.2}]})).raw().toBuffer({resolveWithObject:true});const pixel=(x,y)=>[...data.slice((y*750+x)*info.channels,(y*750+x)*info.channels+3)];
 assert.ok(pixel(375,10).every(c=>c>245),'top must stay white');assert.ok(pixel(0,40).every(c=>c>240),'rounded corner must stay white');assert.ok(pixel(375,80)[1]>240&&pixel(375,80)[0]<20,'photo slot background must keep selected color');assert.equal(info.height,1260);
 }finally{await fs.rm(root,{recursive:true});}
});

test('detail vertical gradient stays below white margin and fades to original photo',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),sharp=(await import('sharp')).default,{renderCard}=await import('../server/render.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'detail-gradient-'));
 try{const file=path.join(root,'one.png');await sharp({create:{width:1200,height:1800,channels:3,background:'#ff0000'}}).png().toFile(file);const store={available:()=>[{id:'a'}],assetPath:()=>file};
 const {data,info}=await sharp(await renderCard(store,{}, {type:'single',imageIds:['a'],gradient:{enabled:true,color:'#0000ff',height:500}})).raw().toBuffer({resolveWithObject:true});const pixel=(x,y)=>[...data.slice((y*750+x)*info.channels,(y*750+x)*info.channels+3)];
 assert.ok(pixel(375,10).every(c=>c>245));assert.ok(pixel(375,45)[2]>230);assert.ok(pixel(375,600)[0]>240);assert.ok(pixel(0,40).every(c=>c>240));
 assert.throws(()=>validateModel({copy:'',cards:[{id:'a',name:'01',type:'single',imageIds:['a'],gradient:{enabled:true,color:'#ffffff',height:1221}}]},['a']));
 }finally{await fs.rm(root,{recursive:true});}
});
