import {ChevronDown,Search} from "lucide-react";

export function MemberListSkeleton({showAssignActions=false}:{showAssignActions?:boolean}) {
 return <section className="member-list-skeleton" role="status" aria-label="Đang tải danh sách thành viên" aria-busy="true">
  <div className="member-filters">
   <div className="search-field"><Search size={18} aria-hidden="true"/><input aria-label="Tìm thành viên" placeholder="Tìm tên hoặc Strava ID…" disabled/></div>
   <button className="picker-trigger member-filter-picker" disabled><span>Bộ lọc</span><ChevronDown size={18} aria-hidden="true"/></button>
  </div>
  <p className="muted result-count" aria-hidden="true"><span className="member-skeleton-block member-skeleton-count"/></p>
  <div className="member-list member-card-list" aria-hidden="true">
   {Array.from({length:6},(_,index)=><article className="member-card member-skeleton-card" key={index}>
    <span className="member-avatar member-skeleton-block"/>
    <div className="member-details"><div className="member-heading"><span className="member-skeleton-block member-skeleton-name" style={{width:index%2?"45%":"58%"}}/><span className="member-chip member-skeleton-block member-skeleton-badge"/></div><p><span className="member-skeleton-block member-skeleton-id"/></p></div>
    <div className="member-actions"><span className="member-skeleton-block member-skeleton-action"/>{showAssignActions&&<span className="member-skeleton-block member-skeleton-action"/>}</div>
   </article>)}
  </div>
 </section>;
}
