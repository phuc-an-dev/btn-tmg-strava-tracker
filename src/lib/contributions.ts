export type ContributionDay={date:string;total:number;individual:number|null;group:number|null;division:number|null};
export type ContributionsResult={period:'week'|'event';today:string;member:{id:number;group_id:number|null;division_id:number|null;group_name:string|null}|null;days:ContributionDay[]};

export function contributionPercent(steps:number|null,total:number):number|null {
 return steps===null||!Number.isFinite(steps)||!Number.isFinite(total)||total<=0?null:Math.min(100,Math.max(0,steps/total*100));
}
export function contributionLabel(percent:number|null){
 if(percent===null)return '—';
 if(percent>0&&percent<.01)return '<0,01%';
 return `${percent.toLocaleString('vi-VN',{maximumFractionDigits:2})}%`;
}
export function waffleCellFill(percent:number|null,index:number){
 return percent===null?0:Math.max(0,Math.min(1,percent-index));
}

export function selectContributionChoice<T extends {id:number}>(choices:T[],entity:number|null,ownId:number|null):T|undefined {
 return choices.find(c=>c.id===entity)??choices.find(c=>c.id===ownId)??choices[0];
}

export function selectContributionChoices<T extends {id:number}>(choices:T[],entities:number[],legacyEntity:number|null,ownId:number|null):T[] {
 const ids=[...new Set(entities)].filter(id=>Number.isSafeInteger(id)&&id>0).slice(0,5);
 const selected=ids.flatMap(id=>choices.find(c=>c.id===id)??[]);
 if(selected.length)return selected;
 const fallback=selectContributionChoice(choices,legacyEntity,ownId);
 return fallback?[fallback]:[];
}
export function toggleContributionSelection(ids:number[],id:number):number[] {
 return ids.includes(id)?ids.filter(value=>value!==id):ids.length<5?[...ids,id]:ids;
}

// Each cell represents [index,index+1) percent; retain fractional color boundaries.
export function waffleCellSegments(shares:(number|null)[],index:number){
 let start=0;
 return shares.flatMap((share,colorIndex)=>{
  const end=Math.min(100,start+(share!==null&&Number.isFinite(share)?Math.max(0,share):0));
  const left=Math.max(index,start),right=Math.min(index+1,end);
  start=end;
  return right>left?[{colorIndex,offset:left-index,width:right-left}]:[];
 });
}

export function orderedContributionShares<T extends {id:number;steps:number;index:number}>(shares:T[],hidden:number[]=[]):T[]{
 return shares.filter(share=>!hidden.includes(share.id)).sort((a,b)=>b.steps-a.steps||a.index-b.index);
}
export function waffleCellPosition(index:number){return {x:index%20*10,y:Math.floor(index/20)*10};}
