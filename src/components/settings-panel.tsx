"use client";

import {useEffect,useState} from 'react';
import {Mail} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import {useAuthenticatedPortal} from './portal-context';
import {AdminPushControl} from './admin-push-control';
import {AppUpdateSettings} from './app-update';

type EmailHealth={enabled:boolean;pending:number;failed:number;sent:number;retrying:number};

export function SettingsPanel() {
 const {session}=useAuthenticatedPortal();
 const [health,setHealth]=useState<EmailHealth|null>(null),[loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let canceled=false,inFlight=false;
  async function load(){
   if(inFlight||document.hidden)return;inFlight=true;
   try{
    const r=await getSupabase().rpc('get_admin_email_health');
    if(r.error)throw r.error;
    if(!canceled)setHealth(r.data as EmailHealth);
   }catch{if(!canceled)setHealth(null);}
   finally{inFlight=false;if(!canceled)setLoaded(true);}
  }
  const start=setTimeout(()=>void load(),0),refresh=()=>void load(),poll=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
  return()=>{canceled=true;clearTimeout(start);clearInterval(poll);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
 },[session.user.id]);
 return <section aria-label="Cài đặt thông báo">
  <AdminPushControl userId={session.user.id} active/>
  <section className="admin-push-control" aria-labelledby="email-settings-title">
   <div className="admin-push-heading"><Mail size={18} aria-hidden="true"/><strong id="email-settings-title">Thông báo qua email</strong></div>
   <p className={`admin-email-health${loaded&&(!health||!health.enabled||health.failed)?' warning':''}`} role="status">
    <span>{!loaded?'Đang kiểm tra kênh email…':!health?'Chưa kiểm tra được kênh email.':!health.enabled?'Email thông báo chưa bật.':health.failed?`${health.failed} email gửi lỗi cần kiểm tra cấu hình.`:health.retrying?`${health.retrying} email đang tự gửi lại.`:'Email thông báo đang bật.'}{health?.enabled&&<small>Đã gửi {health.sent} · Đang chờ {health.pending}</small>}</span>
   </p>
  </section>
  <AppUpdateSettings/>
 </section>;
}
