import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const authorization={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin-email-auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:authorization,require:()=>crypto,Buffer});
test('worker uses expiring signatures without placing its reusable credential in requests',()=>{
 const secret='test-worker-secret',now=1792200000000,stamp=String(now/1000);
 const header='Bearer v1.'+stamp+'.'+crypto.createHmac('sha256',secret).update(stamp).digest('hex');
 assert.equal(authorization.validEmailWorkerAuthorization(header,secret,now),true);
 assert.equal(authorization.validEmailWorkerAuthorization(header,secret,now+121000),false);
 assert.equal(authorization.validEmailWorkerAuthorization(header,secret,now-121000),false);
 assert.equal(authorization.validEmailWorkerAuthorization(header,'wrong-secret',now),false);
 assert.equal(authorization.validEmailWorkerAuthorization('Bearer '+secret,secret,now),false);
 assert.equal(authorization.validEmailWorkerAuthorization('Bearer v1.bad.bad',secret,now),false);
});
const helpers={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin-email.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:helpers,require:()=>({siteUrl:'https://btn-tmg-strava-tracker.vercel.app'}),Intl,URL,URLSearchParams,AbortSignal,fetch});
const job={id:'email-job-1',lease_id:'lease-1',recipient_email:'delivered@resend.dev',stage:'initial',kind:'registration',target_id:'00000000-0000-4000-8000-000000000001',actor_name:'Member <script>\nTest',created_at:'2026-10-17T03:00:00Z',payload:null};
const options={workerToken:'test-token',apiKey:'test-key',from:'REVIVE <notifications@example.invalid>'};
test('email escapes user text, uses a fixed origin and opens the exact target',()=>{
 const mail=helpers.adminEmailPayload(job,options.from);
 assert.ok(!mail.html.includes('<script>'));assert.ok(mail.html.includes('&lt;script&gt;'));
 assert.ok(!mail.subject.includes('\n'));assert.deepEqual(Array.from(mail.to),['delivered@resend.dev']);
 assert.ok(mail.text.includes('https://btn-tmg-strava-tracker.vercel.app/accounts?account='+job.target_id));
 const reminder=helpers.adminEmailPayload({...job,stage:'reminder',kind:'appeal',target_id:'42'},options.from);
 assert.ok(reminder.subject.startsWith('[Nhắc xử lý]'));assert.ok(reminder.text.includes('/appeals?appeal=42'));assert.ok(reminder.text.includes('60 phút'));
});
test('canceled work does not send; provider failures are persisted for retry',async()=>{
 const acknowledgements=[],calls=[];
 const rpc=async(name,args)=>{
  if(name==='claim_admin_email_deliveries')return {data:[job,{...job,id:'canceled'},{...job,id:'retry'}],error:null};
  if(name==='prepare_admin_email_delivery')return {data:args.delivery_id==='canceled'?null:args.proposed_payload,error:null};
  acknowledgements.push(args);return {data:null,error:null};
 };
 const transport=async(url,args)=>{calls.push(args);return calls.length===1?Response.json({id:'provider-accepted'}):Response.json({name:'rate_limit_exceeded'},{status:429});};
 const result=await helpers.deliverAdminEmails({...options,rpc,transport});
 assert.equal(result.sent,1);assert.equal(result.canceled,1);assert.equal(result.retrying,1);assert.equal(calls.length,2);
 assert.equal(acknowledgements[0].accepted_id,'provider-accepted');assert.equal(acknowledgements[1].error_code,'rate_limit_exceeded');
 assert.equal(calls[0].headers['Idempotency-Key'],'revive-admin-email/'+job.id);
});
test('lost acknowledgement retries the exact frozen payload and idempotency key',async()=>{
 const frozen=helpers.adminEmailPayload(job,options.from),requests=[];let failAck=true;
 const rpc=async(name)=>{
  if(name==='claim_admin_email_deliveries')return {data:[{...job,payload:frozen}],error:null};
  if(name==='prepare_admin_email_delivery')return {data:frozen,error:null};
  return {data:null,error:failAck?{message:'temporary outage'}:null};
 };
 const transport=async(url,args)=>{requests.push(args);return Response.json({id:'same-provider-id'});};
 await assert.rejects(helpers.deliverAdminEmails({...options,rpc,transport}),/queue_acknowledgement_failed/);
 failAck=false;
 await helpers.deliverAdminEmails({...options,from:'Changed <changed@example.invalid>',rpc,transport});
 assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);
});
test('queue failures cannot result in an untracked email send',async()=>{
 let sends=0;
 await assert.rejects(helpers.deliverAdminEmails({...options,rpc:async()=>({data:null,error:{}}),transport:async()=>{sends++;return Response.json({id:'bad'});}}),/queue_unavailable/);
 assert.equal(sends,0);
});
