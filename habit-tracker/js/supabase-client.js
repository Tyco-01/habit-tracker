// ============================================================
// supabase-client.js — Gọi Supabase REST API bằng fetch thuần.
//
// Không dùng thư viện @supabase/supabase-js đầy đủ vì app này chỉ
// cần gọi các hàm RPC (không cần realtime, storage, auth built-in...).
// fetch thuần giúp bundle nhẹ hơn nhiều và không có gì "ẩn" khó kiểm soát.
// ============================================================

const SupabaseClient = (() => {

  async function rpc(functionName, params = {}) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/rpc/${functionName}`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': CONFIG.SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify(params)
      });
    } catch (networkErr) {
      const err = new Error('network_error');
      err.cause = networkErr;
      err.isNetworkError = true;
      throw err;
    }

    if (!response.ok) {
      let detail = null;
      try { detail = await response.json(); } catch { /* ignore */ }
      const err = new Error(detail?.message || detail?.code || `http_${response.status}`);
      err.status = response.status;
      err.detail = detail;
      throw err;
    }

    // Hàm RPC trả void (204 No Content) → không có body để parse
    if (response.status === 204) return null;
    return response.json();
  }

  return { rpc };
})();
