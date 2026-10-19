import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {validEmailWorkerAuthorization} from '@/lib/admin-email-auth';
import {deliverAdminPush} from '@/lib/admin-push';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request:Request){
 const secret=process.env.ADMIN_EMAIL_WORKER_SECRET;
 if(!secret)return Response.json({error:'Push worker is not configured.'},{status:503});
 if(!validEmailWorkerAuthorization(request.headers.get('authorization')??'',secret))return Response.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
 if(!url||!key||!publicKey||!privateKey)return Response.json({error:'Push worker is not configured.'},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
 try{
  const summary=await deliverAdminPush({rpc:(name,args)=>db.rpc(name,args),workerToken:secret,send:(subscription,payload,options)=>webpush.sendNotification(subscription,payload,{...options,vapidDetails:{subject:'mailto:notifications@strava.tmgchurch.website',publicKey,privateKey}})});
  return Response.json(summary,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Push processing will be retried.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
