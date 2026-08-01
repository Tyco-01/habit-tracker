// ============================================================
// storage-local.js — Lưu dữ liệu ngay trên thiết bị (offline-first).
//
// Dùng localStorage thay vì IndexedDB: dữ liệu của app này (vài chục
// thói quen × vài năm tick hàng ngày) chỉ tới vài trăm KB, quá nhỏ để
// cần một cơ sở dữ liệu phức tạp hơn. localStorage đơn giản, đồng bộ,
// và đủ tin cậy cho quy mô này — tránh over-engineering.
//
// Cấu trúc dữ liệu lưu cục bộ (PHẢI khớp với những gì sync.js đọc/ghi
// qua Sync.getData() — xem sync.js nếu thêm field mới ở đây):
//   habits: [{ id, name, sortOrder, parentId }]  — parentId: quan hệ cha-con
//   checks: { [habitId]: { [dateStr]: true } }   — chỉ lưu ngày ĐÃ tick
//   events: { [dateStr]: [{ id, name, note }] }
//   archivedHabits: [{ id, name, archivedAt }]   — habit trong thùng rác
//   habitNotes: { [habitId]: { general, byDate: { [dateStr]: content } } }
//
// LƯU Ý — bug đã sửa: save() luôn lưu NGUYÊN object data (mọi field),
// nhưng load() bản cũ chỉ đọc lại 3 field đầu (habits/checks/events),
// âm thầm đánh rơi archivedHabits/habitNotes dù chúng vẫn nằm nguyên
// trong chuỗi JSON đã lưu. Hậu quả: nếu offline rồi tải lại trang
// trước khi kịp Sync.pullFromServer(), thùng rác và ghi chú hiện
// TRỐNG dù dữ liệu chưa hề mất — chỉ là load() không đọc ra. Đã sửa:
// load() giờ khôi phục đủ mọi field mà save() có thể đã ghi.
// ============================================================

const LocalStore = (() => {

  function emptyData() {
    return { habits: [], checks: {}, events: {}, archivedHabits: [], habitNotes: {} };
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.DATA);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw);
      return {
        habits: Array.isArray(parsed.habits) ? parsed.habits : [],
        checks: parsed.checks && typeof parsed.checks === 'object' ? parsed.checks : {},
        events: parsed.events && typeof parsed.events === 'object' ? parsed.events : {},
        archivedHabits: Array.isArray(parsed.archivedHabits) ? parsed.archivedHabits : [],
        habitNotes: parsed.habitNotes && typeof parsed.habitNotes === 'object' ? parsed.habitNotes : {}
      };
    } catch {
      return emptyData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.DATA, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Không lưu được dữ liệu cục bộ:', e);
      return false;
    }
  }

  function clear() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.DATA);
  }

  // ---- Hàng đợi đồng bộ: các thao tác chưa gửi lên server thành công ----
  // Mỗi phần tử: { id, type, payload, createdAt }
  // type ∈ 'add_habit' | 'remove_habit' | 'set_check' | 'add_event' | 'remove_event'

  function loadQueue() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SYNC_QUEUE);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveQueue(queue) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
      return true;
    } catch (e) {
      console.error('Không lưu được hàng đợi đồng bộ:', e);
      return false;
    }
  }

  function enqueue(type, payload) {
    const queue = loadQueue();
    queue.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: Date.now()
    });
    saveQueue(queue);
  }

  function dequeue(entryId) {
    const queue = loadQueue().filter(e => e.id !== entryId);
    saveQueue(queue);
  }

  function clearQueue() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SYNC_QUEUE);
  }

  return {
    load, save, clear,
    loadQueue, saveQueue, enqueue, dequeue, clearQueue
  };
})();
