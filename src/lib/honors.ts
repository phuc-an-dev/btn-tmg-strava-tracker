export type HonorScope='individuals'|'divisions';
export type HonorWinner={id:number;name:string;score:number;division_id?:number|null;group_id?:number|null};
export type HonorSnapshot={scope:HonorScope;captured_at:string;winners:HonorWinner[]};
// Reveal lower positions first, including when fewer than three have a score.
export function honorRevealOrder(count:number){return Array.from({length:Math.min(3,Math.max(0,count))},(_,i)=>Math.min(3,count)-i);}
export function honorDetail(winner:HonorWinner,scope:HonorScope){
 return scope==='individuals'?[winner.division_id?`LĐ ${winner.division_id}`:'Chưa phân LĐ',winner.group_id?`Nhóm ${winner.group_id}`:''].filter(Boolean).join(' · '):'';
}

// Leave the name on its own before introducing the animated score.
export function honorScoreAt(elapsed:number,score:number,reduced=false):number|null {
 if(reduced)return score;
 if(elapsed<600)return null;
 const progress=Math.min(1,Math.max(0,(elapsed-600)/1600));
 return progress===1?score:Math.min(Math.max(0,score-1),Math.floor(score*(1-(1-progress)**3)));
}
