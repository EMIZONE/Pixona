/**
 * Animador de spritesheets en pixel art.
 *
 * `data/animations.json` define el tamaño de frame, el punto de anclaje y los
 * frames de cada animación; el ancho de la imagen da las columnas de la rejilla.
 * `playOnce` reproduce una animación sin bucle y vuelve a `idle` al terminar.
 *
 * El contorno de dos colores se genera en un canvas aparte a partir del alfa y
 * se dibuja desplazado antes del sprite, así sigue al tema de la interfaz.
 */

/** Ancho máximo del contorno en unidades del escenario (≈1 px de un frame de 160). */
const MAX_OUTLINE_WIDTH = 3.3;

export class SpriteAnimator {
  constructor(image, metadata) {
    this.image = image;
    this.meta = metadata;
    this.columns = Math.floor(image.width / metadata.frameWidth);
    // Punto del frame (en píxeles de la rejilla) que cae sobre el ancla del
    // escenario. El héroe no está centrado en su frame: la espada ocupa el lado
    // derecho, así que sus pies son el ancla.
    this.anchorX = metadata.anchorX;
    this.anchorY = metadata.anchorY;

    this.currentAnim = 'idle';
    this.frameIndex = 0;
    this.elapsedTime = 0;
    this.loop = true;
    this.finished = false;
    this.revertTimer = null;
    // Impulso hacia delante al atacar: 1 derecha, -1 izquierda, 0 sin impulso.
    this.lungeDirection = 0;

    // Contorno opcional `{ light, accent }`, cacheado por frame + color.
    this.outline = null;
    this.outlineCache = new Map();
  }

  /**
   * Cambia de animación sin reiniciarla si ya está activa. Con `loop = false`
   * se queda en el último frame (`defeat`).
   */
  setAnimation(name, loop = true) {
    if (!this.meta.animations[name]) return;
    if (this.currentAnim === name && this.loop === loop && !this.finished) return;

    clearTimeout(this.revertTimer);
    this.currentAnim = name;
    this.loop = loop;
    this.finished = false;
    this.frameIndex = 0;
    this.elapsedTime = 0;
  }

  /** Reproduce una animación sin bucle y vuelve a `idle` pasado `duration` ms. */
  playOnce(name, duration) {
    clearTimeout(this.revertTimer);
    this.setAnimation(name, false);
    this.revertTimer = setTimeout(() => this.setAnimation('idle'), duration);
  }

  /** Dirección del impulso durante `attack`. */
  setLungeDirection(direction) {
    this.lungeDirection = direction;
  }

  /** Máximo avance en los frames centrales del ataque; vuelve a 0 al final. */
  attackLunge(height) {
    if (this.currentAnim !== 'attack' || !this.lungeDirection) return 0;
    const frames = this.meta.animations.attack.frames.length;
    const progress = frames > 1 ? this.frameIndex / (frames - 1) : 0;
    return Math.sin(progress * Math.PI) * height * 0.14 * this.lungeDirection;
  }

  /**
   * Define los dos colores del contorno: `light` arriba-izquierda y `accent`
   * abajo-derecha. `null` lo desactiva.
   */
  setOutlineColors(colors) {
    if (!colors) {
      this.outline = null;
      this.outlineCache.clear();
      return;
    }

    if (this.outline &&
        this.outline.light === colors.light &&
        this.outline.accent === colors.accent) {
      return;
    }

    this.outline = { light: colors.light, accent: colors.accent };
    this.outlineCache.clear();
  }

  /** Avanza la animación; el `while` cubre un frame lento que salta varios. */
  update(deltaTime) {
    if (this.finished) return;

    const animation = this.meta.animations[this.currentAnim];
    const frameDuration = 1000 / animation.fps;
    this.elapsedTime += deltaTime;

    while (this.elapsedTime >= frameDuration) {
      this.elapsedTime -= frameDuration;

      if (this.frameIndex < animation.frames.length - 1) {
        this.frameIndex++;
      } else if (this.loop) {
        this.frameIndex = 0;
      } else {
        this.finished = true;
        break;
      }
    }
  }

  /** Frame actual: id global y esquina superior izquierda dentro del sheet. */
  frameRect() {
    const frameId = this.meta.animations[this.currentAnim].frames[this.frameIndex];
    return {
      frameId,
      sourceX: (frameId % this.columns) * this.meta.frameWidth,
      sourceY: Math.floor(frameId / this.columns) * this.meta.frameHeight
    };
  }

  /**
   * Dibuja el frame actual con su ancla (pies) sobre (`centerX`, `bottomY`) y
   * escalado a `height`. El contorno se pinta antes, desplazado 1 píxel.
   */
  drawCentered(ctx, centerX, bottomY, height) {
    const scale = height / this.meta.frameHeight;
    const width = this.meta.frameWidth * scale;
    const x = centerX - this.anchorX * scale + this.attackLunge(height);
    const y = bottomY - this.anchorY * scale;

    if (this.outline) this.drawOutline(ctx, x, y, width, height, scale);

    const frame = this.frameRect();
    ctx.drawImage(
      this.image,
      frame.sourceX, frame.sourceY, this.meta.frameWidth, this.meta.frameHeight,
      x, y, width, height
    );
  }

  /** Dos siluetas del color del contorno, una por esquina. */
  drawOutline(ctx, x, y, width, height, scale) {
    const frame = this.frameRect();
    const offset = Math.min(scale, MAX_OUTLINE_WIDTH);
    ctx.drawImage(this.getOutlineFrame(frame, this.outline.light), x - offset, y - offset, width, height);
    ctx.drawImage(this.getOutlineFrame(frame, this.outline.accent), x + offset, y + offset, width, height);
  }

  /**
   * Máscara del frame pintada de un color sólido. Se genera una vez por
   * frame + color y se guarda en caché.
   */
  getOutlineFrame(frame, color) {
    const key = `${frame.frameId}:${color}`;
    const cached = this.outlineCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = this.meta.frameWidth;
    canvas.height = this.meta.frameHeight;

    const outlineCtx = canvas.getContext('2d');
    outlineCtx.imageSmoothingEnabled = false;
    outlineCtx.drawImage(
      this.image,
      frame.sourceX, frame.sourceY, this.meta.frameWidth, this.meta.frameHeight,
      0, 0, this.meta.frameWidth, this.meta.frameHeight
    );
    // `source-in` conserva el alfa del frame y reemplaza su color.
    outlineCtx.globalCompositeOperation = 'source-in';
    outlineCtx.fillStyle = color;
    outlineCtx.fillRect(0, 0, this.meta.frameWidth, this.meta.frameHeight);

    this.outlineCache.set(key, canvas);
    return canvas;
  }
}
