import {pageMetadata} from "@/lib/page-metadata";
import {AuditRouteContent} from "@/components/portal-route-content";
export const metadata=pageMetadata("/audit");
export default function Page(){return <AuditRouteContent/>;}
