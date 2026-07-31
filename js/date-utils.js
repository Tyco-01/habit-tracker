// ============================================================
// date-utils.js — Tiện ích ngày tháng dùng CHUNG cho toàn app.
//
// Trước đây các hàm dưới đây bị định nghĩa lặp lại (copy-paste) ở
// nhiều file view khác nhau — rủi ro thật: dateKey() từng tồn tại
// với 2 CHỮ KÝ KHÁC NHAU ở 2 nơi (1 tham số Date vs 3 tham số
// year/month/day), dễ gây bug nếu gọi nhầm kiểu. Gộp về đây để chỉ
// còn 1 định nghĩa duy nhất, sửa 1 chỗ áp dụng toàn app.
//
// QUY ƯỚC dateStr trong toàn bộ app: luôn dạng "YYYY-MM-DD" (số
// tháng/ngày có đệm 0 phía trước nếu 1 chữ số) — KHÔNG dùng
// toISOString() (lệch múi giờ) hay các định dạng khác.
// ============================================================

const DateUtils = (() => {

  const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  // Tên tháng đầy đủ — dùng cho tiêu đề dạng "Thứ 5, 30 tháng 7"
  const MONTH_NAMES_FULL = [
    'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
    'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'
  ];

  // 2 kiểu viết tắt tên tháng khác nhau CÓ CHỦ ĐÍCH (không phải trùng lặp
  // cần gộp) — dùng cho 2 ngữ cảnh hiển thị khác nhau:
  //   MONTHS_SHORT_BAR ('T1'..'T12')  — nhãn dưới cột biểu đồ (stats.js),
  //     cần ngắn nhất có thể vì cột rất hẹp.
  //   MONTHS_SHORT_GRID ('Th1'..'Th12') — nhãn đầu mỗi khối tháng trong
  //     lưới "Cả năm" (year.js), có đủ chỗ rộng hơn nên rõ nghĩa hơn 1 chút.
  const MONTHS_SHORT_BAR = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
  const MONTHS_SHORT_GRID = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

  // Đổi 1 đối tượng Date thành chuỗi "YYYY-MM-DD" theo giờ ĐỊA PHƯƯƠNG
  // (không dùng toISOString() vì nó quy đổi sang UTC, có thể lệch 1 ngày
  // tuỳ múi giờ người dùng).
  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Biến thể nhận thẳng (year, monthIndex0based, day) thay vì Date — tiện
  // khi đang lặp qua lưới ngày/tháng (vd year.js) mà không cần dựng đối
  // tượng Date tạm chỉ để lấy key.
  function dateKeyFromParts(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // Chiều ngược lại: "YYYY-MM-DD" → đối tượng Date (giờ địa phương, 00:00).
  function parseDateStr(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Nhãn dạng "Thứ 5, 30 tháng 7" cho 1 đối tượng Date.
  function formatFullLabel(d) {
    return `${DAYS_VN[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES_FULL[d.getMonth()]}`;
  }

  // Nhãn ngắn dạng "30/7" — dùng cho lịch sử dấu ấn rút gọn.
  function formatShortLabel(d) {
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  // true nếu dateStr trùng đúng ngày hôm nay (giờ địa phương).
  function isToday(dateStr) {
    return dateStr === dateKey(new Date());
  }

  return {
    DAYS_VN, MONTH_NAMES_FULL, MONTHS_SHORT_BAR, MONTHS_SHORT_GRID,
    dateKey, dateKeyFromParts, parseDateStr,
    formatFullLabel, formatShortLabel, isToday
  };
})();
