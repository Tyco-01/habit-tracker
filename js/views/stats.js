// ============================================================
// views/stats.js — Màn "Thống kê": streak dài nhất và tỷ lệ hoàn
// thành theo tháng, xem riêng theo từng thói quen.
//
// Toàn bộ phép tính chạy ở phía trình duyệt, dựa trên dữ liệu đã
// tải sẵn trong Sync.getData() — không cần gọi thêm API nào.
// ============================================================

const StatsView = (() => {

  const MONTHS_SHORT = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

  function dateKey(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // Streak dài nhất từng đạt được (không chỉ streak hiện tại) — quét
  // toàn bộ lịch sử tick, tìm chuỗi ngày liên tiếp dài nhất.
  function longestStreak(checksForHabit) {
    if (!checksForHabit) return 0;
    const dates = Object.keys(checksForHabit).filter(k => checksForHabit[k]).sort();
    if (dates.length === 0) return 0;

    let longest = 1;
    let current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const cur = new Date(dates[i] + 'T00:00:00');
      const diffDays = Math.round((cur - prev) / 86400000);
      if (diffDays === 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }
    return longest;
  }

  // Tỷ lệ % hoàn thành trong N ngày gần nhất (tính đến hôm nay)
  function completionRate(checksForHabit, days, today) {
    if (!checksForHabit) return 0;
    let done = 0;
    const d = new Date(today);
    for (let i = 0; i < days; i++) {
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (checksForHabit[key]) done++;
      d.setDate(d.getDate() - 1);
    }
    return Math.round((done / days) * 100);
  }

  // Tỷ lệ % hoàn thành theo từng tháng trong năm hiện tại (tính đến hôm nay
  // cho tháng hiện tại, cả tháng cho tháng đã qua)
  function monthlyRates(checksForHabit, today) {
    const rates = [];
    for (let m = 0; m <= today.getMonth(); m++) {
      const daysInMonth = new Date(today.getFullYear(), m + 1, 0).getDate();
      const lastDay = (m === today.getMonth()) ? today.getDate() : daysInMonth;
      let done = 0;
      for (let day = 1; day <= lastDay; day++) {
        const key = dateKey(today.getFullYear(), m, day);
        if (checksForHabit && checksForHabit[key]) done++;
      }
      rates.push(lastDay > 0 ? Math.round((done / lastDay) * 100) : 0);
    }
    return rates;
  }

  function render(container) {
    function draw() {
      const { habits, checks } = Sync.getData();
      const today = new Date();

      if (habits.length === 0) {
        container.innerHTML = `
          <h3 style="margin:0 0 4px;font-weight:600;font-size:18px;color:var(--ink);">Thống kê</h3>
          <div class="empty-state"><p>Chưa có việc nào để thống kê.</p></div>
        `;
        return;
      }

      const selectedId = container.dataset.selectedHabit || habits[0].id;
      const selected = habits.find(h => h.id === selectedId) || habits[0];
      const habitChecks = checks[selected.id];

      const longest = longestStreak(habitChecks);
      const rate30 = completionRate(habitChecks, 30, today);
      const rates = monthlyRates(habitChecks, today);
      const maxRate = Math.max(...rates, 1);

      container.innerHTML = `
        <h3 style="margin:0 0 16px;font-weight:600;font-size:18px;color:var(--ink);">Thống kê</h3>

        <div class="stats-habit-picker" id="stats-picker"></div>

        <div class="stats-cards">
          <div class="stats-card">
            <p class="stats-card-label">Streak dài nhất</p>
            <p class="stats-card-value">${longest} <span>ngày</span></p>
          </div>
          <div class="stats-card">
            <p class="stats-card-label">Hoàn thành (30 ngày)</p>
            <p class="stats-card-value">${rate30}<span>%</span></p>
          </div>
        </div>

        <p class="section-label" style="margin-top:20px;">TỶ LỆ HOÀN THÀNH THEO THÁNG</p>
        <div class="stats-bars">
          ${rates.map((r, i) => `
            <div class="stats-bar-col">
              <div class="stats-bar" style="height:${Math.max(4, (r / maxRate) * 60)}px;"></div>
              <span class="stats-bar-label">${MONTHS_SHORT[i]}</span>
            </div>
          `).join('')}
        </div>
      `;

      const picker = container.querySelector('#stats-picker');
      picker.innerHTML = habits.map(h => `
        <button class="stats-pill ${h.id === selected.id ? 'active' : ''}" data-habit="${h.id}">${escapeHtml(h.name)}</button>
      `).join('');
      picker.querySelectorAll('[data-habit]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.dataset.selectedHabit = btn.dataset.habit;
          draw();
        });
      });
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    Sync.onChange(draw);
    draw();
  }

  return { render };
})();
