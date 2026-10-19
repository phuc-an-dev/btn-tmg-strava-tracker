import {createHash} from 'node:crypto';
import type {PushSubscription} from 'web-push';

export type PushJob={id:string;lease_id:string;subscription:PushSubscription;is_test:boolean;kind:'registration'|'appeal'|null;target_id:string|null;notification_id:number|null};
type Rpc=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
type Sender=(subscription:PushSubscription,payload:string,options:{TTL:number;urgency:'high';topic:string;timeout:number})=>Promise<{statusCode:number}>;

export function validPushSubscription(subscription:PushSubscription):boolean {
 try{
  const u=new URL(subscription.endpoint);
  const paths:Record<string,RegExp>={'web.push.apple.com':/^\/.+/,'fcm.googleapis.com':/^\/(fcm\/send|wp)\/.+/,'updates.push.services.mozilla.com':/^\/wpush\/v2\/.+/};
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.search||subscription.endpoint.length>2048||!paths[u.hostname]?.test(u.pathname))return false;
  if(!/^B[A-Za-z0-9_-]{86}=?$/.test(subscription.keys.p256dh)||!/^[A-Za-z0-9_-]{22}(==)?$/.test(subscription.keys.auth))return false;
  return Buffer.from(subscription.keys.p256dh,'base64url').length===65&&Buffer.from(subscription.keys.auth,'base64url').length===16;
 }catch{return false;}
}

export function adminPushPayload(job:PushJob){
 const params=new URLSearchParams(job.kind==='registration'?{account:job.target_id!,status:'pending'}:{appeal:job.target_id!,status:'pending'});
 return {
  title:job.is_test?'REVIVE · Thông báo thử':job.kind==='registration'?'REVIVE · Đăng ký chờ duyệt':'REVIVE · Khiếu nại mới',
  // Lock-screen content intentionally contains no names, email addresses or reasons.
  body:job.is_test?'Thiết bị này đã nhận được thông báo đẩy từ REVIVE.':'Có hồ sơ cần Admin kiểm tra. Chạm để xem trạng thái mới nhất.',
  url:job.is_test?'/activities':`${job.kind==='registration'?'/accounts':'/appeals'}?${params}`,
  tag:`revive-${job.id}`,
 };
}

export async function deliverAdminPush({rpc,workerToken,send}:{rpc:Rpc;workerToken:string;send:Sender}) {
 const claimed=await rpc('claim_admin_push_deliveries',{worker_token:workerToken});
 if(claimed.error||!Array.isArray(claimed.data))throw new Error('push_queue_unavailable');
 const result={claimed:claimed.data.length,sent:0,retrying:0,canceled:0,expired:0};
 // At most five independent devices; wait for every acknowledgement before exit.
 const processed=await Promise.allSettled((claimed.data as PushJob[]).map(async job=>{
  const args={worker_token:workerToken,delivery_id:job.id,delivery_lease:job.lease_id};
  const ready=await rpc('prepare_admin_push_delivery',args);
  if(ready.error)throw new Error('push_prepare_failed');
  if(!ready.data){result.canceled++;return;}
  let status=400;
  if(validPushSubscription(job.subscription)){
   try{const response=await send(job.subscription,JSON.stringify(adminPushPayload(job)),{TTL:3600,urgency:'high',topic:createHash('sha256').update(job.id).digest('base64url').slice(0,32),timeout:8000});status=response.statusCode;}
   catch(error){const code=(error as {statusCode?:unknown})?.statusCode;status=typeof code==='number'&&Number.isInteger(code)&&code>=100&&code<=599?code:0;}
  }
  const finished=await rpc('finish_admin_push_delivery',{...args,http_status:status});
  if(finished.error)throw new Error('push_acknowledgement_failed');
  if(status>=200&&status<=299)result.sent++;else if(status===404||status===410)result.expired++;else result.retrying++;
 }));
 if(processed.some(item=>item.status==='rejected'))throw new Error('push_acknowledgement_failed');
 return result;
}
