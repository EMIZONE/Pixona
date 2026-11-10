/**
 * Carga de contenido del arranque: los JSON de `data/` y las imágenes de
 * `assets/`. Centraliza las dos operaciones asíncronas que usa `main.js`.
 */
export class DataLoader {
  /**
   * Descarga un JSON y da un error legible si el servidor responde mal; así
   * `Promise.all` corta el arranque con un mensaje claro.
   */
  static async loadJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url} (HTTP ${response.status})`);
    }
    return response.json();
  }

  /** Envuelve la carga de una imagen en una promesa para cargarla en paralelo. */
  static loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      image.src = url;
    });
  }
}
