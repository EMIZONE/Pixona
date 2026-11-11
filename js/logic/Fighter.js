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
/** Cada golpe varía entre -4 y +4 puntos de daño. */
const DAMAGE_VARIANCE = 4;

export class Fighter {
  /**
   * @param {object} data definición del JSON (personaje o sombra)
   * @param {{ items: object, weapons: object[], equipment: object }} catalogs
   * @param {() => number} rng fuente de azar; las pruebas pasan una fija
   */
  constructor(data, { items, weapons, equipment }, rng = Math.random) {
    this.id = data.id;
    this.name = data.name;
    this.rng = rng;

    this.maxHp = data.maxHp;
    this.currentHp = this.maxHp;
    this.maxSp = data.maxSp;
    this.currentSp = this.maxSp;

    this.baseAtk = data.atk;
    this.baseDef = data.def;
    this.baseSpeed = data.speed;
    this.baseEvasion = data.evasion;
    this.blockReduce = data.blockReduce;

    // Habilidad de las sombras (el jugador ataca con el menú, no con esto).
    this.skillChance = data.skillChance;
    this.skillPower = data.skillPower;

    // Cartera y experiencia del jugador; las sombras traen 0 en el JSON.
    this.money = data.money;
    this.xp = data.xp;

    this.items = { ...data.items };
    this.itemCatalog = items;

    // El equipo se resuelve por id contra los catálogos. Las sombras no traen
    // ids de equipo, así que reciben las piezas neutras.
    const pick = (list, id) => list.find((piece) => piece.id === id);
    this.weapon = pick(weapons, data.weapon) ?? NO_WEAPON;
    this.armor = pick(equipment.armor, data.armor) ?? NO_ARMOR;
    this.accessory = pick(equipment.accessories, data.accessory) ?? NO_ACCESSORY;

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

  /**
   * Cambia una pieza equipada y recalcula las estadísticas. Cambiar de arma
   * solo afecta a los números, nunca al sprite.
   * @param {'weapon' | 'armor' | 'accessory'} slot
   */
  equip(slot, piece) {
    this[slot] = piece;
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
    if (this.rng() < evasion) {
      return { evaded: true, damage: 0, blocked: false };
    }

    const blocked = this.isBlocking;
    // Variación por golpe: -4 a +4 puntos antes del bloqueo. El redondeo deja
    // enteros también con ataques fraccionarios (Habilidad usa atk * 1.5).
    const variance = Math.floor(this.rng() * (DAMAGE_VARIANCE * 2 + 1)) - DAMAGE_VARIANCE;
    let damage = Math.max(1, Math.round(incomingAtk - this.def + variance));
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
