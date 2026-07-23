// ============================================================
// app.js — Điểm khởi động: xử lý đăng nhập, điều hướng tab, gắn kết
// toàn bộ các module lại với nhau.
// ============================================================

(function () {

  const root = document.getElementById('app');

  function showLockScreen() {
    root.innerHTML = `
      <div class="lock-screen">
        <h1>Thói quen mỗi ngày</h1>
        <p>Nhập mã bí mật của bạn. <strong style="color:var(--ink);">Lưu ý:</strong> mã sai dù chỉ 1 ký tự sẽ không báo lỗi — hệ thống sẽ tự tạo 1 vùng dữ liệu trống mới thay vì cảnh báo. Hãy chắc chắn gõ đúng nguyên văn mã bạn đã lưu.</p>
        <input type="password" id="secret-input" class="lock-input" placeholder="Mã bí mật (tối thiểu 8 ký tự)" autocomplete="off" />
        <button class="lock-btn" id="secret-submit">Tiếp tục</button>
        <p class="lock-error" id="lock-error"></p>
      </div>
    `;

    const input = root.querySelector('#secret-input');
    const btn = root.querySelector('#secret-submit');
    const errorEl = root.querySelector('#lock-error');

    async function submit() {
      errorEl.textContent = '';
      btn.disabled = true;
      try {
        await Auth.loginWithSecret(input.value);
        await bootAfterLogin();
      } catch (err) {
        errorEl.textContent = err.message === 'network_error'
          ? 'Không có kết nối mạng — thử lại khi có mạng.'
          : (err.message || 'Có lỗi xảy ra, thử lại.');
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  async function bootAfterLogin() {
    root.innerHTML = `
      <div class="tabs" style="justify-content:space-between;">
        <div style="display:flex;gap:6px;">
          <button class="tab-btn active" id="nav-today">Hôm nay</button>
          <button class="tab-btn" id="nav-year">Cả năm</button>
          <button class="tab-btn" id="nav-stats">Thống kê</button>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <button id="nav-export" aria-label="Xuất dữ liệu backup" title="Tải file backup dữ liệu" style="border:none;background:transparent;color:var(--mute);padding:6px 8px;display:flex;align-items:center;">
            <i class="ti ti-download" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button id="nav-logout" aria-label="Đăng xuất" style="border:none;background:transparent;color:var(--mute);padding:6px 8px;display:flex;align-items:center;">
            <i class="ti ti-logout" style="font-size:16px;" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div id="view-today"></div>
      <div id="view-year" style="display:none;"></div>
      <div id="view-stats" style="display:none;"></div>
      <div id="view-day" style="display:none;"></div>
      <div class="sync-indicator" id="sync-indicator"></div>
    `;

    const viewToday = root.querySelector('#view-today');
    const viewYear = root.querySelector('#view-year');
    const viewStats = root.querySelector('#view-stats');
    const viewDay = root.querySelector('#view-day');
    const navToday = root.querySelector('#nav-today');
    const navYear = root.querySelector('#nav-year');
    const navStats = root.querySelector('#nav-stats');
    const navLogout = root.querySelector('#nav-logout');
    const navExport = root.querySelector('#nav-export');

    navExport.addEventListener('click', () => {
      try {
        const filename = ExportData.exportAll();
        console.log('Đã xuất file backup:', filename);
      } catch (err) {
        alert('Không thể xuất dữ liệu — thử lại sau.');
        console.error('Lỗi xuất dữ liệu:', err);
      }
    });

    navLogout.addEventListener('click', () => {
      const confirmed = confirm(
        'Đăng xuất khỏi thiết bị này?\n\n' +
        'Bạn sẽ cần nhập lại mã bí mật để xem dữ liệu. ' +
        'Dữ liệu vẫn an toàn trên máy chủ, không bị mất.'
      );
      if (!confirmed) return;
      Auth.logout();
      LocalStore.clear();
      LocalStore.clearQueue();
      location.reload();
    });

    function showTab(tab) {
      viewToday.style.display = tab === 'today' ? 'block' : 'none';
      viewYear.style.display = tab === 'year' ? 'block' : 'none';
      viewStats.style.display = tab === 'stats' ? 'block' : 'none';
      viewDay.style.display = 'none';
      navToday.classList.toggle('active', tab === 'today');
      navYear.classList.toggle('active', tab === 'year');
      navStats.classList.toggle('active', tab === 'stats');
    }

    navToday.addEventListener('click', () => { showTab('today'); TodayView.render(viewToday); });
    navYear.addEventListener('click', () => { showTab('year'); YearView.render(viewYear, openDay); });
    navStats.addEventListener('click', () => { showTab('stats'); StatsView.render(viewStats); });

    function openDay(dateStr) {
      viewToday.style.display = 'none';
      viewYear.style.display = 'none';
      viewDay.style.display = 'block';
      DayDetailView.render(viewDay, dateStr, () => {
        viewDay.style.display = 'none';
        showTab('year');
        YearView.render(viewYear, openDay);
      });
    }

    // Thử lấy dữ liệu mới nhất từ server (nếu có mạng); nếu không, dùng
    // dữ liệu đã lưu cục bộ từ trước — app vẫn dùng được bình thường.
    try {
      await Sync.pullFromServer();
    } catch (err) {
      console.warn('Không tải được dữ liệu từ máy chủ, dùng dữ liệu cục bộ:', err);
    }

    TodayView.render(viewToday);
    showTab('today');

    setupSyncIndicator();
  }

  function setupSyncIndicator() {
    const el = document.getElementById('sync-indicator');
    if (!el) return;

    function showOffline() {
      el.textContent = 'Đang chờ mạng để đồng bộ';
      el.classList.add('visible');
    }
    function hide() {
      el.classList.remove('visible');
    }

    if (!navigator.onLine) showOffline();
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', () => {
      el.textContent = 'Đã kết nối lại';
      el.classList.add('visible');
      setTimeout(hide, 2000);
    });
  }

  // ---- Khởi động ----
  if (Auth.isLoggedIn()) {
    bootAfterLogin();
  } else {
    showLockScreen();
  }

})();
