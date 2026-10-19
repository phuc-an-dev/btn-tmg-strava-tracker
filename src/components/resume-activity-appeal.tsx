"use client";
import Link from "next/link";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {ActivityAppealControl,useActivityAppeals} from "./activity-appeal";
import {usePortal} from "./portal-context";
import {activityAppealTarget} from "@/lib/portal-routes";
import {invalidateActivityData} from "@/lib/activity-cache";

// Re-fetch eligibility after login; the URL never grants permission to submit.
export function ResumeActivityAppeal(){
 const {session,ownMember,isAdmin,isLeader}=usePortal();
 const params=useSearchParams(),pathname=usePathname(),router=useRouter();
 const id=activityAppealTarget(params.get("activity"));
 const appeals=useActivityAppeals(session&&id?[id]:[]);
 const state=id?appeals.states.get(id):undefined;
 const target=pathname+`?${params}`;
 const close=()=>{const next=new URLSearchParams(params);next.delete("activity");router.replace(pathname+(next.size?`?${next}`:""),{scroll:false});};
 if(!id||!session)return null;
 if(!ownMember&&!isAdmin&&!isLeader)return <p className="goal-card">Tài khoản cần được duyệt và liên kết với thành viên để gửi khiếu nại. <Link href={`/onboarding?redirect=${encodeURIComponent(target)}`}>Xem trạng thái tài khoản</Link></p>;
 if(appeals.error)return <p role="alert">{appeals.error} <button className="text-button" onClick={appeals.refresh}>Thử lại</button></p>;
 if(appeals.loading)return <p className="muted" role="status">Đang kiểm tra quyền khiếu nại hoạt động…</p>;
 if(!state||(!state.can_submit&&!state.appeals.length))return <p className="goal-card" role="status">Bạn chỉ có thể khiếu nại hoạt động đã duyệt thuộc quyền của tài khoản. <button className="text-button" onClick={close}>Đóng</button></p>;
 return <ActivityAppealControl key={id} autoOpen state={state} onOpenChange={open=>{if(!open)close();}} onChanged={()=>{invalidateActivityData();window.dispatchEvent(new Event("activity-data-changed"));}}/>;
}
