# Habit Tracker — Tài liệu kiến trúc

> Đọc file này TRƯỚC khi sửa bất kỳ dòng code nào. Viết cho người
> (hoặc AI) chưa từng thấy dự án này, để hiểu đủ mà không cần hỏi
> lại người viết ban đầu.

## 1. Đây là gì

App cá nhân để theo dõi thói quen hằng ngày (tick việc lặp lại) và
ghi nhận sự kiện 1 lần (vd "cắt tóc", để tra khoảng cách giữa các
lần). Chạy dưới dạng **PWA** (Progressive Web App) — 1 trang web
tĩnh, không có backend tự viết, cài được như app trên điện
thoại/máy tính qua trình duyệt.

**Không phải:** app native (.apk/.dmg), không dùng framework
(React/Vue), không có server riêng.

## 2. Ngăn xếp công nghệ (tech stack)

| Lớp | Công nghệ | Vì sao chọn |
|---|---|---|
| Frontend | HTML/CSS/JS thuần | App nhỏ, framework chỉ thêm phức tạp không cần thiết |
| Backend | Supabase (Postgres) | Miễn phí đủ dùng, không cần tự quản lý server |
| Hosting | GitHub Pages | Miễn phí, deploy = kéo thả file |
| Xác thực | Tự viết (không dùng Supabase Auth) | Không cần email, chỉ cần 1 "mã bí mật" |
| Offline | localStorage + hàng đợi đồng bộ tự viết | Không có thư viện ngoài nào phù hợp quy mô nhỏ này |

**Không dùng:** `@supabase/supabase-js` (gọi thẳng REST API bằng
`fetch` để nhẹ hơn), IndexedDB (localStorage đủ cho quy mô dữ liệu
này), bất kỳ bundler/build step nào (mở file là chạy, không cần
`npm install`).

## 3. Cấu trúc thư mục và vai trò từng file

```
index.html              Trang duy nhất — khung app, nạp mọi script theo ĐÚNG THỨ TỰ phụ thuộc
manifest.json           Khai báo PWA (tên, icon, màu) — để trình duyệt cho phép "Cài đặt"
service-worker.js       Cache tài nguyên để chạy offline — XEM MỤC 6 trước khi sửa

css/style.css           Toàn bộ style. Màu khai báo CỨNG (không dùng biến theme hệ thống)
                        để không bị ảnh hưởng bởi dark mode của trình duyệt/OS.

js/config.js            Hằng số cấu hình: URL Supabase, key public, mốc streak cây...
                        SỬA Ở ĐÂY khi cần đổi project Supabase hoặc chỉnh mốc tăng trưởng.

js/date-utils.js        Tiện ích ngày tháng DÙNG CHUNG (dateKey, parseDateStr, tên
                        thứ/tháng tiếng Việt...). Trước đây các hàm này bị copy-paste
                        lặp lại ở nhiều file view — đã gộp về đây, SỬA Ở ĐÂY khi cần
                        đổi định dạng ngày tháng, không sửa lẻ tẻ từng view.

js/dom-utils.js         Tiện ích DOM DÙNG CHUNG (hiện chỉ có escapeHtml). Cùng lý do
                        gộp như date-utils.js — 6 file từng tự định nghĩa escapeHtml
                        giống hệt nhau.

js/auth.js              Đăng nhập bằng "mã bí mật" — hash SHA-256 ở trình duyệt trước khi
                        gửi lên, server không bao giờ thấy mã gốc.

js/supabase-client.js   Gọi Supabase REST API bằng fetch thuần (không dùng thư viện
                        @supabase/supabase-js đầy đủ — không cần, chỉ gọi RPC).

js/storage-local.js     Lưu dữ liệu + hàng đợi đồng bộ vào localStorage. load() PHẢI
                        khôi phục ĐỦ mọi field mà save() có thể đã ghi (xem docblock
                        trong file — từng có bug đánh rơi archivedHabits/habitNotes).

js/sync.js              QUAN TRỌNG NHẤT. Cầu nối local ↔ Supabase. Mọi thao tác người
                        dùng áp dụng LOCAL NGAY, rồi mới thử gửi server. Xem mục 5.
                        Cũng quản lý quan hệ cha-con giữa habit (setHabitParent) và
                        ghi chú 2 loại — chung/riêng ngày (setHabitNote).

js/tree-icons.js         Vẽ SVG icon cây theo 9 mốc streak + trạng thái héo úa.

js/event-section.js     UI "Sự kiện riêng ngày này" — DÙNG CHUNG giữa màn Hôm nay và
                        màn chi tiết ngày (mỗi lần gọi cần idPrefix riêng để tránh
                        trùng ID DOM). Tự vẽ dropdown gợi ý (không dùng <datalist> —
                        không chạm được trên nhiều trình duyệt di động). Lịch sử sự
                        kiện là <button> bấm được để nhảy thẳng tới ngày đó, qua
                        window.__jumpToDate (app.js gán lúc khởi động).

js/export-data.js       Xuất toàn bộ dữ liệu ra file JSON backup.

js/views/today.js       Màn "Hôm nay": tick việc, kéo-thả sắp xếp HOẶC tạo/tách quan hệ
                        cha-con (thả vào giữa 1 hàng khác = làm con; thả ra vùng trống
                        = tách độc lập), sửa tên, ghi chú (toggle 2 màu: chung/riêng
                        ngày). Thùng rác đã tách sang views/trash.js — không còn ở đây.
js/views/year.js        Màn "Cả năm": lưới lịch 12 tháng, chuyển năm, tìm ngày cụ thể,
                        dấu kẹp giấy trên ngày có sự kiện.
js/views/day-detail.js  Màn chi tiết 1 ngày (mở từ "Cả năm").
js/views/stats.js       Màn "Thống kê": streak dài nhất, tỷ lệ hoàn thành theo tháng.
js/views/trash.js       Màn "Thùng rác" — tab riêng (icon cạnh 3 tab chính), habit đã
                        xoá giữ 30 ngày, khôi phục từng cái hoặc dọn sạch toàn bộ.

js/app.js               Điểm khởi động — màn khoá (nhập mã bí mật), điều hướng tab,
                        gắn kết mọi module lại với nhau. ĐỌC FILE NÀY ĐẦU TIÊN.

supabase/schema.sql        Schema gốc — chạy 1 LẦN DUY NHẤT lúc setup ban đầu.
supabase/migration_v2.sql  Migration bổ sung (đổi tên habit, sắp xếp, thùng rác, ghi
                            chú sự kiện) — ĐÃ CHẠY RỒI, giữ lại để biết lịch sử.
supabase/migration_v3.sql  Migration bổ sung (ghi chú habit 2 loại, quan hệ cha-con
                            giữa habit) — chạy SAU migration_v2, chỉ 1 lần.
```

## 4. Mô hình bảo mật — ĐỌC KỸ TRƯỚC KHI ĐỘNG VÀO AUTH

Không dùng email/mật khẩu. Luồng đăng nhập:

1. Người dùng nhập 1 "mã bí mật" tự chọn (≥8 ký tự).
2. Trình duyệt hash SHA-256 mã đó — **mã gốc không bao giờ rời khỏi
   thiết bị**, chỉ gửi bản hash lên server.
3. Server (hàm RPC `auth_with_secret`) so khớp hash: có → đăng
   nhập, chưa có → tạo user mới.
4. Server trả về `session_token` (UUID ngẫu nhiên, hết hạn sau 180
   ngày không dùng) — lưu ở `localStorage`, dùng cho mọi request
   sau thay vì gửi lại mã bí mật mỗi lần.

**Vì sao không dùng Supabase Auth chuẩn:** không cần email, muốn
đơn giản nhất có thể cho 1 người dùng duy nhất.

**Tại sao mọi bảng đều "khoá cứng" RLS (row-level security):** Xem
`supabase/schema.sql` — các bảng (`habits`, `checks`, `events`,
`sessions`, `users`) **không có policy nào cho phép truy cập trực
tiếp**. Mọi đọc/ghi đều đi qua hàm RPC (`SECURITY DEFINER`, tự kiểm
tra `session_token` hợp lệ trước khi chạm dữ liệu). Đây là thiết kế
có chủ đích — an toàn hơn dựa vào JWT claims, vì không cần mint JWT
tùy chỉnh.

**Rủi ro đã biết và chấp nhận:** mã bí mật ngắn/dễ đoán có thể bị dò
bằng dictionary attack. Không có "quên mật khẩu" — mất mã là mất
quyền truy cập dữ liệu vĩnh viễn (nhưng dữ liệu vẫn còn trên
server, chỉ là không đăng nhập lại được).

## 5. Cơ chế Offline-First — ĐỌC KỸ TRƯỚC KHI SỬA `sync.js`

Đây là phần **dễ có bug ẩn nhất** trong toàn bộ hệ thống. Nguyên
tắc bắt buộc phải giữ:

1. Mọi thao tác người dùng (`Sync.addHabit`, `Sync.setCheck`...) áp
   dụng vào `data` (biến state cục bộ trong `sync.js`) **NGAY LẬP
   TỨC**, không đợi mạng — UI phản hồi tức thì.
2. Đồng thời, thao tác đó được đẩy vào **hàng đợi** (`LocalStore`
   trong `localStorage`, key `habit_sync_queue`).
3. `flushQueue()` xử lý hàng đợi, gửi từng thao tác lên Supabase.
4. **ID tạm → ID thật:** khi thêm habit/event lúc offline, chúng
   được gán 1 ID tạm (`tmp_...`). Khi `add_habit`/`add_event` server
   thành công, ID tạm được **ánh xạ lại** thành ID thật — cả trong
   `data` (state hiển thị) **VÀ** trong chính hàng đợi còn lại (xem
   `remapHabitIdInQueue`). Nếu quên bước "cập nhật lại hàng đợi",
   các thao tác gửi ngay sau (vd tick 1 habit vừa mới thêm) sẽ dùng
   nhầm ID tạm đã hết hạn — **đây chính là 1 bug thật đã xảy ra và
   được sửa, xem lịch sử bên dưới**.

**Bài học từ bug đã sửa (quan trọng, đọc kỹ):**
> Khi mất mạng giữa chừng lúc đang xử lý hàng đợi, code CŨ chỉ giữ
> lại đúng 1 entry đang lỗi để thử lại — **các entry phía sau (chưa
> kịp xử lý tới) bị rơi mất vĩnh viễn** vì vòng lặp `break` ngay lập
> tức mà không đưa chúng vào `stillPending`. Đã sửa: khi gặp lỗi
> mạng, giữ lại TOÀN BỘ phần hàng đợi từ vị trí đó trở đi.

**Nếu sửa `sync.js`, bắt buộc phải chạy lại test mô phỏng** (xem
mục 7) trước khi coi là xong — đừng chỉ đọc code bằng mắt và tin là
đúng, vì bug loại này rất khó thấy nếu không mô phỏng đúng kịch bản
mất mạng.

## 5b. Listener của Sync.onChange() — PHẢI tự gỡ khi render() gọi lại

**Bug đã sửa, đọc kỹ trước khi thêm view mới hoặc sửa view hiện có:**
Mọi view (`today.js`, `year.js`, `day-detail.js`, `stats.js`,
`trash.js`, `event-section.js`) gọi `Sync.onChange(draw)` trong hàm
`render()` để tự vẽ lại mỗi khi dữ liệu đổi. Nhưng `render()` được
gọi LẠI mỗi khi người dùng chuyển tab qua rồi quay lại (xem
`app.js`, `navToday`/`navYear`/... đều gọi `View.render()` mỗi lần
bấm) — nếu không tự gỡ listener của lần render() TRƯỚC, mảng
listener của `Sync` sẽ cộng dồn vô hạn theo số lần chuyển tab: vừa
rò rỉ bộ nhớ, vừa khiến các closure cũ (trỏ vào DOM đã bị thay thế)
vẫn chạy `draw()` thừa mỗi khi có thay đổi dữ liệu, càng dùng app
lâu càng chậm dần.

**Cách sửa đã áp dụng — PHẢI theo đúng pattern này khi thêm view
mới:** gắn hàm `draw` (hoặc tương đương) lên chính `container` bằng
1 property riêng, kiểm tra và gỡ nó trước khi đăng ký cái mới:

```js
if (container.__xyzOnChange) Sync.offChange(container.__xyzOnChange);
container.__xyzOnChange = draw;
Sync.onChange(draw);
draw();
```

**Cảnh báo quan trọng — bug thật đã xảy ra ngay với cách sửa ở
trên:** gắn cờ lên `container` CHỈ đáng tin nếu `container` đó ổn
định qua các lần gọi. `EventSection.render()` là trường hợp VI PHẠM
điều này: nó được gọi từ BÊN TRONG `today.js`/`day-detail.js`, và 2
view cha đó tự `container.innerHTML = ...` lại TOÀN BỘ cây con mỗi
lần chúng render() — nghĩa là node `#event-section-today` (hay
`#event-section`) được EventSection nhận vào là 1 **node HOÀN TOÀN
MỚI** mỗi lần view cha render() lại, dù `idPrefix` truyền vào vẫn
luôn cố định. Gắn cờ lên node đó thì cờ luôn "chưa từng thấy" (vì
node mới), nên listener cũ (đóng gói node ĐÃ BỊ VĂNG khỏi DOM)
KHÔNG BAO GIỜ được gỡ — cộng dồn mãi mỗi lần vào lại tab "Hôm nay"
hoặc mở 1 ngày trong "Cả năm". Bug này chỉ lộ ra khi kiểm tra
**tích hợp thật** (gọi `TodayView.render()` với `EventSection` lồng
bên trong nhiều lần, đếm số listener qua `Sync._listenerCount()`) —
kiểm tra `EventSection` độc lập với 1 container cố định (không đại
diện đúng cách nó thực sự được dùng trong app) sẽ KHÔNG bắt được.

**Cách sửa đúng đã áp dụng:** với bất kỳ module nào có thể bị 1 view
khác gọi lồng vào (không tự kiểm soát được vòng đời container của
chính nó), lưu cờ gỡ-listener ở **cấp module** (theo 1 key ổn định
như `idPrefix`, KHÔNG phụ thuộc DOM node), thay vì lưu trên
`container`:

```js
// Ở cấp module, KHÔNG lưu trên DOM container
const changeListenersByPrefix = {};

function render(container, ..., { idPrefix }) {
  // ...
  if (changeListenersByPrefix[idPrefix]) Sync.offChange(changeListenersByPrefix[idPrefix]);
  changeListenersByPrefix[idPrefix] = draw;
  Sync.onChange(draw);
}
```

**Bài học tổng quát:** gắn cờ lên `container` (như pattern ở đầu
mục này) chỉ an toàn cho các view TOP-LEVEL do `app.js` gọi trực
tiếp lên 1 node cố định (`today.js`, `year.js`, `stats.js`,
`trash.js`, `day-detail.js` khi tự nó là view cha) — không an toàn
cho bất kỳ module nào được gọi LỒNG bên trong 1 view khác, vì
container của module con phụ thuộc vào view cha có tái tạo DOM hay
không. Khi thêm module con mới kiểu này, luôn dùng cách lưu theo
key cấp module như trên.

**Bug liên quan, cùng gốc, riêng trong `today.js`:** listener
kéo-thả gắn trên `document` (`bindDragDropGlobal`) từng nằm ngay
trong `render()` — bị gọi lại và cộng dồn trên `document` mỗi lần
vào lại tab "Hôm nay" (nghiêm trọng hơn cả bug trên vì gắn trên
`document` thì KHÔNG có DOM nào bị thay thế để tự "vô hiệu hoá", cứ
thế cộng dồn vĩnh viễn — sau N lần vào tab, 1 lượt kéo-thả gọi
`setHabitParent` N lần trùng lặp). Đã sửa bằng cờ module-level
`globalDragBound`, đảm bảo phần gắn listener chỉ chạy đúng 1 lần
cho toàn bộ vòng đời app dù `render()` gọi lại bao nhiêu lần.

**`Sync._listenerCount()`** — hàm debug-only thêm riêng để
`smoke-test-full-app.js` đếm trực tiếp số listener, không cần suy
luận gián tiếp qua DOM hay thời gian thực thi (cả 2 cách đó đều đã
thử và không đáng tin — xem comment trong file test). Không gọi
trong luồng chính của app.

## 6. Service Worker — vì sao cần tăng version mỗi lần sửa code

`service-worker.js` cache các file JS/CSS để app chạy được offline.
Chiến lược: **network-first cho file thuộc app** (luôn thử tải bản
mới nhất từ mạng trước, chỉ rơi về cache khi mất mạng thật) —
**cache-first cho tài nguyên ngoài** (Google Fonts, Tabler Icons).

**QUY TẮC BẮT BUỘC:** mỗi khi thêm/sửa file JS/CSS mới, phải:
1. Thêm đường dẫn file đó vào mảng `CORE_ASSETS`.
2. Tăng số trong `CACHE_NAME` (vd `v5` → `v6`).

Nếu quên bước 2, trình duyệt của người dùng cũ có thể vẫn dùng cache
cache cũ trong 1 khoảng thời gian, không thấy code mới ngay — đây
là nguyên nhân gây ra lỗi "nút mới không hiện dù đã cập nhật code"
đã từng gặp.

## 7. Bộ test hiện có (chạy bằng Node, không cần trình duyệt)

Các bộ test được viết trong quá trình phát triển để xác minh logic
đúng, **không nằm trong repo** (chỉ chạy tạm trong môi trường
Claude lúc code). Nếu cần sửa lại các phần dưới đây, **nên viết lại
test tương tự** trước khi tin code đã đúng:

- **Streak & héo úa** (`tree-icons.js`): kiểm tra tính đúng của
  `growthState()` — streak dài nhất, mốc tăng trưởng, 3 mức héo
  (1/2/3+ ngày lỡ), tụt mốc đúng cách.
- **Đồng bộ offline/online** (`sync.js`): mô phỏng mất mạng giữa
  chừng, race condition ID tạm → ID thật, xác nhận không mất dữ
  liệu qua nhiều lượt `flushQueue()`.
- **Xuất dữ liệu** (`export-data.js`): cấu trúc JSON đúng, dùng tên
  thay vì ID nội bộ.
- **Gợi ý sự kiện** (`event-section.js`): danh sách tên không
  trùng lặp, đúng thứ tự alphabet tiếng Việt.
- **Listener không cộng dồn** (mọi view + `sync.js`): mô phỏng
  `render()` gọi lại nhiều lần (giả lập chuyển tab qua lại), xác
  nhận `Sync.listeners` không tăng vô hạn — xem mục 5b.
- **Listener kéo-thả cấp document không cộng dồn** (`today.js`):
  mô phỏng `render()` gọi lại nhiều lần, xác nhận
  `document.addEventListener('dragover'/'drop')` chỉ gọi đúng 1
  lần — xem mục 5b.
- **Khôi phục dữ liệu từ localStorage** (`storage-local.js`): lưu
  dữ liệu đầy đủ (gồm `archivedHabits`, `habitNotes`) rồi mô phỏng
  "tải lại trang" (gọi lại `load()`), xác nhận không field nào bị
  đánh rơi; đồng thời xác nhận dữ liệu CŨ (trước khi 2 field này
  tồn tại) vẫn `load()` an toàn, không lỗi.
- **Smoke test tích hợp toàn app** (`smoke-test-full-app.js`): nạp
  TOÀN BỘ app thật (đúng thứ tự script trong `index.html`) vào
  JSDOM, gọi `render()` thật của mọi view, thao tác DOM thật (bấm
  nút thêm/xoá, gõ ghi chú) để kích hoạt code bên trong event
  handler — đây là bài test đã BẮT ĐƯỢC 2 bug thật mà các test đơn
  lẻ ở trên không bắt được: (1) `event-section.js` từng gọi thẳng
  `escapeHtml()`/`parseDateStr()` sau khi các hàm cục bộ đó đã bị
  xoá khi gộp về `DateUtils`/`DomUtils` — chỉ lộ ra khi thực sự
  CHẠY code (không phải chỉ `node -c` kiểm tra cú pháp); (2)
  `EventSection` lồng bên trong `today.js`/`day-detail.js` vẫn bị
  cộng dồn listener dù đã "sửa" theo pattern chuẩn — vì cờ gỡ
  listener lưu trên DOM container, nhưng container đó bị view CHA
  tái tạo mới mỗi lần render() (xem mục 5b, phần "Cảnh báo quan
  trọng"). Bài học: **luôn chạy smoke test này sau khi sửa bất kỳ
  view hay module dùng chung nào** — kiểm tra module độc lập
  (container cố định tự tay tạo trong test) không đại diện đúng
  cách module đó thực sự được dùng khi lồng trong 1 view khác.

**Cách viết lại test nhanh:** dùng Node `vm` module để chạy code
JS trong sandbox giả lập (`localStorage`, `document`, `Sync`...) mà
không cần trình duyệt thật — xem cách làm ở lịch sử phát triển nếu
cần tham khảo lại cấu trúc.

## 8. Những quyết định có chủ đích — đừng "sửa lại cho giống chuẩn"

Vài chỗ nhìn qua tưởng là thiếu sót nhưng thực ra là quyết định có
lý do — đừng tự ý "sửa cho đúng" nếu chưa hiểu vì sao:

- **`_sha256Hex` export ra ngoài trong `auth.js`** dù không dùng ở
  đâu — để test thủ công qua console khi cần, giữ nguyên.
- **Sự kiện được phép đặt vào ngày tương lai**, nhưng việc lặp lại
  thì không — vì sự kiện 1 lần có tính chất "lên lịch trước" (hẹn
  khám), còn việc lặp lại tick trước ngày chưa tới là vô nghĩa.
- **Sự kiện không có thùng rác** (xoá là mất luôn), nhưng habit thì
  có — vì sự kiện là ghi chép nhất thời, habit là cấu trúc lâu dài
  dễ bị xoá nhầm hơn.
- **ID trong DOM có tiền tố theo `idPrefix`** (`today-event-...`,
  `day-detail-event-...`) — vì `EventSection` được gọi từ 2 nơi có
  thể cùng tồn tại trong DOM lúc 1 thời điểm (1 cái ẩn qua
  `display:none`), nên không thể dùng ID cứng.

## 9. Nếu muốn nhờ người khác (hoặc AI khác) sửa tiếp

Đưa file này cho họ đọc trước tiên. Sau đó:

1. Chỉ rõ **triệu chứng** cụ thể ("bấm nút X không có phản ứng gì"),
   không chỉ nói chung chung ("app bị lỗi").
2. Nếu liên quan tới `sync.js` hoặc bất kỳ logic tính toán nào
   (streak, thống kê), yêu cầu họ **viết test xác minh trước khi
   sửa**, không chỉ sửa rồi "chắc là được" — bài học từ mục 5.
3. Sau khi sửa file JS/CSS, nhắc họ tăng `CACHE_NAME` trong
   `service-worker.js` (mục 6) — dễ quên, gây lỗi khó hiểu.
4. Nếu cần đổi cấu trúc database, viết file `migration_vN.sql` mới
   (không sửa trực tiếp `schema.sql` gốc), để giữ lịch sử thay đổi
   rõ ràng theo đúng cách 2 file hiện có đang làm.
