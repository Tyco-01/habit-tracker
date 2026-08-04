// ============================================================
// views/year.js — Màn "Cả năm": lưới theo tháng, chuyển qua lại năm.
// ============================================================

const YearView = (() => {

  let viewYear = new Date().getFullYear();
  let onDayClick = null;

  function countForDate(checks, habits, key) {
    return habits.filter(h => checks[h.id] && checks[h.id][key]).length;
  }

  // true nếu có bất kỳ habit nào mang ghi chú RIÊNG cho đúng ngày này
  // (không tính ghi chú "chung", vì ghi chú chung không gắn với 1
  // ngày cụ thể nào — hiện y hệt ở mọi ngày nên không cần đánh dấu).
  function hasNoteForDate(habitNotes, key) {
    return Object.values(habitNotes || {}).some(entry => !!(entry.byDate || {})[key]);
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

  function render(container, dayClickHandler, { focusToday = false } = {}) {
    onDayClick = dayClickHandler;
    if (focusToday) viewYear = new Date().getFullYear();

    container.innerHTML = `<div id="year-content"></div>`;
    const content = container.querySelector('#year-content');
    let lastYearHtml = null; // xem giải thích ở EventSection.drawEvents(), cùng cơ chế — quan trọng hơn cả ở đây vì draw() build cả lưới 365 ô + vòng lặp đếm mỗi lần gọi, tốn kém hơn hẳn các view khác

    function draw() {
      const { habits, checks, events, habitNotes } = Sync.getData();
      const today = new Date();
      const todayKey = DateUtils.dateKeyFromParts(today.getFullYear(), today.getMonth(), today.getDate());
      const total = habits.length;
      const isCurrentYear = viewYear === today.getFullYear();

      let fullDays = 0;
      if (total > 0) {
        const startOfView = new Date(viewYear, 0, 1);
        const endOfView = isCurrentYear ? today : new Date(viewYear, 11, 31);
        for (let d = new Date(startOfView); d <= endOfView; d.setDate(d.getDate() + 1)) {
          const key = DateUtils.dateKeyFromParts(d.getFullYear(), d.getMonth(), d.getDate());
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
        <div class="date-jump-row">
          <i class="ti ti-search" style="font-size:14px;color:var(--mute);" aria-hidden="true"></i>
          <input type="date" id="date-jump-input" class="date-jump-input" aria-label="Tìm đến ngày cụ thể" />
        </div>
      `;

      if (total === 0) {
        html += `<div class="empty-state"><p>Chưa có việc nào để hiển thị.</p></div>`;
        if (html === lastYearHtml) return;
        lastYearHtml = html;
        content.innerHTML = html;
        bindNav();
        bindDateJump();
        return;
      }

      // Luôn vẽ đủ 12 tháng — tháng chưa tới (của năm hiện tại) sẽ tự
      // hiện toàn ô mờ nhạt vì mọi ngày trong đó đều là "tương lai".
      html += `<div class="months-grid">`;
      for (let m = 0; m <= 11; m++) {
        const daysInMonth = new Date(viewYear, m + 1, 0).getDate();
        const isCurrentMonth = isCurrentYear && m === today.getMonth();
        const isFutureMonth = isCurrentYear && m > today.getMonth();
        const todayDate = today.getDate();

        const firstOfMonth = new Date(viewYear, m, 1);
        const firstWeekday = firstOfMonth.getDay(); // 0 = Chủ nhật ... 6 = Thứ 7

        let cells = '';
        // Ô trống cho các ngày trước ngày 1 (căn đúng vị trí thứ)
        for (let i = 0; i < firstWeekday; i++) {
          cells += `<div class="day-cell blank"></div>`;
        }
        for (let day = 1; day <= daysInMonth; day++) {
          const isFuture = isFutureMonth || (isCurrentMonth && day > todayDate);
          const key = DateUtils.dateKeyFromParts(viewYear, m, day);
          const hasEvent = !!(events[key] && events[key].length > 0);
          const hasNote = hasNoteForDate(habitNotes, key);
          const clipHtml = hasEvent ? `<i class="ti ti-paperclip event-clip" aria-hidden="true"></i>` : '';
          const noteMarkHtml = hasNote ? `<i class="ti ti-note note-mark" aria-hidden="true"></i>` : '';

          if (isFuture) {
            // Ngày chưa tới: không có việc lặp lại để hiện số, nhưng vẫn
            // bấm mở được — để có thể đặt trước dấu ấn 1 lần (vd hẹn khám).
            cells += `<div class="day-cell future-day" data-date="${key}">${clipHtml}${noteMarkHtml}<span class="day-number">${day}</span></div>`;
            continue;
          }
          const count = countForDate(checks, habits, key);
          const isToday = key === todayKey;
          cells += `<div class="day-cell ${cellClass(count, total)} ${count === 0 ? 'empty-day' : ''} ${isToday ? 'today' : ''}" data-date="${key}">${clipHtml}${noteMarkHtml}${count > 0 ? `<span class="day-progress">${count}</span>` : ''}<span class="day-number">${day}</span></div>`;
        }

        html += `
          <div class="month-block">
            <p class="month-label">${DateUtils.MONTHS_SHORT_GRID[m]}</p>
            <div class="weekday-row">
              <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
            </div>
            <div class="day-grid month-grid">${cells}</div>
          </div>
        `;
      }
      html += `</div>`;

      // Bỏ qua ghi lại nếu không đổi gì — build lưới 365 ô + vòng lặp
      // đếm fullDays ở trên chạy MỖI KHI Sync.onChange bắn, kể cả khi
      // đang xem tab khác hoặc thay đổi không liên quan gì tới lưới
      // ngày (vd gõ note 1 event ở tab "Hôm nay"). So sánh HTML trước
      // khi ghi tránh lãng phí, và tránh mất giá trị đang gõ dở trong
      // #date-jump-input nếu người dùng đang thao tác đúng lúc có thay
      // đổi khác xảy ra.
      if (html === lastYearHtml) return;
      lastYearHtml = html;
      content.innerHTML = html;

      content.querySelectorAll('.day-cell[data-date]').forEach(cell => {
        cell.addEventListener('click', () => {
          if (onDayClick) onDayClick(cell.dataset.date);
        });
      });

      bindNav();
      bindDateJump();

      if (focusToday && isCurrentYear) {
        requestAnimationFrame(() => {
          const todayCell = content.querySelector(`[data-date="${todayKey}"]`);
          todayCell?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        });
      }
    }

    // Cho phép gõ (hoặc chọn từ bộ lịch gốc của trình duyệt/hệ điều hành)
    // 1 ngày bất kỳ để nhảy thẳng tới đó — kể cả khác năm đang xem.
    function bindDateJump() {
      const input = content.querySelector('#date-jump-input');
      if (!input) return;
      input.addEventListener('change', () => {
        const value = input.value; // dạng "YYYY-MM-DD" chuẩn của input[type=date]
        if (!value) return;
        const [y] = value.split('-').map(Number);
        viewYear = y;
        draw();
        if (onDayClick) onDayClick(value);
      });
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

    // Gỡ listener của lần render() trước (nếu có) trước khi đăng ký cái
    // mới — render() được gọi lại mỗi khi người dùng chuyển sang tab
    // "Cả năm", nếu không gỡ thì listener cũ (trỏ DOM đã bị thay thế)
    // sẽ cộng dồn mãi, chạy draw() thừa nhiều lần mỗi khi data đổi.
    if (container.__yearOnChange) Sync.offChange(container.__yearOnChange);
    container.__yearOnChange = draw;
    Sync.onChange(draw);
    draw();
  }

  return { render };
})();
