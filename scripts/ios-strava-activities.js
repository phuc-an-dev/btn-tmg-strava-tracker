/* Safari Shortcuts: prepare one page of activities; POST is a separate native action. */
(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const coreTarget = {};
    /* INSERT_EXTENSION_CORE */
    const core = coreTarget.ReviveCore;
    if (!core.isDiscussionUrl(location.href)) {
      throw new Error("Mở trang Thảo luận club REVIVE trong Safari trước khi chạy.");
    }
    const athleteId = core.detectAthleteId(document);
    if (!athleteId) throw new Error("Chưa tìm thấy tài khoản Strava. Mở menu tài khoản rồi chạy lại.");
    const cursor = String(Math.floor(Date.now() / 1000) + 1);
    const url = new URL("/clubs/2368312/post_feed", location.origin);
    url.search = new URLSearchParams({feed_type:"club_posts",athlete_id:athleteId,club_id:"2368312",before:cursor,cursor}).toString();
    const response = await fetch(url, {
      credentials:"same-origin",headers:{Accept:"application/json"},signal:controller.signal
    });
    if (!response.ok) throw new Error(`Strava trả HTTP ${response.status}.`);
    if (!(response.headers.get("content-type") || "").includes("application/json")) {
      throw new Error("Strava không trả JSON. Kiểm tra đăng nhập Safari.");
    }
    const data = await response.json();
    if (!Array.isArray(data.entries)) throw new Error("Cấu trúc feed Strava không hợp lệ.");
    const observedAt = new Date().toISOString();
    const entries = data.entries.map(entry => ({...entry,observed_at:observedAt}));
    const rows = core.normalize(entries,{startDate:"2026-10-04",endDate:"2026-11-15"},observedAt);
    const activities = rows.filter(row => /^\d{1,15}$/.test(row.athlete_id || "") && /^202\d-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(row.start_local || ""));
    if (!activities.length) throw new Error("Trang này không có activity đủ ID và ngày để gửi.");
    if (activities.length > 50) throw new Error("Trang có hơn 50 activities; cần chia lô trước khi gửi.");
    const body = JSON.stringify({club_id:"2368312",activities});
    if (new TextEncoder().encode(body).length > 400000) throw new Error("Trang dữ liệu quá lớn; cần chia lô trước khi gửi.");
    completion({body,activity_count:activities.length,skipped_count:rows.length-activities.length,
      message:`Chuẩn bị ${activities.length} activity từ ${entries.length} bài mới nhất. Đây là một trang, chưa phải toàn bộ club.`});
  } catch (error) {
    completion({body:"",error:error.name === "AbortError" ? "Strava phản hồi quá chậm. Hãy chạy lại." : String(error.message || error)});
  } finally {
    clearTimeout(timer);
  }
})();
