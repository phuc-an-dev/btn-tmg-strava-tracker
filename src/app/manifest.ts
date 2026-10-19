import type {MetadataRoute} from "next";

export default function manifest():MetadataRoute.Manifest {
  return {
    id:"/",
    name:"REVIVE · Đi bộ Strava",
    short_name:"REVIVE",
    description:"Theo dõi hoạt động đi bộ Strava, số bước và bảng xếp hạng hội thao REVIVE 2026 của BTN Trương Minh Giảng.",
    lang:"vi",
    start_url:"/rankings",
    scope:"/",
    display:"standalone",
    background_color:"#f8f7f4",
    theme_color:"#1d4fb8",
    icons:[
      {src:"/revive/app-icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"/revive/app-icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
    ],
  };
}
