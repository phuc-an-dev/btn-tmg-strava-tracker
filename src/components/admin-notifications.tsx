"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Bell,CheckCheck,ChevronRight,MessageSquareWarning,UserRoundPlus} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import {BottomDrawer} from './mobile-drawer';
import {Pagination} from './pagination';
import {useAppToast} from './app-toast';

type Notification={id:number;kind:'registration'|'appeal';target_id:string;actor_name:string;created_at:string;read_at:string|null;available:boolean;status:string};
type Inbox={rows:Notification[];total:number;unread_count:number;latest_id:number};
const time=(value:string)=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));

export function AdminNotifications({userId}:{userId:string}) {
 const router=useRouter(),{add}=useAppToast();
 const [open,setOpen]=useState(false),[page,setPage]=useState(1),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [response,setResponse]=useState<{page:number;data:Inbox}|null>(null);
 const data=response?.page===page?response.data:null,unread=response?.data.unread_count??0;
 useEffect(()=>{
  let canceled=false,inFlight=false;
  async function load(){
   if(inFlight||document.hidden)return;inFlight=true;
   try{const r=await getSupabase().rpc('get_admin_notifications',{page_number:page});if(r.error)throw r.error;
    if(!canceled){const next=r.data as Inbox;setResponse({page,data:next});setError('');const last=Math.max(1,Math.ceil(next.total/10));if(page>last)setPage(last);}
   }catch{if(!canceled)setError('Không tải được thông báo.');}finally{inFlight=false;}
  }
  const start=setTimeout(()=>void load(),0),refresh=()=>void load(),poll=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('admin-inbox-changed',refresh);
  return()=>{canceled=true;clearTimeout(start);clearInterval(poll);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('admin-inbox-changed',refresh);};
 },[page,reload,userId]);
 async function markRead(item?:Notification){
  if(busy||(!item&&!data))return false;
  setBusy(true);setError('');
  try{const r=await getSupabase().rpc('mark_admin_notifications_read',item?{notification_ids:[item.id]}:{up_to_id:data!.latest_id});if(r.error)throw r.error;
   setReload(n=>n+1);return true;
  }catch{setError('Chưa lưu được trạng thái đã đọc. Hãy thử lại.');return false;}finally{setBusy(false);}
 }
 async function visit(item:Notification){
  if(!item.read_at&&!await markRead(item))add({title:'Chưa lưu được trạng thái đã đọc.',type:'error',timeout:3000});
  setOpen(false);
  const params=new URLSearchParams(item.kind==='registration'?{account:item.target_id,status:item.status==='pending'?'pending':'approved'}:{appeal:item.target_id,status:item.status==='pending'?'pending':item.status==='accepted'?'accepted':'rejected'});
  router.push(`${item.kind==='registration'?'/accounts':'/appeals'}?${params}`);
 }
 return <><button type="button" className="admin-notification-bell icon-button" aria-label={`Thông báo${unread?`, ${unread} chưa đọc`:''}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setPage(1);setReload(n=>n+1);setOpen(true);}}><Bell size={21} aria-hidden="true"/>{unread>0&&<span className="admin-notification-count" aria-hidden="true">{unread>99?'99+':unread}</span>}{error&&!unread&&<span className="admin-notification-error-dot" aria-hidden="true"/>}</button>
  <BottomDrawer open={open} onOpenChange={value=>{if(!busy)setOpen(value);}} title="Thông báo" description={!response?'Đang tải thông báo…':unread?`${unread} thông báo chưa đọc`:'Bạn đã đọc tất cả thông báo'} busy={busy} footer={false}>
   <div className="drawer-form-body admin-notification-inbox" data-base-ui-swipe-ignore>
    <div className="admin-notification-tools"><span>Đăng ký · Khiếu nại</span><button type="button" className="text-button" disabled={busy||!unread||!data} onClick={()=>void markRead()}><CheckCheck size={16}/>Đọc tất cả</button></div>
    {error&&<div className="portal-load-error" role="alert"><span>{error}</span><button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>Thử lại</button></div>}
    {!data&&!error?<p className="muted" role="status">Đang tải thông báo…</p>:data&&<><ul className="admin-notification-list">{data.rows.map(item=>{
     const Icon=item.kind==='registration'?UserRoundPlus:MessageSquareWarning;
     return <li key={item.id}><button type="button" className={`admin-notification-item${item.read_at?'':' unread'}`} disabled={busy||!item.available} onClick={()=>void visit(item)}><span className="admin-notification-type"><Icon size={19} aria-hidden="true"/></span><span className="admin-notification-content"><strong>{item.kind==='registration'?'Đăng ký chờ duyệt':'Khiếu nại hoạt động'}</strong><span className="admin-notification-actor">{item.actor_name}</span><span className="admin-notification-meta"><time dateTime={item.created_at}>{time(item.created_at)}</time><span>{!item.available?'Không còn khả dụng':item.status==='pending'?(item.kind==='registration'?'Chờ duyệt':'Chờ xử lý'):'Đã xử lý'}</span></span></span>{!item.read_at&&<span className="admin-notification-unread" aria-label="Chưa đọc"/>}{item.available&&<ChevronRight className="admin-notification-arrow" size={16} aria-hidden="true"/>}</button>{!item.available&&!item.read_at&&<button type="button" className="text-button admin-notification-mark" disabled={busy} onClick={()=>void markRead(item)}>Đánh dấu đã đọc</button>}</li>;
    })}</ul>{!data.total&&<p className="admin-notification-empty"><Bell size={28} aria-hidden="true"/>Chưa có thông báo mới.</p>}{data.total>10&&<Pagination currentPage={page} totalPages={Math.max(1,Math.ceil(data.total/10))} pageSize={10} onPageChange={setPage} ariaLabel="Phân trang thông báo"/>}</>}
   </div>
  </BottomDrawer>
 </>;
}
