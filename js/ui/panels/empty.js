/**
 * Panel decorativo CONFIDENT: sin filas propias, solo un texto de relleno.
 */
const EMPTY_DETAIL = 'No disponible en esta demo.';
const EMPTY_ROW = '— sin contenido —';

export const emptyPanel = {
  label: 'CONFIDENT',

  render(menu) {
    menu.panelDetail.textContent = EMPTY_DETAIL;
    menu.panelList.appendChild(menu.makeEmptyLine(EMPTY_ROW));
  }
};
