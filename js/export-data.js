// ============================================================
// export-data.js — Xuất toàn bộ dữ liệu hiện có ra 1 file JSON để
// người dùng tự lưu backup — phòng trường hợp quên mã bí mật hoặc
// Supabase gặp sự cố (đã bàn khi thảo luận về rủi ro lưu trữ).
//
// File xuất ra là JSON thuần, có thể đọc bằng mắt hoặc dùng lại
// sau này (vd để tự viết script khôi phục nếu cần).
// ============================================================

const ExportData = (() => {

  function todayStamp() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function downloadAsFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Xuất toàn bộ dữ liệu hiện có trong Sync (đã tải sẵn trong bộ nhớ,
  // không cần gọi thêm API) ra 1 file JSON có cấu trúc rõ ràng, dễ đọc.
  function exportAll() {
    const { habits, checks, events, archivedHabits } = Sync.getData();

    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: 'habit-tracker-v1',
      habits: habits.map(h => ({ name: h.name, sortOrder: h.sortOrder })),
      checks: Object.entries(checks).reduce((acc, [habitId, dates]) => {
        const habit = habits.find(h => h.id === habitId);
        if (habit) acc[habit.name] = Object.keys(dates).filter(d => dates[d]).sort();
        return acc;
      }, {}),
      events: Object.entries(events).reduce((acc, [date, list]) => {
        if (list.length > 0) acc[date] = list.map(e => ({ name: e.name, note: e.note || '' }));
        return acc;
      }, {}),
      trash: (archivedHabits || []).map(h => ({ name: h.name, archivedAt: new Date(h.archivedAt).toISOString() }))
    };

    const filename = `habit-tracker-backup-${todayStamp()}.json`;
    downloadAsFile(filename, JSON.stringify(payload, null, 2));
    return filename;
  }

  return { exportAll };
})();
