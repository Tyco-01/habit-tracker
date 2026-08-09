// ============================================================
// day-preview-sheet.js — Bottom sheet xem nhanh + chỉnh nhanh 1 ngày,
// mở bằng NHẤN GIỮ (long-press) lên bất kỳ ô ngày nào trong màn Lịch
// (mode Ngày/Tuần/Tháng/Năm — mọi ô đều có [data-date], xem year.js).
//
// Mục đích: click thường vẫn mở thẳng day-detail (hành vi cũ, giữ
// nguyên) — long-press là lối tắt THỨ HAI, không cần rời trang lịch
// vẫn tick việc / đọc-sửa ghi chú / thêm dấu ấn cho 1 ngày, đỡ phải
// chuyển hẳn sang trang chi tiết cho việc lặt vặt.
//
// Tái dùng gần như nguyên xi 2 module đã có sẵn cho đúng dữ liệu:
//   - EventSection (event-section.js): khối "Sự kiện ngày" — y hệt
//     khối dùng ở day-detail.js, chỉ khác idPrefix để không đụng ID.
//   - HabitNotePanel (habit-note-panel.js): panel ghi chú từng habit,
//     mở xổ ngay dưới dòng habit khi bấm icon note.
// Phần danh sách habit + tick được viết lại RÚT GỌN so với
// day-detail.js (bỏ nút "sửa phạm vi áp dụng" và "xoá" — đây là sheet
// xem nhanh, không phải nơi quản lý cấu trúc habit; 2 hành động đó
// vẫn có ở trang chi tiết đầy đủ qua nút "Xem chi tiết đầy đủ").
//
// Cách dùng: DayPreviewSheet.open(dateStr, onOpenFull) — onOpenFull
// là callback khi bấm "Xem chi tiết đầy đủ" (app.js truyền openDay).
// ============================================================

const DayPreviewSheet = (() => {

  let overlayEl = null;
  let onChangeHandler = null;
  const EVENT_SECTION_PREFIX = 'day-preview-sheet';

  const CLOSE_ANIM_MS = 260; // khớp transition trong .day-preview-sheet-card (css/views/day-preview-sheet.css)

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'day-preview-sheet-overlay';
    overlayEl.style.display = 'none';
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function close() {
    const overlay = overlayEl;
    if (!overlay || overlay.style.display === 'none') return;
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown);
    if (onChangeHandler) {
      Sync.offChange(onChangeHandler);
      onChangeHandler = null;
    }
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }, CLOSE_ANIM_MS);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function drawHabitsList(container, dateStr) {
    const data = Sync.getData();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dObj = DateUtils.parseDateStr(dateStr);
    const isFutureDate = dObj > today;
    const scoped = isFutureDate ? [] : HabitScope.habitsForDate(dateStr, data);

    if (scoped.length === 0) {
      container.innerHTML = `<p class="day-preview-empty">${isFutureDate ? 'Ngày này chưa tới.' : 'Chưa có việc lặp lại nào cho ngày này.'}</p>`;
      return;
    }

    const { checks } = data;
    const doneCount = scoped.filter(h => checks[h.id] && checks[h.id][dateStr]).length;

    container.innerHTML = `
      <p class="section-label" style="margin:0 0 10px;">VIỆC LẶP LẠI<span class="section-label-count">${doneCount}/${scoped.length}</span></p>
      <div class="day-preview-habit-list">
        ${scoped.map(h => {
          const checked = !!(checks[h.id] && checks[h.id][dateStr]);
          const noteActive = HabitNotePanel.hasAnyNote(h.id, dateStr);
          return `
            <div class="day-toggle-row">
              <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${DomUtils.escapeHtml(h.name)}">
                ${checked ? '<i class="ti ti-check" style="font-size:12px;color:var(--card);" aria-hidden="true"></i>' : ''}
              </button>
              <span style="font-size:14px;flex:1;${checked ? 'color:var(--mute);text-decoration:line-through;' : ''}">${DomUtils.escapeHtml(h.name)}</span>
              <button class="note-btn ${noteActive ? 'note-btn-active' : ''}" data-note="${h.id}" aria-label="Ghi chú cho ${DomUtils.escapeHtml(h.name)}" title="Ghi chú">
                <i class="ti ti-note" style="font-size:14px;" aria-hidden="true"></i>
              </button>
            </div>
            <div class="habit-note-panel" id="day-preview-note-panel-${h.id}"></div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.check-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const { checks } = Sync.getData();
        const isChecked = !!(checks[btn.dataset.habit] && checks[btn.dataset.habit][dateStr]);
        Sync.setCheck(btn.dataset.habit, dateStr, !isChecked);
      });
    });

    container.querySelectorAll('[data-note]').forEach(btn => {
      btn.addEventListener('click', () => {
        const habitId = btn.dataset.note;
        const panel = container.querySelector(`#day-preview-note-panel-${habitId}`);
        if (!panel) return;
        const isOpen = panel.classList.contains('is-open');
        container.querySelectorAll('.habit-note-panel').forEach(p => p.classList.remove('is-open'));
        if (!isOpen) {
          panel.classList.add('is-open');
          HabitNotePanel.render(panel, habitId, dateStr);
        }
      });
    });
  }

  function open(dateStr, onOpenFull) {
    const overlay = ensureOverlay();
    const dObj = DateUtils.parseDateStr(dateStr);
    const label = DateUtils.formatFullLabel(dObj);
    const lunar = (() => { try { return LunarCalendar.fromSolar(dObj); } catch (e) { return null; } })();
    const isToday = DateUtils.isToday(dateStr);

    overlay.innerHTML = `
      <div class="day-preview-sheet-card" role="dialog" aria-modal="true" aria-labelledby="day-preview-sheet-title">
        <div class="day-preview-sheet-grabber" aria-hidden="true"></div>
        <div class="day-preview-sheet-header">
          <div class="day-preview-sheet-heading-col">
            <p class="day-preview-sheet-title" id="day-preview-sheet-title">${isToday ? 'Hôm nay' : DomUtils.escapeHtml(label)}</p>
            ${isToday ? `<p class="day-preview-sheet-date">${DomUtils.escapeHtml(label)}</p>` : ''}
            ${lunar ? `<p class="day-preview-sheet-lunar">Âm lịch: ${DomUtils.escapeHtml(lunar.fullLabel)}</p>` : ''}
          </div>
          <button type="button" class="day-preview-sheet-close" id="day-preview-sheet-close" aria-label="Đóng">
            <i class="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>
        <div class="day-preview-sheet-body">
          <div id="day-preview-habits"></div>
          <div id="day-preview-event-section" style="margin-top:20px;"></div>
        </div>
        <div class="day-preview-sheet-footer">
          <button type="button" class="day-preview-sheet-full-btn" id="day-preview-sheet-full-btn">
            Xem chi tiết đầy đủ <i class="ti ti-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `;
    overlay.style.display = 'flex';

    // requestAnimationFrame trước khi thêm .is-open — cùng lý do đã
    // giải thích kỹ ở confirm-modal.js: đảm bảo trình duyệt vẽ xong
    // trạng thái ban đầu (display:flex, chưa is-open) ở 1 frame riêng
    // trước khi đổi sang is-open ở frame kế tiếp, nếu không animation
    // trượt lên có thể bị gộp mất, nhảy thẳng luôn vào trạng thái cuối.
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
    });

    const habitsEl = overlay.querySelector('#day-preview-habits');
    drawHabitsList(habitsEl, dateStr);
    onChangeHandler = () => drawHabitsList(habitsEl, dateStr);
    Sync.onChange(onChangeHandler);

    EventSection.render(overlay.querySelector('#day-preview-event-section'), dateStr, { idPrefix: EVENT_SECTION_PREFIX, showHistory: false });

    overlay.querySelector('#day-preview-sheet-close').addEventListener('click', close);
    overlay.querySelector('#day-preview-sheet-full-btn').addEventListener('click', () => {
      close();
      if (typeof onOpenFull === 'function') onOpenFull(dateStr);
    });
    // Bấm ra vùng tối xung quanh = đóng, giống mọi overlay khác trong app.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKeydown);
  }

  return { open, close };
})();
