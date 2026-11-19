import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Fighter } from '../js/logic/Fighter.js';
import { BattleEngine, BATTLE_STATE } from '../js/logic/BattleEngine.js';
import { BattleFlow } from '../js/logic/BattleFlow.js';
import { Progression } from '../js/logic/Progression.js';
import { Requests } from '../js/logic/Requests.js';
import { formatMoney } from '../js/utils/format.js';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

const characters = read('characters.json').player;
const enemies = read('enemies.json');
const progressionData = read('progression.json');
const requestsData = read('requests.json');
const catalogs = {
  items: read('items.json'),
  weapons: read('weapons.json'),
  equipment: read('equipment.json')
};

const noop = () => {};

function createUi() {
  return {
    logs: [],
    logAction(message, kind) { this.logs.push({ message, kind }); },
    clearLog: noop,
    setEnemyName: noop,
    updateStatusBars: noop,
    showTurn: noop,
    enableMenu: noop,
    showHit: noop,
    showRecoil: noop,
    damageFloatRemaining: () => 0,
    showGuard: noop,
    clearGuard: noop,
    clearGuards: noop,
    setItemLabel: noop
  };
}

const animators = {
  player: { setAnimation: noop, playOnce: noop },
  enemy: { setAnimation: noop, playOnce: noop }
};

function createEngine({
  player = new Fighter(characters, catalogs),
  enemy
} = {}) {
  const ui = createUi();
  const engine = new BattleEngine(player, ui, animators, { onVictory: noop, onDefeat: noop });
  engine.enter(enemy ?? new Fighter(enemies[0], catalogs));
  engine.start();
  return { engine, ui, player };
}

test('Fighter resuelve el equipo inicial y recalcula estadísticas', () => {
  const player = new Fighter(characters, catalogs);
  assert.equal(player.maxHp, 100);
  assert.equal(player.currentHp, player.maxHp);
  assert.equal(player.weapon.atkBonus, 0);
  assert.equal(player.def, 10);
  assert.equal(player.evasion, 0.2);

  const blade = catalogs.weapons.find((weapon) => weapon.recoil > 0);
  player.equip('weapon', blade);
  assert.equal(player.atk, characters.atk + blade.atkBonus);
  assert.equal(player.def, player.baseDef + player.weapon.defBonus + player.armor.defBonus);
});

test('Fighter cobra retroceso sin evasión ni defensa', () => {
  const player = new Fighter(characters, catalogs);
  player.takeRecoil(14);
  assert.equal(player.currentHp, player.maxHp - 14);
});

test('Fighter rechaza SP y objetos sin cargas', () => {
  const player = new Fighter(characters, catalogs);
  assert.equal(player.consumeSp(player.currentSp + 1), false);
  assert.equal(player.currentSp, player.maxSp);
  assert.equal(player.useItem('potion_big'), catalogs.items.potion_big);
  assert.equal(player.useItem('potion_big'), null);
});

test('Fighter aplica curación y evasión', () => {
  const player = new Fighter(characters, catalogs);
  player.currentHp = 40;
  player.useItem('potion');
  assert.ok(player.currentHp > 40);

  player.evasion = 1;
  assert.deepEqual(player.receiveAttack(999), { evaded: true, damage: 0, blocked: false });
});

test('Progression sube de nivel al alcanzar los umbrales del JSON', () => {
  const progression = new Progression(progressionData);
  assert.equal(progression.levelFor(0), 1);
  assert.equal(progression.levelFor(progressionData.xpCurve[0]), 2);
  assert.equal(progression.levelFor(progressionData.xpCurve.at(-1)), progressionData.xpCurve.length + 1);
  assert.equal(progression.remainingFor(0), progressionData.xpCurve[0]);
  assert.equal(progression.remainingFor(progressionData.xpCurve.at(-1)), 0);
});

test('Requests solo cierra la petición de la sombra derrotada, una vez', () => {
  const requests = new Requests(structuredClone(requestsData));
  const target = requests.list.find((request) => request.status === 'pending');
  const done = requests.completeFor(target.target);

  assert.equal(done.length, 1);
  assert.equal(done[0].status, 'completed');
  assert.equal(requests.completeFor(target.target).length, 0);
});

test('BattleEngine rechaza HABILIDAD sin SP sin gastar el turno', async () => {
  const { engine, player } = createEngine();
  player.currentSp = 0;

  await engine.executePlayerAction('SKILL');

  assert.equal(engine.state, BATTLE_STATE.PLAYER_TURN);
  assert.equal(player.currentSp, 0);
});

test('BattleEngine usa OBJETO y actualiza el contador', async () => {
  const { engine, player, ui } = createEngine();
  player.currentHp = 40;
  engine.setActiveItem('potion');

  await engine.executePlayerAction('ITEM');

  assert.ok(player.currentHp > 40);
  assert.equal(player.items.potion, characters.items.potion - 1);
  assert.ok(ui.logs.some((entry) => entry.message.includes('usó')));
});

test('BattleEngine termina en VICTORY al bajar el HP del enemigo a 0', async () => {
  const enemy = new Fighter(enemies[0], catalogs);
  enemy.evasion = 0;
  enemy.currentHp = 1;
  const { engine } = createEngine({ enemy });

  await engine.executePlayerAction('ATTACK');

  assert.equal(engine.state, BATTLE_STATE.VICTORY);
  assert.equal(enemy.isAlive(), false);
});

test('BattleFlow suma dinero, EXP, botín y nivel, y paga las peticiones', async () => {
  const player = new Fighter(characters, catalogs);
  const requests = structuredClone(requestsData);
  const shown = [];
  const flow = new BattleFlow({
    player,
    enemies: structuredClone(enemies),
    ui: createUi(),
    animators,
    transition: { play: noop },
    result: { show: (payload) => shown.push(payload) },
    catalogs,
    requests,
    progression: new Progression(progressionData)
  });
  flow.encounter = enemies[0];
  flow.index = enemies.length - 1;

  await flow.handleVictory();

  const request = requests.find((entry) => entry.target === enemies[0].id);
  assert.equal(player.money, characters.money + enemies[0].money + request.reward);
  assert.equal(player.xp, enemies[0].xp);
  assert.equal(player.items.potion, characters.items.potion + enemies[0].drop.count);
  assert.equal(request.status, 'completed');
  assert.equal(flow.rewards.money, enemies[0].money + request.reward);

  const last = shown.at(-1);
  assert.equal(last.level, flow.progression.levelFor(player.xp));
  assert.equal(last.rewards.xp, enemies[0].xp);
});

test('formatMoney usa separadores de miles', () => {
  assert.equal(formatMoney(191576), (191576).toLocaleString('es-MX'));
});

test('El daño siempre es entero, también con ataques fraccionarios', () => {
  const target = new Fighter(characters, catalogs, () => 0.5);
  target.evasion = 0;

  const hit = target.receiveAttack(37.5);
  assert.equal(Number.isInteger(hit.damage), true);
  assert.equal(hit.damage, 28);

  target.isBlocking = true;
  const blocked = target.receiveAttack(37.5);
  assert.equal(Number.isInteger(blocked.damage), true);
  assert.equal(blocked.damage, 14);
});

test('La VEL decide quién abre el combate', () => {
  const fast = new Fighter({ ...enemies[0], speed: 99 }, catalogs);
  const { engine } = createEngine({ enemy: fast });

  assert.equal(engine.state, BATTLE_STATE.ENEMY_TURN);
  // Cancela el turno pendiente para no dejar timers vivos en la prueba.
  engine.state = BATTLE_STATE.INIT;
});

test('Una excepción devuelve el turno en lugar de congelar el combate', async () => {
  const { engine } = createEngine();
  engine.ui.showHit = () => {
    throw new Error('boom');
  };

  const original = console.error;
  console.error = noop;
  try {
    await engine.executePlayerAction('ATTACK');
  } finally {
    console.error = original;
  }

  assert.equal(engine.state, BATTLE_STATE.PLAYER_TURN);
  assert.ok(engine.ui.logs.some((entry) => entry.message.includes('Algo falló')));
});

test('La sombra usa habilidad cuando el azar la elige, con daño entero', async () => {
  const boss = enemies.at(-1);
  assert.ok(boss.skillChance > 0, 'la última sombra debe tener habilidad');

  const rolls = [0, 0];
  const enemy = new Fighter(boss, catalogs, () => rolls.shift() ?? 0.99);
  const player = new Fighter(characters, catalogs, () => 0.9);
  const { engine, ui } = createEngine({ player, enemy });
  engine.state = BATTLE_STATE.ENEMY_TURN;

  await engine.processEnemyTurn();

  assert.ok(ui.logs.some((entry) => entry.message.includes('usa una habilidad')));
  // 25 * 1.15 = 28.75 - 10 DEF + 4 de variación = 22.75 → 23
  assert.equal(player.currentHp, player.maxHp - 23);
});

test('loadSettings descarta ajustes corruptos', async () => {
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ accent: 'red;}body{', fontPx: 999 })
  };
  const { loadSettings } = await import('../js/ui/panels/system.js');
  assert.deepEqual(loadSettings(), { accent: '#ff0033', fontPx: 16 });

  globalThis.localStorage = { getItem: () => 'no es json' };
  assert.deepEqual(loadSettings(), { accent: '#ff0033', fontPx: 16 });
  delete globalThis.localStorage;
});

test('BattleFlow pasa a la siguiente sombra y restaura HP/SP en negro', async () => {
  const player = new Fighter(characters, catalogs);
  player.currentHp = 10;
  player.currentSp = 1;

  const flow = new BattleFlow({
    player,
    enemies: structuredClone(enemies),
    ui: createUi(),
    animators,
    transition: { play: async ({ onCovered }) => { onCovered(); } },
    result: { show: noop },
    catalogs,
    requests: structuredClone(requestsData),
    progression: new Progression(progressionData)
  });
  flow.encounter = enemies[0];
  flow.index = 0;

  await flow.handleVictory();

  assert.equal(flow.index, 1);
  assert.equal(flow.encounter.id, enemies[1].id);
  assert.equal(flow.enemy.name, enemies[1].name);
  assert.equal(player.currentHp, player.maxHp);
  assert.equal(player.currentSp, player.maxSp);
});
