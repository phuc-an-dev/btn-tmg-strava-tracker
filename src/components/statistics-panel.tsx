"use client";
import {useEffect,useRef,useState} from "react";
import dynamic from "next/dynamic";
import {useQueryStates} from "nuqs";
import {Activity,Check,ChevronLeft,ChevronRight,Search,Shield,TrendingUp,User,Users,X} from "lucide-react";
import {getSupabase} from "@/lib/supabase";
import {statisticsQuery,queryOptions} from "@/lib/portal-query";
import {activityCacheEpoch,getCachedStatistics,setCachedStatistics} from "@/lib/activity-cache";
import {chartRows,lastStatisticsDay,orderedStatisticsSeries,shortDate,statisticsColors,statisticsSearch,type StatisticsResult,type StatisticsScope} from "@/lib/statistics";
import {usePortal} from "./portal-context";
import {SegmentedTabs} from "./segmented-tabs";
import {BottomDrawer} from "./mobile-drawer";
import {Pagination} from "./pagination";
import {StatisticsChartSkeleton,StatisticsSkeleton} from "./statistics-skeleton";
import {StatisticsBranches} from "./statistics-branches";

const StatisticsChart=dynamic(()=>import("./statistics-chart"),{ssr:false,loading:()=> <StatisticsChartSkeleton/>});
const selectionPageSize=5;
const number=(value:number)=>value.toLocaleString("vi-VN");
const labels:Record<StatisticsScope,string>={individuals:"cá nhân",groups:"nhóm nhỏ",divisions:"liên đoàn"};
const scopeIcons:Record<StatisticsScope,typeof User>={individuals:User,groups:Users,divisions:Shield};

export function StatisticsPanel() {
 const {session,members,groups}=usePortal();
 const [params,setParams]=useQueryStates(statisticsQuery,queryOptions);
 const {scope,period,mode,entities}=params,userId=(session?.user.id??"guest");
 const idsKey=entities.join(","),key=`${scope}|${period}|${idsKey}`;
 const [response,setResponse]=useState<{key:string;data:StatisticsResult}|null>(null);
 const [error,setError]=useState(""),[reload,setReload]=useState(0);
 const [hidden,setHidden]=useState<number[]>([]),[selectedDay,setSelectedDay]=useState<string|null>(null);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<number[]>([]),[search,setSearch]=useState(""),[page,setPage]=useState(1);
 const searchInput=useRef<HTMLInputElement>(null);
 const data=response?.key===key?response.data:null;
 useEffect(()=>{
  let canceled=false,inFlight=false;
  const load=async()=>{
   if(inFlight)return;inFlight=true;const epoch=activityCacheEpoch();
   try{
    const r=await getSupabase().rpc("get_activity_statistics",{stat_scope:scope,stat_period:period,entity_ids:idsKey?idsKey.split(",").map(Number):[]});
    if(canceled)return;
    if(r.error)throw r.error;
    const next=r.data as StatisticsResult;
    setCachedStatistics(userId,key,next,epoch);setResponse({key,data:next});setError("");
   }catch{if(!canceled)setError("Không tải được thống kê. Hãy thử lại hoặc chọn lại đối tượng.");}
   finally{inFlight=false;}
  };
  const start=setTimeout(()=>{setError("");const cached=getCachedStatistics(userId,key);if(cached)setResponse({key,data:cached});else void load();},0);
  const refresh=()=>{if(!document.hidden)void load();};
  const poll=setInterval(refresh,60_000);document.addEventListener("visibilitychange",refresh);
  return()=>{canceled=true;clearTimeout(start);clearInterval(poll);document.removeEventListener("visibilitychange",refresh);};
 },[scope,period,idsKey,key,userId,reload]);
 const choices=scope==="individuals"?members.map(m=>({id:m.strava_athlete_id,name:m.btn_name||m.strava_name,searchText:`${m.btn_name??''} ${m.strava_name}`,description:m.division_id?`LĐ ${m.division_id}${m.group_id?` · Nhóm ${m.group_id}`:""}`:"Chưa phân LĐ"})):scope==="groups"?groups.map(g=>({id:g.id,name:g.name,searchText:g.name,description:g.division_id?`LĐ ${g.division_id}`:"Chưa phân LĐ"})):[1,2,3,4,5].map(id=>({id,name:`LĐ ${id}`,searchText:`Liên đoàn ${id}`,description:""}));
 for(const series of data?.series??[])if(!choices.some(c=>c.id===series.id))choices.push({id:series.id,name:series.name,searchText:series.name,description:""});
 const terms=statisticsSearch(search).split(' ').filter(Boolean);
 const filtered=choices.filter(c=>{const text=statisticsSearch(`${c.name} ${c.searchText} ${c.id} ${c.description}`);return terms.every(term=>text.includes(term));});
 const selectedChoices=draft.flatMap(id=>{const choice=choices.find(c=>c.id===id);return choice?[choice]:[];});
 const pages=Math.max(1,Math.ceil(filtered.length/selectionPageSize)),current=Math.min(page,pages);
 const selectedIds=data?.series.map(s=>s.id)??(entities.length>0?entities:choices.slice(0,5).map(c=>c.id));
 const activeCount=entities.length>0?entities.length:(data?data.series.length:5);
 const rows=data?chartRows(data,mode):[];
 const lastDay=data?lastStatisticsDay(data):-1;
 const selectedIndex=data&&selectedDay&&data.days.includes(selectedDay)&&data.days.indexOf(selectedDay)<=lastDay?data.days.indexOf(selectedDay):lastDay;
 const selectedRow=rows[selectedIndex];
 const orderedSeries=data?orderedStatisticsSeries(data,selectedRow):[];
 const resetSelection=(next:StatisticsScope)=>{setHidden([]);setSelectedDay(null);void setParams({scope:next,entities:[]},{history:"push"});};
 const showPicker=()=>{setDraft(selectedIds);setSearch("");setPage(1);setOpen(true);};
 const ScopeIcon=scopeIcons[scope];
 return <section className="statistics-panel" aria-label="Thống kê bước đi bộ">
  <SegmentedTabs className="statistics-scope-tabs" ariaLabel="Loại thống kê" value={scope} onValueChange={resetSelection} items={[{value:"individuals",label:<span className="statistics-tab-label"><User size={16}/><span>Cá nhân</span></span>},{value:"groups",label:<span className="statistics-tab-label"><Users size={16}/><span>Nhóm nhỏ</span></span>},{value:"divisions",label:<span className="statistics-tab-label"><Shield size={16}/><span>Liên đoàn</span></span>}]}/>
  <div className="statistics-controls" data-scope={scope} role="group" aria-label={`Tùy chọn thống kê ${labels[scope]}`}>
   <StatisticsBranches scope={scope}/>
   <button type="button" className="statistics-picker picker-trigger statistics-picker-compact" aria-label={`Chọn ${labels[scope]} so sánh, đã chọn ${activeCount} trên 5`} aria-haspopup="dialog" aria-expanded={open} onClick={showPicker}><span><ScopeIcon size={16} className="statistics-picker-icon" aria-hidden="true"/><span>Chọn</span></span><span className="statistics-picker-badge">{activeCount}/5</span></button>
   <SegmentedTabs className="statistics-period-tabs" ariaLabel="Thời gian thống kê" value={period} onValueChange={period=>{setSelectedDay(null);void setParams({period},{history:"push"});}} items={[{value:"week",label:"Tuần này"},{value:"event",label:"Tất cả"}]}/>
  </div>
  {error&&<div className="portal-load-error" role="alert"><span>{error}</span><button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>Thử lại</button></div>}
  {!data&&!error&&<StatisticsSkeleton embed/>}
  {data&&<article className="statistics-card">
   <header><p className="muted">Bước đã duyệt · {data.series.length} {labels[scope]}</p><strong className="statistics-total">{number(data.series.reduce((sum,s)=>sum+s.total,0))}</strong><p className="statistics-period">{shortDate(data.start_date)}–{shortDate(data.end_date)} · {mode==="daily"?"Số bước mỗi ngày":"Số bước tích lũy"}</p></header>
   <SegmentedTabs className="statistics-mode-tabs" ariaLabel="Cách hiển thị biểu đồ" value={mode} onValueChange={mode=>void setParams({mode},{history:"push"})} items={[{value:"daily",label:<span className="statistics-tab-label"><Activity size={16} aria-hidden="true"/><span>Nhịp độ</span></span>},{value:"cumulative",label:<span className="statistics-tab-label"><TrendingUp size={16} aria-hidden="true"/><span>Tiến độ</span></span>}]}/>
   {data.series.length>0&&data.days.length>0?<><StatisticsChart data={data} mode={mode} hidden={hidden} selectedIndex={selectedIndex} onSelect={index=>setSelectedDay(data.days[index])}/>
    <div className="statistics-legend" aria-label="Đối tượng trên biểu đồ, vị trí cố định">{data.series.map((series,index)=><button key={series.id} type="button" title={series.name} aria-pressed={!hidden.includes(series.id)} disabled={!hidden.includes(series.id)&&data.series.filter(s=>!hidden.includes(s.id)).length===1} onClick={()=>setHidden(ids=>ids.includes(series.id)?ids.filter(id=>id!==series.id):[...ids,series.id])}><span className="statistics-legend-dot" style={{background:statisticsColors[index]}} aria-hidden="true"/><span className="statistics-legend-name">{series.name}</span></button>)}</div>
    {selectedIndex>=0?<section className="statistics-day" aria-label="Chi tiết số bước theo ngày"><header><button type="button" className="icon-button" aria-label="Ngày trước" disabled={selectedIndex===0} onClick={()=>setSelectedDay(data.days[selectedIndex-1])}><ChevronLeft size={18}/></button><h2>Ngày {shortDate(data.days[selectedIndex])}</h2><button type="button" className="icon-button" aria-label="Ngày sau" disabled={selectedIndex===lastDay} onClick={()=>setSelectedDay(data.days[selectedIndex+1])}><ChevronRight size={18}/></button></header>
     <table><caption className="sr-only">Số bước {mode==="daily"?"trong ngày":"tích lũy đến ngày"} {shortDate(data.days[selectedIndex])}, từ cao xuống thấp</caption><thead><tr><th scope="col">{scope==="individuals"?"Cá nhân":scope==="groups"?"Nhóm nhỏ":"Liên đoàn"}</th><th scope="col">{mode==="daily"?"Số bước":"Tích lũy"}</th></tr></thead><tbody>{orderedSeries.map(({series,index,value})=>!hidden.includes(series.id)&&<tr key={series.id}><th scope="row"><span className="statistics-dot" style={{background:statisticsColors[index]}} aria-hidden="true"/>{series.name}</th><td>{value===null?"—":number(Number(value))}</td></tr>)}</tbody></table>
    </section>:<p className="statistics-empty">Chưa có ngày hoàn tất trong khoảng đã chọn.</p>}</>:<p className="statistics-empty">{data.series.length?"Chưa có hoạt động đã duyệt trong khoảng đã chọn.":"Chưa có đối tượng để thống kê."}</p>}
   <p className="muted statistics-note">Chỉ tính bước thực tế đã duyệt đến hết hôm qua, không cộng thưởng đi chung. Chạm biểu đồ để xem từng ngày.</p>
  </article>}
  <BottomDrawer open={open} onOpenChange={setOpen} className="statistics-picker-drawer" title={`Chọn ${labels[scope]}`} description={`Đã chọn ${draft.length}/5`} footer={<button type="button" className="primary" disabled={!draft.length} onClick={()=>{setHidden([]);setSelectedDay(null);void setParams({entities:draft},{history:"push"});setOpen(false);}}>Xác nhận</button>}>
   <div className="statistics-selection" data-base-ui-swipe-ignore><div className="search-field"><Search size={18}/><input ref={searchInput} aria-label={`Tìm ${labels[scope]}`} aria-describedby="statistics-selection-limit" placeholder={scope==='individuals'?'Tìm tên hoặc Strava ID…':`Tìm ${labels[scope]}…`} enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck={false} value={search} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.blur();}}} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{search&&<button type="button" className="search-clear icon-button" aria-label="Xóa tìm kiếm thống kê" onClick={()=>{setSearch("");setPage(1);searchInput.current?.focus({preventScroll:true});}}><X size={18}/></button>}</div>
    <div className="statistics-selection-row"><div className="statistics-selected" role="group" aria-label="Đối tượng đã chọn">{selectedChoices.map(c=><button type="button" className="statistics-selected-chip" key={c.id} title={c.name} aria-label={`Bỏ chọn ${c.name}`} onClick={()=>setDraft(ids=>ids.filter(id=>id!==c.id))}><span>{c.name}</span><X size={14} aria-hidden="true"/></button>)}{!selectedChoices.length&&<span className="statistics-selection-empty">Chưa chọn</span>}</div><button type="button" className="text-button statistics-clear-selection" aria-label="Bỏ chọn tất cả" disabled={!draft.length} onClick={()=>setDraft([])}>Bỏ hết</button></div>
    <div className="statistics-selection-summary"><span aria-live="polite">{filtered.length} kết quả</span><span id="statistics-selection-limit">{draft.length>=5?'Đủ 5 mục. Bỏ chọn để thêm mới.':'Chọn tối đa 5 mục.'}</span></div>
    <div className="statistics-options" role="listbox" aria-multiselectable="true" aria-label={`Danh sách ${labels[scope]}`}>{filtered.slice((current-1)*selectionPageSize,current*selectionPageSize).map(c=><button type="button" role="option" aria-selected={draft.includes(c.id)} key={c.id} className="select-item" disabled={!draft.includes(c.id)&&draft.length>=5} onClick={()=>setDraft(ids=>ids.includes(c.id)?ids.filter(id=>id!==c.id):ids.length<5?[...ids,c.id]:ids)}><span>{c.name}{c.description&&<small>{c.description}</small>}</span><span className="select-item-indicator" aria-hidden="true">{draft.includes(c.id)&&<Check size={14}/>}</span></button>)}{!filtered.length&&<p className="muted statistics-note" role="status">{scope==='individuals'?'Không tìm thấy kết quả. Thử tên khác hoặc Strava ID.':'Không tìm thấy kết quả. Thử tên khác.'}</p>}</div>
    {pages>1&&<Pagination currentPage={current} totalPages={pages} onPageChange={setPage} ariaLabel="Phân trang chọn thống kê"/>}
   </div>
  </BottomDrawer>
 </section>;
}
