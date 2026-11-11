/**
 * Peticiones secundarias.
 *
 * `data/requests.json` marca con `target` la sombra que completa cada encargo.
 * La lista es la misma que muestra el menú: al cambiar `status` el panel se
 * repinta con el estado nuevo.
 */
export class Requests {
  constructor(list) {
    this.list = list;
  }

  /** Marca como completadas las peticiones cuyo objetivo acaba de caer. */
  completeFor(enemyId) {
    const done = this.list.filter(
      (request) => request.status === 'pending' && request.target === enemyId
    );
    done.forEach((request) => {
      request.status = 'completed';
    });
    return done;
  }
}
