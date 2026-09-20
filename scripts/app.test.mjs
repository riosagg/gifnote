/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { conversionDuration, moveSelection } from '../src/time-range.ts';
import { inspectGif, limitGifDuration } from '../src/gif-info.ts';
import { Timeline } from '../src/timeline.ts';
import { MediaController } from '../src/media.ts';
import { ConversionEngine } from '../src/ffmpeg.ts';
import { revealProgress } from '../src/progress-view.ts';
import { dom, emit, settle } from './test-dom.mjs';

function gif(delays) {
  const header = [71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255];
  const image = [44,0,0,0,0,1,0,1,0,0,2,2,68,1,0];
  return new Uint8Array([...header, ...delays.flatMap(t => [33,249,4,0,t&255,t>>8,0,0,...image]),59]);
}

test('progress visibility: no movement when visible; smooth offscreen scroll; respect visual viewport and reduced motion', () => {
  const el=dom(); const panel=el('status-panel'); panel.hidden=false;
  window.innerHeight=800; window.matchMedia=()=>({matches:false});
  let rect={top:100,height:120}; const calls=[];
  panel.getBoundingClientRect=()=>rect;
  panel.scrollIntoView=options=>calls.push(options);
  revealProgress(panel); assert.equal(calls.length,0);
  rect={top:-140,height:120}; revealProgress(panel);
  assert.deepEqual(calls.pop(),{behavior:'smooth',block:'start'});
  rect={top:750,height:120}; revealProgress(panel);
  assert.deepEqual(calls.pop(),{behavior:'smooth',block:'start'});
  window.visualViewport={offsetTop:100,height:400};
  rect={top:50,height:120}; revealProgress(panel); assert.equal(calls.pop().behavior,'smooth');
  rect={top:100,height:600}; revealProgress(panel); assert.equal(calls.length,0);
  rect={top:-140,height:120}; window.matchMedia=()=>({matches:true});
  revealProgress(panel); assert.equal(calls.pop().behavior,'instant');
  panel.hidden=true; revealProgress(panel); assert.equal(calls.length,0);
});

test('selection move cases A/B/C/D and fractional source edges preserve length', () => {
  assert.deepEqual(moveSelection(40,55,10,120), { start:50,end:65 });
  assert.deepEqual(moveSelection(0,15,-10,120), { start:0,end:15 });
  assert.deepEqual(moveSelection(105,120,10,120), { start:105,end:120 });
  assert.deepEqual(moveSelection(40,48,10,120), { start:50,end:58 });
  for (const delta of [-100,0.123,100]) {
    const p=moveSelection(1.23,4.84,delta,6.27);
    assert.ok(p.start>=0 && p.end<=6.27+1e-12);
    assert.ok(Math.abs(p.end-p.start-3.61)<1e-12);
  }
  assert.equal(conversionDuration(40.8,55.80000000000001),15);
  assert.equal(conversionDuration(0,120),15);
  assert.equal(conversionDuration(0,14.3799),14.379);
  assert.throws(()=>conversionDuration(5,4));
});

test('pointer selection movement synchronizes controls and head; cancellation releases capture', () => {
  const el=dom(); const t=new Timeline(time=>t.setHead(time)); t.reset(120);
  el('end-number').value='55';emit(el('end-number'),'change');
  const track=el('selected-track');
  emit(track,'pointerdown',{button:0,pointerId:1,clientX:400});
  emit(track,'pointermove',{pointerId:2,clientX:700}); // unrelated pointer
  assert.equal(t.start,40);
  emit(track,'pointermove',{pointerId:1,clientX:500});
  assert.equal(t.start,50);assert.equal(t.end,65);
  for(const id of ['start-number','start-range','scrub'])assert.equal(Number(el(id).value),50);
  for(const id of ['end-number','end-range'])assert.equal(Number(el(id).value),65);
  assert.equal(el('selection-duration').textContent,'15.0秒 / 最大15秒');
  emit(track,'pointerup',{pointerId:1,clientX:500});assert.equal(track.capture.size,0);
  emit(track,'pointerdown',{button:0,pointerId:3,clientX:500});
  emit(track,'pointermove',{pointerId:3,clientX:5000});assert.equal(t.end,120);assert.equal(t.start,105);
  emit(track,'pointercancel',{pointerId:3});assert.equal(track.capture.size,0);
  emit(track,'keydown',{key:'Home'});assert.equal(t.start,0);assert.equal(t.end,15);
  el('end-range').value='8';emit(el('end-range'),'input');
  emit(track,'keydown',{key:'ArrowRight'});assert.equal(t.end-t.start,8);
  t.reset(4.84);assert.equal(el('end-range').value,el('end-range').max);
  t.reset(0);assert.equal(el('playhead').style.left,'0%');assert.equal(track.style.width,'0%');
});

test('GIF budget adjusts bytes, drops excess frames, avoids 1 tick and never stretches', () => {
  const source=gif([750,751]);
  assert.equal(inspectGif(source).duration,15.01);
  const fixed=limitGifDuration(source,15);
  assert.equal(inspectGif(fixed).duration,15);
  assert.equal(inspectGif(source).duration,15.01,'input is not mutated');
  assert.equal(inspectGif(limitGifDuration(gif([750,750,10]),15)).frames,2);
  assert.equal(inspectGif(limitGifDuration(gif([1499,10]),15)).duration,14.99);
  const short=gif([700,700]);assert.equal(limitGifDuration(short,15),short);
  assert.equal(inspectGif(limitGifDuration(gif([1000,500]),14.379)).duration,14.37);
});

test('real npm core reproduces 15.01s; full conversion pipeline stays within selection', async () => {
  const require=createRequire(import.meta.url);globalThis.self={location:{href:'http://localhost/ffmpeg-core.js'}};
  const core=await require('@ffmpeg/core')({wasmBinary:await readFile(new URL('../public/ffmpeg/ffmpeg-core.wasm',import.meta.url))});
  core.setLogger(()=>{});
  const run=(...args)=>{core.reset();const code=core.exec(...args);assert.equal(code,0);};
  run('-f','lavfi','-i','color=c=red:s=16x16:r=8','-t','15','-vf','fps=8','raw.gif');
  assert.equal(inspectGif(core.FS.readFile('raw.gif')).duration,15.01);
  const gifFile = new File([core.FS.readFile('raw.gif')], 'test.gif', {type:'image/gif'});
  run('-f','lavfi','-i','color=c=red:s=16x16:r=30','-t','16','-c:v','libx264','-pix_fmt','yuv420p','input-test.mp4');
  const file=new File([core.FS.readFile('input-test.mp4')],'test.mp4',{type:'video/mp4'});
  let terminated=0;
  const adapter={loaded:true,on(){},off(){},terminate(){terminated++;this.loaded=false;},
    async writeFile(p,b){core.FS.writeFile(p,b);},async readFile(p){return core.FS.readFile(p);},async deleteFile(p){core.FS.unlink(p);},
    async exec(args){for(let i=0;i<args.length;i++)if(args[i]==='-t')assert.ok(Number(args[i+1])<=15);core.reset();return core.exec(...args);}};
  for(const sourceFile of [file,gifFile]) for(const fps of [5,6,7,8,10]) for(const end of [15,14.37]) {
    adapter.loaded=true;
    const engine=new ConversionEngine();engine.engine=adapter;engine.load=async()=>adapter;
    const result=await engine.convert({file:sourceFile,isGif:sourceFile===gifFile,isStatic:false,start:0,end,crop:{x:0,y:0,width:16,height:16},settings:{width:620,fps,colors:128},upscale:false},()=>{});
    assert.ok(result.info.duration<=end && result.info.duration> end-0.3,`${fps} fps / ${end}: ${result.info.duration}`);
    const bytes=new Uint8Array(await result.blob.arrayBuffer());assert.equal(inspectGif(bytes).duration,result.info.duration);
    core.FS.writeFile('checked.gif',bytes);core.reset();core.ffprobe('-v','error','-show_entries','format=duration','-of','json','checked.gif','-o','probe.json');
    const probe=JSON.parse(core.FS.readFile('probe.json',{encoding:'utf8'}));assert.ok(Number(probe.format.duration)<=end);
    assert.throws(()=>core.FS.stat('output.gif'));assert.throws(()=>core.FS.stat(sourceFile===gifFile?'input.gif':'input.mp4'));
  }
  assert.equal(terminated,20);
});

test('media destroy releases URL, decoded GIF, dimensions and playback state', async () => {
  const el=dom();const m=new MediaController();const engine=new ConversionEngine();const signal=new AbortController().signal;
  const revoked=[];const revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
  try {
    await m.open(new File(['....ftyp........'],'a.mp4'),engine,()=>{},signal);
    m.seek(10);const url=el('video').src;m.destroy();
    assert.ok(revoked.includes(url));assert.equal(m.file,undefined);
    for(const key of ['duration','width','height','time'])assert.equal(m[key],0);
    await m.open(new File([gif([20,30])],'a.gif'),engine,()=>{},signal);
    assert.equal(m.isGif,true);m.destroy();assert.equal(m.isGif,false);assert.equal(el('gif-canvas').width,1);
  } finally {URL.revokeObjectURL=revoke;}
});

test('actual file handlers: video -> clear -> drop GIF, same GIF reselect, replace, result reset', async () => {
  const el=dom();const originalConvert=ConversionEngine.prototype.convert;let cancels=0;const originalCancel=ConversionEngine.prototype.cancel;
  ConversionEngine.prototype.cancel=function(){cancels++;return originalCancel.call(this);};
  ConversionEngine.prototype.convert=async(_request,status)=>{
    status('変換機能を準備しています…','準備中');
    status('GIFを作成しています…','変換中',20);
    return {blob:new Blob([gif([20,30])]),info:{width:1,height:1,duration:0.5,frames:2},settings:{fps:10,colors:128},adjusted:false};
  };
  let progressScrolls=0;
  window.innerHeight=800;
  el('status-panel').getBoundingClientRect=()=>({top:-200,height:100});
  el('status-panel').scrollIntoView=()=>{progressScrolls++;};
  const revoked=[];const revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>{revoked.push(url);revoke(url);};
  try {
    await import('../src/main.ts');
    const choose=async file=>{el('file-input').files=[file];el('file-input').value='chosen';emit(el('file-input'),'change');await settle();};
    await choose(new File(['....ftyp........'],'a.mp4'));assert.equal(el('editor').hidden,false);
    el('clear-file').click();assert.equal(el('editor').hidden,true);assert.equal(el('upload-section').hidden,false);assert.equal(el('drop-zone').disabled,false);
    assert.equal(el('file-input').value,'');assert.equal(el('file-name').textContent,'');assert.equal(el('end-range').value,'0');assert.ok(revoked.length);
    const file=new File([gif([20,30])],'a.gif');
    emit(document,'drop',{dataTransfer:{files:[file]}});await settle();assert.equal(el('file-name').textContent,'a.gif');assert.equal(el('editor').hidden,false);
    const preset=el('crop-presets').children.find(x=>x.dataset.ratio==='4:3');emit(el('crop-presets'),'click',{target:preset});el('upscale-crop').checked=true;
    el('convert').click();await settle();assert.equal(el('result').hidden,false);const resultURL=el('result-image').src;
    assert.equal(progressScrolls,1,'only the first conversion status may scroll');
    el('clear-file').click();assert.ok(revoked.includes(resultURL));assert.equal(el('result').hidden,true);assert.equal(el('result-stats').children.length,0);assert.equal(el('download').href,'');
    assert.equal(el('crop-overlay').hidden,true);assert.equal(el('upscale-crop').checked,false);assert.equal(el('status-panel').hidden,true);assert.equal(el('error').hidden,true);assert.equal(el('progress').value,0);
    await choose(file);assert.equal(el('file-name').textContent,'a.gif');assert.equal(el('file-input').value,'');
    const clicks=el('file-input').clicks;el('replace-file').click();assert.equal(el('file-input').clicks,clicks+1);
    await choose(new File(['....ftyp........'],'b.mp4'));assert.equal(el('file-name').textContent,'b.mp4');assert.equal(el('editor').hidden,false);
    el('clear-file').click();assert.ok(cancels>=3);
    // A canceled read finishing late must not clear the next file or its busy state.
    let finishRead;
    const pending=new File(['....ftyp........'],'pending.mp4');
    pending.slice=()=>({arrayBuffer:()=>new Promise(resolve=>{finishRead=resolve;})});
    await choose(pending);assert.equal(el('editor').disabled,true);
    el('clear-file').click();await choose(file);
    finishRead(new TextEncoder().encode('....ftyp........').buffer);await settle();
    assert.equal(el('file-name').textContent,'a.gif');assert.equal(el('editor').hidden,false);assert.equal(el('editor').disabled,false);
    el('clear-file').click();
  } finally {ConversionEngine.prototype.convert=originalConvert;ConversionEngine.prototype.cancel=originalCancel;URL.revokeObjectURL=revoke;}
});
