"use client";
import Image from "next/image";
import Link from "next/link";
import {reviveFont} from "@/lib/fonts";
import {useEffect,useState,type ReactNode} from "react";

export function ReviveHeader({ children, showAbout = true }: { children?: ReactNode; showAbout?: boolean }) {
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    let frame=0,collapsed=false;
    const update=()=>{
      frame=0;
      const next=window.scrollY>(collapsed?8:48);
      if(next!==collapsed){collapsed=next;setCompact(next);}
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    schedule();
    window.addEventListener("scroll",schedule,{passive:true});
    window.addEventListener("pageshow",schedule);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",schedule);window.removeEventListener("pageshow",schedule);};
  },[]);
  return <div className="revive-header-slot"><header className="header revive-header" data-compact={compact||undefined}>
    <Link className="brand revive-brand" href="/" aria-label="REVIVE · Hội thao 2026, trang chủ">
      <Image src="/revive/logo.png" width={52} height={60} alt="" preload />
      <span><span className={`${reviveFont.className} revive-wordmark`}>REVIVE</span><small>HỘI THAO 2026</small></span>
    </Link>
    <div className="header-actions">{showAbout && <Link className="about-link" href="/about">Về REVIVE</Link>}{children}</div>
  </header></div>;
}
