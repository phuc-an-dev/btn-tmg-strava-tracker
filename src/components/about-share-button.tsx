"use client";
import {useRef,useState} from "react";
import {Share2,X} from "lucide-react";
import {aboutShare,shareAbout} from "@/lib/about-share";
import {AppToastProvider,useAppToast} from "./app-toast";

export function AboutShareButton() {
 return <AppToastProvider><ShareButton/></AppToastProvider>;
}
function ShareButton() {
 const {add}=useAppToast();
 const [busy,setBusy]=useState(false),[manual,setManual]=useState(false);
 const sharing=useRef(false);
 async function share() {
  if(sharing.current)return;
  sharing.current=true;setBusy(true);setManual(false);
  try{
   const result=await shareAbout(navigator);
   if(result==="copied")add({title:"Đã sao chép liên kết",type:"success",timeout:2500});
   if(result==="manual")setManual(true);
  }finally{sharing.current=false;setBusy(false);}
 }
 return <div className="about-share"><button type="button" className="about-share-button" aria-label="Chia sẻ hội thao" title="Chia sẻ hội thao" disabled={busy} aria-busy={busy} onClick={()=>void share()}><Share2 size={18} aria-hidden="true"/><span>Chia sẻ</span></button>{manual&&<div className="about-share-copy"><div><p role="status">Sao chép liên kết này để chia sẻ.</p><button type="button" className="icon-button" aria-label="Đóng liên kết chia sẻ" onClick={()=>setManual(false)}><X size={16}/></button></div><input aria-label="Liên kết hội thao" readOnly value={aboutShare.url} onFocus={e=>e.currentTarget.select()}/></div>}</div>;
}
