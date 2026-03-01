export const TILE_SIZE = 32;
export const CANVAS_W = 640;
export const CANVAS_H = 480;

export const INPUT_MAP = {
  // 이동 키: 방향키 단독
  MOVE_UP: ['ArrowUp'],
  MOVE_DOWN: ['ArrowDown'],
  MOVE_LEFT: ['ArrowLeft'],
  MOVE_RIGHT: ['ArrowRight'],

  // 상호작용: Space바 단독
  INTERACT: ['Space'],

  // 도구 및 특수 액션
  USE_TOOL: ['KeyF'],      // 낚시
  TOGGLE_SEAT: ['KeyS'],   // 좌석
  PLACE_TRAP: ['KeyD'],    // 통발 설치/회수

  // 이모티콘 (1~4 숫자키)
  EMOJI_1: ['Digit1'],     // ❤️ 하트
  EMOJI_2: ['Digit2'],     // 😄 웃음
  EMOJI_3: ['Digit3'],     // 😢 슬픔
  EMOJI_4: ['Digit4'],     // ❗ 느낌표

  // 시스템 및 UI 제어
  START: ['Enter', 'Space'],
  MENU: ['Tab'],
  CANCEL: ['Escape'],
  INVENTORY: ['KeyI'],
  QUEST_LOG: ['KeyQ'],
  DEBUG_TOGGLE: ['F1'],
  INSTALL_HOUSE: ['KeyH']
};

export const MODES = {
  START: 'START',
  EXPLORE: 'EXPLORE',
  MENU: 'MENU',
  DIALOG: 'DIALOG',
  SHOP: 'SHOP',
  BUILD: 'BUILD',
  HOUSING_EDIT: 'HOUSING_EDIT'
};

export const COLORS = {
  PLAYER: '#3498db',
  PLAYER_OUTLINE: '#2980b9',
  GRASS: '#2ecc71',
  DIRT: '#d35400',
  WALL: '#7f8c8d',
  BUSH: '#27ae60',
  WATER: '#3498db',
  TEXT_MAIN: '#ecf0f1',
  TEXT_DEBUG: '#00ff00'
};

export const GAME_CONFIG = {
  DAY_DURATION_SECONDS: 60
};

export const FISH_RARITY_ORDER = ['C', 'B', 'A', 'S', 'SS'];
export const FISH_RARITY_MULTIPLIERS = {
  C: 1.0,
  B: 1.3,
  A: 1.8,
  S: 2.5,
  SS: 4.0
};
