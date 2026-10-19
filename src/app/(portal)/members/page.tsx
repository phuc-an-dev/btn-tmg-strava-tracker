import {pageMetadata} from "@/lib/page-metadata";
import {MembersRouteContent} from "@/components/portal-route-content";
export const metadata=pageMetadata("/members");
export default function Page(){return <MembersRouteContent/>;}
