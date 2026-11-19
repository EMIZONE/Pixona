/**
 * Conexión con Open-Meteo (https://open-meteo.com), la API pública de clima que
 * no pide clave ni registro.
 *
 * La ubicación sale de `data/weather.json`: el servicio solo arma la consulta y
 * devuelve el bloque `current`; la presentación vive en `ui/WeatherWidget.js`.
 */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export class WeatherService {
  /** Consulta el clima actual de una coordenada. */
  static async getCurrent({ latitude, longitude }) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
      timezone: 'auto',
      wind_speed_unit: 'kmh'
    });

    const response = await fetch(`${FORECAST_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`Open-Meteo respondió HTTP ${response.status}`);
    }

    const payload = await response.json();
    return payload.current;
  }
}
