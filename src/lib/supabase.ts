import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;
async function measuredFetch(input:RequestInfo|URL,init?:RequestInit){
  const path=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).pathname;
  const rpc=path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
  const start=performance.now();
  try{return await fetch(input,init);}finally{
    if(rpc){try{const name=`supabase:rpc:${rpc}`;if(performance.getEntriesByName(name).length>=50)performance.clearMeasures(name);performance.measure(name,{start,duration:performance.now()-start});}catch{/* Timing support must never break a data request. */}}
  }
}
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Chưa cấu hình Supabase.");
  client ??= createClient(url, key,{global:{fetch:measuredFetch}});
  return client;
}
