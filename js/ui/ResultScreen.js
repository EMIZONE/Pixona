import { createNode } from '../utils/dom.js';
import { formatMoney } from '../utils/format.js';

/**
 * Pantalla final de la tanda, con estética Persona.
 *
 * - victoria: lista las sombras derrotadas, EXP, nivel, dinero y botín total;
 * - derrota: lista solo las derrotadas y muestra dónde cayó el jugador.
 *
 * El botón (o Enter/Z/Espacio) recarga la página: no hay guardado.
 */
const RESTART_KEYS = new Set(['Enter', 'z', 'Z', ' ']);
const SETTLE_DELAY_MS = 800;

export class ResultScreen {
  constructor({ items, onRestart }) {
    this.itemCatalog = items;
    this.onRestart = onRestart;
    this.visible = false;
    this.settleTimer = null;

    this.root = document.getElementById('result-screen');
    this.kicker = document.getElementById('result-kicker');
    this.title = document.getElementById('result-title');
    this.subtitle = document.getElementById('result-subtitle');
    this.rows = document.getElementById('result-rows');
    this.xpEl = document.getElementById('result-xp');
    this.moneyEl = document.getElementById('result-money');
    this.levelEl = document.getElementById('result-level');
    this.lootEl = document.getElementById('result-loot');
    this.restartBtn = document.getElementById('result-restart');

    this.restartBtn.addEventListener('click', () => this.onRestart());

    // Al estar visible, Enter/Z/Espacio reinician y Tab no sale de la tarjeta.
    window.addEventListener('keydown', (event) => {
      if (!this.visible) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        this.restartBtn.focus();
        return;
      }
      if (!RESTART_KEYS.has(event.key)) return;
      event.preventDefault();
      this.onRestart();
    });
  }

  /** Muestra el resumen y rellena todos los bloques. */
  show({ victory, defeated, total, rewards, level, fallenAt }) {
    this.visible = true;
    clearTimeout(this.settleTimer);
    this.root.classList.remove('is-settled');
    this.root.classList.toggle('is-defeat', !victory);
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.inert = false;
    // Pasada la animación, `is-settled` garantiza que todo quede visible.
    this.settleTimer = setTimeout(() => this.root.classList.add('is-settled'), SETTLE_DELAY_MS);

    this.kicker.textContent = victory ? 'BATALLA COMPLETADA' : 'FIN DEL COMBATE';
    this.title.textContent = victory ? 'VICTORIA' : 'DERROTA';
    this.subtitle.textContent = victory
      ? `${total} / ${total} SOMBRAS DERROTADAS`
      : `${defeated.length} / ${total} SOMBRAS DERROTADAS · CAÍSTE ANTE ${fallenAt.name}`;

    this.renderRows(defeated);
    this.renderLoot(rewards.loot);

    this.xpEl.textContent = `+${rewards.xp}`;
    this.moneyEl.textContent = `¥ ${formatMoney(rewards.money)}`;
    this.levelEl.textContent = String(level);

    // El foco va al botón para que Enter funcione sin usar el ratón.
    this.restartBtn.focus();
  }

  /** Vuelca los nodos de una lista, o su estado vacío, en un contenedor. */
  renderList(container, entries, emptyText, buildRow) {
    container.replaceChildren();
    if (entries.length === 0) {
      container.appendChild(createNode('p', 'result-empty', emptyText));
      return;
    }
    container.append(...entries.map(buildRow));
  }

  /** Una fila por sombra derrotada: nombre, EXP y dinero. */
  renderRows(defeated) {
    this.renderList(this.rows, defeated, 'Ninguna sombra derrotada.', (enemy, index) => {
      const row = createNode('div', 'result-row');
      // La variable CSS escalona la animación de entrada de cada fila.
      row.style.setProperty('--result-index', index);
      row.append(
        createNode('span', 'result-row-name', `${index + 1}. ${enemy.name}`),
        createNode('span', 'result-row-reward', `+${enemy.xp} EXP · ¥ ${formatMoney(enemy.money)}`)
      );
      return row;
    });
  }

  /** Botín agrupado por objeto (las caídas repetidas se suman en BattleFlow). */
  renderLoot(loot) {
    this.renderList(this.lootEl, Object.entries(loot), 'Sin botín esta vez.', ([itemId, count]) => {
      const row = createNode('div', 'result-loot-row');
      row.append(
        createNode('span', 'result-loot-name', this.itemCatalog[itemId].name),
        createNode('span', 'result-loot-count', `×${count}`)
      );
      return row;
    });
  }
}
