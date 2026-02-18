const STORAGE_KEY = 'pet_town_save_v1';
const CURRENT_VERSION = 3; // ?곗씠??援ъ“ 蹂寃?????踰꾩쟾???щ┝

function normalizeState(data) {
  const normalizedStepProgress = (data?.quests?.stepProgress && typeof data.quests.stepProgress === 'object')
    ? { ...data.quests.stepProgress }
    : {};
  const next = {
    ...data,
    money: typeof data?.money === 'number' ? data.money : 0,
    inventory: Array.isArray(data?.inventory) ? data.inventory : ['fishing_rod'],
    equippedToolId: data?.equippedToolId ?? data?.equippedItem ?? (Array.isArray(data?.inventory) && data.inventory.includes('fishing_rod') ? 'fishing_rod' : null),
    equippedItem: data?.equippedItem || 'fishing_rod',
    lastCatch: data?.lastCatch ?? null
  };
  next.shop = {
    isOpen: !!data?.shop?.isOpen,
    mode: data?.shop?.mode === 'BUY' ? 'BUY' : 'SELL',
    shopId: data?.shop?.shopId ?? null
  };

  const bagCapacityById = { starter_bag: 10, fish_bag_t1: 20, fish_bag_t2: 40, fish_bag_t3: 80 };
  const legacyBagId = next?.fishBag?.itemId || next?.equipment?.bagId || 'starter_bag';
  const legacyBagCapacity = typeof next?.fishBag?.capacity === 'number'
    ? next.fishBag.capacity
    : (bagCapacityById[legacyBagId] || 10);
  const legacyBagFish = Array.isArray(next?.fishBag?.fish) ? next.fishBag.fish.slice() : [];
  next.bags = (next?.bags && typeof next.bags === 'object') ? { ...next.bags } : {};
  if (!next.bags[legacyBagId]) {
    next.bags[legacyBagId] = {
      capacity: legacyBagCapacity,
      fishes: legacyBagFish
    };
  } else {
    if (!Array.isArray(next.bags[legacyBagId].fishes) && Array.isArray(next.bags[legacyBagId].fish)) {
      next.bags[legacyBagId].fishes = next.bags[legacyBagId].fish.slice();
    }
    if (typeof next.bags[legacyBagId].capacity !== 'number') next.bags[legacyBagId].capacity = legacyBagCapacity;
    if (!Array.isArray(next.bags[legacyBagId].fishes)) next.bags[legacyBagId].fishes = legacyBagFish;
  }
  Object.keys(next.bags).forEach((bagId) => {
    const bag = next.bags[bagId];
    if (!bag || typeof bag !== 'object') {
      next.bags[bagId] = { capacity: bagCapacityById[bagId] || 10, fishes: [] };
      return;
    }
    if (!Array.isArray(bag.fishes) && Array.isArray(bag.fish)) bag.fishes = bag.fish.slice();
    if (!Array.isArray(bag.fishes)) bag.fishes = [];
    if (typeof bag.capacity !== 'number') bag.capacity = bagCapacityById[bagId] || 10;
  });
  if (!next.inventory.includes(legacyBagId)) next.inventory.push(legacyBagId);
  if (!next.inventory.includes('starter_bag')) next.inventory.push('starter_bag');

  next.equipment = {
    rodId: next?.equipment?.rodId ?? next.equippedToolId ?? (next.inventory.includes('fishing_rod') ? 'fishing_rod' : null),
    bagId: next?.equipment?.bagId ?? legacyBagId,
    baitId: next?.equipment?.baitId ?? null,
    chairId: next?.equipment?.chairId ?? null,
    trapId: next?.equipment?.trapId ?? null
  };
  if (next.equipment.rodId) next.equippedToolId = next.equipment.rodId;
  if (!next.bags[next.equipment.bagId]) {
    next.bags[next.equipment.bagId] = {
      capacity: bagCapacityById[next.equipment.bagId] || 10,
      fishes: []
    };
  }
  if (next.equipment.baitId && !next.inventory.includes(next.equipment.baitId)) next.equipment.baitId = null;
  if (next.equipment.chairId && !next.inventory.includes(next.equipment.chairId)) next.equipment.chairId = null;
  if (next.equipment.trapId && !next.inventory.includes(next.equipment.trapId)) next.equipment.trapId = null;
  next.seat = {
    isSeated: false,
    chairPlaced: false,
    chairPos: { x: 0, y: 0 },
    autoFishing: false,
    autoTimer: 0,
    bagFullWarn: false
  };

  const legacyFish = next.inventory.filter((id) => typeof id === 'string' && id.startsWith('fish_') && !id.startsWith('fish_bag_'));
  if (legacyFish.length > 0) {
    const equippedBag = next.bags[next.equipment.bagId];
    const room = Math.max(0, (equippedBag?.capacity || 0) - (equippedBag?.fishes?.length || 0));
    const moving = legacyFish.slice(0, room);
    if (moving.length > 0) {
      if (!equippedBag.fishes) equippedBag.fishes = [];
      next.bags[next.equipment.bagId].fishes.push(...moving);
      const movingCounts = {};
      moving.forEach((id) => {
        movingCounts[id] = (movingCounts[id] || 0) + 1;
      });
      next.inventory = next.inventory.filter((id) => {
        if (!movingCounts[id]) return true;
        movingCounts[id]--;
        return false;
      });
    }
  }

  next.ui = {
    modal: null,
    selectedPetId: next?.ui?.selectedPetId ?? null,
    selectedInvId: next?.ui?.selectedInvId ?? null,
    selectedInvIndex: typeof next?.ui?.selectedInvIndex === 'number' ? next.ui.selectedInvIndex : null,
    selectedQuestId: next?.ui?.selectedQuestId ?? null,
    invTab: next?.ui?.invTab || 'ALL',
    fishBagOpen: !!next?.ui?.fishBagOpen,
    openBagId: next?.ui?.openBagId ?? null,
    npcBubble: {
      visible: false,
      text: '',
      idx: 0,
      timer: 0,
      id: null
    }
  };

  if (!Array.isArray(next.ownedPetIds)) next.ownedPetIds = [];
  if (next.activePetId && !next.ownedPetIds.includes(next.activePetId)) next.activePetId = null;
  next.traps = Array.isArray(next?.traps) ? next.traps.map((t) => ({
    x: Number.isFinite(t?.x) ? t.x : 0,
    y: Number.isFinite(t?.y) ? t.y : 0,
    itemId: t?.itemId || 'bait_heavy',
    capacity: Number.isFinite(t?.capacity) ? t.capacity : 10,
    fishes: Array.isArray(t?.fishes) ? t.fishes : [],
    timer: Number.isFinite(t?.timer) ? t.timer : 0
  })) : [];
  next.trapInventory = Array.isArray(next?.trapInventory) ? next.trapInventory.map((t) => ({
    itemId: t?.itemId || 'bait_heavy',
    capacity: Number.isFinite(t?.capacity) ? t.capacity : 10,
    fishes: Array.isArray(t?.fishes) ? t.fishes : []
  })) : [];
  next.quests = {
    activeQuestIds: Array.isArray(data?.quests?.activeQuestIds) ? [...data.quests.activeQuestIds] : ['tut_controls'],
    completedQuestIds: Array.isArray(data?.quests?.completedQuestIds) ? [...data.quests.completedQuestIds] : [],
    stepProgress: normalizedStepProgress,
    newlyCompletedQueue: Array.isArray(data?.quests?.newlyCompletedQueue) ? [...data.quests.newlyCompletedQueue] : []
  };
  if (next.quests.activeQuestIds.length === 0 && next.quests.completedQuestIds.length === 0) {
    next.quests.activeQuestIds.push('tut_controls');
  }

  return next;
}

export const Storage = {
  save(state) {
    try {
      // [Refactored] 硫뷀??곗씠?곗? ?④퍡 ???
      const payload = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        data: state
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      // console.log('Game Saved'); // I/O 遺??媛먯냼瑜??꾪빐 濡쒓렇 ?쒓굅
    } catch (e) {
      console.error('Save failed', e);
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      // 援щ쾭???곗씠???쒖닔 state 媛앹껜) ?명솚??泥댄겕
      if (!parsed.version) {
        console.warn('Legacy save file detected.');
        return normalizeState(parsed);
      }

      // 踰꾩쟾 泥댄겕 諛?留덉씠洹몃젅?댁뀡 (?꾩슂 ??濡쒖쭅 異붽?)
      if (parsed.version < CURRENT_VERSION) {
        console.warn(`Migrating save from v${parsed.version} to v${CURRENT_VERSION}`);
        // return this.migrate(parsed.data, parsed.version);
      }

      return normalizeState(parsed.data || {});
    } catch (e) {
      console.error('Load failed', e);
      return null;
    }
  },

  exists() {
    return !!localStorage.getItem(STORAGE_KEY);
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Save data cleared.');
  }
};
