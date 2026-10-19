'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {Award,Crown,Maximize2,Minimize2,Shield,User} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import type {Role} from '@/lib/portal-data';
import {honorDetail,honorRevealOrder,honorScoreAt,type HonorScope,type HonorSnapshot} from '@/lib/honors';
import {ReviveHeader} from './revive-header';
import {PortalSidebar} from './portal-sidebar';
import {PortalNavigation} from './portal-navigation';
import {PageHeader} from './page-header';
import {SegmentedTabs} from './segmented-tabs';
import {AppToastProvider} from './app-toast';
import {AdminNotifications} from './admin-notifications';
import {HonorsConfetti} from './honors-confetti';

export function HonorsPage(){return <AppToastProvider><HonorsPageContent/></AppToastProvider>;}
function HonorsPageContent(){
 const [scope,setScope]=useState<HonorScope>('individuals');
 const [presenting,setPresenting]=useState(false);
 const shell=useRef<HTMLDivElement>(null),wasFullscreen=useRef(false);
 useEffect(()=>{
  const node=shell.current;
  const changed=()=>{
   if(document.fullscreenElement===node)wasFullscreen.current=true;
   else if(wasFullscreen.current){wasFullscreen.current=false;setPresenting(false);}
  };
  document.addEventListener('fullscreenchange',changed);
  return()=>{
   document.removeEventListener('fullscreenchange',changed);
   if(node&&document.fullscreenElement===node)void document.exitFullscreen().catch(()=>{});
  };
 },[]);
 async function togglePresentation(){
  if(presenting){
   setPresenting(false);
   if(document.fullscreenElement===shell.current)await document.exitFullscreen().catch(()=>{});
   return;
  }
  setPresenting(true);
  // Keep the expanded stage available when fullscreen is unsupported or declined.
  try{await shell.current?.requestFullscreen?.({navigationUI:'hide'});}catch{}
 }
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<{id:string;role:Role}|null>(null);
 useEffect(()=>{
  const db=getSupabase();let canceled=false;
  void db.auth.getSession().then(({data})=>{if(!canceled)setSession(data.session);});
  const {data:listener}=db.auth.onAuthStateChange((_event,next)=>{if(!canceled)setSession(next);});
  return()=>{canceled=true;listener.subscription.unsubscribe();};
 },[]);
 const userId=session?.user.id;
 useEffect(()=>{
  if(!userId)return;let canceled=false;
  void getSupabase().from('profiles').select('role').eq('id',userId).single().then(({data})=>{if(!canceled)setProfile({id:userId,role:(data?.role as Role)||'user'});});
  return()=>{canceled=true;};
 },[userId]);
 const role=profile?.id===userId?profile?.role:'user';
 return <div ref={shell} className={`app-shell revive-shell honors-shell${presenting?" honors-presenting":""}`}><ReviveHeader showAbout={false}>
  {userId&&role==='admin'&&<AdminNotifications key={userId} userId={userId}/>}
  <PortalSidebar guest={!session} loginRedirect="/honors" email={session?.user.email??''} admin={!!session&&role==='admin'} leader={!!session&&role==='leader'} section="honors" onSignOut={()=>void getSupabase().auth.signOut()}/>
 </ReviveHeader><main className="member-main" data-section="honors">
  <PageHeader title="Vinh danh" metadata="Top 3 · Toàn hội thao REVIVE 2026"/>
  <section className="honors-panel" aria-label="Công bố kết quả hội thao">
   <div className="honors-toolbar"><SegmentedTabs id="honors-tabs" ariaLabel="Bảng vinh danh" value={scope} onValueChange={setScope} items={[{value:'individuals',label:<><User size={18}/>Cá nhân</>,panelId:'honors-stage'},{value:'divisions',label:<><Shield size={18}/>Liên đoàn</>,panelId:'honors-stage'}]}/><button type="button" className="text-button honors-presentation-toggle" aria-pressed={presenting} onClick={()=>void togglePresentation()}>{presenting?<Minimize2 size={18}/>:<Maximize2 size={18}/>} {presenting?'Thoát trình chiếu':'Trình chiếu'}</button></div>
   <HonorsStage key={scope} scope={scope}/>
  </section><PortalNavigation section="honors"/>
 </main></div>;
}

export function HonorsStage({scope}:{scope:HonorScope}){
 const [snapshot,setSnapshot]=useState<HonorSnapshot|null>(null),[revealed,setRevealed]=useState<number[]>([]);
 const [busy,setBusy]=useState(false),[animating,setAnimating]=useState(false),[error,setError]=useState('');
 const [burst,setBurst]=useState<{id:number;champion:boolean;origin:{x:number;y:number}|null}>({id:0,champion:false,origin:null}),[settled,setSettled]=useState(false);
 const stage=useRef<HTMLDivElement>(null);
 const request=useRef(0),inFlight=useRef(false),animationLock=useRef(false),activeRank=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 const order=honorRevealOrder(snapshot?.winners.length??3),next=order[revealed.length];
 const done=!!snapshot&&revealed.length===order.length;
 const last=revealed.at(-1),latest=last?snapshot?.winners[last-1]:null;
 const finishReveal=useCallback(()=>{
  animationLock.current=false;setAnimating(false);
  const column=stage.current?.querySelector(`.honors-place[data-place="${activeRank.current}"] .honors-plinth`);
  const bounds=column?.getBoundingClientRect();
  const origin=bounds?{x:bounds.left+bounds.width/2,y:bounds.top+Math.min(20,bounds.height*.1)}:null;
  setBurst(previous=>({id:previous.id+1,champion:activeRank.current===1,origin}));
 },[]);
 const finishConfetti=useCallback(()=>{if(burst.champion)setSettled(true);},[burst.champion]);
 const reveal=(rank:number)=>{
  animationLock.current=true;activeRank.current=rank;setAnimating(true);setSettled(false);
  setRevealed(previous=>[...previous,rank]);
 };
 async function advance(){
  // Ignore repeated taps while the name and score of the current place are revealing.
  if(inFlight.current||animationLock.current)return;
  if(done){
   if(order.length){activeRank.current=0;setRevealed([]);setBurst({id:0,champion:false,origin:null});setSettled(false);setError('');}
   return;
  }
  if(snapshot){if(next)reveal(next);return;}
  inFlight.current=true;setBusy(true);setError('');const version=++request.current;
  try{
   const result=await getSupabase().rpc('get_honors',{honor_scope:scope});
   if(version!==request.current)return;
   if(result.error)throw result.error;
   const data=result.data as HonorSnapshot;setSnapshot(data);
   const first=honorRevealOrder(data.winners.length)[0];if(first)reveal(first);
  }catch{if(version===request.current)setError('Chưa lấy được kết quả. Chạm để thử lại.');}
  finally{if(version===request.current){setBusy(false);inFlight.current=false;}}
 }
 return <div ref={stage} id="honors-stage" role="tabpanel" aria-labelledby={`honors-tabs-${scope}`} className="honors-stage" data-settled={settled||undefined} data-waiting={!revealed.length&&!busy||undefined} aria-busy={busy}>
  <button type="button" className="honors-tap-surface" aria-label={done?"Chạm để đặt lại":`Chạm để công bố Top ${next??3}`} disabled={busy||animating||!!snapshot&&!order.length} onClick={()=>void advance()}/>
  <div className="honors-podium" aria-label="Bục vinh danh">
   {[2,1,3].map(rank=>{
    const winner=snapshot?.winners[rank-1],open=revealed.includes(rank)&&!!winner;
    return <article className="honors-place" data-place={rank} data-revealed={open||undefined} data-active={open&&last===rank||undefined} key={rank} aria-label={`Top ${rank}${open?`: ${winner.name}`:''}`}>
     <div className="honors-winner" aria-hidden={!open||undefined} key={`${snapshot?.captured_at??''}-${open}`}>
      {winner&&<><span className="honors-medal">{rank===1?<Crown size={23}/>:<Award size={21}/>}</span><h3>{winner.name}</h3>{honorDetail(winner,scope)&&<p>{honorDetail(winner,scope)}</p>}{open?<HonorScore score={winner.score} unit={scope==='individuals'?'bước':'bước quy đổi'} onComplete={finishReveal}/>:<strong className="honors-score">{winner.score.toLocaleString('vi-VN')}<small>{scope==='individuals'?'bước':'bước quy đổi'}</small></strong>}</>}
     </div>
     <div className="honors-plinth"><div className="honors-plinth-face"><span>{rank}</span></div></div>
    </article>;
   })}
  </div>
  <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
   {busy?'Đang lấy kết quả…':latest?`Top ${last}: ${latest.name}${animating?'':`, ${latest.score.toLocaleString('vi-VN')} ${scope==='individuals'?'bước':'bước quy đổi'}`}`:'Chạm vào bục vinh danh để bắt đầu công bố.'}
  </div>
  {snapshot&&!order.length&&<p className="muted">Chưa có kết quả đủ điều kiện vinh danh.</p>}
  {error&&<p className="honors-error" role="alert">{error}</p>}
  <HonorsConfetti burst={burst.id} champion={burst.champion} origin={burst.origin} onComplete={finishConfetti}/>
 </div>;
}

function HonorScore({score,unit,onComplete}:{score:number;unit:string;onComplete:()=>void}){
 const [value,setValue]=useState<number|null>(null);
 useEffect(()=>{
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let frame=0,start:number|undefined;
  const draw=(now:number)=>{
   start??=now;
   const next=honorScoreAt(now-start,score,reduced);setValue(next);
   if(next===score){onComplete();return;}
   frame=requestAnimationFrame(draw);
  };
  frame=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(frame);
 },[score,onComplete]);
 return <strong className="honors-score" data-visible={value!==null||undefined} aria-hidden="true"><span className="honors-score-reserve">{score.toLocaleString('vi-VN')}<small>{unit}</small></span><span className="honors-score-value">{value===null?'\u00a0':value.toLocaleString('vi-VN')}<small>{unit}</small></span></strong>;
}
