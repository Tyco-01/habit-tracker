// ============================================================
// js/theme-toggle.js — Quản lý giao diện: 3 chế độ có sẵn (Theo hệ
// thống/Sáng/Tối) CỘNG THÊM 1 "bộ sưu tập" theme TUỲ CHỈNH do người
// dùng tự đặt màu từng thành phần + đặt tên + lưu lại, chọn dùng bất
// cứ lúc nào (xem js/theme-editor-modal.js cho phần UI).
//
// LƯU Ý PHẠM VI: theme là SỞ THÍCH THIẾT BỊ (giống mã khoá màn hình),
// không phải dữ liệu người dùng — CHỈ lưu localStorage, KHÔNG đồng bộ
// qua Supabase. Đổi máy/trình duyệt khác sẽ không thấy theme đã lưu —
// đây là quyết định có chủ đích, xem mục 8 trong ARCHITECTURE.md.
//
// QUAN TRỌNG: logic áp dụng (CẢ chế độ có sẵn LẪN theme tuỳ chỉnh)
// được LẶP LẠI ở 1 <script> CHẶN RENDER ngay đầu <head> trong
// index.html (TRƯỚC khi tải CSS) — không chỉ ở đây — để tránh "nháy
// sai theme" 1 khắc lúc tải trang. Script đó là BẢN RÚT GỌN có chủ
// đích của apply()/STORAGE_KEY/CUSTOM_KEY dưới đây — ĐỔI KEY hoặc
// logic áp dụng thì PHẢI sửa cả 2 chỗ.
// ============================================================

const ThemeToggle = (() => {
  const STORAGE_KEY = 'habit-tracker-theme'; // 'system'(mặc định) | 'light' | 'dark' | 'custom:<id>'
  const CUSTOM_KEY = 'habit-tracker-custom-themes'; // JSON: [{id, name, vars}]
  const ORDER = ['system', 'light', 'dark']; // 3 chế độ có sẵn — KHÔNG gồm custom (custom chọn từ bộ sưu tập, không xoay vòng)
  const ICON = { system: 'ti-device-desktop', light: 'ti-sun', dark: 'ti-moon' };
  const LABEL = { system: 'Theo hệ thống', light: 'Giao diện sáng', dark: 'Giao diện tối' };

  // 8 "thành phần" cho phép tuỳ chỉnh màu — key JS ngắn gọn <-> tên
  // biến CSS thật (xem css/base.css). Đây là DUY NHẤT 1 nơi định
  // nghĩa danh sách này — js/theme-editor-modal.js đọc từ đây để vẽ
  // form, không tự liệt kê lại.
  const VARS = [
    { key: 'ink', cssVar: '--ink', label: 'Chữ chính' },
    { key: 'mute', cssVar: '--mute', label: 'Chữ phụ (mờ)' },
    { key: 'paper', cssVar: '--paper', label: 'Nền trang' },
    { key: 'card', cssVar: '--card', label: 'Nền thẻ/card' },
    { key: 'line', cssVar: '--line', label: 'Viền' },
    { key: 'fullBg', cssVar: '--full-bg', label: 'Ô "hoàn thành đủ"' },
    { key: 'partialBg', cssVar: '--partial-bg', label: 'Ô "hoàn thành 1 phần"' },
    { key: 'danger', cssVar: '--danger', label: 'Màu cảnh báo/lỗi' }
  ];

  // Khớp đúng giá trị meta theme-color trong index.html/manifest.json —
  // ĐỔI MÀU Ở BASE.CSS THÌ NHỚ ĐỔI CẢ Ở ĐÂY, không tự suy ra được từ
  // CSS (biến CSS không đọc được từ JS mà không tốn 1 lần reflow).
  const META_COLOR = { light: '#F5F1E8', dark: '#1C1917' };

  function isCustomMode(mode) {
    return typeof mode === 'string' && mode.indexOf('custom:') === 0;
  }
  function customIdOf(mode) {
    return isCustomMode(mode) ? mode.slice('custom:'.length) : null;
  }

  function get() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (ORDER.includes(v)) return v;
      if (isCustomMode(v) && listCustomThemes().some(t => t.id === customIdOf(v))) return v;
      return 'system';
    } catch (e) {
      return 'system'; // localStorage có thể bị chặn (chế độ ẩn danh nghiêm ngặt của 1 số trình duyệt)
    }
  }

  function listCustomThemes() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomThemesList(list) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) { /* hết dung lượng hoặc bị chặn — thôi, không lưu được thì dùng cho phiên này rồi mất */ }
  }

  // #RRGGBB → "r, g, b" — cần để tính lại --ink-rgb (dùng cho rgba()
  // ở shadow/scrollbar, xem css/components.css) mỗi khi --ink đổi,
  // vì --ink-rgb không tự suy ra được từ --ink bằng CSS thuần.
  function hexToRgbTriplet(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return '0, 0, 0';
    return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
  }

  // Độ chói tương đối theo công thức WCAG — dùng để cảnh báo tương
  // phản thấp trong js/theme-editor-modal.js (contrastRatio bên dưới),
  // KHÔNG chặn lưu, chỉ cảnh báo (xem lý do ở ARCHITECTURE.md mục 8).
  function relativeLuminance(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return 0;
    const chan = (v) => {
      v = parseInt(v, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const [r, g, b] = [chan(m[1]), chan(m[2]), chan(m[3])];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(hexA, hexB) {
    const L1 = relativeLuminance(hexA) + 0.05;
    const L2 = relativeLuminance(hexB) + 0.05;
    return L1 > L2 ? L1 / L2 : L2 / L1;
  }

  // Đọc màu ĐANG HIỆU LỰC thật sự của cả 8 biến (sau khi mọi override
  // — data-theme, prefers-color-scheme, hay theme tuỳ chỉnh trước đó —
  // đã áp dụng) — dùng làm giá trị KHỞI ĐIỂM khi mở form "Tạo theme
  // mới", để người dùng CHỈNH TỪ theme hiện tại thay vì phải tự chọn
  // lại từ đầu cả 8 màu.
  function getResolvedColors() {
    const computed = getComputedStyle(document.documentElement);
    const out = {};
    VARS.forEach(v => {
      const raw = computed.getPropertyValue(v.cssVar).trim();
      out[v.key] = /^#[0-9a-f]{6}$/i.test(raw) ? raw : '#000000';
    });
    return out;
  }

  function applyMetaThemeColor(paperColorOrMode) {
    const light = document.querySelector('meta[name="theme-color"][media*="light"]');
    const dark = document.querySelector('meta[name="theme-color"][media*="dark"]');
    if (!light || !dark) return;
    if (paperColorOrMode === 'system') {
      // Khôi phục nguyên bản — mỗi thẻ tự khớp đúng media của nó,
      // trình duyệt tự chọn theo prefers-color-scheme thật.
      light.setAttribute('content', META_COLOR.light);
      dark.setAttribute('content', META_COLOR.dark);
      return;
    }
    // 'light'/'dark' → màu mặc định tương ứng; theme tuỳ chỉnh → màu
    // nền (--paper) của chính theme đó, truyền thẳng vào tham số này.
    const color = paperColorOrMode === 'light' ? META_COLOR.light
      : paperColorOrMode === 'dark' ? META_COLOR.dark
      : paperColorOrMode;
    light.setAttribute('content', color);
    dark.setAttribute('content', color);
  }

  // Xoá sạch mọi inline override của lần chọn custom theme TRƯỚC đó
  // (nếu có) — cần thiết khi chuyển TỪ 1 theme tuỳ chỉnh SANG chế độ
  // có sẵn (system/light/dark), nếu không giá trị inline cũ (ưu tiên
  // cao hơn mọi CSS selector) sẽ tiếp tục đè lên base.css.
  function clearCustomOverrides() {
    const style = document.documentElement.style;
    VARS.forEach(v => style.removeProperty(v.cssVar));
    style.removeProperty('--ink-rgb');
  }

  function applyCustomTheme(theme) {
    const style = document.documentElement.style;
    VARS.forEach(v => {
      const val = theme.vars && theme.vars[v.key];
      if (val) style.setProperty(v.cssVar, val);
    });
    if (theme.vars && theme.vars.ink) style.setProperty('--ink-rgb', hexToRgbTriplet(theme.vars.ink));
    document.documentElement.removeAttribute('data-theme');
    applyMetaThemeColor((theme.vars && theme.vars.paper) || 'system');
  }

  function apply(mode) {
    if (isCustomMode(mode)) {
      const theme = listCustomThemes().find(t => t.id === customIdOf(mode));
      if (theme) { applyCustomTheme(theme); return; }
      mode = 'system'; // theme đã bị xoá (vd xoá ở thiết bị khác rồi mở lại đây) — rơi về mặc định
    }
    clearCustomOverrides();
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.setAttribute('data-theme', mode);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    applyMetaThemeColor(mode);
  }

  function set(mode) {
    if (!ORDER.includes(mode) && !isCustomMode(mode)) mode = 'system';
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* không lưu được thì thôi, vẫn áp dụng cho phiên hiện tại */ }
    apply(mode);
  }

  // Xoay vòng: theo hệ thống → sáng → tối → theo hệ thống... (CHỈ xoay
  // trong 3 chế độ có sẵn — nếu đang ở 1 custom theme, xoay từ 'system'
  // trở đi, không cố "tìm vị trí" của custom trong ORDER vì nó không
  // nằm trong đó).
  function cycle() {
    const current = get();
    const idx = ORDER.indexOf(current);
    const next = ORDER[(idx === -1 ? 0 : idx + 1) % ORDER.length];
    set(next);
    return next;
  }

  // name: chuỗi hiển thị; vars: { ink, mute, paper, card, line,
  // fullBg, partialBg, danger } — PHẢI đủ cả 8 key (js/theme-editor-
  // modal.js luôn gửi đủ, tự điền từ getResolvedColors() nếu người
  // dùng chưa chỉnh). Trả về theme object vừa lưu (kèm id mới).
  function saveNewCustomTheme(name, vars) {
    const theme = { id: 'theme_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, vars };
    const list = listCustomThemes();
    list.push(theme);
    saveCustomThemesList(list);
    return theme;
  }

  function updateCustomTheme(id, name, vars) {
    const list = listCustomThemes();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { id, name, vars };
    saveCustomThemesList(list);
    // Nếu theme này ĐANG được áp dụng, áp lại ngay để phản ánh thay đổi.
    if (get() === 'custom:' + id) apply('custom:' + id);
    return list[idx];
  }

  function deleteCustomTheme(id) {
    saveCustomThemesList(listCustomThemes().filter(t => t.id !== id));
    // Đang dùng đúng theme vừa xoá → rơi về "Theo hệ thống", không thể
    // tiếp tục hiển thị 1 theme không còn tồn tại trong bộ sưu tập.
    if (get() === 'custom:' + id) set('system');
  }

  return {
    get, set, apply, cycle, isCustomMode, customIdOf,
    listCustomThemes, saveNewCustomTheme, updateCustomTheme, deleteCustomTheme,
    getResolvedColors, contrastRatio,
    VARS, ICON, LABEL
  };
})();
