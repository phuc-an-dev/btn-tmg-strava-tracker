"use client";

import Image from "next/image";
import {useState} from "react";
import {Expand,Minus,Plus} from "lucide-react";
import {BottomDrawer} from "./mobile-drawer";

const poster="/revive/about-meaning.jpg";
const description="Thể chất: Ta dầu bị ngã, sẽ lại dậy — hành động thực tiễn. Tinh thần: Từ cá nhân đến tập thể — tinh thần đồng đội. Tâm linh: Đức Giê-hô-va sẽ làm sự sáng cho ta — có Chúa dẫn dắt.";

export function AboutMeaning() {
 const [open,setOpen]=useState(false),[zoom,setZoom]=useState(1);
 return <div className="about-meaning">
  <div className="about-meaning-heading"><h3>Ý nghĩa chủ đề Vực dậy</h3><button type="button" className="text-button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setZoom(1);setOpen(true);}}><Expand size={16} aria-hidden="true"/>Xem rõ</button></div>
  <Image className="about-meaning-image" src={poster} width={3116} height={1752} alt={description} sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1040px) calc(100vw - 64px), 976px"/>
  <BottomDrawer open={open} onOpenChange={setOpen} title="Ý nghĩa chủ đề Vực dậy" footer={false}><div className="about-poster-viewer" data-base-ui-swipe-ignore><div className="about-poster-scroll about-meaning-scroll" role="region" aria-label="Ảnh ý nghĩa chủ đề Vực dậy" tabIndex={0}><Image src={poster} width={3116} height={1752} alt={description} sizes="(max-width: 639px) 1800px, 2400px" style={{width:`${zoom*100}%`}}/></div><div className="about-poster-controls"><button type="button" className="icon-button" aria-label="Thu nhỏ ảnh ý nghĩa chủ đề" disabled={zoom===1} onClick={()=>setZoom(z=>Math.max(1,z-.5))}><Minus size={18}/></button><span aria-live="polite">{zoom*100}%</span><button type="button" className="icon-button" aria-label="Phóng to ảnh ý nghĩa chủ đề" disabled={zoom===3} onClick={()=>setZoom(z=>Math.min(3,z+.5))}><Plus size={18}/></button></div><p className="muted">Phóng to rồi vuốt để xem các phần của ảnh.</p></div></BottomDrawer>
 </div>;
}
