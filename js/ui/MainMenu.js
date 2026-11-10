import { createButton, createNode } from '../utils/dom.js';

/**
 * Menú principal de pantalla completa (estilo Persona).
 *
 * Dos zonas de foco: `'options'` (la lista de la izquierda) y `'rows'` (las
 * filas del panel). El menú no guarda estado del juego: al confirmar una fila
 * llama a los callbacks de `main.js` y repinta el panel con los datos ya
 * actualizados del `Fighter`. Cada opción declara el método que dibuja su panel.
 */
const OPTIONS = [
  { label: 'OBJETO', render: 'renderItems' },
  { label: 'PERSONA', render: 'renderPersona' },
  { label: 'STATS', render: 'renderStats' },
  { label: 'CONFIDENT', render: 'renderEmpty' },
  { label: 'REQUEST', render: 'renderRequests' },
  { label: 'CALENDARIO', render: 'renderCalendar' },
  { label: 'SISTEMA', render: 'renderSystem' }
];

/** Atributos de PIXONA y su etiqueta visible. */
const STAT_LABELS = [
  ['strength', 'FUERZA'],
  ['magic', 'MAGIA'],
  ['endurance', 'RESISTENCIA'],
  ['agility', 'AGILIDAD'],
  ['luck', 'SUERTE']
];

/** Temas disponibles en SISTEMA. El color se aplica a `--accent`. */
const THEMES = [
  { label: 'ROJO', color: '#ff0033' },
  { label: 'AZUL', color: '#2f6bff' },
  { label: 'VERDE', color: '#00c46a' },
  { label: 'ÁMBAR', color: '#ff9f1c' },
  { label: 'CIAN', color: '#00d4e0' },
  { label: 'MAGENTA', color: '#ff2ea6' }
];

/** Tamaños del texto global (S / M / L / XL). */
const FONT_SIZES = [
  { id: 's', label: 'PEQUEÑO', px: 14 },
  { id: 'm', label: 'NORMAL', px: 16 },
  { id: 'l', label: 'GRANDE', px: 18 },
  { id: 'xl', label: 'ENORME', px: 21 }
];

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DEFAULT_THEME = THEMES[0].color;
const DEFAULT_FONT_PX = 16;
const EMPTY_DETAIL = 'No disponible en esta demo.';
const EMPTY_ROW = '— sin contenido —';
/** Duraciones alineadas con `.menu-submenu.is-leaving` / `is-entering`. */
const PANEL_LEAVE_MS = 160;
const PANEL_ENTER_MS = 280;

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
    this.accent = DEFAULT_THEME;
    this.fontPx = DEFAULT_FONT_PX;

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
      button.addEventListener('mouseenter', () => this.selectOption(index));
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
    const key = event.key;

    if (key === 'Escape') {
      event.preventDefault();
      if (this.zone === 'rows') this.backToOptions();
      else this.close();
      return;
    }

    const down = key === 'ArrowDown' || key === 's' || key === 'S';
    const up = key === 'ArrowUp' || key === 'w' || key === 'W';
    const confirm = key === 'Enter' || key === 'z' || key === 'Z';
    const forward = key === 'ArrowRight' || key === 'd' || key === 'D';
    const back = key === 'ArrowLeft' || key === 'a' || key === 'A';

    if (this.zone === 'rows') {
      if (down) {
        event.preventDefault();
        this.moveRow(1);
      } else if (up) {
        event.preventDefault();
        this.moveRow(-1);
      } else if (confirm) {
        event.preventDefault();
        this.activateRow();
      } else if (back) {
        event.preventDefault();
        this.backToOptions();
      }
      return;
    }

    if (down) {
      event.preventDefault();
      this.selectOption((this.optionIndex + 1) % OPTIONS.length);
    } else if (up) {
      event.preventDefault();
      this.selectOption((this.optionIndex - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (confirm || forward) {
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
    this.panel.classList.remove('is-entering');
    // Reflow para reiniciar la animación al cambiar de opción.
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
      this.closeGearCategory();
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
   * Limpia el panel y llama al renderer de la opción activa. `keepIndex`
   * conserva la fila seleccionada tras un cambio (equipar, cambiar tema…).
   */
  renderPanel(keepIndex = 0) {
    const option = OPTIONS[this.optionIndex];
    this.panelTitle.textContent = option.label;
    this.panelList.replaceChildren();
    this.rows = [];

    this[option.render]();

    this.rowIndex = Math.min(keepIndex, Math.max(0, this.rows.length - 1));
    this.applyRowHighlight();
  }

  /** Repinta el panel, refresca los chips y deja un mensaje de resultado. */
  refreshPanel(message, index = this.rowIndex) {
    this.renderPanel(index);
    this.updateStats();
    this.panelDetail.textContent = message;
  }

  /** Panel vacío para opciones sin contenido (CONFIDENT). */
  renderEmpty() {
    this.panelDetail.textContent = EMPTY_DETAIL;
    this.panelList.appendChild(this.makeEmptyLine(EMPTY_ROW));
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

    row.addEventListener('mouseenter', () => this.focusRow(index, preview));
    row.addEventListener('click', () => {
      this.focusRow(index, preview);
      action();
    });

    container.appendChild(row);
    this.rows.push({ el: row, action, preview });
    return row;
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

  previewRow() {
    this.rows[this.rowIndex].preview();
  }

  activateRow() {
    this.rows[this.rowIndex].action();
  }

  /* --- Armas ---------------------------------------------------------- */

  /**
   * Vista previa de un arma. La DEF incluye la armadura actual porque cambiar
   * de arma no la reemplaza; el delta de ATK compara contra el arma equipada.
   */
  describeWeapon(weapon) {
    const attack = this.player.baseAtk + weapon.atkBonus;
    const defense = this.player.baseDef + weapon.defBonus + this.player.armor.defBonus;
    const delta = attack - this.player.atk;
    const deltaText = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';
    const recoil = weapon.recoil > 0 ? ` · RETROCESO -${weapon.recoil} HP` : '';
    return `${weapon.description} ATK ${attack}${deltaText} · DEF ${defense}${recoil}`;
  }

  equipWeapon(weapon) {
    this.onEquipWeapon(weapon);
    this.refreshPanel(`${weapon.name} equipada. ${this.describeWeapon(weapon)}`);
  }

  /* --- Persona y equipo ---------------------------------------------- */

  /**
   * Panel PERSONA: ranuras de equipo + perfil. Confirmar una ranura despliega
   * el arsenal completo de esa categoría para comparar todas las piezas.
   */
  renderPersona() {
    if (this.gearCategory) {
      this.renderGearList(this.gearCategory);
      return;
    }

    const { persona } = this;
    this.panelDetail.textContent = this.personaLine();
    this.panelList.appendChild(this.sectionLabel('EQUIPAMIENTO'));

    const slots = [
      ['ARMA', this.player.weapon, 'weapon'],
      ['ARMADURA', this.player.armor, 'armor'],
      ['ACCESORIO', this.player.accessory, 'accessory']
    ];

    slots.forEach(([label, item, category]) => {
      const config = this.gearConfig(category);
      const row = this.makeRow(label, { value: item.name, active: true });
      this.addRow(
        row,
        () => this.openGearCategory(category),
        () => {
          this.panelDetail.textContent =
            `${config.describe(item)} ENTER para ver todas las opciones.`;
        }
      );
    });

    this.panelList.appendChild(this.sectionLabel('PERFIL'));
    this.panelList.appendChild(createNode('p', 'persona-bio', this.profileDescription));

    this.panelList.appendChild(this.sectionLabel(`PERSONA · ${persona.name}`));
    this.panelList.appendChild(
      createNode('p', 'persona-bio persona-meta', `Nivel ${persona.level} · Arcano: ${persona.arcana}`)
    );
    this.panelList.appendChild(createNode('p', 'persona-bio', persona.description));
  }

  /** Configuración de una ranura: lista, pieza actual y cómo describir/equipar. */
  gearConfig(category) {
    const configs = {
      weapon: {
        label: 'ARMA',
        list: this.weapons,
        current: this.player.weapon,
        describe: (item) => this.describeWeapon(item),
        stats: (item) => this.weaponStats(item),
        equip: (item) => this.equipWeapon(item)
      },
      armor: {
        label: 'ARMADURA',
        list: this.equipment.armor,
        current: this.player.armor,
        describe: (item) => this.describeArmor(item),
        stats: (item) => this.armorStats(item),
        equip: (item) => this.equipArmor(item)
      },
      accessory: {
        label: 'ACCESORIO',
        list: this.equipment.accessories,
        current: this.player.accessory,
        describe: (item) => this.describeAccessory(item),
        stats: (item) => this.accessoryStats(item),
        equip: (item) => this.equipAccessory(item)
      }
    };

    return configs[category];
  }

  /** Abre el arsenal de una categoría; el foco arranca en la primera pieza. */
  openGearCategory(category) {
    this.gearCategory = category;
    this.renderPanel(1);
    this.zone = 'rows';
    this.applyRowHighlight();
    this.previewRow();
  }

  /** Vuelve de la lista de piezas a las ranuras de PERSONA. */
  closeGearCategory() {
    const slotIndex = { weapon: 0, armor: 1, accessory: 2 }[this.gearCategory] ?? 0;
    this.gearCategory = null;
    this.renderPanel(slotIndex);
    this.zone = 'rows';
    this.applyRowHighlight();
    this.previewRow();
  }

  /** Lista completa de una categoría, con stats alineados y la pieza activa. */
  renderGearList(category) {
    const config = this.gearConfig(category);
    this.panelTitle.textContent = `PERSONA · ${config.label}`;
    this.panelDetail.textContent =
      `${config.list.length} opciones. Elige la que mejor encaje con tu build.`;

    const back = this.makeRow('← VOLVER A PERSONA', { value: 'ESC' });
    this.addRow(
      back,
      () => this.closeGearCategory(),
      () => { this.panelDetail.textContent = 'Vuelve a las ranuras de equipo.'; }
    );

    this.panelList.appendChild(
      this.sectionLabel(`${config.label} · ${config.list.length} OPCIONES`)
    );

    config.list.forEach((item) => {
      const row = this.makeRow(item.name, {
        value: config.stats(item),
        active: item === config.current
      });
      this.addRow(
        row,
        () => config.equip(item),
        () => { this.panelDetail.textContent = `${config.describe(item)} ENTER para equipar.`; }
      );
    });
  }

  /** Stats de un arma con el resto del equipo actual, para comparar de un vistazo. */
  weaponStats(weapon) {
    const attack = this.player.baseAtk + weapon.atkBonus;
    const defense = this.player.baseDef + weapon.defBonus + this.player.armor.defBonus;
    const recoil = weapon.recoil > 0 ? ` · RETRO -${weapon.recoil}` : '';
    return `ATK ${attack} · DEF ${defense}${recoil}`;
  }

  armorStats(armor) {
    const defense = this.player.baseDef + this.player.weapon.defBonus + armor.defBonus;
    const speed = armor.speedBonus ? ` · VEL ${this.signed(armor.speedBonus)}` : '';
    const evasion = armor.evasionBonus
      ? ` · EVA ${this.signed(Math.round(armor.evasionBonus * 100))}%`
      : '';
    return `DEF ${defense}${speed}${evasion}`;
  }

  accessoryStats(accessory) {
    const evasion = Math.round(accessory.evasionBonus * 100);
    return `EVA ${this.signed(evasion)}% · VEL ${this.signed(accessory.speedBonus)}`;
  }

  signed(value) {
    return value > 0 ? `+${value}` : `${value}`;
  }

  describeArmor(armor) {
    const speed = armor.speedBonus ? ` · VEL ${this.signed(armor.speedBonus)}` : '';
    const evasion = armor.evasionBonus
      ? ` · EVA ${this.signed(Math.round(armor.evasionBonus * 100))}%`
      : '';
    return `${armor.name}: ${armor.description} DEF +${armor.defBonus}${speed}${evasion}.`;
  }

  describeAccessory(accessory) {
    return `${accessory.name}: ${accessory.description} ` +
      `EVA ${this.signed(Math.round(accessory.evasionBonus * 100))}% · ` +
      `VEL ${this.signed(accessory.speedBonus)}.`;
  }

  equipArmor(armor) {
    this.onEquipArmor(armor);
    this.refreshPanel(`Armadura: ${armor.name}. DEF ${this.player.def}.`);
  }

  equipAccessory(accessory) {
    this.onEquipAccessory(accessory);
    this.refreshPanel(this.describeAccessory(accessory));
  }

  /* --- Objetos -------------------------------------------------------- */

  /** Catálogo completo; las cargas a 0 se marcan como vacías pero siguen visibles. */
  renderItems() {
    const activeId = this.getActiveItemId();

    Object.entries(this.itemCatalog).forEach(([id, definition]) => {
      const count = this.player.items[id] ?? 0;
      const row = this.makeRow(definition.name, {
        value: `×${count}`,
        active: id === activeId,
        empty: count <= 0
      });
      this.addRow(
        row,
        () => this.selectItem(id, definition),
        () => this.previewItem(id, definition, count)
      );
    });

    const active = this.itemCatalog[activeId];
    this.panelDetail.textContent = `Activo: ${active.name}. ${active.description}`;
  }

  /** Vista previa con estado activo y aviso de existencias. */
  previewItem(id, definition, count) {
    const suffix = count <= 0 ? ' Sin existencias.' : '';
    const active = id === this.getActiveItemId() ? ' ACTIVO.' : '';
    this.panelDetail.textContent = `${definition.name}: ${definition.description}${active}${suffix}`;
  }

  /** Marca el objeto que usará el comando OBJETO en el combate. */
  selectItem(itemId, definition) {
    this.onSelectItem(itemId, definition);
    this.refreshPanel(
      `Activo: ${definition.name}. ${definition.description}`,
      Object.keys(this.itemCatalog).indexOf(itemId)
    );
  }

  /* --- Stats ---------------------------------------------------------- */

  /** Línea común de cabecera del Persona. */
  personaLine() {
    const { persona } = this;
    return `${persona.name} · Nivel ${persona.level} · Arcano: ${persona.arcana}`;
  }

  /**
   * Panel STATS: atributos del Persona sobre 99 y derivados reales del
   * `Fighter` (HP/SP/ATK/DEF/EVA/VEL), más el equipo completo.
   */
  renderStats() {
    this.panelDetail.textContent = this.personaLine();

    const grid = createNode('div', 'stat-grid');
    STAT_LABELS.forEach(([key, label]) => {
      const value = this.persona.stats[key];
      const bar = createNode('span', 'stat-bar');
      const fill = createNode('span', 'stat-bar-fill');
      fill.style.width = `${(value / 99) * 100}%`;
      bar.appendChild(fill);

      const row = createNode('div', 'stat-row');
      row.append(createNode('span', 'stat-name', label), createNode('span', 'stat-num', value), bar);
      grid.appendChild(row);
    });
    this.panelList.appendChild(grid);

    const player = this.player;
    const derived = [
      `HP ${player.currentHp}/${player.maxHp}`,
      `SP ${player.currentSp}/${player.maxSp}`,
      `ATK ${player.atk}`,
      `DEF ${player.def}`,
      `EVA ${Math.round(player.evasion * 100)}%`,
      `VEL ${player.speed}`
    ];
    const gear = [
      `ARMA: ${player.weapon.name}`,
      `ARMADURA: ${player.armor.name}`,
      `ACCESORIO: ${player.accessory.name}`
    ];
    this.panelList.append(
      createNode('p', 'stat-derived', derived.join(' · ')),
      createNode('p', 'stat-derived stat-gear', gear.join(' · '))
    );
  }

  /* --- Peticiones ----------------------------------------------------- */

  /** Peticiones agrupadas por estado; el contenido es estático. */
  renderRequests() {
    const pending = this.requests.filter((request) => request.status === 'pending');
    const completed = this.requests.filter((request) => request.status === 'completed');

    this.panelDetail.textContent = `${pending.length} pendientes · ${completed.length} completadas.`;

    this.panelList.appendChild(this.sectionLabel(`PENDIENTES · ${pending.length}`));
    if (pending.length === 0) {
      this.panelList.appendChild(this.makeEmptyLine('Sin peticiones pendientes.'));
    }
    pending.forEach((request) => this.addRequestRow(request));

    this.panelList.appendChild(this.sectionLabel(`COMPLETADAS · ${completed.length}`));
    if (completed.length === 0) {
      this.panelList.appendChild(this.makeEmptyLine('Todavía no has completado ninguna.'));
    }
    completed.forEach((request) => this.addRequestRow(request));
  }

  /** Una petición es una fila; las completadas se atenúan. */
  addRequestRow(request) {
    const completed = request.status === 'completed';
    const row = this.makeRow(request.title, {
      value: completed ? 'COMPLETADA' : request.reward,
      completed
    });
    this.addRow(row, () => this.showRequest(request));
  }

  showRequest(request) {
    this.panelDetail.textContent = this.describeRequest(request);
  }

  /** Detalle de cliente, lugar, objetivo, recompensa y estado. */
  describeRequest(request) {
    const status = request.status === 'completed' ? 'COMPLETADA' : 'PENDIENTE';
    return `${request.client} · ${request.location}. ${request.summary} ` +
      `${request.objective} Recompensa: ${request.reward}. [${status}]`;
  }

  /** Línea vacía reutilizada por los paneles sin contenido. */
  makeEmptyLine(text) {
    return createNode('p', 'submenu-empty', text);
  }

  /* --- Calendario ----------------------------------------------------- */

  /**
   * Calendario del mes real con la semana empezando en lunes. `getDay()`
   * devuelve 0 para domingo; `(firstWeekday + 6) % 7` deja lunes en la columna
   * 0. Los días de los meses vecinos rellenan los huecos con `is-outside`.
   */
  renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    this.panelDetail.textContent = 'Días pasados en rojo · hoy en blanco.';

    const grid = createNode('div', 'cal-grid');
    WEEKDAYS.forEach((label) => {
      grid.appendChild(createNode('span', 'cal-dow', label));
    });

    const firstWeekday = new Date(year, month, 1).getDay();
    const leading = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < leading; i++) {
      grid.appendChild(this.makeDayCell(daysInPrevMonth - leading + i + 1, 'is-outside'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const modifier = day < today ? 'is-past' : day === today ? 'is-today' : '';
      grid.appendChild(this.makeDayCell(day, modifier));
    }

    const trailing = (7 - ((leading + daysInMonth) % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      grid.appendChild(this.makeDayCell(i, 'is-outside'));
    }

    this.panelList.append(createNode('p', 'cal-month', `${MONTHS[month]} ${year}`), grid);
  }

  makeDayCell(day, modifier) {
    return createNode('span', modifier ? `cal-day ${modifier}` : 'cal-day', day);
  }

  /* --- Sistema -------------------------------------------------------- */

  /**
   * Panel SISTEMA: color de acento, tamaño del texto y restablecer.
   * Ambos ajustes viven en memoria; al recargar vuelven a los valores por
   * defecto (no hay localStorage).
   */
  renderSystem() {
    this.panelDetail.textContent = 'Cambia el color de acento y el tamaño del texto.';

    this.panelList.appendChild(this.sectionLabel('COLOR DE LA INTERFAZ'));

    THEMES.forEach((theme) => {
      const isActive = theme.color === this.accent;
      const row = this.makeRow(theme.label, {
        value: isActive ? 'ACTIVO' : '',
        active: isActive,
        swatch: theme.color
      });

      this.addRow(
        row,
        () => {
          this.accent = theme.color;
          this.onAccentChange(theme.color);
          this.refreshPanel(`Color de interfaz: ${theme.label.toLowerCase()}.`);
        },
        () => { this.panelDetail.textContent = `Color de interfaz: ${theme.label.toLowerCase()}.`; }
      );
    });

    this.panelList.appendChild(this.sectionLabel('TAMAÑO DEL TEXTO'));

    const picker = createNode('div', 'size-picker');
    this.panelList.appendChild(picker);

    FONT_SIZES.forEach((size) => {
      const button = createButton('size-btn', size.id.toUpperCase());
      button.classList.toggle('is-chosen', size.px === this.fontPx);

      this.addRow(
        button,
        () => {
          this.fontPx = size.px;
          this.onFontChange(size.px);
          this.refreshPanel(`Tamaño de texto: ${size.label.toLowerCase()} (${size.px}px).`);
        },
        () => { this.panelDetail.textContent = `${size.label} · ${size.px}px`; },
        picker
      );
    });

    this.panelList.appendChild(this.sectionLabel('ATENCIÓN'));

    const reset = this.makeRow('RESTABLECER', { value: 'ROJO · NORMAL' });
    this.addRow(
      reset,
      () => {
        this.accent = DEFAULT_THEME;
        this.fontPx = DEFAULT_FONT_PX;
        this.onAccentChange(DEFAULT_THEME);
        this.onFontChange(DEFAULT_FONT_PX);
        this.refreshPanel('Ajustes restablecidos.');
      },
      () => { this.panelDetail.textContent = 'Vuelve al tema rojo y al texto normal.'; }
    );
  }

  /* ------------------------------------------------------------------ */
  /* Estadísticas inferiores                                             */
  /* ------------------------------------------------------------------ */

  /** Chips ATK/DEF/HP/SP que acompañan siempre al menú. */
  updateStats() {
    const player = this.player;
    this.statEls.ATK.textContent = player.atk;
    this.statEls.DEF.textContent = player.def;
    this.statEls.HP.textContent = `${player.currentHp}/${player.maxHp}`;
    this.statEls.SP.textContent = `${player.currentSp}/${player.maxSp}`;
  }
}
