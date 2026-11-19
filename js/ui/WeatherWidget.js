/**
 * Tarjeta de clima de la esquina superior izquierda.
 *
 * Consulta Open-Meteo al arrancar y cada `refreshMinutes` (data/weather.json),
 * y se reintenta al minuto si la red falla. La tarjeta no bloquea el juego: si
 * no hay conexión, el combate sigue y el aviso se muestra en la propia tarjeta.
 */
import { WeatherService } from '../services/WeatherService.js';

const RETRY_MS = 60_000;
/** Evita repetir la consulta cuando la pestaña solo pierde el foco un momento. */
const VISIBILITY_GUARD_MS = 60_000;

/** Códigos WMO que devuelve Open-Meteo, traducidos para la interfaz. */
const WEATHER_LABELS = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna',
  55: 'Llovizna fuerte',
  56: 'Llovizna helada',
  57: 'Llovizna helada fuerte',
  61: 'Lluvia ligera',
  63: 'Lluvia',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada',
  67: 'Lluvia helada fuerte',
  71: 'Nieve ligera',
  73: 'Nieve',
  75: 'Nieve fuerte',
  77: 'Granos de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos',
  82: 'Chubascos fuertes',
  85: 'Chubascos de nieve',
  86: 'Chubascos de nieve fuertes',
  95: 'Tormenta',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo fuerte'
};

/** Texto en español para un código WMO; los códigos nuevos caen en un genérico. */
export function weatherLabel(code) {
  return WEATHER_LABELS[code] ?? 'Clima variable';
}

export class WeatherWidget {
  constructor(config) {
    this.config = config;
    this.root = document.getElementById('weather-widget');
    this.placeEl = document.getElementById('weather-place');
    this.tempEl = document.getElementById('weather-temp');
    this.conditionEl = document.getElementById('weather-condition');
    this.metaEl = document.getElementById('weather-meta');

    this.placeEl.textContent = config.city;
    this.timer = 0;
    this.loading = false;
    this.lastFetch = 0;
    this.hasReading = false;
  }

  start() {
    this.refresh();

    // Al volver a la pestaña, refresca si el dato ya puede estar viejo.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastFetch < VISIBILITY_GUARD_MS) return;
      this.refresh();
    });

    window.addEventListener('online', () => this.refresh());
  }

  async refresh() {
    if (this.loading) return;

    clearTimeout(this.timer);
    this.loading = true;
    this.lastFetch = Date.now();

    try {
      const current = await WeatherService.getCurrent(this.config);
      this.renderCurrent(current);
      this.schedule(this.config.refreshMinutes * 60_000);
    } catch {
      this.renderError();
      this.schedule(RETRY_MS);
    } finally {
      this.loading = false;
    }
  }

  schedule(delay) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), delay);
  }

  renderCurrent(current) {
    const temperature = Math.round(current.temperature_2m);
    const wind = Math.round(current.wind_speed_10m);
    const humidity = Math.round(current.relative_humidity_2m);
    const label = weatherLabel(current.weather_code);

    this.hasReading = true;
    this.root.classList.remove('is-error');
    this.tempEl.textContent = `${temperature}°`;
    this.conditionEl.textContent = label;
    this.metaEl.textContent = `VIENTO ${wind} KM/H · HUMEDAD ${humidity}%`;
    this.root.setAttribute(
      'aria-label',
      `Clima en ${this.config.city}: ${temperature}°, ${label}, viento ${wind} km/h, humedad ${humidity}%`
    );
  }

  renderError() {
    this.root.classList.add('is-error');

    if (this.hasReading) {
      // Conserva la última lectura; solo avisa que no se pudo actualizar.
      this.metaEl.textContent = 'SIN CONEXIÓN · SE REINTENTA';
      this.root.setAttribute('aria-label', `Clima en ${this.config.city}: sin conexión`);
      return;
    }

    this.tempEl.textContent = '--°';
    this.conditionEl.textContent = 'Sin conexión';
    this.metaEl.textContent = 'SE REINTENTA EN 1 MIN';
    this.root.setAttribute('aria-label', `Clima en ${this.config.city}: sin conexión`);
  }
}
