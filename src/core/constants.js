export const TILE_SIZE = 32;
export const CANVAS_W = 640;
export const CANVAS_H = 480;

export const INPUT_MAP = {
  MOVE_UP: ['ArrowUp'],
  MOVE_DOWN: ['ArrowDown'],
  MOVE_LEFT: ['ArrowLeft'],
  MOVE_RIGHT: ['ArrowRight'],
  INTERACT: ['KeyE'],
  START: ['Enter', 'Space'],
  MENU: ['Tab', 'Escape'],
  CANCEL: ['Escape'],
  INVENTORY: ['KeyI'],
  QUEST_LOG: ['KeyQ'],
  USE_TOOL: ['KeyF'],
  TOGGLE_SEAT: ['KeyS'],
  DEBUG_TOGGLE: ['F1']
};

export const MODES = {
  START: 'START',
  EXPLORE: 'EXPLORE',
  MENU: 'MENU',
  DIALOG: 'DIALOG',
  SHOP: 'SHOP'
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

