// time.js
export const Time = {
  // 현실 시간 기준 야간 판별 (오후 7시 ~ 오전 6시)
  isNight(state) {
    if (!state || typeof state.time === 'undefined') {
      const hour = new Date().getHours();
      return hour < 6 || hour >= 19;
    }
    return state.time < 0.25 || state.time > 0.75;
  },

  // 현실 시간에 맞춘 위상 세분화
  getPhase() {
    const h = new Date().getHours();
    if (h >= 5 && h < 7) return 'DAWN';    // 05:00 ~ 07:00 해 뜰 때
    if (h >= 7 && h < 17) return 'DAY';    // 07:00 ~ 17:00 낮
    if (h >= 17 && h < 19) return 'DUSK';  // 17:00 ~ 19:00 해 질 때
    return 'NIGHT';                        // 19:00 ~ 05:00 밤
  },

  // [NEW] 가상 시간 누적(advance) 대신 현실 시간 동기화(sync)
  sync(state) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // UI의 Time Bar 렌더링을 위해 하루의 진행도를 0.0 ~ 1.0으로 변환
    state.time = (hours * 3600 + minutes * 60 + seconds) / 86400;

    // 일일(Daily) 퀘스트 리셋을 위한 날짜 추적 브릿지
    const todayStr = now.toDateString();
    if (state.lastLoginDate !== todayStr) {
      state.isNewDay = true; // main.js에서 리셋을 수행하도록 플래그 전달
      state.lastLoginDate = todayStr;
      state.day = (state.day || 1) + 1; // 인게임 일자도 현실 날짜 변경 시 1씩 증가
    } else {
      state.isNewDay = false;
    }
  },

  // 현실 시계 포맷 출력
  getClockStr() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
};
