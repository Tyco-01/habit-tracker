// ============================================================
// views/mini-calendar-picker.js — Bộ chọn ngày/tháng/năm TỰ VẼ, thay
// thế input[type=date/month] gốc của trình duyệt.
//
// LÝ DO tồn tại module này: input gốc (showPicker()) cho ra 1 khung
// popup hoàn toàn do trình duyệt/hệ điều hành vẽ — không set được màu,
// không chèn được âm lịch vào bên trong, và style của nó (nền trắng,
// font khác) lạc quẻ hẳn so với giao diện tối/sáng của app. Module này
// tự vẽ lại 100% để: (1) đồng bộ màu/kiểu với theme hiện tại của app
// (dùng chung biến CSS --ink/--paper/--card/--line/--mute), (2) hiện
// được âm lịch ngay trong từng ô ngày.
//
// API: MiniCalendarPicker.open({ anchorEl, initialDate, mode, onSelect })
//   - anchorEl: nút đã mở popup — dùng để loại trừ khỏi "click ra
//     ngoài thì đóng" (bấm lại đúng nút mở không nên tự đóng ngay);
//     KHÔNG dùng để định vị popup nữa (popup luôn ở giữa màn hình,
//     xem .mcp-popup trong CSS)
//   - initialDate: Date — tháng/năm ban đầu hiện ra
//   - mode: 'day' | 'week' — 'day' bôi đậm đúng 1 ô khi hover/chọn;
//     'week' bôi đậm CẢ HÀNG chứa ngày đang hover/chọn (để người dùng
//     thấy rõ mình đang chọn nguyên 1 tuần, không phải 1 ngày lẻ)
//   - onSelect(dateObj): gọi khi người dùng chọn xong 1 ngày, rồi
//     picker tự đóng
// ============================================================

const MiniCalendarPicker = (() => {

  let activePopup = null;
  let activeCleanup = null;

  function closeActive() {
    if (activeCleanup) activeCleanup();
    activePopup = null;
    activeCleanup = null;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function startOfWeek(d) {
    const r = new Date(d);
    r.setDate(r.getDate() - r.getDay());
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function lunarShort(dateObj) {
    try { return LunarCalendar.fromSolar(dateObj).shortLabel; } catch (e) { return ''; }
  }

  function open({ anchorEl, initialDate, mode = 'day', onSelect }) {
    closeActive(); // chỉ 1 popup mở tại 1 thời điểm — mở cái mới thì đóng cái cũ trước

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let viewDate = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
    let hoveredWeekStart = null; // chỉ dùng khi mode === 'week', để bôi đậm cả hàng lúc hover

    const backdrop = document.createElement('div');
    backdrop.className = 'mcp-backdrop';
    document.body.appendChild(backdrop);

    const popup = document.createElement('div');
    popup.className = 'mcp-popup';
    document.body.appendChild(popup);
    activePopup = popup;

    function renderGrid() {
      const y = viewDate.getFullYear();
      const m = viewDate.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const firstWeekday = new Date(y, m, 1).getDay();
      const prevMonthDays = new Date(y, m, 0).getDate();

      let cells = '';
      for (let i = 0; i < firstWeekday; i++) {
        const dayNum = prevMonthDays - firstWeekday + 1 + i;
        const d = new Date(y, m - 1, dayNum);
        cells += cellHtml(d, true);
      }
      for (let day = 1; day <= daysInMonth; day++) {
        cells += cellHtml(new Date(y, m, day), false);
      }
      const totalCells = firstWeekday + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      for (let i = 1; i <= trailing; i++) {
        cells += cellHtml(new Date(y, m + 1, i), true);
      }

      popup.innerHTML = `
        <div class="mcp-header">
          <button type="button" class="mcp-nav-btn" data-nav="-1" aria-label="Tháng trước"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
          <span class="mcp-month-label">${DateUtils.MONTH_NAMES_FULL[m][0].toUpperCase() + DateUtils.MONTH_NAMES_FULL[m].slice(1)}, ${y}</span>
          <button type="button" class="mcp-nav-btn" data-nav="1" aria-label="Tháng sau"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        </div>
        <div class="mcp-weekday-row">
          <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
        </div>
        <div class="mcp-grid">${cells}</div>
        <button type="button" class="mcp-today-btn">Hôm nay</button>
      `;

      popup.querySelectorAll('.mcp-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          viewDate = new Date(y, m + parseInt(btn.dataset.nav, 10), 1);
          renderGrid();
        });
      });
      popup.querySelectorAll('.mcp-cell[data-date]').forEach(cell => {
        const d = DateUtils.parseDateStr(cell.dataset.date);
        cell.addEventListener('click', () => {
          onSelect(d);
          closeActive();
        });
        if (mode === 'week') {
          cell.addEventListener('mouseenter', () => {
            hoveredWeekStart = startOfWeek(d);
            highlightWeek();
          });
        }
      });
      if (mode === 'week') {
        popup.addEventListener('mouseleave', () => {
          hoveredWeekStart = null;
          highlightWeek();
        });
      }
      popup.querySelector('.mcp-today-btn').addEventListener('click', () => {
        onSelect(new Date());
        closeActive();
      });
    }

    function highlightWeek() {
      popup.querySelectorAll('.mcp-cell[data-date]').forEach(cell => {
        const d = DateUtils.parseDateStr(cell.dataset.date);
        const inHoveredWeek = hoveredWeekStart && startOfWeek(d).getTime() === hoveredWeekStart.getTime();
        cell.classList.toggle('mcp-week-hover', !!inHoveredWeek);
      });
    }

    function cellHtml(d, isAdjacent) {
      const key = DateUtils.dateKey(d);
      const isToday = sameDay(d, today);
      const isSelected = sameDay(d, initialDate);
      const lunar = lunarShort(d);
      const cls = ['mcp-cell'];
      if (isAdjacent) cls.push('mcp-cell-adjacent');
      if (isToday) cls.push('mcp-cell-today');
      if (isSelected) cls.push('mcp-cell-selected');
      return `<button type="button" class="${cls.join(' ')}" data-date="${key}">
        <span class="mcp-cell-num">${d.getDate()}</span>
        <span class="mcp-cell-lunar">${lunar}</span>
      </button>`;
    }

    renderGrid();
    // Căn GIỮA MÀN HÌNH tuyệt đối bằng CSS (position: fixed + transform,
    // xem .mcp-popup trong CSS) — không còn định vị theo anchorEl như
    // trước (dropdown ngay dưới nút bấm, hay bị lệch/tràn ra ngoài
    // viewport khi anchor nằm gần mép, đã báo lại kèm ảnh chụp lệch
    // hẳn sang phải). Cùng cách tiếp cận đã dùng cho .cal-switcher-
    // vertical (css/views/year.css) — đơn giản, ổn định, không phụ
    // thuộc phép đo JS nào.

    // Đóng khi click ra ngoài popup, hoặc nhấn Esc — hành vi popup
    // chuẩn, tránh popup "dính" lại màn hình gây khó chịu.
    //
    // BUG ĐÃ GẶP: dùng thẳng e.target trong listener 'click' trên
    // document rất dễ vỡ ở đây, vì các nút điều hướng tháng bên trong
    // popup gọi renderGrid() → popup.innerHTML = ... ngay trong handler
    // click của chính chúng. Lúc sự kiện click đó nổi bọt tới listener
    // trên document (chạy SAU khi handler nội bộ đã xong), DOM node
    // gốc của e.target đã bị gỡ khỏi cây DOM (bị innerHTML thay thế) —
    // popup.contains(e.target) khi đó luôn trả về false dù người dùng
    // rõ ràng đang bấm bên trong popup, khiến popup tự đóng ngay sau
    // mỗi lần bấm nút điều hướng. Dùng e.composedPath() thay vì
    // e.target: composedPath() được "chụp" tại thời điểm sự kiện phát
    // sinh (trước khi renderGrid() kịp chạy), nên vẫn phản ánh đúng
    // cây DOM lúc bấm, không bị ảnh hưởng bởi việc DOM đổi sau đó.
    function onDocClick(e) {
      const path = e.composedPath();
      if (!path.includes(popup) && !path.includes(anchorEl)) closeActive();
    }
    function onKeydown(e) {
      if (e.key === 'Escape') closeActive();
    }
    // setTimeout 0: tránh chính cú click MỞ popup (đang nổi bọt lên
    // document ngay lúc này) bị onDocClick bắt luôn và đóng lại tức thì.
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
    document.addEventListener('keydown', onKeydown);

    activeCleanup = () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeydown);
      popup.remove();
      backdrop.remove();
    };
  }

  return { open, close: closeActive };
})();
