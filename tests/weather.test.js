import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { weatherLabel } from '../js/ui/WeatherWidget.js';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'));

test('weatherLabel traduce los códigos WMO de Open-Meteo', () => {
  assert.equal(weatherLabel(0), 'Despejado');
  assert.equal(weatherLabel(2), 'Parcialmente nublado');
  assert.equal(weatherLabel(65), 'Lluvia fuerte');
  assert.equal(weatherLabel(95), 'Tormenta');
});

test('weatherLabel deja un texto genérico para códigos desconocidos', () => {
  assert.equal(weatherLabel(123), 'Clima variable');
});

test('weather.json trae una coordenada y un intervalo de refresco válidos', () => {
  const config = read('weather.json');

  assert.equal(typeof config.city, 'string');
  assert.ok(config.city.length > 0);
  assert.ok(config.latitude >= -90 && config.latitude <= 90);
  assert.ok(config.longitude >= -180 && config.longitude <= 180);
  assert.ok(config.refreshMinutes > 0);
});
