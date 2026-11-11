/**
 * Sombra ovalada procedural bajo una entidad: degradado radial negro aplastado
 * y un filo tenue del color de acento para que se lea sobre el suelo.
 *
 * El degradado se pinta una vez en un canvas pequeño y se estira en cada frame;
 * el filo se traza aparte para que conserve su grosor en unidades de escenario.
 */
const TEXTURE_SIZE = 128;
const TAU = Math.PI * 2;

export class GroundShadow {
  constructor(accent = '#ff0033') {
    this.accent = accent;
    this.texture = null;
  }

  /** El tema de SISTEMA cambia el color del filo. */
  setAccent(accent) {
    this.accent = accent;
  }

  /**
   * Dibuja la sombra centrada en `(x, y)`. `radiusX` es el ancho y `radiusY` el
   * alto del óvalo; `opacity` permite desvanecerla cuando cae la sombra.
   */
  draw(ctx, x, y, radiusX, radiusY, opacity = 1) {
    if (opacity <= 0) return;

    this.texture ??= buildTexture();

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(this.texture, x - radiusX, y - radiusY, radiusX * 2, radiusY * 2);

    // Filo de acento: muy sutil para no competir con el sprite.
    ctx.globalAlpha = 0.26 * opacity;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX * 0.86, radiusY * 0.86, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/** Degradado central: opaco en el centro y transparente en el borde. */
function buildTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const ctx = canvas.getContext('2d');
  const radius = TEXTURE_SIZE / 2;
  const shade = ctx.createRadialGradient(radius, radius, radius * 0.08, radius, radius, radius);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
  shade.addColorStop(0.45, 'rgba(0, 0, 0, 0.8)');
  shade.addColorStop(0.8, 'rgba(0, 0, 0, 0.44)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, TAU);
  ctx.fill();
  return canvas;
}
