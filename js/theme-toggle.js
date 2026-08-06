// ============================================================
// js/theme-toggle.js — Cho chọn TAY giao diện Sáng/Tối/Theo hệ thống,
// bên cạnh việc tự đổi theo prefers-color-scheme (mặc định, xem
// css/base.css). Lưu lựa chọn vào localStorage, áp qua thuộc tính
// data-theme trên <html> — CSS đọc thuộc tính này để ghi đè khối
// @media (prefers-color-scheme: dark).
//
// QUAN TRỌNG: logic áp dụng CŨNG được lặp lại ở 1 <script> CHẶN RENDER
// ngay đầu <head> trong index.html (TRƯỚC khi tải CSS) — không chỉ ở
// đây — để tránh "nháy sai theme" 1 khắc lúc tải trang (nếu đợi tới
// lúc file JS này chạy mới đọc localStorage thì trang đã kịp vẽ 1
// lần theo theme mặc định rồi mới đổi lại, gây nháy). Script chặn
// render đó là BẢN RÚT GỌN có chủ đích của apply()/STORAGE_KEY dưới
// đây — ĐỔI STORAGE_KEY hoặc logic áp dụng thì PHẢI sửa cả 2 chỗ.
// ============================================================

const ThemeToggle = (() => {
  const STORAGE_KEY = 'habit-tracker-theme'; // giá trị: 'light' | 'dark' | 'system' (mặc định, coi như không lưu gì)
  const ORDER = ['system', 'light', 'dark'];
  const ICON = { system: 'ti-device-desktop', light: 'ti-sun', dark: 'ti-moon' };
  const LABEL = { system: 'Theo hệ thống', light: 'Giao diện sáng', dark: 'Giao diện tối' };

  // Khớp đúng giá trị meta theme-color trong index.html/manifest.json —
  // ĐỔI MÀU Ở BASE.CSS THÌ NHỚ ĐỔI CẢ Ở ĐÂY, không tự suy ra được từ
  // CSS (biến CSS không đọc được từ JS mà không tốn 1 lần reflow).
  const META_COLOR = { light: '#F5F1E8', dark: '#1C1917' };

  function get() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return ORDER.includes(v) ? v : 'system';
    } catch (e) {
      return 'system'; // localStorage có thể bị chặn (chế độ ẩn danh nghiêm ngặt của 1 số trình duyệt)
    }
  }

  function applyMetaThemeColor(mode) {
    const light = document.querySelector('meta[name="theme-color"][media*="light"]');
    const dark = document.querySelector('meta[name="theme-color"][media*="dark"]');
    if (!light || !dark) return;
    if (mode === 'system') {
      // Khôi phục nguyên bản — mỗi thẻ tự khớp đúng media của nó,
      // trình duyệt tự chọn theo prefers-color-scheme thật.
      light.setAttribute('content', META_COLOR.light);
      dark.setAttribute('content', META_COLOR.dark);
    } else {
      // Ép cả 2 thẻ về CÙNG 1 màu — bất kể media nào khớp, nội dung
      // đều giống nhau nên kết quả luôn đúng màu đã chọn tay.
      light.setAttribute('content', META_COLOR[mode]);
      dark.setAttribute('content', META_COLOR[mode]);
    }
  }

  function apply(mode) {
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.setAttribute('data-theme', mode);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    applyMetaThemeColor(mode);
  }

  function set(mode) {
    if (!ORDER.includes(mode)) mode = 'system';
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* không lưu được thì thôi, vẫn áp dụng cho phiên hiện tại */ }
    apply(mode);
  }

  // Xoay vòng: theo hệ thống → sáng → tối → theo hệ thống...
  function cycle() {
    const next = ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length];
    set(next);
    return next;
  }

  return { get, set, apply, cycle, ICON, LABEL };
})();
