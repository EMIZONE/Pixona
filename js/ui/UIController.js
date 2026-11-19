import { createNode } from '../utils/dom.js';
import { BattleMenu } from './BattleMenu.js';
import { TurnBanner } from './TurnBanner.js';

/** El registro se mantiene corto para no tapar la escena. */
const MAX_LOG_ENTRIES = 6;
/** Un número de daño vive algo menos que su animación. */
const DAMAGE_FLOAT_MS = 1650;
/** Margen extra para leer BLOQUEO/ESQUIVA después de empezar el turno. */
const GUARD_LINGER_MS = 2200;

/**
 * Puente entre la lógica del combate y el DOM del HUD: barras de HP/SP,
 * nombre del enemigo, registro de acciones, estado del menú y feedback visual
 * de turnos y golpes.
 */
export class UIController {
  constructor(onActionSelect, getHitPoint, getGuardPoint) {
    this.menu = new BattleMenu('battle-menu', onActionSelect);
    this.getHitPoint = getHitPoint;
    this.getGuardPoint = getGuardPoint;
    this.turnBanner = new TurnBanner();
    this.hitFlash = document.getElementById('hit-flash');
    this.canvas = document.getElementById('game-canvas');
    // Los números y estados viven dentro de #ui-layer para que la banda de
    // turnos (z 15) quede por encima de ellos.
    this.layer = document.getElementById('ui-layer');
    // Evita reactivar los botones mientras el menú principal tapa el combate.
    this.menuBlocked = false;
    // Se usa para retrasar el anuncio del turno hasta que el daño se desvanezca.
    this.damageFloatEndsAt = 0;
    // Etiquetas persistentes de BLOQUEO/ESQUIVA, una por bando.
    this.guards = { player: null, enemy: null };
    this.guardFrame = null;

    this.playerHpBar = document.getElementById('player-hp-bar');
    this.playerHpText = document.getElementById('player-hp-text');
    this.playerSpBar = document.getElementById('player-sp-bar');
    this.playerSpText = document.getElementById('player-sp-text');
    this.enemyHpBar = document.getElementById('enemy-hp-bar');
    this.enemyHpText = document.getElementById('enemy-hp-text');
    this.enemyNameEl = document.querySelector('.enemy-status .entity-name');
    this.logContainer = document.getElementById('battle-log');
  }

  /** Activa o desactiva las acciones del jugador. */
  enableMenu(enable) {
    this.menu.setEnabled(enable && !this.menuBlocked);
  }

  /** El menú principal tapa el combate: sus botones no deben responder. */
  setMenuBlocked(blocked) {
    this.menuBlocked = blocked;
    if (blocked) this.menu.setEnabled(false);
  }

  /** La tarjeta del enemigo se reutiliza entre combates; solo cambia el nombre. */
  setEnemyName(name) {
    this.enemyNameEl.textContent = name;
  }

  clearLog() {
    this.logContainer.replaceChildren();
  }

  /** Etiqueta del botón OBJETO con el objeto activo y sus cargas. */
  setItemLabel(itemName, count) {
    this.menu.setActionLabel('ITEM', `OBJETO (${itemName} ×${count})`);
  }

  /** Anuncia el turno ('player' | 'enemy' | 'over') en banda y chip. */
  showTurn(kind) {
    this.turnBanner.show(kind);
  }

  /**
   * Feedback de un golpe: número flotante sobre la ficha del herido, destello
   * de pantalla y temblor de la escena. Si el defensor está en postura, su
   * etiqueta persistente ya anuncia ESQUIVA/BLOQUEO; aquí solo se muestra el
   * resultado numérico (o el ESQUIVA de una evasión pasiva).
   */
  showHit(side, { evaded, damage }) {
    if (evaded) {
      if (this.guards[side]?.kind !== 'dodge') {
        this.spawnDamage(side, 'ESQUIVA', 'is-evade');
      }
      return;
    }

    this.spawnDamage(side, `-${damage}`);
    this.flashHit(side);
    this.shakeScene();
  }

  /** Etiqueta persistente de BLOQUEO/ESQUIVA sobre la cabeza del combatiente. */
  showGuard(side, kind) {
    this.removeGuard(side);

    const point = this.getGuardPoint(side);
    const label = createNode(
      'span',
      `guard-float is-${side} is-${kind}`,
      kind === 'dodge' ? 'ESQUIVA' : 'BLOQUEO'
    );
    label.setAttribute('aria-hidden', 'true');
    label.style.left = `${point.x}px`;
    label.style.top = `${point.y}px`;
    this.layer.appendChild(label);
    this.guards[side] = { element: label, kind, clearTimer: null };
    this.trackGuards();
  }

  /** Al empezar el siguiente turno, deja la etiqueta un rato antes de quitarla. */
  clearGuard(side) {
    const guard = this.guards[side];
    if (!guard || guard.clearTimer) return;
    guard.clearTimer = setTimeout(() => this.removeGuard(side), GUARD_LINGER_MS);
  }

  /** Retirada inmediata (nueva postura, cambio de combate o fin de la batalla). */
  removeGuard(side) {
    const guard = this.guards[side];
    if (!guard) return;
    clearTimeout(guard.clearTimer);
    guard.element.remove();
    this.guards[side] = null;
    if (!this.guards.player && !this.guards.enemy) this.stopTrackingGuards();
  }

  clearGuards() {
    this.removeGuard('player');
    this.removeGuard('enemy');
  }

  /** Reancla las etiquetas cada frame mientras la escena se mueve. */
  trackGuards() {
    if (this.guardFrame !== null) return;

    const update = () => {
      this.guardFrame = null;
      let active = false;
      for (const side of ['player', 'enemy']) {
        const guard = this.guards[side];
        if (!guard) continue;
        active = true;
        const point = this.getGuardPoint(side);
        guard.element.style.left = `${point.x}px`;
        guard.element.style.top = `${point.y}px`;
      }
      if (active) this.guardFrame = requestAnimationFrame(update);
    };
    this.guardFrame = requestAnimationFrame(update);
  }

  stopTrackingGuards() {
    if (this.guardFrame === null) return;
    cancelAnimationFrame(this.guardFrame);
    this.guardFrame = null;
  }

  /** Crea el número que sube desde el cuerpo del jugador o del enemigo. */
  spawnDamage(side, text, modifier) {
    const point = this.getHitPoint(side);

    const float = createNode(
      'span',
      `damage-float is-${side}${modifier ? ` ${modifier}` : ''}`,
      text
    );
    float.setAttribute('aria-hidden', 'true');
    float.style.left = `${point.x}px`;
    float.style.top = `${point.y}px`;
    this.layer.appendChild(float);

    this.damageFloatEndsAt = performance.now() + DAMAGE_FLOAT_MS;
    setTimeout(() => float.remove(), DAMAGE_FLOAT_MS);
  }

  /** Tiempo restante del último número de daño (0 si ya desapareció). */
  damageFloatRemaining() {
    return Math.max(0, this.damageFloatEndsAt - performance.now());
  }

  /** Retroceso del arma: número propio sobre el jugador y destello rojo. */
  showRecoil(amount) {
    this.spawnDamage('player', `RETROCESO -${amount}`, 'is-recoil');
    this.flashHit('player');
  }

  /** Reinicia el destello aunque el golpe anterior siga en pantalla. */
  flashHit(side) {
    this.hitFlash.classList.remove('is-player-hit', 'is-enemy-hit');
    void this.hitFlash.offsetWidth;
    this.hitFlash.classList.add(side === 'player' ? 'is-player-hit' : 'is-enemy-hit');
  }

  /** Temblor breve de la escena (el HUD queda quieto). */
  shakeScene() {
    this.canvas.classList.remove('is-shaking');
    void this.canvas.offsetWidth;
    this.canvas.classList.add('is-shaking');
  }

  /** Actualiza una barra y su texto con la misma fórmula de porcentaje. */
  updateBar(barElement, textElement, current, max, label) {
    barElement.style.width = `${(current / max) * 100}%`;
    textElement.textContent = `${label}: ${current}/${max}`;
  }

  /** Sincroniza el HUD con el estado actual de ambos combatientes. */
  updateStatusBars(player, enemy) {
    this.updateBar(this.playerHpBar, this.playerHpText, player.currentHp, player.maxHp, 'HP');
    this.updateBar(this.playerSpBar, this.playerSpText, player.currentSp, player.maxSp, 'SP');
    this.updateBar(this.enemyHpBar, this.enemyHpText, enemy.currentHp, enemy.maxHp, 'HP');
  }

  /**
   * Añade una línea al registro. `kind = 'accent'` se usa para hitos
   * (victoria, derrota, curación entre combates).
   */
  logAction(message, kind) {
    this.logContainer.appendChild(
      createNode('p', kind ? `log-entry ${kind}` : 'log-entry', message)
    );

    while (this.logContainer.children.length > MAX_LOG_ENTRIES) {
      this.logContainer.firstElementChild.remove();
    }
  }
}
