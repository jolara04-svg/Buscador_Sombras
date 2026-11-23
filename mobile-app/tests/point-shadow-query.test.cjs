'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadModule(relativePath) {
  const filename = path.resolve(__dirname, '..', 'src', 'components', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, require);
  return exports;
}

const {
  buildShadowTimeline,
  calculateSunPosition,
  formatMinute,
  shadowStateLabel,
} = loadModule('point-shadow-query.ts');

test('la posición solar devuelve sol sobre el horizonte y sombra de noche', () => {
  const midday = calculateSunPosition(new Date('2026-06-21T12:00:00'), 40.4168, -3.7038);
  const midnight = calculateSunPosition(new Date('2026-06-21T00:00:00'), 40.4168, -3.7038);

  assert.ok(midday.elevation > 60, `Elevación inesperada: ${midday.elevation}`);
  assert.ok(midnight.elevation < 0, `Elevación nocturna inesperada: ${midnight.elevation}`);
});

test('la consulta genera franjas agrupadas de sombra, sol y sombra', () => {
  const timeline = buildShadowTimeline({
    date: '2026-06-21',
    latitude: 40.4168,
    longitude: -3.7038,
    stepMinutes: 15,
  });

  assert.equal(timeline.minutosSol + timeline.minutosSombra, 1440);
  assert.ok(timeline.intervalos.length >= 3, 'Debe haber al menos noche, día y noche');
  assert.equal(timeline.intervalos[0].estado, 'sombra');
  assert.equal(timeline.intervalos[timeline.intervalos.length - 1].estado, 'sombra');
  assert.ok(timeline.intervalos.some(interval => interval.estado === 'sol'));
  assert.equal(timeline.intervalos[0].inicio, '00:00');
  assert.equal(timeline.intervalos.at(-1).fin, '24:00');
});

test('el detector puntual puede marcar sombra durante el día y la salida se agrupa', () => {
  const timeline = buildShadowTimeline({
    date: '2026-06-21',
    latitude: 40.4168,
    longitude: -3.7038,
    startMinute: 720,
    endMinute: 780,
    stepMinutes: 15,
    isShadowed: sample => sample.minuto < 750,
  });

  assert.deepEqual(timeline.intervalos.map(interval => [interval.estado, interval.inicio, interval.fin]), [
    ['sombra', '12:00', '12:30'],
    ['sol', '12:30', '13:00'],
  ]);
});

test('el formato de minutos y las etiquetas son legibles', () => {
  assert.equal(formatMinute(0), '00:00');
  assert.equal(formatMinute(12 * 60 + 5), '12:05');
  assert.equal(formatMinute(1440), '24:00');
  assert.equal(shadowStateLabel('sol'), 'Sol directo');
  assert.equal(shadowStateLabel('sombra'), 'Sombra');
});

test('la consulta valida coordenadas, intervalo y fecha', () => {
  assert.throws(() => buildShadowTimeline({ date: '2026-06-21', latitude: 91, longitude: 0 }), /latitud/);
  assert.throws(() => buildShadowTimeline({ date: '2026-06-21', latitude: 40, longitude: 0, startMinute: 600, endMinute: 600 }), /hora final/);
  assert.throws(() => buildShadowTimeline({ date: 'no-es-una-fecha', latitude: 40, longitude: 0 }), /fecha/);
  assert.throws(() => buildShadowTimeline({ date: '2026-06-21', latitude: 40, longitude: 0, stepMinutes: 0 }), /muestreo/);
});

test('HU9 entrega al detector puntual la hora, fecha y posición solar de la muestra', () => {
  let recibida;
  const timeline = buildShadowTimeline({
    date: '2026-06-21',
    latitude: 40.4168,
    longitude: -3.7038,
    startMinute: 720,
    endMinute: 735,
    stepMinutes: 15,
    isShadowed: (sample) => {
      recibida = sample;
      return true;
    },
  });

  assert.equal(recibida.minuto, 727.5);
  assert.equal(recibida.fecha.getHours(), 12);
  assert.equal(recibida.fecha.getMinutes(), 7);
  assert.equal(recibida.fecha.getSeconds(), 0);
  assert.ok(recibida.elevation > 0);
  assert.equal(timeline.intervalos[0].estado, 'sombra');
});
