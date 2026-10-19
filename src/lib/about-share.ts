import {siteUrl} from "./site";

export const aboutShare={
 title:"REVIVE 2026 | Hội thao BTN Trương Minh Giảng",
 text:"Giới thiệu hội thao REVIVE 2026 của BTN Trương Minh Giảng: chủ đề, ý nghĩa và lịch trình.",
 url:new URL("/about",siteUrl).href,
};

type ShareBrowser={share?:(data:ShareData)=>Promise<void>;clipboard?:{writeText:(text:string)=>Promise<void>}};
export async function shareAbout(browser:ShareBrowser):Promise<"shared"|"copied"|"cancelled"|"manual"> {
 if(browser.share){
  try{await browser.share(aboutShare);return "shared";}
  catch(error){if(error&&typeof error==="object"&&"name" in error&&error.name==="AbortError")return "cancelled";}
 }
 try{if(!browser.clipboard)return "manual";await browser.clipboard.writeText(aboutShare.url);return "copied";}
 catch{return "manual";}
}
