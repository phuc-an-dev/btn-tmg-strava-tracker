import {createHash,timingSafeEqual} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
const maxBytes=1000000;
const digest=(value:string)=>createHash("sha256").update(value).digest();
export async function POST(request:Request) {
 const secret=process.env.STRAVA_SYNC_SECRET;
 if(!secret)return Response.json({error:"Đồng bộ chưa được cấu hình."},{status:503});
 const provided=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
 if(!timingSafeEqual(digest(secret),digest(provided)))return Response.json({error:"Mã đồng bộ không đúng."},{status:401});
 if(!request.headers.get("content-type")?.includes("application/json"))return Response.json({error:"Chỉ nhận JSON."},{status:415});
 try {
  const reader=request.body?.getReader();if(!reader)throw new Error("Thiếu dữ liệu.");
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes){await reader.cancel();return Response.json({error:"Danh sách đối chiếu vượt 1 MB."},{status:413});}chunks.push(value);}
  const payload=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(payload?.club_id!=="2368312"||payload.complete!==true||!Array.isArray(payload.post_ids)||payload.post_ids.length>50000)throw new Error("Cần danh sách bài đăng của lượt quét đầy đủ.");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return Response.json({error:"Đồng bộ chưa được cấu hình."},{status:503});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await db.rpc("complete_extension_post_scan",{payload,sync_secret:secret});
  if(result.error)return Response.json({error:result.error.code==="PT429"?"Gửi quá nhanh. Thử lại sau một phút.":"Không đối chiếu được lượt quét. Kiểm tra ID bài đăng và thời gian quét."},{status:result.error.code==="PT429"?429:400});
  return Response.json(result.data,{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Dữ liệu JSON không hợp lệ."},{status:400});}
}
