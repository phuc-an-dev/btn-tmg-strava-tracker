"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {getSupabase} from "@/lib/supabase";
import {normalizeSignupCode,resendWait,savePendingSignup,signupOtpError,validSignupCode,type PendingSignup} from "@/lib/signup-otp";

export function SignupOtpForm({pending,onVerified,onChangeEmail}:{pending:PendingSignup;onVerified:()=>void;onChangeEmail:()=>void}) {
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState<"verify"|"resend"|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [sentAt,setSentAt]=useState(pending.sentAt);
  const [now,setNow]=useState(()=>Date.now());
  const lock=useRef(false);
  const input=useRef<HTMLInputElement>(null);
  const wait=resendWait(sentAt,now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);

  async function verify(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(lock.current||!validSignupCode(code))return;
    lock.current=true;setBusy("verify");setError("");setMessage("");
    try {
      const result=await getSupabase().auth.verifyOtp({email:pending.email,token:code,type:"email"});
      if(result.error)throw result.error;
      if(!result.data.session)throw new Error("Missing verification session");
      savePendingSignup(null);onVerified();
    } catch(error) {setError(signupOtpError(error));input.current?.focus();}
    finally {lock.current=false;setBusy(null);}
  }

  async function resend() {
    if(lock.current||resendWait(sentAt,Date.now())>0)return;
    lock.current=true;setBusy("resend");setError("");setMessage("");
    try {
      const result=await getSupabase().auth.resend({type:"signup",email:pending.email});
      if(result.error)throw result.error;
      const time=Date.now();setSentAt(time);setNow(time);setCode("");savePendingSignup({email:pending.email,sentAt:time});
      setMessage("Đã gửi lại mã. Hãy nhập mã trong email mới nhất.");
    } catch(error) {setError(signupOtpError(error));}
    finally {lock.current=false;setBusy(null);}
  }

  return <div className="signup-otp">
    <p className="signup-otp-email">Mã xác nhận được gửi đến <strong>{pending.email}</strong></p>
    <p className="muted">Mở email, lấy mã 6 chữ số rồi nhập tại đây. Nếu chưa thấy email, kiểm tra mục thư rác.</p>
    <form onSubmit={verify} aria-busy={!!busy}>
      <label htmlFor="signup-code">Mã xác nhận</label>
      <input ref={input} id="signup-code" name="code" className="signup-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={event=>{setCode(normalizeSignupCode(event.target.value));setError("");}} aria-invalid={!!error} aria-describedby={error?"signup-code-error":undefined} disabled={!!busy} required/>
      {error&&<p id="signup-code-error" className="form-field-error" role="alert">{error}</p>}
      {message&&<p className="signup-code-message" role="status">{message}</p>}
      <button type="submit" className="primary full-width" disabled={!!busy||!validSignupCode(code)}>{busy==="verify"?"Đang xác nhận…":"Xác nhận và tiếp tục"}</button>
    </form>
    <div className="signup-code-actions">
      <button type="button" className="text-button" disabled={!!busy||wait>0} onClick={()=>void resend()}>{busy==="resend"?"Đang gửi…":wait>0?`Gửi lại mã sau ${wait}s`:"Gửi lại mã"}</button>
      <button type="button" className="text-button" disabled={!!busy} onClick={onChangeEmail}>Đổi email</button>
    </div>
  </div>;
}
