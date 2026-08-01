// ============================================================
// event-section.js — Khối UI "Dấu ấn", dùng chung giữa màn "Hôm
// nay" và màn chi tiết 1 ngày, tránh lặp code. (Tên biến/hàm trong
// file này vẫn giữ "event" — chỉ tên hiển thị trên UI đổi thành
// "dấu ấn", đổi tên biến/hàm nội bộ không cần thiết và tăng rủi ro
// gõ nhầm khi sửa. Nhãn từng là "DẤU ẤN NGÀY NÀY", rút gọn còn
// "DẤU ẤN" vì chữ "ngày này" dư — ngữ cảnh trang đã luôn là 1 ngày
// cụ thể, không cần nhắc lại.)
//
// Dấu ấn có thể đặt vào NGÀY TƯƠNG LAI (khác với việc lặp lại) — vì
// dấu ấn 1 lần thường mang tính "lên lịch trước" (hẹn nha sĩ, sinh
// nhật...), không giống việc lặp lại vốn chỉ có ý nghĩa khi tick
// đúng ngày nó xảy ra.
//
// Mỗi lần gọi render() cần 1 `idPrefix` riêng biệt để các ID phần
// tử con không trùng nhau — vì màn "Hôm nay" và màn chi tiết ngày
// có thể cùng tồn tại trong DOM cùng lúc (1 cái đang ẩn qua
// display:none).
//
// Gợi ý tên dấu ấn: KHÔNG dùng datalist (native browser element) —
// trên nhiều trình duyệt di động, phần tử này không mở được bằng
// chạm (chỉ hoạt động tốt trên desktop). Thay bằng dropdown tự vẽ,
// đảm bảo chạm được trên mọi thiết bị.
//
// Nhảy nhanh tới ngày khác: gọi window.__jumpToDate(dateStr) — hàm
// này được app.js gán sẵn lúc khởi động, mở thẳng màn chi tiết ngày
// đó mà không cần người dùng tự thao tác qua "Cả năm".
// ============================================================

const EventSection = (() => {

  // Map idPrefix -> listener hiện tại, đặt Ở CẤP MODULE (không lưu
  // trên DOM container) — đây là điểm mấu chốt: TRƯỚC ĐÂY listener cũ
  // được lưu trên chính `container` truyền vào, với giả định container
  // đó ổn định qua các lần gọi. Giả định này ĐÚNG khi EventSection
  // được gọi trực tiếp với 1 container cố định, nhưng SAI khi gọi từ
  // bên trong 1 view khác (today.js, day-detail.js) — các view đó tự
  // `container.innerHTML = ...` lại TOÀN BỘ cây con mỗi lần render(),
  // tạo ra 1 node `#event-section-today` HOÀN TOÀN MỚI mỗi lần, nên
  // property gắn trên node cũ không bao giờ được node mới thấy lại —
  // hậu quả: listener cũ (đóng gói node đã bị văng khỏi DOM) không
  // bao giờ bị gỡ, cộng dồn mãi mỗi lần view cha render() lại (bug đã
  // xác nhận qua smoke-test-full-app.js: TodayView/DayDetailView làm
  // listener của EventSection tăng N lần sau N lần render() view cha,
  // dù bản thân EventSection.render() nhận đúng idPrefix cố định).
  //
  // Lưu theo idPrefix ở object cấp module thay vì trên DOM node giải
  // quyết đúng gốc: idPrefix luôn cố định dù DOM node có bị thay mới
  // bao nhiêu lần, nên luôn tìm đúng listener cũ để gỡ.
  const changeListenersByPrefix = {};

  function daysBetween(a, b) {
    return Math.round((a - b) / 86400000);
  }

  function jumpToDate(dateStr) {
    if (typeof window.__jumpToDate === 'function') {
      window.__jumpToDate(dateStr);
    }
  }

  function allEventNames() {
    const { events } = Sync.getData();
    const names = new Set();
    Object.values(events).forEach(list => {
      list.forEach(e => names.add(e.name));
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  }

  function historyFor(eventName, currentDateStr) {
    const { events } = Sync.getData();
    const allEntries = [];
    Object.keys(events).forEach(k => {
      (events[k] || []).forEach(e => {
        if (e.name === eventName) allEntries.push(k);
      });
    });
    const uniqueDates = [...new Set(allEntries)].sort();
    return uniqueDates.map((k, i) => {
      let gapText = 'lần đầu ghi nhận';
      if (i > 0) {
        const kd = DateUtils.parseDateStr(k);
        const prevD = DateUtils.parseDateStr(uniqueDates[i - 1]);
        gapText = `cách lần trước ${daysBetween(kd, prevD)} ngày`;
      }
      return { dateStr: k, gapText, isCurrent: k === currentDateStr };
    });
  }

  // options: { idPrefix (bắt buộc), showHistory }
  //   showHistory: nếu true, hiện TOÀN BỘ lịch sử ghi nhận (dạng timeline
  //     dọc, đốt chấm nối liền — chấm đặc + viền ngoài cho lần gần nhất,
  //     chấm rỗng mờ dần cho các lần cũ hơn) ngay dưới mỗi dấu ấn, bấm để
  //     nhảy tới ngày đó. Trước đây từng giới hạn CHỈ 3 lần gần nhất
  //     (đặt tên "compactHistory") cùng lúc với 1 chế độ "lịch sử đầy đủ"
  //     riêng (withHistory) hiện thành khối lớn riêng phía dưới — 2 chế
  //     độ đó đã bỏ hẳn vì trùng lặp thông tin với nhau (cùng dữ liệu,
  //     chỉ khác cách trình bày), gây rối mắt. Giờ chỉ còn 1 khối duy
  //     nhất (không giới hạn số lượng), nên không còn nguy cơ trùng lặp
  //     như trước — đổi tên "compactHistory" → "showHistory" cho đúng
  //     bản chất mới (không còn "rút gọn" nữa).
  function render(container, dateStr, { idPrefix, showHistory = false } = {}) {
    if (!idPrefix) {
      throw new Error('EventSection.render cần idPrefix để tránh trùng ID giữa các khối.');
    }

    const addBtnId = `${idPrefix}-event-add-btn`;
    const inputRowId = `${idPrefix}-event-input-row`;
    const inputId = `${idPrefix}-event-input`;
    const saveId = `${idPrefix}-event-save`;
    // Tên "dropdownId"/class "event-dropdown" là tàn dư lịch sử — khối
    // này giờ không còn ẩn/hiện theo việc gõ chữ nữa (xem comment ở
    // dưới, đoạn "Ô nhập tên mới + chip gợi ý"), chỉ còn là nơi chứa
    // chip gợi ý hiện cùng lúc với ô nhập. Không đổi tên vì phải sửa
    // đồng thời nhiều chỗ trong cả JS lẫn CSS chỉ để đúng nghĩa hơn,
    // trong khi hành vi chạy thật không phụ thuộc gì vào cái tên —
    // rủi ro gõ sai khi đổi lớn hơn giá trị nhận lại.
    const dropdownId = `${idPrefix}-event-dropdown`;

    container.innerHTML = `
      <div class="section-header-row">
        <p class="section-label" style="margin:0;">DẤU ẤN<span class="section-label-count" id="${idPrefix}-event-count">0</span></p>
        <button class="pill-btn" id="${addBtnId}">
          <i class="ti ti-plus" style="font-size:12px;" aria-hidden="true"></i> Thêm
        </button>
      </div>
      <div class="input-row event-input-wrap" id="${inputRowId}" style="display:none;">
        <div class="event-input-field">
          <input type="text" id="${inputId}" placeholder="ví dụ: cắt tóc" maxlength="60" autocomplete="new-event-name" />
          <div class="event-dropdown" id="${dropdownId}" style="display:none;"></div>
        </div>
        <button id="${saveId}">Lưu</button>
      </div>
      <div class="event-list-slot"></div>
    `;

    const eventListEl = container.querySelector('.event-list-slot');

    // Số mốc timeline đang hiện cho từng dấu ấn (khoá theo event.id) —
    // đặt ở đây (phạm vi render(), không phải trong drawEvents) để
    // KHÔNG bị reset về mặc định mỗi khi drawEvents chạy lại. drawEvents
    // chạy lại rất thường xuyên (Sync.onChange bắn cho MỌI thay đổi dữ
    // liệu, kể cả ở dấu ấn khác hoàn toàn không liên quan) — nếu đặt
    // biến này trong drawEvents, người dùng bấm "Xem thêm" xong chỉ cần
    // 1 thay đổi bất kỳ ở nơi khác là timeline lại tự thu gọn về ban đầu.
    const TIMELINE_PAGE_SIZE = 5; // số mốc hiện mặc định + mỗi lần "Xem thêm"
    const timelineExpanded = new Map(); // event.id -> số mốc đang hiện

    function drawEvents() {
      const { events } = Sync.getData();
      const evs = events[dateStr] || [];

      const countEl = container.querySelector(`#${idPrefix}-event-count`);
      if (countEl) countEl.textContent = evs.length;

      eventListEl.innerHTML = evs.length === 0
        ? `<p style="font-size:13px;color:var(--mute);margin:0;">Chưa có dấu ấn nào cho ngày này.</p>`
        : evs.map(e => {
          const fullHistory = showHistory ? historyFor(e.name, dateStr).reverse() : [];
          const visibleCount = timelineExpanded.get(e.id) || TIMELINE_PAGE_SIZE;
          const historyRows = fullHistory.slice(0, visibleCount);
          const remaining = fullHistory.length - historyRows.length;
          return `
            <div class="event-row" style="flex-direction:column;align-items:stretch;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="event-name">${DomUtils.escapeHtml(e.name)}</span>
                <button class="event-remove" data-event="${e.id}" aria-label="Xoá ${DomUtils.escapeHtml(e.name)}">
                  <i class="ti ti-x" style="font-size:14px;" aria-hidden="true"></i>
                </button>
              </div>
              <textarea class="event-note-input" data-event-note="${e.id}" placeholder="Ghi chú thêm (tuỳ chọn)..." maxlength="500" rows="1">${DomUtils.escapeHtml(e.note || '')}</textarea>
              ${historyRows.length > 0 ? `
                <div class="event-timeline">
                  <div class="event-timeline-track">
                    ${historyRows.map((r, i) => `
                      <button class="event-timeline-item ${r.isCurrent ? 'current' : ''}" data-jump="${r.dateStr}" ${r.isCurrent ? 'disabled' : ''}>
                        <span class="event-timeline-dot ${i === 0 ? 'latest' : ''}"></span>
                        <span class="event-timeline-date">${DateUtils.formatDayMonthLabel(DateUtils.parseDateStr(r.dateStr))}${r.isCurrent ? ' <span class="event-timeline-today-tag">hôm nay</span>' : ''}</span>
                        <span class="event-timeline-gap">${r.gapText}</span>
                      </button>
                    `).join('')}
                  </div>
                  ${remaining > 0 ? `
                    <button type="button" class="event-timeline-more" data-expand="${e.id}">
                      Xem thêm ${Math.min(remaining, TIMELINE_PAGE_SIZE)} mốc cũ hơn
                      <i class="ti ti-chevron-down" style="font-size:12px;" aria-hidden="true"></i>
                    </button>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

      eventListEl.querySelectorAll('.event-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ev = evs.find(e => e.id === btn.dataset.event);
          const name = ev ? ev.name : 'dấu ấn này';
          const ok = await ConfirmModal.show({
            title: `Xoá "${name}"?`,
            body: 'Dấu ấn này sẽ bị xoá hẳn, không có thùng rác cho dấu ấn 1 lần.',
            confirmLabel: 'Xoá'
          });
          if (!ok) return;
          Sync.removeEvent(dateStr, btn.dataset.event);
          timelineExpanded.delete(btn.dataset.event);
        });
      });

      eventListEl.querySelectorAll('.event-note-input').forEach(area => {
        area.addEventListener('blur', () => {
          const eventId = area.dataset.eventNote;
          const original = evs.find(e => e.id === eventId);
          const newNote = area.value.trim();
          if (original && newNote !== (original.note || '')) {
            Sync.updateEventNote(dateStr, eventId, newNote);
          }
        });
      });

      eventListEl.querySelectorAll('[data-jump]').forEach(btn => {
        btn.addEventListener('click', () => jumpToDate(btn.dataset.jump));
      });

      eventListEl.querySelectorAll('[data-expand]').forEach(btn => {
        btn.addEventListener('click', () => {
          const eventId = btn.dataset.expand;
          const current = timelineExpanded.get(eventId) || TIMELINE_PAGE_SIZE;
          timelineExpanded.set(eventId, current + TIMELINE_PAGE_SIZE);
          drawEvents();
        });
      });
    }

    drawEvents();
    // Gỡ listener của lần render() TRƯỚC ĐÓ CHO ĐÚNG idPrefix NÀY (nếu
    // có) trước khi đăng ký cái mới — tra trong changeListenersByPrefix
    // (cấp module, xem giải thích ở đầu file) chứ KHÔNG lưu trên chính
    // `container`, vì container này thường bị view cha (today.js,
    // day-detail.js) tái tạo mới mỗi lần nó tự render() lại.
    if (changeListenersByPrefix[idPrefix]) Sync.offChange(changeListenersByPrefix[idPrefix]);
    changeListenersByPrefix[idPrefix] = drawEvents;
    Sync.onChange(drawEvents);

    // ---- Ô nhập tên mới + chip gợi ý tên đã dùng trước đây ----
    // Trước đây chip gợi ý nằm trong 1 dropdown ẩn, chỉ hiện khi input
    // được focus/gõ (mô phỏng datalist, vì <datalist> gốc không chạm
    // được trên nhiều trình duyệt di động). Đã bỏ hẳn cơ chế ẩn/hiện
    // phụ đó: giờ chip gợi ý hiện NGAY khi mở khối thêm (bấm "+ Thêm"),
    // đi cùng nhịp với ô nhập, không cần người dùng gõ trước mới thấy —
    // và bấm 1 chip là GHI NHẬN LUÔN (gọi addEvent trực tiếp), không
    // còn hành vi cũ "điền tên vào ô rồi tự đi bấm Lưu". Việc này biến
    // thao tác phổ biến nhất (dùng lại 1 dấu ấn đã có từ trước, ví dụ
    // 1 sự kiện lặp lại không đều đặn) từ 4 bước (gõ, chờ dropdown,
    // chọn, bấm Lưu) xuống còn 1 bước (bấm chip).
    //
    // Chip lọc bỏ tên ĐÃ CÓ trong danh sách dấu ấn của NGÀY HÔM NAY —
    // vì cơ chế cũ có 1 lớp bảo vệ tự nhiên chống trùng lặp (người dùng
    // thấy tên trong ô input trước khi bấm Lưu, dễ nhận ra "cái này có
    // rồi"), còn bấm-chip-là-ghi-ngay thì mất hẳn bước xem lại đó — nếu
    // không lọc, bấm nhầm 1 chip cho tên đã tồn tại hôm nay sẽ tạo
    // dấu ấn trùng tên mà addEvent (sync.js) không hề chặn.
    const addBtn = container.querySelector(`#${addBtnId}`);
    const addRow = container.querySelector(`#${inputRowId}`);
    const addInput = container.querySelector(`#${inputId}`);
    const addSave = container.querySelector(`#${saveId}`);
    const suggestSlot = container.querySelector(`#${dropdownId}`);

    // Nút "+ Thêm" phải tự đổi thành "✕ Đóng" khi khối đang mở, để
    // người dùng biết bấm lại là gập lại — trước đây nút bị bỏ sót,
    // luôn hiện cố định "+ Thêm" bất kể trạng thái, gây hiểu lầm khối
    // không hề mở/đóng theo nút này.
    function setAddBtnState(isOpen) {
      addBtn.classList.toggle('active', isOpen);
      addBtn.innerHTML = isOpen
        ? `<i class="ti ti-x" style="font-size:12px;" aria-hidden="true"></i> Đóng`
        : `<i class="ti ti-plus" style="font-size:12px;" aria-hidden="true"></i> Thêm`;
    }

    function drawSuggestions() {
      const { events } = Sync.getData();
      const todayNames = new Set((events[dateStr] || []).map(e => e.name));
      const names = allEventNames().filter(n => !todayNames.has(n));
      if (names.length === 0) { suggestSlot.style.display = 'none'; suggestSlot.innerHTML = ''; return; }

      suggestSlot.innerHTML = `
        <p class="event-dropdown-label">hoặc chạm để dùng lại</p>
        <div class="event-dropdown-scroll">${names.map(n => `<button type="button" class="event-dropdown-chip" data-suggest="${DomUtils.escapeHtml(n)}">${DomUtils.escapeHtml(n)}</button>`).join('')}</div>
      `;
      suggestSlot.style.display = 'block';

      suggestSlot.querySelectorAll('[data-suggest]').forEach(item => {
        item.addEventListener('click', () => {
          Sync.addEvent(dateStr, item.dataset.suggest);
          closeAddRow();
        });
      });
    }

    function closeAddRow() {
      addRow.style.display = 'none';
      addInput.value = '';
      setAddBtnState(false);
    }

    addBtn.addEventListener('click', () => {
      const showing = addRow.style.display !== 'none';
      if (showing) { closeAddRow(); return; }
      addRow.style.display = 'flex';
      setAddBtnState(true);
      drawSuggestions();
      addInput.focus();
    });

    function submitEvent() {
      const name = addInput.value.trim();
      if (!name) return;
      Sync.addEvent(dateStr, name);
      closeAddRow();
    }
    addSave.addEventListener('click', submitEvent);
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitEvent(); });
  }

  return { render };
})();
