// ============================================================
// views/today.js — Màn "Hôm nay": danh sách việc lặp lại để tick.
//
// Hỗ trợ:
//   - Kéo-thả đổi thứ tự (kéo lên/xuống giữa các việc CÙNG CẤP)
//   - Kéo 1 việc THẢ VÀO GIỮA 1 việc khác → biến thành "việc con"
//     (thụt vào, nhóm dưới việc cha). Kéo con RA ngoài khu vực cha
//     (thả vào vùng gốc) → tách trở lại thành việc độc lập.
//   - Bấm vào tên để sửa tại chỗ (giữ nguyên lịch sử/streak)
//   - Ghi chú cho mỗi việc — 2 dạng, chuyển đổi bằng 1 nút màu:
//       màu thường = ghi chú CHUNG (áp dụng mọi ngày)
//       màu nhấn   = ghi chú RIÊNG cho đúng hôm nay
//   - Xoá vào Thùng rác (xem views/trash.js — đã tách thành tab riêng)
//
// Thùng rác KHÔNG còn nằm trong file này (đã tách sang trash.js).
// ============================================================

const TodayView = (() => {

  const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  // Trạng thái kéo-thả: phân biệt "kéo để đổi thứ tự" (thả giữa 2 hàng)
  // với "kéo để làm con" (thả ngay lên giữa 1 hàng khác).
  let draggedId = null;

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sortedHabits(habits) {
    return [...habits].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  // Xây cấu trúc cây: việc gốc (không có parentId) kèm mảng con của nó.
  // Con của con (2 cấp lồng nhau) không hỗ trợ — quy về cấp con của
  // gốc gần nhất, tránh lồng vô hạn gây khó hiểu.
  function buildTree(habits) {
    const ordered = sortedHabits(habits);
    const byId = {};
    ordered.forEach(h => { byId[h.id] = h; });

    function rootOf(h) {
      let cur = h;
      let guard = 0;
      while (cur.parentId && byId[cur.parentId] && guard < 10) {
        cur = byId[cur.parentId];
        guard++;
      }
      return cur.id;
    }

    const roots = [];
    const childrenOf = {};
    ordered.forEach(h => {
      if (!h.parentId || !byId[h.parentId]) {
        roots.push(h);
      } else {
        const rootId = rootOf(byId[h.parentId]);
        if (!childrenOf[rootId]) childrenOf[rootId] = [];
        childrenOf[rootId].push(h);
      }
    });

    return { roots, childrenOf };
  }

  function getNote(habitId, todayKey) {
    const { habitNotes } = Sync.getData();
    const entry = habitNotes[habitId];
    if (!entry) return { general: '', daily: '', hasGeneral: false, hasDaily: false };
    return {
      general: entry.general || '',
      daily: entry.byDate[todayKey] || '',
      hasGeneral: !!entry.general,
      hasDaily: !!entry.byDate[todayKey]
    };
  }

  function render(container) {
    const today = new Date();
    const todayKey = dateKey(today);
    const label = `${DAYS_VN[today.getDay()]}, ${today.getDate()} tháng ${today.getMonth() + 1}`;

    container.innerHTML = `
      <div class="today-header">
        <p class="today-date">${label}</p>
        <button class="icon-btn-round" id="add-habit-btn" aria-label="Thêm việc mới">
          <i class="ti ti-plus" style="font-size:15px;" aria-hidden="true"></i>
        </button>
      </div>
      <h3 class="today-title">Hôm nay</h3>
      <div class="input-row" id="add-habit-row" style="display:none;">
        <input type="text" id="add-habit-input" placeholder="ví dụ: tập thể dục" maxlength="60" />
        <button id="add-habit-save">Lưu</button>
      </div>
      <div id="habit-list"></div>
      <div class="empty-state" id="empty-state" style="display:none;">
        <i class="ti ti-checklist" style="font-size:28px;display:block;margin:0 auto 10px;" aria-hidden="true"></i>
        <p>Chưa có việc nào</p>
      </div>

      <div style="border-top:1px solid var(--line);margin-top:20px;padding-top:16px;" id="event-section-today"></div>
    `;

    const listEl = container.querySelector('#habit-list');
    const emptyEl = container.querySelector('#empty-state');

    EventSection.render(container.querySelector('#event-section-today'), todayKey, { idPrefix: 'today', withHistory: true, compactHistory: true });

    function habitRowHtml(h, isChild) {
      const { checks } = Sync.getData();
      const checked = !!(checks[h.id] && checks[h.id][todayKey]);
      const state = TreeIcons.growthState(checks[h.id], today);
      const treeHtml = TreeIcons.render(state);
      const note = getNote(h.id, todayKey);
      const noteActive = note.hasDaily || note.hasGeneral;

      return `
        <div class="habit-row ${isChild ? 'habit-row-child' : ''}" draggable="true" data-habit-id="${h.id}">
          <span class="drag-handle" aria-hidden="true" title="Kéo để đổi thứ tự, hoặc thả vào 1 việc khác để nhóm lại">
            <i class="ti ti-grip-vertical" style="font-size:15px;"></i>
          </span>
          <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${escapeHtml(h.name)}">
            ${checked ? '<i class="ti ti-check" style="font-size:13px;color:var(--paper);" aria-hidden="true"></i>' : ''}
          </button>
          <span class="habit-name ${checked ? 'done' : ''}" data-edit="${h.id}" title="Bấm để sửa tên">${escapeHtml(h.name)}</span>
          <span class="habit-streak">${treeHtml}${state.displayDays > 0 ? state.displayDays : ''}</span>
          <button class="note-btn ${noteActive ? 'note-btn-active' : ''}" data-note="${h.id}" aria-label="Ghi chú cho ${escapeHtml(h.name)}" title="Ghi chú">
            <i class="ti ti-note" style="font-size:14px;" aria-hidden="true"></i>
          </button>
          <button class="remove-btn" data-remove="${h.id}" aria-label="Xoá ${escapeHtml(h.name)}">
            <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
          </button>
        </div>
        <div class="habit-note-panel" id="note-panel-${h.id}" style="display:none;"></div>
      `;
    }

    function draw() {
      const { habits } = Sync.getData();

      if (habits.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }
      listEl.style.display = 'block';
      emptyEl.style.display = 'none';

      const { roots, childrenOf } = buildTree(habits);

      listEl.innerHTML = roots.map(h => {
        const children = childrenOf[h.id] || [];
        return `
          <div class="habit-group" data-group-root="${h.id}">
            ${habitRowHtml(h, false)}
            <div class="habit-children" data-children-of="${h.id}">
              ${children.map(c => habitRowHtml(c, true)).join('')}
            </div>
          </div>
        `;
      }).join('');

      bindRowEvents();
      bindDragDrop();
    }

    function bindRowEvents() {
      const { habits } = Sync.getData();

      listEl.querySelectorAll('.check-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const habitId = btn.dataset.habit;
          const { checks } = Sync.getData();
          const isChecked = !!(checks[habitId] && checks[habitId][todayKey]);
          Sync.setCheck(habitId, todayKey, !isChecked);
        });
      });

      listEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          const habit = habits.find(h => h.id === btn.dataset.remove);
          const name = habit ? habit.name : 'việc này';
          const confirmed = confirm(`Chuyển "${name}" vào thùng rác?\n\nViệc sẽ được giữ 30 ngày trong thùng rác trước khi xoá hẳn. Nếu đây là việc cha, các việc con của nó sẽ được tách ra thành việc độc lập.`);
          if (!confirmed) return;
          Sync.removeHabit(btn.dataset.remove);
        });
      });

      listEl.querySelectorAll('[data-edit]').forEach(span => {
        span.addEventListener('click', () => {
          const habitId = span.dataset.edit;
          const habit = habits.find(h => h.id === habitId);
          if (!habit) return;

          const input = document.createElement('input');
          input.type = 'text';
          input.value = habit.name;
          input.maxLength = 60;
          input.className = 'inline-edit-input';

          span.replaceWith(input);
          input.focus();
          input.select();

          let committed = false;
          function commit() {
            if (committed) return;
            committed = true;
            const newName = input.value.trim();
            if (newName && newName !== habit.name) {
              Sync.renameHabit(habitId, newName);
            } else {
              draw();
            }
          }

          input.addEventListener('blur', commit);
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') { input.value = habit.name; input.blur(); }
          });
        });
      });

      listEl.querySelectorAll('[data-note]').forEach(btn => {
        btn.addEventListener('click', () => {
          const habitId = btn.dataset.note;
          const panel = container.querySelector(`#note-panel-${habitId}`);
          if (!panel) return;
          const isOpen = panel.style.display !== 'none';
          container.querySelectorAll('.habit-note-panel').forEach(p => { p.style.display = 'none'; });
          if (!isOpen) {
            panel.style.display = 'block';
            renderNotePanel(panel, habitId);
          }
        });
      });
    }

    function renderNotePanel(panel, habitId) {
      let showingDaily = true;

      function draw() {
        const note = getNote(habitId, todayKey);
        const content = showingDaily ? note.daily : note.general;

        panel.innerHTML = `
          <div class="note-toggle-row">
            <button class="note-toggle ${showingDaily ? 'note-toggle-daily' : 'note-toggle-general'}" id="note-mode-btn">
              <i class="ti ${showingDaily ? 'ti-calendar-event' : 'ti-repeat'}" style="font-size:12px;" aria-hidden="true"></i>
              ${showingDaily ? 'Riêng hôm nay' : 'Chung mọi ngày'}
            </button>
            <span class="note-toggle-hint">Bấm để đổi loại ghi chú</span>
          </div>
          <textarea class="note-textarea" placeholder="${showingDaily ? 'Ghi chú chỉ áp dụng cho hôm nay...' : 'Ghi chú áp dụng cho mọi ngày...'}" maxlength="1000" rows="2">${escapeHtml(content)}</textarea>
        `;

        const modeBtn = panel.querySelector('#note-mode-btn');
        const textarea = panel.querySelector('.note-textarea');

        modeBtn.addEventListener('click', () => {
          showingDaily = !showingDaily;
          draw();
        });

        textarea.addEventListener('blur', () => {
          const newVal = textarea.value.trim();
          const dateArg = showingDaily ? todayKey : null;
          const currentVal = showingDaily ? note.daily : note.general;
          if (newVal !== currentVal) {
            Sync.setHabitNote(habitId, dateArg, newVal);
          }
        });
      }
      draw();
    }

    function bindDragDrop() {
      listEl.querySelectorAll('.habit-row').forEach(row => {
        row.addEventListener('dragstart', (e) => {
          draggedId = row.dataset.habitId;
          row.classList.add('dragging');
          e.stopPropagation();
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          listEl.querySelectorAll('.drag-over-child').forEach(el => el.classList.remove('drag-over-child'));
          draggedId = null;
        });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (row.dataset.habitId === draggedId) return;
          row.classList.add('drag-over-child');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over-child');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('drag-over-child');
          const targetId = row.dataset.habitId;
          if (!draggedId || draggedId === targetId) return;

          const { habits } = Sync.getData();
          const targetHabit = habits.find(h => h.id === targetId);
          if (targetHabit && targetHabit.parentId === draggedId) return;

          Sync.setHabitParent(draggedId, targetId);
        });
      });

      listEl.addEventListener('dragover', (e) => {
        if (e.target === listEl) e.preventDefault();
      });
      listEl.addEventListener('drop', (e) => {
        if (e.target !== listEl) return;
        e.preventDefault();
        if (!draggedId) return;
        Sync.setHabitParent(draggedId, null);
      });
    }

    Sync.onChange(draw);
    draw();

    const addBtn = container.querySelector('#add-habit-btn');
    const addRow = container.querySelector('#add-habit-row');
    const addInput = container.querySelector('#add-habit-input');
    const addSave = container.querySelector('#add-habit-save');

    addBtn.addEventListener('click', () => {
      const showing = addRow.style.display !== 'none';
      addRow.style.display = showing ? 'none' : 'flex';
      if (!showing) addInput.focus();
    });

    function submitAdd() {
      const name = addInput.value.trim();
      if (!name) return;
      Sync.addHabit(name);
      addInput.value = '';
      addRow.style.display = 'none';
    }
    addSave.addEventListener('click', submitAdd);
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAdd(); });
  }

  return { render };
})();
