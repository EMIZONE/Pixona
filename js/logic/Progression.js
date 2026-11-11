/**
 * Curva de experiencia del jugador.
 *
 * `data/progression.json` guarda solo los umbrales: `xpCurve[0]` es la EXP que
 * hace falta para llegar al nivel 2. El nivel empieza en 1 y sube un escalón
 * por cada umbral alcanzado.
 */
export class Progression {
  constructor({ xpCurve }) {
    this.xpCurve = xpCurve;
  }

  levelFor(xp) {
    return this.xpCurve.filter((threshold) => xp >= threshold).length + 1;
  }

  /** EXP que falta para el siguiente nivel, o 0 al llegar al techo de la curva. */
  remainingFor(xp) {
    return this.xpCurve.find((threshold) => xp < threshold) ?? 0;
  }
}
