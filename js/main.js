/**
 * Punto de entrada del juego: carga datos e imágenes, crea la escena, conecta
 * el menú principal con el combate y arranca el bucle de render.
 *
 * La lógica de turnos vive en `BattleEngine` / `BattleFlow`; la escena y el HUD
 * viven en `graphics/` y `ui/`. Este archivo solo los instancia y conecta.
 */
import { DataLoader } from './utils/DataLoader.js';
import { BackgroundRenderer } from './graphics/BackgroundRenderer.js';
import { GroundShadow } from './graphics/GroundShadow.js';
import { SpriteAnimator } from './graphics/SpriteAnimator.js';
import { Fighter } from './logic/Fighter.js';
import { BattleFlow } from './logic/BattleFlow.js';
import { Progression } from './logic/Progression.js';
import { BATTLE_STATE } from './logic/BattleEngine.js';
import { UIController } from './ui/UIController.js';
import { MainMenu } from './ui/MainMenu.js';
import { EncounterTransition } from './ui/EncounterTransition.js';
import { ResultScreen } from './ui/ResultScreen.js';
import { WeatherWidget } from './ui/WeatherWidget.js';

/**
 * Reparto de la escena en coordenadas del escenario (1920x1080). El héroe es
 * más grande y está más abajo; `footY` ancla los pies y `sway` es el balanceo
 * lateral. El balanceo es espejado entre ambos.
 */
const ENTITY_LAYOUT = {
  player: { x: 826, footY: 1004, height: 530, sway: 18 },
  enemy: { x: 1272, footY: 762, height: 360, sway: 11 }
};

const SHADOW_FADE_MS = 480;
const IDLE_WAVE_SPEED = 1.15;
const BREATH_AMPLITUDE = 0.012;
const ENEMY_STATUS_GAP = 10;
const SHADOW_SWAY_FACTOR = 0.3;
/** El personaje con el turno crece un 7 %; el cambio se suaviza en 200 ms. */
const TURN_SCALE = 0.07;
const TURN_SCALE_MS = 200;
// Color fijo del lado iluminado del contorno; el otro lado usa el acento.
const OUTLINE_LIGHT = '#ffffff';

/** Interpolación del tamaño de turno, independiente del frame anterior. */
const approach = (current, target, deltaTime) =>
  current + (target - current) * Math.min(1, deltaTime / TURN_SCALE_MS);

/**
 * Reparto de una entidad en coordenadas del escenario (1920x1080). Las sombras
 * más grandes se corren a la derecha la mitad de su ancho extra para que su
 * borde izquierdo nunca pise al héroe. El bucle de render pasa un objeto
 * reutilizable en `out` para no reservar memoria en cada frame.
 */
function entityLayout(side, flow, out = {}) {
  const base = ENTITY_LAYOUT[side];
  out.x = base.x;
  out.footY = base.footY;
  out.height = base.height;
  out.sway = base.sway;

  if (side === 'enemy') {
    out.height = flow.encounter.height;
    out.x += (out.height - base.height) / 2;
  }
  return out;
}

/**
 * Punto del cuerpo en píxeles de pantalla. `heightRatio` elige la altura dentro
 * del frame: 0.5 es el torso (números de daño) y 0.98 la cabeza (estados).
 */
function entityScreenPoint(side, flow, bgRenderer, heightRatio) {
  const layout = entityLayout(side, flow);
  return {
    x: bgRenderer.screenX(layout.x),
    y: bgRenderer.screenY(layout.footY - layout.height * heightRatio)
  };
}

/** `true` si una capa modal tapa el combate (transición o resultados). */
function isBattleUiCovered() {
  const encounter = document.getElementById('encounter-overlay');
  const resultScreen = document.getElementById('result-screen');
  return encounter.classList.contains('is-open') ||
    encounter.classList.contains('is-closing') ||
    resultScreen.classList.contains('is-open');
}

/** Carga en paralelo los nueve JSON y las tres imágenes del juego. */
async function loadAssets() {
  const [characters, animations, weapons, items, equipment, requests, enemies, progression,
    weather, hero, enemy, background] = await Promise.all([
    DataLoader.loadJSON('data/characters.json'),
    DataLoader.loadJSON('data/animations.json'),
    DataLoader.loadJSON('data/weapons.json'),
    DataLoader.loadJSON('data/items.json'),
    DataLoader.loadJSON('data/equipment.json'),
    DataLoader.loadJSON('data/requests.json'),
    DataLoader.loadJSON('data/enemies.json'),
    DataLoader.loadJSON('data/progression.json'),
    DataLoader.loadJSON('data/weather.json'),
    DataLoader.loadImage('assets/hero_spritesheet.png'),
    DataLoader.loadImage('assets/enemy_spritesheet.png'),
    DataLoader.loadImage('assets/background.png')
  ]);

  return {
    characters, animations, weapons, items, equipment, requests, enemies, progression,
    weather, hero, enemy, background
  };
}

/** Lee el acento actual de la hoja de estilos (el tema por defecto). */
function readAccent() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
}

/** Aplica el acento al documento, a las sombras y al contorno de los sprites. */
function applyTheme(color, animators, shadows) {
  document.documentElement.style.setProperty('--accent', color);
  Object.values(shadows).forEach((shadow) => shadow.setAccent(color));
  Object.values(animators).forEach((animator) => {
    animator.setOutlineColors({ light: OUTLINE_LIGHT, accent: color });
  });
}

/**
 * Bucle de `requestAnimationFrame`: balanceo idle, HUD que sigue al enemigo,
 * sombras y sprites. Termina cuando se cierra la página.
 */
function startRenderLoop({ bgRenderer, flow, animators, shadows, enemyStatusEl }) {
  let lastTime = performance.now();
  // La sombra del enemigo se desvanece al morir y vuelve al entrar el siguiente.
  let enemyShadowOpacity = 1;
  let renderedEnemy = null;
  // 0 = tamaño normal, 1 = tamaño de turno. Se interpola para no dar saltos.
  let playerFocus = 0;
  let enemyFocus = 0;
  // Reutilizados: el HUD solo se toca cuando el valor cambia de verdad.
  const enemyPos = {};
  const lastStatus = { left: NaN, top: NaN, opacity: NaN };

  function frame(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    const playerPos = ENTITY_LAYOUT.player;
    entityLayout('enemy', flow, enemyPos);
    const enemy = flow.enemy;

    if (enemy !== renderedEnemy) {
      renderedEnemy = enemy;
      enemyShadowOpacity = 1;
    }

    // --- Escala del turno ----------------------------------------------
    // El jugador sigue agrandado mientras resuelve su acción.
    const state = flow.engine.state;
    const playerTarget =
      state === BATTLE_STATE.PLAYER_TURN || state === BATTLE_STATE.RESOLVING ? 1 : 0;
    const enemyTarget = state === BATTLE_STATE.ENEMY_TURN ? 1 : 0;

    playerFocus = approach(playerFocus, playerTarget, deltaTime);
    enemyFocus = approach(enemyFocus, enemyTarget, deltaTime);

    const playerHeight = playerPos.height * (1 + TURN_SCALE * playerFocus);
    const enemyHeight = enemyPos.height * (1 + TURN_SCALE * enemyFocus);

    // --- Balanceo idle espejado ---------------------------------------
    const idleWave = Math.sin((currentTime / 1000) * IDLE_WAVE_SPEED);
    const playerSway = idleWave * playerPos.sway;
    const enemySway = -idleWave * enemyPos.sway;
    const playerBreath = 1 + idleWave * BREATH_AMPLITUDE;
    const enemyBreath = 1 - idleWave * BREATH_AMPLITUDE;

    if (!enemy.isAlive()) {
      enemyShadowOpacity = Math.max(0, enemyShadowOpacity - deltaTime / SHADOW_FADE_MS);
    }

    // --- Tarjeta de HP sobre la cabeza del enemigo ---------------------
    const statusLeft = bgRenderer.screenX(enemyPos.x + enemySway);
    const statusTop = bgRenderer.screenY(enemyPos.footY - enemyHeight) - ENEMY_STATUS_GAP;
    if (statusLeft !== lastStatus.left) {
      enemyStatusEl.style.left = `${statusLeft}px`;
      lastStatus.left = statusLeft;
    }
    if (statusTop !== lastStatus.top) {
      enemyStatusEl.style.top = `${statusTop}px`;
      lastStatus.top = statusTop;
    }
    if (enemyShadowOpacity !== lastStatus.opacity) {
      enemyStatusEl.style.opacity = String(enemyShadowOpacity);
      lastStatus.opacity = enemyShadowOpacity;
    }

    animators.player.update(deltaTime);
    animators.enemy.update(deltaTime);

    // --- Escena --------------------------------------------------------
    bgRenderer.draw();
    const ctx = bgRenderer.ctx;
    bgRenderer.beginStage(ctx);

    shadows.enemy.draw(
      ctx,
      enemyPos.x + enemySway * SHADOW_SWAY_FACTOR,
      enemyPos.footY - 2,
      enemyHeight * 0.36 * enemyBreath,
      enemyHeight * 0.06,
      enemyShadowOpacity
    );
    shadows.player.draw(
      ctx,
      playerPos.x + playerSway * SHADOW_SWAY_FACTOR,
      playerPos.footY - 2,
      playerHeight * 0.38 * playerBreath,
      playerHeight * 0.062
    );

    animators.enemy.drawCentered(ctx, enemyPos.x + enemySway, enemyPos.footY, enemyHeight);
    animators.player.drawCentered(ctx, playerPos.x + playerSway, playerPos.footY, playerHeight);

    bgRenderer.endStage(ctx);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

async function bootstrap() {
  const assets = await loadAssets();

  // --- Escena ----------------------------------------------------------
  const bgRenderer = new BackgroundRenderer(document.getElementById('game-canvas'));
  bgRenderer.setImage(assets.background);
  bgRenderer.resize();
  window.addEventListener('resize', () => bgRenderer.resize());

  const catalogs = { items: assets.items, weapons: assets.weapons, equipment: assets.equipment };
  const player = new Fighter(assets.characters.player, catalogs);

  const animators = {
    player: new SpriteAnimator(assets.hero, assets.animations.hero),
    enemy: new SpriteAnimator(assets.enemy, assets.animations.enemy)
  };
  const shadows = { player: new GroundShadow(), enemy: new GroundShadow() };
  const enemyStatusEl = document.querySelector('.enemy-status');
  // Cada uno se impulsa hacia el otro al atacar.
  animators.player.setLungeDirection(1);
  animators.enemy.setLungeDirection(-1);

  // Contorno dinámico: blanco arriba-izquierda y acento abajo-derecha.
  applyTheme(readAccent(), animators, shadows);

  // El clima se consulta en paralelo; si la red falla, el combate sigue igual.
  new WeatherWidget(assets.weather).start();

  // --- Combate y paneles ----------------------------------------------
  // El callback se ejecuta más tarde, cuando `flow` ya existe.
  const ui = new UIController(
    (action) => flow.engine.executePlayerAction(action),
    (side) => entityScreenPoint(side, flow, bgRenderer, 0.5),
    (side) => entityScreenPoint(side, flow, bgRenderer, 0.98)
  );
  const flow = new BattleFlow({
    player,
    enemies: assets.enemies,
    ui,
    animators,
    transition: new EncounterTransition(),
    result: new ResultScreen({
      items: assets.items,
      onRestart: () => window.location.reload()
    }),
    catalogs,
    requests: assets.requests,
    progression: new Progression(assets.progression)
  });

  const mainMenu = new MainMenu({
    player,
    profile: assets.characters.player,
    catalogs,
    requests: assets.requests,
    getActiveItemId: () => flow.engine.activeItemId,

    // El menú no muta el Fighter directamente: estos callbacks aplican el
    // cambio y lo reflejan en el registro de combate.
    onEquipWeapon: (weapon) => {
      player.equip('weapon', weapon);
      ui.logAction(`${player.name} equipa ${weapon.name}. ATK ${player.atk} · DEF ${player.def}.`);
    },
    onEquipArmor: (armor) => {
      player.equip('armor', armor);
      ui.logAction(`${player.name} equipa ${armor.name}. DEF ${player.def}.`);
    },
    onEquipAccessory: (accessory) => {
      player.equip('accessory', accessory);
      ui.logAction(`${player.name} equipa ${accessory.name}. EVA ${Math.round(player.evasion * 100)}%.`);
    },
    onSelectItem: (itemId, definition) => {
      flow.engine.setActiveItem(itemId);
      ui.logAction(`Objeto activo: ${definition.name}.`);
    },

    // SISTEMA: acento de la interfaz, las sombras y el contorno de los sprites.
    onAccentChange: (color) => applyTheme(color, animators, shadows),
    // SISTEMA: tamaño del texto; el HUD de combate limita su crecimiento en CSS.
    onFontChange: (pixels) => {
      document.documentElement.style.fontSize = `${pixels}px`;
    },

    // Abrir el menú bloquea las acciones de combate que quedan debajo.
    onOpen: () => ui.setMenuBlocked(true),
    // Al cerrar, solo se reactiva el combate si sigue siendo turno del jugador.
    onClose: () => {
      ui.setMenuBlocked(false);
      ui.enableMenu(flow.engine.state === BATTLE_STATE.PLAYER_TURN);
    }
  });

  // --- Atajos de teclado ------------------------------------------------
  const canOpenMenu = () =>
    !isBattleUiCovered() && flow.engine.state === BATTLE_STATE.PLAYER_TURN;

  document.getElementById('open-menu-btn').addEventListener('click', () => {
    if (canOpenMenu()) mainMenu.open();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'm' && event.key !== 'M') return;

    event.preventDefault();
    if (canOpenMenu()) mainMenu.toggle();
  });

  // --- Arranque ---------------------------------------------------------
  flow.start();
  startRenderLoop({ bgRenderer, flow, animators, shadows, enemyStatusEl });
}

window.addEventListener('DOMContentLoaded', bootstrap);
