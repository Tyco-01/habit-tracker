// ============================================================
// js/sync/state.js — NỀN TẢNG của toàn bộ module Sync. Giữ DUY NHẤT
// bản `data` thật trong toàn app — mutations.js, queue.js, pull.js
// đều đọc/ghi qua getData()/setData() ở đây, KHÔNG module nào được tự
// khai báo biến `data` riêng của mình.
//
// LÝ DO QUAN TRỌNG PHẢI LÀM VẬY: sync.js gốc (trước khi tách) là 1
// closure duy nhất, mọi hàm bên trong chia sẻ chung 1 biến `data` qua
// scope. Khi tách thành nhiều file (không có build step/bundler, mỗi
// file là 1 global riêng), nếu mỗi file tự "let data = ..." thì SẼ CÓ
// NHIỀU BẢN DATA KHÁC NHAU không đồng bộ — vd today.js gọi
// SyncMutations.setCheck() sửa 1 bản, nhưng event-section.js đọc
// SyncState.getData() lại thấy bản khác chưa cập nhật. File này tồn
// tại chính xác để ngăn lỗi đó: CHỈ CÓ 1 nơi sở hữu `data` thật.
//
// setData() dùng đúng 1 lần duy nhất trong toàn app: pull.js sau khi
// tải xong snapshot từ server (thay thế TOÀN BỘ data cục bộ bằng dữ
// liệu mới từ server). Mọi thao tác khác (thêm/sửa/xoá habit, tick
// việc...) đều SỬA TRỰC TIẾP field bên trong data hiện có (qua
// getData(), không gọi setData()) — xem mutations.js.
// ============================================================

const SyncState = (() => {

  let data = LocalStore.load();
  if (!Array.isArray(data.archivedHabits)) data.archivedHabits = [];
  if (!data.habitNotes || typeof data.habitNotes !== 'object') data.habitNotes = {};

  let listeners = [];
  let saveErrorListeners = [];
  let lastSaveFailed = false;

  function getData() { return data; }

  // CHỈ dùng khi cần THAY THẾ TOÀN BỘ data (hiện chỉ pull.js dùng, sau
  // khi tải snapshot mới từ server) — không dùng để sửa 1 field lẻ,
  // việc đó sửa trực tiếp qua getData() rồi gọi persistLocal().
  function setData(newData) { data = newData; }

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

  // getter/setter cho lastSaveFailed — cần expose vì queue.js (flushQueue)
  // đọc VÀ GHI cờ này khi lưu hàng đợi thất bại, cùng lớp lỗi với
  // persistLocal() bên dưới nhưng xảy ra ở bước khác (lưu hàng đợi,
  // không phải lưu data chính) nên không thể tự động hoá qua persistLocal().
  function getLastSaveFailed() { return lastSaveFailed; }
  function setLastSaveFailed(v) { lastSaveFailed = v; }

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

  function truncate(str, max) {
    return (str || '').toString().trim().slice(0, max);
  }

  function isTemp(id) {
    return typeof id === 'string' && id.startsWith('tmp_');
  }

  return {
    getData, setData,
    onChange, offChange, onSaveError, notifySaveError,
    getLastSaveFailed, setLastSaveFailed,
    persistLocal, tempId, truncate, isTemp,
    // Chỉ dùng cho TEST — xác nhận không có listener bị cộng dồn qua
    // nhiều lần render() (xem ARCHITECTURE.md mục 5b). Gạch dưới đầu
    // tên đánh dấu đây là API nội bộ/debug, không phải tính năng công khai.
    _listenerCount: () => listeners.length
  };
})();
