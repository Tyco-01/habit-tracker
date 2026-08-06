// ============================================================
// lunar-calendar.js — Chuyển đổi Dương lịch → Âm lịch Việt Nam.
//
// Thuật toán thiên văn thuần (vị trí Mặt Trăng/Mặt Trời, điểm Sóc,
// tiết khí) tính theo múi giờ UTC+7 (giờ Việt Nam) — đây là công thức
// toán học phổ biến, không phải dữ liệu tra bảng có bản quyền.
// Độ chính xác đủ dùng cho mốc thời gian 1900–2100.
// ============================================================

const LunarCalendar = (() => {

  const PI = Math.PI;

  function INT(d) { return Math.floor(d); }

  // Ngày Julian (số nguyên, tính từ 12:00 UTC) của 1 ngày Dương lịch.
  function jdFromDate(dd, mm, yy) {
    const a = INT((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
    if (jd < 2299161) {
      jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
    }
    return jd;
  }

  // Chiều ngược lại: ngày Julian → {day, month, year} Dương lịch.
  function jdToDate(jd) {
    let a, b, c;
    if (jd > 2299160) {
      a = jd + 32044;
      b = INT((4 * a + 3) / 146097);
      c = a - INT((b * 146097) / 4);
    } else {
      b = 0;
      c = jd + 32082;
    }
    const d = INT((4 * c + 3) / 1461);
    const e = c - INT((1461 * d) / 4);
    const m = INT((5 * e + 2) / 153);
    const day = e - INT((153 * m + 2) / 5) + 1;
    const month = m + 3 - 12 * INT(m / 10);
    const year = b * 100 + d - 4800 + INT(m / 10);
    return { day, month, year };
  }

  // Vị trí Mặt Trời (kinh độ hoàng đạo biểu kiến, độ, chuẩn hoá 0..360)
  // tại thời điểm Julian jdn, múi giờ timeZone (giờ, vd 7 cho VN).
  function sunLongitude(jdn) {
    const T = (jdn - 2451545.0) / 36525;
    const T2 = T * T;
    const dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = L0 + DL;
    L = L * dr;
    L = L - PI * 2 * INT(L / (PI * 2));
    return L;
  }

  // Thời điểm Sóc (New Moon) thứ k kể từ Sóc chuẩn (giờ Julian, UT).
  function newMoon(k) {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 -= 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 -= 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    let deltat;
    if (T < -11) {
      deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    } else {
      deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }
    return Jd1 + C1 - deltat;
  }

  // Ngày Julian (làm tròn, giờ địa phương timeZone) của lần Sóc thứ k.
  function getNewMoonDay(k, timeZone) {
    return INT(newMoon(k) + 0.5 + timeZone / 24);
  }

  // Kinh độ Mặt Trời tại 1 thời điểm Julian, quy đổi ra "cung" 0..11
  // (mỗi cung 30 độ) — dùng để xác định tháng Tý (chứa Đông chí).
  function getSunLongitude(jdn, timeZone) {
    return INT(sunLongitude(jdn - 0.5 - timeZone / 24) / PI * 6);
  }

  function getLunarMonth11(yy, timeZone) {
    const off = jdFromDate(31, 12, yy) - 2415021;
    const k = INT(off / 29.530588853);
    let nm = getNewMoonDay(k, timeZone);
    const sunLong = getSunLongitude(nm, timeZone);
    if (sunLong >= 9) {
      nm = getNewMoonDay(k - 1, timeZone);
    }
    return nm;
  }

  function getLeapMonthOffset(a11, timeZone) {
    const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0;
    let i = 1;
    let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
    do {
      last = arc;
      i++;
      arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
    } while (arc !== last && i < 14);
    return i - 1;
  }

  // Đổi 1 ngày Dương lịch (dd/mm/yy) sang Âm lịch VN, múi giờ 7.0.
  // Trả về { day, month, year, leap } — leap=1 nếu là tháng nhuận.
  function convertSolar2Lunar(dd, mm, yy, timeZone = 7) {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1, timeZone);
    if (monthStart > dayNumber) {
      monthStart = getNewMoonDay(k, timeZone);
    }
    let a11 = getLunarMonth11(yy, timeZone);
    let b11 = a11;
    let lunarYear;
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = getLunarMonth11(yy - 1, timeZone);
    } else {
      lunarYear = yy + 1;
      b11 = getLunarMonth11(yy + 1, timeZone);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = INT((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) lunarLeap = 1;
      }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
  }

  // --- Can Chi ---
  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

  function canChiYear(lunarYear) {
    return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
  }

  // Nhãn ngắn gọn cho 1 ngày âm — "15" (ngày thường) hoặc "1/7" (mùng
  // 1, kèm số tháng để rõ vừa sang tháng mới) hoặc "1/7N" (mùng 1
  // tháng nhuận).
  function shortLabel(lunar) {
    if (lunar.day === 1) {
      return `${lunar.month}${lunar.leap ? 'N' : ''}/1`;
    }
    return String(lunar.day);
  }

  // API chính dùng cho toàn app: (Date JS) → thông tin âm lịch đầy đủ.
  function fromSolar(dateObj) {
    const lunar = convertSolar2Lunar(dateObj.getDate(), dateObj.getMonth() + 1, dateObj.getFullYear());
    return {
      day: lunar.day,
      month: lunar.month,
      year: lunar.year,
      leap: !!lunar.leap,
      isFirstDay: lunar.day === 1,
      shortLabel: shortLabel(lunar),
      fullLabel: `${lunar.day}/${lunar.month}${lunar.leap ? ' (nhuận)' : ''}/${lunar.year}`,
      canChiYear: canChiYear(lunar.year)
    };
  }

  return { fromSolar, convertSolar2Lunar, canChiYear };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = LunarCalendar;
