"use client";
import Image from "next/image";
import {useState} from "react";
import {ChevronDown,Expand,Minus,Plus} from "lucide-react";
import {BottomDrawer} from "./mobile-drawer";

const poster="/revive/about-scripture.png";
export function AboutScripture() {
 const [open,setOpen]=useState(false),[zoom,setZoom]=useState(1);
 return <section className="about-scripture" aria-label="Lời chủ đề">
  <Image className="about-banner" src={poster} width={1920} height={1080} alt="Câu Kinh Thánh chủ đề · Mi-chê 7:8" sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1040px) calc(100vw - 64px), 976px"/>
  <div className="about-scripture-tools"><span>Mi-chê 7:8</span><button type="button" className="text-button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setZoom(1);setOpen(true);}}><Expand size={16}/>Xem rõ</button></div>
  <details className="about-scripture-text"><summary>Đọc lời chủ đề<ChevronDown size={16} aria-hidden="true"/></summary><blockquote>“Hỡi kẻ thù ta, chớ vui mừng vì cớ ta.<br/>Ta dầu bị ngã, sẽ lại dậy;<br/>dầu ngồi trong nơi tối tăm,<br/>Đức Giê-hô-va sẽ làm sự sáng cho ta.”<cite>Mi-chê 7:8</cite></blockquote></details>
  <BottomDrawer open={open} onOpenChange={setOpen} title="Lời chủ đề · Mi-chê 7:8" footer={false}><div className="about-poster-viewer" data-base-ui-swipe-ignore><div className="about-poster-scroll" role="region" aria-label="Ảnh lời chủ đề" tabIndex={0}><Image src={poster} width={1920} height={1080} alt="Mi-chê 7:8 · Hỡi kẻ thù ta, chớ vui mừng vì cớ ta. Ta dầu bị ngã, sẽ lại dậy; dầu ngồi trong nơi tối tăm, Đức Giê-hô-va sẽ làm sự sáng cho ta." sizes="1920px" style={{width:`${zoom*100}%`}}/></div><div className="about-poster-controls"><button type="button" className="icon-button" aria-label="Thu nhỏ ảnh lời chủ đề" disabled={zoom===1} onClick={()=>setZoom(z=>Math.max(1,z-.5))}><Minus size={18}/></button><span aria-live="polite">{zoom*100}%</span><button type="button" className="icon-button" aria-label="Phóng to ảnh lời chủ đề" disabled={zoom===3} onClick={()=>setZoom(z=>Math.min(3,z+.5))}><Plus size={18}/></button></div><p className="muted">Phóng to rồi vuốt để xem các phần của ảnh.</p></div></BottomDrawer>
 </section>;
}
