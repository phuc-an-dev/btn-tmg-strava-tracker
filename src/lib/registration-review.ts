import type {Member,Profile} from "./portal-data";

export function registrationApproved(account:Profile,member?:Member) {
 return !!account.approved_at||!!member||account.role==="admin";
}
export function registrationIssue(account:Profile,members:Member[]) {
 if(!account.email_verified_at)return "Người đăng ký chưa xác thực email.";
 if(!account.full_name?.trim()||!account.birth_year||!account.gender||!account.requested_group_id||!account.requested_strava_athlete_id)return "Hồ sơ cũ chưa đủ thông tin đăng ký. Kiểm tra trong Chi tiết.";
 const member=members.find(m=>m.strava_athlete_id===account.requested_strava_athlete_id);
 if(!member)return "Không tìm thấy hồ sơ Strava trong club. Cần đồng bộ lại thành viên.";
 if(!member.active)return "Tài khoản Strava không còn tham gia club.";
 if(member.auth_user_id&&member.auth_user_id!==account.id)return "Tài khoản Strava đã được sử dụng bởi tài khoản khác.";
 return null;
}
