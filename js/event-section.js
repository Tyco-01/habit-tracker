// ============================================================
// event-section.js — Khối UI "Sự kiện riêng ngày này", dùng chung
// giữa màn "Hôm nay" và màn chi tiết 1 ngày, tránh lặp code.
//
// Sự kiện có thể đặt vào NGÀY TƯƠNG LAI (khác với việc lặp lại) —
// vì sự kiện 1 lần thường mang tính "lên lịch trước" (hẹn nha sĩ,
// sinh nhật...), không giống việc lặp lại vốn chỉ có ý nghĩa khi
// tick đúng ngày nó xảy ra.
//
// Mỗi lần gọi render() cần 1 `idPrefix` riêng biệt để các ID phần
// tử con không trùng nhau — vì màn "Hôm nay" và màn chi tiết ngày
// có thể cùng tồn tại trong DOM cùng lúc (1 cái đang ẩn qua
// display:none).
//
// Gợi ý tên sự kiện: KHÔNG dùng datalist (native browser element) —
// trên nhiều trình duyệt di động, phần tử này không mở được bằng
// chạm (chỉ hoạt động tốt trên desktop). Thay bằng dropdown tự vẽ
// dưới đây, đảm bảo chạm được trên mọi thiết bị.
// desktop). Thay bằng dropdown tự vẽ, chạm được trên mọi thiết bị.
//
// Nhảy nhanh tới ngày khác: gọi window.__jumpToDate(dateStr) — hàm
// này được app.js gán sẵn lúc khởi động, mở thẳng màn chi tiết ngày
// đó mà không cần người dùng tự thao tác qua "Cả năm".
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
        const kd = parseDateStr(k);
        const prevD = parseDateStr(uniqueDates[i - 1]);
        gapText = `cách lần trước ${daysBetween(kd, prevD)} ngày`;
      }
      return { dateStr: k, gapText, isCurrent: k === currentDateStr };
    });
  }

  // options: { idPrefix (bắt buộc), withHistory, compactHistory }
  //   withHistory: có hiện lịch sử theo tên sự kiện hay không.
  //   compactHistory: nếu true, chỉ hiện lịch sử RÚT GỌN (3 lần gần
  //     nhất, bấm để nhảy tới) ngay dưới mỗi sự kiện — dùng cho màn
  //     "Hôm nay" để không chiếm quá nhiều chỗ.
  function render(container, dateStr, { idPrefix, withHistory = true, compactHistory = false } = {}) {
    if (!idPrefix) {
      throw new Error('EventSection.render cần idPrefix để tránh trùng ID giữa các khối.');
    }

    const addBtnId = `${idPrefix}-event-add-btn`;
    const inputRowId = `${idPrefix}-event-input-row`;
    const inputId = `${idPrefix}-event-input`;
    const saveId = `${idPrefix}-event-save`;
    const dropdownId = `${idPrefix}-event-dropdown`;

    container.innerHTML = `
      <div class="section-header-row">
        <p class="section-label" style="margin:0;">SỰ KIỆN RIÊNG NGÀY NÀY</p>
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
      ${withHistory ? '<div class="event-history-slot"></div>' : ''}
    `;

    const eventListEl = container.querySelector('.event-list-slot');
    const eventHistoryEl = container.querySelector('.event-history-slot');

    function formatShortDate(dateStr) {
      const d = parseDateStr(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }
    function formatFullDate(dateStr) {
      const d = parseDateStr(dateStr);
      return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
    }

    function drawEvents() {
      const { events } = Sync.getData();
      const evs = events[dateStr] || [];

      eventListEl.innerHTML = evs.length === 0
        ? `<p style="font-size:13px;color:var(--mute);margin:0;">Chưa có sự kiện nào cho ngày này.</p>`
        : evs.map(e => {
          const compactRows = compactHistory ? historyFor(e.name, dateStr).slice(-3).reverse() : [];
          return `
            <div class="event-row" style="flex-direction:column;align-items:stretch;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="event-name">${escapeHtml(e.name)}</span>
                <button class="event-remove" data-event="${e.id}" aria-label="Xoá ${escapeHtml(e.name)}">
                  <i class="ti ti-x" style="font-size:14px;" aria-hidden="true"></i>
                </button>
              </div>
              <textarea class="event-note-input" data-event-note="${e.id}" placeholder="Ghi chú thêm (tuỳ chọn)..." maxlength="500" rows="1">${escapeHtml(e.note || '')}</textarea>
              ${compactRows.length > 0 ? `
                <div class="event-compact-history">
                  ${compactRows.map(r => `
                    <button class="event-compact-history-item ${r.isCurrent ? 'current' : ''}" data-jump="${r.dateStr}" ${r.isCurrent ? 'disabled' : ''}>
                      <span>${formatShortDate(r.dateStr)}</span>
                      <span class="event-compact-history-gap">${r.gapText}</span>
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

      eventListEl.querySelectorAll('.event-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ev = evs.find(e => e.id === btn.dataset.event);
          const name = ev ? ev.name : 'sự kiện này';
          const ok = await ConfirmModal.show({
            title: `Xoá "${name}"?`,
            body: 'Sự kiện này sẽ bị xoá hẳn, không có thùng rác cho sự kiện 1 lần.',
            confirmLabel: 'Xoá'
          });
          if (!ok) return;
          Sync.removeEvent(dateStr, btn.dataset.event);
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

      if (withHistory && eventHistoryEl) {
        eventHistoryEl.innerHTML = '';
        evs.forEach(ev => {
          const rows = historyFor(ev.name, dateStr);
          if (rows.length < 1) return;

          const rowsHtml = rows.map(r => `
            <button class="history-row ${r.isCurrent ? 'current' : ''}" data-jump="${r.dateStr}" ${r.isCurrent ? 'disabled' : ''}>
              <span>${formatFullDate(r.dateStr)}${r.isCurrent ? ' (đang xem)' : ''}</span>
              <span class="history-gap">${r.gapText}</span>
            </button>
          `).join('');
          eventHistoryEl.innerHTML += `<p class="section-label" style="margin-top:20px;">LỊCH SỬ "${escapeHtml(ev.name.toUpperCase())}"</p>${rowsHtml}`;
        });

        eventHistoryEl.querySelectorAll('[data-jump]').forEach(btn => {
          btn.addEventListener('click', () => jumpToDate(btn.dataset.jump));
        });
      }
    }

    drawEvents();
    Sync.onChange(drawEvents);

    // ---- Ô nhập + dropdown gợi ý tự vẽ (thay cho phần tử datalist gốc, để chạm được trên di động) ----
    const addBtn = container.querySelector(`#${addBtnId}`);
    const addRow = container.querySelector(`#${inputRowId}`);
    const addInput = container.querySelector(`#${inputId}`);
    const addSave = container.querySelector(`#${saveId}`);
    const dropdown = container.querySelector(`#${dropdownId}`);

    function closeDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
    }

    function openDropdown() {
      const query = addInput.value.trim().toLowerCase();
      const names = allEventNames().filter(n => !query || n.toLowerCase().includes(query));
      if (names.length === 0) { closeDropdown(); return; }

      dropdown.innerHTML = names.map(n => `<button type="button" class="event-dropdown-item" data-suggest="${escapeHtml(n)}"><i class="ti ti-history" aria-hidden="true"></i>${escapeHtml(n)}</button>`).join('');
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('[data-suggest]').forEach(item => {
        // mousedown thay vì click: chạy TRƯỚC sự kiện blur của input,
        // nếu không input sẽ mất focus và đóng dropdown trước khi kịp chọn.
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          addInput.value = item.dataset.suggest;
          closeDropdown();
        });
      });
    }

    addBtn.addEventListener('click', () => {
      const showing = addRow.style.display !== 'none';
      addRow.style.display = showing ? 'none' : 'flex';
      if (!showing) addInput.focus();
    });

    addInput.addEventListener('focus', openDropdown);
    addInput.addEventListener('input', openDropdown);
    addInput.addEventListener('blur', () => setTimeout(closeDropdown, 150));

    function submitEvent() {
      const name = addInput.value.trim();
      if (!name) return;
      Sync.addEvent(dateStr, name);
      addInput.value = '';
      closeDropdown();
      addRow.style.display = 'none';
    }
    addSave.addEventListener('click', submitEvent);
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitEvent(); });
  }

  return { render };
})();
