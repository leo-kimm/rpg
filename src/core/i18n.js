export let currentLang = 'ko';

const DICTS = {
  ko: {
    'ui.shop.title': '\uBB3C\uACE0\uAE30 \uB9E4\uC785\uC18C',
    'ui.shop.tab.sell': '\uD310\uB9E4',
    'ui.shop.tab.buy': '\uAD6C\uB9E4',
    'ui.shop.empty.sell': '\uD310\uB9E4\uD560 \uAC83\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
    'ui.shop.empty.buy': '\uAD6C\uB9E4\uD560 \uAC83\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
    'ui.shop.money': '\uC18C\uC9C0\uAE08',
    'ui.shop.close': 'Esc \uB610\uB294 E\uB85C \uB2EB\uAE30',
    'ui.inventory.empty': '\uAC00\uBC29\uC774 \uBE44\uC5C8\uC2B5\uB2C8\uB2E4',
    'ui.inventory.noItem': '\uC544\uC774\uD15C \uC5C6\uC74C',
    'ui.inventory.selectHint': '\uC544\uC774\uD15C\uC744 \uC120\uD0DD\uD558\uBA74 \uC0C1\uC138\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.',
    'ui.inventory.tab.all': '\uC804\uCCB4',
    'ui.inventory.tab.tools': '\uB3C4\uAD6C',
    'ui.inventory.tab.bags': '\uAC00\uBC29',
    'ui.inventory.fishBag': '\uBB3C\uACE0\uAE30\uAC00\uBC29',
    'ui.inventory.fishBagCapacity': '\uC6A9\uB7C9: {cur}/{cap}',
    'ui.inventory.fishBagBack': '\uAC00\uBC29 \uBAA9\uB85D\uC73C\uB85C',

    'msg.fishing.faceWater': '\uBB3C\uC744 \uBC14\uB77C\uBCF4\uACE0 \uB09A\uC2DC\uD558\uC138\uC694.',
    'msg.fishing.needRod': '\uB09A\uC2EF\uB300\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.',
    'msg.fishing.equipRod': '\uB09A\uC2EF\uB300\uB97C \uC7A5\uCC29\uD558\uC138\uC694.',
    'msg.fishing.cantHere': '\uC5EC\uAE30\uC11C\uB294 \uB09A\uC2DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBB3C\uAC00\uB85C \uAC00\uBCF4\uC138\uC694.',
    'msg.fishing.started': '\uB09A\uC2DC \uC2DC\uC791... (\uAE30\uB2E4\uB824 \uBCF4\uC138\uC694)',
    'msg.fishing.stopped': '\uB09A\uC2DC\uB97C \uC911\uB2E8\uD588\uC2B5\uB2C8\uB2E4.',
    'msg.fishing.caught': '\uD68D\uB4DD: {name} (+1)',
    'msg.fishing.bagFull': '\uBB3C\uACE0\uAE30\uAC00\uBC29\uC774 \uAC00\uB4DD \uCC3C\uC2B5\uB2C8\uB2E4.',

    'msg.shop.sold': '{name} \uD310\uB9E4 +{price}G',
    'msg.shop.bought': '{name} \uAD6C\uB9E4 -{price}G',
    'msg.shop.notEnough': '\uC18C\uC9C0\uAE08\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4 ({price}G \uD544\uC694)',

    'msg.intro.welcome': '\uD3AB \uD0C0\uC6B4\uC5D0 \uC624\uC2E0 \uAC83\uC744 \uD658\uC601\uD569\uB2C8\uB2E4! E \uB610\uB294 Space\uB85C \uC0C1\uD638\uC791\uC6A9, TAB\uC740 \uBA54\uB274\uC785\uB2C8\uB2E4.',
    'ui.pet.equipped': '\uC7A5\uCC29\uC911',
    'ui.pet.equip': '\uC7A5\uCC29',
    'ui.pet.unequip': '\uD574\uC81C',
    'ui.pet.trait': '\uD2B9\uC131',
    'ui.pet.effect': '\uD6A8\uACFC',

    'item.fishing_rod.name': '\uB0A1\uC740 \uB09A\uC2EF\uB300',
    'item.fishing_rod.desc': '\uBB3C\uAC00\uC5D0\uC11C \uBB3C\uACE0\uAE30\uB97C \uB09A\uAE30\uC5D0 \uC801\uD569\uD569\uB2C8\uB2E4.',
    'item.fishing_rod_pro.name': '\uD504\uB85C \uB09A\uC2EF\uB300',
    'item.fishing_rod_pro.desc': '\uD5A5\uC0C1\uB41C \uC904 \uC7A5\uB825\uC73C\uB85C \uB354 \uC548\uC815\uC801\uC73C\uB85C \uB09A\uC2B5\uB2C8\uB2E4.',
    'item.fishing_rod_ultra.name': '\uC6B8\uD2B8\uB77C \uB09A\uC2EF\uB300',
    'item.fishing_rod_ultra.desc': '\uC219\uB828\uC790\uB97C \uC704\uD55C \uCD5C\uC0C1\uAE09 \uB09A\uC2EF\uB300.',

    'item.fish_minnow.name': '\uD53C\uB77C\uBBF8',
    'item.fish_minnow.desc': '\uAC15\uC5D0\uC11C \uD754\uD788 \uBCF4\uC774\uB294 \uC791\uC740 \uBB3C\uACE0\uAE30.',
    'item.fish_perch.name': '\uD37C\uCE58',
    'item.fish_perch.desc': '\uC904\uBB34\uB2AC\uAC00 \uC788\uB294 \uB2E8\uB2E8\uD55C \uC0B4\uC758 \uBB3C\uACE0\uAE30.',
    'item.fish_carp.name': '\uC789\uC5B4',
    'item.fish_carp.desc': '\uD638\uC218\uC5D0\uC11C \uC790\uC8FC \uBCF4\uC774\uB294 \uD2BC\uD2BC\uD55C \uBB3C\uACE0\uAE30.',
    'item.fish_catfish.name': '\uBA54\uAE30',
    'item.fish_catfish.desc': '\uAE4A\uC740 \uBB3C\uC5D0\uC11C \uC0AC\uB294 \uC218\uC5FC \uB2EC\uB9B0 \uBB3C\uACE0\uAE30.',
    'item.fish_golden_koi.name': '\uD669\uAE08 \uC789\uC5B4',
    'item.fish_golden_koi.desc': '\uBC18\uC9DD\uC774\uB294 \uD76C\uADC0\uD55C \uBCF4\uC0C1 \uBB3C\uACE0\uAE30.',

    'item.fishing_rod_pro.effect': '\uD2F0\uC5B42: \uD76C\uADC0\uD558\uC9C0 \uC54A\uC740 \uC911\uAE09 \uC5B4\uC885 \uD574\uAE08, \uD76C\uADC0 \uD655\uB960 \uC18C\uD3ED \uC99D\uAC00',
    'item.fishing_rod_ultra.effect': '\uD2F0\uC5B43: \uD76C\uADC0 \uC5B4\uC885 \uD574\uAE08, \uC785\uC9C8 \uC18D\uB3C4 \uC99D\uAC00'
    ,
    'item.fish_bag_t1.name': '\uBB3C\uACE0\uAE30\uAC00\uBC29 I',
    'item.fish_bag_t1.desc': '\uAE30\uBCF8 \uBB3C\uACE0\uAE30 \uAC00\uBC29\uC785\uB2C8\uB2E4.',
    'item.fish_bag_t2.name': '\uBB3C\uACE0\uAE30\uAC00\uBC29 II',
    'item.fish_bag_t2.desc': '\uB354 \uB9CE\uC740 \uBB3C\uACE0\uAE30\uB97C \uBCF4\uAD00\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
    'item.fish_bag_t3.name': '\uBB3C\uACE0\uAE30\uAC00\uBC29 III',
    'item.fish_bag_t3.desc': '\uCD5C\uB300 \uC6A9\uB7C9\uC758 \uBB3C\uACE0\uAE30 \uAC00\uBC29\uC785\uB2C8\uB2E4.'
  }
};

export function t(key, params = null) {
  const dict = DICTS[currentLang] || {};
  let out = dict[key] ?? key;
  if (params && typeof out === 'string') {
    Object.keys(params).forEach((k) => {
      out = out.replaceAll(`{${k}}`, String(params[k]));
    });
  }
  return out;
}
