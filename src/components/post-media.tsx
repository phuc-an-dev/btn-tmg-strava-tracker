"use client";
import Image from "next/image";
import {useRef,useState} from "react";
import {ChevronLeft,ChevronRight,Images,ImageOff} from "lucide-react";
import type {PostMedia} from "@/lib/post-media";
import {BottomDrawer} from "./mobile-drawer";

export function PostMediaBackground({media}:{media:PostMedia[]}) {
 const [failed,setFailed]=useState(false);
 if(!media.length||failed)return null;
 // Older snapshots have no smaller Strava variant. Resize those through Next's
 // allowlisted image optimizer rather than downloading a full photo for a card.
 const thumbnail=media[0].thumbnail_url||media[0].url;
 return <span className="post-media-background" aria-hidden="true"><Image src={thumbnail} alt="" fill sizes="240px" unoptimized={thumbnail!==media[0].url} onError={()=>setFailed(true)}/></span>;
}
function MediaSlide({photo,index}:{photo:PostMedia;index:number}) {
 const [state,setState]=useState<"loading"|"ready"|"error">("loading");
 return <div className="post-media-slide">{state==="loading"&&<span className="post-media-placeholder member-skeleton-block" role="status" aria-label="Đang tải ảnh"/>}{state==="error"?<div className="post-media-placeholder post-media-error" role="alert"><ImageOff size={28}/><p>Không tải được ảnh. Bạn có thể xem trực tiếp trên Strava.</p><button className="text-button" onClick={()=>setState("loading")}>Thử lại</button></div>:<Image src={photo.url} alt={photo.caption||`Ảnh ${index+1} `} fill unoptimized sizes="(max-width: 639px) 100vw, 600px" className={state==="ready"?"is-ready":""} onLoad={()=>setState("ready")} onError={()=>setState("error")}/>}</div>;
}
export function PostMediaButton({media,title}:{media:PostMedia[];title:string}) {
 const [open,setOpen]=useState(false),[active,setActive]=useState(0);
 const slider=useRef<HTMLDivElement>(null);
 if(!media.length)return null;
 const go=(index:number)=>{const node=slider.current;if(node)node.scrollTo({left:Math.max(0,Math.min(media.length-1,index))*node.clientWidth,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});};
 return <><button type="button" className="post-media-button" aria-label={`Xem ${media.length} ảnh của ${title}`} aria-haspopup="dialog" onClick={()=>{setActive(0);setOpen(true);}}><Images size={16}/><span>{media.length}</span></button><BottomDrawer open={open} onOpenChange={setOpen} title={`Ảnh · ${title}`} footer={false}><div className="post-media-viewer" data-base-ui-swipe-ignore><div ref={slider} className="post-media-slider" role="region" aria-roledescription="carousel" aria-label="Thư viện ảnh" tabIndex={0} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();go(active+(e.key==="ArrowLeft"?-1:1));}}} onScroll={e=>{const node=e.currentTarget;if(node.clientWidth)setActive(Math.max(0,Math.min(media.length-1,Math.round(node.scrollLeft/node.clientWidth))));}}>{media.map((photo,index)=><div className="post-media-page" key={`${photo.id}-${index}`} aria-label={`Ảnh ${index+1} / ${media.length}`} aria-hidden={active!==index}>{open&&Math.abs(index-active)<=1&&<MediaSlide photo={photo} index={index}/>}</div>)}</div><div className="post-media-controls"><button className="icon-button" aria-label="Ảnh trước" disabled={active===0} onClick={()=>go(active-1)}><ChevronLeft size={20}/></button><span aria-live="polite">{active+1} / {media.length}</span><button className="icon-button" aria-label="Ảnh tiếp theo" disabled={active===media.length-1} onClick={()=>go(active+1)}><ChevronRight size={20}/></button></div>{media[active]?.caption&&<p className="post-media-caption">{media[active].caption}</p>}</div></BottomDrawer></>;
}
