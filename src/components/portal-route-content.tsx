"use client";
import {useEffect} from "react";
import {useQueryStates,debounce} from "nuqs";
import {membersQuery,queryOptions,useDebouncedSearch} from "@/lib/portal-query";
import {usePortal,useAuthenticatedPortal} from "./portal-context";
import {ResumeActivityAppeal} from "./resume-activity-appeal";
import {AccountsSkeleton} from "./accounts-skeleton";
import {AuditPanel} from "./audit-panel";
import {AccountsPanel} from "./accounts-panel";
import {ActivityPanel} from "./activity-panel";
import {MemberActivitiesPanel} from "./member-activities-panel";
import {Pagination} from "./pagination";
import {ChoiceEditor,ResponsivePicker} from "./mobile-drawer";
import {ArrowUpRight,Layers,Pencil,RefreshCw,Search,Users,X} from "lucide-react";
import {getSupabase} from "@/lib/supabase";
import type {Member,Group} from "@/lib/portal-data";
const divisions=[1,2,3,4,5];
const divisionOptions=[{value:"",label:"Chưa phân"},...divisions.map(id=>({value:String(id),label:`Liên đoàn ${id}`}))];
const displayName=(member:Member)=>member.btn_name||member.strava_name;
export function MembersRouteContent(){
 const {members,ownMember,isAdmin,isLeader,edit,refreshing}=usePortal();
 const [params,setParams]=useQueryStates(membersQuery,queryOptions);
 const {division:filter,page,size:pageSize}=params;
 const query=useDebouncedSearch(params.q);
  const visible = members.filter(member => (filter === "unassigned" ? !member.division_id : !filter || String(member.division_id) === filter) && `${member.strava_name} ${member.btn_name ?? ""} ${member.strava_athlete_id}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  useEffect(()=>{
    const timer=setTimeout(()=>{if(page>pageCount&&params.q===query)void setParams({page:pageCount},{history:"replace"});},0);
    return()=>clearTimeout(timer);
  },[page,pageCount,params.q,query,setParams]);
  const pageMembers = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pagination = (
    <Pagination
      currentPage={currentPage}
      totalPages={pageCount}
      onPageChange={value=>void setParams({page:value},{history:"push"})}
      pageSize={pageSize}
      onPageSizeChange={size => {
        void setParams({size:size as 10|20|50,page:1},{history:"push"});
      }}
      pageSizeOptions={[10, 20, 50]}
      pageSizeLabel="Số thành viên mỗi trang"
      ariaLabel="Phân trang thành viên"
    />
  );
 return <><div className="member-filters"><div className="search-field"><Search size={18}/><input aria-label="Tìm thành viên" placeholder="Tìm tên hoặc Strava ID…" value={params.q} onChange={event=>void setParams({q:event.target.value,page:1},{history:"replace",limitUrlUpdates:event.target.value?debounce(300):undefined})}/>{params.q && <button type="button" className="search-clear icon-button" aria-label="Xóa tìm kiếm" onClick={()=>void setParams({q:"",page:1})}><X size={18}/></button>}</div><ResponsivePicker label="Bộ lọc" triggerLabel="Bộ lọc" className={filter ? "member-filter-picker is-active" : "member-filter-picker"} value={filter} onChange={value=>void setParams({division:value as typeof filter,page:1},{history:"push"})} options={[{value:"",label:"Tất cả liên đoàn"},{value:"unassigned",label:"Chưa phân liên đoàn"},...divisionOptions.slice(1)]}/></div><p className="muted result-count member-result-count result-summary"><strong>{visible.length ? `${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,visible.length)} / ${visible.length} thành viên` : "0 thành viên"}</strong>{(refreshing||params.q!==query)&&<span className="member-list-progress" role="status"><RefreshCw size={12} aria-hidden="true"/>{refreshing?"Đang cập nhật…":"Đang tìm…"}</span>}</p><div className="member-list member-card-list" aria-busy={refreshing}>{pageMembers.map(member=><article className="member-card" key={member.strava_athlete_id}><span className="member-avatar">{displayName(member).trim().charAt(0)}</span><div className="member-details"><div className="member-heading"><h2>{displayName(member)}</h2><span data-division={member.division_id??undefined} className={`member-chip ${member.division_id ? "assigned-chip" : ""}`}>{member.division_id ? `LĐ ${member.division_id}${member.group_id ? ` · Nhóm ${member.group_id}`:""}`:"Chưa phân LĐ"}</span></div><p>{member.btn_name ? `${member.strava_name} · `:""}ID {member.strava_athlete_id}</p>{ownMember?.strava_athlete_id===member.strava_athlete_id && <span className="member-chip">Bạn</span>}</div><div className="member-actions"><a className="member-strava" href={`https://www.strava.com/athletes/${member.strava_athlete_id}`} target="_blank" rel="noopener noreferrer" aria-label={`Mở Strava của ${displayName(member)}`}><span>Xem Strava</span><ArrowUpRight size={16}/></a>{(isAdmin || isLeader) && <button className="member-assign" onClick={()=>edit(member)}><Pencil size={15}/>Phân công</button>}</div></article>)}</div>{visible.length>0 && pagination}{!visible.length && <p className="goal-card">Không tìm thấy thành viên phù hợp.</p>}</>;
}
export function ActivitiesRouteContent(){const {session,profile,members,groups,leaderDivision}=usePortal();return <><ResumeActivityAppeal/>{!session||!profile||profile.role==="user"?<MemberActivitiesPanel key={session?.user.id??"guest"} groups={groups}/>:<ActivityPanel key={session.user.id} members={members} userRole={profile.role} userDivision={leaderDivision}/>}</>;}
export function AuditRouteContent(){const {session,members}=useAuthenticatedPortal();return <AuditPanel key={session.user.id} members={members}/>;}
export function DivisionRouteContent(){const {leaderDivision,members,groups,edit}=usePortal();return <MyDivisionSection leaderDivision={leaderDivision} members={members} groups={groups} onEditMember={edit}/>;}
export function GroupsRouteContent(){const {members,groups,busy,message,mutate}=usePortal();return <section aria-label="Nhóm nhỏ theo liên đoàn"><p className="muted division-note">5 liên đoàn · 10 nhóm nhỏ. Nhóm đã có thành viên cần bỏ phân công trước khi chuyển liên đoàn.</p><div className="division-grid">{divisions.map(id=><article className="division-card" key={id}><header><span className="division-icon"><Layers size={22}/></span><div><h2>Liên đoàn {id}</h2><p>{groups.filter(group=>group.division_id===id).length} nhóm · {members.filter(member=>member.division_id===id).length} thành viên</p></div></header>{groups.filter(group=>group.division_id===id).map(group=><GroupAssignment key={`${group.id}-${group.division_id}`} group={group} members={members} busy={busy} error={message} onSave={value=>mutate(()=>getSupabase().rpc('assign_group',{group_number:group.id,assigned_division:value}))}/>)}{!groups.some(group=>group.division_id===id) && <p className="division-empty">Chưa có nhóm được phân.</p>}</article>)}</div>{groups.some(group=>!group.division_id) && <article className="division-card unassigned-groups"><header><span className="division-icon"><Layers size={22}/></span><div><h2>Nhóm chưa phân</h2><p>Chọn liên đoàn cho các nhóm bên dưới.</p></div></header>{groups.filter(group=>!group.division_id).map(group=><GroupAssignment key={group.id} group={group} members={members} busy={busy} error={message} onSave={value=>mutate(()=>getSupabase().rpc('assign_group',{group_number:group.id,assigned_division:value}))}/>)}</article>}</section>;}
export function AccountsRouteContent(){const {session,accounts,members,groups,busy,accountsLoading,accountsError,refreshAccounts,mutate}=useAuthenticatedPortal();return <section className="permissions-panel" aria-label="Duyệt đăng ký">{accountsLoading && !accounts.length && <AccountsSkeleton count={4} />}{accountsError && <div className="portal-load-error" role="alert"><span>Không tải được tài khoản.</span><button className="text-button" onClick={()=>session && void refreshAccounts(session,true)}>Thử lại</button></div>}{(!accountsLoading||accounts.length>0)&&<AccountsPanel onApprove={account=>mutate(()=>getSupabase().rpc("approve_registration",{account_id:account.id}))} groups={groups} onDelete={(account,email)=>mutate(()=>getSupabase().rpc("delete_account",{account_id:account.id,confirmation_email:email}))} accounts={accounts} members={members} userId={session.user.id} busy={busy} onLink={(account,athleteId,expectedId)=>mutate(()=>getSupabase().rpc("link_account_member",{account_id:account.id,athlete_id:athleteId,expected_athlete_id:expectedId}))} onSave={(account,role)=>mutate(()=>getSupabase().rpc('set_account_role',{account_id:account.id,new_role:role}))}/>} {!accountsLoading && !accountsError && !accounts.length && <p className="panel-note">Chưa có tài khoản đăng ký.</p>}</section>;}
function MyDivisionSection({ leaderDivision, members, groups, onEditMember }: {
  leaderDivision: number | null;
  members: Member[];
  groups: Group[];
  onEditMember: (member: Member) => void;
}) {
  const divisionMembers = members.filter(m => m.division_id === leaderDivision);
  const divisionGroups = groups.filter(g => g.division_id === leaderDivision);
  const unassignedMembers = divisionMembers.filter(m => !m.group_id);

  if (!leaderDivision) {
    return (
      <section className="goal-card">
        <h2>Chưa được phân công liên đoàn</h2>
        <p className="muted">Tài khoản của bạn chưa được liên kết với liên đoàn nào. Vui lòng liên hệ Admin để được phân công.</p>
      </section>
    );
  }

  return (
    <section className="my-division-view" aria-label={`Tổng quan Liên đoàn ${leaderDivision}`}>
      {unassignedMembers.length > 0 && (
        <article className="division-unassigned-card">
          <header className="division-section-title">
            <span className="member-chip" style={{ background: "#fff0e5", color: "#c2410c", borderColor: "var(--orange)" }}>Cần xếp nhóm</span>
            <h3>Thành viên chưa phân nhóm ({unassignedMembers.length})</h3>
          </header>
          <div className="member-mini-list">
            {unassignedMembers.map(member => (
              <div key={member.strava_athlete_id} className="member-mini-row">
                <div>
                  <strong>{displayName(member)}</strong>
                  <p className="muted">{member.strava_name} · ID {member.strava_athlete_id}</p>
                </div>
                <button type="button" className="member-assign" onClick={() => onEditMember(member)}>
                  <Pencil size={14} />
                  Xếp nhóm
                </button>
              </div>
            ))}
          </div>
        </article>
      )}

      <div className="division-groups-breakdown">
        <h3 className="section-title">Cơ cấu nhóm nhỏ trong Liên đoàn {leaderDivision}</h3>
        <div className="division-grid" style={{ marginTop: 12 }}>
          {divisionGroups.map(group => {
            const groupMembers = divisionMembers.filter(m => m.group_id === group.id);
            return (
              <article className="division-card" key={group.id}>
                <header>
                  <span className="division-icon"><Layers size={20} /></span>
                  <div>
                    <h2>{group.name}</h2>
                    <p>{groupMembers.length} thành viên</p>
                  </div>
                </header>
                {groupMembers.length > 0 ? (
                  <div className="group-members-chips">
                    {groupMembers.map(m => (
                      <span key={m.strava_athlete_id} className="member-tag" onClick={() => onEditMember(m)} title="Bấm để chỉnh sửa phân công">
                        {displayName(m)} <Pencil size={11} />
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="division-empty">Chưa có thành viên nào.</p>
                )}
              </article>
            );
          })}
          {divisionGroups.length === 0 && (
            <p className="division-empty">Chưa có nhóm nào được phân bổ cho Liên đoàn {leaderDivision}.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function GroupAssignment({ group, members, busy, onSave, error }: { group: Group; members: Member[]; busy: boolean; onSave: (division: number | null) => Promise<boolean>; error: string }) {
  return <div className="division-group"><div className="division-group-heading"><h3>{group.name}</h3><span><Users size={14}/>{members.filter(member=>member.group_id===group.id).length} thành viên</span></div><ChoiceEditor title={`Đổi liên đoàn của ${group.name}`} value={String(group.division_id ?? "")} options={divisionOptions} busy={busy} error={error} onSave={value=>onSave(value ? Number(value):null)}/></div>;
}

