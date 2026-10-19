import type {RankingsResult} from "./rankings";
import type {StatisticsResult} from "./statistics";
import type {PostMedia} from "./post-media";
import type { ClubActivity, ActivityStatus } from "./activity-data";

export type MemberActivityResult = {
  rows: Array<{
    media?:PostMedia[];activity_id: number;
    athlete_id: number;
    athlete_name: string;
    name: string;
    sport_type: string;
    start_local: string;
    steps: number | null;
    people_count: number | null;
    division_id: number | null;
    group_id: number | null;
    status: ActivityStatus;
    points: number;
    rejection_reason: string;
  }>;
  total: number;
  approved_points: number;
  pending_points: number;
};

export type AdminActivityResult = {rows: ClubActivity[];total:number;counts:Record<ActivityStatus,number>;approved_points:number};

// Session-local only. Epochs prevent an old request restoring data after logout,
// a review, or even signing back into the same account.
let owner:string|null=null;
let epoch=0;
const ttl=30_000;
type Entry<T>={value:T;fetchedAt:number};
const adminCache=new Map<string,Entry<AdminActivityResult>>();
const memberCache=new Map<string,Entry<MemberActivityResult>>();
const rankingsCache=new Map<string,Entry<RankingsResult>>();
const statisticsCache=new Map<string,Entry<StatisticsResult>>();
export function invalidateActivityData(){epoch++;adminCache.clear();memberCache.clear();rankingsCache.clear();statisticsCache.clear();}
export function setActivityCacheOwner(userId:string|null){if(owner!==userId){owner=userId;invalidateActivityData();}}
export function activityCacheEpoch(){return epoch;}
function read<T>(cache:Map<string,Entry<T>>,userId:string,key:string):T|undefined {
 if(owner!==userId)return undefined;
 const entry=cache.get(key);
 if(entry&&Date.now()-entry.fetchedAt<ttl)return entry.value;
 cache.delete(key);
}
function write<T>(cache:Map<string,Entry<T>>,userId:string,key:string,value:T,version:number){
 if(owner!==userId||version!==epoch)return;
 if(cache.size>=50)cache.delete(cache.keys().next().value!);
 cache.set(key,{value,fetchedAt:Date.now()});
}
export const getCachedAdminActivities=(userId:string,key:string)=>read(adminCache,userId,key);
export const setCachedAdminActivities=(userId:string,key:string,value:AdminActivityResult,version:number)=>write(adminCache,userId,key,value,version);
export const getCachedMemberActivities=(userId:string,key:string)=>read(memberCache,userId,key);
export const setCachedMemberActivities=(userId:string,key:string,value:MemberActivityResult,version:number)=>write(memberCache,userId,key,value,version);

export const getCachedRankings=(userId:string,key:string)=>read(rankingsCache,userId,key);
export const setCachedRankings=(userId:string,key:string,value:RankingsResult,version:number)=>write(rankingsCache,userId,key,value,version);
export const getCachedStatistics=(userId:string,key:string)=>read(statisticsCache,userId,key);
export const setCachedStatistics=(userId:string,key:string,value:StatisticsResult,version:number)=>write(statisticsCache,userId,key,value,version);
