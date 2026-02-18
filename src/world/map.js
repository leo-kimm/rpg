import { TILE_SIZE } from '../core/constants.js';

const WIDTH = 50;
const HEIGHT = 40;

const TILE_LEGEND = {
  '.': { type: 0, collision: 0 },
  '#': { type: 2, collision: 1 },
  'T': { type: 3, collision: 2 },
  '=': { type: 1, collision: 0 },
  '+': { type: 5, collision: 0 },
  '~': { type: 4, collision: 1 },
  'B': { type: 6, collision: 0 },
  'Z': { type: 7, collision: 0 },
  'S': { type: 8, collision: 0 },
  '^': { type: 9, collision: 1 },
  'O': { type: 10, collision: 2 },
  'X': { type: 11, collision: 1 },
  '*': { type: 12, collision: 0 },
  'P': { type: 1, collision: 0 },
  'H': { type: 2, collision: 1 }
};

const WATER_CHARS = new Set(['~']);
const WATER_ZONES = [
  { region: 'upstream', rect: { x: 0, y: 0, w: WIDTH, h: 15 } },
  { region: 'midstream', rect: { x: 0, y: 15, w: WIDTH, h: 13 } },
  { region: 'downstream', rect: { x: 0, y: 28, w: WIDTH, h: 5 } },
  { region: 'sea', rect: { x: 0, y: 33, w: WIDTH, h: HEIGHT - 33 } }
];

const MAP_LAYOUT = [
  "^^^^^^^^^^^^^^^^^^^^^^OO^^^^^^^^^^^^^^^^^^^^^^^^^^",
  "^^^^^^^^^^^^^^^^^~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^",
  "^^^^^^^^^TTTT^^^~B~~~~~~^^^TTTT^^^^^^^^^^^^^^^^^^^",
  "^^^^^^^^TTTTT^^^~~......~^^TTTTT^^^^^^^^^^^^^^^^^^",
  "##.......TTTT....~......~.......................##",
  "#.........TT.....~......~........................#",
  "#................~..Z...~........................#",
  "#................~..Z...~........................#",
  "#...*******......~......~......+++++++++++++.....#",
  "#...*******......~......~......+XXXXXXXXXXX+.....#",
  "#...*******......~......~......+XXXXXXXXXXX+.....#",
  "#................~......~......+XXXXXXXXXXX+.....#",
  "#................~~~B~~~~......+++++...+++++.....#",
  "#...................=...............=............#",
  "#...................=...............=............#",
  "#...................=...............=............#",
  "#....T...T..........=.......P.P.....=............#",
  "#...TTTTTTT.........=.......P.P.....=............#",
  "#....T...T..........=...............=............#",
  "#...................=...............=............#",
  "#...................=...............=............#",
  "#................~~~~~~~~...........=............#",
  "#................~......~...........=............#",
  "#................~..Z...~...........=............#",
  "#................~..Z...~...........=............#",
  "#................~......~...........=............#",
  "#................~......~........................#",
  "#TT..............~......~......................TT#",
  "#TTT.............~......~.....................TTT#",
  "#TTTT............~~~B~~~~....................TTTT#",
  "#SSSS...............=.......................SSSSS#",
  "#SSSSSSSS...........=.............XX....XX.SSSSSS#",
  "#SSSSSSSS...........=.............XX....XX.SSSSSS#",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
];

const TILE_LAYER = new Array(WIDTH * HEIGHT).fill(0);
const COLLISION_LAYER = new Array(WIDTH * HEIGHT).fill(0);

if (MAP_LAYOUT.length !== HEIGHT || MAP_LAYOUT[0].length !== WIDTH) {
  console.error(`Map Layout Size Error! Expected ${WIDTH}x${HEIGHT}, Got ${MAP_LAYOUT[0].length}x${MAP_LAYOUT.length}`);
}

for (let y = 0; y < HEIGHT; y++) {
  const row = MAP_LAYOUT[y] || '';
  for (let x = 0; x < WIDTH; x++) {
    const char = row[x] || '.';
    const tileDef = TILE_LEGEND[char] || TILE_LEGEND['.'];
    const i = y * WIDTH + x;
    TILE_LAYER[i] = tileDef.type;
    COLLISION_LAYER[i] = tileDef.collision;
  }
}

export const WORLD_MAP = {
  id: 'village_main',
  width: WIDTH,
  height: HEIGHT,
  spawnPoint: { x: 22, y: 16 },
  poi: [
    {
      id: 'FISH_MARKET',
      type: 'SHOP',
      name: '바다코끼리 어시장',
      x: 30, y: 31, radius: 2,
      rect: { x: 30, y: 31, w: 2, h: 2 },
      shopMode: 'SELL',
      blocksMovement: true
    },
    {
      id: 'TACKLE_SHOP',
      type: 'SHOP',
      name: '낚시용품점',
      x: 34, y: 31, radius: 2,
      rect: { x: 34, y: 31, w: 2, h: 2 },
      shopMode: 'BUY',
      blocksMovement: true
    },
    { id: 'home', x: 23, y: 17, radius: 5 },
    { id: 'forest', x: 7, y: 6, radius: 8 },
    { id: 'lake', x: 21, y: 24, radius: 6 }
  ],
  npcs: [
    { id: 'NPC_SEA_ELEPHANT', kind: 'SHOPKEEPER_SELL', name: '바다코끼리 상인', x: 32, y: 32, shopId: 'FISH_MARKET' },
    { id: 'NPC_TACKLE', kind: 'SHOPKEEPER_BUY', name: '용품점 주인', x: 36, y: 32, shopId: 'TACKLE_SHOP' },
    { id: 'NPC_MAYOR', kind: 'QUEST_GIVER', name: '촌장', x: 22, y: 14, questId: 'tut_controls' },
    { id: 'NPC_FOREST_KEEPER', kind: 'QUEST_GIVER', name: '숲지기', x: 6, y: 8, questId: 'tut_pet_obtain' }
  ],
  tileLayer: TILE_LAYER,
  collisionLayer: COLLISION_LAYER
};

export function idx(tx, ty) {
  return ty * WIDTH + tx;
}

export function inBounds(tx, ty) {
  return tx >= 0 && tx < WIDTH && ty >= 0 && ty < HEIGHT;
}

export function isWalkable(tx, ty) {
  if (!inBounds(tx, ty)) return false;
  const blockedByNpc = Array.isArray(WORLD_MAP.npcs) && WORLD_MAP.npcs.some((n) => n.x === tx && n.y === ty);
  if (blockedByNpc) return false;
  for (const p of WORLD_MAP.poi) {
    if (!p?.blocksMovement || !p?.rect) continue;
    const r = p.rect;
    const inRect = tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
    if (inRect) return false;
  }
  const c = WORLD_MAP.collisionLayer[idx(tx, ty)];
  return c === 0 || c === 2;
}

export function getTileType(tx, ty) {
  if (!inBounds(tx, ty)) return null;
  return WORLD_MAP.collisionLayer[idx(tx, ty)];
}

export function isNearPOI(map, pos, poiId) {
  const poi = map.poi.find(p => p.id === poiId);
  if (!poi) return false;
  if (poi.rect) {
    const r = poi.rect;
    const nearestX = Math.max(r.x, Math.min(pos.tx, r.x + r.w - 1));
    const nearestY = Math.max(r.y, Math.min(pos.ty, r.y + r.h - 1));
    const dx = pos.tx - nearestX;
    const dy = pos.ty - nearestY;
    const radius = poi.radius ?? 0;
    return (dx * dx + dy * dy) <= (radius * radius);
  }

  const dx = pos.tx - poi.x;
  const dy = pos.ty - poi.y;
  return (dx * dx + dy * dy) <= (poi.radius * poi.radius);
}

export function getTileCharAt(tx, ty) {
  if (!inBounds(tx, ty)) return null;
  const row = MAP_LAYOUT[ty];
  return row ? row[tx] || null : null;
}

export function isWaterTile(ch) {
  return WATER_CHARS.has(ch);
}

export function isWaterAt(tx, ty) {
  return isWaterTile(getTileCharAt(tx, ty));
}

export function getWaterRegion(tx, ty) {
  const zone = WATER_ZONES.find((z) => (
    tx >= z.rect.x && tx < z.rect.x + z.rect.w
    && ty >= z.rect.y && ty < z.rect.y + z.rect.h
  ));
  return zone ? zone.region : 'midstream';
}

