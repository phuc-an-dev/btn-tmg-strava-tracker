"use client";
import Image from "next/image";
import {useEffect,useState} from "react";
import {Copy,ClipboardPaste,Clock3,CheckCheck,ExternalLink,BookOpen} from "lucide-react";
import {usePortal} from "./portal-context";
import {getSupabase} from "@/lib/supabase";
import type {PostMedia} from "@/lib/post-media";
import {PostMediaBackground,PostMediaButton} from "./post-media";
import {BottomDrawer} from "./mobile-drawer";
import {ActivityStatusRibbon} from "./activity-status-ribbon";
import {Pagination} from "./pagination";
import {ActivityTimeline} from "./activity-timeline";
import {postVietnamTimestamp} from "@/lib/activity-timeline";
import {ActivityListSkeleton} from "./activity-list-skeleton";
export type IncompletePost={media?:PostMedia[];post_id:number;athlete_id:number;athlete_name:string;title:string;posted_at:string|null;division_id:number|null;group_id:number|null};
export function useIncompletePosts(scope:string,query:string,division:string,group="",page=1,active=true) {
 const {session}=usePortal(),userId=session?.user.id??"guest";
 const [rows,setRows]=useState<IncompletePost[]>([]),[total,setTotal]=useState(0),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{let canceled=false,inFlight=false;
 const load=async()=>{if(inFlight)return;inFlight=true;try{const r=await getSupabase().rpc("get_incomplete_post_page",{report_scope:scope,search_text:query,division_filter:division?Number(division):null,group_filter:group?Number(group):null,page_number:page,count_only:!active});if(canceled)return;setError(r.error?"Không tải được bài cần bổ sung.":"");if(!r.error){setRows(r.data.rows as IncompletePost[]);setTotal(r.data.total as number);}}finally{inFlight=false;if(!canceled)setLoading(false);}};
 const refresh=()=>{if(!document.hidden)void load();};
 const timer=setTimeout(()=>{setLoading(true);void load();},0),poll=setInterval(refresh,60000);
 document.addEventListener("visibilitychange",refresh);
 return()=>{canceled=true;clearTimeout(timer);clearInterval(poll);document.removeEventListener("visibilitychange",refresh);};},[scope,query,division,group,page,active,userId]);
 return {rows,total,error,loading};
}
export function IncompletePosts({rows,total,error,loading,page,onPageChange}:{rows:IncompletePost[];total:number;error:string;loading:boolean;page:number;onPageChange:(page:number)=>void}) {
 const [help,setHelp]=useState(false),pages=Math.max(1,Math.ceil(total/10)),current=Math.min(page,pages);
 useEffect(()=>{const timer=setTimeout(()=>{if(!loading&&page>pages)onPageChange(pages);},0);return()=>clearTimeout(timer);},[loading,page,pages,onPageChange]);
 if(loading&&!rows.length)return <ActivityListSkeleton embed variant="incomplete"/>;
 return <><p className="muted result-count result-summary">{loading?"Đang tải bài cần bổ sung…":<><strong>{total} bài cần bổ sung</strong> · Chưa đủ thông tin để duyệt</>}</p>{error&&<p role="alert" className="drawer-error">{error}</p>}<ActivityTimeline rows={rows} timestamp={r=>postVietnamTimestamp(r.posted_at)} kind="bài đăng" datePrefix="Ngày đăng " unknownLabel="Chưa xác định ngày đăng" renderCard={r=><article className="activity-review-card incomplete-post post-media-card" key={r.post_id}><PostMediaBackground media={r.media??[]}/><header><div className="activity-identity">{r.division_id&&<span data-division={r.division_id} className="member-chip assigned-chip">LĐ {r.division_id}</span>}<div><h2>{r.athlete_name||"Thành viên Strava"}</h2>{r.posted_at&&<p className="muted">{new Date(r.posted_at).toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"})}</p>}</div></div><ActivityStatusRibbon status="incomplete"/></header><div className="activity-title-row"><h3>{r.title||"Bài đăng Strava"}</h3></div><p className="muted">Bài chưa hiển thị activity. Vui lòng bổ sung liên kết hoạt động trên Strava.</p><footer><PostMediaButton media={r.media??[]} title={r.athlete_name}/><a className="activity-action-icon" aria-label={`Xem bài Strava: ${r.title}`} title="Xem bài Strava" href={`https://www.strava.com/clubs/2368312/posts/${r.post_id}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/></a><button type="button" className="primary" onClick={()=>setHelp(true)}><BookOpen size={18}/>Hướng dẫn</button></footer></article>}/>{!loading&&!error&&!total&&<p className="goal-card">Không có bài cần bổ sung.</p>}{total>10&&<Pagination currentPage={current} totalPages={pages} onPageChange={onPageChange} pageSize={10} ariaLabel="Phân trang bài cần bổ sung"/>}<BottomDrawer open={help} onOpenChange={setHelp} title="Cách chia sẻ hoạt động" footer={<button className="primary" onClick={()=>setHelp(false)}>Đã hiểu</button>}><div className="drawer-form-body"><ol className="activity-post-guide">{[
 {icon:Copy,title:"Sao chép link hoạt động",text:"Mở hoạt động trên Strava và sao chép liên kết hoạt động."},
 {icon:ClipboardPaste,title:"Dán link và nhấn Enter",text:"Dán liên kết vào bài đăng trong nhóm, sau đó nhấn Enter."},
 {icon:Clock3,title:"Chờ thẻ activity xuất hiện",text:"Chờ khoảng 2–3 giây. Nếu chưa thấy thẻ thông tin hoạt động, tiếp tục chờ và kiểm tra liên kết."},
 {icon:CheckCheck,title:"Kiểm tra rồi lưu bài",text:"Chỉ lưu khi thẻ activity đã hiển thị. Chỉ đăng ảnh sẽ chưa đủ thông tin để duyệt."},
].map(({icon:Icon,title,text},index)=><li key={title}><span className="activity-guide-icon" aria-hidden="true"><Icon size={19}/></span><div><span className="activity-guide-step">Bước {index+1}</span><h3>{title}</h3><p>{text}</p>{index===2&&<figure className="activity-guide-example"><Image src="/revive/strava-activity-preview.jpg" alt="Ví dụ trên Strava: sau khi dán link, thẻ hoạt động Ld2_1_708 có ảnh bản đồ và dòng STRAVA.COM đã xuất hiện." width={1075} height={1280} sizes="(max-width: 600px) 75vw, 420px"/><figcaption>Ví dụ: thẻ có ảnh bản đồ, tên hoạt động và dòng STRAVA.COM đã xuất hiện. Kiểm tra thẻ rồi nhấn Publish để đăng bài.</figcaption></figure>}</div></li>)}</ol><p className="muted activity-guide-note">Sau khi sửa bài, dữ liệu sẽ cập nhật ở lần đồng bộ tiếp theo.</p></div></BottomDrawer></>;
}
