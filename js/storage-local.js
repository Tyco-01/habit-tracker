// ============================================================
// storage-local.js — Lưu dữ liệu ngay trên thiết bị (offline-first).
//
// Dùng localStorage thay vì IndexedDB: dữ liệu của app này (vài chục
// thói quen × vài năm tick hàng ngày) chỉ tới vài trăm KB, quá nhỏ để
// cần một cơ sở dữ liệu phức tạp hơn. localStorage đơn giản, đồng bộ,
// và đủ tin cậy cho quy mô này — tránh over-engineering.
//
// Cấu trúc dữ liệu lưu cục bộ:
//   habits: [{ id, name, sortOrder }]
//   checks: { [habitId]: { [dateStr]: true } }   — chỉ lưu ngày ĐÃ tick
//   events: { [dateStr]: [{ id, name }] }
// ============================================================

const LocalStore = (() => {

  function emptyData() {
    return { habits: [], checks: {}, events: {} };
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.DATA);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw);
      return {
        habits: Array.isArray(parsed.habits) ? parsed.habits : [],
        checks: parsed.checks && typeof parsed.checks === 'object' ? parsed.checks : {},
        events: parsed.events && typeof parsed.events === 'object' ? parsed.events : {}
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
    localStorage.setItem(CONFIG.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
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
