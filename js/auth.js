// ============================================================
// auth.js — Đăng nhập bằng "mã bí mật" tự đặt, không email/mật khẩu.
//
// Luồng hoạt động:
//   1. Người dùng nhập mã bí mật (1 lần trên mỗi thiết bị mới).
//   2. Trình duyệt tự hash mã đó bằng SHA-256 — mã gốc KHÔNG BAO GIỜ
//      rời khỏi thiết bị, chỉ có bản hash được gửi lên server.
//   3. Server so khớp hash: nếu đã có thì đăng nhập, chưa có thì tạo mới.
//   4. Server trả về 1 session_token — token này được lưu cục bộ và
//      dùng cho mọi lần gọi API tiếp theo, để không phải gửi lại mã
//      bí mật (hay hash của nó) mỗi lần.
// ============================================================

const Auth = (() => {

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(hashBuffer));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getStoredSession() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.token || !parsed.userId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function storeSession(session) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
  }

  // Đăng nhập / đăng ký bằng mã bí mật người dùng nhập.
  // Trả về { token, userId, isNew }.
  async function loginWithSecret(secretPhrase) {
    const trimmed = (secretPhrase || '').trim();
    if (trimmed.length < 8) {
      throw new Error('Mã bí mật cần ít nhất 8 ký tự.');
    }

    const hash = await sha256Hex(trimmed);
    const result = await SupabaseClient.rpc('auth_with_secret', {
      p_secret_hash: hash
    });

    if (!result || result.length === 0) {
      throw new Error('Không nhận được phản hồi hợp lệ từ máy chủ.');
    }

    const row = result[0];
    const session = { token: row.session_token, userId: row.user_id };
    storeSession(session);
    return { ...session, isNew: row.is_new };
  }

  function isLoggedIn() {
    return !!getStoredSession();
  }

  function currentToken() {
    const s = getStoredSession();
    return s ? s.token : null;
  }

  function logout() {
    clearSession();
  }

  return {
    loginWithSecret,
    isLoggedIn,
    currentToken,
    logout,
    _sha256Hex: sha256Hex // export để test thủ công nếu cần
  };
})();
