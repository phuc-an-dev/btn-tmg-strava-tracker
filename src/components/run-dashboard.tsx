"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Flag, Footprints, House, Plus, Route, Target, Timer, X } from "lucide-react";

type Activity = { id: number; title: string; distance: number; minutes: number; date: string };
type Tab = "overview" | "activities" | "goal";
const initialActivities: Activity[] = [
  { id: 1, title: "Chạy sáng cùng TMG", distance: 5.2, minutes: 32, date: "Hoạt động mẫu" },
  { id: 2, title: "Một vòng công viên", distance: 3.8, minutes: 25, date: "Hoạt động mẫu" },
  { id: 3, title: "Chạy nhẹ cuối tuần", distance: 7, minutes: 46, date: "Hoạt động mẫu" },
];
const tabs = [
  { id: "overview", label: "Tổng quan", icon: House },
  { id: "activities", label: "Hoạt động", icon: Route },
  { id: "goal", label: "Mục tiêu", icon: Target },
] as const;
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function RunDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [activities, setActivities] = useState(initialActivities);
  const [goal, setGoal] = useState(30);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const distance = activities.reduce((total, activity) => total + activity.distance, 0);
  const minutes = activities.reduce((total, activity) => total + activity.minutes, 0);
  const progress = Math.min(100, Math.round(distance / goal * 100));

  function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const km = Number(data.get("distance"));
    const duration = Number(data.get("minutes"));
    if (!title || !Number.isFinite(km) || km <= 0 || !Number.isFinite(duration) || duration <= 0) return;
    setActivities(previous => [{ id: Date.now(), title, distance: km, minutes: duration, date: "Vừa thêm" }, ...previous]);
    form.reset();
    dialog.current?.close();
    setMessage("Đã thêm hoạt động vào bản demo.");
  }

  return (
    <div className="app-shell">
      <header className="header">
        <Link className="brand" href="/" aria-label="TMG Run - Trang chủ"><span className="brand-icon"><Footprints size={24} /></span><span>TMG<span className="brand-light"> RUN</span></span></Link>
        <span className="demo-badge">Bản demo</span>
      </header>
      <main id="main-content">
        <div className="page-heading"><div><p className="eyebrow">CÙNG NHAU TIẾN BƯỚC</p><h1>{tab === "overview" ? "Mỗi bước chạy,\nmột kết nối." : tab === "activities" ? "Những bước chân\ncủa bạn." : "Một mục tiêu,\nnhiều bước nhỏ."}</h1><p className="muted">Dành thời gian cho sức khỏe. Lan tỏa tinh thần TMG.</p></div><button className="primary add-button" onClick={() => dialog.current?.showModal()}><Plus size={20} />Thêm hoạt động</button></div>
        <p className="demo-note">Dữ liệu minh họa · Chưa kết nối Strava · Thay đổi chỉ lưu trong phiên hiện tại.</p>
        <div role="status" className="status-message">{message}</div>
        {tab === "overview" && <>
          <section className="hero-card" aria-labelledby="hero-title">
            <div className="hero-content"><span className="pill"><Flag size={15} /> HÀNH TRÌNH CỦA BẠN</span><h2 id="hero-title">Bắt đầu nhỏ.<br />Đi xa cùng nhau.</h2><p>Mỗi kilomet đều là một bước tiến.<br />Hôm nay, bạn đã sẵn sàng chưa?</p><button className="hero-link" onClick={() => setTab("goal")}>Xem mục tiêu của tôi <ArrowUpRight size={20} /></button></div>
            <div className="route-art" aria-hidden="true"><svg viewBox="0 0 300 240" fill="none"><path d="M40 185C-5 90 90 160 100 85S220 25 205 105s90 25 60 105" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 11" /><circle cx="40" cy="185" r="12" fill="currentColor" /><circle cx="265" cy="210" r="12" stroke="currentColor" strokeWidth="4" /></svg><span className="route-caption">LET’S KEEP MOVING</span></div>
          </section>
          <section className="stats" aria-label="Thống kê hoạt động">
            <article className="stat-card"><Route size={22} /><p>Tổng quãng đường</p><strong>{number.format(distance)} <span>km</span></strong></article>
            <article className="stat-card"><Footprints size={22} /><p>Hoạt động</p><strong>{activities.length} <span>buổi</span></strong></article>
            <article className="stat-card"><Timer size={22} /><p>Thời gian vận động</p><strong>{number.format(minutes)} <span>phút</span></strong></article>
          </section>
        </>}
        {tab !== "activities" && <section className="goal-card" aria-labelledby="goal-title"><div className="section-heading"><div className="goal-label"><span className="soft-icon"><Target size={22} /></span><div><h2 id="goal-title">Mục tiêu quãng đường</h2><p className="muted">Từng bước một, bạn đang tiến gần hơn.</p></div></div><strong>{progress}%</strong></div><progress value={Math.min(distance, goal)} max={goal} aria-label="Tiến độ mục tiêu" /><div className="progress-caption"><span><b>{number.format(distance)}</b> / {number.format(goal)} km</span><span>{distance >= goal ? "Đã đạt mục tiêu!" : `Còn ${number.format(goal - distance)} km`}</span></div>{tab === "goal" && <form className="goal-form" onSubmit={event => { event.preventDefault(); const value = Number(new FormData(event.currentTarget).get("goal")); if (Number.isFinite(value) && value > 0) { setGoal(value); setMessage("Đã cập nhật mục tiêu."); } }}><label htmlFor="goal">Mục tiêu mới (km)</label><div><input id="goal" name="goal" type="number" min="1" max="10000" step="1" defaultValue={goal} required /><button className="primary" type="submit">Lưu mục tiêu</button></div></form>}</section>}
        {tab !== "goal" && <section className="activity-section" aria-labelledby="activity-title"><div className="section-heading"><h2 id="activity-title">{tab === "overview" ? "Hoạt động gần đây" : "Tất cả hoạt động"}</h2>{tab === "overview" && <button className="text-button" onClick={() => setTab("activities")}>Xem tất cả <ChevronRight size={16} /></button>}</div><div className="activity-list">{(tab === "overview" ? activities.slice(0, 3) : activities).map(activity => <article className="activity" key={activity.id}><span className="activity-icon"><Footprints size={22} /></span><div className="activity-info"><h3>{activity.title}</h3><p>{activity.date} <span>·</span> {activity.minutes} phút</p></div><strong>{number.format(activity.distance)}<span> km</span></strong></article>)}</div></section>}
        <footer className="page-footer">Mỗi bước chân đều có ý nghĩa.</footer>
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng chính">{tabs.map(item => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><item.icon size={22} /><span>{item.label}</span></button>)}</nav>
      <dialog ref={dialog} className="activity-dialog"><form onSubmit={addActivity}><div className="section-heading"><h2>Thêm hoạt động</h2><button type="button" className="icon-button" aria-label="Đóng" onClick={() => dialog.current?.close()}><X size={22} /></button></div><p className="muted">Ghi lại một bước tiến của bạn hôm nay.</p><label htmlFor="title">Tên hoạt động</label><input id="title" name="title" placeholder="Chạy sáng tại công viên" maxLength={80} required autoFocus /><div className="form-grid"><div><label htmlFor="distance">Quãng đường (km)</label><input id="distance" name="distance" type="number" inputMode="decimal" min="0.1" max="1000" step="0.1" placeholder="5" required /></div><div><label htmlFor="minutes">Thời gian (phút)</label><input id="minutes" name="minutes" type="number" inputMode="numeric" min="1" max="10000" step="1" placeholder="30" required /></div></div><button className="primary full-width" type="submit"><Plus size={20} /> Lưu hoạt động</button></form></dialog>
    </div>
  );
}
