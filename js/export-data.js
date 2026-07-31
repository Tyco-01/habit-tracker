// ============================================================
// export-data.js — Xuất TOÀN BỘ dữ liệu hiện có ra 1 file JSON để
// người dùng tự lưu backup — phòng trường hợp quên mã bí mật hoặc
// Supabase gặp sự cố (đã bàn khi thảo luận về rủi ro lưu trữ).
//
// Bao gồm: habits (kèm parentId — quan hệ cha-con), checks (lịch sử
// tick từng ngày), habitNotes (ghi chú chung + riêng ngày), events
// (dấu ấn 1 lần), trash (habit trong thùng rác kèm checks/notes còn
// sót lại trước khi bị purge hẳn).
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

  // Xuất TOÀN BỘ dữ liệu hiện có trong Sync (đã tải sẵn trong bộ nhớ,
  // không cần gọi thêm API) ra 1 file JSON có cấu trúc rõ ràng, dễ đọc.
  //
  // QUAN TRỌNG — lịch sử bản export cũ bị THIẾU (đã sửa ở đây):
  //   - parentId (quan hệ cha-con giữa các habit) không được xuất ra,
  //     nên khôi phục từ file cũ sẽ làm mọi habit về lại làm gốc.
  //   - habitNotes (ghi chú chung + ghi chú riêng theo ngày) KHÔNG
  //     được xuất ra chút nào.
  //   - archivedHabits (thùng rác) chỉ có name/archivedAt, không giữ
  //     lại checks/habitNotes của habit đã xoá (dữ liệu này vẫn còn
  //     trong data.checks/data.habitNotes cho tới khi bị purge hẳn).
  //
  // Dùng ID THẬT làm khoá (không chỉ dựa vào tên) — vì 2 habit có thể
  // trùng tên, và cần giữ đúng ID để tái lập quan hệ parentId chính xác
  // nếu sau này viết script khôi phục.
  function exportAll() {
    const { habits, checks, events, archivedHabits, habitNotes } = Sync.getData();

    const allHabitIds = new Set([
      ...habits.map(h => h.id),
      ...(archivedHabits || []).map(h => h.id)
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: 'habit-tracker-v2',
      habits: habits.map(h => ({
        id: h.id,
        name: h.name,
        sortOrder: h.sortOrder,
        parentId: h.parentId || null
      })),
      checks: [...allHabitIds].reduce((acc, habitId) => {
        const dates = checks[habitId];
        if (dates) {
          const trueDates = Object.keys(dates).filter(d => dates[d]).sort();
          if (trueDates.length > 0) acc[habitId] = trueDates;
        }
        return acc;
      }, {}),
      habitNotes: [...allHabitIds].reduce((acc, habitId) => {
        const entry = (habitNotes || {})[habitId];
        if (entry && (entry.general || Object.keys(entry.byDate || {}).length > 0)) {
          acc[habitId] = { general: entry.general || '', byDate: entry.byDate || {} };
        }
        return acc;
      }, {}),
      events: Object.entries(events).reduce((acc, [date, list]) => {
        if (list.length > 0) acc[date] = list.map(e => ({ id: e.id, name: e.name, note: e.note || '' }));
        return acc;
      }, {}),
      trash: (archivedHabits || []).map(h => ({ id: h.id, name: h.name, archivedAt: new Date(h.archivedAt).toISOString() }))
    };

    const filename = `habit-tracker-backup-${todayStamp()}.json`;
    downloadAsFile(filename, JSON.stringify(payload, null, 2));
    return filename;
  }

  return { exportAll };
})();
