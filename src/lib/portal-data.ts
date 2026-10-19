import {setActivityCacheOwner} from "./activity-cache";
import { getSupabase } from "./supabase";

export type Role = "admin" | "leader" | "user";
export type Profile = { id: string; email: string; role: Role; full_name?: string | null; birth_year?: number | null; gender?: string | null; created_at?: string;email_verified_at?:string|null;approved_at?:string|null;approved_by?:string|null;requested_group_id?:number|null;requested_strava_athlete_id?:number|null;requested_strava_url?:string|null };
export type Member = { strava_athlete_id: number; strava_name: string; btn_name: string | null; division_id: number | null; group_id: number | null; auth_user_id: string | null; synced_at: string; active: boolean };
export type Group = { id: number; name: string; division_id: number | null };
type PortalData = { profile: Profile; members: Member[]; groups: Group[] };

// Memory only: discard data on sign-out/account change, and never persist a roster.
let owner: string | null = null;
let generation = 0;
let roster: PortalData | undefined;
let accounts: Profile[] | undefined;
let rosterRequest: Promise<PortalData> | undefined;
let accountsRequest: Promise<Profile[]> | undefined;
let accountsFetchedAt = 0;

export function setPortalOwner(userId: string | null) {
  if (owner === userId) return;
  owner = userId;
  setActivityCacheOwner(userId);
  generation++;
  roster = undefined;
  accounts = undefined;
  rosterRequest = undefined;
  accountsRequest = undefined;
  accountsFetchedAt = 0;
}

export function cachedPortal(userId: string) { return owner === userId ? roster : undefined; }

export function loadPortal(userId: string, force = false): Promise<PortalData> {
  setPortalOwner(userId);
  if (rosterRequest) return force ? rosterRequest.catch(() => undefined).then(() => {
    if (owner !== userId) throw new Error("Account changed");
    return loadPortal(userId);
  }) : rosterRequest;
  const version = generation;
  const db = getSupabase();
  const request = Promise.all([
    db.from("profiles").select("id,email,role,full_name,birth_year,gender,requested_group_id,requested_strava_athlete_id,requested_strava_url").eq("id", userId).single(),
    db.from("members").select("strava_athlete_id,strava_name,btn_name,division_id,group_id,auth_user_id,synced_at,active").order("strava_name").order("strava_athlete_id"),
    db.from("small_groups").select("id,name,division_id").order("id"),
  ]).then(([p, m, g]) => {
    for (const result of [p, m, g]) if (result.error) throw new Error(result.error.message);
    const data = { profile: p.data as Profile, members: m.data as Member[], groups: g.data as Group[] };
    if (version === generation) {
      roster = data;
      if (data.profile.role !== "admin") { accounts = undefined; accountsFetchedAt = 0; }
    }
    return data;
  }).finally(() => { if (rosterRequest === request) rosterRequest = undefined; });
  rosterRequest = request;
  return request;
}

export function loadAccounts(userId: string, force = false): Promise<Profile[]> {
  setPortalOwner(userId);
  if (accountsRequest) return force ? accountsRequest.catch(() => undefined).then(() => {
    if (owner !== userId) throw new Error("Account changed");
    return loadAccounts(userId, true);
  }) : accountsRequest;
  if (!force && accounts && Date.now() - accountsFetchedAt < 30_000) return Promise.resolve(accounts);
  const version = generation;
  const request = Promise.resolve(getSupabase().from("profiles").select("id,email,role,full_name,birth_year,gender,created_at,email_verified_at,approved_at,approved_by,requested_group_id,requested_strava_athlete_id,requested_strava_url").order("created_at",{ascending:false}).order("id",{ascending:false})).then(result => {
    if (result.error) throw new Error(result.error.message);
    const data = result.data as Profile[];
    if (version === generation && roster?.profile.role === "admin") { accounts = data; accountsFetchedAt = Date.now(); }
    return data;
  }).finally(() => { if (accountsRequest === request) accountsRequest = undefined; });
  accountsRequest = request;
  return request;
}

// This RPC deliberately omits account IDs and contact information. Never reuse the private roster cache.
export async function loadPublicPortal(){
 const {data,error}=await getSupabase().rpc("get_public_portal");
 if(error)throw new Error(error.message);
 return {members:(data.members as Omit<Member,"auth_user_id">[]).map(member=>({...member,auth_user_id:null})),groups:data.groups as Group[]};
}
