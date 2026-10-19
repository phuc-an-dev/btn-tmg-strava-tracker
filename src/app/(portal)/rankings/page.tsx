import {pageMetadata} from "@/lib/page-metadata";
import {RankingsPanel} from "@/components/rankings-panel";
export const metadata=pageMetadata("/rankings");
export default function Page(){return <RankingsPanel/>;}
