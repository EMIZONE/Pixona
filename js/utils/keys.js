/**
 * Mapa único de teclas de navegación: el combate y el menú principal leían
 * las mismas combinaciones por separado.
 */
const ACTIONS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  Enter: 'confirm', z: 'confirm', Z: 'confirm',
  ArrowRight: 'forward', d: 'forward', D: 'forward',
  ArrowLeft: 'back', a: 'back', A: 'back',
  Escape: 'escape'
};

/** Acción de navegación de `event.key`, o `null` si la tecla no navega. */
export function navigationAction(key) {
  return ACTIONS[key] ?? null;
}
