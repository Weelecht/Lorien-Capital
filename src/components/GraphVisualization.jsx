import React, { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

const GraphVisualization = ({ 
  position, 
  startPoint, 
  endPoint, 
  pathKeys, 
  graphData, 
  animationState, 
  gridWidth, 
  gridHeight, 
  isAnimating, 
  path 
}) => {
  const meshRefs = useRef([]);
  const skip = 2;

  const { nodes, edges } = graphData;

  // Calculate centering offset based on rectangular grid size - center at world origin
  const totalSizeWidth = (gridWidth - 1) * skip;
  const totalSizeHeight = (gridHeight - 1) * skip;
  const halfSizeWidth = totalSizeWidth / 2;
  const halfSizeHeight = totalSizeHeight / 2;

  // PERFORMANCE OPTIMIZATION: Shared geometries and materials
  const sharedGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  
  // Create shared materials for different node types
  const sharedMaterials = useMemo(() => ({
    default: new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.0,
      color: '#808080'
    }),
    start: new THREE.MeshStandardMaterial({
      color: '#00ff00',
      emissive: '#00ff00',
      emissiveIntensity: 1.0,
      roughness: 0.9,
      metalness: 0.0
    }),
    end: new THREE.MeshStandardMaterial({
      color: '#ff0000',
      emissive: '#ff0000',
      emissiveIntensity: 1.0,
      roughness: 0.9,
      metalness: 0.0
    }),
    current: new THREE.MeshStandardMaterial({
      color: '#aa00ff',
      emissive: '#aa00ff',
      emissiveIntensity: 1.5,
      roughness: 0.9,
      metalness: 0.0
    }),
    path: new THREE.MeshStandardMaterial({
      color: '#00ffff',
      emissive: '#ffffff',
      emissiveIntensity: 1.2,
      roughness: 0.9,
      metalness: 0.0
    }),
    completed: new THREE.MeshStandardMaterial({
      color: '#00ffff',
      emissive: '#ffffff',
      emissiveIntensity: 1.2,
      roughness: 0.9,
      metalness: 0.0
    })
  }), []);

  // PERFORMANCE OPTIMIZATION: Cache node size calculations
  const nodeSizeCache = useMemo(() => {
    const cache = new Map();
    for (const [nodeKey, node] of nodes.entries()) {
      const weight = node.weight;
      
      // WEIGHT TO SIZE MAPPING:
      // Higher weight = More difficult terrain = Larger, more imposing obstacles
      // Lower weight = Easier terrain = Smaller, less obstructive cubes
      
      const minWeight = 0.1;   // Easiest terrain (small cubes)
      const maxWeight = 25.0;  // Most difficult terrain (large cubes)
      const minSize = 0.4;     // Minimum cube width/depth for easy terrain
      const maxSize = 2.5;     // Maximum cube width/depth for difficult terrain
      const minHeight = 0.3;   // Minimum cube height for easy terrain  
      const maxHeight = 4.0;   // Maximum cube height for difficult terrain
      
      // Normalize weight to 0-1 range (0 = easiest, 1 = most difficult)
      const normalizedWeight = Math.max(0, Math.min(1, (weight - minWeight) / (maxWeight - minWeight)));
      
      // Apply curve for better visual distinction (makes differences more apparent)
      const curvedWeight = Math.pow(normalizedWeight, 0.8);
      
      // Calculate size: Higher weight → Larger size (more imposing obstacles)
      const size = minSize + (maxSize - minSize) * curvedWeight;
      const height = minHeight + (maxHeight - minHeight) * curvedWeight;
      
      cache.set(nodeKey, { 
        width: size, 
        depth: size, 
        height: height
      });
    }
    return cache;
  }, [nodes]);

  const getNodeSize = useCallback((nodeKey) => {
    return nodeSizeCache.get(nodeKey) || { width: 0.4, depth: 0.4, height: 0.3 };
  }, [nodeSizeCache]);

  // Create edge lines with dynamic styling - only show path edges for performance
  const edgeLines = useMemo(() => {
    const lines = [];
    
    // Show current path edges during animation, or completed path edges during pause
    let pathToShow = null;
    
    if (animationState && animationState.currentPath && animationState.currentPath.length >= 2) {
      // During animation - show current path
      pathToShow = animationState.currentPath;
    } else if (!isAnimating && path && path.length >= 2) {
      // During completion pause - show full completed path
      pathToShow = path;
    }
    
    if (!pathToShow || pathToShow.length < 2) {
      return lines;
    }
    
    // Only render edges for the path
    for (let i = 0; i < pathToShow.length - 1; i++) {
      const nodeKey1 = pathToShow[i];
      const nodeKey2 = pathToShow[i + 1];
      
      const node1 = nodes.get(nodeKey1);
      const node2 = nodes.get(nodeKey2);
      
      if (!node1 || !node2) continue;
      
      // Get cube heights for proper centering
      const startNodeSize = getNodeSize(nodeKey1);
      const endNodeSize = getNodeSize(nodeKey2);
      
      const startPos = [
        node1.x * skip - halfSizeWidth + position[0],
        node1.y * skip - halfSizeHeight + position[1],
        position[2] + startNodeSize.height / 2
      ];
      const endPos = [
        node2.x * skip - halfSizeWidth + position[0],
        node2.y * skip - halfSizeHeight + position[1],
        position[2] + endNodeSize.height / 2
      ];

      lines.push({
        id: `path-${nodeKey1}-${nodeKey2}`,
        points: [startPos, endPos],
        color: '#00ffff', // Always cyan for consistency
        opacity: 1.0,
        lineWidth: 3.5
      });
    }
    
    return lines;
  }, [nodes, position, skip, halfSizeWidth, halfSizeHeight, getNodeSize, animationState, isAnimating, path]);

  // PERFORMANCE OPTIMIZATION: Group nodes by material type to reduce state changes
  const nodeGroups = useMemo(() => {
    const groups = {
      critical: [], // Start, end, current nodes
      path: [],     // Path nodes
      completed: [], // Completed path nodes (yellow)
      terrain: []   // Regular terrain nodes
    };

    for (const [nodeKey, node] of nodes.entries()) {
      const nodeSize = getNodeSize(nodeKey);
      
      // Determine node type for material selection
      const isStart = startPoint && node.x === startPoint.x && node.y === startPoint.y;
      const isEnd = endPoint && node.x === endPoint.x && node.y === endPoint.y;
      const isCurrent = animationState && animationState.current === nodeKey;
      const isInCurrentPath = animationState && isAnimating && animationState.currentPath?.includes(nodeKey);
      const isInCompletedPath = !isAnimating && pathKeys?.has(nodeKey);
      
      const nodeData = {
        key: nodeKey,
        position: [
          node.x * skip - halfSizeWidth + position[0],
          node.y * skip - halfSizeHeight + position[1],
          position[2] + nodeSize.height / 2
        ],
        scale: [nodeSize.width, nodeSize.height, nodeSize.depth],
        nodeType: isStart ? 'start' : isEnd ? 'end' : isCurrent ? 'current' : 
                  isInCurrentPath ? 'path' : isInCompletedPath ? 'completed' : 'terrain',
        terrainColor: (() => {
          // Only calculate terrain color for terrain nodes
          if (isStart || isEnd || isCurrent || isInCurrentPath || isInCompletedPath) return null;
          
          const weight = node.weight;
          const minWeight = 0.1;
          const maxWeight = 25.0;
          const normalizedWeight = Math.max(0, Math.min(1, (weight - minWeight) / (maxWeight - minWeight)));
          const grayValue = Math.floor(255 * (1 - normalizedWeight));
          return `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        })()
      };

      if (isStart || isEnd || isCurrent) {
        groups.critical.push(nodeData);
      } else if (isInCurrentPath) {
        groups.path.push(nodeData);
      } else if (isInCompletedPath) {
        groups.completed.push(nodeData);
      } else {
        groups.terrain.push(nodeData);
      }
    }

    return groups;
  }, [nodes, getNodeSize, startPoint, endPoint, animationState, pathKeys, skip, halfSizeWidth, halfSizeHeight, position, isAnimating]);

  return (
    <>
      {/* Draw edges with dynamic styling */}
      {edgeLines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color={line.color}
          lineWidth={line.lineWidth}
          transparent
          opacity={line.opacity}
        />
      ))}
      
      {/* PERFORMANCE OPTIMIZATION: Render critical nodes with shadows */}
      {nodeGroups.critical.map((nodeData) => (
        <mesh
          key={nodeData.key}
          position={nodeData.position}
          scale={nodeData.scale}
          castShadow
          receiveShadow
          geometry={sharedGeometry}
          material={sharedMaterials[nodeData.nodeType]}
        />
      ))}
      
      {/* PERFORMANCE OPTIMIZATION: Render path nodes without shadows */}
      {nodeGroups.path.map((nodeData) => (
        <mesh
          key={nodeData.key}
          position={nodeData.position}
          scale={nodeData.scale}
          geometry={sharedGeometry}
          material={sharedMaterials.path}
        />
      ))}
      
      {/* PERFORMANCE OPTIMIZATION: Render completed path nodes */}
      {nodeGroups.completed.map((nodeData) => (
        <mesh
          key={nodeData.key}
          position={nodeData.position}
          scale={nodeData.scale}
          geometry={sharedGeometry}
          material={sharedMaterials.completed}
        />
      ))}
      
      {/* PERFORMANCE OPTIMIZATION: Render terrain nodes with dynamic colors */}
      {nodeGroups.terrain.map((nodeData) => (
        <mesh
          key={nodeData.key}
          position={nodeData.position}
          scale={nodeData.scale}
          geometry={sharedGeometry}
        >
          <meshStandardMaterial 
            color={nodeData.terrainColor}
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
      ))}
    </>
  );
};

export default GraphVisualization; 