import { MODES, TILE_SIZE, FISH_RARITY_MULTIPLIERS, FISH_RARITY_ORDER } from '../core/constants.js';
import { isWalkable, getTileType, getTileCharAt, isWaterAt, isNearPOI, getWaterRegion, isFarmableTile } from './map.js';
import { RNG } from '../core/rng.js';
import { t } from '../core/i18n.js';
import { getPetById, getSpawnablePets } from '../data/pets.js'; // [Changed] ??덉쨮?????怨쀬뵠??嚥≪뮇彛?import
import { getItem, getFishLootTable } from '../data/items.js';
import { QUESTS, QUESTS_BY_ID } from '../data/quests.js';
import { Pet } from './entities.js';
import { migrateInventory, invHas, invCount, invAdd, invRemove, invFind } from '../core/inventoryHelper.js';

// [Strategy] ?袁⑥쟿??Frame) 疫꿸퀡而???袁⑤빒 ??볦퍢(Time) 疫꿸퀡而???猷???뽯선
// 160ms = ??0.16?λ뜄彛????燁???猷?(??댭???쥓?ㅿ쭪????癒?봺筌왖????? ??얜즲)
const MOVE_DELAY_MS = 160;
let lastMoveTime = 0;
const FISH_LOOT_TABLES = {
  TIER1: [
    { id: 'fish_minnow', prob: 60 },
    { id: 'fish_perch', prob: 40 }
  ],
  TIER2: [
    { id: 'fish_minnow', prob: 45 },
    { id: 'fish_perch', prob: 35 },
    { id: 'fish_carp', prob: 20 }
  ],
  TIER3: [
    { id: 'fish_minnow', prob: 34 },
    { id: 'fish_perch', prob: 28 },
    { id: 'fish_carp', prob: 20 },
    { id: 'fish_catfish', prob: 12 },
    { id: 'fish_golden_koi', prob: 6 }
  ]
};
const ROD_RARITY_WEIGHTS = {
  1: { C: 70, B: 25, A: 5, S: 0, SS: 0 },
  2: { C: 40, B: 40, A: 18, S: 2, SS: 0 },
  3: { C: 0, B: 55, A: 35, S: 9, SS: 1 }
};
const RARITY_TO_FISH_TIERS = {
  C: new Set(['COMMON']),
  B: new Set(['COMMON', 'UNCOMMON']),
  A: new Set(['COMMON', 'UNCOMMON', 'RARE']),
  S: new Set(['UNCOMMON', 'RARE', 'EPIC']),
  SS: new Set(['RARE', 'EPIC'])
};
const FISH_POOLS_BY_RARITY = {
  C: ['fish_minnow', 'fish_perch'],
  B: ['fish_perch', 'fish_trout', 'fish_carp'],
  A: ['fish_carp', 'fish_bass', 'fish_catfish'],
  S: ['fish_catfish', 'fish_mackerel', 'fish_golden_koi'],
  SS: ['fish_tuna', 'fish_golden_koi']
};
const ROD_RARITY_CAPS = {
  1: 'B',
  2: 'A',
  3: 'S'
};
const BAIT_EFFECTS = {
  basic: { bonusWeight: 0, multiplier: 1.0 },
  worm: { regionBoost: 'upstream', multiplier: 1.3 },
  shrimp: { regionBoost: 'sea', multiplier: 1.4 },
  premium: { rarityFloor: 'B', multiplier: 1.2 }
};

function getEquippedRodTier(state) {
  const rodId = state?.equipment?.rodId || state.equippedToolId;
  const equipped = getItem(rodId);
  if (equipped && equipped.toolKind === 'FISHING_ROD') return equipped.tier || 1;
  return 0;
}

function getEquippedRodInfo(state) {
  const rodId = state?.equipment?.rodId || state?.equippedToolId || null;
  const equipped = getItem(rodId);
  if (equipped && equipped.toolKind === 'FISHING_ROD') {
    return { rodId, tier: equipped.tier || 1 };
  }
  return { rodId, tier: 0 };
}

function getTierFishTable(tier) {
  if (tier >= 3) return { name: 'TIER3', table: FISH_LOOT_TABLES.TIER3 };
  if (tier >= 2) return { name: 'TIER2', table: FISH_LOOT_TABLES.TIER2 };
  return { name: 'TIER1', table: FISH_LOOT_TABLES.TIER1 };
}

function normalizeWeights(weights) {
  const out = {};
  let sum = 0;
  FISH_RARITY_ORDER.forEach((k) => {
    out[k] = Math.max(0, Number(weights?.[k] || 0));
    sum += out[k];
  });
  if (sum <= 0) return { C: 100, B: 0, A: 0, S: 0, SS: 0 };
  const scale = 100 / sum;
  FISH_RARITY_ORDER.forEach((k) => {
    out[k] = out[k] * scale;
  });
  return out;
}

function shiftWeight(weights, from, to, ratio) {
  const available = Math.max(0, weights[from] || 0);
  const move = available * Math.max(0, ratio);
  weights[from] = Math.max(0, available - move);
  weights[to] = Math.max(0, (weights[to] || 0) + move);
}

function getRodRarityWeights(tier) {
  return normalizeWeights(ROD_RARITY_WEIGHTS[Math.max(1, Math.min(3, tier || 1))] || ROD_RARITY_WEIGHTS[1]);
}

function applyPetLuckToWeights(weights, petSkillValue) {
  const out = { ...weights };
  const luck = Math.max(0, petSkillValue || 0);
  if (luck <= 0) return normalizeWeights(out);
  shiftWeight(out, 'C', 'B', luck);
  shiftWeight(out, 'B', 'A', luck * 0.85);
  shiftWeight(out, 'A', 'S', luck * 0.7);
  shiftWeight(out, 'S', 'SS', luck * 0.5);
  return normalizeWeights(out);
}

function getBaitCount(state, baitId) {
  if (!baitId || !Array.isArray(state?.inventory)) return 0;
  return invCount(state.inventory, baitId);
}

function getActiveBaitBuff(state) {
  const baitId = state?.equipment?.baitId || null;
  const bait = baitId ? getItem(baitId) : null;
  const count = getBaitCount(state, baitId);
  if (!bait || count <= 0) {
    return { baitId: null, shift: 0, minRarity: null, count: 0, baitType: 'basic', effect: BAIT_EFFECTS.basic };
  }
  const baitType = bait.baitType || 'basic';
  const effect = BAIT_EFFECTS[baitType] || BAIT_EFFECTS.basic;
  const shiftBase = typeof bait.rarityShift === 'number' ? bait.rarityShift : (bait?.baitEffect?.value || 0);
  return {
    baitId,
    shift: Math.max(0, Math.min(0.25, shiftBase)),
    minRarity: bait.minRarity || effect.rarityFloor || null,
    count,
    baitType,
    effect
  };
}

function applyBaitToWeights(weights, baitShiftValue) {
  const out = { ...weights };
  const shift = Math.max(0, Math.min(0.25, baitShiftValue || 0));
  if (shift <= 0) return normalizeWeights(out);
  shiftWeight(out, 'C', 'B', shift);
  shiftWeight(out, 'B', 'A', shift * 0.95);
  shiftWeight(out, 'A', 'S', shift * 0.8);
  shiftWeight(out, 'S', 'SS', shift * 0.6);
  return normalizeWeights(out);
}

function consumeActiveBait(state, showDialog) {
  const baitId = state?.equipment?.baitId;
  if (!baitId || !Array.isArray(state?.inventory)) return;
  invRemove(state.inventory, baitId, 1);
  const remaining = invCount(state.inventory, baitId);
  if (remaining <= 0) {
    state.equipment.baitId = null;
    if (showDialog) {
      showDialog('미끼가 떨어졌습니다! 낚시를 계속하려면 상점을 이용하세요.', '#e74c3c');
    }
  }
}

function getRarityIndex(rarity) {
  return FISH_RARITY_ORDER.indexOf(rarity);
}

function applyRarityCap(weights, maxRarity) {
  const out = { ...weights };
  const capIdx = getRarityIndex(maxRarity);
  if (capIdx < 0) return normalizeWeights(out);
  let overflow = 0;
  FISH_RARITY_ORDER.forEach((rarity, idx) => {
    if (idx > capIdx) {
      overflow += Math.max(0, out[rarity] || 0);
      out[rarity] = 0;
    }
  });
  out[maxRarity] = Math.max(0, (out[maxRarity] || 0) + overflow);
  return normalizeWeights(out);
}

function applyRarityFloor(weights, minRarity) {
  const out = { ...weights };
  const floorIdx = getRarityIndex(minRarity);
  if (floorIdx < 0) return normalizeWeights(out);
  let underflow = 0;
  FISH_RARITY_ORDER.forEach((rarity, idx) => {
    if (idx < floorIdx) {
      underflow += Math.max(0, out[rarity] || 0);
      out[rarity] = 0;
    }
  });
  out[minRarity] = Math.max(0, (out[minRarity] || 0) + underflow);
  return normalizeWeights(out);
}

function pickRarity(weights) {
  const weighted = FISH_RARITY_ORDER.map((tier) => ({ tier, prob: Math.max(0, weights[tier] || 0) }));
  return RNG.pickWeighted(weighted).tier;
}

function getActivePetFishingBuff(state) {
  const pet = state?.activePetId ? getPetById(state.activePetId) : null;
  return {
    petId: pet?.id || null,
    luck: pet?.skillType === 'FISHING_LUCK' ? Math.max(0, pet.skillValue || 0) : 0,
    weight: pet?.skillType === 'FISHING_WEIGHT' ? Math.max(0, pet.skillValue || 0) : 0
  };
}

function pickFishByRarityAndTier(rodTier, rarity, region = 'midstream', baitBuff = null) {
  const poolIds = FISH_POOLS_BY_RARITY[rarity] || FISH_POOLS_BY_RARITY.C;
  const cap = ROD_RARITY_CAPS[Math.max(1, Math.min(3, rodTier || 1))] || 'B';
  const capRank = getRarityIndex(cap);
  const floorRank = baitBuff?.effect?.rarityFloor ? getRarityIndex(baitBuff.effect.rarityFloor) : -1;
  const tierTable = getTierFishTable(rodTier);
  const tierWeights = new Map((tierTable?.table || []).map((entry) => [entry.id, entry.prob || 1]));

  const weightedPool = getFishLootTable()
    .filter((fish) => fish.region === region)
    .filter((fish) => (fish.requiredRodTier || 1) <= (rodTier || 1))
    .filter((fish) => {
      const fishRank = getRarityIndex(fish.rarity || 'C');
      if (fishRank < 0) return false;
      if (floorRank >= 0 && fishRank < floorRank) return false;
      if (fishRank <= capRank) return true;
      return rodTier >= 3 && (fish.rarity === 'SS') && (region === 'sea' || region === 'downstream');
    })
    .map((fish) => {
      let prob = tierWeights.get(fish.id) || fish.prob || 1;
      if (poolIds.includes(fish.id)) prob *= 1.35;
      if (!poolIds.includes(fish.id)) prob *= 0.82;
      if (baitBuff?.baitType && fish.preferredBaitType && baitBuff.baitType === fish.preferredBaitType) prob *= 1.5;
      if (baitBuff?.effect?.regionBoost && baitBuff.effect.regionBoost === region) prob *= (baitBuff.effect.multiplier || 1);
      if (baitBuff?.effect?.multiplier && baitBuff.baitType === 'premium') prob *= baitBuff.effect.multiplier;
      if (fish.rarity === 'SS' && rodTier >= 3) prob *= ((region === 'sea' || region === 'downstream') ? 0.28 : 0.12);
      return { id: fish.id, prob: Math.max(0.01, prob) };
    });

  if (weightedPool.length > 0) {
    const picked = RNG.pickWeighted(weightedPool);
    return picked ? getItem(picked.id) : null;
  }

  const fallbackByTier = (tierTable?.table || [])
    .map((entry) => ({ id: entry.id, prob: entry.prob || 1 }))
    .filter((entry) => !!getItem(entry.id));
  if (fallbackByTier.length > 0) {
    const picked = RNG.pickWeighted(fallbackByTier);
    return picked ? getItem(picked.id) : null;
  }

  const any = getFishLootTable();
  return any.length > 0 ? any[RNG.range(0, any.length - 1)] : null;
}

function rollFishWeight(baseWeight, petWeightBonus) {
  const minMul = 0.6;
  const maxMul = 1.8;
  const mul = minMul + (maxMul - minMul) * RNG.float();
  const boosted = mul * (1 + Math.max(0, petWeightBonus || 0));
  return Math.max(1, Math.round((baseWeight || 100) * boosted));
}

function computeCatchPrice(fishItem, weightG, rarity) {
  if (!fishItem) return 0;
  const perG = typeof fishItem.pricePerG === 'number' ? fishItem.pricePerG : null;
  const base = perG != null ? Math.round(weightG * perG) : (fishItem.sellPrice || fishItem.price || 0);
  // If economy inflates too hard, lower SS multiplier from 4.0 to 3.0 as fallback.
  const mult = FISH_RARITY_MULTIPLIERS[rarity] || 1.0;
  return Math.max(1, Math.round(base * mult));
}

function getFishingContext(state, player) {
  const target = { tx: player.tx, ty: player.ty };
  if (player.facing === 'left') target.tx--;
  else if (player.facing === 'right') target.tx++;
  else if (player.facing === 'up') target.ty--;
  else if (player.facing === 'down') target.ty++;

  const frontCh = getTileCharAt(target.tx, target.ty);
  const currentCh = getTileCharAt(player.tx, player.ty);
  const standingOnBridge = currentCh === 'B' || currentCh === 'Z';
  const frontIsWater = isWaterAt(target.tx, target.ty);
  const nearWater = standingOnBridge || frontIsWater
    || isWaterAt(player.tx, player.ty - 1)
    || isWaterAt(player.tx, player.ty + 1)
    || isWaterAt(player.tx - 1, player.ty)
    || isWaterAt(player.tx + 1, player.ty);

  const hasRod = Array.isArray(state.inventory) && state.inventory.some(e => {
    const item = getItem(e.itemId || e);
    return item && item.toolKind === 'FISHING_ROD';
  });
  const hasEquippedRod = getEquippedRodTier(state) > 0;
  const region = getWaterRegion(player.tx, player.ty);

  return { targetTx: target.tx, targetTy: target.ty, frontCh, frontIsWater, nearWater, hasRod, hasEquippedRod, region };
}

function getFishingStartGate(state, player, includeCooldown = true) {
  if (!player || state.mode !== MODES.EXPLORE) return "MODE_BLOCK";
  if (includeCooldown && state.fishingCooldown && state.fishingCooldown > 0) return "COOLDOWN";
  const ctx = getFishingContext(state, player);
  if (!ctx.hasRod || !ctx.hasEquippedRod) return "NO_TOOL";
  if (!ctx.frontIsWater) return ctx.nearWater ? "NOT_FACING_WATER" : "NOT_NEAR_WATER";
  return "OK";
}

function ensureSeatState(state) {
  if (!state.seat || typeof state.seat !== 'object') {
    state.seat = {
      isSeated: false,
      chairPlaced: false,
      chairPos: { x: 0, y: 0 },
      autoFishing: false,
      autoTimer: 0,
      bagFullWarn: false
    };
  }
}

function ensureBagsState(state) {
  if (!state.bags || typeof state.bags !== 'object') state.bags = {};
  if (!state.bags.starter_bag) state.bags.starter_bag = { capacity: 10, fishes: [] };
  Object.keys(state.bags).forEach((bagId) => {
    const bag = state.bags[bagId];
    if (!bag || typeof bag !== 'object') {
      state.bags[bagId] = { capacity: 10, fishes: [] };
      return;
    }
    if (!Array.isArray(bag.fishes)) bag.fishes = [];
    if (typeof bag.capacity !== 'number') {
      const meta = getItem(bagId);
      bag.capacity = meta?.bagCapacity || meta?.capacity || 10;
    }
  });
  if (!state.equipment || typeof state.equipment !== 'object') state.equipment = {};
  if (!state.equipment.bagId) state.equipment.bagId = 'starter_bag';
  if (!state.bags[state.equipment.bagId]) {
    const meta = getItem(state.equipment.bagId);
    state.bags[state.equipment.bagId] = {
      capacity: meta?.bagCapacity || meta?.capacity || 10,
      fishes: []
    };
  }
}

function ensureTrapState(state) {
  if (!Array.isArray(state.traps)) state.traps = [];
  if (!Array.isArray(state.trapInventory)) state.trapInventory = [];
}

function getTrapCapacityByItem(itemId) {
  const item = getItem(itemId);
  return Number(item?.trapCapacity || (itemId === 'bait_lure' ? 30 : itemId === 'bait_hook' ? 20 : 10));
}

function isTrapItem(itemId) {
  const item = getItem(itemId);
  return !!item && item.equipSlot === 'TRAP';
}

function ensureQuestState(state) {
  if (!state.quests || typeof state.quests !== 'object') {
    state.quests = { activeQuestIds: ['tut_controls'], completedQuestIds: [], stepProgress: {}, newlyCompletedQueue: [], accepted: {} };
  }
  if (!Array.isArray(state.quests.activeQuestIds)) state.quests.activeQuestIds = [];
  if (!Array.isArray(state.quests.completedQuestIds)) state.quests.completedQuestIds = [];
  if (!state.quests.stepProgress || typeof state.quests.stepProgress !== 'object') state.quests.stepProgress = {};
  if (!Array.isArray(state.quests.newlyCompletedQueue)) state.quests.newlyCompletedQueue = [];
  if (!state.quests.accepted || typeof state.quests.accepted !== 'object') state.quests.accepted = {};

  if (state.quests.activeQuestIds.length === 0 && state.quests.completedQuestIds.length === 0) {
    const autoQuest = QUESTS.find((quest) => quest.autoAccept);
    if (autoQuest) state.quests.activeQuestIds.push(autoQuest.id);
  }
}

function getCurrentStep(quest, progressByStep) {
  if (!quest || !Array.isArray(quest.steps)) return null;
  for (const step of quest.steps) {
    const need = Math.max(1, Number(step.count || 1));
    const cur = Number(progressByStep?.[step.id] || 0);
    if (cur < need) return step;
  }
  return null;
}

function matchesQuestEvent(step, eventType, payload = {}) {
  if (!step || step.target !== eventType) return false;
  const match = step.match || {};

  // 검증 조건이 아예 없으면 무조건 패스
  if (Object.keys(match).length === 0) return true;

  for (const key in match) {
    if (key === 'mode' && payload.mode !== match.mode) return false;
    if (key === 'requireNearWater' && !payload.nearWater) return false;

    // 상점 구매 종류(buyKinds) 검증 하드코어 패치
    if (key === 'buyKinds' && Array.isArray(match.buyKinds)) {
      const payloadKind = payload.kind || payload.item?.kind || payload.item?.equipSlot || null;
      if (!payloadKind || !match.buyKinds.includes(payloadKind)) return false;
    }

    // 희귀도 최소치 검증
    if (key === 'minRarity') {
      const order = ['C', 'B', 'A', 'S', 'SS'];
      const reqIdx = order.indexOf(match.minRarity);
      const curIdx = order.indexOf(payload?.rarity || 'C');
      if (curIdx < reqIdx) return false;
    }

    // 아이템 ID 직접 매칭
    if (key === 'itemId') {
      const pId = payload?.item?.id || payload?.itemId || payload?.id;
      if (match[key] !== pId) return false;
    }
  }
  return true;
}

export const MovementSystem = {
  update(state, input, player, map) {
    // 1. 筌뤴뫀諭?筌ｋ똾寃?(?癒곕퓮 筌뤴뫀諭뜹첎? ?袁⑤빍筌???猷??븍뜃?)
    if (state.mode !== MODES.EXPLORE) return;

    if (map && state.playerPos && globalThis.QuestSystem?.validateSpatialQuests) {
      globalThis.QuestSystem.validateSpatialQuests(state, map);
    } else if (map && state.playerPos && typeof QuestSystem !== 'undefined' && QuestSystem.validateSpatialQuests) {
      QuestSystem.validateSpatialQuests(state, map);
    }

    ensureSeatState(state);
    if (state.seat.isSeated) {
      player.isSeated = true;
      // seated: lock movement, allow facing changes only
      if (input.isAction('MOVE_UP')) player.facing = 'up';
      else if (input.isAction('MOVE_DOWN')) player.facing = 'down';
      else if (input.isAction('MOVE_LEFT')) player.facing = 'left';
      else if (input.isAction('MOVE_RIGHT')) player.facing = 'right';
      state.playerPos.facing = player.facing;
      return;
    }
    player.isSeated = false;

    // 2. ?묅뫂???筌ｋ똾寃?(Date.now() ?????곗쨮 ?袁⑥쟿????끸뵲???類ｋ궖)
    const now = Date.now();
    if (now - lastMoveTime < MOVE_DELAY_MS) {
      return;
    }

    // 3. ??낆젾 筌ｌ꼶??(Action Mapping ??뽰뒠)
    let dx = 0;
    let dy = 0;
    let facing = player.facing;

    // ??揶쏄낯苑???猷?獄쎻뫗? (RPG?癒?퐣??癰귣똾??4獄쎻뫚堉???猷??疫꿸퀡??
    if (input.isAction('MOVE_UP')) { dy = -1; facing = 'up'; }
    else if (input.isAction('MOVE_DOWN')) { dy = 1; facing = 'down'; }
    else if (input.isAction('MOVE_LEFT')) { dx = -1; facing = 'left'; }
    else if (input.isAction('MOVE_RIGHT')) { dx = 1; facing = 'right'; }

    // 4. ??猷?嚥≪뮇彛???묐뻬
    if (dx !== 0 || dy !== 0) {
      const newTx = player.tx + dx;
      const newTy = player.ty + dy;
      if (state.seat?.isSeated) return;

      // [M7] 고스트 충돌 검사 (Soft Collision: 0.5초 이상 충돌 시 bypass)
      let ghostBlocked = false;
      if (typeof window !== 'undefined' && window._ghostPlayers) {
        const ghostEntities = window._ghostPlayers;
        for (const uid of Object.keys(ghostEntities)) {
          const g = ghostEntities[uid];
          if (!g) continue;
          // 밀려나는 중인 고스트는 충돌체로 인식하지 않음
          if (g.isPushed) continue;
          const gtx = Math.round(g.renderX / TILE_SIZE);
          const gty = Math.round(g.renderY / TILE_SIZE);
          if (gtx === newTx && gty === newTy) {
            ghostBlocked = true;
            break;
          }
        }
      }
      // Soft Collision Bypass: 0.5초 이상 연속 충돌 시 통과 허용 (데드락 방지)
      if (ghostBlocked) {
        if (!state._ghostCollisionStart) state._ghostCollisionStart = now;
        if (now - state._ghostCollisionStart > 500) {
          ghostBlocked = false; // bypass
        }
      } else {
        state._ghostCollisionStart = 0;
      }

      const isHouseBlock = (tx, ty) => {
        if (state.inInstance) return false;
        const hitLocal = (state.houses || []).some(h => h.tx === tx && h.ty === ty);
        let hitGlobal = false;
        // [Phase 5] 타인의 집 충돌 판정 추가
        if (typeof window !== 'undefined' && window._dataManager && window._dataManager.publicHouses) {
            hitGlobal = Object.values(window._dataManager.publicHouses).flat().some(h => h.tx === tx && h.ty === ty);
        } else if (typeof dataManager !== 'undefined' && dataManager.publicHouses) {
            hitGlobal = Object.values(dataManager.publicHouses).flat().some(h => h.tx === tx && h.ty === ty);
        }
        return hitLocal || hitGlobal;
      };

      let instanceBlocked = false;
      if (state.inInstance) {
        const iBase = state.instanceBase || 1000;
        if (newTx < iBase || newTx > iBase + 4 || newTy < iBase || newTy > iBase + 4) {
          instanceBlocked = true; // 실내 벽 통과 방지
        }
      }

      if (!instanceBlocked && (state.inInstance || isWalkable(newTx, newTy)) && !isHouseBlock(newTx, newTy) && !ghostBlocked) {
        if (state.seat?.isSeated) return;
        if (state.isFishing && ActionSystem.stopFishing) ActionSystem.stopFishing(state, player, 'MOVE');
        player.setPosition(newTx, newTy, facing);
        state.playerPos.tx = newTx;
        state.playerPos.ty = newTy;
        state.playerPos.facing = facing;
        QuestSystem.emitQuestEvent(state, 'PLAYER_MOVED');
        lastMoveTime = now;
      } else {
        player.facing = facing;
        state.playerPos.facing = facing;
        lastMoveTime = now - (MOVE_DELAY_MS / 2);
      }
    }
  }
};

export const InteractionSystem = {
  update(state, input, map, showDialogCallback, dt = 0, addSystemMsg = null) {
    if (state.mode === 'BUILD') {
      if (input.wasActionPressed('INTERACT')) {
        const targetId = state.buildTarget;
        const bTx = state.playerPos.tx;
        const bTy = state.playerPos.ty;

        // [Phase 5-0] 알박기 방지 검증 추가
        if (Array.isArray(map?.npcs)) {
          const tooCloseNpc = map.npcs.find(npc =>
            (Math.abs(bTx - npc.x) + Math.abs(bTy - npc.y)) <= 3
          );
          if (tooCloseNpc) {
            if (addSystemMsg) addSystemMsg('중요 시설(NPC/상점) 근처에는 건물을 설치할 수 없습니다.', '#e74c3c');
            input.consumeAction('INTERACT');
            return;
          }
        }

        if (!Array.isArray(state.houses)) state.houses = [];

        // 1. 해당 좌표에 집 설치
        state.houses.push({ id: targetId, tx: bTx, ty: bTy });

        // 2. 인벤토리에서 소모
        if (!Array.isArray(state.inventory)) state.inventory = [];
        const idx = state.inventory.findIndex(i => i.itemId === targetId);
        if (idx >= 0) {
          state.inventory[idx].count -= 1;
          if (state.inventory[idx].count <= 0) state.inventory.splice(idx, 1);
        }

        // 3. 모드 복귀
        if (addSystemMsg) addSystemMsg('건축물이 설치되었습니다!', '#2ecc71');
        state.mode = MODES.EXPLORE;
        state.buildTarget = null;
        input.consumeAction('INTERACT');
      }
      return; // 일반 상호작용 차단
    }

    if (state.mode !== MODES.EXPLORE) return;
    if (!state.ui || typeof state.ui !== 'object') state.ui = {};
    if (!state.ui.npcBubble || typeof state.ui.npcBubble !== 'object') {
      state.ui.npcBubble = { visible: false, text: '', idx: 0, timer: 0, id: null };
    }

    const FISH_SELL_LINES = ['안녕~ 물고기 팔래말래?', '크기가 애매하긴해~', '갑붕싸.. 월척이로구만~'];
    const FISH_BUY_LINES = ['낚시용품은 여기서!', '좋은 미끼 들어왔어~', '오늘은 대물 각이야!'];
    const FARM_SELL_LINES = ['음메~ 신선한 작물 가져왔소?', '황소장터에 온 걸 환영하소!', '최고가로 쳐주겠소!'];
    const FARM_BUY_LINES = ['씨앗 심고 부자되세요!', '최고급 괭이 입고완료!', '농사의 기본은 장비죠!'];

    const npcs = Array.isArray(map?.npcs) ? map.npcs : [];
    const nearNpc = npcs.find((n) => Math.abs(state.playerPos.tx - n.x) + Math.abs(state.playerPos.ty - n.y) <= 2);
    if (nearNpc) {
      const bubble = state.ui.npcBubble;
      let lines = FISH_SELL_LINES;
      if (nearNpc.shopId === 'FARM_MARKET') lines = FARM_SELL_LINES;
      else if (nearNpc.shopId === 'FARM_SHOP') lines = FARM_BUY_LINES;
      else if (nearNpc.shopId === 'FISH_MARKET' || nearNpc.kind === 'SHOPKEEPER_SELL') lines = FISH_SELL_LINES;
      else if (nearNpc.shopId === 'TACKLE_SHOP' || nearNpc.kind === 'SHOPKEEPER_BUY') lines = FISH_BUY_LINES;
      else if (nearNpc.kind === 'QUEST_GIVER') lines = ['새로운 퀘스트가 있어요!', 'Space로 대화해보세요'];
      if (bubble.id !== nearNpc.id) {
        bubble.idx = 0;
        bubble.timer = 0;
      }
      bubble.visible = true;
      bubble.id = nearNpc.id;
      bubble.text = lines[bubble.idx % lines.length];
      bubble.timer += Math.max(0, dt || 0);
      if (bubble.timer >= 2.5) {
        bubble.idx = (bubble.idx + 1) % lines.length;
        bubble.text = lines[bubble.idx];
        bubble.timer = 0;
      }
    } else if (state.ui.npcBubble?.visible) {
      state.ui.npcBubble.visible = false;
      state.ui.npcBubble.text = '';
      state.ui.npcBubble.timer = 0;
      state.ui.npcBubble.idx = 0;
      state.ui.npcBubble.id = null;
    }

    if (state.discoverCooldown > 0) state.discoverCooldown--;

    // [Phase 4: 하우징 진입 / 탈출]
    const pFacing = state.playerPos.facing || 'down';
    const fX = state.playerPos.tx + (pFacing === 'left' ? -1 : pFacing === 'right' ? 1 : 0);
    const fY = state.playerPos.ty + (pFacing === 'up' ? -1 : pFacing === 'down' ? 1 : 0);
    
    // [Phase 5] 내 집과 타인의 집 목록 통합
    let allHouses = [...(state.houses || [])];
    if (typeof window !== 'undefined' && window._dataManager && window._dataManager.publicHouses) {
      allHouses = allHouses.concat(Object.values(window._dataManager.publicHouses).flat());
    } else if (typeof dataManager !== 'undefined' && dataManager.publicHouses) {
      allHouses = allHouses.concat(Object.values(dataManager.publicHouses).flat());
    }

    const targetHouse = allHouses.find(h => h.tx === fX && h.ty === fY);


    if (input.wasActionPressed('INTERACT')) {

      // 1. 퇴장 로직: 텐트 내부의 하단 중앙(iBase+2, iBase+4 주변)에서 Space 누를 시
      if (state.inInstance && state.playerPos.ty >= (state.instanceBase || 1000) + 3) {
        if (state.lastWorldPos) {
          state.playerPos.tx = state.lastWorldPos.tx;
          state.playerPos.ty = state.lastWorldPos.ty + 1; // 텐트 바로 아래로 복귀
          if (typeof window !== 'undefined' && window.player) {
            window.player.setPosition(state.playerPos.tx, state.playerPos.ty, 'down');
            window.player.renderX = state.playerPos.tx * 32; // TILE_SIZE
            window.player.renderY = state.playerPos.ty * 32;
            if (typeof camera !== 'undefined' && typeof WORLD_MAP !== 'undefined') {
              camera.x = window.player.renderX - camera.width / 2 + TILE_SIZE / 2;
              camera.y = window.player.renderY - camera.height / 2 + TILE_SIZE / 2;
              camera.update(window.player, WORLD_MAP.width, WORLD_MAP.height);
            }
          }
          state.inInstance = false;
          if (typeof dataManager !== 'undefined' && dataManager.saveUserData) dataManager.saveUserData(state).catch(e => console.error(e));
          if (addSystemMsg) addSystemMsg('밖으로 나왔습니다.', '#f1c40f');
        }
        input.consumeAction('INTERACT');
        return;
      }

      // 2. 수면 로직: 내 발밑이나 앞칸에 'bed_camp'가 있을 때
      const pFacingBed = state.playerPos.facing || 'down';
      const fTx = state.playerPos.tx + (pFacingBed === 'left' ? -1 : pFacingBed === 'right' ? 1 : 0);
      const fTy = state.playerPos.ty + (pFacingBed === 'up' ? -1 : pFacingBed === 'down' ? 1 : 0);

      // [Phase 5] 통합된 집 배열(allHouses)에서 침대 찾기
      const targetBed = allHouses.find(h => h.id === 'bed_camp' && ((h.tx === state.playerPos.tx && h.ty === state.playerPos.ty) || (h.tx === fTx && h.ty === fTy)));

      if (targetBed) {
        if (state.isSleeping) return; // 중복 실행 방지
        // [데이터 주도 설계] 침대 ID별 이불 색상 사전(Dictionary)
        const BED_STYLES = {
          'bed_camp': { fold: '#5a5a5a', body: '#2c2c2c' }, // 현재 야전 침대 (진회색/검정)
          'bed_hospital': { fold: '#ffffff', body: '#3498db' }, // [향후 확장 예시] 병원 침대 (흰색/파랑)
          'bed_luxury': { fold: '#f1c40f', body: '#e74c3c' }  // [향후 확장 예시] 고급 침대 (금색/빨강)
        };

        // const bedTx = targetBed.tx;
        // const bedTy = targetBed.ty;

        // 1. 상태 및 렌더링 좌표 강제 스냅 (바닥에서 자는 현상 방지)
        state.isSleeping = true;
        state.sleepProgress = 0; // [Phase 4-3] 프레임 기반 10초 타이머 초기화 (main.js에서 갱신)
        state.playerPos.tx = targetBed.tx;
        state.playerPos.ty = targetBed.ty;

        // 타겟 침대의 ID를 기반으로 스타일을 불러와 상태에 저장 (없으면 기본값)
        state.bedStyle = BED_STYLES[targetBed.id] || BED_STYLES['bed_camp'];

        if (typeof window !== 'undefined' && window.player) {
          window.player.setPosition(targetBed.tx, targetBed.ty, 'down');
          // TILE_SIZE(32) 정중앙으로 소수점 없이 강제 고정
          window.player.renderX = bedTx * 32;
          window.player.renderY = bedTy * 32;
          window.player.isSleeping = true;
        }

        input.consumeAction('INTERACT');
        return;
      }

      // 3. 밖에서 안으로 진입 (내 텐트 + 타인 텐트)
      if (targetHouse && targetHouse.id === 'house_tent' && !state.inInstance) {
        let ownerUid = state.id || (typeof dataManager !== 'undefined' ? dataManager.userId : 'local');

        // [Phase 5] 내 집이 아니라면 타인의 집인지 publicHouses에서 다시 검색
        if (!(state.houses || []).some(h => h.tx === targetHouse.tx && h.ty === targetHouse.ty)) {
          if (typeof dataManager !== 'undefined' && dataManager.publicHouses) {
            for (const [uid, pubHouses] of Object.entries(dataManager.publicHouses)) {
              if (pubHouses && pubHouses.some(h => h.tx === targetHouse.tx && h.ty === targetHouse.ty)) {
                ownerUid = uid;
                break;
              }
            }
          }
        }

        // [Phase 5-0] 인스턴스 룸 해시 충돌(Hash Collision) 방어 
        let hash = 0;
        for (let i = 0; i < ownerUid.length; i++) hash = ((hash << 5) - hash + ownerUid.charCodeAt(i)) | 0;
        const iBase = 10000 + (Math.abs(hash) % 100000) * 50;

        state.instanceBase = iBase;
        state.lastWorldPos = { ...state.playerPos };

        const enterX = iBase + 2; const enterY = iBase + 2;
        state.playerPos.tx = enterX; state.playerPos.ty = enterY; // 내부 중앙 안착
        if (typeof window !== 'undefined' && window.player) {
          window.player.setPosition(enterX, enterY, 'down');
          window.player.renderX = enterX * 32; // TILE_SIZE 직결
          window.player.renderY = enterY * 32;
          if (typeof camera !== 'undefined' && typeof WORLD_MAP !== 'undefined') {
            camera.x = window.player.renderX - camera.width / 2 + TILE_SIZE / 2;
            camera.y = window.player.renderY - camera.height / 2 + TILE_SIZE / 2;
            camera.update(window.player, WORLD_MAP.width, WORLD_MAP.height);
          }
        }

        state.inInstance = true;
        if (typeof dataManager !== 'undefined' && dataManager.saveUserData) dataManager.saveUserData(state).catch(e => console.error(e));

        const ownerName = ownerUid === (typeof dataManager !== 'undefined' ? dataManager.userId : 'local') ? '내' : `${ownerUid.substring(0, 4)}님의`;
        if (addSystemMsg) addSystemMsg(`${ownerName} 텐트 내부로 들어왔습니다.`, '#f1c40f');
        input.consumeAction('INTERACT');
        return;
      }
    }

    if (input.wasActionPressed('INTERACT')) {
      // [M2] 밀치기 트리거: 정면 고스트 감지 + 마주보기 검증
      if (typeof window !== 'undefined' && window._ghostPlayers && state.playerPos) {
        const pFacing = state.playerPos.facing || 'down';
        const frontX = state.playerPos.tx + (pFacing === 'left' ? -1 : pFacing === 'right' ? 1 : 0);
        const frontY = state.playerPos.ty + (pFacing === 'up' ? -1 : pFacing === 'down' ? 1 : 0);
        const oppDir = { up: 'down', down: 'up', left: 'right', right: 'left' };
        const pushDelta = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

        for (const [uid, ghost] of Object.entries(window._ghostPlayers)) {
          if (!ghost || ghost.isPushed) continue;
          const gtx = Math.round(ghost.renderX / TILE_SIZE);
          const gty = Math.round(ghost.renderY / TILE_SIZE);
          if (gtx === frontX && gty === frontY) {
            const isFacing = ghost.facing === oppDir[pFacing];
            if (isFacing) {
              // 밀려날 뒤쪽 타일이 이동 가능한지 확인
              const pd = pushDelta[pFacing];
              const backTx = gtx + pd.dx;
              const backTy = gty + pd.dy;
              if (isWalkable(backTx, backTy)) {
                // dataManager는 main.js 스코프이므로 window 경유
                if (typeof window._dataManager?.pushPlayer === 'function') {
                  window._dataManager.pushPlayer(uid, pFacing);
                }
                if (addSystemMsg) addSystemMsg('상대를 밀었습니다!', '#f39c12');
                QuestSystem.emitQuestEvent(state, 'PLAYER_PUSH', { targetUid: uid, direction: pFacing });
                input.consumeAction('INTERACT');
                return; // 밀기 성공 시 일반 상호작용 중단
              }
            }
            break;
          }
        }
      }

      // [M5] 수면 엔진 (야전 침대 상호작용)
      if (state.furniture && state.playerPos) {
        const { tx: pTx, ty: pTy, facing: pFacing } = state.playerPos;
        const fTx = pTx + (pFacing === 'left' ? -1 : pFacing === 'right' ? 1 : 0);
        const fTy = pTy + (pFacing === 'up' ? -1 : pFacing === 'down' ? 1 : 0);
        const bed = state.furniture.find(f => f.id === 'bed_camp' && ((f.tx === pTx && f.ty === pTy) || (f.tx === fTx && f.ty === fTy)));

        if (bed) {
          if (state.isSleeping) return; // 중복 실행 방지

          state.isSleeping = true;
          state.sleepProgress = 0;
          state.playerPos.tx = bed.tx;
          state.playerPos.ty = bed.ty;

          if (typeof window !== 'undefined' && window.player) {
            window.player.setPosition(bed.tx, bed.ty, 'down');
            window.player.renderX = bed.tx * 32;
            window.player.renderY = bed.ty * 32;
            window.player.isSleeping = true; // 이 값이 들어가야 entities.js에서 90도로 눕습니다.
          }
          input.consumeAction('INTERACT');
          return;
        }
      }

      // [Phase 3] 농사 상호작용 상태 머신 (수확 → 밭갈기 → 파종 → 물주기)
      if (state.farm && state.playerPos) {
        // [Phase 5] 발밑 타겟팅 (현재 밟고 있는 타일)
        const farmTx = state.playerPos.tx;
        const farmTy = state.playerPos.ty;
        const tileKey = `${farmTx},${farmTy}`;
        const farmTile = state.farm[tileKey];
        const tileType = getTileType(farmTx, farmTy);

        const activeToolId = state.equipment?.activeToolId;
        const activeTool = activeToolId ? getItem(activeToolId) : null;

        // A: 수확 (stage 3, 장비 무관)
        if (farmTile && farmTile.stage === 3) {
          if (addSystemMsg) addSystemMsg('작물을 수확했습니다!', '#2ecc71');
          if (!Array.isArray(state.inventory)) state.inventory = [];
          if (farmTile.cropId) invAdd(state.inventory, farmTile.cropId, 1);
          delete state.farm[tileKey];
          state.uiDirty = true;
          input.consumeAction('INTERACT');
          return;
        }

        // B: 밭갈기 (괭이 + 농사 가능 타일 + 아직 밭 아님)
        if (activeTool?.toolKind === 'FARM_HOE' && !farmTile && isFarmableTile(farmTx, farmTy)) {
          if (state.stamina < 2) {
            if (addSystemMsg) addSystemMsg('체력이 부족합니다. 야전침대에서 휴식하세요.', '#e74c3c');
            return;
          }
          state.stamina = Math.max(0, state.stamina - 2);
          state.farm[tileKey] = { cropId: null, stage: 0, waterLevel: 0, plantedAt: null };
          if (addSystemMsg) addSystemMsg('밭을 일궜습니다.', '#e67e22');
          state.uiDirty = true;
          input.consumeAction('INTERACT');
          return;
        }

        // C: 파종 (씨앗 + 빈 밭)
        if (activeTool?.toolKind === 'FARM_SEED' && farmTile && !farmTile.cropId) {
          if (state.stamina < 2) {
            if (addSystemMsg) addSystemMsg('체력이 부족합니다. 야전침대에서 휴식하세요.', '#e74c3c');
            return;
          }
          state.stamina = Math.max(0, state.stamina - 2);
          farmTile.cropId = activeTool.harvestsInto || activeToolId;
          farmTile.stage = 1;
          farmTile.plantedAt = Date.now();
          invRemove(state.inventory, activeToolId, 1);
          if (invCount(state.inventory, activeToolId) <= 0) state.equipment.activeToolId = null;
          if (addSystemMsg) addSystemMsg('씨앗을 심었습니다.', '#f1c40f');
          state.uiDirty = true;
          input.consumeAction('INTERACT');
          return;
        }

        // D: 물주기 (물뿌리개 + 성장 중 + 수분 없음)
        if (activeTool?.toolKind === 'FARM_WATER' && farmTile && farmTile.stage > 0 && farmTile.stage < 3 && farmTile.waterLevel === 0) {
          if (state.stamina < 2) {
            if (addSystemMsg) addSystemMsg('체력이 부족합니다. 야전침대에서 휴식하세요.', '#e74c3c');
            return;
          }
          state.stamina = Math.max(0, state.stamina - 2);
          farmTile.waterLevel = 1;
          if (addSystemMsg) addSystemMsg('작물에 물을 주었습니다.', '#3498db');
          state.uiDirty = true;
          input.consumeAction('INTERACT');
          return;
        }
      }

      ensureTrapState(state);
      const fishMarket = isNearPOI(map, state.playerPos, 'FISH_MARKET');
      const tackleShop = isNearPOI(map, state.playerPos, 'TACKLE_SHOP');
      const farmMarket = isNearPOI(map, state.playerPos, 'FARM_MARKET');
      const farmShop = isNearPOI(map, state.playerPos, 'FARM_SHOP');
      if (fishMarket || tackleShop || farmMarket || farmShop) {
        state.mode = MODES.SHOP;
        if (!state.shop || typeof state.shop !== 'object') state.shop = { isOpen: false, mode: 'SELL', shopId: null };
        state.shop.isOpen = true;
        state.shop.mode = fishMarket ? 'SELL' : tackleShop ? 'BUY' : farmMarket ? 'SELL_FARM' : 'BUY_FARM';
        state.shop.shopId = fishMarket ? 'FISH_MARKET' : tackleShop ? 'TACKLE_SHOP' : farmMarket ? 'FARM_MARKET' : 'FARM_SHOP';
        state.shopCloseLockUntil = Date.now() + 200;
        QuestSystem.emitQuestEvent(state, 'OPEN_SHOP', { mode: state.shop.mode, shopId: state.shop.shopId });
        input.consumeAction('INTERACT');
        input.consumeAction('USE_TOOL');
        return;
      }

      const questNpc = npcs.find((n) => n.kind === 'QUEST_GIVER' && Math.abs(state.playerPos.tx - n.x) + Math.abs(state.playerPos.ty - n.y) <= 2);
      if (questNpc) {
        // 1. 대화문 먼저 확보
        const questMessage = QuestSystem.getQuestNpcDialog(state, questNpc.id, questNpc.name);

        // 2. 이벤트 발송 (퀘스트 완료 및 보상 지급 트리거)
        QuestSystem.emitQuestEvent(state, 'TALK_TO_NPC', { npcId: questNpc.id });

        // 3. 몰입형 대사 덮어쓰기 (하드코딩)
        let finalMsg = questMessage;
        if (questNpc.id === 'NPC_MAYOR' && questMessage && questMessage.includes('이장과 대화')) {
          finalMsg = "촌장: 오, 새로 온 주민이구만! 허허, 일단 여기서 지내려면 잠자리가 필요할 터. 마을 기금으로 낡은 텐트와 침대를 하나 주겠네. 인벤토리(I)의 [설치] 탭을 열어 바닥에 설치해보게나!";
        }

        // 4. 대사 출력
        if (finalMsg) showDialogCallback(finalMsg);

        input.consumeAction('INTERACT');
        input.consumeAction('USE_TOOL');
        return;
      }

      const nearBush = (
        getTileType(state.playerPos.tx, state.playerPos.ty) === 2
        || getTileType(state.playerPos.tx + 1, state.playerPos.ty) === 2
        || getTileType(state.playerPos.tx - 1, state.playerPos.ty) === 2
        || getTileType(state.playerPos.tx, state.playerPos.ty + 1) === 2
        || getTileType(state.playerPos.tx, state.playerPos.ty - 1) === 2
      );
      if (nearBush) {
        showDialogCallback('수풀을 조사한다...');
        this.handleBushEncounter(state, map, showDialogCallback);
        input.consumeAction('INTERACT');
        input.consumeAction('USE_TOOL');
      }
    }

    // [D키 전용] 통발 설치 / 회수 (장착 의존성 제거)
    if (input.wasActionPressed('PLACE_TRAP')) {
      ensureTrapState(state);
      const front = getFishingContext(state, { tx: state.playerPos.tx, ty: state.playerPos.ty, facing: state.playerPos.facing });

      // 물가가 아니면 안내
      if (!front.frontIsWater) {
        if (addSystemMsg) addSystemMsg('통발은 물가에만 설치할 수 있습니다.', '#e74c3c');
        return;
      }

      // 1. 회수: 눈앞 타일에 설치된 통발이 있는지 확인
      const trapAtFront = state.traps.find((t) => t.x === front.targetTx && t.y === front.targetTy);
      if (trapAtFront) {
        const trapItemId = trapAtFront.itemId || 'bait_heavy';
        if (!Array.isArray(state.inventory)) state.inventory = [];
        if (state.inventory.length >= 260) {
          if (addSystemMsg) addSystemMsg('인벤토리가 가득 차서 통발을 회수할 수 없다.', '#e74c3c');
          return;
        }
        invAdd(state.inventory, trapItemId);
        state.trapInventory.push({
          itemId: trapItemId,
          capacity: trapAtFront.capacity || getTrapCapacityByItem(trapItemId),
          fishes: Array.isArray(trapAtFront.fishes) ? trapAtFront.fishes.slice() : []
        });
        state.traps = state.traps.filter((t) => t !== trapAtFront);
        if (addSystemMsg) addSystemMsg('통발을 회수했습니다.', '#3498db');
        state.uiDirty = true;
        QuestSystem.emitQuestEvent(state, 'PLACE_TRAP', { action: 'retrieve' });
        return;
      }

      // 2. 설치: 인벤토리에서 통발 아이템 탐색 (장착 없이 바로 사용)
      const exists = state.traps.some((t) => t.x === front.targetTx && t.y === front.targetTy);
      if (exists) {
        if (addSystemMsg) addSystemMsg('이미 통발이 설치되어 있다.', '#e74c3c');
        return;
      }

      // 인벤토리에서 통발 아이템 찾기
      // 인벤토리에서 통발 아이템 찾기 (스택형)
      const trapInvEntry = state.inventory.find(e => isTrapItem(e.itemId));
      if (!trapInvEntry) {
        if (addSystemMsg) addSystemMsg('인벤토리에 설치할 통발이 없습니다.', '#e74c3c');
        return;
      }

      const trapToolId = trapInvEntry.itemId;
      invRemove(state.inventory, trapToolId, 1);
      const stashIdx = state.trapInventory.findIndex((ti) => ti.itemId === trapToolId);
      const trapBag = stashIdx >= 0 ? state.trapInventory.splice(stashIdx, 1)[0] : null;
      state.traps.push({
        x: front.targetTx,
        y: front.targetTy,
        itemId: trapToolId,
        capacity: trapBag?.capacity || getTrapCapacityByItem(trapToolId),
        fishes: Array.isArray(trapBag?.fishes) ? trapBag.fishes : [],
        timer: 0
      });
      if (addSystemMsg) addSystemMsg('통발을 설치했습니다.', '#2ecc71');
      state.uiDirty = true;
      QuestSystem.emitQuestEvent(state, 'PLACE_TRAP', { action: 'place' });
      return;
    }
  },

  // Bush encounter helper
  handleBushEncounter(state, map, showDialogCallback) {
    if (state.discoverCooldown > 0) {
      showDialogCallback('아직 흔적이 남아있지 않다. 잠시 후 다시 조사해보자.');
      return;
    }

    if (RNG.chance(3)) {
      const validPets = getSpawnablePets(state, map);

      if (validPets.length > 0) {
        const foundPet = RNG.pickWeighted(validPets);

        if (!state.ownedPetIds.includes(foundPet.id)) {
          state.ownedPetIds.push(foundPet.id);
          QuestSystem.emitQuestEvent(state, 'PET_OBTAINED', { petId: foundPet.id });
          showDialogCallback(`[${foundPet.name}]를 발견했다! 펫 도감에 등록된다.`);
        } else {
          const reward = 10;
          state.money += reward;
          showDialogCallback(`[${foundPet.name}]가 다시 나타났다. ${reward}G를 획득했다.`);
        }

        state.discoverCooldown = 180;
      } else {
        showDialogCallback('수풀에서 소리가 났지만 놓쳐버렸다...');
      }
    } else {
      const flavorTexts = [
        '바람에 잎사귀만 흔들린다.',
        '별다른 기척이 없다.',
        '다른 수풀도 조사해보자.'
      ];
      showDialogCallback(flavorTexts[RNG.range(0, flavorTexts.length - 1)]);
    }
  }
};

export const PetSystem = {
  update(state, player, currentPetRef, dt = 0) {
    if (!currentPetRef) return;
    const activeId = state.activePetId;
    if (activeId) {
      if (!currentPetRef.pet || currentPetRef.pet.id !== activeId) {
        const petData = getPetById(activeId);
        if (petData) {
          currentPetRef.pet = new Pet(activeId, petData);
          currentPetRef.pet.tx = player.tx;
          currentPetRef.pet.ty = player.ty;
          currentPetRef.pet.renderX = player.renderX;
          currentPetRef.pet.renderY = player.renderY;
        }
      }

      if (currentPetRef.pet) {
        currentPetRef.pet.update(player, dt);
      }
    } else if (currentPetRef.pet) {
      currentPetRef.pet = null;
    }
  }
};

export const TrapSystem = {
  update(state, dt = 0) {
    ensureTrapState(state);
    const traps = state.traps;
    if (!Array.isArray(traps) || traps.length === 0) return;
    const intervalSec = 75;
    const catchProb = 0.6;
    traps.forEach((trap) => {
      if (!trap || typeof trap !== 'object') return;
      trap.timer = Number.isFinite(trap.timer) ? trap.timer : 0;
      trap.capacity = Number.isFinite(trap.capacity) ? trap.capacity : getTrapCapacityByItem(trap.itemId);
      if (!Array.isArray(trap.fishes)) trap.fishes = [];
      trap.timer += Math.max(0, dt || 0);
      if (trap.timer < intervalSec) return;
      trap.timer = 0;
      if (trap.fishes.length >= trap.capacity) return;
      if (RNG.float() > catchProb) return;
      const pool = getFishLootTable().filter((f) => ['C', 'B', 'COMMON', 'UNCOMMON'].includes(String(f?.rarity || '').toUpperCase()));
      if (pool.length === 0) return;
      const fish = pool[RNG.range(0, pool.length - 1)];
      const rarity = String(fish?.rarity || 'C').toUpperCase();
      const weightG = rollFishWeight(fish.weightG || 120, 0);
      const unitPrice = computeCatchPrice(fish, weightG, rarity);
      trap.fishes.push({ itemId: fish.id, rarity, weightG, unitPrice });
      state.uiDirty = true;
    });
  }
};

// import { getTileType } from './map.js'; // ?怨룸뼊??import ?類ㅼ뵥

export const ActionSystem = {
  stopSeating(state, player, reason = 'SEAT_STOP') {
    ensureSeatState(state);
    state.seat.isSeated = false;
    state.seat.chairPlaced = false;
    state.seat.autoFishing = false;
    state.seat.autoTimer = 0;
    state.seat.bagFullWarn = false;
    if (!state.debug) state.debug = {};
    state.debug.lastSeatReason = reason;
    if (state.isFishing) this.stopFishing(state, player, reason);
    if (player) player.isFishing = false;
    if (player) player.isSeated = false;
  },

  stopFishing(state, player, reason = 'UNKNOWN') {
    state.isFishing = false;
    if (player) player.isFishing = false;
    if (!state.debug) state.debug = {};
    state.debug.lastFishingCancelReason = reason;
    if ('fishingTimer' in state) state.fishingTimer = 0;
    if ('fishingCast' in state) state.fishingCast = false;
    if ('fishingCastAt' in state) state.fishingCastAt = 0;
    if ('fishingProgress' in state) state.fishingProgress = 0;
    if ('fishingBiteWindow' in state) state.fishingBiteWindow = 0;
    if ('fishingBiteAt' in state) state.fishingBiteAt = 0;
    if ('fishingPreview' in state) state.fishingPreview = null;
  },

  update(state, input, player, map, showDialog, dt = 0.016, addSystemMsg = null) {
    ensureSeatState(state);
    if (state.mode !== MODES.EXPLORE && state.seat.isSeated) {
      this.stopSeating(state, player, 'MODE_CHANGE');
      return;
    }

    if (input.wasActionPressed('TOGGLE_SEAT')) {
      const hasChair = Array.isArray(state?.inventory) && invHas(state.inventory, 'fishing_chair');
      if (state.seat.isSeated) {
        this.stopSeating(state, player, 'TOGGLE_OFF');
      } else if (!hasChair) {
        showDialog('낚시용 의자를 장착하세요.');
      } else {
        const gate = getFishingStartGate(state, player, false);
        if (gate === 'OK') {
          state.seat.isSeated = true;
          state.seat.chairPlaced = true;
          state.seat.chairPos = { x: player.tx, y: player.ty };
          state.seat.autoFishing = true;
          state.seat.autoTimer = 0;
          state.seat.bagFullWarn = false;
        } else if (gate === 'NOT_FACING_WATER' || gate === 'NOT_NEAR_WATER') {
          showDialog('물가를 바라본 위치에서만 앉을 수 있어요.');
        }
      }
    }

    if (state.seat.isSeated) {
      const gate = getFishingStartGate(state, player, false);
      if (gate !== 'OK') {
        this.stopSeating(state, player, 'LEAVE_WATER');
        return;
      }

      ensureBagsState(state);
      const equippedBag = state.bags[state.equipment.bagId];
      const bagCap = equippedBag?.capacity || 10;
      if ((equippedBag?.fishes?.length || 0) >= bagCap) {
        state.seat.autoFishing = false;
        state.seat.bagFullWarn = true;
        if (state.isFishing) this.stopFishing(state, player, 'BAG_FULL');
      } else {
        state.seat.bagFullWarn = false;
        if (state.seat.autoFishing && !state.isFishing && (!state.fishingCooldown || state.fishingCooldown <= 0)) {
          state.seat.autoTimer += Math.max(0, dt || 0);
          if (state.seat.autoTimer >= 1.0) {
            state.seat.autoTimer = 0;
            state.isFishing = true;
            if (player) player.isFishing = true;
          }
        }
      }
    }

    if (state.fishingCooldown && state.fishingCooldown > 0) state.fishingCooldown--;
    if (state?.equipment?.baitId && getBaitCount(state, state.equipment.baitId) > 0) {
      QuestSystem.emitQuestEvent(state, 'BAIT_EQUIPPED', { baitId: state.equipment.baitId });
    }

    if (state.isFishing && player) {
      const activeGate = getFishingStartGate(state, player, false);
      if (activeGate !== 'OK') {
        this.stopFishing(state, player, activeGate === 'MODE_BLOCK' ? 'MODE_BLOCK' : 'LEAVE_WATER');
        return;
      }

      // 미끼 하드 밸리데이션: 장착된 미끼가 없으면 낚시 강제 종료
      const activeBaitId = state.equipment?.baitId;
      if (!activeBaitId || getBaitCount(state, activeBaitId) <= 0) {
        if (addSystemMsg) addSystemMsg('장착된 미끼가 없어 낚시가 취소되었습니다.', '#e74c3c');
        state.equipment.baitId = null;
        this.stopFishing(state, player, 'NO_BAIT');
        return;
      }

      // Fishing success roll while fishing is active.
      const rod = getEquippedRodInfo(state);
      const rodTier = rod.tier || 1;
      player.rodTier = rodTier;
      const biteChanceN = rodTier >= 3 ? 50 : rodTier >= 2 ? 80 : 120;
      if (RNG.chance(biteChanceN)) {
        const tierTable = getTierFishTable(rodTier);
        const petBuff = getActivePetFishingBuff(state);
        const baseWeights = getRodRarityWeights(rodTier);
        const petAdjustedWeights = applyPetLuckToWeights(baseWeights, petBuff.luck);
        const rarityWeightsBefore = normalizeWeights(petAdjustedWeights);
        const baitBuff = getActiveBaitBuff(state);
        const baitAdjustedWeights = applyBaitToWeights(petAdjustedWeights, baitBuff.shift);
        const rarityWeightsAfterBait = normalizeWeights(baitAdjustedWeights);
        const maxRarityCap = ROD_RARITY_CAPS[Math.max(1, Math.min(3, rodTier || 1))] || 'A';
        const cappedWeights = applyRarityCap(baitAdjustedWeights, maxRarityCap);
        let rarityWeights = cappedWeights;
        if (baitBuff.minRarity) {
          const capIdx = getRarityIndex(maxRarityCap);
          const baitMinIdx = getRarityIndex(baitBuff.minRarity);
          const finalMin = (baitMinIdx >= 0 && capIdx >= 0 && baitMinIdx > capIdx) ? maxRarityCap : baitBuff.minRarity;
          rarityWeights = applyRarityFloor(cappedWeights, finalMin);
        }
        const rarity = pickRarity(rarityWeights);
        const region = getWaterRegion(player.tx, player.ty);
        const caughtFish = pickFishByRarityAndTier(rodTier, rarity, region, baitBuff);

        if (caughtFish) {
          ensureBagsState(state);
          const equippedBag = state.bags[state.equipment.bagId];
          const bagCap = equippedBag?.capacity || 10;
          if ((equippedBag?.fishes?.length || 0) >= bagCap) {
            this.stopFishing(state, player, 'BAG_FULL');
            if (addSystemMsg) addSystemMsg(t('msg.fishing.bagFull'), '#e74c3c');
            else showDialog(t('msg.fishing.bagFull'));
            return;
          }

          const rolledWeight = rollFishWeight(caughtFish.weightG || 100, petBuff.weight);
          const unitPrice = computeCatchPrice(caughtFish, rolledWeight, rarity);
          equippedBag.fishes.push({
            itemId: caughtFish.id,
            rarity,
            weightG: rolledWeight,
            unitPrice
          });
          state.uiDirty = true;
          state.lastCatch = caughtFish.id;
          state.lastCatchAt = Date.now();
          if (!state.debug) state.debug = {};
          state.debug.lastCatch = {
            fishId: caughtFish.id,
            tier: rodTier,
            tableName: tierTable.name,
            rarity,
            weightG: rolledWeight,
            price: unitPrice,
            petId: petBuff.petId || 'N/A',
            baitId: baitBuff.baitId || 'N/A',
            baitTier: baitBuff.baitId ? (getItem(baitBuff.baitId)?.baitTier || getItem(baitBuff.baitId)?.tier || 0) : 0,
            rarityWeightsBefore,
            rarityWeightsAfterBait,
            finalRarity: rarity,
            finalFishId: caughtFish.id
          };
          consumeActiveBait(state, addSystemMsg || showDialog);
          state.fishingCooldown = rodTier >= 3 ? 25 : rodTier >= 2 ? 40 : 60;
          this.stopFishing(state, player, 'CAUGHT');
          QuestSystem.emitQuestEvent(state, 'CATCH_FISH', { fishId: caughtFish.id, rarity, weightG: rolledWeight });
          const fishName = caughtFish.nameKey ? t(caughtFish.nameKey) : caughtFish.name;
          const catchMsg = t('msg.fishing.caught', { name: fishName });

          // 하이브리드 알림: S/SS는 중앙 대화창, C/B/A는 시스템 로그
          if ((rarity === 'S' || rarity === 'SS') && showDialog) {
            showDialog(`${catchMsg} (+${unitPrice}G) \u2728`);
          } else if (addSystemMsg) {
            addSystemMsg(`${catchMsg} (+${unitPrice}G)`, rarity);
          } else {
            showDialog(catchMsg);
          }
        }
      }
    }

    // ??노뻻 ??뽰삂/?ル굝利?(F??
    if (input.wasActionPressed('USE_TOOL')) {
      if (!state.debug) state.debug = {};
      if (!state?.equipment?.baitId) {
        if (addSystemMsg) addSystemMsg('미끼가 없습니다! 인벤토리(I)에서 미끼를 장착해주세요.', 'C');
        else showDialog('미끼가 없습니다! 인벤토리(I)에서 미끼를 장착해주세요.');
        state.debug.fishingStartGate = 'NO_BAIT';
        return;
      }
      const baitId = state.equipment.baitId;
      const inv = Array.isArray(state?.inventory) ? state.inventory : [];
      const baitCount = invCount(inv, baitId);
      if (baitCount <= 0) {
        state.equipment.baitId = null;
        if (addSystemMsg) addSystemMsg('미끼를 다 썼습니다. 상점에서 구매하세요!', 'C');
        else showDialog('미끼를 다 썼습니다. 상점에서 구매하세요!');
        state.debug.fishingStartGate = 'NO_BAIT_STOCK';
        return;
      }
      const ctx = getFishingContext(state, player);
      let fishingBlockReason = getFishingStartGate(state, player, true);

      state.debug.frontTile = { x: ctx.targetTx, y: ctx.targetTy, ch: ctx.frontCh };
      state.debug.frontIsWater = ctx.frontIsWater;
      state.debug.nearWater = ctx.nearWater;
      state.debug.lastFishingTile = `front=${ctx.targetTx},${ctx.targetTy}:${ctx.frontCh || 'OUT'} nearWater=${ctx.nearWater}`;

      state.debug.lastFishingReason = fishingBlockReason;
      state.debug.fishingStartGate = fishingBlockReason;

      if (state.isFishing) {
        // ??? ??노뻻 餓λ쵐?좑쭖??띯뫁??        this.stopFishing(state, player, 'TOGGLE');
        showDialog(t('msg.fishing.stopped'));
      } else {
        if (!ctx.hasRod) {
          showDialog(t('msg.fishing.needRod'));
          return;
        }

        if (!ctx.hasEquippedRod) {
          showDialog(t('msg.fishing.equipRod'));
          return;
        }

        // ??노뻻 ??뺣즲 (strict: must face water)
        if (ctx.hasEquippedRod) {
          if (ctx.frontIsWater) {
            if (state.stamina < 3) {
              if (addSystemMsg) addSystemMsg('체력이 부족합니다. 야전침대에서 휴식하세요.', '#e74c3c');
              else showDialog('체력이 부족합니다. 야전침대에서 휴식하세요.');
              return;
            }
            state.stamina = Math.max(0, state.stamina - 3);
            state.uiDirty = true;
            state.isFishing = true;
            player.isFishing = true; // ??볦퍟???怨밴묶 ??쇱젟
            QuestSystem.emitQuestEvent(state, 'START_FISHING', { nearWater: ctx.nearWater, frontIsWater: ctx.frontIsWater });
            showDialog(t('msg.fishing.started'));
            state.debug.fishingStartGate = "OK";
          } else if (ctx.nearWater) {
            showDialog(t('msg.fishing.faceWater'));
            state.debug.fishingStartGate = "NOT_FACING_WATER";
          } else {
            showDialog(t('msg.fishing.cantHere'));
            state.debug.fishingStartGate = "NOT_NEAR_WATER";
          }
        }
      }
    }
  }
};

export const QuestSystem = {
  acceptQuest(state, questId) {
    ensureQuestState(state);
    if (!questId || state.quests.activeQuestIds.includes(questId) || state.quests.completedQuestIds.includes(questId)) return false;
    const quest = QUESTS_BY_ID[questId];
    if (!quest) return false;
    state.quests.activeQuestIds.push(questId);
    if (!state.quests.stepProgress[questId] || typeof state.quests.stepProgress[questId] !== 'object') {
      state.quests.stepProgress[questId] = {};
    }
    state.quests._dirty = true;
    return true;
  },

  completeStep(state, questId, stepId) {
    ensureQuestState(state);
    const quest = QUESTS_BY_ID[questId];
    if (!quest) return false;
    const step = quest.steps.find((s) => s.id === stepId);
    if (!step) return false;
    if (!state.quests.stepProgress[questId] || typeof state.quests.stepProgress[questId] !== 'object') {
      state.quests.stepProgress[questId] = {};
    }
    const need = Math.max(1, Number(step.count || 1));
    const cur = Number(state.quests.stepProgress[questId][stepId] || 0);
    if (cur >= need) return false;
    state.quests.stepProgress[questId][stepId] = need;
    state.quests._dirty = true;
    return true;
  },

  isQuestComplete(state, questId) {
    ensureQuestState(state);
    const quest = QUESTS_BY_ID[questId];
    if (!quest) return false;
    const progress = state.quests.stepProgress[questId] || {};
    return quest.steps.every((step) => Number(progress[step.id] || 0) >= Math.max(1, Number(step.count || 1)));
  },

  validateSpatialQuests(state, map) {
    if (!state.quests || !state.quests.activeQuestIds || !state.quests.activeQuestIds.length) return false;
    let changed = false;
    for (const questId of state.quests.activeQuestIds.slice()) {
      const quest = QUESTS_BY_ID[questId];
      if (!quest) continue;
      const progress = state.quests.stepProgress[questId] || {};
      const step = getCurrentStep(quest, progress);
      if (step && step.type === 'MOVE' && step.targetPOI) {
        if (isNearPOI(map, state.playerPos, step.targetPOI)) {
          if (this.completeStep(state, questId, step.id)) {
            changed = true;
            if (this.isQuestComplete(state, questId)) {
              if (this.completeQuest(state, questId)) changed = true;
            }
          }
        }
      }
    }
    if (changed) state.quests._dirty = true;
    return changed;
  },

  completeQuest(state, questId) {
    ensureQuestState(state);
    const quest = QUESTS_BY_ID[questId];
    if (!quest) return false;
    if (!this.isQuestComplete(state, questId)) return false;
    state.quests.activeQuestIds = state.quests.activeQuestIds.filter((id) => id !== questId);
    if (!state.quests.completedQuestIds.includes(questId)) state.quests.completedQuestIds.push(questId);
    if (Array.isArray(quest.rewards)) {
      quest.rewards.forEach((reward) => {
        if (reward?.type === 'MONEY') {
          state.money = (state.money || 0) + (reward.amount || 0);
        } else if (reward?.type === 'ITEM') {
          if (!Array.isArray(state.inventory)) state.inventory = [];
          const count = reward.count || 1;
          invAdd(state.inventory, reward.itemId, count);
          if (isTrapItem(reward.itemId)) {
            if (!Array.isArray(state.trapInventory)) state.trapInventory = [];
            state.trapInventory.push({ itemId: reward.itemId, capacity: getTrapCapacityByItem(reward.itemId), fishes: [] });
          }
        }
      });
    }
    if (Array.isArray(state.quests.newlyCompletedQueue)) {
      state.quests.newlyCompletedQueue.push(questId);
    }
    if (quest.nextQuestId) this.acceptQuest(state, quest.nextQuestId);
    state.quests._dirty = true;
    return true;
  },

  emitQuestEvent(state, eventType, payload = {}) {
    ensureQuestState(state);
    if (!eventType) return false;
    if (!state.quests.accepted) state.quests.accepted = {};
    let changed = false;
    for (const questId of state.quests.activeQuestIds.slice()) {
      const quest = QUESTS_BY_ID[questId];
      if (!quest) continue;
      // 수락되지 않은 퀘스트는 이벤트 진행을 무시함 (단, autoAccept는 예외)
      if (!state.quests.accepted[questId] && !quest.autoAccept) continue;
      const progress = state.quests.stepProgress[questId] || {};
      const step = getCurrentStep(quest, progress);
      if (!step) {
        if (this.completeQuest(state, questId)) changed = true;
        continue;
      }
      if (!matchesQuestEvent(step, eventType, payload)) continue;
      const need = Math.max(1, Number(step.count || 1));
      const cur = Number(progress[step.id] || 0);
      if (cur >= need) continue;
      if (!state.quests.stepProgress[questId] || typeof state.quests.stepProgress[questId] !== 'object') {
        state.quests.stepProgress[questId] = {};
      }
      state.quests.stepProgress[questId][step.id] = Math.min(need, cur + 1);
      changed = true;
      if (this.isQuestComplete(state, questId)) {
        if (this.completeQuest(state, questId)) changed = true;
      }
    }
    if (changed) state.quests._dirty = true;
    return changed;
  },

  getCurrentQuest(state) {
    ensureQuestState(state);
    const questId = state.quests.activeQuestIds[0];
    if (!questId) return null;
    return QUESTS_BY_ID[questId] || null;
  },

  getQuestNpcDialog(state, npcId, npcName = 'NPC') {
    ensureQuestState(state);
    const questForNpc = state.quests.activeQuestIds
      .map((id) => QUESTS_BY_ID[id])
      .find((quest) => quest && quest.npcId === npcId);
    if (!questForNpc) return `${npcName}: 지금은 맡길 일이 없구나.`;
    const progress = state.quests.stepProgress[questForNpc.id] || {};
    const step = getCurrentStep(questForNpc, progress);
    if (!step) return `${npcName}: 잘했구나! 다음 일을 보자.`;
    return `${npcName}: ${questForNpc.title}\n- ${step.text}`;
  },

  getQuestList() {
    return QUESTS.slice();
  }
};

// ========================================
// FarmingSystem — 작물 성장 엔진 (Timestamp 기반)
// ========================================
export const FarmingSystem = {
  update(state, dt = 0) {
    if (!state.farm) return;
    const now = Date.now();
    const STAGE_DURATION = 60000; // 1단계당 60초 (테스트용)

    for (const key in state.farm) {
      const [fx, fy] = key.split(',').map(Number);

      // [긴급 패치] 현재 지정된 텃밭 구역이 아닌 곳의 밭(고스트 밭) 자동 삭제
      if (!isFarmableTile(fx, fy)) {
        delete state.farm[key];
        state.uiDirty = true;
        continue;
      }

      const crop = state.farm[key];
      if (!crop.cropId || crop.stage >= 3 || !crop.plantedAt) continue;

      // 물을 줬다면 성장 속도 30% 가속
      const speedMult = crop.waterLevel > 0 ? 1.3 : 1.0;
      const elapsed = (now - crop.plantedAt) * speedMult;

      const newStage = Math.min(3, 1 + Math.floor(elapsed / STAGE_DURATION));
      if (newStage > crop.stage) {
        crop.stage = newStage;
        crop.waterLevel = 0; // 다음 단계 진입 시 수분 증발
        state.uiDirty = true;
      }
    }
  }
};
