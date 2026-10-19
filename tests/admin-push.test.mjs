import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import {test} from 'node:test';
import ts from 'typescript';
const helpers={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin-push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:helpers,require:()=>crypto,URL,URLSearchParams,Buffer});
const subscription={endpoint:'https://web.push.apple.com/valid-test-token',keys:{p256dh:'B'+'A'.repeat(86),auth:'A'.repeat(22)}};
const job={id:'push-job',lease_id:'lease',subscription,is_test:false,kind:'registration',target_id:'target-id',notification_id:1};
test('only public push providers and well-formed keys can be contacted',()=>{
 assert.equal(helpers.validPushSubscription(subscription),true);
 for(const endpoint of ['http://web.push.apple.com/token','https://127.0.0.1/token','https://web.push.apple.com.evil.test/token','https://web.push.apple.com@127.0.0.1/token','https://web.push.apple.com:8443/token','https://fcm.googleapis.com/arbitrary/path','https://web.push.apple.com/token?redirect=https://127.0.0.1'])assert.equal(helpers.validPushSubscription({...subscription,endpoint}),false,endpoint);
 assert.equal(helpers.validPushSubscription({...subscription,keys:{p256dh:'invalid',auth:'x'}}),false);
});
test('push payload contains no member identity and opens the exact case',()=>{
 const payload=helpers.adminPushPayload(job);
 assert.equal(payload.url,'/accounts?account=target-id&status=pending');
 assert.equal(helpers.adminPushPayload({...job,kind:'appeal'}).url,'/appeals?appeal=target-id&status=pending');
 assert.equal(helpers.adminPushPayload({...job,is_test:true}).url,'/activities');
 assert.ok(!('actor_name' in payload));assert.ok(!('email' in payload));
});
test('canceled jobs never send; expired endpoints and transient errors are acknowledged',async()=>{
 const acknowledgements=[],calls=[];
 const rpc=async(name,args)=>{
  if(name==='claim_admin_push_deliveries')return {data:[job,{...job,id:'canceled'},{...job,id:'expired'},{...job,id:'retry'},{...job,id:'unsafe',subscription:{...subscription,endpoint:'https://127.0.0.1/'}}],error:null};
  if(name==='prepare_admin_push_delivery')return {data:args.delivery_id!=='canceled',error:null};
  acknowledgements.push(args);return {data:null,error:null};
 };
 const send=async(...args)=>{calls.push(args);if(calls.length===2)throw {statusCode:410};if(calls.length===3)throw {statusCode:429};return {statusCode:201};};
 const result=await helpers.deliverAdminPush({rpc,send,workerToken:'test'});
 assert.equal(calls.length,3);assert.equal(result.sent,1);assert.equal(result.canceled,1);assert.equal(result.expired,1);
 assert.deepEqual(acknowledgements.map(a=>a.http_status).sort((a,b)=>a-b),[201,400,410,429]);
 assert.equal(calls[0][2].TTL,3600);assert.equal(calls[0][2].topic.length,32);
});
test('lost acknowledgement keeps the same push tag and provider topic on retry',async()=>{
 const sends=[];let failed=true;
 const rpc=async(name)=>name==='claim_admin_push_deliveries'?{data:[job],error:null}:name==='prepare_admin_push_delivery'?{data:true,error:null}:{data:null,error:failed?{}:null};
 const send=async(...args)=>{sends.push(args);return {statusCode:201};};
 await assert.rejects(helpers.deliverAdminPush({rpc,send,workerToken:'test'}),/acknowledgement/);failed=false;
 await helpers.deliverAdminPush({rpc,send,workerToken:'test'});
 assert.equal(sends[0][1],sends[1][1]);assert.equal(sends[0][2].topic,sends[1][2].topic);
});

function worker(){
 const handlers={},shown=[],opened=[];
 const self={location:{origin:'https://revive.example'},addEventListener:(name,fn)=>{handlers[name]=fn;},registration:{showNotification:async(...args)=>{shown.push(args);}},skipWaiting:()=>{}};
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL,clients:{claim:async()=>{},matchAll:async()=>[],openWindow:async(url)=>{opened.push(url);}}});
 return {handlers,shown,opened};
}
test('worker always shows a visible notification, even for malformed or null payloads',async()=>{
 const {handlers,shown}=worker();
 for(const value of [null,[],{},'invalid']){let pending;handlers.push({data:{json:()=>{if(value==='invalid')throw Error();return value;}},waitUntil:p=>{pending=p;}});await pending;}
 assert.equal(shown.length,4);assert.ok(shown.every(([title])=>title.startsWith('REVIVE')));
});
test('notification clicks reject external URLs, script URLs, and unsafe same-origin routes',async()=>{
 const {handlers,opened}=worker();
 for(const url of ['https://evil.example/','javascript:alert(1)','/api/extension/members','//evil.example/accounts','/appeals?appeal=42']){
  let pending;handlers.notificationclick({notification:{close:()=>{},data:{url}},waitUntil:p=>{pending=p;}});await pending;
 }
 assert.deepEqual(opened,['https://revive.example/activities','https://revive.example/activities','https://revive.example/activities','https://revive.example/activities','https://revive.example/appeals?appeal=42']);
});
