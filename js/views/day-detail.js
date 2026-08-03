// ============================================================
// views/day-detail.js — Màn chi tiết 1 ngày: việc lặp lại + dấu ấn 1 lần.
// Phần "Dấu ấn" dùng chung với màn Hôm nay qua module EventSection.
// ============================================================

const DayDetailView = (() => {

  function render(container, dateStr, onBack) {
    const dObj = DateUtils.parseDateStr(dateStr);
    const label = DateUtils.formatFullLabel(dObj);
    const { habits } = Sync.getData();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDate = dObj > today;
    const total = isFutureDate ? 0 : habits.length;

    container.innerHTML = `
      <div class="day-view">
        <div class="day-detail-header">
          <button class="back-btn" id="day-back" aria-label="Quay lại">
            <i class="ti ti-arrow-left" style="font-size:20px;" aria-hidden="true"></i>
          </button>
          <div class="day-detail-heading-row">
            <h3 class="day-detail-title" id="day-title"></h3>
            <p class="day-detail-date">${label}</p>
          </div>
        </div>

        ${total > 0 ? `
        <p class="section-label">VIỆC LẶP LẠI<span class="section-label-count">${habits.length}</span></p>
        <div id="day-habits" style="margin-bottom:20px;"></div>
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
        const { habits, checks } = Sync.getData();
        const doneCount = habits.filter(h => checks[h.id] && checks[h.id][dateStr]).length;
        titleEl.textContent = `${doneCount}/${habits.length} việc hoàn thành`;

        const html = habits.map(h => {
          const checked = !!(checks[h.id] && checks[h.id][dateStr]);
          const noteActive = HabitNotePanel.hasAnyNote(h.id, dateStr);
          return `
            <div class="day-toggle-row">
              <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${DomUtils.escapeHtml(h.name)}">
                ${checked ? '<i class="ti ti-check" style="font-size:12px;color:var(--card);" aria-hidden="true"></i>' : ''}
              </button>
              <span style="font-size:14px;flex:1;${checked ? 'color:var(--mute);text-decoration:line-through;' : ''}">${DomUtils.escapeHtml(h.name)}</span>
              ${HabitNotePanel.noteHintHtml(h.id, dateStr)}
              <button class="note-btn ${noteActive ? 'note-btn-active' : ''}" data-note="${h.id}" aria-label="Ghi chú cho ${DomUtils.escapeHtml(h.name)}" title="Ghi chú">
                <i class="ti ti-note" style="font-size:14px;" aria-hidden="true"></i>
              </button>
              <button class="remove-btn" data-remove="${h.id}" aria-label="Xoá ${DomUtils.escapeHtml(h.name)}">
                <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
              </button>
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

        habitsEl.querySelectorAll('[data-remove]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const { habits } = Sync.getData();
            const habit = habits.find(h => h.id === btn.dataset.remove);
            const name = habit ? habit.name : 'việc này';
            const ok = await ConfirmModal.show({
              title: `Chuyển "${name}" vào thùng rác?`,
              body: 'Việc sẽ được giữ 30 ngày trong thùng rác trước khi xoá hẳn. Nếu đây là việc cha, các việc con của nó sẽ được tách ra thành việc độc lập.',
              confirmLabel: 'Chuyển vào thùng rác'
            });
            if (!ok) return;
            Sync.removeHabit(btn.dataset.remove);
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

    EventSection.render(container.querySelector('#event-section'), dateStr, { idPrefix: 'day-detail', showHistory: true });
  }

  return { render };
})();
