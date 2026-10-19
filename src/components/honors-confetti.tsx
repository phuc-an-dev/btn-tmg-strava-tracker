'use client';
import {useEffect,useRef} from 'react';

export function HonorsConfetti({burst,champion,origin=null,onComplete}:{burst:number;champion:boolean;origin?:{x:number;y:number}|null;onComplete:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!burst)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const node=canvas.current,context=node?.getContext('2d');
  if(reduced||!node||!context){const frame=requestAnimationFrame(onComplete);return()=>cancelAnimationFrame(frame);}
  const width=window.innerWidth,height=window.innerHeight,ratio=Math.min(window.devicePixelRatio||1,2);
  node.width=width*ratio;node.height=height*ratio;context.scale(ratio,ratio);
  const launchX=Math.max(0,Math.min(width,origin?.x??width*.5)),launchY=Math.max(0,Math.min(height,origin?.y??height*.5));
  const colors=['#1d4fb8','#4285ef','#8cb8ff','#d6a126','#ffcf57','#fff0b0'];
  // First place gets three volleys from both sides plus a central burst.
  const particles=Array.from({length:champion?780:240},(_,index)=>{
   const side=index%3,delay=champion?Math.floor(index/260)*420:Math.floor(index/120)*180;
   return {x:champion?(side===0?width*.03:side===1?width*.97:width*.5):launchX,
    y:champion?(side===2?height*.45:height*.76):launchY,
    vx:champion?(side===0?3+Math.random()*12:side===1?-3-Math.random()*12:(Math.random()-.5)*20):(Math.random()-.5)*19,
    vy:-7-Math.random()*(champion?18:15),delay,angle:Math.random()*Math.PI,spin:(Math.random()-.5)*.2,
    size:4+Math.random()*6,ribbon:index%5===0,color:colors[Math.floor(Math.random()*colors.length)]};
  });
  let frame=0,start:number|undefined,last=0,finished=false;
  const complete=()=>{if(!finished){finished=true;onComplete();}};
  const duration=champion?5600:4200;
  function draw(now:number){
   if(start===undefined){start=now;last=now;}
   const elapsed=now-start,step=Math.min((now-last)/16.67,2);last=now;
   context!.clearRect(0,0,width,height);
   for(const p of particles){
    if(elapsed<p.delay)continue;
    p.x+=p.vx*step;p.y+=p.vy*step;p.vy+=.17*step;p.vx*=Math.pow(.993,step);p.angle+=p.spin*step;
    if(p.y>height+30)continue;
    context!.save();context!.translate(p.x,p.y);context!.rotate(p.angle);
    context!.globalAlpha=Math.max(0,Math.min(1,(duration-elapsed)/800));context!.fillStyle=p.color;
    context!.fillRect(-p.size/2,-p.size/2,p.size,p.ribbon?p.size*2.5:p.size*.6);context!.restore();
   }
   if(elapsed<duration)frame=requestAnimationFrame(draw);else{context!.clearRect(0,0,width,height);complete();}
  }
  frame=requestAnimationFrame(draw);
  const clear=()=>{cancelAnimationFrame(frame);context.clearRect(0,0,width,height);};
  const resized=()=>{clear();complete();};
  window.addEventListener('resize',resized,{once:true});
  return()=>{clear();window.removeEventListener('resize',resized);};
 },[burst,champion,origin,onComplete]);
 return <canvas ref={canvas} className="honors-confetti" aria-hidden="true"/>;
}
