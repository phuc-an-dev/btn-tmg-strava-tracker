"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {safePortalRedirect} from "@/lib/portal-routes";
import { getSupabase } from "@/lib/supabase";
import {InstallHomeScreenGuide} from "@/components/install-home-screen-guide";
import {SignupOtpForm} from "@/components/signup-otp-form";
import {PENDING_SIGNUP_KEY,readPendingSignup,savePendingSignup,type PendingSignup} from "@/lib/signup-otp";
import {SignupSelectionFields} from "@/components/signup-selection-fields";
import {emptySignupSelection,type SignupSelection} from "@/lib/signup-selection";
import { ReviveHeader } from "@/components/revive-header";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = safePortalRedirect(searchParams.get("redirect"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [selection,setSelection]=useState<SignupSelection>(emptySignupSelection);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingSignup|null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data }) => {
      if (data.session) {
        savePendingSignup(null);
        router.replace(redirectTarget);
      } else {
        try {
          const saved=readPendingSignup(sessionStorage.getItem(PENDING_SIGNUP_KEY));
          if(saved){setPending(saved);setEmail(saved.email);}
        } catch { /* Continue with a fresh form when storage is unavailable. */ }
        setChecking(false);
      }
    });
  }, [router, redirectTarget]);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const isValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    birthYear.trim().length === 4 &&
    Number(birthYear) >= 1940 &&
    Number(birthYear) <= 2026 &&
    password.length >= 8 &&
    confirmPassword === password && !!selection.groupId && !!selection.athleteId;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid) return;

    setBusy(true);
    setError("");


    try {
      const resolved=await getSupabase().rpc("validate_signup_selection",{selected_group:selection.groupId,selected_athlete:selection.athleteId});
      if(resolved.error)throw new Error(resolved.error.message);
      const chosen=resolved.data as {group_id:number;athlete_id:number;strava_url:string};
      const result = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            birth_year: Number(birthYear),
            gender,
            requested_group_id:chosen.group_id,
            requested_strava_athlete_id:chosen.athlete_id,
          },
        },
      });

      if (result.error) throw result.error;

      if (!result.data.session) {
        const next={email:email.trim(),sentAt:Date.now()};
        savePendingSignup(next);setPending(next);
        setPassword("");setConfirmPassword("");
      } else {
        router.replace(redirectTarget);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  const loginHref = redirectTarget && redirectTarget !== "/rankings"
    ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
    : "/login";

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
          <h2>{pending?"Xác nhận email":"Tạo tài khoản REVIVE"}</h2>
          {!pending&&<p className="muted">
            Tạo tài khoản để theo dõi đi bộ Strava. Chọn nhóm nhỏ và hồ sơ Strava để BTC xác nhận.
          </p>}

          {error && <p className="drawer-error" role="alert">{error}</p>}
          {pending&&<SignupOtpForm pending={pending} onVerified={()=>router.replace(redirectTarget)} onChangeEmail={()=>{savePendingSignup(null);setPending(null);setError("");}}/>}

          {!pending && (
            <form onSubmit={handleSubmit}>
              <label htmlFor="reg-name">Họ và tên (Full Name)</label>
              <input
                id="reg-name"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={busy || checking}
              />

              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy || checking}
              />

              <div className="form-row-2">
                <div>
                  <label htmlFor="reg-year">Năm sinh</label>
                  <input
                    id="reg-year"
                    name="birthYear"
                    type="number"
                    inputMode="numeric"
                    placeholder="VD: 2002"
                    min={1940}
                    max={2026}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    required
                    disabled={busy || checking}
                  />
                </div>
                <div>
                  <label id="label-gender">Giới tính</label>
                  <div
                    className="gender-selector"
                    role="radiogroup"
                    aria-labelledby="label-gender"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={gender === "male"}
                      className={`gender-pill ${gender === "male" ? "is-active" : ""}`}
                      onClick={() => setGender("male")}
                      disabled={busy || checking}
                    >
                      Nam
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={gender === "female"}
                      className={`gender-pill ${gender === "female" ? "is-active" : ""}`}
                      onClick={() => setGender("female")}
                      disabled={busy || checking}
                    >
                      Nữ
                    </button>
                  </div>
                </div>
              </div>

              <SignupSelectionFields value={selection} onChange={setSelection} disabled={busy||checking}/>

              <label htmlFor="reg-password">Mật khẩu (Password)</label>
              <div className="password-field">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  minLength={8}
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
              {passwordTooShort && (
                <p className="form-field-error">Mật khẩu cần tối thiểu 8 ký tự.</p>
              )}

              <label htmlFor="reg-confirm-password">Xác nhận mật khẩu (Confirm Password)</label>
              <div className="password-field">
                <input
                  id="reg-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={busy || checking}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="form-field-error">Mật khẩu xác nhận không khớp.</p>
              )}

              <button
                type="submit"
                className="primary full-width"
                disabled={busy || checking || !isValid}
              >
                {busy ? "Đang xử lý…" : "Tạo tài khoản"}
              </button>
            </form>
          )}

          <Link className="text-button full-width" href={loginHref}>
            Đã có tài khoản? Đăng nhập
          </Link>
          <InstallHomeScreenGuide/>
        </section>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell revive-shell auth-shell">
          <ReviveHeader showAbout={true} />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
