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
  WILT_DROP_THRESHOLD: 3
});
