import type {PostMedia} from "./post-media";
export type ActivityStatus = "pending" | "approved" | "rejected";
export type ClubActivity = {
 media?:PostMedia[];activity_id: number; athlete_id: number; athlete_name: string; name: string; sport_type: string;
 start_local: string; distance_m: number | null; source_steps: number | null; steps: number | null;
 people_count: number | null; division_id: number | null; group_id: number | null;
 status: ActivityStatus; note: string; rejection_reason?: string; revision: number; points: number;
 source: {division?:number|null; warnings?: string[]; source_posts?: {post_id:string; posted_at:string; body:string}[]; declared_steps?:number|null};
};
export const statusLabels: Record<ActivityStatus,string> = {pending:"Chờ duyệt",approved:"Đã duyệt",rejected:"Từ chối"};
export function inEvent(row: Pick<ClubActivity,"start_local"|"sport_type">) {
 const date=row.start_local.slice(0,10);
 return row.sport_type==="Walk" && date>="2026-10-04" && date<="2026-11-15";
}
export function proposedPoints(steps: number | null, people: number | null) {
 return steps!==null && people!==null && people>=1 ? Math.round(steps*(1+(people>1?people/10:0))) : null;
}
export function parseActivityImport(value: unknown): {club_id:string;activities: Record<string,unknown>[]} {
 if (!value || typeof value!=="object") throw new Error("File JSON không hợp lệ.");
 const d=value as Record<string,unknown>;
 if(String(d.club_id)!=="2368312" || !Array.isArray(d.activities)) throw new Error("Chọn file activities của club 2368312, không phải JSON bài đăng gốc.");
 const rows=[...d.activities,...(Array.isArray(d.excluded)?d.excluded:[])];
 if(rows.length>1000) throw new Error("Mỗi lần nhập tối đa 1.000 activities.");
 for(const r of rows) {
  if(!r || typeof r!=="object" || !/^\d{1,15}$/.test(String(r.activity_id)) || !/^\d{1,15}$/.test(String(r.athlete_id)) || typeof r.start_local!=="string") throw new Error("Activity thiếu ID người thực hiện hoặc ngày bắt đầu.");
 }
 return {club_id:"2368312",activities:rows};
}
