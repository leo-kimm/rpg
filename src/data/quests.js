export const QUESTS = [
  {
    id: 'tut_controls',
    title: '처음 오셨군요!',
    desc: '기본 조작을 익히고 마을 생활을 시작해보세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_MAYOR',
    autoAccept: true,
    steps: [
      { id: 'move_once', text: '아무 방향으로 한 칸 이동해보세요', type: 'EVENT', target: 'PLAYER_MOVED', count: 1 },
      { id: 'open_inventory', text: '인벤토리(I)를 열어보세요', type: 'ACTION', target: 'OPEN_INVENTORY', count: 1 },
      { id: 'open_quest', text: '퀘스트 로그(Q)를 열어보세요', type: 'ACTION', target: 'OPEN_QUEST_LOG', count: 1 }
    ],
    rewards: [{ type: 'MONEY', amount: 50 }],
    nextQuestId: 'tut_housing'
  },
  {
    id: 'tut_housing',
    title: '생존의 기본',
    desc: '마을 이장과 대화하여 거주지 보급품을 받으세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_MAYOR',
    autoAccept: true,
    steps: [
      { id: 'talk_mayor', type: 'EVENT', target: 'TALK_TO_NPC', count: 1, match: { npcId: 'NPC_MAYOR' }, text: '이장과 대화' }
    ],
    rewards: [
      { type: 'ITEM', itemId: 'house_tent', amount: 1 },
      { type: 'ITEM', itemId: 'bed_camp', amount: 1 }
    ],
    nextQuestId: 'tut_sleep'
  },
  {
    id: 'tut_sleep',
    title: '첫 휴식',
    desc: '인벤토리에서 야전침대를 설치하고, 다가가 Space를 눌러 체력을 회복하세요.',
    category: 'TUTORIAL',
    autoAccept: true,
    requirement: 'tut_housing',
    steps: [
      { id: 'sleep_bed', type: 'EVENT', target: 'SLEEP', count: 1, text: '야전침대에서 수면' }
    ],
    rewards: [{ type: 'MONEY', amount: 200 }],
    nextQuestId: 'tut_buy_bait'
  },
  {
    id: 'tut_buy_bait',
    title: '미끼 구매하기',
    desc: '낚시를 하려면 미끼가 꼭 필요해요. 해안 쪽 낚시용품점에서 미끼를 구매하세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'buy_bait', text: '낚시용품점에서 미끼를 1개 이상 구매하세요 (Space로 상점 열기)', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { buyKinds: ['BAIT'] }, targetPOI: 'shop', targetHint: '해안 쪽' }
    ],
    rewards: [{ type: 'MONEY', amount: 80 }],
    nextQuestId: 'tut_fishing'
  },
  {
    id: 'tut_fishing',
    title: '낚시 배우기',
    desc: '장착한 미끼로 물가에서 낚시를 시작하고 물고기를 한 마리 잡아보세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'start_fishing', text: '호수 쪽 물가로 이동해 낚시를 시작하세요 (F)', type: 'EVENT', target: 'START_FISHING', count: 1, match: { requireNearWater: true }, targetPOI: 'lake', targetHint: '호수 쪽' },
      { id: 'catch_fish', text: '물고기를 1마리 잡아보세요', type: 'EVENT', target: 'CATCH_FISH', count: 1 }
    ],
    rewards: [{ type: 'MONEY', amount: 80 }],
    nextQuestId: 'tut_sell_fish'
  },
  {
    id: 'tut_sell_fish',
    title: '물고기 판매하기',
    desc: '어시장에 가서 물고기를 판매해보세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_MAYOR',
    steps: [
      { id: 'open_sell_shop', text: '어시장(해안 쪽)으로 이동하세요. 도착 후 Space바로 상호작용', type: 'EVENT', target: 'OPEN_SHOP', count: 1, match: { mode: 'SELL' }, targetPOI: 'fish_market', targetHint: '해안 쪽' },
      { id: 'sell_fish', text: '물고기를 1마리 이상 판매하세요', type: 'EVENT', target: 'SELL_FISH', count: 1 }
    ],
    rewards: [{ type: 'MONEY', amount: 100 }],
    nextQuestId: 'tut_pet_obtain'
  },
  {
    id: 'tut_buy_item',
    title: '아이템 구매하기',
    desc: '용품점에서 아이템을 구매해보세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'open_buy_shop', text: '낚시용품점(해안 쪽)으로 이동하세요. 도착 후 Space바로 상호작용', type: 'EVENT', target: 'OPEN_SHOP', count: 1, match: { mode: 'BUY' }, targetPOI: 'shop', targetHint: '해안 쪽' },
      { id: 'buy_item', text: '미끼 또는 낚싯대/가방을 1개 구매하세요', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { buyKinds: ['BAIT', 'ROD', 'BAG'] } }
    ],
    rewards: [{ type: 'MONEY', amount: 120 }],
    nextQuestId: 'tut_pet_obtain'
  },
  {
    id: 'tut_pet_obtain',
    title: '펫 획득하기',
    desc: '숲의 수풀(타일 ID: 2) 근처에서 Space바로 조사하면 펫을 발견할 수 있어요.',
    category: 'TUTORIAL',
    npcId: 'NPC_FOREST_KEEPER',
    steps: [
      { id: 'obtain_pet', text: '숲에서 펫을 1마리 획득하세요', type: 'EVENT', target: 'PET_OBTAINED', count: 1, targetPOI: 'forest', targetHint: '숲 지역' }
    ],
    rewards: [{ type: 'MONEY', amount: 150 }],
    nextQuestId: 'tut_pet_equip'
  },
  {
    id: 'tut_pet_equip',
    title: '펫 장착하기',
    desc: '획득한 펫을 함께 걷기로 장착해보세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_MAYOR',
    steps: [
      { id: 'equip_pet', text: 'TAB으로 펫 메뉴 열기 -> 펫 선택 -> [함께 걷기] 장착', type: 'EVENT', target: 'PET_EQUIPPED', count: 1, targetPOI: 'center', targetHint: '마을 중앙' }
    ],
    rewards: [{ type: 'MONEY', amount: 200 }]
  },

  // ===== 일일 루틴 (Daily) =====
  {
    id: 'daily_sell_quota',
    title: '[일일] 어시장의 큰손',
    desc: '오늘 하루, 어시장에 물고기 15마리를 판매하여 상권을 활성화시켜주세요.',
    category: 'DAILY',
    npcId: 'NPC_MAYOR',
    autoAccept: true,
    steps: [
      { id: 'sell_fish_15', text: '물고기를 15마리 판매하세요', type: 'EVENT', target: 'SELL_FISH', count: 15 }
    ],
    rewards: [{ type: 'MONEY', amount: 300 }]
  },
  {
    id: 'daily_catch_warmup',
    title: '[일일] 프로 낚시꾼의 워밍업',
    desc: '아무 물고기나 15마리를 낚아보세요. 꾸준한 연습이 실력을 만듭니다.',
    category: 'DAILY',
    npcId: 'NPC_TACKLE',
    autoAccept: true,
    steps: [
      { id: 'catch_15', text: '물고기를 15마리 낚으세요', type: 'EVENT', target: 'CATCH_FISH', count: 15 }
    ],
    rewards: [{ type: 'MONEY', amount: 100 }]
  },

  // ===== 성장형 마일스톤 (Milestone) =====
  {
    id: 'mile_upgrade_rod',
    title: '더 깊은 곳을 향해',
    desc: '현재 낚싯대로는 큰 물고기를 낚기 어렵습니다. 돈을 모아 프로 낚싯대를 구매하세요.',
    category: 'MILESTONE',
    npcId: 'NPC_MAYOR',
    steps: [
      { id: 'buy_pro_rod', text: '프로 낚싯대(Tier 2)를 구매하세요', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { itemId: 'fishing_rod_pro' } }
    ],
    rewards: [{ type: 'MONEY', amount: 500 }, { type: 'ITEM', itemId: 'fish_bag_t2', count: 1 }],
    nextQuestId: 'mile_catch_epic'
  },
  {
    id: 'mile_catch_epic',
    title: '전설의 어부',
    desc: '마을의 전설로 내려오는 SS등급 희귀 어종을 낚아 올리세요. 행운을 올려주는 펫과 고급 미끼가 필수입니다.',
    category: 'MILESTONE',
    npcId: 'NPC_FOREST_KEEPER',
    steps: [
      { id: 'catch_ss_fish', text: 'SS등급 물고기를 1마리 낚으세요', type: 'EVENT', target: 'CATCH_FISH', count: 1, match: { minRarity: 'SS' } }
    ],
    rewards: [{ type: 'MONEY', amount: 5000 }, { type: 'ITEM', itemId: 'fishing_rod_ultra', count: 1 }]
  },
  {
    id: 'mile_rare_catch',
    title: '대물을 향한 여정',
    desc: '등급이 A 이상인 희귀 물고기를 1마리 낚아보세요.',
    category: 'MILESTONE',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'catch_a_fish', text: 'A등급 이상 물고기를 1마리 낚으세요', type: 'EVENT', target: 'CATCH_FISH', count: 1, match: { minRarity: 'A' } }
    ],
    rewards: [{ type: 'MONEY', amount: 500 }, { type: 'ITEM', itemId: 'bait_premium', count: 3 }]
  },
  {
    id: 'mile_upgrade_gear',
    title: '장비가 날개를 단다',
    desc: '상점에서 더 큰 가방 또는 새로운 낚싯대를 구매하세요.',
    category: 'MILESTONE',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'buy_gear', text: '가방 또는 낚싯대를 1개 구매하세요', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { buyKinds: ['ROD', 'BAG'] } }
    ],
    rewards: [{ type: 'MONEY', amount: 300 }]
  },

  // ===== 수집 및 탐험 (Exploration & Collection) =====
  {
    id: 'explore_pet_master',
    title: '동물 교감의 달인',
    desc: '숲을 조사하여 펫 3종류를 누적 획득하세요.',
    category: 'COLLECTION',
    npcId: 'NPC_FOREST_KEEPER',
    steps: [
      { id: 'obtain_3_pets', text: '펫을 3마리 획득하세요', type: 'EVENT', target: 'PET_OBTAINED', count: 3 }
    ],
    rewards: [{ type: 'MONEY', amount: 400 }]
  },

  // ===== 튜토리얼 확장: 통발 시스템 =====
  {
    id: 'tut_trap_system',
    title: '자동화의 묘미, 통발',
    desc: '낚시용품점에서 통발을 구매한 뒤, D키를 이용해 물가에 설치해보세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'buy_trap', text: '상점에서 통발을 1개 구매하세요', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { buyKinds: ['TRAP'] } },
      { id: 'place_trap', text: '인벤토리(I)에서 통발을 장착 후, 물가에서 D키로 설치하세요', type: 'EVENT', target: 'PLACE_TRAP', count: 1 }
    ],
    rewards: [{ type: 'ITEM', itemId: 'bait_premium', count: 3 }]
  }
];

export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map((quest) => [quest.id, quest]));
