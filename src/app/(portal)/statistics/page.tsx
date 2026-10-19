import {pageMetadata} from "@/lib/page-metadata";
import {StatisticsPanel} from "@/components/statistics-panel";
export const metadata=pageMetadata("/statistics");
export default function Page(){return <StatisticsPanel/>;}
