'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relativePath) {
  const filename = path.resolve(__dirname, '..', 'src', 'components', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, require);
  return exports;
}

const {
  ESTACIONES,
  estacionDeFecha,
  fechaRepresentativaDeEstacion,
  formatearFechaLocal,
} = load('seasonal-solar.ts');
const { calculateSunPosition } = load('point-shadow-query.ts');
const { getShadowCastMatrix } = load('shadersSombras.ts');

test('HU10 expone las cuatro estaciones en el orden esperado', () => {
  assert.deepEqual(
    ESTACIONES.map((estacion) => estacion.value),
    ['primavera', 'verano', 'otoño', 'invierno'],
  );
  assert.deepEqual(
    ESTACIONES.map((estacion) => estacion.label),
    ['Primavera', 'Verano', 'Otoño', 'Invierno'],
  );
});

test('HU10 construye una fecha representativa conservando año y hora', () => {
  const referencia = new Date(2026, 0, 15, 14, 35, 12, 250);
  const fechaVerano = fechaRepresentativaDeEstacion('verano', referencia);

  assert.equal(fechaVerano.getFullYear(), 2026);
  assert.equal(fechaVerano.getMonth(), 5);
  assert.equal(fechaVerano.getDate(), 21);
  assert.equal(fechaVerano.getHours(), 14);
  assert.equal(fechaVerano.getMinutes(), 35);
  assert.equal(fechaVerano.getSeconds(), 12);
  assert.equal(fechaVerano.getMilliseconds(), 250);
});

test('HU10 clasifica correctamente las fechas frontera de cada estación', () => {
  const casos = [
    [new Date(2026, 0, 1), 'invierno'],
    [new Date(2026, 2, 19), 'invierno'],
    [new Date(2026, 2, 20), 'primavera'],
    [new Date(2026, 5, 20), 'primavera'],
    [new Date(2026, 5, 21), 'verano'],
    [new Date(2026, 8, 21), 'verano'],
    [new Date(2026, 8, 22), 'otoño'],
    [new Date(2026, 11, 20), 'otoño'],
    [new Date(2026, 11, 21), 'invierno'],
  ];

  for (const [fecha, estacion] of casos) {
    assert.equal(estacionDeFecha(fecha), estacion, `La fecha ${fecha.toISOString()} debe ser ${estacion}`);
  }
});

test('HU10 formatea fechas locales sin desplazar el día por la zona horaria', () => {
  assert.equal(formatearFechaLocal(new Date(2026, 5, 21, 23, 45)), '2026-06-21');
});

test('HU10 rechaza referencias y fechas inválidas', () => {
  assert.throws(() => fechaRepresentativaDeEstacion('verano', 'fecha inválida'), /referencia no es válida/);
  assert.throws(() => formatearFechaLocal(new Date('fecha inválida')), /fecha inválida/);
});

test('HU10 cambia la elevación y el acimut solar entre verano e invierno', () => {
  const referencia = new Date(2026, 0, 15, 9, 0);
  const fechaVerano = fechaRepresentativaDeEstacion('verano', referencia);
  const fechaInvierno = fechaRepresentativaDeEstacion('invierno', referencia);
  const verano = calculateSunPosition(fechaVerano, 40.4168, -3.7038);
  const invierno = calculateSunPosition(fechaInvierno, 40.4168, -3.7038);

  assert.ok(verano.elevation > invierno.elevation, 'El sol debe estar más alto en verano en Madrid');
  assert.notEqual(verano.azimuth, invierno.azimuth, 'La dirección solar debe cambiar entre estaciones');
});

test('HU10 produce matrices de sombra diferentes para cada estación', () => {
  const referencia = new Date(2026, 0, 15, 9, 0);
  const verano = calculateSunPosition(fechaRepresentativaDeEstacion('verano', referencia), 40.4168, -3.7038);
  const invierno = calculateSunPosition(fechaRepresentativaDeEstacion('invierno', referencia), 40.4168, -3.7038);
  const matrizVerano = getShadowCastMatrix(verano.azimuth, verano.elevation, 1).elements;
  const matrizInvierno = getShadowCastMatrix(invierno.azimuth, invierno.elevation, 1).elements;

  assert.notDeepEqual(matrizVerano, matrizInvierno, 'La proyección de sombra debe variar entre estaciones');
});
