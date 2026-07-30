// ============================================================
// data-repair.js — Dò và TỰ SỬA các lỗi cấu trúc dữ liệu đã biết.
//
// Khác với reload trang (chỉ dọn trạng thái JS tạm thời), module này
// sửa trực tiếp DỮ LIỆU THẬT nếu nó đang ở trạng thái không hợp lệ —
// dùng bởi nút "Làm tươi" để tự phục hồi các lỗi kiểu đã từng xảy ra
// (vd vòng lặp cha-con khiến habit biến mất khỏi màn hình) mà không
// cần biết cách sửa thủ công qua console.
//
// Nguyên tắc: CHỈ sửa những gì chắc chắn sai theo cấu trúc dữ liệu
// (không đoán ý người dùng) — an toàn để chạy nhiều lần, không làm
// gì nếu dữ liệu đã hợp lệ.
// ============================================================

const DataRepair = (() => {

  // Kiểm tra + sửa: mọi habit đang tham gia 1 vòng lặp cha-con.
  // Trả về mảng ID cần tách ra làm gốc (parentId = null) để cắt vòng
  // lặp — chọn habit có sortOrder nhỏ nhất trong mỗi vòng lặp, vì nó
  // nhiều khả năng là "gốc ban đầu" trước khi bị kéo nhầm vào con của
  // chính nó.
  function findCircularParentIds(habits) {
    const byId = {};
    habits.forEach(h => { byId[h.id] = h; });
    const toDetach = new Set();
    const visited = new Set();

    habits.forEach(h => {
      if (visited.has(h.id) || !h.parentId) return;

      const chain = [];
      let cur = h;
      let guard = 0;
      while (cur && cur.parentId && guard < 50) {
        if (chain.includes(cur.id)) {
          const loopStart = chain.indexOf(cur.id);
          const loop = chain.slice(loopStart);
          loop.forEach(id => visited.add(id));
          const pick = loop
            .map(id => byId[id])
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0];
          toDetach.add(pick.id);
          break;
        }
        chain.push(cur.id);
        cur = byId[cur.parentId];
        guard++;
      }
      chain.forEach(id => visited.add(id));
    });

    return [...toDetach];
  }

  // Kiểm tra: parentId trỏ tới 1 id không còn tồn tại trong habits
  // (habit cha đã bị xoá nhưng con chưa được cập nhật lại).
  // Trả về mảng ID cần tách ra làm gốc.
  function findOrphanParentIds(habits) {
    const validIds = new Set(habits.map(h => h.id));
    return habits.filter(h => h.parentId && !validIds.has(h.parentId)).map(h => h.id);
  }

  // Dò toàn bộ lỗi cấu trúc đã biết, KHÔNG tự ghi vào Sync — chỉ trả
  // về danh sách "cần làm gì". Nơi gọi (nút Làm tươi) quyết định có
  // áp dụng hay không, và tự gọi Sync.setHabitParent cho từng ID để
  // đi đúng luồng đồng bộ hàng đợi hiện có (không viết API ghi đè
  // mảng riêng, tránh trùng lặp logic đồng bộ).
  function diagnose() {
    const { habits } = Sync.getData();

    const circularIds = findCircularParentIds(habits);
    const afterCircular = habits.map(h => circularIds.includes(h.id) ? { ...h, parentId: null } : h);
    const orphanIds = findOrphanParentIds(afterCircular);

    const idsToDetach = [...new Set([...circularIds, ...orphanIds])];
    const details = [];
    if (circularIds.length > 0) {
      details.push(`${circularIds.length} việc bị vòng lặp cha-con (đã tự tách ra làm việc độc lập)`);
    }
    if (orphanIds.length > 0) {
      details.push(`${orphanIds.length} việc có việc cha đã không còn tồn tại (đã tự tách ra làm việc độc lập)`);
    }

    return { changed: idsToDetach.length > 0, idsToDetach, details };
  }

  return { diagnose, findCircularParentIds, findOrphanParentIds };
})();
