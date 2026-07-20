// ============================================================
// sync.js — Cầu nối giữa dữ liệu cục bộ (offline-first) và Supabase.
//
// Nguyên tắc: MỌI thao tác của người dùng áp dụng vào bộ nhớ cục bộ
// NGAY LẬP TỨC (phản hồi tức thì trên giao diện), sau đó mới thử gửi
// lên Supabase ở nền. Nếu gửi thất bại (mất mạng, lỗi tạm thời), thao
// tác được xếp vào hàng đợi và tự động thử lại sau — người dùng không
// bị chặn hay mất dữ liệu.
// ============================================================

const Sync = (() => {

  let data = LocalStore.load();
  let isSyncing = false;
  let listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function notify() { listeners.forEach(fn => fn(data)); }

  function getData() { return data; }

  function persistLocal() {
    LocalStore.save(data);
    notify();
  }

  // ---- Áp dụng thao tác vào state cục bộ (không đợi mạng) ----

  function applyAddHabit(habit) {
    data.habits.push(habit);
    persistLocal();
  }

  function applyRemoveHabit(habitId) {
    data.habits = data.habits.filter(h => h.id !== habitId);
    delete data.checks[habitId];
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

  // ---- Hành động công khai: gọi từ UI ----
  // Mỗi hành động: (1) tạo id tạm nếu cần, (2) áp dụng cục bộ ngay,
  // (3) đẩy vào hàng đợi đồng bộ, (4) thử đồng bộ ngay nếu có mạng.

  function tempId() {
    return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function addHabit(name) {
    const habit = { id: tempId(), name, sortOrder: data.habits.length };
    applyAddHabit(habit);
    LocalStore.enqueue('add_habit', { localId: habit.id, name });
    kickSync();
    return habit;
  }

  function removeHabit(habitId) {
    applyRemoveHabit(habitId);
    LocalStore.enqueue('remove_habit', { habitId });
    kickSync();
  }

  function setCheck(habitId, dateStr, checked) {
    applySetCheck(habitId, dateStr, checked);
    LocalStore.enqueue('set_check', { habitId, date: dateStr, checked });
    kickSync();
  }

  function addEvent(dateStr, name) {
    const event = { id: tempId(), name };
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

  // ---- Xử lý hàng đợi đồng bộ ----

  // id thật do server cấp thay cho id tạm — cần ánh xạ lại trong dữ liệu
  // cục bộ để các thao tác tiếp theo (vd xoá) dùng đúng id thật.
  function remapHabitId(oldId, newId) {
    data.habits = data.habits.map(h => h.id === oldId ? { ...h, id: newId } : h);
    if (data.checks[oldId]) {
      data.checks[newId] = data.checks[oldId];
      delete data.checks[oldId];
    }
    persistLocal();
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
      case 'remove_habit': {
        // Nếu habit chưa kịp có id thật (vẫn là tmp_) thì không có gì để xoá trên server
        if (String(entry.payload.habitId).startsWith('tmp_')) break;
        await SupabaseClient.rpc('remove_habit', {
          p_session_token: token, p_habit_id: entry.payload.habitId
        });
        break;
      }
      case 'set_check': {
        if (String(entry.payload.habitId).startsWith('tmp_')) {
          // Habit gốc chưa đồng bộ xong — đẩy thao tác này lại cuối hàng đợi, thử sau
          throw new Error('habit_not_synced_yet');
        }
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
        if (String(entry.payload.eventId).startsWith('tmp_')) break;
        await SupabaseClient.rpc('remove_event', {
          p_session_token: token, p_event_id: entry.payload.eventId
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
      let queue = LocalStore.loadQueue();
      const stillPending = [];

      for (const entry of queue) {
        try {
          await processOne(entry, token);
          // thành công → không đưa lại vào hàng đợi
        } catch (err) {
          if (err.message === 'habit_not_synced_yet') {
            stillPending.push(entry); // thử lại ở lượt sau
          } else if (err.isNetworkError) {
            stillPending.push(entry);
            break; // mất mạng giữa chừng — dừng, giữ nguyên phần còn lại
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

    const snapshot = await SupabaseClient.rpc('get_snapshot', { p_session_token: token });

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
      remoteEvents[e.date].push({ id: e.id, name: e.name });
    });

    data = { habits: remoteHabits, checks: remoteChecks, events: remoteEvents };
    persistLocal();
  }

  // Tự động đồng bộ khi mạng quay lại
  window.addEventListener('online', () => { flushQueue(); });

  // Thử đồng bộ định kỳ nhẹ nhàng (phòng trường hợp lỗi tạm thời trước đó)
  setInterval(() => { flushQueue(); }, 30000);

  return {
    getData, onChange,
    addHabit, removeHabit, setCheck, addEvent, removeEvent,
    pullFromServer, flushQueue
  };
})();
