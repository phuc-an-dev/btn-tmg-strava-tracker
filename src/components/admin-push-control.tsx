"use client";
import {useEffect,useState} from 'react';
import {BellRing,Smartphone} from 'lucide-react';
import {getSupabase} from '@/lib/supabase';
import {currentPushSession,matchesPushKey,needsHomeScreen,pushOwnerKey,pushPublicKey,supportsPush} from '@/lib/browser-push';

type Config={enabled:boolean;public_key:string|null};
type State='loading'|'install'|'unsupported'|'denied'|'off'|'on'|'unconfigured'|'error';
type TestStatus={status:string;created_at:string;sent_at:string|null}|null;
const testLabels:Record<string,string>={pending:'Thông báo thử đang chờ gửi.',sending:'Đang gửi thông báo thử…',sent:'Máy chủ đẩy đã nhận thông báo thử. Kiểm tra thông báo trên thiết bị.',failed:'Gửi thử chưa thành công. Hãy thử lại sau.',canceled:'Thông báo thử đã hủy.'};

export function AdminPushControl({userId,active}:{userId:string;active:boolean}){
 const [state,setState]=useState<State>('loading'),[config,setConfig]=useState<Config|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[lastTest,setLastTest]=useState<TestStatus>(null),[refresh,setRefresh]=useState(0);
 const [deviceEndpoint,setDeviceEndpoint]=useState<string|null>(null);
 useEffect(()=>{
  if(!active)return;
  let canceled=false;
  async function load(){
   try{
    if(needsHomeScreen()){if(!canceled)setState('install');return;}
    if(!supportsPush()){if(!canceled)setState('unsupported');return;}
    await currentPushSession(userId);
    const response=await getSupabase().rpc('get_admin_push_config');
    if(response.error)throw response.error;
    const next=response.data as Config;if(canceled)return;setConfig(next);
    if(!next.enabled||!next.public_key){setState('unconfigured');return;}
    if(Notification.permission==='denied'){setState('denied');return;}
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
    await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Service worker timeout')),12000))]);
    if(canceled)return;
    const subscription=await registration.pushManager.getSubscription();
    let owner:string|null=null;try{owner=localStorage.getItem(pushOwnerKey);}catch{/* Require explicit opt-in if storage is unavailable. */}
    if(subscription&&(owner!==userId||!matchesPushKey(subscription,next.public_key))){await subscription.unsubscribe();if(!canceled)setState('off');return;}
    if(subscription&&Notification.permission==='granted'){
     await currentPushSession(userId);
     const device=await getSupabase().rpc('get_admin_push_device',{device_endpoint:subscription.endpoint});
     if(device.error)throw device.error;
     if(!device.data.registered)await subscription.unsubscribe();
     if(!canceled){setState(device.data.registered?'on':'off');setDeviceEndpoint(device.data.registered?subscription.endpoint:null);setLastTest(device.data.last_test);}
    }else if(!canceled)setState('off');
   }catch{if(!canceled){setState('error');setMessage('Chưa kiểm tra được thông báo đẩy. Hãy thử lại.');}}
  }
  void load();
  return()=>{canceled=true;};
 },[active,userId,refresh]);
 useEffect(()=>{
  if(!active||state!=='on'||!deviceEndpoint)return;
  let canceled=false,inFlight=false;
  const poll=setInterval(async()=>{
   if(document.hidden||inFlight)return;inFlight=true;
   try{
    await currentPushSession(userId);
    const device=await getSupabase().rpc('get_admin_push_device',{device_endpoint:deviceEndpoint}).abortSignal(AbortSignal.timeout(8000));
    if(!canceled&&!device.error){setLastTest(device.data.last_test);if(!device.data.registered){setState('off');setDeviceEndpoint(null);}}
   }catch{/* Keep the last known device status during transient failures. */}finally{inFlight=false;}
  },10000);
  return()=>{canceled=true;clearInterval(poll);};
 },[active,state,deviceEndpoint,userId]);
 async function enable(){
  if(busy||!config?.public_key)return;
  // Request permission directly from the button gesture, before any network await.
  setBusy(true);setMessage('');
  let created:PushSubscription|null=null;
  try{
   const permission=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
   if(await permission!=='granted'){setState(Notification.permission==='denied'?'denied':'off');return;}
   await currentPushSession(userId);
   const registration=await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(subscription){
    const known=await getSupabase().rpc('get_admin_push_device',{device_endpoint:subscription.endpoint});
    if(known.error)throw known.error;
    if(!known.data.registered){await subscription.unsubscribe();subscription=null;}
   }
   const expected=pushPublicKey(config.public_key);
   if(subscription&&!matchesPushKey(subscription,config.public_key)){await subscription.unsubscribe();subscription=null;}
   if(!subscription){subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:expected});created=subscription;}
   await currentPushSession(userId);
   const r=await getSupabase().rpc('save_admin_push_subscription',{subscription:subscription.toJSON()});
   if(r.error)throw r.error;
   await currentPushSession(userId);
   try{localStorage.setItem(pushOwnerKey,userId);}catch{/* Notification permission is independent of local storage. */}
   setState('on');setDeviceEndpoint(subscription.endpoint);setMessage('Đã bật thông báo trên thiết bị này.');
  }catch{if(created)await created.unsubscribe().catch(()=>false);setMessage('Chưa bật được thông báo. Kiểm tra kết nối rồi thử lại.');setState('off');}
  finally{setBusy(false);}
 }
 async function disable(){
  if(busy)return;setBusy(true);setMessage('');
  try{
   await currentPushSession(userId);
   const registration=await navigator.serviceWorker.getRegistration('/'),subscription=await registration?.pushManager.getSubscription();
   if(subscription){const r=await getSupabase().rpc('remove_admin_push_subscription',{device_endpoint:subscription.endpoint});if(r.error)throw r.error;await subscription.unsubscribe();}
   try{localStorage.removeItem(pushOwnerKey);}catch{/* Storage may be unavailable. */}
   const notifications=await registration?.getNotifications();notifications?.forEach(item=>item.close());
   setState('off');setDeviceEndpoint(null);setLastTest(null);setMessage('Đã tắt thông báo trên thiết bị này.');
  }catch{setMessage('Chưa tắt được thông báo. Hãy thử lại.');}finally{setBusy(false);}
 }
 async function sendTest(){
  if(busy)return;setBusy(true);setMessage('');
  try{
   await currentPushSession(userId);
   const subscription=await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
   if(!subscription)throw new Error('Missing subscription');
   const r=await getSupabase().rpc('request_admin_push_test',{device_endpoint:subscription.endpoint});
   if(r.error)throw r.error;
   setMessage('Đã xếp thông báo thử. Thông thường sẽ nhận trong vòng một phút.');setRefresh(n=>n+1);
  }catch(error){setMessage(error&&typeof error==='object'&&'message' in error&&String(error.message).includes('một phút')?'Vui lòng chờ một phút trước khi gửi thử lại.':'Chưa gửi được thông báo thử. Hãy thử lại.');}finally{setBusy(false);}
 }
 const descriptions:Record<State,string>={loading:'Đang kiểm tra thiết bị…',install:'Trên iPhone: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Mở REVIVE từ biểu tượng đó rồi bật thông báo. Cần iOS 16.4 trở lên.',unsupported:'Trình duyệt này chưa hỗ trợ thông báo đẩy. Bạn vẫn nhận thông báo qua email.',denied:'Quyền thông báo đang bị chặn. Trên iPhone, mở Cài đặt → Thông báo → REVIVE để cho phép, rồi mở lại ứng dụng.',off:'Nhận thông báo đăng ký và khiếu nại mới, kể cả khi không mở REVIVE.',on:'Đã bật trên thiết bị này. Email vẫn được gửi song song.',unconfigured:'Kênh thông báo đẩy đang được cấu hình. Email vẫn hoạt động.',error:'Chưa kiểm tra được thiết bị.'};
 return <section className="admin-push-control" aria-label="Thông báo trên thiết bị" aria-busy={busy}><div className="admin-push-heading"><Smartphone size={18} aria-hidden="true"/><strong>Thông báo trên thiết bị</strong>{state==='on'&&<span>Đã bật</span>}</div><p>{descriptions[state]}</p><div className="admin-push-actions">{state==='off'&&<button type="button" className="text-button" disabled={busy} onClick={()=>void enable()}><BellRing size={16}/>{busy?'Đang bật…':'Bật thông báo'}</button>}{state==='on'&&<><button type="button" className="text-button" disabled={busy} onClick={()=>void sendTest()}>Gửi thử</button><button type="button" className="text-button muted" disabled={busy} onClick={()=>void disable()}>Tắt trên thiết bị này</button></>}{(state==='error'||state==='denied')&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setMessage('');setRefresh(n=>n+1);}}>Kiểm tra lại</button>}</div>{message&&<p className="admin-push-feedback" role="status">{message}</p>}{state==='on'&&lastTest&&<p className="admin-push-feedback" role="status">{testLabels[lastTest.status]??''}</p>}</section>;
}
