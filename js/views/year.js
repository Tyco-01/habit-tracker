// ============================================================
// views/year.js — Màn "Cả năm": lưới theo tháng, chuyển qua lại năm.
// ============================================================

const YearView = (() => {

  const MONTHS_SHORT = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];

  let viewYear = new Date().getFullYear();
  let onDayClick = null;

  function dateKey(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function countForDate(checks, habits, key) {
    return habits.filter(h => checks[h.id] && checks[h.id][key]).length;
  }

  function earliestDataYear(checks, events) {
    const years = [];
    Object.values(checks).forEach(datesObj => {
      Object.keys(datesObj).forEach(k => years.push(parseInt(k.split('-')[0], 10)));
    });
    Object.keys(events).forEach(k => years.push(parseInt(k.split('-')[0], 10)));
    if (years.length === 0) return new Date().getFullYear();
    return Math.min(...years, new Date().getFullYear());
  }

  function cellClass(count, total) {
    if (count === 0) return '';
    if (total > 0 && count >= total) return 'full';
    return 'partial';
  }

  function render(container, dayClickHandler) {
    onDayClick = dayClickHandler;

    container.innerHTML = `<div id="year-content"></div>`;
    const content = container.querySelector('#year-content');

    function draw() {
      const { habits, checks, events } = Sync.getData();
      const today = new Date();
      const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
      const total = habits.length;
      const isCurrentYear = viewYear === today.getFullYear();
      const lastMonth = isCurrentYear ? today.getMonth() : 11;

      let fullDays = 0;
      if (total > 0) {
        const startOfView = new Date(viewYear, 0, 1);
        const endOfView = isCurrentYear ? today : new Date(viewYear, 11, 31);
        for (let d = new Date(startOfView); d <= endOfView; d.setDate(d.getDate() + 1)) {
          const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
          if (countForDate(checks, habits, key) === total) fullDays++;
        }
      }

      const minYear = earliestDataYear(checks, events);
      const canGoBack = viewYear > minYear;
      const canGoForward = viewYear < today.getFullYear();

      let html = `
        <div class="year-header">
          <div class="year-nav">
            <button id="year-prev" aria-label="Năm trước" ${canGoBack ? '' : 'disabled'}>
              <i class="ti ti-chevron-left" style="font-size:18px;" aria-hidden="true"></i>
            </button>
            <h3 class="year-label">${viewYear}</h3>
            <button id="year-next" aria-label="Năm sau" ${canGoForward ? '' : 'disabled'}>
              <i class="ti ti-chevron-right" style="font-size:18px;" aria-hidden="true"></i>
            </button>
          </div>
          <span class="year-count">${total > 0 ? fullDays + ' ngày hoàn thành đủ' : ''}</span>
        </div>
      `;

      if (total === 0) {
        html += `<div class="empty-state"><p>Chưa có việc nào để hiển thị.</p></div>`;
        content.innerHTML = html;
        bindNav();
        return;
      }

      html += `<div class="months-scroll">`;
      for (let m = 0; m <= lastMonth; m++) {
        const daysInMonth = new Date(viewYear, m + 1, 0).getDate();
        const isCurrentMonth = isCurrentYear && m === today.getMonth();
        const todayDate = today.getDate();

        const firstOfMonth = new Date(viewYear, m, 1);
        const firstWeekday = firstOfMonth.getDay(); // 0 = Chủ nhật ... 6 = Thứ 7

        let cells = '';
        // Ô trống cho các ngày trước ngày 1 (căn đúng vị trí thứ)
        for (let i = 0; i < firstWeekday; i++) {
          cells += `<div class="day-cell blank"></div>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
          const isFuture = isCurrentMonth && day > todayDate;
          if (isFuture) {
            // Ngày chưa tới: hiện số mờ nhạt, không thể bấm/tick
            cells += `<div class="day-cell future-day">${day}</div>`;
            continue;
          }
          const key = dateKey(viewYear, m, day);
          const count = countForDate(checks, habits, key);
          const isToday = key === todayKey;
          cells += `<div class="day-cell ${cellClass(count, total)} ${isToday ? 'today' : ''}" data-date="${key}">${count > 0 ? count : ''}</div>`;
        }

        html += `
          <div class="month-block ${m < lastMonth ? 'with-border' : ''}">
            <p class="month-label">${MONTHS_SHORT[m]}</p>
            <div class="weekday-row">
              <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
            </div>
            <div class="day-grid month-grid">${cells}</div>
          </div>
        `;
      }
      html += `</div>`;

      content.innerHTML = html;

      content.querySelectorAll('.day-cell[data-date]').forEach(cell => {
        cell.addEventListener('click', () => {
          if (onDayClick) onDayClick(cell.dataset.date);
        });
      });

      bindNav();
    }

    function bindNav() {
      const prevBtn = content.querySelector('#year-prev');
      const nextBtn = content.querySelector('#year-next');
      if (prevBtn) prevBtn.addEventListener('click', () => {
        if (prevBtn.disabled) return;
        viewYear--;
        draw();
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        if (nextBtn.disabled) return;
        viewYear++;
        draw();
      });
    }

    Sync.onChange(draw);
    draw();
  }

  return { render };
})();
