export type StatisticsScope="individuals"|"groups"|"divisions";
export type StatisticsMode="daily"|"cumulative";
export type StatisticsResult={scope:StatisticsScope;period:"week"|"event";today:string;start_date:string;end_date:string;days:string[];series:{id:number;name:string;total:number;values:(number|null)[]}[]};
export const statisticsColors=["#1d4fb8","#c65408","#6b8616","#8250bf","#087f8c"];
export const statisticsDashes=[undefined,"8 3","3 3","10 3 2 3","2 4"];
export function statisticsSearch(value:string){return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim().replace(/\s+/g,' ');}
export function statisticsIds(value:string):number[]|null {
 if(!value)return [];
 const parts=value.split(",");
 if(parts.length>5||parts.some(id=>!/^\d{1,15}$/.test(id)||Number(id)<1))return null;
 const ids=parts.map(Number);
 return new Set(ids).size===ids.length?ids:null;
}
export function chartRows(data:StatisticsResult,mode:StatisticsMode) {
 const totals=data.series.map(()=>0);
 return data.days.map((date,index)=>{
  const row:Record<string,number|string|null>={index,date};
  data.series.forEach((series,i)=>{const value=date>=data.today?null:series.values[index]??null;if(value!==null)totals[i]+=value;row[`s${i}`]=value===null?null:mode==="cumulative"?totals[i]:value;});
  return row;
 });
}
export function lastStatisticsDay(data:StatisticsResult) {
 return data.days.reduce((last,day,i)=>day<data.today&&data.series.some(s=>s.values[i]!=null)?i:last,-1);
}
export function orderedStatisticsSeries(data:StatisticsResult,row:Record<string,number|string|null>|undefined) {
 return data.series.map((series,index)=>({series,index,value:row?.[`s${index}`]??null}))
  .sort((a,b)=>(b.value===null?-1:Number(b.value))-(a.value===null?-1:Number(a.value))||a.index-b.index);
}
// Four explicit ticks, including zero. Do not rely on the chart's tick-count hint.
export function stepTicks(max:number):number[] {
 const target=Math.max(1,max)/3,power=10**Math.floor(Math.log10(target));
 const step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=target)??10*power;
 const integerStep=Math.max(1,Math.ceil(step));
 return [0,integerStep,integerStep*2,integerStep*3];
}
export function dateTicks(length:number):number[] {
 if(length<1)return [];
 return [...new Set([0,Math.round((length-1)/3),Math.round(2*(length-1)/3),Math.max(0,length-1)])];
}
export function shortDate(date:string){return `${date.slice(8,10)}/${date.slice(5,7)}`;}
export function shortSteps(n:number){return n>=1_000_000?`${(n/1_000_000).toLocaleString("vi-VN",{maximumFractionDigits:1})}M`:n>=1000?`${(n/1000).toLocaleString("vi-VN",{maximumFractionDigits:1})}K`:String(n);}
