// ============================================================
// views/day-detail.js — Màn chi tiết 1 ngày: việc lặp lại + sự kiện 1 lần.
// Phần "Sự kiện" dùng chung với màn Hôm nay qua module EventSection.
// ============================================================

const DayDetailView = (() => {

  const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const MONTH_NAMES = ['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6','tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function parseDateStr(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function render(container, dateStr, onBack) {
    const dObj = parseDateStr(dateStr);
    const label = `${DAYS_VN[dObj.getDay()]}, ${dObj.getDate()} ${MONTH_NAMES[dObj.getMonth()]}`;
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
          <div>
            <p class="day-detail-date">${label}</p>
            <h3 class="day-detail-title" id="day-title"></h3>
          </div>
        </div>

        ${total > 0 ? `
        <p class="section-label">VIỆC LẶP LẠI</p>
        <div id="day-habits" style="margin-bottom:20px;"></div>
        ` : ''}

        <div id="event-section"></div>
      </div>
    `;

    container.querySelector('#day-back').addEventListener('click', onBack);

    if (total > 0) {
      const titleEl = container.querySelector('#day-title');
      const habitsEl = container.querySelector('#day-habits');

      function drawHabits() {
        const { habits, checks } = Sync.getData();
        const doneCount = habits.filter(h => checks[h.id] && checks[h.id][dateStr]).length;
        titleEl.textContent = `${doneCount}/${habits.length} việc hoàn thành`;

        habitsEl.innerHTML = habits.map(h => {
          const checked = !!(checks[h.id] && checks[h.id][dateStr]);
          return `
            <div class="day-toggle-row">
              <button class="toggle-btn ${checked ? 'checked' : ''}" data-habit="${h.id}">
                ${checked ? '<i class="ti ti-check" style="font-size:12px;color:var(--card);" aria-hidden="true"></i>' : ''}
              </button>
              <span style="font-size:14px;${checked ? 'color:var(--mute);text-decoration:line-through;' : ''}">${escapeHtml(h.name)}</span>
            </div>
          `;
        }).join('');

        habitsEl.querySelectorAll('.toggle-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const { checks } = Sync.getData();
            const isChecked = !!(checks[btn.dataset.habit] && checks[btn.dataset.habit][dateStr]);
            Sync.setCheck(btn.dataset.habit, dateStr, !isChecked);
          });
        });
      }
      drawHabits();
      Sync.onChange(drawHabits);
    } else {
      const titleEl = container.querySelector('#day-title');
      if (titleEl) {
        titleEl.textContent = isFutureDate
          ? 'Ngày này chưa tới'
          : 'Chưa có việc lặp lại nào';
      }
    }

    EventSection.render(container.querySelector('#event-section'), dateStr, { idPrefix: 'day-detail', withHistory: true });
  }

  return { render };
})();
