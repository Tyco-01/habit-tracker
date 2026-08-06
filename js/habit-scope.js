// ============================================================
// js/habit-scope.js — Tính TỔNG SỐ VIỆC áp dụng cho 1 ngày cụ thể.
//
// BỐI CẢNH (bug đã sửa): trước đây "tổng số việc" của MỌI ngày (kể
// cả ngày trong quá khứ) luôn lấy CỐ ĐỊNH bằng habits.length hiện
// tại. Hậu quả: thêm 1 việc mới khiến TOÀN BỘ ngày trong quá khứ bị
// tính lại theo mẫu số mới — 1 ngày đã đạt 100% (đen/đầy) tự nhiên
// tụt xuống dưới 100% dù thực tế hôm đó đã hoàn thành đủ số việc
// TỒN TẠI LÚC ĐÓ. "completed"/"total" của quá khứ phải là SỰ THẬT
// LỊCH SỬ, không tự động viết lại khi cấu hình hiện tại đổi.
//
// GIẢI PHÁP: mỗi habit mang 1 mốc "validFrom" (ngày bắt đầu được
// tính vào tổng — mặc định = ngày habit được tạo, xem
// SyncMutations.addHabit) và 1 mốc "validTo" (ngày CUỐI CÙNG còn được
// tính — mặc định = hôm nay lúc xoá, nhưng có thể LÙI VỀ QUÁ KHỨ nếu
// người dùng chọn "Xoá cả quá khứ", xem js/habit-range-modal.js). Tổng
// của 1 ngày D = đếm số habit (đang hoạt động HOẶC đã archive) mà
// validFrom <= D <= validTo (nếu có).
//
// validTo KHÁC archivedAt — CỐ Ý TÁCH RIÊNG, đừng gộp lại:
//   archivedAt = thời điểm THẬT SỰ bấm nút xoá (luôn = lúc đó, không
//     bao giờ lùi được) — chỉ dùng để đếm "còn N ngày trong thùng rác"
//     (xem trash.js/purge_expired_trash trên Supabase).
//   validTo = ngày habit NGỪNG được tính vào tổng — có thể lùi về quá
//     khứ (vd "thực ra đã nghỉ từ 2 tuần trước"), không liên quan gì
//     tới đồng hồ đếm ngược thùng rác. Nếu gộp 2 khái niệm này làm 1,
//     lùi validTo sẽ vô tình rút ngắn luôn thời gian còn lại trong
//     thùng rác — tác dụng phụ người dùng không hề muốn.
//
// TƯƠNG THÍCH NGƯỢC: habit archive TRƯỚC khi có validTo (undefined/
// null) → dùng archivedAt làm mốc ngừng thay thế (đúng hành vi cũ).
//
// TƯƠNG THÍCH NGƯỢC: habit tạo TRƯỚC khi tính năng này tồn tại
// không có validFrom (undefined/null) — coi là "luôn hợp lệ, không
// giới hạn dưới", giữ nguyên hành vi cũ (habits.length) cho toàn bộ
// dữ liệu cũ. Chỉ habit tạo MỚI từ giờ trở đi mới tự động có
// validFrom = hôm nay, nên chỉ ảnh hưởng NGÀY TỪ LÚC ĐÓ VỀ SAU —
// đúng tinh thần "không đụng vào quá khứ" đã bàn.
// ============================================================

const HabitScope = (() => {

  // "Ngày archive" ở dạng dateStr — archivedAt lưu dạng timestamp ms
  // (Date.now() khi archive), quy đổi ra dateStr theo giờ ĐỊA PHƯƠNG
  // (khớp quy ước dateStr toàn app, xem date-utils.js). Lưu ý: nếu habit
  // được archive rồi user đổi múi giờ thiết bị, mốc ngày quy đổi có thể
  // lệch 1 ngày so với lúc archive thật — rủi ro nhỏ, chấp nhận được cho
  // quy mô app cá nhân này (cùng lớp rủi ro với các đánh đổi khác đã
  // ghi trong ARCHITECTURE.md).
  function archivedDateKey(h) {
    return h.archivedAt ? DateUtils.dateKey(new Date(h.archivedAt)) : null;
  }

  // true nếu habit h (đang hoạt động HOẶC đã archive, hình dạng gộp
  // {id, name, validFrom, validTo?, archivedAt?}) được tính vào tổng
  // của dateStr.
  function isActiveOn(dateStr, h) {
    if (h.validFrom && dateStr < h.validFrom) return false;
    if (h.validTo) {
      if (dateStr > h.validTo) return false;
    } else {
      // Chưa có validTo tường minh (habit archive từ TRƯỚC khi tính
      // năng "xoá cả quá khứ" tồn tại) — dùng archivedAt làm mốc
      // ngừng thay thế, giữ nguyên hành vi cũ.
      const archived = archivedDateKey(h);
      if (archived && dateStr > archived) return false;
    }
    return true;
  }

  // Danh sách habit (gộp active + archived) tính vào tổng của dateStr —
  // dùng làm mẫu số "tổng việc" thay cho habits.length cố định trước đây.
  function habitsForDate(dateStr, { habits, archivedHabits }) {
    const fromActive = (habits || []).filter(h => isActiveOn(dateStr, h));
    const fromArchived = (archivedHabits || []).filter(h => isActiveOn(dateStr, h));
    return [...fromActive, ...fromArchived];
  }

  // Habit đang hoạt động (chưa archive) nhưng validFrom SAU dateStr —
  // tức "chưa áp dụng cho ngày này" — dùng để hiện khối "việc khác" gợi
  // ý mở rộng phạm vi ở day-detail.js. Chỉ xét habit ACTIVE (không xét
  // archived) vì mở rộng phạm vi cho 1 habit đã bỏ không phải nhu cầu
  // chính, giữ phạm vi tính năng gọn.
  function notYetActiveHabits(dateStr, { habits }) {
    return (habits || []).filter(h => h.validFrom && dateStr < h.validFrom);
  }

  // Ngày sớm nhất mà tracker này CÓ DỮ LIỆU THẬT (bất kỳ check hoặc
  // event nào) — dùng làm điểm bắt đầu thực tế khi người dùng chọn "áp
  // dụng không giới hạn / từ trước tới giờ" cho 1 habit (xem
  // habit-range-modal.js). Không có ý nghĩa gì khi hiện checklist tick
  // hồi tố cho những ngày TRƯỚC KHI người dùng bắt đầu dùng app — không
  // có gì để tick, chỉ tổ kéo dài danh sách vô ích. Trả về hôm nay nếu
  // tracker hoàn toàn trống (chưa có check/event nào).
  function earliestTrackedDate(data) {
    const dates = [];
    Object.values(data.checks || {}).forEach(byDate => {
      Object.keys(byDate).forEach(d => dates.push(d));
    });
    Object.keys(data.events || {}).forEach(d => dates.push(d));
    if (dates.length === 0) return DateUtils.dateKey(new Date());
    return dates.sort()[0];
  }

  return { isActiveOn, habitsForDate, notYetActiveHabits, earliestTrackedDate };
})();
