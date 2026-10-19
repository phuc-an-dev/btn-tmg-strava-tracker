"use client";
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {useQueryStates,debounce} from "nuqs";
import {adminActivitiesQuery,queryOptions,useDebouncedSearch} from "@/lib/portal-query";
import {ExternalLink,Check,Eye,Pencil,Search,SlidersHorizontal,X} from "lucide-react";
import {IncompletePosts,useIncompletePosts} from "./incomplete-posts";
import {PostMediaBackground,PostMediaButton} from "./post-media";
import {Pagination} from "./pagination";
import {ActivityAppealControl,useActivityAppeals} from "./activity-appeal";
import type {ActivityAppealState} from "@/lib/activity-appeals";
import {ActivityAssignment} from "./activity-assignment";
import {ActivityStatusRibbon} from "./activity-status-ribbon";
import {ActivityTimeline} from "./activity-timeline";
import {ActivityListSkeleton} from "./activity-list-skeleton";
import {getSupabase} from "@/lib/supabase";
import {type ClubActivity,type ActivityStatus,inEvent,proposedPoints,statusLabels} from "@/lib/activity-data";
import {getCachedAdminActivities,setCachedAdminActivities,invalidateActivityData,activityCacheEpoch,type AdminActivityResult} from "@/lib/activity-cache";
import {useAuthenticatedPortal} from "./portal-context";
import type {Member} from "@/lib/portal-data";
import {BottomDrawer} from "./mobile-drawer";
import {useAppToast} from "./app-toast";
import {SegmentedTabs} from "./segmented-tabs";
import {SelectItem} from "./select-item";
const number=(value:number|null)=>value===null?"Chưa có":value.toLocaleString("vi-VN");
const warningLabels:Record<string,string>={missing_steps:"Thiếu bước Strava",missing_group_code:"Thiếu cú pháp đi chung",declared_steps_mismatch:"Bước tự khai khác Strava",conflicting_group_code:"Cú pháp mâu thuẫn",conflicting_steps:"Số bước mâu thuẫn",ambiguous_post_stats:"Nhiều activity trong một bài",missing_athlete:"Thiếu người thực hiện",missing_activity_date:"Thiếu ngày",invalid_people_count:"Số người không hợp lệ"};
export function ActivityPanel({members,userRole="admin",userDivision=null}:{members:Member[];userRole?:"admin"|"leader"|"user";userDivision?:number|null}) {
 const isAdmin=userRole==="admin";
 const {add:toast}=useAppToast();
 const {session}=useAuthenticatedPortal(),userId=session.user.id;
 const parsers=useMemo(()=>({...adminActivitiesQuery,division:adminActivitiesQuery.division.withDefault((userRole==="leader"&&userDivision?String(userDivision):"") as ""|"1"|"2"|"3"|"4"|"5")}),[userRole,userDivision]);
 const [params,setParams]=useQueryStates(parsers,queryOptions);
 const filter=params.status,page=params.page,divisionFilter=params.division;
 const [filterOpen,setFilterOpen]=useState(false),[draftDivision,setDraftDivision]=useState(divisionFilter);
 const input=params.q,query=useDebouncedSearch(input);
 const reports=useIncompletePosts("club",query,divisionFilter,"",page,filter==="incomplete");
 const cacheKey=`${filter}|${divisionFilter}|${page}|${query}`;
 const cached=getCachedAdminActivities(userId,cacheKey);
 const [result,setResult]=useState<AdminActivityResult>(cached??{rows:[],total:0,counts:{pending:0,approved:0,rejected:0},approved_points:0});
 const {rows,counts}=result;
 const [loading,setLoading]=useState(!cached),[error,setError]=useState(""),[detailLoading,setDetailLoading]=useState(false);
 const setInput=(q:string)=>void setParams({q,page:1},{history:"replace",limitUrlUpdates:q?debounce(300):undefined});
 const setPage=(page:number)=>void setParams({page},{history:"push"});
 const [selected,setSelected]=useState<ClubActivity|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState("");
 const appeals=useActivityAppeals(filter==="incomplete"?[]:rows.map(r=>r.activity_id));
 const generation=useRef(0),detailRequest=useRef(0);
 useEffect(()=>()=>{detailRequest.current++;},[]);
 const load=useCallback(async(background=false,force=false)=>{
  const version=++generation.current,epoch=activityCacheEpoch();
  if(input!==query)return;
  const cached=!force?getCachedAdminActivities(userId,cacheKey):undefined;
  if(cached){setResult(cached);setLoading(false);setError("");return;}
  if(!background){setLoading(true);setResult(previous=>({...previous,rows:[],total:0}));}
  setError("");
  try{
   const r=await getSupabase().rpc("get_review_activity_page",{search_text:query,status_filter:filter==="incomplete"?"pending":filter,count_only:filter==="incomplete",division_filter:divisionFilter?Number(divisionFilter):null,page_number:page});
   if(r.error)throw new Error(r.error.message);
   if(version===generation.current){const data=r.data as AdminActivityResult;setResult(data);setCachedAdminActivities(userId,cacheKey,data,epoch);}
  }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:"Không tải được activities.");}
  finally{if(version===generation.current)setLoading(false);}
 },[filter,input,query,userId,cacheKey,divisionFilter,page]);
 useEffect(()=>{const guard=generation;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);guard.current++;};},[load]);
 useEffect(()=>{
  const refresh=()=>{if(!document.hidden&&!busy&&!selected&&!detailLoading)void load(true,true);};
  const timer=setInterval(refresh,60000);document.addEventListener("visibilitychange",refresh);
  return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};
 },[load,busy,selected,detailLoading]);
 const visible=rows,pages=Math.max(1,Math.ceil(result.total/10)),current=Math.min(page,pages);
 useEffect(()=>{const timer=setTimeout(()=>{if(filter!=="incomplete"&&!loading&&input===query&&page>pages)void setParams({page:pages},{history:"replace"});},0);return()=>clearTimeout(timer);},[filter,loading,input,query,page,pages,setParams]);
 async function openActivity(row:ClubActivity){
  const version=++detailRequest.current;setDetailLoading(true);setSelected(null);setFormError("");
  const r=await getSupabase().from("club_activities").select("*").eq("activity_id",row.activity_id).single();
  if(version!==detailRequest.current)return;
  setDetailLoading(false);
  if(r.error){setError("Không tải được chi tiết hoạt động. Vui lòng thử lại.");return;}
  setSelected(r.data as ClubActivity);
 }
 async function review(event:FormEvent<HTMLFormElement>,decision:ActivityStatus){
  event.preventDefault();if(!selected)return;const d=new FormData(event.currentTarget);setBusy(true);setFormError("");
  try{const r=await getSupabase().rpc("review_club_activity",{target_id:selected.activity_id,expected_revision:selected.revision,new_steps:d.get("steps")===""?null:Number(d.get("steps")),new_people:d.get("people")===""?null:Number(d.get("people")),new_division:selected.division_id,new_note:String(d.get("note")??""),new_rejection_reason:String(d.get("rejection_reason")??""),decision});if(r.error)throw new Error(r.error.message);setSelected(null);invalidateActivityData();await load(false,true);toast({title:decision==="approved"?"Đã duyệt activity.":decision==="rejected"?"Đã từ chối activity.":"Đã lưu · activity chờ duyệt lại.",type:"success",timeout:2000});}
  catch(e){setFormError(e instanceof Error?e.message:"Không lưu được.");}finally{setBusy(false);}
 }
 return <section className="activities-panel" aria-label="Hoạt động đi bộ">
  {userRole==="leader"&&userDivision&&<div className="activity-toolbar"><div><span data-division={userDivision} className="member-chip assigned-chip">Liên đoàn {userDivision}</span></div></div>}
  <SegmentedTabs id="activity-status-tabs" className="activity-status-tabs" ariaLabel="Trạng thái hoạt động" value={filter} onValueChange={status=>{void setParams({status,page:1},{history:"push"});}} items={([
   {value:"pending",label:<><span>Chờ duyệt</span><span className="activity-tab-count">({counts.pending})</span></>},
   {value:"approved",label:<><span>Đã duyệt</span><span className="activity-tab-count">({counts.approved})</span></>},
   {value:"incomplete",label:<><span>Cần bổ sung</span><span className="activity-tab-count">({reports.total})</span></>},
  ] as const)}/>
  <div className="member-activity-search-row activity-search-row"><div className="search-field"><Search size={18}/><input aria-label="Tìm hoạt động" maxLength={200} placeholder="Tìm tên, thành viên hoặc activity ID…" value={input} onChange={e=>setInput(e.target.value)}/>{input&&<button className="search-clear icon-button" aria-label="Xóa tìm hoạt động" onClick={()=>setInput("")}><X size={18}/></button>}</div><button type="button" className="permission-filter-button" aria-expanded={filterOpen} aria-haspopup="dialog" onClick={()=>{setDraftDivision(divisionFilter);setFilterOpen(true);}}><SlidersHorizontal size={17}/>Bộ lọc{divisionFilter&&<span className="activity-filter-dot" aria-label="Đang lọc"/>}</button></div>
  {appeals.error&&<div className="portal-load-error" role="alert"><span>{appeals.error}</span><button type="button" className="text-button" onClick={appeals.refresh}>Thử lại</button></div>}{detailLoading&&<p className="muted" role="status">Đang tải chi tiết…</p>}{error&&<p className="drawer-error" role="alert">{error}</p>}{filter==="incomplete"?<IncompletePosts {...reports} page={page} onPageChange={setPage}/>:loading&&!rows.length?<ActivityListSkeleton embed userRole={userRole}/>:<><p className="muted result-count result-summary"><strong>{result.total} hoạt động</strong> · <strong className="summary-total">{number(result.approved_points)}</strong> bước đã duyệt</p><ActivityTimeline rows={visible} timestamp={r=>r.start_local} renderCard={r=>{
   const member=members.find(m=>m.strava_athlete_id===r.athlete_id);
   const warnings=[...(r.people_count===null?["Số người chưa xác định"]:[]),...(r.source.warnings??[]).filter(w=>!['not_walk','outside_event_period'].includes(w)),...(!member?["Chưa có trong danh sách thành viên"]:!member.group_id?["Thành viên chưa phân nhóm"]:r.status!=="approved"&&r.division_id!==member.division_id?[r.division_id?"LĐ từ tiêu đề khác phân công":"Chưa xác định LĐ từ tiêu đề"]:[])];
   return <article className="activity-review-card post-media-card" key={r.activity_id}><PostMediaBackground media={r.media??[]}/><header><div className="activity-identity">{r.division_id&&<span data-division={r.division_id} className="member-chip assigned-chip">LĐ {r.division_id}</span>}<div><h2>{member?.btn_name||r.athlete_name}</h2><p className="muted">{r.start_local.slice(11,16)}{r.group_id&&` · Nhóm ${r.group_id}`}</p></div></div><ActivityStatusRibbon status={r.status}/></header><div className="activity-title-row"><h3>{r.name}</h3></div><div className="activity-metrics"><div><span>Bước thực tế</span><strong>{number(r.steps)}</strong></div><div><span>Đi chung</span><strong>{r.people_count===null?"Chưa có":`${r.people_count} người`}</strong></div><div><span>{r.status==="approved"?"Đã tính điểm":"Dự kiến"}</span><strong>{number(r.status==="approved"?r.points:proposedPoints(r.steps,r.people_count))}</strong></div></div><div className="activity-flags">{warnings.map(w=><span key={w}>{warningLabels[w]??w}</span>)}</div><footer><PostMediaButton media={r.media??[]} title={r.athlete_name}/><a className="activity-action-icon" href={`https://www.strava.com/activities/${r.activity_id}`} target="_blank" rel="noopener noreferrer" aria-label={`Xem Strava: ${r.name}`} title="Xem Strava"><ExternalLink size={18}/></a>{isAdmin?<><button className="text-button activity-action-icon" aria-label={`Chỉnh sửa: ${r.name}`} title="Chỉnh sửa" disabled={detailLoading} onClick={()=>void openActivity(r)}><Pencil size={18}/></button><button className="primary" disabled={detailLoading} onClick={()=>void openActivity(r)}><Check size={15}/>Duyệt</button></>:<button className="primary text-button" style={{minWidth:84}} disabled={detailLoading} onClick={()=>void openActivity(r)}><Eye size={15}/>Chi tiết</button>}</footer><ActivityAppealControl state={appeals.states.get(r.activity_id)} onChanged={appeals.refresh}/></article>;
  }}/>{!visible.length&&!loading&&<p className="goal-card">Không có hoạt động phù hợp.</p>}{result.total>0&&<Pagination currentPage={current} totalPages={pages} onPageChange={setPage} pageSize={10} ariaLabel="Phân trang hoạt động"/>}</>}

  <BottomDrawer open={filterOpen} onOpenChange={setFilterOpen} title="Bộ lọc hoạt động" footer={<button type="button" className="primary" onClick={()=>{void setParams({division:draftDivision,page:1},{history:"push"});setFilterOpen(false);}}>Xác nhận</button>}><div className="drawer-options" role="listbox" aria-label="Lọc theo liên đoàn" data-base-ui-swipe-ignore>{[{value:"",label:"Tất cả LĐ"},...[1,2,3,4,5].map(d=>({value:String(d),label:`LĐ ${d}${userRole==="leader"&&userDivision===d?" (Của tôi)":""}`}))].map(option=><SelectItem key={option.value} label={option.label} selected={draftDivision===option.value} onSelect={()=>setDraftDivision(option.value as typeof divisionFilter)}/>)}</div></BottomDrawer>
  <BottomDrawer open={!!selected} onOpenChange={open=>{if(!open&&!busy)setSelected(null);}} title={isAdmin?"Kiểm tra hoạt động":"Chi tiết hoạt động"} description={selected?.athlete_name} busy={busy} footer={false}>{selected&&(isAdmin?<ReviewForm key={`${selected.activity_id}-${selected.revision}`} row={selected} appealState={appeals.states.get(selected.activity_id)} onAppealChanged={appeals.refresh} member={members.find(m=>m.strava_athlete_id===selected.athlete_id)} busy={busy} error={formError} onCancel={()=>setSelected(null)} onSubmit={review}/>:<ActivityDetailView row={selected} appealState={appeals.states.get(selected.activity_id)} onAppealChanged={appeals.refresh} member={members.find(m=>m.strava_athlete_id===selected.athlete_id)} onCancel={()=>setSelected(null)}/>)}</BottomDrawer>
 </section>;
}
function ReviewForm({row,member,busy,error,onCancel,onSubmit,appealState,onAppealChanged}:{appealState:ActivityAppealState|undefined;onAppealChanged:()=>void;row:ClubActivity;member:Member|undefined;busy:boolean;error:string;onCancel:()=>void;onSubmit:(e:FormEvent<HTMLFormElement>,decision:ActivityStatus)=>Promise<void>}) {
 const [steps,setSteps]=useState(row.steps===null?"":String(row.steps)),[people,setPeople]=useState(row.people_count===null?"":String(row.people_count));

 const canApprove=!!member?.active&&!!member.group_id&&!!member.division_id&&inEvent(row)&&steps!==""&&Number.isInteger(Number(steps))&&Number(steps)>=0&&Number(steps)<=1000000&&people!==""&&Number.isInteger(Number(people))&&Number(people)>=1&&Number(people)<=100;
 return <form className="drawer-form" onSubmit={e=>{const button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;void onSubmit(e,(button?.value??"pending") as ActivityStatus);}}><div className="drawer-form-body" data-base-ui-swipe-ignore>
  <p><strong>{row.name}</strong></p><p className="muted">ID {row.activity_id} · Bước gốc Strava: {number(row.source_steps)}</p>
  {row.source.source_posts?.map(p=><details className="activity-source" key={p.post_id}><summary>Bài đăng nguồn · {p.post_id}</summary><p>{p.body}</p></details>)}
  <PostMediaButton media={row.media??[]} title={row.athlete_name}/><ActivityHistory id={row.activity_id}/><ActivityAppealControl state={appealState} onChanged={onAppealChanged}/>
  <label htmlFor="review-steps">Số bước thực tế</label><input id="review-steps" name="steps" type="number" inputMode="numeric" min={0} max={1000000} step={1} value={steps} onChange={e=>setSteps(e.target.value)} disabled={busy}/>
  <label htmlFor="review-people">Số người đi chung (gồm người tạo activity)</label><input id="review-people" name="people" type="number" inputMode="numeric" min={1} max={100} step={1} value={people} onChange={e=>setPeople(e.target.value)} disabled={busy}/>
  <ActivityAssignment row={row} member={member} review/>
  <label htmlFor="review-note">Ghi chú kiểm tra</label><textarea id="review-note" name="note" maxLength={2000} defaultValue={row.note} placeholder="Bắt buộc ghi nguồn đối chiếu nếu sửa hoặc bổ sung số bước" disabled={busy}/>
  <label htmlFor="review-rejection-reason">Lý do từ chối · Hiển thị cho thành viên</label><textarea id="review-rejection-reason" name="rejection_reason" maxLength={1000} defaultValue={row.rejection_reason??""} placeholder="Nhập lý do và nội dung thành viên cần bổ sung khi từ chối" disabled={busy}/>
  <p>Dự kiến: <strong>{number(proposedPoints(steps===""?null:Number(steps),people===""?null:Number(people)))} bước</strong></p>
  {!inEvent(row)&&<p className="drawer-error">Ngoài kỳ hội thao hoặc không phải Walk; không thể duyệt.</p>}{error&&<p className="drawer-error" role="alert">{error}</p>}
  <div className="review-secondary"><button type="submit" value="pending" disabled={busy}>Lưu chờ duyệt</button><button type="submit" value="rejected" disabled={busy}>Từ chối</button></div>
 </div><footer className="drawer-footer drawer-actions"><button type="button" className="drawer-cancel" disabled={busy} onClick={onCancel}>Hủy</button><button type="submit" className="primary" value="approved" disabled={busy||!canApprove}>{busy?"Đang lưu…":"Xác nhận duyệt"}</button></footer></form>;
}
function ActivityHistory({id}:{id:number}) {
 const [history,setHistory]=useState<{created_at:string;before_data:ClubActivity|null;after_data:ClubActivity&{appeal_resolution?:string}}[]>([]);
 const [error,setError]=useState(false);
 useEffect(()=>{let canceled=false;void getSupabase().from("audit_log").select("created_at,before_data,after_data").eq("action","review_activity").eq("entity_id",String(id)).order("created_at",{ascending:false}).limit(10).then(r=>{if(!canceled){if(r.error)setError(true);else setHistory(r.data as typeof history);}});return()=>{canceled=true;};},[id]);
 return <details className="activity-source"><summary>Lịch sử kiểm tra</summary>{error?<p>Không tải được lịch sử.</p>:!history.length?<p className="muted">Chưa có lần kiểm tra nào.</p>:history.map((h,i)=><p key={`${h.created_at}-${i}`}>{new Date(h.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})} · {statusLabels[h.after_data.status]} · {number(h.after_data.steps)} bước · {h.after_data.people_count??"?"} người{h.after_data.appeal_resolution?` · Xử lý khiếu nại: ${h.after_data.appeal_resolution}`:h.after_data.note?` · ${h.after_data.note}`:""}</p>)}</details>;
}

function ActivityDetailView({row,member,onCancel,appealState,onAppealChanged}:{appealState:ActivityAppealState|undefined;onAppealChanged:()=>void;row:ClubActivity;member:Member|undefined;onCancel:()=>void}) {
 const warnings=[...(row.people_count===null?["Số người chưa xác định"]:[]),...(row.source.warnings??[]).filter(w=>!['not_walk','outside_event_period'].includes(w)),...(!member?["Chưa có trong danh sách thành viên"]:!member.group_id?["Thành viên chưa phân nhóm"]:row.status!=="approved"&&row.division_id!==member.division_id?[row.division_id?"LĐ từ tiêu đề khác phân công":"Chưa xác định LĐ từ tiêu đề"]:[])];
 return <div className="drawer-form-body" data-base-ui-swipe-ignore><p><strong>{row.name}</strong></p><p className="muted">ID {row.activity_id} · Người thực hiện: {member?.btn_name||row.athlete_name}</p><ActivityAssignment row={row} member={member}/><div className="activity-metrics" style={{margin:"14px 0"}}><div><span>Bước thực tế</span><strong>{number(row.steps)}</strong></div><div><span>Đi chung</span><strong>{row.people_count===null?"Chưa có":`${row.people_count} người`}</strong></div><div><span>{row.status==="approved"?"Điểm đã tính":"Điểm dự kiến"}</span><strong>{number(row.status==="approved"?row.points:proposedPoints(row.steps,row.people_count))}</strong></div></div>{row.note&&<div style={{background:"#f8fafc",padding:"10px 14px",borderRadius:"10px",margin:"10px 0"}}><p style={{margin:0,fontSize:"13px"}}><strong>Ghi chú kiểm tra:</strong> {row.note}</p></div>}{warnings.length>0&&<div className="activity-flags" style={{margin:"12px 0"}}>{warnings.map(w=><span key={w}>{warningLabels[w]??w}</span>)}</div>}{row.source.source_posts?.map(p=><details className="activity-source" key={p.post_id}><summary>Bài đăng nguồn · {p.post_id}</summary><p>{p.body}</p></details>)}<PostMediaButton media={row.media??[]} title={row.athlete_name}/><ActivityHistory id={row.activity_id}/><ActivityAppealControl state={appealState} onChanged={onAppealChanged}/><footer className="drawer-footer" style={{marginTop:20}}><button type="button" className="primary full-width" onClick={onCancel}>Đóng</button></footer></div>;
}
