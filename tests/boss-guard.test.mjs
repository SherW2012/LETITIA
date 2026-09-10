import test from 'node:test';
import assert from 'node:assert/strict';
import { Guard } from '../dist/modules/boss-guard/tracker.js';
import { visionAsset } from '../worker/index.js';
const me={x:.28,y:.15,w:.45,h:.8,score:.9};
const other={x:.02,y:.1,w:.2,h:.65,score:.8};
test('ignore calibrated owner, confirm a newcomer, wait before restoring',()=>{
  const g=new Guard();g.calibrate(me,0);
  assert.equal(g.update([me],100).cover,false);
  assert.equal(g.update([me,other],200).cover,false);
  assert.equal(g.update([me,other],400).cover,true);
  assert.equal(g.update([me],500).cover,true);
  assert.equal(g.update([me],3400).cover,true);
  assert.equal(g.update([me],3500).cover,false);
});
test('one-frame false positive does not trigger',()=>{
  const g=new Guard();g.calibrate(me,0);
  g.update([me,other],100);
  assert.equal(g.update([me],250).cover,false);
});
test('owner disappearing does not hide the remaining stranger or recover cover',()=>{
  const g=new Guard();g.calibrate(me,0);
  g.update([other],200);
  assert.equal(g.update([other],400).cover,true);
  assert.equal(g.update([],800).cover,true);
  const result=g.update([],1600);
  assert.equal(result.state,'lost');
  assert.equal(g.update([me],8000).cover,true);
  g.calibrate(me,8100);assert.equal(g.update([me],8200).cover,false);
});
test('nearby smaller person is not adopted as owner',()=>{
  const g=new Guard();g.calibrate(me,0);
  const behind={...me,w:.2,h:.4};
  assert.equal(g.update([behind],200).ownerIndex,-1);
});
test('disappearance of other person for a short interval retains cover',()=>{
  const g=new Guard();g.calibrate(me,0);
  g.update([me,other],100);g.update([me,other],300);g.update([me],400);
  g.update([me,other],1200);g.update([me],1600);
  assert.equal(g.update([me],4500).cover,true);
  assert.equal(g.update([me],4600).cover,false);
});
test('model proxy only allows fixed assets and never forwards browser credentials',async()=>{
  let called=false;
  assert.equal((await visionAsset(new Request('https://site.test/models/arbitrary'),()=>{called=true;})).status,404);
  assert.equal(called,false);
  const response=await visionAsset(new Request('https://site.test/models/efficientdet-lite0.tflite',{headers:{Cookie:'private'}}),async(url,opts)=>{
    assert.equal(url,'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite');
    assert.equal(opts.headers,undefined);return new Response(new Uint8Array([1,2,3]));
  });
  assert.equal(response.headers.get('Content-Type'),'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
});
