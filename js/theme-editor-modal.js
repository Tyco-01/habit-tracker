// ============================================================
// js/theme-editor-modal.js — UI cho ThemeToggle (js/theme-toggle.js):
// mở bằng NHẤP ĐÚP vào nút Home (#nav-today, xem app.js) — nút Home
// gộp 3 hành vi theo loại thao tác, xem app.js để biết cả 3. 2 màn
// trong cùng 1 overlay:
//   Picker  — liệt kê 3 chế độ có sẵn (Theo hệ thống/Sáng/Tối) +
//     "bộ sưu tập" theme tuỳ chỉnh đã lưu (chạm để áp dụng, có nút
//     sửa/xoá riêng từng cái).
//   Editor  — tạo mới HOẶC sửa 1 theme: đặt tên + 8 ô chọn màu (native
//     <input type="color">, đủ dùng, không cần tự vẽ color picker) +
//     cảnh báo tương phản thấp (không chặn lưu, chỉ báo).
// ============================================================

const ThemeEditorModal = (() => {

  let overlayEl = null;
  const CLOSE_ANIM_MS = 180; // khớp confirm-modal.js/habit-range-modal.js
  let onChangeCallback = null; // đăng ký ở open(), gọi mỗi khi ThemeToggle.set() chạy — xem app.js

  // Xem giải thích đầy đủ về lý do cần biến uỷ quyền này trong
  // js/habit-range-modal.js (ensureOverlay) — tránh listener 'click'
  // cộng dồn trên overlay SINGLETON qua nhiều lần mở.
  let currentCloseHandler = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'confirm-modal-overlay theme-modal-overlay';
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

  // Các cặp (nền, chữ) THẬT SỰ được dùng chung với nhau trong app (xem
  // css/views/year.css, css/base.css) — cảnh báo nếu độ tương phản
  // dưới ngưỡng dễ đọc. KHÔNG chặn lưu — chỉ báo, vì đây là theme CÁ
  // NHÂN, người dùng có toàn quyền chấp nhận đánh đổi nếu muốn (vd cố
  // tình làm màu nhạt cho phong cách riêng).
  const CONTRAST_PAIRS = [
    { a: 'ink', b: 'paper', label: 'Chữ chính / Nền trang' },
    { a: 'ink', b: 'card', label: 'Chữ chính / Nền thẻ' },
    { a: 'card', b: 'fullBg', label: 'Chữ trên ô "hoàn thành đủ"' },
    { a: 'ink', b: 'partialBg', label: 'Chữ trên ô "hoàn thành 1 phần"' }
  ];
  const CONTRAST_MIN = 3; // ngưỡng WCAG cho chữ cỡ lớn/đậm — đủ dùng làm mốc cảnh báo, không cần khắt khe tới 4.5

  function computeContrastWarnings(vars) {
    return CONTRAST_PAIRS
      .filter(p => vars[p.a] && vars[p.b])
      .map(p => ({ ...p, ratio: ThemeToggle.contrastRatio(vars[p.a], vars[p.b]) }))
      .filter(p => p.ratio < CONTRAST_MIN);
  }

  function swatchHtml(vars) {
    const dots = ['paper', 'ink', 'fullBg', 'danger'].map(k => `<span style="background:${DomUtils.escapeHtml(vars[k] || '#ccc')};"></span>`).join('');
    return `<span class="theme-modal-swatch">${dots}</span>`;
  }

  // ---------------------------------------------------------------
  // Màn Picker
  // ---------------------------------------------------------------
  function renderPicker(overlay) {
    const current = ThemeToggle.get();
    const customThemes = ThemeToggle.listCustomThemes();

    overlay.innerHTML = `
      <div class="range-modal-card theme-modal-card" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
        <p class="confirm-modal-title" id="theme-modal-title">Giao diện</p>
        <div class="theme-modal-list">
          ${['system', 'light', 'dark'].map(mode => `
            <button class="theme-modal-row" data-mode="${mode}">
              <i class="ti ${ThemeToggle.ICON[mode]}" aria-hidden="true"></i>
              <span class="theme-modal-row-name">${ThemeToggle.LABEL[mode]}</span>
              ${current === mode ? '<i class="ti ti-check theme-modal-row-check" aria-hidden="true"></i>' : ''}
            </button>
          `).join('')}
        </div>

        <p class="theme-modal-section-label">Theme của bạn</p>
        ${customThemes.length === 0 ? `
          <p class="theme-modal-empty">Chưa có theme tuỳ chỉnh nào — tạo 1 bộ màu riêng và lưu lại để dùng về sau.</p>
        ` : `
          <div class="theme-modal-list">
            ${customThemes.map(t => `
              <div class="theme-modal-row theme-modal-row-custom" data-custom-row="${t.id}">
                <button class="theme-modal-row-apply" data-apply-custom="${t.id}">
                  ${swatchHtml(t.vars || {})}
                  <span class="theme-modal-row-name">${DomUtils.escapeHtml(t.name)}</span>
                  ${current === 'custom:' + t.id ? '<i class="ti ti-check theme-modal-row-check" aria-hidden="true"></i>' : ''}
                </button>
                <button class="range-btn" data-edit-custom="${t.id}" aria-label="Sửa theme ${DomUtils.escapeHtml(t.name)}" title="Sửa">
                  <i class="ti ti-pencil" style="font-size:14px;" aria-hidden="true"></i>
                </button>
                <button class="remove-btn" data-delete-custom="${t.id}" aria-label="Xoá theme ${DomUtils.escapeHtml(t.name)}" title="Xoá">
                  <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
                </button>
              </div>
            `).join('')}
          </div>
        `}

        <button class="pill-btn" id="theme-modal-new" style="margin-top:12px;width:100%;">+ Tạo theme mới</button>

        <div class="confirm-modal-actions" style="margin-top:16px;">
          <button class="confirm-modal-btn confirm-modal-btn-cancel" id="theme-modal-close" style="flex:1;">Đóng</button>
        </div>
      </div>
    `;

    function close() { closeOverlay(overlay); }
    currentCloseHandler = close;
    overlay.querySelector('#theme-modal-close').addEventListener('click', close);

    overlay.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        ThemeToggle.set(btn.dataset.mode);
        if (onChangeCallback) onChangeCallback();
        renderPicker(overlay); // vẽ lại để cập nhật dấu tích đang chọn
      });
    });

    overlay.querySelectorAll('[data-apply-custom]').forEach(btn => {
      btn.addEventListener('click', () => {
        ThemeToggle.set('custom:' + btn.dataset.applyCustom);
        if (onChangeCallback) onChangeCallback();
        renderPicker(overlay);
      });
    });

    overlay.querySelectorAll('[data-edit-custom]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = customThemes.find(t => t.id === btn.dataset.editCustom);
        if (theme) renderEditor(overlay, { theme });
      });
    });

    overlay.querySelectorAll('[data-delete-custom]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const theme = customThemes.find(t => t.id === btn.dataset.deleteCustom);
        const ok = await ConfirmModal.show({
          title: `Xoá theme "${theme ? theme.name : ''}"?`,
          body: 'Không thể hoàn tác. Nếu đang dùng theme này, giao diện sẽ chuyển về "Theo hệ thống".',
          confirmLabel: 'Xoá'
        });
        if (!ok) return;
        ThemeToggle.deleteCustomTheme(btn.dataset.deleteCustom);
        if (onChangeCallback) onChangeCallback();
        renderPicker(overlay);
      });
    });

    overlay.querySelector('#theme-modal-new').addEventListener('click', () => {
      renderEditor(overlay, { theme: null });
    });
  }

  // ---------------------------------------------------------------
  // Màn Editor — theme: null (tạo mới) hoặc object có sẵn (sửa)
  // ---------------------------------------------------------------
  function renderEditor(overlay, { theme }) {
    const isEdit = !!theme;
    // Tạo mới: khởi điểm từ màu ĐANG HIỆU LỰC thật sự của giao diện
    // hiện tại (xem ThemeToggle.getResolvedColors) — chỉnh TỪ 1 theme
    // đã quen mắt dễ hơn nhiều so với phải chọn lại từ đầu cả 8 màu.
    const vars = Object.assign({}, isEdit ? theme.vars : ThemeToggle.getResolvedColors());
    const name = isEdit ? theme.name : '';

    overlay.innerHTML = `
      <div class="range-modal-card theme-modal-card" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
        <p class="confirm-modal-title" id="theme-modal-title">${isEdit ? `Sửa "${DomUtils.escapeHtml(theme.name)}"` : 'Tạo theme mới'}</p>

        <div class="range-modal-field">
          <label class="range-modal-label" for="theme-modal-name">Tên theme</label>
          <input type="text" id="theme-modal-name" class="range-modal-date-input" maxlength="40" placeholder="VD: Hoàng hôn, Rừng đêm..." value="${DomUtils.escapeHtml(name)}" />
        </div>

        <div class="theme-modal-color-grid">
          ${ThemeToggle.VARS.map(v => `
            <label class="theme-modal-color-row">
              <span>${v.label}</span>
              <input type="color" data-color-key="${v.key}" value="${vars[v.key] || '#000000'}" />
            </label>
          `).join('')}
        </div>

        <div id="theme-modal-warnings"></div>

        <p class="range-modal-error" id="theme-modal-error" style="display:none;"></p>

        <div class="confirm-modal-actions" style="margin-top:16px;">
          <button class="confirm-modal-btn confirm-modal-btn-cancel" id="theme-modal-back">Huỷ</button>
          <button class="confirm-modal-btn confirm-modal-btn-ok" id="theme-modal-save">Lưu</button>
        </div>
      </div>
    `;

    function close() { closeOverlay(overlay); }
    currentCloseHandler = close;
    overlay.querySelector('#theme-modal-back').addEventListener('click', () => renderPicker(overlay));

    const warningsEl = overlay.querySelector('#theme-modal-warnings');
    function syncWarnings() {
      const warnings = computeContrastWarnings(vars);
      warningsEl.innerHTML = warnings.length === 0 ? '' : `
        <div class="theme-modal-warning">
          <i class="ti ti-alert-triangle" aria-hidden="true"></i>
          <span>Độ tương phản thấp, có thể khó đọc: ${warnings.map(w => DomUtils.escapeHtml(w.label)).join(', ')}.</span>
        </div>
      `;
    }
    syncWarnings();

    overlay.querySelectorAll('[data-color-key]').forEach(input => {
      input.addEventListener('input', () => {
        vars[input.dataset.colorKey] = input.value;
        syncWarnings();
      });
    });

    overlay.querySelector('#theme-modal-save').addEventListener('click', () => {
      const nameInput = overlay.querySelector('#theme-modal-name');
      const trimmedName = nameInput.value.trim();
      const errorEl = overlay.querySelector('#theme-modal-error');
      if (!trimmedName) {
        errorEl.textContent = 'Đặt 1 cái tên cho theme này đã.';
        errorEl.style.display = 'block';
        nameInput.focus();
        return;
      }
      const saved = isEdit
        ? ThemeToggle.updateCustomTheme(theme.id, trimmedName, vars)
        : ThemeToggle.saveNewCustomTheme(trimmedName, vars);
      // Áp dụng ngay — tạo/sửa xong mà không thấy đổi gì thì rất dễ
      // tưởng nhầm là lưu thất bại.
      ThemeToggle.set('custom:' + saved.id);
      if (onChangeCallback) onChangeCallback();
      close();
    });
  }

  function open(onChange) {
    onChangeCallback = onChange || null;
    const overlay = ensureOverlay();
    openOverlay(overlay);
    renderPicker(overlay);
  }

  return { open };
})();
