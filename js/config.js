// ============================================================
// Cấu hình chung của app — chỉnh ở đây khi cần đổi project Supabase
// hoặc điều chỉnh các mốc tăng trưởng của icon cây.
// ============================================================

const CONFIG = Object.freeze({
  SUPABASE_URL: 'https://uljzcgygfbfcrkmimbwt.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1ql4QcnMzQVDpeqKtWWRcg_fcMNHzjA',

  // Khoá lưu trong localStorage
  STORAGE_KEYS: {
    SESSION: 'habit_session',   // { token, userId }
    DATA: 'habit_data',          // { habits, checks, events }
    SYNC_QUEUE: 'habit_sync_queue' // các thao tác chưa đồng bộ lên server
  },

  // 9 mốc tăng trưởng của icon cây (số ngày streak)
  MILESTONES: [1, 3, 7, 14, 30, 60, 100, 365, 730],

  // Số ngày lỡ liên tiếp trước khi thực sự tụt 1 mốc
  WILT_DROP_THRESHOLD: 3,

  // Giới hạn độ dài text — PHẢI khớp đúng thuộc tính maxlength trong
  // HTML (today.js, event-section.js, habit-note-panel.js). maxlength
  // HTML chỉ chặn được khi gõ tay qua bàn phím, KHÔNG chặn được nếu
  // giá trị gán qua JS trực tiếp (console, hay bug UI khác lỡ gọi
  // Sync.addHabit(...) với chuỗi rất dài) — validate lại 1 lần nữa ở
  // sync.js (nguồn sự thật duy nhất cho dữ liệu) trước khi lưu.
  MAX_LENGTH: {
    NAME: 60,      // tên habit / tên dấu ấn
    NOTE: 1000     // ghi chú (dùng số lớn hơn cho cả 2 loại ghi chú,
                    // vì event-note giới hạn 500 còn habit-note 1000 —
                    // lấy giới hạn LỚN HƠN ở tầng validate chung, để
                    // không cắt nhầm ghi chú habit hợp lệ; UI vẫn tự
                    // giới hạn đúng 500/1000 riêng qua maxlength)
  }
});
