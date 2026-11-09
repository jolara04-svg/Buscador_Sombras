// Cola de prioridad binaria: Dijkstra O((V+E) log V), sin recorrer todos los
// nodos para buscar el minimo. Las entradas antiguas se descartan al extraerlas.
class MinHeap {
  values = [];
  push(value) {
    const a = this.values;
    let i = a.length; a.push(value);
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].cost <= value.cost) break; a[i] = a[p]; i = p; }
    a[i] = value;
  }
  pop() {
    const a = this.values, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (2 * i + 1 < a.length) {
        let child = 2 * i + 1;
        if (child + 1 < a.length && a[child + 1].cost < a[child].cost) child++;
        if (a[child].cost >= last.cost) break;
        a[i] = a[child]; i = child;
      }
      a[i] = last;
    }
    return first;
  }
}

export function makeAdjacency(edges, exposure, mode = 'shade') {
  const adjacency = new Map();
  edges.forEach((edge, index) => {
    const info = exposure[index];
    // Nunca sustituir informacion desconocida por sol ni permitir costes negativos.
    if (!info || info.cost === null || info.unknownM > 1e-7) return;
    const cost = mode === 'distance' ? info.lengthM : info.cost;
    if (!Number.isFinite(cost) || cost < 0) throw new Error('Dijkstra necesita costes finitos no negativos');
    const add = (a, b) => { if (!adjacency.has(a)) adjacency.set(a, []); adjacency.get(a).push({ to: b, cost, index }); if (!adjacency.has(b)) adjacency.set(b, []); };
    if (edge.forward) add(edge.source, edge.target);
    if (edge.reverse) add(edge.target, edge.source);
  });
  return adjacency;
}

export function dijkstra(adjacency, source, target) {
  if (!adjacency.has(source) || !adjacency.has(target)) return null;
  const best = new Map([[source, 0]]), previous = new Map(), heap = new MinHeap();
  heap.push({ node: source, cost: 0 });
  let visited = 0;
  while (heap.values.length) {
    const current = heap.pop();
    if (current.cost !== best.get(current.node)) continue;
    visited++;
    if (current.node === target) {
      const nodes = [target], edgeIndices = [];
      let node = target;
      while (node !== source) { const p = previous.get(node); edgeIndices.push(p.index); node = p.node; nodes.push(node); }
      return { cost: current.cost, nodes: nodes.reverse(), edgeIndices: edgeIndices.reverse(), visited };
    }
    for (const arc of adjacency.get(current.node)) {
      const cost = current.cost + arc.cost;
      if (cost < (best.get(arc.to) ?? Infinity)) {
        best.set(arc.to, cost); previous.set(arc.to, { node: current.node, index: arc.index });
        heap.push({ node: arc.to, cost });
      }
    }
  }
  return null;
}

// Se eligen endpoints de prueba dentro del componente debil mayor. Esto evita
// confundir una isla del extracto con un fallo del algoritmo. Aun asi, se informa
// de rutas dirigidas imposibles; no se inventan conexiones para obtener exito.
export function largestComponent(edges) {
  const adjacency = new Map();
  for (const e of edges) {
    for (const [a, b] of [[e.source, e.target], [e.target, e.source]]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push(b);
    }
  }
  const seen = new Set();
  let largest = [], count = 0;
  for (const start of adjacency.keys()) {
    if (seen.has(start)) continue;
    count++;
    const component = [start]; seen.add(start);
    for (let i = 0; i < component.length; i++) for (const neighbor of adjacency.get(component[i])) {
      if (!seen.has(neighbor)) { seen.add(neighbor); component.push(neighbor); }
    }
    if (component.length > largest.length) largest = component;
  }
  return { nodes: largest, count, totalNodes: adjacency.size };
}

export function summarizeRoute(route, exposure) {
  if (!route) return null;
  const totals = { lengthM: 0, shadeM: 0, sunM: 0, weightedCost: 0 };
  for (const index of route.edgeIndices) {
    const e = exposure[index];
    totals.lengthM += e.lengthM; totals.shadeM += e.shadeM;
    totals.sunM += e.sunM; totals.weightedCost += e.cost;
  }
  return { ...totals, shadeFraction: totals.lengthM ? totals.shadeM / totals.lengthM : 0,
    nodes: route.nodes, edgeIndices: route.edgeIndices, visited: route.visited };
}

// Reader del atlas: cada mascara es de 1 byte/pixel y se localiza en O(1).
// Las aristas pueden cruzar fronteras: cada muestra consulta su zona sin cortar
// ni duplicar la arista original del grafo.
export function atlasAt(atlas, bounds, cols, zoneSizeM, resolution, x, y) {
  if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return null;
  const col = Math.floor((x - bounds.minX) / zoneSizeM), row = Math.floor((y - bounds.minY) / zoneSizeM);
  const mask = atlas[row * cols + col];
  if (!mask) return null;
  const u = Math.floor((x - bounds.minX - col * zoneSizeM) / zoneSizeM * resolution);
  const v = Math.floor((y - bounds.minY - row * zoneSizeM) / zoneSizeM * resolution);
  return mask[v * resolution + u];
}
