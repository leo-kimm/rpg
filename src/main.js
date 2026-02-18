import { CANVAS_W, CANVAS_H, TILE_SIZE, MODES, COLORS } from './core/constants.js'; // [?占쎌젙?? KEYS ?占쎄굅 ?占쎈즺
import { createInitialState } from './core/state.js';
import { Input } from './core/input.js';
import { Time } from './core/time.js';
import { Storage } from './core/storage.js';
import { UI } from './core/ui.js';
import { t } from './core/i18n.js';
import { WORLD_MAP, getTileType } from './world/map.js';
import { Player, drawFishIcon, drawTrapIcon } from './world/entities.js';
import { MovementSystem, InteractionSystem, PetSystem, ActionSystem, TrapSystem, QuestSystem } from './world/systems.js';

// Setup Canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; 
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Game Globals
let state = createInitialState();
const input = new Input();
let player = null;
let petRef = { pet: null }; 

// Delta Time Variables
let lastTime = 0;
const frameStats = {
  fps: 0,
  msPerFrame: 0
};
const inputFrame = {
  inventoryPressed: false
};
const sanityWarningsShown = new Set();

function emitQuestEvent(type, payload = {}) {
  QuestSystem.emitQuestEvent(state, type, payload);
}

function ensureFishBagState() {
  if (!state.bags || typeof state.bags !== 'object') {
    state.bags = {};
  }
  if (state.fishBag && typeof state.fishBag === 'object' && !state.bags[state.fishBag.itemId || 'starter_bag']) {
    state.bags[state.fishBag.itemId || 'starter_bag'] = {
      capacity: state.fishBag.capacity || 10,
      fishes: Array.isArray(state.fishBag.fish) ? state.fishBag.fish.slice() : []
    };
  }
  if (!state.bags.starter_bag) {
    state.bags.starter_bag = { capacity: 10, fishes: [] };
  }
  Object.keys(state.bags).forEach((bagId) => {
    const bag = state.bags[bagId];
    if (!bag || typeof bag !== 'object') {
      state.bags[bagId] = { capacity: 10, fishes: [] };
      return;
    }
    if (!Array.isArray(bag.fishes) && Array.isArray(bag.fish)) bag.fishes = bag.fish.slice();
    if (!Array.isArray(bag.fishes)) bag.fishes = [];
    if (typeof bag.capacity !== 'number') {
      const bagMeta = UI.getItemMeta ? UI.getItemMeta(bagId) : null;
      bag.capacity = bagMeta?.bagCapacity || bagMeta?.capacity || 10;
    }
  });
  if (!Array.isArray(state.inventory)) state.inventory = [];
  if (!state.inventory.includes('starter_bag')) state.inventory.push('starter_bag');
  if (!state.equipment || typeof state.equipment !== 'object') {
    state.equipment = {
      rodId: state.equippedToolId || (state.inventory.includes('fishing_rod') ? 'fishing_rod' : null),
      bagId: 'starter_bag',
      baitId: null,
      chairId: null,
      trapId: null
    };
  }
  if (!state.equipment.rodId) state.equipment.rodId = state.equippedToolId || 'fishing_rod';
  if (!state.equipment.bagId) state.equipment.bagId = 'starter_bag';
  if (!Object.prototype.hasOwnProperty.call(state.equipment, 'trapId')) state.equipment.trapId = null;
  if (!Object.prototype.hasOwnProperty.call(state.equipment, 'chairId')) state.equipment.chairId = null;
  if (state.equipment.rodId) state.equippedToolId = state.equipment.rodId;
  if (!state.bags[state.equipment.bagId]) {
    const bagMeta = UI.getItemMeta ? UI.getItemMeta(state.equipment.bagId) : null;
    state.bags[state.equipment.bagId] = {
      capacity: bagMeta?.bagCapacity || bagMeta?.capacity || 10,
      fishes: []
    };
  }
  if (state.equipment.baitId && !state.inventory.includes(state.equipment.baitId)) state.equipment.baitId = null;
  if (state.equipment.chairId && !state.inventory.includes(state.equipment.chairId)) state.equipment.chairId = null;
  if (state.equipment.trapId && !state.inventory.includes(state.equipment.trapId)) state.equipment.trapId = null;
  if (!Array.isArray(state.traps)) state.traps = [];
  if (!Array.isArray(state.trapInventory)) state.trapInventory = [];
  if (!state.seat || typeof state.seat !== 'object') {
    state.seat = { isSeated: false, chairPlaced: false, chairPos: { x: 0, y: 0 }, autoFishing: false, autoTimer: 0, bagFullWarn: false };
  }
  if (!state.ui || typeof state.ui !== 'object') {
    state.ui = {
      modal: null,
      selectedPetId: null,
      selectedInvId: null,
      selectedInvIndex: null,
      invTab: 'ALL',
      fishBagOpen: false,
      openBagId: null,
      npcBubble: { visible: false, text: '', idx: 0, timer: 0, id: null }
    };
  }
  if (!state.ui.npcBubble || typeof state.ui.npcBubble !== 'object') {
    state.ui.npcBubble = { visible: false, text: '', idx: 0, timer: 0, id: null };
  }
  if (!Object.prototype.hasOwnProperty.call(state.ui, 'openBagId')) state.ui.openBagId = null;
  if (!state.shop || typeof state.shop !== 'object') {
    state.shop = { isOpen: false, mode: 'SELL', shopId: null };
  }
  if (!state.quests || typeof state.quests !== 'object') {
    state.quests = { activeQuestIds: ['tut_controls'], completedQuestIds: [], stepProgress: {}, newlyCompletedQueue: [] };
  }
  if (!Array.isArray(state.quests.activeQuestIds)) state.quests.activeQuestIds = [];
  if (!Array.isArray(state.quests.completedQuestIds)) state.quests.completedQuestIds = [];
  if (!state.quests.stepProgress || typeof state.quests.stepProgress !== 'object') state.quests.stepProgress = {};
  if (!Array.isArray(state.quests.newlyCompletedQueue)) state.quests.newlyCompletedQueue = [];
  if (state.quests.activeQuestIds.length === 0 && state.quests.completedQuestIds.length === 0) {
    state.quests.activeQuestIds.push('tut_controls');
  }
}

function getEquippedBagContainer() {
  ensureFishBagState();
  const bagId = state?.equipment?.bagId;
  if (!bagId || !state.bags[bagId]) return null;
  return state.bags[bagId];
}

// Camera System
const camera = {
  x: 0,
  y: 0,
  width: CANVAS_W,
  height: CANVAS_H,
  update(target, mapWidth, mapHeight) {
    this.width = canvas.width;
    this.height = canvas.height;
    if (!Number.isFinite(this.x)) this.x = 0;
    if (!Number.isFinite(this.y)) this.y = 0;
    if (!Number.isFinite(mapWidth) || !Number.isFinite(mapHeight) || mapWidth <= 0 || mapHeight <= 0) return;
    const targetX = target.renderX - this.width / 2 + TILE_SIZE / 2;
    const targetY = target.renderY - this.height / 2 + TILE_SIZE / 2;
    this.x += (targetX - this.x) * 0.15;
    this.y += (targetY - this.y) * 0.15;
    const maxX = Math.max(0, mapWidth * TILE_SIZE - this.width);
    const maxY = Math.max(0, mapHeight * TILE_SIZE - this.height);
    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
    if (!Number.isFinite(this.x)) this.x = 0;
    if (!Number.isFinite(this.y)) this.y = 0;
  }
};

// Init
function init() {
  const hasSave = Storage.exists();
  UI.init({
    onNewGame: startNewGame,
    onContinue: loadGame,
    onSelectPet: (id) => state.selectedPetId = id,
    onWalkPet: (id) => {
      state.activePetId = id;
      emitQuestEvent('PET_EQUIPPED', { petId: id });
    },
    onStopWalk: () => state.activePetId = null,
    onSellItem: (itemRef) => sellItem(itemRef),
    onSellTrap: (trapRef) => sellTrapContents(trapRef),
    onSellTen: () => sellTenFish(),
    onBuyItem: (itemId, count = 1) => buyItem(itemId, count),
    onInventoryChanged: () => Storage.save(state)
  });

  UI.setStartScreen(true, hasSave);
  requestAnimationFrame(loop);
}

function startNewGame() {
  state = createInitialState();
  ensureFishBagState();
  if (!Array.isArray(state.inventory)) state.inventory = [];
  if (!state.inventory.includes('fishing_rod')) state.inventory.push('fishing_rod');
  if (!state.equippedToolId && state.inventory.includes('fishing_rod')) state.equippedToolId = 'fishing_rod';
  if (!state.equippedItem) state.equippedItem = 'fishing_rod';
  startGame();
}

function loadGame() {
  const loaded = Storage.load();
  if (loaded) {
    state = loaded;
    ensureFishBagState();
    if (!Array.isArray(state.inventory)) state.inventory = [];
    if (!state.equippedToolId && state.inventory.includes('fishing_rod')) state.equippedToolId = 'fishing_rod';
    startGame();
  } else {
    // 濡쒕뱶 ?占쏀뙣 ????寃뚯엫
    startNewGame();
  }
}

function toFishRecord(entry) {
  if (typeof entry === 'string') return { itemId: entry, rarity: 'C', weightG: null, unitPrice: null };
  if (entry && typeof entry === 'object') return entry;
  return null;
}

function findFishEntryIndex(source, itemRef) {
  if (!Array.isArray(source)) return -1;
  if (itemRef && typeof itemRef === 'object') {
    const idx = source.indexOf(itemRef);
    if (idx >= 0) return idx;
    const byValue = source.findIndex((x) => {
      if (!x || typeof x !== 'object') return false;
      return x.itemId === itemRef.itemId
        && (x.rarity || 'C') === (itemRef.rarity || 'C')
        && (x.weightG ?? null) === (itemRef.weightG ?? null)
        && (x.unitPrice ?? null) === (itemRef.unitPrice ?? null);
    });
    return byValue;
  }
  return source.findIndex((x) => {
    const rec = toFishRecord(x);
    return rec && rec.itemId === itemRef;
  });
}

function sellItem(itemRef) {
  ensureFishBagState();
  const bag = getEquippedBagContainer();
  const source = Array.isArray(bag?.fishes) ? bag.fishes : [];
  const record = toFishRecord(itemRef);
  const itemId = record?.itemId || itemRef;
  const idx = findFishEntryIndex(source, itemRef);
  if (idx < 0) return;

  const item = UI.getItemMeta ? UI.getItemMeta(itemId) : null;
  const sourceRec = toFishRecord(source[idx]);
  const price = UI.getComputedSellPrice ? UI.getComputedSellPrice(item, sourceRec) : (item?.sellPrice || item?.price || 0);
  source.splice(idx, 1);
  state.money += price;
  emitQuestEvent('SELL_FISH', { count: 1, totalPrice: price });
  Storage.save(state);

  UI.showDialog(t('msg.shop.sold', { name: UI.getItemName ? UI.getItemName(item) : (item?.name || itemId), price }));
  setTimeout(() => UI.hideDialog(), 700);
  UI.renderShop(state);
}

function sellTenFish() {
  ensureFishBagState();
  const bag = getEquippedBagContainer();
  const source = Array.isArray(bag?.fishes) ? bag.fishes : [];
  if (source.length < 10) {
    UI.showDialog('Need at least 10 fish.');
    setTimeout(() => UI.hideDialog(), 700);
    return;
  }

  const batch = source.slice(0, 10);
  let totalPrice = 0;
  batch.forEach((entry) => {
    const rec = toFishRecord(entry);
    const item = UI.getItemMeta ? UI.getItemMeta(rec?.itemId) : null;
    totalPrice += UI.getComputedSellPrice ? UI.getComputedSellPrice(item, rec) : (item?.sellPrice || item?.price || 0);
  });

  const bonus = Math.floor(totalPrice * 0.1);
  source.splice(0, 10);
  state.money += (totalPrice + bonus);
  emitQuestEvent('SELL_FISH', { count: 10, totalPrice: totalPrice + bonus });
  Storage.save(state);

  UI.showDialog(`Sold 10 fish +${totalPrice + bonus}G (bonus ${bonus}G)`);
  setTimeout(() => UI.hideDialog(), 900);
  UI.renderShop(state);
}

function sellTrapContents(trapRef) {
  if (!trapRef || typeof trapRef !== 'object') return;
  const source = Array.isArray(state?.trapInventory) ? state.trapInventory : [];
  const idx = source.indexOf(trapRef);
  if (idx < 0) return;
  const fishes = Array.isArray(source[idx].fishes) ? source[idx].fishes : [];
  if (fishes.length === 0) return;
  let total = 0;
  fishes.forEach((entry) => {
    const item = UI.getItemMeta ? UI.getItemMeta(entry?.itemId) : null;
    total += UI.getComputedSellPrice ? UI.getComputedSellPrice(item, entry) : (item?.sellPrice || item?.price || 0);
  });
  source[idx].fishes = [];
  state.money += total;
  Storage.save(state);
  UI.showDialog(`통발 어획 정산 +${total}G`);
  setTimeout(() => UI.hideDialog(), 800);
  UI.renderShop(state);
}

function buyItem(itemId, count = 1) {
  const item = UI.getItemMeta ? UI.getItemMeta(itemId) : null;
  if (!item) return;
  ensureFishBagState();
  const unitPrice = UI.getComputedBuyPrice ? UI.getComputedBuyPrice(item) : (item.buyPrice || 0);
  const buyCount = Math.max(1, Math.min(99, Math.floor(Number(count) || 1)));
  if (unitPrice <= 0) return;
  const isUniqueEquip = item.equipSlot === 'BAG' || item.equipSlot === 'ROD';
  const totalPrice = isUniqueEquip ? unitPrice : (unitPrice * buyCount);
  if ((state.money ?? 0) < totalPrice) {
    UI.showDialog(`골드가 부족합니다. (${totalPrice}G 필요)`);
    setTimeout(() => UI.hideDialog(), 700);
    return;
  }

  if (!Array.isArray(state.inventory)) state.inventory = [];
  if (isUniqueEquip && state.inventory.includes(itemId)) {
    UI.showDialog('이미 보유한 장비입니다.');
    setTimeout(() => UI.hideDialog(), 700);
    return;
  }

  if (item.equipSlot === 'BAG') {
    ensureFishBagState();
    if (state.bags[itemId]) {
      UI.showDialog('?대? 蹂댁쑀??媛諛⑹엯?덈떎.');
      setTimeout(() => UI.hideDialog(), 700);
      return;
    }
    state.money -= unitPrice;
    if (!state.inventory.includes(itemId)) state.inventory.push(itemId);
    state.bags[itemId] = {
      capacity: item.bagCapacity || item.capacity || 10,
      fishes: []
    };
    emitQuestEvent('BUY_ITEM', { itemId, price: unitPrice, count: 1 });
    Storage.save(state);
    UI.showDialog(`${UI.getItemName ? UI.getItemName(item) : item.name} x1 구매 완료 (-${unitPrice}G)`);
    setTimeout(() => UI.hideDialog(), 700);
    UI.renderShop(state);
    return;
  }

  state.money -= totalPrice;
  for (let i = 0; i < buyCount; i++) {
    state.inventory.push(itemId);
  }
  if (item.equipSlot === 'TRAP') {
    if (!Array.isArray(state.trapInventory)) state.trapInventory = [];
    for (let i = 0; i < buyCount; i++) {
      state.trapInventory.push({
        itemId,
        capacity: Number(item.trapCapacity || 10),
        fishes: []
      });
    }
  }
  emitQuestEvent('BUY_ITEM', { itemId, price: totalPrice, count: buyCount });

  if (item.equipSlot === 'BAIT') {
    // Bait is consumable stock; keep currently equipped bait unless empty.
  }

  if (item.toolKind === 'FISHING_ROD') {
    const equipped = UI.getItemMeta ? UI.getItemMeta(state.equippedToolId) : null;
    const equippedTier = equipped?.toolKind === 'FISHING_ROD' ? (equipped.tier || 1) : 0;
    const newTier = item.tier || 1;
    if (!state.equippedToolId || newTier > equippedTier) {
      state.equippedToolId = itemId;
      state.equipment.rodId = itemId;
    }
  }

  Storage.save(state);
  UI.showDialog(`${UI.getItemName ? UI.getItemName(item) : item.name} x${buyCount} 구매 완료 (-${totalPrice}G)`);
  setTimeout(() => UI.hideDialog(), 700);
  UI.renderShop(state);
}

function startGame() {
  if (!WORLD_MAP || !WORLD_MAP.width || !WORLD_MAP.height) return;
  const sp = WORLD_MAP?.spawnPoint;
  const startX = Number.isFinite(sp?.x) ? sp.x : 22;
  const startY = Number.isFinite(sp?.y) ? sp.y : 16;
  player = new Player(startX, startY, state?.playerPos?.facing || 'down');
  camera.width = canvas.width;
  camera.height = canvas.height;
  camera.x = player.renderX - camera.width / 2 + TILE_SIZE / 2;
  camera.y = player.renderY - camera.height / 2 + TILE_SIZE / 2;
  if (!Number.isFinite(camera.x)) camera.x = 0;
  if (!Number.isFinite(camera.y)) camera.y = 0;
  camera.update(player, WORLD_MAP.width, WORLD_MAP.height);
  state.mode = MODES.EXPLORE;
  UI.setStartScreen(false, false);

  if (!state.hasSeenIntro) {
    state.hasSeenIntro = true;
    UI.showDialog(t('msg.intro.welcome'));
    state.mode = MODES.DIALOG;
  }
}

function loop(timestamp) {
  /*
   * REGRESSION CHECKLIST
   * - App boots without console errors; start screen appears
   * - Press Space: START -> EXPLORE works
   * - Player is visible and can move; movement cadence unchanged
   * - Inventory/menu open/close returns to EXPLORE
   * - Dialog open/close returns to EXPLORE
   * - Fishing start/stop still works (if implemented)
   * - Pet encounter in bush still works (if implemented)
   * - Camera follows player (if implemented)
   * - F1 debug overlay toggles and does not break controls
   */
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  updateFrameStats(dt);

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function updateFrameStats(dt) {
  if (!dt || dt <= 0) return;
  frameStats.fps = 1 / dt;
  frameStats.msPerFrame = dt * 1000;
}

function warnOnce(issueKey, message) {
  if (sanityWarningsShown.has(issueKey)) return;
  sanityWarningsShown.add(issueKey);
  console.warn(`[debugSanity] ${message}`);
}

function isDebugOverlayOn() {
  const debugEl = document.getElementById('debug-overlay');
  return !!debugEl && !debugEl.classList.contains('hidden');
}

function debugSanity() {
  // Read-only sanity checks only; no state mutation.
  if (!state) warnOnce('missing_state', 'state is null/undefined');
  if (!input) warnOnce('missing_input', 'input is null/undefined');
  if (!WORLD_MAP) warnOnce('missing_map', 'WORLD_MAP is null/undefined');
  if (!UI) warnOnce('missing_ui', 'UI module is null/undefined');

  if (state && state.mode !== MODES.START && !player) {
    warnOnce('missing_player', 'player is null/undefined outside START mode');
  }

  if (WORLD_MAP) {
    if (typeof WORLD_MAP.width !== 'number' || typeof WORLD_MAP.height !== 'number') {
      warnOnce('bad_map_size', 'WORLD_MAP width/height is invalid');
    }
    if (!Array.isArray(WORLD_MAP.tileLayer)) {
      warnOnce('bad_map_tile_layer', 'WORLD_MAP.tileLayer is missing or not an array');
    }
  }

  if (!document.getElementById('game')) warnOnce('missing_node_game', '#game node is missing');
  if (!document.getElementById('ui-layer')) warnOnce('missing_node_ui_layer', '#ui-layer node is missing');
  if (!document.getElementById('debug-overlay')) warnOnce('missing_node_debug_overlay', '#debug-overlay node is missing');
}

function update(dt) {
  // input.update();
  inputFrame.inventoryPressed = input.wasActionPressed('INVENTORY');

  if (input.wasActionPressed('DEBUG_TOGGLE')) {
    UI.toggleDebugOverlay();
  }

  if (input.wasActionPressed('CANCEL')) {
    if (handleCancelAction()) {
      input.update();
      return;
    }
  }

  if (state.mode !== MODES.EXPLORE && state.isFishing && player && ActionSystem.stopFishing) {
    ActionSystem.stopFishing(state, player, 'MODE_CHANGE');
  }
  if (state.mode !== MODES.EXPLORE && state?.seat?.isSeated && player && ActionSystem.stopSeating) {
    ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
  }

  switch (state.mode) {
    case MODES.START:
      updateStart();
      break;
    case MODES.EXPLORE:
      updateExplore(dt);
      break;
    case MODES.MENU:
      updateMenu();
      break;
    case MODES.DIALOG:
      updateDialog();
      break;
    case MODES.SHOP:
      updateShop();
      break;
  }

  if (state?.quests?._dirty) {
    state.quests._dirty = false;
    Storage.save(state);
  }

  input.update();
}

function handleCancelAction() {
  if (UI.closeTransientViews && UI.closeTransientViews(state)) return true;

  const dialogEl = document.getElementById('dialog-box');
  const dialogOpen = state.mode === MODES.DIALOG || (!!dialogEl && !dialogEl.classList.contains('hidden'));

  if (dialogOpen) {
    UI.hideDialog();
    if (state.mode === MODES.DIALOG) state.mode = MODES.EXPLORE;
    return true;
  }

  if (state.mode === MODES.SHOP) {
    UI.toggleShop(false, state);
    if (state.shop) state.shop.isOpen = false;
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'ESC');
    state.mode = MODES.EXPLORE;
    return true;
  }

  if (state.mode === MODES.MENU) {
    UI.togglePokedex(false, state);
    UI.toggleInventory(false, state);
    UI.toggleQuestLog(false, state);
    UI.toggleShop(false, state);
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'ESC');
    state.mode = MODES.EXPLORE;
    return true;
  }

  if (state.isFishing && player && ActionSystem.stopFishing) {
    ActionSystem.stopFishing(state, player, 'ESC');
    return true;
  }

  return false;
}

function updateStart() {
  // [?占쎌젙?? KEYS.ENTER -> 'INTERACT' ?占쎌뀡 ?占쎌슜
  if (input.wasActionPressed('INTERACT') || input.wasActionPressed('START')) {
    if (Storage.exists()) loadGame();
    else startNewGame();
  }
}

function updateMenu() {
  if (input.wasActionPressed('MENU') || input.wasActionPressed('INVENTORY') || input.wasActionPressed('QUEST_LOG')) {
    state.mode = MODES.EXPLORE;
    UI.togglePokedex(false, state);
    UI.toggleInventory(false, state); // ?占쎈깽?占쎈━ ?占쎄린
    UI.toggleQuestLog(false, state);
  }
}

function updateDialog() {
  // [?占쎌젙?? KEYS.SPACE -> 'INTERACT' ?占쎌뀡 ?占쎌슜
  if (input.wasActionPressed('INTERACT') || input.wasActionPressed('START')) {
    UI.hideDialog();
    state.mode = MODES.EXPLORE;
  }
}

function updateShop() {
  UI.toggleShop(true, state);
  const lockActive = (state.shopCloseLockUntil || 0) > Date.now();
  if (input.wasActionPressed('MENU') || (!lockActive && input.wasActionPressed('INTERACT'))) {
    UI.toggleShop(false, state);
    if (state.shop) state.shop.isOpen = false;
    state.mode = MODES.EXPLORE;
  }
}

function updateExplore(dt) {
  const safeDt = Math.min(dt, 0.1);
  // [New] ?占쎈깽?占쎈━ ??(I)
  if (input.wasActionPressed('INVENTORY')) {
     if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
     // UI.toggleInventory(true, state) ??援ы쁽 ?占쎌슂 (媛꾨떒??Dialog 紐⑤뱶泥섎읆 泥섎━ 媛??
     // ?占쎄린?占쎈뒗 媛꾨떒??濡쒓렇占?李띻굅??UI ?占쎌텧
     UI.toggleInventory(true, state);
     emitQuestEvent('OPEN_INVENTORY');
     state.mode = MODES.MENU; // 硫붾돱 紐⑤뱶占??占쏀솚?占쎌뿬 ?占쎈룞 留됯린
     return;
  }

  if (input.wasActionPressed('QUEST_LOG')) {
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
    UI.toggleQuestLog(true, state);
    emitQuestEvent('OPEN_QUEST_LOG');
    state.mode = MODES.MENU;
    return;
  }


  // [?占쎌젙?? KEYS.TAB -> 'MENU' ?占쎌뀡 ?占쎌슜
  if (input.wasActionPressed('MENU')) {
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
    state.mode = MODES.MENU;
    UI.togglePokedex(true, state);
    return;
  }

  // [New] ?占쎌떆 ?占쎌뒪???占쎈뜲?占쏀듃
  ActionSystem.update(state, input, player, WORLD_MAP, (msg) => {
    UI.showDialog(msg);
    // 占쏙옙占쏙옙 占쌨쏙옙占쏙옙占쏙옙 占쏙옙占?占쏙옙占쏙옙占쌍곤옙 占쌥깍옙
    setTimeout(() => UI.hideDialog(), 1000);
  }, safeDt);


  Time.advance(state, safeDt);

  MovementSystem.update(state, input, player, WORLD_MAP);
  
  if (player) player.update(safeDt);

  if (player) {
      camera.update(player, WORLD_MAP.width, WORLD_MAP.height);
  }

  InteractionSystem.update(state, input, WORLD_MAP, (msg) => {
    UI.showDialog(msg);
    state.mode = MODES.DIALOG;
    Storage.save(state);
  }, safeDt);

  if (state.mode === MODES.SHOP) {
    UI.toggleShop(true, state);
    return;
  }

  PetSystem.update(state, player, petRef, safeDt);
  TrapSystem.update(state, safeDt);
}





// ----------------------------------------------------
// Rendering Logic
// ----------------------------------------------------

function drawTileDetail(ctx, x, y, type) {
  if (!Number.isFinite(type)) type = 0;
  const size = TILE_SIZE;
  const tx = Math.floor(x / size);
  const ty = Math.floor(y / size);
  const h = (tx * 73856093 ^ ty * 19349663) >>> 0;
  const r = (n) => ((h >> n) & 255) / 255;

  if (type === 0) {
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(x, y, size, size);
    if (r(1) < 0.1) {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(x + 4 + Math.floor(r(2) * 8), y + 5 + Math.floor(r(3) * 8), 2, 2);
      if (r(4) < 0.4) ctx.fillRect(x + 16, y + 18, 2, 2);
    }
  } else if (type === 1) {
    ctx.fillStyle = '#c27a3a';
    ctx.fillRect(x, y, size, size);
    if (r(5) < 0.08) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 6 + Math.floor(r(6) * 10), y + 6 + Math.floor(r(7) * 10), 2, 2);
    }
  } else if (type === 2 || type === 11) {
    ctx.fillStyle = type === 11 ? '#5b6168' : ((COLORS && COLORS.WALL) ? COLORS.WALL : '#7f8c8d');
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  } else if (type === 3) {
    ctx.fillStyle = '#2e9f57';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = (COLORS && COLORS.BUSH) ? COLORS.BUSH : '#27ae60';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 4) {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 5, y + 8 + Math.floor(r(8) * 3), 10, 2);
    ctx.fillRect(x + 15, y + 18 + Math.floor(r(9) * 3), 8, 2);
    const layer = Array.isArray(WORLD_MAP?.tileLayer) ? WORLD_MAP.tileLayer : null;
    const idxOf = (nx, ny) => ny * WORLD_MAP.width + nx;
    const isLand = (nx, ny) => nx >= 0 && ny >= 0 && nx < WORLD_MAP.width && ny < WORLD_MAP.height
      ? (Number.isFinite(layer?.[idxOf(nx, ny)]) ? layer[idxOf(nx, ny)] : 0) !== 4
      : false;
    ctx.fillStyle = 'rgba(236, 240, 241, 0.55)';
    if (isLand(tx, ty - 1)) ctx.fillRect(x, y, size, 1);
    if (isLand(tx - 1, ty)) ctx.fillRect(x, y, 1, size);
    if (isLand(tx + 1, ty)) ctx.fillRect(x + size - 1, y, 1, size);
    if (isLand(tx, ty + 1)) ctx.fillRect(x, y + size - 1, size, 1);
  } else if (type === 5) {
    ctx.fillStyle = '#57606f';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#dfe4ea';
    ctx.fillRect(x + 14, y + 4, 4, 12);
  } else if (type === 6 || type === 7) {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = type === 6 ? '#d35400' : '#bdc3c7';
    ctx.fillRect(x + 2, y + 4, size - 4, size - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + 8, size, 2);
  } else if (type === 8) {
    ctx.fillStyle = '#f6e58d';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    if (r(10) < 0.25) ctx.fillRect(x + 5, y + 5, 2, 2);
    if (r(11) < 0.18) ctx.fillRect(x + 20, y + 20, 2, 2);
  } else if (type === 9) {
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x + size, y + size);
    ctx.fill();
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.35, y + size * 0.3);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x + size * 0.65, y + size * 0.3);
    ctx.fill();
  } else if (type === 10) {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#111822';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size, size / 2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1abc9c';
    ctx.fillRect(x + size / 2 - 2, y + size / 2 + 4, 2, 2);
  } else if (type === 12) {
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = (h % 2 === 0) ? '#e74c3c' : '#f1c40f';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = (COLORS && COLORS.GRASS) ? COLORS.GRASS : '#2ecc71';
    ctx.fillRect(x, y, size, size);
  }
}

function drawSeaElephantNpc(ctx, tx, ty) {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8d8f96';
  ctx.fillRect(px + 6, py + 10, 20, 14);
  ctx.fillRect(px + 3, py + 14, 8, 8);
  ctx.fillRect(px + 20, py + 18, 4, 4);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 18, py + 14, 2, 2);
  ctx.fillRect(px + 22, py + 14, 2, 2);
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(px + 20, py + 20, 1, 4);
  ctx.fillRect(px + 23, py + 20, 1, 4);
}

function drawTackleNpc(ctx, tx, ty) {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6c7a89';
  ctx.fillRect(px + 9, py + 11, 14, 14);
  ctx.fillStyle = '#c8a37a';
  ctx.fillRect(px + 10, py + 4, 12, 10);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 12, py + 8, 2, 2);
  ctx.fillRect(px + 18, py + 8, 2, 2);
}

function drawMayorNpc(ctx, tx, ty) {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f6ea8';
  ctx.fillRect(px + 10, py + 10, 12, 14);
  ctx.fillStyle = '#f1c27d';
  ctx.fillRect(px + 10, py + 4, 12, 9);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 12, py + 8, 2, 2);
  ctx.fillRect(px + 18, py + 8, 2, 2);
}

function drawForestKeeperNpc(ctx, tx, ty) {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c7a5e';
  ctx.fillRect(px + 9, py + 10, 14, 14);
  ctx.fillStyle = '#bfd26b';
  ctx.fillRect(px + 9, py + 4, 14, 9);
  ctx.fillStyle = '#1f2d3a';
  ctx.fillRect(px + 12, py + 8, 2, 2);
  ctx.fillRect(px + 18, py + 8, 2, 2);
}

function drawFishSign(ctx, px, py) {
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(px + 2, py + 2, 16, 8);
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.ellipse(px + 10, py + 6, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px + 13, py + 6);
  ctx.lineTo(px + 16, py + 4);
  ctx.lineTo(px + 16, py + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(px + 8, py + 5, 1, 1);
}

function drawTackleSign(ctx, px, py) {
  ctx.fillStyle = '#f39c12';
  ctx.fillRect(px + 2, py + 2, 16, 8);
  ctx.strokeStyle = '#ecf0f1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 9);
  ctx.lineTo(px + 14, py + 3);
  ctx.stroke();
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(px + 14, py + 3, 2, 2);
}

function drawMarketBuilding(ctx, rect, type = 'SELL') {
  if (!rect) return;
  const rx = rect.x * TILE_SIZE;
  const ry = rect.y * TILE_SIZE;
  const rw = rect.w * TILE_SIZE;
  const rh = rect.h * TILE_SIZE;
  const bandH = Math.floor(TILE_SIZE * 0.7);
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(rx, ry, rw, bandH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(rx, ry, rw, rh);
  const doorTx = rect.x;
  const doorTy = rect.y + rect.h - 1;
  const dx = doorTx * TILE_SIZE;
  const dy = doorTy * TILE_SIZE;
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(dx + 3, dy + 3, TILE_SIZE - 6, TILE_SIZE - 3);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(dx + TILE_SIZE - 8, dy + TILE_SIZE / 2, 2, 2);
  const signX = rx + Math.floor(rw / 2) - 10;
  const signY = ry + 2;
  if (type === 'BUY') drawTackleSign(ctx, signX, signY);
  else drawFishSign(ctx, signX, signY);
}

function drawFishingChair(ctx, tx, ty, dir = 'down') {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  const sx = px + 6;
  const sy = py + 10;
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(sx, sy + 8, 20, 6); // seat
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(sx + 1, sy + 14, 3, 7);
  ctx.fillRect(sx + 16, sy + 14, 3, 7);
  // directional backrest
  if (dir === 'up') {
    ctx.fillRect(sx + 2, sy + 12, 16, 3);
  } else if (dir === 'left') {
    ctx.fillRect(sx + 15, sy + 2, 3, 14);
  } else if (dir === 'right') {
    ctx.fillRect(sx + 2, sy + 2, 3, 14);
  } else {
    ctx.fillRect(sx + 2, sy, 16, 3); // down/default
  }
}

function drawNpcBubble(ctx, npc, text) {
  if (!npc || !text) return;
  const npcPx = npc.x * TILE_SIZE + TILE_SIZE / 2;
  const npcPy = npc.y * TILE_SIZE;
  ctx.font = '12px DotGothic16, sans-serif';
  const padX = 8;
  const padY = 6;
  const textW = Math.ceil(ctx.measureText(text).width);
  const w = textW + padX * 2;
  const h = 26;
  const camMinX = camera.x + 4;
  const camMaxX = camera.x + camera.width - w - 4;
  const bx = Math.max(camMinX, Math.min(npcPx - w / 2, camMaxX));
  const by = npcPy - 34;
  const tailX = Math.max(bx + 10, Math.min(npcPx, bx + w - 10));

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeRect(bx, by, w, h);
  ctx.beginPath();
  ctx.moveTo(tailX - 5, by + h);
  ctx.lineTo(tailX + 5, by + h);
  ctx.lineTo(tailX, by + h + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ecf0f1';
  ctx.fillText(text, bx + padX, by + 16);
}

function draw() {
  let tilesDrawn = 0;
  let entitiesCount = 0;
  try {
    // Hard reset transform every frame to prevent accumulated transforms.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (player) camera.update(player, WORLD_MAP.width, WORLD_MAP.height);
    const mapW = WORLD_MAP?.width;
    const mapH = WORLD_MAP?.height;
    const layer = Array.isArray(WORLD_MAP?.tileLayer) ? WORLD_MAP.tileLayer : null;
    if (!WORLD_MAP || !layer || layer.length === 0 || !mapW || !mapH) {
      if (!sanityWarningsShown.has('map_not_ready')) {
        sanityWarningsShown.add('map_not_ready');
        console.error(`[draw] MAP NOT READY width=${mapW || 0} height=${mapH || 0} tileLayer=${layer ? layer.length : 0}`);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ff4d4f';
      ctx.font = 'bold 24px DotGothic16, monospace';
      ctx.fillText('MAP NOT READY', 12, 34);
      ctx.font = 'bold 14px DotGothic16, monospace';
      ctx.fillText(`tileLayer=${layer ? layer.length : 0} width=${mapW || 0} height=${mapH || 0}`, 12, 56);
      UI.updateHUD(state, {
        mode: state.mode ?? 'N/A',
        mapReady: 'NO',
        mapWidth: mapW || 0,
        mapHeight: mapH || 0,
        tileLayerLen: layer ? layer.length : 0
      });
      return;
    }
    if (!Number.isFinite(camera.x)) camera.x = 0;
    if (!Number.isFinite(camera.y)) camera.y = 0;

    const camX = Math.max(0, Math.floor(camera.x));
    const camY = Math.max(0, Math.floor(camera.y));
    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw only visible tiles in current camera viewport.
    const startCol = Math.floor(camX / TILE_SIZE);
    const endCol = startCol + Math.ceil(camera.width / TILE_SIZE) + 1;
    const startRow = Math.floor(camY / TILE_SIZE);
    const endRow = startRow + Math.ceil(camera.height / TILE_SIZE) + 1;
    for (let y = startRow; y <= endRow; y++) {
      if (y < 0 || y >= WORLD_MAP.height) continue;
      for (let x = startCol; x <= endCol; x++) {
        if (x < 0 || x >= WORLD_MAP.width) continue;
        const idx = y * WORLD_MAP.width + x;
        const raw = layer ? layer[idx] : 0;
        const tileId = Number.isFinite(raw) ? raw : 0;
        drawTileDetail(ctx, x * TILE_SIZE, y * TILE_SIZE, tileId);
        tilesDrawn++;
      }
    }

    // Shop POI Marker
    const shopPois = Array.isArray(WORLD_MAP.poi) ? WORLD_MAP.poi.filter(p => p.type === 'SHOP') : [];
    shopPois.forEach((poi) => {
      drawMarketBuilding(ctx, poi.rect, poi.shopMode || 'SELL');
    });

    const trapList = Array.isArray(state?.traps) ? state.traps : [];
    trapList.forEach((trap) => {
      if (!trap) return;
      const px = trap.x * TILE_SIZE;
      const py = trap.y * TILE_SIZE;
      drawTrapIcon(ctx, trap, px, py, TILE_SIZE);
      const cap = Number(trap.capacity || 0);
      const fill = Array.isArray(trap.fishes) ? trap.fishes.length : 0;
      if (cap > 0 && fill >= cap) {
        ctx.fillStyle = '#ff6b35';
        ctx.font = 'bold 14px DotGothic16, monospace';
        ctx.fillText('!', px + TILE_SIZE / 2 - 2, py - 4 + Math.sin(Date.now() / 160) * 2);
      }
    });

    if (state.mode === MODES.EXPLORE && state?.seat?.chairPlaced && state?.seat?.chairPos) {
      drawFishingChair(ctx, state.seat.chairPos.x, state.seat.chairPos.y, player?.facing || 'down');
    }
    const npcs = Array.isArray(WORLD_MAP.npcs) ? WORLD_MAP.npcs : [];
    npcs.forEach((npc) => {
      if (npc.kind === 'SHOPKEEPER_SELL') drawSeaElephantNpc(ctx, npc.x, npc.y);
      else if (npc.kind === 'SHOPKEEPER_BUY') drawTackleNpc(ctx, npc.x, npc.y);
      else if (npc.kind === 'QUEST_GIVER' && npc.id === 'NPC_MAYOR') drawMayorNpc(ctx, npc.x, npc.y);
      else if (npc.kind === 'QUEST_GIVER') drawForestKeeperNpc(ctx, npc.x, npc.y);
    });

    if (state?.ui?.npcBubble?.visible && state?.ui?.npcBubble?.id) {
      const npc = npcs.find((n) => n.id === state.ui.npcBubble.id);
      if (npc) drawNpcBubble(ctx, npc, state.ui.npcBubble.text);
    }

    // Draw Entities
    // Y-Sort (罹먮┃?占쏙옙? ???占쎌뿉 ?占쎄굅???占쎌뿉 ?占쎈뒗 寃껋쓣 ?占쎌뿰?占쎈읇占?泥섎━)
    const entities = [];
    if (player && (!Number.isFinite(player.renderX) || !Number.isFinite(player.renderY))) {
      player.renderX = Number.isFinite(player.tx) ? player.tx * TILE_SIZE : 0;
      player.renderY = Number.isFinite(player.ty) ? player.ty * TILE_SIZE : 0;
      warnOnce('player_render_nan', 'player renderX/renderY was invalid and has been repaired');
    }
    if (player) player.isSeated = state.mode === MODES.EXPLORE && !!state?.seat?.isSeated;
    if (player) entities.push(player);
    if (petRef.pet) entities.push(petRef.pet);
    entitiesCount = entities.length;
    
    // y sort with NaN safety
    entities.sort((a, b) => {
      const ay = Number.isFinite(a?.renderY) ? a.renderY : 0;
      const by = Number.isFinite(b?.renderY) ? b.renderY : 0;
      return ay - by;
    });
    entities.forEach(e => e.render(ctx));
    if (state?.lastCatch && state?.lastCatchAt && player) {
      const elapsed = Date.now() - state.lastCatchAt;
      if (elapsed < 1200) {
        const fishDef = UI.getItemMeta ? UI.getItemMeta(state.lastCatch) : null;
        if (fishDef) {
          const iconSize = 24;
          const sx = player.renderX + TILE_SIZE + 6;
          const sy = player.renderY - 18 - Math.floor(elapsed / 90);
          ctx.save();
          ctx.translate(sx, sy);
          drawFishIcon(ctx, fishDef, iconSize);
          ctx.restore();
        }
      }
    }
    if (state.mode === MODES.EXPLORE && state?.seat?.bagFullWarn && player) {
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 16px DotGothic16, sans-serif';
      ctx.fillText('!', player.renderX + TILE_SIZE / 2 - 2, player.renderY - 6);
    }

    ctx.restore();
  } catch (err) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4d4f';
    ctx.font = 'bold 16px DotGothic16, monospace';
    ctx.fillText(`RENDER ERROR: ${err?.message || err}`, 12, 26);
    if (err?.stack) {
      const stackLine = String(err.stack).split('\n')[1] || '';
      ctx.fillText(stackLine.trim(), 12, 46);
    }
    console.error('[draw] render failed', err);
  }

  const hasPlayer = !!player;
  const hasActivePetId = Object.prototype.hasOwnProperty.call(state, 'activePetId');
  const hasMoney = Object.prototype.hasOwnProperty.call(state, 'money');
  const hasTime = Object.prototype.hasOwnProperty.call(state, 'time');
  const hasTimePhaseFn = typeof Time.getPhase === 'function';
  const equippedRodId = state?.equipment?.rodId || state.equippedToolId;
  const equippedToolMeta = UI.getItemMeta ? UI.getItemMeta(equippedRodId) : null;
  const activeBaitId = state?.equipment?.baitId || null;
  const activeBaitCount = activeBaitId && Array.isArray(state.inventory)
    ? state.inventory.filter((id) => id === activeBaitId).length
    : 0;

  const debugInfo = {
    fps: frameStats.fps > 0 ? frameStats.fps.toFixed(1) : 'N/A',
    msPerFrame: frameStats.msPerFrame > 0 ? frameStats.msPerFrame.toFixed(2) : 'N/A',
    mode: state.mode ?? 'N/A',
    playerTile: hasPlayer ? `(${player.tx}, ${player.ty})` : 'N/A',
    playerPixel: hasPlayer ? `(${player.renderX.toFixed(1)}, ${player.renderY.toFixed(1)})` : 'N/A',
    inventoryCount: Array.isArray(state.inventory) ? state.inventory.length : 0,
    ownedPetCount: Array.isArray(state.ownedPetIds) ? state.ownedPetIds.length : 0,
    activePetId: hasActivePetId ? (state.activePetId ?? 'None') : 'N/A',
    money: (typeof state.money === 'number') ? state.money : 0,
    timePhase: (hasTime && hasTimePhaseFn) ? `${Time.getClockStr(state)} / ${Time.getPhase(state)}` : 'N/A',
    mapId: WORLD_MAP.id || WORLD_MAP.name || 'N/A',
    inventoryPressed: inputFrame.inventoryPressed ? 'YES' : 'NO',
    lastCatch: state.lastCatch || 'N/A',
    equippedTool: equippedRodId || 'N/A',
    equippedRod: equippedToolMeta ? `${UI.getItemName ? UI.getItemName(equippedToolMeta) : equippedToolMeta.name} (T${equippedToolMeta.tier || 1})` : 'N/A',
    activeBait: activeBaitId ? `${UI.getItemName ? UI.getItemName(activeBaitId) : activeBaitId} (${activeBaitCount})` : 'N/A',
    lastCatchDebug: state.debug?.lastCatch
      ? `${state.debug.lastCatch.finalFishId || state.debug.lastCatch.fishId} [${state.debug.lastCatch.finalRarity || state.debug.lastCatch.rarity || 'C'}] ${state.debug.lastCatch.weightG || '-'}g ${state.debug.lastCatch.price || '-'}G T${state.debug.lastCatch.tier} pet:${state.debug.lastCatch.petId || 'N/A'} bait:${state.debug.lastCatch.baitId || 'N/A'}(T${state.debug.lastCatch.baitTier || 0})`
      : 'N/A',
    catchWeights: state.debug?.lastCatch
      ? `before:${JSON.stringify(state.debug.lastCatch.rarityWeightsBefore || {})} afterBait:${JSON.stringify(state.debug.lastCatch.rarityWeightsAfterBait || {})}`
      : 'N/A',
    fishingReason: state.debug?.lastFishingReason || 'N/A',
    fishingTile: state.debug?.lastFishingTile || 'N/A',
    isFishing: state.isFishing ? 'YES' : 'NO',
    fishingStartGate: state.debug?.fishingStartGate || 'N/A',
    frontTile: state.debug?.frontTile ? `${state.debug.frontTile.x},${state.debug.frontTile.y}:${state.debug.frontTile.ch ?? 'OUT'}` : 'N/A',
    frontIsWater: state.debug?.frontIsWater ? 'true' : 'false',
    nearWater: state.debug?.nearWater ? 'true' : 'false',
    tilesDrawn,
    entitiesCount
  };

  UI.updateHUD(state, debugInfo);
  if (isDebugOverlayOn() || state?.debug?.enabled) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 14px DotGothic16, monospace';
    const tileLayerLen = Array.isArray(WORLD_MAP?.tileLayer) ? WORLD_MAP.tileLayer.length : 0;
    const dx = Math.max(8, canvas.width - 360);
    ctx.fillText(`MODE=${state.mode}`, dx, 18);
    ctx.fillText(`hasPlayer=${hasPlayer}`, dx, 34);
    ctx.fillText(`tileLayer=${tileLayerLen}`, dx, 50);
    ctx.fillText(`camera=(${Math.floor(camera.x)},${Math.floor(camera.y)},${Math.floor(camera.width)},${Math.floor(camera.height)})`, dx, 66);
    ctx.fillText(`tilesDrawn=${tilesDrawn} entities=${entitiesCount}`, dx, 82);
    if (tilesDrawn === 0) {
      ctx.fillStyle = '#ff4d4f';
      ctx.fillText('WARNING: tilesDrawn=0 (camera/mode/map broken)', dx, 98);
    }
  }

  if (isDebugOverlayOn()) {
    debugSanity();
  }
}

window.Game = { state, player };

init();


