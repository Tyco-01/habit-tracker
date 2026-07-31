// ============================================================
// views/trash.js — Màn "Thùng rác" riêng biệt: các habit đã xoá,
// giữ 30 ngày trước khi mất vĩnh viễn. Tách khỏi màn "Hôm nay" để
// không làm rối giao diện chính, và để trạng thái mở/đóng rõ ràng
// hơn (là 1 tab hẳn hoi, không phải panel ẩn/hiện dễ gây nhầm lẫn).
// ============================================================

const TrashView = (() => {

  const RETENTION_DAYS = 30;

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

  function render(container) {
    function draw() {
      const trashed = trashList();

      container.innerHTML = `
        <div class="today-header">
          <p class="today-date">Việc đã xoá, giữ tối đa ${RETENTION_DAYS} ngày</p>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <h3 class="today-title" style="margin:0;">Thùng rác</h3>
          ${trashed.length > 0 ? `<button class="pill-btn" id="trash-clear-btn"><i class="ti ti-trash-x" style="font-size:12px;" aria-hidden="true"></i> Dọn sạch</button>` : ''}
        </div>
        <div id="trash-list"></div>
      `;

      const listEl = container.querySelector('#trash-list');

      if (trashed.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <i class="ti ti-trash-off" style="font-size:28px;display:block;margin:0 auto 10px;" aria-hidden="true"></i>
            <p>Thùng rác trống.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = trashed.map(t => `
        <div class="event-row">
          <span class="event-name" style="text-decoration:line-through;color:var(--mute);">${DomUtils.escapeHtml(t.name)}</span>
          <span style="font-size:11px;color:var(--mute);margin-right:8px;white-space:nowrap;">còn ${t.daysLeft} ngày</span>
          <button class="pill-btn" data-restore="${t.id}" style="border-radius:8px;flex-shrink:0;">Khôi phục</button>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', () => {
          Sync.restoreHabit(btn.dataset.restore);
        });
      });

      const clearBtn = container.querySelector('#trash-clear-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
          const ok = await ConfirmModal.show({
            title: 'Dọn sạch thùng rác?',
            body: `Toàn bộ ${trashed.length} việc trong thùng rác sẽ bị xoá VĨNH VIỄN, không thể khôi phục.`,
            confirmLabel: 'Xoá vĩnh viễn'
          });
          if (!ok) return;
          Sync.emptyTrash();
        });
      }
    }

    // Gỡ listener của lần render() trước (nếu có) — render() gọi lại mỗi
    // khi chuyển sang tab "Thùng rác", nếu không gỡ sẽ cộng dồn listener.
    if (container.__trashOnChange) Sync.offChange(container.__trashOnChange);
    container.__trashOnChange = draw;
    Sync.onChange(draw);
    draw();
  }

  return { render };
})();
