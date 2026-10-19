export function GroupsSkeleton() {
  return (
    <section className="groups-skeleton" role="status" aria-label="Đang tải nhóm nhỏ" aria-busy="true">
      <p className="muted division-note" aria-hidden="true" style={{ margin: "0 0 16px" }}>
        <span className="member-skeleton-block" style={{ width: 280, height: 16 }} />
      </p>

      <div className="division-grid" aria-hidden="true">
        {[1, 2, 3, 4].map(id => (
          <article className="division-card division-skeleton-card" key={id}>
            <header>
              <span className="division-icon member-skeleton-block" style={{ width: 36, height: 36, borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <span className="member-skeleton-block" style={{ width: 110, height: 18, marginBottom: 4 }} />
                <span className="member-skeleton-block" style={{ width: 130, height: 13 }} />
              </div>
            </header>

            {[1, 2].map(grp => (
              <div key={grp} className="division-group" style={{ padding: "14px 16px" }}>
                <div className="division-group-heading">
                  <span className="member-skeleton-block" style={{ width: 80, height: 16 }} />
                  <span className="member-skeleton-block" style={{ width: 70, height: 13 }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <span className="member-skeleton-block" style={{ width: "100%", height: 42, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
