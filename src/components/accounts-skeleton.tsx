import { Search, SlidersHorizontal } from "lucide-react";

export function AccountsSkeleton({
  embed = false,
  count = 4,
}: {
  embed?: boolean;
  count?: number;
}) {
  const cards = (
    <div className="permission-card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="permission-card registration-card permission-skeleton-card" key={index}>
          <header>
            <span className="permission-avatar member-skeleton-block" style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <div className="permission-identity">
              <span className="member-skeleton-block permission-skeleton-name" style={{ width: index % 2 ? "110px" : "145px" }} />
              <span className="member-skeleton-block permission-skeleton-email" />
            </div>
            <span className="member-skeleton-block permission-skeleton-role" />
          </header>

          <dl className="registration-info">
            {[0,1].map(n=><div key={n}><span className="member-skeleton-block" style={{width:"65%",height:12,marginBottom:6}}/><span className="member-skeleton-block" style={{width:"80%",height:16}}/></div>)}
          </dl>
          <div className="registration-strava"><span className="member-skeleton-block" style={{width:"65%",height:36}}/></div>
          <p className="registration-date"><span className="member-skeleton-block" style={{width:145,height:13}}/></p>

          <footer>
            <span className="member-skeleton-block permission-skeleton-action" />
            <span className="member-skeleton-block permission-skeleton-action" />
          </footer>
        </article>
      ))}
    </div>
  );

  if (embed) return cards;

  return (
    <section className="permissions-panel accounts-skeleton" role="status" aria-label="Đang tải hồ sơ đăng ký" aria-busy="true">
      <div className="segmented-tabs registration-tabs" style={{gridTemplateColumns:"1fr 1fr"}} aria-hidden="true">{[0,1].map(n=><span key={n} className="member-skeleton-block" style={{width:"65%",height:18,margin:"13px auto"}}/>)}</div>
      <div className="permission-filters" aria-hidden="true">
        <div className="search-field">
          <Search size={18} />
          <input aria-label="Tìm tài khoản" placeholder="Tìm tên hoặc email…" disabled />
        </div>
        <button className="permission-filter-button" disabled style={{ opacity: 1 }}>
          <SlidersHorizontal size={17} />
          Bộ lọc
        </button>
      </div>

      <p className="muted permission-result-count" aria-hidden="true" style={{ margin: "14px 0" }}>
        <span className="member-skeleton-block member-skeleton-count" style={{ width: 90 }} />
      </p>

      {cards}
    </section>
  );
}
