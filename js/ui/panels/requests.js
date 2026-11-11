import { formatMoney } from '../../utils/format.js';

/**
 * Panel REQUEST: peticiones agrupadas por estado. Las pendientes se cierran
 * solas al derrotar la sombra indicada en `target` (ver `logic/Requests.js`).
 */
export const requestsPanel = {
  label: 'REQUEST',

  render(menu) {
    const pending = menu.requests.filter((request) => request.status === 'pending');
    const completed = menu.requests.filter((request) => request.status === 'completed');

    menu.panelDetail.textContent =
      `${pending.length} pendientes · ${completed.length} completadas.`;

    menu.panelList.appendChild(menu.sectionLabel(`PENDIENTES · ${pending.length}`));
    if (pending.length === 0) {
      menu.panelList.appendChild(menu.makeEmptyLine('Sin peticiones pendientes.'));
    }
    pending.forEach((request) => addRequestRow(menu, request));

    menu.panelList.appendChild(menu.sectionLabel(`COMPLETADAS · ${completed.length}`));
    if (completed.length === 0) {
      menu.panelList.appendChild(menu.makeEmptyLine('Todavía no has completado ninguna.'));
    }
    completed.forEach((request) => addRequestRow(menu, request));
  }
};

/** Una petición es una fila; las completadas se atenúan. */
function addRequestRow(menu, request) {
  const completed = request.status === 'completed';
  const row = menu.makeRow(request.title, {
    value: completed ? 'COMPLETADA' : `¥ ${formatMoney(request.reward)}`,
    completed
  });
  menu.addRow(row, () => {
    menu.panelDetail.textContent = describeRequest(request);
  });
}

/** Detalle de cliente, lugar, objetivo, recompensa y estado. */
function describeRequest(request) {
  const status = request.status === 'completed' ? 'COMPLETADA' : 'PENDIENTE';
  return `${request.client} · ${request.location}. ${request.summary} ` +
    `${request.objective} Recompensa: ¥ ${formatMoney(request.reward)}. [${status}]`;
}
