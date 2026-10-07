'use strict';

function openMonsterPanel(scene, monster) {
  var W = scene.scale.width, H = scene.scale.height;
  var PW = 460, PH = 530;
  var PX = W / 2 - PW / 2;  // left edge of panel
  var PY = H / 2 - PH / 2;  // top edge of panel
  var items = [];             // all elements — destroyed on close

  function track(obj) { items.push(obj); return obj; }

  var sp = SPECIES[monster.speciesId];
  var mods = getVariantModifiers(monster.variantIndex);

  // dim overlay
  var overlay = track(scene.add.graphics().setDepth(50));
  overlay.fillStyle(0x000000, 0.65);
  overlay.fillRect(0, 0, W, H);
  overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
  overlay.on('pointerdown', function(ptr) {
    if (ptr.x < PX || ptr.x > PX + PW || ptr.y < PY || ptr.y > PY + PH) closePanel();
  });

  // panel background
  var panelBg = track(scene.add.graphics().setDepth(51));
  panelBg.fillStyle(0x1e0f3a, 1);
  panelBg.fillRoundedRect(PX, PY, PW, PH, 18);
  panelBg.lineStyle(2, 0x6040c0, 1);
  panelBg.strokeRoundedRect(PX, PY, PW, PH, 18);

  // close button
  var closeBtn = track(scene.add.text(PX + PW - 24, PY + 22, '✕', {
    fontFamily: FONT, fontSize: '24px', color: '#aa88cc'
  }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true }));
  closeBtn.on('pointerdown', closePanel);

  // monster sprite
  var texKey = makeMonsterTexture(scene, monster);
  var img = track(scene.add.image(W / 2, PY + 108, texKey).setDisplaySize(118, 118).setDepth(52));
  scene.tweens.add({ targets: img, y: img.y - 5, duration: 1000, ease: 'Sine.InOut', yoyo: true, repeat: -1 });

  if (mods.isGolden) {
    track(scene.add.text(W / 2 + 52, PY + 58, '★ Golden', {
      fontFamily: FONT, fontSize: '13px', color: '#FFD700',
      backgroundColor: '#2a1a00', padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(52));
  }

  track(scene.add.text(W / 2, PY + 184, sp.name, {
    fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(52));

  track(scene.add.text(W / 2, PY + 212, 'Lv ' + monster.level + '  •  ' + sp.habitat[0].toUpperCase() + sp.habitat.slice(1), {
    fontFamily: FONT, fontSize: '15px', color: '#8888cc'
  }).setOrigin(0.5).setDepth(52));

  // stat bars
  var statDefs = [
    { key: 'hunger',      label: '🍖 Hunger',    color: 0xf57c00 },
    { key: 'happiness',   label: '💛 Happiness', color: 0xfdd835 },
    { key: 'cleanliness', label: '✨ Clean',      color: 0x42a5f5 }
  ];
  var barEntries = {};
  var barStartY = PY + 246;
  statDefs.forEach(function(def, i) {
    var by = barStartY + i * 42;
    track(scene.add.text(PX + 24, by, def.label, {
      fontFamily: FONT, fontSize: '14px', color: '#bbbbbb'
    }).setOrigin(0, 0.5).setDepth(52));

    var barBg = track(scene.add.graphics().setDepth(52));
    barBg.fillStyle(0x11082a, 1);
    barBg.fillRoundedRect(PX + 148, by - 9, 262, 18, 9);

    var barFill = track(scene.add.graphics().setDepth(53));
    var valTxt = track(scene.add.text(PX + PW - 22, by, '0', {
      fontFamily: FONT, fontSize: '13px', color: '#ffffff'
    }).setOrigin(1, 0.5).setDepth(53));

    barEntries[def.key] = { fill: barFill, color: def.color, bgX: PX + 148, bgY: by - 9, valTxt: valTxt };
  });

  function refreshStatBars() {
    statDefs.forEach(function(def) {
      var e = barEntries[def.key];
      var pct = Math.max(0, Math.min(1, monster[def.key] / 100));
      e.fill.clear();
      e.fill.fillStyle(e.color, 1);
      e.fill.fillRoundedRect(e.bgX, e.bgY, Math.max(18, 262 * pct), 18, 9);
      e.valTxt.setText(Math.round(monster[def.key]));
    });
  }
  refreshStatBars();

  // action buttons
  var btnY = PY + 398;
  var actions = [
    { label: '🍽 Feed',  col: 0x9a3a00, fn: showFoodPicker },
    { label: '💆 Pet',   col: 0x7a4090, fn: doPet          },
    { label: '🧹 Clean', col: 0x206090, fn: doClean        }
  ];
  actions.forEach(function(act, i) {
    track(makeButton(scene, PX + 80 + i * 150, btnY, 130, 46, act.label, act.col, act.fn, 15).setDepth(52));
  });

  var sellPrice = Math.max(10, Math.round(sp.price * (1 + monster.level * 0.2) * (monster.happiness / 100) * 0.8));
  track(makeButton(scene, W / 2, PY + PH - 44, 200, 42, '💰 Sell  +' + sellPrice, 0x1a5030, doSell, 15).setDepth(52));

  // food picker
  var fpItems = [];
  function clearFoodPicker() {
    fpItems.forEach(function(o) { try { o.destroy(); } catch(e) {} });
    fpItems = [];
  }
  function showFoodPicker() {
    if (fpItems.length > 0) { clearFoodPicker(); return; }
    var FPY = PY + PH + 8;
    var fpBg = scene.add.graphics().setDepth(54);
    fpBg.fillStyle(0x120728, 1);
    fpBg.fillRoundedRect(PX, FPY, PW, 132, 14);
    fpBg.lineStyle(1, 0x4030a0, 1);
    fpBg.strokeRoundedRect(PX, FPY, PW, 132, 14);
    fpItems.push(fpBg);

    FOOD_TYPES.forEach(function(food, i) {
      var bx = PX + 78 + i * 152;
      var by = FPY + 66;
      var canAfford = Game.state.coins >= food.cost;
      var lbl = food.name + '\n+' + food.hungerGain + '🍖 +' + food.happinessGain + '💛\n' + food.cost + '⬡';
      var fbtn = makeButton(scene, bx, by, 136, 98, lbl, canAfford ? 0x2a4a1a : 0x2a2a2a, function() {
        if (Game.state.coins < food.cost) { showToast(scene, 'Not enough coins!', '#ff9999'); return; }
        Game.state.coins -= food.cost;
        monster.hunger      = Math.min(100, monster.hunger      + food.hungerGain);
        monster.happiness   = Math.min(100, monster.happiness   + food.happinessGain);
        monster.lastCaredAt = Date.now();
        gainXP(monster, 10);
        store.setJSON('mps_state', Game.state);
        sfx.feed();
        showFloat(scene, W / 2, PY + 80, '+' + food.hungerGain + '🍖', '#ffcc44');
        refreshStatBars();
        notifyHub();
        clearFoodPicker();
      }, 13);
      fbtn.setDepth(55);
      fpItems.push(fbtn);
    });
  }

  function doPet() {
    monster.happiness   = Math.min(100, monster.happiness + 8);
    monster.lastCaredAt = Date.now();
    gainXP(monster, 5);
    store.setJSON('mps_state', Game.state);
    sfx.pet();
    showFloat(scene, W / 2, PY + 80, '+8 💛', '#ffdd55');
    refreshStatBars();
  }

  function doClean() {
    monster.cleanliness = Math.min(100, monster.cleanliness + 25);
    monster.lastCaredAt = Date.now();
    gainXP(monster, 5);
    store.setJSON('mps_state', Game.state);
    sfx.clean();
    showFloat(scene, W / 2, PY + 80, '+25 ✨', '#88ccff');
    refreshStatBars();
  }

  function doSell() {
    Game.state.coins += sellPrice;
    Game.state.monsters = Game.state.monsters.filter(function(m) { return m.id !== monster.id; });
    Game.state.stats.sold++;
    Game.state.stats.totalEarned += sellPrice;
    store.setJSON('mps_state', Game.state);
    sfx.sell();
    showFloat(scene, W / 2, H / 2, '+' + sellPrice + '⬡', '#ffd700');
    closePanel();
  }

  function notifyHub() {
    var hub = scene.game.scene.getScene('Hub');
    if (hub) hub.updateCoins();
  }

  function closePanel() {
    clearFoodPicker();
    items.forEach(function(o) { try { o.destroy(); } catch(e) {} });
    var hub = scene.game.scene.getScene('Hub');
    if (hub) hub.refreshAll();
  }
}

function gainXP(monster, amount) {
  monster.xp = (monster.xp || 0) + amount;
  if (monster.level < 10) {
    var needed = XP_TABLE[monster.level];
    if (monster.xp >= needed) {
      monster.xp -= needed;
      monster.level = Math.min(10, monster.level + 1);
      sfx.levelup();
    }
  }
}
