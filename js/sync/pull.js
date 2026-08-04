// ============================================================
// js/sync/pull.js — Tải toàn bộ dữ liệu từ server (lúc đăng nhập / mở
// app lần đầu). Đây là nơi DUY NHẤT trong toàn app gọi
// SyncState.setData() (thay thế TOÀN BỘ data cục bộ) — mọi thao tác
// khác chỉ sửa field bên trong data hiện có, xem mutations.js.
// ============================================================

const SyncPull = (() => {

  async function pullFromServer() {
    const token = Auth.currentToken();
    if (!token) return;

    // Dọn tự động các mục thùng rác đã quá 30 ngày trước khi tải dữ liệu mới
    try {
      await SupabaseClient.rpc('purge_expired_trash', { p_session_token: token });
    } catch (err) {
      console.warn('Không dọn được thùng rác quá hạn (bỏ qua, không ảnh hưởng dữ liệu chính):', err);
    }

    const [snapshot, trashRows] = await Promise.all([
      SupabaseClient.rpc('get_snapshot', { p_session_token: token }),
      SupabaseClient.rpc('get_trash', { p_session_token: token }).catch(() => [])
    ]);

    const remoteHabits = (snapshot.habits || []).map(h => ({
      id: h.id, name: h.name, sortOrder: h.sort_order, parentId: h.parent_habit_id || null
    }));
    const remoteChecks = {};
    (snapshot.checks || []).forEach(c => {
      if (!remoteChecks[c.habit_id]) remoteChecks[c.habit_id] = {};
      remoteChecks[c.habit_id][c.date] = true;
    });
    const remoteEvents = {};
    (snapshot.events || []).forEach(e => {
      if (!remoteEvents[e.date]) remoteEvents[e.date] = [];
      remoteEvents[e.date].push({ id: e.id, name: e.name, note: e.note || '' });
    });
    const remoteArchived = (trashRows || []).map(t => ({
      id: t.id, name: t.name, archivedAt: new Date(t.archived_at).getTime()
    }));
    const remoteHabitNotes = {};
    (snapshot.habitNotes || []).forEach(n => {
      if (!remoteHabitNotes[n.habit_id]) remoteHabitNotes[n.habit_id] = { general: '', byDate: {} };
      if (n.date === null) {
        remoteHabitNotes[n.habit_id].general = n.content;
      } else {
        remoteHabitNotes[n.habit_id].byDate[n.date] = n.content;
      }
    });

    SyncState.setData({
      habits: remoteHabits, checks: remoteChecks, events: remoteEvents,
      archivedHabits: remoteArchived, habitNotes: remoteHabitNotes
    });
    SyncState.persistLocal();
  }

  return { pullFromServer };
})();
