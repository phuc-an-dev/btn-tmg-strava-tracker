import {pageMetadata} from "@/lib/page-metadata";
import {GroupsRouteContent} from "@/components/portal-route-content";
export const metadata=pageMetadata("/groups");
export default function Page(){return <GroupsRouteContent/>;}
