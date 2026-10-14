import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import sharp from 'sharp';
import { createFastCutout } from '../server/fast-cutout.js';
test('fast cutout reuses one session and changes only alpha at working resolution',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fast-cutout-'));try{const source=path.join(root,'source.png'),out=path.join(root,'out.png');await sharp({create:{width:1200,height:1500,channels:3,background:'#804020'}}).png().toFile(source);let loads=0,runs=0;
 const engine=createFastCutout('unused',{loadSession:async()=>{loads++;return {inputNames:['input'],outputNames:['output'],run:async feeds=>{runs++;assert.deepEqual(feeds.input.dims,[1,3,320,320]);const values=new Float32Array(320*320);for(let i=0;i<values.length;i++)values[i]=(i%320)>159?1:0;return {output:{data:values,dims:[1,1,320,320]}};}};}});
 await engine(source,out);await engine(source,out);assert.equal(loads,1);assert.equal(runs,2);const {data,info}=await sharp(out).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1200);assert.equal(info.height,1500);assert.equal(info.channels,4);assert.deepEqual([...data.slice(0,3)],[128,64,32]);assert.equal(data[3],0);assert.equal(data[(600*1200+1000)*4+3],255);
 }finally{await fs.rm(root,{recursive:true});}
});
test('cutout API uses working cache offline and reuses completed fast results',async()=>{
 const {startServer}=await import('../server/index.js');const root=await fs.mkdtemp(path.join(os.tmpdir(),'fast-cutout-api-'));let instance;try{const source=path.join(root,'source');await fs.mkdir(source);await sharp({create:{width:1200,height:1600,channels:3,background:'#ffffff'}}).jpeg().toFile(path.join(source,'one.jpg'));let calls=0;
 instance=await startServer({root:path.join(root,'data'),port:0,cutoutProcessor:async(input,output)=>{calls++;assert.ok(input.includes(path.join('data','media')));await sharp(input).ensureAlpha().png().toFile(output);}});const [p]=await instance.store.importPaths([source]);await instance.store.idle();await fs.rm(source,{recursive:true});let url;
 for(let i=0;i<2;i++){const response=await fetch(instance.url+'/api/projects/'+p.id+'/cutout',{method:'POST',headers:{'content-type':'application/json',origin:instance.url},body:JSON.stringify({assetId:p.assets[0].id})});assert.equal(response.status,200);const {id}=await response.json();await instance.waitJob(id);const job=instance.jobs.get(id);assert.equal(job.status,'done');if(url)assert.equal(url,job.cutoutUrl);url=job.cutoutUrl;}
 assert.equal(calls,1);assert.equal(p.assets[0].cutoutEngine,'silueta');
 }finally{if(instance)await instance.close();await fs.rm(root,{recursive:true});}
});
test('failed fast model loading can retry without keeping a rejected session',async()=>{
 let attempts=0;const engine=createFastCutout('unused',{loadSession:async()=>{attempts++;throw new Error('model unavailable');}});await assert.rejects(engine('unused','unused'),/model unavailable/);await assert.rejects(engine('unused','unused'),/model unavailable/);assert.equal(attempts,2);
});
test('missing Windows native runtime gives official setup instructions',async()=>{
 const engine=createFastCutout('unused',{platform:'win32',loadSession:async()=>{const error=new Error('The specified module could not be found');error.code='ERR_DLOPEN_FAILED';throw error;}});await assert.rejects(engine('unused','unused'),/Visual C\+\+ x64.*https:\/\/aka.ms\/vc14\/vc_redist.x64.exe/);
});
