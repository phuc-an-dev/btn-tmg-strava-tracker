import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/site";
import { aboutShare } from "@/lib/about-share";
import "./globals.css";
import {NuqsAdapter} from "nuqs/adapters/next/app";
import {PerformanceInsights} from "@/components/performance-insights";
import {AppUpdateProvider} from "@/components/app-update";

const {title,text:description} = aboutShare;
const shareImage = { url: "/revive/og/about-v2.png", width: 1200, height: 630, alt: "REVIVE · Hội thao 2026 · Ban Thanh Niên Trương Minh Giảng" };

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "REVIVE",
  keywords: ["REVIVE", "Hội thao 2026", "Ban Thanh Niên", "Trương Minh Giảng", "hội thao BTN", "đi bộ", "Strava"],
  icons: { icon: "/revive/logo.png", apple: {url:"/revive/app-icon-180.png",sizes:"180x180",type:"image/png"} },
  appleWebApp: {capable:true,title:"REVIVE",statusBarStyle:"default"},
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "REVIVE · Hội thao 2026",
    title,
    description,
    url: "/about",
    images: [shareImage],
  },
  twitter: { card: "summary_large_image", title, description, images: [shareImage] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4fb8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><AppUpdateProvider><NuqsAdapter>{children}</NuqsAdapter></AppUpdateProvider><PerformanceInsights/></body></html>;
}
