import test from 'node:test';
import assert from 'node:assert/strict';
import {snapRect,snapCrop} from '../shared/alignment.js';
import {imageRect} from '../shared/model.js';
test('near center snaps both axes, outside threshold hides guides and Alt disables snapping',()=>{
 const box={left:0,top:40,width:750,height:1220};
 const result=snapRect({left:272,top:605,width:200,height:100},box,6);
 assert.equal(result.left,275);assert.equal(result.top,600);assert.deepEqual(result.guides,{x:375,y:650});
 assert.deepEqual(snapRect({left:250,top:550,width:200,height:100},box,6).guides,{});
 const alt=snapRect({left:272,top:605,width:200,height:100},box,6,true);
 assert.equal(alt.left,272);assert.equal(alt.top,605);assert.deepEqual(alt.guides,{});
});
test('photo snaps within its own frame including contain images and preserves scale',()=>{
 for(const contain of [false,true]){
  const crop={x:.5,y:.5,scale:1.3,dx:.012,dy:-.012};
  const result=snapCrop(crop,1200,1800,353,353,contain,6);
  assert.equal(result.crop.scale,1.3);
  const scale=contain?Math.min(353/1200,353/1800)/Math.max(353/1200,353/1800)*.86:1;
  const rect=imageRect(1200,1800,353,353,{...result.crop,scale:1.3*scale});
  assert.ok(Math.abs(rect.left+rect.width/2-176.5)<=1);assert.ok(Math.abs(rect.top+rect.height/2-176.5)<=1);
  assert.deepEqual(result.guides,{x:176.5,y:176.5});
 }
});
