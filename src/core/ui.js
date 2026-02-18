import { MODES, COLORS } from './constants.js';
import { PETS } from '../data/pets.js';
import { Time } from './time.js';
import { t } from './i18n.js';
// ?뚯씪 ?곷떒 import 異붽?
import { ITEMS } from '../data/items.js';
import { QUESTS, QUESTS_BY_ID } from '../data/quests.js';
import { WORLD_MAP } from '../world/map.js';
import { drawFishIcon, drawRodIcon, drawBagIcon } from '../world/entities.js';

// Cache DOM elements
const el = {
  startScreen: document.getElementById('start-screen'),
  hud: document.getElementById('hud'),
  pokedex: document.getElementById('pokedex'),
  dialog: document.getElementById('dialog-box'),
  shop: document.getElementById('shop-screen'),
  quest: document.getElementById('quest-screen'),
  questList: document.getElementById('quest-list'),
  questDetail: document.getElementById('quest-detail'),
  questTracker: document.getElementById('quest-tracker'),
  notificationArea: document.getElementById('notification-area'),

  day: document.getElementById('day-display'),
  money: document.getElementById('money-display'),
  timeBar: document.getElementById('time-bar-fill'),
  debug: document.getElementById('debug-overlay'),

  petList: document.getElementById('pet-list'),
  petName: document.getElementById('pet-name'),
  petDesc: document.getElementById('pet-desc'),
  btnWalk: document.getElementById('btn-walk'),
  btnStop: document.getElementById('btn-stop-walk'),

  btnContinue: document.getElementById('btn-continue'),
  btnNew: document.getElementById('btn-newgame'),

  dialogText: document.getElementById('dialog-text'),
  uiLayer: document.getElementById('ui-layer')
};

// [NEW] ?곹깭 異붿쟻???꾪븳 罹먯떆 (遺덊븘?뷀븳 DOM ?낅뜲?댄듃 諛⑹?)
let _lastMoney = -1;
let _lastDay = -1;
let _typewriterInterval = null; // ??먭린 ?④낵 ?쒖뼱??
let _debugOverlayVisible = false;
let _shopSelectedKey = null;
let _shopPurchaseCount = 1;
let _questToastTimer = null;
const _iconCache = new Map();

function ensureUiState(state) {
  if (!state.ui || typeof state.ui !== 'object') {
    state.ui = { modal: null, selectedPetId: null, selectedInvId: null, selectedInvIndex: null, selectedQuestId: null, invTab: 'ALL', fishBagOpen: false, openBagId: null };
  }
  if (!state.ui.invTab) state.ui.invTab = 'ALL';
  if (typeof state.ui.selectedInvIndex !== 'number') state.ui.selectedInvIndex = null;
  if (!Object.prototype.hasOwnProperty.call(state.ui, 'selectedQuestId')) state.ui.selectedQuestId = null;
  if (!Object.prototype.hasOwnProperty.call(state.ui, 'openBagId')) state.ui.openBagId = null;
}

function getPetEffectText(pet) {
  if (!pet || !pet.skillType) return '-';
  if (pet.skillType === 'FISHING_LUCK') return `낚시 희귀 확률 +${Math.round((pet.skillValue || 0) * 100)}%`;
  if (pet.skillType === 'FISHING_WEIGHT') return `낚시 무게 보정 +${Math.round((pet.skillValue || 0) * 100)}%`;
  if (pet.skillType === 'MOVE_SPEED') return `이동 속도 보조 +${Math.round((pet.skillValue || 0) * 100)}%`;
  if (pet.skillType === 'PRICE_BONUS') return `판매 가격 보너스 +${Math.round((pet.skillValue || 0) * 100)}%`;
  if (pet.skillType === 'TIME_WATER') return `시간대 수변 보조 +${Math.round((pet.skillValue || 0) * 100)}%`;
  if (pet.skillType === 'COSMETIC') return '코스메틱 동료 효과';
  return `${pet.skillType} +${pet.skillValue || 0}`;
}

export const UI = {
  init(callbacks) {
    el.btnNew.onclick = callbacks.onNewGame;
    el.btnContinue.onclick = callbacks.onContinue;
    el.btnWalk.onclick = () => callbacks.onWalkPet(this.selectedPetId);
    el.btnStop.onclick = callbacks.onStopWalk;

    this.callbacks = callbacks;
    this.selectedPetId = null;

    const shopTitle = document.querySelector('#shop-screen h2');
    const shopMoneyLabel = document.querySelector('#shop-screen p');
    const shopGuide = document.querySelector('#shop-screen .guide');
    if (shopTitle) shopTitle.textContent = '바다코끼리 어시장';
    if (shopMoneyLabel) shopMoneyLabel.childNodes[0].nodeValue = `${t('ui.shop.money')}: `;
    if (shopGuide) shopGuide.textContent = t('ui.shop.close');
    if (el.debug) el.debug.classList.add('hidden');
    if (el.uiLayer && !document.getElementById('minimap-container')) {
      const minimapWrap = document.createElement('div');
      minimapWrap.id = 'minimap-container';
      minimapWrap.style.position = 'absolute';
      minimapWrap.style.left = '10px';
      minimapWrap.style.top = '10px';
      minimapWrap.style.border = '2px solid #fff';
      minimapWrap.style.background = 'rgba(0,0,0,0.6)';
      minimapWrap.style.borderRadius = '8px';
      minimapWrap.style.overflow = 'hidden';
      minimapWrap.style.pointerEvents = 'none';
      minimapWrap.style.zIndex = '90';
      minimapWrap.innerHTML = `
        <canvas id="minimap" width="140" height="100" style="display:block;"></canvas>
        <div id="quest-helper-text" style="color:#f1c40f;font-size:11px;font-weight:bold;padding:4px;text-align:center;border-top:1px solid #555;min-height:18px;">퀘스트 도우미</div>
      `;
      el.uiLayer.appendChild(minimapWrap);
    }
    if (el.uiLayer && !document.getElementById('ui-modal')) {
      const modal = document.createElement('div');
      modal.id = 'ui-modal';
      modal.className = 'screen hidden';
      modal.style.zIndex = '220';
      modal.style.pointerEvents = 'auto';
      modal.innerHTML = `
        <div id="ui-modal-card" style="width:84%;max-width:520px;background:rgba(20,20,20,0.95);border:2px solid #ecf0f1;padding:16px;">
          <h3 id="ui-modal-title" style="margin-bottom:10px;color:#f1c40f;"></h3>
          <div id="ui-modal-body"></div>
          <div id="ui-modal-actions" class="action-buttons" style="margin-top:10px;"></div>
        </div>`;
      el.uiLayer.appendChild(modal);
    }
  },

  setStartScreen(visible, canContinue) {
    el.startScreen.classList.toggle('hidden', !visible);
    el.hud.classList.toggle('hidden', visible);
    el.btnContinue.disabled = !canContinue;
  },

  toggleDebugOverlay() {
    _debugOverlayVisible = !_debugOverlayVisible;
    el.debug.classList.toggle('hidden', !_debugOverlayVisible);
  },

  updateHUD(state, debugInfo = null) {
    // [CHANGED] 媛믪씠 蹂?덉쓣 ?뚮쭔 ?띿뒪???낅뜲?댄듃 (?뚮뜑留?理쒖쟻??
    if (_lastDay !== state.day) {
      el.day.textContent = state.day;
      _lastDay = state.day;
    }

    if (_lastMoney !== state.money) {
        // [NEW] ?덉씠 ?ㅻ? ???レ옄 ?좊땲硫붿씠???④낵 (媛꾨떒 踰꾩쟾)
        el.money.style.color = state.money > _lastMoney ? '#f1c40f' : '#ecf0f1';
        el.money.textContent = state.money;
        setTimeout(() => el.money.style.color = '#ecf0f1', 200);
        _lastMoney = state.money;
    }
    
    // Time bar??留ㅻ걚?ъ썙???섎?濡?留ㅻ쾲 ?낅뜲?댄듃
    el.timeBar.style.width = `${state.time * 100}%`;
    this.renderQuestTracker(state);
    this.updateMinimap(state, WORLD_MAP);
    this.flushQuestNotifications(state);

    if (_debugOverlayVisible) {
      // Debug Info
      const debugText = debugInfo ? `
[DEBUG]
FPS: ${debugInfo.fps} (${debugInfo.msPerFrame} ms)
Mode: ${debugInfo.mode}
Player Tile: ${debugInfo.playerTile}
Player Pixel: ${debugInfo.playerPixel}
Inventory: ${debugInfo.inventoryCount}
Owned Pets: ${debugInfo.ownedPetCount}
Active Pet: ${debugInfo.activePetId}
Money: ${debugInfo.money}
Time/Phase: ${debugInfo.timePhase}
Map: ${debugInfo.mapId}
Inventory Pressed: ${debugInfo.inventoryPressed}
lastCatch: ${debugInfo.lastCatch}
EquippedTool: ${debugInfo.equippedTool}
EquippedRod: ${debugInfo.equippedRod}
ActiveBait: ${debugInfo.activeBait}
lastCatchDebug: ${debugInfo.lastCatchDebug}
catchWeights: ${debugInfo.catchWeights}
Fishing: ${debugInfo.fishingReason} (${debugInfo.fishingTile})
isFishing: ${debugInfo.isFishing}
fishingStartGate: ${debugInfo.fishingStartGate}
frontTile: ${debugInfo.frontTile}
frontIsWater: ${debugInfo.frontIsWater}
nearWater: ${debugInfo.nearWater}
` : `
    [DEBUG INFO]
    Mode: ${state.mode}
    Pos: (${state.playerPos.tx}, ${state.playerPos.ty})
    ActivePet: ${state.activePetId || 'None'}
    Night: ${Time.isNight(state) ? 'YES' : 'NO'}
    `;
      el.debug.textContent = debugText;
      el.debug.style.color = Time.isNight(state) ? '#aaa' : '#00ff00';
    }
  },

  togglePokedex(show, state) {
    el.pokedex.classList.toggle('hidden', !show);
    if (show) {
      this.renderPetList(state);
    }
  },

  renderPetList(state) {
    ensureUiState(state);
    el.petList.innerHTML = '';

    if (!state.selectedPetId && state.ownedPetIds.length > 0) {
      state.selectedPetId = state.ownedPetIds[0];
    }
    this.selectedPetId = state.selectedPetId;

    state.ownedPetIds.forEach(id => {
      const pet = PETS.find(p => p.id === id);
      if (!pet) return;

      const div = document.createElement('div');
      div.className = 'pet-slot';
      
      // [CHANGED] ?ㅽ???吏곸젒 二쇱엯 ???CSS 蹂???쒖슜 沅뚯옣?섏?留? 
      // ?꾩옱???숈쟻 而щ윭 吏?먯쓣 ?꾪빐 ?좎??섎릺 洹몃┝???④낵 異붽?
      div.style.backgroundColor = pet.color || '#555';
      div.style.boxShadow = `inset 0 0 10px rgba(0,0,0,0.5)`; 
      
      if (id === this.selectedPetId) {
        div.classList.add('selected');
        // [NEW] ?좏깮???レ? ?뚮몢由??됱긽????怨좎쑀 ?됱쑝濡?鍮쏅굹寃???
        div.style.borderColor = '#fff'; 
        div.style.transform = 'scale(1.1)';
      }

      // [NEW] ?띿뒪??????ν썑 ?꾩씠肄섏씠 ?ㅼ뼱媛??먮━ ?뺣낫
      // ?꾩옱??泥?湲?먮쭔 ?쒖떆?섎릺, ?ㅽ??쇰쭅???꾪빐 span?쇰줈 媛먯뙂
      div.innerHTML = '';
      div.style.position = 'relative';
      const icon = document.createElement('canvas');
      icon.width = 48;
      icon.height = 48;
      this.drawPetIconToCanvas(icon, pet, 48);
      div.appendChild(icon);

      if (state.activePetId === id) {
        const badge = document.createElement('div');
        badge.textContent = t('ui.pet.equipped');
        badge.style.position = 'absolute';
        badge.style.right = '2px';
        badge.style.top = '2px';
        badge.style.fontSize = '0.5rem';
        badge.style.background = 'rgba(0,0,0,0.65)';
        badge.style.padding = '1px 3px';
        badge.style.color = '#f1c40f';
        div.appendChild(badge);
      }

      div.onclick = () => {
        state.ui.selectedPetId = id;
        this.callbacks.onSelectPet(id);
        this.renderPetList(state);
        this.openPetDetail(state, pet);
      };

      el.petList.appendChild(div);
    });

    this.updatePetDetails(state);
  },

  updatePetDetails(state) {
    if (!this.selectedPetId) {
      el.petName.textContent = "No Pet Selected";
      el.petDesc.textContent = "";
      el.btnWalk.disabled = true;
      el.btnStop.classList.add('hidden');
      return;
    }

    const pet = PETS.find(p => p.id === this.selectedPetId);
    el.petName.textContent = pet.name;
    el.petDesc.textContent = pet.desc;
    el.btnWalk.disabled = false;

    if (state.activePetId) {
      el.btnStop.classList.remove('hidden');
      if (state.activePetId === this.selectedPetId) {
        el.btnWalk.textContent = t('ui.pet.equipped');
        el.btnWalk.disabled = true;
        el.btnWalk.classList.add('active-btn'); // CSS?먯꽌 ?ㅽ??쇰쭅 媛??
      } else {
        el.btnWalk.textContent = t('ui.pet.equip');
        el.btnWalk.disabled = false;
        el.btnWalk.classList.remove('active-btn');
      }
    } else {
      el.btnStop.classList.add('hidden');
      el.btnWalk.textContent = t('ui.pet.equip');
      el.btnWalk.disabled = false;
    }
  },

  // [NEW] ??먭린 ?④낵媛 ?곸슜????붿갹 ?⑥닔
  showDialog(text, onComplete = null) {
    el.dialog.classList.remove('hidden');
    el.dialogText.textContent = ""; // 珥덇린??
    
    // 湲곗〈 ??댄븨 以묐떒
    if (_typewriterInterval) clearInterval(_typewriterInterval);

    let i = 0;
    const speed = 30; // 湲?먮떦 30ms

    _typewriterInterval = setInterval(() => {
      el.dialogText.textContent += text.charAt(i);
      i++;
      
      // ??댄븨 ?꾨즺 ??
      if (i > text.length - 1) {
        clearInterval(_typewriterInterval);
        _typewriterInterval = null;
        if (onComplete) onComplete();
      }
    }, speed);
  },

  hideDialog() {
    el.dialog.classList.add('hidden');
    if (_typewriterInterval) {
        clearInterval(_typewriterInterval);
        _typewriterInterval = null;
    }
  },

  // ?쇄뼹??[?ш린?쒕???蹂듭궗?댁꽌 遺숈뿬?ｌ쑝?몄슂] ?쇄뼹??
  
  toggleInventory(show, state) {
    // ?몃깽?좊━ ?붾㈃(DOM)???놁쑝硫??먮윭媛 ?????덉쑝誘濡?泥댄겕 (?덉쟾?μ튂)
    const invScreen = document.getElementById('inventory-screen');
    if (!invScreen) return;
    
    invScreen.classList.toggle('hidden', !show);
    document.body.classList.toggle('modal-open', !!show);
    
    if (show) {
        ensureUiState(state);
        state.ui.fishBagOpen = false;
        state.ui.openBagId = null;
        this.renderInventory(state);
    }
  },

  toggleQuestLog(show, state) {
    ensureUiState(state);
    if (!el.quest) return;
    el.quest.classList.toggle('hidden', !show);
    document.body.classList.toggle('modal-open', !!show);
    if (show) this.renderQuestLog(state);
  },

  renderQuestLog(state) {
    ensureUiState(state);
    if (!el.questList || !el.questDetail) return;
    const questClose = document.getElementById('quest-close');
    if (questClose) {
      questClose.onclick = () => {
        this.toggleQuestLog(false, state);
        state.mode = MODES.EXPLORE;
      };
    }
    const activeIds = Array.isArray(state?.quests?.activeQuestIds) ? state.quests.activeQuestIds : [];
    const completedIds = Array.isArray(state?.quests?.completedQuestIds) ? state.quests.completedQuestIds : [];
    const ordered = [
      ...activeIds.map((id) => ({ id, status: 'ACTIVE' })),
      ...QUESTS.filter((q) => !activeIds.includes(q.id) && !completedIds.includes(q.id)).map((q) => ({ id: q.id, status: 'LOCKED' })),
      ...completedIds.map((id) => ({ id, status: 'DONE' }))
    ];
    if (!state.ui.selectedQuestId || !ordered.some((x) => x.id === state.ui.selectedQuestId)) {
      state.ui.selectedQuestId = ordered[0]?.id || null;
    }

    el.questList.innerHTML = '';
    ordered.forEach((entry) => {
      const quest = QUESTS_BY_ID[entry.id];
      if (!quest) return;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `quest-row${state.ui.selectedQuestId === quest.id ? ' selected' : ''}`;
      const badge = entry.status === 'ACTIVE' ? '[진행중]' : entry.status === 'DONE' ? '[완료]' : '[잠김]';
      row.textContent = `${badge} ${quest.title}`;
      row.onclick = () => {
        state.ui.selectedQuestId = quest.id;
        this.renderQuestLog(state);
      };
      el.questList.appendChild(row);
    });
    this.renderQuestDetail(state, state.ui.selectedQuestId);
  },

  renderQuestDetail(state, questId) {
    if (!el.questDetail) return;
    const quest = QUESTS_BY_ID[questId];
    if (!quest) {
      el.questDetail.innerHTML = '<div class="quest-empty">퀘스트를 선택하세요.</div>';
      return;
    }
    const progress = state?.quests?.stepProgress?.[quest.id] || {};
    const completedIds = Array.isArray(state?.quests?.completedQuestIds) ? state.quests.completedQuestIds : [];
    const isDone = completedIds.includes(quest.id);
    const rewards = Array.isArray(quest.rewards)
      ? quest.rewards.map((r) => r?.type === 'MONEY' ? `${r.amount || 0}G` : `${r.type || '-'}`).join(', ')
      : '-';
    const stepsHtml = (quest.steps || []).map((step) => {
      const need = Math.max(1, Number(step.count || 1));
      const cur = Math.min(need, Number(progress?.[step.id] || 0));
      const done = cur >= need || isDone;
      const meter = need > 1 ? ` (${cur}/${need})` : '';
      return `<li class="${done ? 'done' : ''}">${done ? '☑' : '☐'} ${step.text}${meter}</li>`;
    }).join('');
    el.questDetail.innerHTML = `
      <h3>${quest.title}${isDone ? ' - 완료!' : ''}</h3>
      <p class="quest-desc">${quest.desc || ''}</p>
      <div class="quest-steps-title">진행 단계</div>
      <ul class="quest-steps">${stepsHtml}</ul>
      <div class="quest-reward">보상: ${rewards}</div>
    `;
  },

  renderQuestTracker(state) {
    if (!el.questTracker) return;
    const activeIds = Array.isArray(state?.quests?.activeQuestIds) ? state.quests.activeQuestIds : [];
    const quest = QUESTS_BY_ID[activeIds[0]];
    if (!quest) {
      el.questTracker.classList.add('hidden');
      return;
    }
    const progress = state?.quests?.stepProgress?.[quest.id] || {};
    const currentStep = (quest.steps || []).find((step) => Number(progress?.[step.id] || 0) < Math.max(1, Number(step.count || 1))) || quest.steps?.[quest.steps.length - 1];
    if (!currentStep) {
      el.questTracker.classList.add('hidden');
      return;
    }
    const need = Math.max(1, Number(currentStep.count || 1));
    const cur = Math.min(need, Number(progress?.[currentStep.id] || 0));
    const meter = need > 1 ? ` (${cur}/${need})` : '';
    el.questTracker.textContent = `퀘스트: ${quest.title} - ${currentStep.text}${meter}`;
    el.questTracker.classList.remove('hidden');
  },

  getQuestTargetPos(step, map) {
    if (!step) return null;
    const poiKey = String(step.targetPOI || '').toLowerCase();
    const hint = step.targetHint || '';
    const table = {
      fish_market: { poiId: 'FISH_MARKET', x: 30, y: 31, radius: 2, label: '어시장' },
      shop: { poiId: 'TACKLE_SHOP', x: 34, y: 31, radius: 2, label: '낚시용품점' },
      center: { npcId: 'NPC_MAYOR', x: 22, y: 14, radius: 2, label: '마을 중앙' },
      forest: { poiId: 'forest', x: 7, y: 6, radius: 3, label: '숲' },
      lake: { poiId: 'lake', x: 21, y: 24, radius: 3, label: '호수' }
    };
    const base = table[poiKey];
    if (!base) return null;
    if (!map) return { ...base, hint };

    if (base.poiId && Array.isArray(map.poi)) {
      const poi = map.poi.find((p) => String(p?.id || '').toLowerCase() === String(base.poiId).toLowerCase());
      if (poi) return { x: poi.x, y: poi.y, radius: poi.radius || base.radius, label: base.label, hint };
    }
    if (base.npcId && Array.isArray(map.npcs)) {
      const npc = map.npcs.find((n) => n?.id === base.npcId);
      if (npc) return { x: npc.x, y: npc.y, radius: base.radius, label: base.label, hint };
    }
    return { ...base, hint };
  },

  drawDirectionArrow(ctx, x, y, dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const ux = dx / len;
    const uy = dy / len;
    const arrowLen = 14;
    const tipX = x + ux * arrowLen;
    const tipY = y + uy * arrowLen;
    const sideX = -uy;
    const sideY = ux;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ux * 6 + sideX * 4, tipY - uy * 6 + sideY * 4);
    ctx.lineTo(tipX - ux * 6 - sideX * 4, tipY - uy * 6 - sideY * 4);
    ctx.closePath();
    ctx.fill();
  },

  updateMinimap(state, map) {
    const canvas = document.getElementById('minimap');
    if (!canvas || !map) return;
    const helperText = document.getElementById('quest-helper-text');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const scaleX = w / Math.max(1, map.width || 1);
    const scaleY = h / Math.max(1, map.height || 1);

    ctx.fillStyle = '#0f1722';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }

    const playerTx = Number(state?.playerPos?.tx ?? 0);
    const playerTy = Number(state?.playerPos?.ty ?? 0);
    const px = playerTx * scaleX;
    const py = playerTy * scaleY;
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    const traps = Array.isArray(state?.traps) ? state.traps : [];
    ctx.fillStyle = '#14b8a6';
    traps.forEach((trap) => {
      if (!trap || !Number.isFinite(trap.x) || !Number.isFinite(trap.y)) return;
      ctx.beginPath();
      ctx.arc(trap.x * scaleX, trap.y * scaleY, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const activeQuestId = state?.quests?.activeQuestIds?.[0];
    if (!activeQuestId) {
      if (helperText) helperText.textContent = '퀘스트 없음';
      return;
    }
    const quest = QUESTS_BY_ID[activeQuestId];
    const progress = state?.quests?.stepProgress?.[activeQuestId] || {};
    const currentStep = (quest?.steps || []).find((step) => Number(progress?.[step.id] || 0) < Math.max(1, Number(step.count || 1)))
      || quest?.steps?.[quest.steps.length - 1];
    const target = this.getQuestTargetPos(currentStep, map);
    if (!target) {
      if (helperText) helperText.textContent = '목표 좌표 없음';
      return;
    }

    const tx = target.x * scaleX;
    const ty = target.y * scaleY;
    const dxTiles = target.x - playerTx;
    const dyTiles = target.y - playerTy;
    const distance = Math.round(Math.hypot(dxTiles, dyTiles));
    const arrived = distance <= Math.max(1, Number(target.radius || 2));

    const blink = Math.sin(Date.now() / 220) > 0;
    ctx.fillStyle = blink ? '#ff6b57' : '#c0392b';
    ctx.beginPath();
    ctx.arc(tx, ty, 4, 0, Math.PI * 2);
    ctx.fill();
    this.drawDirectionArrow(ctx, px, py, tx - px, ty - py);

    if (helperText) {
      const isFishingStart = currentStep?.type === 'EVENT' && currentStep?.target === 'START_FISHING';
      helperText.textContent = arrived
        ? (isFishingStart ? '도착! F로 낚시 시작' : `${target.label} 도착! E로 상호작용`)
        : `${target.label}${target.hint ? `(${target.hint})` : ''} 방향 ${distance}타일`;
    }
  },

  flushQuestNotifications(state) {
    const queue = state?.quests?.newlyCompletedQueue;
    if (!Array.isArray(queue) || queue.length === 0) return;
    ensureUiState(state);
    if (state.ui.questNotifyOpen) return;
    const modal = document.getElementById('ui-modal');
    if (!modal || !modal.classList.contains('hidden')) return;
    const questId = queue.shift();
    const quest = QUESTS_BY_ID[questId];
    if (!quest) return;
    state.ui.questNotifyOpen = true;
    state.ui.questNotifyPrevMode = state.mode;
    state.mode = MODES.DIALOG;
    this.openModal(
      state,
      `퀘스트 완료: ${quest.title}`,
      (root) => {
        const desc = document.createElement('div');
        desc.textContent = '완료 보상을 확인하세요.';
        root.appendChild(desc);
        if (Array.isArray(quest.rewards) && quest.rewards.length > 0) {
          const reward = document.createElement('div');
          reward.style.marginTop = '8px';
          reward.textContent = `보상: ${quest.rewards.map((r) => r.type === 'MONEY' ? `${r.amount}G` : r.type).join(', ')}`;
          root.appendChild(reward);
        }
      },
      [{
        label: '확인',
        onClick: () => {
          if (modal) modal.classList.add('hidden');
          state.ui.modal = null;
          state.mode = state.ui.questNotifyPrevMode || MODES.EXPLORE;
          state.ui.questNotifyPrevMode = null;
          state.ui.questNotifyOpen = false;
        }
      }]
    );
  },

  toggleShop(show, state) {
    if (!el.shop) return;
    const wasHidden = el.shop.classList.contains('hidden');
    el.shop.classList.toggle('hidden', !show);
    if (show && wasHidden) {
      this.renderShop(state);
    }
  },

  getItemMeta(itemId) {
    return ITEMS[itemId] || null;
  },

  getItemName(itemOrId) {
    const item = typeof itemOrId === 'string' ? ITEMS[itemOrId] : itemOrId;
    if (!item) return '';
    return item.nameKey ? t(item.nameKey) : (item.name || item.id || '');
  },

  getItemDesc(itemOrId) {
    const item = typeof itemOrId === 'string' ? ITEMS[itemOrId] : itemOrId;
    if (!item) return '';
    return item.descKey ? t(item.descKey) : (item.desc || item.description || '');
  },

  getItemEffect(itemOrId) {
    const item = typeof itemOrId === 'string' ? ITEMS[itemOrId] : itemOrId;
    if (!item) return '';
    return item.effectTextKey ? t(item.effectTextKey) : (item.effectText || '');
  },

  getVisualTier(itemOrId) {
    const item = typeof itemOrId === 'string' ? ITEMS[itemOrId] : itemOrId;
    if (!item) return 1;
    if (typeof item.tier === 'number') return item.tier;
    if (item.equipSlot === 'BAG' || item.iconKind === 'BAG_FISH') {
      const cap = item.bagCapacity || item.capacity || 10;
      if (cap >= 80) return 3;
      if (cap >= 40) return 2;
      return 1;
    }
    return 1;
  },

  drawPetIconToCanvas(canvas, pet, size = 48) {
    if (!canvas || !pet) return;
    canvas.width = size;
    canvas.height = size;
    const key = `pet:${pet.id}:${size}:${pet.color || ''}`;
    const cached = _iconCache.get(key);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (cached) {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(cached, 0, 0);
      return;
    }

    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, size, size);
    const inferredShape = pet?.visual?.shape
      || (pet?.skillType === 'FISHING_WEIGHT' ? 'CIRCLE' : pet?.skillType === 'FISHING_LUCK' ? 'OVAL' : 'TRIANGLE');
    const v = {
      shape: inferredShape,
      eyeStyle: pet?.visual?.eyeStyle || 'DOT',
      accentColor: pet?.visual?.accentColor || '#ffffff',
      floatAnim: !!pet?.visual?.floatAnim
    };
    const primary = pet.color || '#95a5a6';
    const cx = size * 0.5;
    const cy = size * 0.54;

    // shadow
    octx.fillStyle = 'rgba(0,0,0,0.15)';
    octx.beginPath();
    octx.ellipse(cx, size * 0.85, size * 0.3, size * 0.08, 0, 0, Math.PI * 2);
    octx.fill();

    // base body
    octx.fillStyle = primary;
    if (v.shape === 'CIRCLE') {
      octx.beginPath();
      octx.arc(cx, cy, size * 0.27, 0, Math.PI * 2);
      octx.fill();
    } else if (v.shape === 'TRIANGLE') {
      octx.beginPath();
      octx.moveTo(cx, size * 0.2);
      octx.lineTo(size * 0.78, size * 0.74);
      octx.lineTo(size * 0.22, size * 0.74);
      octx.closePath();
      octx.fill();
    } else if (v.shape === 'STACKED') {
      octx.beginPath();
      octx.ellipse(cx, size * 0.62, size * 0.3, size * 0.2, 0, 0, Math.PI * 2);
      octx.fill();
      octx.fillStyle = v.accentColor;
      octx.beginPath();
      octx.ellipse(cx, size * 0.38, size * 0.2, size * 0.15, 0, 0, Math.PI * 2);
      octx.fill();
      octx.fillStyle = primary;
    } else {
      octx.beginPath();
      octx.ellipse(cx, cy, size * 0.3, size * 0.22, 0, 0, Math.PI * 2);
      octx.fill();
    }

    // accent mark
    octx.fillStyle = v.accentColor;
    octx.beginPath();
    octx.ellipse(cx, size * 0.33, size * 0.08, size * 0.04, 0, 0, Math.PI * 2);
    octx.fill();

    // eyes
    const eyeY = size * 0.5;
    const eyeR = v.eyeStyle === 'WIDE' ? size * 0.05 : (v.eyeStyle === 'SMALL' ? size * 0.028 : size * 0.038);
    octx.fillStyle = '#111';
    octx.beginPath(); octx.arc(cx - size * 0.1, eyeY, eyeR, 0, Math.PI * 2); octx.fill();
    octx.beginPath(); octx.arc(cx + size * 0.1, eyeY, eyeR, 0, Math.PI * 2); octx.fill();
    octx.fillStyle = '#fff';
    octx.beginPath(); octx.arc(cx - size * 0.1 + 1, eyeY - 1, Math.max(1, eyeR * 0.35), 0, Math.PI * 2); octx.fill();
    octx.beginPath(); octx.arc(cx + size * 0.1 + 1, eyeY - 1, Math.max(1, eyeR * 0.35), 0, Math.PI * 2); octx.fill();
    _iconCache.set(key, off);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(off, 0, 0);
  },

  drawItemIconToCanvas(canvas, item, size = 24, fishId = null) {
    if (!canvas || !item) return;
    canvas.width = size;
    canvas.height = size;
    const key = `item:${item.id}:${size}:${fishId || ''}`;
    const cached = _iconCache.get(key);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (cached) {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(cached, 0, 0);
      return;
    }

    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.clearRect(0, 0, size, size);
    octx.fillStyle = '#ecf0f1';

    if (item.type === 'FISH') {
      drawFishIcon(octx, item, size);
    } else if (item.type === 'TOOL' && item.toolKind === 'FISHING_ROD') {
      drawRodIcon(octx, item, size);
    } else if (item.iconKind === 'CHAIR' || item.equipSlot === 'CHAIR') {
      octx.fillStyle = '#8d6e63';
      octx.fillRect(size * 0.26, size * 0.52, size * 0.48, size * 0.12);
      octx.fillRect(size * 0.28, size * 0.26, size * 0.08, size * 0.26);
      octx.fillRect(size * 0.64, size * 0.26, size * 0.08, size * 0.26);
      octx.fillRect(size * 0.3, size * 0.64, size * 0.08, size * 0.18);
      octx.fillRect(size * 0.62, size * 0.64, size * 0.08, size * 0.18);
    } else if (item.iconKind === 'TRAP' || item.equipSlot === 'TRAP') {
      const cap = Number(item.trapCapacity || item.capacity || 10);
      octx.fillStyle = cap >= 30 ? '#0f766e' : cap >= 20 ? '#0ea5a5' : '#14b8a6';
      octx.fillRect(size * 0.22, size * 0.42, size * 0.56, size * 0.4);
      octx.strokeStyle = '#d1fae5';
      octx.lineWidth = Math.max(1, Math.floor(size / 18));
      octx.strokeRect(size * 0.22, size * 0.42, size * 0.56, size * 0.4);
      octx.strokeStyle = 'rgba(236,253,245,0.55)';
      for (let gx = 0.28; gx < 0.78; gx += 0.12) {
        octx.beginPath();
        octx.moveTo(size * gx, size * 0.42);
        octx.lineTo(size * gx, size * 0.82);
        octx.stroke();
      }
      octx.fillStyle = '#8b5a2b';
      octx.fillRect(size * 0.2, size * 0.3, size * 0.6, size * 0.08);
    } else if (item.iconKind === 'BAIT' || item.equipSlot === 'BAIT') {
      const style = item.baitStyle || 'HAPJEONG';
      octx.lineWidth = Math.max(1, Math.floor(size / 16));
      octx.strokeStyle = '#ecf0f1';
      octx.fillStyle = '#f5f5f5';
      if (style === 'CORK') {
        octx.fillRect(size * 0.38, size * 0.2, size * 0.24, size * 0.22);
        octx.beginPath();
        octx.moveTo(size * 0.5, size * 0.42);
        octx.lineTo(size * 0.5, size * 0.82);
        octx.stroke();
      } else if (style === 'HEAVY') {
        octx.beginPath();
        octx.moveTo(size * 0.5, size * 0.2);
        octx.lineTo(size * 0.34, size * 0.6);
        octx.lineTo(size * 0.66, size * 0.6);
        octx.closePath();
        octx.fill();
        octx.fillRect(size * 0.47, size * 0.6, size * 0.06, size * 0.22);
      } else if (style === 'SPIN') {
        octx.beginPath();
        octx.arc(size * 0.5, size * 0.4, size * 0.16, 0, Math.PI * 2);
        octx.stroke();
        octx.beginPath();
        octx.moveTo(size * 0.34, size * 0.4);
        octx.lineTo(size * 0.22, size * 0.32);
        octx.moveTo(size * 0.66, size * 0.4);
        octx.lineTo(size * 0.78, size * 0.48);
        octx.stroke();
      } else if (style === 'HOOK') {
        octx.beginPath();
        octx.moveTo(size * 0.5, size * 0.22);
        octx.lineTo(size * 0.5, size * 0.68);
        octx.arc(size * 0.42, size * 0.68, size * 0.08, 0, Math.PI, true);
        octx.stroke();
        octx.beginPath();
        octx.moveTo(size * 0.48, size * 0.44);
        octx.lineTo(size * 0.58, size * 0.4);
        octx.moveTo(size * 0.48, size * 0.52);
        octx.lineTo(size * 0.58, size * 0.48);
        octx.stroke();
      } else if (style === 'CURIOUS') {
        octx.beginPath();
        octx.arc(size * 0.5, size * 0.46, size * 0.16, 0, Math.PI * 2);
        octx.stroke();
        octx.fillRect(size * 0.48, size * 0.44, 2, 2);
        octx.beginPath();
        octx.arc(size * 0.5, size * 0.82, size * 0.08, Math.PI * 0.1, Math.PI * 0.9);
        octx.stroke();
      } else if (style === 'TREASURE') {
        octx.beginPath();
        octx.moveTo(size * 0.5, size * 0.2);
        octx.lineTo(size * 0.64, size * 0.36);
        octx.lineTo(size * 0.5, size * 0.52);
        octx.lineTo(size * 0.36, size * 0.36);
        octx.closePath();
        octx.fill();
        octx.fillRect(size * 0.26, size * 0.58, 2, 2);
        octx.fillRect(size * 0.72, size * 0.56, 2, 2);
      } else {
        octx.beginPath();
        octx.arc(size * 0.5, size * 0.36, size * 0.16, 0, Math.PI * 2);
        octx.fill();
        octx.beginPath();
        octx.moveTo(size * 0.5, size * 0.52);
        octx.lineTo(size * 0.5, size * 0.82);
        octx.stroke();
      }
    } else if (item.equipSlot === 'BAG' || item.iconKind === 'BAG_FISH') {
      drawBagIcon(octx, item, size);
    } else {
      octx.fillStyle = '#95a5a6';
      octx.fillRect(size * 0.18, size * 0.18, size * 0.64, size * 0.64);
    }

    _iconCache.set(key, off);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(off, 0, 0);
  },

  closeTransientViews(state) {
    ensureUiState(state);
    const modal = document.getElementById('ui-modal');
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      state.ui.modal = null;
      return true;
    }
    if (state.ui.fishBagOpen) {
      state.ui.fishBagOpen = false;
      state.ui.openBagId = null;
      this.renderInventory(state);
      return true;
    }
    if (el.quest && !el.quest.classList.contains('hidden')) {
      this.toggleQuestLog(false, state);
      state.mode = MODES.EXPLORE;
      return true;
    }
    return false;
  },

  openModal(state, title, bodyBuilder, actions = []) {
    ensureUiState(state);
    const modal = document.getElementById('ui-modal');
    const titleEl = document.getElementById('ui-modal-title');
    const bodyEl = document.getElementById('ui-modal-body');
    const actionsEl = document.getElementById('ui-modal-actions');
    if (!modal || !titleEl || !bodyEl || !actionsEl) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = '';
    if (typeof bodyBuilder === 'function') bodyBuilder(bodyEl);
    actionsEl.innerHTML = '';

    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = action.label;
      btn.onclick = action.onClick;
      actionsEl.appendChild(btn);
    });

    modal.classList.remove('hidden');
    state.ui.modal = title;
  },

  openPetDetail(state, pet) {
    this.openModal(
      state,
      this.getItemName ? (pet.name || pet.id) : (pet.name || pet.id),
      (root) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '12px';
        wrap.style.alignItems = 'center';
        const icon = document.createElement('canvas');
        icon.width = 72; icon.height = 72;
        this.drawPetIconToCanvas(icon, pet, 72);
        wrap.appendChild(icon);

        const text = document.createElement('div');
        const trait = pet.trait || pet.desc || '-';
        text.innerHTML = `
          <div>${t('ui.pet.trait')}: ${trait}</div>
          <div style="margin-top:6px;">${t('ui.pet.effect')}: ${getPetEffectText(pet)}</div>
        `;
        wrap.appendChild(text);
        root.appendChild(wrap);
      },
      [
        {
          label: state.activePetId === pet.id ? t('ui.pet.unequip') : t('ui.pet.equip'),
          onClick: () => {
            if (state.activePetId === pet.id) this.callbacks.onStopWalk();
            else this.callbacks.onWalkPet(pet.id);
            this.closeTransientViews(state);
            this.renderPetList(state);
          }
        },
        {
          label: 'Close',
          onClick: () => this.closeTransientViews(state)
        }
      ]
    );
  },

  getComputedSellPrice(itemOrId) {
    const fishEntry = arguments.length > 1 ? arguments[1] : null;
    if (fishEntry && typeof fishEntry.unitPrice === 'number') return fishEntry.unitPrice;
    const item = typeof itemOrId === 'string' ? ITEMS[itemOrId] : itemOrId;
    if (!item) return 0;
    if (typeof item.weightG === 'number' && typeof item.pricePerG === 'number') {
      return Math.round(item.weightG * item.pricePerG * (item.rarityMultiplier || 1));
    }
    return item.sellPrice ?? item.price ?? 0;
  },

  getComputedBuyPrice(itemOrId) {
    const item = typeof itemOrId === 'string' ? ITEMS[itemOrId] : itemOrId;
    if (!item) return 0;
    return item.buyPrice ?? 0;
  },

  renderShop(state) {
    const shopList = document.getElementById('shop-list');
    const moneyEl = document.getElementById('shop-money');
    if (!shopList) return;
    const prevWrap = document.getElementById('shop-list-wrap');
    const prevScrollTop = prevWrap ? prevWrap.scrollTop : 0;
    const shopMode = state?.shop?.mode === 'BUY' ? 'BUY' : 'SELL';
    const shopTitle = document.querySelector('#shop-screen h2');
    if (shopTitle) shopTitle.textContent = shopMode === 'BUY' ? '낚시용품점' : '바다코끼리 어시장';

    shopList.innerHTML = '';
    if (moneyEl) moneyEl.textContent = state.money ?? 0;
    const toFishRecord = (entry) => {
      if (typeof entry === 'string') return { itemId: entry, rarity: 'C', weightG: null, unitPrice: null };
      if (entry && typeof entry === 'object') return entry;
      return null;
    };

    const entries = [];
    if (shopMode === 'BUY') {
      Object.values(ITEMS).filter(item => typeof item.buyPrice === 'number').forEach((item) => {
        const price = this.getComputedBuyPrice(item);
        entries.push({
          key: `BUY:${item.id}`,
          item,
          price,
          actionLabel: '구매',
          subtitle: this.getItemEffect(item),
          onAction: (count = 1) => this.callbacks?.onBuyItem?.(item.id, count)
        });
      });
    } else {
      const equippedBagId = state?.equipment?.bagId || null;
      const equippedBag = equippedBagId && state?.bags ? state.bags[equippedBagId] : null;
      const fishList = Array.isArray(equippedBag?.fishes) ? equippedBag.fishes : [];
      const sellableEntries = fishList.map(toFishRecord).filter((entry) => {
        if (!entry) return false;
        const item = ITEMS[entry.itemId];
        return !!item && (item.type === 'FISH' || typeof item.sellPrice === 'number' || typeof item.price === 'number');
      });
      sellableEntries.forEach((entry, idx) => {
        const item = ITEMS[entry.itemId];
        const price = this.getComputedSellPrice(item, entry);
        const weightBase = typeof entry.weightG === 'number' ? entry.weightG : item.weightG;
        const weightLabel = typeof weightBase === 'number' ? `${weightBase}g` : '-';
        const rarityLabel = entry.rarity ? ` [${entry.rarity}]` : '';
        entries.push({
          key: `SELL:${entry.itemId}:${idx}`,
          item,
          price,
          actionLabel: '판매',
          subtitle: `${rarityLabel} ${weightLabel}`.trim(),
          entry,
          onAction: () => this.callbacks?.onSellItem?.(entry)
        });
      });
      const trapEntries = Array.isArray(state?.trapInventory) ? state.trapInventory : [];
      trapEntries.forEach((trap, idx) => {
        const trapItem = ITEMS[trap?.itemId];
        if (!trapItem) return;
        const fishes = Array.isArray(trap?.fishes) ? trap.fishes : [];
        if (fishes.length === 0) return;
        let total = 0;
        fishes.forEach((entry) => {
          const fishItem = ITEMS[entry?.itemId];
          total += this.getComputedSellPrice(fishItem, entry);
        });
        entries.push({
          key: `TRAP:${trap.itemId}:${idx}`,
          item: trapItem,
          price: total,
          actionLabel: '어획 정산',
          subtitle: `통발 어획 ${fishes.length}마리`,
          onAction: () => this.callbacks?.onSellTrap?.(trap)
        });
      });
    }

    if (entries.length && !entries.some((x) => x.key === _shopSelectedKey)) _shopSelectedKey = entries[0].key;
    const selected = entries.find((x) => x.key === _shopSelectedKey) || null;
    const canSellTen = entries.length >= 10;

    shopList.innerHTML = `
      <div class="shop-panel">
        <div class="shop-header">
          <div class="shop-title">${shopMode === 'BUY' ? '낚시용품점' : '바다코끼리 어시장'}</div>
          <div class="shop-header-right">
            <div class="shop-money-badge">${state.money ?? 0}G</div>
          </div>
        </div>
        <div class="shop-body">
          <div id="shop-list-wrap" class="shop-listwrap"></div>
          <div id="shop-detail" class="shop-detail"></div>
        </div>
      </div>
    `;

    const listWrap = shopList.querySelector('#shop-list-wrap');
    const detail = shopList.querySelector('#shop-detail');
    if (!listWrap || !detail) return;

    if (!entries.length) {
      listWrap.innerHTML = `<div class="shop-empty">${shopMode === 'BUY' ? t('ui.shop.empty.buy') : t('ui.shop.empty.sell')}</div>`;
      detail.innerHTML = `
        <div class="shop-detail-top">
          <div class="shop-detail-titlebox">
            <div class="shop-detail-name">아이템을 선택하세요</div>
          </div>
        </div>
        <div class="shop-detail-scroll">
          <div>${shopMode === 'BUY' ? t('ui.shop.empty.buy') : t('ui.shop.empty.sell')}</div>
        </div>
        <div class="shop-detail-actions"></div>
      `;
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `shop-row${entry.key === _shopSelectedKey ? ' selected' : ''}`;
      const rowItem = entry.item;
      const rowEquipped = !!rowItem && (
        (rowItem.equipSlot === 'ROD' && state?.equipment?.rodId === rowItem.id) ||
        (rowItem.equipSlot === 'BAG' && state?.equipment?.bagId === rowItem.id) ||
        (rowItem.equipSlot === 'BAIT' && state?.equipment?.baitId === rowItem.id) ||
        (rowItem.equipSlot === 'CHAIR' && state?.equipment?.chairId === rowItem.id) ||
        (rowItem.equipSlot === 'TRAP' && state?.equipment?.trapId === rowItem.id)
      );
      if (rowEquipped) {
        row.classList.add('equipped', `tier-${this.getVisualTier(rowItem)}`);
      }
      const icon = document.createElement('canvas');
      icon.className = 'shop-row-icon';
      this.drawItemIconToCanvas(icon, entry.item, 28, entry.item?.id);
      const text = document.createElement('div');
      text.className = 'shop-row-text';
      text.innerHTML = `<div class="shop-row-name">${this.getItemName(entry.item)}</div><div class="shop-row-sub">${entry.subtitle || '-'}</div>`;
      const price = document.createElement('div');
      price.className = 'shop-row-price';
      price.textContent = `${entry.price}G`;
      if (rowEquipped) {
        const eq = document.createElement('div');
        eq.className = 'shop-eq-badge';
        eq.textContent = '장착중';
        row.appendChild(eq);
      }
      row.append(icon, text, price);
      row.onclick = () => {
        _shopSelectedKey = entry.key;
        _shopPurchaseCount = 1;
        this.renderShop(state);
      };
      listWrap.appendChild(row);
    });

    const icon = document.createElement('canvas');
    icon.className = 'shop-detail-icon';
    this.drawItemIconToCanvas(icon, selected.item, 72, selected.item?.id);
    const name = this.getItemName(selected.item);
    const selectedEquipped = !!selected.item && (
      (selected.item.equipSlot === 'ROD' && state?.equipment?.rodId === selected.item.id) ||
      (selected.item.equipSlot === 'BAG' && state?.equipment?.bagId === selected.item.id) ||
      (selected.item.equipSlot === 'BAIT' && state?.equipment?.baitId === selected.item.id) ||
      (selected.item.equipSlot === 'CHAIR' && state?.equipment?.chairId === selected.item.id) ||
      (selected.item.equipSlot === 'TRAP' && state?.equipment?.trapId === selected.item.id)
    );
    const desc = this.getItemDesc(selected.item);
    const effect = this.getItemEffect(selected.item);
    const isStackable = !!selected.item && (
      selected.item.type === 'CONSUME'
      || selected.item.type === 'INSTALL'
      || selected.item.equipSlot === 'BAIT'
    );
    detail.innerHTML = `
      <div class="shop-detail-top">
        <div class="shop-detail-iconbox"></div>
        <div class="shop-detail-titlebox">
          <div class="shop-detail-name">${name}${selectedEquipped ? ' [장착중]' : ''}</div>
          <div class="shop-detail-price">${selected.price}G</div>
        </div>
      </div>
      <div class="shop-detail-scroll">
        <div>${desc || '-'}</div>
        <div class="shop-detail-effect">${effect || selected.subtitle || ''}</div>
      </div>
      ${isStackable && shopMode === 'BUY' ? `
      <div class="qty-selector" style="display:flex;align-items:center;justify-content:center;margin-bottom:10px;gap:10px;">
        <button type="button" id="btn-qty-minus" class="btn" style="width:30px;padding:0;">-</button>
        <span id="qty-display" style="font-size:18px;font-weight:bold;min-width:30px;text-align:center;">${_shopPurchaseCount}</span>
        <button type="button" id="btn-qty-plus" class="btn" style="width:30px;padding:0;">+</button>
      </div>
      ` : ''}
      <div class="shop-detail-actions"></div>
    `;
    const iconBox = detail.querySelector('.shop-detail-iconbox');
    if (iconBox) iconBox.appendChild(icon);
    const actions = detail.querySelector('.shop-detail-actions');
    if (actions) {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'btn';
      const updateBtnText = () => {
        const total = selected.price * _shopPurchaseCount;
        actionBtn.textContent = shopMode === 'BUY'
          ? `${selected.actionLabel} (${total}G)`
          : selected.actionLabel;
      };
      updateBtnText();
      actionBtn.onclick = () => selected.onAction?.(_shopPurchaseCount);
      actions.appendChild(actionBtn);
      if (shopMode === 'SELL' && this.callbacks?.onSellTen) {
        const bundleBtn = document.createElement('button');
        bundleBtn.type = 'button';
        bundleBtn.className = 'btn';
        bundleBtn.textContent = 'SELL x10 (+10%)';
        bundleBtn.disabled = !canSellTen;
        bundleBtn.onclick = () => {
          if (canSellTen) this.callbacks.onSellTen();
        };
        actions.appendChild(bundleBtn);
      }
    }
    if (isStackable && shopMode === 'BUY') {
      const qtyDisplay = detail.querySelector('#qty-display');
      const minusBtn = detail.querySelector('#btn-qty-minus');
      const plusBtn = detail.querySelector('#btn-qty-plus');
      if (minusBtn) {
        minusBtn.onclick = () => {
          if (_shopPurchaseCount > 1) {
            _shopPurchaseCount--;
            if (qtyDisplay) qtyDisplay.textContent = String(_shopPurchaseCount);
            const btn = actions.querySelector('.btn');
            if (btn) btn.textContent = `${selected.actionLabel} (${selected.price * _shopPurchaseCount}G)`;
          }
        };
      }
      if (plusBtn) {
        plusBtn.onclick = () => {
          if (_shopPurchaseCount < 99) {
            _shopPurchaseCount++;
            if (qtyDisplay) qtyDisplay.textContent = String(_shopPurchaseCount);
            const btn = actions.querySelector('.btn');
            if (btn) btn.textContent = `${selected.actionLabel} (${selected.price * _shopPurchaseCount}G)`;
          }
        };
      }
    }
    if (prevScrollTop > 0 && listWrap) {
      listWrap.scrollTop = prevScrollTop;
    }
  },

  renderInventory(state) {
    ensureUiState(state);
    const invList = document.getElementById('inventory-list');
    const legacyNameEl = document.getElementById('item-name');
    const legacyDescEl = document.getElementById('item-desc');
    
    if (!invList) return;
    if (legacyNameEl) legacyNameEl.textContent = '';
    if (legacyDescEl) legacyDescEl.textContent = '';

    const inv = Array.isArray(state?.inventory) ? state.inventory : [];
    const maxSlots = 260;
    const bags = (state?.bags && typeof state.bags === 'object') ? state.bags : {};
    const equippedBagId = state?.equipment?.bagId || null;
    const equippedBag = equippedBagId && bags[equippedBagId] ? bags[equippedBagId] : null;
    if (state?.equipment?.baitId && !inv.includes(state.equipment.baitId)) state.equipment.baitId = null;

    const inferTab = (item) => {
      if (!item) return 'ETC';
      if (item.invTab) return item.invTab;
      if (item.type === 'TOOL' || item.equipSlot === 'BAG' || item.equipSlot === 'ROD') return 'EQUIP';
      if (item.type === 'CONSUME') return 'CONSUME';
      if (item.type === 'INSTALL') return 'SETUP';
      if (item.type === 'SETUP') return 'SETUP';
      if (item.type === 'CASH') return 'CASH';
      return 'ETC';
    };

    if (state.ui.fishBagOpen) {
      const openBagId = state.ui.openBagId || equippedBagId;
      const openBag = openBagId && bags[openBagId] ? bags[openBagId] : null;
      const fishInBag = Array.isArray(openBag?.fishes) ? openBag.fishes : [];
      const bagCounts = new Map();
      fishInBag.forEach((entry) => {
        const fishId = typeof entry === 'string' ? entry : entry?.itemId;
        if (!fishId) return;
        bagCounts.set(fishId, (bagCounts.get(fishId) || 0) + 1);
      });
      const bagItems = Array.from(bagCounts.entries()).map(([itemId, qty]) => ({ itemId, qty, item: ITEMS[itemId] || null }));
      if (state.ui.selectedInvIndex != null && (state.ui.selectedInvIndex < 0 || state.ui.selectedInvIndex >= bagItems.length)) {
        state.ui.selectedInvIndex = null;
      }

      invList.innerHTML = `
        <div id="inventoryPanel" class="inventory-panel">
          <div class="inventory-panel-inner">
            <div class="inv-header">
              <span class="inv-title">${t('ui.inventory.fishBag')}</span>
              <span class="inv-count">${fishInBag.length}/${openBag?.capacity || 0}</span>
              <button type="button" data-action="close-bag" class="inv-close">↩</button>
            </div>
            <div class="inv-body">
              <div class="inv-left">
                <div id="invGridScroll" class="inv-grid-scroll">
                  <div id="invGrid" class="inv-grid"></div>
                </div>
              </div>
              <div class="inv-right">
                <div id="invDetail" class="inv-detail"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const backBtn = invList.querySelector('[data-action="close-bag"]');
      if (backBtn) {
        backBtn.onclick = () => {
          state.ui.fishBagOpen = false;
          state.ui.openBagId = null;
          state.ui.selectedInvIndex = null;
          this.renderInventory(state);
        };
      }

      const gridRoot = invList.querySelector('#invGrid');
      const detailRoot = invList.querySelector('#invDetail');
      if (!gridRoot || !detailRoot) return;

      if (bagItems.length === 0) {
        detailRoot.textContent = t('ui.shop.empty.sell');
        return;
      }

      bagItems.forEach((entry, idx) => {
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        if (state.ui.selectedInvIndex === idx) slot.classList.add('selected');
        if (entry.item) {
          const icon = document.createElement('canvas');
          icon.className = 'inv-icon';
          this.drawItemIconToCanvas(icon, entry.item, 40, entry.itemId);
          slot.appendChild(icon);
        }
        if (entry.qty > 1) {
          const qty = document.createElement('div');
          qty.className = 'inv-qty';
          qty.textContent = `${entry.qty}`;
          slot.appendChild(qty);
        }
        slot.onclick = () => {
          state.ui.selectedInvIndex = idx;
          state.ui.selectedInvId = entry.itemId;
          this.renderInventory(state);
        };
        gridRoot.appendChild(slot);
      });

      const selected = state.ui.selectedInvIndex == null ? null : bagItems[state.ui.selectedInvIndex];
      if (!selected?.item) {
        detailRoot.textContent = '아이템을 선택하세요';
        return;
      }
      const big = document.createElement('canvas');
      big.className = 'icon';
      this.drawItemIconToCanvas(big, selected.item, 88, selected.itemId);
      detailRoot.innerHTML = `
        <div class="inv-detail-header">
          <div id="invDetailName" class="inv-detail-name"></div>
          <div id="invDetailFlags" class="inv-detail-flags"></div>
        </div>
        <div class="inv-detail-main">
          <div id="invDetailIconBox" class="inv-detail-iconbox"></div>
          <div class="inv-detail-meta">
            <div id="invDetailBodyScroll" class="inv-detail-scroll inv-detail-descwrap">
              <div id="invDetailDesc" class="inv-detail-desc"></div>
              <div id="invDetailExtra" class="inv-detail-extra"></div>
            </div>
            <div id="invDetailActions" class="inv-detail-actions"></div>
          </div>
        </div>
      `;
      const detailNameEl = detailRoot.querySelector('#invDetailName');
      const detailFlagsEl = detailRoot.querySelector('#invDetailFlags');
      const detailIconBoxEl = detailRoot.querySelector('#invDetailIconBox');
      const detailDescEl = detailRoot.querySelector('#invDetailDesc');
      const detailExtraEl = detailRoot.querySelector('#invDetailExtra');
      if (detailNameEl) detailNameEl.textContent = this.getItemName(selected.item);
      if (detailFlagsEl) detailFlagsEl.textContent = `[x${selected.qty || 1}]`;
      if (detailIconBoxEl) detailIconBoxEl.appendChild(big);
      if (detailDescEl) detailDescEl.textContent = this.getItemDesc(selected.item);
      if (detailExtraEl) detailExtraEl.textContent = '';
      return;
    }

    const counts = new Map();
    inv.forEach((itemId) => {
      counts.set(itemId, (counts.get(itemId) || 0) + 1);
    });
    const stacked = Array.from(counts.entries()).map(([itemId, qty]) => ({ itemId, qty, item: ITEMS[itemId] || null }));
    const filteredItems = stacked.filter(({ item }) => {
      if (!item) return state.ui.invTab === 'ALL' || state.ui.invTab === 'ETC';
      if (item.type === 'FISH') return false;
      return state.ui.invTab === 'ALL' || inferTab(item) === state.ui.invTab;
    });

    if (state.ui.selectedInvIndex != null && (state.ui.selectedInvIndex < 0 || state.ui.selectedInvIndex >= filteredItems.length)) {
      state.ui.selectedInvIndex = null;
    }

    invList.innerHTML = `
      <div id="inventoryPanel" class="inventory-panel">
        <div class="inventory-panel-inner">
          <div class="inv-header">
            <span class="inv-title">ITEM INVENTORY</span>
            <span class="inv-count">${stacked.length}/${maxSlots}</span>
            <button type="button" data-action="close-inventory" class="inv-close">✕</button>
          </div>
          <div class="inv-tabs">
            <button type="button" data-inv-tab="ALL">ALL</button>
            <button type="button" data-inv-tab="EQUIP">장비</button>
            <button type="button" data-inv-tab="CONSUME">소비</button>
            <button type="button" data-inv-tab="SETUP">설치</button>
            <button type="button" data-inv-tab="ETC">기타</button>
            <button type="button" data-inv-tab="CASH">캐시</button>
          </div>
          <div class="inv-body">
            <div class="inv-left">
              <div id="invGridScroll" class="inv-grid-scroll">
                <div id="invGrid" class="inv-grid"></div>
              </div>
            </div>
            <div class="inv-right">
              <div id="invDetail" class="inv-detail"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = invList.querySelector('[data-action="close-inventory"]');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.toggleInventory(false, state);
        state.mode = MODES.EXPLORE;
      };
    }

    const tabButtons = Array.from(invList.querySelectorAll('[data-inv-tab]'));
    tabButtons.forEach((btn) => {
      const tabId = btn.getAttribute('data-inv-tab');
      if (tabId === state.ui.invTab) btn.classList.add('active');
      btn.onclick = () => {
        state.ui.invTab = tabId || 'ALL';
        state.ui.selectedInvIndex = null;
        this.renderInventory(state);
      };
    });

    const gridRoot = invList.querySelector('#invGrid');
    const detailRoot = invList.querySelector('#invDetail');
    if (!gridRoot || !detailRoot) return;

    if (filteredItems.length === 0) {
      detailRoot.textContent = t('ui.inventory.empty');
    }

    filteredItems.forEach((entry, idx) => {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      if (state.ui.selectedInvIndex === idx) slot.classList.add('selected');
      const item = entry.item;
      const isEquippedRod = !!item && item.equipSlot === 'ROD' && state?.equipment?.rodId === entry.itemId;
      const isEquippedBag = !!item && item.equipSlot === 'BAG' && state?.equipment?.bagId === entry.itemId;
      const isEquippedBait = !!item && item.equipSlot === 'BAIT' && state?.equipment?.baitId === entry.itemId;
      const isEquippedChair = !!item && item.equipSlot === 'CHAIR' && state?.equipment?.chairId === entry.itemId;
      const isEquippedTrap = !!item && item.equipSlot === 'TRAP' && state?.equipment?.trapId === entry.itemId;
      const isEquipped = isEquippedRod || isEquippedBag || isEquippedBait || isEquippedChair || isEquippedTrap;
      if (isEquipped) {
        slot.classList.add('equipped', `tier-${this.getVisualTier(item)}`);
        const badge = document.createElement('div');
        badge.textContent = 'E';
        badge.style.position = 'absolute';
        badge.style.left = '4px';
        badge.style.top = '4px';
        badge.style.fontSize = '11px';
        badge.style.padding = '1px 4px';
        badge.style.borderRadius = '4px';
        badge.style.background = 'rgba(241,196,15,0.85)';
        badge.style.color = '#1f1f1f';
        slot.appendChild(badge);
      }

      if (item) {
        const icon = document.createElement('canvas');
        icon.className = 'inv-icon';
        this.drawItemIconToCanvas(icon, item, 40, entry.itemId);
        slot.appendChild(icon);
      } else {
        slot.textContent = '?';
      }

      if (entry.qty > 1) {
        const qty = document.createElement('div');
        qty.className = 'inv-qty';
        qty.textContent = `${entry.qty}`;
        slot.appendChild(qty);
      }

      slot.onclick = () => {
        state.ui.selectedInvIndex = idx;
        state.ui.selectedInvId = entry.itemId;
        this.renderInventory(state);
      };
      slot.ondblclick = () => {
        if (!entry.item || (entry.item.equipSlot !== 'BAIT' && entry.item.equipSlot !== 'CHAIR' && entry.item.equipSlot !== 'BAG' && entry.item.equipSlot !== 'TRAP')) return;
        if (!state.equipment || typeof state.equipment !== 'object') state.equipment = { rodId: null, bagId: null, baitId: null, chairId: null, trapId: null };
        if (entry.item.equipSlot === 'BAG') {
          state.equipment.bagId = entry.itemId;
          if (!state.bags || typeof state.bags !== 'object') state.bags = {};
          if (!state.bags[entry.itemId]) {
            state.bags[entry.itemId] = {
              capacity: entry.item.bagCapacity || entry.item.capacity || 10,
              fishes: []
            };
          }
          this.callbacks?.onInventoryChanged?.();
          this.renderInventory(state);
          return;
        }
        if (entry.item.equipSlot === 'CHAIR') {
          state.equipment.chairId = state.equipment.chairId === entry.itemId ? null : entry.itemId;
          this.callbacks?.onInventoryChanged?.();
          this.renderInventory(state);
          return;
        }
        if (entry.item.equipSlot === 'TRAP') {
          state.equipment.trapId = state.equipment.trapId === entry.itemId ? null : entry.itemId;
          this.callbacks?.onInventoryChanged?.();
          this.renderInventory(state);
          return;
        }
        if (state.equipment.baitId === entry.itemId) {
          state.equipment.baitId = null;
          this.callbacks?.onInventoryChanged?.();
          this.renderInventory(state);
          return;
        }
        if ((entry.qty || 0) <= 0) {
          this.showDialog('미끼가 없습니다');
          setTimeout(() => this.hideDialog(), 700);
          return;
        }
        state.equipment.baitId = entry.itemId;
        this.callbacks?.onInventoryChanged?.();
        this.renderInventory(state);
      };
      gridRoot.appendChild(slot);
    });

    const selected = state.ui.selectedInvIndex == null ? null : filteredItems[state.ui.selectedInvIndex];
    detailRoot.innerHTML = '';
    if (!selected) {
      detailRoot.textContent = '아이템을 선택하세요';
      return;
    }

    const item = selected.item;
    if (!item) {
      detailRoot.textContent = `[Unknown Item: ${selected.itemId}]`;
      return;
    }

    const big = document.createElement('canvas');
    big.className = 'icon';
    this.drawItemIconToCanvas(big, item, 88, selected.itemId);

    const desc = document.createElement('div');
    desc.className = 'inv-detail-desc';
    desc.textContent = this.getItemDesc(item);

    const extra = document.createElement('div');
    extra.className = 'inv-detail-extra';
    const baitId = state?.equipment?.baitId || null;
    const baitCount = baitId && Array.isArray(state?.inventory) ? state.inventory.filter((id) => id === baitId).length : 0;
    const equippedRod = state?.equipment?.rodId ? ITEMS[state.equipment.rodId] : null;
    const equippedBagMeta = state?.equipment?.bagId ? ITEMS[state.equipment.bagId] : null;
    const equippedChair = state?.equipment?.chairId ? ITEMS[state.equipment.chairId] : null;
    const equippedTrap = state?.equipment?.trapId ? ITEMS[state.equipment.trapId] : null;
    const equippedLine = document.createElement('div');
    equippedLine.textContent = `현재 낚싯대: ${equippedRod ? this.getItemName(equippedRod) : '없음'} | 현재 가방: ${equippedBagMeta ? this.getItemName(equippedBagMeta) : '없음'} | 현재 미끼: ${baitId ? `${this.getItemName(baitId)} (${baitCount})` : '없음'} | 현재 의자: ${equippedChair ? this.getItemName(equippedChair) : '없음'} | 현재 통발: ${equippedTrap ? this.getItemName(equippedTrap) : '없음'}`;
    extra.appendChild(equippedLine);
    const infoLine = document.createElement('div');
    const equipState = item.equipSlot === 'ROD' ? (state?.equipment?.rodId === selected.itemId ? ' [장착중]' : '')
      : item.equipSlot === 'BAG' ? (state?.equipment?.bagId === selected.itemId ? ' [장착중]' : '')
      : item.equipSlot === 'BAIT' ? (state?.equipment?.baitId === selected.itemId ? ' [활성]' : '')
      : item.equipSlot === 'CHAIR' ? (state?.equipment?.chairId === selected.itemId ? ' [장착중]' : '')
      : item.equipSlot === 'TRAP' ? (state?.equipment?.trapId === selected.itemId ? ' [장착중]' : '')
      : '';
    const bagText = item.equipSlot === 'BAG'
      ? ` ${t('ui.inventory.fishBagCapacity', { cur: Array.isArray(state?.bags?.[selected.itemId]?.fishes) ? state.bags[selected.itemId].fishes.length : 0, cap: state?.bags?.[selected.itemId]?.capacity || item.bagCapacity || item.capacity || 0 })}`
      : '';
    infoLine.textContent = `Type: ${item.type || 'ITEM'}${equipState}${bagText}`;
    extra.appendChild(infoLine);
    if (item.equipSlot === 'BAIT') {
      const baitRemain = Array.isArray(state?.inventory) ? state.inventory.filter((id) => id === selected.itemId).length : 0;
      const rodId = state?.equipment?.rodId || state?.equippedToolId || null;
      const rodTier = rodId && ITEMS[rodId] ? (ITEMS[rodId].tier || 1) : 1;
      const rodCap = rodTier >= 3 ? 'SS' : rodTier >= 2 ? 'S' : 'A';
      const baitSummary = document.createElement('div');
      baitSummary.textContent = `효과: min ${item.minRarity || 'C'} (rod cap ${rodCap}) / shift +${Math.round((item.rarityShift || item?.baitEffect?.value || 0) * 100)}%, 잔여 ${baitRemain}`;
      extra.appendChild(baitSummary);
    }

    const actions = document.createElement('div');
    actions.className = 'inv-detail-actions';
    if (item.equipSlot === 'ROD') {
      const equipBtn = document.createElement('button');
      equipBtn.type = 'button';
      equipBtn.className = 'btn';
      equipBtn.textContent = '장착';
      equipBtn.onclick = () => {
        if (!state.equipment || typeof state.equipment !== 'object') state.equipment = { rodId: null, bagId: null, baitId: null, chairId: null, trapId: null };
        state.equipment.rodId = selected.itemId;
        state.equippedToolId = selected.itemId;
        this.callbacks?.onInventoryChanged?.();
        this.renderInventory(state);
      };
      actions.appendChild(equipBtn);
    }
    if (item.equipSlot === 'BAG') {
      const equipBagBtn = document.createElement('button');
      equipBagBtn.type = 'button';
      equipBagBtn.className = 'btn';
      equipBagBtn.textContent = '장착';
      equipBagBtn.onclick = () => {
        if (!state.equipment || typeof state.equipment !== 'object') state.equipment = { rodId: null, bagId: null, baitId: null, chairId: null, trapId: null };
        state.equipment.bagId = selected.itemId;
        if (!state.bags || typeof state.bags !== 'object') state.bags = {};
        if (!state.bags[selected.itemId]) {
          state.bags[selected.itemId] = {
            capacity: item.bagCapacity || item.capacity || 10,
            fishes: []
          };
        }
        this.callbacks?.onInventoryChanged?.();
        this.renderInventory(state);
      };
      actions.appendChild(equipBagBtn);
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn';
      openBtn.textContent = t('ui.inventory.fishBag');
      openBtn.onclick = () => {
        state.ui.fishBagOpen = true;
        state.ui.openBagId = selected.itemId;
        state.ui.selectedInvIndex = null;
        this.renderInventory(state);
      };
      actions.appendChild(openBtn);
    }
    if (item.equipSlot === 'BAIT') {
      const activateBtn = document.createElement('button');
      activateBtn.type = 'button';
      activateBtn.className = 'btn';
      const isActiveBait = state?.equipment?.baitId === selected.itemId;
      activateBtn.textContent = isActiveBait ? '활성 해제' : '미끼 활성';
      activateBtn.onclick = () => {
        if (!state.equipment || typeof state.equipment !== 'object') state.equipment = { rodId: null, bagId: null, baitId: null, chairId: null, trapId: null };
        if (state.equipment.baitId === selected.itemId) {
          state.equipment.baitId = null;
        } else {
          state.equipment.baitId = selected.itemId;
        }
        this.callbacks?.onInventoryChanged?.();
        this.renderInventory(state);
      };
      actions.appendChild(activateBtn);
    }
    if (item.equipSlot === 'CHAIR') {
      const equipChairBtn = document.createElement('button');
      equipChairBtn.type = 'button';
      equipChairBtn.className = 'btn';
      equipChairBtn.textContent = state?.equipment?.chairId === selected.itemId ? '해제' : '장착';
      equipChairBtn.onclick = () => {
        if (!state.equipment || typeof state.equipment !== 'object') state.equipment = { rodId: null, bagId: null, baitId: null, chairId: null, trapId: null };
        state.equipment.chairId = state.equipment.chairId === selected.itemId ? null : selected.itemId;
        this.callbacks?.onInventoryChanged?.();
        this.renderInventory(state);
      };
      actions.appendChild(equipChairBtn);
    }
    if (item.equipSlot === 'TRAP') {
      const equipTrapBtn = document.createElement('button');
      equipTrapBtn.type = 'button';
      equipTrapBtn.className = 'btn';
      equipTrapBtn.textContent = state?.equipment?.trapId === selected.itemId ? '해제' : '장착';
      equipTrapBtn.onclick = () => {
        if (!state.equipment || typeof state.equipment !== 'object') state.equipment = { rodId: null, bagId: null, baitId: null, chairId: null, trapId: null };
        state.equipment.trapId = state.equipment.trapId === selected.itemId ? null : selected.itemId;
        this.callbacks?.onInventoryChanged?.();
        this.renderInventory(state);
      };
      actions.appendChild(equipTrapBtn);
    }

    detailRoot.innerHTML = `
      <div class="inv-detail-header">
        <div id="invDetailName" class="inv-detail-name"></div>
        <div id="invDetailFlags" class="inv-detail-flags"></div>
      </div>
      <div class="inv-detail-main">
        <div id="invDetailIconBox" class="inv-detail-iconbox"></div>
        <div class="inv-detail-meta">
          <div id="invDetailBodyScroll" class="inv-detail-scroll inv-detail-descwrap">
            <div id="invDetailDesc" class="inv-detail-desc"></div>
            <div id="invDetailExtra" class="inv-detail-extra"></div>
          </div>
          <div id="invDetailActions" class="inv-detail-actions"></div>
        </div>
      </div>
    `;
    const detailNameEl = detailRoot.querySelector('#invDetailName');
    const detailFlagsEl = detailRoot.querySelector('#invDetailFlags');
    const detailIconBoxEl = detailRoot.querySelector('#invDetailIconBox');
    const detailDescEl = detailRoot.querySelector('#invDetailDesc');
    const detailExtraEl = detailRoot.querySelector('#invDetailExtra');
    const detailActionsEl = detailRoot.querySelector('#invDetailActions');
    if (detailNameEl) detailNameEl.textContent = this.getItemName(item);
    if (detailFlagsEl) detailFlagsEl.textContent = equipState ? equipState.trim() : '';
    if (detailIconBoxEl) detailIconBoxEl.appendChild(big);
    if (detailDescEl) detailDescEl.textContent = desc.textContent;
    if (detailExtraEl) {
      detailExtraEl.innerHTML = '';
      detailExtraEl.append(...Array.from(extra.childNodes));
    }
    if (detailActionsEl) detailActionsEl.append(...Array.from(actions.children));
  }

};

