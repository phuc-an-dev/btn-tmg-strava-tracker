"use client";

import {useId,useRef,type CSSProperties,type KeyboardEvent,type ReactNode} from "react";

export type SegmentedTab<Value extends string> = {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
  panelId?: string;
};

export function SegmentedTabs<Value extends string>({items,value,onValueChange,ariaLabel,id,className=""}: {
  items: readonly SegmentedTab<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  id?: string;
  className?: string;
}) {
  const generatedId=useId();
  const prefix=id??generatedId;
  const list=useRef<HTMLDivElement>(null);
  const swipeStart=useRef<{x:number;y:number}|null>(null);
  const swipeHandled=useRef(false);
  const selected=items.findIndex(item=>item.value===value);
  const enabled=items.map((item,index)=>({item,index})).filter(({item})=>!item.disabled);
  const activate=(index:number,focus=false)=>{
    const item=items[index];
    if(!item||item.disabled)return;
    if(item.value!==value)onValueChange(item.value);
    if(focus)list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  };
  const onKeyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(!enabled.length||!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();
    const current=enabled.findIndex(({index})=>index===selected);
    const next=event.key==="Home"?0:event.key==="End"?enabled.length-1:
      current<0?(event.key==="ArrowRight"?0:enabled.length-1):
      (current+(event.key==="ArrowRight"?1:-1)+enabled.length)%enabled.length;
    activate(enabled[next].index,true);
  };
  if(!items.length)return null;
  return <div ref={list} id={id} className={`segmented-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}
    style={{"--tab-count":items.length} as CSSProperties}
    onPointerDown={event=>{swipeHandled.current=false;swipeStart.current=event.pointerType==="touch"?{x:event.clientX,y:event.clientY}:null;}}
    onPointerUp={event=>{
      const start=swipeStart.current;swipeStart.current=null;
      if(!start)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      if(Math.abs(dx)<=45||Math.abs(dx)<=Math.abs(dy))return;
      const current=enabled.findIndex(({index})=>index===selected);
      const next=current+(dx<0?1:-1);
      swipeHandled.current=true;
      if(next>=0&&next<enabled.length)activate(enabled[next].index);
    }}
    onPointerCancel={()=>{swipeStart.current=null;}}>
    {selected>=0&&<span className="segmented-tabs-indicator" aria-hidden="true" style={{transform:`translateX(${selected*100}%)`}}/>}
    {items.map((item,index)=><button key={item.value} type="button" id={`${prefix}-${encodeURIComponent(item.value)}`} role="tab"
      aria-selected={item.value===value} aria-controls={item.panelId} disabled={item.disabled}
      tabIndex={!item.disabled&&(index===selected||((selected<0||items[selected]?.disabled)&&index===enabled[0]?.index))?0:-1}
      onKeyDown={onKeyDown} onClick={()=>{if(!swipeHandled.current)activate(index);swipeHandled.current=false;}}>{item.label}</button>)}
  </div>;
}
