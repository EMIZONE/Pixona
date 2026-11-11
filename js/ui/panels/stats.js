import { createNode } from '../../utils/dom.js';

/** Atributos de PIXONA y su etiqueta visible. */
const STAT_LABELS = [
  ['strength', 'FUERZA'],
  ['magic', 'MAGIA'],
  ['endurance', 'RESISTENCIA'],
  ['agility', 'AGILIDAD'],
  ['luck', 'SUERTE']
];

/**
 * Panel STATS: atributos del Persona sobre 99 y derivados reales del
 * `Fighter` (HP/SP/ATK/DEF/EVA/VEL), más el equipo completo.
 */
export const statsPanel = {
  label: 'STATS',

  render(menu) {
    menu.panelDetail.textContent = menu.personaLine();

    const grid = createNode('div', 'stat-grid');
    STAT_LABELS.forEach(([key, label]) => {
      const value = menu.persona.stats[key];
      const bar = createNode('span', 'stat-bar');
      const fill = createNode('span', 'stat-bar-fill');
      fill.style.width = `${(value / 99) * 100}%`;
      bar.appendChild(fill);

      const row = createNode('div', 'stat-row');
      row.append(createNode('span', 'stat-name', label), createNode('span', 'stat-num', value), bar);
      grid.appendChild(row);
    });
    menu.panelList.appendChild(grid);

    const player = menu.player;
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
    menu.panelList.append(
      createNode('p', 'stat-derived', derived.join(' · ')),
      createNode('p', 'stat-derived stat-gear', gear.join(' · '))
    );
  }
};
