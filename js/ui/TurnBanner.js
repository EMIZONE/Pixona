/**
 * Anuncio de turno.
 *
 * `show('player')` / `show('enemy')` lanzan una banda central que se desliza y
 * se va, y actualizan el chip permanente del HUD. `show('over')` retira la
 * banda y deja el chip en «FIN DEL COMBATE».
 */
const BANNER_MS = 1400;

export class TurnBanner {
  constructor() {
    this.root = document.getElementById('turn-banner');
    this.kicker = document.getElementById('turn-banner-kicker');
    this.label = document.getElementById('turn-banner-label');
    this.hint = document.getElementById('turn-banner-hint');
    this.chip = document.getElementById('turn-chip');
    this.chipText = document.getElementById('turn-chip-text');
    this.hideTimer = null;
  }

  show(kind) {
    this.chip.classList.remove('is-player', 'is-enemy', 'is-over');

    if (kind === 'over') {
      this.hideBanner();
      this.chip.classList.add('is-over');
      this.chipText.textContent = 'FIN DEL COMBATE';
      return;
    }

    const player = kind === 'player';
    this.kicker.textContent = player ? 'SIGUIENTE' : 'ATENCIÓN';
    this.label.textContent = player ? 'TU TURNO' : 'TURNO DEL ENEMIGO';
    this.hint.textContent = player ? 'ELIGE UNA ACCIÓN' : 'LA SOMBRA SE PREPARA';
    this.chipText.textContent = player ? 'TU TURNO' : 'TURNO DEL ENEMIGO';
    this.chip.classList.add(player ? 'is-player' : 'is-enemy');

    // Reinicia la animación aunque el turno anterior siga en pantalla.
    this.root.classList.remove('is-open', 'is-player', 'is-enemy');
    void this.root.offsetWidth;
    this.root.classList.add('is-open', player ? 'is-player' : 'is-enemy');
    this.root.setAttribute('aria-hidden', 'false');

    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hideBanner(), BANNER_MS);
  }

  hideBanner() {
    clearTimeout(this.hideTimer);
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
  }
}
