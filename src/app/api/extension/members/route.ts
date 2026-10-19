import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const maxBytes = 512_000;
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const secret = process.env.STRAVA_SYNC_SECRET;
  if (!secret) return Response.json({ error: "Đồng bộ chưa được cấu hình." }, { status: 503 });
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(digest(secret), digest(provided))) return Response.json({ error: "Mã đồng bộ không đúng." }, { status: 401 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Chỉ nhận JSON." }, { status: 415 });

  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Thiếu dữ liệu.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return Response.json({ error: "Danh sách vượt 512 KB." }, { status: 413 });
      }
      chunks.push(value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (payload?.club_id !== "2368312" || payload?.complete !== true || !Array.isArray(payload.members)
      || payload.members.length < 1 || payload.members.length > 1000 || payload.expected_count !== payload.members.length) {
      return Response.json({ error: "Danh sách thành viên chưa đầy đủ hoặc sai định dạng." }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return Response.json({ error: "Đồng bộ chưa được cấu hình." }, { status: 503 });
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await db.rpc("import_extension_members", { payload, sync_secret: secret });
    if (result.error) {
      const limited = result.error.code === "PT429";
      return Response.json({ error: limited ? "Gửi quá nhanh. Thử lại sau một phút." : "Không nhập được danh sách. Kiểm tra ID, tên và vai trò Strava." }, { status: limited ? 429 : 400 });
    }
    return Response.json(result.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }
}
