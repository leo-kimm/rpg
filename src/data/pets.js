import { isNearPOI } from '../world/map.js';

export const PETS = [
  {
    id: 'slime',
    name: '이끼 슬라임',
    desc: '촉촉하고 말랑한 기본 동료입니다.',
    trait: '낚시 행운을 조금 높여줍니다.',
    skillType: 'FISHING_LUCK',
    skillValue: 0.12,
    color: '#2ecc71',
    prob: 70,
    condition: () => true,
    visual: {
      shape: 'OVAL',
      eyeStyle: 'DOT',
      accentColor: '#88d8b0',
      floatAnim: true
    }
  },
  {
    id: 'owl',
    name: '보라 부엉이',
    desc: '밤 숲에서 만날 수 있는 지혜로운 친구입니다.',
    trait: '밤낚시에 무게 보정을 제공합니다.',
    skillType: 'FISHING_WEIGHT',
    skillValue: 0.18,
    color: '#8e44ad',
    prob: 20,
    condition: (state, map) => state.time > 0.75 && isNearPOI(map, state.playerPos, 'forest'),
    visual: {
      shape: 'CIRCLE',
      eyeStyle: 'WIDE',
      accentColor: '#d2b4ff',
      floatAnim: false
    }
  },
  {
    id: 'fox',
    name: '황금 여우',
    desc: '좀처럼 모습을 드러내지 않는 희귀한 펫입니다.',
    trait: '낚시 행운을 안정적으로 올려줍니다.',
    skillType: 'FISHING_LUCK',
    skillValue: 0.15,
    color: '#f1c40f',
    prob: 10,
    condition: (state, map) => state.day >= 3 && isNearPOI(map, state.playerPos, 'center'),
    visual: {
      shape: 'TRIANGLE',
      eyeStyle: 'SMALL',
      accentColor: '#ffb347',
      floatAnim: false
    }
  },
  {
    id: 'cat',
    name: '치즈 냥이',
    desc: '장터 근처를 배회하는 장사꾼 고양이입니다.',
    trait: '판매 가격 보너스를 주는 경제형 동료입니다.',
    skillType: 'PRICE_BONUS',
    skillValue: 0.15,
    color: '#ffdd59',
    prob: 24,
    condition: (state, map) => state.time > 0.2 && state.time < 0.7 && isNearPOI(map, state.playerPos, 'center'),
    visual: {
      shape: 'CIRCLE',
      eyeStyle: 'DOT',
      accentColor: '#ffa502',
      floatAnim: false
    }
  },
  {
    id: 'dog',
    name: '웰시코기',
    desc: '짧은 다리로도 누구보다 빠르게 달리는 친구입니다.',
    trait: '탐험 이동 보조형으로 설계된 동료입니다.',
    skillType: 'MOVE_SPEED',
    skillValue: 0.12,
    color: '#e67e22',
    prob: 22,
    condition: (state) => state.time > 0.35 && state.time < 0.85,
    visual: {
      shape: 'STACKED',
      eyeStyle: 'SMALL',
      accentColor: '#d35400',
      floatAnim: false
    }
  },
  {
    id: 'duck',
    name: '튜브 오리',
    desc: '강가에서 둥둥 떠다니는 귀여운 오리입니다.',
    trait: '시간대에 따라 낚시 보조를 주는 수변형 동료입니다.',
    skillType: 'TIME_WATER',
    skillValue: 0.08,
    color: '#f5f6fa',
    prob: 18,
    condition: (state) => state.time > 0.15 && state.time < 0.45,
    visual: {
      shape: 'OVAL',
      eyeStyle: 'DOT',
      accentColor: '#f39c12',
      floatAnim: true
    }
  },
  {
    id: 'rabbit',
    name: '달토끼',
    desc: '달빛 아래에서만 잘 보이는 감성형 펫입니다.',
    trait: '능력치보다 분위기를 살려주는 코스메틱 동료입니다.',
    skillType: 'COSMETIC',
    skillValue: 0.05,
    color: '#ecf0f1',
    prob: 12,
    condition: (state) => state.time > 0.7,
    visual: {
      shape: 'STACKED',
      eyeStyle: 'WIDE',
      accentColor: '#c39bd3',
      floatAnim: true
    }
  }
];

export function getPetById(id) {
  return PETS.find((pet) => pet.id === id) || null;
}

export function getSpawnablePets(state, map) {
  return PETS.filter((pet) => pet.condition(state, map));
}

