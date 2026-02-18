import { TILE_SIZE, COLORS } from '../core/constants.js';

// [Helper] ??ル쪇援??곌랜?????貫??(?遊붋??類ㅼ몠????嶺뚯쉳????
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

function normalizeFishRarity(raw) {
  if (!raw) return 'C';
  if (raw === 'COMMON') return 'C';
  if (raw === 'UNCOMMON') return 'B';
  if (raw === 'RARE') return 'A';
  if (raw === 'EPIC') return 'S';
  return raw;
}

function getWeightScale(weightClass) {
  if (weightClass === 'small') return 0.82;
  if (weightClass === 'large') return 1.18;
  return 1.0;
}

function getRarityStyle(rarity) {
  const r = normalizeFishRarity(rarity);
  if (r === 'SS') return { fill: '#9dd7ff', stroke: '#eaf7ff', line: 2.4, glow: '#9be7ff' };
  if (r === 'S') return { fill: '#f1c40f', stroke: '#fff6c5', line: 2.1, glow: '#f9e079' };
  if (r === 'A') return { fill: '#4aa3ff', stroke: '#bcdfff', line: 1.8, glow: null };
  if (r === 'B') return { fill: '#5abf72', stroke: '#bde8c8', line: 1.5, glow: null };
  return { fill: '#7f8c99', stroke: '#c8d0d8', line: 1.2, glow: null };
}

function buildBodyPath(ctx, shape, cx, cy, bodyW, bodyH) {
  ctx.beginPath();
  if (shape === 'BULKY') {
    ctx.ellipse(cx - bodyW * 0.06, cy, bodyW * 0.52, bodyH * 0.56, 0, 0, Math.PI * 2);
    return;
  }
  if (shape === 'LONG_FLAT') {
    ctx.moveTo(cx - bodyW * 0.58, cy);
    ctx.bezierCurveTo(cx - bodyW * 0.22, cy - bodyH * 0.85, cx + bodyW * 0.45, cy - bodyH * 0.35, cx + bodyW * 0.62, cy);
    ctx.bezierCurveTo(cx + bodyW * 0.38, cy + bodyH * 0.45, cx - bodyW * 0.18, cy + bodyH * 0.85, cx - bodyW * 0.58, cy);
    ctx.closePath();
    return;
  }
  if (shape === 'EEL') {
    ctx.moveTo(cx - bodyW * 0.64, cy - bodyH * 0.2);
    ctx.bezierCurveTo(cx - bodyW * 0.25, cy + bodyH * 0.85, cx + bodyW * 0.25, cy - bodyH * 0.85, cx + bodyW * 0.68, cy + bodyH * 0.12);
    ctx.lineWidth = Math.max(2, bodyH * 0.9);
    ctx.lineCap = 'round';
    return;
  }
  if (shape === 'SPHERICAL') {
    ctx.arc(cx - bodyW * 0.08, cy, Math.max(bodyW, bodyH) * 0.42, 0, Math.PI * 2);
    return;
  }
  if (shape === 'TRIANGLE') {
    ctx.moveTo(cx - bodyW * 0.6, cy);
    ctx.lineTo(cx, cy - bodyH * 0.75);
    ctx.lineTo(cx + bodyW * 0.45, cy);
    ctx.lineTo(cx, cy + bodyH * 0.75);
    ctx.closePath();
    return;
  }
  if (shape === 'ELEGANT') {
    ctx.moveTo(cx - bodyW * 0.6, cy);
    ctx.bezierCurveTo(cx - bodyW * 0.15, cy - bodyH * 0.85, cx + bodyW * 0.48, cy - bodyH * 0.1, cx + bodyW * 0.52, cy);
    ctx.bezierCurveTo(cx + bodyW * 0.28, cy + bodyH * 0.35, cx - bodyW * 0.22, cy + bodyH * 0.7, cx - bodyW * 0.6, cy);
    ctx.closePath();
    return;
  }
  if (shape === 'SLIM') {
    ctx.ellipse(cx, cy, bodyW * 0.52, bodyH * 0.34, 0, 0, Math.PI * 2);
    return;
  }
  ctx.ellipse(cx, cy, bodyW * 0.52, bodyH * 0.46, 0, 0, Math.PI * 2);
}

export function drawFishIcon(ctx, fishDef, size) {
  if (!ctx || !fishDef) return;
  const v = fishDef.visual || {};
  const region = fishDef.region || fishDef.habitat || 'midstream';
  const shape = v.shape || (region === 'upstream' ? 'SLIM' : region === 'downstream' ? 'BULKY' : region === 'sea' ? 'ELEGANT' : 'ROUNDED');
  const habitat = fishDef.habitat || region;
  const weightClass = fishDef.weightClass || 'medium';
  const rarity = normalizeFishRarity(fishDef.rarity || fishDef.rarityTier || 'C');
  const rarityStyle = getRarityStyle(rarity);
  const regionScale = region === 'sea' ? 1.08 : region === 'downstream' ? 1.12 : region === 'upstream' ? 0.9 : 1.0;
  const scale = (v.scale || 1) * getWeightScale(weightClass) * regionScale;

  const cx = size * 0.5;
  const cy = size * 0.5;
  const bodyW = size * 0.44 * scale;
  const bodyH = size * 0.28 * scale;
  const baseColor = v.baseColor || rarityStyle.fill;
  const finColor = v.finColor || baseColor;
  const patternMode = v.pattern || (habitat === 'river' ? 'STRIPES_V' : habitat === 'sea' ? 'STRIPES_H' : habitat === 'deep' ? 'SPOTS' : 'SPOTS_RED');
  const patternColor = v.patternColor || (habitat === 'deep' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.22)');

  if (rarityStyle.glow) {
    ctx.shadowBlur = 6;
    ctx.shadowColor = rarityStyle.glow;
  }

  // tail
  ctx.fillStyle = finColor;
  ctx.beginPath();
  if (shape === 'ELEGANT') {
    ctx.moveTo(cx + bodyW * 0.42, cy);
    ctx.lineTo(cx + bodyW * 0.82, cy - bodyH * 0.52);
    ctx.quadraticCurveTo(cx + bodyW * 0.72, cy, cx + bodyW * 0.82, cy + bodyH * 0.52);
    ctx.closePath();
  } else {
    ctx.moveTo(cx + bodyW * 0.5, cy);
    ctx.lineTo(cx + bodyW * 0.9, cy - bodyH * 0.42);
    ctx.lineTo(cx + bodyW * 0.9, cy + bodyH * 0.42);
    ctx.closePath();
  }
  ctx.fill();

  // body
  if (shape === 'EEL') {
    buildBodyPath(ctx, shape, cx, cy, bodyW, bodyH);
    ctx.strokeStyle = baseColor;
    ctx.stroke();
  } else {
    buildBodyPath(ctx, shape, cx, cy, bodyW, bodyH);
    ctx.fillStyle = baseColor;
    ctx.fill();
  }

  // pattern clipped to body
  ctx.save();
  buildBodyPath(ctx, shape, cx, cy, bodyW, bodyH);
  ctx.clip();
  ctx.fillStyle = patternColor;

  if (patternMode === 'STRIPES' || patternMode === 'STRIPES_V') {
    for (let i = -1; i <= 2; i++) ctx.fillRect(cx - bodyW * 0.35 + i * (bodyW * 0.26), cy - bodyH, Math.max(2, size * 0.045), bodyH * 2);
  } else if (patternMode === 'STRIPES_H') {
    for (let i = -1; i <= 1; i++) ctx.fillRect(cx - bodyW, cy - bodyH * 0.16 + i * (bodyH * 0.35), bodyW * 2, Math.max(2, size * 0.045));
  } else if (patternMode === 'SCALES') {
    for (let y = -2; y <= 2; y++) {
      for (let x = -3; x <= 3; x++) {
        ctx.beginPath();
        ctx.arc(cx + x * (bodyW * 0.2), cy + y * (bodyH * 0.24), Math.max(1, size * 0.04), 0, Math.PI);
        ctx.fill();
      }
    }
  } else if (patternMode === 'BLOTCH') {
    for (let i = 0; i < 4; i++) {
      const ox = Math.sin((i + 1) * 1.7) * bodyW * 0.4;
      const oy = Math.cos((i + 2) * 1.3) * bodyH * 0.35;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, Math.max(2, size * (0.04 + (i % 2) * 0.02)), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (patternMode === 'SPOTS' || patternMode === 'SPOTS_RED') {
    ctx.fillStyle = patternMode === 'SPOTS_RED' ? '#e74c3c' : patternColor;
    for (let i = 0; i < 4; i++) {
      const ox = Math.sin((i + 3) * 2.1) * bodyW * 0.35;
      const oy = Math.cos((i + 1) * 1.9) * bodyH * 0.32;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, Math.max(1.5, size * 0.04), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (patternMode === 'ZIGZAG') {
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.5, cy - bodyH * 0.1);
    ctx.lineTo(cx - bodyW * 0.25, cy + bodyH * 0.18);
    ctx.lineTo(cx, cy - bodyH * 0.1);
    ctx.lineTo(cx + bodyW * 0.25, cy + bodyH * 0.18);
    ctx.lineTo(cx + bodyW * 0.5, cy - bodyH * 0.1);
    ctx.stroke();
  }
  ctx.restore();

  // habitat accent
  if (habitat === 'rare') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const px = cx - bodyW * 0.15 + i * (bodyW * 0.28);
      const py = cy - bodyH * 0.8 + (i % 2 === 0 ? -1 : 2);
      ctx.fillRect(px, py, 1.5, 1.5);
    }
  }

  // feature
  const feature = v.feature;
  if (feature === 'WHISKER_SHORT' || feature === 'WHISKER_LONG') {
    const whiskerLen = feature === 'WHISKER_LONG' ? bodyW * 0.65 : bodyW * 0.4;
    ctx.strokeStyle = '#1f2a35';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.5, cy + 1);
    ctx.quadraticCurveTo(cx - bodyW * 0.82, cy + bodyH * 0.2, cx - bodyW * 0.5 - whiskerLen, cy + bodyH * 0.45);
    ctx.moveTo(cx - bodyW * 0.5, cy - 1);
    ctx.quadraticCurveTo(cx - bodyW * 0.82, cy - bodyH * 0.2, cx - bodyW * 0.5 - whiskerLen, cy - bodyH * 0.45);
    ctx.stroke();
  } else if (feature === 'SPIKE_DORSAL' || feature === 'FIN_SHARP') {
    ctx.fillStyle = finColor;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.35, cy - bodyH * 0.35);
    ctx.lineTo(cx - bodyW * 0.05, cy - bodyH * 0.95);
    ctx.lineTo(cx + bodyW * 0.2, cy - bodyH * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (feature === 'FIN_FLOW') {
    ctx.strokeStyle = finColor;
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.beginPath();
    ctx.moveTo(cx + bodyW * 0.05, cy + bodyH * 0.2);
    ctx.quadraticCurveTo(cx + bodyW * 0.45, cy + bodyH * 0.45, cx + bodyW * 0.55, cy + bodyH * 0.75);
    ctx.stroke();
  } else if (feature === 'SPIKES') {
    ctx.strokeStyle = '#6e4f1e';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const sx = cx + Math.cos(ang) * (bodyW * 0.52);
      const sy = cy + Math.sin(ang) * (bodyH * 0.62);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * 3, sy + Math.sin(ang) * 3);
      ctx.stroke();
    }
  } else if (feature === 'JAW_HOOK') {
    ctx.strokeStyle = '#2f3640';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW * 0.45, cy + bodyH * 0.1);
    ctx.quadraticCurveTo(cx - bodyW * 0.62, cy + bodyH * 0.42, cx - bodyW * 0.28, cy + bodyH * 0.42);
    ctx.stroke();
  }

  // outline
  buildBodyPath(ctx, shape, cx, cy, bodyW, bodyH);
  ctx.strokeStyle = v.outlineColor || rarityStyle.stroke;
  ctx.lineWidth = rarityStyle.line;
  if (shape === 'EEL') ctx.stroke();
  else ctx.stroke();

  // eye
  const eyeX = shape === 'LONG_FLAT' || shape === 'EEL' ? cx - bodyW * 0.4 : cx - bodyW * 0.28;
  const eyeY = cy - bodyH * 0.1;
  ctx.fillStyle = '#f8f9fa';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, Math.max(1.8, size * 0.065), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(eyeX + 0.8, eyeY, Math.max(0.8, size * 0.028), 0, Math.PI * 2);
  ctx.fill();

  if (rarity === 'SS') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(cx - bodyW * 0.05, cy - bodyH * 0.75, 2, 2);
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

export function drawRodIcon(ctx, rodDef, size) {
  if (!ctx || !rodDef) return;
  const tier = rodDef.tier || 1;
  const startX = size * 0.2;
  const startY = size * 0.8;
  const endX = size * 0.8;
  const endY = size * 0.2;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tier <= 1) {
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = size * 0.12;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(size * 0.42, size * 0.42, endX, endY);
    ctx.stroke();

    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(size * 0.34, size * 0.65);
    ctx.lineTo(size * 0.36, size * 0.61);
    ctx.moveTo(size * 0.47, size * 0.53);
    ctx.lineTo(size * 0.49, size * 0.49);
    ctx.stroke();

    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.arc(startX + size * 0.1, startY - size * 0.1, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (tier === 2) {
    ctx.strokeStyle = '#2f3d4a';
    ctx.lineWidth = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(size * 0.4, size * 0.6);
    ctx.stroke();

    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = size * 0.08;
    ctx.beginPath();
    ctx.moveTo(size * 0.4, size * 0.6);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.arc(size * 0.6, size * 0.4, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    ctx.arc(startX + size * 0.12, startY - size * 0.12, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(startX + size * 0.12, startY - size * 0.12, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowBlur = Math.max(3, size * 0.15);
    ctx.shadowColor = '#f1c40f';

    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = size * 0.1;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.strokeStyle = '#fff7cc';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(startX + size * 0.1, startY - size * 0.1, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(endX, endY, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBagIcon(ctx, bagDef, size) {
  if (!ctx || !bagDef) return;
  const capacity = bagDef.bagCapacity || bagDef.capacity || 10;
  const radius = Math.max(3, Math.floor(size * 0.14));
  const roundRect = (x, y, w, h, r) => {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  };

  if (capacity <= 10) {
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath();
    ctx.moveTo(size * 0.3, size * 0.2);
    ctx.quadraticCurveTo(size * 0.1, size * 0.8, size * 0.5, size * 0.9);
    ctx.quadraticCurveTo(size * 0.9, size * 0.8, size * 0.7, size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.beginPath();
    ctx.moveTo(size * 0.35, size * 0.3);
    ctx.lineTo(size * 0.65, size * 0.3);
    ctx.stroke();
  } else if (capacity <= 40) {
    ctx.fillStyle = '#3498db';
    roundRect(size * 0.2, size * 0.3, size * 0.6, size * 0.5, radius);
    ctx.fill();
    ctx.fillStyle = '#ecf0f1';
    roundRect(size * 0.18, size * 0.25, size * 0.64, size * 0.15, radius * 0.7);
    ctx.fill();
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(size * 0.45, size * 0.35, size * 0.1, size * 0.1);
  } else {
    ctx.fillStyle = '#2c3e50';
    roundRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6, radius + 2);
    ctx.fill();
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.stroke();

    ctx.shadowBlur = Math.max(3, size * 0.12);
    ctx.shadowColor = '#2ecc71';
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function drawTrapIcon(ctx, trapItem, x, y, size = TILE_SIZE) {
  if (!ctx) return;
  const itemId = trapItem?.id || trapItem?.itemId || 'bait_heavy';
  const cap = Number(trapItem?.trapCapacity || trapItem?.capacity || (itemId === 'bait_lure' ? 30 : itemId === 'bait_hook' ? 20 : 10));
  const bodyW = Math.floor(size * 0.62);
  const bodyH = Math.floor(size * 0.44);
  const bx = x + Math.floor((size - bodyW) / 2);
  const by = y + Math.floor(size * 0.42);
  const bodyColor = cap >= 30 ? '#0f766e' : cap >= 20 ? '#0ea5a5' : '#14b8a6';

  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by, bodyW, bodyH);
  ctx.strokeStyle = '#d1fae5';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bodyW, bodyH);

  ctx.strokeStyle = 'rgba(236,253,245,0.55)';
  for (let ix = bx + 3; ix < bx + bodyW; ix += 6) {
    ctx.beginPath();
    ctx.moveTo(ix, by);
    ctx.lineTo(ix, by + bodyH);
    ctx.stroke();
  }
  for (let iy = by + 3; iy < by + bodyH; iy += 6) {
    ctx.beginPath();
    ctx.moveTo(bx, iy);
    ctx.lineTo(bx + bodyW, iy);
    ctx.stroke();
  }

  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x + Math.floor(size * 0.18), y + Math.floor(size * 0.2), Math.floor(size * 0.64), Math.max(2, Math.floor(size * 0.08)));
}

export class Player {
  constructor(tx, ty, facing = 'down') {
    this.tx = Number.isFinite(tx) ? tx : 0;
    this.ty = Number.isFinite(ty) ? ty : 0;
    this.facing = facing;
    this.renderX = this.tx * TILE_SIZE;
    this.renderY = this.ty * TILE_SIZE;
    this.isMoving = false;
    this.animTimer = 0;
    this.walkFrame = 0;
    this.rodTier = 1;
    this.history = [];
    this.maxHistory = 20;
    this.recordHistory();
  }

  setPosition(tx, ty, facing) {
    if (this.tx !== tx || this.ty !== ty) {
      this.isMoving = true;
      this.recordHistory();
    }
    this.tx = tx;
    this.ty = ty;
    this.facing = facing;
  }

  recordHistory() {
    this.history.unshift({ tx: this.tx, ty: this.ty });
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }

  update(dt) {
    const smoothFactor = 0.2;
    const targetX = this.tx * TILE_SIZE;
    const targetY = this.ty * TILE_SIZE;
    if (Math.abs(targetX - this.renderX) < 0.5) this.renderX = targetX;
    else this.renderX = lerp(this.renderX, targetX, smoothFactor);
    if (Math.abs(targetY - this.renderY) < 0.5) this.renderY = targetY;
    else this.renderY = lerp(this.renderY, targetY, smoothFactor);

    const dist = Math.abs(targetX - this.renderX) + Math.abs(targetY - this.renderY);
    if (dist > 1) {
      this.animTimer += dt * 5;
      if (this.animTimer > 1) {
        this.animTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 2;
      }
    } else {
      this.walkFrame = 0;
    }
  }

  render(ctx) {
    const cx = this.renderX;
    const cy = this.renderY;
    const size = TILE_SIZE;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + size / 2, cy + size - 2, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.isSeated) {
      const baseY = cy + 4;
      ctx.fillStyle = '#ffccaa';
      ctx.fillRect(cx + 8, baseY + 2, 16, 12);
      ctx.fillStyle = COLORS.PLAYER_OUTLINE;
      ctx.fillRect(cx + 8, baseY, 16, 5);
      ctx.fillStyle = COLORS.PLAYER;
      ctx.fillRect(cx + 9, baseY + 13, 14, 9);
      ctx.fillStyle = COLORS.PLAYER_OUTLINE;
      ctx.fillRect(cx + 10, baseY + 22, 4, 2);
      ctx.fillRect(cx + 18, baseY + 22, 4, 2);

      ctx.fillStyle = '#2c3e50';
      if (this.facing === 'up') {
        ctx.fillRect(cx + 11, baseY + 6, 2, 2);
        ctx.fillRect(cx + 19, baseY + 6, 2, 2);
        ctx.fillRect(cx + 15, baseY + 14, 2, 3);
      } else if (this.facing === 'left') {
        ctx.fillRect(cx + 10, baseY + 7, 2, 2);
        ctx.fillRect(cx + 16, baseY + 8, 2, 2);
        ctx.fillRect(cx + 8, baseY + 15, 2, 4);
      } else if (this.facing === 'right') {
        ctx.fillRect(cx + 20, baseY + 7, 2, 2);
        ctx.fillRect(cx + 14, baseY + 8, 2, 2);
        ctx.fillRect(cx + 22, baseY + 15, 2, 4);
      } else {
        ctx.fillRect(cx + 12, baseY + 7, 2, 2);
        ctx.fillRect(cx + 18, baseY + 7, 2, 2);
      }

      if (this.isFishing) {
        const rodTier = this.rodTier || 1;
        ctx.strokeStyle = rodTier >= 3 ? '#f1c40f' : rodTier >= 2 ? '#3498db' : '#e67e22';
        ctx.lineWidth = 2;
        ctx.beginPath();

        let rodStartX = cx + size / 2;
        let rodStartY = baseY + 14;
        let rodEndX = rodStartX;
        let rodEndY = rodStartY;

        if (this.facing === 'left') {
          rodStartX = cx + 8; rodStartY = baseY + 14; rodEndX = cx - 18; rodEndY = baseY + 8;
        } else if (this.facing === 'right') {
          rodStartX = cx + size - 8; rodStartY = baseY + 14; rodEndX = cx + size + 18; rodEndY = baseY + 8;
        } else if (this.facing === 'up') {
          rodStartX = cx + size / 2; rodStartY = baseY + 6; rodEndX = cx + size / 2; rodEndY = baseY - 16;
        } else {
          rodStartX = cx + size / 2; rodStartY = baseY + 22; rodEndX = cx + size / 2; rodEndY = baseY + size + 8;
        }

        ctx.moveTo(rodStartX, rodStartY);
        ctx.lineTo(rodEndX, rodEndY);
        ctx.stroke();

        ctx.fillStyle = rodTier >= 3 ? '#fff4c4' : '#e74c3c';
        ctx.beginPath();
        ctx.arc(rodEndX, rodEndY + (Math.sin(Date.now() / 200) * 2), 3, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const bounce = this.walkFrame === 1 ? -2 : 0;
    ctx.fillStyle = COLORS.PLAYER;
    ctx.fillRect(cx + 8, cy + 12 + bounce, 16, 14);
    ctx.fillStyle = '#ffccaa';
    ctx.fillRect(cx + 6, cy + 2 + bounce, 20, 14);
    ctx.fillStyle = COLORS.PLAYER_OUTLINE;
    ctx.fillRect(cx + 6, cy + bounce, 20, 6);
    ctx.fillRect(cx + 4, cy + 4 + bounce, 2, 6);
    ctx.fillRect(cx + 26, cy + 4 + bounce, 2, 6);

    ctx.fillStyle = '#2c3e50';
    let eyeOffsetX = 0;
    if (this.facing === 'left') eyeOffsetX = -2;
    if (this.facing === 'right') eyeOffsetX = 2;

    if (this.facing !== 'up') {
      ctx.fillRect(cx + 10 + eyeOffsetX, cy + 8 + bounce, 2, 2);
      ctx.fillRect(cx + 20 + eyeOffsetX, cy + 8 + bounce, 2, 2);
    }

    if (this.isFishing) {
      const rodTier = this.rodTier || 1;
      ctx.strokeStyle = rodTier >= 3 ? '#f1c40f' : rodTier >= 2 ? '#3498db' : '#e67e22';
      ctx.lineWidth = 2;
      ctx.beginPath();

      let rodEndX = cx;
      let rodEndY = cy;
      if (this.facing === 'left') {
        ctx.moveTo(cx, cy + 12 + bounce); rodEndX = cx - 20; rodEndY = cy + 5 + bounce;
      } else if (this.facing === 'right') {
        ctx.moveTo(cx + size, cy + 12 + bounce); rodEndX = cx + size + 20; rodEndY = cy + 5 + bounce;
      } else if (this.facing === 'up') {
        ctx.moveTo(cx + size / 2, cy + bounce); rodEndX = cx + size / 2; rodEndY = cy - 20 + bounce;
      } else {
        ctx.moveTo(cx + size / 2, cy + size + bounce); rodEndX = cx + size / 2; rodEndY = cy + size + 20 + bounce;
      }

      ctx.lineTo(rodEndX, rodEndY);
      ctx.stroke();
      ctx.fillStyle = rodTier >= 3 ? '#fff4c4' : '#e74c3c';
      ctx.beginPath();
      ctx.arc(rodEndX, rodEndY + (Math.sin(Date.now() / 200) * 2), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
export class Pet {
  constructor(id, data) {
    this.id = id;
    this.name = data.name;
    this.skillType = data.skillType || null;
    this.color = data.color || '#95a5a6';
    this.visual = data.visual || {};

    this.tx = 0;
    this.ty = 0;
    this.renderX = 0;
    this.renderY = 0;
    this.floatTimer = 0;
  }

  update(player, dt) {
    const target = player.history[Math.min(3, player.history.length - 1)];
    if (target) {
      this.tx = target.tx;
      this.ty = target.ty;
    }

    const targetX = this.tx * TILE_SIZE;
    const targetY = this.ty * TILE_SIZE;
    this.renderX = lerp(this.renderX, targetX, 0.25);
    this.renderY = lerp(this.renderY, targetY, 0.25);
    this.floatTimer += dt * 3;
  }

  render(ctx) {
    const cx = this.renderX;
    const cy = this.renderY;
    const size = TILE_SIZE;
    const shape = this.visual.shape
      || (this.skillType === 'FISHING_WEIGHT' ? 'CIRCLE' : this.skillType === 'FISHING_LUCK' ? 'OVAL' : 'TRIANGLE');
    const eyeStyle = this.visual.eyeStyle || 'DOT';
    const accentColor = this.visual.accentColor || '#ffffff';
    const floatAmp = this.visual.floatAnim ? 3 : 2;
    const floatY = Math.sin(this.floatTimer) * floatAmp;
    const bodyX = cx + size * 0.5;
    const bodyY = cy + size * 0.54 + floatY;
    const primary = this.color;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + size / 2, cy + size - 4, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = primary;
    if (shape === 'CIRCLE') {
      ctx.beginPath();
      ctx.arc(bodyX, bodyY, size * 0.27, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'TRIANGLE') {
      ctx.beginPath();
      ctx.moveTo(cx + size * 0.5, cy + size * 0.22 + floatY);
      ctx.lineTo(cx + size * 0.78, cy + size * 0.74 + floatY);
      ctx.lineTo(cx + size * 0.22, cy + size * 0.74 + floatY);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'STACKED') {
      ctx.beginPath();
      ctx.ellipse(bodyX, cy + size * 0.62 + floatY, size * 0.30, size * 0.20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.ellipse(bodyX, cy + size * 0.38 + floatY, size * 0.20, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = primary;
    } else {
      ctx.beginPath();
      ctx.ellipse(bodyX, bodyY, size * 0.30, size * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.ellipse(bodyX, cy + size * 0.33 + floatY, size * 0.08, size * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    const eyeY = cy + size * 0.5 + floatY;
    const eyeR = eyeStyle === 'WIDE' ? size * 0.05 : (eyeStyle === 'SMALL' ? size * 0.028 : size * 0.038);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(bodyX - size * 0.1, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyX + size * 0.1, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bodyX - size * 0.1 + 1, eyeY - 1, Math.max(1, eyeR * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bodyX + size * 0.1 + 1, eyeY - 1, Math.max(1, eyeR * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
}
