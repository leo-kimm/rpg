/**
 * inventoryHelper.js — 스택형 인벤토리 CRUD 유틸리티
 *
 * 스키마: [{ itemId: string, count: number }, ...]
 * 장비류(ROD, BAG 등)는 항상 count=1 고정.
 */

/**
 * 평면 배열 ['a','a','b'] → 스택형 [{itemId:'a',count:2},{itemId:'b',count:1}]
 * 이미 스택형이면 그대로 반환 (방어적 처리).
 */
export function migrateInventory(arr) {
    if (!Array.isArray(arr)) return [];
    if (arr.length === 0) return [];

    // 이미 스택형인지 판별 (첫 원소가 객체이고 itemId 키를 가지면)
    if (arr[0] && typeof arr[0] === 'object' && 'itemId' in arr[0]) {
        return arr; // 이미 마이그레이션 완료
    }

    // 평면 → 스택 변환
    const map = new Map();
    for (const id of arr) {
        if (typeof id !== 'string') continue;
        map.set(id, (map.get(id) || 0) + 1);
    }
    return Array.from(map.entries()).map(([itemId, count]) => ({ itemId, count }));
}

/** 인벤토리에 해당 아이템이 있는지 (includes 대체) */
export function invHas(inv, itemId) {
    if (!Array.isArray(inv) || !itemId) return false;
    return inv.some(e => e.itemId === itemId);
}

/** 인벤토리 내 해당 아이템의 수량 (filter().length 대체) */
export function invCount(inv, itemId) {
    if (!Array.isArray(inv) || !itemId) return 0;
    const entry = inv.find(e => e.itemId === itemId);
    return entry ? entry.count : 0;
}

/**
 * 인벤토리에 아이템 추가 (push 대체).
 * 동일 itemId가 있으면 count += n, 없으면 새 엔트리 추가.
 * @returns {Array} 원본 배열 (in-place 수정)
 */
export function invAdd(inv, itemId, n = 1) {
    if (!Array.isArray(inv) || !itemId || n <= 0) return inv;
    const entry = inv.find(e => e.itemId === itemId);
    if (entry) {
        entry.count += n;
    } else {
        inv.push({ itemId, count: n });
    }
    return inv;
}

/**
 * 인벤토리에서 아이템 제거 (splice/indexOf 대체).
 * count -= n, count가 0 이하면 엔트리 자체 삭제.
 * @returns {number} 실제 제거된 수량
 */
export function invRemove(inv, itemId, n = 1) {
    if (!Array.isArray(inv) || !itemId || n <= 0) return 0;
    const idx = inv.findIndex(e => e.itemId === itemId);
    if (idx < 0) return 0;
    const entry = inv[idx];
    const removed = Math.min(entry.count, n);
    entry.count -= removed;
    if (entry.count <= 0) {
        inv.splice(idx, 1);
    }
    return removed;
}

/** 인벤토리 엔트리 검색 (indexOf → find 대체) */
export function invFind(inv, itemId) {
    if (!Array.isArray(inv) || !itemId) return null;
    return inv.find(e => e.itemId === itemId) || null;
}
