// ============================================================
// habit-note-panel.js — UI ghi chú cho 1 habit, DÙNG CHUNG giữa màn
// "Hôm nay" và màn chi tiết 1 ngày (day-detail) — tách ra từ
// views/today.js để tránh viết lại 2 lần, đúng cách event-section.js
// đã làm cho phần "Sự kiện riêng ngày này".
//
// Mỗi habit có 2 loại ghi chú ĐỘC LẬP với nhau, không loại nào ghi
// đè loại kia:
//   - "Mọi ngày" (general): 1 nội dung DUY NHẤT, hiện giống hệt nhau
//     bất kể đang xem ngày nào. Dùng cho lưu ý bền vững (vd "nhớ giãn
//     cơ trước khi tập").
//   - "Hôm nay" / "Ngày này" (daily): nội dung RIÊNG cho đúng ngày
//     đang xem (theo dateStr truyền vào) — đổi ngày khác thì nội
//     dung khác, không lẫn nhau. Dùng cho ghi chép nhất thời.
//
// QUAN TRỌNG: tham số `dateStr` KHÔNG cố định là "hôm nay" — khi gọi
// từ views/day-detail.js, đây là ngày đang xem (có thể là quá khứ).
// Vì vậy nhãn hiển thị cũng đổi theo: "Hôm nay" nếu dateStr trùng
// ngày thật hiện tại, "Ngày này" nếu là ngày khác — để không gây
// hiểu lầm khi xem lại 1 ngày trong quá khứ.
// ============================================================

const HabitNotePanel = (() => {

  // Đọc dữ liệu ghi chú của 1 habit ứng với dateStr đang xem.
  function getNote(habitId, dateStr) {
    const { habitNotes } = Sync.getData();
    const entry = habitNotes[habitId];
    if (!entry) return { general: '', daily: '', hasGeneral: false, hasDaily: false };
    return {
      general: entry.general || '',
      daily: (entry.byDate || {})[dateStr] || '',
      hasGeneral: !!entry.general,
      hasDaily: !!(entry.byDate || {})[dateStr]
    };
  }

  // true nếu habit này có BẤT KỲ ghi chú nào (chung hoặc riêng ngày
  // đang xem) — dùng để tô đậm icon note trên dòng habit.
  function hasAnyNote(habitId, dateStr) {
    const note = getNote(habitId, dateStr);
    return note.hasDaily || note.hasGeneral;
  }

  // Nhãn ngắn hiện ngay cạnh icon note trên dòng habit (KHÔNG cần mở
  // panel mới biết đang có loại ghi chú nào) — điểm sửa chính so với
  // bản cũ, nơi icon không nói lên trạng thái gì cả.
  function noteHintHtml(habitId, dateStr) {
    const note = getNote(habitId, dateStr);
    const dayLabel = DateUtils.isToday(dateStr) ? 'hôm nay' : 'ngày này';
    if (note.hasGeneral && note.hasDaily) {
      return `<span class="note-hint"><i class="ti ti-notes" style="font-size:12px;" aria-hidden="true"></i>2 ghi chú</span>`;
    }
    if (note.hasGeneral) {
      return `<span class="note-hint"><i class="ti ti-repeat" style="font-size:12px;" aria-hidden="true"></i>ghi chú chung</span>`;
    }
    if (note.hasDaily) {
      return `<span class="note-hint"><i class="ti ti-calendar-event" style="font-size:12px;" aria-hidden="true"></i>ghi chú ${dayLabel}</span>`;
    }
    return `<span class="note-hint note-hint-empty">chưa có ghi chú</span>`;
  }

  // Vẽ nội dung panel vào `panel` (đã có sẵn trong DOM, ẩn/hiện do
  // nơi gọi quản lý). `dateStr`: ngày đang xem — "Hôm nay" (today.js)
  // hoặc 1 ngày cụ thể trong quá khứ (day-detail.js).
  function render(panel, habitId, dateStr) {
    let showingDaily = true;
    const dayLabel = DateUtils.isToday(dateStr) ? 'Hôm nay' : 'Ngày này';

    function draw() {
      const note = getNote(habitId, dateStr);
      const content = showingDaily ? note.daily : note.general;

      panel.innerHTML = `
        <div class="note-toggle-row">
          <button class="note-toggle ${showingDaily ? 'note-toggle-active' : ''}" id="note-mode-btn-${habitId}">
            <i class="ti ti-calendar-event" style="font-size:12px;" aria-hidden="true"></i>
            ${dayLabel}
          </button>
          <button class="note-toggle ${!showingDaily ? 'note-toggle-active' : ''}" id="note-mode-btn-general-${habitId}">
            <i class="ti ti-repeat" style="font-size:12px;" aria-hidden="true"></i>
            Mọi ngày
          </button>
        </div>
        <p class="note-toggle-caption">
          ${showingDaily
            ? `Chỉ hiện lại đúng ngày này — ngày khác sẽ trống, không ảnh hưởng ghi chú "Mọi ngày".`
            : `Hiện giống nhau ở mọi ngày cho việc này — dùng cho lưu ý lâu dài.`}
        </p>
        <textarea class="note-textarea" placeholder="${showingDaily ? `Ghi chú chỉ áp dụng cho ${dayLabel.toLowerCase()}...` : 'Ghi chú áp dụng cho mọi ngày...'}" maxlength="1000" rows="2">${DomUtils.escapeHtml(content)}</textarea>
      `;

      const dailyBtn = panel.querySelector(`#note-mode-btn-${habitId}`);
      const generalBtn = panel.querySelector(`#note-mode-btn-general-${habitId}`);
      const textarea = panel.querySelector('.note-textarea');

      dailyBtn.addEventListener('click', () => { showingDaily = true; draw(); });
      generalBtn.addEventListener('click', () => { showingDaily = false; draw(); });

      textarea.addEventListener('blur', () => {
        const newVal = textarea.value.trim();
        const dateArg = showingDaily ? dateStr : null;
        const currentVal = showingDaily ? note.daily : note.general;
        if (newVal !== currentVal) {
          Sync.setHabitNote(habitId, dateArg, newVal);
        }
      });
    }
    draw();
  }

  return { getNote, hasAnyNote, noteHintHtml, render };
})();
