import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildGraph, unproject } from './core.mjs';
const root = new URL('./', import.meta.url);
const scale = process.argv.includes('--scale');
const prefix = scale ? 'scale-' : '';
const config = JSON.parse(await fs.readFile(new URL(`${prefix}config.json`, root)));
await fs.mkdir(new URL('data/', root), { recursive: true });
const rawPath = new URL(`data/${prefix}osm.json`, root);
const downloadStart = performance.now();
let osm;
let downloaded = false;
// Guardar la respuesta original permite repetir el experimento sin mas peticiones.
if (!process.argv.includes('--refresh')) {
  try { osm = JSON.parse(await fs.readFile(rawPath)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!osm) {
  downloaded = true;
  const sw = unproject(-config.sizeM / 2, -config.sizeM / 2, config.center);
  const ne = unproject(config.sizeM / 2, config.sizeM / 2, config.center);
  const query = `[out:json][timeout:45];way["highway"](${sw.lat},${sw.lon},${ne.lat},${ne.lon});(._;>;);out body;`;
  const endpoint = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
  const response = await fetch(`${endpoint}?${new URLSearchParams({ data: query })}`, { headers: { Accept: 'application/json', 'User-Agent': 'SombrApp-campus-prototype/1.0' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Overpass ${response.status}: ${await response.text()}`);
  osm = await response.json();
  if (osm.remark || !Array.isArray(osm.elements)) throw new Error(`Overpass incompleto: ${osm.remark}`);
  await fs.writeFile(rawPath, JSON.stringify(osm, null, 2));
}
const buildStart = performance.now();
const graph = buildGraph(osm, config);
if (!graph.edges.length) throw new Error('No se encontraron caminos en la zona');
const buildMs = performance.now() - buildStart;
const graphPath = new URL(`data/${prefix}graph.json`, root);
await fs.writeFile(graphPath, JSON.stringify(graph, null, 2));
const metrics = { downloaded, inputMs: buildStart - downloadStart, buildMs,
  totalMs: performance.now() - downloadStart, graphBytes: (await fs.stat(graphPath)).size,
  rawOsmBytes: (await fs.stat(rawPath)).size, memory: process.memoryUsage(), nodes: graph.nodes.length, edges: graph.edges.length };
await fs.writeFile(new URL(`data/${prefix}generation.json`, root), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify({ ...metrics, output: fileURLToPath(graphPath) }));
