export function DivisionSkeleton() {
  return (
    <section className="my-division-view division-skeleton" role="status" aria-label="Đang tải liên đoàn" aria-busy="true">
      {/* Khối thành viên chưa phân nhóm */}
      <article className="division-unassigned-card" aria-hidden="true">
        <header className="division-section-title">
          <span className="member-skeleton-block" style={{ width: 90, height: 22, borderRadius: 12 }} />
          <span className="member-skeleton-block" style={{ width: 170, height: 18 }} />
        </header>
        <div className="member-mini-list">
          {[0, 1].map(index => (
            <div key={index} className="member-mini-row">
              <div style={{ flex: 1 }}>
                <span className="member-skeleton-block" style={{ width: index ? "130px" : "150px", height: 16, marginBottom: 4 }} />
                <span className="member-skeleton-block" style={{ width: 100, height: 12 }} />
              </div>
              <span className="member-skeleton-block" style={{ width: 78, height: 32, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </article>

      {/* Cơ cấu nhóm nhỏ */}
      <div className="division-groups-breakdown" aria-hidden="true" style={{ marginTop: 20 }}>
        <span className="member-skeleton-block" style={{ width: 220, height: 20, marginBottom: 12 }} />
        <div className="division-grid" style={{ marginTop: 12 }}>
          {[0, 1].map(cardIdx => (
            <article className="division-card division-skeleton-card" key={cardIdx}>
              <header>
                <span className="division-icon member-skeleton-block" style={{ width: 36, height: 36, borderRadius: 10 }} />
                <div style={{ flex: 1 }}>
                  <span className="member-skeleton-block" style={{ width: cardIdx ? "110px" : "130px", height: 18, marginBottom: 4 }} />
                  <span className="member-skeleton-block" style={{ width: 75, height: 13 }} />
                </div>
              </header>
              <div className="group-members-chips">
                {[75, 95, 80, 110, 85, 100].map((w, chipIdx) => (
                  <span
                    key={chipIdx}
                    className="member-tag member-skeleton-block"
                    style={{ width: `${w}px`, height: 32, border: "none" }}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
