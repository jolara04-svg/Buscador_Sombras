'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * Función auxiliar para compilar y cargar dinámicamente el componente index.tsx
 * extrayendo sus funciones exportadas (como calculateSunPosition).
 */
function loadAppModule() {
  const filename = path.resolve(__dirname, '..', 'src', 'app', 'index.tsx');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', compiled)(exports, require);
  return exports;
}

const { calculateSunPosition } = loadAppModule();

/**
 * Suite de pruebas unitarias (Caja Blanca) para la función calculateSunPosition (HU-06).
 */

test('1. Mediodía de verano en Madrid (21 de junio de 2026, 12:00)', () => {
  // Madrid: lat 40.4168, lon -3.7038
  // Solsticio de verano al mediodía solar aproximado: elevación alta (> 60 grados).
  const date = new Date('2026-06-21T12:00:00');
  const pos = calculateSunPosition(date, 40.4168, -3.7038);

  assert.ok(typeof pos.elevation === 'number', 'La elevación debe ser un número');
  assert.ok(typeof pos.azimuth === 'number', 'El acimut debe ser un número');
  assert.ok(pos.elevation > 60, `La elevación al mediodía de verano en Madrid (${pos.elevation}) debería ser mayor a 60°`);
});

test('2. Medianoche en Madrid (21 de junio de 2026, 00:00)', () => {
  // A medianoche el sol debe estar por debajo del horizonte (elevación negativa).
  const date = new Date('2026-06-21T00:00:00');
  const pos = calculateSunPosition(date, 40.4168, -3.7038);

  assert.ok(pos.elevation < 0, `La elevación a medianoche (${pos.elevation}) debe ser negativa (bajo el horizonte)`);
});

test('3. Hemisferio Sur - Sydney, Australia (-33.8688, 151.2093) al mediodía', () => {
  // En invierno austral (21 de junio), al mediodía el sol se sitúa hacia el norte (acimut cercano a 0° o 360°).
  const date = new Date('2026-06-21T12:00:00');
  const pos = calculateSunPosition(date, -33.8688, 151.2093);

  assert.ok(typeof pos.elevation === 'number');
  assert.ok(typeof pos.azimuth === 'number');
  // El acimut en el hemisferio sur al mediodía apunta hacia el ecuador (norte, ~0°/360°)
  const isNorthOrClose = pos.azimuth < 45 || pos.azimuth > 315;
  assert.ok(isNorthOrClose, `El acimut en Sydney en invierno al mediodía (${pos.azimuth}) debería apuntar hacia el norte (~0°/360°)`);
});

test('4. Ecuador (0, 0) durante equinoccio (21 de marzo de 2026, 12:00)', () => {
  // En el equinoccio al mediodía en el ecuador, el sol pasa prácticamente por el cenit (~90°).
  const date = new Date('2026-03-21T12:00:00');
  const pos = calculateSunPosition(date, 0, 0);

  assert.ok(pos.elevation > 80, `La elevación en el ecuador en equinoccio al mediodía (${pos.elevation}) debe estar cerca del cenit (>80°)`);
});

test('5. Robustez: Fecha inválida no debe lanzar excepción', () => {
  const invalidDate = new Date('invalid-date-string');
  let threw = false;
  let result;
  try {
    result = calculateSunPosition(invalidDate, 40.4168, -3.7038);
  } catch (e) {
    threw = true;
  }

  assert.equal(threw, false, 'calculateSunPosition no debe lanzar excepciones ante fechas inválidas');
  assert.ok(isNaN(result.elevation) || typeof result.elevation === 'number', 'Debe manejar los valores de forma segura');
});
