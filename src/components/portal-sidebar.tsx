"use client";
import Image from "next/image";
import Link from "next/link";
import {Drawer} from "@base-ui/react/drawer";
import {Award,ChartPie,Activity,ChartNoAxesCombined,Flag,History,Info,Layers,LogOut,Menu,MessageSquareWarning,Settings,ShieldCheck,Trophy,Users,X} from "lucide-react";
import {useState} from "react";
import {reviveFont} from "@/lib/fonts";

export function PortalSidebar({email,admin,leader,section,onSignOut,guest=false,loginRedirect="/contributions"}:{loginRedirect?:string;email:string;guest?:boolean;admin:boolean;leader?:boolean;section:string;onSignOut:()=>void}) {
 const [open,setOpen]=useState(false);
 const role=admin?"Admin":leader?"LĐ trưởng":"Thành viên";
 return <>
  <button className="sidebar-trigger icon-button" aria-label="Mở menu" aria-expanded={open} onClick={()=>setOpen(true)}><Menu size={23}/></button>
  <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="left"><Drawer.Portal>
   <Drawer.Backdrop className="drawer-backdrop"/>
   <Drawer.Viewport className="sidebar-viewport"><Drawer.Popup className="portal-sidebar" initialFocus={false}>
    <header>
     <Drawer.Title className="sidebar-brand"><Image src="/revive/logo.png" width={36} height={42} alt=""/><span><span className={`${reviveFont.className} revive-wordmark`}>REVIVE</span><small>HỘI THAO 2026</small></span></Drawer.Title>
     <Drawer.Close className="drawer-close" aria-label="Đóng menu"><X size={18}/></Drawer.Close>
    </header>
    <Drawer.Description className="sr-only">Menu hội thao và tài khoản đăng nhập.</Drawer.Description>
    <section className="sidebar-account" aria-label="Tài khoản đăng nhập">
     <span className="sidebar-avatar" aria-hidden="true">{email.trim().charAt(0).toUpperCase()||"R"}</span>
     <div><p className="sidebar-email">{email||"Chào bạn"}</p><span className="sidebar-role">{guest?"Chưa đăng nhập":role}</span></div>
    </section>
    <nav aria-label="Menu hội thao">
     <section className="sidebar-menu-group"><h3>Hội thao</h3>
      <Link href="/members" aria-current={section==="members"?"page":undefined} onClick={()=>setOpen(false)}><Users size={20}/>Thành viên</Link>
      <Link href="/activities" aria-current={section==="activities"?"page":undefined} onClick={()=>setOpen(false)}><Activity size={20}/>Hoạt động</Link>
      <Link href="/rankings" aria-current={section==="rankings"?"page":undefined} onClick={()=>setOpen(false)}><Trophy size={20}/>Xếp hạng</Link>
      <Link href="/statistics" aria-current={section==="statistics"?"page":undefined} onClick={()=>setOpen(false)}><ChartNoAxesCombined size={20}/>Thống kê</Link>
      <Link href="/contributions" aria-current={section==="contributions"?"page":undefined} onClick={()=>setOpen(false)}><ChartPie size={20}/>Đóng góp</Link>
      <Link href="/honors" aria-current={section==="honors"?"page":undefined} onClick={()=>setOpen(false)}><Award size={20}/>Vinh danh</Link>
     </section>
     {(admin||leader)&&<section className="sidebar-menu-group"><h3>Quản lý</h3>
      {admin&&<><Link href="/groups" aria-current={section==="groups"?"page":undefined} onClick={()=>setOpen(false)}><Layers size={20}/>Nhóm nhỏ</Link><Link href="/accounts" aria-current={section==="accounts"?"page":undefined} onClick={()=>setOpen(false)}><ShieldCheck size={20}/>Duyệt đăng ký</Link><Link href="/appeals" aria-current={section==="appeals"?"page":undefined} onClick={()=>setOpen(false)}><MessageSquareWarning size={20}/>Khiếu nại</Link><Link href="/audit" aria-current={section==="audit"?"page":undefined} onClick={()=>setOpen(false)}><History size={20}/>Audit</Link></>}
      {leader&&<Link href="/division" aria-current={section==="my-division"?"page":undefined} onClick={()=>setOpen(false)}><Flag size={20}/>Liên đoàn của tôi</Link>}
     </section>}
     <section className="sidebar-menu-group"><h3>Thông tin</h3>{admin&&<Link href="/settings" aria-current={section==="settings"?"page":undefined} onClick={()=>setOpen(false)}><Settings size={20}/>Cài đặt</Link>}<Link href="/about" onClick={()=>setOpen(false)}><Info size={20}/>Về REVIVE</Link></section>
    </nav>
    <footer>{guest?<><Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}><LogOut size={20}/>Đăng nhập</Link><Link href={`/register?redirect=${encodeURIComponent(loginRedirect)}`}><Users size={20}/>Đăng ký</Link></>:<button type="button" onClick={()=>{setOpen(false);onSignOut();}}><LogOut size={20}/>Đăng xuất</button>}</footer>
   </Drawer.Popup></Drawer.Viewport>
  </Drawer.Portal></Drawer.Root>
 </>;
}
