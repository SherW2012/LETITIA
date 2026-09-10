import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowseWindow} from '../dist/modules/boss-guard/browse-window.js';
import {destination,DEFAULT_DESTINATION} from '../dist/modules/boss-guard/destination.js';
test('default Google Scholar and explicit web URLs only',()=>{
  assert.equal(destination(''),DEFAULT_DESTINATION);
  assert.equal(destination(' https://example.org/a?q=hello '),'https://example.org/a?q=hello');
  for(const value of ['javascript:alert(1)','data:text/html,hi','file:///tmp/a','https://user:secret@example.org','//example.org','not a url'])assert.throws(()=>destination(value));
});
test('navigation switches only the opened browser window and restores once',()=>{
  const visits=[];let opened=0;
  const handle={closed:false,focus(){},set location(url){visits.push(url);}};
  const browser=new BrowseWindow(()=>{opened++;return handle;});
  browser.start('https://reading.example/','https://scholar.google.com/');
  assert.equal(browser.switch(false),false);
  assert.equal(browser.switch(true),true);
  assert.equal(browser.switch(true),false);
  assert.equal(browser.switch(false),true);
  assert.deepEqual(visits,['https://reading.example/','https://scholar.google.com/','https://reading.example/']);
  browser.start('https://reading.example/','https://scholar.google.com/');assert.equal(opened,1);
});
test('popup blocking and COOP/closed handles report interruption',()=>{
  assert.throws(()=>new BrowseWindow(()=>null).start('https://a.test','https://b.test'),/拦截/);
  const handle={closed:false,focus(){}};
  const browser=new BrowseWindow(()=>handle);browser.start('https://a.test','https://b.test');
  handle.closed=true;assert.throws(()=>browser.switch(true),/摄像头仍开启/);
});
test('denied navigation does not claim a successful switch',()=>{
  let deny=false;
  const handle={closed:false,focus(){},set location(url){if(deny)throw new Error('blocked');}};
  const browser=new BrowseWindow(()=>handle);browser.start('https://a.test','https://b.test');deny=true;
  assert.throws(()=>browser.switch(true),/阻止/);assert.equal(browser.covered,false);
});
