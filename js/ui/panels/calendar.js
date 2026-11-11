import { createNode } from '../../utils/dom.js';

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Panel CALENDARIO del mes real, con la semana empezando en lunes.
 *
 * `getDay()` devuelve 0 para domingo; `(firstWeekday + 6) % 7` deja lunes en la
 * columna 0. Los días de los meses vecinos rellenan los huecos con `is-outside`.
 */
export const calendarPanel = {
  label: 'CALENDARIO',

  render(menu) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    menu.panelDetail.textContent = 'Días pasados en rojo · hoy en blanco.';

    const grid = createNode('div', 'cal-grid');
    WEEKDAYS.forEach((label) => {
      grid.appendChild(createNode('span', 'cal-dow', label));
    });

    const firstWeekday = new Date(year, month, 1).getDay();
    const leading = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < leading; i++) {
      grid.appendChild(makeDayCell(daysInPrevMonth - leading + i + 1, 'is-outside'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const modifier = day < today ? 'is-past' : day === today ? 'is-today' : '';
      grid.appendChild(makeDayCell(day, modifier));
    }

    const trailing = (7 - ((leading + daysInMonth) % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      grid.appendChild(makeDayCell(i, 'is-outside'));
    }

    menu.panelList.append(createNode('p', 'cal-month', `${MONTHS[month]} ${year}`), grid);
  }
};

function makeDayCell(day, modifier) {
  return createNode('span', modifier ? `cal-day ${modifier}` : 'cal-day', day);
}
