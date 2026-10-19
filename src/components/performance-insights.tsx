"use client";
import {Analytics} from "@vercel/analytics/next";
import {SpeedInsights} from "@vercel/speed-insights/next";
import {redactInsightUrl} from "@/lib/insights";

export function PerformanceInsights(){
 return <><Analytics beforeSend={redactInsightUrl}/><SpeedInsights beforeSend={redactInsightUrl}/></>;
}
