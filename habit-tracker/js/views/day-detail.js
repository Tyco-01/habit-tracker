// ============================================================
// views/day-detail.js — Màn chi tiết 1 ngày: việc lặp lại + sự kiện 1 lần.
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

  function daysBetween(a, b) {
    return Math.round((a - b) / 86400000);
  }

  function render(container, dateStr, onBack) {
    const dObj = parseDateStr(dateStr);
    const label = `${DAYS_VN[dObj.getDay()]}, ${dObj.getDate()} ${MONTH_NAMES[dObj.getMonth()]}`;

    function draw() {
      const { habits, checks, events } = Sync.getData();
      const total = habits.length;
      const dayEvents = events[dateStr] || [];

      let html = `
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
      `;

      if (total > 0) {
        html += `
          <p class="section-label">VIỆC LẶP LẠI</p>
          <div id="day-habits" style="margin-bottom:20px;"></div>
        `;
      }

      html += `
        <div class="section-header-row">
          <p class="section-label" style="margin:0;">SỰ KIỆN RIÊNG NGÀY NÀY</p>
          <button class="pill-btn" id="event-add-btn">
            <i class="ti ti-plus" style="font-size:12px;" aria-hidden="true"></i> Thêm
          </button>
        </div>
        <div class="input-row" id="event-input-row" style="display:none;">
          <input type="text" id="event-input" placeholder="ví dụ: cắt tóc" maxlength="60" />
          <button id="event-save">Lưu</button>
        </div>
        <div id="event-list"></div>
        <div id="event-history"></div>
      </div>
      `;

      container.innerHTML = html;

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
        if (titleEl) titleEl.textContent = 'Chưa có việc lặp lại nào';
      }

      const eventListEl = container.querySelector('#event-list');
      const eventHistoryEl = container.querySelector('#event-history');

      function drawEvents() {
        const { events } = Sync.getData();
        const evs = events[dateStr] || [];

        eventListEl.innerHTML = evs.length === 0
          ? `<p style="font-size:13px;color:var(--mute);margin:0;">Chưa có sự kiện nào cho ngày này.</p>`
          : evs.map(e => `
            <div class="event-row">
              <i class="ti ti-sparkles" style="font-size:15px;color:var(--ink);" aria-hidden="true"></i>
              <span class="event-name">${escapeHtml(e.name)}</span>
              <button class="event-remove" data-event="${e.id}" aria-label="Xoá ${escapeHtml(e.name)}">
                <i class="ti ti-x" style="font-size:14px;" aria-hidden="true"></i>
              </button>
            </div>
          `).join('');

        eventListEl.querySelectorAll('.event-remove').forEach(btn => {
          btn.addEventListener('click', () => {
            Sync.removeEvent(dateStr, btn.dataset.event);
          });
        });

        // Lịch sử theo tên sự kiện — tính khoảng cách giữa các lần
        eventHistoryEl.innerHTML = '';
        evs.forEach(ev => {
          const allEntries = [];
          Object.keys(events).forEach(k => {
            (events[k] || []).forEach(e => {
              if (e.name === ev.name) allEntries.push(k);
            });
          });
          const uniqueDates = [...new Set(allEntries)].sort();
          if (uniqueDates.length < 1) return;

          let rows = '';
          uniqueDates.forEach((k, i) => {
            const kd = parseDateStr(k);
            let gapText = 'lần đầu ghi nhận';
            if (i > 0) {
              const prevD = parseDateStr(uniqueDates[i - 1]);
              gapText = `cách lần trước ${daysBetween(kd, prevD)} ngày`;
            }
            const isCur = k === dateStr;
            rows += `
              <div class="history-row ${isCur ? 'current' : ''}">
                <span>${kd.getDate()} ${MONTH_NAMES[kd.getMonth()]}${isCur ? ' (đang xem)' : ''}</span>
                <span class="history-gap">${gapText}</span>
              </div>
            `;
          });
          eventHistoryEl.innerHTML += `<p class="section-label" style="margin-top:20px;">LỊCH SỬ "${escapeHtml(ev.name.toUpperCase())}"</p>${rows}`;
        });
      }
      drawEvents();
      Sync.onChange(drawEvents);

      const addBtn = container.querySelector('#event-add-btn');
      const addRow = container.querySelector('#event-input-row');
      const addInput = container.querySelector('#event-input');
      const addSave = container.querySelector('#event-save');

      addBtn.addEventListener('click', () => {
        const showing = addRow.style.display !== 'none';
        addRow.style.display = showing ? 'none' : 'flex';
        if (!showing) addInput.focus();
      });

      function submitEvent() {
        const name = addInput.value.trim();
        if (!name) return;
        Sync.addEvent(dateStr, name);
        addInput.value = '';
        addRow.style.display = 'none';
      }
      addSave.addEventListener('click', submitEvent);
      addInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitEvent(); });
    }

    draw();
  }

  return { render };
})();
