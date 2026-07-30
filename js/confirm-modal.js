// ============================================================
// confirm-modal.js — Modal xác nhận tự vẽ, đồng bộ theme app,
// THAY THẾ hoàn toàn confirm() gốc của trình duyệt (không thể chỉnh
// giao diện của hộp thoại gốc — font/màu/bo góc do trình duyệt quyết
// định, không phải code của app).
//
// Cách dùng — GIỮ NGUYÊN tinh thần confirm() cũ, chỉ thêm "await":
//
//   const ok = await ConfirmModal.show({
//     title: 'Chuyển "bbb" vào thùng rác?',
//     body: 'Việc sẽ được giữ 30 ngày...',
//     confirmLabel: 'Chuyển vào thùng rác',  // tuỳ chỉnh chữ nút OK
//     cancelLabel: 'Huỷ'                      // tuỳ chỉnh chữ nút Huỷ (có mặc định)
//   });
//   if (!ok) return;
//
// Chế độ CHỈ THÔNG BÁO (1 nút duy nhất, dùng khi không có gì để huỷ —
// ví dụ báo kết quả sau khi 1 hành động đã thực hiện xong):
//
//   await ConfirmModal.show({
//     title: 'Đã sửa xong',
//     body: '...',
//     confirmLabel: 'Đã hiểu',
//     hideCancel: true
//   });
//
// Trả về Promise<boolean> — true nếu bấm nút xác nhận, false nếu
// Huỷ hoặc bấm ra ngoài / phím Escape.
// ============================================================

const ConfirmModal = (() => {

  let overlayEl = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'confirm-modal-overlay';
    overlayEl.style.display = 'none';
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function show({ title, body = '', confirmLabel = 'OK', cancelLabel = 'Huỷ', hideCancel = false }) {
    const overlay = ensureOverlay();

    return new Promise((resolve) => {
      function close(result) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
        document.removeEventListener('keydown', onKeydown);
        resolve(result);
      }
      function onKeydown(e) {
        if (e.key === 'Escape') close(false);
      }

      overlay.innerHTML = `
        <div class="confirm-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <p class="confirm-modal-title" id="confirm-modal-title">${title}</p>
          ${body ? `<p class="confirm-modal-body">${body}</p>` : ''}
          <div class="confirm-modal-actions">
            ${hideCancel ? '' : `<button class="confirm-modal-btn confirm-modal-btn-cancel" id="confirm-modal-cancel">${cancelLabel}</button>`}
            <button class="confirm-modal-btn confirm-modal-btn-ok" id="confirm-modal-ok">${confirmLabel}</button>
          </div>
        </div>
      `;
      overlay.style.display = 'flex';

      overlay.querySelector('#confirm-modal-ok').addEventListener('click', () => close(true));
      const cancelBtn = overlay.querySelector('#confirm-modal-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
      // Bấm ra vùng tối xung quanh card = huỷ (giống hành vi quen thuộc
      // của modal, không có trong confirm() gốc nhưng tiện hơn).
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
      document.addEventListener('keydown', onKeydown);

      overlay.querySelector('#confirm-modal-ok').focus();
    });
  }

  return { show };
})();
