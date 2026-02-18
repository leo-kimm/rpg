import { INPUT_MAP } from './constants.js';

export class Input {
  constructor() {
    this.keys = {};     // 현재 프레임의 키 상태
    this.prevKeys = {}; // 이전 프레임의 키 상태

    // INPUT_MAP에 정의된 모든 키를 자동으로 차단 목록에 등록 (브라우저 스크롤 방지 등)
    this.blockedKeys = new Set(Object.values(INPUT_MAP).flat());

    window.addEventListener('keydown', (e) => {
      if (this.blockedKeys.has(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      if (this.blockedKeys.has(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = false;
    });
  }

  // 매 프레임 update() 호출 시 이전 상태 저장
  update() {
    this.prevKeys = { ...this.keys };
  }

  // [New] 물리 키가 아닌 '행동'을 체크 (예: W키나 화살표 위쪽 모두 True)
  isAction(actionName) {
    const keyCodes = INPUT_MAP[actionName];
    if (!keyCodes) return false;
    return keyCodes.some(code => this.keys[code]);
  }

  // [New] 해당 행동이 '방금' 눌렸는지 체크 (Trigger)
  wasActionPressed(actionName) {
    const keyCodes = INPUT_MAP[actionName];
    if (!keyCodes) return false;
    return keyCodes.some(code => this.keys[code] && !this.prevKeys[code]);
  }

  // 하위 호환성 및 디버깅용 (직접 키 코드 체크)
  isDown(code) {
    return !!this.keys[code];
  }
}