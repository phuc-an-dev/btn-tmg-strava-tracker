import type {PostMedia} from './post-media';
import type {Group} from './portal-data';
export type AppealStatus='pending'|'accepted'|'rejected';
export type AppealValues={steps:number|null;people_count:number|null;group_id:number|null;division_id:number|null;points:number;revision:number};
export type AppealActivity=AppealValues&{activity_id:number;athlete_id:number;athlete_name:string;name:string;start_local:string;sport_type:string;status:string;source_steps:number|null;media:PostMedia[]};
export type ActivityAppeal={id:number;activity_id:number;requester_name:string;requester_role:string;reason:string;proposed_steps:number;proposed_people:number;proposed_group:number;proposed_division:number;base_revision:number;before_result:AppealValues;status:AppealStatus;resolution_reason:string|null;result:AppealValues|null;reviewer_name:string|null;created_at:string;reviewed_at:string|null};
export type ActivityAppealState={activity:AppealActivity;can_submit:boolean;appeals:ActivityAppeal[]};
export type AppealDetail={activity:AppealActivity;appeal:ActivityAppeal};
export const appealStatusLabels:Record<AppealStatus,string>={pending:'Đang chờ xử lý',accepted:'Đã chấp nhận',rejected:'Không chấp nhận'};
export const appealNumber=(value:number|null)=>value===null?'—':value.toLocaleString('vi-VN');
export const appealTime=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
export const appealGroup=(value:Pick<AppealValues,'group_id'|'division_id'>)=>`Nhóm ${value.group_id??'—'} · LĐ ${value.division_id??'—'}`;
export function appealProposal(p:ActivityAppeal):AppealValues{return {steps:p.proposed_steps,people_count:p.proposed_people,group_id:p.proposed_group,division_id:p.proposed_division,points:0,revision:p.base_revision};}
export function appealGroupOptions(groups:Group[],original:AppealValues) {
 const options=groups.filter(g=>g.division_id!==null).map(g=>({value:`${g.id}:${g.division_id}`,label:`${g.name} · LĐ ${g.division_id}`,childLabel:g.name,group:`Liên đoàn ${g.division_id}`}));
 const value=`${original.group_id}:${original.division_id}`;
 if(original.group_id&&original.division_id&&!options.some(o=>o.value===value))options.unshift({value,label:`${appealGroup(original)} (đã ghi nhận)`,childLabel:`Nhóm ${original.group_id} (đã ghi nhận)`,group:`Liên đoàn ${original.division_id}`});
 return options;
}
export function appealInputError(value:string,field:'steps'|'people') {
 const min=field==='steps'?0:1,max=field==='steps'?1000000:100;
 if(/^\d+$/.test(value)&&Number(value)>=min&&Number(value)<=max)return '';
 return field==='steps'?'Nhập số bước nguyên từ 0 đến 1.000.000.':'Nhập số người nguyên từ 1 đến 100 (gồm người tạo activity).';
}
export function validAppealValues(steps:string,people:string,pair:string){
 return !appealInputError(steps,'steps')&&!appealInputError(people,'people')&&/^\d+:\d+$/.test(pair);
}
