import {Suspense,type ReactNode} from "react";
import {MemberPortal} from "@/components/member-portal";
import {PortalLoadingShell} from "@/components/portal-loading-shell";
export default function PortalLayout({children}:{children:ReactNode}) {
 return <Suspense fallback={<PortalLoadingShell/>}><MemberPortal>{children}</MemberPortal></Suspense>;
}
