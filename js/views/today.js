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

  // Trạng thái kéo-thả: phân biệt "kéo để đổi thứ tự" (thả giữa 2 hàng)
  // với "kéo để làm con" (thả ngay lên giữa 1 hàng khác).
  let draggedId = null;
  let draggedRow = null; // tham chiếu DOM node đang kéo — dùng để bật/tắt
                          // hiệu ứng "sẽ tách ra" ngay trên chính nó khi
                          // con trỏ đang ở vùng không trúng habit nào khác.
  let globalDragBound = false; // đảm bảo listener kéo-thả cấp document
                                // (xem bindDragDropGlobal trong render())
                                // chỉ gắn đúng 1 lần cho toàn bộ vòng đời
                                // app, dù render() được gọi lại bao nhiêu
                                // lần (mỗi lần chuyển tab).

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

  function render(container) {
    const today = new Date();
    const todayKey = DateUtils.dateKey(today);
    const label = `${DateUtils.DAYS_VN[today.getDay()]}, ${today.getDate()} tháng ${today.getMonth() + 1}`;

    container.innerHTML = `
      <div class="today-header">
        <div class="today-heading-row">
          <h3 class="today-title">Hôm nay</h3>
          <p class="today-date">${label}</p>
        </div>
        <button class="icon-btn-round" id="add-habit-btn" aria-label="Thêm việc mới">
          <i class="ti ti-plus" style="font-size:15px;" aria-hidden="true"></i>
        </button>
      </div>
      <div class="input-row anim-collapse" id="add-habit-row">
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

    EventSection.render(container.querySelector('#event-section-today'), todayKey, { idPrefix: 'today', showHistory: true });

    function habitRowHtml(h, isChild) {
      const { checks } = Sync.getData();
      const checked = !!(checks[h.id] && checks[h.id][todayKey]);
      const state = TreeIcons.growthState(checks[h.id], today);
      const treeHtml = TreeIcons.render(state);
      const noteActive = HabitNotePanel.hasAnyNote(h.id, todayKey);

      return `
        <div class="habit-row ${isChild ? 'habit-row-child' : ''}" draggable="true" data-habit-id="${h.id}" title="Kéo để đổi thứ tự, hoặc thả vào 1 việc khác để nhóm lại">
          <button class="check-btn ${checked ? 'checked' : ''}" data-habit="${h.id}" aria-label="Đánh dấu ${DomUtils.escapeHtml(h.name)}">
            ${checked ? '<i class="ti ti-check" style="font-size:13px;color:var(--paper);" aria-hidden="true"></i>' : ''}
          </button>
          <span class="habit-name ${checked ? 'done' : ''}" data-edit="${h.id}" title="Bấm để sửa tên">${DomUtils.escapeHtml(h.name)}</span>
          <span class="habit-streak">${treeHtml}${state.displayDays > 0 ? state.displayDays : ''}</span>
          ${HabitNotePanel.noteHintHtml(h.id, todayKey)}
          <button class="note-btn ${noteActive ? 'note-btn-active' : ''}" data-note="${h.id}" aria-label="Ghi chú cho ${DomUtils.escapeHtml(h.name)}" title="Ghi chú">
            <i class="ti ti-note" style="font-size:14px;" aria-hidden="true"></i>
          </button>
          <button class="remove-btn" data-remove="${h.id}" aria-label="Xoá ${DomUtils.escapeHtml(h.name)}">
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
      bindDragDropRows();
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
        btn.addEventListener('click', async () => {
          const habit = habits.find(h => h.id === btn.dataset.remove);
          const name = habit ? habit.name : 'việc này';
          const ok = await ConfirmModal.show({
            title: `Chuyển "${name}" vào thùng rác?`,
            body: 'Việc sẽ được giữ 30 ngày trong thùng rác trước khi xoá hẳn. Nếu đây là việc cha, các việc con của nó sẽ được tách ra thành việc độc lập.',
            confirmLabel: 'Chuyển vào thùng rác'
          });
          if (!ok) return;
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
            HabitNotePanel.render(panel, habitId, todayKey);
          }
        });
      });
    }

    function bindDragDropRows() {
      listEl.querySelectorAll('.habit-row').forEach(row => {
        row.addEventListener('dragstart', (e) => {
          draggedId = row.dataset.habitId;
          draggedRow = row;
          row.classList.add('dragging');
          e.stopPropagation();
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging', 'will-detach');
          listEl.querySelectorAll('.drag-over-child, .drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-child', 'drag-over-top', 'drag-over-bottom');
          });
          draggedId = null;
          draggedRow = null;
        });
        // Chia chiều cao dòng thành 3 vùng để phân biệt Ý ĐỊNH khi thả:
        //   - 1/4 trên & 1/4 dưới: "chèn trước/sau dòng này" — CHỈ đổi
        //     thứ tự, không đổi parentId (bug đã sửa ở đây: bản vá
        //     trước chỉ còn 1 hành động duy nhất khi thả trúng dòng
        //     khác — luôn gộp cha-con — nên đổi thứ tự trên/dưới
        //     không còn hoạt động được nữa).
        //   - 1/2 giữa: "thả vào trong" — gộp làm cha-con (hành vi cũ).
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (row.dataset.habitId === draggedId) return;
          const rect = row.getBoundingClientRect();
          const ratio = (e.clientY - rect.top) / rect.height;
          row.classList.remove('drag-over-child', 'drag-over-top', 'drag-over-bottom');
          if (ratio < 0.25) {
            row.classList.add('drag-over-top');
          } else if (ratio > 0.75) {
            row.classList.add('drag-over-bottom');
          } else {
            row.classList.add('drag-over-child');
          }
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over-child', 'drag-over-top', 'drag-over-bottom');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const wasTop = row.classList.contains('drag-over-top');
          const wasBottom = row.classList.contains('drag-over-bottom');
          row.classList.remove('drag-over-child', 'drag-over-top', 'drag-over-bottom');
          const targetId = row.dataset.habitId;
          if (!draggedId || draggedId === targetId) return;

          const { habits } = Sync.getData();
          const byId = {};
          habits.forEach(h => { byId[h.id] = h; });

          // Chặn thả draggedId vào 1 hậu duệ (con/cháu...) của chính nó —
          // nếu không, cha sẽ trở thành con của con mình, tạo vòng lặp
          // tham chiếu vô hạn khiến buildTree() không tìm được gốc và
          // TOÀN BỘ habit liên quan biến mất khỏi màn hình (đã xảy ra
          // thật, xem lịch sử: kéo "abc" thả vào "thiền" là con của "abc").
          function isDescendantOf(candidateId, ancestorId) {
            let cur = byId[candidateId];
            let guard = 0;
            while (cur && cur.parentId && guard < 20) {
              if (cur.parentId === ancestorId) return true;
              cur = byId[cur.parentId];
              guard++;
            }
            return false;
          }

          if (wasTop || wasBottom) {
            // Đổi thứ tự — giữ nguyên parentId hiện tại của draggedId,
            // chỉ chèn nó trước/sau targetId trong danh sách sortedHabits
            // toàn cục rồi ghi lại sortOrder tuần tự.
            const ordered = sortedHabits(habits).map(h => h.id).filter(id => id !== draggedId);
            const targetIdx = ordered.indexOf(targetId);
            const insertAt = wasTop ? targetIdx : targetIdx + 1;
            ordered.splice(insertAt, 0, draggedId);
            Sync.reorderHabits(ordered);
          } else {
            if (isDescendantOf(targetId, draggedId)) return;
            Sync.setHabitParent(draggedId, targetId);
          }
        });
      });
    }

    // Tách ra: thay vì chỉ nhận "thả đúng khoảng trống trong listEl"
    // (quá khó canh bằng chuột, khoảng trống giữa 2 dòng chỉ vài px),
    // nghe drop trên toàn document — bất kỳ điểm thả nào KHÔNG trúng
    // vào 1 .habit-row khác đều coi là "kéo ra ngoài" và tự tách.
    //
    // PHẢI CHỈ GẮN ĐÚNG 1 LẦN TRONG TOÀN BỘ VÒNG ĐỜI APP — không phải
    // 1 lần mỗi khi render() chạy. render() chạy lại mỗi khi người
    // dùng chuyển sang tab khác rồi quay lại tab "Hôm nay" (xem
    // app.js), nên nếu gắn ở đây, listener trên `document` sẽ CỘNG
    // DỒN vĩnh viễn — bug thật đã có: sau N lần vào lại tab "Hôm nay",
    // 1 lượt kéo-thả sẽ gọi setHabitParent N lần trùng lặp. Dùng cờ
    // module-level (globalDragBound) để đảm bảo chỉ chạy phần gắn
    // listener đúng 1 lần, dù render() được gọi bao nhiêu lần.
    if (!globalDragBound) {
      globalDragBound = true;
      document.addEventListener('dragover', (e) => {
        if (!draggedId) return;
        const overRow = e.target.closest('.habit-row');
        if (!overRow) {
          e.preventDefault();
          // Đang ở vùng sẽ tách ra — hiện hiệu ứng ngay trên dòng đang
          // kéo, đối xứng với hiệu ứng "sẽ gộp vào" (drag-over-child)
          // hiện lên trên dòng đích khi kéo-vào.
          if (draggedRow) draggedRow.classList.add('will-detach');
        } else if (draggedRow) {
          draggedRow.classList.remove('will-detach');
        }
      });
      document.addEventListener('drop', (e) => {
        if (!draggedId) return;
        if (e.target.closest('.habit-row')) return;
        e.preventDefault();
        Sync.setHabitParent(draggedId, null);
      });
    }

    // Mỗi lần render() được gọi lại (vd chuyển tab rồi quay lại), phải gỡ
    // listener của LẦN RENDER TRƯỚC trước khi đăng ký cái mới — nếu không,
    // listener cũ vẫn trỏ vào DOM đã bị thay thế nhưng vẫn chạy mỗi khi có
    // thay đổi dữ liệu, tích luỹ dần theo số lần chuyển tab (memory leak +
    // chạy draw() nhiều lần dư thừa).
    if (container.__todayOnChange) Sync.offChange(container.__todayOnChange);
    container.__todayOnChange = draw;
    Sync.onChange(draw);
    draw();

    const addBtn = container.querySelector('#add-habit-btn');
    const addRow = container.querySelector('#add-habit-row');
    const addInput = container.querySelector('#add-habit-input');
    const addSave = container.querySelector('#add-habit-save');

    addBtn.addEventListener('click', () => {
      const showing = addRow.classList.contains('is-open');
      addRow.classList.toggle('is-open', !showing);
      if (!showing) addInput.focus();
    });

    function submitAdd() {
      const name = addInput.value.trim();
      if (!name) return;
      Sync.addHabit(name);
      addInput.value = '';
      addRow.classList.remove('is-open');
    }
    addSave.addEventListener('click', submitAdd);
    addInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAdd(); });
  }

  return { render };
})();
