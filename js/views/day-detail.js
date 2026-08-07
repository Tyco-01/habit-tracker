// ============================================================
// views/day-detail.js — Màn chi tiết 1 ngày: việc lặp lại + dấu ấn 1 lần.
// Phần "Dấu ấn" dùng chung với màn Hôm nay qua module EventSection.
//
// "VIỆC LẶP LẠI" của ngày này giờ lọc qua HabitScope (validFrom/
// archivedAt) thay vì liệt kê MỌI habit đang hoạt động — nếu không,
// 1 habit tạo sau ngày đang xem vẫn hiện ra như thể đã tồn tại từ lúc
// đó, sai lịch sử. Habit CHƯA áp dụng cho ngày này (tạo sau ngày đang
// xem) hiện ở khối phụ "Việc khác" bên dưới, có thể mở rộng phạm vi
// ngược về quá khứ qua HabitRangeModal nếu người dùng thật sự muốn
// tính nó cho ngày này (xem js/habit-range-modal.js).
// ============================================================

const DayDetailView = (() => {

  function render(container, dateStr, onBack) {
    const dObj = DateUtils.parseDateStr(dateStr);
    const label = DateUtils.formatFullLabel(dObj);
    const lunarLabel = LunarCalendar.formatFull(LunarCalendar.fromDateStr(dateStr));
    const data = Sync.getData();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDate = dObj > today;
    // Ngày tương lai: không có việc lặp lại nào áp dụng được (xem
    // ARCHITECTURE.md mục 8 — "tick trước ngày chưa tới là vô nghĩa"),
    // nên bỏ qua HabitScope hoàn toàn, giữ đúng hành vi cũ.
    const scopedHabits = isFutureDate ? [] : HabitScope.habitsForDate(dateStr, data);
    const notYetActive = isFutureDate ? [] : HabitScope.notYetActiveHabits(dateStr, data);
    const total = scopedHabits.length;

    container.innerHTML = `
      <div class="day-view">
        <div class="day-detail-header">
          <button class="back-btn" id="day-back" aria-label="Quay lại">
            <i class="ti ti-arrow-left" style="font-size:20px;" aria-hidden="true"></i>
          </button>
          <div class="day-detail-heading-row">
            <div class="day-detail-title-row">
              <h3 class="day-detail-title" id="day-title"></h3>
              <p class="day-detail-date">${label}</p>
            </div>
            <p class="day-detail-lunar"><i class="ti ti-moon-stars" aria-hidden="true"></i>${lunarLabel}</p>
          </div>
        </div>

        ${total > 0 ? `
        <p class="section-label">VIỆC LẶP LẠI<span class="section-label-count">${total}</span></p>
        <div id="day-habits" style="margin-bottom:20px;"></div>
        ` : ''}

        ${notYetActive.length > 0 ? `
        <div id="day-not-yet-active" style="margin-bottom:20px;"></div>
        ` : ''}

        <div id="event-section"></div>
      </div>
    `;

    container.querySelector('#day-back').addEventListener('click', onBack);

    // Gỡ listener của lần render() trước (nếu có) — render() gọi lại mỗi
    // khi mở 1 ngày khác từ "Cả năm". Đặt ở ĐẦU hàm (không chỉ trong
    // nhánh total > 0) vì ngày xem trước có thể có habit (đã đăng ký
    // listener) còn ngày xem sau thì không — vẫn phải gỡ listener cũ.
    if (container.__dayDetailOnChange) {
      Sync.offChange(container.__dayDetailOnChange);
      container.__dayDetailOnChange = null;
    }

    if (total > 0) {
      const titleEl = container.querySelector('#day-title');
      const habitsEl = container.querySelector('#day-habits');

      let lastHabitsHtml = null; // xem giải thích ở EventSection.drawEvents(), cùng cơ chế

      function drawHabits() {
        const data = Sync.getData();
        const { checks } = data;
        const scoped = HabitScope.habitsForDate(dateStr, data);
        const activeIds = new Set(data.habits.map(h => h.id));
        const doneCount = scoped.filter(h => checks[h.id] && checks[h.id][dateStr]).length;
        titleEl.textContent = `${doneCount}/${scoped.length} việc hoàn thành`;

        const html = scoped.map(h => {
          const checked = !!(checks[h.id] && checks[h.id][dateStr]);
          const noteActive = HabitNotePanel.hasAnyNote(h.id, dateStr);
          const isActive = activeIds.has(h.id);
          return `
            <div class="day-toggle-row ${isActive ? '' : 'day-toggle-row-archived'}">
              <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${DomUtils.escapeHtml(h.name)}">
                ${checked ? '<i class="ti ti-check" style="font-size:12px;color:var(--card);" aria-hidden="true"></i>' : ''}
              </button>
              <span style="font-size:14px;flex:1;${checked ? 'color:var(--mute);text-decoration:line-through;' : ''}">${DomUtils.escapeHtml(h.name)}${isActive ? '' : ' <span style="font-size:11px;color:var(--mute);">(đã xoá)</span>'}</span>
              ${HabitNotePanel.noteHintHtml(h.id, dateStr)}
              <button class="note-btn ${noteActive ? 'note-btn-active' : ''}" data-note="${h.id}" aria-label="Ghi chú cho ${DomUtils.escapeHtml(h.name)}" title="Ghi chú">
                <i class="ti ti-note" style="font-size:14px;" aria-hidden="true"></i>
              </button>
              ${isActive ? `
              <button class="range-btn" data-range="${h.id}" aria-label="Sửa phạm vi áp dụng của ${DomUtils.escapeHtml(h.name)}" title="Sửa phạm vi áp dụng">
                <i class="ti ti-calendar-time" style="font-size:14px;" aria-hidden="true"></i>
              </button>
              <button class="remove-btn" data-remove="${h.id}" aria-label="Xoá ${DomUtils.escapeHtml(h.name)}">
                <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
              </button>
              ` : ''}
            </div>
            <div class="habit-note-panel" id="day-detail-note-panel-${h.id}"></div>
          `;
        }).join('');

        // Bỏ qua ghi lại nếu không đổi gì — ngoài lợi ích hiệu năng, còn
        // khắc phục 1 bug ẩn: trước đây innerHTML ghi đè vô điều kiện
        // mỗi khi Sync.onChange bắn (kể cả do thay đổi không liên quan,
        // vd tick 1 habit khác), khiến panel ghi chú đang mở của 1 habit
        // bị ĐÓNG LẠI đột ngột (panel luôn render với display:none mặc
        // định). Giờ không ghi lại nếu không có gì đổi, panel giữ đúng
        // trạng thái đang mở.
        if (html === lastHabitsHtml) return;
        lastHabitsHtml = html;
        habitsEl.innerHTML = html;

        habitsEl.querySelectorAll('[data-note]').forEach(btn => {
          btn.addEventListener('click', () => {
            const habitId = btn.dataset.note;
            const panel = habitsEl.querySelector(`#day-detail-note-panel-${habitId}`);
            if (!panel) return;
            const isOpen = panel.classList.contains('is-open');
            habitsEl.querySelectorAll('.habit-note-panel').forEach(p => { p.classList.remove('is-open'); });
            if (!isOpen) {
              panel.classList.add('is-open');
              HabitNotePanel.render(panel, habitId, dateStr);
            }
          });
        });

        habitsEl.querySelectorAll('.check-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const { checks } = Sync.getData();
            const isChecked = !!(checks[btn.dataset.habit] && checks[btn.dataset.habit][dateStr]);
            Sync.setCheck(btn.dataset.habit, dateStr, !isChecked);
          });
        });

        habitsEl.querySelectorAll('[data-range]').forEach(btn => {
          btn.addEventListener('click', () => {
            const { habits } = Sync.getData();
            const habit = habits.find(h => h.id === btn.dataset.range);
            // onDone: sau khi modal commit xong (validFrom đổi), render()
            // lại TOÀN BỘ màn chi tiết ngày — cần thiết vì tổng/scoped
            // list có thể đổi theo cách drawHabits() bên trong (chỉ gắn
            // Sync.onChange khi total > 0 lúc render ban đầu) không tự
            // bắt được, ví dụ khi total đang là 0 (chưa có habit nào áp
            // dụng ngày này) mà modal vừa làm nó > 0.
            if (habit) HabitRangeModal.open(habit, dateStr, () => render(container, dateStr, onBack));
          });
        });

        habitsEl.querySelectorAll('[data-remove]').forEach(btn => {
          btn.addEventListener('click', () => {
            const { habits } = Sync.getData();
            const habit = habits.find(h => h.id === btn.dataset.remove);
            if (!habit) return;
            // onDone: render() lại toàn bộ màn (cùng lý do đã giải
            // thích ở nút [data-range] phía trên — total/scoped có thể
            // đổi theo cách drawHabits() không tự bắt được hết, ví dụ
            // xoá NỐT habit cuối cùng của ngày này).
            HabitRangeModal.confirmDelete(habit, () => render(container, dateStr, onBack));
          });
        });
      }
      drawHabits();
      container.__dayDetailOnChange = drawHabits;
      Sync.onChange(drawHabits);
    } else {
      const titleEl = container.querySelector('#day-title');
      if (titleEl) {
        titleEl.textContent = isFutureDate
          ? 'Ngày này chưa tới'
          : 'Chưa có việc lặp lại nào';
      }
    }

    // Khối "Việc khác" — habit ĐANG hoạt động nhưng tạo SAU ngày đang
    // xem, nên chưa được tính vào tổng của ngày này. Hiện mờ/phụ để
    // không lẫn với danh sách chính, kèm nút mở rộng phạm vi ngược nếu
    // người dùng thật sự muốn tính nó cho ngày này (vd nhớ ra hôm đó
    // cũng đã làm việc này, dù lúc đó chưa thêm vào app).
    if (notYetActive.length > 0) {
      const notYetEl = container.querySelector('#day-not-yet-active');
      notYetEl.innerHTML = `
        <p class="section-label" style="background:transparent;color:var(--mute);border:1px solid var(--line);">VIỆC KHÁC (áp dụng từ ngày sau)<span class="section-label-count" style="background:var(--line);color:var(--mute);">${notYetActive.length}</span></p>
        ${notYetActive.map(h => `
          <div class="day-toggle-row day-toggle-row-ghost">
            <span style="font-size:14px;flex:1;color:var(--mute);">${DomUtils.escapeHtml(h.name)}</span>
            <button class="pill-btn" data-extend="${h.id}">Áp dụng cho ngày này</button>
          </div>
        `).join('')}
      `;
      notYetEl.querySelectorAll('[data-extend]').forEach(btn => {
        btn.addEventListener('click', () => {
          const { habits } = Sync.getData();
          const habit = habits.find(h => h.id === btn.dataset.extend);
          if (habit) HabitRangeModal.open(habit, dateStr, () => render(container, dateStr, onBack));
        });
      });
    }

    EventSection.render(container.querySelector('#event-section'), dateStr, { idPrefix: 'day-detail', showHistory: true });
  }

  return { render };
})();
