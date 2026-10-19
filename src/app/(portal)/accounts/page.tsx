import {pageMetadata} from "@/lib/page-metadata";
import {AccountsRouteContent} from "@/components/portal-route-content";
export const metadata=pageMetadata("/accounts");
export default function Page(){return <AccountsRouteContent/>;}
