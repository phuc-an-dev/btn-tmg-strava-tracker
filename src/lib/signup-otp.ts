export const SIGNUP_RESEND_SECONDS=60;
export const PENDING_SIGNUP_KEY="revive.pending-signup";
export type PendingSignup={email:string;sentAt:number};

export function normalizeSignupCode(value:string) {
  return value.replace(/\D/g,"").slice(0,6);
}

export function validSignupCode(value:string) {
  return /^\d{6}$/.test(value);
}

export function resendWait(sentAt:number,now:number) {
  return Math.max(0,Math.ceil((sentAt+SIGNUP_RESEND_SECONDS*1000-now)/1000));
}

export function readPendingSignup(raw:string|null):PendingSignup|null {
  try {
    const data=JSON.parse(raw??"null");
    if(!data||typeof data.email!=="string"||data.email.length>320||!/^\S+@\S+\.\S+$/.test(data.email)||typeof data.sentAt!=="number"||!Number.isFinite(data.sentAt)||data.sentAt<0)return null;
    return {email:data.email,sentAt:data.sentAt};
  } catch {return null;}
}

export function savePendingSignup(data:PendingSignup|null) {
  try {
    if(data)sessionStorage.setItem(PENDING_SIGNUP_KEY,JSON.stringify(data));
    else sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch { /* Verification still works when browser storage is unavailable. */ }
}

export function signupOtpError(error:unknown) {
  const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
  if(code==="otp_expired")return "Mã không đúng hoặc đã hết hạn. Kiểm tra mã mới nhất hoặc gửi lại mã.";
  if(code==="over_email_send_rate_limit"||code==="over_request_rate_limit")return "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.";
  return "Không thực hiện được. Vui lòng kiểm tra kết nối và thử lại.";
}
