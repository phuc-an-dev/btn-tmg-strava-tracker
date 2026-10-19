import type {ReactNode} from 'react';
import {ChevronDown,Users} from 'lucide-react';
import {groupActivityDays} from '@/lib/activity-timeline';

export function ActivityTimeline<T>({rows,timestamp,renderCard,kind='hoạt động',datePrefix='',unknownLabel='Chưa xác định ngày',subgroups}:{rows:T[];timestamp:(row:T)=>string|null|undefined;renderCard:(row:T)=>ReactNode;kind?:string;datePrefix?:string;unknownLabel?:string;subgroups?:(rows:T[])=>{key:string;label:string;rows:T[]}[]}){
 return <div className="activity-timeline">{groupActivityDays(rows,timestamp).map(group=>{
  const label=group.date?`${datePrefix}${group.date.split('-').reverse().join('/')}`:unknownLabel;
  return <section key={group.date||'unknown'} className="activity-timeline-day" aria-label={label}><header className="activity-timeline-heading"><h2>{group.date?<time dateTime={group.date}>{label}</time>:label}</h2><span>{group.rows.length} {kind} trên trang này</span></header>{subgroups?<div className="activity-companion-groups">{subgroups(group.rows).map(subgroup=><details key={subgroup.key} className="activity-companion-group" open><summary><Users size={15} aria-hidden="true"/><span><strong>{subgroup.label}</strong><small>{subgroup.rows.length} hoạt động trên trang này</small></span><ChevronDown size={16} className="activity-companion-chevron" aria-hidden="true"/></summary><div className="activity-card-list">{subgroup.rows.map(renderCard)}</div></details>)}</div>:<div className="activity-card-list">{group.rows.map(renderCard)}</div>}</section>;
 })}</div>;
}
