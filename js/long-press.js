// ============================================================
// long-press.js — Tiện ích dùng CHUNG để phát hiện thao tác "nhấn
// giữ" trên 1 phần tử, không phụ thuộc module gọi nó là gì (hiện
// dùng cho DayPreviewSheet ở views/year.js, nhưng viết tách riêng vì
// bản thân việc "nhấn giữ = mở xem nhanh" là 1 khái niệm tương tác
// chung, không chỉ riêng cho lịch).
//
// DÙNG POINTER EVENTS (không phải touchstart/mousedown riêng lẻ) —
// pointerdown/up/move/cancel hoạt động thống nhất trên cả chuột lẫn
// chạm, khỏi phải viết 2 bộ listener song song rồi lo khử trùng lặp
// (1 số trình duyệt mobile bắn CẢ touchstart LẪN mousedown cho cùng 1
// lần chạm, gây double-fire nếu tự gắn cả 2).
//
// Ngưỡng thời gian 500ms — đủ dài để không cướp thao tác của 1 cú bấm
// thường (chuyển sang day-detail như cũ), đủ ngắn để không có cảm
// giác "ì" khi cố tình giữ.
//
// Chống nhầm với thao tác VUỐT/CUỘN: nếu ngón tay di chuyển quá
// MOVE_TOLERANCE (10px) trước khi đủ 500ms, huỷ luôn — vì lúc đó rõ
// ràng người dùng đang cuộn trang chứ không định giữ yên 1 chỗ.
//
// Chống xung đột với CLICK THƯỜNG: khi long-press đã kích hoạt thành
// công (đủ 500ms, gọi callback), lần 'click' NGAY SAU pointerup đó bị
// chặn lại (preventDefault + 1 cờ tạm) — nếu không, nhấn giữ xong nhả
// tay ra sẽ VỪA mở sheet xem nhanh VỪA kích hoạt luôn listener click
// gốc (mở thẳng day-detail), gây 2 hành vi chồng chéo cùng 1 lúc.
// ============================================================

const LongPress = (() => {

  const DURATION_MS = 500;
  const MOVE_TOLERANCE = 10;

  // bind(el, onLongPress) — el: phần tử cần theo dõi; onLongPress(el):
  // gọi khi giữ đủ lâu, nhận lại chính el để nơi gọi đọc dataset dễ
  // dàng (vd cell.dataset.date). Trả về hàm huỷ (unbind) nếu nơi gọi
  // cần gỡ sau này — hiện chưa nơi nào cần dùng vì year.js luôn thay
  // mới toàn bộ innerHTML (listener cũ tự mất theo node cũ), nhưng để
  // sẵn cho đúng chuẩn 1 tiện ích dùng chung nên có lối thoát rõ ràng.
  function bind(el, onLongPress) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let firedThisPress = false; // true nếu long-press ĐÃ kích hoạt ở lượt nhấn hiện tại — dùng để chặn 'click' ăn theo ngay sau đó

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function onPointerDown(e) {
      // Chỉ theo dõi nút chính (chuột trái) hoặc chạm/bút — bỏ qua
      // chuột phải/giữa để không cướp menu ngữ cảnh gốc của trình duyệt.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      firedThisPress = false;
      startX = e.clientX;
      startY = e.clientY;
      clearTimer();
      // Đảm bảo pointermove/pointerup vẫn bắn về el kể cả khi ngón tay
      // trôi ra ngoài bounding box ban đầu trong lúc chờ đủ ngưỡng
      // DURATION_MS — không có dòng này, MOVE_TOLERANCE bên dưới có
      // thể không bao giờ nhận được sự kiện move để tự huỷ đúng lúc
      // (xem giải thích đầy đủ ở js/swipe-nav.js, cùng vấn đề).
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      timer = setTimeout(() => {
        timer = null;
        firedThisPress = true;
        el.classList.add('is-long-pressing');
        // Rung nhẹ phản hồi xúc giác nếu thiết bị hỗ trợ (hầu hết
        // Android; iOS Safari không hỗ trợ Vibration API — bỏ qua êm
        // nếu không có, không phải lỗi cần xử lý).
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
        onLongPress(el);
      }, DURATION_MS);
    }

    function onPointerMove(e) {
      if (!timer) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clearTimer();
    }

    function endPress() {
      clearTimer();
      el.classList.remove('is-long-pressing');
    }

    function onClickCapture(e) {
      // Chặn Ở GIAI ĐOẠN CAPTURE (trước khi sự kiện tới listener click
      // gắn ở year.js, vốn được thêm sau qua bubble bình thường) —
      // long-press vừa kích hoạt thành công thì click ăn theo ngay sau
      // đó không nên mở TIẾP day-detail nữa, sheet xem nhanh đã lo rồi.
      if (firedThisPress) {
        e.stopPropagation();
        e.preventDefault();
        firedThisPress = false;
      }
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPress);
    el.addEventListener('pointercancel', endPress);
    el.addEventListener('pointerleave', endPress);
    el.addEventListener('click', onClickCapture, true);
    // Chặn menu ngữ cảnh gốc (chuột phải/giữ lâu trên mobile) — trình
    // duyệt mobile mặc định hiện menu "Sao chép/Chia sẻ" khi giữ lâu
    // trên 1 phần tử, xung đột trực tiếp với long-press tự định nghĩa.
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    return function unbind() {
      clearTimer();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPress);
      el.removeEventListener('pointercancel', endPress);
      el.removeEventListener('pointerleave', endPress);
      el.removeEventListener('click', onClickCapture, true);
    };
  }

  return { bind };
})();
