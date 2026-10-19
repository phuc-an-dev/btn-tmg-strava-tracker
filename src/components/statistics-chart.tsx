"use client";
import {CartesianGrid,Line,LineChart,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {chartRows,dateTicks,lastStatisticsDay,shortDate,shortSteps,statisticsColors,statisticsDashes,stepTicks,type StatisticsMode,type StatisticsResult} from "@/lib/statistics";

export default function StatisticsChart({data,mode,hidden,selectedIndex,onSelect}:{data:StatisticsResult;mode:StatisticsMode;hidden:number[];selectedIndex:number;onSelect:(index:number)=>void}) {
 const rows=chartRows(data,mode),lastDay=lastStatisticsDay(data);
 const max=Math.max(0,...rows.flatMap(row=>data.series.flatMap((series,i)=>hidden.includes(series.id)?[]:[Number(row[`s${i}`]??0)])));
 const ticks=stepTicks(max),xTicks=dateTicks(data.days.length);
 return <div className="statistics-chart" role="group" aria-label={`Biểu đồ ${mode==="daily"?"Nhịp độ: số bước mỗi ngày":"Tiến độ: số bước tích lũy"}. Dùng phím mũi tên để xem ngày hoặc các nút dưới biểu đồ.`} onKeyDown={event=>{
  if(lastDay>=0&&(event.key==="ArrowLeft"||event.key==="ArrowRight")){event.preventDefault();onSelect(Math.max(0,Math.min(lastDay,selectedIndex+(event.key==="ArrowLeft"?-1:1))));}
 }}>
  <ResponsiveContainer width="100%" height={240} minWidth={0}>
   <LineChart data={rows} margin={{top:12,right:14,bottom:4,left:0}} accessibilityLayer onClick={state=>{
    if(state.activeTooltipIndex!==null&&state.activeTooltipIndex!==undefined){const index=Number(state.activeTooltipIndex);if(Number.isInteger(index)&&index>=0&&index<=lastDay)onSelect(index);}
   }}>
    <CartesianGrid vertical={false} stroke="#e0e4eb" strokeDasharray="3 4"/>
    <XAxis dataKey="index" type="number" domain={[0,data.days.length-1]} ticks={xTicks} interval={0} tickFormatter={i=>shortDate(data.days[Number(i)]??"")} tick={{fontSize:10,fill:"#586575"}} tickLine={false} axisLine={false} tickMargin={10}/>
    <YAxis domain={[0,ticks[3]]} ticks={ticks} interval={0} width={44} tickFormatter={shortSteps} tick={{fontSize:10,fill:"#586575"}} tickLine={false} axisLine={false}/>
    <Tooltip trigger="click" defaultIndex={selectedIndex>=0?selectedIndex:undefined} content={()=>null} cursor={false}/>
    {selectedIndex>=0&&<ReferenceLine x={selectedIndex} stroke="#9aa8be" strokeDasharray="3 4"/>}
    {data.series.map((series,i)=><Line key={series.id} type="monotone" dataKey={`s${i}`} name={series.name} stroke={statisticsColors[i]} strokeDasharray={statisticsDashes[i]} strokeWidth={2.5} dot={rows.length===1?{r:4}:false} activeDot={{r:4}} connectNulls={false} hide={hidden.includes(series.id)} isAnimationActive={false}/>)}
   </LineChart>
  </ResponsiveContainer>
 </div>;
}
