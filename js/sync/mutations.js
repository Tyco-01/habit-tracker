// ============================================================
// js/sync/mutations.js — Áp dụng thao tác vào state cục bộ (apply*)
// + hành động công khai gọi từ UI (addHabit, setCheck...). Mỗi hành
// động công khai: (1) áp dụng cục bộ ngay qua apply*, (2) đẩy vào
// hàng đợi đồng bộ, (3) gọi SyncQueue.kickSync() để thử gửi lên
// server ngay nếu có mạng. Nạp SAU state.js VÀ queue.js (cần
// SyncQueue.kickSync() đã tồn tại).
// ============================================================

const SyncMutations = (() => {

  // A UI lock is useful, but it is not a data-integrity boundary: touch/click
  // pairs, two mounted views, or callers outside the UI can still invoke this
  // function twice. This normalized fingerprint is also used to make names
  // unique for the full lifetime of an active habit, not just a short window.
  const recentHabitAdds = new Map();
  const HABIT_DEDUPE_WINDOW_MS = 1200;

  function habitFingerprint(name) {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  // ---- Áp dụng thao tác vào state cục bộ (không đợi mạng) ----

  function applyAddHabit(habit) {
    const data = SyncState.getData();
    data.habits.push(habit);
    SyncState.persistLocal();
  }

  // Chuyển habit sang danh sách archivedHabits thay vì xoá hẳn.
  // Nếu habit này đang là "cha" của những habit khác, các con đó
  // được tự động TÁCH RA thành việc độc lập (không bị archive theo)
  // — tránh trường hợp "con mồ côi" còn parentId trỏ tới 1 habit đã
  // nằm trong thùng rác, gây hiển thị sai hoặc lỗi khi khôi phục.
  function applyArchiveHabit(habitId) {
    const data = SyncState.getData();
    const habit = data.habits.find(h => h.id === habitId);
    if (!habit) return;
    data.habits = data.habits
      .filter(h => h.id !== habitId)
      .map(h => h.parentId === habitId ? { ...h, parentId: null } : h);
    data.archivedHabits.push({ id: habitId, name: habit.name, archivedAt: Date.now() });
    SyncState.persistLocal();
  }

  function applyRestoreHabit(habitId) {
    const data = SyncState.getData();
    const archived = data.archivedHabits.find(h => h.id === habitId);
    if (!archived) return;
    data.archivedHabits = data.archivedHabits.filter(h => h.id !== habitId);
    data.habits.push({ id: habitId, name: archived.name, sortOrder: data.habits.length });
    SyncState.persistLocal();
  }

  // Xoá vĩnh viễn 1 habit khỏi archivedHabits + toàn bộ checks liên quan
  function applyPurgeHabit(habitId) {
    const data = SyncState.getData();
    data.archivedHabits = data.archivedHabits.filter(h => h.id !== habitId);
    delete data.checks[habitId];
    SyncState.persistLocal();
  }

  function applyEmptyTrash() {
    const data = SyncState.getData();
    data.archivedHabits.forEach(h => { delete data.checks[h.id]; });
    data.archivedHabits = [];
    SyncState.persistLocal();
  }

  function applySetCheck(habitId, dateStr, checked) {
    const data = SyncState.getData();
    if (!data.checks[habitId]) data.checks[habitId] = {};
    if (checked) {
      data.checks[habitId][dateStr] = true;
    } else {
      delete data.checks[habitId][dateStr];
    }
    SyncState.persistLocal();
  }

  function applyAddEvent(dateStr, event) {
    const data = SyncState.getData();
    if (!data.events[dateStr]) data.events[dateStr] = [];
    data.events[dateStr].push(event);
    SyncState.persistLocal();
  }

  function applyRemoveEvent(dateStr, eventId) {
    const data = SyncState.getData();
    if (data.events[dateStr]) {
      data.events[dateStr] = data.events[dateStr].filter(e => e.id !== eventId);
    }
    SyncState.persistLocal();
  }

  function applyRenameHabit(habitId, newName) {
    const data = SyncState.getData();
    data.habits = data.habits.map(h => h.id === habitId ? { ...h, name: newName } : h);
    SyncState.persistLocal();
  }

  // Đổi tên MỌI event cùng oldName, ở MỌI ngày trong data.events —
  // KHÔNG chỉ 1 event_id — để timeline (nhóm theo tên, xem
  // historyFor() trong event-section.js) vẫn liền mạch sau khi đổi
  // tên thay vì bị tách thành 2 chuỗi rời nhau.
  function applyRenameEvent(oldName, newName) {
    const data = SyncState.getData();
    Object.keys(data.events).forEach(dateStr => {
      data.events[dateStr] = data.events[dateStr].map(e =>
        e.name === oldName ? { ...e, name: newName } : e
      );
    });
    SyncState.persistLocal();
  }

  function applyReorderHabits(orderedIds) {
    const data = SyncState.getData();
    const byId = {};
    data.habits.forEach(h => { byId[h.id] = h; });
    data.habits = orderedIds.map((id, idx) => ({ ...byId[id], sortOrder: idx })).filter(Boolean);
    SyncState.persistLocal();
  }

  function applyUpdateEventNote(dateStr, eventId, note) {
    const data = SyncState.getData();
    if (!data.events[dateStr]) return;
    data.events[dateStr] = data.events[dateStr].map(e => e.id === eventId ? { ...e, note } : e);
    SyncState.persistLocal();
  }

  // Ghi chú cho "việc tích" — 2 dạng:
  //   dateStr = null  → ghi chú CHUNG, áp dụng mọi ngày
  //   dateStr = '...' → ghi chú RIÊNG cho đúng ngày đó
  // content rỗng ('') = xoá ghi chú đó.
  function applySetHabitNote(habitId, dateStr, content) {
    const data = SyncState.getData();
    if (!data.habitNotes[habitId]) data.habitNotes[habitId] = { general: '', byDate: {} };
    const entry = data.habitNotes[habitId];
    if (dateStr === null) {
      entry.general = content;
    } else if (content) {
      entry.byDate[dateStr] = content;
    } else {
      delete entry.byDate[dateStr];
    }
    SyncState.persistLocal();
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
    const data = SyncState.getData();
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
    SyncState.persistLocal();
  }

  // ---- Hành động công khai: gọi từ UI ----
  // Mỗi hành động: (1) áp dụng cục bộ ngay, (2) đẩy vào hàng đợi đồng
  // bộ, (3) thử đồng bộ ngay nếu có mạng.

  function addHabit(name) {
    const data = SyncState.getData();
    name = SyncState.truncate(name, CONFIG.MAX_LENGTH.NAME);
    if (!name) return null;

    const key = habitFingerprint(name);
    const now = Date.now();
    const existing = data.habits.find(h => habitFingerprint(h.name) === key);
    if (existing) return existing;
    const recent = recentHabitAdds.get(key);
    if (recent && now - recent.createdAt < HABIT_DEDUPE_WINDOW_MS) {
      return recent.habit;
    }

    const habit = { id: SyncState.tempId(), name, sortOrder: data.habits.length, parentId: null };
    recentHabitAdds.set(key, { createdAt: now, habit });
    applyAddHabit(habit);
    LocalStore.enqueue('add_habit', { localId: habit.id, name });
    SyncQueue.kickSync();
    return habit;
  }

  // Xoá = chuyển vào thùng rác (archive), không xoá cứng ngay
  function removeHabit(habitId) {
    applyArchiveHabit(habitId);
    LocalStore.enqueue('archive_habit', { habitId });
    SyncQueue.kickSync();
  }

  function restoreHabit(habitId) {
    applyRestoreHabit(habitId);
    LocalStore.enqueue('restore_habit', { habitId });
    SyncQueue.kickSync();
  }

  // Xoá vĩnh viễn toàn bộ thùng rác — không hoàn tác được
  function emptyTrash() {
    applyEmptyTrash();
    LocalStore.enqueue('empty_trash', {});
    SyncQueue.kickSync();
  }

  function setCheck(habitId, dateStr, checked) {
    applySetCheck(habitId, dateStr, checked);
    LocalStore.enqueue('set_check', { habitId, date: dateStr, checked });
    SyncQueue.kickSync();
  }

  function addEvent(dateStr, name) {
    name = SyncState.truncate(name, CONFIG.MAX_LENGTH.NAME);
    const event = { id: SyncState.tempId(), name, note: '' };
    applyAddEvent(dateStr, event);
    LocalStore.enqueue('add_event', { localId: event.id, date: dateStr, name });
    SyncQueue.kickSync();
    return event;
  }

  function removeEvent(dateStr, eventId) {
    applyRemoveEvent(dateStr, eventId);
    LocalStore.enqueue('remove_event', { eventId });
    SyncQueue.kickSync();
  }

  function renameHabit(habitId, newName) {
    newName = SyncState.truncate(newName, CONFIG.MAX_LENGTH.NAME);
    applyRenameHabit(habitId, newName);
    LocalStore.enqueue('rename_habit', { habitId, name: newName });
    SyncQueue.kickSync();
  }

  // Đổi tên 1 dấu ấn ÁP DỤNG CẢ CHUỖI lịch sử — mọi event cùng tên
  // cũ (ở mọi ngày) đều đổi sang tên mới, timeline vẫn liền mạch.
  // Không dùng eventId làm khoá vì lý do đã giải thích ở
  // applyRenameEvent — dùng oldName để khớp đúng "cả nhóm" cùng lúc.
  // Không đổi gì nếu tên mới trùng hệt tên cũ (kể cả sau khi trim) —
  // tránh action rỗng vô nghĩa vào hàng đợi đồng bộ.
  function renameEvent(oldName, newName) {
    newName = SyncState.truncate(newName.trim(), CONFIG.MAX_LENGTH.NAME);
    if (!newName || newName === oldName) return;
    applyRenameEvent(oldName, newName);
    LocalStore.enqueue('rename_event', { oldName, newName });
    SyncQueue.kickSync();
  }

  function reorderHabits(orderedIds) {
    applyReorderHabits(orderedIds);
    LocalStore.enqueue('reorder_habits', { orderedIds });
    SyncQueue.kickSync();
  }

  function updateEventNote(dateStr, eventId, note) {
    note = SyncState.truncate(note, CONFIG.MAX_LENGTH.NOTE);
    applyUpdateEventNote(dateStr, eventId, note);
    LocalStore.enqueue('update_event_note', { eventId, note });
    SyncQueue.kickSync();
  }

  // dateStr = null → ghi chú chung; dateStr = 'YYYY-MM-DD' → ghi chú riêng ngày đó
  function setHabitNote(habitId, dateStr, content) {
    content = SyncState.truncate(content, CONFIG.MAX_LENGTH.NOTE);
    applySetHabitNote(habitId, dateStr, content);
    LocalStore.enqueue('set_habit_note', { habitId, date: dateStr, content });
    SyncQueue.kickSync();
  }

  // parentId = null → tách thành việc độc lập
  function setHabitParent(habitId, parentId) {
    applySetHabitParent(habitId, parentId);
    LocalStore.enqueue('set_habit_parent', { habitId, parentId });
    SyncQueue.kickSync();
  }

  return {
    addHabit, removeHabit, restoreHabit, emptyTrash,
    setCheck, addEvent, removeEvent,
    renameHabit, renameEvent, reorderHabits, updateEventNote,
    setHabitNote, setHabitParent
  };
})();
