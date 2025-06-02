// A* pathfinding algorithm with Manhattan distance heuristic

// Optimized Binary Heap Priority Queue
class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  enqueue(element, priority) {
    const node = { element, priority };
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
      
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.heap.length && this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }

      if (rightChild < this.heap.length && this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// Simple Perlin noise implementation for terrain generation
class PerlinNoise {
  constructor(seed = 0) {
    this.seed = seed;
    this.permutation = this.generatePermutation();
  }

  generatePermutation() {
    const p = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Shuffle array using seed
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    // Duplicate the permutation
    for (let i = 0; i < 256; i++) {
      p[256 + i] = p[i];
    }
    
    return p;
  }

  seededRandom() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

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
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    
    const A = this.permutation[X] + Y;
    const AA = this.permutation[A] + Z;
    const AB = this.permutation[A + 1] + Z;
    const B = this.permutation[X + 1] + Y;
    const BA = this.permutation[B] + Z;
    const BB = this.permutation[B + 1] + Z;
    
    return this.lerp(w,
      this.lerp(v,
        this.lerp(u, this.grad(this.permutation[AA], x, y, z),
                     this.grad(this.permutation[BA], x - 1, y, z)),
        this.lerp(u, this.grad(this.permutation[AB], x, y - 1, z),
                     this.grad(this.permutation[BB], x - 1, y - 1, z))),
      this.lerp(v,
        this.lerp(u, this.grad(this.permutation[AA + 1], x, y, z - 1),
                     this.grad(this.permutation[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.permutation[AB + 1], x, y - 1, z - 1),
                     this.grad(this.permutation[BB + 1], x - 1, y - 1, z - 1))));
  }

  fractalNoise(x, y, octaves = 4, persistence = 0.5, scale = 0.1) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }
}

// Generate graph structure with nodes, edges, and terrain weights
export const generateGraphStructure = (gridWidth, gridHeight = null, seed = 42, detail = 1.0) => {
  // Handle backward compatibility - if gridHeight is not provided or is a number that should be seed
  if (gridHeight === null || (typeof gridHeight === 'number' && gridHeight < 10)) {
    // Old square grid format: generateGraphStructure(gridSize, seed, detail)
    const gridSize = gridWidth;
    gridHeight = gridSize;
    gridWidth = gridSize;
    if (typeof arguments[1] === 'number' && arguments[1] >= 1 && arguments[1] <= 1000) {
      seed = arguments[1];
    }
    if (typeof arguments[2] === 'number') {
      detail = arguments[2];
    }
  }

  const nodes = new Map();
  const edges = new Map();
  const perlin = new PerlinNoise(seed);
  
  // Enhanced cache key for consistent terrain generation
  const cacheKey = `${gridWidth}x${gridHeight}-${seed}-${detail.toFixed(1)}`;
  
  // Create nodes with terrain weights for rectangular grid
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const nodeKey = `${x},${y}`;
      
      // Generate terrain weight using fractal noise
      const noiseValue = perlin.fractalNoise(
        x, y, 
        4, // octaves for detail
        0.6, // persistence for terrain variation
        detail * 0.05 // scale adjusted by detail parameter
      );
      
      // Enhanced weight calculation for more dramatic terrain
      let weight;
      if (noiseValue < -0.3) {
        // Deep valleys - very easy paths
        weight = 0.1 + (noiseValue + 0.3) * 0.5; // 0.1 to 0.25
      } else if (noiseValue < 0.1) {
        // Rolling hills - moderate difficulty
        weight = 0.5 + noiseValue * 2.5; // 0.5 to 0.75
      } else if (noiseValue < 0.4) {
        // Hills - difficult terrain
        weight = 2.0 + (noiseValue - 0.1) * 10; // 2.0 to 5.0
      } else {
        // Mountains - very difficult
        weight = 8.0 + (noiseValue - 0.4) * 28.33; // 8.0 to 25.0
      }
      
      // Add some roads/paths for interesting navigation
      const roadNoise = perlin.fractalNoise(x * 0.03, y * 0.03, 2, 0.5, detail * 0.1);
      if (Math.abs(roadNoise) < 0.05) {
        weight = Math.min(weight, 0.3); // Road network
      }
      
      nodes.set(nodeKey, {
        x,
        y,
        weight: Math.max(0.1, weight) // Ensure minimum weight
      });
    }
  }
  
  // Create edges (4-directional for performance) for rectangular grid
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const nodeKey = `${x},${y}`;
      const connections = new Set();
      
      // Only orthogonal connections for better performance
      const directions = [
        { dx: -1, dy: 0 },  // left
        { dx: 1, dy: 0 },   // right
        { dx: 0, dy: -1 },  // up
        { dx: 0, dy: 1 }    // down
      ];
      
      for (const { dx, dy } of directions) {
        const newX = x + dx;
        const newY = y + dy;
        
        if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
          const neighborKey = `${newX},${newY}`;
          connections.add(neighborKey);
        }
      }
      
      edges.set(nodeKey, connections);
    }
  }
  
  return { nodes, edges };
};

// A* algorithm for graph-based pathfinding - optimized version
export const dijkstraGraph = (startKey, endKey, nodes, edges) => {
  const gCost = new Map();
  const fCost = new Map();
  const previous = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();
  
  // Get start and end coordinates for heuristic calculation
  const startNode = nodes.get(startKey);
  const endNode = nodes.get(endKey);
  
  // Manhattan distance heuristic function
  const manhattanDistance = (nodeKey) => {
    const node = nodes.get(nodeKey);
    const distance = Math.abs(node.x - endNode.x) + Math.abs(node.y - endNode.y);
    
    // Make heuristic more conservative to give terrain weights more influence
    // This prevents the algorithm from being too aggressive about straight lines
    // and makes it more likely to consider terrain difficulty
    return distance * 0.8; // Reduced from 1.0 to make weights more influential
  };
  
  // Initialize costs only for reachable nodes (optimization)
  const maxDistance = Math.abs(startNode.x - endNode.x) + Math.abs(startNode.y - endNode.y);
  const searchRadius = maxDistance * 1.5; // Limit search area for performance
  
  for (const nodeKey of nodes.keys()) {
    const node = nodes.get(nodeKey);
    const distanceFromStart = Math.abs(node.x - startNode.x) + Math.abs(node.y - startNode.y);
    
    // Skip nodes that are too far from reasonable path
    if (distanceFromStart > searchRadius) continue;
    
    gCost.set(nodeKey, Infinity);
    fCost.set(nodeKey, Infinity);
    previous.set(nodeKey, null);
  }
  
  // Set start costs
  gCost.set(startKey, 0);
  fCost.set(startKey, manhattanDistance(startKey));
  pq.enqueue(startKey, fCost.get(startKey));
  
  let nodesExplored = 0;
  let maxNodesToExplore = Math.min(1000, nodes.size * 0.5); // Change const to let for modification
  
  while (!pq.isEmpty() && nodesExplored < maxNodesToExplore) {
    const { element: currentKey } = pq.dequeue();
    
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    nodesExplored++;
    
    // Check if we reached the goal
    if (currentKey === endKey) {
      break;
    }
    
    // Early termination optimization: if we're very close to target, prioritize direct path
    const currentNode = nodes.get(currentKey);
    const distanceToEnd = Math.abs(currentNode.x - endNode.x) + Math.abs(currentNode.y - endNode.y);
    if (distanceToEnd <= 3 && nodesExplored > 50) {
      // Close to target, reduce search scope for faster completion
      maxNodesToExplore = Math.min(maxNodesToExplore, nodesExplored + 100);
    }
    
    const connections = edges.get(currentKey) || new Set();
    
    for (const neighborKey of connections) {
      if (visited.has(neighborKey)) continue;
      if (!gCost.has(neighborKey)) continue; // Skip nodes outside search radius
      
      const neighborNode = nodes.get(neighborKey);
      
      // Calculate movement cost (orthogonal only for performance)
      const dx = currentNode.x - neighborNode.x;
      const dy = currentNode.y - neighborNode.y;
      const movementCost = dx === 0 || dy === 0 ? 1 : 1.414;
      
      // Calculate tentative g cost
      const tentativeGCost = gCost.get(currentKey) + movementCost * neighborNode.weight;
      
      // If this path to neighbor is better than previous paths
      if (tentativeGCost < gCost.get(neighborKey)) {
        previous.set(neighborKey, currentKey);
        gCost.set(neighborKey, tentativeGCost);
        
        // Calculate f cost with heuristic
        const hCost = manhattanDistance(neighborKey);
        const newFCost = tentativeGCost + hCost;
        fCost.set(neighborKey, newFCost);
        
        // Add to priority queue with f cost as priority
        pq.enqueue(neighborKey, newFCost);
      }
    }
  }
  
  return { distances: gCost, previous };
};

// A* algorithm with Manhattan distance heuristic for animation
export const dijkstraGraphAnimated = (startKey, endKey, nodes, edges) => {
  const gCost = new Map(); // Actual cost from start
  const fCost = new Map(); // Estimated total cost (g + h)
  const previous = new Map();
  const visited = new Set();
  const pq = new PriorityQueue();
  const animationSteps = [];
  const MAX_ANIMATION_STEPS = 1500;
  
  // Get start and end coordinates for heuristic calculation
  const startNode = nodes.get(startKey);
  const endNode = nodes.get(endKey);
  
  // Manhattan distance heuristic function
  const manhattanDistance = (nodeKey) => {
    const node = nodes.get(nodeKey);
    const distance = Math.abs(node.x - endNode.x) + Math.abs(node.y - endNode.y);
    
    // Make heuristic more conservative to give terrain weights more influence
    // This prevents the algorithm from being too aggressive about straight lines
    // and makes it more likely to consider terrain difficulty
    return distance * 0.8; // Reduced from 1.0 to make weights more influential
  };
  
  // Initialize costs
  for (const nodeKey of nodes.keys()) {
    gCost.set(nodeKey, Infinity);
    fCost.set(nodeKey, Infinity);
    previous.set(nodeKey, null);
  }
  
  // Set start costs
  gCost.set(startKey, 0);
  fCost.set(startKey, manhattanDistance(startKey));
  pq.enqueue(startKey, fCost.get(startKey));
  
  // Store initial step
  animationSteps.push({
    type: 'init',
    current: startKey,
    completed: false
  });
  
  let lastVisitedSize = 0;
  
  while (!pq.isEmpty() && animationSteps.length < MAX_ANIMATION_STEPS) {
    const { element: currentKey } = pq.dequeue();
    
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    
    // Reconstruct current path for animation
    const currentPath = reconstructGraphPath(previous, startKey, currentKey);
    
    animationSteps.push({
      type: 'explore',
      current: currentKey,
      visitedCount: visited.size,
      newVisited: visited.size - lastVisitedSize,
      currentPath: currentPath.length > 0 ? currentPath : [startKey],
      completed: false
    });
    
    lastVisitedSize = visited.size;
    
    // Check if we reached the goal
    if (currentKey === endKey) {
      animationSteps.push({
        type: 'complete',
        current: currentKey,
        visitedCount: visited.size,
        currentPath: currentPath,
        completed: true
      });
      break;
    }
    
    // Early termination optimization: if we're very close to target, prioritize direct path
    const currentNode = nodes.get(currentKey);
    const distanceToEnd = Math.abs(currentNode.x - endNode.x) + Math.abs(currentNode.y - endNode.y);
    if (distanceToEnd <= 3 && visited.size > 50) {
      // Close to target, reduce search scope for faster completion
      const maxNodesToExplore = Math.min(MAX_ANIMATION_STEPS, visited.size + 100);
      const newPQ = new PriorityQueue();
      for (const nodeKey of visited) {
        newPQ.enqueue(nodeKey, manhattanDistance(nodeKey));
      }
      pq.heap = newPQ.heap;
    }
    
    const connections = edges.get(currentKey) || new Set();
    
    for (const neighborKey of connections) {
      if (visited.has(neighborKey)) continue;
      
      const neighborNode = nodes.get(neighborKey);
      
      // Calculate movement cost (orthogonal vs diagonal)
      const dx = currentNode.x - neighborNode.x;
      const dy = currentNode.y - neighborNode.y;
      const movementCost = dx === 0 || dy === 0 ? 1 : 1.414; // sqrt(2) for diagonal
      
      // Calculate tentative g cost
      const tentativeGCost = gCost.get(currentKey) + movementCost * neighborNode.weight;
      
      // If this path to neighbor is better than previous paths
      if (tentativeGCost < gCost.get(neighborKey)) {
        previous.set(neighborKey, currentKey);
        gCost.set(neighborKey, tentativeGCost);
        
        // Calculate f cost with heuristic
        const hCost = manhattanDistance(neighborKey);
        const newFCost = tentativeGCost + hCost;
        fCost.set(neighborKey, newFCost);
        
        // Add to priority queue with f cost as priority
        pq.enqueue(neighborKey, newFCost);
      }
    }
  }
  
  return animationSteps;
};

// Reconstruct path for graph
export const reconstructGraphPath = (previous, startKey, endKey) => {
  const path = [];
  let current = endKey;
  
  while (current) {
    path.unshift(current);
    current = previous.get(current);
  }
  
  return path.length > 0 && path[0] === startKey ? path : [];
};

// Find shortest path in graph
export const findShortestGraphPath = (startKey, endKey, nodes, edges) => {
  if (!nodes.has(startKey) || !nodes.has(endKey)) {
    return { path: [], distance: Infinity, pathExists: false };
  }
  
  if (startKey === endKey) {
    return { path: [startKey], distance: 0, pathExists: true };
  }
  
  const { distances, previous } = dijkstraGraph(startKey, endKey, nodes, edges);
  const path = reconstructGraphPath(previous, startKey, endKey);
  
  return {
    path,
    distance: distances.get(endKey),
    pathExists: path.length > 0
  };
}; 