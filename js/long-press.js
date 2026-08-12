// ============================================================
// long-press.js — Tiện ích dùng CHUNG để phát hiện thao tác "nhấn
// giữ" trên 1 phần tử (DayPreviewSheet ở views/year.js, và nút theme
// dùng cơ chế RIÊNG trong theme-quick-picker.js — không dùng module
// này, xem lý do ở đó).
//
// VIẾT LẠI dùng TOUCH EVENTS THUẦN (touchstart/move/end/cancel) —
// bản trước dùng Pointer Events + setPointerCapture, TRỘN LẪN với
// SwipeNav (giờ cũng dùng Touch Events thuần, xem swipe-nav.js) trên
// CÙNG cây DOM (.day-cell nằm trong .cal-pane) — dù về lý thuyết 2 hệ
// sự kiện độc lập không capture chéo nhau, việc trộn 2 API sự kiện
// khác nhau cho cùng 1 vùng cảm ứng làm tăng bất định khó kiểm chứng
// (xem ARCHITECTURE.md mục 8, lịch sử các bug cảm ứng đã gặp — nhiều
// bug chỉ lộ ra trên thiết bị thật, không lộ qua test giả lập). Dùng
// CHUNG 1 API sự kiện (Touch Events) cho mọi tương tác cảm ứng tuỳ
// biến trong app giảm hẳn bề mặt có thể phát sinh tương tác lạ giữa
// 2 module khác cơ chế.
//
// Chuột: long-press qua chuột không còn được hỗ trợ ở bản này (giữ
// chuột không có khái niệm tương đương "long-press" trên di động) —
// mọi nơi dùng LongPress đều là tương tác trên lưới ngày, chủ yếu
// dùng trên di động; người dùng chuột vẫn bấm 1 cú để mở day-detail
// bình thường qua click listener riêng (không đụng tới module này).
//
// Ngưỡng thời gian 500ms — đủ dài để không cướp thao tác của 1 cú bấm
// thường (chuyển sang day-detail như cũ), đủ ngắn để không có cảm
// giác "ì" khi cố tình giữ.
//
// Chống nhầm với thao tác VUỐT/CUỘN: nếu ngón tay di chuyển quá
// MOVE_TOLERANCE trước khi đủ 500ms, huỷ luôn — vì lúc đó rõ ràng
// người dùng đang vuốt/cuộn chứ không định giữ yên 1 chỗ. Ngưỡng này
// NHỎ HƠN DIRECTION_LOCK_PX của SwipeNav (10px) — long-press tự huỷ
// TRƯỚC khi SwipeNav (ở tầng .cal-pane bao ngoài) kịp khoá hướng
// ngang, nên 2 module không tranh giành gì: đúng lúc nào chỉ 1 trong 2
// đang "sống".
//
// Chống xung đột với CLICK THƯỜNG: khi long-press đã kích hoạt thành
// công (đủ 500ms, gọi callback), lần 'click' NGAY SAU touchend đó bị
// chặn lại (preventDefault + 1 cờ tạm) — nếu không, nhấn giữ xong nhả
// tay ra sẽ VỪA mở sheet xem nhanh VỪA kích hoạt luôn listener click
// gốc (mở thẳng day-detail), gây 2 hành vi chồng chéo cùng 1 lúc.
// ============================================================

const LongPress = (() => {

  const DURATION_MS = 500;
  const MOVE_TOLERANCE = 8;

  // bind(el, onLongPress) — el: phần tử cần theo dõi; onLongPress(el):
  // gọi khi giữ đủ lâu, nhận lại chính el để nơi gọi đọc dataset dễ
  // dàng (vd cell.dataset.date). Trả về hàm huỷ (unbind).
  function bind(el, onLongPress) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let firedThisPress = false; // true nếu long-press ĐÃ kích hoạt ở lượt nhấn hiện tại — dùng để chặn 'click' ăn theo ngay sau đó

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      firedThisPress = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      clearTimer();
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

    function onTouchMove(e) {
      if (!timer) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
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

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', endPress, { passive: true });
    el.addEventListener('touchcancel', endPress, { passive: true });
    el.addEventListener('click', onClickCapture, true);
    // Chặn menu ngữ cảnh gốc (giữ lâu trên mobile mặc định hiện menu
    // "Sao chép/Chia sẻ") — xung đột trực tiếp với long-press tự định
    // nghĩa ở đây.
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    return function unbind() {
      clearTimer();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', endPress);
      el.removeEventListener('touchcancel', endPress);
      el.removeEventListener('click', onClickCapture, true);
    };
  }

  return { bind };
})();
