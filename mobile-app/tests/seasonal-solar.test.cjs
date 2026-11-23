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
  fechaRepresentativaDeEstacion,
} = load('seasonal-solar.ts');

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
