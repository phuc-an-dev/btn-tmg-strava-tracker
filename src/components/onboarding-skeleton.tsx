import { ReviveHeader } from "./revive-header";

export function OnboardingSkeleton() {
  return (
    <div className="app-shell revive-shell onboarding-shell" role="status" aria-label="Đang tải trạng thái tài khoản" aria-busy="true">
      <ReviveHeader showAbout={false} />
      <main className="onboarding-main">
        <div className="onboarding-card onboarding-skeleton-card" aria-hidden="true">
          <div className="onboarding-header" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span className="member-skeleton-block" style={{ width: 190, height: 26, marginBottom: 8 }} />
            <span className="member-skeleton-block" style={{ width: 140, height: 16 }} />
          </div>

          {/* Stepper 3 bước mô phỏng */}
          <div className="stepper-container" style={{ margin: "28px 0" }}>
            <div className="step-line">
              <div className="step-line-progress" style={{ width: "50%", opacity: 0.4 }} />
            </div>

            {[1, 2, 3].map(step => (
              <div className="step-item" key={step}>
                <div className="step-circle member-skeleton-block" style={{ width: 36, height: 36, borderRadius: "50%", border: "none" }} />
                <span className="member-skeleton-block" style={{ width: 68, height: 12, marginTop: 8 }} />
              </div>
            ))}
          </div>

          {/* Hộp thông báo */}
          <div className="onboarding-message-box" style={{ padding: "20px 18px" }}>
            <span className="member-skeleton-block" style={{ width: 180, height: 20, marginBottom: 10 }} />
            <span className="member-skeleton-block" style={{ width: "90%", height: 14, marginBottom: 6 }} />
            <span className="member-skeleton-block" style={{ width: "65%", height: 14 }} />
          </div>

          {/* Nút hành động */}
          <div className="onboarding-actions" style={{ marginTop: 24 }}>
            <span className="member-skeleton-block" style={{ width: "100%", height: 48, borderRadius: 12 }} />
            <span className="member-skeleton-block" style={{ width: 90, height: 20, margin: "14px auto 0" }} />
          </div>
        </div>
      </main>
    </div>
  );
}
