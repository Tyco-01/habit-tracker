// ============================================================
// js/sync/index.js — Điểm ráp nối cuối cùng của module Sync đã tách
// (state.js + queue.js + mutations.js + pull.js). Gộp lại thành đúng
// object `Sync` với CHỮ KÝ Y HỆT bản gốc trước khi tách — mọi file
// khác trong app (today.js, event-section.js, app.js...) gọi
// Sync.getData(), Sync.addHabit()... như trước, KHÔNG cần sửa gì.
//
// Nạp SAU CẢ 4 file con (state.js, queue.js, mutations.js, pull.js)
// — xem thứ tự trong index.html.
// ============================================================

const Sync = {
  getData: SyncState.getData,
  onChange: SyncState.onChange,
  offChange: SyncState.offChange,
  onSaveError: SyncState.onSaveError,

  addHabit: SyncMutations.addHabit,
  removeHabit: SyncMutations.removeHabit,
  restoreHabit: SyncMutations.restoreHabit,
  emptyTrash: SyncMutations.emptyTrash,
  setCheck: SyncMutations.setCheck,
  addEvent: SyncMutations.addEvent,
  removeEvent: SyncMutations.removeEvent,
  renameHabit: SyncMutations.renameHabit,
  renameEvent: SyncMutations.renameEvent,
  reorderHabits: SyncMutations.reorderHabits,
  updateEventNote: SyncMutations.updateEventNote,
  setHabitNote: SyncMutations.setHabitNote,
  setHabitParent: SyncMutations.setHabitParent,

  pullFromServer: SyncPull.pullFromServer,
  flushQueue: SyncQueue.flushQueue,

  // Chỉ dùng cho TEST — xác nhận không có listener bị cộng dồn qua
  // nhiều lần render() (xem ARCHITECTURE.md mục 5b).
  _listenerCount: SyncState._listenerCount
};
