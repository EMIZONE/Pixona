/** Teclas compartidas por teclado y por los controles del juego. */
const MOVE_DOWN_KEYS = new Set(['ArrowDown', 's', 'S']);
const MOVE_UP_KEYS = new Set(['ArrowUp', 'w', 'W']);
const CONFIRM_KEYS = new Set(['Enter', 'z', 'Z']);

/**
 * Menú de acciones del combate (ATACAR / HABILIDAD / …).
 *
 * Solo gestiona foco, ratón y teclado: avisa a `onActionSelect` con el
 * `data-action` elegido y deja que `BattleEngine` valide la acción.
 */
export class BattleMenu {
  constructor(containerId, onActionSelect) {
    this.container = document.getElementById(containerId);
    this.onActionSelect = onActionSelect;
    this.buttons = Array.from(this.container.querySelectorAll('.menu-btn'));
    this.selectedIndex = 0;
    this.enabled = false;

    this.buttons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (!this.enabled) return;
        this.selectedIndex = index;
        this.triggerSelection();
      });
      // El hover solo mueve el foco visual; no ejecuta la acción.
      button.addEventListener('mouseenter', () => {
        if (this.enabled) this.setFocus(index);
      });
    });

    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
  }

  /** Navegación circular con flechas/WASD y confirmación con Enter/Z. */
  handleKeyDown(event) {
    if (!this.enabled) return;

    const key = event.key;

    if (MOVE_DOWN_KEYS.has(key)) {
      event.preventDefault();
      this.setFocus((this.selectedIndex + 1) % this.buttons.length);
    } else if (MOVE_UP_KEYS.has(key)) {
      event.preventDefault();
      this.setFocus((this.selectedIndex - 1 + this.buttons.length) % this.buttons.length);
    } else if (CONFIRM_KEYS.has(key)) {
      event.preventDefault();
      this.triggerSelection();
    }
  }

  /** Mueve el resaltado y el foco real del navegador. */
  setFocus(index) {
    this.selectedIndex = index;
    this.buttons.forEach((button, i) => {
      button.classList.toggle('active', i === index);
      if (i === index) button.focus();
    });
  }

  /** Envía al motor la acción del botón activo. */
  triggerSelection() {
    this.onActionSelect(this.buttons[this.selectedIndex].dataset.action);
  }

  /** Cambia el texto de una acción (por ejemplo, el objeto activo y sus cargas). */
  setActionLabel(action, label) {
    const button = this.buttons.find((button) => button.dataset.action === action);
    if (button) button.textContent = label;
  }

  /**
   * Habilita o deshabilita todo el menú y, al reactivarlo, devuelve el foco al
   * último botón elegido para que el teclado siga funcionando sin un clic.
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.container.classList.toggle('is-disabled', !enabled);
    if (enabled) this.setFocus(this.selectedIndex);
  }
}
