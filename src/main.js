import { CANVAS_W, CANVAS_H, TILE_SIZE, MODES, COLORS } from './core/constants.js?v=20260221_1559';
import { createInitialState } from './core/state.js?v=20260221_1559';
import { Input } from './core/input.js?v=20260221_1559';
import { Time } from './core/time.js?v=20260221_1559';
import DataManager from './dataManager.js?v=20260221_1559';
import { UI } from './core/ui.js?v=20260221_1559';
import { t } from './core/i18n.js?v=20260221_1559';
import { WORLD_MAP, getTileType } from './world/map.js?v=20260221_1559';
import { Player, drawFishIcon, drawTrapIcon } from './world/entities.js?v=20260221_1559';
import { MovementSystem, InteractionSystem, PetSystem, ActionSystem, TrapSystem, QuestSystem, FarmingSystem } from './world/systems.js?v=20260221_1559';
import { QUESTS_BY_ID } from './data/quests.js?v=20260221_1559';
import { ITEMS } from './data/items.js?v=20260221_1559';
import { migrateInventory, invHas, invCount, invAdd, invRemove, invFind } from './core/inventoryHelper.js';

// Setup Canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Game Globals
let state = createInitialState();
const input = new Input();
const dataManager = new DataManager();
window.MAILBOX_POS = { tx: 24, ty: 14 }; // 촌장(22, 14) 우측 빈 공간

window.openMailboxUI = async function (state) {
  state.mode = 'MENU';
  let container = document.getElementById('mailbox-ui');

  if (!container) {
    container = document.createElement('div');
    container.id = 'mailbox-ui';
    // 전체 컨테이너를 세로 정렬(column)로 변경하여 헤더와 바디 분리
    container.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:640px; height:480px; background:#2c3e50; border:4px solid #f1c40f; color:#ecf0f1; display:flex; flex-direction:column; font-family:"DotGothic16", sans-serif; z-index:9999; box-shadow: 0 0 20px rgba(0,0,0,0.8); border-radius: 8px;';

    // 상단 헤더 (제목 및 닫기 버튼 영역)
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 20px; background:#1a252f; border-bottom:2px solid #34495e;';
    header.innerHTML = '<h2 style="margin:0; color:#f1c40f; font-size:20px;">📮 마을 공용 우편함</h2>';

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '닫기 X';
    closeBtn.style.cssText = 'background:#e74c3c; color:white; border:none; padding:8px 16px; cursor:pointer; font-weight:bold; border-radius:4px; font-family:"DotGothic16";';
    closeBtn.onclick = () => window.closeMailboxUI();
    header.appendChild(closeBtn);
    container.appendChild(header);

    // 메인 바디 (좌우 패널)
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; flex:1; flex-direction:row; padding:10px; gap:10px; overflow:hidden;';

    // 좌측: 서버 보관함
    const leftPanel = document.createElement('div');
    leftPanel.style.cssText = 'flex:1; display:flex; flex-direction:column; background:#1a252f; border-radius:4px; padding:10px;';
    leftPanel.innerHTML = '<h3 style="margin-top:0; color:#3498db; text-align:center;">서버 보관함<br><small style="color:#7f8c8d; font-size:12px;">(누구나 가져갈 수 있습니다)</small></h3>';
    const serverList = document.createElement('div');
    serverList.id = 'mb-server-list';
    serverList.style.cssText = 'flex:1; overflow-y:auto; padding-right:5px;';
    leftPanel.appendChild(serverList);

    // 우측: 내 인벤토리
    const rightPanel = document.createElement('div');
    rightPanel.style.cssText = 'flex:1; display:flex; flex-direction:column; background:#1a252f; border-radius:4px; padding:10px;';
    rightPanel.innerHTML = '<h3 style="margin-top:0; color:#2ecc71; text-align:center;">내 가방<br><small style="color:#7f8c8d; font-size:12px;">(클릭하여 우편함에 넣기)</small></h3>';
    const localList = document.createElement('div');
    localList.id = 'mb-local-list';
    localList.style.cssText = 'flex:1; overflow-y:auto; padding-right:5px;';
    rightPanel.appendChild(localList);

    body.appendChild(leftPanel);
    body.appendChild(rightPanel);
    container.appendChild(body);

    document.body.appendChild(container);
  }

  container.style.display = 'flex';

  const render = async () => {
    if (!window._dataManager) return;
    const serverItemsObj = await window._dataManager.fetchMailbox();
    const serverList = document.getElementById('mb-server-list');
    if (serverList) serverList.innerHTML = '';

    if (Object.keys(serverItemsObj).length === 0 && serverList) {
      serverList.innerHTML = '<p style="color:#95a5a6; text-align:center; margin-top:50%;">우편함이 비어있습니다.</p>';
    }

    Object.entries(serverItemsObj).forEach(([key, item]) => {
      const meta = window.getItem ? window.getItem(item.itemId) : null;
      const btn = document.createElement('button');
      btn.innerHTML = `◀ 가져오기: ${meta?.name || item.itemId}`;
      btn.style.cssText = 'display:block; width:100%; margin-bottom:8px; padding:10px; background:#2980b9; color:white; border:none; cursor:pointer; text-align:left; border-radius:4px; font-family:"DotGothic16"; transition: background 0.2s;';
      btn.onmouseover = () => btn.style.background = '#3498db';
      btn.onmouseout = () => btn.style.background = '#2980b9';
      btn.onclick = async () => {
        await window._dataManager.clearMailboxItem(key);
        if (typeof invAdd === 'function') invAdd(state.inventory, item.itemId, 1);
        state.uiDirty = true; // 인벤토리 변경 알림
        if (window._dataManager.saveUserData) window._dataManager.saveUserData(state); // 즉시 저장
        render();
      };
      if (serverList) serverList.appendChild(btn);
    });

    const localList = document.getElementById('mb-local-list');
    if (localList) localList.innerHTML = '';
    const inv = Array.isArray(state.inventory) ? state.inventory : [];
    if (inv.length === 0 && localList) {
      localList.innerHTML = '<p style="color:#95a5a6; text-align:center; margin-top:50%;">가방이 비어있습니다.</p>';
    }

    inv.forEach((invItem) => {
      if (!invItem || !invItem.itemId) return;
      const meta = window.getItem ? window.getItem(invItem.itemId) : null;
      const btn = document.createElement('button');
      btn.innerHTML = `넣기 ▶ : ${meta?.name || invItem.itemId} (보유: ${invItem.count || 1})`;
      btn.style.cssText = 'display:block; width:100%; margin-bottom:8px; padding:10px; background:#27ae60; color:white; border:none; cursor:pointer; text-align:left; border-radius:4px; font-family:"DotGothic16"; transition: background 0.2s;';
      btn.onmouseover = () => btn.style.background = '#2ecc71';
      btn.onmouseout = () => btn.style.background = '#27ae60';
      btn.onclick = async () => {
        if (typeof invRemove === 'function') invRemove(state.inventory, invItem.itemId, 1);
        await window._dataManager.pushToMailbox({ itemId: invItem.itemId });
        state.uiDirty = true; // 인벤토리 변경 알림
        if (window._dataManager.saveUserData) window._dataManager.saveUserData(state); // 즉시 저장
        render();
      };
      if (localList) localList.appendChild(btn);
    });
  };
  render();
};

window.closeMailboxUI = function () {
  const container = document.getElementById('mailbox-ui');
  if (container) container.style.display = 'none';
  if (window.Game && window.Game.state) window.Game.state.mode = 'EXPLORE';
};
window._dataManager = dataManager; // InteractionSystem 밀치기용 전역 접근
let player = null;
let petRef = { pet: null };

function syncState(newState) {
  const safeState = Object.assign(createInitialState(), newState);
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, safeState);
}

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
  if (!state.playerPos || typeof state.playerPos !== 'object') {
    state.playerPos = { tx: 22, ty: 16, facing: 'down', mapId: 'town' };
    if (UI && UI.addSystemMessage) UI.addSystemMessage('데이터 무결성 오류로 위치 정보가 초기화되었습니다.', '#e67e22');
  }
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
  state.inventory = migrateInventory(state.inventory);
  if (!invHas(state.inventory, 'starter_bag')) invAdd(state.inventory, 'starter_bag');
  if (!state.equipment || typeof state.equipment !== 'object') {
    state.equipment = {
      rodId: state.equippedToolId || (invHas(state.inventory, 'fishing_rod') ? 'fishing_rod' : null),
      bagId: 'starter_bag',
      baitId: null,
      chairId: null,
      trapId: null,
      activeToolId: state.equippedToolId || 'fishing_rod',
      activeSubItemId: null
    };
  }
  if (!state.equipment.activeToolId) state.equipment.activeToolId = state.equipment.rodId || state.equippedToolId || 'fishing_rod';
  if (!Object.prototype.hasOwnProperty.call(state.equipment, 'activeSubItemId')) state.equipment.activeSubItemId = null;
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
  if (state.equipment.baitId && !invHas(state.inventory, state.equipment.baitId)) state.equipment.baitId = null;
  if (state.equipment.chairId && !invHas(state.inventory, state.equipment.chairId)) state.equipment.chairId = null;
  if (state.equipment.trapId && !invHas(state.inventory, state.equipment.trapId)) state.equipment.trapId = null;
  if (!Array.isArray(state.traps)) state.traps = [];
  if (!Array.isArray(state.trapInventory)) state.trapInventory = [];
  if (!state.farm || typeof state.farm !== 'object') state.farm = {};
  if (!state.equipment.activeToolId) state.equipment.activeToolId = state.equipment.rodId || 'fishing_rod';
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

    const targetX = target.renderX - this.width / 2 + TILE_SIZE / 2;
    const targetY = target.renderY - this.height / 2 + TILE_SIZE / 2;

    this.x += (targetX - this.x) * 0.15;
    this.y += (targetY - this.y) * 0.15;

    if (!state.inInstance && !(state.playerPos && state.playerPos.inInstance)) {
      this.x = Math.max(0, Math.min(this.x, mapWidth * 32 - this.width));
      this.y = Math.max(0, Math.min(this.y, mapHeight * 32 - this.height));
    }
  }
};

// Init
async function init() {
  // Expose getItem so it can be safely called or debugged from window scope if needed
  window.getItem = (await import('./data/items.js')).getItem;

  // [FIX] Register Admin Key properly in Input system
  input.bindKey('k', 'ADMIN_DEMOLISH');

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
    onSellInventoryItem: (itemId, count = 1) => sellInventoryItem(itemId, count),
    onInventoryChanged: async () => {
      try {
        await dataManager.saveUserData(state);
      } catch (e) {
        if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
        UI.renderShop(state);
      }
    },
    onCloseUI: () => {
      handleCancelAction();
    }
  });

  // [NEW] Global GameController for UI signaling
  window.GameController = {
    changeMode: (newMode) => {
      state.mode = newMode;
    },
    processCloseUI: () => {
      handleCancelAction();
    },
    completeQuest: (questId) => {
      if (QuestSystem.completeQuest(state, questId)) {
        UI.addSystemMessage('퀘스트 보상을 획득했습니다!', '#2ecc71');
        dataManager.saveUserData(state).catch(e => console.error("Quest turn-in save failed", e));
        if (UI.renderQuestLog) UI.renderQuestLog(state);
        if (UI.updateQuestTracker) UI.updateQuestTracker(state);
      }
    }
  };

  // [M5] 하우징 아이템 설치 콜백 브릿지
  window.onInstallItem = (itemId) => {
    // [FIX] ITEMS 직접 참조 대신 getItem 함수 사용
    const item = typeof getItem === 'function' ? getItem(itemId) : (UI && UI.getItemMeta ? UI.getItemMeta(itemId) : true);
    if (!item) return;

    // 인벤토리 창 닫기
    if (UI && UI.toggleInventory) UI.toggleInventory(false, state);
    if (state.ui) state.ui.inventoryOpen = false;

    // [상태 초기화] 모드 전환 및 타겟 설정
    state.mode = 'BUILD';
    state.buildTarget = itemId;

    // 시스템 메시지 출력
    if (typeof addSystemMsg === 'function') {
      addSystemMsg('[건축 모드] 방향키로 위치를 잡고 Space로 설치하세요. (취소: ESC)', '#f1c40f');
    } else if (UI && UI.addSystemMessage) {
      UI.addSystemMessage('[건축 모드] 방향키로 위치를 잡고 Space로 설치하세요. (취소: ESC)', '#f1c40f');
    }
  };

  const remoteData = await dataManager.loadData();
  const hasSave = !!remoteData && Object.keys(remoteData).length > 0;

  dataManager.startMultiplayerSync((msg) => {
    UI.showDialog(msg);
    setTimeout(() => UI.hideDialog(), 1500);
  });

  // [Phase 5] Push Mechanics Network Sync
  dataManager.startPushListener((ev) => {
    if (player && typeof player.applyPush === 'function') {
      player.applyPush(ev.dir);
      state.playerPos.tx = player.tx;
      state.playerPos.ty = player.ty;
      // 강제로 즉시 롤백 불가능한 위치를 서버에 덮어씀 (고무줄 현상 방지)
      if (typeof dataManager._sendPosition === 'function') {
        // [FIX] Use TILE_SIZE pixels instead of tile coordinates to prevent teleporting to the edge of the map
        dataManager._sendPosition(player.tx * TILE_SIZE, player.ty * TILE_SIZE, state.playerPos.mapId, player.facing, state.activePetId, state.isFishing, state.seat?.isSeated, 0, 0, !!state.inInstance, state.instanceBase || 1000, state.instanceOwner || dataManager.userId);
      }
      if (typeof addSystemMsg === 'function') addSystemMsg('누군가에게 떠밀렸습니다!', '#f39c12');
    }
  });

  UI.setStartScreen(true, hasSave);
  requestAnimationFrame(loop);
}

async function startNewGame() {
  const initialState = createInitialState();
  syncState(initialState);
  ensureFishBagState();
  if (!Array.isArray(state.inventory)) state.inventory = [];
  if (!invHas(state.inventory, 'fishing_rod')) invAdd(state.inventory, 'fishing_rod');
  if (!state.equippedToolId && invHas(state.inventory, 'fishing_rod')) state.equippedToolId = 'fishing_rod';
  if (!state.equippedItem) state.equippedItem = 'fishing_rod';

  try {
    await dataManager.resetUserData(state);
  } catch (e) {
    console.error("Failed to reset user data on server", e);
  }

  startGame();
}

async function loadGame() {
  const loaded = await dataManager.loadData();
  if (loaded) {
    syncState(loaded);
    // 평면 배열 세이브 → 스택형 자동 마이그레이션
    if (Array.isArray(state.inventory)) {
      state.inventory = migrateInventory(state.inventory);
    }
    ensureFishBagState();
    if (!Array.isArray(state.inventory)) state.inventory = [];
    if (!state.equippedToolId && invHas(state.inventory, 'fishing_rod')) state.equippedToolId = 'fishing_rod';
    startGame();
  } else {
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

async function sellItem(itemRef) {
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

  try {
    await dataManager.saveUserData(state);
    UI.showDialog(t('msg.shop.sold', { name: UI.getItemName ? UI.getItemName(item) : (item?.name || itemId), price }));
  } catch (e) {
    if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
    UI.showDialog("판매 중 오류가 발생했습니다. (Rollback)");
  }

  setTimeout(() => UI.hideDialog(), 700);
  UI.renderShop(state);
}

function sellTenFish() {
  ensureFishBagState();
  const bag = getEquippedBagContainer();
  let count = 0;
  let total = 0;

  const extractFishes = (arr) => {
    while (arr.length > 0 && count < 10) {
      const entry = arr.pop();
      const rec = toFishRecord(entry);
      const item = UI.getItemMeta ? UI.getItemMeta(rec?.itemId) : null;
      total += UI.getComputedSellPrice ? UI.getComputedSellPrice(item, rec) : (item?.sellPrice || item?.price || 0);
      count++;
    }
  };

  // 가방 먼저 순회, 그 다음 통발 순회
  if (Array.isArray(bag?.fishes)) extractFishes(bag.fishes);
  if (count < 10 && Array.isArray(state.trapInventory)) {
    state.trapInventory.forEach(trap => {
      if (Array.isArray(trap.fishes)) extractFishes(trap.fishes);
    });
  }

  if (count < 10) {
    UI.addSystemMessage('물고기가 10마리 이상 필요합니다. (가방+통발)', '#e74c3c');
    return;
  }

  const bonus = Math.floor(total * 0.1);
  state.money += (total + bonus);
  emitQuestEvent('SELL_FISH', { count: 10, totalPrice: total + bonus });
  dataManager.saveUserData(state).catch(e => {
    if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
    console.error('Sell save failed', e);
  });

  UI.addSystemMessage(`10마리 판매 +${total + bonus}G (보너스 ${bonus}G)`, '#2ecc71');
  UI.renderShop(state);
}

async function sellTrapContents(trapRef) {
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

  try {
    await dataManager.saveUserData(state);
    UI.showDialog(`통발 어획 정산 +${total}G`);
  } catch (e) {
    if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
    UI.showDialog("정산 중 오류가 발생했습니다. (Rollback)");
  }

  setTimeout(() => UI.hideDialog(), 800);
  UI.renderShop(state);
}

async function buyItem(itemId, count = 1) {
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
  if (isUniqueEquip && invHas(state.inventory, itemId)) {
    UI.showDialog('이미 보유한 장비입니다.');
    setTimeout(() => UI.hideDialog(), 700);
    return;
  }

  if (item.equipSlot === 'BAG') {
    ensureFishBagState();
    if (state.bags[itemId]) {
      UI.showDialog('?대? 蹂댁쑀??媛€諛⑹엯?덈떎.');
      setTimeout(() => UI.hideDialog(), 700);
      return;
    }
    state.money -= unitPrice;
    if (!invHas(state.inventory, itemId)) invAdd(state.inventory, itemId);
    state.bags[itemId] = {
      capacity: item.bagCapacity || item.capacity || 10,
      fishes: []
    };
    emitQuestEvent('BUY_ITEM', { itemId, kind: item.equipSlot || item.kind, buyKinds: [item.equipSlot || item.kind], item, price: unitPrice, count: 1 });

    try {
      await dataManager.saveUserData(state);
      UI.showDialog(`${UI.getItemName ? UI.getItemName(item) : item.name} x1 구매 완료 (-${unitPrice}G)`);
    } catch (e) {
      if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
      UI.showDialog("구매 중 오류가 발생했습니다. (Rollback)");
    }

    setTimeout(() => UI.hideDialog(), 700);
    UI.renderShop(state);
    return;
  }

  state.money -= totalPrice;
  invAdd(state.inventory, itemId, buyCount);
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
  emitQuestEvent('BUY_ITEM', { itemId, kind: item.equipSlot || item.kind, buyKinds: [item.equipSlot || item.kind], item, price: totalPrice, count: buyCount });

  if (item.equipSlot === 'BAIT') {
    // 미끼 자동 장착 브릿지: 장착된 미끼가 없으면 방금 산 미끼 자동 장착
    if (!state.equipment.baitId) {
      state.equipment.baitId = itemId;
      UI.addSystemMessage(`[${UI.getItemName ? UI.getItemName(item) : item.name}] 자동 장착되었습니다.`, '#2ecc71');
      state.uiDirty = true;
    }
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

  try {
    await dataManager.saveUserData(state);
    UI.showDialog(`${UI.getItemName ? UI.getItemName(item) : item.name} x${buyCount} 구매 완료 (-${totalPrice}G)`);
  } catch (e) {
    if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
    UI.showDialog("구매 중 오류가 발생했습니다. (Rollback)");
  }

  setTimeout(() => UI.hideDialog(), 700);
  UI.renderShop(state);
}

// [Phase 4] 인벤토리 수확물 판매 (농시장 SELL_FARM 전용)
async function sellInventoryItem(itemId, count = 1) {
  const item = UI.getItemMeta ? UI.getItemMeta(itemId) : null;
  if (!item || !item.sellPrice) {
    UI.showDialog('판매할 수 없는 아이템입니다.');
    setTimeout(() => UI.hideDialog(), 700);
    return;
  }
  const actualRemoved = invRemove(state.inventory, itemId, count);
  if (actualRemoved > 0) {
    const earn = item.sellPrice * actualRemoved;
    state.money += earn;
    try {
      await dataManager.saveUserData(state);
      UI.showDialog(`${item.name} x${actualRemoved} 판매 (+${earn}G)`);
    } catch (e) {
      UI.showDialog('판매 중 오류가 발생했습니다.');
    }
    setTimeout(() => UI.hideDialog(), 700);
    UI.renderShop(state);
  }
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

  // [UI Closed / Game Started] Focus Steal Defense
  const cvs = document.getElementById('game');
  if (cvs) {
    cvs.setAttribute('tabindex', '0');
    cvs.focus();
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

  // [데이터 렌더링 동기화] state의 수면 상태를 실제 Player 객체에 직접 주입
  if (player) {
    player.isSleeping = !!state.isSleeping;
    player.bedStyle = state.bedStyle; // [추가된 브릿지]
  }
  // [Phase 4-3] 수면 중일 땐 타이머 갱신 및 입력 차단
  if (state.isSleeping) {
    if (typeof state.sleepProgress === 'number') {
      // 10초간 0 -> 100 (dt는 밀리초 단위라면 dt * 0.01)
      // 현재 프레임워크에서 dt는 초 단위(s)이므로 dt * 10
      state.sleepProgress += dt * 10;

      if (state.sleepProgress >= 100) {
        state.isSleeping = false;
        state.sleepProgress = 0;
        state.stamina = state.maxStamina || 100;
        state.mode = MODES.EXPLORE; // [Phase 4-3] 수면 종료 시 탐험 모드로 복구
        state.uiDirty = true;

        if (typeof window !== 'undefined' && window.player) window.player.isSleeping = false;

        if (typeof UI !== 'undefined' && UI.addSystemMessage) {
          UI.addSystemMessage('충분한 휴식을 취했습니다. 체력이 회복되었습니다!', '#3498db');
        }

        if (typeof QuestSystem !== 'undefined') QuestSystem.emitQuestEvent(state, 'SLEEP');
        if (typeof dataManager !== 'undefined' && dataManager.saveUserData) dataManager.saveUserData(state).catch(e => console.error(e));
      }
    } else {
      state.sleepProgress = 0;
    }

    if (typeof input !== 'undefined' && input.update) {
      input.consumeAction('INTERACT');
    }
  }

  // [New] H Key 하우징 최우선 설치 로직 (야외/실내) 및 디버깅 로그
  if (input.wasActionPressed('INSTALL_HOUSE')) {
    input.consumeAction('INSTALL_HOUSE'); // 중복 처리를 막기 위해 입력 즉시 소모

    // [NEW] 1. 가구 회수 시도 (발밑 또는 눈앞의 내 가구 확인)
    const pTx = state.playerPos.tx;
    const pTy = state.playerPos.ty;
    const pFacing = state.playerPos.facing || 'down';
    const fTx = pTx + (pFacing === 'left' ? -1 : pFacing === 'right' ? 1 : 0);
    const fTy = pTy + (pFacing === 'up' ? -1 : pFacing === 'down' ? 1 : 0);

    const houseIdx = (state.houses || []).findIndex(h => (h.tx === pTx && h.ty === pTy) || (h.tx === fTx && h.ty === fTy));
    if (houseIdx >= 0) {
      const removed = state.houses.splice(houseIdx, 1)[0];
      if (!Array.isArray(state.inventory)) state.inventory = [];

      if (typeof invAdd === 'function') {
        invAdd(state.inventory, removed.id, 1);
      } else {
        const exist = state.inventory.find(i => i.itemId === removed.id);
        if (exist) exist.count++;
        else state.inventory.push({ itemId: removed.id, count: 1 });
      }

      if (typeof addSystemMsg === 'function') addSystemMsg('가구를 성공적으로 회수했습니다.', '#3498db');
      else if (UI && UI.addSystemMessage) UI.addSystemMessage('가구를 성공적으로 회수했습니다.', '#3498db');

      if (typeof dataManager !== 'undefined' && dataManager.saveUserData) {
        dataManager.saveUserData(state).catch(e => console.error(e));
      }
      return; // 회수 성공 시 기존 설치 로직을 건너뛰고 즉시 종료
    }

    if (state.mode !== MODES.EXPLORE) {
      console.log("[INSTALL_HOUSE] 실패: 탐험(EXPLORE) 모드가 아닙니다. (현재 모드:", state.mode, ")");
    } else if (!state.equipment || !state.equipment.activeToolId) {
      console.log("[INSTALL_HOUSE] 실패: 장착된 속성(activeToolId)이 없습니다.", state.equipment);
      if (typeof addSystemMsg === 'function') addSystemMsg('설치할 텐트나 침대를 먼저 장착해주세요.', '#e74c3c');
    } else {
      const toolId = state.equipment.activeToolId;
      const itemMeta = ITEMS[toolId];

      if (!itemMeta || itemMeta.type !== 'INSTALL') {
        console.log("[INSTALL_HOUSE] 실패: 장착된 아이템의 메타데이터가 없거나 INSTALL 타입이 아닙니다.", { toolId, itemMeta });
        if (typeof addSystemMsg === 'function') addSystemMsg('현재 장착된 아이템은 설치할 수 없습니다.', '#e74c3c');
      } else {
        const bTx = state.playerPos.tx;
        const bTy = state.playerPos.ty;
        let bIsGround = false;

        if (state.inInstance) {
          const iBase = state.instanceBase || 1000;
          bIsGround = (bTx >= iBase && bTx <= iBase + 4 && bTy >= iBase && bTy <= iBase + 4) && !(bTx === iBase + 2 && bTy === iBase + 4);
        } else {
          const bTileType = typeof getTileType === 'function' ? getTileType(bTx, bTy) : 0;
          bIsGround = bTileType === 0 || bTileType === 8;
        }

        const bIsOccupied = (state.houses || []).some(h => h.tx === bTx && h.ty === bTy);
        let canBuild = bIsGround && !bIsOccupied;

        // [Phase 5-0] 알박기 방지 (No-Build Zone) 공간 검증 로직
        if (canBuild && typeof WORLD_MAP !== 'undefined' && Array.isArray(WORLD_MAP.npcs)) {
          const tooCloseNpc = WORLD_MAP.npcs.find(npc =>
            (Math.abs(bTx - npc.x) + Math.abs(bTy - npc.y)) <= 3
          );
          if (tooCloseNpc) {
            canBuild = false;
            console.log("[INSTALL_HOUSE] 실패: 주요 시설(NPC, 상점 등) 근처에는 건물을 설치할 수 없습니다.", { npc: tooCloseNpc });
            if (typeof addSystemMsg === 'function') addSystemMsg('중요 시설 근처에는 건물을 설치할 수 없습니다.', '#e74c3c');
            else if (UI && UI.addSystemMessage) UI.addSystemMessage('중요 시설 근처에는 건물을 설치할 수 없습니다.', '#e74c3c');
            return;
          }
        }

        if (canBuild) {
          if (!state.houses) state.houses = [];
          state.houses.push({ id: toolId, tx: bTx, ty: bTy });

          if (typeof invRemove === 'function') {
            invRemove(state.inventory, toolId, 1);
          } else {
            const idx = state.inventory.findIndex(i => i.itemId === toolId);
            if (idx >= 0) {
              state.inventory[idx].count -= 1;
              if (state.inventory[idx].count <= 0) {
                state.inventory.splice(idx, 1);
                state.equipment.activeToolId = null; // 인벤 잔여 0소진시 자동 장착 해제
              }
            }
          }

          if (toolId === 'bed_camp' && typeof QuestSystem !== 'undefined') {
            QuestSystem.emitQuestEvent(state, 'INSTALL_BED', { itemId: 'bed_camp' });
          }

          if (typeof dataManager !== 'undefined' && dataManager.saveUserData) {
            dataManager.saveUserData(state).catch(e => console.error(e));
          }

          console.log("[INSTALL_HOUSE] 성공: 건물을 설치했습니다.", { id: toolId, x: bTx, y: bTy });
          if (typeof addSystemMsg === 'function') addSystemMsg('성공적으로 설치되었습니다!', '#2ecc71');
          else if (UI && UI.addSystemMessage) UI.addSystemMessage('성공적으로 설치되었습니다!', '#2ecc71');
        } else {
          console.log("[INSTALL_HOUSE] 실패: 타일 부적합 또는 이미 건물이 존재함.", { x: bTx, y: bTy, bIsGround, bIsOccupied, inInstance: state.inInstance });
          if (typeof addSystemMsg === 'function') addSystemMsg('이곳에는 설치할 수 없습니다.', '#e74c3c');
          else if (UI && UI.addSystemMessage) UI.addSystemMessage('이곳에는 설치할 수 없습니다.', '#e74c3c');
        }
      }
    }
  }
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

  try {
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
      case MODES.HOUSING_EDIT:
        updateHousingEdit(dt);
        break;
    }
  } catch (err) {
    console.error("[UPDATE ERROR] Game loop rescued:", err);
    state.mode = MODES.EXPLORE; // Emergency fallback
  }

  // Ensure absolutely essential loops run regardless of UI Mode guard exits
  if (state.mode !== MODES.START) {
    Time.sync(state);
    const safeDt = Math.min(dt, 0.1);
    if (player) player.update(safeDt);
    if (player && typeof WORLD_MAP !== 'undefined') {
      camera.update(player, WORLD_MAP.width, WORLD_MAP.height);
    }
  }

  if (state?.quests?._dirty) {
    state.quests._dirty = false;
    dataManager.saveUserData(state).catch(e => {
      if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
      console.error("Quest sync failed", e);
    });
  }

  // M6: Dirty Flag - 물고기 인벤토리 실시간 동기화
  if (state.uiDirty) {
    state.uiDirty = false;
    if ((state.ui?.inventoryOpen || state.ui?.fishBagOpen) && UI.renderInventory) {
      UI.renderInventory(state);
    }
  }

  input.update();
}

function handleCancelAction() {
  // 1. 모든 Transient UI 패널 강제 종료 및 모드 초기화 (I, Q 키 등 관통 방어)
  if (state.ui?.inventoryOpen || state.ui?.questLogOpen || state.ui?.fishBagOpen || state.ui?.trapViewOpen) {
    state.ui.inventoryOpen = false;
    state.ui.questLogOpen = false;
    state.ui.fishBagOpen = false;
    state.ui.trapViewOpen = false;

    if (UI.toggleInventory) UI.toggleInventory(false, state);
    if (UI.toggleQuestLog) UI.toggleQuestLog(false, state);

    // 메뉴 모드에 갇혀 이동이 불가능해지는 버그(State Lock) 완벽 해제
    if (state.mode === MODES.MENU) {
      state.mode = MODES.EXPLORE;
    }
    return true;
  }

  // 2. 다이얼로그(대화창) 닫기
  const dialogEl = document.getElementById('dialog-box');
  const dialogOpen = state.mode === MODES.DIALOG || (!!dialogEl && !dialogEl.classList.contains('hidden'));
  if (dialogOpen) {
    UI.hideDialog();
    if (state.mode === MODES.DIALOG) state.mode = MODES.EXPLORE;
    return true;
  }

  // 3. 상점 닫기
  if (state.mode === MODES.SHOP) {
    UI.toggleShop(false, state);
    if (state.shop) state.shop.isOpen = false;
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'ESC');
    state.mode = MODES.EXPLORE;
    return true;
  }

  // 4. 메뉴 닫기
  if (state.mode === MODES.MENU) {
    if (window.closeMailboxUI) window.closeMailboxUI(); // [NEW] 우편함 ESC 닫기 연동
    if (UI.togglePokedex) UI.togglePokedex(false, state);
    if (UI.toggleInventory) UI.toggleInventory(false, state);
    if (UI.toggleQuestLog) UI.toggleQuestLog(false, state);
    if (UI.toggleShop) UI.toggleShop(false, state);
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'ESC');
    state.mode = MODES.EXPLORE;
    return true;
  }

  // 5. 위 UI들이 모두 닫혀있는 상태일 때만 낚시를 취소함
  if (state.isFishing && player && ActionSystem.stopFishing) {
    ActionSystem.stopFishing(state, player, 'ESC');
    return true;
  }

  return false;
}



function updateStart() {
  if (input.wasActionPressed('INTERACT') || input.wasActionPressed('START')) {
    if (dataManager.data && Object.keys(dataManager.data).length > 0) loadGame();
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
    state.interactionLock = Date.now() + 250;
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
  if (!state || !state.playerPos) return; // [FIX] Critical crash guard
  const safeDt = Math.min(dt, 0.1);

  // [New] Debounce double-triggers from exiting dialogs (Space만 해당)
  if (state.interactionLock && Date.now() < state.interactionLock) {
    input.consumeAction('INTERACT');
    input.consumeAction('START');
  }

  // [New] 1순위: UI (퀘스트 알림창 등) 닫기
  if (input.wasActionPressed('START') || input.wasActionPressed('INTERACT')) {
    if (UI.closeTransientViews && UI.closeTransientViews(state)) {
      input.consumeAction('INTERACT');
      input.consumeAction('START');
    }
  }

  // [New] 인벤토리 (I)
  if (input.wasActionPressed('INVENTORY')) {
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
    state.mode = MODES.MENU;
    try {
      UI.toggleInventory(true, state);
    } catch (e) {
      console.error(e);
      state.mode = MODES.EXPLORE;
    }
    emitQuestEvent('OPEN_INVENTORY');
    return;
  }

  if (input.wasActionPressed('QUEST_LOG')) {
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
    state.mode = MODES.MENU;
    try {
      UI.toggleQuestLog(true, state, false); // false = View-only mode
    } catch (e) {
      console.error(e);
      state.mode = MODES.EXPLORE;
    }
    emitQuestEvent('OPEN_QUEST_LOG');
    return;
  }

  // [수정] KEYS.TAB -> 'MENU'
  if (input.wasActionPressed('MENU')) {
    if (state?.seat?.isSeated && player && ActionSystem.stopSeating) ActionSystem.stopSeating(state, player, 'MODE_CHANGE');
    state.mode = MODES.MENU;
    try {
      UI.togglePokedex(true, state);
    } catch (e) {
      console.error(e);
      state.mode = MODES.EXPLORE;
    }
    return;
  }

  // 일일 퀘스트 자정 초기화
  if (state.isNewDay) {
    const dailyIds = Object.keys(QUESTS_BY_ID).filter(id => QUESTS_BY_ID[id]?.category === 'DAILY');
    if (state.quests) {
      state.quests.completedQuestIds = (state.quests.completedQuestIds || []).filter(id => !dailyIds.includes(id));
      dailyIds.forEach(id => {
        if (state.quests.stepProgress?.[id]) delete state.quests.stepProgress[id];
      });
    }
    UI.addSystemMessage('[\uc2dc\uc2a4\ud15c] \uc790\uc815\uc774 \uc9c0\ub098 \uc77c\uc77c \ud018\uc2a4\ud2b8\uac00 \ucd08\uae30\ud654\ub418\uc5c8\uc2b5\ub2c8\ub2e4.', '#e74c3c');
    state.isNewDay = false;
  }

  // [Phase 3 Teleport Bridge] state.playerPos와 실제 물리 객체의 강제 동기화 (텔레포트 대비)
  if (player && state.playerPos && (player.tx !== state.playerPos.tx || player.ty !== state.playerPos.ty)) {
    const dist = Math.abs(player.tx - state.playerPos.tx) + Math.abs(player.ty - state.playerPos.ty);
    player.setPosition(state.playerPos.tx, state.playerPos.ty, state.playerPos.facing || player.facing);

    if (dist > 5) {
      player.isMoving = false;
      player.renderX = state.playerPos.tx * 32;
      player.renderY = state.playerPos.ty * 32;
      camera.x = player.renderX - camera.width / 2 + 16;
      camera.y = player.renderY - camera.height / 2 + 16;
    }
  }

  if (!state.isSleeping) {
    ActionSystem.update(state, input, player, WORLD_MAP, (msg) => {
      UI.showDialog(msg);
      setTimeout(() => UI.hideDialog(), 1000);
    }, safeDt, (text, rarity) => {
      UI.addSystemMessage(text, rarity);
    });

    MovementSystem.update(state, input, player, WORLD_MAP);

    InteractionSystem.update(state, input, WORLD_MAP, (msg, npcId) => {
      // [NEW] 촌장일 경우 다이얼로그 대신 퀘스트 보드 오픈
      if (npcId === 'NPC_MAYOR') {
        state.mode = MODES.MENU;
        if (UI.toggleQuestLog) UI.toggleQuestLog(true, state, true); // true = Mayor Mode
      } else {
        UI.showDialog(msg);
        state.mode = MODES.DIALOG;
      }
      dataManager.saveUserData(state).catch(e => {
        if (dataManager.previousState) syncState(dataManager._deepMerge({}, dataManager.previousState));
        console.error("Interaction save failed", e);
      });
    }, safeDt, UI.addSystemMessage.bind(UI));

    PetSystem.update(state, player, petRef, safeDt);
    TrapSystem.update(state, safeDt);
  }

  if (state.mode === MODES.SHOP) {
    try {
      UI.toggleShop(true, state);
    } catch (e) {
      console.error(e);
      state.mode = MODES.EXPLORE;
    }
    return;
  }

  // [Emoji System] 숫자키 1~4로 이모티콘 발동
  const EMOJI_MAP = { 1: '❤️', 2: '😄', 3: '😢', 4: '❗' };
  if (!state._emoji) state._emoji = { id: 0, time: 0 };
  for (let i = 1; i <= 4; i++) {
    if (input.wasActionPressed(`EMOJI_${i}`)) {
      state._emoji.id = i;
      state._emoji.time = Date.now();
      input.consumeAction(`EMOJI_${i}`);
    }
  }
  // 이모티콘 2초 후 자동 만료
  if (state._emoji.id && Date.now() - state._emoji.time > 2000) {
    state._emoji.id = 0;
    state._emoji.time = 0;
  }

  // [Pushed Event Listener] 밀치기 당했을 때 반응
  if (!state._pushListenerInit && dataManager.userId && dataManager.startPushListener) {
    state._pushListenerInit = true;
    dataManager.startPushListener((ev) => {
      if (!ev || !ev.ts || Date.now() - ev.ts > 3000) return;
      if (state._lastPushTs === ev.ts) return;
      state._lastPushTs = ev.ts;
      const dirMap = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
      const d = dirMap[ev.dir];
      if (d && player) {
        const newTx = player.tx + d.dx;
        const newTy = player.ty + d.dy;
        player._slideFrom = { x: player.renderX, y: player.renderY };
        player._slideStart = Date.now();
        player.setPosition(newTx, newTy, player.facing);
        state.playerPos.tx = newTx;
        state.playerPos.ty = newTy;
      }
    });
  }

  // [Phase 3] 농사 성장 엔진 업데이트
  FarmingSystem.update(state, dt);

  // [New] Broadcast state to Firebase
  if (player && dataManager.data) {
    const px = typeof player.renderX === 'number' ? player.renderX : (player.tx * TILE_SIZE);
    const py = typeof player.renderY === 'number' ? player.renderY : (player.ty * TILE_SIZE);

    const currentMapId = (WORLD_MAP && WORLD_MAP.id) ? WORLD_MAP.id : 'town';
    dataManager.updatePosition(
      px,
      py,
      currentMapId,
      player.facing,
      state.activePetId,
      !!state.isFishing, // [에러 해결] 강제 Boolean 변환으로 undefined 차단
      state.seat?.isSeated || false,
      state._emoji.id,
      state._emoji.time,
      !!state.inInstance,
      state.instanceBase || 1000,
      state.instanceOwner || dataManager.userId
    );
  }

  // [Real-time Sync for Bags & Traps] - Observer Pattern
  let currentWatchCount = 0;
  if (state.ui?.trapViewOpen && state.ui?.openTrapIndex != null) {
    currentWatchCount = state.trapInventory?.[state.ui.openTrapIndex]?.fishes?.length || 0;
  } else if (state.ui?.fishBagOpen) {
    const openBagId = state.ui?.openBagId || state?.equipment?.bagId;
    currentWatchCount = state?.bags?.[openBagId]?.fishes?.length || 0;
  } else {
    currentWatchCount = Array.isArray(state.inventory) ? state.inventory.length : 0;
  }

  if (state.ui && state.ui._lastWatchCount !== currentWatchCount) {
    state.ui._lastWatchCount = currentWatchCount;
    if (state.ui.inventoryOpen || state.ui.fishBagOpen || state.ui.trapViewOpen) {
      const gridScroll = document.getElementById('invGridScroll');
      const scrollPos = gridScroll ? gridScroll.scrollTop : 0;
      UI.renderInventory(state);
      const newGridScroll = document.getElementById('invGridScroll');
      if (newGridScroll) newGridScroll.scrollTop = scrollPos;
    }
  }
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
  } else if (type === 13) { // W: 하얀 울타리
    ctx.fillStyle = (COLORS && COLORS.GRASS) ? COLORS.GRASS : '#2ecc71';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(x + 2, y + 10, size - 4, 4);
    ctx.fillRect(x + 2, y + 22, size - 4, 4);
    ctx.fillRect(x + 12, y + 4, 8, size - 4);
    ctx.strokeStyle = '#bdc3c7'; ctx.strokeRect(x + 12, y + 4, 8, size - 4);
  } else if (type === 14) { // I: 농장 팻말
    ctx.fillStyle = (COLORS && COLORS.GRASS) ? COLORS.GRASS : '#2ecc71';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + size / 2, y + size - 4, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8b4513'; ctx.fillRect(x + 14, y + 16, 4, 12);
    ctx.fillStyle = '#d35400'; ctx.fillRect(x + 4, y + 6, 24, 14);
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(x + 14, y + 10, 4, 6);
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

  // 1. 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. 몸체 (인자한 갈색 코트)
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(px + 10, py + 12, 12, 12);

  // 3. 얼굴
  ctx.fillStyle = '#f1c27d';
  ctx.fillRect(px + 10, py + 5, 12, 8);

  // 4. 풍성한 흰 수염 (촌장의 상징)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px + 10, py + 10, 12, 5); // 턱수염
  ctx.fillRect(px + 9, py + 9, 3, 3);    // 왼쪽 구두수염
  ctx.fillRect(px + 20, py + 9, 3, 3);   // 오른쪽 구두수염

  // 5. 검은색 중절모
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 8, py + 4, 16, 2);   // 모자 챙
  ctx.fillRect(px + 11, py + 1, 10, 4);  // 모자 본체

  // 6. 눈
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 12, py + 7, 2, 2);
  ctx.fillRect(px + 18, py + 7, 2, 2);

  // 7. 지팡이 (오른손에 든 지팡이)
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(px + 22, py + 10, 2, 14); // 지팡이 막대
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(px + 21, py + 9, 4, 2);   // 지팡이 손잡이 (금색)
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
  const isFarm = type === 'SELL_FARM' || type === 'BUY_FARM';
  ctx.fillStyle = isFarm ? '#2e7d32' : '#6d4c41';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = isFarm ? '#1b5e20' : '#5d4037';
  ctx.fillRect(rx, ry, rw, bandH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(rx, ry, rw, rh);
  const doorTx = rect.x;
  const doorTy = rect.y + rect.h - 1;
  const dx = doorTx * TILE_SIZE;
  const dy = doorTy * TILE_SIZE;
  ctx.fillStyle = isFarm ? '#a5d6a7' : '#f1c40f';
  ctx.fillRect(dx + 3, dy + 3, TILE_SIZE - 6, TILE_SIZE - 3);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(dx + TILE_SIZE - 8, dy + TILE_SIZE / 2, 2, 2);
  const signX = rx + Math.floor(rw / 2) - 10;
  const signY = ry + 2;
  if (isFarm) drawFarmSign(ctx, signX, signY);
  else if (type === 'BUY') drawTackleSign(ctx, signX, signY);
  else drawFishSign(ctx, signX, signY);
}

function drawFarmSign(ctx, x, y) {
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(x, y, 20, 14);
  ctx.strokeStyle = '#5d4037';
  ctx.strokeRect(x, y, 20, 14);
  // 당근 아이콘
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(x + 8, y + 3, 4, 8);
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(x + 7, y + 1, 6, 3);
}

function drawBullNpc(ctx, tx, ty) {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 뿜 (Ivory)
  ctx.fillStyle = '#F5DEB3';
  ctx.beginPath(); ctx.moveTo(px + 4, py + 6); ctx.lineTo(px, py); ctx.lineTo(px + 8, py + 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px + 28, py + 6); ctx.lineTo(px + 32, py); ctx.lineTo(px + 24, py + 6); ctx.fill();
  // 몫통 + 머리
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(px + 6, py + 10, 20, 16);
  ctx.fillRect(px + 4, py + 4, 24, 12);
  // 입/코 주변
  ctx.fillStyle = '#D2B48C';
  ctx.fillRect(px + 8, py + 10, 16, 6);
  // 눈과 콧구멍
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 10, py + 6, 2, 2);
  ctx.fillRect(px + 20, py + 6, 2, 2);
  ctx.fillRect(px + 12, py + 12, 2, 2);
  ctx.fillRect(px + 18, py + 12, 2, 2);
}

function drawFarmerNpc(ctx, tx, ty) {
  const px = tx * TILE_SIZE;
  const py = ty * TILE_SIZE;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  // 멜빵바지 (파란색) & 체크셔츠 (빨간색)
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(px + 10, py + 12, 12, 12);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(px + 10, py + 6, 12, 6);
  // 얼굴
  ctx.fillStyle = '#f1c27d';
  ctx.fillRect(px + 10, py + 4, 12, 6);
  // 밀짚모자
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(px + 6, py + 2, 20, 4);
  ctx.fillRect(px + 10, py - 2, 12, 4);
  // 눈
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 12, py + 6, 2, 2);
  ctx.fillRect(px + 18, py + 6, 2, 2);
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

function drawSharedMailbox(ctx, tx, ty) {
  const px = tx * 32; // TILE_SIZE is 32
  const py = ty * 32;
  ctx.fillStyle = '#e74c3c'; // 빨간 우편함 색
  ctx.fillRect(px + 10, py + 10, 12, 16); // 우편함 몸체
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(px + 14, py + 26, 4, 6);   // 기둥
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(px + 12, py + 14, 8, 2);   // 입구
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

    const camX = Math.max(0, Math.round(camera.x));
    const camY = Math.max(0, Math.round(camera.y));

    // [FIX] NaN guards to prevent render crashes
    if (!Number.isFinite(camera.x)) camera.x = 0;
    if (!Number.isFinite(camera.y)) camera.y = 0;
    if (player && (!Number.isFinite(player.renderX) || !Number.isFinite(player.renderY))) {
      player.renderX = player.tx * 32;
      player.renderY = player.ty * 32;
    }

    ctx.save();
    ctx.translate(-camX, -camY);

    // [Phase 4-3] 수면 블랙 오버레이 (0.4 opacity)
    if (state.isSleeping) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      // 맵 전체 크기 덮기 (카메라 좌표계)
      ctx.fillRect(camX, camY, canvas.width, canvas.height);
    }

    // [강제 교체] 인스턴스 전용 렌더링 파이프라인
    if (state.inInstance) {
      const rx = (state.instanceBase || 1000) * TILE_SIZE;
      const ry = (state.instanceBase || 1000) * TILE_SIZE;
      ctx.fillStyle = '#000000'; // 주변 완전 암전
      ctx.fillRect(rx - 800, ry - 800, 2600, 2600); // 더 넓은 영역 가림

      ctx.fillStyle = '#5d4037'; // 나무 바닥 (5x5 크기로 확장)
      ctx.fillRect(rx, ry, TILE_SIZE * 5, TILE_SIZE * 5);
      ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 4;
      ctx.strokeRect(rx, ry, TILE_SIZE * 5, TILE_SIZE * 5);

      // 출구 표시 (하단 중앙)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(rx + TILE_SIZE * 2, ry + TILE_SIZE * 4, TILE_SIZE, TILE_SIZE);
    } else {
      const isInst = state.inInstance || (state.playerPos && state.playerPos.inInstance);
      const startCol = Math.max(0, Math.floor(camera.x / 32));
      const endCol = isInst ? startCol + Math.ceil(canvas.width / 32) + 1 : Math.min(WORLD_MAP.width, startCol + Math.ceil(canvas.width / 32) + 1);
      const startRow = Math.max(0, Math.floor(camera.y / 32));
      const endRow = isInst ? startRow + Math.ceil(canvas.height / 32) + 1 : Math.min(WORLD_MAP.height, startRow + Math.ceil(canvas.height / 32) + 1);

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
      if (npc.id === 'NPC_FARMER_SELL') drawBullNpc(ctx, npc.x, npc.y);
      else if (npc.id === 'NPC_FARMER_BUY') drawFarmerNpc(ctx, npc.x, npc.y);
      else if (npc.id === 'NPC_MAYOR') drawMayorNpc(ctx, npc.x, npc.y);
      else if (npc.kind === 'QUEST_GIVER') drawForestKeeperNpc(ctx, npc.x, npc.y);
      else if (npc.kind === 'SHOPKEEPER_SELL') drawSeaElephantNpc(ctx, npc.x, npc.y);
      else if (npc.kind === 'SHOPKEEPER_BUY') drawTackleNpc(ctx, npc.x, npc.y);
    });

    // [FIX] 우편함이 지형에 덮이지 않도록 NPC 레이어 직후에 그림
    if (!state.inInstance && window.MAILBOX_POS) {
      drawSharedMailbox(ctx, window.MAILBOX_POS.tx, window.MAILBOX_POS.ty);
    }

    if (state?.ui?.npcBubble?.visible && state?.ui?.npcBubble?.id) {
      const npc = npcs.find((n) => n.id === state.ui.npcBubble.id);
      if (npc) drawNpcBubble(ctx, npc, state.ui.npcBubble.text);
    }

    // Draw Entities
    // [M2] 글로벌 농장(Farm) 렌더링
    const globalFarm = {
      ...(state.farm || {}),
      ...((window._dataManager && window._dataManager.publicFarm) ? window._dataManager.publicFarm : {})
    };
    if (state.mode === MODES.EXPLORE && globalFarm) {
      for (const key in globalFarm) {
        const crop = globalFarm[key];
        if (!crop || typeof key !== 'string') continue;

        const [fx, fy] = key.split('_').map(Number);
        // [HOTFIX] 구버전 콤마(,) 데이터 유입 시 NaN으로 인한 Canvas 크래시 완벽 차단
        if (!Number.isFinite(fx) || !Number.isFinite(fy)) continue;

        const pxF = fx * TILE_SIZE; const pyF = fy * TILE_SIZE;
        ctx.fillStyle = '#4e342e'; ctx.fillRect(pxF + 1, pyF + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.strokeStyle = '#3e2723'; ctx.strokeRect(pxF + 1, pyF + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        if (crop.waterLevel > 0) {
          ctx.fillStyle = 'rgba(41, 128, 185, 0.25)'; ctx.fillRect(pxF + 1, pyF + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        }
      }
    }

    // Y-Sort (罹먮┃?占쏙옙? ???占쎌뿉 ?占쎄굅???占쎌뿉 ?占쎈뒗 寃껋쓣 ?占쎌뿰?占쎈읇占?泥섎━)
    const entities = [];
    if (player && (!Number.isFinite(player.renderX) || !Number.isFinite(player.renderY))) {
      player.renderX = Number.isFinite(player.tx) ? player.tx * TILE_SIZE : 0;
      player.renderY = Number.isFinite(player.ty) ? player.ty * TILE_SIZE : 0;
      warnOnce('player_render_nan', 'player renderX/renderY was invalid and has been repaired');
    }
    if (player) player.isSeated = state.mode === MODES.EXPLORE && !!state?.seat?.isSeated;

    // [M4] 작물 Y-Sort 렌더링
    if (state.mode === MODES.EXPLORE && globalFarm) {
      for (const key in globalFarm) {
        const crop = globalFarm[key];
        if (!crop || !crop.cropId) continue; // [HOTFIX] Null 방어
        const [fx, fy] = key.split('_').map(Number);
        const pxF = fx * TILE_SIZE; const pyF = fy * TILE_SIZE;

        entities.push({
          renderY: pyF + TILE_SIZE / 2 + 4,
          render: (ctx) => {
            const cx = pxF + TILE_SIZE / 2; const cy = pyF + TILE_SIZE / 2 + 2;
            const stage = crop.stage || 0;
            if (stage === 0) {
              ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
            } else if (stage === 1) {
              ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy - 2);
              ctx.quadraticCurveTo(cx - 4, cy - 4, cx - 4, cy - 1); ctx.quadraticCurveTo(cx - 2, cy - 1, cx, cy - 2);
              ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 4, cy - 1); ctx.quadraticCurveTo(cx + 2, cy - 1, cx, cy - 2); ctx.fill();
            } else if (stage === 2) {
              ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy - 3);
              ctx.ellipse(cx - 3, cy - 3, 4, 2, Math.PI / 4, 0, Math.PI * 2); ctx.ellipse(cx + 3, cy - 3, 4, 2, -Math.PI / 4, 0, Math.PI * 2); ctx.fill();
            } else if (stage === 3) {
              if (crop.cropId === 'crop_greenonion') {
                ctx.fillStyle = '#ecf0f1'; ctx.fillRect(cx - 2, cy - 8, 4, 8);
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.moveTo(cx - 2, cy - 8); ctx.lineTo(cx - 6, cy - 18); ctx.lineTo(cx - 1, cy - 10); ctx.fill();
                ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy - 20); ctx.lineTo(cx + 2, cy - 10); ctx.fill();
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.moveTo(cx + 2, cy - 8); ctx.lineTo(cx + 6, cy - 16); ctx.lineTo(cx + 1, cy - 10); ctx.fill();
              } else if (crop.cropId === 'crop_tomato') {
                // 토마토: 나무 지지대와 크고 붉은 열매 강조 (초록 덤불 제거)
                ctx.fillStyle = '#8d6e63'; // 지지대 막대
                ctx.fillRect(cx - 1, cy - 14, 2, 14);
                ctx.fillStyle = '#2ecc71'; // 하단에 약간의 잎사귀만 배치
                ctx.beginPath(); ctx.ellipse(cx, cy - 3, 5, 2, 0, 0, Math.PI * 2); ctx.fill();

                // 크고 탐스러운 토마토 열매 3개
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath(); ctx.arc(cx - 4, cy - 8, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 4, cy - 4, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(cx + 1, cy - 12, 3, 0, Math.PI * 2); ctx.fill();

                // 열매 광택 효과
                ctx.fillStyle = '#ff7675';
                ctx.fillRect(cx - 5, cy - 9, 1, 1);
                ctx.fillRect(cx + 3, cy - 5, 1, 1);

              } else if (crop.cropId === 'crop_potato') {
                // 감자: 수확기가 되어 흙 위로 드러난 큼직한 감자 알맹이 강조
                ctx.fillStyle = '#5d4037'; // 밑동 흙더미
                ctx.beginPath(); ctx.ellipse(cx, cy, 7, 3, 0, 0, Math.PI * 2); ctx.fill();

                // 큼직한 포슬포슬 감자 (황토색)
                ctx.fillStyle = '#e1b12c';
                ctx.beginPath(); ctx.ellipse(cx - 4, cy - 2, 4.5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx + 3, cy - 1, 5, 3.5, 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(cx, cy - 5, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();

                // 감자 눈(씨눈) 디테일
                ctx.fillStyle = '#c23616';
                ctx.fillRect(cx - 5, cy - 2, 1, 1);
                ctx.fillRect(cx + 4, cy - 1, 1, 1);
                ctx.fillRect(cx, cy - 5, 1, 1);

                // 시든 잎사귀 (초록색 비중 극소화)
                ctx.fillStyle = '#a4b0be';
                ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 2, cy - 10); ctx.lineTo(cx + 2, cy - 9); ctx.fill();
              } else {
                ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 1); ctx.lineTo(cx + 3, cy - 1); ctx.lineTo(cx, cy + 6); ctx.fill();
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.moveTo(cx, cy - 1); ctx.lineTo(cx - 3, cy - 6); ctx.lineTo(cx, cy - 8); ctx.lineTo(cx + 3, cy - 6); ctx.fill();
              }
            }
          }
        });
      }
    }

    if (state.inInstance) {
      // 실내 렌더링 시, 외부 월드의 바닥/오브젝트는 생략하지만 내부 가구들은 Y-Sort 대상에 포함함
      const isVisiting = state.instanceOwner && state.instanceOwner !== dataManager.userId;
      const targetHouses = isVisiting ? (dataManager.publicHouses?.[state.instanceOwner] || []) : (state.houses || []);
      const targetFurniture = isVisiting ? (dataManager.publicFurniture?.[state.instanceOwner] || []) : (state.furniture || []);

      const interiorHouses = Array.isArray(targetHouses) ? targetHouses.filter(h => h.tx >= state.instanceBase && h.tx <= state.instanceBase + 4 && h.ty >= state.instanceBase && h.ty <= state.instanceBase + 4) : [];
      interiorHouses.forEach(h => {
        const px = h.tx * TILE_SIZE;
        const py = h.ty * TILE_SIZE;
        entities.push({
          renderY: py + TILE_SIZE / 2,
          render: (ctx) => {
            if (h.id === 'bed_camp') {
              ctx.fillStyle = '#34495e'; // 야전침대 프레임
              ctx.fillRect(px + TILE_SIZE * 0.2, py + TILE_SIZE * 0.3, TILE_SIZE * 0.6, TILE_SIZE * 0.4);
              ctx.fillStyle = '#bdc3c7'; // 베개
              ctx.fillRect(px + TILE_SIZE * 0.25, py + TILE_SIZE * 0.35, TILE_SIZE * 0.15, TILE_SIZE * 0.3);
            }
          }
        });
      });

      // 가구 렌더링
      const interiorFurs = Array.isArray(targetFurniture) ? targetFurniture : [];
      const iBase = state.instanceBase || 1000;
      interiorFurs.forEach(f => {
        const px = (iBase + f.tx) * TILE_SIZE;
        const py = (iBase + f.ty) * TILE_SIZE;
        entities.push({
          renderY: py + TILE_SIZE / 2,
          render: (ctx) => {
            // [TODO] 가구 종류별 스프라이트로 교체 필요, 지금은 색상 지정
            ctx.fillStyle = '#8e44ad';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#ecf0f1';
            ctx.font = '10px DotGothic16';
            ctx.fillText(f.id.substring(0, 4), px + 2, py + 16);
          }
        });
      });
    } else {
      // 1. 이미 설치된 내 집 렌더링 (야외)
      const houses = Array.isArray(state.houses) ? state.houses : [];
      houses.forEach(h => {
        const px = h.tx * TILE_SIZE;
        const py = h.ty * TILE_SIZE;
        entities.push({
          renderY: py + TILE_SIZE / 2,
          render: (ctx) => {
            if (h.id === 'house_tent') {
              ctx.fillStyle = '#27ae60'; // 내 텐트 지붕 (초록색)
              ctx.beginPath(); ctx.moveTo(px + TILE_SIZE / 2, py - 8); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE); ctx.lineTo(px, py + TILE_SIZE); ctx.fill();
              ctx.fillStyle = '#1e8449'; ctx.fillRect(px + TILE_SIZE / 2 - 4, py + TILE_SIZE - 6, 8, 6);
            } else if (h.id === 'bed_camp') {
              ctx.fillStyle = '#34495e';
              ctx.fillRect(px + TILE_SIZE * 0.2, py + TILE_SIZE * 0.3, TILE_SIZE * 0.6, TILE_SIZE * 0.4);
              ctx.fillStyle = '#bdc3c7';
              ctx.fillRect(px + TILE_SIZE * 0.25, py + TILE_SIZE * 0.35, TILE_SIZE * 0.15, TILE_SIZE * 0.3);
            }
          }
        });
      });

      // [Phase 5] 2. 타 유저 글로벌 하우징 렌더링 (야외)
      if (typeof dataManager !== 'undefined' && dataManager.publicHouses) {
        for (const [uid, pubHouses] of Object.entries(dataManager.publicHouses)) {
          if (uid === dataManager.userId) continue; // 내 집은 이미 위에서 그림
          if (!Array.isArray(pubHouses)) continue;
          pubHouses.forEach(h => {
            const px = h.tx * TILE_SIZE;
            const py = h.ty * TILE_SIZE;
            entities.push({
              renderY: py + TILE_SIZE / 2,
              render: (ctx) => {
                if (h.id === 'house_tent') {
                  ctx.fillStyle = '#3498db'; // 타인 텐트 지붕 (파란색)
                  ctx.beginPath(); ctx.moveTo(px + TILE_SIZE / 2, py - 8); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE); ctx.lineTo(px, py + TILE_SIZE); ctx.fill();
                  ctx.fillStyle = '#2980b9'; ctx.fillRect(px + TILE_SIZE / 2 - 4, py + TILE_SIZE - 6, 8, 6);
                  // 텐트 위에 닉네임 표시
                  ctx.fillStyle = 'rgba(255,255,255,0.7)';
                  ctx.font = '10px DotGothic16';
                  ctx.fillText(uid.substring(0, 4), px + TILE_SIZE / 2 - 10, py - 12);
                } else if (h.id === 'bed_camp') {
                  // 다른 사람 침대는 흐릿한 빨간색
                  ctx.fillStyle = '#c0392b';
                  ctx.fillRect(px + TILE_SIZE * 0.2, py + TILE_SIZE * 0.3, TILE_SIZE * 0.6, TILE_SIZE * 0.4);
                  ctx.fillStyle = '#e74c3c';
                  ctx.fillRect(px + TILE_SIZE * 0.25, py + TILE_SIZE * 0.35, TILE_SIZE * 0.15, TILE_SIZE * 0.3);
                }
              }
            });
          });
        }
      }
    }

    // (BUILD 모드 홀로그램 제거됨: Phase 4 H-key 장착 기반 건설로 이전됨)
    // [Phase 4-1] HOUSING_EDIT 가상 홀로그램 렌더링
    if (state.mode === MODES.HOUSING_EDIT && player) {
      const px = player.tx * TILE_SIZE;
      const py = player.ty * TILE_SIZE;
      const canBuild = state._canBuildHere;

      entities.push({
        renderY: py + TILE_SIZE,
        render: (ctx) => {
          ctx.fillStyle = canBuild ? 'rgba(52, 152, 219, 0.5)' : 'rgba(231, 76, 60, 0.5)';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = canBuild ? '#3498db' : '#e74c3c';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
      });
    }

    if (player) entities.push(player);
    if (petRef.pet) entities.push(petRef.pet);
    entitiesCount = entities.length;

    // [Multiplayer] Ghost Entity Rendering (Player 인스턴스 기반)
    const ghostEntities = dataManager.others || {};
    const myMapId = (WORLD_MAP && WORLD_MAP.id) ? WORLD_MAP.id : 'town';
    if (!window._ghostPlayers) window._ghostPlayers = {};

    function uidToColor(uid) {
      let hash = 0;
      for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 60%, 50%)`;
    }

    Object.entries(ghostEntities).forEach(([uid, u]) => {
      if (uid === dataManager.userId) return;
      if (!u.position) return;
      const ghostMapId = u.position.mapId || 'town';
      if (ghostMapId !== myMapId) return;

      const myInInstance = !!state.inInstance;
      const ghostInInstance = !!u.position.inInstance;
      if (myInInstance !== ghostInInstance) return;
      if (myInInstance && ghostInInstance) {
        // [FIX] Ensure both evaluate to the exact string UID to prevent Host vs Visitor mismatches
        const myHost = String(state.instanceOwner || dataManager.userId);
        const ghostHost = String(u.position.instanceOwner);
        if (myHost !== ghostHost) return;
      }

      const gx = Number.isFinite(u.position.x) ? u.position.x : 0;
      const gy = Number.isFinite(u.position.y) ? u.position.y : 0;

      if (!window._ghostPlayers[uid]) {
        const gp = new Player(0, 0, 'down');
        gp._ghostUid = uid;
        window._ghostPlayers[uid] = gp;
        gp.renderX = gx;
        gp.renderY = gy;
      }
      const ghost = window._ghostPlayers[uid];

      const distSq = Math.pow(gx - ghost.renderX, 2) + Math.pow(gy - ghost.renderY, 2);
      if (distSq > 100000) {
        ghost.renderX = gx;
        ghost.renderY = gy;
      } else {
        const lerpFactor = 0.25;
        ghost.renderX += (gx - ghost.renderX) * lerpFactor;
        ghost.renderY += (gy - ghost.renderY) * lerpFactor;
      }

      // [FIX] Trigger walking animation frames based on movement distance
      ghost.isMoving = distSq > 4;
      ghost.facing = u.position.facing || 'down';
      ghost.isFishing = !!u.position.isFishing;
      ghost.isSeated = !!u.position.isSeated;
      ghost.rodTier = u.position.rodTier || 1;
      ghost.emojiId = u.position.emojiId || 0;
      ghost.emojiTime = u.position.emojiTime || 0;

      if (u.pushedEvent && u.pushedEvent.ts) {
        if (!ghost._lastPushTs || ghost._lastPushTs < u.pushedEvent.ts) {
          ghost._lastPushTs = u.pushedEvent.ts;
          if (typeof ghost.applyPush === 'function') ghost.applyPush(u.pushedEvent.dir);
        }
      }

      const ghostColor = uidToColor(uid);

      // [FIX] Push ghost into entities array for proper Y-Sorting and integer coordinate rendering
      entities.push({
        renderY: ghost.renderY,
        render: (ctx) => {
          const prevX = ghost.renderX;
          const prevY = ghost.renderY;
          ghost.renderX = Math.round(prevX);
          ghost.renderY = Math.round(prevY);

          ctx.globalAlpha = 0.75;
          ghost.render(ctx, ghostColor);
          ctx.globalAlpha = 1.0;

          if (u.position.emojiId && u.position.emojiTime && Date.now() - u.position.emojiTime < 2000) {
            const emojiMap = { 1: '❤️', 2: '😄', 3: '😢', 4: '❗' };
            const emojiStr = emojiMap[u.position.emojiId];
            if (emojiStr) {
              const elapsed = Date.now() - u.position.emojiTime;
              const floatY = Math.sin(elapsed / 300) * 3;
              const alpha = Math.max(0, 1 - elapsed / 2000);
              ctx.globalAlpha = alpha;
              ctx.font = '16px sans-serif';
              ctx.fillText(emojiStr, ghost.renderX + TILE_SIZE / 2 - 8, ghost.renderY - 10 + floatY);
              ctx.globalAlpha = 1.0;
            }
          }
          ghost.renderX = prevX;
          ghost.renderY = prevY;
        }
      });
    });

    for (const uid of Object.keys(window._ghostPlayers)) {
      if (!ghostEntities[uid]) delete window._ghostPlayers[uid];
    }

    // y sort with NaN safety
    entities.sort((a, b) => {
      const ay = Number.isFinite(a?.renderY) ? a.renderY : 0;
      const by = Number.isFinite(b?.renderY) ? b.renderY : 0;

      // [무결점 패치] 기존 변수(const)를 건드리지 않고 새로운 변수를 만들어 1000을 더함
      const aSort = (state.isSleeping && a === player) ? ay + 1000 : ay;
      const bSort = (state.isSleeping && b === player) ? by + 1000 : by;

      return aSort - bSort;
    });
    entities.forEach(e => {
      // Prevent sub-pixel sprite tearing by enforcing integers during draw
      const origX = e.renderX;
      const origY = e.renderY;
      if (typeof origX === 'number') e.renderX = Math.round(origX);
      if (typeof origY === 'number') e.renderY = Math.round(origY);

      e.render(ctx);

      if (typeof origX === 'number') e.renderX = origX;
      if (typeof origY === 'number') e.renderY = origY;
    });



    // [M4] 로컬 플레이어 이모티콘 렌더링
    if (state._emoji && state._emoji.id && player) {
      const emojiMap = { 1: '❤️', 2: '😄', 3: '😢', 4: '❗' };
      const emojiStr = emojiMap[state._emoji.id];
      if (emojiStr) {
        const elapsed = Date.now() - state._emoji.time;
        if (elapsed < 2000) {
          const floatY = Math.sin(elapsed / 300) * 3;
          const alpha = Math.max(0, 1 - elapsed / 2000);
          ctx.globalAlpha = alpha;
          ctx.font = '16px sans-serif';
          ctx.fillText(emojiStr, player.renderX + TILE_SIZE / 2 - 8, player.renderY - 10 + floatY);
          ctx.globalAlpha = 1.0;
        }
      }
    }

    // [Phase 4-2] Zzz 수면 파티클 렌더링
    if (state.isSleeping && player) {
      if (!window._zzzParticles) window._zzzParticles = [];

      // 0.5초마다 파티클 1개 생성 (최대 3개 유지)
      if (!window._lastZzzTime || Date.now() - window._lastZzzTime > 500) {
        window._zzzParticles.push({
          x: player.renderX + TILE_SIZE / 2 + (Math.random() * 8 - 4),
          y: player.renderY - 8,
          life: 0,
          maxLife: 2000 // 2초 뒤 소멸
        });
        window._lastZzzTime = Date.now();
      }

      for (let i = window._zzzParticles.length - 1; i >= 0; i--) {
        const p = window._zzzParticles[i];
        p.life += 16; // 대략 60fps 기준
        if (p.life >= p.maxLife) {
          window._zzzParticles.splice(i, 1);
          continue;
        }

        const progress = p.life / p.maxLife;
        const fy = p.y - progress * 24; // 위로 둥둥 뜨기
        const fx = p.x + Math.sin(progress * Math.PI * 2) * 4; // 좌우 살랑살랑
        const alpha = 1 - Math.pow(progress, 2); // 끝 갈수록 흐릿

        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f1c40f'; // 노란색 Zzz
        // 크기도 시간에 따라 살짝 커지게 (12px -> 18px)
        const size = 12 + progress * 6;
        ctx.font = `bold ${Math.floor(size)}px sans-serif`;
        ctx.fillText('Z', fx, fy);
      }
      ctx.globalAlpha = 1.0;

      // [Phase 4-3] 수면 진행률 프로그레스 바 렌더링
      const pRatio = Math.min(100, Math.max(0, state.sleepProgress || 0)) / 100;
      const barW = 32;
      const barH = 6;
      const bx = player.renderX + TILE_SIZE / 2 - barW / 2;
      const by = player.renderY - 14;

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(bx + 1, by + 1, (barW - 2) * pRatio, barH - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(bx, by, barW, barH);
    }

    // [M5] 밀치기 감지 (INTERACT 키 + 정면 고스트 + 마주보기 확인)
    if (input.wasActionPressed('INTERACT') && player && window._ghostPlayers) {
      const oppDir = { up: 'down', down: 'up', left: 'right', right: 'left' };
      const dirDelta = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
      const dd = dirDelta[player.facing];
      if (dd) {
        const frontTx = player.tx + dd.dx;
        const frontTy = player.ty + dd.dy;
        for (const [uid, ghost] of Object.entries(window._ghostPlayers)) {
          const gtx = Math.round(ghost.renderX / TILE_SIZE);
          const gty = Math.round(ghost.renderY / TILE_SIZE);
          if (gtx === frontTx && gty === frontTy) {
            // 마주보기 확인
            if (ghost.facing === oppDir[player.facing]) {
              // 뒤쪽 타일 확인
              const pushDelta = dirDelta[player.facing];
              const pushTx = gtx + pushDelta.dx;
              const pushTy = gty + pushDelta.dy;
              // 밀치기 실행
              dataManager.pushPlayer(uid, player.facing);
              QuestSystem.emitQuestEvent(state, 'PLAYER_PUSH', { targetUid: uid, direction: player.facing });
              UI.addSystemMessage('상대방을 밀쳤습니다!', '#e74c3c');
            }
            break;
          }
        }
      }
    }
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
    console.error('[draw] State Context =>', {
      inInstance: state?.inInstance,
      instanceBase: state?.instanceBase,
      playerPos: state?.playerPos
    });
  }

  const hasPlayer = !!player;
  const hasActivePetId = Object.prototype.hasOwnProperty.call(state, 'activePetId');
  const hasMoney = Object.prototype.hasOwnProperty.call(state, 'money');
  const hasTime = Object.prototype.hasOwnProperty.call(state, 'time');
  const hasTimePhaseFn = typeof Time.getPhase === 'function';
  const equippedRodId = state?.equipment?.rodId || state.equippedToolId;
  const equippedToolMeta = UI.getItemMeta ? UI.getItemMeta(equippedRodId) : null;
  const activeBaitId = state?.equipment?.baitId || null;
  const activeBaitCount = activeBaitId
    ? invCount(state.inventory, activeBaitId)
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

  // 주야간 렬더링: 밤안개 오버레이
  if (Time.isNight()) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(15, 20, 45, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 밤/낮 테마 토글
  document.body.classList.toggle('theme-night', Time.isNight());

  if (isDebugOverlayOn()) {
    debugSanity();
  }
}

// 기존: window.Game = { state, player };
Object.defineProperty(window, 'Game', {
  get: () => ({ state, player })
});

init();


