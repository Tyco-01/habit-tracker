// ============================================================
// event-section.js — Khối UI "Sự kiện riêng ngày này", dùng chung
// giữa màn "Hôm nay" và màn chi tiết 1 ngày, tránh lặp code.
//
// Sự kiện có thể đặt vào NGÀY TƯƠNG LAI (khác với việc lặp lại) —
// vì sự kiện 1 lần thường mang tính "lên lịch trước" (hẹn nha sĩ,
// sinh nhật...), không giống việc lặp lại vốn chỉ có ý nghĩa khi
// tick đúng ngày nó xảy ra.
// ============================================================

const EventSection = (() => {

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

  // Render khối sự kiện vào `container` cho đúng `dateStr`.
  // `withHistory`: có hiện phần "Lịch sử" theo tên sự kiện hay không
  // (màn Hôm nay không cần phần này để giữ gọn, màn chi tiết ngày thì có).
  function render(container, dateStr, { withHistory = true } = {}) {
    container.innerHTML = `
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
      ${withHistory ? '<div id="event-history"></div>' : ''}
    `;

    const eventListEl = container.querySelector('#event-list');
    const eventHistoryEl = container.querySelector('#event-history');

    function drawEvents() {
      const { events } = Sync.getData();
      const evs = events[dateStr] || [];

      eventListEl.innerHTML = evs.length === 0
        ? `<p style="font-size:13px;color:var(--mute);margin:0;">Chưa có sự kiện nào cho ngày này.</p>`
        : evs.map(e => `
          <div class="event-row" style="flex-direction:column;align-items:stretch;gap:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <i class="ti ti-sparkles" style="font-size:15px;color:var(--ink);flex-shrink:0;" aria-hidden="true"></i>
              <span class="event-name">${escapeHtml(e.name)}</span>
              <button class="event-remove" data-event="${e.id}" aria-label="Xoá ${escapeHtml(e.name)}">
                <i class="ti ti-x" style="font-size:14px;" aria-hidden="true"></i>
              </button>
            </div>
            <textarea class="event-note-input" data-event-note="${e.id}" placeholder="Ghi chú thêm (tuỳ chọn)..." maxlength="500" rows="1">${escapeHtml(e.note || '')}</textarea>
          </div>
        `).join('');

      eventListEl.querySelectorAll('.event-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const ev = evs.find(e => e.id === btn.dataset.event);
          const name = ev ? ev.name : 'sự kiện này';
          const confirmed = confirm(`Xoá "${name}"?\n\nSự kiện này sẽ bị xoá hẳn, không có thùng rác cho sự kiện 1 lần.`);
          if (!confirmed) return;
          Sync.removeEvent(dateStr, btn.dataset.event);
        });
      });

      // Ghi chú: lưu khi rời khỏi ô nhập (blur), không lưu theo từng phím gõ
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

      if (withHistory && eventHistoryEl) {
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

  return { render };
})();
