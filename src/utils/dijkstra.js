// A* pathfinding on a 4-connected grid with Manhattan-distance heuristic.
// Node keys are integers: key = y * gridWidth + x. Neighbors are computed
// on demand from the key — no edges map is materialised.

class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  enqueue(element, priority) {
    this.heap.push({ element, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    const heap = this.heap;
    if (heap.length === 0) return null;
    if (heap.length === 1) return heap.pop();
    const min = heap[0];
    heap[0] = heap.pop();
    this.bubbleDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  bubbleUp(index) {
    const heap = this.heap;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (heap[parent].priority <= heap[index].priority) break;
      [heap[parent], heap[index]] = [heap[index], heap[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    const heap = this.heap;
    const len = heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < len && heap[left].priority < heap[smallest].priority) smallest = left;
      if (right < len && heap[right].priority < heap[smallest].priority) smallest = right;
      if (smallest === index) break;
      [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
      index = smallest;
    }
  }
}

class PerlinNoise {
  constructor(seed = 0) {
    this.seed = seed;
    this.permutation = this.generatePermutation();
  }

  generatePermutation() {
    const p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 256; i++) p[256 + i] = p[i];
    return p;
  }

  seededRandom() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }

  grad(hash, x, y, z = 0) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x), v = this.fade(y), w = this.fade(z);
    const p = this.permutation;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return this.lerp(w,
      this.lerp(v,
        this.lerp(u, this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z)),
        this.lerp(u, this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z))),
      this.lerp(v,
        this.lerp(u, this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1))));
  }

  fractalNoise(x, y, octaves = 4, persistence = 0.5, scale = 0.1) {
    let value = 0, amplitude = 1, frequency = scale, maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return value / maxValue;
  }
}

export const coordToKey = (x, y, gridWidth) => y * gridWidth + x;
export const keyToX = (key, gridWidth) => key % gridWidth;
export const keyToY = (key, gridWidth) => Math.floor(key / gridWidth);

export const generateGraphStructure = (gridWidth, gridHeight, seed = 42, detail = 1.0) => {
  const size = gridWidth * gridHeight;
  const weights = new Float32Array(size);
  const nodes = new Map();
  const perlin = new PerlinNoise(seed);
  const baseScale = detail * 0.05;
  const roadScale = detail * 0.1;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const noiseValue = perlin.fractalNoise(x, y, 4, 0.6, baseScale);

      let weight;
      if (noiseValue < -0.3) {
        weight = 0.1 + (noiseValue + 0.3) * 0.5;
      } else if (noiseValue < 0.1) {
        weight = 0.5 + noiseValue * 2.5;
      } else if (noiseValue < 0.4) {
        weight = 2.0 + (noiseValue - 0.1) * 10;
      } else {
        weight = 8.0 + (noiseValue - 0.4) * 28.33;
      }

      const roadNoise = perlin.fractalNoise(x * 0.03, y * 0.03, 2, 0.5, roadScale);
      if (Math.abs(roadNoise) < 0.05) weight = Math.min(weight, 0.3);

      weight = Math.max(0.1, weight);
      const key = y * gridWidth + x;
      weights[key] = weight;
      nodes.set(key, { x, y, weight });
    }
  }

  return { nodes, weights, gridWidth, gridHeight };
};

const dijkstraGraph = (startKey, endKey, graphData) => {
  const { nodes, weights, gridWidth, gridHeight } = graphData;
  const gCost = new Map();
  const previous = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();
  const lastRow = (gridHeight - 1) * gridWidth;

  const endX = endKey % gridWidth;
  const endY = (endKey - endX) / gridWidth;
  const heuristic = (key) => {
    const x = key % gridWidth;
    const y = (key - x) / gridWidth;
    return (Math.abs(x - endX) + Math.abs(y - endY)) * 0.8;
  };

  gCost.set(startKey, 0);
  pq.enqueue(startKey, heuristic(startKey));

  const maxNodes = Math.min(2000, nodes.size);
  let explored = 0;

  while (!pq.isEmpty() && explored < maxNodes) {
    const { element: currentKey } = pq.dequeue();
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    explored++;

    if (currentKey === endKey) break;

    const currentG = gCost.get(currentKey);
    const x = currentKey % gridWidth;

    const candidates = [
      x > 0 ? currentKey - 1 : -1,
      x < gridWidth - 1 ? currentKey + 1 : -1,
      currentKey >= gridWidth ? currentKey - gridWidth : -1,
      currentKey < lastRow ? currentKey + gridWidth : -1,
    ];

    for (let i = 0; i < 4; i++) {
      const nKey = candidates[i];
      if (nKey < 0 || visited.has(nKey)) continue;
      const tentativeG = currentG + weights[nKey];
      const existing = gCost.get(nKey);
      if (existing === undefined || tentativeG < existing) {
        previous.set(nKey, currentKey);
        gCost.set(nKey, tentativeG);
        pq.enqueue(nKey, tentativeG + heuristic(nKey));
      }
    }
  }

  return { gCost, previous };
};

const reconstructPath = (previous, startKey, endKey) => {
  const path = [];
  let current = endKey;
  while (current !== undefined) {
    path.unshift(current);
    if (current === startKey) return path;
    current = previous.get(current);
  }
  return [];
};

export const findShortestGraphPath = (startKey, endKey, graphData) => {
  const { nodes } = graphData;
  if (!nodes.has(startKey) || !nodes.has(endKey)) {
    return { path: [], distance: Infinity, pathExists: false };
  }
  if (startKey === endKey) {
    return { path: [startKey], distance: 0, pathExists: true };
  }

  const { gCost, previous } = dijkstraGraph(startKey, endKey, graphData);
  const path = reconstructPath(previous, startKey, endKey);

  return {
    path,
    distance: gCost.get(endKey) ?? Infinity,
    pathExists: path.length > 0,
  };
};
