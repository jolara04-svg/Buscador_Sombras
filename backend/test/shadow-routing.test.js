const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = import('../experiments/shadow-routing/core.mjs');
const routing = import('../experiments/shadow-routing/routing.mjs');

test('mascara: orientacion WebGL, limites y posiciones desconocidas', async () => {
  const { maskAt } = await core;
  const pixels = new Uint8Array(16); pixels[0] = 255; // suroeste sombreado
  const bounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
  assert.equal(maskAt(pixels, 2, 2, bounds, 0.5, 0.5), 1);
  assert.equal(maskAt(pixels, 2, 2, bounds, 0.5, 1.5), 0);
  assert.equal(maskAt(pixels, 2, 2, bounds, 2, 0), null);
});

test('atlas: arista cruza dos mascaras sin perder metros ni confundir frontera', async () => {
  const { atlasAt } = await routing;
  const { evaluateEdge } = await core;
  const atlas = [new Uint8Array(4).fill(1), new Uint8Array(4)];
  const bounds = { minX: 0, minY: 0, maxX: 4, maxY: 2 };
  const read = (x, y) => atlasAt(atlas, bounds, 2, 2, 2, x, y);
  assert.equal(read(1.99, 1), 1);
  assert.equal(read(2, 1), 0);
  assert.equal(read(4, 1), null);
  const e = evaluateEdge({ id: 'seam', geometry: [[0, 1], [4, 1]] }, read, 0.5, 4);
  assert.equal(e.shadeFraction, 0.5);
  assert.equal(e.unknownM, 0);
  assert.equal(e.cost, 10);
});

test('Dijkstra: distancia y sombra eligen alternativas distintas, respeta direccion y desconocidos', async () => {
  const { makeAdjacency, dijkstra, summarizeRoute } = await routing;
  const edges = [
    { source: 'a', target: 'b', forward: true, reverse: false },
    { source: 'a', target: 'c', forward: true, reverse: true },
    { source: 'c', target: 'b', forward: true, reverse: false },
    { source: 'a', target: 'd', forward: true, reverse: true }
  ];
  const info = [
    { lengthM: 10, shadeM: 0, sunM: 10, cost: 40, unknownM: 0 },
    { lengthM: 7, shadeM: 7, sunM: 0, cost: 7, unknownM: 0 },
    { lengthM: 7, shadeM: 7, sunM: 0, cost: 7, unknownM: 0 },
    { lengthM: 1, shadeM: 0, sunM: 0, cost: null, unknownM: 1 }
  ];
  const shaded = makeAdjacency(edges, info), shortest = makeAdjacency(edges, info, 'distance');
  assert.deepEqual(dijkstra(shortest, 'a', 'b').nodes, ['a', 'b']);
  const route = dijkstra(shaded, 'a', 'b');
  assert.deepEqual(route.nodes, ['a', 'c', 'b']);
  assert.equal(summarizeRoute(route, info).lengthM, 14);
  assert.equal(dijkstra(shaded, 'b', 'a'), null);
  assert.equal(dijkstra(shaded, 'a', 'd'), null);
  assert.equal(dijkstra(shaded, 'a', 'a').cost, 0);
  assert.throws(() => makeAdjacency([edges[0]], [{ cost: -1, unknownM: 0 }]));
});

test('Dijkstra con heap coincide con referencia Floyd-Warshall en grafo dirigido', async () => {
  const { makeAdjacency, dijkstra } = await routing;
  const n = 18, edges = [], info = [];
  const reference = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : Infinity));
  let state = 42;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  for (let i = 0; i < 70; i++) {
    const a = random() % n, b = random() % n, cost = random() % 50;
    edges.push({ source: String(a), target: String(b), forward: true, reverse: false });
    info.push({ cost, lengthM: cost, unknownM: 0 });
    reference[a][b] = Math.min(reference[a][b], cost);
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) reference[i][j] = Math.min(reference[i][j], reference[i][k] + reference[k][j]);
  const adjacency = makeAdjacency(edges, info);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (!adjacency.has(String(i)) || !adjacency.has(String(j))) continue;
    assert.equal(dijkstra(adjacency, String(i), String(j))?.cost ?? Infinity, reference[i][j]);
  }
});
test('exposicion: ponderar longitud, conservar metros y penalizar solo sol', async () => {
  const { evaluateEdge } = await core;
  const edge = { id: 'a', geometry: [[0, 0], [2, 0], [10, 0]] };
  const result = evaluateEdge(edge, x => x < 2 ? 1 : 0, 3, 4);
  assert.equal(result.shadeM, 2);
  assert.equal(result.sunM, 8);
  assert.equal(result.cost, 34);
  assert.equal(result.shadeFraction, 0.2);
  assert.equal(evaluateEdge(edge, () => null).cost, null);
  assert.throws(() => evaluateEdge(edge, () => 0, 0));
});
test('grafo: identidad OSM, accesos peatonales y direccion propia', async () => {
  const { buildGraph, unproject, project } = await core;
  const config = { center: { lat: 40.45, lon: -3.73 }, sizeM: 512 };
  const p = unproject(10, 20, config.center);
  const xy = project(p.lat, p.lon, config.center);
  assert.ok(Math.abs(xy[0] - 10) < 1e-6 && Math.abs(xy[1] - 20) < 1e-6);
  const node = (id, x, y) => ({ type: 'node', id, ...unproject(x, y, config.center) });
  const way = (id, nodes, tags) => ({ type: 'way', id, nodes, tags: { highway: 'footway', ...tags } });
  const graph = buildGraph({ elements: [node(1, -10, 0), node(2, 10, 0), node(3, 0, -10), node(4, 0, 10),
    way(10, [1, 2], { oneway: 'yes' }), way(11, [3, 4], { 'oneway:foot': '-1' }),
    way(12, [1, 3], { access: 'private' }), way(13, [1, 4], { bridge: 'yes' })] }, config);
  assert.equal(graph.nodes.length, 4); // Cruce geometrico no crea un nodo ficticio.
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.edges[0].reverse, true); // oneway de coches no afecta a peatones
  assert.equal(graph.edges[1].forward, false);
  assert.equal(graph.edges[1].reverse, true);
});
