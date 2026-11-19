import { createNode } from '../../utils/dom.js';

/**
 * Panel PERSONA: perfil del personaje y ranuras de equipo.
 *
 * Confirmar una ranura guarda la categoría en `menu.gearCategory`; mientras
 * esté activa, este mismo panel dibuja la lista completa de esa categoría para
 * comparar todas las piezas.
 */
export const personaPanel = {
  label: 'PERSONA',
  tall: true,

  render(menu) {
    if (menu.gearCategory) {
      renderGearList(menu, menu.gearCategory);
      return;
    }
    renderProfile(menu);
  },

  /** Esc/← desde una lista de piezas: vuelve a las ranuras de equipo. */
  back(menu) {
    closeGearCategory(menu);
  }
};

/** Perfil + tres ranuras + descripción de la pieza equipada. */
function renderProfile(menu) {
  const { player, persona } = menu;

  // 1. Descripción del personaje (altura estable: no mueve las ranuras).
  menu.panelDetail.textContent = menu.profileDescription;
  menu.panelList.append(
    createNode('p', 'persona-bio persona-meta', menu.personaLine()),
    createNode('p', 'persona-bio', persona.description)
  );

  // 2. Ranuras de equipo.
  menu.panelList.appendChild(menu.sectionLabel('EQUIPAMIENTO'));

  const itemDetail = createNode(
    'p',
    'persona-bio persona-item-detail',
    describeWeapon(menu, player.weapon)
  );

  const slots = [
    ['ARMA', player.weapon, 'weapon'],
    ['ARMADURA', player.armor, 'armor'],
    ['ACCESORIO', player.accessory, 'accessory']
  ];

  slots.forEach(([label, item, category]) => {
    const config = gearConfig(menu, category);
    const row = menu.makeRow(label, { value: item.name, active: true });
    menu.addRow(
      row,
      () => openGearCategory(menu, category),
      () => {
        itemDetail.textContent =
          `${config.describe(item)} ENTER para ver todas las opciones.`;
      }
    );
  });

  // 3. Descripción del objeto, fuera del flujo que empuja las ranuras.
  menu.panelList.append(menu.sectionLabel('OBJETO'), itemDetail);
}

/** Configuración de una ranura: lista, pieza actual y cómo describir/equipar. */
function gearConfig(menu, category) {
  const { player } = menu;
  const configs = {
    weapon: {
      label: 'ARMA',
      list: menu.weapons,
      current: player.weapon,
      describe: (item) => describeWeapon(menu, item),
      stats: (item) => weaponStats(menu, item),
      equip: (item) => equipWeapon(menu, item)
    },
    armor: {
      label: 'ARMADURA',
      list: menu.equipment.armor,
      current: player.armor,
      describe: (item) => describeArmor(menu, item),
      stats: (item) => armorStats(menu, item),
      equip: (item) => equipArmor(menu, item)
    },
    accessory: {
      label: 'ACCESORIO',
      list: menu.equipment.accessories,
      current: player.accessory,
      describe: (item) => describeAccessory(item),
      stats: (item) => accessoryBonus(item),
      equip: (item) => equipAccessory(menu, item)
    }
  };

  return configs[category];
}

/** Abre el arsenal de una categoría; el foco arranca en la primera pieza. */
function openGearCategory(menu, category) {
  menu.gearCategory = category;
  menu.renderPanel(1);
  menu.zone = 'rows';
  menu.applyRowHighlight();
  menu.previewRow();
}

/** Vuelve de la lista de piezas a las ranuras de PERSONA. */
function closeGearCategory(menu) {
  const slotIndex = { weapon: 0, armor: 1, accessory: 2 }[menu.gearCategory] ?? 0;
  menu.gearCategory = null;
  menu.renderPanel(slotIndex);
  menu.zone = 'rows';
  menu.applyRowHighlight();
  menu.previewRow();
}

/** Lista completa de una categoría, con stats alineados y la pieza activa. */
function renderGearList(menu, category) {
  const config = gearConfig(menu, category);
  menu.panelTitle.textContent = `PERSONA · ${config.label}`;
  menu.panelDetail.textContent =
    `${config.list.length} opciones. Elige la que mejor encaje con tu build.`;

  // La descripción vive debajo de las piezas, así el texto variable no empuja
  // la lista al pasar el ratón.
  const itemDetail = createNode(
    'p',
    'persona-bio persona-item-detail',
    `${config.describe(config.current)} ENTER para equipar.`
  );

  const back = menu.makeRow('← VOLVER A PERSONA', { value: 'ESC' });
  menu.addRow(
    back,
    () => closeGearCategory(menu),
    () => { itemDetail.textContent = 'Vuelve a las ranuras de equipo.'; }
  );

  menu.panelList.appendChild(
    menu.sectionLabel(`${config.label} · ${config.list.length} OPCIONES`)
  );

  config.list.forEach((item) => {
    const row = menu.makeRow(item.name, {
      value: config.stats(item),
      active: item === config.current
    });
    menu.addRow(
      row,
      () => config.equip(item),
      () => { itemDetail.textContent = `${config.describe(item)} ENTER para equipar.`; }
    );
  });

  menu.panelList.append(menu.sectionLabel('DETALLE'), itemDetail);
}

/**
 * Vista previa de un arma. La DEF incluye la armadura actual porque cambiar de
 * arma no la reemplaza; el delta de ATK compara contra el arma equipada.
 */
function weaponTotals(menu, weapon) {
  return {
    atk: menu.player.baseAtk + weapon.atkBonus,
    def: menu.player.baseDef + weapon.defBonus + menu.player.armor.defBonus
  };
}

function describeWeapon(menu, weapon) {
  const { atk, def } = weaponTotals(menu, weapon);
  const delta = atk - menu.player.atk;
  const deltaText = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';
  const recoil = weapon.recoil > 0 ? ` · RETROCESO -${weapon.recoil} HP` : '';
  return `${weapon.description} ATK ${atk}${deltaText} · DEF ${def}${recoil}`;
}

/** Stats de un arma con el resto del equipo actual, para comparar de un vistazo. */
function weaponStats(menu, weapon) {
  const { atk, def } = weaponTotals(menu, weapon);
  const recoil = weapon.recoil > 0 ? ` · RETRO -${weapon.recoil}` : '';
  return `ATK ${atk} · DEF ${def}${recoil}`;
}

/** Sufijos VEL/EVA compartidos por la lista y el detalle de una armadura. */
function armorBonus(armor) {
  const speed = armor.speedBonus ? ` · VEL ${signed(armor.speedBonus)}` : '';
  const evasion = armor.evasionBonus
    ? ` · EVA ${signed(Math.round(armor.evasionBonus * 100))}%`
    : '';
  return `${speed}${evasion}`;
}

function armorStats(menu, armor) {
  const defense = menu.player.baseDef + menu.player.weapon.defBonus + armor.defBonus;
  return `DEF ${defense}${armorBonus(armor)}`;
}

/** EVA/VEL de un accesorio; lo usan la lista y el detalle. */
function accessoryBonus(accessory) {
  const evasion = Math.round(accessory.evasionBonus * 100);
  return `EVA ${signed(evasion)}% · VEL ${signed(accessory.speedBonus)}`;
}

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function describeArmor(menu, armor) {
  return `${armor.name}: ${armor.description} DEF +${armor.defBonus}${armorBonus(armor)}.`;
}

function describeAccessory(accessory) {
  return `${accessory.name}: ${accessory.description} ${accessoryBonus(accessory)}.`;
}

function equipWeapon(menu, weapon) {
  menu.onEquipWeapon(weapon);
  menu.refreshPanel(`${weapon.name} equipada. ${describeWeapon(menu, weapon)}`);
}

function equipArmor(menu, armor) {
  menu.onEquipArmor(armor);
  menu.refreshPanel(`Armadura: ${armor.name}. DEF ${menu.player.def}.`);
}

function equipAccessory(menu, accessory) {
  menu.onEquipAccessory(accessory);
  menu.refreshPanel(describeAccessory(accessory));
}
