import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const nativeRequire=createRequire(import.meta.url);
function module(file,mocks={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams,require:name=>mocks[name]??nativeRequire(name)});
 return exports;
}
const routes=module('src/lib/portal-routes.ts');
function render({session={user:{id:'A'}},ownMember={},state=null,error='',loading=false}={}){
 let requested=[],opened=null;
 const params=new URLSearchParams('scope=club&status=approved&q=123&activity=123');
 const {ResumeActivityAppeal}=module('src/components/resume-activity-appeal.tsx',{
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  'next/navigation':{useSearchParams:()=>params,usePathname:()=>'/activities',useRouter:()=>({replace(){}})},
  './portal-context':{usePortal:()=>({session,ownMember,isAdmin:false,isLeader:false})},
  '@/lib/portal-routes':routes,
  '@/lib/activity-cache':{},
  './activity-appeal':{
   useActivityAppeals:ids=>{requested=[...ids];return {states:new Map(state?[[123,state]]:[]),error,loading,refresh(){}};},
   ActivityAppealControl:props=>{opened=props;return React.createElement('div',null,'Appeal form');},
  },
 });
 const html=renderToStaticMarkup(React.createElement(ResumeActivityAppeal));
 return {html,requested,opened};
}
test('an anonymous deep link never requests private appeal history',()=>{
 const result=render({session:null,ownMember:null});
 assert.deepEqual(result.requested,[]);assert.equal(result.opened,null);
});
test('returning from login rechecks the precise activity and opens only an eligible form',()=>{
 const state={activity:{activity_id:123},can_submit:true,appeals:[]};
 const result=render({state});
 assert.deepEqual(result.requested,[123]);assert.equal(result.opened.state,state);assert.equal(result.opened.autoOpen,true);
});
test('an unrelated account or ineligible activity cannot open the form',()=>{
 for(const state of [null,{activity:{activity_id:123},can_submit:false,appeals:[]}]){
  const result=render({state});assert.equal(result.opened,null);assert.match(result.html,/thuộc quyền của tài khoản/);
 }
});
test('pending registration preserves the target through onboarding',()=>{
 const result=render({ownMember:null});assert.equal(result.opened,null);
 assert.match(result.html,/onboarding\?redirect=%2Factivities%3F/);assert.match(result.html,/activity%3D123/);
});
test('an eligibility fetch error is recoverable rather than an endless loading message',()=>{
 const result=render({error:'Không tải được thông tin khiếu nại.',loading:true});
 assert.match(result.html,/Thử lại/);assert.doesNotMatch(result.html,/Đang kiểm tra quyền/);assert.equal(result.opened,null);
});
