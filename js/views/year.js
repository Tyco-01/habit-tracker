// ============================================================
// views/year.js — Màn lịch: 4 chế độ xem Ngày / Tuần / Tháng / Năm,
// chuyển đổi qua thanh segmented control (giống macOS Calendar).
//
// Vẫn giữ tên global YearView (không đổi tên module) để app.js và
// day-detail.js không phải sửa lại lời gọi — chỉ nội dung bên trong
// giờ tự vẽ đúng theo `mode` đang chọn. Cả 4 chế độ dùng chung 1 mốc
// điều hướng `anchor` (Date đang neo):
//   - "day"   → đúng ngày anchor
//   - "week"  → tuần chứa anchor (bắt đầu Chủ nhật, khớp cột CN..T7
//     đã dùng ở view Năm cũ)
//   - "month" → tháng chứa anchor (lưới 7 cột, có ô mờ đệm đầu/cuối
//     tháng để giữ đúng cột thứ — quen thuộc kiểu lịch để bàn)
//   - "year"  → năm chứa anchor (12 khối tháng, giữ nguyên hành vi cũ)
//
// Âm lịch: LunarCalendar.fromSolar(Date) → {day, month, leap,
// shortLabel, fullLabel, canChiYear} (xem js/lunar-calendar.js).
// Ở lưới (Tuần/Tháng/Năm) chỉ hiện shortLabel (gọn, không rối mắt);
// khi mở chi tiết 1 ngày cụ thể hiện fullLabel + canChiYear (đầy đủ).
// ============================================================

const YearView = (() => {

  const MODES = ['day', 'week', 'month', 'year'];
  const MODE_LABEL = { day: 'Ngày', week: 'Tuần', month: 'Tháng', year: 'Năm' };

  let mode = 'month';
  let anchor = new Date(); // mốc ngày đang neo cho mode day/week/month
  let viewYear = new Date().getFullYear(); // mốc năm riêng cho mode year (giữ hành vi cũ: chỉ đi lùi tới năm có dữ liệu, không đi tới tương lai)
  let onDayClick = null;

  // ---------- Helpers dữ liệu (dùng chung mọi mode) ----------

  // scopedHabits = danh sách habit ĐÃ LỌC theo HabitScope cho đúng
  // ngày `key` (không còn dùng habits.length cố định — xem
  // js/habit-scope.js để biết vì sao: bug "thêm việc mới làm tụt màu
  // ngày cũ").
  function countForDate(checks, scopedHabits, key) {
    return scopedHabits.filter(h => checks[h.id] && checks[h.id][key]).length;
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

  // Nhãn âm lịch gọn cho 1 ô ngày trong lưới — trả về chuỗi rỗng nếu
  // vì lý do nào đó tính toán lỗi (không để crash cả lưới vì 1 ngày lỗi).
  function lunarShort(dateObj) {
    try {
      return LunarCalendar.fromSolar(dateObj).shortLabel;
    } catch (e) {
      return '';
    }
  }

  // Chủ nhật của tuần chứa dateObj (không sửa dateObj gốc).
  function startOfWeek(dateObj) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // ---------- Render chính ----------

  function render(container, dayClickHandler, { focusToday = false } = {}) {
    onDayClick = dayClickHandler;
    // pendingScrollToToday: cờ DÙNG 1 LẦN RỒI TẮT — khác focusToday (tham
    // số đầu vào cố định của lần gọi render() này). Nếu dùng thẳng
    // focusToday để quyết định "có nên scroll ở lần draw() này không",
    // mọi lần draw() sau (đổi mode qua lại, tick 1 habit khác khiến
    // Sync.onChange bắn) đều bị coi là "vẫn cần scroll" vì focusToday
    // không tự tắt — cuộn lại về hôm nay ngoài ý muốn người dùng mỗi khi
    // có bất kỳ thay đổi dữ liệu nào. Bật lại đúng 1 lần nữa khi bấm nút
    // "Hôm nay" (xem bindNavCommon).
    let pendingScrollToToday = focusToday;
    if (focusToday) {
      anchor = new Date();
      viewYear = new Date().getFullYear();
    }

    // .cal-switch-pill: 1 khối nền ĐỘC LẬP, absolute, TRƯỢT mượt bằng
    // transform giữa các nút thay vì mỗi nút tự đổi background rời rạc
    // (bản trước: nút active tự tô nền, nút rời active tự bỏ nền —
    // không có cảm giác "1 khối duy nhất di chuyển" mà là 2 sự kiện
    // xảy ra tách biệt cùng lúc). Nút giờ luôn trong suốt
    // (.cal-switch-btn không tự tô nền nữa, xem CSS) — pill nằm DƯỚI
    // (z-index thấp hơn) và đổi vị trí/kích thước bằng
    // syncPillPosition() mỗi khi mode đổi, xem hàm đó bên dưới.
    container.innerHTML = `
      <div class="cal-switcher cal-switcher-vertical" role="tablist" aria-label="Chọn chế độ xem lịch">
        <div class="cal-switch-pill" aria-hidden="true"></div>
        ${MODES.map(m => `<button class="cal-switch-btn ${m === mode ? 'active' : ''}" data-mode="${m}" role="tab" aria-selected="${m === mode}">${MODE_LABEL[m]}</button>`).join('')}
      </div>
      <div id="year-content"></div>
    `;
    const switcher = container.querySelector('.cal-switcher');
    const pill = container.querySelector('.cal-switch-pill');

    const content = container.querySelector('#year-content');
    let lastHtml = null; // xem giải thích ở EventSection.drawEvents(), cùng cơ chế — quan trọng hơn cả ở đây vì mode "year" build cả lưới 365 ô + vòng lặp đếm mỗi lần gọi, tốn kém hơn hẳn mode khác

    // Đo lại vị trí/kích thước nút đang active THẬT SỰ (offsetTop/
    // offsetHeight) rồi áp vào pill bằng transform TRỤC DỌC —
    // .cal-switcher giờ là CỘT DỌC (4 nút chồng lên nhau, xem
    // .cal-switcher-vertical trong CSS), nên pill trượt theo Y thay vì
    // X như bản hàng ngang cũ. Không hardcode % theo index vì 4 nhãn
    // "Ngày/Tuần/Tháng/Năm" có thể cao khác nhau tuỳ font-rendering.
    function syncPillPosition(withAnimation) {
      const activeBtn = switcher.querySelector('.cal-switch-btn.active');
      if (!activeBtn || !pill) return;
      if (!withAnimation) pill.classList.add('cal-switch-pill-no-anim');
      pill.style.height = `${activeBtn.offsetHeight}px`;
      pill.style.transform = `translateY(${activeBtn.offsetTop}px)`;
      if (!withAnimation) {
        // eslint-disable-next-line no-unused-expressions
        pill.offsetHeight; // ép reflow đồng bộ
        pill.classList.remove('cal-switch-pill-no-anim');
      }
    }

    // Cột dọc Ngày/Tuần/Tháng/Năm nổi CỐ ĐỊNH GIỮA MÀN HÌNH (position:
    // fixed, căn giữa bằng CSS thuần qua .cal-switcher-vertical), đè
    // lên nội dung lịch phía sau như 1 popup — không cuộn theo trang.

    // switchMode() tách riêng khỏi listener click — vuốt DỌC trên
    // .cal-switcher (SwipeNavVertical.bind, gắn ở dưới cùng file) và
    // nút bấm đều gọi chung 1 hàm này, tránh viết trùng logic đổi mode + animation
    // pill + vẽ lại 2 nơi.
    function switchMode(newMode) {
      if (newMode === mode || !MODES.includes(newMode)) return;
      mode = newMode;
      switcher.querySelectorAll('.cal-switch-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
        b.setAttribute('aria-selected', b.dataset.mode === mode ? 'true' : 'false');
      });
      syncPillPosition(true);
      lastHtml = null; // đổi mode luôn phải vẽ lại, kể cả nếu HTML mode mới trùng tình cờ với mode cũ
      draw();
    }

    switcher.querySelectorAll('.cal-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Vuốt DỌC TRÊN CHÍNH cột switcher (không phải trên vùng nội dung
    // lịch bên cạnh — 2 vùng DOM tách biệt hoàn toàn, không đụng độ
    // với việc cuộn xem tháng dài, xem .cal-switcher-vertical trong
    // CSS: position:fixed, khoanh vùng RIÊNG bên trái màn hình): kéo
    // XUỐNG = mode kế tiếp, kéo LÊN = mode trước đó, theo đúng thứ tự
    // MODES (Ngày→Tuần→Tháng→Năm) — khớp cảm giác "cuộn xuống 1 danh
    // sách dọc" tự nhiên hơn so với bản kéo ngang cũ.
    //
    // KHÔNG transform CHÍNH switcher trong lúc kéo bằng cách gán trực
    // tiếp translateY lên .cal-switcher — switcher giờ position:fixed
    // (không phải sticky nữa), animate pill bên trong đã đủ truyền đạt
    // "đang đổi mode", không cần thêm hiệu ứng kéo-theo-tay ở bản thân
    // khung ngoài.
    SwipeNavVertical.bind(switcher, {
      onLockVertical: () => {
        const idx = MODES.indexOf(mode);
        if (idx < MODES.length - 1) SwipeHint.show(MODE_LABEL[MODES[idx + 1]]);
      },
      onDrag: (dy) => {
        const idx = MODES.indexOf(mode);
        const nextIdx = dy > 0 ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < MODES.length) SwipeHint.show(MODE_LABEL[MODES[nextIdx]]);
        else SwipeHint.hide(); // đã ở đầu/cuối (vd đang xem "Ngày" mà kéo lên) — không có đích, ẩn hint
      },
      onCommit: (dir) => {
        const idx = MODES.indexOf(mode);
        const nextIdx = dir === 1 ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < MODES.length) switchMode(MODES[nextIdx]);
      },
      onSettle: () => SwipeHint.hide(),
      onCancel: () => SwipeHint.hide()
    });


    // Vị trí pill ban đầu (không animation) NGAY SAU KHI DOM đã có
    // kích thước thật — offsetWidth/offsetLeft chỉ đúng SAU 1 lần
    // layout, requestAnimationFrame đảm bảo trình duyệt đã tính layout
    // xong trước khi ta đọc.
    requestAnimationFrame(() => syncPillPosition(false));

    // Kích thước nút có thể đổi khi xoay màn hình / đổi cỡ cửa sổ
    // (responsive) — đo lại pill KHÔNG animation mỗi lần đó, animation
    // chỉ dành riêng cho lúc NGƯỜI DÙNG chủ động đổi mode.
    if (!container.__switcherResizeObserver) {
      container.__switcherResizeObserver = new ResizeObserver(() => syncPillPosition(false));
      container.__switcherResizeObserver.observe(switcher);
    }

    // draw(pageDir) — pageDir: -1 (trang MỚI trượt vào từ TRÁI, dùng
    // khi lùi về trước) | 1 (trượt vào từ PHẢI, khi tiến lên sau) |
    // 0/undefined (không animation hướng, dùng cho lần vẽ đầu, đổi
    // mode, hoặc data thay đổi nền — chỉ fade nhẹ như .cal-pane vốn có).
    // Class được gắn 1 LẦN lúc tạo phần tử (không phải toggle sau đó)
    // vì animation CSS chỉ tự chạy khi phần tử MỚI xuất hiện trong DOM
    // với class đã có sẵn — đây là lý do content.innerHTML luôn tạo
    // phần tử .cal-pane HOÀN TOÀN MỚI mỗi lần draw(), không tái dùng.
    function draw(pageDir) {
      const data = Sync.getData();
      let html;
      if (mode === 'day') html = drawDay(data);
      else if (mode === 'week') html = drawWeek(data);
      else if (mode === 'month') html = drawMonth(data);
      else html = drawYearMode(data);

      // Bỏ qua ghi lại nếu không đổi gì — build lưới lặp lại + vòng lặp
      // đếm ở trên chạy MỖI KHI Sync.onChange bắn, kể cả khi đang xem
      // tab khác hoặc thay đổi không liên quan gì tới lịch (vd gõ note
      // 1 event ở tab "Hôm nay"). So sánh HTML trước khi ghi tránh lãng
      // phí, và tránh mất giá trị đang gõ dở trong ô tìm ngày nếu người
      // dùng đang thao tác đúng lúc có thay đổi khác xảy ra.
      if (html === lastHtml) return;
      lastHtml = html;

      const dirClass = pageDir === 1 ? 'cal-pane-in-next' : pageDir === -1 ? 'cal-pane-in-prev' : '';
      content.innerHTML = `<div class="cal-pane ${dirClass}" id="cal-pane">${html}</div>`;
      const paneEl = content.querySelector('.cal-pane');

      // Vuốt ngang TRÊN CHÍNH NỘI DUNG (không phải trên switcher) —
      // trái = trang sau (tiến), phải = trang trước (lùi), quy ước
      // quen thuộc của app lịch (vuốt trái = xem cái SAU).
      //
      // ANIMATION "GIỌT LỎNG": onDrag kéo paneEl theo đúng ngón tay
      // (translateX = dx) — khi thả tay, onCommit đổi trang (gọi
      // step+draw NGAY, dựng .cal-pane MỚI với animation CSS có sẵn
      // cal-pane-in-next/prev, xem year.css) trong khi paneEl CŨ vẫn
      // đang hiển thị đúng vị trí đã kéo tới — .cal-pane cũ tự bị xoá
      // khỏi DOM ngay khi content.innerHTML được set lại trong draw(),
      // nên không cần animate "trôi nốt" cho nó (nó biến mất ngay,
      // thay bằng phần tử mới đã tự có animation trượt vào đúng
      // hướng). onCancel animate paneEl trôi VỀ lại vị trí gốc khi
      // chưa đủ ngưỡng.
      SwipeNav.bind(paneEl, {
        onDrag: (dx) => {
          paneEl.style.transform = `translateX(${dx}px)`;
          // Đọc TRỰC TIẾP aria-label có sẵn của #cal-prev/#cal-next
          // (mỗi mode tự đặt đúng ngữ cảnh — "Ngày trước", "Tuần sau",
          // "Tháng trước"... xem drawDay/drawWeek/drawMonth/
          // drawYearMode phía trên) thay vì tự bịa chuỗi mới ở đây —
          // đảm bảo nhãn hint LUÔN khớp đúng với nút mũi tên tương ứng,
          // không cần đồng bộ tay 2 nơi mỗi khi đổi câu chữ.
          const btn = content.querySelector(dx < 0 ? '#cal-next' : '#cal-prev');
          if (btn && !btn.disabled) SwipeHint.show(btn.getAttribute('aria-label'));
          else SwipeHint.hide(); // nút đích bị disabled (vd đã ở năm xa nhất cho phép) — không có gì để đi tới
        },
        onCommit: (dir) => { step(dir); draw(dir); },
        onSettle: () => SwipeHint.hide(),
        onCancel: () => {
          paneEl.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          paneEl.style.transform = '';
          const done = () => { paneEl.style.transition = ''; paneEl.removeEventListener('transitionend', done); };
          paneEl.addEventListener('transitionend', done);
          SwipeHint.hide();
        }
      });

      // Gắn click cho MỌI phần tử có data-date (không phụ thuộc class
      // cụ thể — .day-cell ở Tháng/Năm, .cal-week-row ở Tuần,
      // .cal-day-focus ở Ngày...) trừ .cal-day-focus-open, vì nút đó
      // ĐÃ có listener riêng qua delegation ở cuối render() (dòng dưới
      // cùng) — gắn thêm ở đây sẽ gọi onDayClick 2 lần mỗi cú bấm.
      //
      // NHẤN GIỮ (long-press) cùng trên các ô này mở DayPreviewSheet —
      // xem/tick/ghi chú nhanh mà không rời trang lịch. LongPress tự
      // chặn click ăn theo ngay sau khi long-press kích hoạt (xem
      // js/long-press.js), nên 2 tương tác không chồng lẫn nhau: nhấn
      // ngắn = mở day-detail như trước giờ, giữ lâu = mở sheet xem nhanh.
      content.querySelectorAll('[data-date]:not(.cal-day-focus-open)').forEach(cell => {
        cell.addEventListener('click', () => {
          if (onDayClick) onDayClick(cell.dataset.date);
        });
        LongPress.bind(cell, (el) => {
          DayPreviewSheet.open(el.dataset.date, onDayClick);
        });
      });

      bindNavCommon();
      bindDateJump();

      if (mode === 'year' && pendingScrollToToday && viewYear === new Date().getFullYear()) {
        pendingScrollToToday = false;
        const todayKey = DateUtils.dateKey(new Date());
        requestAnimationFrame(() => {
          const todayCell = content.querySelector(`[data-date="${todayKey}"]`);
          todayCell?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        });
      }
    }

    // Nav prev/next dùng CHUNG 1 id cho mọi mode (#cal-prev/#cal-next)
    // — mỗi mode tự quyết định bước nhảy đúng đơn vị của mình (ngày/
    // tuần/tháng/năm).
    function bindNavCommon() {
      const prevBtn = content.querySelector('#cal-prev');
      const nextBtn = content.querySelector('#cal-next');
      if (prevBtn) prevBtn.addEventListener('click', () => { if (!prevBtn.disabled) { step(-1); draw(-1); } });
      if (nextBtn) nextBtn.addEventListener('click', () => { if (!nextBtn.disabled) { step(1); draw(1); } });
    }

    function step(dir) {
      if (mode === 'day') { const d = new Date(anchor); d.setDate(d.getDate() + dir); anchor = d; }
      else if (mode === 'week') { const d = new Date(anchor); d.setDate(d.getDate() + dir * 7); anchor = d; }
      else if (mode === 'month') { const d = new Date(anchor); d.setMonth(d.getMonth() + dir, 1); anchor = d; }
      else { viewYear += dir; }
    }

    // Bấm THẲNG vào dòng tiêu đề (#cal-title-jump) mở popup chọn ngày/
    // tháng TỰ VẼ (MiniCalendarPicker — không dùng input gốc của
    // trình duyệt nữa, vì input gốc không set được màu/kiểu và không
    // chèn được âm lịch vào bên trong). Popup tự có sẵn nút "Hôm nay"
    // nên không cần thêm nút riêng ở ngoài.
    function bindDateJump() {
      const titleBtn = content.querySelector('#cal-title-jump');
      if (!titleBtn) return;
      titleBtn.addEventListener('click', () => {
        MiniCalendarPicker.open({
          anchorEl: titleBtn,
          initialDate: mode === 'year' ? new Date(viewYear, 0, 1) : anchor,
          mode: mode === 'week' ? 'week' : 'day',
          onSelect: (d) => {
            if (mode === 'year') {
              viewYear = d.getFullYear();
              if (viewYear === new Date().getFullYear()) pendingScrollToToday = true;
              draw();
              if (onDayClick) onDayClick(DateUtils.dateKey(d));
              return;
            }
            anchor = d;
            draw();
          }
        });
      });
    }

    // ---------- Mode: Ngày ----------
    function drawDay(data) {
      const { checks, events, habitNotes } = data;
      const today = new Date();
      const todayKey = DateUtils.dateKey(today);
      const key = DateUtils.dateKey(anchor);
      const lunar = (() => { try { return LunarCalendar.fromSolar(anchor); } catch (e) { return null; } })();
      const isFuture = DateUtils.parseDateStr(key) > new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const scoped = isFuture ? [] : HabitScope.habitsForDate(key, data);
      const count = countForDate(checks, scoped, key);
      const total = scoped.length;
      const hasEvent = !!(events[key] && events[key].length > 0);
      const hasNote = hasNoteForDate(habitNotes, key);

      const header = `
        <div class="cal-header">
          <div class="cal-nav">
            <button id="cal-prev" aria-label="Ngày trước"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
            <button id="cal-title-jump" class="cal-title cal-title-btn" aria-label="Chọn ngày khác">${DateUtils.DAYS_VN[anchor.getDay()]}, ${anchor.getDate()}/${anchor.getMonth() + 1}</button>
            <button id="cal-next" aria-label="Ngày sau"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          </div>
        </div>
      `;

      return `
        ${header}
        <div class="cal-day-focus ${key === todayKey ? 'is-today' : ''}" data-date="${key}">
          <p class="cal-day-focus-weekday">${DateUtils.DAYS_VN[anchor.getDay()]}</p>
          <p class="cal-day-focus-date">${anchor.getDate()} ${DateUtils.MONTH_NAMES_FULL[anchor.getMonth()]}, ${anchor.getFullYear()}</p>
          ${lunar ? `<p class="cal-day-focus-lunar">Âm lịch: ${lunar.fullLabel} · năm ${lunar.canChiYear}</p>` : ''}
          <div class="cal-day-focus-badges">
            ${total > 0 ? `<span class="cal-badge ${cellClass(count, total) || 'cal-badge-empty'}">${count}/${total} việc</span>` : (isFuture ? `<span class="cal-badge cal-badge-muted">Ngày chưa tới</span>` : `<span class="cal-badge cal-badge-muted">Không có việc lặp lại</span>`)}
            ${hasEvent ? `<span class="cal-badge cal-badge-muted"><i class="ti ti-paperclip" aria-hidden="true"></i> Có dấu ấn</span>` : ''}
            ${hasNote ? `<span class="cal-badge cal-badge-muted"><i class="ti ti-note" aria-hidden="true"></i> Có ghi chú</span>` : ''}
          </div>
          <button class="cal-day-focus-open" data-date="${key}">Xem chi tiết ngày này <i class="ti ti-arrow-right" aria-hidden="true"></i></button>
        </div>
      `;
    }

    // ---------- Mode: Tuần ----------
    function drawWeek(data) {
      const { checks, events, habitNotes } = data;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayKey = DateUtils.dateKey(today);
      const weekStart = startOfWeek(anchor);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);

      const rangeLabel = weekStart.getMonth() === weekEnd.getMonth()
        ? `${weekStart.getDate()} - ${weekEnd.getDate()} ${DateUtils.MONTH_NAMES_FULL[weekStart.getMonth()]}, ${weekStart.getFullYear()}`
        : `${weekStart.getDate()} ${DateUtils.MONTH_NAMES_FULL[weekStart.getMonth()]} - ${weekEnd.getDate()} ${DateUtils.MONTH_NAMES_FULL[weekEnd.getMonth()]}, ${weekEnd.getFullYear()}`;

      const header = `
        <div class="cal-header">
          <div class="cal-nav">
            <button id="cal-prev" aria-label="Tuần trước"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
            <button id="cal-title-jump" class="cal-title cal-title-btn" aria-label="Chọn tuần khác">${rangeLabel}</button>
            <button id="cal-next" aria-label="Tuần sau"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          </div>
        </div>
      `;

      let rows = '';
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart); d.setDate(d.getDate() + i);
        const key = DateUtils.dateKey(d);
        const isFuture = d > today;
        const isToday = key === todayKey;
        const lunar = lunarShort(d);
        const hasEvent = !!(events[key] && events[key].length > 0);
        const hasNote = hasNoteForDate(habitNotes, key);

        let bodyHtml;
        if (isFuture) {
          bodyHtml = `<span class="cal-week-row-status cal-badge-muted">Chưa tới</span>`;
        } else {
          const scoped = HabitScope.habitsForDate(key, data);
          const count = countForDate(checks, scoped, key);
          const total = scoped.length;
          bodyHtml = total > 0
            ? `<span class="cal-week-row-status ${cellClass(count, total)}">${count}/${total}</span>`
            : `<span class="cal-week-row-status cal-badge-muted">—</span>`;
        }

        rows += `
          <div class="cal-week-row ${isToday ? 'is-today' : ''}" data-date="${key}">
            <div class="cal-week-row-date">
              <span class="cal-week-row-dow">${DateUtils.DAYS_VN[d.getDay()]}</span>
              <span class="cal-week-row-num">${d.getDate()}</span>
              <span class="cal-week-row-lunar">${lunar}</span>
            </div>
            <div class="cal-week-row-marks">
              ${hasEvent ? `<i class="ti ti-paperclip" aria-hidden="true"></i>` : ''}
              ${hasNote ? `<i class="ti ti-note" aria-hidden="true"></i>` : ''}
            </div>
            ${bodyHtml}
          </div>
        `;
      }

      return `${header}<div class="cal-week-list">${rows}</div>`;
    }

    // ---------- Mode: Tháng ----------
    function drawMonth(data) {
      const { checks, events, habitNotes } = data;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayKey = DateUtils.dateKey(today);
      const y = anchor.getFullYear();
      const m = anchor.getMonth();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const firstWeekday = new Date(y, m, 1).getDay();

      const header = `
        <div class="cal-header">
          <div class="cal-nav">
            <button id="cal-prev" aria-label="Tháng trước"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
            <button id="cal-title-jump" class="cal-title cal-title-btn" aria-label="Chọn tháng khác">${DateUtils.MONTH_NAMES_FULL[m][0].toUpperCase() + DateUtils.MONTH_NAMES_FULL[m].slice(1)}, ${y}</button>
            <button id="cal-next" aria-label="Tháng sau"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          </div>
        </div>
        <div class="weekday-row cal-month-weekday-row">
          <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
        </div>
      `;

      let cells = '';
      // Ô đệm đầu tháng — thuộc THÁNG TRƯỚC, lấp đầy hàng đầu tiên để
      // giữ đúng cột thứ (kiểu lịch để bàn quen thuộc) thay vì để
      // trống. Vẫn gắn data-date + bấm mở được như ô bình thường —
      // người dùng có thể muốn xem/ghi nhận nhanh 1 ngày cuối tháng
      // trước mà không cần lùi cả trang.
      const prevMonthDate = new Date(y, m - 1, 1);
      const prevY = prevMonthDate.getFullYear();
      const prevM = prevMonthDate.getMonth();
      const prevMonthDays = new Date(y, m, 0).getDate();
      for (let i = 0; i < firstWeekday; i++) {
        const dayNum = prevMonthDays - firstWeekday + 1 + i;
        const adjKey = DateUtils.dateKeyFromParts(prevY, prevM, dayNum);
        const adjLunar = lunarShort(new Date(prevY, prevM, dayNum));
        cells += `<div class="day-cell blank-adjacent" data-date="${adjKey}"><div class="day-cell-top"><span class="day-lunar">${adjLunar}</span></div><span class="day-number">${dayNum}</span></div>`;
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(y, m, day);
        const key = DateUtils.dateKeyFromParts(y, m, day);
        const isFuture = d > today;
        const isToday = key === todayKey;
        const lunar = lunarShort(d);
        const hasEvent = !!(events[key] && events[key].length > 0);
        const hasNote = hasNoteForDate(habitNotes, key);
        const clipHtml = hasEvent ? `<i class="ti ti-paperclip event-clip" aria-hidden="true"></i>` : '';
        const noteMarkHtml = hasNote ? `<i class="ti ti-note note-mark" aria-hidden="true"></i>` : '';
        // Hàng 1 (day-cell-top): âm lịch bên trái, icon event/note bên
        // phải — 1 hàng grid duy nhất thay vì các phần tử absolute rời
        // rạc, xem giải thích chi tiết ở CSS .cal-month-grid .day-cell.
        const topRowHtml = `<div class="day-cell-top"><span class="day-lunar">${lunar}</span><span class="day-cell-icons">${clipHtml}${noteMarkHtml}</span></div>`;

        if (isFuture) {
          cells += `<div class="day-cell future-day" data-date="${key}">${topRowHtml}<span class="day-number">${day}</span></div>`;
          continue;
        }
        const scoped = HabitScope.habitsForDate(key, data);
        const dayTotal = scoped.length;
        const count = countForDate(checks, scoped, key);
        cells += `<div class="day-cell ${cellClass(count, dayTotal)} ${count === 0 ? 'empty-day' : ''} ${isToday ? 'today' : ''}" data-date="${key}">${topRowHtml}<span class="day-number">${day}</span>${count > 0 ? `<span class="day-progress">${count}</span>` : ''}</div>`;
      }
      // Ô đệm cuối tháng — thuộc THÁNG SAU, lấp nốt hàng cuối cho đều
      // lưới 7 cột. Cùng lý do trên: gắn data-date + bấm mở được.
      const totalCells = firstWeekday + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      const nextMonthDate = new Date(y, m + 1, 1);
      const nextY = nextMonthDate.getFullYear();
      const nextM = nextMonthDate.getMonth();
      for (let i = 1; i <= trailing; i++) {
        const adjKey = DateUtils.dateKeyFromParts(nextY, nextM, i);
        const adjLunar = lunarShort(new Date(nextY, nextM, i));
        cells += `<div class="day-cell blank-adjacent" data-date="${adjKey}"><div class="day-cell-top"><span class="day-lunar">${adjLunar}</span></div><span class="day-number">${i}</span></div>`;
      }

      return `${header}<div class="day-grid cal-month-grid">${cells}</div>`;
    }

    // ---------- Mode: Năm (hành vi gốc, giữ nguyên) ----------
    function drawYearMode(data) {
      const { habits, checks, events, habitNotes } = data;
      const today = new Date();
      const todayKey = DateUtils.dateKeyFromParts(today.getFullYear(), today.getMonth(), today.getDate());
      // hasAnyHabit CHỈ dùng để gác "có việc nào để hiển thị lưới năm
      // không" (không phụ thuộc ngày) — KHÔNG dùng làm mẫu số cho từng
      // ô ngày nữa, xem HabitScope.habitsForDate bên dưới cho mẫu số
      // thật của từng ngày cụ thể.
      const hasAnyHabit = habits.length > 0;
      const isCurrentYear = viewYear === today.getFullYear();

      let fullDays = 0;
      if (hasAnyHabit) {
        const startOfView = new Date(viewYear, 0, 1);
        const endOfView = isCurrentYear ? today : new Date(viewYear, 11, 31);
        for (let d = new Date(startOfView); d <= endOfView; d.setDate(d.getDate() + 1)) {
          const key = DateUtils.dateKeyFromParts(d.getFullYear(), d.getMonth(), d.getDate());
          const scoped = HabitScope.habitsForDate(key, data);
          if (scoped.length > 0 && countForDate(checks, scoped, key) === scoped.length) fullDays++;
        }
      }

      const minYear = earliestDataYear(checks, events);
      const canGoBack = viewYear > minYear;
      const canGoForward = viewYear < today.getFullYear();

      let html = `
        <div class="cal-header">
          <div class="cal-nav">
            <button id="cal-prev" aria-label="Năm trước" ${canGoBack ? '' : 'disabled'}>
              <i class="ti ti-chevron-left" aria-hidden="true"></i>
            </button>
            <button id="cal-title-jump" class="cal-title cal-title-year cal-title-btn" aria-label="Chọn năm khác">${viewYear}</button>
            <button id="cal-next" aria-label="Năm sau" ${canGoForward ? '' : 'disabled'}>
              <i class="ti ti-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
          <span class="year-count">${hasAnyHabit ? fullDays + ' ngày hoàn thành đủ' : ''}</span>
        </div>
      `;

      if (!hasAnyHabit) {
        html += `<div class="empty-state"><p>Chưa có việc nào để hiển thị.</p></div>`;
        return html;
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
          const scoped = HabitScope.habitsForDate(key, data);
          const dayTotal = scoped.length;
          const count = countForDate(checks, scoped, key);
          const isToday = key === todayKey;
          cells += `<div class="day-cell ${cellClass(count, dayTotal)} ${count === 0 ? 'empty-day' : ''} ${isToday ? 'today' : ''}" data-date="${key}">${clipHtml}${noteMarkHtml}${count > 0 ? `<span class="day-progress">${count}</span>` : ''}<span class="day-number">${day}</span></div>`;
        }

        html += `
          <div class="month-block">
            <p class="month-label">${DateUtils.MONTH_NAMES_FULL[m][0].toUpperCase() + DateUtils.MONTH_NAMES_FULL[m].slice(1)}</p>
            <div class="weekday-row">
              <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
            </div>
            <div class="day-grid month-grid">${cells}</div>
          </div>
        `;
      }
      html += `</div>`;
      return html;
    }

    // Gỡ listener của lần render() trước (nếu có) trước khi đăng ký cái
    // mới — render() được gọi lại mỗi khi người dùng chuyển sang tab
    // "Lịch", nếu không gỡ thì listener cũ (trỏ DOM đã bị thay thế)
    // sẽ cộng dồn mãi, chạy draw() thừa nhiều lần mỗi khi data đổi.
    if (container.__yearOnChange) Sync.offChange(container.__yearOnChange);
    container.__yearOnChange = draw;
    Sync.onChange(draw);
    draw();

    // Nút "Xem chi tiết ngày này" ở mode Ngày — gắn qua delegation trên
    // content vì #cal-pane bị vẽ lại (innerHTML) mỗi lần draw(), không
    // gắn trực tiếp lên nút được (mất listener sau lần vẽ đầu).
    content.addEventListener('click', (e) => {
      const btn = e.target.closest('.cal-day-focus-open');
      if (btn && onDayClick) onDayClick(btn.dataset.date);
    });
  }

  return { render };
})();
