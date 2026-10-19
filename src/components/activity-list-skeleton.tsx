import type {CSSProperties} from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import {ActivityStatusRibbon} from "./activity-status-ribbon";
import type { Role } from "@/lib/portal-data";

export function ActivityListSkeleton({
  embed = false,
  userRole = "admin",
  count = 10,
  memberScope = "mine",
  variant = "activity",
  appealFilter = "",
}: {
  embed?: boolean;
  userRole?: Role;
  count?: number;
  memberScope?: "mine" | "club";
  variant?: "activity" | "incomplete";
  appealFilter?:string;
}) {
  const isUser = userRole === "user";
  const incomplete = variant === "incomplete";
  const cards = (
    <div className="activity-timeline" aria-hidden="true"><section className="activity-timeline-day"><header className="activity-timeline-heading"><span className="member-skeleton-block" style={{width:88,height:18}}/><span className="member-skeleton-block" style={{width:140,height:14}}/></header><div className="activity-card-list">
      {Array.from({ length: count }, (_, index) => (
        <article className={`activity-review-card activity-skeleton-card ${incomplete?"incomplete-post":""}`} key={index}>
          <header>
            <div className="activity-identity">
              <span className="member-chip member-skeleton-block activity-skeleton-chip" />
              <div>
                <h2><span className="member-skeleton-block activity-skeleton-author" style={{ width: index % 2 ? "120px" : "155px" }} /></h2>
                <p className="muted"><span className="member-skeleton-block activity-skeleton-text">21:08{isUser&&!incomplete&&" · Nhóm 4"}</span></p>
              </div>
            </div>
            <ActivityStatusRibbon loading/>
          </header>

          <div className="activity-title-row">
            <h3 style={{width:"100%"}}><span className="member-skeleton-block activity-skeleton-title" style={{ width: index % 2 ? "70%" : "85%" }} /></h3>
          </div>

          {incomplete?<p className="muted"><span className="member-skeleton-block activity-skeleton-text">Bài chưa hiển thị activity. Vui lòng bổ sung liên kết hoạt động trên Strava.</span></p>:<div className="activity-metrics">
            <div>
              <span className="member-skeleton-block activity-skeleton-text">Bước thực tế</span>
              <strong className="member-skeleton-block activity-skeleton-metric-val" />
            </div>
            <div>
              <span className="member-skeleton-block activity-skeleton-text">Đi chung</span>
              <strong className="member-skeleton-block activity-skeleton-metric-val" />
            </div>
            <div>
              <span className="member-skeleton-block activity-skeleton-text">{isUser?"Điểm đã duyệt":"Đã tính điểm"}</span>
              <strong className="member-skeleton-block activity-skeleton-metric-val" />
            </div>
          </div>}

          {!isUser&&!incomplete&&<div className="activity-flags"/>}
          {isUser&&!incomplete ? (
            <div className="member-activity-media-actions">
              <span className="member-skeleton-block activity-skeleton-action-icon" />
              <span className="member-skeleton-block activity-skeleton-action-icon" />
              <div className="member-activity-strava activity-skeleton-strava"><span className="member-skeleton-block" /></div>
            </div>
          ) : (
            <footer>
              <span className="member-skeleton-block activity-skeleton-action-icon" />
              <span className="member-skeleton-block activity-skeleton-action-icon" />
              {userRole==="admin"&&!incomplete&&<span className="member-skeleton-block activity-skeleton-action-icon" />}
              <span className="member-skeleton-block activity-skeleton-action-btn" />
            </footer>
          )}
        </article>
      ))}
    </div></section></div>
  );

  const content = (
    <div className="activity-embedded-skeleton" role="status" aria-label="Đang tải hoạt động" aria-busy="true">
      {isUser && !incomplete && !appealFilter && memberScope === "mine" && (
        <div className="member-activity-totals activity-skeleton-totals" aria-hidden="true">
          {["Điểm đã duyệt", "Điểm dự kiến · Chờ duyệt"].map(label => <div key={label}><span className="member-skeleton-block activity-skeleton-text">{label}</span><strong className="member-skeleton-block"/></div>)}
        </div>
      )}
      <p className={`muted ${isUser&&!incomplete?"permission-result-count":"result-count"}`} aria-hidden="true"><span className="member-skeleton-block activity-skeleton-count activity-skeleton-text">{incomplete?"10 bài cần bổ sung · Chưa đủ thông tin để duyệt":isUser?<>10 hoạt động{appealFilter?" đã khiếu nại":""}{!appealFilter&&memberScope==="mine"&&" · Điểm chờ duyệt chưa được cộng"}</>:"10 hoạt động · 100.000 bước đã duyệt"}</span></p>
      {cards}
    </div>
  );

  if (embed) return content;
  return (
    <section className={`${isUser?"member-activities":"activities-panel"} activity-list-skeleton`} role="status" aria-label="Đang tải hoạt động" aria-busy="true">
      {isUser ? (
        <div className="segmented-tabs" aria-hidden="true" style={{"--tab-count":2} as CSSProperties}>
          <span className="segmented-tabs-indicator" style={{transform:`translateX(${memberScope==="club"?100:0}%)`}}/>
          {["Của tôi","Hội thao"].map((label,index)=><button key={label} role="tab" disabled aria-selected={index===(memberScope==="club"?1:0)}>{label}</button>)}
        </div>
      ) : (
        <>
          <div className="segmented-tabs activity-status-tabs" aria-hidden="true" style={{"--tab-count":3} as CSSProperties}>
            {["Chờ duyệt", "Đã duyệt", "Cần bổ sung"].map(tab => (
              <button key={tab} disabled style={{ opacity: 1 }}>
                <span>{tab}</span>
                <span className="activity-tab-count">(<span className="member-skeleton-block" style={{width:18,height:10}}/>)</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className={isUser?"member-activity-tab-panel":"activity-skeleton-body"}>
      {isUser&&<p className="muted member-activity-period">04/10–15/11/2026 · Giờ Việt Nam</p>}
      <div className={`member-activity-search-row ${isUser?"":"activity-search-row"}`} aria-hidden="true">
        <div className="search-field"><Search size={18}/><input aria-label="Tìm hoạt động" placeholder="Tìm tên, thành viên hoặc activity ID…" disabled/></div>
        <button type="button" className="permission-filter-button" disabled><SlidersHorizontal size={17}/>Bộ lọc</button>
      </div>

      {content}
      </div>
    </section>
  );
}
