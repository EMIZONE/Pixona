/**
 * Ayudas mínimas para construir DOM sin repetir tres líneas por nodo.
 * El texto siempre entra por `textContent`, nunca por HTML.
 */

/** Crea un nodo con clase y texto opcionales. */
export function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Igual que `createNode`, pero para botones que no deben enviar formularios. */
export function createButton(className, text) {
  const button = createNode('button', className, text);
  button.type = 'button';
  return button;
}
