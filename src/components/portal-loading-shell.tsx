"use client";
import {Suspense} from "react";
import {usePathname} from "next/navigation";
import {Menu} from "lucide-react";
import {portalRoutes,sectionForPath,type PortalSection} from "@/lib/portal-routes";
import type {Role} from "@/lib/portal-data";
import {PageHeader} from "./page-header";
import {ReviveHeader} from "./revive-header";
import {RankingsSkeleton,RankingsRouteSkeleton} from "./rankings-panel";
import {MemberListSkeleton} from "./member-list-skeleton";
import {ActivityListSkeleton} from "./activity-list-skeleton";
import {AuditListSkeleton} from "./audit-list-skeleton";
import {DivisionSkeleton} from "./division-skeleton";
import {GroupsSkeleton} from "./groups-skeleton";
import {AccountsSkeleton} from "./accounts-skeleton";
import {PortalNavigation} from "./portal-navigation";
import {AppealsSkeleton} from "./appeals-skeleton";
import {StatisticsSkeleton} from "./statistics-skeleton";

export function PortalLoadingShell({section:requestedSection,role,activityScope="mine",activityVariant="activity",activityAppeal=""}:{section?:PortalSection;role?:Role;activityScope?:"mine"|"club";activityVariant?:"activity"|"incomplete";activityAppeal?:string}) {
 const pathname=usePathname();
 const section=requestedSection??sectionForPath(pathname);
 return <div className="app-shell revive-shell">
  <ReviveHeader showAbout={false}><button className="sidebar-trigger icon-button" aria-label="Đang tải menu" disabled><Menu size={23}/></button></ReviveHeader>
  <main className="member-main" data-section={section}>
   <PageHeader title={portalRoutes[section].title} loading={section!=="accounts"&&section!=="appeals"&&section!=="settings"}/>
   <PortalNavigation section={section} role={role}/>
   {section==="members"&&<MemberListSkeleton showAssignActions={role==="admin"||role==="leader"}/>}
   {section==="rankings"&&<Suspense fallback={<RankingsSkeleton/>}><RankingsRouteSkeleton/></Suspense>}
   {section==="statistics"&&<StatisticsSkeleton/>}
   {section==="activities"&&<ActivityListSkeleton userRole={role} memberScope={activityScope} variant={activityVariant} appealFilter={activityAppeal}/>}
   {section==="my-division"&&<DivisionSkeleton/>}
   {section==="groups"&&<GroupsSkeleton/>}
   {section==="audit"&&<AuditListSkeleton/>}
   {section==="appeals"&&<AppealsSkeleton/>}
   {section==="accounts"&&<AccountsSkeleton/>}
   {section==="settings"&&<p className="muted" role="status">Đang tải cài đặt…</p>}
  </main>
 </div>;
}
