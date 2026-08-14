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
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="tab-btn tab-btn-icon active" id="nav-today" aria-label="Hôm nay" title="Hôm nay">
            <i class="ti ti-home" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button class="tab-btn tab-btn-icon tab-btn-calendar-icon" id="nav-year" aria-label="Lịch" title="Lịch">
            <span class="cal-icon-weekday" id="nav-cal-weekday"></span>
            <span class="cal-icon-daynum" id="nav-cal-daynum"></span>
          </button>
          <button class="tab-btn tab-btn-icon" id="nav-stats" aria-label="Thống kê" title="Thống kê">
            <i class="ti ti-chart-bar" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button class="tab-btn tab-btn-icon" id="nav-trash" aria-label="Thùng rác" title="Thùng rác">
            <i class="ti ti-trash" style="font-size:15px;" aria-hidden="true"></i>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <!-- touch-action:none trên #nav-theme — thao tác "giữ rồi rê
               ngón tay xuống chọn 1 trong 3 mode" (js/theme-quick-
               picker.js) là 1 cử chỉ DỌC ngay trên nút này. #app/body
               có touch-action:pan-y (cho vuốt ngang 4-tab hoạt động,
               xem css/base.css) — nhưng "pan-y" đồng nghĩa "trục dọc
               giao lại hoàn toàn cho trình duyệt tự cuộn", nên khi
               ngón tay rê dọc trên #nav-theme, trình duyệt tự ý coi
               đó là cuộn trang, GIÀNH quyền xử lý và bắn pointercancel
               giữa chừng, cắt đứt việc JS đang theo dõi rê-chọn (đã
               xác nhận qua Puppeteer touchscreen thật: giữ đủ 500ms,
               rê xuống lựa chọn "light", is-hover đúng, nhưng thả tay
               ra sự kiện thực nhận được là pointercancel chứ không
               phải pointerup, nên ThemeToggle.set() không bao giờ
               được gọi). touch-action:none GHI ĐÈ pan-y kế thừa CHỈ
               TRÊN NÚT NÀY — báo trình duyệt nhường TOÀN QUYỀN xử lý
               mọi cử chỉ (cả dọc lẫn ngang) bắt đầu từ đây cho JS,
               không tự ý can thiệp. -->
          <button id="nav-theme" aria-label="Đổi giao diện" style="border:none;background:transparent;color:var(--mute);padding:6px 8px;display:flex;align-items:center;touch-action:none;">
            <i class="ti" style="font-size:16px;" aria-hidden="true"></i>
          </button>
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
      <div id="view-today" class="view-fade-in"></div>
      <div id="view-year" class="view-fade-in" style="display:none;"></div>
      <div id="view-stats" class="view-fade-in" style="display:none;"></div>
      <div id="view-trash" class="view-fade-in" style="display:none;"></div>
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
    const navTheme = root.querySelector('#nav-theme');
    const tabsEl = root.querySelector('.tabs');

    // Vị trí thanh tab (trên/dưới) — áp dụng NGAY lúc mount theo lựa
    // chọn đã lưu (mặc định "trên" nếu chưa từng đổi), và gắn nhấn giữ
    // để đổi qua lại. Không cần callback onChange gì thêm ở đây —
    // apply() đã tự lo mọi việc (class CSS, padding #app), UI cập
    // nhật ngay khi người dùng chọn trong bảng.
    TabBarPosition.apply(tabsEl);
    TabBarPosition.bind(tabsEl);

    // Icon tab "Lịch" hiển thị kiểu "T2 21": thứ trong tuần + số ngày
    // nằm ngang cạnh nhau — thay cho icon lịch tĩnh cũ. "Chủ nhật" rút
    // gọn riêng thành "CN" (khác DateUtils.DAYS_VN vốn dùng "Chủ nhật"
    // đầy đủ cho những chỗ khác cần văn phong trang trọng hơn); các
    // ngày còn lại giữ nguyên "Thứ 2".."Thứ 7" đã có sẵn dạng số,
    // không cần đổi. Chỉ tính 1 lần lúc mount — đủ dùng vì hiếm khi 1
    // phiên làm việc kéo dài qua nửa đêm để lệch ngày.
    function syncCalendarIcon() {
      const now = new Date();
      const weekdayEl = root.querySelector('#nav-cal-weekday');
      const daynumEl = root.querySelector('#nav-cal-daynum');
      if (!weekdayEl || !daynumEl) return;
      weekdayEl.textContent = now.getDay() === 0 ? 'CN' : DateUtils.DAYS_VN[now.getDay()];
      daynumEl.textContent = String(now.getDate()).padStart(2, '0'); // luôn 2 chữ số ("08" thay vì "8") để độ rộng icon ổn định mọi ngày trong tháng, không co giãn theo 1 hay 2 chữ số
    }
    syncCalendarIcon();

    // Nút đổi giao diện — mở ThemeEditorModal (3 chế độ có sẵn + bộ
    // sưu tập theme tuỳ chỉnh, xem js/theme-editor-modal.js). Icon
    // phản ánh chế độ ĐANG chọn — dùng ti-palette riêng cho theme tuỳ
    // chỉnh (không có icon cố định như 3 chế độ có sẵn).
    function syncThemeButton() {
      const mode = ThemeToggle.get();
      const icon = navTheme.querySelector('i');
      if (ThemeToggle.isCustomMode(mode)) {
        const theme = ThemeToggle.listCustomThemes().find(t => t.id === ThemeToggle.customIdOf(mode));
        icon.className = 'ti ti-palette';
        navTheme.title = theme ? theme.name : 'Giao diện';
      } else {
        icon.className = `ti ${ThemeToggle.ICON[mode]}`;
        navTheme.title = ThemeToggle.LABEL[mode];
      }
    }
    syncThemeButton();
    // onChange: ThemeEditorModal gọi lại MỖI KHI theme thật sự đổi
    // (chọn chế độ có sẵn, áp/sửa/xoá theme tuỳ chỉnh) — để icon nút
    // này cập nhật ngay, không cần đợi đóng modal hay poll định kỳ.
    navTheme.addEventListener('click', () => {
      ThemeEditorModal.open(syncThemeButton);
    });
    // NHẤN GIỮ cùng nút này (khác bấm ngắn ở trên) mở bảng chọn nhanh
    // 3 chế độ có sẵn — rê-thả để chọn ngay, không cần mở hẳn modal
    // đầy đủ. Tự chặn không mở ThemeEditorModal nếu long-press đã kích
    // hoạt (xem js/theme-quick-picker.js).
    ThemeQuickPicker.bind(navTheme, syncThemeButton);

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

    function showTab(tab, { restoreScroll = true } = {}) {
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
      if (restoreScroll) restoreScrollPosition(tab);
    }

    // TAB_ORDER + goToTab() gộp chung logic "chuyển sang đúng tab N,
    // gọi đúng render() của nó" — dùng CHUNG bởi cả click nút VÀ vuốt
    // ngang (SwipeNav, gắn dưới cùng khối này), để không viết lặp lại
    // 4 nhánh if/else y hệt nhau ở 2 nơi.
    const TAB_ORDER = ['today', 'year', 'stats', 'trash'];
    const TAB_LABEL = { today: 'Hôm nay', year: 'Lịch', stats: 'Thống kê', trash: 'Thùng rác' };
    function goToTab(tab) {
      if (tab === 'today') { showTab('today'); TodayView.render(viewToday); }
      else if (tab === 'year') { showTab('year', { restoreScroll: false }); YearView.render(viewYear, openDay, { focusToday: true }); }
      else if (tab === 'stats') { showTab('stats'); StatsView.render(viewStats); }
      else if (tab === 'trash') { showTab('trash'); TrashView.render(viewTrash); }
    }

    navToday.addEventListener('click', () => goToTab('today'));
    navYear.addEventListener('click', () => goToTab('year'));
    navStats.addEventListener('click', () => goToTab('stats'));
    navTrash.addEventListener('click', () => goToTab('trash'));

    // Vuốt ngang TRÊN NỘI DUNG TRANG để đổi qua lại 4 tab chính, theo
    // đúng thứ tự hiển thị trên thanh tab (Hôm nay→Lịch→Thống kê→Thùng
    // rác) — trái = tab kế tiếp, phải = tab trước đó, cùng quy ước với
    // vuốt trên .cal-switcher (year.js).
    //
    // GẮN LÊN document.body, KHÔNG PHẢI root (#app) — #app có padding
    // riêng và chiều cao co theo NỘI DUNG thực tế của tab đang xem (vd
    // tab "Hôm nay" với ít việc sẽ thấp hơn hẳn viewport) — khi đó
    // phần diện tích màn hình còn lại (vùng trống bên dưới nội dung)
    // thuộc về BODY, KHÔNG PHẢI CON của #app — bind trên #app hoàn
    // toàn không nhận được gì trong trường hợp này (xác nhận qua
    // Puppeteer touchscreen thật, xem ARCHITECTURE.md mục 8).
    //
    // shouldIgnore kiểm tra TARGET THẬT của cử chỉ (không dựa vào biến
    // currentTab như bản trước — ở tab Lịch vẫn có vùng KHÔNG thuộc
    // .cal-switcher/.cal-pane, vd khoảng trống phía trên card, nơi
    // vuốt đổi TAB vẫn nên hoạt động) — chỉ nhường cho year.js xử lý
    // khi cử chỉ THỰC SỰ bắt đầu trong 1 trong 2 vùng đó.
    //
    // ANIMATION "GIỌT LỎNG" — 2 view (đang xem + hàng xóm sắp/vừa rời
    // khỏi) cùng hiện, dịch chuyển ĐÚNG theo dx trong lúc kéo (xem
    // dragMove), rồi "trôi nốt" bằng CSS transition khi thả tay (xem
    // dragSettle/dragCancel) — không snap tức thì.
    const dragState = { neighborTab: null, neighborEl: null };

    function viewElByTab(tab) {
      if (tab === 'today') return viewToday;
      if (tab === 'year') return viewYear;
      if (tab === 'stats') return viewStats;
      if (tab === 'trash') return viewTrash;
      return null;
    }

    // dx âm (kéo trái) => xem tab KẾ TIẾP; dx dương (kéo phải) => tab TRƯỚC ĐÓ
    function neighborTabFor(dx) {
      const idx = TAB_ORDER.indexOf(currentTab);
      return TAB_ORDER[dx < 0 ? idx + 1 : idx - 1] || null;
    }

    function dragMove(dx) {
      const wantTab = neighborTabFor(dx);
      if (dragState.neighborTab !== wantTab) {
        // Đổi hướng kéo giữa chừng, hoặc lần đầu xác định hàng xóm —
        // dọn hàng xóm CŨ (nếu có) rồi chuẩn bị hàng xóm MỚI.
        if (dragState.neighborEl) {
          dragState.neighborEl.style.display = 'none';
          dragState.neighborEl.style.transform = '';
        }
        dragState.neighborTab = wantTab;
        dragState.neighborEl = wantTab ? viewElByTab(wantTab) : null;
        if (dragState.neighborEl) dragState.neighborEl.style.display = 'block';
        // Cập nhật CHỈ BÁO đang vuốt tới đâu — chỉ set lại khi ĐÍCH
        // thực sự đổi (không phải mỗi frame kéo), vì wantTab chỉ đổi
        // khi người dùng đảo hướng giữa chừng hoặc đã ở đầu/cuối danh
        // sách tab (wantTab null → không có gì để hiện, ẩn hint đi).
        if (wantTab) SwipeHint.show(`→ ${TAB_LABEL[wantTab]}`);
        else SwipeHint.hide();
      }
      const currentEl = viewElByTab(currentTab);
      if (currentEl) currentEl.style.transform = `translateX(${dx}px)`;
      if (dragState.neighborEl) {
        // Hàng xóm luôn cách view hiện tại ĐÚNG 1 bề rộng viewport,
        // cùng chiều với hướng kéo — tiến dần vào khung hình theo
        // đúng % ngón tay đã đi, tạo cảm giác "2 trang trôi qua nhau".
        const vw = window.innerWidth;
        const sign = dx < 0 ? 1 : -1;
        dragState.neighborEl.style.transform = `translateX(${dx - sign * vw}px)`;
      }
    }

    // animated=true: "trôi nốt" bằng transition rồi dọn sạch transform/
    // display khi xong, thay vì snap tức thì về vị trí cuối — dùng
    // chung cho cả huỷ kéo (mọi view trôi VỀ vị trí gốc translateX(0))
    // lẫn hoàn tất đổi tab (view cũ trôi HẲN ra ngoài viewport, view
    // mới trôi nốt tới đúng vị trí 0 — cả 2 đều chỉ là "còn 1 đoạn
    // đường ngắn cần animate", không phải chạy lại animation từ đầu).
    function finishDrag(animated) {
      [viewToday, viewYear, viewStats, viewTrash].forEach(el => {
        if (el.style.transform === '') return;
        if (animated) {
          el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
          const done = () => { el.style.transition = ''; el.removeEventListener('transitionend', done); if (el !== viewElByTab(currentTab)) el.style.display = 'none'; };
          el.addEventListener('transitionend', done);
        } else if (el !== viewElByTab(currentTab)) {
          el.style.display = 'none';
        }
        el.style.transform = '';
      });
      dragState.neighborTab = null;
      dragState.neighborEl = null;
    }

    SwipeNav.bind(document.body, {
      shouldIgnore: (target) => !!target.closest('.cal-switcher, .cal-pane'),
      onDrag: dragMove,
      onCommit: (dir) => {
        // dir: -1 (kéo trái) | 1 (kéo phải). Hàng xóm ĐÃ ĐÚNG tab cần
        // chuyển tới (dragState tự cập nhật liên tục trong dragMove) —
        // chỉ cần chính thức hoá currentTab + render nội dung mới NGAY
        // (không đợi animation kết thúc, để dữ liệu hiển thị luôn mới
        // nhất) rồi để finishDrag() animate nốt phần transform còn lại.
        const wantTab = dragState.neighborTab;
        if (!wantTab) return; // đã ở đầu/cuối danh sách, không có hàng xóm để chuyển tới
        currentTab = wantTab;
        navToday.classList.toggle('active', currentTab === 'today');
        navYear.classList.toggle('active', currentTab === 'year');
        navStats.classList.toggle('active', currentTab === 'stats');
        navTrash.classList.toggle('active', currentTab === 'trash');
        if (currentTab === 'today') TodayView.render(viewToday);
        else if (currentTab === 'year') YearView.render(viewYear, openDay, { focusToday: true });
        else if (currentTab === 'stats') StatsView.render(viewStats);
        else if (currentTab === 'trash') TrashView.render(viewTrash);
      },
      onSettle: () => { finishDrag(true); SwipeHint.hide(); },
      onCancel: () => { finishDrag(true); SwipeHint.hide(); }
    });

    function openDay(dateStr) {
      saveScrollPosition();
      // Ẩn TOÀN BỘ 4 view chính, không chỉ viewToday/viewYear — bug
      // thật đã tồn tại: nếu đang ở tab Thống kê hoặc Thùng rác rồi mở
      // day-detail (vd qua link từ đâu đó gọi window.__jumpToDate),
      // view cũ (stats/trash) không hề bị ẩn, hiển thị CHỒNG LẤN cùng
      // lúc với viewDay mới — cả 2 nội dung hiện trên cùng 1 trang.
      // Phát hiện qua rà soát ảnh chụp toàn bộ view, không phải lỗi cố
      // ý tái hiện được bằng thao tác thông thường (đường vào day-
      // detail phổ biến nhất — bấm ô ngày trong Lịch — luôn xuất phát
      // từ tab Lịch nên không lộ bug này).
      viewToday.style.display = 'none';
      viewYear.style.display = 'none';
      viewStats.style.display = 'none';
      viewTrash.style.display = 'none';
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

    // Cảnh báo hết dung lượng NGHIÊM TRỌNG hơn cảnh báo mạng (mất mạng
    // chỉ trễ đồng bộ, còn hết dung lượng có thể MẤT THAY ĐỔI thật) —
    // dùng cờ này để chặn các nhánh offline/online ghi đè mất cảnh báo
    // quan trọng hơn khi cả 2 tình huống xảy ra cùng lúc.
    let storageFull = false;

    function showOffline() {
      if (storageFull) return;
      el.textContent = 'Đang chờ mạng để đồng bộ';
      el.classList.add('visible');
    }
    function hide() {
      if (storageFull) return;
      el.classList.remove('visible');
    }

    if (!navigator.onLine) showOffline();
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', () => {
      if (storageFull) return;
      el.textContent = 'Đã kết nối lại';
      el.classList.add('visible');
      setTimeout(hide, 2000);
    });

    Sync.onSaveError((reason) => {
      if (reason === 'local_storage_full') {
        storageFull = true;
        el.textContent = 'Hết dung lượng lưu trữ — thay đổi mới nhất có thể CHƯA được lưu. Hãy xoá bớt việc/sự kiện cũ.';
        el.classList.add('visible');
      } else if (reason === 'recovered') {
        storageFull = false;
        el.classList.remove('visible');
      }
    });
  }

  // ---- Khởi động ----
  if (Auth.isLoggedIn()) {
    bootAfterLogin();
  } else {
    showLockScreen();
  }

})();
