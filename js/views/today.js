// ============================================================
// views/today.js — Màn "Hôm nay": danh sách việc lặp lại để tick.
// ============================================================

const TodayView = (() => {

  const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
    `;

    const listEl = container.querySelector('#habit-list');
    const emptyEl = container.querySelector('#empty-state');

    function draw() {
      const { habits, checks } = Sync.getData();

      if (habits.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }
      listEl.style.display = 'block';
      emptyEl.style.display = 'none';

      listEl.innerHTML = habits.map(h => {
        const checked = !!(checks[h.id] && checks[h.id][todayKey]);
        const state = TreeIcons.growthState(checks[h.id], today);
        const treeHtml = TreeIcons.render(state);
        return `
          <div class="habit-row">
            <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${escapeHtml(h.name)}">
              ${checked ? '<i class="ti ti-check" style="font-size:13px;color:var(--paper);" aria-hidden="true"></i>' : ''}
            </button>
            <span class="habit-name ${checked ? 'done' : ''}">${escapeHtml(h.name)}</span>
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
          Sync.removeHabit(btn.dataset.remove);
        });
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render };
})();
