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
  if (!data.habitNotes || typeof data.habitNotes !== 'object') data.habitNotes = {};

  let isSyncing = false;
  let listeners = [];
  let saveErrorListeners = [];
  let lastSaveFailed = false;

  function onChange(fn) { listeners.push(fn); }
  function offChange(fn) { listeners = listeners.filter(l => l !== fn); }
  function notify() { listeners.forEach(fn => fn(data)); }

  // Riêng cho lỗi LƯU CỤC BỘ thất bại (ví dụ localStorage đầy) — tách
  // khỏi onChange/notify ở trên vì đó vốn dùng để báo "dữ liệu đã đổi,
  // vẽ lại UI", còn đây là báo "vừa đổi dữ liệu nhưng KHÔNG lưu được",
  // 2 việc khác hẳn nhau, không nên gộp cùng 1 kênh kẻo listener cũ
  // (chỉ mong nhận `data` để vẽ lại) phải tự đoán thêm ý nghĩa mới.
  function onSaveError(fn) { saveErrorListeners.push(fn); }
  function notifySaveError(reason) { saveErrorListeners.forEach(fn => fn(reason)); }

  function getData() { return data; }

  function persistLocal() {
    // TRƯỚC ĐÂY: gọi LocalStore.save(data) rồi bỏ qua hoàn toàn giá trị
    // trả về. Khi localStorage đầy, save() trả false nhưng notify() vẫn
    // chạy như bình thường — UI cập nhật đúng, người dùng thấy thay đổi
    // đã "lưu", nhưng thực ra KHÔNG nằm trong localStorage. Tải lại
    // trang trước khi kịp đồng bộ lên server là mất trắng, không có
    // cảnh báo gì. Giờ kiểm tra kết quả, báo lỗi qua onSaveError nếu
    // thất bại — xem setupSyncIndicator() trong app.js để biết UI hiện
    // cảnh báo này thế nào.
    const ok = LocalStore.save(data);
    if (!ok && !lastSaveFailed) {
      lastSaveFailed = true;
      notifySaveError('local_storage_full');
    } else if (ok && lastSaveFailed) {
      lastSaveFailed = false;
      notifySaveError('recovered');
    }
    notify();
  }

  function tempId() {
    return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // Cắt bớt text về đúng giới hạn CONFIG.MAX_LENGTH — phòng trường hợp
  // giá trị lọt qua mà không qua ô input HTML (vốn đã có maxlength),
  // ví dụ gọi thẳng Sync.addHabit(...) từ console với chuỗi rất dài.
  // String(x || '') để không crash nếu lỡ truyền vào giá trị không
  // phải chuỗi (undefined, null, number...).
  function truncate(str, max) {
    return String(str || '').slice(0, max);
  }

  function isTemp(id) {
    return String(id).startsWith('tmp_');
  }

  // ---- Áp dụng thao tác vào state cục bộ (không đợi mạng) ----

  function applyAddHabit(habit) {
    data.habits.push(habit);
    persistLocal();
  }

  // Chuyển habit sang danh sách archivedHabits thay vì xoá hẳn.
  // Nếu habit này đang là "cha" của những habit khác, các con đó
  // được tự động TÁCH RA thành việc độc lập (không bị archive theo)
  // — tránh trường hợp "con mồ côi" còn parentId trỏ tới 1 habit đã
  // nằm trong thùng rác, gây hiển thị sai hoặc lỗi khi khôi phục.
  function applyArchiveHabit(habitId) {
    const habit = data.habits.find(h => h.id === habitId);
    if (!habit) return;
    data.habits = data.habits
      .filter(h => h.id !== habitId)
      .map(h => h.parentId === habitId ? { ...h, parentId: null } : h);
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

  // Ghi chú cho "việc tích" — 2 dạng:
  //   dateStr = null  → ghi chú CHUNG, áp dụng mọi ngày
  //   dateStr = '...' → ghi chú RIÊNG cho đúng ngày đó
  // content rỗng ('') = xoá ghi chú đó.
  function applySetHabitNote(habitId, dateStr, content) {
    if (!data.habitNotes[habitId]) data.habitNotes[habitId] = { general: '', byDate: {} };
    const entry = data.habitNotes[habitId];
    if (dateStr === null) {
      entry.general = content;
    } else if (content) {
      entry.byDate[dateStr] = content;
    } else {
      delete entry.byDate[dateStr];
    }
    persistLocal();
  }

  // parentId = null → tách habit ra thành việc độc lập (kéo ra ngoài)
  //
  // CHẶN TẬN GỐC vòng lặp cha-con ngay ở đây (tầng dữ liệu) — trước
  // đây chỉ chặn ở tầng UI (views/today.js), nghĩa là nếu có đường
  // gọi khác tới setHabitParent (bug UI tương lai, hoặc gọi trực tiếp
  // từ console) vẫn có thể ghi được dữ liệu vòng lặp. Vòng lặp khiến
  // buildTree() không tìm được gốc hợp lệ, làm TOÀN BỘ habit liên
  // quan biến mất khỏi màn hình dù dữ liệu chưa hề bị xoá (đã xảy ra
  // thật: kéo "abc" thả vào "thiền" — con của "abc").
  function applySetHabitParent(habitId, parentId) {
    if (parentId) {
      const byId = {};
      data.habits.forEach(h => { byId[h.id] = h; });
      let cur = byId[parentId];
      let guard = 0;
      while (cur && cur.parentId && guard < 20) {
        if (cur.parentId === habitId) {
          console.warn(`setHabitParent bị chặn: sẽ tạo vòng lặp cha-con (${habitId} <-> ${parentId})`);
          return;
        }
        cur = byId[cur.parentId];
        guard++;
      }
    }
    data.habits = data.habits.map(h => h.id === habitId ? { ...h, parentId } : h);
    persistLocal();
  }

  // ---- Hành động công khai: gọi từ UI ----
  // Mỗi hành động: (1) áp dụng cục bộ ngay, (2) đẩy vào hàng đợi đồng
  // bộ, (3) thử đồng bộ ngay nếu có mạng.

  function addHabit(name) {
    name = truncate(name, CONFIG.MAX_LENGTH.NAME);
    const habit = { id: tempId(), name, sortOrder: data.habits.length, parentId: null };
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
    name = truncate(name, CONFIG.MAX_LENGTH.NAME);
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
    newName = truncate(newName, CONFIG.MAX_LENGTH.NAME);
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
    note = truncate(note, CONFIG.MAX_LENGTH.NOTE);
    applyUpdateEventNote(dateStr, eventId, note);
    LocalStore.enqueue('update_event_note', { eventId, note });
    kickSync();
  }

  // dateStr = null → ghi chú chung; dateStr = 'YYYY-MM-DD' → ghi chú riêng ngày đó
  function setHabitNote(habitId, dateStr, content) {
    content = truncate(content, CONFIG.MAX_LENGTH.NOTE);
    applySetHabitNote(habitId, dateStr, content);
    LocalStore.enqueue('set_habit_note', { habitId, date: dateStr, content });
    kickSync();
  }

  // parentId = null → tách thành việc độc lập
  function setHabitParent(habitId, parentId) {
    applySetHabitParent(habitId, parentId);
    LocalStore.enqueue('set_habit_parent', { habitId, parentId });
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
      if (entry.type === 'set_habit_note' && entry.payload.habitId === oldId) {
        return { ...entry, payload: { ...entry.payload, habitId: newId } };
      }
      if (entry.type === 'set_habit_parent') {
        const p = { ...entry.payload };
        if (p.habitId === oldId) p.habitId = newId;
        if (p.parentId === oldId) p.parentId = newId;
        return { ...entry, payload: p };
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
      case 'set_habit_note': {
        if (isTemp(entry.payload.habitId)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('set_habit_note', {
          p_session_token: token,
          p_habit_id: entry.payload.habitId,
          p_note_date: entry.payload.date, // null hoặc 'YYYY-MM-DD'
          p_content: entry.payload.content
        });
        break;
      }
      case 'set_habit_parent': {
        if (isTemp(entry.payload.habitId)) throw new Error('habit_not_synced_yet');
        if (entry.payload.parentId && isTemp(entry.payload.parentId)) throw new Error('habit_not_synced_yet');
        await SupabaseClient.rpc('set_habit_parent', {
          p_session_token: token,
          p_habit_id: entry.payload.habitId,
          p_parent_id: entry.payload.parentId
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

      const queueSaved = LocalStore.saveQueue(stillPending);
      if (!queueSaved && !lastSaveFailed) {
        // Cùng lớp lỗi với persistLocal() (localStorage đầy), nhưng
        // xảy ra ở bước lưu HÀNG ĐỢI ĐỒNG BỘ chứ không phải dữ liệu
        // chính — nếu không báo, các thao tác đang chờ gửi lên server
        // (stillPending) sẽ mất khỏi localStorage âm thầm, không ai
        // biết cho tới khi phát hiện dữ liệu không đồng bộ. Dùng
        // chung kênh onSaveError vì cùng bản chất "ghi localStorage
        // thất bại", không cần thêm 1 kênh báo lỗi riêng.
        lastSaveFailed = true;
        notifySaveError('local_storage_full');
      }
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

    data = {
      habits: remoteHabits, checks: remoteChecks, events: remoteEvents,
      archivedHabits: remoteArchived, habitNotes: remoteHabitNotes
    };
    persistLocal();
  }

  // Tự động đồng bộ khi mạng quay lại
  window.addEventListener('online', () => { flushQueue(); });

  // Thử đồng bộ định kỳ nhẹ nhàng (phòng trường hợp lỗi tạm thời trước đó)
  setInterval(() => { flushQueue(); }, 30000);

  return {
    getData, onChange, offChange, onSaveError,
    addHabit, removeHabit, restoreHabit, emptyTrash,
    setCheck, addEvent, removeEvent,
    renameHabit, reorderHabits, updateEventNote,
    setHabitNote, setHabitParent,
    pullFromServer, flushQueue,
    // Chỉ dùng cho TEST (smoke-test-full-app.js) để xác nhận trực tiếp
    // không có listener bị cộng dồn qua nhiều lần render() — không gọi
    // trong luồng chính của app. Đặt tên có gạch dưới đầu để đánh dấu
    // rõ đây là API nội bộ/debug, không phải 1 tính năng công khai.
    _listenerCount: () => listeners.length
  };
})();
