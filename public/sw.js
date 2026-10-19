/* global self, clients */
// Notifications only: no fetch interception or caching of authenticated data.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));

function safeNotificationUrl(value){
 try{
  const url=new URL(value,self.location.origin);
  if(url.origin===self.location.origin&&['/accounts','/appeals','/activities'].includes(url.pathname))return url.href;
 }catch{/* Fall back to a safe route for malformed payloads. */}
 return new URL('/activities',self.location.origin).href;
}

self.addEventListener('push',event=>{
 let data={};
 try{const parsed=event.data?.json();if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))data=parsed;}catch{/* Always display a visible notification. */}
 event.waitUntil(self.registration.showNotification(typeof data.title==='string'?data.title.slice(0,100):'REVIVE · Thông báo mới',{
  body:typeof data.body==='string'?data.body.slice(0,250):'Có thông báo mới cần kiểm tra trên REVIVE.',
  icon:'/revive/app-icon-192.png',badge:'/revive/app-icon-192.png',
  tag:typeof data.tag==='string'?data.tag.slice(0,100):'revive-notification',
  data:{url:safeNotificationUrl(data.url)},
 }));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=safeNotificationUrl(event.notification.data?.url);
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   if(new URL(client.url).origin===self.location.origin&&'navigate' in client){
    try{const opened=await client.navigate(url);if(opened){await opened.focus();return;}}catch{/* Try opening a new window. */}
   }
  }
  await clients.openWindow(url);
 })());
});
