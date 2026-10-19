import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/components/honors-page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({decline=false,unsupported=false}={}){
 const states=[],refs=[],listeners=new Map();let stateIndex=0,refIndex=0,firstEffect,requests=0,exits=0;
 const document={fullscreenElement:null,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),exitFullscreen:async()=>{exits++;document.fullscreenElement=null;listeners.get('fullscreenchange')?.();}};
 const node=unsupported?{}:{requestFullscreen:async()=>{requests++;if(decline)throw Error('Denied');document.fullscreenElement=node;listeners.get('fullscreenchange')?.();}};
 const api={},jsx=(type,props)=>({type,props});
 vm.runInNewContext(code,{exports:api,document,require(name){
  if(name==='react')return {useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useRef:initial=>{const i=refIndex++;return refs[i]??=(i===0?{current:node}:{current:initial});},useEffect:fn=>{firstEffect??=fn;},useCallback:fn=>fn};
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  return new Proxy({},{get:(_,key)=>key});
 }});
 function render(){stateIndex=0;refIndex=0;return api.HonorsPage().props.children.type();}
 function findButton(tree){if(!tree||typeof tree!=='object')return null;if(tree.type==='button')return tree;for(const child of [tree.props?.children].flat()){const result=findButton(child);if(result)return result;}return null;}
 render();const cleanup=firstEffect();
 return {states,node,document,cleanup,get requests(){return requests;},get exits(){return exits;},async click(){findButton(render()).props.onClick();await Promise.resolve();await Promise.resolve();},escape(){document.fullscreenElement=null;listeners.get('fullscreenchange')?.();},get cleanupSubscribed(){return listeners.size>0;}};
}
test('presentation enters native fullscreen and exits without resetting the selected table',async()=>{
 const f=fixture();f.states[0]='divisions';await f.click();assert.equal(f.requests,1);assert.equal(f.states[1],true);assert.equal(f.document.fullscreenElement,f.node);
 await f.click();assert.equal(f.exits,1);assert.equal(f.states[1],false);assert.equal(f.states[0],'divisions');f.cleanup();
});
test('Escape restores normal layout; declined or unsupported fullscreen keeps the expanded stage',async()=>{
 const f=fixture();await f.click();f.escape();assert.equal(f.states[1],false);f.cleanup();
 for(const options of [{decline:true},{unsupported:true}]){const fallback=fixture(options);await fallback.click();assert.equal(fallback.states[1],true);await fallback.click();assert.equal(fallback.states[1],false);fallback.cleanup();}
});
test('unmount cleans up listeners and exits only its own fullscreen element',async()=>{
 const own=fixture();await own.click();own.cleanup();assert.equal(own.exits,1);assert.equal(own.cleanupSubscribed,false);
 const other=fixture();other.document.fullscreenElement={};other.cleanup();assert.equal(other.exits,0);
});
