// ============================================================
// dom-utils.js — Tiện ích thao tác DOM dùng CHUNG cho toàn app.
//
// escapeHtml() trước đây bị định nghĩa lặp lại y hệt (copy-paste) ở
// 6 file khác nhau (event-section, habit-note-panel, day-detail,
// stats, today, trash) — gộp về 1 chỗ để sửa 1 lần áp dụng mọi nơi.
// ============================================================

const DomUtils = (() => {

  // Escape chuỗi trước khi chèn vào template HTML (chống XSS cơ bản
  // qua tên habit/sự kiện do người dùng tự đặt) — dùng chính trình
  // duyệt để escape (gán vào textContent rồi đọc lại innerHTML) thay
  // vì tự viết regex thay thế từng ký tự, tránh sót trường hợp.
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { escapeHtml };
})();
