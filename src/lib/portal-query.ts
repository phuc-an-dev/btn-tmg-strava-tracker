"use client";
import {useEffect,useState} from "react";
import {createParser,parseAsString,parseAsStringLiteral,parseAsNumberLiteral} from "nuqs";
import {statisticsIds} from "./statistics";
export const pageParser=createParser({
 parse:(value:string)=>/^\d+$/.test(value)&&Number(value)>=1&&Number(value)<=10000?Number(value):null,
 serialize:String,
}).withDefault(1);
const q=parseAsString.withDefault("");
const division=parseAsStringLiteral(["","1","2","3","4","5"]).withDefault("");
const group=parseAsStringLiteral(["","1","2","3","4","5","6","7","8","9","10"]).withDefault("");
export const membersQuery={q,division:parseAsStringLiteral(["","unassigned","1","2","3","4","5"]).withDefault(""),page:pageParser,size:parseAsNumberLiteral([10,20,50]).withDefault(10)};
export const memberActivitiesQuery={q,appeal:parseAsStringLiteral(["","all","pending","accepted","rejected"]).withDefault(""),scope:parseAsStringLiteral(["mine","club"]).withDefault("mine"),status:parseAsStringLiteral(["all","pending","approved","rejected","incomplete"]).withDefault("all"),division,group,page:pageParser};
export const adminActivitiesQuery={q,status:parseAsStringLiteral(["pending","approved","incomplete"]).withDefault("pending"),division,page:pageParser};
export const appealsQuery={q,appeal:parseAsString.withDefault(""),status:parseAsStringLiteral(["pending","accepted","rejected"]).withDefault("pending"),page:pageParser};
export const accountsQuery={q,account:parseAsString.withDefault(""),status:parseAsStringLiteral(["pending","approved"]).withDefault("pending"),role:parseAsStringLiteral(["","admin","leader","user"]).withDefault("")};
export const auditQuery={q,action:parseAsStringLiteral(["","assign_member","approve_registration","link_account_member","assign_group","set_account_role","delete_account","import_activities","sync_members","review_activity","submit_activity_appeal","resolve_activity_appeal","activate_first_admin"]).withDefault(""),page:pageParser};
export const queryOptions={history:"replace",shallow:true,scroll:false,clearOnDefault:true} as const;
// URL state is immediate; client-side data fetching waits for typing to settle.
export function useDebouncedSearch(value:string) {
 const [settled,setSettled]=useState(value);
 useEffect(()=>{const timer=setTimeout(()=>setSettled(value),300);return()=>clearTimeout(timer);},[value]);
 return value===""?"":settled;
}
export const rankingsQuery={q,within:parseAsStringLiteral(["all","group","division"]).withDefault("all"),metric:parseAsStringLiteral(["performance","kudos"]).withDefault("performance"),tab:parseAsStringLiteral(["individuals","groups","divisions","top-kudos"]).withDefault("individuals"),period:parseAsStringLiteral(["event","week"]).withDefault("event"),gender:parseAsStringLiteral(["","male","female"]).withDefault(""),page:pageParser};
export const statisticsQuery={scope:parseAsStringLiteral(["individuals","groups","divisions"]).withDefault("individuals"),period:parseAsStringLiteral(["week","event"]).withDefault("event"),mode:parseAsStringLiteral(["daily","cumulative"]).withDefault("daily"),entities:createParser({parse:statisticsIds,serialize:(ids:number[])=>ids.join(","),eq:(a:number[],b:number[])=>a.join(",")===b.join(",")}).withDefault([])};
