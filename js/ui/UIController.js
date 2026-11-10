import { createNode } from '../utils/dom.js';
import { BattleMenu } from './BattleMenu.js';
import { TurnBanner } from './TurnBanner.js';

/** El registro se mantiene corto para no tapar la escena. */
const MAX_LOG_ENTRIES = 6;
/** Un número de daño vive algo menos que su animación. */
const DAMAGE_FLOAT_MS = 950;

/**
 * Puente entre la lógica del combate y el DOM del HUD: barras de HP/SP,
 * nombre del enemigo, registro de acciones, estado del menú y feedback visual
 * de turnos y golpes.
 */
export class UIController {
  constructor(onActionSelect) {
    this.menu = new BattleMenu('battle-menu', onActionSelect);
    this.turnBanner = new TurnBanner();
    this.hitFlash = document.getElementById('hit-flash');
    this.canvas = document.getElementById('game-canvas');
    // Evita reactivar los botones mientras el menú principal tapa el combate.
    this.menuBlocked = false;

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
    this.menu.setActionLabel('ITEM', itemName ? `OBJETO (${itemName} ×${count})` : 'OBJETO');
  }

  /** Anuncia el turno ('player' | 'enemy' | 'over') en banda y chip. */
  showTurn(kind) {
    this.turnBanner.show(kind);
  }

  /**
   * Feedback de un golpe: número flotante sobre la ficha del herido, destello
   * de pantalla y temblor de la escena. Una esquiva solo muestra el texto.
   */
  showHit(side, { evaded, damage, blocked }) {
    if (evaded) {
      this.spawnDamage(side, 'ESQUIVA', 'is-evade');
      return;
    }

    this.spawnDamage(side, blocked ? `BLOQUEO -${damage}` : `-${damage}`, blocked ? 'is-blocked' : '');
    this.flashHit(side);
    this.shakeScene();
  }

  /** Crea el número que sube desde la ficha del jugador o del enemigo. */
  spawnDamage(side, text, modifier) {
    // Se mide en el frame siguiente: la ficha del enemigo la coloca el bucle
    // de render y puede no tener aún su posición definitiva en este instante.
    requestAnimationFrame(() => {
      const bar = side === 'player' ? this.playerHpBar : this.enemyHpBar;
      const rect = bar.closest('.status-panel').getBoundingClientRect();

      const float = createNode(
        'span',
        `damage-float is-${side}${modifier ? ` ${modifier}` : ''}`,
        text
      );
      float.setAttribute('aria-hidden', 'true');
      float.style.left = `${rect.left + rect.width / 2}px`;
      float.style.top = `${rect.top}px`;
      document.body.appendChild(float);
      setTimeout(() => float.remove(), DAMAGE_FLOAT_MS);
    });
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
    const entry = document.createElement('p');
    entry.className = kind ? `log-entry ${kind}` : 'log-entry';
    entry.textContent = message;
    this.logContainer.appendChild(entry);

    while (this.logContainer.children.length > MAX_LOG_ENTRIES) {
      this.logContainer.firstElementChild.remove();
    }
  }
}
