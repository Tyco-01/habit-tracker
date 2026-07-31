// ============================================================
// event-section.js — Khối UI "Dấu ấn ngày này", dùng chung giữa màn
// "Hôm nay" và màn chi tiết 1 ngày, tránh lặp code. (Tên biến/hàm
// trong file này vẫn giữ "event" — chỉ tên hiển thị trên UI đổi
// thành "dấu ấn", đổi tên biến/hàm nội bộ không cần thiết và tăng
// rủi ro gõ nhầm khi sửa.)
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

  // options: { idPrefix (bắt buộc), compactHistory }
  //   compactHistory: nếu true, hiện lịch sử RÚT GỌN (3 lần gần nhất,
  //     bấm để nhảy tới) ngay dưới mỗi sự kiện. Trước đây còn có 1
  //     chế độ "lịch sử đầy đủ" riêng (withHistory) hiện thành khối
  //     lớn phía dưới — đã bỏ hẳn vì trùng lặp thông tin với compact
  //     history (cả 2 nơi hiển thị cùng dữ liệu, chỉ khác cách trình
  //     bày), gây rối mắt và không cần thiết.
  function render(container, dateStr, { idPrefix, compactHistory = false } = {}) {
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
        <p class="section-label" style="margin:0;">DẤU ẤN NGÀY NÀY</p>
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

    function formatShortDate(dateStr) {
      const d = parseDateStr(dateStr);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    }

    function drawEvents() {
      const { events } = Sync.getData();
      const evs = events[dateStr] || [];

      eventListEl.innerHTML = evs.length === 0
        ? `<p style="font-size:13px;color:var(--mute);margin:0;">Chưa có dấu ấn nào cho ngày này.</p>`
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
          const name = ev ? ev.name : 'dấu ấn này';
          const ok = await ConfirmModal.show({
            title: `Xoá "${name}"?`,
            body: 'Dấu ấn này sẽ bị xoá hẳn, không có thùng rác cho dấu ấn 1 lần.',
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

      dropdown.innerHTML = `<div class="event-dropdown-scroll">${names.map(n => `<button type="button" class="event-dropdown-chip" data-suggest="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')}</div>`;
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
