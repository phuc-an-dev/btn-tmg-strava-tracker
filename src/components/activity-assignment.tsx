import type {ClubActivity} from "@/lib/activity-data";
import type {Member} from "@/lib/portal-data";

export function ActivityAssignment({row,member,review=false}:{row:ClubActivity;member:Member|undefined;review?:boolean}) {
 const sourceDivision=row.source.division;
 const titleDivision=sourceDivision===undefined?(row.status==="approved"?null:row.division_id):sourceDivision;
 const assigned=!!member?.active&&!!member.group_id&&!!member.division_id;
 const credited=review?assigned?member:null:row.status==="approved"?row:null;
 return <section className="review-division review-assignment" aria-label="Thông tin liên đoàn">
  <dl>
   <div><dt>LĐ từ tiêu đề</dt><dd>{titleDivision?`LĐ ${titleDivision}`:"Chưa xác định"}</dd></div>
   <div><dt>Phân công thành viên</dt><dd>{assigned?`LĐ ${member.division_id} · Nhóm ${member.group_id}`:"Chưa có phân công hợp lệ"}</dd></div>
   <div><dt>{review?"Tính điểm khi duyệt":"Nhóm/LĐ đã ghi nhận"}</dt><dd><strong>{credited?`LĐ ${credited.division_id} · Nhóm ${credited.group_id}`:"Chưa ghi nhận"}</strong></dd></div>
  </dl>
  {review&&<p>{!assigned?"Cần phân nhóm cho thành viên đang tham gia trước khi duyệt.":titleDivision!==member.division_id?"LĐ từ tiêu đề chưa xác định hoặc khác phân công. Hoạt động sẽ được ghi nhận theo phân công thành viên.":"Hoạt động được ghi nhận theo phân công thành viên tại thời điểm duyệt."}</p>}
 </section>;
}
