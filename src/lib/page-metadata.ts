import type {Metadata} from "next";
import {siteUrl} from "./site";

const pages={
 "/honors":{title:"Vinh danh | REVIVE 2026",description:"Công bố Top 3 cá nhân và liên đoàn theo kết quả toàn hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/contributions":{title:"Đóng góp bước đi bộ | REVIVE 2026",description:"Xem tỷ lệ đóng góp bước đi bộ của cá nhân, nhóm nhỏ và liên đoàn trong hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/settings":{title:"Cài đặt thông báo | REVIVE 2026",description:"Quản lý thông báo trên thiết bị và kiểm tra trạng thái email thông báo của REVIVE.",image:"og/portal-v2.png"},
 "/appeals":{title:"Xử lý khiếu nại hoạt động | REVIVE 2026",description:"Admin đối chiếu khiếu nại và điều chỉnh kết quả hoạt động đi bộ đã duyệt.",image:"og/portal-v2.png"},
 "/statistics":{title:"Thống kê bước đi bộ Strava | REVIVE 2026",description:"Theo dõi số bước từng ngày, cộng dồn và so sánh cá nhân, nhóm nhỏ, liên đoàn trong hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/register":{title:"Đăng ký tài khoản đi bộ Strava | REVIVE 2026",description:"Tạo tài khoản để theo dõi hoạt động đi bộ Strava, số bước và bảng xếp hạng hội thao REVIVE 2026.",image:"og/register-v2.png"},
 "/login":{title:"Đăng nhập theo dõi đi bộ Strava | REVIVE 2026",description:"Đăng nhập để theo dõi hoạt động đi bộ Strava, số bước đã duyệt và bảng xếp hạng hội thao REVIVE 2026.",image:"og/login-v2.png"},
 "/activities":{title:"Hoạt động đi bộ Strava | REVIVE 2026",description:"Theo dõi hoạt động đi bộ Strava, số bước, trạng thái duyệt và điểm ghi nhận trong hội thao REVIVE 2026.",image:"og/activities-v2.png"},
 "/rankings":{title:"Xếp hạng đi bộ Strava | REVIVE 2026",description:"Xem xếp hạng đi bộ cá nhân, nhóm nhỏ, liên đoàn và Top kudo bài đăng Strava trong hội thao REVIVE 2026.",image:"og/rankings-v2.png"},
 "/members":{title:"Thành viên đi bộ Strava | REVIVE 2026",description:"Xem thành viên, nhóm nhỏ và liên đoàn tham gia hoạt động đi bộ Strava trong hội thao REVIVE 2026 của BTN TMG.",image:"og/members-v2.png"},
 "/onboarding":{title:"Trạng thái tài khoản đi bộ Strava | REVIVE 2026",description:"Kiểm tra trạng thái tài khoản theo dõi đi bộ Strava và chờ BTC duyệt thông tin, nhóm nhỏ, hồ sơ Strava đã chọn.",image:"og/portal-v2.png"},
 "/accounts":{title:"Duyệt tài khoản đi bộ Strava | REVIVE 2026",description:"Trang quản trị kiểm tra hồ sơ, duyệt đăng ký và quản lý quyền tài khoản theo dõi đi bộ Strava của hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/groups":{title:"Nhóm nhỏ đi bộ Strava | REVIVE 2026",description:"Quản lý nhóm nhỏ và phân công liên đoàn cho hoạt động đi bộ Strava trong hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/division":{title:"Liên đoàn đi bộ Strava của tôi | REVIVE 2026",description:"Trang dành cho liên đoàn trưởng theo dõi thành viên và hoạt động đi bộ Strava thuộc liên đoàn trong hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/audit":{title:"Nhật ký quản trị đi bộ Strava | REVIVE 2026",description:"Xem nhật ký đồng bộ Strava, phân nhóm, duyệt hoạt động đi bộ và quản lý tài khoản trong hội thao REVIVE 2026.",image:"og/portal-v2.png"},
 "/demo":{title:"Demo theo dõi đi bộ Strava | REVIVE 2026",description:"Xem giao diện minh họa theo dõi hoạt động đi bộ Strava, số bước và bảng xếp hạng hội thao REVIVE 2026 của BTN TMG.",image:"og/portal-v2.png"},
} as const;

export function pageMetadata(path:keyof typeof pages):Metadata {
 const page=pages[path],url=new URL(path,siteUrl).href;
 const image={url:`/revive/${page.image}`,width:1200,height:630,type:"image/png",alt:page.title};
 return {
  title:page.title,description:page.description,alternates:{canonical:url},robots:{index:false,follow:false},
  openGraph:{type:"website",locale:"vi_VN",siteName:"REVIVE · Đi bộ Strava",title:page.title,description:page.description,url,images:[image]},
  twitter:{card:"summary_large_image",title:page.title,description:page.description,images:[image]},
 };
}
