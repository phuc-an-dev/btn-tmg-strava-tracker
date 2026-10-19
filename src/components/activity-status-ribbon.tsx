import type {ActivityStatus} from "@/lib/activity-data";

const labels:Record<ActivityStatus|"incomplete",string>={pending:"Chưa duyệt",approved:"Đã duyệt",rejected:"Từ chối",incomplete:"Cần bổ sung"};

export function ActivityStatusRibbon({status,loading=false}:{status?:ActivityStatus|"incomplete";loading?:boolean}) {
  return <div className={`activity-status-ribbon ${loading?"loading":status??"pending"}`} aria-hidden={loading||undefined}>
    <span className={loading?"member-skeleton-block":undefined}>{!loading&&labels[status??"pending"]}</span>
  </div>;
}
