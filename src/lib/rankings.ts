import type {PostMedia} from "./post-media";
export type IndividualRanking={kudos?:number;posts?:number;athlete_id:number;name:string;division_id:number|null;group_id:number|null;gender:"male"|"female"|null;is_me:boolean;steps:number;points:number;activities:number;days:number;lifetime_steps:number;lifetime_days:number};
export type TeamRanking={kudos?:number;posts?:number;id:number;name:string;division_id:number;steps:number;points:number;activities:number;members:number;participants:number};
export type RankingsResult={individuals:IndividualRanking[];groups:TeamRanking[];divisions:TeamRanking[];featured?:{media?:PostMedia[];post_id:number;title:string;name:string;kudos:number;posted_at:string;division_id:number|null;group_id:number|null}[];summary:{kudos?:number;posts_with_kudos?:number;updated_at?:string|null;steps:number;points:number;activities:number;participants:number;roster:number;with_gender:number}};
export function ranked<T>(rows:T[],score:(row:T)=>number):(T&{rank:number})[] {
 let previous:number|undefined,rank=0;
 return [...rows].sort((a,b)=>score(b)-score(a)).map(row=>{const value=score(row);if(value!==previous)rank++;previous=value;return {...row,rank};});
}
export type RankingWithin="all"|"group"|"division";
type RankingMembership={group_id:number|null;division_id:number|null};
export function availableRankingWithin(within:RankingWithin,member:RankingMembership|undefined):RankingWithin {
 return (within==="group"&&!member?.group_id)||(within==="division"&&!member?.division_id)?"all":within;
}
export function individualRankings(rows:IndividualRanking[],within:RankingWithin,member:RankingMembership|undefined,gender:string,isKudos=false) {
 const scope=availableRankingWithin(within,member);
 return ranked(rows.filter(row=>(!gender||row.gender===gender)&&(scope==="all"||(scope==="group"?row.group_id===member?.group_id:row.division_id===member?.division_id))),row=>isKudos?row.kudos??0:row.steps);
}
export function ownRankingPosition(rows:(IndividualRanking&{rank:number})[],isKudos=false) {
 const index=rows.findIndex(row=>row.is_me&&(!isKudos||(row.kudos??0)>0));
 if(index<0)return null;
 const own=rows[index],score=(row:IndividualRanking)=>isKudos?row.kudos??0:row.steps;
 // Skip tied peers; the next higher score may belong to more than one person.
 const above=rows.slice(0,index).reverse().find(row=>score(row)>score(own));
 return {own,page:Math.floor(index/10)+1,above,gap:above?score(above)-score(own):0};
}
export function participation(row:Pick<TeamRanking,"members"|"participants">) {return row.members?Math.round(row.participants/row.members*100):0;}
export function earnedBadges(row:Pick<IndividualRanking,"activities"|"lifetime_steps"|"lifetime_days">) {
 const badges:string[]=[];
 const milestone=[200000,100000,50000].find(n=>row.lifetime_steps>=n);
 if(milestone)badges.push(`${(milestone/1000).toLocaleString("vi-VN")}K bước`);
 if(row.lifetime_days>=7)badges.push("Bền bỉ · 7 ngày");
 if(row.activities>0)badges.push("Khởi động");
 return badges;
}

export function postDisplayTitle(title:string) {
 return title.replace(/https?:\/\/\S+|www\.\S+/gi," ").replace(/\s+/g," ").trim()||"Bài chia sẻ hoạt động";
}
