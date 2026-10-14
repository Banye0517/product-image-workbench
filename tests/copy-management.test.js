import test from 'node:test';import assert from 'node:assert/strict';
import { defaultCopy, nextCopy } from '../shared/model.js';
test('main and subtitle defaults use requested sizes and centered positions',()=>{
 assert.equal(defaultCopy('main','卖点').size,72);assert.equal(defaultCopy('subtitle','品名').size,36);assert.equal(defaultCopy('subtitle','品名').align,'center');assert.equal(defaultCopy('main','卖点').y,150);
});

test('product removal hides record and preserves original, adding folder restores edits',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),sharp=(await import('sharp')).default;const {startServer}=await import('../server/index.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'product-management-'));let server;
 try{const source=path.join(root,'product');await fs.mkdir(source);await sharp({create:{width:100,height:150,channels:3,background:'#aabbcc'}}).png().toFile(path.join(source,'one.png'));let opened='';server=await startServer({root:path.join(root,'data'),port:0,openFolder:async value=>{opened=value;}});const [p]=await server.store.importPaths([source]);await server.store.idle();p.model.copy='保留的文案';await server.store.persist();const call=route=>fetch(server.url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal((await call('/api/projects/'+p.id+'/open')).status,200);assert.equal(opened,await fs.realpath(source));assert.equal((await call('/api/projects/'+p.id+'/archive')).status,200);assert.equal(server.store.summaries().length,0);assert.deepEqual(await fs.readdir(source),['one.png']);const [restored]=await server.store.importPaths([source]);await server.store.idle();assert.equal(restored.id,p.id);assert.equal(restored.model.copy,'保留的文案');assert.equal(server.store.summaries().length,1);
 }finally{if(server)await server.close();await fs.rm(root,{recursive:true});}
});

test('copy allocation cycles after all clauses are used and allows empty manual copy',()=>{
 const model={copy:'柔软舒适。轻盈透气。',cards:[]};
 for(const expected of ['柔软舒适','轻盈透气','柔软舒适','轻盈透气']){const text=nextCopy(model,'main');assert.equal(text.value,expected);model.cards.push({text});}
 const empty=nextCopy({copy:'',cards:[]},'main');assert.equal(empty.value,'');assert.equal(empty.source,undefined);assert.equal(empty.size,72);
 const subtitle=nextCopy(model,'subtitle');assert.equal(subtitle.value,'柔软舒适');assert.equal(subtitle.size,36);
});
