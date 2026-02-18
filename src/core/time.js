import { GAME_CONFIG } from './constants.js';

export const Time = {
  // Returns true if night time (< 0.25 or > 0.75)
  isNight(state) {
    return state.time < 0.25 || state.time > 0.75;
  },

  // [New] 시간대별 위상 반환 (조명, BGM 변경용)
  getPhase(state) {
    if (state.time < 0.25) return 'NIGHT';
    if (state.time < 0.35) return 'DAWN'; // 해 뜰 때
    if (state.time < 0.65) return 'DAY';
    if (state.time < 0.75) return 'DUSK'; // 해 질 때
    return 'NIGHT';
  },

  // Advance time based on Delta Time (dt)
  advance(state, dt) {
    // dt(초)를 하루 길이(초)로 나누어 진행 비율 계산
    const timeIncrement = dt / GAME_CONFIG.DAY_DURATION_SECONDS;
    
    state.time += timeIncrement;

    if (state.time >= 1.0) {
      state.time -= 1.0; // 정확성을 위해 0.0 할당 대신 뺌
      state.day += 1;
    }
  },

  // Get formatted time string (00:00 format)
  getClockStr(state) {
    const totalMinutes = Math.floor(state.time * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
};