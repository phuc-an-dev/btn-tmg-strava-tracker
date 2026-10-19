"use client";

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import {shortDate} from '@/lib/statistics';
import {contributionLabel,contributionPercent,waffleCellFill,type ContributionsResult} from '@/lib/contributions';
import {useAuthenticatedPortal} from './portal-context';
import {ContributionsSkeleton} from './statistics-skeleton';

function Waffle({percent,label}:{percent:number|null;label:string}){
 return <svg className="contribution-waffle" viewBox="0 0 98 98" role="img" aria-label={label}>
  {Array.from({length:100},(_,i)=>{
   const x=(i%10)*10,y=(9-Math.floor(i/10))*10,fill=waffleCellFill(percent,i);
   return <g key={i}><rect x={x} y={y} width="8" height="8" rx="1.5" fill="#e9edf3"/>{fill>0&&<rect x={x} y={y} width={8*fill} height="8" rx="1" fill="var(--blue)"/>}</g>;
  })}
 </svg>;
}

export function ContributionsCard({period,date,onSelectDate}:{period:'week'|'event';date:string|null;onSelectDate:(day:string)=>void}){
 const {session,ownMember,isAdmin}=useAuthenticatedPortal();
 const userId=session.user.id,memberKey=ownMember?`${ownMember.strava_athlete_id}|${ownMember.group_id}|${ownMember.division_id}`:'unlinked';
 const key=`${userId}|${period}|${memberKey}`;
 const [response,setResponse]=useState<{key:string;data:ContributionsResult}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const data=response?.key===key?response.data:null;
 useEffect(()=>{
  let canceled=false,inFlight=false;
  async function load(){
   if(inFlight||document.hidden)return;inFlight=true;
   try{
    const result=await getSupabase().rpc('get_my_activity_contributions',{stat_period:period});
    if(result.error)throw result.error;
    if(!canceled){setResponse({key,data:result.data as ContributionsResult});setError('');}
   }catch{if(!canceled)setError('Chưa tải được phần đóng góp.');}finally{inFlight=false;}
  }
  const start=setTimeout(()=>{setError('');void load();},0),refresh=()=>void load(),timer=setInterval(refresh,60_000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('admin-inbox-changed',refresh);
  return()=>{canceled=true;clearTimeout(start);clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('admin-inbox-changed',refresh);};
 },[key,period,retry]);
 if(!data&&!error)return <ContributionsSkeleton/>;
 if(!data)return <article className="statistics-card contributions-card"><h2>Đóng góp của tôi</h2><div className="portal-load-error" role="alert"><span>{error}</span><button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></div></article>;
 const requestedIndex=date?data.days.findIndex(day=>day.date===date):-1;
 const selectedIndex=requestedIndex>=0?requestedIndex:data.days.length-1;
 const day=data.days[selectedIndex];
 const metrics=day?[
  {label:'Cá nhân',detail:'Của tôi',steps:day.individual},
  {label:'Nhóm nhỏ',detail:data.member?.group_id?data.member.group_name||`Nhóm ${data.member.group_id}`:'Chưa phân nhóm',steps:day.group},
  {label:'Liên đoàn',detail:data.member?.division_id?`LĐ ${data.member.division_id}`:'Chưa phân LĐ',steps:day.division},
 ]:[];
 return <article className="statistics-card contributions-card" aria-label="Đóng góp của tôi">
  <div className="contribution-heading"><h2>Đóng góp của tôi</h2>{day&&<div className="contribution-date"><button type="button" className="icon-button" aria-label="Ngày đóng góp trước" disabled={selectedIndex===0} onClick={()=>onSelectDate(data.days[selectedIndex-1].date)}><ChevronLeft size={16}/></button><time dateTime={day.date}>{shortDate(day.date)}</time><button type="button" className="icon-button" aria-label="Ngày đóng góp sau" disabled={selectedIndex===data.days.length-1} onClick={()=>onSelectDate(data.days[selectedIndex+1].date)}><ChevronRight size={16}/></button></div>}</div>
  {day?<><p className="contribution-total">Toàn hội thao: <strong>{day.total.toLocaleString('vi-VN')} bước</strong></p>
   {!data.member?<p className="contribution-empty">Tài khoản chưa liên kết thành viên Strava. {isAdmin?<Link href="/members">Liên kết tại Thành viên</Link>:'Nhờ Admin liên kết để xem đóng góp của bạn.'}</p>:<>
    <div className="contribution-grid">{metrics.map(metric=>{
     const percent=contributionPercent(metric.steps,day.total),label=contributionLabel(percent);
     return <section className="contribution-metric" key={metric.label} aria-label={`${metric.label}: ${label}`}><h3>{metric.label}</h3><Waffle percent={percent} label={`${metric.label}: ${label} trên tổng bước toàn hội thao trong ngày`}/><strong className="contribution-percent">{label}</strong><span className="contribution-steps">{metric.steps===null?'—':`${metric.steps.toLocaleString('vi-VN')} bước`}</span><span className="contribution-detail" title={metric.detail}>{metric.detail}</span></section>;
    })}</div>
    {!day.total&&<p className="contribution-empty">Chưa có bước đã duyệt trong ngày này.</p>}
   </>}
   <p className="contribution-note">Ba tỷ lệ tính riêng trên tổng bước thực tế đã duyệt, không cộng thưởng đi chung.</p>
  </>:<p className="contribution-empty">Chưa có ngày hoàn tất trong khoảng đã chọn.</p>}
  {error&&<p className="contribution-note" role="status">Chưa cập nhật được. Đang hiển thị dữ liệu đã tải.</p>}
 </article>;
}
