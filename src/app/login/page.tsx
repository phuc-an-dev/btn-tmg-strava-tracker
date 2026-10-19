"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {safePortalRedirect} from "@/lib/portal-routes";
import { getSupabase } from "@/lib/supabase";
import {InstallHomeScreenGuide} from "@/components/install-home-screen-guide";
import { ReviveHeader } from "@/components/revive-header";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = safePortalRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(redirectTarget);
      } else {
        setChecking(false);
      }
    });
  }, [router, redirectTarget]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (result.error) throw result.error;
      router.replace(redirectTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đăng nhập được.");
    } finally {
      setBusy(false);
    }
  }

  const registerHref = redirectTarget && redirectTarget !== "/rankings"
    ? `/register?redirect=${encodeURIComponent(redirectTarget)}`
    : "/register";

  return (
    <div className="app-shell revive-shell auth-shell">
      <ReviveHeader showAbout={true} />
      <main className="member-main">
        <div className="auth-intro">
          <div>
            <p className="eyebrow">BAN THANH NIÊN TRƯƠNG MINH GIẢNG</p>
            <h1>REVIVE</h1>
            <p className="revive-tagline">Vực tâm linh · Vực tinh thần · Vực thể chất</p>
            <blockquote>
              “Ta dầu bị ngã, sẽ lại dậy”
              <cite>Mi-chê 7:8</cite>
            </blockquote>
            <Image
              className="auth-art"
              src="/revive/logo.png"
              width={340}
              height={390}
              alt=""
              aria-hidden="true"
            />
          </div>
        </div>

        <section className="login-card">
          <span className="soft-icon">
            <ShieldCheck size={22} />
          </span>
          <h2>Chào bạn, đăng nhập nhé</h2>
          <p className="muted">
            Đăng nhập để gửi khiếu nại hoạt động của bạn và sử dụng các chức năng theo quyền tài khoản.
          </p>

          {error && <p className="drawer-error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy || checking}
            />

            <label htmlFor="login-password">Mật khẩu</label>
            <div className="password-field">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy || checking}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              className="primary full-width"
              disabled={busy || checking}
            >
              {busy ? "Đang xử lý…" : "Đăng nhập"}
            </button>
          </form>

          <Link className="text-button full-width" href={registerHref}>
            Chưa có tài khoản? Tạo tài khoản
          </Link>
          <InstallHomeScreenGuide/>
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell revive-shell auth-shell">
          <ReviveHeader showAbout={true} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
