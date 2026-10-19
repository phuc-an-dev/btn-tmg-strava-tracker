"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {RefreshCw} from 'lucide-react';
import {appVersion,isAppVersion,mayRetryUpdate} from '@/lib/app-version';

type Status='idle'|'checking'|'current'|'available'|'error';
type UpdateContext={version:string;status:Status;check:()=>Promise<void>;apply:()=>void};
const Context=createContext<UpdateContext|null>(null);
const attemptKey='revive-update-attempt',scrollKey='revive-update-scroll';

export function AppUpdateProvider({children}:{children:ReactNode}) {
 const [status,setStatus]=useState<Status>('idle'),[latest,setLatest]=useState<string|null>(null),[message,setMessage]=useState('');
 const dirty=useRef(new Set<Element>()),lastInteraction=useRef(0),inFlight=useRef(false),lastCheck=useRef(0),reloading=useRef(false);
 const controller=useRef<AbortController|null>(null);
 const blocked=useCallback(()=>{
  for(const form of dirty.current)if(!form.isConnected||form.closest('dialog:not([open])'))dirty.current.delete(form);
  return document.hidden||!navigator.onLine||dirty.current.size>0||
   !!document.querySelector('[aria-busy="true"], [role="dialog"], dialog[open], .bottom-drawer, .portal-sidebar')||
   !!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
 },[]);
 const apply=useCallback((manual=false)=>{
  if(!latest||reloading.current)return;
  if(blocked()){
   if(manual)setMessage('Vui lòng hoàn tất hoặc đóng form trước khi cập nhật.');
   return;
  }
  if(!manual&&Date.now()-lastInteraction.current<2000)return;
  try{
   const previous=JSON.parse(sessionStorage.getItem(attemptKey)||'null');
   if(!mayRetryUpdate(previous,appVersion,latest,Date.now(),manual)){
    setMessage('Chưa nhận được bản mới. Bạn có thể thử lại sau một phút.');return;
   }
   sessionStorage.setItem(attemptKey,JSON.stringify({from:appVersion,to:latest,at:Date.now()}));
   sessionStorage.setItem(scrollKey,JSON.stringify({url:location.pathname+location.search+location.hash,x:scrollX,y:scrollY,at:Date.now()}));
  }catch{
   // Without a reload guard, keep the update manual rather than risk a loop.
   if(!manual){setMessage('Có phiên bản mới. Nhấn Cập nhật để tải lại.');return;}
  }
  reloading.current=true;location.reload();
 },[latest,blocked]);
 const check=useCallback(async(manual=false)=>{
  if(inFlight.current||document.hidden)return;
  if(!navigator.onLine){if(manual){setStatus('error');setMessage('Cần có mạng để kiểm tra cập nhật.');}return;}
  if(!manual&&Date.now()-lastCheck.current<1000)return;
  inFlight.current=true;lastCheck.current=Date.now();
  if(manual){setStatus('checking');setMessage('');}
  const abort=new AbortController();controller.current=abort;let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;abort.abort();},8000);
  try{
   const response=await fetch(`/api/app-version?at=${Date.now()}`,{cache:'no-store',credentials:'omit',signal:abort.signal});
   if(!response.ok)throw new Error('Version unavailable');
   const data=await response.json();
   if(!isAppVersion(data.version))throw new Error('Invalid version');
   if(!abort.signal.aborted){setLatest(data.version===appVersion?null:data.version);setStatus(data.version===appVersion?'current':'available');}
  }catch{if(manual&&!abort.signal.aborted){setStatus('error');setMessage('Chưa kiểm tra được phiên bản. Hãy thử lại.');}}
  finally{
   clearTimeout(timeout);inFlight.current=false;
   if(manual&&timedOut){setStatus('error');setMessage('Kiểm tra cập nhật quá thời gian. Hãy thử lại.');}
  }
 },[]);
 useEffect(()=>{
  const interact=()=>{lastInteraction.current=Date.now();};
  const edit=(event:Event)=>{
   const target=event.target;
   if(!(target instanceof Element))return;
   const form=target.closest('form');
   if(form)dirty.current.add(form);
  };
  const refresh=()=>void check();
  const reset=(event:Event)=>{if(event.target instanceof Element)dirty.current.delete(event.target);};
  const initial=setTimeout(refresh,0),poll=setInterval(refresh,120_000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('pageshow',refresh);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);
  document.addEventListener('input',edit,true);document.addEventListener('change',edit,true);document.addEventListener('submit',edit,true);
  document.addEventListener('reset',reset,true);
  document.addEventListener('pointerdown',interact,true);document.addEventListener('keydown',interact,true);
  return()=>{
   clearTimeout(initial);clearInterval(poll);controller.current?.abort();
   document.removeEventListener('visibilitychange',refresh);window.removeEventListener('pageshow',refresh);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);
   document.removeEventListener('input',edit,true);document.removeEventListener('change',edit,true);document.removeEventListener('submit',edit,true);
   document.removeEventListener('reset',reset,true);
   document.removeEventListener('pointerdown',interact,true);document.removeEventListener('keydown',interact,true);
  };
 },[check]);
 useEffect(()=>{
  if(!latest)return;
  const timer=setInterval(()=>apply(),1000);return()=>clearInterval(timer);
 },[latest,apply]);
 useEffect(()=>{
  let saved:{url:string;x:number;y:number;at:number}|null=null;
  try{saved=JSON.parse(sessionStorage.getItem(scrollKey)||'null');sessionStorage.removeItem(scrollKey);}catch{return;}
  if(!saved||saved.url!==location.pathname+location.search+location.hash||Date.now()-saved.at>600_000||!Number.isFinite(saved.y)||!Number.isFinite(saved.x))return;
  let count=0;
  const stop=()=>{clearInterval(timer);window.removeEventListener('pointerdown',stop);window.removeEventListener('wheel',stop);window.removeEventListener('keydown',stop);};
  const timer=setInterval(()=>{
   if(document.documentElement.scrollHeight-innerHeight>=saved!.y){window.scrollTo(saved!.x,saved!.y);stop();}
   else if(++count>=40)stop();
  },250);
  window.addEventListener('pointerdown',stop);window.addEventListener('wheel',stop);window.addEventListener('keydown',stop);
  return stop;
 },[]);
 return <Context.Provider value={{version:appVersion,status,check:()=>check(true),apply:()=>apply(true)}}>
  {children}
  {latest&&<aside className="app-update-banner" role="status"><div><strong>Có phiên bản mới</strong><p>{message||'App sẽ cập nhật khi bạn hoàn tất thao tác.'}</p></div><button type="button" onClick={()=>apply(true)}>Cập nhật</button></aside>}
 </Context.Provider>;
}

export function AppUpdateSettings(){
 const update=useContext(Context);
 if(!update)return null;
 return <section className="admin-push-control" aria-labelledby="app-update-title"><div className="admin-push-heading"><RefreshCw size={18} aria-hidden="true"/><strong id="app-update-title">Cập nhật ứng dụng</strong></div><p>Phiên bản đang dùng: <code>{update.version}</code></p><p role="status">{update.status==='checking'?'Đang kiểm tra…':update.status==='current'?'Bạn đang dùng phiên bản mới nhất.':update.status==='available'?'Có phiên bản mới sẵn sàng cập nhật.':update.status==='error'?'Chưa kiểm tra được phiên bản. Kiểm tra kết nối và thử lại.':'Tự kiểm tra khi quay lại app và mỗi 2 phút khi đang mở.'}</p><div className="admin-push-actions"><button type="button" className="text-button" disabled={update.status==='checking'} onClick={()=>void update.check()}><RefreshCw size={16}/>Kiểm tra cập nhật</button>{update.status==='available'&&<button type="button" className="text-button" onClick={update.apply}>Cập nhật ngay</button>}</div></section>;
}
