import {createClient} from '@supabase/supabase-js';
import {deliverAdminEmails} from '@/lib/admin-email';
import {validEmailWorkerAuthorization} from '@/lib/admin-email-auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export async function POST(request:Request){
 const secret=process.env.ADMIN_EMAIL_WORKER_SECRET;
 if(!secret)return Response.json({error:'Email worker is not configured.'},{status:503});
 if(!validEmailWorkerAuthorization(request.headers.get('authorization')??'',secret))return Response.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,apiKey=process.env.RESEND_API_KEY,from=process.env.ADMIN_EMAIL_FROM;
 if(!url||!key||!apiKey||!from)return Response.json({error:'Email worker is not configured.'},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
 try{
  const summary=await deliverAdminEmails({rpc:(name,args)=>db.rpc(name,args),workerToken:secret,apiKey,from});
  return Response.json(summary,{headers:{'Cache-Control':'no-store'}});
 }catch{
  // Leases expire; the next scheduled run retries using the same provider idempotency key.
  return Response.json({error:'Email processing will be retried.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
