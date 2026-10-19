import Link from "next/link";
import {ChartPie,Activity,ChartNoAxesCombined,Trophy} from "lucide-react";
import type {CSSProperties} from "react";
import type {Role} from "@/lib/portal-data";
import type {PortalSection} from "@/lib/portal-routes";

export function PortalNavigation({section}:{section:PortalSection;role?:Role}) {
 if(section==="accounts")return null;
 const items=[
  {section:"activities",href:"/activities",label:"Hoạt động",Icon:Activity},
  {section:"rankings",href:"/rankings",label:"Xếp hạng",Icon:Trophy},
  {section:"statistics",href:"/statistics",label:"Thống kê",Icon:ChartNoAxesCombined},
  {section:"contributions",href:"/contributions",label:"Đóng góp",Icon:ChartPie},
 ];
 const selected=items.findIndex(item=>item.section===section);
 const index=Math.max(0,selected);
 return <nav className="portal-tabs" aria-label="Quản lý hội thao">
  <div className="portal-nav-items" style={{"--nav-count":items.length} as CSSProperties}>
   <span className="portal-nav-indicator" aria-hidden="true" style={{transform:`translateX(calc(${index*100}% + ${index} * var(--nav-gap)))`,opacity:selected>=0?1:0}}/>
   {items.map(({section:target,href,label,Icon})=><Link key={target} href={href} aria-current={section===target?"page":undefined}><Icon size={19}/>{label}</Link>)}
  </div>
 </nav>;
}
