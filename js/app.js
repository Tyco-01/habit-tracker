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
      <div class="tabs sticky-tabs" id="tab-bar-outer" tabindex="0" style="justify-content:center;">
        <div class="tab-pill-group tab-pill-group-main" id="tab-pill-group">
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
          <!-- Home — TRUNG TÂM của thanh, to hơn 3 nút thường (xem
               .tab-btn-home trong layout.css). 3 hành vi khác nhau
               trên CÙNG 1 nút, không đè lên nhau (xem app.js):
                 - Nhấn 1 cái (click)  → goToTab('today'), y hệt hành
                   vi Home cũ.
                 - Nhấp đúp (dblclick) → mở ThemeEditorModal đầy đủ
                   (thay chỗ "bấm ngắn nút theme cũ" — bấm ngắn giờ đã
                   dùng cho goToTab nên dời sang đúp).
                 - Giữ (long-press + rê chọn) → ThemeQuickPicker, y hệt
                   hành vi "giữ nút theme cũ", chỉ đổi anchor sang đây.
               touch-action:none — LÝ DO Y HỆT #nav-theme cũ (đã xoá):
               ThemeQuickPicker cần 1 cử chỉ DỌC (giữ rồi rê xuống chọn)
               ngay trên nút này, phải giành quyền cử chỉ hoàn toàn
               khỏi tay trình duyệt (xem giải thích gốc trong lịch sử
               file, không lặp lại ở đây). -->
          <button class="tab-btn tab-btn-icon tab-btn-home active" id="nav-today" aria-label="Hôm nay — nhấn để về Hôm nay, giữ để đổi giao diện nhanh, nhấp đúp để mở đầy đủ tuỳ chỉnh giao diện" title="Hôm nay" style="touch-action:none;">
            <i class="ti ti-home" aria-hidden="true"></i>
          </button>
          <button id="nav-refresh" aria-label="Làm tươi" title="Tải lại app — dùng khi giao diện bị lỗi hoặc hiển thị sai">
            <i class="ti ti-refresh" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button id="nav-export" aria-label="Xuất dữ liệu backup" title="Tải file backup dữ liệu">
            <i class="ti ti-download" style="font-size:16px;" aria-hidden="true"></i>
          </button>
          <button id="nav-logout" aria-label="Đăng xuất">
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
    const tabsEl = root.querySelector('.tabs');

    // Vị trí thanh tab (trên/dưới) — áp dụng NGAY lúc mount theo lựa
    // chọn đã lưu (mặc định "trên" nếu chưa từng đổi), và gắn nhấn giữ
    // để đổi qua lại. Không cần callback onChange gì thêm ở đây —
    // apply() đã tự lo mọi việc (class CSS, padding #app), UI cập
    // nhật ngay khi người dùng chọn trong bảng.
    TabBarPosition.apply(tabsEl);
    TabBarPosition.bind(tabsEl);

    // Icon tab "Lịch" hiển thị kiểu "T2 21": thứ trong tuần rút gọn tối
    // đa (DateUtils.DAYS_VN_MICRO — "T2".."T7"/"CN") + số ngày nằm
    // ngang cạnh nhau, thay cho icon lịch tĩnh cũ. Chỉ tính 1 lần lúc
    // mount — đủ dùng vì hiếm khi 1 phiên làm việc kéo dài qua nửa đêm
    // để lệch ngày.
    function syncCalendarIcon() {
      const now = new Date();
      const weekdayEl = root.querySelector('#nav-cal-weekday');
      const daynumEl = root.querySelector('#nav-cal-daynum');
      if (!weekdayEl || !daynumEl) return;
      weekdayEl.textContent = DateUtils.DAYS_VN_MICRO[now.getDay()];
      daynumEl.textContent = String(now.getDate()).padStart(2, '0'); // luôn 2 chữ số ("08" thay vì "8") để độ rộng icon ổn định mọi ngày trong tháng, không co giãn theo 1 hay 2 chữ số
    }
    syncCalendarIcon();

    // ---- Nút Home giờ gộp 3 chức năng khác nhau, tách bạch bằng LOẠI
    // THAO TÁC (yêu cầu tinh gọn thanh nav — bỏ hẳn nút đổi giao diện
    // rời, gộp hết vào Home để tiết kiệm chỗ):
    //   - Nhấn 1 cái (click)  → về tab "Hôm nay" — hành vi GỐC, không đổi.
    //   - Giữ (long-press)    → ThemeQuickPicker — bảng chọn nhanh 3
    //     chế độ (hệ thống/sáng/tối).
    //   - Nhấp đúp (dblclick) → ThemeEditorModal — bảng đầy đủ (theme
    //     tuỳ chỉnh...).
    // 3 thao tác không đụng nhau: click/dblclick là sự kiện chuột gốc
    // của trình duyệt (tự phân biệt số lần bấm, không bao giờ bắn cả
    // 2 cho cùng 1 lần tương tác); long-press được ThemeQuickPicker tự
    // phát hiện qua pointerdown giữ đủ lâu không nhấc tay, nên không
    // bao giờ đồng thời sinh ra click. ----
    ThemeQuickPicker.bind(navToday);
    navToday.addEventListener('dblclick', () => ThemeEditorModal.open());

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

    // Hệ số làm mềm hiệu ứng ĐÀN HỒI khi kéo tại ĐẦU (today, kéo phải)
    // hoặc CUỐI (trash, kéo trái) danh sách tab — không có hàng xóm để
    // trôi vào, nhưng ngón tay vẫn đang kéo. Thay vì "im lìm không
    // phản hồi gì" (cảm giác app bị đứng/lag), view hiện tại di chuyển
    // theo dx nhưng bị "ghìm lại" bằng căn bậc hai — kéo cùng 1 khoảng
    // dx thực tế cho chuyển vị màn hình NHỎ HƠN NHIỀU và giảm dần tốc
    // độ, giống cảm giác "kéo dây thun" quen thuộc (iOS rubber-band
    // scroll). Hệ số 0.35 chọn qua thử nghiệm: đủ RÕ để nhận ra khác
    // biệt so với kéo bình thường, không NẶNG tới mức cảm giác ì trễ.
    function rubberBand(dx) {
      const sign = dx < 0 ? -1 : 1;
      return sign * Math.sqrt(Math.abs(dx)) * 6; // *6 bù lại độ "phẳng" của sqrt ở khoảng dx nhỏ, giữ cảm giác di chuyển có thật ngay từ đầu cú kéo thay vì gần như đứng yên
    }

    function dragMove(dx) {
      const wantTab = neighborTabFor(dx);
      if (dragState.neighborTab !== wantTab) {
        // Đổi hướng kéo giữa chừng, hoặc lần đầu xác định hàng xóm —
        // dọn hàng xóm CŨ (nếu có) rồi chuẩn bị hàng xóm MỚI.
        if (dragState.neighborEl) {
          dragState.neighborEl.style.display = 'none';
          dragState.neighborEl.style.transform = '';
          dragState.neighborEl.style.opacity = '';
          dragState.neighborEl.style.boxShadow = '';
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

      if (!wantTab) {
        // ĐẦU/CUỐI danh sách — áp dụng hiệu ứng ĐÀN HỒI thay vì kéo
        // tuyến tính bình thường, xem rubberBand() ở trên. Không có
        // hàng xóm nào để mờ dần/trôi vào, chỉ chính view hiện tại co
        // giãn nhẹ rồi tự bật lại khi thả tay (bật lại xử lý trong
        // finishDrag, dùng chung logic transform:'' như đường thoát
        // bình thường).
        if (currentEl) currentEl.style.transform = `translateX(${rubberBand(dx)}px)`;
        return;
      }

      // ---- Có hàng xóm hợp lệ — hiệu ứng ĐẦY ĐỦ: trượt NGANG (như cũ)
      // + MỜ DẦN (opacity) + BÓNG ĐỔ động, tạo cảm giác "2 lớp trang có
      // chiều sâu trôi qua nhau" thay vì 2 tấm phẳng trượt cứng. ----
      const vw = window.innerWidth;
      const progress = Math.min(1, Math.abs(dx) / vw); // 0 → 1, tiến độ đã kéo qua hết chiều rộng màn hình

      currentEl.style.transform = `translateX(${dx}px)`;
      // View ĐANG RỜI ĐI mờ dần từ 1 → 0.55 (không mờ hẳn về 0 — vẫn
      // cần đọc được nội dung nếu người dùng đổi ý kéo ngược lại giữa
      // chừng, mờ hẳn về 0 sẽ tạo cảm giác "biến mất" đột ngột khó
      // chịu hơn là hữu ích).
      currentEl.style.opacity = `${1 - progress * 0.45}`;
      // Bóng đổ RÚT DẦN theo cạnh đang rời khỏi khung hình — mô phỏng
      // trang đang "nhấc lên" khỏi trang bên dưới, đậm nhất lúc bắt
      // đầu kéo (còn che phần lớn màn hình) và nhạt dần khi gần trôi
      // hết (progress → 1, gần như phẳng lại với trang bên dưới).
      const shadowSide = dx < 0 ? '-' : ''; // trượt trái → bóng đổ bên PHẢI (hướng ngược lại chiều trôi, mô phỏng ánh sáng chiếu từ trên xuống lúc "nhấc mép")
      currentEl.style.boxShadow = `${shadowSide}${8 * (1 - progress)}px 0 ${20 * (1 - progress)}px rgba(var(--ink-rgb), ${0.18 * (1 - progress)})`;

      if (dragState.neighborEl) {
        // Hàng xóm luôn cách view hiện tại ĐÚNG 1 bề rộng viewport,
        // cùng chiều với hướng kéo — tiến dần vào khung hình theo
        // đúng % ngón tay đã đi, tạo cảm giác "2 trang trôi qua nhau".
        const sign = dx < 0 ? 1 : -1;
        dragState.neighborEl.style.transform = `translateX(${dx - sign * vw}px)`;
        // View SẮP TỚI mờ dần từ 0.7 → 1 (đối xứng ngược lại view đang
        // rời đi) — bắt đầu đã hiện mờ mờ (không phải 0 tuyệt đối) để
        // người dùng thấy ngay có gì đó đang tới, rõ dần lên khi kéo
        // gần hoàn tất.
        dragState.neighborEl.style.opacity = `${0.7 + progress * 0.3}`;
      }
    }

    // animated=true: "trôi nốt" bằng transition rồi dọn sạch transform/
    // opacity/boxShadow/display khi xong, thay vì snap tức thì về vị
    // trí cuối — dùng chung cho cả huỷ kéo (mọi view trôi VỀ vị trí
    // gốc translateX(0), opacity(1), không bóng) lẫn hoàn tất đổi tab
    // (view cũ trôi HẲN ra ngoài viewport, view mới trôi nốt tới đúng
    // vị trí 0 — cả 2 đều chỉ là "còn 1 đoạn đường ngắn cần animate",
    // không phải chạy lại animation từ đầu).
    function finishDrag(animated) {
      [viewToday, viewYear, viewStats, viewTrash].forEach(el => {
        const touched = el.style.transform !== '' || el.style.opacity !== '' || el.style.boxShadow !== '';
        if (!touched) return;
        if (animated) {
          el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
          const done = () => { el.style.transition = ''; el.removeEventListener('transitionend', done); if (el !== viewElByTab(currentTab)) el.style.display = 'none'; };
          el.addEventListener('transitionend', done);
        } else if (el !== viewElByTab(currentTab)) {
          el.style.display = 'none';
        }
        el.style.transform = '';
        el.style.opacity = '';
        el.style.boxShadow = '';
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

    // Lăn chuột NGANG + phím mũi tên TRÁI/PHẢI để chuyển nhanh 4 tab
    // chính trên desktop — bổ sung sau khi báo "muốn cơ chế lăn chuột
    // và phím mũi tên", cùng tinh thần với TabBarPosition (wheel/phím
    // mũi tên đổi vị trí top/bottom) nhưng ở đây đổi TAB, dùng TAB_ORDER
    // + goToTab() đã có sẵn — không cần animate "giọt lỏng" phức tạp
    // như lúc vuốt tay (dragMove/finishDrag), goToTab() chuyển thẳng
    // và để .view-fade-in (đã gắn sẵn trên mọi view, xem HTML mount ở
    // trên) tự lo hiệu ứng chuyển mượt.
    let tabWheelDebounce = null;
    function onTabWheel(e) {
      // Chỉ xử lý khi cử chỉ rõ ràng là NGANG (trackpad 2 ngón vuốt
      // ngang, hoặc chuột có bánh lăn ngang) — deltaX chiếm ưu thế hơn
      // deltaY. Lăn dọc bình thường (deltaY, chuột thường) phải giữ
      // NGUYÊN chức năng cuộn trang mặc định, không được cướp mất —
      // đây là lý do KHÔNG dùng deltaY ở đây như TabBarPosition.onWheel
      // (thanh tab đó đứng yên 1 chỗ nên cướp deltaY không ảnh hưởng
      // gì tới cuộn trang; còn document.body thì CHÍNH LÀ trang, cướp
      // nhầm deltaY sẽ khiến người dùng không cuộn trang được nữa).
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (target_isIgnored(e.target)) return;
      e.preventDefault();
      if (tabWheelDebounce) return; // debounce 150ms — cùng lý do TabBarPosition.onWheel, 1 lần lăn bắn nhiều sự kiện liên tiếp
      const idx = TAB_ORDER.indexOf(currentTab);
      const nextIdx = e.deltaX > 0 ? idx + 1 : idx - 1; // lăn "sang phải" (deltaX dương) → tab kế tiếp, cùng chiều trực giác với vuốt tay trái
      if (nextIdx >= 0 && nextIdx < TAB_ORDER.length) goToTab(TAB_ORDER[nextIdx]);
      tabWheelDebounce = setTimeout(() => { tabWheelDebounce = null; }, 150);
    }
    function target_isIgnored(target) {
      // Không cướp lăn ngang khi đang ở trên chính switcher Lịch (nó
      // có cơ chế lăn/kéo DỌC riêng của nó, xem SwipeNavVertical) hoặc
      // trên thanh tab chính (đang dùng lăn dọc để đổi top/bottom, xem
      // TabBarPosition.onWheel — 1 sự kiện wheel không nên bị CẢ 2 nơi
      // cùng xử lý).
      return !!target.closest('.cal-switcher, #tab-bar-outer');
    }
    document.body.addEventListener('wheel', onTabWheel, { passive: false });

    function onTabArrowKey(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      // Không can thiệp khi phím mũi tên đang được dùng cho việc KHÁC
      // rõ ràng hơn — vd đang ở trong 1 modal/popup có điều hướng mũi
      // tên riêng (MiniCalendarPicker chọn ngày), hoặc đang focus vào
      // chính thanh tab chính (nơi mũi tên LÊN/XUỐNG đã dùng cho
      // TabBarPosition — mũi tên TRÁI/PHẢI ở đó không có ý nghĩa gì
      // nên vẫn an toàn cho qua, nhưng chặn hẳn cho rõ ràng, tránh
      // trường hợp phím trái/phải vô tình đổi tab NGAY LÚC người dùng
      // đang dùng phím mũi tên khác trong ngữ cảnh thanh tab).
      if (e.target.closest('.mini-calendar-picker, #tab-bar-outer')) return;
      const idx = TAB_ORDER.indexOf(currentTab);
      const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
      if (nextIdx >= 0 && nextIdx < TAB_ORDER.length) {
        e.preventDefault();
        goToTab(TAB_ORDER[nextIdx]);
      }
    }
    document.addEventListener('keydown', onTabArrowKey);

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
