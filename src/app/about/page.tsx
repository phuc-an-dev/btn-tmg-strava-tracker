import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Activity, CalendarDays } from "lucide-react";
import { ReviveHeader } from "@/components/revive-header";
import { AboutScripture } from "@/components/about-scripture";
import { AboutMeaning } from "@/components/about-meaning";
import { aboutShare } from "@/lib/about-share";
import { AboutShareButton } from "@/components/about-share-button";

const shareImage={url:"/revive/og/about-v2.png",width:1200,height:630,alt:"REVIVE · Hội thao 2026 · Ban Thanh Niên Trương Minh Giảng",type:"image/png"};
export const metadata: Metadata = {
 title:aboutShare.title,
 description:aboutShare.text,
 alternates:{canonical:aboutShare.url},
 robots:{index:true,follow:true},
 openGraph:{type:"website",locale:"vi_VN",siteName:"REVIVE · Hội thao 2026",title:aboutShare.title,description:aboutShare.text,url:aboutShare.url,images:[shareImage]},
 twitter:{card:"summary_large_image",title:aboutShare.title,description:aboutShare.text,images:[shareImage]},
};
const organizers = [
  { image: 8, name: "Trần Thành Tín", role: "Trưởng BTC" },
  { image: 9, name: "Nguyễn Giang Trọng Vân", role: "Phó BTC" },
  { image: 10, name: "Đào Phạm Bảo Anh", role: "Thư ký" },
  { image: 11, name: "Phạm Trình Ân Phúc", role: "Điều phối đi bộ" },
  { image: 12, name: "Nguyễn Hoàng Phúc", role: "Điều phối đối kháng" },
  { image: 13, name: "Võ Phương An Bình", role: "Thủ quỹ" },
];
const events = [
  { date: "04/10", iso: "2026-10-04", title: "Đi bộ", color: "blue" },
  { date: "18/10", iso: "2026-10-18", title: "Nhảy cổ động & Bóng chụp", color: "lime" },
  { date: "15/11", iso: "2026-11-15", title: "Vận động tiếp sức & Ngày hội", color: "orange" },
];

export default function AboutPage() {
  return <div className="app-shell revive-shell about-shell"><ReviveHeader showAbout={false}><AboutShareButton/></ReviveHeader>
    <main className="about-main">
      <section className="about-hero"><h1 className="sr-only">REVIVE · Hội thao 2026 · Ban Thanh Niên Trương Minh Giảng</h1><Image className="about-banner" src="/revive/about-event.png" width={1920} height={1080} alt="Hội thao 2026 · Ban Thanh Niên Trương Minh Giảng" preload sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1040px) calc(100vw - 64px), 976px"/><div className="about-hero-caption"><p className="revive-tagline">Vực tâm linh · Vực tinh thần · Vực thể chất</p><span className="event-period"><CalendarDays size={14} aria-hidden="true"/>04/10 — 15/11/2026</span></div></section>
      <AboutScripture/>
      <section className="about-section"><p className="eyebrow">TINH THẦN REVIVE</p><h2>Ba phương diện. Một hành trình.</h2><div className="values-grid">
        <article className="value-card lime"><span className="value-icon" aria-hidden="true"/><h3>Vực tâm linh</h3><p>Khỏi sự nguội lạnh, thối lui.</p></article>
        <article className="value-card blue"><span className="value-icon" aria-hidden="true"/><h3>Vực thể chất</h3><p>Để có một thân thể khỏe mạnh, sẵn sàng cho công tác nhà Chúa, cho công việc trong cuộc sống và tận hưởng niềm vui sống Chúa ban.</p></article>
        <article className="value-card orange"><span className="value-icon" aria-hidden="true"/><h3>Vực tinh thần</h3><p>Trước những thất bại, mệt mỏi, yếu đuối của bản thân.</p></article>
      </div><AboutMeaning/></section>
      <section className="about-section"><p className="eyebrow">04/10 — 15/11/2026</p><h2>Tiến trình hội thao</h2><Image className="about-banner about-timeline-banner" src="/revive/about-revive.png" width={1920} height={1080} alt="REVIVE · Ban Thanh Niên Trương Minh Giảng" sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1040px) calc(100vw - 64px), 976px"/><ol className="event-timeline">{events.map(event=><li className={event.color} key={event.iso}><time dateTime={event.iso}>{event.date}</time><div><span>HỘI THAO 2026</span><h3>{event.title}</h3></div></li>)}</ol></section>
      <section className="about-section"><p className="eyebrow">CÙNG NHAU PHỤC VỤ</p><h2>Ban tổ chức</h2><div className="organizer-grid">{organizers.map(person=><article className="organizer-card" key={person.image}><Image src={`/revive/organizer-${person.image}.png`} width={1920} height={1080} alt="" sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw" /><div><h3>{person.name}</h3><p>{person.role}</p></div></article>)}</div></section>
    </main><footer className="revive-footer">REVIVE · Hội thao 2026<br/>Ban Thanh Niên Trương Minh Giảng</footer><Link className="about-activity-fab" href="/activities"><Activity size={18} aria-hidden="true"/>Xem hoạt động đi bộ</Link>
  </div>;
}
