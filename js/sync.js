// ============================================================
// sync.js — Cầu nối giữa dữ liệu cục bộ (offline-first) và Supabase.
//
// Nguyên tắc: MỌI thao tác của người dùng áp dụng vào bộ nhớ cục bộ
// NGAY LẬP TỨC (phản hồi tức thì trên giao diện), sau đó mới thử gửi
// lên Supabase ở nền. Nếu gửi thất bại (mất mạng, lỗi tạm thời), thao
// tác được xếp vào hàng đợi và tự động thử lại sau — người dùng không
// bị chặn hay mất dữ liệu.
//
// Cơ chế Thùng rác: xoá habit không xoá cứng ngay mà chuyển vào
// data.archivedHabits (kèm thời điểm xoá). Sau 30 ngày, hoặc khi
// người dùng chủ động "Dọn sạch", habit mới bị xoá vĩnh viễn.
// ============================================================

const Sync = (() => {

  let data = LocalStore.load();
  if (!Array.isArray(data.archivedHabits)) data.archivedHabits = [];

  let isSyncing = false;
  let listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(fn => fn(data)); }

  function getData() { return data; }

  function persistLocal() {
    LocalStore.save(data);
    notify();
  }

  function tempId() {
    return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function isTemp(id) {
    return String(id).startsWith('tmp_');
  }

  // ---- Áp dụng thao tác vào state cục bộ (không đợi mạng) ----

  function applyAddHabit(habit) {
    data.habits.push(habit);
    persistLocal();
  }

  // Chuyển habit sang danh sách archivedHabits thay vì xoá hẳn
  function applyArchiveHabit(habitId) {
    const habit = data.habits.find(h => h.id === habitId);
    if (!habit) return;
    data.habits = data.habits.filter(h => h.id !== habitId);
    data.archivedHabits.push({ id: habitId, name: habit.name, archivedAt: Date.now() });
    persistLocal();
  }

  function applyRestoreHabit(habitId) {
    const archived = data.archivedHabits.find(h => h.id === habitId);
    if (!archived) return;
    data.archivedHabits = data.archivedHabits.filter(h => h.id !== habitId);
    data.habits.push({ id: habitId, name: archived.name, sortOrder: data.habits.length });
    persistLocal();
  }

  // Xoá vĩnh viễn 1 habit khỏi archivedHabits + toàn bộ checks liên quan
  function applyPurgeHabit(habitId) {
    data.archivedHabits = data.archivedHabits.filter(h => h.id !== habitId);
    delete data.checks[habitId];
    persistLocal();
  }

  function applyEmptyTrash() {
    data.archivedHabits.forEach(h => { delete data.checks[h.id]; });
    data.archivedHabits = [];
    persistLocal();
  }

  function applySetCheck(habitId, dateStr, checked) {
    if (!data.checks[habitId]) data.checks[habitId] = {};
    if (checked) {
      data.checks[habitId][dateStr] = true;
    } else {
      delete data.checks[habitId][dateStr];
    }
    persistLocal();
  }

  function applyAddEvent(dateStr, event) {
    if (!data.events[dateStr]) data.events[dateStr] = [];
    data.events[dateStr].push(event);
    persistLocal();
  }

  function applyRemoveEvent(dateStr, eventId) {
    if (data.events[dateStr]) {
      data.events[dateStr] = data.events[dateStr].filter(e => e.id !== eventId);
    }
    persistLocal();
  }

  function applyRenameHabit(habitId, newName) {
    data.habits = data.habits.map(h => h.id === habitId ? { ...h, name: newName } : h);
    persistLocal();
  }

  function applyReorderHabits(orderedIds) {
    const byId = {};
    data.habits.forEach(h => { byId[h.id] = h; });
    data.habits = orderedIds.map((id, idx) => ({ ...byId[id], sortOrder: idx })).filter(Boolean);
    persistLocal();
  }

  function applyUpdateEventNote(dateStr, eventId, note) {
    if (!data.events[dateStr]) return;
    data.events[dateStr] = data.events[dateStr].map(e => e.id === eventId ? { ...e, note } : e);
    persistLocal();
  }

  // ---- Hành động công khai: gọi từ UI ----
  // Mỗi hành động: (1) áp dụng cục bộ ngay, (2) đẩy vào hàng đợi đồng
  // bộ, (3) thử đồng bộ ngay nếu có mạng.

  function addHabit(name) {
    const habit = { id: tempId(), name, sortOrder: data.habits.length };
    applyAddHabit(habit);
    LocalStore.enqueue('add_habit', { localId: habit.id, name });
    kickSync();
    return habit;
  }

  // Xoá = chuyển vào thùng rác (archive), không xoá cứng ngay
  function removeHabit(habitId) {
    applyArchiveHabit(habitId);
    LocalStore.enqueue('archive_habit', { habitId });
    kickSync();
  }

  function restoreHabit(habitId) {
    applyRestoreHabit(habitId);
    LocalStore.enqueue('restore_habit', { habitId });
    kickSync();
  }

  // Xoá vĩnh viễn toàn bộ thùng rác — không hoàn tác được
  function emptyTrash() {
    applyEmptyTrash();
    LocalStore.enqueue('empty_trash', {});
    kickSync();
  }

  function setCheck(habitId, dateStr, checked) {
    applySetCheck(habitId, dateStr, checked);
    LocalStore.enqueue('set_check', { habitId, date: dateStr, checked });
    kickSync();
  }

  function addEvent(dateStr, name) {
    const event = { id: tempId(), name, note: '' };
    applyAddEvent(dateStr, event);
    LocalStore.enqueue('add_event', { localId: event.id, date: dateStr, name });
    kickSync();
    return event;
  }

  function removeEvent(dateStr, eventId) {
    applyRemoveEvent(dateStr, eventId);
    LocalStore.enqueue('remove_event', { eventId });
    kickSync();
  }

  function renameHabit(habitId, newName) {
    applyRenameHabit(habitId, newName);
    LocalStore.enqueue('rename_habit', { habitId, name: newName });
    kickSync();
  }

  function reorderHabits(orderedIds) {
    applyReorderHabits(orderedIds);
    LocalStore.enqueue('reorder_habits', { orderedIds });
    kickSync();
  }

  function updateEventNote(dateStr, eventId, note) {
    applyUpdateEventNote(dateStr, eventId, note);
    LocalStore.enqueue('update_event_note', { eventId, note });
    kickSync();
  }

  // ---- Xử lý hàng đợi đồng bộ ----

  // id thật do server cấp thay cho id tạm — cần ánh xạ lại trong dữ liệu
  // cục bộ để các thao tác tiếp theo (vd xoá) dùng đúng id thật.
  // id thật do server cấp thay cho id tạm — cần ánh xạ lại trong dữ liệu
  // cục bộ để các thao tác tiếp theo (vd xoá) dùng đúng id thật. Đồng thời
  // phải cập nhật NGAY các entry còn lại trong hàng đợi (vd set_check gửi
  // liền sau add_habit trong cùng 1 lượt offline) — nếu không, chúng vẫn
  // giữ id tạm cũ và phải chờ thêm 1 lượt flushQueue nữa mới gửi được.
  function remapHabitIdInQueue(oldId, newId) {
    const queue = LocalStore.loadQueue();
    const updated = queue.map(entry => {
      if (entry.type === 'set_check' && entry.payload.habitId === oldId) {
        return { ...entry, payload: { ...entry.payload, habitId: newId } };
      }
      if (entry.type === 'rename_habit' && entry.payload.habitId === oldId) {
        return { ...entry, payload: { ...entry.payload, habitId: newId } };
      }
      if (entry.type === 'archive_habit' && entry.payload.habitId === oldId) {
        return { ...entry, payload: { ...entry.payload, habitId: newId } };
      }
      if (entry.type === 'reorder_habits') {
        return { ...entry, payload: { orderedIds: entry.payload.orderedIds.map(id => id === oldId ? newId : id) } };
      }
      return entry;
    });
    LocalStore.saveQueue(updated);
  }

  function remapHabitId(oldId, newId) {
    data.habits = data.habits.map(h => h.id === oldId ? { ...h, id: newId } : h);
    if (data.checks[oldId]) {
      data.checks[newId] = data.checks[oldId];
      delete data.checks[oldId];
    }
    persistLocal();
    remapHabitIdInQueue(oldId, newId);
  }

  function remapEventId(dateStr, oldId, newId) {
    if (!data.events[dateStr]) return;
    data.events[dateStr] = data.events[dateStr].map(e => e.id === oldId ? { ...e, id: newId } : e);
    persistLocal();
  }

  async function processOne(entry, token) {
    switch (entry.type) {
      case 'add_habit': {
        const newId = await SupabaseClient.rpc('add_habit', {
          p_session_token: token, p_name: entry.payload.name
        });
        remapHabitId(entry.payload.localId, newId);
        break;
      }
      case 'archive_habit': {
        if (isTemp(entry.payload.habitId)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('remove_habit', {
          p_session_token: token, p_habit_id: entry.payload.habitId
        });
        break;
      }
      case 'restore_habit': {
        await SupabaseClient.rpc('restore_habit', {
          p_session_token: token, p_habit_id: entry.payload.habitId
        });
        break;
      }
      case 'empty_trash': {
        await SupabaseClient.rpc('empty_trash', { p_session_token: token });
        break;
      }
      case 'set_check': {
        if (isTemp(entry.payload.habitId)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('set_check', {
          p_session_token: token,
          p_habit_id: entry.payload.habitId,
          p_date: entry.payload.date,
          p_checked: entry.payload.checked
        });
        break;
      }
      case 'add_event': {
        const newId = await SupabaseClient.rpc('add_event', {
          p_session_token: token, p_date: entry.payload.date, p_name: entry.payload.name
        });
        remapEventId(entry.payload.date, entry.payload.localId, newId);
        break;
      }
      case 'remove_event': {
        if (isTemp(entry.payload.eventId)) break;
        await SupabaseClient.rpc('remove_event', {
          p_session_token: token, p_event_id: entry.payload.eventId
        });
        break;
      }
      case 'rename_habit': {
        if (isTemp(entry.payload.habitId)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('update_habit_name', {
          p_session_token: token, p_habit_id: entry.payload.habitId, p_new_name: entry.payload.name
        });
        break;
      }
      case 'reorder_habits': {
        // Nếu còn habit nào chưa có id thật, hoãn thao tác sắp xếp lại tới khi tất cả đã đồng bộ
        if (entry.payload.orderedIds.some(isTemp)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('reorder_habits', {
          p_session_token: token, p_ordered_ids: entry.payload.orderedIds
        });
        break;
      }
      case 'update_event_note': {
        if (isTemp(entry.payload.eventId)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('update_event_note', {
          p_session_token: token, p_event_id: entry.payload.eventId, p_note: entry.payload.note
        });
        break;
      }
    }
  }

  async function flushQueue() {
    if (isSyncing) return;
    if (!navigator.onLine) return;
    const token = Auth.currentToken();
    if (!token) return;

    isSyncing = true;
    try {
      const initialQueue = LocalStore.loadQueue();
      const stillPending = [];

      for (let i = 0; i < initialQueue.length; i++) {
        // Đọc lại đúng entry này từ LocalStore (không dùng bản snapshot cứng
        // từ đầu) — vì processOne() ở bước trước có thể đã gọi remapHabitId
        // và cập nhật id tạm → id thật ngay trong hàng đợi (xem
        // remapHabitIdInQueue). Nếu cứ dùng snapshot cũ, set_check gửi ngay
        // sau add_habit trong cùng lượt sẽ bị gửi nhầm id tạm đã hết hạn.
        const currentQueue = LocalStore.loadQueue();
        const entry = currentQueue.find(e => e.id === initialQueue[i].id) || initialQueue[i];

        try {
          await processOne(entry, token);
          // thành công → không đưa lại vào hàng đợi
        } catch (err) {
          if (err.message === 'habit_not_synced_yet') {
            stillPending.push(entry); // thử lại ở lượt sau
          } else if (err.isNetworkError) {
            // Mất mạng giữa chừng: KHÔNG chỉ giữ lại entry đang lỗi — mọi
            // thao tác còn lại (i trở đi, kể cả những cái CHƯA kịp thử)
            // đều phải giữ nguyên, nếu không sẽ bị rơi mất vĩnh viễn.
            const remaining = currentQueue.filter(e =>
              initialQueue.slice(i).some(orig => orig.id === e.id)
            );
            stillPending.push(...remaining);
            break;
          } else {
            // Lỗi nghiệp vụ thật (vd dữ liệu không hợp lệ) — bỏ qua thao tác này,
            // không để nó chặn cả hàng đợi mãi mãi.
            console.error('Bỏ qua thao tác đồng bộ lỗi:', entry, err);
          }
        }
      }

      LocalStore.saveQueue(stillPending);
    } finally {
      isSyncing = false;
    }
  }

  let kickTimer = null;
  function kickSync() {
    clearTimeout(kickTimer);
    kickTimer = setTimeout(() => { flushQueue(); }, 400);
  }

  // ---- Tải toàn bộ dữ liệu từ server (lúc đăng nhập / mở app lần đầu) ----
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
      id: h.id, name: h.name, sortOrder: h.sort_order
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

    data = { habits: remoteHabits, checks: remoteChecks, events: remoteEvents, archivedHabits: remoteArchived };
    persistLocal();
  }

  // Tự động đồng bộ khi mạng quay lại
  window.addEventListener('online', () => { flushQueue(); });

  // Thử đồng bộ định kỳ nhẹ nhàng (phòng trường hợp lỗi tạm thời trước đó)
  setInterval(() => { flushQueue(); }, 30000);

  return {
    getData, onChange,
    addHabit, removeHabit, restoreHabit, emptyTrash,
    setCheck, addEvent, removeEvent,
    renameHabit, reorderHabits, updateEventNote,
    pullFromServer, flushQueue
  };
})();
