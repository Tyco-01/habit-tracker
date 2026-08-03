// ============================================================
// views/stats.js — Màn "Thống kê": streak dài nhất và tỷ lệ hoàn
// thành theo tháng, xem riêng theo từng thói quen.
//
// Toàn bộ phép tính chạy ở phía trình duyệt, dựa trên dữ liệu đã
// tải sẵn trong Sync.getData() — không cần gọi thêm API nào.
// ============================================================

const StatsView = (() => {

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
      const key = DateUtils.dateKeyFromParts(d.getFullYear(), d.getMonth(), d.getDate());
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
        const key = DateUtils.dateKeyFromParts(today.getFullYear(), m, day);
        if (checksForHabit && checksForHabit[key]) done++;
      }
      rates.push(lastDay > 0 ? Math.round((done / lastDay) * 100) : 0);
    }
    return rates;
  }

  function render(container) {
    let lastStatsHtml = null; // xem giải thích ở EventSection.drawEvents(), cùng cơ chế

    function draw() {
      const { habits, checks } = Sync.getData();
      const today = new Date();

      if (habits.length === 0) {
        const emptyHtml = `
          <h3 style="margin:0 0 4px;font-weight:600;font-size:18px;color:var(--ink);">Thống kê</h3>
          <div class="empty-state"><p>Chưa có việc nào để thống kê.</p></div>
        `;
        if (emptyHtml === lastStatsHtml) return;
        lastStatsHtml = emptyHtml;
        container.innerHTML = emptyHtml;
        return;
      }

      const selectedId = container.dataset.selectedHabit || habits[0].id;
      const selected = habits.find(h => h.id === selectedId) || habits[0];
      const habitChecks = checks[selected.id];

      const longest = longestStreak(habitChecks);
      const rate30 = completionRate(habitChecks, 30, today);
      const rates = monthlyRates(habitChecks, today);
      const maxRate = Math.max(...rates, 1);

      const mainHtml = `
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

        <p class="section-label" style="margin-top:20px;">HOÀN THÀNH THEO THÁNG</p>
        <div class="stats-bars">
          ${rates.map((r, i) => `
            <div class="stats-bar-col">
              <div class="stats-bar" style="height:${Math.max(4, (r / maxRate) * 60)}px;"></div>
              <span class="stats-bar-label">${DateUtils.MONTHS_SHORT_BAR[i]}</span>
            </div>
          `).join('')}
        </div>
      `;

      // Chuỗi picker (chọn habit đang xem thống kê) đổi theo selectedId,
      // cần gộp vào cùng chuỗi so sánh — nếu chỉ so sánh mainHtml, đổi
      // habit đang chọn (mà số liệu 2 habit tình cờ giống hệt nhau) sẽ
      // không kích hoạt render lại phần "active" pill.
      const pickerHtmlPreview = habits.map(h => (h.id === selected.id ? '1' : '0')).join('');
      const fullHtml = mainHtml + '|' + pickerHtmlPreview;
      if (fullHtml === lastStatsHtml) return;
      lastStatsHtml = fullHtml;
      container.innerHTML = mainHtml;

      const picker = container.querySelector('#stats-picker');
      picker.innerHTML = habits.map(h => `
        <button class="stats-pill ${h.id === selected.id ? 'active' : ''}" data-habit="${h.id}">${DomUtils.escapeHtml(h.name)}</button>
      `).join('');
      picker.querySelectorAll('[data-habit]').forEach(btn => {
        btn.addEventListener('click', () => {
          container.dataset.selectedHabit = btn.dataset.habit;
          draw();
        });
      });
    }

    // Gỡ listener của lần render() trước (nếu có) — render() gọi lại mỗi
    // khi chuyển sang tab "Thống kê", nếu không gỡ sẽ cộng dồn listener.
    if (container.__statsOnChange) Sync.offChange(container.__statsOnChange);
    container.__statsOnChange = draw;
    Sync.onChange(draw);
    draw();
  }

  return { render };
})();
