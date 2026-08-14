// ============================================================
// badge.js — Badge số trên icon PWA (Home Screen), báo số việc
// CHƯA tick trong hôm nay.
//
// Giới hạn nền tảng (không phải lỗi code, không khắc phục được):
//   - Chỉ Chrome/Chromium-based browser (Brave, Edge...) hỗ trợ
//     navigator.setAppBadge — Safari/iOS không hỗ trợ qua PWA cài
//     từ Add to Home Screen kiểu thường.
//   - Badge chỉ CẬP NHẬT khi app đang mở/được đưa lên foreground.
//     Không có server đẩy tin (Web Push) nên khi app đóng, con số
//     giữ nguyên như lần cập nhật gần nhất — không tự nhảy theo
//     thời gian thực. Muốn real-time cần thêm hạ tầng Web Push +
//     cron riêng (không nằm trong bản này).
//   - Badge chỉ hiện SỐ, không đổi được hình dạng/màu icon — đó là
//     giới hạn của Badging API, không liên quan tới code ở đây.
// ============================================================

const AppBadge = (() => {

  function isSupported() {
    return 'setAppBadge' in navigator;
  }

  // Đếm số habit (không tính archived) CHƯA tick cho hôm nay.
  function countUnchecked() {
    const { habits, checks } = Sync.getData();
    const todayKey = DateUtils.dateKey(new Date());
    let count = 0;
    for (const h of habits) {
      const checked = !!(checks[h.id] && checks[h.id][todayKey]);
      if (!checked) count++;
    }
    return count;
  }

  // Tính lại và set badge. Gọi hàm này mỗi khi:
  //   - App vừa mở / được focus lại (visibilitychange)
  //   - Người dùng tick/bỏ tick 1 habit
  //   - Người dùng thêm/xoá 1 habit
  function refresh() {
    if (!isSupported()) return;
    try {
      const n = countUnchecked();
      if (n > 0) {
        navigator.setAppBadge(n).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    } catch (e) {
      // Im lặng bỏ qua — badge là tính năng phụ trợ, không được
      // phép làm vỡ luồng chính của app nếu API lỗi vặt.
    }
  }

  return { refresh, isSupported, countUnchecked };
})();
