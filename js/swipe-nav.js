// ============================================================
// swipe-nav.js — VIẾT LẠI HOÀN TOÀN (bản trước dùng Pointer Events +
// setPointerCapture + stopPropagation qua nhiều tầng lồng nhau — quá
// giòn, mỗi lần sửa 1 chỗ lại hở bug khác, và test bằng chuột/touch
// giả lập trong Chrome headless "Testing" build KHÔNG phản ánh đúng
// hành vi cảm ứng thật trên điện thoại — xem mục 8 trong
// ARCHITECTURE.md để đọc đầy đủ lịch sử các bug đã gặp).
//
// BẢN NÀY dùng touchstart/touchmove/touchend THUẦN (không phải
// Pointer Events) — đơn giản hơn, ít bất ngờ hơn, và ĐÚNG NGHĨA GỐC
// của API cảm ứng (không cần suy đoán qua lớp trừu tượng Pointer
// Events). Chuột/trackpad không cần hỗ trợ kéo ở đây — mọi nơi dùng
// SwipeNav đều đã có cách khác để thao tác bằng chuột (bấm nút mode,
// bấm mũi tên prev/next, bấm tab) nên bỏ hẳn phần mouse-drag cho gọn,
// giảm bề mặt có thể lỗi.
//
// HỖ TRỢ KÉO-THEO-NGÓN-TAY THỜI GIAN THỰC ("giọt lỏng"): options.onDrag
// được gọi LIÊN TỤC trong lúc kéo với dx = khoảng cách kéo hiện tại
// (px, âm/dương theo hướng) — nơi gọi tự quyết định vẽ gì (thường là
// áp transform: translateX lên nội dung + phần tử bên cạnh). Khi thả
// tay: nếu |dx| vượt ngưỡng, gọi onCommit(direction) rồi onSettle() để
// animate NỐT quãng đường còn lại (không snap tức thì); nếu chưa đủ,
// gọi onCancel() để animate TRÔI VỀ vị trí ban đầu.
//
// CHỈ 1 TẦNG DUY NHẤT XỬ LÝ MỖI LẦN VUỐT — không còn nhiều SwipeNav
// lồng nhau tự ý tranh nhau qua bubble/capture như bản trước. Nơi gọi
// (app.js) tự kiểm tra "cử chỉ này có nên do tầng trong xử lý không"
// bằng cách kiểm tra target qua closest() TRƯỚC KHI quyết định có xử
// lý gì hay không, thay vì để 2 instance SwipeNav độc lập cùng lắng
// nghe song song rồi giành giật nhau lúc runtime.
// ============================================================

const SwipeNav = (() => {

  const COMMIT_THRESHOLD_PX = 55;   // kéo đủ xa (px) mới tính là "đổi trang", ngắn hơn thì trôi về lại
  const DIRECTION_LOCK_PX = 10;     // |dx| phải vượt mốc này (và vượt |dy|) trước khi khoá vào "đang vuốt ngang", tránh nhầm với cuộn dọc

  // bind(el, options) — el: phần tử nhận cử chỉ chạm.
  // options:
  //   onDrag(dx)      — gọi liên tục khi đang kéo, dx = khoảng cách px hiện tại (âm = kéo trái)
  //   onCommit(dir)   — gọi ĐÚNG 1 LẦN khi thả tay và |dx| đã đủ ngưỡng; dir = -1 (kéo trái, "tiến") | 1 (kéo phải, "lùi")
  //   onSettle()      — gọi NGAY SAU onCommit, để nơi gọi animate nốt quãng đường còn lại tới vị trí cuối
  //   onCancel()       — gọi khi thả tay nhưng CHƯA đủ ngưỡng — animate trôi về lại vị trí ban đầu (dx → 0)
  //   onLockHorizontal() — gọi ĐÚNG 1 LẦN ngay khi vừa xác định chắc
  //     chắn đây là vuốt ngang (trước cả onDrag đầu tiên) — dùng để
  //     hiện CHỈ BÁO cho người dùng biết mình đang vuốt cái gì (vd
  //     nhãn nổi "→ Lịch" / "→ Năm") NGAY LẬP TỨC, không đợi tới lúc
  //     đã kéo đủ xa mới biết. Tách riêng khỏi onDrag (chạy MỖI FRAME
  //     kéo) vì chỉ báo chỉ cần TẠO 1 LẦN lúc bắt đầu, không cần vẽ
  //     lại liên tục — nơi gọi tự cập nhật NỘI DUNG chỉ báo (đổi
  //     hướng/đích) dựa vào dx nhận được qua onDrag nếu cần.
  //   shouldIgnore(target) — gọi ngay lúc chạm xuống với e.target gốc;
  //     trả true để BỎ QUA HOÀN TOÀN cử chỉ này (không active, không
  //     preventDefault gì cả) — dùng khi el là 1 vùng RỘNG (vd
  //     document.body cho 4-tab chính) NHƯNG có 1 vùng CON bên trong
  //     nó ĐÃ có SwipeNav RIÊNG của chính nó (vd .cal-switcher/.cal-
  //     pane trong tab Lịch) — vùng ngoài cần tự biết "nhường" ngay từ
  //     đầu bằng cách kiểm tra target, KHÔNG dựa vào stopPropagation
  //     (bản trước dùng cách đó, gây bug 2 tầng tranh nhau capture —
  //     xem ARCHITECTURE.md mục 8). Đây là cách "1 tầng xử lý duy
  //     nhất" đúng nghĩa: tầng ngoài tự loại trừ TRƯỚC khi bắt đầu
  //     theo dõi, thay vì cả 2 tầng cùng theo dõi rồi giành nhau.
  // Trả về hàm unbind().
  function bind(el, { onDrag, onCommit, onSettle, onCancel, onLockHorizontal, shouldIgnore } = {}) {
    let active = false;
    let lockedHorizontal = false;
    let startX = 0, startY = 0, lastDx = 0;

    function onTouchStart(e) {
      if (e.touches.length !== 1) return; // bỏ qua đa chạm (pinch-zoom...)
      if (typeof shouldIgnore === 'function' && shouldIgnore(e.target)) return;
      active = true;
      lockedHorizontal = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastDx = 0;
    }

    function onTouchMove(e) {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!lockedHorizontal) {
        if (Math.abs(dx) > DIRECTION_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
          lockedHorizontal = true;
          if (typeof onLockHorizontal === 'function') onLockHorizontal();
        } else if (Math.abs(dy) > DIRECTION_LOCK_PX) {
          // Rõ ràng đang cuộn dọc — bỏ theo dõi hẳn, trả quyền cuộn
          // lại hoàn toàn cho trình duyệt, không preventDefault gì cả.
          active = false;
          return;
        } else {
          return; // chưa đủ rõ hướng nào
        }
      }

      // Đã khoá ngang — chặn cuộn dọc mặc định trong lúc kéo, báo dx
      // mới cho nơi gọi vẽ animation theo tay thời gian thực.
      e.preventDefault();
      lastDx = dx;
      if (typeof onDrag === 'function') onDrag(dx);
    }

    function onTouchEnd() {
      if (!active) return;
      active = false;
      if (!lockedHorizontal) return; // chưa từng khoá ngang — không phải 1 cử chỉ vuốt hoàn chỉnh, không làm gì cả
      lockedHorizontal = false;

      if (Math.abs(lastDx) >= COMMIT_THRESHOLD_PX) {
        const dir = lastDx < 0 ? -1 : 1;
        if (typeof onCommit === 'function') onCommit(dir);
        if (typeof onSettle === 'function') onSettle();
      } else {
        if (typeof onCancel === 'function') onCancel();
      }
      lastDx = 0;
    }

    function onTouchCancel() {
      if (!active) return;
      active = false;
      const wasLocked = lockedHorizontal;
      lockedHorizontal = false;
      lastDx = 0;
      if (wasLocked && typeof onCancel === 'function') onCancel();
    }

    // passive: false BẮT BUỘC — cần preventDefault() trong onTouchMove
    // để chặn cuộn trang mặc định trong lúc đang kéo ngang; touch
    // listener mặc định là passive:true trên nhiều trình duyệt hiện
    // đại (tối ưu hiệu năng cuộn), preventDefault() bị bỏ qua lặng lẽ
    // nếu không khai báo passive:false tường minh.
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return function unbind() {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }

  return { bind, COMMIT_THRESHOLD_PX };
})();
