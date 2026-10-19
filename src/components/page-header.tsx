import type {ReactNode} from "react";

export function PageHeader({title,metadata,action,loading=false}: {
  title:string;
  metadata?:ReactNode;
  action?:ReactNode;
  loading?:boolean;
}) {
  return <header className="portal-page-header">
    <p className="eyebrow">BAN THANH NIÊN TRƯƠNG MINH GIẢNG</p>
    <h1 title={title}>{title}</h1>
    <div className="portal-page-header-meta">
      {loading?<span className="member-skeleton-block member-skeleton-sync" aria-hidden="true"/>:metadata&&<p className="sync-note">{metadata}</p>}
      {action}
    </div>
  </header>;
}
