import type { Member } from "./portal-data";

/* ── Cấu hình hiển thị người thực hiện (Actor) ────────────────────────── */
export const ACTOR_ALIASES: Record<string, string> = {
  "anphucphamtrinh@gmail.com": "Phúc Admin",
  "anphucphamtrinh": "Phúc Admin",
};

/* ── Types ─────────────────────────────────────────────────────── */
export type AuditRow = {
  id: number;
  actor_id: string | null;
  actor_snapshot?: { email: string; role?: string } | null;
  action: string;
  entity_id: string;
  created_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  actor: { email: string; role?: string } | null;
};

export type ActionBadgeType = {
  label: string;
  iconName: "users" | "pencil" | "link" | "unlink" | "check" | "x" | "clock" | "layers" | "shield" | "upload" | "sparkles";
  color: "blue" | "green" | "amber" | "red" | "purple" | "cyan" | "indigo";
};

export type PartyInfo = {
  name: string;
  subtitle?: string;
  initials?: string;
  iconName?: "layers" | "upload" | "shield";
  variant: "actor" | "target" | "system";
};

export type TransitionInfo = {
  before?: string;
  after: string;
};

export type SpecificChange = {
  label: string;
  before: string;
  after: string;
};

export type AuditDescription = {
  summary: string;
  heroHeadline: string;
  badge: ActionBadgeType;
  actorParty: PartyInfo;
  targetParty: PartyInfo;
  transition: TransitionInfo;
  transitions: string[];
  specificChanges: SpecificChange[];
  actor: string;
  actorDetail: string;
  time: string;
};

/* ── Helpers ───────────────────────────────────────────────────── */
const roleLabels: Record<string, string> = { admin: "Admin", leader: "Liên đoàn trưởng", user: "Thành viên" };
const statusLabels: Record<string, string> = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối" };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function resolveActorName(
  actor: { email?: string | null; role?: string } | null,
  actorId?: string | null,
  members?: Member[]
): { name: string; detail: string; email: string } {
  const email = (actor?.email ?? "").trim();
  const prefix = email ? email.split("@")[0].toLowerCase() : "";

  if (email && ACTOR_ALIASES[email.toLowerCase()]) {
    const alias = ACTOR_ALIASES[email.toLowerCase()];
    return { name: alias, detail: `${alias} (${email})`, email };
  }
  if (prefix && ACTOR_ALIASES[prefix]) {
    const alias = ACTOR_ALIASES[prefix];
    return { name: alias, detail: email ? `${alias} (${email})` : alias, email };
  }

  if (actorId && members?.length) {
    const linked = members.find(m => m.auth_user_id === actorId);
    if (linked) {
      const btnName = linked.btn_name || linked.strava_name;
      const roleBadge = actor?.role === "admin" ? " (Admin)" : actor?.role === "leader" ? " (LĐ)" : "";
      const name = `${btnName}${roleBadge}`;
      return { name, detail: email ? `${name} (${email})` : name, email };
    }
  }

  if (prefix) {
    return { name: prefix, detail: email || prefix, email };
  }
  return { name: "Hệ thống", detail: "Hệ thống", email: "" };
}

function memberName(entityId: string, members: Member[]): string {
  const m = members.find(m => String(m.strava_athlete_id) === entityId);
  return m?.btn_name || m?.strava_name || `ID ${entityId}`;
}

function groupLabel(groupId: unknown, divisionId: unknown): string {
  if (!groupId) return "Chưa phân nhóm";
  return divisionId ? `Nhóm ${groupId} · LĐ ${divisionId}` : `Nhóm ${groupId}`;
}

function divisionLabel(divisionId: unknown): string {
  return divisionId ? `LĐ ${divisionId}` : "Chưa phân LĐ";
}

function arrow(before: string, after: string): string {
  return before === after ? after : `${before} → ${after}`;
}

function numLabel(v: unknown, suffix = ""): string {
  if (v === null || v === undefined) return "Chưa có";
  return `${Number(v).toLocaleString("vi-VN")}${suffix}`;
}

/* ── Main describe function ────────────────────────────────────── */
export function describeAudit(row: AuditRow, members: Member[]): AuditDescription {
  const { name: actorName, detail: actorDetail, email: actorEmail } = row.after_data?.source === "extension" ? {name:"Extension Strava",detail:"Đồng bộ bằng mã chung",email:""} : resolveActorName(row.actor ?? row.actor_snapshot ?? null, row.actor_id, members);
  const time = fmtTime(row.created_at);
  const before = row.before_data ?? {};
  const after = row.after_data ?? {};

  const actorParty: PartyInfo = {
    name: actorName,
    subtitle: actorEmail || "Tài khoản hệ thống",
    initials: getInitials(actorName),
    variant: "actor",
  };

  switch (row.action) {
    case "assign_member": {
      const member = members.find(m => String(m.strava_athlete_id) === row.entity_id);
      const name = member?.btn_name || member?.strava_name || `ID ${row.entity_id}`;
      const targetParty: PartyInfo = {
        name,
        subtitle: `ID ${row.entity_id}`,
        initials: getInitials(name),
        variant: "target",
      };

      const beforeGroup = groupLabel(before.group_id, before.division_id);
      const afterGroup = groupLabel(after.group_id, after.division_id);

      const beforeGroupId = before.group_id ?? null;
      const afterGroupId = after.group_id ?? null;
      const beforeDivId = before.division_id ?? null;
      const afterDivId = after.division_id ?? null;

      const groupChanged = beforeGroupId !== afterGroupId || beforeDivId !== afterDivId;
      const accountChanged = (before.auth_user_id ?? null) !== (after.auth_user_id ?? null);
      const nameChanged = (before.btn_name ?? null) !== (after.btn_name ?? null);
      const hasAccount = !!after.auth_user_id;

      let badge: ActionBadgeType = { label: "Phân nhóm", iconName: "users", color: "blue" };
      let transition: TransitionInfo = { after: "" };
      const transitions: string[] = [];
      const specificChanges: SpecificChange[] = [];

      // 1. Phân tích thay đổi nhóm
      if (groupChanged) {
        transitions.push(arrow(beforeGroup, afterGroup));
        transition = { before: beforeGroup, after: afterGroup };
        if (beforeGroupId !== afterGroupId) {
          specificChanges.push({
            label: "Nhóm nhỏ",
            before: beforeGroupId ? `Nhóm ${beforeGroupId}` : "—",
            after: afterGroupId ? `Nhóm ${afterGroupId}` : "—",
          });
        }
        if (beforeDivId !== afterDivId) {
          specificChanges.push({
            label: "Liên đoàn",
            before: beforeDivId ? `LĐ ${beforeDivId}` : "—",
            after: afterDivId ? `LĐ ${afterDivId}` : "—",
          });
        }
      }

      // 2. Phân tích thay đổi tài khoản
      if (accountChanged) {
        const beforeAcc = before.auth_user_id ? "Đã liên kết" : "Chưa liên kết";
        const afterAcc = after.auth_user_id ? "Đã liên kết" : "Bỏ liên kết";
        transitions.push(`Tài khoản: ${arrow(beforeAcc, afterAcc)}`);
        specificChanges.push({
          label: "Tài khoản",
          before: beforeAcc,
          after: afterAcc,
        });
      }

      // 3. Phân tích thay đổi tên
      if (nameChanged) {
        transitions.push(`Tên: ${arrow(String(before.btn_name ?? "—"), String(after.btn_name ?? "—"))}`);
        specificChanges.push({
          label: "Tên BTN",
          before: String(before.btn_name ?? "—"),
          after: String(after.btn_name ?? "—"),
        });
      }

      let summary = "";
      let heroHeadline = "";

      if (groupChanged && accountChanged) {
        badge = { label: "Phân nhóm", iconName: "users", color: "blue" };
        if (afterGroupId) {
          summary = `${actorName} đã phân ${name} vào ${afterGroup} và liên kết tài khoản`;
          heroHeadline = `${actorName} đã phân nhóm · ${name}`;
          transition = { before: beforeGroup, after: `${afterGroup} · Liên kết TK` };
        } else {
          summary = `${actorName} đã bỏ phân nhóm và đổi tài khoản của ${name}`;
          heroHeadline = `${actorName} đã đổi thông tin · ${name}`;
          transition = { before: beforeGroup, after: "Chưa phân nhóm" };
        }
      } else if (accountChanged) {
        if (after.auth_user_id) {
          badge = { label: "Liên kết tài khoản", iconName: "link", color: "blue" };
          summary = `${actorName} đã liên kết tài khoản đăng nhập cho ${name}`;
          heroHeadline = `${actorName} đã liên kết tài khoản · ${name}`;
          transition = { after: "Tài khoản: Đã liên kết" };
        } else {
          badge = { label: "Hủy liên kết", iconName: "unlink", color: "red" };
          summary = `${actorName} đã hủy liên kết tài khoản của ${name}`;
          heroHeadline = `${actorName} đã hủy liên kết · ${name}`;
          transition = { before: "Đã liên kết", after: "Chưa liên kết" };
        }
      } else if (groupChanged) {
        badge = { label: "Phân nhóm", iconName: "users", color: "blue" };
        if (afterGroupId) {
          const verb = beforeGroupId ? "đã chuyển" : "đã phân";
          const prep = beforeGroupId ? "sang" : "vào";
          summary = `${actorName} ${verb} ${name} ${prep} ${afterGroup}`;
          heroHeadline = `${actorName} đã phân nhóm · ${name}`;
          transition = { before: beforeGroup, after: afterGroup };
        } else {
          summary = `${actorName} đã bỏ phân nhóm của ${name}`;
          heroHeadline = `${actorName} đã bỏ phân nhóm · ${name}`;
          transition = { before: beforeGroup, after: "Chưa phân nhóm" };
        }
      } else if (hasAccount && !afterGroupId) {
        // Trường hợp thành viên đã liên kết tài khoản nhưng chưa phân nhóm (như bản ghi 39)
        badge = { label: "Liên kết tài khoản", iconName: "link", color: "blue" };
        summary = `${actorName} đã liên kết tài khoản đăng nhập cho ${name}`;
        heroHeadline = `${actorName} đã liên kết tài khoản · ${name}`;
        transition = { after: "Tài khoản: Đã liên kết" };
        if (specificChanges.length === 0) {
          specificChanges.push({
            label: "Tài khoản",
            before: "Chưa liên kết",
            after: "Đã liên kết",
          });
        }
      } else if (nameChanged) {
        badge = { label: "Cập nhật thông tin", iconName: "pencil", color: "amber" };
        summary = `${actorName} đã đổi tên BTN của ${name} thành ${after.btn_name ?? "mặc định"}`;
        heroHeadline = `${actorName} đã cập nhật thông tin · ${name}`;
        transition = { before: String(before.btn_name ?? "—"), after: String(after.btn_name ?? "—") };
      } else {
        badge = { label: "Cập nhật thông tin", iconName: "pencil", color: "amber" };
        summary = `${actorName} đã cập nhật thông tin của ${name}`;
        heroHeadline = `${actorName} đã cập nhật thông tin · ${name}`;
        if (hasAccount) {
          badge = { label: "Liên kết tài khoản", iconName: "link", color: "blue" };
          transition = { after: "Tài khoản: Đã liên kết" };
        } else if (afterGroupId) {
          transition = { after: afterGroup };
        } else {
          transition = { after: "Đã lưu thông tin" };
        }
      }

      if (transitions.length === 0) {
        transitions.push(transition.before ? arrow(transition.before, transition.after) : transition.after);
      }
      if (specificChanges.length === 0) {
        specificChanges.push({
          label: badge.label,
          before: transition.before ?? "—",
          after: transition.after,
        });
      }

      return {
        summary,
        heroHeadline,
        badge,
        actorParty,
        targetParty,
        transition,
        transitions,
        specificChanges,
        actor: actorName,
        actorDetail,
        time,
      };
    }

    case "assign_group": {
      const groupName = `Nhóm ${row.entity_id}`;
      const targetParty: PartyInfo = {
        name: groupName,
        subtitle: "Nhóm nhỏ hội thao",
        iconName: "layers",
        variant: "target",
      };
      const beforeDiv = divisionLabel(before.division_id);
      const afterDiv = divisionLabel(after.division_id);
      const badge: ActionBadgeType = { label: "Cấu hình nhóm", iconName: "layers", color: "indigo" };
      const summary = after.division_id
        ? `${actorName} đã chuyển ${groupName} sang ${afterDiv}`
        : `${actorName} đã bỏ phân liên đoàn cho ${groupName}`;
      const heroHeadline = `${actorName} đã cấu hình ${groupName}`;
      const transition: TransitionInfo = { before: beforeDiv, after: afterDiv };
      const specificChanges: SpecificChange[] = [
        { label: "Liên đoàn", before: beforeDiv, after: afterDiv }
      ];

      return {
        summary,
        heroHeadline,
        badge,
        actorParty,
        targetParty,
        transition,
        transitions: [arrow(beforeDiv, afterDiv)],
        specificChanges,
        actor: actorName,
        actorDetail,
        time,
      };
    }

    case "approve_registration": {
      const email=String(after.email??row.entity_id),name=String(after.full_name??email);
      const summary=`${actorName} đã duyệt đăng ký của ${name}`;
      return {summary,heroHeadline:summary,badge:{label:"Duyệt đăng ký",iconName:"check",color:"green"},actorParty,
        targetParty:{name,subtitle:email,initials:getInitials(name),variant:"target"},
        transition:{before:"Chờ duyệt",after:"Đã duyệt"},transitions:["Chờ duyệt → Đã duyệt"],
        specificChanges:[{label:"Đăng ký",before:"Chờ duyệt",after:"Đã duyệt"}],actor:actorName,actorDetail,time};
    }

    case "link_account_member": {
      const email = String(after.email ?? before.email ?? row.entity_id);
      const name = String(after.member_name ?? "Thành viên");
      const oldName = String(before.member_name ?? "Chưa liên kết");
      const summary = `${actorName} đã liên kết ${email} với ${name}`;
      const transition = {before: oldName, after: name};
      return {
        summary, heroHeadline: summary,
        badge: {label: "Liên kết thành viên", iconName: "link", color: "blue"},
        actorParty,
        targetParty: {name, subtitle: `${email} · ${groupLabel(after.group_id, after.division_id)}`, initials: getInitials(name), variant: "target"},
        transition, transitions: [arrow(oldName, name)],
        specificChanges: [{label: "Thành viên liên kết", before: oldName, after: name}],
        actor: actorName, actorDetail, time,
      };
    }

    case "delete_account": {
      const email = String(before.email ?? row.entity_id);
      const summary = `${actorName} đã xóa tài khoản ${email}`;
      return {
        summary, heroHeadline: summary,
        badge: {label: "Xóa tài khoản", iconName: "unlink", color: "red"}, actorParty,
        targetParty: {name: email, subtitle: "Hồ sơ Strava và hoạt động được giữ lại", initials: getInitials(email), variant: "target"},
        transition: {before: "Có tài khoản đăng nhập", after: "Đã xóa tài khoản"},
        transitions: ["Đã gỡ liên kết đăng nhập"],
        specificChanges: [{label: "Tài khoản", before: email, after: "Đã xóa"}],
        actor: actorName, actorDetail, time,
      };
    }

    case "set_account_role": {
      const email = String(after.email ?? before.email ?? row.entity_id);
      const emailPrefix = email.split("@")[0];
      const targetName = ACTOR_ALIASES[email.toLowerCase()] ?? ACTOR_ALIASES[emailPrefix.toLowerCase()] ?? emailPrefix;
      const targetParty: PartyInfo = {
        name: targetName,
        subtitle: email,
        initials: getInitials(targetName),
        variant: "target",
      };

      const beforeRole = roleLabels[String(before.role)] ?? String(before.role ?? "—");
      const afterRole = roleLabels[String(after.role)] ?? String(after.role ?? "—");
      const badge: ActionBadgeType = { label: "Thay đổi quyền", iconName: "shield", color: "purple" };
      const summary = `${actorName} đã đổi quyền của ${targetName} thành ${afterRole}`;
      const heroHeadline = `${actorName} đã đổi quyền · ${targetName}`;
      const transition: TransitionInfo = { before: beforeRole, after: afterRole };
      const specificChanges: SpecificChange[] = [
        { label: "Vai trò", before: beforeRole, after: afterRole }
      ];

      return {
        summary,
        heroHeadline,
        badge,
        actorParty,
        targetParty,
        transition,
        transitions: [arrow(beforeRole, afterRole)],
        specificChanges,
        actor: actorName,
        actorDetail,
        time,
      };
    }

    case "import_activities": {
      const inserted = Number(after.inserted ?? 0);
      const skipped = Number(after.skipped ?? 0);
      const targetParty: PartyInfo = {
        name: `${inserted} hoạt động`,
        subtitle: "Club Strava 2368312",
        iconName: "upload",
        variant: "target",
      };
      const badge: ActionBadgeType = { label: "Nhập hoạt động", iconName: "upload", color: "cyan" };
      const summary = `${actorName} đã nhập ${inserted} hoạt động · bỏ qua ${skipped} trùng`;
      const heroHeadline = `${actorName} đã nhập hoạt động Strava`;
      const transition: TransitionInfo = { after: `Đã nhập ${inserted} · Bỏ qua ${skipped}` };
      const specificChanges: SpecificChange[] = [
        { label: "Hoạt động mới", before: "0", after: String(inserted) },
        { label: "Bỏ qua trùng", before: "0", after: String(skipped) },
      ];

      return {
        summary,
        heroHeadline,
        badge,
        actorParty,
        targetParty,
        transition,
        transitions: [`Nhập ${inserted} · Bỏ qua ${skipped}`],
        specificChanges,
        actor: actorName,
        actorDetail,
        time,
      };
    }
    case "sync_members": {
      const inserted = Number(after.inserted ?? 0);
      const updated = Number(after.updated ?? 0);
      const unchanged = Number(after.unchanged ?? 0);
      const targetParty: PartyInfo = { name: `${Number(after.total ?? 0)} thành viên`, subtitle: "Club Strava 2368312", iconName: "layers", variant: "target" };
      const badge: ActionBadgeType = { label: "Đồng bộ thành viên", iconName: "users", color: "blue" };
      const summary = `Extension đã đồng bộ ${Number(after.total ?? 0)} thành viên · thêm ${inserted}, cập nhật ${updated}, giữ nguyên ${unchanged}`;
      return {
        summary,
        heroHeadline: "Extension đã đồng bộ danh sách Strava",
        badge,
        actorParty,
        targetParty,
        transition: { after: `Thêm ${inserted} · Cập nhật ${updated} · Giữ nguyên ${unchanged}` },
        transitions: [`Thêm ${inserted} · Cập nhật ${updated} · Giữ nguyên ${unchanged}`],
        specificChanges: [
          { label: "Thành viên mới", before: "0", after: String(inserted) },
          { label: "Thông tin Strava cập nhật", before: "0", after: String(updated) },
          { label: "Không đổi", before: "0", after: String(unchanged) },
        ],
        actor: actorName,
        actorDetail,
        time,
      };
    }

    case "submit_activity_appeal":
    case "resolve_activity_appeal": {
      const name=memberName(String(after.athlete_id??before.athlete_id??""),members);
      const submitted=row.action==="submit_activity_appeal";
      const outcome=submitted?"Chờ xử lý":after.status==="accepted"?"Đã chấp nhận":"Không chấp nhận";
      const verb=submitted?"gửi khiếu nại":after.status==="accepted"?"chấp nhận khiếu nại":"không chấp nhận khiếu nại";
      const reason=String(after.resolution_reason??after.reason??"—");
      return {
        summary:`${actorName} ${verb} · ${name}`,heroHeadline:`${actorName} ${verb}`,
        badge:{label:submitted?"Gửi khiếu nại":"Xử lý khiếu nại",iconName:submitted?"clock":after.status==="accepted"?"check":"x",color:submitted?"amber":after.status==="accepted"?"green":"red"},
        actorParty,targetParty:{name,subtitle:`Hoạt động #${row.entity_id}`,initials:getInitials(name),variant:"target"},
        transition:{before:submitted?"Đã duyệt":"Chờ xử lý",after:outcome},transitions:[outcome],
        specificChanges:[{label:"Khiếu nại",before:submitted?"—":"Chờ xử lý",after:outcome},{label:submitted?"Lý do khiếu nại":"Phản hồi admin",before:"—",after:reason}],
        actor:actorName,actorDetail,time,
      };
    }

    case "review_activity": {
      const athleteId = String(after.athlete_id ?? before.athlete_id ?? "");
      const name = memberName(athleteId, members);
      const targetParty: PartyInfo = {
        name,
        subtitle: `Hoạt động #${row.entity_id}`,
        initials: getInitials(name),
        variant: "target",
      };

      const beforeStatus = statusLabels[String(before.status)] ?? String(before.status ?? "—");
      const afterStatus = statusLabels[String(after.status)] ?? String(after.status ?? "—");
      const stepsText = after.steps !== undefined && after.steps !== null ? ` · ${numLabel(after.steps)} bước` : "";

      let badge: ActionBadgeType = { label: "Duyệt hoạt động", iconName: "check", color: "green" };
      let actionVerb = "đã duyệt";
      if (after.status === "rejected") {
        badge = { label: "Từ chối hoạt động", iconName: "x", color: "red" };
        actionVerb = "đã từ chối";
      } else if (after.status === "pending") {
        badge = { label: "Chờ duyệt lại", iconName: "clock", color: "amber" };
        actionVerb = "lưu chờ duyệt";
      }

      const specificChanges: SpecificChange[] = [
        { label: "Trạng thái", before: beforeStatus, after: afterStatus }
      ];
      if (before.steps !== after.steps && after.steps !== undefined) {
        specificChanges.push({ label: "Số bước", before: numLabel(before.steps), after: numLabel(after.steps) });
      }
      if (before.people_count !== after.people_count && after.people_count !== undefined) {
        specificChanges.push({ label: "Số người", before: numLabel(before.people_count, " người"), after: numLabel(after.people_count, " người") });
      }
      if (before.group_id !== after.group_id || before.division_id !== after.division_id) {
        specificChanges.push({ label: "Nhóm/LĐ tính điểm", before: groupLabel(before.group_id, before.division_id), after: groupLabel(after.group_id, after.division_id) });
      }
      if (after.points !== undefined && after.points !== before.points) {
        specificChanges.push({ label: "Điểm thưởng", before: numLabel(before.points), after: numLabel(after.points) });
      }

      const summary = `${actorName} ${actionVerb} hoạt động của ${name}${stepsText}`;
      const heroHeadline = `${actorName} ${actionVerb} hoạt động · ${name}`;
      const transition: TransitionInfo = {
        before: beforeStatus,
        after: `${afterStatus}${stepsText}`,
      };

      return {
        summary,
        heroHeadline,
        badge,
        actorParty,
        targetParty,
        transition,
        transitions: [arrow(beforeStatus, afterStatus)],
        specificChanges,
        actor: actorName,
        actorDetail,
        time,
      };
    }

    case "activate_first_admin": {
      const email = String(after.email ?? row.entity_id);
      const prefix = email.split("@")[0];
      const targetName = ACTOR_ALIASES[email.toLowerCase()] ?? ACTOR_ALIASES[prefix.toLowerCase()] ?? prefix;
      const sysActor: PartyInfo = { name: "Hệ thống", subtitle: "Tự động kích hoạt", iconName: "shield", variant: "system" };
      const targetParty: PartyInfo = { name: targetName, subtitle: email, initials: getInitials(targetName), variant: "target" };
      const badge: ActionBadgeType = { label: "Thiết lập admin", iconName: "sparkles", color: "amber" };
      const summary = `Hệ thống kích hoạt quyền Admin đầu tiên cho ${targetName}`;
      const heroHeadline = `Hệ thống kích hoạt Admin · ${targetName}`;
      const transition: TransitionInfo = { before: "Chưa kích hoạt", after: "Admin" };
      const specificChanges: SpecificChange[] = [
        { label: "Vai trò", before: "Chưa kích hoạt", after: "Admin" }
      ];

      return {
        summary,
        heroHeadline,
        badge,
        actorParty: sysActor,
        targetParty,
        transition,
        transitions: [`${email} → Admin`],
        specificChanges,
        actor: "Hệ thống",
        actorDetail: "Hệ thống",
        time,
      };
    }

    default: {
      const targetParty: PartyInfo = { name: row.entity_id, subtitle: `ID ${row.entity_id}`, variant: "target" };
      const badge: ActionBadgeType = { label: row.action, iconName: "pencil", color: "blue" };
      return {
        summary: `${actorName} thực hiện ${row.action}`,
        heroHeadline: `${actorName} · ${row.action}`,
        badge,
        actorParty,
        targetParty,
        transition: { after: row.action },
        transitions: [],
        specificChanges: [{ label: row.action, before: "—", after: "Thực hiện" }],
        actor: actorName,
        actorDetail,
        time,
      };
    }
  }
}
