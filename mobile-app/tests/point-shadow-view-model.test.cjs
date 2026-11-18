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
  formatSelectedPoint,
  formatIntervalDuration,
  formatQueryDate,
  intervalColor,
  intervalLabel,
} = loadModule('point-shadow-view-model.ts');

test('la vista del punto conserva seis decimales para identificar el clic exacto', () => {
  assert.equal(formatSelectedPoint({ lat: 40.416812345, lon: -3.703812345 }), '40.416812, -3.703812');
});

test('la vista convierte duraciones a horas y minutos', () => {
  assert.equal(formatIntervalDuration(0), '0 min');
  assert.equal(formatIntervalDuration(45), '45 min');
  assert.equal(formatIntervalDuration(60), '1 h');
  assert.equal(formatIntervalDuration(135), '2 h 15 min');
});

test('la fecha del panel se formatea y gestiona fechas inválidas', () => {
  assert.equal(formatQueryDate('2026-06-21T12:30:00'), '2026-06-21');
  assert.equal(formatQueryDate('fecha inválida'), 'Fecha no válida');
});

test('las franjas tienen etiquetas y colores distinguibles', () => {
  assert.equal(intervalLabel({ estado: 'sol' }), 'Sol directo');
  assert.equal(intervalLabel({ estado: 'sombra' }), 'Sombra');
  assert.notEqual(intervalColor('sol'), intervalColor('sombra'));
});
