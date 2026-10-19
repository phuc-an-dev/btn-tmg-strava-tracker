// start_local is already Vietnam wall time; never parse it through browser timezone.
export function groupActivityDays<T>(rows:T[],timestamp:(row:T)=>string|null|undefined){
 const entries=rows.map((row,index)=>{const stamp=timestamp(row)??'';return {row,index,stamp,date:/^\d{4}-\d{2}-\d{2}/.test(stamp)?stamp.slice(0,10):''};});
 entries.sort((a,b)=>b.date.localeCompare(a.date)||b.stamp.localeCompare(a.stamp)||a.index-b.index);
 const groups:{date:string;rows:T[]}[]=[];
 for(const entry of entries){let group=groups[groups.length-1];if(!group||group.date!==entry.date){group={date:entry.date,rows:[]};groups.push(group);}group.rows.push(entry.row);}
 return groups;
}
export function postVietnamTimestamp(value:string|null){
 if(!value)return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);
}

export function groupCompanionActivities<T extends {people_count:number|null;division_id:number|null;group_id:number|null}>(rows:T[]){
 const groups=new Map<string,{key:string;label:string;order:number;rows:T[]}>();
 for(const row of rows){
  const people=row.people_count,shared=people!==null&&Number.isInteger(people)&&people>1;
  const solo=people===1,key=shared?`shared:${row.division_id??'none'}:${row.group_id??'none'}:${people}`:solo?'solo':'unknown';
  let group=groups.get(key);
  if(!group){
   const label=shared?`Đi chung · ${row.division_id?`LĐ ${row.division_id} · `:''}${row.group_id?`Nhóm ${row.group_id}`:'Chưa phân nhóm'} · ${people} người`:solo?'Đi cá nhân':'Chưa xác định số người';
   group={key,label,order:shared?0:solo?1:2,rows:[]};groups.set(key,group);
  }
  group.rows.push(row);
 }
 return [...groups.values()].sort((a,b)=>a.order-b.order);
}
