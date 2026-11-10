/**
 * Combatiente (jugador o sombra).
 *
 * Guarda las estadísticas base del JSON, el equipo equipado y las estadísticas
 * efectivas. El combate consulta siempre `atk/def/speed/evasion`; las sombras
 * usan el equipo neutro porque no llevan armas ni accesorios.
 */
const NO_WEAPON = { id: null, name: '', description: '', atkBonus: 0, defBonus: 0, recoil: 0 };
const NO_ARMOR = {
  id: null,
  name: '',
  description: '',
  defBonus: 0,
  speedBonus: 0,
  evasionBonus: 0
};
const NO_ACCESSORY = { id: null, name: '', description: '', evasionBonus: 0, speedBonus: 0 };

export class Fighter {
  /**
   * @param {object} data definición del JSON (personaje o sombra)
   * @param {{ items: object, weapons: object[], equipment: object }} catalogs
   */
  constructor(data, { items, weapons, equipment }) {
    this.id = data.id;
    this.name = data.name;

    this.maxHp = data.maxHp;
    this.currentHp = this.maxHp;
    this.maxSp = data.maxSp;
    this.currentSp = this.maxSp;

    this.baseAtk = data.atk;
    this.baseDef = data.def;
    this.baseSpeed = data.speed;
    this.baseEvasion = data.evasion;
    this.blockReduce = data.blockReduce;

    this.items = { ...data.items };
    this.itemCatalog = items;

    // El equipo se resuelve por id contra los catálogos. Las sombras no traen
    // ids de equipo, así que reciben las piezas neutras.
    this.weapon = weapons.find((weapon) => weapon.id === data.weapon) ?? NO_WEAPON;
    this.armor = equipment.armor.find((armor) => armor.id === data.armor) ?? NO_ARMOR;
    this.accessory = equipment.accessories.find((piece) => piece.id === data.accessory) ?? NO_ACCESSORY;

    // Estados temporales de un turno.
    this.isBlocking = false;
    this.isDodging = false;

    this.recalculateStats();
  }

  isAlive() {
    return this.currentHp > 0;
  }

  /** Limpia bloqueo/esquiva al empezar un turno nuevo. */
  resetTurnStates() {
    this.isBlocking = false;
    this.isDodging = false;
  }

  // --- Equipo ---------------------------------------------------------

  /** Cambiar de arma solo afecta a las estadísticas, nunca al sprite. */
  equipWeapon(weapon) {
    this.weapon = weapon;
    this.recalculateStats();
  }

  equipArmor(armor) {
    this.armor = armor;
    this.recalculateStats();
  }

  equipAccessory(accessory) {
    this.accessory = accessory;
    this.recalculateStats();
  }

  /** Recompone las estadísticas desde las base para no acumular bonificaciones. */
  recalculateStats() {
    this.atk = this.baseAtk + this.weapon.atkBonus;
    this.def = this.baseDef + this.weapon.defBonus + this.armor.defBonus;
    this.speed = this.baseSpeed + this.accessory.speedBonus + this.armor.speedBonus;
    this.evasion = this.baseEvasion + this.accessory.evasionBonus + this.armor.evasionBonus;
  }

  // --- Recursos -------------------------------------------------------

  /**
   * Paga un coste de SP. Devuelve `false` sin tocarlos si no alcanza; el motor
   * usa ese valor para rechazar la acción sin consumir el turno.
   */
  consumeSp(cost) {
    if (this.currentSp < cost) return false;
    this.currentSp -= cost;
    return true;
  }

  /**
   * Gasta una unidad del objeto y aplica su efecto.
   * Devuelve la definición usada, o `null` si no quedan cargas.
   */
  useItem(itemId) {
    const count = this.items[itemId] ?? 0;
    if (count <= 0) return null;

    const definition = this.itemCatalog[itemId];
    this.items[itemId] = count - 1;
    if (definition.heal) {
      this.currentHp = Math.min(this.maxHp, this.currentHp + definition.heal);
    }
    if (definition.sp) {
      this.currentSp = Math.min(this.maxSp, this.currentSp + definition.sp);
    }
    return definition;
  }

  // --- Combate --------------------------------------------------------

  /**
   * Resuelve un golpe entrante: primero evasión, luego daño menos defensa y
   * después bloqueo. El HP nunca baja de 0.
   * Devuelve `{ evaded, damage, blocked }` para el registro de combate.
   */
  receiveAttack(incomingAtk) {
    const evasion = this.isDodging ? this.evasion + 0.5 : this.evasion;
    if (Math.random() < evasion) {
      return { evaded: true, damage: 0, blocked: false };
    }

    const blocked = this.isBlocking;
    let damage = Math.max(1, incomingAtk - this.def);
    if (blocked) {
      damage = Math.max(1, Math.floor(damage * (1 - this.blockReduce)));
    }

    this.currentHp = Math.max(0, this.currentHp - damage);
    return { evaded: false, damage, blocked };
  }

  /** Daño directo sin evasión, defensa ni bloqueo: retroceso de un arma. */
  takeRecoil(amount) {
    this.currentHp = Math.max(0, this.currentHp - amount);
  }
}
