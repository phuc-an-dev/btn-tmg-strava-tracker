'use client';
import {useEffect,useState} from 'react';
import {parseAsInteger,parseAsStringLiteral,useQueryStates} from 'nuqs';
import type {Session} from '@supabase/supabase-js';
import {Check,Search,Shield,User,Users,X} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import type {Role} from '@/lib/portal-data';
import {contributionLabel,contributionPercent,orderedContributionShares,selectContributionChoices,toggleContributionSelection} from '@/lib/contributions';
import {shortDate,statisticsSearch,type StatisticsScope} from '@/lib/statistics';
import {statisticsQuery,queryOptions} from '@/lib/portal-query';
import {ReviveHeader} from './revive-header';
import {PortalSidebar} from './portal-sidebar';
import {PortalNavigation} from './portal-navigation';
import {PageHeader} from './page-header';
import {SegmentedTabs} from './segmented-tabs';
import {StatisticsBranches} from './statistics-branches';
import {BottomDrawer} from './mobile-drawer';
import {Pagination} from './pagination';
import {AdminNotifications} from './admin-notifications';
import {AppToastProvider} from './app-toast';
import {ContributionWaffle} from './contribution-waffle';
import {contributionColors} from '@/lib/contribution-colors';

type Choice={id:number;name:string;detail:string;steps:number};
type Result={start_date:string;end_date:string;own_id:number|null;total:number;choices:Choice[]};
const query={scope:parseAsStringLiteral(['individuals','groups','divisions'] as const).withDefault('individuals'),period:parseAsStringLiteral(['week','event'] as const).withDefault('event'),entity:parseAsInteger,entities:statisticsQuery.entities};
const labels={individuals:'cá nhân',groups:'nhóm nhỏ',divisions:'liên đoàn'};
const icons={individuals:User,groups:Users,divisions:Shield};
export function ContributionsPage(){return <AppToastProvider><ContributionsPageContent/></AppToastProvider>;}
function ContributionsPageContent(){
 const [params,setParams]=useQueryStates(query,queryOptions),{scope,period,entity,entities}=params;
 const [auth,setAuth]=useState<{ready:boolean;session:Session|null}>({ready:false,session:null}),[profile,setProfile]=useState<{userId:string;role:Role}|null>(null);
 const [response,setResponse]=useState<{key:string;data:Result}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [visibility,setVisibility]=useState<{key:string;hidden:number[]}>({key:'',hidden:[]});
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<number[]>([]),[search,setSearch]=useState(''),[page,setPage]=useState(1);
 const userId=auth.session?.user.id??'guest',key=`${userId}|${scope}|${period}`;
 const data=response?.key===key?response.data:null;
 const role=profile?.userId===userId?profile.role:'user';
 useEffect(()=>{
  const db=getSupabase();let canceled=false;
  void db.auth.getSession().then(({data})=>{if(!canceled)setAuth({ready:true,session:data.session});});
  const {data:listener}=db.auth.onAuthStateChange((_event,session)=>{if(!canceled)setAuth({ready:true,session});});
  return()=>{canceled=true;listener.subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  let canceled=false;
  if(!auth.session)return;
  void getSupabase().from('profiles').select('role').eq('id',userId).single().then(({data})=>{if(!canceled)setProfile({userId,role:(data?.role as Role)||'user'});});
  return()=>{canceled=true;};
 },[userId,auth.session]);
 useEffect(()=>{
  if(!auth.ready)return;
  let canceled=false,inFlight=false;
  async function load(){
   if(inFlight||document.hidden)return;inFlight=true;
   try{const r=await getSupabase().rpc('get_contribution_statistics',{stat_scope:scope,stat_period:period});if(r.error)throw r.error;if(!canceled){setResponse({key,data:r.data as Result});setError('');}}
   catch{if(!canceled)setError('Chưa tải được dữ liệu đóng góp.');}finally{inFlight=false;}
  }
  const start=setTimeout(()=>{setError('');void load();},0),refresh=()=>void load(),timer=setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);
  return()=>{canceled=true;clearTimeout(start);clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
 },[auth.ready,key,scope,period,retry]);
 const selected=data?selectContributionChoices(data.choices,entities,entity,data.own_id):[];
 const shares=selected.map((choice,index)=>({...choice,index,percent:data?contributionPercent(choice.steps,data.total):null}));
 const visibilityKey=`${userId}|${scope}|${selected.map(choice=>choice.id).join(',')}`;
 const hidden=visibility.key===visibilityKey?visibility.hidden:[];
 const orderedShares=orderedContributionShares(shares,hidden);
 const selectedSteps=orderedShares.reduce((sum,choice)=>sum+choice.steps,0);
 const remaining=data?Math.max(0,data.total-selectedSteps):0;
 const selectedChoices=draft.flatMap(id=>data?.choices.find(c=>c.id===id)??[]);
 const terms=statisticsSearch(search).split(' ').filter(Boolean);
 const filtered=data?.choices.filter(c=>terms.every(t=>statisticsSearch(`${c.name} ${c.detail} ${c.id}`).includes(t)))??[];
 const pages=Math.max(1,Math.ceil(filtered.length/5)),current=Math.min(page,pages),Icon=icons[scope];
 const changeScope=(scope:StatisticsScope)=>{setOpen(false);void setParams({scope,entity:null,entities:[]},{history:'push'});};
 return <div className="app-shell revive-shell"><ReviveHeader showAbout={false}>{auth.session&&role==='admin'&&<AdminNotifications userId={userId}/>}<PortalSidebar guest={!auth.session} email={auth.session?.user.email??''} admin={!!auth.session&&role==='admin'} leader={!!auth.session&&role==='leader'} section="contributions" onSignOut={()=>void getSupabase().auth.signOut()}/></ReviveHeader>
 <main className="member-main" data-section="contributions"><PageHeader title="Đóng góp" metadata="Tỷ lệ trên tổng bước đã duyệt của toàn hội thao"/>
 <section className="statistics-panel" aria-label="Tỷ lệ đóng góp bước đi bộ">
  <SegmentedTabs className="statistics-scope-tabs" ariaLabel="Loại đóng góp" value={scope} onValueChange={changeScope} items={[{value:'individuals',label:<span className="statistics-tab-label"><User size={16}/><span>Cá nhân</span></span>},{value:'groups',label:<span className="statistics-tab-label"><Users size={16}/><span>Nhóm nhỏ</span></span>},{value:'divisions',label:<span className="statistics-tab-label"><Shield size={16}/><span>Liên đoàn</span></span>}]}/>
  <div className="statistics-controls" data-scope={scope} role="group" aria-label={`Tùy chọn đóng góp ${labels[scope]}`}><StatisticsBranches scope={scope}/><button type="button" className="statistics-picker picker-trigger statistics-picker-compact" aria-label={`Chọn ${labels[scope]} so sánh, đã chọn ${selected.length} trên 5`} aria-haspopup="dialog" aria-expanded={open} disabled={!data} onClick={()=>{setDraft(selected.map(c=>c.id));setSearch('');setPage(1);setOpen(true);}}><span><Icon size={16} className="statistics-picker-icon" aria-hidden="true"/><span>{selected.length===1?selected[0].name:'So sánh'}</span></span><span className="statistics-picker-badge">{selected.length}/5</span></button><SegmentedTabs className="statistics-period-tabs" ariaLabel="Thời gian đóng góp" value={period} onValueChange={period=>void setParams({period},{history:'push'})} items={[{value:'week',label:'Tuần này'},{value:'event',label:'Toàn hội thao'}]}/></div>
  {error&&<div className="portal-load-error" role="alert"><span>{error}</span><button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></div>}
  {!data&&!error&&<article className="statistics-card contribution-overview" aria-label="Đang tải đóng góp" aria-busy="true"><div className="member-skeleton-block" style={{height:24,width:'60%'}}/><div className="member-skeleton-block contribution-large-waffle"/><div className="member-skeleton-block" style={{height:40,width:'40%'}}/></article>}
  {data&&<article className="statistics-card contribution-overview"><h2>{selected.length>1?`So sánh ${selected.length} ${labels[scope]}`:selected[0]?.name??'Chưa có đối tượng'}</h2><p className="muted">{data.start_date<=data.end_date?`${shortDate(data.start_date)}–${shortDate(data.end_date)} · ${period==='week'?'Tuần này':'Toàn hội thao'}`:'Chưa có ngày hoàn tất trong khoảng đã chọn'}</p>
   <p className="contribution-comparison-total">Toàn hội thao: <strong>{data.total.toLocaleString('vi-VN')} bước</strong></p>
   <ContributionWaffle shares={orderedShares}/>
   <strong className="contribution-large-percent">{contributionLabel(contributionPercent(selectedSteps,data.total))}</strong>
   <p className="contribution-ratio"><strong>{selectedSteps.toLocaleString('vi-VN')}</strong> / {data.total.toLocaleString('vi-VN')} bước{selected.length>1?(hidden.length?' · Đang hiển thị':' · Tổng đã chọn'):''}</p>
   <div className="contribution-legend" aria-label="Chú thích màu, vị trí cố định">{shares.map(share=><button type="button" key={share.id} title={share.name} aria-pressed={!hidden.includes(share.id)} disabled={!hidden.includes(share.id)&&orderedShares.length===1} onClick={()=>setVisibility({key:visibilityKey,hidden:hidden.includes(share.id)?hidden.filter(id=>id!==share.id):[...hidden,share.id]})}><i style={{background:contributionColors[share.index]}}/>{share.name}</button>)}<span><i style={{background:'#e9edf3'}}/>Phần còn lại</span></div>
   <p className="contribution-legend-hint">Chạm chú thích để ẩn hoặc hiện. Tỷ lệ luôn tính trên tổng bước toàn hội thao.</p>
   <table className="contribution-breakdown"><caption className="sr-only">Số bước và tỷ lệ đóng góp, từ cao xuống thấp</caption><thead><tr><th scope="col">{scope==='individuals'?'Cá nhân':scope==='groups'?'Nhóm nhỏ':'Liên đoàn'}</th><th scope="col">Số bước</th><th scope="col">Tỷ lệ</th></tr></thead><tbody>{orderedShares.map(share=><tr key={share.id}><th scope="row"><span className="contribution-row-label"><i style={{background:contributionColors[share.index]}}/><span>{share.name}{share.detail&&<small>{share.detail}</small>}</span></span></th><td>{share.steps.toLocaleString('vi-VN')}</td><td>{contributionLabel(share.percent)}</td></tr>)}</tbody><tfoot><tr><th scope="row"><span className="contribution-row-label"><i style={{background:'#e9edf3'}}/>Phần còn lại</span></th><td>{remaining.toLocaleString('vi-VN')}</td><td>{contributionLabel(contributionPercent(remaining,data.total))}</td></tr></tfoot></table>
   {!data.total&&<p className="contribution-empty">Chưa có bước đã duyệt trong khoảng này.</p>}<p className="contribution-note">Chỉ tính bước thực tế đã duyệt đến hết hôm qua, không cộng thưởng đi chung. Mỗi ô tương ứng 1% tổng bước toàn hội thao.</p>
  </article>}
 </section><PortalNavigation section="contributions"/></main>
 <BottomDrawer className="statistics-picker-drawer" open={open} onOpenChange={setOpen} title={`Chọn ${labels[scope]}`} description={`Đã chọn ${draft.length}/5`} footer={<button type="button" className="primary" disabled={!draft.length} onClick={()=>{void setParams({entities:draft,entity:null},{history:'push'});setOpen(false);}}>Xác nhận</button>}>
  <div className="statistics-selection" data-base-ui-swipe-ignore><div className="search-field"><Search size={18}/><input aria-label={`Tìm ${labels[scope]}`} placeholder={scope==='individuals'?'Tìm tên hoặc Strava ID…':`Tìm ${labels[scope]}…`} value={search} autoComplete="off" enterKeyHint="done" onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{search&&<button type="button" className="search-clear icon-button" aria-label="Xóa tìm kiếm" onClick={()=>{setSearch('');setPage(1);}}><X size={18}/></button>}</div><div className="statistics-selection-row"><div className="statistics-selected" role="group" aria-label="Đối tượng đã chọn">{selectedChoices.map(c=><button type="button" className="statistics-selected-chip" key={c.id} title={c.name} aria-label={`Bỏ chọn ${c.name}`} onClick={()=>setDraft(ids=>ids.filter(id=>id!==c.id))}><span>{c.name}</span><X size={14} aria-hidden="true"/></button>)}{!draft.length&&<span className="statistics-selection-empty">Chưa chọn</span>}</div><button type="button" className="text-button statistics-clear-selection" aria-label="Bỏ chọn tất cả" disabled={!draft.length} onClick={()=>setDraft([])}>Bỏ hết</button></div><div className="statistics-selection-summary"><span aria-live="polite">{filtered.length} kết quả</span><span>{draft.length>=5?'Đủ 5 mục. Bỏ chọn để thêm mới.':'Chọn tối đa 5 đối tượng'}</span></div><div className="statistics-options" role="listbox" aria-multiselectable="true" aria-label={`Danh sách ${labels[scope]}`}>{filtered.slice((current-1)*5,current*5).map(c=><button type="button" role="option" aria-selected={draft.includes(c.id)} key={c.id} className="select-item" disabled={!draft.includes(c.id)&&draft.length>=5} onClick={()=>setDraft(ids=>toggleContributionSelection(ids,c.id))}><span>{c.name}{c.detail&&<small>{c.detail}</small>}</span><span className="select-item-indicator" aria-hidden="true">{draft.includes(c.id)&&<Check size={14}/>}</span></button>)}{!filtered.length&&<p className="muted" role="status">Không tìm thấy kết quả.</p>}</div>{pages>1&&<Pagination currentPage={current} totalPages={pages} onPageChange={setPage} ariaLabel="Phân trang chọn đóng góp"/>}</div>
 </BottomDrawer></div>;
}
