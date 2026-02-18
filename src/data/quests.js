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
    nextQuestId: 'tut_buy_bait'
  },
  {
    id: 'tut_buy_bait',
    title: '미끼 구매하기',
    desc: '낚시를 하려면 미끼가 꼭 필요해요. 해안 쪽 낚시용품점에서 미끼를 구매하세요.',
    category: 'TUTORIAL',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'open_buy_shop_for_bait', text: '낚시용품점(해안 쪽)으로 이동하세요. 도착 후 E로 상호작용', type: 'EVENT', target: 'OPEN_SHOP', count: 1, match: { mode: 'BUY' }, targetPOI: 'shop', targetHint: '해안 쪽' },
      { id: 'buy_bait', text: '미끼를 1개 이상 구매하세요 (낚시 필수)', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { buyKinds: ['BAIT'] } }
    ],
    rewards: [{ type: 'MONEY', amount: 80 }],
    nextQuestId: 'tut_equip_bait'
  },
  {
    id: 'tut_equip_bait',
    title: '미끼 장착하기',
    desc: '인벤토리(I)에서 미끼를 장착하세요. 미끼가 없으면 낚시를 시작할 수 없어요.',
    category: 'TUTORIAL',
    npcId: 'NPC_TACKLE',
    steps: [
      { id: 'open_inventory_for_bait', text: '인벤토리(I)를 열어 미끼를 확인하세요', type: 'ACTION', target: 'OPEN_INVENTORY', count: 1 },
      { id: 'equip_bait', text: '인벤토리(I)에서 구매한 미끼를 장착하세요', type: 'EVENT', target: 'BAIT_EQUIPPED', count: 1 }
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
      { id: 'open_sell_shop', text: '어시장(해안 쪽)으로 이동하세요. 도착 후 E로 상호작용', type: 'EVENT', target: 'OPEN_SHOP', count: 1, match: { mode: 'SELL' }, targetPOI: 'fish_market', targetHint: '해안 쪽' },
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
      { id: 'open_buy_shop', text: '낚시용품점(해안 쪽)으로 이동하세요. 도착 후 E로 상호작용', type: 'EVENT', target: 'OPEN_SHOP', count: 1, match: { mode: 'BUY' }, targetPOI: 'shop', targetHint: '해안 쪽' },
      { id: 'buy_item', text: '미끼 또는 낚싯대/가방을 1개 구매하세요', type: 'EVENT', target: 'BUY_ITEM', count: 1, match: { buyKinds: ['BAIT', 'ROD', 'BAG'] } }
    ],
    rewards: [{ type: 'MONEY', amount: 120 }],
    nextQuestId: 'tut_pet_obtain'
  },
  {
    id: 'tut_pet_obtain',
    title: '펫 획득하기',
    desc: '숲의 수풀(타일 ID: 2) 근처에서 E키로 조사하면 펫을 발견할 수 있어요.',
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
  }
];

export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map((quest) => [quest.id, quest]));
