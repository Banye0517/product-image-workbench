import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { Store } from '../server/store.js';
test('imports all orientations and scopes saved states independently', async () => {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'main-server-'));try {
 const source=path.join(root,'source');await fs.mkdir(source);
 for(const [name,width,height] of [['square',100,100],['wide',150,100],['portrait',100,150]]) await sharp({create:{width,height,channels:3,background:'#123456'}}).png().toFile(path.join(source,name+'.png'));
 const store=await new Store(path.join(root,'data')).init();const [p]=await store.importPaths([source]);await store.idle();assert.equal(p.assets.length,3);assert.equal(p.skipped.length,0);
 await store.save(p.id,p.model,true,'detail');assert.equal(p.detailSaved,true);assert.equal(p.mainSaved,false);
 await store.save(p.id,p.model,true,'main');assert.equal(p.mainSaved,true);assert.equal(p.detailSaved,true);
 await store.save(p.id,{...p.model,copy:'new'},false,'main');assert.equal(p.mainSaved,false);assert.equal(p.detailSaved,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('main export writes both fixed formats and refuses untreated white photos', async () => {
 const {startServer}=await import('../server/index.js'),{newMainCard}=await import('../shared/main-model.js');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'main-export-'));let server;try{
 const source=path.join(root,'source');await fs.mkdir(source);await sharp({create:{width:200,height:300,channels:3,background:'#bb9944'}}).png().toFile(path.join(source,'one.png'));
 server=await startServer({root:path.join(root,'data'),port:0});const [p]=await server.store.importPaths([source]);await server.store.idle();
 const card=newMainCard('color',[p.assets[0].id]);p.model.mainCards=[card];const overlays={};for(const [f,w,h] of [['800',800,800],['750',750,1000]])overlays[card.id+':'+f]='data:image/png;base64,'+(await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).png().toBuffer()).toString('base64');
 const response=await fetch(server.url+'/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:'main',destination:path.join(root,'output'),projects:[{id:p.id,overlays}]})});assert.equal(response.status,200);const {id}=await response.json();await server.waitJob(id);assert.equal(server.jobs.get(id).status,'done');assert.equal(server.jobs.get(id).total,2);
 for(const [f,w,h] of [['800x800',800,800],['750x1000',750,1000]]){const m=await sharp(path.join(root,'output','source','主图',f,card.name+'.jpg')).metadata();assert.equal(m.width,w);assert.equal(m.height,h);}
 const {renderCard}=await import('../server/render.js');await assert.rejects(renderCard(server.store,p,newMainCard('white',[p.assets[0].id]),undefined,'800'),/抠图/);
 const white=newMainCard('white',[p.assets[0].id]),failedOutput=path.join(root,'failed-output');const rejected=await fetch(server.url+'/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:'main',destination:failedOutput,projects:[{id:p.id,model:{...p.model,mainCards:[white]},overlays:{}}]})});assert.equal(rejected.status,400);assert.equal((await fs.readdir(failedOutput)).length,0);
 }finally{if(server)await server.close();await fs.rm(root,{recursive:true,force:true});}
});
test('transparent source receives alpha preserving preview and reimport keeps it', async () => {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'alpha-preview-'));try {
 const source=path.join(root,'source');await fs.mkdir(source);await sharp({create:{width:80,height:100,channels:4,background:'#00000000'}}).composite([{input:await sharp({create:{width:20,height:20,channels:4,background:'#ff0000'}}).png().toBuffer(),left:20,top:20}]).png().toFile(path.join(source,'alpha.png'));
 const store=await new Store(path.join(root,'data')).init();const [p]=await store.importPaths([source]);await store.idle();assert.ok(p.assets[0].alphaUrl);const m=await sharp(path.join(store.root,'media',path.basename(p.assets[0].alphaUrl))).metadata();assert.equal(m.hasAlpha,true);assert.equal(m.width,p.assets[0].alphaWidth);
 await store.importPaths([source]);await store.idle();assert.ok(p.assets[0].alphaUrl);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('duplicate replacement resets cutout choice and restore clears both saved states', async () => {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'duplicate-main-'));try {
 const source=path.join(root,'source');await fs.mkdir(source);await sharp({create:{width:60,height:100,channels:3,background:'#123456'}}).png().toFile(path.join(source,'a.png'));await fs.copyFile(path.join(source,'a.png'),path.join(source,'b.png'));
 const store=await new Store(path.join(root,'data')).init();const [p]=await store.importPaths([source]);await store.idle();p.model.mainCards=[{imageId:p.assets[1].id,useCutout:true}];await store.resolve(p.id,p.groups[0].id,[p.assets[0].id]);assert.equal(p.model.mainCards[0].useCutout,false);p.mainSaved=true;p.detailSaved=true;await store.restore(p.id);assert.equal(p.mainSaved,false);assert.equal(p.detailSaved,false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
