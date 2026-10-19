export function redactInsightUrl<T extends {url:string}>(event:T):T{
 const url=new URL(event.url);url.search="";url.hash="";
 return {...event,url:url.href};
}
