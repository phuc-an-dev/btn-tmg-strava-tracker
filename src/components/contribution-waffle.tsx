'use client';
import {useId} from 'react';
import {contributionLabel,waffleCellSegments,waffleCellPosition} from '@/lib/contributions';
import {contributionColors} from '@/lib/contribution-colors';

export function ContributionWaffle({shares}:{shares:{id:number;name:string;percent:number|null;index:number}[]}){
 const prefix=useId(),percentages=shares.map(share=>share.percent);
 return <svg className="contribution-large-waffle" viewBox="0 0 198 48" role="img" aria-label={`Biểu đồ đóng góp: ${shares.map(share=>`${share.name} ${contributionLabel(share.percent)}`).join(', ')}; màu xám là phần còn lại`}>
  <defs>{Array.from({length:100},(_,i)=><clipPath key={i} id={`${prefix}-${i}`}><rect x={waffleCellPosition(i).x} y={waffleCellPosition(i).y} width="8" height="8" rx="1.5"/></clipPath>)}</defs>
  {Array.from({length:100},(_,i)=>{const {x,y}=waffleCellPosition(i);return <g key={i} clipPath={`url(#${prefix}-${i})`}><rect x={x} y={y} width="8" height="8" fill="#e9edf3"/>{waffleCellSegments(percentages,i).map(segment=><rect key={segment.colorIndex} x={x+8*segment.offset} y={y} width={8*segment.width} height="8" fill={contributionColors[shares[segment.colorIndex].index]}/>)}</g>;})}
 </svg>;
}
