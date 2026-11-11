import { createButton, createNode } from '../utils/dom.js';
import { navigationAction } from '../utils/keys.js';
import { calendarPanel } from './panels/calendar.js';
import { emptyPanel } from './panels/empty.js';
import { itemsPanel } from './panels/items.js';
import { personaPanel } from './panels/persona.js';
import { requestsPanel } from './panels/requests.js';
import { statsPanel } from './panels/stats.js';
import { defaultSettings, systemPanel } from './panels/system.js';

/**
 * Menú principal de pantalla completa (estilo Persona).
 *
 * Dos zonas de foco: `'options'` (la lista de la izquierda) y `'rows'` (las
 * filas del panel). El menú no guarda estado del juego: al confirmar una fila
 * llama a los callbacks de `main.js` y repinta el panel con los datos ya
 * actualizados del `Fighter`.
 *
 * Cada opción es un panel de `panels/` con la forma `{ label, tall?, render(menu) }`.
 * El menú les presta las filas (`makeRow` / `addRow` / `sectionLabel`), el
 * contenedor (`panelList` / `panelDetail` / `panelTitle`) y el repintado
 * (`renderPanel` / `refreshPanel`), así que un panel nuevo solo necesita un
 * archivo y una entrada en `OPTIONS`.
 */
const OPTIONS = [
  itemsPanel,
  personaPanel,
  statsPanel,
  emptyPanel,
  requestsPanel,
  calendarPanel,
  systemPanel
];

/** Duraciones alineadas con `.menu-submenu.is-leaving` / `is-entering`. */
const PANEL_LEAVE_MS = 160;
const PANEL_ENTER_MS = 280;
/** Ventana tras el último movimiento real del ratón para aceptar un hover. */
const HOVER_MOVE_GRACE_MS = 120;

export class MainMenu {
  constructor({
    player,
    profile,
    catalogs,
    requests,
    getActiveItemId,
    onEquipWeapon,
    onEquipArmor,
    onEquipAccessory,
    onSelectItem,
    onAccentChange,
    onFontChange,
    onOpen,
    onClose
  }) {
    this.player = player;
    this.persona = profile.persona;
    this.profileDescription = profile.description;
    this.weapons = catalogs.weapons;
    this.itemCatalog = catalogs.items;
    this.equipment = catalogs.equipment;
    this.requests = requests;
    this.getActiveItemId = getActiveItemId;
    this.onEquipWeapon = onEquipWeapon;
    this.onEquipArmor = onEquipArmor;
    this.onEquipAccessory = onEquipAccessory;
    this.onSelectItem = onSelectItem;
    this.onAccentChange = onAccentChange;
    this.onFontChange = onFontChange;
    this.onOpen = onOpen;
    this.onClose = onClose;

    // Tema y tamaño elegidos en SISTEMA; se aplican al documento por callback.
    this.settings = defaultSettings();

    // Markup de index.html.
    this.root = document.getElementById('main-menu');
    this.optionsEl = document.getElementById('menu-options');
    this.panel = this.root.querySelector('.menu-submenu');
    this.panelTitle = document.getElementById('menu-submenu-title');
    this.panelDetail = document.getElementById('menu-detail');
    this.panelList = document.getElementById('menu-submenu-list');
    this.statsEl = document.getElementById('menu-stats');

    // Navegación: lista de opciones + filas del panel activo.
    this.optionEls = [];
    this.rows = [];
    this.optionIndex = 0;
    this.rowIndex = 0;
    this.zone = 'options';
    this.visible = false;
    // Categoría de equipo abierta dentro de PERSONA ('weapon' | 'armor' | 'accessory').
    this.gearCategory = null;
    // Se actualiza con cada movimiento real del ratón (ver `hoverOption`).
    this.pointerMovedAt = 0;

    this.build();
  }

  /* ------------------------------------------------------------------ */
  /* Construcción                                                        */
  /* ------------------------------------------------------------------ */

  build() {
    this.optionEls = OPTIONS.map((option, index) => {
      const button = createButton('menu-option', option.label);
      // Variable CSS que escalona la animación de entrada.
      button.style.setProperty('--option-index', index);
      button.addEventListener('mouseenter', () => this.hoverOption(index));
      button.addEventListener('click', () => this.activateOption(index));
      this.optionsEl.appendChild(button);
      return button;
    });

    // Chips inferiores con las estadísticas del jugador.
    this.statEls = {};
    ['ATK', 'DEF', 'HP', 'SP'].forEach((label) => {
      const value = createNode('span', 'menu-stat-value', '—');
      const chip = createNode('div', 'menu-stat');
      chip.append(createNode('span', 'menu-stat-label', label), value);
      this.statsEl.appendChild(chip);
      this.statEls[label] = value;
    });

    // Cualquier zona marcada como `data-menu-dismiss` cierra el menú.
    this.root.querySelectorAll('[data-menu-dismiss]').forEach((element) => {
      element.addEventListener('click', () => this.close());
    });

    window.addEventListener('keydown', (event) => {
      if (this.visible) this.handleKey(event);
    });

    // La opción activa se desplaza 18 px y puede meterse bajo un cursor quieto;
    // sin este registro, dos opciones se robarían el hover en bucle.
    window.addEventListener('pointermove', () => {
      this.pointerMovedAt = performance.now();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Abrir / cerrar                                                      */
  /* ------------------------------------------------------------------ */

  open() {
    if (this.visible) return;
    this.visible = true;
    this.root.hidden = false;

    this.zone = 'options';
    this.optionIndex = 0;
    this.gearCategory = null;
    this.applyOptionHighlight();
    this.renderPanel(0);
    this.playPanelEnter();
    this.updateStats();
    this.onOpen();
  }

  close() {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
    this.onClose();
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  /* ------------------------------------------------------------------ */
  /* Teclado                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * En opciones: arriba/abajo cambia la opción, Enter/→ entra al panel.
   * En filas: arriba/abajo mueve, Enter confirma, ←/Esc vuelve. Esc en
   * opciones cierra el menú.
   */
  handleKey(event) {
    const action = navigationAction(event.key);

    if (action === 'escape') {
      event.preventDefault();
      if (this.zone === 'rows') this.backToOptions();
      else this.close();
      return;
    }

    if (this.zone === 'rows') {
      if (action === 'down') {
        event.preventDefault();
        this.moveRow(1);
      } else if (action === 'up') {
        event.preventDefault();
        this.moveRow(-1);
      } else if (action === 'confirm') {
        event.preventDefault();
        this.activateRow();
      } else if (action === 'back') {
        event.preventDefault();
        this.backToOptions();
      }
      return;
    }

    if (action === 'down') {
      event.preventDefault();
      this.selectOption((this.optionIndex + 1) % OPTIONS.length);
    } else if (action === 'up') {
      event.preventDefault();
      this.selectOption((this.optionIndex - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (action === 'confirm' || action === 'forward') {
      event.preventDefault();
      this.activateOption(this.optionIndex);
    }
  }

  /** Movimiento circular de filas; actualiza resaltado y vista previa. */
  moveRow(delta) {
    this.rowIndex = (this.rowIndex + delta + this.rows.length) % this.rows.length;
    this.applyRowHighlight();
    this.previewRow();
  }

  /* ------------------------------------------------------------------ */
  /* Opciones                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Hover con intención: solo acepta el cambio si el ratón se movió hace poco.
   * Evita el bucle entre dos opciones cuando la activa se desplaza 18 px bajo
   * un cursor quieto.
   */
  hoverOption(index) {
    if (performance.now() - this.pointerMovedAt > HOVER_MOVE_GRACE_MS) return;
    this.selectOption(index);
  }

  /** Cambia la opción activa (hover o flechas) y dibuja su panel. */
  selectOption(index) {
    const changed = index !== this.optionIndex;
    this.optionIndex = index;
    this.gearCategory = null;
    this.zone = 'options';
    this.applyOptionHighlight();
    if (changed) this.playPanelSwap();
    else this.renderPanel(0);
  }

  /** La tarjeta sale, se repinta con la nueva opción y vuelve a entrar. */
  playPanelSwap() {
    clearTimeout(this.panelTimer);
    this.panel.classList.remove('is-entering');
    this.panel.classList.add('is-leaving');
    this.panelTimer = setTimeout(() => {
      this.panel.classList.remove('is-leaving');
      this.renderPanel(0);
      this.playPanelEnter();
    }, PANEL_LEAVE_MS);
  }

  /** Entrada de la tarjeta completa (sin animar el contenido). */
  playPanelEnter() {
    clearTimeout(this.panelEnterTimer);
    // Reinicia la animación aunque una anterior siga en pantalla.
    this.panel.classList.remove('is-entering');
    void this.panel.offsetWidth;
    this.panel.classList.add('is-entering');
    this.panelEnterTimer = setTimeout(() => {
      this.panel.classList.remove('is-entering');
    }, PANEL_ENTER_MS);
  }

  /**
   * Confirma una opción: si su panel tiene filas, pasa el foco a la primera.
   * Los paneles vacíos (CONFIDENT) dejan el foco en las opciones.
   */
  activateOption(index) {
    this.selectOption(index);
    if (this.rows.length === 0) return;

    this.zone = 'rows';
    this.applyRowHighlight();
    this.previewRow();
  }

  /**
   * Esc/← desde las filas: si hay un arsenal abierto vuelve a las ranuras de
   * PERSONA; si no, regresa a la lista de opciones.
   */
  backToOptions() {
    if (this.gearCategory) {
      personaPanel.back(this);
      return;
    }

    this.zone = 'options';
    this.applyRowHighlight();
  }

  applyOptionHighlight() {
    this.optionEls.forEach((element, index) => {
      element.classList.toggle('is-active', index === this.optionIndex);
    });
  }

  applyRowHighlight() {
    this.rows.forEach((row, index) => {
      row.el.classList.toggle('is-active', this.zone === 'rows' && index === this.rowIndex);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Panel de detalle                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Limpia el panel y delega en el panel activo. `keepIndex` conserva la fila
   * seleccionada tras un cambio (equipar, cambiar tema…).
   */
  renderPanel(keepIndex = 0) {
    const option = OPTIONS[this.optionIndex];
    this.panel.classList.toggle('is-persona', Boolean(option.tall));
    this.panelTitle.textContent = option.label;
    this.panelList.replaceChildren();
    this.rows = [];

    option.render(this);

    this.rowIndex = Math.min(keepIndex, Math.max(0, this.rows.length - 1));
    this.applyRowHighlight();
  }

  /** Repinta el panel, refresca los chips y deja un mensaje de resultado. */
  refreshPanel(message, index = this.rowIndex) {
    this.renderPanel(index);
    this.updateStats();
    this.panelDetail.textContent = message;
  }

  /* --- Filas genéricas ------------------------------------------------ */

  /**
   * Fila genérica del panel (nombre a la izquierda, valor a la derecha).
   * `active` marca lo equipado, `empty` lo agotado, `completed` lo terminado y
   * `swatch` pinta el cuadradito de color de los temas.
   */
  makeRow(label, { value = '', active = false, empty = false, completed = false, swatch = null } = {}) {
    const row = createButton('submenu-row');
    row.classList.toggle('is-equipped', active);
    row.classList.toggle('is-empty', empty);
    row.classList.toggle('is-completed', completed);

    const name = createNode('span', 'row-name');
    if (swatch) {
      const dot = createNode('span', 'swatch');
      dot.style.backgroundColor = swatch;
      name.appendChild(dot);
    }
    name.appendChild(document.createTextNode(label));

    row.append(name, createNode('span', 'row-value', value));
    return row;
  }

  /**
   * Registra una fila y la añade al DOM. `action` se ejecuta al confirmar y
   * `preview` al enfocar (por defecto, la misma acción).
   */
  addRow(row, action, preview = action, container = this.panelList) {
    const index = this.rows.length;

    row.addEventListener('mouseenter', () => this.hoverRow(index, preview));
    row.addEventListener('click', () => {
      this.focusRow(index, preview);
      action();
    });

    container.appendChild(row);
    this.rows.push({ el: row, action, preview });
    return row;
  }

  /**
   * Hover de fila con la misma guarda que las opciones: el texto de detalle
   * cambia de alto y puede mover las filas bajo un cursor quieto.
   */
  hoverRow(index, preview) {
    if (performance.now() - this.pointerMovedAt > HOVER_MOVE_GRACE_MS) return;
    this.focusRow(index, preview);
  }

  /** Mueve el foco a una fila y actualiza el texto de detalle. */
  focusRow(index, preview) {
    this.zone = 'rows';
    this.rowIndex = index;
    this.applyRowHighlight();
    preview();
  }

  /** Cabecera de sección dentro de un panel (EQUIPAMIENTO, PENDIENTES…). */
  sectionLabel(text) {
    return createNode('p', 'submenu-section', text);
  }

  /** Línea de aviso para los paneles sin contenido. */
  makeEmptyLine(text) {
    return createNode('p', 'submenu-empty', text);
  }

  previewRow() {
    this.rows[this.rowIndex].preview();
  }

  activateRow() {
    this.rows[this.rowIndex].action();
  }

  /* ------------------------------------------------------------------ */
  /* Datos compartidos por los paneles                                   */
  /* ------------------------------------------------------------------ */

  /** Línea de cabecera del Persona (PERSONA y STATS). */
  personaLine() {
    const { persona } = this;
    return `${persona.name} · Nivel ${persona.level} · Arcano: ${persona.arcana}`;
  }

  /** Chips ATK/DEF/HP/SP que acompañan siempre al menú. */
  updateStats() {
    const player = this.player;
    this.statEls.ATK.textContent = player.atk;
    this.statEls.DEF.textContent = player.def;
    this.statEls.HP.textContent = `${player.currentHp}/${player.maxHp}`;
    this.statEls.SP.textContent = `${player.currentSp}/${player.maxSp}`;
  }
}
