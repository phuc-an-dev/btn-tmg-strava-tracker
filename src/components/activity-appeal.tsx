"use client";
import {useEffect,useState,type FormEvent} from 'react';
import {CheckCircle2,Clock3,MessageSquareWarning,Send,XCircle} from 'lucide-react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import {appealGroup,appealGroupOptions,appealNumber,appealProposal,appealStatusLabels,appealTime,validAppealValues,appealInputError,type ActivityAppealState,type ActivityAppeal,type AppealValues} from '@/lib/activity-appeals';
import {proposedPoints} from '@/lib/activity-data';
import {BottomDrawer,ResponsivePicker} from './mobile-drawer';
import {usePortal} from './portal-context';
import {useAppToast} from './app-toast';

export function useActivityAppeals(ids:number[]) {
 const {session}=usePortal(),idsKey=ids.join(','),key=`${session?.user.id??"guest"}|${idsKey}`;
 const [response,setResponse]=useState<{key:string;rows:ActivityAppealState[]}|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{
  let canceled=false,inFlight=false;
  async function load(){
   if(!session||inFlight)return;inFlight=true;
   try{const r=await getSupabase().rpc('get_activity_appeals',{activity_ids:idsKey?idsKey.split(',').map(Number):[]});if(r.error)throw r.error;if(!canceled){setResponse({key,rows:r.data as ActivityAppealState[]});setError('');}}
   catch{if(!canceled)setError('Không tải được thông tin khiếu nại.');}finally{inFlight=false;}
  }
  const start=setTimeout(()=>{if(session&&idsKey)void load();else{setResponse({key,rows:[]});setError('');}},0);
  const refresh=()=>{if(session&&idsKey&&!document.hidden)void load();};
  const poll=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
  return()=>{canceled=true;clearTimeout(start);clearInterval(poll);document.removeEventListener('visibilitychange',refresh);};
 },[idsKey,key,reload,session]);
 const rows=response?.key===key?response.rows:[];
 return {states:new Map(rows.map(r=>[r.activity.activity_id,r])),loading:!!session&&!!idsKey&&response?.key!==key,error,refresh:()=>setReload(n=>n+1)};
}
export function AppealComparison({before,after,afterLabel='Đề nghị'}:{before:AppealValues;after:AppealValues;afterLabel?:string}) {
 return <table className="appeal-comparison"><caption className="sr-only">Đối chiếu kết quả hoạt động</caption><thead><tr><th scope="col">Thông tin</th><th scope="col">Đã duyệt</th><th scope="col">{afterLabel}</th></tr></thead><tbody><tr><th scope="row">Số bước</th><td>{appealNumber(before.steps)}</td><td>{appealNumber(after.steps)}</td></tr><tr><th scope="row">Đi chung</th><td>{before.people_count??'—'} người</td><td>{after.people_count??'—'} người</td></tr><tr><th scope="row">Nhóm / LĐ</th><td>{appealGroup(before)}</td><td>{appealGroup(after)}</td></tr></tbody></table>;
}
export function AppealHistoryEntry({appeal:p}:{appeal:ActivityAppeal}) {
 const ResolutionIcon=p.status==='accepted'?CheckCircle2:p.status==='rejected'?XCircle:Clock3;
 return <article className={`appeal-history-entry appeal-timeline appeal-timeline-${p.status}`}>
  <div className="appeal-timeline-step">
   <div className="appeal-timeline-rail"><span className="appeal-timeline-icon submitted"><Send size={15} aria-hidden="true"/></span><span className="appeal-timeline-line" aria-hidden="true"/></div>
   <div className="appeal-timeline-content">
    <header><div><strong>Đã gửi khiếu nại</strong><p className="muted">Người gửi: {p.requester_name}{p.requester_role==='leader'?' · LĐ trưởng':''}</p></div><time dateTime={p.created_at}>{appealTime(p.created_at)}</time></header>
    <div className="appeal-message-card"><strong className="appeal-message-label">Lý do khiếu nại</strong><p className="appeal-reason">{p.reason}</p></div>
    <AppealComparison before={p.before_result} after={appealProposal(p)}/>
   </div>
  </div>
  <div className="appeal-timeline-step">
   <div className="appeal-timeline-rail"><span className={`appeal-timeline-icon ${p.status}`}><ResolutionIcon size={16} aria-hidden="true"/></span></div>
   <div className="appeal-timeline-content">
    <header><strong>{p.status==='pending'?'Đang chờ Admin xử lý':p.status==='accepted'?'Đã chấp nhận':'Không chấp nhận'}</strong>{p.reviewed_at&&<time dateTime={p.reviewed_at}>{appealTime(p.reviewed_at)}</time>}</header>
    {p.status==='pending'?<p className="muted appeal-timeline-note">Kết quả hiện tại vẫn được giữ trong lúc chờ xử lý.</p>:<><div className="appeal-message-card"><strong className="appeal-message-label">Phản hồi của Admin</strong>{p.resolution_reason&&<p className="appeal-reason">{p.resolution_reason}</p>}</div>{p.status==='accepted'&&p.result&&<AppealComparison before={p.before_result} after={p.result} afterLabel="Đã cập nhật"/>}</>}
   </div>
  </div>
 </article>;
}
export function ActivityAppealControl({state,onChanged,onOpenChange,compact=false,autoOpen=false}:{autoOpen?:boolean;compact?:boolean;state:ActivityAppealState|undefined;onChanged:()=>void;onOpenChange?:(open:boolean)=>void}) {
 const [open,setOpen]=useState(autoOpen),[compose,setCompose]=useState(autoOpen&&!!state?.can_submit&&!state?.appeals.length),[busy,setBusy]=useState(false);
 const {isAdmin}=usePortal();
 const changeOpen=(value:boolean)=>{setOpen(value);onOpenChange?.(value);};
 if(!state||(!state.can_submit&&!state.appeals.length))return null;
 const latest=state.appeals[0],pending=state.appeals.some(p=>p.status==='pending');
 const triggerLabel=pending?'Khiếu nại đang chờ':latest?`Khiếu nại · ${appealStatusLabels[latest.status].toLocaleLowerCase('vi')}`:'Khiếu nại';
 return <div className="activity-appeal-control">{!autoOpen&&<button type="button" className={`appeal-trigger ${compact?'compact':''} ${pending?'pending':''}`}  onClick={()=>{setCompose(state.can_submit&&!state.appeals.length);changeOpen(true);}} aria-haspopup="dialog" aria-expanded={open} aria-label={triggerLabel} title={triggerLabel}><MessageSquareWarning size={16} aria-hidden="true"/>{!compact&&<span>{triggerLabel}</span>}</button>}<BottomDrawer open={open} onOpenChange={value=>{if(!busy)changeOpen(value);}} busy={busy} title="Khiếu nại hoạt động" description={state.activity.athlete_name} footer={false}>{compose&&state.can_submit?<SubmitAppealForm busy={busy} setBusy={setBusy} state={state} onCancel={()=>{if(state.appeals.length)setCompose(false);else changeOpen(false);}} onDone={()=>{changeOpen(false);onChanged();}}/>:<div className="drawer-form-body appeal-detail" data-base-ui-swipe-ignore>{pending&&<p className="appeal-notice">Kết quả đã duyệt vẫn được giữ trong lúc chờ xử lý.</p>}{isAdmin&&pending&&<Link className="text-button" href="/appeals">Mở danh sách khiếu nại</Link>}<h3 className="appeal-timeline-title">Tiến trình xử lý</h3>{state.appeals.map(p=><AppealHistoryEntry key={p.id} appeal={p}/>)}{state.appeals.length===10&&<p className="muted">Hiển thị 10 khiếu nại gần nhất.</p>}{state.can_submit&&<button type="button" className="primary full-width" onClick={()=>setCompose(true)}>Gửi khiếu nại mới</button>}</div>}</BottomDrawer></div>;
}
function SubmitAppealForm({state,onCancel,onDone,busy,setBusy}:{busy:boolean;setBusy:(value:boolean)=>void;state:ActivityAppealState;onCancel:()=>void;onDone:()=>void}) {
 // Keep the revision that the member actually reviewed, even if polling refreshes the card.
 const [a]=useState(state.activity),{groups}=usePortal(),{add}=useAppToast();
 const [steps,setSteps]=useState(String(a.steps??'')),[people,setPeople]=useState(String(a.people_count??'')),[pair,setPair]=useState(`${a.group_id}:${a.division_id}`),[reason,setReason]=useState(''),[error,setError]=useState('');
 const [group,division]=pair.split(':').map(Number),stepsError=appealInputError(steps,'steps'),peopleError=appealInputError(people,'people');
 const validValues=validAppealValues(steps,people,pair),changed=Number(steps)!==a.steps||Number(people)!==a.people_count||group!==a.group_id||division!==a.division_id,valid=validValues&&!!reason.trim()&&changed;
 const submitHint=!validValues?'Vui lòng sửa thông tin chưa hợp lệ ở trên.':!changed?'Cần thay đổi ít nhất một kết quả để gửi khiếu nại.':!reason.trim()?'Vui lòng nhập lý do khiếu nại.':'';
 async function submit(e:FormEvent){e.preventDefault();if(busy||!valid)return;setBusy(true);setError('');try{const r=await getSupabase().rpc('submit_activity_appeal',{target_id:a.activity_id,expected_revision:a.revision,requested_steps:Number(steps),requested_people:Number(people),requested_group:group,requested_division:division,appeal_reason:reason.trim()});if(r.error)throw r.error;add({title:'Đã gửi khiếu nại. Kết quả hiện tại được giữ nguyên.',type:'success',timeout:3000});onDone();}catch(e){setError(e instanceof Error?e.message:typeof e==='object'&&e&&'message' in e?String(e.message):'Không gửi được khiếu nại.');}finally{setBusy(false);}}
 return <form className="drawer-form" onSubmit={submit}><div className="drawer-form-body appeal-detail" data-base-ui-swipe-ignore><p><strong>{a.name}</strong></p><AppealComparison before={a} after={{...a,steps:stepsError?null:Number(steps),people_count:peopleError?null:Number(people),group_id:group,division_id:division}}/><label htmlFor={`appeal-steps-${a.activity_id}`}>Số bước đề nghị</label><input id={`appeal-steps-${a.activity_id}`} type="number" min={0} max={1000000} step={1} inputMode="numeric" required value={steps} onChange={e=>setSteps(e.target.value)} disabled={busy} aria-invalid={!!stepsError} aria-describedby={stepsError?`appeal-steps-error-${a.activity_id}`:undefined}/>{stepsError&&<p id={`appeal-steps-error-${a.activity_id}`} className="form-field-error" aria-live="polite">{stepsError}</p>}<label htmlFor={`appeal-people-${a.activity_id}`}>Số người đi chung đề nghị (gồm người tạo activity)</label><input id={`appeal-people-${a.activity_id}`} type="number" min={1} max={100} step={1} inputMode="numeric" required value={people} onChange={e=>setPeople(e.target.value)} disabled={busy} aria-invalid={!!peopleError} aria-describedby={`appeal-people-help-${a.activity_id}`}/><p id={`appeal-people-help-${a.activity_id}`} className={peopleError?"form-field-error":"appeal-field-help"} aria-live="polite">{peopleError||"Từ 1 đến 100 người, gồm người tạo activity."}</p><label>Nhóm nhỏ / Liên đoàn đề nghị</label><ResponsivePicker label="Nhóm nhỏ / Liên đoàn đề nghị" options={appealGroupOptions(groups,a)} value={pair} onChange={setPair} disabled={busy}/>{!/^\d+:\d+$/.test(pair)&&<p className="form-field-error">Vui lòng chọn nhóm nhỏ / liên đoàn.</p>}<label htmlFor={`appeal-reason-${a.activity_id}`}>Lý do khiếu nại <span aria-hidden="true" style={{color:"#b91c1c"}}>*</span></label><textarea id={`appeal-reason-${a.activity_id}`} maxLength={2000} required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Nêu phần cần sửa và nguồn đối chiếu, ví dụ số bước trên Strava hoặc người đi chung." disabled={busy}/><p className="muted">Điểm đề nghị: {appealNumber(stepsError||peopleError?null:proposedPoints(Number(steps),Number(people)))}</p>{submitHint&&<p className="appeal-submit-hint" role="status">{submitHint}</p>}{error&&<p className="drawer-error" role="alert">{error}</p>}</div><footer className="drawer-footer drawer-actions"><button type="button" className="drawer-cancel" disabled={busy} onClick={onCancel}>Hủy</button><button type="submit" className="primary appeal-submit" disabled={busy||!valid}>{busy?'Đang gửi…':'Gửi khiếu nại'}</button></footer></form>;
}

export function SignInAppealControl({activityId}:{activityId:number}) {
 const target=`/activities?scope=club&status=approved&q=${activityId}&activity=${activityId}`;
 return <Link className="appeal-trigger compact" href={`/login?redirect=${encodeURIComponent(target)}`} aria-label="Đăng nhập để khiếu nại hoạt động" title="Đăng nhập để khiếu nại hoạt động"><MessageSquareWarning size={16}/></Link>;
}
