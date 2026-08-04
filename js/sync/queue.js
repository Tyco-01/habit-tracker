// ============================================================
// js/sync/queue.js — Xử lý hàng đợi đồng bộ offline. Đọc/ghi dữ liệu
// qua SyncState.getData() (KHÔNG tự giữ biến `data` riêng — xem cảnh
// báo quan trọng ở đầu state.js). Nạp SAU state.js, TRƯỚC mutations.js
// (mutations.js gọi kickSync() ở cuối mỗi hành động công khai).
// ============================================================

const SyncQueue = (() => {

  let isSyncing = false; // cờ khoá nội bộ, chỉ dùng trong file này — khác
                          // với data/listeners (thật sự dùng chung), nên
                          // KHÔNG đặt trong state.js.

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
    const data = SyncState.getData();
    data.habits = data.habits.map(h => h.id === oldId ? { ...h, id: newId } : h);
    if (data.checks[oldId]) {
      data.checks[newId] = data.checks[oldId];
      delete data.checks[oldId];
    }
    SyncState.persistLocal();
    remapHabitIdInQueue(oldId, newId);
  }

  function remapEventId(dateStr, oldId, newId) {
    const data = SyncState.getData();
    if (!data.events[dateStr]) return;
    data.events[dateStr] = data.events[dateStr].map(e => e.id === oldId ? { ...e, id: newId } : e);
    SyncState.persistLocal();
  }

  async function processOne(entry, token) {
    const isTemp = SyncState.isTemp;
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
      case 'rename_event': {
        // Không cần check isTemp: RPC update_event_name khớp theo
        // TÊN (p_old_name), không theo event_id — nên vẫn đúng dù
        // event đang mang id tạm hay id thật (xem supabase/migration_v4.sql).
        await SupabaseClient.rpc('update_event_name', {
          p_session_token: token, p_old_name: entry.payload.oldName, p_new_name: entry.payload.newName
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
      if (!queueSaved && !SyncState.getLastSaveFailed()) {
        // Cùng lớp lỗi với persistLocal() (localStorage đầy), nhưng
        // xảy ra ở bước lưu HÀNG ĐỢI ĐỒNG BỘ chứ không phải dữ liệu
        // chính — nếu không báo, các thao tác đang chờ gửi lên server
        // (stillPending) sẽ mất khỏi localStorage âm thầm, không ai
        // biết cho tới khi phát hiện dữ liệu không đồng bộ. Dùng
        // chung kênh onSaveError vì cùng bản chất "ghi localStorage
        // thất bại", không cần thêm 1 kênh báo lỗi riêng.
        SyncState.setLastSaveFailed(true);
        SyncState.notifySaveError('local_storage_full');
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

  // Tự động đồng bộ khi mạng quay lại
  window.addEventListener('online', () => { flushQueue(); });

  // Thử đồng bộ định kỳ nhẹ nhàng (phòng trường hợp lỗi tạm thời trước đó)
  setInterval(() => { flushQueue(); }, 30000);

  return { flushQueue, kickSync };
})();
