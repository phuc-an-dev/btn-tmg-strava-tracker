"use client";

import {useEffect,useRef,useState} from "react";
import type {StatisticsScope} from "@/lib/statistics";

export function StatisticsBranches({scope}:{scope:StatisticsScope}) {
 const svg=useRef<SVGSVGElement>(null);
 const [size,setSize]=useState({width:0,picker:0});
 useEffect(()=>{
  const controls=svg.current?.parentElement;
  const picker=controls?.querySelector<HTMLElement>('.statistics-picker-compact');
  if(!controls||!picker)return;
  const observer=new ResizeObserver(()=>setSize({width:controls.getBoundingClientRect().width,picker:picker.getBoundingClientRect().width}));
  observer.observe(controls);observer.observe(picker);
  return()=>observer.disconnect();
 },[]);
 const index=scope==='individuals'?0:scope==='groups'?1:2;
 const start=5+(size.width-10)*(index+.5)/3;
 const left=scope==='individuals'?start:size.picker/2;
 const right=(size.width+size.picker+8)/2;
 const branch=(target:number)=>{
  if(Math.abs(target-start)<.5)return `M ${start} 8 V 28`;
  const direction=target>start?1:-1,radius=Math.min(6,Math.abs(target-start)/2);
  return `M ${start} 8 V ${14-radius} Q ${start} 14 ${start+direction*radius} 14 H ${target-direction*radius} Q ${target} 14 ${target} ${14+radius} V 28`;
 };
 return <svg ref={svg} className="statistics-branches" viewBox={`0 0 ${size.width||1} 28`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
  {size.width>0&&<path d={`M ${start} 0 V 8 ${branch(left)} ${branch(right)}`}/>}
 </svg>;
}
