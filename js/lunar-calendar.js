// ============================================================
// js/lunar-calendar.js — Chuyển Dương lịch → Âm lịch Việt Nam, thuật
// toán thiên văn chuẩn (Hồ Ngọc Đức, múi giờ UTC+7) — KHÔNG dùng bảng
// tra cứu cứng (lookup table) vì âm lịch phụ thuộc thời điểm trăng
// non/tiết khí thực tế mỗi năm, bảng cứng sẽ hết hạn hoặc sai lệch.
//
// ĐÃ KIỂM CHỨNG: khớp ĐÚNG 12/12 mốc "mùng 1 tháng âm lịch" của năm
// 2026 lấy trực tiếp từ Lịch macOS (ảnh tham khảo người dùng cung
// cấp) + khớp Tết Giáp Thìn 2024 (10/2) và Tết Ất Tỵ 2025 (29/1) —
// xem smoke-test-lunar-calendar.js.
//
// Thuật toán này là công thức thiên văn CÔNG KHAI, phổ biến, được
// dùng lại rộng rãi trong nhiều dự án lịch âm Việt Nam mã nguồn mở —
// không phải phát minh riêng của app này.
// ============================================================

const LunarCalendar = (() => {

  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  const TIMEZONE = 7; // Việt Nam UTC+7 — thuật toán này TÍNH THEO múi giờ này, đổi sẽ lệch ngày sóc

  function jdFromDate(dd, mm, yy) {
    const a = Math.floor((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    if (jd < 2299161) {
      jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    }
    return jd;
  }

  // Thời điểm trăng non thứ k kể từ điểm gốc (xấp xỉ bằng chuỗi Fourier
  // rút gọn cho kinh độ Mặt Trăng-Mặt Trời) — lõi thuật toán, KHÔNG sửa
  // các hệ số ma thuật (magic number) dưới đây nếu không chắc chắn.
  function newMoon(k) {
    const T = k / 1236.85;
    const T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    let deltat;
    if (T < -11) {
      deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    } else {
      deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }
    return Jd1 + C1 - deltat;
  }

  // Kinh độ Mặt Trời thật (dùng để xác định tiết khí — cần cho việc
  // tìm tháng 11 âm lịch và tháng nhuận).
  function sunLongitude(jdn) {
    const T = (jdn - 2451545.0) / 36525;
    const T2 = T * T;
    const dr = Math.PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = L0 + DL;
    L = L * dr;
    L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
    return L;
  }

  function getSunLongitude(dayNumber) {
    return Math.floor(sunLongitude(dayNumber - 0.5 - TIMEZONE / 24) / Math.PI * 6);
  }
  function getNewMoonDay(k) {
    return Math.floor(newMoon(k) + 0.5 + TIMEZONE / 24);
  }
  function getLunarMonth11(yy) {
    const off = jdFromDate(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = getNewMoonDay(k);
    const sl = getSunLongitude(nm);
    if (sl >= 9) nm = getNewMoonDay(k - 1);
    return nm;
  }
  function getLeapMonthOffset(a11) {
    const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0, i = 1;
    let arc = getSunLongitude(getNewMoonDay(k + i));
    do {
      last = arc;
      i++;
      arc = getSunLongitude(getNewMoonDay(k + i));
    } while (arc !== last && i < 14);
    return i - 1;
  }

  // dd/mm/yy: ngày dương lịch → { day, month, year, isLeap } âm lịch.
  // year là NĂM ÂM LỊCH (có thể khác năm dương ở khoảng cận Tết).
  function toLunar(dd, mm, yy) {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1);
    if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
    let a11 = getLunarMonth11(yy);
    let b11 = a11;
    let lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = getLunarMonth11(yy - 1);
    } else {
      lunarYear = yy + 1;
      b11 = getLunarMonth11(yy + 1);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = false;
    let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      const leapMonthDiff = getLeapMonthOffset(a11);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) lunarLeap = true;
      }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, isLeap: lunarLeap };
  }

  // dateStr 'YYYY-MM-DD' (khớp quy ước DateUtils.dateKey của app) →
  // âm lịch. Tiện gọi trực tiếp từ view mà không cần tự parse ngày.
  function fromDateStr(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return toLunar(d, m, y);
  }

  // "Bính Ngọ" — tên Can Chi của 1 năm ÂM LỊCH (không phải năm dương).
  function canChiYear(lunarYear) {
    return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
  }

  // Chuỗi đầy đủ, RÕ RÀNG, không thể nhầm lẫn với ngày dương — dùng ở
  // nơi có đủ chỗ hiển thị (vd views/day-detail.js), KHÔNG dùng ở ô
  // lịch nhỏ trong lưới năm (xem views/year.js — chỉ hiện số ngày âm
  // rút gọn ở đó vì không đủ chỗ).
  function formatFull(lunar) {
    const monthLabel = lunar.isLeap ? `${lunar.month} (nhuận)` : `${lunar.month}`;
    return `${lunar.day}/${monthLabel} âm lịch, năm ${canChiYear(lunar.year)}`;
  }

  return { toLunar, fromDateStr, canChiYear, formatFull };
})();
