/**
 * Motor de un combate individual.
 *
 *   INIT → PLAYER_TURN → RESOLVING → ENEMY_TURN → … → VICTORY / DEFEAT
 *
 * `RESOLVING` es el momento en que la acción elegida se está animando y el
 * jugador ya no puede volver a actuar. El cambio al siguiente turno espera a
 * que termine el ataque. Solo conoce las reglas de un enfrentamiento;
 * `BattleFlow` encadena las cinco sombras y reacciona a los callbacks.
 */
export const BATTLE_STATE = {
  INIT: 'INIT',
  PLAYER_TURN: 'PLAYER_TURN',
  RESOLVING: 'RESOLVING',
  ENEMY_TURN: 'ENEMY_TURN',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT'
};

const SKILL_COST = 15;
const DODGE_COST = 5;
const SKILL_POWER = 1.5;
/** Anticipación antes de aplicar el daño: la animación ya está corriendo. */
const ATTACK_WINDUP = 250;
/** Recuperación tras el impacto antes de cerrar el turno. */
const ATTACK_RECOVERY = 350;
/** Pausa visible antes de pasar el turno al otro bando. */
const TURN_PAUSE = 250;
const REACTION_TIME = 400;
const ENEMY_THINK_TIME = 850;
const ENEMY_ATTACK_CHANCE = 0.7;
const VICTORY_DELAY = 1500;
const DEFEAT_DELAY = 1000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class BattleEngine {
  constructor(player, uiController, animators, { onVictory, onDefeat }) {
    this.player = player;
    this.enemy = null;
    this.ui = uiController;
    this.animators = animators;
    this.onVictory = onVictory;
    this.onDefeat = onDefeat;

    this.outcomeTimer = null;
    this.activeItemId = null;
    this.state = BATTLE_STATE.INIT;
  }

  /**
   * Monta un enemigo y sincroniza el HUD, sin empezar el turno. Se llama al
   * arrancar la tanda y otra vez, en negro, al pasar a la siguiente sombra.
   */
  enter(enemy) {
    clearTimeout(this.outcomeTimer);
    this.enemy = enemy;
    this.state = BATTLE_STATE.INIT;
    this.ui.setEnemyName(enemy.name);
    this.ui.updateStatusBars(this.player, enemy);
    this.animators.player.setAnimation('idle');
    this.animators.enemy.setAnimation('idle');
    this.ensureActiveItem();
  }

  /** Da el turno al jugador tras el mensaje de encuentro. */
  start() {
    this.ui.logAction(`${this.enemy.name} te cierra el paso. Elige una acción.`);
    this.setState(BATTLE_STATE.PLAYER_TURN);
  }

  /** Si el objeto activo se agotó, pasa al siguiente que quede. */
  ensureActiveItem() {
    if (this.activeItemId && this.player.items[this.activeItemId] > 0) return;
    const next = Object.keys(this.player.items).find((id) => this.player.items[id] > 0);
    if (next) this.setActiveItem(next);
  }

  /** Objeto que usará el comando OBJETO (se elige en el menú principal). */
  setActiveItem(itemId) {
    this.activeItemId = itemId;
    const definition = this.player.itemCatalog[itemId];
    this.ui.setItemLabel(definition.name, this.player.items[itemId]);
  }

  /** Punto único de transición de estados. */
  setState(newState) {
    this.state = newState;

    switch (newState) {
      case BATTLE_STATE.PLAYER_TURN:
        this.ui.showTurn('player');
        this.ui.enableMenu(true);
        break;

      case BATTLE_STATE.RESOLVING:
        this.ui.enableMenu(false);
        break;

      case BATTLE_STATE.ENEMY_TURN:
        this.ui.showTurn('enemy');
        this.ui.enableMenu(false);
        this.processEnemyTurn();
        break;

      case BATTLE_STATE.VICTORY:
        this.endBattle(true);
        break;

      case BATTLE_STATE.DEFEAT:
        this.endBattle(false);
        break;
    }
  }

  /**
   * Cierra el combate: registro, animación final y aviso a `BattleFlow` con el
   * retardo justo para que se vea la reacción.
   */
  endBattle(victory) {
    this.ui.showTurn('over');
    this.ui.enableMenu(false);
    this.ui.logAction(victory ? '¡VICTORIA!' : 'DERROTA.', 'accent');
    this.animators.player.setAnimation('idle');
    // La sombra derrotada se queda en el último frame; en derrota vuelve a idle.
    this.animators.enemy.setAnimation(victory ? 'defeat' : 'idle', !victory);
    this.outcomeTimer = setTimeout(
      () => (victory ? this.onVictory() : this.onDefeat()),
      victory ? VICTORY_DELAY : DEFEAT_DELAY
    );
  }

  /**
   * Entrada única de las acciones del jugador.
   *
   * Pasa a `RESOLVING` mientras se reproduce la acción: así no se puede pulsar
   * dos veces ni abrir el menú, y el turno no cambia hasta que la animación
   * termina. Si la acción se rechaza (sin SP, sin objetos…), se devuelve el
   * turno sin gastarlo.
   */
  async executePlayerAction(actionType) {
    if (this.state !== BATTLE_STATE.PLAYER_TURN) return;

    this.player.resetTurnStates();
    this.setState(BATTLE_STATE.RESOLVING);

    const accepted = await this.resolvePlayerAction(actionType);
    if (!accepted) {
      this.state = BATTLE_STATE.PLAYER_TURN;
      this.ui.enableMenu(true);
      return;
    }

    this.ui.updateStatusBars(this.player, this.enemy);
    if (this.checkEndConditions()) return;

    // Deja respirar el último frame antes de anunciar el turno del enemigo.
    await wait(TURN_PAUSE);
    if (this.state !== BATTLE_STATE.RESOLVING) return;
    this.setState(BATTLE_STATE.ENEMY_TURN);
  }

  /** Traduce el `data-action` del menú a una regla de combate. */
  async resolvePlayerAction(actionType) {
    switch (actionType) {
      case 'ATTACK':
        await this.dealDamage('player', this.enemy, this.player.atk, 'ataca');
        return true;

      case 'SKILL':
        if (!this.player.consumeSp(SKILL_COST)) return this.reject('SP insuficiente.');
        await this.dealDamage(
          'player',
          this.enemy,
          this.player.atk * SKILL_POWER,
          `usa Habilidad (${SKILL_COST} SP)`
        );
        return true;

      case 'BLOCK':
        this.player.isBlocking = true;
        this.ui.logAction(`${this.player.name} adopta postura de bloqueo.`);
        return true;

      case 'DODGE':
        if (!this.player.consumeSp(DODGE_COST)) {
          return this.reject('SP insuficiente para esquivar.');
        }
        this.player.isDodging = true;
        this.ui.logAction(`${this.player.name} se prepara para esquivar.`);
        return true;

      case 'ITEM':
        return this.useActiveItem();

      default:
        return false;
    }
  }

  /**
   * Golpe genérico: arranca la animación, espera el impulso, aplica el daño en
   * el pico del ataque, muestra el feedback y deja una recuperación antes de
   * devolver el control.
   */
  async dealDamage(attacker, target, atk, verb) {
    const victimSide = attacker === 'player' ? 'enemy' : 'player';
    this.animators[attacker].playOnce('attack', ATTACK_WINDUP + ATTACK_RECOVERY);

    await wait(ATTACK_WINDUP);

    const result = target.receiveAttack(atk);
    if (!result.evaded) {
      this.animators[victimSide].playOnce('hurt', REACTION_TIME);
    }

    this.ui.showHit(victimSide, result);

    const attackerName = attacker === 'player' ? this.player.name : this.enemy.name;
    this.ui.logAction(`${attackerName} ${verb}. ${this.formatResult(result, target.name)}`);

    // Algunas armas cobran el golpe con HP del atacante, acierte o falle.
    const recoil = attacker === 'player' ? this.player.weapon.recoil : 0;
    if (recoil > 0) {
      this.player.takeRecoil(recoil);
      this.ui.showRecoil(recoil);
      this.ui.logAction(`${this.player.name} sufre ${recoil} de daño por el retroceso.`);
    }

    this.ui.updateStatusBars(this.player, this.enemy);
    await wait(ATTACK_RECOVERY);
  }

  /** Usa el objeto activo y actualiza el contador del botón OBJETO. */
  useActiveItem() {
    const item = this.player.itemCatalog[this.activeItemId];
    if (!item) return this.reject('No tienes objetos equipados.');

    const used = this.player.useItem(this.activeItemId);
    if (!used) return this.reject(`No te quedan ${item.name.toLowerCase()}.`);

    const effect = used.heal ? `+${used.heal} HP` : `+${used.sp} SP`;
    this.ui.logAction(
      `${this.player.name} usó ${used.name} (${effect}). Quedan ${this.player.items[this.activeItemId]}.`
    );
    this.ui.setItemLabel(used.name, this.player.items[this.activeItemId]);
    return true;
  }

  /** Rechazo con mensaje: no consume el turno. */
  reject(message) {
    this.ui.logAction(message);
    return false;
  }

  /**
   * Turno de la sombra: espera para que se lea el registro, ataca (70 %) o
   * bloquea (30 %) y solo entonces devuelve el turno al jugador.
   */
  async processEnemyTurn() {
    this.enemy.resetTurnStates();
    await wait(ENEMY_THINK_TIME);
    if (this.state !== BATTLE_STATE.ENEMY_TURN) return;

    if (Math.random() < ENEMY_ATTACK_CHANCE) {
      await this.dealDamage('enemy', this.player, this.enemy.atk, 'ataca');
    } else {
      this.enemy.isBlocking = true;
      this.ui.logAction(`${this.enemy.name} se bloquea.`);
    }

    this.ui.updateStatusBars(this.player, this.enemy);
    if (this.checkEndConditions()) return;

    await wait(TURN_PAUSE);
    if (this.state !== BATTLE_STATE.ENEMY_TURN) return;
    this.setState(BATTLE_STATE.PLAYER_TURN);
  }

  /** Texto del resultado de un golpe para el registro. */
  formatResult(result, targetName) {
    if (result.evaded) return `${targetName} esquivó el ataque.`;
    if (result.blocked) return `${targetName} bloqueó y recibió ${result.damage} de daño.`;
    return `${targetName} recibió ${result.damage} de daño.`;
  }

  /** Comprueba si alguien llegó a 0 HP; `true` si el combate terminó. */
  checkEndConditions() {
    if (!this.enemy.isAlive()) {
      this.setState(BATTLE_STATE.VICTORY);
      return true;
    }
    if (!this.player.isAlive()) {
      this.setState(BATTLE_STATE.DEFEAT);
      return true;
    }
    return false;
  }
}
