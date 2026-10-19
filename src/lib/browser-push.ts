import {getSupabase} from './supabase';

export const pushOwnerKey='revive-push-owner';
export function needsHomeScreen(){
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 return ios&&!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator&{standalone?:boolean}).standalone;
}
export function supportsPush(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&window.isSecureContext;}
export function pushPublicKey(key:string){
 const decoded=atob(key.replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(decoded,c=>c.charCodeAt(0));
}
export function matchesPushKey(subscription:PushSubscription,key:string){
 const actual=subscription.options.applicationServerKey;
 const expected=pushPublicKey(key);
 return !!actual&&actual.byteLength===expected.length&&expected.every((value,i)=>new Uint8Array(actual)[i]===value);
}
export async function currentPushSession(userId:string){
 const {data,error}=await getSupabase().auth.getSession();
 if(error||data.session?.user.id!==userId)throw new Error('Phiên đăng nhập đã thay đổi. Hãy mở lại thông báo.');
}
export async function removeBrowserPush(){
 if(!supportsPush())return;
 const registration=await navigator.serviceWorker.getRegistration('/');
 if(!registration?.active?.scriptURL.endsWith('/sw.js'))return;
 const subscription=await registration.pushManager.getSubscription();
 if(subscription){
  await Promise.allSettled([getSupabase().rpc('remove_admin_push_subscription',{device_endpoint:subscription.endpoint}).abortSignal(AbortSignal.timeout(5000)),subscription.unsubscribe()]);
 }
 try{localStorage.removeItem(pushOwnerKey);}catch{/* Storage may be unavailable. */}
 const notifications=await registration.getNotifications();notifications.forEach(item=>item.close());
}
