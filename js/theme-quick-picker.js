// ============================================================
// js/theme-quick-picker.js — Bảng nổi nhỏ chọn NHANH 1 trong 3 chế độ
// giao diện có sẵn (Theo hệ thống/Sáng/Tối), mở bằng NHẤN GIỮ nút
// #nav-theme (app.js) — khác hẳn bấm NGẮN (vẫn mở ThemeEditorModal
// đầy đủ như trước, xem app.js, không đổi hành vi đó).
//
// Thao tác: giữ nút → bảng 3 lựa chọn hiện NGAY PHÍA TRÊN nút → rê
// ngón tay (không rời mặt kính) qua từng lựa chọn, lựa chọn dưới ngón
// tay tự nổi bật lên → THẢ TAY để áp dụng ngay lựa chọn đang nổi bật.
// Giống hệt thao tác "quick action" kiểu iOS 3D Touch / menu ngữ cảnh
// giữ-rê-thả trên di động — không cần bấm thêm lần nào sau khi thả.
//
// KHÔNG DÙNG LongPress.bind() có sẵn (js/long-press.js) — module đó
// chỉ bắn callback ĐÚNG 1 LẦN khi đủ ngưỡng thời gian rồi thôi, không
// có cơ chế theo dõi pointermove SAU thời điểm đó để biết ngón tay
// đang ở trên lựa chọn nào. Cần tự quản lý pointermove xuyên suốt từ
// lúc kích hoạt tới lúc thả tay, nên viết luồng riêng ở đây thay vì
// gượng ép tái dùng.
// ============================================================

const ThemeQuickPicker = (() => {

  const HOLD_MS = 400; // ngắn hơn LongPress.DURATION_MS (500ms) một chút — đây là lối tắt hay dùng lặp lại nên phản hồi nhanh hơn 1 nhịp so với long-press "khám phá" (mở sheet xem ngày)
  const MOVE_TOLERANCE = 8; // di chuyển quá mốc này TRƯỚC khi đủ HOLD_MS coi như đang định cuộn/kéo gì khác, không phải định giữ yên chờ bảng hiện ra

  const MODES = ['system', 'light', 'dark'];

  let panelEl = null;
  let onChangeCallback = null;

  function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.createElement('div');
    panelEl.className = 'theme-quick-panel';
    panelEl.style.display = 'none';
    document.body.appendChild(panelEl);
    return panelEl;
  }

  function optionRect(optionEl) {
    return optionEl.getBoundingClientRect();
  }

  // Lựa chọn dưới toạ độ (x, y) hiện tại của ngón tay — so khoảng cách
  // TÂM từng lựa chọn với ngón tay thay vì đúng bounding-box (rê hơi
  // lệch ra ngoài mép bảng theo chiều dọc vẫn chọn được lựa chọn gần
  // nhất, khoan dung hơn cho ngón tay to/rê không thật chính xác trên
  // màn cảm ứng nhỏ).
  function closestOption(panel, x, y) {
    const options = Array.from(panel.querySelectorAll('.theme-quick-option'));
    let best = null;
    let bestDist = Infinity;
    options.forEach(opt => {
      const r = optionRect(opt);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestDist) { bestDist = dist; best = opt; }
    });
    return best;
  }

  function highlightOption(panel, optionEl) {
    panel.querySelectorAll('.theme-quick-option').forEach(o => o.classList.toggle('is-hover', o === optionEl));
  }

  function positionPanel(panel, anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    // Bảng nổi PHÍA TRÊN nút, canh giữa theo chiều ngang nút — trừ
    // trường hợp nút nằm quá sát mép phải màn hình (nút theme thường ở
    // góc phải header), khi đó dịch bảng sang trái để không tràn khỏi
    // viewport. Đo SAU khi đã display:flex (kích thước thật đã có).
    const panelWidth = panel.offsetWidth;
    let left = r.left + r.width / 2 - panelWidth / 2;
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));
    const top = r.top - panel.offsetHeight - 10;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(margin, top)}px`;
  }

  function renderPanelContent(panel) {
    const current = ThemeToggle.get();
    panel.innerHTML = MODES.map(mode => `
      <div class="theme-quick-option ${current === mode ? 'is-current' : ''}" data-mode="${mode}">
        <i class="ti ${ThemeToggle.ICON[mode]}" aria-hidden="true"></i>
        <span>${ThemeToggle.LABEL[mode]}</span>
      </div>
    `).join('');
  }

  function openPanel(anchorEl) {
    const panel = ensurePanel();
    renderPanelContent(panel);
    panel.style.display = 'flex';
    panel.style.visibility = 'hidden'; // đo kích thước trước khi định vị, tránh 1 khắc thấy bảng "nhảy" từ góc (0,0) tới đúng chỗ
    positionPanel(panel, anchorEl);
    panel.style.visibility = 'visible';
    requestAnimationFrame(() => panel.classList.add('is-open'));
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
    return panel;
  }

  function closePanel(panel) {
    panel.classList.remove('is-open');
    setTimeout(() => { panel.style.display = 'none'; }, 160);
  }

  // bind(anchorEl, onChange) — anchorEl: nút #nav-theme; onChange:
  // callback gọi lại sau khi 1 lựa chọn được áp dụng (app.js dùng để
  // cập nhật icon nút, cùng callback đã truyền cho ThemeEditorModal).
  // Trả về hàm unbind.
  function bind(anchorEl, onChange) {
    onChangeCallback = onChange || null;
    let holdTimer = null;
    let panelOpen = false;
    let startX = 0, startY = 0;
    let activePointerId = null;
    let suppressNextClick = false;

    function clearHoldTimer() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      activePointerId = e.pointerId;
      clearHoldTimer();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        panelOpen = true;
        anchorEl.classList.add('is-long-pressing');
        const panel = openPanel(anchorEl);
        highlightOption(panel, panel.querySelector('.theme-quick-option.is-current') || panel.querySelector('.theme-quick-option'));
      }, HOLD_MS);
    }

    function onPointerMove(e) {
      if (e.pointerId !== activePointerId) return;
      if (!panelOpen) {
        // Vẫn đang trong giai đoạn CHỜ đủ HOLD_MS — di chuyển quá xa
        // coi như không định giữ yên (đang định vuốt/cuộn gì khác),
        // huỷ hẹn giờ, không mở bảng.
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clearHoldTimer();
        return;
      }
      // Bảng ĐÃ mở — rê ngón tay qua các lựa chọn, tô sáng lựa chọn
      // gần ngón tay nhất theo thời gian thực.
      const panel = panelEl;
      if (!panel) return;
      const opt = closestOption(panel, e.clientX, e.clientY);
      if (opt) highlightOption(panel, opt);
    }

    // Đánh dấu suppressNextClick TRƯỚC KHI onPointerUp (bubble) chạy —
    // capture-phase chạy trước bubble-phase, nên tại thời điểm này
    // panelOpen vẫn còn nguyên giá trị thật của lượt nhấn hiện tại.
    function onPointerUpCapture(e) {
      if (e.pointerId !== activePointerId) return;
      if (panelOpen) suppressNextClick = true;
    }

    function onPointerUp(e) {
      if (e.pointerId !== activePointerId) return;
      clearHoldTimer();
      anchorEl.classList.remove('is-long-pressing');
      if (!panelOpen) return; // bấm ngắn — để click listener gốc (mở ThemeEditorModal) tự xử lý bình thường, không can thiệp gì ở đây
      panelOpen = false;
      const panel = panelEl;
      if (panel) {
        const chosen = panel.querySelector('.theme-quick-option.is-hover') || panel.querySelector('.theme-quick-option.is-current');
        closePanel(panel);
        if (chosen && chosen.dataset.mode !== ThemeToggle.get()) {
          ThemeToggle.set(chosen.dataset.mode);
          if (onChangeCallback) onChangeCallback();
          if (navigator.vibrate) { try { navigator.vibrate(14); } catch (err) {} }
        }
      }
    }

    function onPointerCancel(e) {
      if (e.pointerId !== activePointerId) return;
      clearHoldTimer();
      anchorEl.classList.remove('is-long-pressing');
      if (panelOpen && panelEl) closePanel(panelEl);
      panelOpen = false;
    }

    // Long-press ĐÃ kích hoạt bảng thì 'click' ăn theo ngay sau
    // pointerup không nên mở TIẾP ThemeEditorModal — bảng quick-picker
    // đã lo xong việc chọn (hoặc người dùng huỷ) rồi.
    function onClickCapture(e) {
      if (suppressNextClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressNextClick = false;
      }
    }

    anchorEl.addEventListener('pointerdown', onPointerDown);
    anchorEl.addEventListener('pointermove', onPointerMove);
    anchorEl.addEventListener('pointerup', onPointerUpCapture, true);
    anchorEl.addEventListener('pointerup', onPointerUp);
    anchorEl.addEventListener('pointercancel', onPointerCancel);
    anchorEl.addEventListener('click', onClickCapture, true);
    anchorEl.addEventListener('contextmenu', (e) => e.preventDefault());

    return function unbind() {
      anchorEl.removeEventListener('pointerdown', onPointerDown);
      anchorEl.removeEventListener('pointermove', onPointerMove);
      anchorEl.removeEventListener('pointerup', onPointerUpCapture, true);
      anchorEl.removeEventListener('pointerup', onPointerUp);
      anchorEl.removeEventListener('pointercancel', onPointerCancel);
      anchorEl.removeEventListener('click', onClickCapture, true);
    };
  }

  return { bind };
})();
