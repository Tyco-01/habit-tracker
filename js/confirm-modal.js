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

  const CLOSE_ANIM_MS = 180; // khớp đúng transition trong .confirm-modal-overlay (css/components.css)

  function show({ title, body = '', confirmLabel = 'OK', cancelLabel = 'Huỷ', hideCancel = false }) {
    const overlay = ensureOverlay();

    return new Promise((resolve) => {
      function close(result) {
        // Bỏ .is-open trước để animation lùi (fade + scale down) kịp
        // chạy, CHỜ ĐỦ THỜI LƯỢNG animation rồi mới thực sự ẩn hẳn +
        // xoá nội dung — nếu ẩn ngay lập tức (display:none tức thì),
        // animation đóng không có thời gian để hiện, y hệt vấn đề đã
        // gặp với .event-row khi xoá sự kiện trước đây.
        overlay.classList.remove('is-open');
        document.removeEventListener('keydown', onKeydown);
        setTimeout(() => {
          overlay.style.display = 'none';
          overlay.innerHTML = '';
        }, CLOSE_ANIM_MS);
        resolve(result);
      }
      function onKeydown(e) {
        if (e.key === 'Escape') close(false);
      }

      overlay.innerHTML = `
        <div class="confirm-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <p class="confirm-modal-title" id="confirm-modal-title">${DomUtils.escapeHtml(title)}</p>
          ${body ? `<p class="confirm-modal-body">${DomUtils.escapeHtml(body)}</p>` : ''}
          <div class="confirm-modal-actions">
            ${hideCancel ? '' : `<button class="confirm-modal-btn confirm-modal-btn-cancel" id="confirm-modal-cancel">${DomUtils.escapeHtml(cancelLabel)}</button>`}
            <button class="confirm-modal-btn confirm-modal-btn-ok" id="confirm-modal-ok">${DomUtils.escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      `;
      overlay.style.display = 'flex';

      // requestAnimationFrame: đảm bảo trình duyệt thực sự VẼ XONG frame
      // với display:flex + opacity:0 (trạng thái ban đầu, kế thừa từ CSS
      // mặc định) TRƯỚC KHI thêm .is-open (opacity:1) ở frame kế tiếp —
      // nếu thêm is-open ngay trong cùng 1 lệnh, trình duyệt có thể gộp
      // 2 thay đổi vào cùng 1 frame và bỏ qua animation hoàn toàn (từ
      // display:none nhảy thẳng lên opacity:1, không có gì để nội suy).
      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });

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
