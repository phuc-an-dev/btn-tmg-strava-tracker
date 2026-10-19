"use client";
import {useEffect,useState,type ReactNode} from "react";
import {useQueryStates,debounce} from "nuqs";
import {auditQuery,queryOptions,useDebouncedSearch} from "@/lib/portal-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Layers,
  Link,
  Pencil,
  Search,
  Shield,
  Sparkles,
  Unlink,
  Upload,
  Users,
  X
} from "lucide-react";
import {getSupabase} from "@/lib/supabase";
import {describeAudit,type AuditRow,type ActionBadgeType,type PartyInfo} from "@/lib/audit-describe";
import type {Member} from "@/lib/portal-data";
import {BottomDrawer,ResponsivePicker} from "./mobile-drawer";
import {Pagination} from "./pagination";
import {AuditListSkeleton} from "./audit-list-skeleton";

const filterActions:Record<string,string>={
  delete_account:"Xóa tài khoản",
  assign_member:"Phân công thành viên",
  approve_registration:"Duyệt đăng ký",
  link_account_member:"Liên kết thành viên",
  assign_group:"Cấu hình nhóm nhỏ",
  set_account_role:"Thay đổi quyền",
  import_activities:"Nhập hoạt động",
  sync_members:"Đồng bộ thành viên",
  review_activity:"Kiểm tra hoạt động",
  submit_activity_appeal:"Gửi khiếu nại",
  resolve_activity_appeal:"Xử lý khiếu nại",
  activate_first_admin:"Thiết lập admin"
};

const hiddenFields = new Set(["revision","updated_at","reviewed_at","reviewed_by","imported_at","imported_by"]);
const fieldLabels:Record<string,string>={
  btn_name:"Tên BTN",division_id:"Liên đoàn",group_id:"Nhóm nhỏ",auth_user_id:"Tài khoản liên kết",
  role:"Vai trò",steps:"Số bước",people_count:"Số người",status:"Trạng thái",note:"Ghi chú",
  appeal_id:"Khiếu nại",reason:"Lý do khiếu nại",resolution_reason:"Lý do xử lý",appeal_resolution:"Phản hồi khiếu nại",
  points:"Điểm",inserted:"Đã nhập",skipped:"Bỏ qua",active:"Đang tham gia",email:"Email",
  athlete_name:"Tên VĐV",sport_type:"Môn",source_steps:"Bước gốc Strava"
};

function rawValue(v:unknown):string {
  if(v==null)return "—";
  if(typeof v==="boolean")return v?"Có":"Không";
  if(typeof v==="object")return JSON.stringify(v);
  return String(v);
}

function renderBadgeIcon(iconName: ActionBadgeType["iconName"]): ReactNode {
  switch(iconName) {
    case "users": return <Users size={13} aria-hidden="true"/>;
    case "pencil": return <Pencil size={13} aria-hidden="true"/>;
    case "link": return <Link size={13} aria-hidden="true"/>;
    case "unlink": return <Unlink size={13} aria-hidden="true"/>;
    case "check": return <Check size={13} aria-hidden="true"/>;
    case "x": return <X size={13} aria-hidden="true"/>;
    case "clock": return <Clock size={13} aria-hidden="true"/>;
    case "layers": return <Layers size={13} aria-hidden="true"/>;
    case "shield": return <Shield size={13} aria-hidden="true"/>;
    case "upload": return <Upload size={13} aria-hidden="true"/>;
    case "sparkles": return <Sparkles size={13} aria-hidden="true"/>;
    default: return <Pencil size={13} aria-hidden="true"/>;
  }
}

function renderPartyIcon(iconName?: PartyInfo["iconName"]): ReactNode {
  switch(iconName) {
    case "layers": return <Layers size={14} aria-hidden="true"/>;
    case "upload": return <Upload size={14} aria-hidden="true"/>;
    case "shield": return <Shield size={14} aria-hidden="true"/>;
    default: return null;
  }
}

export function AuditPanel({members}:{members:Member[]}) {
  const [rows,setRows]=useState<AuditRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [params,setParams]=useQueryStates(auditQuery,queryOptions);
  const action=params.action,input=params.q,page=params.page,query=useDebouncedSearch(input).trim();
  const [count,setCount]=useState(0),[selected,setSelected]=useState<AuditRow|null>(null);
  const setInput=(q:string)=>void setParams({q,page:1},{history:"replace",limitUrlUpdates:q?debounce(300):undefined});
  const setPage=(page:number)=>void setParams({page},{history:"push"});

  useEffect(()=>{
    let canceled=false;
    const timer=setTimeout(()=>{
      if(input.trim()!==query)return;
      setLoading(true);setError("");
      let request=getSupabase().from("audit_log").select("*,actor:profiles!audit_log_actor_id_fkey(email,role)",{count:"exact"}).order("created_at",{ascending:false}).order("id",{ascending:false});
      if(action)request=request.eq("action",action);
      if(query)request=request.ilike("entity_id",`%${query.replace(/[%_]/g,"")}%`);
      void request.range((page-1)*20,page*20-1).then(r=>{
        if(canceled)return;
        if(r.error)setError(r.error.message);
        else{setRows(r.data as AuditRow[]);setCount(r.count??0);const last=Math.max(1,Math.ceil((r.count??0)/20));if(page>last)void setParams({page:last},{history:"replace"});}
        setLoading(false);
      });
    },0);
    return()=>{canceled=true;clearTimeout(timer);};
  },[action,query,input,page,setParams]);

  const desc = selected ? describeAudit(selected, members) : null;
  const extraFields = selected ? Array.from(new Set([...Object.keys(selected.before_data??{}),...Object.keys(selected.after_data??{})])).filter(key=>hiddenFields.has(key)) : [];

  return <section className="audit-section" aria-label="Nhật ký Audit">
    <div className="audit-toolbar">
      <div className="search-field">
        <Search size={18}/>
        <input aria-label="Tìm Audit" placeholder="Tìm ID thành viên hoặc activity…" value={input} onChange={e=>setInput(e.target.value)}/>
      </div>
      <ResponsivePicker
        label="Loại thay đổi"
        triggerLabel="Bộ lọc"
        value={action}
        onChange={v=>{void setParams({action:v as typeof action,page:1},{history:"push"});}}
        options={[{value:"",label:"Tất cả thay đổi"},...Object.entries(filterActions).map(([value,label])=>({value,label}))]}
      />
    </div>

    <p className="audit-status-line result-summary" aria-live="polite">
      {loading ? "Đang tải lịch sử…" : <strong>{count} bản ghi</strong>}
    </p>

    {error ? <p className="drawer-error" role="alert">{error}</p> : loading && !rows.length ? (
      <AuditListSkeleton embed count={5} />
    ) : (
      <div className="audit-list">
        {rows.map(r=>{
          const d = describeAudit(r, members);
          return (
            <button className="audit-card" key={r.id} onClick={()=>setSelected(r)} type="button">
              {/* Header: Action Badge + Time */}
              <div className="audit-card-top">
                <span className={`audit-badge badge-${d.badge.color}`}>
                  {renderBadgeIcon(d.badge.iconName)}
                  <span>{d.badge.label}</span>
                </span>
                <span className="audit-card-time">{d.time}</span>
              </div>

              {/* Middle: Actor -> Target */}
              <div className="audit-parties-flow">
                <div className="audit-party">
                  <span className={`audit-avatar avatar-${d.actorParty.variant}`}>
                    {d.actorParty.iconName ? renderPartyIcon(d.actorParty.iconName) : (d.actorParty.initials ?? "?")}
                  </span>
                  <span className="audit-party-name">{d.actorParty.name}</span>
                </div>
                <ArrowRight size={14} className="audit-flow-arrow" aria-hidden="true"/>
                <div className="audit-party">
                  <span className={`audit-avatar avatar-${d.targetParty.variant}`}>
                    {d.targetParty.iconName ? renderPartyIcon(d.targetParty.iconName) : (d.targetParty.initials ?? "?")}
                  </span>
                  <span className="audit-party-name">{d.targetParty.name}</span>
                </div>
              </div>

              {/* Bottom: Transition Pill (Muted Before -> Bold After) */}
              <div className="audit-transition-pill">
                {d.transition.before && (
                  <>
                    <span className="trans-before">{d.transition.before}</span>
                    <ArrowRight size={13} className="trans-arrow" aria-hidden="true"/>
                  </>
                )}
                <strong className="trans-after">{d.transition.after}</strong>
              </div>
            </button>
          );
        })}
      </div>
    )}

    {!loading && !error && !rows.length && (
      <p className="goal-card">Chưa có lịch sử phù hợp.</p>
    )}

    {count > 20 && (
      <Pagination
        currentPage={page}
        totalPages={Math.ceil(count / 20)}
        onPageChange={setPage}
        pageSize={20}
        disabled={loading}
        ariaLabel="Phân trang Audit"
      />
    )}

    {/* Bottom Drawer: Chi tiết thay đổi theo mockup */}
    <BottomDrawer
      open={!!selected}
      onOpenChange={open=>{if(!open)setSelected(null);}}
      title="Chi tiết thay đổi"
      footer={false}
    >
      <div className="drawer-form-body">
        {desc && selected && (
          <div className="audit-drawer-container">
            {/* 1. Hero banner: Nền màu nhạt theo hành động */}
            <div className={`audit-drawer-hero hero-${desc.badge.color}`}>
              <div className="drawer-hero-badge">
                {renderBadgeIcon(desc.badge.iconName)}
                <span>{desc.badge.label}</span>
              </div>
              <h2 className="drawer-hero-title">{desc.heroHeadline}</h2>
              <p className="drawer-hero-time">{desc.time}</p>
            </div>

            {/* 2. Grid 2 cột: Người thực hiện & Đối tượng */}
            <div className="audit-drawer-parties-grid">
              <div className="drawer-party-card">
                <p className="party-card-eyebrow">NGƯỜI THỰC HIỆN</p>
                <div className="party-card-avatar avatar-actor">
                  {desc.actorParty.initials ?? "HT"}
                </div>
                <strong className="party-card-name">{desc.actorParty.name}</strong>
                <span className="party-card-sub">{desc.actorParty.subtitle ?? "—"}</span>
              </div>

              <div className="drawer-party-card">
                <p className="party-card-eyebrow">ĐỐI TƯỢNG</p>
                <div className="party-card-avatar avatar-target">
                  {desc.targetParty.iconName ? renderPartyIcon(desc.targetParty.iconName) : (desc.targetParty.initials ?? "?")}
                </div>
                <strong className="party-card-name">{desc.targetParty.name}</strong>
                <span className="party-card-sub">{desc.targetParty.subtitle ?? "—"}</span>
              </div>
            </div>

            {/* 3. Thay đổi cụ thể (N) */}
            <div className="audit-drawer-section">
              <h3 className="drawer-section-title">
                Thay đổi cụ thể ({desc.specificChanges.length})
              </h3>
              <div className="drawer-changes-table">
                {desc.specificChanges.map((change, idx)=>(
                  <div className="drawer-change-row" key={idx}>
                    <span className="change-row-label">{change.label}</span>
                    <span className="change-row-before">{change.before}</span>
                    <ArrowRight size={13} className="change-row-arrow" aria-hidden="true"/>
                    <strong className="change-row-after">{change.after}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Chi tiết kỹ thuật (Collapsible) */}
            <details className="audit-drawer-tech-section" open>
              <summary className="drawer-tech-summary">
                <ChevronDown size={14} aria-hidden="true"/>
                <span>Chi tiết kỹ thuật</span>
              </summary>
              <div className="drawer-tech-card">
                <div className="tech-row">
                  <span className="tech-label">ID bản ghi</span>
                  <span className="tech-value">{selected.id}</span>
                </div>
                <div className="tech-row">
                  <span className="tech-label">Entity ID</span>
                  <span className="tech-value">{selected.entity_id}</span>
                </div>
                <div className="tech-row">
                  <span className="tech-label">Action</span>
                  <span className="tech-value">{selected.action}</span>
                </div>
                <div className="tech-row">
                  <span className="tech-label">updated_at</span>
                  <span className="tech-value">{selected.created_at}</span>
                </div>
                {extraFields.map(key=>{
                  const val = selected.after_data?.[key] ?? selected.before_data?.[key];
                  return (
                    <div className="tech-row" key={key}>
                      <span className="tech-label">{fieldLabels[key] ?? key}</span>
                      <span className="tech-value">{rawValue(val)}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Footer: Nút Hủy full-width */}
      <footer className="drawer-footer">
        <button type="button" className="audit-close-btn" onClick={()=>setSelected(null)}>
          Hủy
        </button>
      </footer>
    </BottomDrawer>
  </section>;
}
