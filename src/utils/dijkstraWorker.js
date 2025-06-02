// WebWorker for offloading Dijkstra computation
import { dijkstraGraphAnimated } from './dijkstra.js';

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'COMPUTE_DIJKSTRA':
        const { startKey, endKey, nodes, edges } = data;
        
        // Convert Map objects from transferable format
        const nodesMap = new Map(nodes);
        const edgesMap = new Map(edges.map(([key, connections]) => [key, new Set(connections)]));
        
        // Compute animation steps
        const animationSteps = dijkstraGraphAnimated(startKey, endKey, nodesMap, edgesMap);
        
        // Send result back to main thread
        self.postMessage({
          type: 'DIJKSTRA_COMPLETE',
          data: { animationSteps }
        });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'DIJKSTRA_ERROR',
      data: { error: error.message }
    });
  }
}; 