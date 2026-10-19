import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/components/honors-confetti.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function confetti({champion=true,reduced=false,origin=null}={}){
 const frames=new Map(),listeners=new Map(),positions=[];let frameId=0,effect,completed=0;
 const ctx={scale(){},clearRect(){},save(){},restore(){},translate(x,y){positions.push({x,y});},rotate(){},fillRect(){}};
 const exports={};
 vm.runInNewContext(code,{exports,require(name){
  if(name==='react')return {useRef:()=>({current:{getContext:()=>ctx}}),useEffect:fn=>{effect=fn;}};
  if(name==='react/jsx-runtime')return {jsx:()=>null};
  throw Error(name);
 },window:{innerWidth:390,innerHeight:844,devicePixelRatio:2,matchMedia:()=>({matches:reduced}),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)});
 exports.HonorsConfetti({burst:1,champion,origin,onComplete:()=>completed++});
 const cleanup=effect();
 return {positions,step(time){const work=[...frames.values()];frames.clear();work.forEach(fn=>fn(time));},cleanup,resize(){listeners.get('resize')?.();},get completed(){return completed;},get pending(){return frames.size;}};
}
test('champion idle effects receive a completion signal only after the last confetti frame',()=>{
 const animation=confetti();animation.step(0);animation.step(5599);assert.equal(animation.completed,0);
 animation.step(5600);assert.equal(animation.completed,1);assert.equal(animation.pending,0);
 animation.resize();assert.equal(animation.completed,1);animation.cleanup();
});
test('reset or switching tables cancels pending completion so old effects cannot start',()=>{
 const animation=confetti();animation.step(0);animation.cleanup();animation.step(6000);
 assert.equal(animation.completed,0);assert.equal(animation.pending,0);
});
test('reduced motion completes without the particle loop and remains cancellable',()=>{
 const animation=confetti({reduced:true});assert.equal(animation.completed,0);animation.step(0);
 assert.equal(animation.completed,1);assert.equal(animation.pending,0);animation.cleanup();
 const canceled=confetti({reduced:true});canceled.cleanup();canceled.step(0);assert.equal(canceled.completed,0);
});

test('non-champion confetti starts at the supplied column, on either side of the viewport',()=>{
 for(const origin of [{x:72,y:510},{x:318,y:570}]){
  const animation=confetti({champion:false,origin});animation.step(0);
  assert.ok(animation.positions.length>0);
  assert.ok(animation.positions.every(p=>p.x===origin.x&&p.y===origin.y));
  animation.cleanup();
 }
});
