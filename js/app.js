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
          <!-- Bọc 3 icon mỗi bên vào 1 khối flex:1 riêng, TỰ CANH VỀ
               PHÍA HOME (flex-end bên trái, flex-start bên phải) —
               ĐÂY LÀ CÁCH DUY NHẤT đảm bảo Home luôn đúng tâm hình học
               bất kể 2 nhóm icon rộng hẹp khác nhau ra sao. Cách cũ
               (justify-content: space-between trên toàn bộ 7 phần tử
               phẳng) đã SAI trong thực tế: icon Lịch (#nav-year) có 2
               dòng chữ "T7 15" rộng hơn hẳn 2 icon đơn cạnh nó, kéo
               lệch cả cụm 3-icon trái so với cụm 3-icon phải (đều toàn
               icon đơn, hẹp hơn) — space-between chỉ chia đều KHOẢNG
               CÁCH giữa các phần tử liền kề, không hề biết hay quan
               tâm tới TỔNG độ rộng 2 nhóm 2 bên có bằng nhau không, kết
               quả đo thực tế: Home lệch ~15px khỏi tâm (đã xác nhận
               bằng ảnh chụp + đo pixel thật, không phải suy đoán). -->
          <div class="tab-pill-side tab-pill-side-left">
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
          <div class="tab-pill-side tab-pill-side-right">
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
    // ANIMATION KIỂU "CARD STACK" (thẻ xếp chồng, cảm giác quẹt thẻ
    // Tinder) — THAY THẾ HẲN kiểu "giọt lỏng" cũ (2 view cùng mặt
    // phẳng trượt cạnh nhau, xem lịch sử ở git/bản trước nếu cần đối
    // chiếu). Ý tưởng: view SẮP TỚI (hàng xóm theo hướng kéo) luôn nằm
    // SẴN NGAY PHÍA SAU view hiện tại, thu nhỏ + mờ hơn ngay từ đầu
    // (STACK_SCALE_FROM/STACK_OPACITY_FROM) — không phải "trôi từ 1
    // bề rộng viewport bên cạnh" như kiểu cũ. Khi kéo, view hiện tại
    // (top card) trượt NGANG theo dx VÀ mờ dần đi; view phía sau (back
    // card) phóng to + rõ dần lên ĐÚNG THEO % top card đã trượt — tạo
    // cảm giác "thẻ dưới lộ dần ra khi thẻ trên được lia đi", đúng
    // ngôn ngữ thị giác của Tinder/Google Photos card stack, khác hẳn
    // "2 trang phẳng nối đuôi nhau" của kiểu cũ.
    const dragState = { neighborTab: null, neighborEl: null, outgoingEl: null, committedDir: null };

    // STACK_SCALE/OPACITY — back card đứng CỐ ĐỊNH ở scale/opacity NÀY
    // SUỐT QUÁ TRÌNH KÉO (KHÔNG phóng to/rõ dần theo % kéo như bản thử
    // trước — đó là nguyên nhân THẬT gây cảm giác "chồng lấn, khựng
    // khựng" đã báo lại: back card gần full-size trong lúc top card
    // còn chưa trượt hết, 2 lớp nội dung đè lên nhau ở vùng top card
    // vừa lộ ra). Đây là cách card-stack CHUẨN (Tinder/Google Photos
    // thật): back card giữ NGUYÊN 1 trạng thái "chờ sẵn" trong suốt lúc
    // kéo, chỉ TOP CARD chuyển động — back card chỉ animate "bật lên"
    // thành full-size SAU KHI top card đã biến mất hẳn (xem finishDrag),
    // không đồng bộ tiến trình với ngón tay.
    const STACK_SCALE = 0.94;
    const STACK_OPACITY = 0.85;

    function viewElByTab(tab) {
      if (tab === 'today') return viewToday;
      if (tab === 'year') return viewYear;
      if (tab === 'stats') return viewStats;
      if (tab === 'trash') return viewTrash;
      return null;
    }

    // renderTab(tab) — gọi đúng hàm render() tương ứng, DÙNG CHUNG cho
    // cả lúc PREVIEW back card khi đang kéo dở (dragMove, chưa chắc
    // commit) lẫn lúc CHÍNH THỨC đổi tab (onCommit/goToTab). Trước khi
    // có hàm này, nội dung back card chỉ được render SAU KHI đã commit
    // xong — nghĩa là trong lúc đang kéo (trước ngưỡng commit), back
    // card hiện ra HOÀN TOÀN TRỐNG nếu người dùng chưa từng ghé qua tab
    // đó trước, phá vỡ hẳn cảm giác "thẻ chờ sẵn phía sau" mà card
    // stack cần có (đã phản hồi lại: "chẳng thấy giống thẻ gì hết").
    function renderTab(tab) {
      if (tab === 'today') TodayView.render(viewToday);
      else if (tab === 'year') YearView.render(viewYear, openDay, { focusToday: true });
      else if (tab === 'stats') StatsView.render(viewStats);
      else if (tab === 'trash') TrashView.render(viewTrash);
    }

    // dx âm (kéo trái) => xem tab KẾ TIẾP; dx dương (kéo phải) => tab TRƯỚC ĐÓ
    function neighborTabFor(dx) {
      const idx = TAB_ORDER.indexOf(currentTab);
      return TAB_ORDER[dx < 0 ? idx + 1 : idx - 1] || null;
    }

    // Hệ số làm mềm hiệu ứng ĐÀN HỒI khi kéo tại ĐẦU (today, kéo phải)
    // hoặc CUỐI (trash, kéo trái) danh sách tab — không có hàng xóm để
    // lộ ra phía sau, nhưng ngón tay vẫn đang kéo. Cùng công thức căn
    // bậc hai với bản "giọt lỏng" cũ (cảm giác kéo dây thun quen
    // thuộc, xem giải thích gốc), chỉ đổi NƠI áp dụng — giờ chỉ còn
    // top card di chuyển (không có back card nào để tính scale/opacity
    // cùng lúc, vì đơn giản là không có view nào phía sau để lộ ra).
    function rubberBand(dx) {
      const sign = dx < 0 ? -1 : 1;
      return sign * Math.sqrt(Math.abs(dx)) * 6;
    }

    function dragMove(dx) {
      const wantTab = neighborTabFor(dx);
      const currentEl = viewElByTab(currentTab);
      // Bật absolute-stacking cho TOP CARD ngay từ lần dragMove ĐẦU
      // TIÊN của cả lượt kéo (không phải mỗi frame — kiểm tra classList
      // trước để chỉ set 1 lần, tránh reflow thừa mỗi pixel di chuyển).
      // z-index cao hơn hẳn back card, đảm bảo LUÔN nổi trên nó dù thứ
      // tự trong DOM là gì. Đồng thời bật nền "bàn xếp thẻ" trên #app
      // (xem .app-stacking trong CSS) — tạo tương phản để back card
      // (box-shadow) thực sự "nổi" lên thay vì chìm vào nền cùng màu.
      if (currentEl && !currentEl.classList.contains('view-stacking')) {
        currentEl.classList.add('view-stacking');
        currentEl.style.zIndex = '2';
        root.classList.add('app-stacking');
      }
      if (dragState.neighborTab !== wantTab) {
        // Đổi hướng kéo giữa chừng, hoặc lần đầu xác định hàng xóm —
        // dọn hàng xóm CŨ (nếu có) rồi đặt hàng xóm MỚI vào ĐÚNG 1
        // trạng thái CỐ ĐỊNH (STACK_SCALE/STACK_OPACITY) và GIỮ NGUYÊN
        // suốt lúc kéo — không tính toán lại theo dx nữa (xem giải
        // thích ở khai báo STACK_SCALE phía trên).
        if (dragState.neighborEl) {
          dragState.neighborEl.style.display = 'none';
          dragState.neighborEl.style.transform = '';
          dragState.neighborEl.style.opacity = '';
          dragState.neighborEl.classList.remove('view-stack-back');
        }
        dragState.neighborTab = wantTab;
        dragState.neighborEl = wantTab ? viewElByTab(wantTab) : null;
        if (dragState.neighborEl) {
          dragState.neighborEl.classList.add('view-stacking', 'view-stack-back');
          dragState.neighborEl.style.zIndex = '1'; // THẤP HƠN top card (z-index 2, set ở trên) — back card luôn nằm DƯỚI dù thứ tự DOM ra sao
          dragState.neighborEl.style.display = 'block';
          dragState.neighborEl.style.transform = `scale(${STACK_SCALE})`;
          dragState.neighborEl.style.opacity = `${STACK_OPACITY}`;
          // Render TRƯỚC nội dung thật của back card ngay khi nó trở
          // thành hàng xóm — KHÔNG đợi tới lúc commit xong mới render
          // (thiết kế cũ), vì lúc đó card đã hiện SẴN cho người dùng
          // xem trong lúc còn đang kéo dở, cần có nội dung thật ngay từ
          // đầu chứ không phải 1 khung trống trơn (đã phát hiện qua
          // ảnh chụp thật: card phía sau hoàn toàn rỗng, không giống
          // "thẻ" gì cả — vì view đó CHƯA TỪNG được render nếu người
          // dùng chưa ghé qua tab đó lần nào trước). Chỉ gọi ĐÚNG 1 LẦN
          // ở đây (bên trong khối "neighborTab đổi", không phải mỗi
          // frame dragMove chạy) — YearView.render() khá nặng (dựng cả
          // lưới ngày + tính âm lịch), gọi lặp lại mỗi pixel kéo sẽ
          // giật máy thấy rõ.
          renderTab(wantTab);
        }
        if (wantTab) SwipeHint.show(`→ ${TAB_LABEL[wantTab]}`);
        else SwipeHint.hide();
      }

      if (!wantTab) {
        // ĐẦU/CUỐI danh sách — chỉ top card đàn hồi nhẹ, không có back
        // card nào để tính toán thêm.
        if (currentEl) currentEl.style.transform = `translateX(${rubberBand(dx)}px)`;
        return;
      }

      // ---- TOP CARD trượt NGANG THEO ĐÚNG dx (1:1 với ngón tay, không
      // giới hạn tỉ lệ nào) + mờ dần khi trượt xa — CHỈ top card
      // chuyển động, back card ĐỨNG YÊN nguyên trạng thái đã set ở
      // trên trong SUỐT lúc kéo (không còn tính lại mỗi frame), loại
      // bỏ hẳn cảm giác "2 lớp cùng chuyển động chồng lên nhau". ----
      const vw = window.innerWidth;
      const progress = Math.min(1, Math.abs(dx) / vw); // dùng CHO OPACITY top card thôi, không còn ảnh hưởng gì tới back card nữa

      currentEl.style.transform = `translateX(${dx}px)`;
      // Mờ dần TUYẾN TÍNH theo đúng % đã trượt qua màn hình — khi top
      // card gần trôi hết ra ngoài (progress gần 1), nó gần như trong
      // suốt, để lộ back card (đang đứng yên, KHÔNG đổi) rõ ràng không
      // bị 2 lớp "đấu tranh" hiển thị cùng lúc.
      currentEl.style.opacity = `${1 - progress * 0.7}`;
    }

    // animated=true: "trôi nốt" bằng transition rồi dọn sạch transform/
    // opacity/display khi xong, thay vì snap tức thì — dùng chung cho
    // cả huỷ kéo (top card trôi VỀ translateX(0)/opacity(1), back card
    // thu lại về vị trí xuất phát rồi ẩn đi) lẫn hoàn tất đổi tab (top
    // card CŨ tiếp tục trôi HẲN ra ngoài viewport theo ĐÚNG hướng đang
    // kéo dở rồi mới ẩn — KHÔNG bật về translateX(0) giữa chừng, vì
    // currentTab đã đổi trước khi hàm này chạy (xem onCommit), nên
    // viewElByTab(currentTab) lúc này trả về BACK CARD chứ không còn
    // là top card cũ nữa; back card trôi nốt lên scale(1)/opacity(1)
    // để trở thành top card mới).
    // committedDir: hướng đã COMMIT thật (1 | -1 | null) — null nghĩa
    // là đang HUỶ kéo (cancel/settle không tới ngưỡng), mọi thứ trôi
    // VỀ vị trí gốc; có giá trị nghĩa là đang HOÀN TẤT đổi tab, top
    // card cũ cần trôi TIẾP ra ngoài theo đúng hướng đó.
    function finishDrag(animated, committedDir) {
      const outgoingEl = committedDir ? dragState.outgoingEl : null;
      [viewToday, viewYear, viewStats, viewTrash].forEach(el => {
        const touched = el.style.transform !== '' || el.style.opacity !== '';
        if (!touched) return;
        const isOutgoing = el === outgoingEl;
        if (animated) {
          el.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
          const done = () => {
            el.style.transition = '';
            el.removeEventListener('transitionend', done);
            // Gỡ absolute-stacking SAU KHI animation đã chạy xong hẳn —
            // gỡ giữa lúc đang transition sẽ khiến phần tử nhảy khỏi vị
            // trí absolute đột ngột (giật hình 1 khung hình cuối).
            el.classList.remove('view-stacking', 'view-stack-back');
            el.style.zIndex = '';
            // Dọn NỐT transform/opacity ở ĐÂY (sau khi display:none, nên
            // không còn gì hiển thị để "giật hình") — kể cả cho
            // outgoingEl. QUAN TRỌNG: outgoingEl vừa trôi ra ngoài xong,
            // nếu KHÔNG dọn 2 giá trị này, lần sau chính el này quay lại
            // làm current/neighbor (vd vuốt lùi lại), style "translateX(vw),
            // opacity:0" CŨ vẫn còn nguyên trong inline style — dù object
            // model coi nó "sạch" theo currentTab, ảnh chụp/DOM thật vẫn
            // giữ giá trị cũ đó, hiện tượng đã bắt được qua test hồi quy
            // (view-year mắc kẹt translateX(710px)/opacity:0 sau nhiều
            // lượt vuốt qua lại — dù currentTab đã đúng, view vẫn "tàng
            // hình" nếu có lúc nó trở thành current trở lại mà code khác
            // quên set lại transform/opacity tường minh).
            el.style.display = el !== viewElByTab(currentTab) ? 'none' : el.style.display;
            el.style.transform = '';
            el.style.opacity = '';
          };
          el.addEventListener('transitionend', done);
          if (isOutgoing) {
            // TRÔI TIẾP ra ngoài viewport theo đúng hướng đã kéo dở,
            // KHÔNG về 0 — el này không còn là currentTab nữa (đã đổi
            // ở onCommit trước khi gọi hàm này). done() ở trên sẽ dọn
            // sạch nốt 2 giá trị này SAU KHI đã ẩn hẳn, không cần dọn
            // ngay tại đây.
            const vw = window.innerWidth;
            el.style.transform = `translateX(${committedDir < 0 ? -vw : vw}px)`;
            el.style.opacity = '0';
            return;
          }
        } else if (!isOutgoing) {
          el.classList.remove('view-stacking', 'view-stack-back');
          el.style.zIndex = '';
          if (el !== viewElByTab(currentTab)) el.style.display = 'none';
        }
        el.style.transform = '';
        el.style.opacity = '';
      });
      dragState.neighborTab = null;
      dragState.neighborEl = null;
      dragState.outgoingEl = null;
      // Gỡ nền "bàn xếp thẻ" — khớp đúng thời lượng transition ở trên
      // (320ms) nếu animated, hoặc ngay lập tức nếu không (huỷ giữa
      // chừng, admin thoát card-stacking gấp không cần animate gì).
      if (animated) {
        setTimeout(() => root.classList.remove('app-stacking'), 320);
      } else {
        root.classList.remove('app-stacking');
      }
    }

    SwipeNav.bind(document.body, {
      shouldIgnore: (target) => !!target.closest('.cal-switcher, .cal-pane'),
      onDrag: dragMove,
      onCommit: (dir) => {
        // dir: -1 (kéo trái) | 1 (kéo phải). Hàng xóm ĐÃ ĐÚNG tab cần
        // chuyển tới (dragState tự cập nhật liên tục trong dragMove).
        const wantTab = dragState.neighborTab;
        if (!wantTab) return; // đã ở đầu/cuối danh sách, không có hàng xóm để chuyển tới
        // LƯU LẠI top card SẮP THÀNH "cũ" TRƯỚC KHI đổi currentTab —
        // sau dòng currentTab = wantTab bên dưới, viewElByTab(currentTab)
        // sẽ trỏ sang BACK CARD (giờ là current), không còn cách nào
        // lấy lại đúng phần tử top card cũ nếu không lưu từ bây giờ.
        // finishDrag() cần biết chính xác phần tử này để cho nó trôi
        // TIẾP ra ngoài thay vì bật về 0 (xem finishDrag để biết lý do
        // đầy đủ).
        dragState.outgoingEl = viewElByTab(currentTab);
        dragState.committedDir = dir;
        currentTab = wantTab;
        navToday.classList.toggle('active', currentTab === 'today');
        navYear.classList.toggle('active', currentTab === 'year');
        navStats.classList.toggle('active', currentTab === 'stats');
        navTrash.classList.toggle('active', currentTab === 'trash');
        // Render lại LẦN NỮA cho chắc (renderTab đã gọi 1 lần trong
        // dragMove ngay khi tab này trở thành hàng xóm — nhưng giữ
        // lại lệnh gọi này làm lớp bảo hiểm cho trường hợp hiếm gặp
        // sự kiện dồn dập khiến dragMove bị bỏ qua 1 vài khung hình,
        // onCommit vẫn đảm bảo nội dung luôn đúng trước khi hiện ra).
        renderTab(currentTab);
      },
      onSettle: () => {
        finishDrag(true, dragState.committedDir);
        dragState.committedDir = null;
        SwipeHint.hide();
      },
      onCancel: () => { finishDrag(true, null); SwipeHint.hide(); }
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
