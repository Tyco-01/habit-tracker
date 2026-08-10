// ============================================================
// swipe-nav.js — Tiện ích dùng CHUNG để phát hiện thao tác "vuốt
// ngang" trên 1 phần tử, kèm hiệu ứng kéo-theo-ngón-tay (drag-follow)
// mượt trong lúc vuốt — dùng ở 3 nơi:
//   1. .cal-pane (views/year.js)   — vuốt = lùi/tiến trang (ngày/tuần/
//      tháng/năm tuỳ mode đang xem)
//   2. .cal-switcher (views/year.js) — vuốt = đổi mode Ngày/Tuần/
//      Tháng/Năm
//   3. #app (app.js)               — vuốt = đổi qua lại 4 tab chính
//      (Hôm nay/Lịch/Thống kê/Thùng rác)
//
// CÙNG DÙNG POINTER EVENTS như long-press.js (xem giải thích "vì sao
// không tách touchstart/mousedown riêng" ở đó, áp dụng y hệt ở đây).
//
// PHÂN BIỆT VUỐT NGANG vs CUỘN DỌC: theo dõi cả dx VÀ dy từ điểm bắt
// đầu — nếu |dy| vượt |dx| Ở BẤT KỲ THỜI ĐIỂM NÀO trong lúc đang theo
// dõi, coi như người dùng đang cuộn dọc trang, HUỶ theo dõi vuốt ngang
// ngay lập tức và KHÔNG preventDefault gì cả — trả quyền cuộn dọc lại
// hoàn toàn cho trình duyệt xử lý tự nhiên. Chỉ khi dx thắng rõ rệt
// (vượt DIRECTION_LOCK_PX trước dy) mới khoá vào chế độ "đang vuốt
// ngang" và preventDefault từ đó để tránh trình duyệt vừa cuộn dọc vừa
// kéo ngang cùng lúc gây giật.
//
// KHÔNG CẢN TRỞ LONG-PRESS/CLICK CON: không gọi preventDefault cho tới
// khi ĐÃ XÁC ĐỊNH chắc chắn là vuốt ngang (dx vượt ngưỡng khoá hướng
// DIRECTION_LOCK_PX=12px) — trước thời điểm đó, pointermove vẫn nổi
// bọt lên bình thường tới long-press.js gắn trên phần tử con (vd
// .day-cell), không bị chặn. Tự long-press.js đã có ngưỡng
// MOVE_TOLERANCE=10px riêng (nhỏ hơn 12px ở đây) khiến nó TỰ HUỶ đúng
// lúc trước khi SwipeNav kịp khoá hướng — preventDefault() chỉ chặn
// hành vi cuộn/kéo mặc định của TRÌNH DUYỆT, không chặn event tiếp tục
// nổi bọt tới listener JS khác trên cùng cây DOM, nên 2 module không
// cần biết tới nhau qua sự kiện tuỳ chỉnh nào cả — chỉ cần đúng thứ tự
// ngưỡng (long-press huỷ TRƯỚC khi swipe khoá hướng) là đủ an toàn.
// ============================================================

const SwipeNav = (() => {

  const SWIPE_THRESHOLD_PX = 60;    // khoảng cách tối thiểu để tính là 1 lần vuốt hoàn chỉnh
  const DIRECTION_LOCK_PX = 12;     // dx phải vượt mốc này (và vượt |dy|) trước khi khoá hẳn vào "đang vuốt ngang"
  const MAX_DRAG_PX = 120;          // kéo-theo-ngón-tay bị "ghìm" lại (rubber-band) sau mốc này, không trôi tự do vô hạn

  // bind(el, { onSwipeLeft, onSwipeRight, dragTarget }) — el: phần tử
  // nhận thao tác chạm; dragTarget (tuỳ chọn): phần tử được áp
  // transform kéo-theo-ngón-tay trong lúc vuốt (mặc định = el; truyền
  // false để CHỈ phát hiện cử chỉ vuốt/gọi callback, KHÔNG kéo-theo-
  // ngón-tay bất kỳ phần tử nào — dùng khi el là 1 vùng lắng nghe rộng
  // như #app, nơi kéo-theo cả khối sẽ trông sai vì #app chứa nhiều
  // view ẩn/hiện bằng display:none, không phải 1 "trang" trực quan
  // duy nhất để trượt qua lại). Trả về hàm unbind.
  function bind(el, { onSwipeLeft, onSwipeRight, dragTarget } = {}) {
    const drag = dragTarget === false ? null : (dragTarget || el);
    let active = false;       // đang theo dõi 1 lượt chạm (chưa chắc là vuốt ngang)
    let lockedHorizontal = false; // ĐÃ xác định chắc chắn là vuốt ngang
    let startX = 0, startY = 0, lastDx = 0;
    let pointerId = null;

    function resetDragVisual() {
      if (!drag) return;
      drag.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
      drag.style.transform = '';
      // Gỡ transition sau khi chạy xong — nếu để transition tồn tại
      // vĩnh viễn, các thay đổi transform KHÁC (không phải do vuốt,
      // vd animation khác của cùng phần tử) sẽ vô tình bị áp transition
      // này, chạy chậm/mượt ngoài ý muốn.
      const clear = () => { drag.style.transition = ''; drag.removeEventListener('transitionend', clear); };
      drag.addEventListener('transitionend', clear);
    }

    // Rubber-band: kéo càng xa càng "ì" lại (căn theo hàm căn bậc 2),
    // giống cảm giác iOS khi kéo quá giới hạn — không cho trôi tự do
    // vô hạn theo đúng khoảng cách ngón tay di chuyển, tạo cảm giác có
    // "điểm neo" thay vì trôi lung tung.
    function rubberBand(dx) {
      const sign = dx < 0 ? -1 : 1;
      const abs = Math.abs(dx);
      if (abs <= MAX_DRAG_PX) return dx;
      const over = abs - MAX_DRAG_PX;
      return sign * (MAX_DRAG_PX + Math.sqrt(over) * 4);
    }

    function onPointerDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      active = true;
      lockedHorizontal = false;
      startX = e.clientX;
      startY = e.clientY;
      lastDx = 0;
      pointerId = e.pointerId;
      // KHÔNG setPointerCapture ở đây — el thường là 1 vùng RỘNG (cả
      // .cal-pane, cả #app) chứa nhiều phần tử con tương tác được
      // (nút bấm, ô ngày...). Capture NGAY khi vừa chạm xuống sẽ khiến
      // MỌI pointerdown/click bình thường trong toàn vùng đó bị "hút"
      // về el, kể cả những cú bấm không hề định vuốt gì — nút bấm bình
      // thường bên trong sẽ ngừng nhận được click. Capture chỉ nên xảy
      // ra SAU KHI đã xác định chắc chắn đây là 1 cú vuốt ngang thật
      // (xem onPointerMove, ngay lúc lockedHorizontal chuyển true).
    }

    function onPointerMove(e) {
      if (!active || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!lockedHorizontal) {
        if (Math.abs(dx) > DIRECTION_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
          lockedHorizontal = true;
          // Chỉ TỪ ĐÂY MỚI capture — đã chắc chắn là vuốt ngang, giữ
          // pointermove/up tiếp tục bắn về el dù ngón tay đi xa khỏi
          // bounding box ban đầu (xem giải thích đầy đủ ở đầu file).
          try { el.setPointerCapture(e.pointerId); } catch (err) {}
        } else if (Math.abs(dy) > DIRECTION_LOCK_PX) {
          // Rõ ràng đang cuộn dọc — bỏ theo dõi hẳn, không can thiệp gì nữa.
          active = false;
          return;
        } else {
          return; // chưa đủ rõ hướng nào, chưa làm gì cả
        }
      }

      // Đã khoá ngang — chặn cuộn dọc/kéo trang mặc định của trình
      // duyệt trong lúc kéo, và cập nhật vị trí kéo-theo-ngón-tay (nếu
      // có drag target — khi dragTarget:false, chỉ theo dõi khoảng
      // cách để xác định swipe, không áp transform lên đâu cả).
      //
      // stopPropagation() BẮT BUỘC ở đây — app có NHIỀU tầng SwipeNav
      // lồng nhau cùng lúc (vd .cal-switcher NẰM TRONG #app, cả 2 đều
      // gọi SwipeNav.bind riêng). pointermove NỔI BỌT từ switcher lên
      // #app theo cơ chế DOM bình thường — nếu không chặn, tầng NGOÀI
      // (#app) CŨNG nhận được cùng chuỗi toạ độ và CŨNG tự khoá hướng
      // ngang gần như đồng thời, rồi CŨNG gọi el.setPointerCapture()
      // của riêng nó — capture gọi SAU sẽ ghi đè capture gọi trước,
      // khiến tầng đã khoá trước (switcher) mất dấu hoàn toàn các
      // pointermove/pointerup tiếp theo (chúng bị "hút" về tầng ngoài
      // đã capture sau), callback của tầng trong không bao giờ được
      // gọi dù người dùng đã vuốt đủ khoảng cách. stopPropagation()
      // ngay khi VỪA khoá hướng đảm bảo CHỈ tầng trong cùng (target
      // gần nhất với ngón tay) được xử lý cử chỉ này, đúng nguyên tắc
      // "phần tử cụ thể nhất thắng" khi nhiều vùng vuốt lồng nhau.
      e.preventDefault();
      e.stopPropagation();
      lastDx = dx;
      if (drag) drag.style.transform = `translateX(${rubberBand(dx)}px)`;
    }

    function onPointerUp(e) {
      if (!active) return;
      active = false;
      if (lockedHorizontal) { try { el.releasePointerCapture(e.pointerId); } catch (err) {} }
      if (lockedHorizontal) {
        resetDragVisual();
        if (lastDx <= -SWIPE_THRESHOLD_PX && typeof onSwipeLeft === 'function') onSwipeLeft();
        else if (lastDx >= SWIPE_THRESHOLD_PX && typeof onSwipeRight === 'function') onSwipeRight();
      }
      lockedHorizontal = false;
      lastDx = 0;
    }

    function onPointerCancel() {
      if (lockedHorizontal) resetDragVisual();
      active = false;
      lockedHorizontal = false;
      lastDx = 0;
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);

    return function unbind() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }

  return { bind };
})();
