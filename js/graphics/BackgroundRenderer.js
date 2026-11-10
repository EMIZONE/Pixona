/**
 * Fondo de combate y transformación del escenario.
 *
 * Todo se dibuja sobre un lienzo virtual de 1920x1080 que este módulo escala
 * con `cover` y ancla abajo. `screenX` / `screenY` convierten coordenadas del
 * escenario a píxeles reales para colocar el HUD.
 */

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export class BackgroundRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = null;
    this.stageScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /** El fondo se carga en `main.js` y se inyecta después. */
  setImage(image) {
    this.image = image;
  }

  /**
   * Ajusta el canvas a la ventana. `Math.max` da el comportamiento `cover`:
   * el fondo cubre la pantalla aunque se recorte por los lados, y se ancla
   * abajo para no cortar los pies de los personajes.
   */
  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width;
    this.canvas.height = height;

    this.stageScale = Math.max(width / STAGE_WIDTH, height / STAGE_HEIGHT);
    this.offsetX = (width - STAGE_WIDTH * this.stageScale) / 2;
    this.offsetY = height - STAGE_HEIGHT * this.stageScale;

    this.ctx.imageSmoothingEnabled = false;
  }

  screenX(x) {
    return this.offsetX + x * this.stageScale;
  }

  screenY(y) {
    return this.offsetY + y * this.stageScale;
  }

  /** A partir de aquí se dibuja en coordenadas 1920x1080 hasta `endStage`. */
  beginStage(ctx) {
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.stageScale, this.stageScale);
  }

  endStage(ctx) {
    ctx.restore();
  }

  /** Limpia el canvas y pinta el fondo cubriendo todo el escenario virtual. */
  draw() {
    const { ctx, canvas } = this;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // El fondo puede venir de Photoshop a otra resolución; se suaviza al
    // escalarlo. Los sprites se siguen dibujando en pixel art (smoothing off).
    ctx.imageSmoothingEnabled = true;
    this.beginStage(ctx);
    ctx.drawImage(this.image, 0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    this.endStage(ctx);
    ctx.imageSmoothingEnabled = false;
  }
}
