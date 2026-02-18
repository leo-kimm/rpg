export function createInitialState() {
  return {
    mode: 'START',
    day: 1,
    time: 0.5,
    money: 0,
    inventory: ['fishing_rod', 'starter_bag'],
    bags: {
      starter_bag: {
        capacity: 10,
        fishes: []
      }
    },
    shop: {
      isOpen: false,
      mode: 'SELL',
      shopId: null
    },
    equipment: {
      rodId: 'fishing_rod',
      bagId: 'starter_bag',
      baitId: null,
      chairId: null,
      trapId: null
    },
    seat: {
      isSeated: false,
      chairPlaced: false,
      chairPos: { x: 0, y: 0 },
      autoFishing: false,
      autoTimer: 0,
      bagFullWarn: false
    },
    traps: [],
    trapInventory: [],
    equippedToolId: null,
    equippedItem: 'fishing_rod',
    lastCatch: null,
    ownedPetIds: [],
    selectedPetId: null,
    activePetId: null,
    quests: {
      activeQuestIds: ['tut_controls'],
      completedQuestIds: [],
      stepProgress: {},
      newlyCompletedQueue: []
    },
    ui: {
      modal: null,
      selectedPetId: null,
      selectedInvId: null,
      selectedInvIndex: null,
      selectedQuestId: null,
      invTab: 'ALL',
      fishBagOpen: false,
      openBagId: null,
      npcBubble: {
        visible: false,
        text: '',
        idx: 0,
        timer: 0,
        id: null
      }
    },
    discoverCooldown: 0,
    playerPos: { tx: 5, ty: 5, facing: 'down' }
  };
}
