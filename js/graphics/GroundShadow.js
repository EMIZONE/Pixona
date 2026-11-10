/**
 * Sombra ovalada procedural bajo una entidad: degradado radial negro aplastado
 * y un filo tenue del color de acento para que se lea sobre el suelo.
 */
export class GroundShadow {
  constructor(accent = '#ff0033') {
    this.accent = accent;
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

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, radiusY / radiusX);
    ctx.globalAlpha = opacity;

    // Degradado central: opaco en el centro y transparente en el borde.
    const shade = ctx.createRadialGradient(0, 0, radiusX * 0.08, 0, 0, radiusX);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    shade.addColorStop(0.45, 'rgba(0, 0, 0, 0.8)');
    shade.addColorStop(0.8, 'rgba(0, 0, 0, 0.44)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
    ctx.fill();

    // Filo de acento: muy sutil para no competir con el sprite.
    ctx.globalAlpha = 0.26 * opacity;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radiusX * 0.86, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
