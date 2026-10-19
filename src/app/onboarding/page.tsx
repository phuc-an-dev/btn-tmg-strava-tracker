"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { Check, Clock, LogOut, RefreshCw } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {safePortalRedirect} from "@/lib/portal-routes";
import { getSupabase } from "@/lib/supabase";
import { loadPortal, type Member, type Profile } from "@/lib/portal-data";
import { ReviveHeader } from "@/components/revive-header";
import { OnboardingSkeleton } from "@/components/onboarding-skeleton";
import {removeBrowserPush} from '@/lib/browser-push';

function OnboardingContent() {
  const router = useRouter();
  const redirectTarget=safePortalRedirect(useSearchParams().get("redirect"));
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const checkStatus = useCallback(async (currentSession: Session, isManual = false) => {
    if (isManual) {
      setChecking(true);
      setStatusMessage("");
    }

    try {
      const data = await loadPortal(currentSession.user.id, true);
      const ownMember = data.members.find((m: Member) => m.auth_user_id === currentSession.user.id);
      const isAdmin = (data.profile as Profile)?.role === "admin";

      if (isAdmin || ownMember) {
        router.replace(redirectTarget);
        return;
      }

      if (isManual) {
        setStatusMessage("Hồ sơ vẫn đang chờ BTC duyệt. Vui lòng kiểm tra lại sau.");
      }
    } catch {
      if (isManual) {
        setStatusMessage("Không thể kiểm tra trạng thái lúc này. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
      if (isManual) setChecking(false);
    }
  }, [router,redirectTarget]);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setSession(data.session);
        void checkStatus(data.session, false);
      }
    });
  }, [router, checkStatus]);

  async function handleSignOut() {
    await removeBrowserPush().catch(()=>{});
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return <OnboardingSkeleton />;
  }

  const userEmail = session?.user.email ?? "";

  return (
    <div className="app-shell revive-shell onboarding-shell">
      <ReviveHeader showAbout={false} />
      <main className="onboarding-main">
        <div className="onboarding-card">
          <div className="onboarding-header">
            <h1>Trạng thái tài khoản</h1>
            <p>{userEmail}</p>
          </div>

          {/* Stepper 3 bước ngang */}
          <div className="stepper-container" aria-label="Tiến trình kích hoạt">
            <div className="step-line" aria-hidden="true">
              <div className="step-line-progress" />
            </div>

            {/* Bước 1 */}
            <div className="step-item">
              <div className="step-circle completed" aria-label="Bước 1: Hoàn thành">
                <Check size={18} />
              </div>
              <span className="step-title completed">Tạo tài khoản</span>
            </div>

            {/* Bước 2 */}
            <div className="step-item">
              <div className="step-circle completed" aria-label="Bước 2: Hoàn thành">
                <Check size={18} />
              </div>
              <span className="step-title completed">Xác thực email</span>
            </div>

            {/* Bước 3 */}
            <div className="step-item">
              <div className="step-circle current" aria-label="Bước 3: Đang chờ xử lý">
                <Clock size={18} />
              </div>
              <span className="step-title current">Chờ duyệt đăng ký</span>
            </div>
          </div>

          {/* Hộp thông báo */}
          <div className="onboarding-message-box">
            <h2>Hồ sơ đang chờ duyệt</h2>
            <p>
              Email đã được xác thực. BTC sẽ kiểm tra thông tin đăng ký, nhóm nhỏ và tài khoản Strava bạn đã chọn.
            </p>
          </div>

          {statusMessage && (
            <p className="status-message" role="status" style={{ textAlign: "center", marginBottom: 16 }}>
              {statusMessage}
            </p>
          )}

          {/* Nút hành động */}
          <div className="onboarding-actions">
            <button
              type="button"
              className="primary full-width"
              style={{ marginTop: 0 }}
              disabled={checking}
              onClick={() => session && void checkStatus(session, true)}
            >
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
              {checking ? "Đang kiểm tra…" : "Kiểm tra lại"}
            </button>

            <button
              type="button"
              className="text-button full-width"
              onClick={() => void handleSignOut()}
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage(){return <Suspense fallback={<OnboardingSkeleton/>}><OnboardingContent/></Suspense>;}
