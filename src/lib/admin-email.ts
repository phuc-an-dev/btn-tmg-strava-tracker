import {siteUrl} from './site';

export type AdminEmailJob={id:string;lease_id:string;recipient_email:string;stage:'initial'|'reminder';kind:'registration'|'appeal';target_id:string;actor_name:string;created_at:string;payload:EmailPayload|null};
export type EmailPayload={from:string;to:string[];subject:string;html:string;text:string};
type Rpc=(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>;
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const cleanText=(value:string)=>value.replace(/[\r\n\u0000-\u001f\u007f]+/g,' ').trim();

export function adminEmailPayload(job:AdminEmailJob,from:string):EmailPayload {
 const registration=job.kind==='registration',reminder=job.stage==='reminder';
 const title=registration?'Đăng ký tài khoản chờ duyệt':'Khiếu nại hoạt động chờ xử lý';
 const name=cleanText(job.actor_name).slice(0,120)||'Thành viên';
 const params=new URLSearchParams(registration?{account:job.target_id,status:'pending'}:{appeal:job.target_id,status:'pending'});
 const url=new URL(`${registration?'/accounts':'/appeals'}?${params}`,siteUrl).href;
 const created=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(job.created_at));
 const intro=reminder?'Hồ sơ vẫn chưa được xử lý sau 60 phút kể từ email đầu tiên.':'Có hồ sơ mới cần admin kiểm tra trên REVIVE.';
 const subject=`${reminder?'[Nhắc xử lý] ':'[REVIVE] '}${title}: ${name.slice(0,70)}`;
 const action=registration?'Xem hồ sơ đăng ký':'Xem khiếu nại';
 const text=`${title}\n\n${intro}\nThành viên: ${name}\nThời gian: ${created} (giờ Việt Nam)\n\n${action}: ${url}\n\nTrạng thái mới nhất được hiển thị trên website. Đây là email thông báo tự động từ REVIVE.`;
 const html=`<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f8;font-family:Arial,sans-serif;color:#29313b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce3ee;border-radius:16px"><tr><td style="padding:24px 24px 18px;border-bottom:1px solid #e0e4eb"><strong style="font-size:28px;color:#1d4fb8">REVIVE</strong><div style="margin-top:6px;font-size:12px;color:#616974">Hội thao BTN Trương Minh Giảng 2026</div></td></tr><tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:21px;line-height:1.4">${escapeHtml(title)}</h1><p style="font-size:15px;line-height:1.7">${escapeHtml(intro)}</p><p style="font-size:15px;line-height:1.7"><strong>${escapeHtml(name)}</strong><br><span style="font-size:13px;color:#616974">${escapeHtml(created)} · Giờ Việt Nam</span></p><p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1d4fb8;border-radius:10px;padding:14px 20px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold">${action}</a></p><p style="font-size:12px;line-height:1.6;color:#616974">Trạng thái mới nhất được hiển thị trên website. Đây là email thông báo tự động từ REVIVE.</p></td></tr></table></td></tr></table></body></html>`;
 return {from,to:[job.recipient_email],subject,html,text};
}

export async function deliverAdminEmails({rpc,workerToken,apiKey,from,transport=fetch}:{rpc:Rpc;workerToken:string;apiKey:string;from:string;transport?:typeof fetch}) {
 const claimed=await rpc('claim_admin_email_deliveries',{worker_token:workerToken});
 if(claimed.error||!Array.isArray(claimed.data))throw new Error('queue_unavailable');
 const summary={claimed:claimed.data.length,sent:0,retrying:0,canceled:0};
 for(const job of claimed.data as AdminEmailJob[]){
  const args={worker_token:workerToken,delivery_id:job.id,delivery_lease:job.lease_id};
  const prepared=await rpc('prepare_admin_email_delivery',{...args,proposed_payload:job.payload??adminEmailPayload(job,from)});
  if(prepared.error)throw new Error('queue_prepare_failed');
  if(!prepared.data){summary.canceled++;continue;}
  let acceptedId:string|null=null,errorCode:string|null=null;
  try{
   const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`revive-admin-email/${job.id}`},body:JSON.stringify(prepared.data),signal:AbortSignal.timeout(8000)});
   const result=await response.json() as {id?:unknown;name?:unknown};
   if(response.ok&&typeof result.id==='string'&&result.id)acceptedId=result.id;
   else errorCode=typeof result.name==='string'&&/^[a-z_]{1,70}$/.test(result.name)?result.name:`http_${response.status}`;
  }catch{errorCode='network_error';}
  const finished=await rpc('finish_admin_email_delivery',{...args,accepted_id:acceptedId,error_code:errorCode});
  if(finished.error)throw new Error('queue_acknowledgement_failed');
  if(acceptedId)summary.sent++;else summary.retrying++;
 }
 return summary;
}
