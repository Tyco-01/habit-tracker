// ============================================================
// js/habit-range-modal.js — Modal sửa "phạm vi áp dụng" (validFrom)
// của 1 habit ĐANG hoạt động. Gọi từ views/day-detail.js (nút "Sửa
// phạm vi áp dụng" trên mỗi habit, hoặc "Áp dụng cho ngày này" trên
// habit chưa áp dụng ngày đang xem).
//
// LUỒNG 2 BƯỚC (đã bàn kỹ trước khi code — xem lý do từng quyết định
// trong các comment bên dưới):
//   Bước 1 — chọn ngày bắt đầu áp dụng mới (hoặc "không giới hạn").
//     Nếu đây là MỞ RỘNG NGƯỢC (habit sẽ tính vào tổng của nhiều ngày
//     quá khứ hơn trước), hiện cảnh báo CỤ THỂ bằng số (N ngày ảnh
//     hưởng, M ngày sẽ tụt dưới 100%) trước khi cho xác nhận — dùng lại
//     ConfirmModal có sẵn, không cần overlay riêng cho bước này.
//   Bước 2 — CHỈ hiện nếu bước 1 mở rộng ngược vào ít nhất 1 ngày quá
//     khứ: hỏi habit này đã hoàn thành ở ngày nào trong khoảng mới được
//     tính thêm (chỉ tính tới hôm nay, KHÔNG đụng tới tương lai — tick
//     tương lai để tự nhiên, tick tay sau khi ngày đó tới thật). Tick
//     tay từng ngày qua checkbox (nhóm theo tháng) — KHÔNG có nút "tick
//     hết" ẩn ngầm tự động, để tránh lỡ tay khai báo hàng loạt "đã làm"
//     cho những ngày thực ra chưa làm. Huỷ ở bước này KHÔNG hoàn tác lại
//     validFrom đã áp dụng ở bước 1 — coi bước 2 là bổ sung tuỳ chọn,
//     không phải điều kiện của bước 1.
// ============================================================

const HabitRangeModal = (() => {

  let overlayEl = null;
  const CLOSE_ANIM_MS = 180; // khớp confirm-modal.js — cùng 1 kiểu animation

  // Overlay là SINGLETON dùng lại qua nhiều lần open() (giống pattern
  // confirm-modal.js) — nếu mỗi bước (renderDatePickerStep/
  // renderChecklistStep) tự gắn listener 'click' riêng lên chính
  // overlay để bắt "bấm ra ngoài để đóng", listener sẽ CỘNG DỒN qua
  // từng lần mở modal (overlay không bị huỷ/tạo lại, chỉ đổi
  // innerHTML). Gắn ĐÚNG 1 LẦN ở đây, uỷ quyền cho biến
  // currentCloseHandler mà mỗi bước tự cập nhật — tránh lặp lại đúng
  // lớp bug "listener cộng dồn" đã có cơ chế phòng ở year.js/
  // day-detail.js (__yearOnChange/__dayDetailOnChange).
  let currentCloseHandler = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'confirm-modal-overlay range-modal-overlay';
    overlayEl.style.display = 'none';
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl && currentCloseHandler) currentCloseHandler();
    });
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('is-open');
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }, CLOSE_ANIM_MS);
  }

  function openOverlay(overlay) {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  }

  // "Ngày archive" hoá thành mốc kết-thúc — dùng lại đúng logic
  // HabitScope.isActiveOn nhưng tách riêng đếm ảnh hưởng ở đây (không
  // export từ habit-scope.js vì chỉ dùng nội bộ module này).
  function countImpact(rangeStart, rangeEnd, habitId, data) {
    let affected = 0;
    let willDrop = 0;
    for (let d = rangeStart; d <= rangeEnd; d = DateUtils.addDays(d, 1)) {
      const scopedBefore = HabitScope.habitsForDate(d, data); // habit CHƯA tính (validFrom chưa đổi)
      const totalBefore = scopedBefore.length;
      const checks = data.checks || {};
      const doneBefore = scopedBefore.filter(h => checks[h.id] && checks[h.id][d]).length;
      affected++;
      if (totalBefore > 0 && doneBefore === totalBefore) willDrop++;
    }
    return { affected, willDrop };
  }

  function formatShort(dateStr) {
    const d = DateUtils.parseDateStr(dateStr);
    return `${d.getDate()} ${DateUtils.MONTHS_SHORT_GRID[d.getMonth()]}, ${d.getFullYear()}`;
  }

  // Ngược lại countImpact() ở trên: đây là XOÁ BỚT phạm vi (validTo lùi
  // về quá khứ), nên % của những ngày bị ảnh hưởng chỉ có thể TĂNG
  // hoặc giữ nguyên, không bao giờ giảm — không cần cảnh báo "tụt %"
  // như khi mở rộng validFrom, thay vào đó báo tin vui "sẽ tăng lên
  // 100%" nếu có.
  function countRemovalImpact(rangeStart, rangeEnd, habitId, data) {
    let affected = 0;
    let newlyFull = 0;
    const checks = data.checks || {};
    for (let d = rangeStart; d <= rangeEnd; d = DateUtils.addDays(d, 1)) {
      const scopedBefore = HabitScope.habitsForDate(d, data); // habit VẪN đang tính (validTo chưa đổi)
      const totalBefore = scopedBefore.length;
      const doneBefore = scopedBefore.filter(h => checks[h.id] && checks[h.id][d]).length;
      const wasFull = totalBefore > 0 && doneBefore === totalBefore;

      const totalAfter = totalBefore - 1;
      const doneAfter = doneBefore - (checks[habitId] && checks[habitId][d] ? 1 : 0);
      const willBeFull = totalAfter > 0 && doneAfter === totalAfter;

      affected++;
      if (!wasFull && willBeFull) newlyFull++;
    }
    return { affected, newlyFull };
  }

  // Bước 2: checklist tick hồi tố, nhóm theo tháng qua <details> (native,
  // không cần JS riêng để mở/đóng) — tháng gần nhất mở sẵn, tháng cũ hơn
  // thu gọn, tránh cuộn dài vô tận khi khoảng ngày lớn (đã bàn — UI list
  // cần nhóm theo tuần/tháng nếu số ngày nhiều).
  function renderChecklistStep(overlay, { habit, rangeStart, rangeEnd, onDone }) {
    const groups = []; // [{ key: 'YYYY-MM', label, days: [dateStr,...] }]
    const byMonth = {};
    for (let d = rangeStart; d <= rangeEnd; d = DateUtils.addDays(d, 1)) {
      const monthKey = d.slice(0, 7);
      if (!byMonth[monthKey]) {
        const parts = DateUtils.parseDateStr(d);
        byMonth[monthKey] = { key: monthKey, label: `Tháng ${parts.getMonth() + 1}, ${parts.getFullYear()}`, days: [] };
        groups.push(byMonth[monthKey]);
      }
      byMonth[monthKey].days.push(d);
    }
    // Tháng gần hôm nay nhất mở sẵn, các tháng còn lại thu gọn.
    const lastGroupKey = groups.length > 0 ? groups[groups.length - 1].key : null;

    overlay.innerHTML = `
      <div class="range-modal-card" role="dialog" aria-modal="true" aria-labelledby="range-modal-title">
        <p class="confirm-modal-title" id="range-modal-title">"${DomUtils.escapeHtml(habit.name)}" đã hoàn thành ở ngày nào?</p>
        <p class="confirm-modal-body">Chỉ tính tới hôm nay. Không bắt buộc — có thể để trống rồi tick tay sau.</p>
        <div class="range-modal-checklist" id="range-modal-checklist">
          ${groups.map(g => `
            <details class="range-modal-month" ${g.key === lastGroupKey ? 'open' : ''}>
              <summary>${DomUtils.escapeHtml(g.label)} <span class="range-modal-month-count">(${g.days.length} ngày)</span></summary>
              ${g.days.map(d => {
                const parts = DateUtils.parseDateStr(d);
                return `
                  <label class="range-modal-day-row">
                    <input type="checkbox" data-day="${d}" />
                    <span>${DateUtils.DAYS_VN[parts.getDay()]}, ${parts.getDate()} ${DateUtils.MONTHS_SHORT_GRID[parts.getMonth()]}</span>
                  </label>
                `;
              }).join('')}
            </details>
          `).join('')}
        </div>
        <div class="confirm-modal-actions">
          <button class="confirm-modal-btn confirm-modal-btn-cancel" id="range-modal-skip">Bỏ qua</button>
          <button class="confirm-modal-btn confirm-modal-btn-ok" id="range-modal-done">Xong</button>
        </div>
      </div>
    `;

    function finish() {
      closeOverlay(overlay);
      if (onDone) onDone();
    }
    currentCloseHandler = finish;

    overlay.querySelector('#range-modal-skip').addEventListener('click', finish);
    overlay.querySelector('#range-modal-done').addEventListener('click', () => {
      const checked = [...overlay.querySelectorAll('input[type=checkbox][data-day]:checked')].map(el => el.dataset.day);
      checked.forEach(dateStr => Sync.setCheck(habit.id, dateStr, true));
      finish();
    });
  }

  // Bước 1: chọn ngày bắt đầu áp dụng.
  function renderDatePickerStep(overlay, { habit, contextDateStr, onDone }) {
    const oldValidFrom = habit.validFrom || null;
    const todayKey = DateUtils.dateKey(new Date());
    // Mặc định: nếu habit ĐÃ áp dụng cho contextDateStr (mở từ hàng
    // habit đang hiện), giữ nguyên ngày đang đặt (oldValidFrom) — người
    // dùng chỉ đang xem lại/chỉnh. Nếu habit CHƯA áp dụng (mở từ khối
    // "Việc khác", oldValidFrom muộn hơn contextDateStr), mặc định luôn
    // contextDateStr — đúng ý "áp dụng cho ngày đang xem", không phải
    // ngày cấu hình cũ (vốn muộn hơn, không giúp ích gì ở đây).
    const defaultValue = (oldValidFrom && oldValidFrom <= contextDateStr) ? oldValidFrom : contextDateStr;
    const statusText = oldValidFrom
      ? `Đang áp dụng từ ${formatShort(oldValidFrom)}.`
      : 'Đang áp dụng không giới hạn (từ trước tới giờ).';

    overlay.innerHTML = `
      <div class="range-modal-card" role="dialog" aria-modal="true" aria-labelledby="range-modal-title">
        <p class="confirm-modal-title" id="range-modal-title">Sửa phạm vi áp dụng "${DomUtils.escapeHtml(habit.name)}"</p>
        <p class="confirm-modal-body">${statusText}</p>
        <div class="range-modal-field">
          <label class="range-modal-label" for="range-modal-date">Áp dụng từ ngày</label>
          <input type="date" id="range-modal-date" class="range-modal-date-input" value="${defaultValue}" max="${todayKey}" />
        </div>
        <button class="pill-btn" id="range-modal-unlimited" style="margin-top:8px;">Không giới hạn (từ trước tới giờ)</button>
        <p class="range-modal-error" id="range-modal-error" style="display:none;"></p>
        <div class="confirm-modal-actions" style="margin-top:16px;">
          <button class="confirm-modal-btn confirm-modal-btn-cancel" id="range-modal-cancel">Huỷ</button>
          <button class="confirm-modal-btn confirm-modal-btn-ok" id="range-modal-continue">Tiếp tục</button>
        </div>
      </div>
    `;

    const dateInput = overlay.querySelector('#range-modal-date');
    const unlimitedBtn = overlay.querySelector('#range-modal-unlimited');
    const errorEl = overlay.querySelector('#range-modal-error');
    let unlimited = false;

    function syncUnlimitedUI() {
      unlimitedBtn.classList.toggle('active', unlimited);
      dateInput.disabled = unlimited;
    }

    unlimitedBtn.addEventListener('click', () => {
      unlimited = !unlimited;
      if (unlimited) dateInput.value = '';
      syncUnlimitedUI();
    });
    dateInput.addEventListener('input', () => {
      if (dateInput.value) { unlimited = false; syncUnlimitedUI(); }
    });

    function close() { closeOverlay(overlay); }
    currentCloseHandler = close;
    overlay.querySelector('#range-modal-cancel').addEventListener('click', close);

    overlay.querySelector('#range-modal-continue').addEventListener('click', async () => {
      const newValidFrom = unlimited ? null : (dateInput.value || null);
      if (!unlimited && !newValidFrom) {
        errorEl.textContent = 'Chọn 1 ngày, hoặc bấm "Không giới hạn".';
        errorEl.style.display = 'block';
        return;
      }

      const oldStart = oldValidFrom; // null = không giới hạn (sớm nhất có thể)
      const sameAsBefore = newValidFrom === oldStart;
      if (sameAsBefore) { close(); return; }

      const isExpandingBackward = newValidFrom === null || (oldStart !== null && newValidFrom < oldStart);

      if (!isExpandingBackward) {
        // Thu hẹp phạm vi (validFrom dời MUỘN hơn) — các ngày trước mốc
        // mới sẽ không còn tính habit này vào tổng nữa. Không cần bước
        // 2 (không có gì để tick thêm khi đang BỚT phạm vi).
        const ok = await ConfirmModal.show({
          title: `Thu hẹp phạm vi áp dụng "${habit.name}"?`,
          body: `Các ngày trước ${formatShort(newValidFrom)} sẽ không còn tính việc này vào tổng nữa.`,
          confirmLabel: 'Áp dụng'
        });
        if (!ok) return;
        Sync.setHabitValidFrom(habit.id, newValidFrom);
        close();
        if (onDone) onDone();
        return;
      }

      // Mở rộng ngược — tính phạm vi ngày MỚI được tính thêm, giới hạn
      // tới hôm nay (không đụng tương lai) và không lùi quá ngày sớm
      // nhất tracker THẬT SỰ có dữ liệu (không có gì để cảnh báo/tick
      // trước đó, chỉ tổ kéo dài vòng lặp vô ích).
      const data = Sync.getData();
      const rangeStart = newValidFrom || HabitScope.earliestTrackedDate(data);
      const rangeEndExclusiveBound = oldStart ? DateUtils.addDays(oldStart, -1) : todayKey;
      const rangeEnd = rangeEndExclusiveBound < todayKey ? rangeEndExclusiveBound : todayKey;

      if (rangeStart > rangeEnd) {
        // Không có ngày quá khứ nào thực sự bị ảnh hưởng (vd tracker
        // hoàn toàn chưa có dữ liệu trước đó) — áp dụng thẳng, không
        // cần cảnh báo hay checklist.
        Sync.setHabitValidFrom(habit.id, newValidFrom);
        close();
        if (onDone) onDone();
        return;
      }

      const { affected, willDrop } = countImpact(rangeStart, rangeEnd, habit.id, data);
      const ok = await ConfirmModal.show({
        title: `Áp dụng "${habit.name}" từ ${formatShort(rangeStart)}?`,
        body: `${affected} ngày trong quá khứ sẽ được tính thêm việc này vào tổng.` +
          (willDrop > 0 ? ` Trong đó ${willDrop} ngày đang đạt 100% sẽ tụt xuống dưới 100% (vì tổng tăng nhưng chưa tick việc mới cho ngày đó).` : ''),
        confirmLabel: 'Áp dụng'
      });
      if (!ok) return;

      Sync.setHabitValidFrom(habit.id, newValidFrom);
      // KHÔNG đóng overlay ở đây — chuyển thẳng sang bước 2 bằng cách
      // thay nội dung card ngay trong overlay đang mở, tránh phải
      // đóng/mở lại animation (dễ tạo race giữa timeout đóng cũ và mở
      // mới nếu tách rời 2 việc đó).
      renderChecklistStep(overlay, { habit, rangeStart, rangeEnd, onDone });
    });
  }

  // "Xoá thông minh" — thay cho ConfirmModal.show() đơn giản trước đây
  // ở today.js/day-detail.js. Cho chọn 2 chế độ:
  //   "Từ hôm nay"  — hành vi CŨ (validTo = hôm nay, không đụng lịch sử)
  //   "Cả quá khứ"  — chọn ngày ĐÃ NGỪNG THẬT, các ngày sau đó tới hôm
  //     nay được TÍNH LẠI (habit này không còn kéo tổng lên nữa) —
  //     không cần checklist bước 2 như luồng mở rộng validFrom, vì đây
  //     là XOÁ BỚT yêu cầu chứ không phải THÊM sự kiện cần khai báo lại.
  function renderDeleteChoiceStep(overlay, { habit, onDone }) {
    const todayKey = DateUtils.dateKey(new Date());
    const defaultPastDate = habit.validFrom && habit.validFrom > DateUtils.addDays(todayKey, -1)
      ? habit.validFrom
      : DateUtils.addDays(todayKey, -1);

    overlay.innerHTML = `
      <div class="range-modal-card" role="dialog" aria-modal="true" aria-labelledby="range-modal-title">
        <p class="confirm-modal-title" id="range-modal-title">Chuyển "${DomUtils.escapeHtml(habit.name)}" vào thùng rác?</p>
        <p class="confirm-modal-body">Việc sẽ được giữ 30 ngày trong thùng rác trước khi xoá hẳn. Nếu đây là việc cha, các việc con của nó sẽ được tách ra thành việc độc lập.</p>
        <div class="range-modal-choice">
          <label class="range-modal-choice-row">
            <input type="radio" name="range-modal-delete-mode" value="today" checked />
            <span><strong>Từ hôm nay</strong> — vẫn tính vào tổng của mọi ngày tới hôm nay, chỉ ngừng từ mai</span>
          </label>
          <label class="range-modal-choice-row">
            <input type="radio" name="range-modal-delete-mode" value="past" />
            <span><strong>Cả quá khứ</strong> — chọn ngày đã thực sự ngừng, các ngày sau đó được tính lại</span>
          </label>
        </div>
        <div class="range-modal-field" id="range-modal-delete-date-field" style="display:none;">
          <label class="range-modal-label" for="range-modal-delete-date">Vẫn tính tới hết ngày</label>
          <input type="date" id="range-modal-delete-date" class="range-modal-date-input" value="${defaultPastDate}" max="${todayKey}" ${habit.validFrom ? `min="${habit.validFrom}"` : ''} />
        </div>
        <div class="confirm-modal-actions" style="margin-top:16px;">
          <button class="confirm-modal-btn confirm-modal-btn-cancel" id="range-modal-cancel">Huỷ</button>
          <button class="confirm-modal-btn confirm-modal-btn-ok" id="range-modal-continue">Chuyển vào thùng rác</button>
        </div>
      </div>
    `;

    const dateField = overlay.querySelector('#range-modal-delete-date-field');
    const continueBtn = overlay.querySelector('#range-modal-continue');
    const modeRadios = overlay.querySelectorAll('input[name="range-modal-delete-mode"]');

    function syncMode() {
      const mode = overlay.querySelector('input[name="range-modal-delete-mode"]:checked').value;
      dateField.style.display = mode === 'past' ? 'block' : 'none';
      // "past" cần thêm 1 bước cảnh báo tác động trước khi thực sự xoá
      // (xem nhánh continue bên dưới) — đổi chữ nút để không hứa hẹn
      // "xoá ngay" trong khi thực ra còn 1 bước nữa.
      continueBtn.textContent = mode === 'past' ? 'Tiếp tục' : 'Chuyển vào thùng rác';
    }
    modeRadios.forEach(r => r.addEventListener('change', syncMode));

    function close() { closeOverlay(overlay); }
    currentCloseHandler = close;
    overlay.querySelector('#range-modal-cancel').addEventListener('click', close);

    continueBtn.addEventListener('click', async () => {
      const mode = overlay.querySelector('input[name="range-modal-delete-mode"]:checked').value;

      if (mode === 'today') {
        Sync.removeHabit(habit.id, todayKey);
        close();
        if (onDone) onDone();
        return;
      }

      const validTo = overlay.querySelector('#range-modal-delete-date').value;
      if (!validTo) return;

      const rangeStart = DateUtils.addDays(validTo, 1);
      const rangeEnd = todayKey;
      if (rangeStart > rangeEnd) {
        // Chọn đúng hôm nay (hoặc sau) — không có ngày quá khứ nào bị
        // ảnh hưởng, y hệt chế độ "Từ hôm nay". Xoá thẳng, khỏi hỏi
        // thêm cảnh báo cho 1 thay đổi rỗng.
        Sync.removeHabit(habit.id, validTo);
        close();
        if (onDone) onDone();
        return;
      }

      const data = Sync.getData();
      const { affected, newlyFull } = countRemovalImpact(rangeStart, rangeEnd, habit.id, data);
      const ok = await ConfirmModal.show({
        title: `Xoá "${habit.name}" kể từ sau ${formatShort(validTo)}?`,
        body: `${affected} ngày sau đó sẽ không còn tính việc này vào tổng nữa.` +
          (newlyFull > 0 ? ` Trong đó ${newlyFull} ngày sẽ tăng lên 100% hoàn thành.` : ''),
        confirmLabel: 'Xoá'
      });
      if (!ok) return;

      Sync.removeHabit(habit.id, validTo);
      close();
      if (onDone) onDone();
    });
  }

  // habit: object habit ĐANG hoạt động (data.habits, không phải
  // archivedHabits — xem giới hạn phạm vi trong HabitScope).
  // contextDateStr: ngày đang xem lúc mở modal (dùng làm gợi ý mặc định
  // khi habit chưa áp dụng ngày này).
  // onDone: gọi lại sau khi CÓ thay đổi thật sự được áp dụng (không gọi
  // nếu người dùng huỷ mà chưa đổi gì) — nơi gọi dùng để render() lại.
  function open(habit, contextDateStr, onDone) {
    const overlay = ensureOverlay();
    openOverlay(overlay);
    renderDatePickerStep(overlay, { habit, contextDateStr, onDone });
  }

  // Thay cho ConfirmModal.show() đơn giản khi bấm nút xoá 1 habit —
  // gọi từ views/today.js và views/day-detail.js. onDone gọi lại sau
  // khi THẬT SỰ xoá (bất kể chế độ nào), không gọi nếu người dùng huỷ.
  function confirmDelete(habit, onDone) {
    const overlay = ensureOverlay();
    openOverlay(overlay);
    renderDeleteChoiceStep(overlay, { habit, onDone });
  }

  return { open, confirmDelete };
})();
