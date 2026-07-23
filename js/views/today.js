// ============================================================
// views/today.js — Màn "Hôm nay": danh sách việc lặp lại để tick.
// Hỗ trợ: kéo-thả đổi thứ tự, bấm vào tên để sửa, xoá vào Thùng rác
// (giữ 30 ngày trước khi xoá vĩnh viễn — xem trash.js).
// ============================================================

const TodayView = (() => {

  const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  let draggedId = null;

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Habit luôn hiện theo đúng sortOrder đã lưu — không phụ thuộc thứ tự
  // mảng trả về từ server (vốn có thể xáo trộn khi tải lại/đồng bộ).
  function sortedHabits(habits) {
    return [...habits].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  function render(container) {
    const today = new Date();
    const todayKey = dateKey(today);
    const label = `${DAYS_VN[today.getDay()]}, ${today.getDate()} tháng ${today.getMonth() + 1}`;

    container.innerHTML = `
      <div class="today-header">
        <p class="today-date">${label}</p>
        <div style="display:flex;gap:8px;">
          <button class="icon-btn-round" id="trash-btn" aria-label="Thùng rác">
            <i class="ti ti-trash" style="font-size:14px;" aria-hidden="true"></i>
          </button>
          <button class="icon-btn-round" id="add-habit-btn" aria-label="Thêm việc mới">
            <i class="ti ti-plus" style="font-size:15px;" aria-hidden="true"></i>
          </button>
        </div>
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

      <div id="trash-panel" style="display:none;"></div>
    `;

    const listEl = container.querySelector('#habit-list');
    const emptyEl = container.querySelector('#empty-state');
    const trashPanel = container.querySelector('#trash-panel');
    const trashBtn = container.querySelector('#trash-btn');

    // Sự kiện riêng cho hôm nay — dùng module chung với màn chi tiết ngày,
    // không hiện phần "Lịch sử" ở đây để giữ màn Hôm nay gọn gàng.
    EventSection.render(container.querySelector('#event-section-today'), todayKey, { idPrefix: 'today', withHistory: false });

    function draw() {
      const { habits, checks } = Sync.getData();
      const ordered = sortedHabits(habits);

      if (ordered.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }
      listEl.style.display = 'block';
      emptyEl.style.display = 'none';

      listEl.innerHTML = ordered.map(h => {
        const checked = !!(checks[h.id] && checks[h.id][todayKey]);
        const state = TreeIcons.growthState(checks[h.id], today);
        const treeHtml = TreeIcons.render(state);
        return `
          <div class="habit-row" draggable="true" data-habit-id="${h.id}">
            <span class="drag-handle" aria-hidden="true" title="Kéo để đổi thứ tự">
              <i class="ti ti-grip-vertical" style="font-size:15px;"></i>
            </span>
            <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${escapeHtml(h.name)}">
              ${checked ? '<i class="ti ti-check" style="font-size:13px;color:var(--paper);" aria-hidden="true"></i>' : ''}
            </button>
            <span class="habit-name ${checked ? 'done' : ''}" data-edit="${h.id}" title="Bấm để sửa tên">${escapeHtml(h.name)}</span>
            <span class="habit-streak">${treeHtml}${state.displayDays > 0 ? state.displayDays : ''}</span>
            <button class="remove-btn" data-remove="${h.id}" aria-label="Xoá ${escapeHtml(h.name)}">
              <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
            </button>
          </div>
        `;
      }).join('');

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
          const habit = ordered.find(h => h.id === btn.dataset.remove);
          const name = habit ? habit.name : 'việc này';
          const confirmed = confirm(`Chuyển "${name}" vào thùng rác?\n\nViệc sẽ được giữ 30 ngày trong thùng rác trước khi xoá hẳn — bạn có thể khôi phục lại trong thời gian đó.`);
          if (!confirmed) return;
          Sync.removeHabit(btn.dataset.remove);
        });
      });

      // Bấm vào tên việc để sửa tại chỗ (inline edit)
      listEl.querySelectorAll('[data-edit]').forEach(span => {
        span.addEventListener('click', () => {
          const habitId = span.dataset.edit;
          const habit = ordered.find(h => h.id === habitId);
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
              draw(); // không đổi hoặc rỗng — vẽ lại như cũ
            }
          }

          input.addEventListener('blur', commit);
          input.addEventListener('keydown', e => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') { input.value = habit.name; input.blur(); }
          });
        });
      });

      // ---- Kéo-thả để đổi thứ tự (HTML5 Drag & Drop, không cần thư viện ngoài) ----
      listEl.querySelectorAll('.habit-row').forEach(row => {
        row.addEventListener('dragstart', () => {
          draggedId = row.dataset.habitId;
          row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          draggedId = null;
        });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (row.dataset.habitId === draggedId) return;
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('drag-over');
          const targetId = row.dataset.habitId;
          if (!draggedId || draggedId === targetId) return;

          const currentIds = ordered.map(h => h.id);
          const fromIdx = currentIds.indexOf(draggedId);
          const toIdx = currentIds.indexOf(targetId);
          if (fromIdx === -1 || toIdx === -1) return;

          currentIds.splice(fromIdx, 1);
          currentIds.splice(toIdx, 0, draggedId);
          Sync.reorderHabits(currentIds);
        });
      });
    }
    Sync.onChange(draw);
    draw();

    // ---- Thùng rác ----
    const RETENTION_DAYS = 30;
    let trashOpen = false;

    function trashList() {
      const { archivedHabits } = Sync.getData();
      const now = Date.now();
      return (archivedHabits || [])
        .map(h => {
          const elapsedDays = Math.floor((now - h.archivedAt) / 86400000);
          const daysLeft = Math.max(0, RETENTION_DAYS - elapsedDays);
          return { id: h.id, name: h.name, daysLeft };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft);
    }

    function drawTrash() {
      const trashed = trashList();
      const html = `
        <div style="border-top:1px solid var(--line);margin-top:20px;padding-top:16px;">
          <div class="section-header-row">
            <p class="section-label" style="margin:0;">THÙNG RÁC (giữ 30 ngày)</p>
            ${trashed.length > 0 ? `<button class="pill-btn" id="trash-clear-btn"><i class="ti ti-trash-x" style="font-size:12px;" aria-hidden="true"></i> Dọn sạch</button>` : ''}
          </div>
          ${trashed.length === 0
            ? `<p style="font-size:13px;color:var(--mute);margin:0;">Thùng rác trống.</p>`
            : trashed.map(t => `
              <div class="event-row">
                <span class="event-name" style="text-decoration:line-through;color:var(--mute);">${escapeHtml(t.name)}</span>
                <span style="font-size:11px;color:var(--mute);margin-right:8px;">còn ${t.daysLeft} ngày</span>
                <button class="pill-btn" data-restore="${t.id}" style="border-radius:8px;">Khôi phục</button>
              </div>
            `).join('')
          }
        </div>
      `;
      trashPanel.innerHTML = html;

      trashPanel.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', () => {
          Sync.restoreHabit(btn.dataset.restore);
          drawTrash();
        });
      });

      const clearBtn = trashPanel.querySelector('#trash-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const confirmed = confirm(`Dọn sạch thùng rác?\n\nToàn bộ ${trashed.length} việc trong thùng rác sẽ bị xoá VĨNH VIỄN, không thể khôi phục. Bạn có chắc chắn không?`);
          if (!confirmed) return;
          Sync.emptyTrash();
          drawTrash();
        });
      }
    }

    trashBtn.addEventListener('click', () => {
      trashOpen = !trashOpen;
      trashPanel.style.display = trashOpen ? 'block' : 'none';
      if (trashOpen) drawTrash();
    });
    Sync.onChange(() => { if (trashOpen) drawTrash(); });

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
