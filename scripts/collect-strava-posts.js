// Run in the DevTools Console on the authenticated Strava club page.
(async () => {
  if (location.origin !== "https://www.strava.com") {
    throw new Error("Run this script on https://www.strava.com");
  }
  if (window.stravaPostSync?.running) {
    throw new Error("A sync is already running");
  }

  const previous = window.stravaPostSync;
  const state = window.stravaPostSync = {
    running: true,
    stop: false,
    completed: false,
    cursor: previous && !previous.completed
      ? previous.cursor
      : Math.floor(Date.now() / 1000) + 1,
    entries: new Map(previous?.entries ?? []),
    error: null,
  };
  const seen = new Set();

  try {
    for (let page = 1; page <= 500 && !state.stop; page++) {
      if (seen.has(state.cursor)) throw new Error("Repeated cursor");
      seen.add(state.cursor);
      const url = new URL("/clubs/2368312/post_feed", location.origin);
      url.search = new URLSearchParams({
        feed_type: "club_posts",
        athlete_id: "191062250",
        club_id: "2368312",
        before: String(state.cursor),
        cursor: String(state.cursor),
      }).toString();
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.entries)) throw new Error("Invalid entries");
      for (const entry of data.entries) {
        const id = entry.post?.id ?? entry.post?.entity_id;
        if (id == null) throw new Error("Missing post ID");
        state.entries.set(String(id), entry);
      }
      console.log(`Trang ${page}: ${state.entries.size} bài`);
      if (data.pagination?.hasMore === false) {
        state.completed = true;
        break;
      }
      const next = Number(data.entries.at(-1)?.cursorData?.updated_at);
      if (!Number.isFinite(next) || next >= state.cursor) {
        throw new Error("Cursor did not advance");
      }
      state.cursor = next;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    state.error = String(error);
    console.error("Đồng bộ dừng; dữ liệu đã lấy được giữ lại:", error);
  } finally {
    state.running = false;
    const blob = new Blob([JSON.stringify({
      club_id: "2368312",
      collected_at: new Date().toISOString(),
      completed: state.completed,
      next_cursor: state.completed ? null : state.cursor,
      error: state.error,
      entries: [...state.entries.values()],
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "strava-club-posts.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    console.log(`Đã xuất ${state.entries.size} bài; lấy hết: ${state.completed}`);
  }
})();
