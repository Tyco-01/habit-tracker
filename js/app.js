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
      <div class="tabs sticky-tabs" style="justify-content:space-between;">
        <div style="display:flex;gap:6px;">
          <button class="tab-btn tab-btn-icon active" id="nav-today" aria-label="Hôm nay" title="Hôm nay">
            <i class="ti ti-home" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button class="tab-btn tab-btn-icon" id="nav-year" aria-label="Cả năm" title="Cả năm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="3"/>
              <path d="M3 9.5h18"/>
              <path d="M8 3v3M16 3v3"/>
              <text x="12" y="16.8" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" stroke="none" font-family="Manrope, sans-serif">${new Date().getDate()}</text>
            </svg>
          </button>
          <button class="tab-btn tab-btn-icon" id="nav-stats" aria-label="Thống kê" title="Thống kê">
            <i class="ti ti-chart-bar" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button class="tab-btn tab-btn-icon" id="nav-trash" aria-label="Thùng rác" title="Thùng rác">
            <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <button id="nav-refresh" aria-label="Làm tươi" title="Tải lại app — dùng khi giao diện bị lỗi hoặc hiển thị sai" style="border:none;background:transparent;color:var(--mute);padding:6px 8px;display:flex;align-items:center;">
            <i class="ti ti-refresh" style="font-size:16px;" aria-hidden="true"></i>
          </button>
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
      <div id="view-trash" style="display:none;"></div>
      <div id="view-day" style="display:none;"></div>
      <div class="sync-indicator" id="sync-indicator"></div>
    `;

    const viewToday = root.querySelector('#view-today');
    const viewYear = root.querySelector('#view-year');
    const viewStats = root.querySelector('#view-stats');
    const viewTrash = root.querySelector('#view-trash');
    const viewDay = root.querySelector('#view-day');
    const navToday = root.querySelector('#nav-today');
    const navYear = root.querySelector('#nav-year');
    const navStats = root.querySelector('#nav-stats');
    const navTrash = root.querySelector('#nav-trash');
    const navRefresh = root.querySelector('#nav-refresh');
    const navLogout = root.querySelector('#nav-logout');
    const navExport = root.querySelector('#nav-export');

    // "Làm tươi" — vừa dọn trạng thái JS tạm thời (reload trang) VỪA
    // tự dò-sửa lỗi CẤU TRÚC DỮ LIỆU thật đã biết (vd vòng lặp cha-con
    // khiến habit biến mất khỏi màn hình dù dữ liệu chưa hề bị xoá).
    // Reload đơn thuần KHÔNG sửa được lỗi dữ liệu — dữ liệu lỗi vẫn
    // y nguyên sau khi tải lại. Đây là lý do thêm bước dò-sửa trước.
    navRefresh.addEventListener('click', async () => {
      navRefresh.disabled = true;
      try {
        const result = DataRepair.diagnose();
        if (result.changed) {
          // Áp dụng từng thao tác tách qua Sync.setHabitParent có sẵn,
          // đi đúng luồng đồng bộ hàng đợi hiện có (không viết API
          // ghi đè mảng riêng).
          for (const id of result.idsToDetach) {
            Sync.setHabitParent(id, null);
          }
          await ConfirmModal.show({
            title: 'Đã tìm và sửa xong lỗi dữ liệu',
            body: result.details.join('. ') + '.',
            confirmLabel: 'Tải lại',
            hideCancel: true
          });
        }
      } catch (err) {
        console.error('Lỗi khi dò-sửa dữ liệu:', err);
      }
      location.reload();
    });

    navExport.addEventListener('click', () => {
      try {
        const filename = ExportData.exportAll();
        console.log('Đã xuất file backup:', filename);
      } catch (err) {
        alert('Không thể xuất dữ liệu — thử lại sau.');
        console.error('Lỗi xuất dữ liệu:', err);
      }
    });

    navLogout.addEventListener('click', async () => {
      const ok = await ConfirmModal.show({
        title: 'Đăng xuất khỏi thiết bị này?',
        body: 'Bạn sẽ cần nhập lại mã bí mật để xem dữ liệu. Dữ liệu vẫn an toàn trên máy chủ, không bị mất.',
        confirmLabel: 'Đăng xuất'
      });
      if (!ok) return;
      Auth.logout();
      LocalStore.clear();
      LocalStore.clearQueue();
      location.reload();
    });

    // ---- Nhớ vị trí cuộn của từng tab, để quay lại không phải cuộn lại từ đầu ----
    const scrollPositions = { today: 0, year: 0, stats: 0, trash: 0 };
    let currentTab = 'today';

    function saveScrollPosition() {
      scrollPositions[currentTab] = window.scrollY;
    }

    function restoreScrollPosition(tab) {
      // Đợi 1 nhịp render xong rồi mới cuộn, để chiều cao trang đã ổn định
      requestAnimationFrame(() => window.scrollTo(0, scrollPositions[tab] || 0));
    }

    function showTab(tab) {
      saveScrollPosition();
      viewToday.style.display = tab === 'today' ? 'block' : 'none';
      viewYear.style.display = tab === 'year' ? 'block' : 'none';
      viewStats.style.display = tab === 'stats' ? 'block' : 'none';
      viewTrash.style.display = tab === 'trash' ? 'block' : 'none';
      viewDay.style.display = 'none';
      navToday.classList.toggle('active', tab === 'today');
      navYear.classList.toggle('active', tab === 'year');
      navStats.classList.toggle('active', tab === 'stats');
      navTrash.classList.toggle('active', tab === 'trash');
      currentTab = tab;
      restoreScrollPosition(tab);
    }

    navToday.addEventListener('click', () => { showTab('today'); TodayView.render(viewToday); });
    navYear.addEventListener('click', () => { showTab('year'); YearView.render(viewYear, openDay); });
    navStats.addEventListener('click', () => { showTab('stats'); StatsView.render(viewStats); });
    navTrash.addEventListener('click', () => { showTab('trash'); TrashView.render(viewTrash); });

    function openDay(dateStr) {
      saveScrollPosition();
      viewToday.style.display = 'none';
      viewYear.style.display = 'none';
      viewDay.style.display = 'block';
      window.scrollTo(0, 0);
      DayDetailView.render(viewDay, dateStr, () => {
        viewDay.style.display = 'none';
        showTab('year');
        YearView.render(viewYear, openDay);
      });
    }

    // Cho phép các view khác (vd lịch sử dấu ấn ở màn Hôm nay) điều
    // hướng thẳng tới 1 ngày cụ thể trong "Cả năm" mà không cần người
    // dùng tự bấm qua từng bước.
    window.__jumpToDate = (dateStr) => openDay(dateStr);

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
