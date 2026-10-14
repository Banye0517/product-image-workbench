import test from 'node:test';
import assert from 'node:assert/strict';
import {createMainCards,mainLayout,validateMainCards,renderSpec} from '../shared/main-model.js';
test('main images share content and keep independent crops in two fixed formats',()=>{
 const cards=createMainCards(['a','b'],'柔感。打底衫。幼童长袖T恤');
 assert.equal(cards.length,4);assert.ok(cards.every(c=>c.logo.url==='/brand-logo.png'));
 const c=cards[0];c.text1.text='changed';c.views['750'].crop.scale=1.4;
 assert.equal(renderSpec(c,'800').text1.text,'changed');assert.equal(renderSpec(c,'750').text1.text,'changed');
 assert.equal(renderSpec(c,'800').crop.scale,1);assert.equal(renderSpec(c,'750').crop.scale,1.4);
 assert.equal(mainLayout('fabric','800').boxes[0].height,530);
 assert.equal(mainLayout('hero','750').height,1000);
});
test('main images validate quantity, colors and maximum three icons',()=>{
 const cards=createMainCards(['a']);validateMainCards(cards,['a']);
 assert.throws(()=>validateMainCards([...cards,{...cards[0],id:'new',name:'new'}],['a']),/一张/);
 const clone=structuredClone(cards);clone[0].icons=['a-class','soft','water','static'];assert.throws(()=>validateMainCards(clone,['a']),/3/);
 clone[0].icons=[];clone[0].gradient.color='url(x)';assert.throws(()=>validateMainCards(clone,['a']),/颜色/);
});
test('main copy starts black and antibacterial icon participates in three icon limit',()=>{
 const cards=createMainCards(['a'],'柔软舒适');
 for(const c of cards)for(const key of ['text1','text2','tag'])assert.equal(c[key].color,'#111111');
 cards[0].icons=['antibacterial','water','soft'];assert.doesNotThrow(()=>validateMainCards(cards,['a']));cards[0].icons.push('skin');assert.throws(()=>validateMainCards(cards,['a']));
});
test('multiple white product cards keep separate photos and crops in both formats',()=>{
 const cards=createMainCards(['a','b']);const extra=structuredClone(cards[3]);extra.id='extra-white';extra.name='05';extra.imageId='b';extra.views['800'].crop.scale=1.4;cards.push(extra);
 assert.doesNotThrow(()=>validateMainCards(cards,['a','b']));assert.equal(cards.filter(c=>c.kind==='white').length,2);assert.equal(cards[3].views['800'].crop.scale,1);assert.equal(renderSpec(extra,'800').imageId,'b');assert.equal(renderSpec(extra,'750').imageId,'b');
});
