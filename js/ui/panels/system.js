import { createButton, createNode } from '../../utils/dom.js';

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

const DEFAULT_THEME = THEMES[0].color;
const DEFAULT_FONT_PX = 16;

/** Ajustes en memoria: al recargar vuelven a los valores por defecto. */
export function defaultSettings() {
  return { accent: DEFAULT_THEME, fontPx: DEFAULT_FONT_PX };
}

/**
 * Panel SISTEMA: color de acento, tamaño del texto y restablecer.
 * Los ajustes viven en `menu.settings`; el documento lo aplica `main.js`.
 */
export const systemPanel = {
  label: 'SISTEMA',

  render(menu) {
    const { settings } = menu;

    menu.panelDetail.textContent = 'Cambia el color de acento y el tamaño del texto.';

    menu.panelList.appendChild(menu.sectionLabel('COLOR DE LA INTERFAZ'));

    THEMES.forEach((theme) => {
      const isActive = theme.color === settings.accent;
      const row = menu.makeRow(theme.label, {
        value: isActive ? 'ACTIVO' : '',
        active: isActive,
        swatch: theme.color
      });

      menu.addRow(
        row,
        () => {
          settings.accent = theme.color;
          menu.onAccentChange(theme.color);
          menu.refreshPanel(`Color de interfaz: ${theme.label.toLowerCase()}.`);
        },
        () => { menu.panelDetail.textContent = `Color de interfaz: ${theme.label.toLowerCase()}.`; }
      );
    });

    menu.panelList.appendChild(menu.sectionLabel('TAMAÑO DEL TEXTO'));

    const picker = createNode('div', 'size-picker');
    menu.panelList.appendChild(picker);

    FONT_SIZES.forEach((size) => {
      const button = createButton('size-btn', size.id.toUpperCase());
      button.classList.toggle('is-chosen', size.px === settings.fontPx);

      menu.addRow(
        button,
        () => {
          settings.fontPx = size.px;
          menu.onFontChange(size.px);
          menu.refreshPanel(`Tamaño de texto: ${size.label.toLowerCase()} (${size.px}px).`);
        },
        () => { menu.panelDetail.textContent = `${size.label} · ${size.px}px`; },
        picker
      );
    });

    menu.panelList.appendChild(menu.sectionLabel('ATENCIÓN'));

    const reset = menu.makeRow('RESTABLECER', { value: 'ROJO · NORMAL' });
    menu.addRow(
      reset,
      () => {
        Object.assign(settings, defaultSettings());
        menu.onAccentChange(settings.accent);
        menu.onFontChange(settings.fontPx);
        menu.refreshPanel('Ajustes restablecidos.');
      },
      () => { menu.panelDetail.textContent = 'Vuelve al tema rojo y al texto normal.'; }
    );
  }
};
