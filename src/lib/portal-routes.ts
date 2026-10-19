import type {Role} from "./portal-data";
export const portalRoutes = {
 members:{href:"/members",title:"Thành viên"},
 honors:{href:"/honors",title:"Vinh danh"},
 rankings:{href:"/rankings",title:"Xếp hạng"},
 contributions:{href:"/contributions",title:"Đóng góp"},
 statistics:{href:"/statistics",title:"Thống kê"},
 activities:{href:"/activities",title:"Hoạt động"},
 appeals:{href:"/appeals",title:"Khiếu nại"},
 audit:{href:"/audit",title:"Audit"},
 groups:{href:"/groups",title:"Nhóm nhỏ"},
 accounts:{href:"/accounts",title:"Duyệt đăng ký"},
 settings:{href:"/settings",title:"Cài đặt"},
 "my-division":{href:"/division",title:"Liên đoàn của tôi"},
} as const;
export type PortalSection=keyof typeof portalRoutes;
export function sectionForPath(path:string):PortalSection {
 return (Object.keys(portalRoutes) as PortalSection[]).find(key=>portalRoutes[key].href===path)??"members";
}
export function isPublicSection(section:PortalSection){return ["members","activities","rankings","statistics","contributions","honors"].includes(section);}
export function canAccessSection(role:Role|null|undefined,section:PortalSection) {
 if(isPublicSection(section))return true;
 if(section==="accounts"||section==="audit"||section==="groups"||section==="appeals"||section==="settings")return role==="admin";
 if(section==="my-division")return role==="leader";
 return true;
}
export function safePortalRedirect(value:string|null) {
 if(!value?.startsWith("/")||value.startsWith("//"))return "/rankings";
 try {
  const url=new URL(value,"https://revive.invalid");
  if(url.origin!=="https://revive.invalid"||!Object.values(portalRoutes).some(route=>route.href===url.pathname))return "/rankings";
  return url.pathname+url.search;
 }catch{return "/rankings";}
}

export function activityAppealTarget(value:string|null){return value&&/^[1-9]\d{0,14}$/.test(value)?Number(value):null;}
