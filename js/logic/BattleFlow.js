import { BattleEngine } from './BattleEngine.js';
import { Fighter } from './Fighter.js';

/**
 * Orquestador de la tanda de cinco combates.
 *
 * Crea el motor, cambia de sombra, restaura HP/SP, acumula EXP/dinero/botín y
 * decide entre la siguiente transición y la pantalla de resultados. No dibuja
 * nada: eso vive en `EncounterTransition` y `ResultScreen`.
 */
export class BattleFlow {
  constructor({ player, enemies, ui, animators, transition, result, catalogs }) {
    this.player = player;
    this.enemies = enemies;
    this.ui = ui;
    this.transition = transition;
    this.result = result;
    this.catalogs = catalogs;

    this.index = 0;
    this.encounter = enemies[0];
    this.rewards = { xp: 0, money: 0, loot: {} };
    this.defeated = [];

    this.engine = new BattleEngine(player, ui, animators, {
      onVictory: () => this.handleVictory(),
      onDefeat: () => this.handleDefeat()
    });
  }

  /** Fighter en combate ahora mismo (lo usa el bucle de render). */
  get enemy() {
    return this.engine.enemy;
  }

  createEnemy(data) {
    return new Fighter(data, this.catalogs);
  }

  /** Arranca la tanda desde la primera sombra. */
  start() {
    this.ui.clearLog();
    this.engine.enter(this.createEnemy(this.encounter));
    this.engine.start();
  }

  /**
   * Suma recompensas y decide: siguiente sombra con transición o resumen final.
   */
  async handleVictory() {
    this.collect(this.encounter);
    this.defeated.push(this.encounter);

    if (this.index === this.enemies.length - 1) {
      this.result.show({
        victory: true,
        defeated: this.defeated,
        total: this.enemies.length,
        rewards: this.rewards
      });
      return;
    }

    const nextIndex = this.index + 1;
    await this.transition.play({
      index: nextIndex + 1,
      total: this.enemies.length,
      enemy: this.enemies[nextIndex],
      // En negro, sin que el jugador vea el corte.
      onCovered: () => this.advance(nextIndex)
    });

    this.engine.start();
  }

  /** Prepara el siguiente combate mientras la pantalla está en negro. */
  advance(nextIndex) {
    this.index = nextIndex;
    this.encounter = this.enemies[nextIndex];

    this.player.currentHp = this.player.maxHp;
    this.player.currentSp = this.player.maxSp;
    this.player.resetTurnStates();

    this.ui.clearLog();
    this.engine.enter(this.createEnemy(this.encounter));
    this.ui.logAction('HP y SP restaurados.', 'accent');
  }

  /**
   * Suma EXP/dinero y añade el botín al inventario. Si el objeto activo acaba
   * de recibir cargas, refresca la etiqueta del botón OBJETO.
   */
  collect(enemy) {
    this.rewards.xp += enemy.xp;
    this.rewards.money += enemy.money;

    if (!enemy.drop) return;

    const { item, count } = enemy.drop;
    this.rewards.loot[item] = (this.rewards.loot[item] ?? 0) + count;
    this.player.items[item] = (this.player.items[item] ?? 0) + count;
    if (this.engine.activeItemId) this.engine.setActiveItem(this.engine.activeItemId);
  }

  /** Si el jugador cae, la misma pantalla muestra la derrota parcial. */
  handleDefeat() {
    this.result.show({
      victory: false,
      defeated: this.defeated,
      total: this.enemies.length,
      rewards: this.rewards,
      fallenAt: this.encounter
    });
  }
}
