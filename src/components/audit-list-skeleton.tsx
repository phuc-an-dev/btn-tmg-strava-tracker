import { ArrowRight, Search } from "lucide-react";

export function AuditListSkeleton({
  embed = false,
  count = 5,
}: {
  embed?: boolean;
  count?: number;
}) {
  const cards = (
    <div className="audit-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="audit-card audit-skeleton-card" key={index}>
          <div className="audit-card-top">
            <span className="member-skeleton-block audit-skeleton-badge" style={{ width: index % 2 ? "140px" : "115px" }} />
            <span className="member-skeleton-block audit-skeleton-time" />
          </div>

          <div className="audit-parties-flow">
            <div className="audit-party">
              <span className="audit-avatar member-skeleton-block" style={{ width: 30, height: 30, borderRadius: "50%" }} />
              <span className="member-skeleton-block audit-skeleton-name" style={{ width: 85 }} />
            </div>
            <ArrowRight size={14} className="audit-flow-arrow" aria-hidden="true" style={{ opacity: 0.3 }} />
            <div className="audit-party">
              <span className="audit-avatar member-skeleton-block" style={{ width: 30, height: 30, borderRadius: "50%" }} />
              <span className="member-skeleton-block audit-skeleton-name" style={{ width: 95 }} />
            </div>
          </div>

          <div className="audit-transition-pill">
            <span className="member-skeleton-block audit-skeleton-desc" style={{ width: index % 2 ? "75%" : "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (embed) return cards;

  return (
    <section className="audit-panel audit-list-skeleton" role="status" aria-label="Đang tải lịch sử Audit" aria-busy="true">
      <div className="member-filters" aria-hidden="true">
        <div className="search-field">
          <Search size={18} />
          <input aria-label="Tìm Audit" placeholder="Tìm ID thành viên hoặc activity…" disabled />
        </div>
        <button className="picker-trigger member-filter-picker" disabled style={{ opacity: 1 }}>
          <span>Bộ lọc</span>
        </button>
      </div>

      <p className="audit-status-line" aria-hidden="true" style={{ margin: "14px 0" }}>
        <span className="member-skeleton-block member-skeleton-count" style={{ width: 95 }} />
      </p>

      {cards}
    </section>
  );
}
