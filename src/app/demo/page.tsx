import {pageMetadata} from "@/lib/page-metadata";
import { RunDashboard } from "@/components/run-dashboard";
export const metadata=pageMetadata("/demo");
export default function DemoPage() { return <RunDashboard />; }
