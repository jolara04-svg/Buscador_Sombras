// Ejecuta la prueba WebGL real en Edge headless y guarda sus resultados.
// CDP se usa solo como automatizacion de pruebas de esta pagina local.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root = fileURLToPath(new URL('./', import.meta.url));
const scale = process.argv.includes('--scale');
const prefix = scale ? 'scale-' : '';
const output = path.join(root, 'output');
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'sombrapp-mask-'));
const browserPath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const server = spawn(process.execPath, [path.join(root, 'server.cjs')], { windowsHide: true, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
const browser = { process: null };
let ws;
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor no inicia')), 15000);
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor termina: ${code}`)); });
    server.stderr.on('data', data => process.stderr.write(data));
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
  browser.process = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--window-size=1200,1100', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let i = 0; i < 150; i++) {
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!port) throw new Error('Edge no publica el puerto CDP');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    clearTimeout(handler.timer);
    if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
    else handler.resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await call('Page.enable');
  const navigationStarted = performance.now();
  await call('Page.navigate', { url: scale ? `${url}/scale.html` : url });
  let result;
  for (let i = 0; i < 480; i++) {
    const response = await call('Runtime.evaluate', { expression: '({result:window.experimentResult,error:window.experimentError})', returnByValue: true });
    const state = response.result.value;
    if (state?.error) throw new Error(state.error);
    if (state?.result) { result = state.result; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!result) throw new Error('La prueba no termina en 240 segundos');
  result.execution = { browser: 'Edge headless', backend: 'SwiftShader (software WebGL); no mide rendimiento de una GPU fisica' };
  result.execution.navigationToObservedCompletionMs = performance.now() - navigationStarted;
  await fs.writeFile(path.join(output, `${prefix}report.json`), JSON.stringify(result, null, 2));
  if (scale) {
    const { writeScaleSummary } = await import('./scale-summary.mjs');
    await writeScaleSummary(result, new URL('./output/SCALE_RESULTS.md', import.meta.url));
  }
  const preview = await call('Runtime.evaluate', { expression: 'document.querySelector("#preview").toDataURL("image/png")', returnByValue: true });
  await fs.writeFile(path.join(output, `${prefix}mask-and-graph.png`), Buffer.from(preview.result.value.split(',')[1], 'base64'));
  const screenshot = await call('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(output, `${prefix}page.png`), Buffer.from(screenshot.data, 'base64'));
  const { edges, scenarios, memory, buildings, ...summary } = result;
  if (scale) {
    summary.buildings = { tiles: buildings.tiles, triangles: buildings.triangles, downloadedBytes: buildings.downloadedBytes };
    summary.memory = { largestObservedJsHeapBytes: memory.largestObservedJsHeapBytes, geometryCpuBytes: memory.geometryCpuBytes,
      serverRssBytes: memory.serverFinal.rss, stagingRgbaCpuBytes: memory.stagingRgbaCpuBytes, caveat: memory.caveat };
    summary.scenarios = scenarios.map(({ repetitions, ...s }) => ({ ...s, firstPipelineMs: repetitions[0].pipelineMs,
      cachedSearchMs: repetitions.at(-1).cachedSearchMs,
      routes: repetitions[0].routes.map(r => ({ name: r.name, zones: r.zonesCrossed.length,
        shortestM: r.shortest?.lengthM, shadedM: r.shaded?.lengthM, sunReductionM: r.sunReductionM })) }));
  } else { summary.buildings = buildings; }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  browser.process?.kill();
  server.kill();
}
