// ============================================================
// tree-icons.js — Icon cây tượng trưng cho streak, thay cho icon lửa.
//
// 9 mốc tăng trưởng: 1-3-7-14-30-60-100-365-730 ngày (dày ở đầu để
// kích thích duy trì thói quen, thưa dần về sau khi động lực đã
// chuyển từ bên ngoài sang tự giác).
//
// Cơ chế héo úa khi lỡ streak (nhân văn hơn việc rớt thẳng về 0):
//   - Lỡ 1 ngày  → héo nhẹ (lá chuyển vàng nhạt), hình dạng giữ nguyên
//   - Lỡ 2 ngày  → héo đậm (vàng nâu, lá hơi rũ), hình dạng giữ nguyên
//   - Lỡ 3+ ngày → tụt về mốc liền dưới, coi như bắt đầu lại từ đó
//   - Tick lại bất cứ lúc nào trong 2 trạng thái héo đầu → phục hồi ngay
// ============================================================

const TreeIcons = (() => {

  const MILESTONES = CONFIG.MILESTONES;
  const DROP_THRESHOLD = CONFIG.WILT_DROP_THRESHOLD;

  const PALETTES = {
    normal: { dark: '#4A3620', mid: '#5C7A3D', l1: '#6B8A48', l2: '#7A9654', l3: '#8FA85F' },
    wilt1:  { dark: '#4A3620', mid: '#6B5A3A', l1: '#C9B77A', l2: '#D0C285', l3: '#D4C68F' },
    wilt2:  { dark: '#4A3620', mid: '#6B5A3A', l1: '#B08A4A', l2: '#B08A4A', l3: '#B08A4A' }
  };

  function milestoneFor(days) {
    let m = 0;
    for (const ms of MILESTONES) { if (days >= ms) m = ms; }
    return m;
  }

  function milestoneStepDown(days) {
    const idx = MILESTONES.indexOf(milestoneFor(days));
    return idx > 0 ? MILESTONES[idx - 1] : 0;
  }

  // Trả về markup SVG (chuỗi) cho 1 mốc + bảng màu cho trước.
  function svgFor(milestone, palette) {
    const p = palette;
    switch (milestone) {
      case 0:
      case 1:
        return `<svg width="16" height="16" viewBox="0 0 32 32" role="img" aria-label="Mầm cây">
          <ellipse cx="16" cy="26" rx="4" ry="2.5" fill="${p.dark}"/>
          <path d="M16 26c0-3 0-4 0-4" stroke="${p.mid}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        </svg>`;
      case 3:
        return `<svg width="16" height="16" viewBox="0 0 32 32" role="img" aria-label="Cây nảy mầm">
          <ellipse cx="16" cy="27" rx="4" ry="2" fill="${p.dark}"/>
          <path d="M16 27c0-5 0-7 0-7" stroke="${p.mid}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
          <path d="M16 20c-1.5-1-2-2-1.5-3 1.5 0 2 1.5 1.5 3z" fill="${p.l1}"/>
          <path d="M16 20c1.5-1 2-2 1.5-3-1.5 0-2 1.5-1.5 3z" fill="${p.l2}"/>
        </svg>`;
      case 7:
        return `<svg width="17" height="17" viewBox="0 0 32 32" role="img" aria-label="Cây con">
          <ellipse cx="16" cy="28" rx="4.2" ry="2" fill="${p.dark}"/>
          <path d="M16 28c0-7 0-10 0-10" stroke="${p.mid}" stroke-width="1.7" fill="none" stroke-linecap="round"/>
          <path d="M16 20c-2-1-3-3-2-4.5 2 0 2.5 2.5 2 4.5z" fill="${p.l1}"/>
          <path d="M16 20c2-1 3-3 2-4.5-2 0-2.5 2.5-2 4.5z" fill="${p.l2}"/>
        </svg>`;
      case 14:
        return `<svg width="17" height="17" viewBox="0 0 32 32" role="img" aria-label="Cây bén rễ">
          <ellipse cx="16" cy="29" rx="4.3" ry="1.8" fill="${p.dark}"/>
          <path d="M16 29c0-8 0-12 0-12" stroke="${p.mid}" stroke-width="1.9" fill="none" stroke-linecap="round"/>
          <path d="M16 20c-2.5-1-3.5-3.5-2.5-5 2.5 0 3 3 2.5 5z" fill="${p.l1}"/>
          <path d="M16 20c2.5-1 3.5-3.5 2.5-5-2.5 0-3 3-2.5 5z" fill="${p.l2}"/>
        </svg>`;
      case 30:
        return `<svg width="18" height="18" viewBox="0 0 32 32" role="img" aria-label="Cây ra nhánh">
          <ellipse cx="16" cy="29" rx="4.5" ry="1.8" fill="${p.dark}"/>
          <path d="M16 29c0-10 0-14 0-14" stroke="${p.mid}" stroke-width="2" fill="none" stroke-linecap="round"/>
          <circle cx="16" cy="14" r="4.5" fill="${p.l1}"/>
          <circle cx="12.5" cy="16" r="3" fill="${p.l2}"/>
          <circle cx="19.5" cy="16" r="3" fill="${p.l2}"/>
        </svg>`;
      case 60:
        return `<svg width="18" height="18" viewBox="0 0 32 32" role="img" aria-label="Cây hoá gỗ">
          <ellipse cx="16" cy="29" rx="4.8" ry="1.8" fill="${p.dark}"/>
          <path d="M16 29c0-9 0-13 0-13" stroke="${p.mid}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
          <circle cx="16" cy="13" r="5.5" fill="${p.l1}"/>
          <circle cx="11.5" cy="15.5" r="4" fill="${p.l2}"/>
          <circle cx="20.5" cy="15.5" r="4" fill="${p.l2}"/>
          <circle cx="16" cy="10" r="3.5" fill="${p.l3}"/>
        </svg>`;
      case 100:
        return `<svg width="19" height="19" viewBox="0 0 32 32" role="img" aria-label="Cây ra hoa">
          <ellipse cx="16" cy="30" rx="5.2" ry="1.8" fill="${p.dark}"/>
          <path d="M16 30c0-8 0-12 0-12" stroke="${p.mid}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          <circle cx="16" cy="12" r="6.5" fill="${p.l1}"/>
          <circle cx="11" cy="14.5" r="4.5" fill="${p.l2}"/>
          <circle cx="21" cy="14.5" r="4.5" fill="${p.l2}"/>
          <circle cx="16" cy="8.5" r="4" fill="${p.l3}"/>
        </svg>`;
      case 365:
        return `<svg width="20" height="20" viewBox="0 0 32 32" role="img" aria-label="Đại thụ">
          <ellipse cx="16" cy="31" rx="6" ry="1.8" fill="${p.dark}"/>
          <path d="M16 31c0-8 0-13 0-13" stroke="${p.mid}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
          <circle cx="16" cy="10" r="7.5" fill="${p.mid}"/>
          <circle cx="10" cy="13" r="5" fill="${p.l1}"/>
          <circle cx="22" cy="13" r="5" fill="${p.l1}"/>
          <circle cx="16" cy="6" r="4.5" fill="${p.l2}"/>
        </svg>`;
      default: // 730+
        return `<svg width="20" height="20" viewBox="0 0 32 32" role="img" aria-label="Thần mộc">
          <ellipse cx="16" cy="31" rx="7" ry="1.8" fill="${p.dark}"/>
          <path d="M16 31c0-7 0-12 0-12" stroke="${p.mid}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
          <circle cx="16" cy="9" r="8.5" fill="${p.mid}" opacity="0.9"/>
          <circle cx="9" cy="12" r="5.5" fill="${p.l1}"/>
          <circle cx="23" cy="12" r="5.5" fill="${p.l1}"/>
          <circle cx="16" cy="5" r="5" fill="${p.l2}"/>
          <circle cx="16" cy="11" r="3" fill="${p.l3}"/>
        </svg>`;
    }
  }

  // ---- Tính toán streak / trạng thái héo từ dữ liệu checks ----

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Số ngày liên tiếp đã tick, tính lùi từ 1 ngày mốc (mặc định hôm nay)
  function currentStreak(checksForHabit, fromDate) {
    let count = 0;
    let d = new Date(fromDate);
    while (checksForHabit && checksForHabit[dateKey(d)]) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }

  // Số ngày liên tiếp KHÔNG tick, tính đến hôm nay (0 nếu hôm nay đã tick)
  function missedStreak(checksForHabit, today) {
    const todayKey = dateKey(today);
    if (checksForHabit && checksForHabit[todayKey]) return 0;
    let count = 0;
    let d = new Date(today);
    for (let i = 0; i < 400; i++) {
      const key = dateKey(d);
      if (!checksForHabit || !checksForHabit[key]) {
        count++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return count;
  }

  // Streak đỉnh gần nhất trước chuỗi ngày lỡ hiện tại
  function peakBeforeMiss(checksForHabit, today, missed) {
    if (missed === 0) return currentStreak(checksForHabit, today);
    const d = new Date(today);
    d.setDate(d.getDate() - missed);
    return currentStreak(checksForHabit, d);
  }

  // API chính: trả về { level, displayDays, milestone } cho 1 habit
  function growthState(checksForHabit, today = new Date()) {
    const missed = missedStreak(checksForHabit, today);
    if (missed === 0) {
      const days = currentStreak(checksForHabit, today);
      return { level: 'normal', displayDays: days, milestone: milestoneFor(days) };
    }
    const peak = peakBeforeMiss(checksForHabit, today, missed);
    if (missed === 1) return { level: 'wilt1', displayDays: peak, milestone: milestoneFor(peak) };
    if (missed === 2) return { level: 'wilt2', displayDays: peak, milestone: milestoneFor(peak) };
    const dropped = milestoneStepDown(peak);
    return { level: 'normal', displayDays: dropped, milestone: dropped };
  }

  // Trả về chuỗi HTML sẵn sàng chèn vào DOM cho 1 trạng thái tăng trưởng
  function render(state) {
    if (!state || state.displayDays <= 0) return '';
    const palette = PALETTES[state.level] || PALETTES.normal;
    return svgFor(state.milestone, palette);
  }

  return { growthState, render, milestoneFor };
})();
