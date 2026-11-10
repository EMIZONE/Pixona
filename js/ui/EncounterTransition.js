/**
 * Transición entre dos sombras: fundido a negro, tarjeta con el siguiente
 * oponente y salida. `onCovered` se ejecuta cuando el negro ya cubre la escena,
 * que es el momento seguro para cambiar el enemigo y restaurar HP/SP.
 *
 * Los tiempos viven aquí para que `BattleFlow` no conozca la animación.
 */
const FADE_IN_MS = 340;
const HOLD_MS = 1150;
const FADE_OUT_MS = 380;
const SETTLE_DELAY_MS = 600;

/** Promesa de espera usada para encadenar las fases. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class EncounterTransition {
  constructor() {
    this.root = document.getElementById('encounter-overlay');
    this.countEl = document.getElementById('encounter-count');
    this.nameEl = document.getElementById('encounter-name');
    this.quoteEl = document.getElementById('encounter-quote');
    // Evita dos transiciones simultáneas.
    this.busy = false;
    // Fuerza el estado final si la animación CSS no arranca (headless).
    this.settleTimer = null;
  }

  /** @param {{ index: number, total: number, enemy: object, onCovered: Function }} options */
  async play({ index, total, enemy, onCovered }) {
    if (this.busy) return;
    this.busy = true;
    clearTimeout(this.settleTimer);

    this.countEl.textContent = `SOMBRA ${index} / ${total}`;
    this.nameEl.textContent = enemy.name;
    this.quoteEl.textContent = enemy.description;
    this.root.classList.remove('is-settled');
    this.root.setAttribute('aria-hidden', 'false');
    this.root.classList.add('is-open');

    // El negro ya cubre la escena: cambiar el enemigo sin que se vea el corte.
    await wait(FADE_IN_MS);
    onCovered();
    this.settleTimer = setTimeout(() => this.root.classList.add('is-settled'), SETTLE_DELAY_MS);

    await wait(HOLD_MS);
    clearTimeout(this.settleTimer);
    this.root.classList.remove('is-settled');
    this.root.classList.remove('is-open');
    this.root.classList.add('is-closing');

    await wait(FADE_OUT_MS);
    this.root.classList.remove('is-closing');
    this.root.setAttribute('aria-hidden', 'true');
    this.busy = false;
  }
}
