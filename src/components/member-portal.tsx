"use client";

import {invalidateActivityData} from "@/lib/activity-cache";
import {PageHeader} from "./page-header";
import {PortalLoadingShell} from "./portal-loading-shell";
import {PortalNavigation} from "./portal-navigation";
import {PortalSidebar} from "./portal-sidebar";
import { AppToastProvider, useAppToast } from "@/components/app-toast";
import { BottomDrawer, ResponsivePicker, useMobile } from "@/components/mobile-drawer";
import { ReviveHeader } from "@/components/revive-header";
import {AdminNotifications} from './admin-notifications';
import {removeBrowserPush} from '@/lib/browser-push';
import Link from "next/link";
import {PortalContext} from "./portal-context";
import {sectionForPath,canAccessSection,isPublicSection,portalRoutes} from "@/lib/portal-routes";
import { usePathname,useSearchParams,useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent,type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { RefreshCw, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

import { cachedPortal, loadAccounts, loadPortal, loadPublicPortal, setPortalOwner, type Profile, type Member, type Group } from "@/lib/portal-data";
const divisions = [1, 2, 3, 4, 5];

export function MemberPortal({children}:{children:ReactNode}) {
  return <AppToastProvider><MemberPortalContent>{children}</MemberPortalContent></AppToastProvider>;
}

function MemberPortalContent({children}:{children:ReactNode}) {
  const router = useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const notificationAccount=searchParams.get("account");
  const section=sectionForPath(pathname);
  const { add: showToast } = useAppToast();
  const mobile = useMobile();
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [accounts, setAccounts] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  useEffect(()=>{if(message) showToast({title:message,type:message === "Đã lưu thay đổi." ? "success" : "info",timeout:2000});},[message,showToast]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const ownMember = members.find(member => member.auth_user_id === session?.user.id);
  const isAdmin = profile?.role === "admin";
  const isLeader = profile?.role === "leader";
  const leaderDivision = ownMember?.division_id ?? null;

  useEffect(() => {
    if (!loading) {
      if (!session && !isPublicSection(section)) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname+(searchParams.size?`?${searchParams}`:""))}`);
      } else if (profile && !isAdmin && !ownMember && !isPublicSection(section)) {
        router.replace("/onboarding");
      }
    }
  }, [loading, session, profile, isAdmin, ownMember, router, pathname, searchParams,section]);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);

  const userId = useRef<string | null>(null);
  const mounted = useRef(false);

  const refresh = useCallback(async (current: Session | null, force = false) => {
    const id = ++requestId.current;
    const nextUser = current?.user.id ?? null;
    const changed = userId.current !== nextUser;
    userId.current = nextUser;
    setPortalOwner(nextUser);
    if (changed || !current) {
      setProfile(null); setMembers([]); setGroups([]); setAccounts([]);
      setEditing(null); setAssignmentOpen(false); dialog.current?.close();
      setAccountsError("");
    }
    setLoadError("");
    if (!current) {
      setLoading(true); setRefreshing(true);
      try {
        const data=await loadPublicPortal();
        if(mounted.current&&id===requestId.current){setMembers(data.members);setGroups(data.groups);}
      } catch(error){if(mounted.current&&id===requestId.current)setLoadError(error instanceof Error?error.message:"Không tải được dữ liệu.");}
      finally{if(mounted.current&&id===requestId.current){setLoading(false);setRefreshing(false);}}
      return;
    }
    const cached = cachedPortal(current.user.id);
    if (cached) { setProfile(cached.profile); setMembers(cached.members); setGroups(cached.groups); }
    setLoading(!cached); setRefreshing(true);
    try {
      const data = await loadPortal(current.user.id, force);
      if(!data.members.length){const publicData=await loadPublicPortal();data.members=publicData.members;data.groups=publicData.groups;}
      if (!mounted.current || id !== requestId.current) return;
      setProfile(data.profile); setMembers(data.members); setGroups(data.groups);
      if (data.profile.role !== "admin") setAccounts([]);
    } catch (error) {
      if (mounted.current && id === requestId.current) setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu.");
    } finally {
      if (mounted.current && id === requestId.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const refreshAccounts = useCallback(async (current: Session, force = false) => {
    const accountUser = current.user.id;
    setAccountsLoading(true); setAccountsError("");
    try {
      const data = await loadAccounts(accountUser, force);
      if (mounted.current && userId.current === accountUser) setAccounts(data);
    } catch (error) {
      if (mounted.current && userId.current === accountUser) setAccountsError(error instanceof Error ? error.message : "Không tải được tài khoản.");
    } finally { if (mounted.current && userId.current === accountUser) setAccountsLoading(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const requests = requestId;
    const db = getSupabase();
    let authVersion = 0;
    const initialVersion = authVersion;
    db.auth.getSession().then(({data, error}) => {
      if (!mounted.current || authVersion !== initialVersion) return;
      if (error) setMessage(error.message);
      setSession(data.session); void refresh(data.session);
    });
    const {data} = db.auth.onAuthStateChange((event, current) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      authVersion++;
      if (!current) setPortalOwner(null);
      // Leave the auth callback before querying Supabase to avoid its session lock.
      const version = authVersion;
      setTimeout(() => {
        if (!mounted.current || authVersion !== version) return;
        setSession(current);
        if(!current)void removeBrowserPush().catch(()=>{});
        if (event === "SIGNED_IN" && userId.current === current?.user.id) return;
        setMessage(""); void refresh(current);
      }, 0);
    });
    return () => { mounted.current = false; requests.current++; data.subscription.unsubscribe(); };
  }, [refresh]);



  async function mutate(action: () => PromiseLike<{error: {message:string} | null}>) {
    if(!session||!profile)return false;
    const actionUser = userId.current;
    setBusy(true); setMessage("");
    try { const result = await action(); if (actionUser !== userId.current) return false; if (result.error) throw new Error(result.error.message); invalidateActivityData(); dialog.current?.close(); setAssignmentOpen(false); await refresh(session, true); if (session && (section === "accounts" || editing)) await refreshAccounts(session, true); window.dispatchEvent(new Event("admin-inbox-changed")); setMessage("Đã lưu thay đổi."); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được thay đổi."); return false; }
    finally { setBusy(false); }
  }

  function edit(member: Member) {
    if (!isAdmin && (!isLeader || member.division_id !== leaderDivision)) return;
    if (session && isAdmin) void refreshAccounts(session);
    setEditing(member); setMessage("");
    if (mobile) setAssignmentOpen(true); else dialog.current?.showModal();
  }
  function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const data = new FormData(event.currentTarget);
    const accountVal = isLeader ? (editing.auth_user_id || null) : (data.get("account") || null);
    void mutate(() => getSupabase().rpc("assign_member_group", {athlete_id:editing.strava_athlete_id,member_name:String(data.get("name")),assigned_group:data.get("group") ? Number(data.get("group")):null,account_id:accountVal}));
  }

  useEffect(()=>{
    const timer=setTimeout(()=>{if(section==="accounts"&&isAdmin&&session)void refreshAccounts(session,!!notificationAccount);},0);
    return()=>clearTimeout(timer);
  },[section,isAdmin,session,refreshAccounts,notificationAccount]);
  useEffect(()=>{
    const timer=setTimeout(()=>{setEditing(null);setAssignmentOpen(false);dialog.current?.close();},0);
    return()=>clearTimeout(timer);
  },[pathname]);

  const eligibleAccounts = accounts.filter(a => !members.some(m => m.auth_user_id===a.id && m.strava_athlete_id!==editing?.strava_athlete_id));

  if (loading || (!session && !isPublicSection(section)) || (profile && !isAdmin && !ownMember && !isPublicSection(section))) {
    return <PortalLoadingShell section={section} role={profile?.role} activityAppeal={searchParams.get("appeal")??""} activityScope={searchParams.get("scope")==="club"?"club":"mine"} activityVariant={searchParams.get("status")==="incomplete"?"incomplete":"activity"}/>;
  }

  async function signOut(){
    await removeBrowserPush().catch(()=>{});
    const {error}=await getSupabase().auth.signOut();
    if(error){setMessage(error.message);return;}
    router.replace('/rankings');
  }
  return <div className="app-shell revive-shell" aria-busy={busy}><ReviveHeader showAbout={false}>{isAdmin&&session&&<AdminNotifications key={session.user.id} userId={session.user.id}/>}<PortalSidebar guest={!session} loginRedirect={pathname+(searchParams.size?`?${searchParams}`:"")} email={session?.user.email??""} admin={isAdmin} leader={isLeader} section={section} onSignOut={()=>void signOut()}/></ReviveHeader><main className="member-main" data-section={section}><PageHeader title={portalRoutes[section].title} metadata={section!=="accounts"&&section!=="appeals"&&section!=="settings"?`${section==="my-division"&&leaderDivision?`LĐ ${leaderDivision} · `:""}Dữ liệu club Strava · ${members[0]?new Date(members[0].synced_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"Chưa đồng bộ"}`:undefined} action={section==="groups"&&profile?<button className="text-button" disabled={refreshing||busy} onClick={()=>void refresh(session)}><RefreshCw size={15}/>{refreshing?"Đang cập nhật…":"Làm mới"}</button>:undefined}/>{loadError && <div className="portal-load-error" role="alert"><span>{profile ? "Chưa cập nhật được. Bạn đang xem dữ liệu đã tải trước đó." : "Không tải được dữ liệu. Hãy thử lại."}</span><button className="text-button" disabled={refreshing} onClick={()=>void refresh(session)}>Thử lại</button></div>}
    {((session&&!profile)||(!session&&loadError&&!members.length)) ? <section className="goal-card"><h2>Chưa tải được hồ sơ</h2><button className="primary full-width" onClick={()=>void refresh(session)}>Thử lại</button></section> : <>

    <PortalNavigation section={section} role={profile?.role}/>
    {canAccessSection(profile?.role,section)?<PortalContext.Provider key={session?.user.id??"guest"} value={{session,profile,members,groups,accounts,ownMember,isAdmin,isLeader,leaderDivision,busy,refreshing,message,accountsLoading,accountsError,edit,mutate,refreshAccounts}}>{children}</PortalContext.Provider>:<section className="goal-card" role="alert"><h2>Bạn không có quyền xem trang này.</h2><Link href="/members">Về Thành viên</Link></section>}
    </>}
  </main>{mobile ? <BottomDrawer open={assignmentOpen} onOpenChange={open=>{if(!busy) setAssignmentOpen(open);}} title="Phân công thành viên" description={editing?.strava_name} footer={false} busy={busy}><AssignmentForm onCancel={()=>setAssignmentOpen(false)} key={editing?.strava_athlete_id} editing={editing} groups={groups} accounts={eligibleAccounts} accountsLoading={accountsLoading} accountsError={accountsError} retryAccounts={()=>session && void refreshAccounts(session,true)} busy={busy} message={message} onSubmit={saveMember} isLeader={isLeader}/></BottomDrawer> : <dialog ref={dialog} className="activity-dialog" aria-labelledby="assign-title"><div className="section-heading"><h2 id="assign-title">Phân công thành viên</h2><button type="button" className="icon-button" aria-label="Đóng" onClick={()=>dialog.current?.close()}><X size={22}/></button></div><AssignmentForm key={JSON.stringify(editing)} editing={editing} groups={groups} accounts={eligibleAccounts} accountsLoading={accountsLoading} accountsError={accountsError} retryAccounts={()=>session && void refreshAccounts(session,true)} busy={busy} message={message} onSubmit={saveMember} isLeader={isLeader}/></dialog>}</div>;
}

function AssignmentForm({ editing, groups, accounts, accountsLoading, accountsError, retryAccounts, busy, message, onSubmit, onCancel, isLeader }: {
  editing: Member | null; groups: Group[]; accounts: Profile[]; accountsLoading: boolean; accountsError: string; retryAccounts: () => void; busy: boolean; message: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel?: () => void;
  isLeader?: boolean;
}) {
  const [groupId, setGroupId] = useState(String(editing?.group_id ?? ""));
  const selectedGroup = groups.find(group=>String(group.id)===groupId);
  const groupOptions = [{value:"",label:"Chưa phân nhóm"},...divisions.flatMap(division=>groups.filter(group=>group.division_id===division).map(group=>({value:String(group.id),label:`${group.name} · Liên đoàn ${division}`,childLabel:group.name,group:`Liên đoàn ${division}`})))];
  return <form className="assignment-form drawer-form" onSubmit={onSubmit}><div className="drawer-form-body" data-base-ui-swipe-ignore><label htmlFor="btn-name">Tên trong BTN</label><input id="btn-name" name="name" maxLength={120} defaultValue={editing?.btn_name ?? ""}/><label htmlFor="small-group">Nhóm nhỏ</label><ResponsivePicker id="small-group" label="Nhóm nhỏ" name="group" value={groupId} onChange={setGroupId} options={groupOptions}/><p className="assignment-group-note muted">{selectedGroup?.division_id ? `${selectedGroup.name} · Liên đoàn ${selectedGroup.division_id}` : "Chưa phân nhóm và liên đoàn"}</p>{isLeader ? <input type="hidden" name="account" value={editing?.auth_user_id ?? ""}/> : <><label htmlFor="account">Tài khoản đăng nhập</label>{accountsError && <p role="alert">Không tải được tài khoản. <button type="button" className="text-button" onClick={retryAccounts}>Thử lại</button></p>}<ResponsivePicker id="account" label="Tài khoản đăng nhập" name="account" disabled={accountsLoading || !!accountsError} defaultValue={editing?.auth_user_id ?? ""} key={`account-${editing?.strava_athlete_id}-${accountsLoading}`} options={[{value:"",label:accountsLoading ? "Đang tải tài khoản…" : "Chưa liên kết"},...accounts.map(account=>({value:account.id,label:account.full_name ? `${account.full_name} (${account.email})` : account.email}))]}/></>}{message && <p className="drawer-error" role="status">{message}</p>}</div><footer className="drawer-footer drawer-actions">{onCancel && <button type="button" className="drawer-cancel" disabled={busy} onClick={onCancel}>Hủy</button>}<button className="primary full-width" disabled={busy || accountsLoading || !!accountsError}>{busy ? "Đang lưu…" : "Lưu phân công"}</button></footer></form>;
}

