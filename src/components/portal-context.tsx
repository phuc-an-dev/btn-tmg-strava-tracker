"use client";
import {createContext,useContext} from "react";
import type {Session} from "@supabase/supabase-js";
import type {Profile,Member,Group} from "@/lib/portal-data";
export type PortalDataContext={
 session:Session|null;profile:Profile|null;members:Member[];groups:Group[];accounts:Profile[];
 ownMember:Member|undefined;isAdmin:boolean;isLeader:boolean;leaderDivision:number|null;
 busy:boolean;refreshing:boolean;message:string;accountsLoading:boolean;accountsError:string;
 edit:(member:Member)=>void;
 mutate:(action:()=>PromiseLike<{error:{message:string}|null}>)=>Promise<boolean>;
 refreshAccounts:(session:Session,force?:boolean)=>Promise<void>;
};
export const PortalContext=createContext<PortalDataContext|null>(null);
export function usePortal(){const context=useContext(PortalContext);if(!context)throw new Error("Portal route requires the authenticated portal layout.");return context;}

export function useAuthenticatedPortal(){const context=usePortal();if(!context.session||!context.profile)throw new Error("Authenticated portal required.");return {...context,session:context.session,profile:context.profile};}
