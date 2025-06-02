import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Environment,
  GizmoHelper,
  GizmoViewport,
  OrbitControls,
  AccumulativeShadows,
  RandomizedLight,
  Line
} from '@react-three/drei';
import { generateGraphStructure, dijkstraGraphAnimated, findShortestGraphPath, reconstructGraphPath } from './utils/dijkstra';
import './App.css';

const FollowTarget = ({ target }) => {
  const { camera } = useThree();

  useFrame(() => {
    camera.lookAt(...target);
  });

  return null;
};

const GraphVisualization = ({ position, onNodeClick, startPoint, endPoint, pathKeys, graphData, animationState }) => {
  const meshRefs = useRef([]);
  const skip = 2;

  const { nodes, edges } = graphData;

  // Calculate centering offset based on grid size - center at world origin
  const gridSize = Math.ceil(Math.sqrt(Array.from(nodes.keys()).length));
  const totalSize = (gridSize - 1) * skip;
  const halfSize = totalSize / 2;

  // Shared geometries and materials for performance
  const sharedGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sharedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.0,
  }), []);

  const getNodeColor = useCallback((nodeKey) => {
    const [x, y] = nodeKey.split(',').map(Number);
    
    // Check if this node is the start point - bright green emissive
    if (startPoint && x === startPoint.x && y === startPoint.y) {
      return { color: '#00ff00', emissive: '#003300', emissiveIntensity: 0.5 };
    }
    
    // Check if this node is the end point - bright red emissive
    if (endPoint && x === endPoint.x && y === endPoint.y) {
      return { color: '#ff0000', emissive: '#330000', emissiveIntensity: 0.5 };
    }
    
    // Animation states (only if animation is active)
    if (animationState && animationState.active) {
      // Current node being traversed - bright purple emissive
      if (animationState.current === nodeKey) {
        return { color: '#aa00ff', emissive: '#6600aa', emissiveIntensity: 0.8 };
      }
      
      // Path nodes already traversed - cyan emissive
      if (animationState.currentPath && animationState.currentPath.includes(nodeKey)) {
        return { color: '#00ffff', emissive: '#00aaaa', emissiveIntensity: 0.8 };
      }
    } else {
      // Static mode - show final path with yellow emissive
      if (pathKeys && pathKeys.has(nodeKey)) {
        return { color: '#ffff00', emissive: '#aaaa00', emissiveIntensity: 0.8 };
      }
    }
    
    // Default terrain cubes - grayscale based on weight, no emissive
    const node = nodes.get(nodeKey);
    const weight = node ? node.weight : 1;
    
    // Map weight to grayscale (easy terrain = white, difficult = black)
    const minWeight = 0.1;
    const maxWeight = 25.0;
    const normalizedWeight = Math.max(0, Math.min(1, (weight - minWeight) / (maxWeight - minWeight)));
    
    // Invert so low weight = light color, high weight = dark color
    const grayValue = Math.floor(255 * (1 - normalizedWeight));
    const grayColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    
    return { 
      color: grayColor,
      emissive: '#000000',
      emissiveIntensity: 0
    };
  }, [startPoint, endPoint, pathKeys, nodes, animationState]);

  const getNodeSize = useCallback((nodeKey) => {
    const node = nodes.get(nodeKey);
    const weight = node ? node.weight : 1;
    
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
    
    return { 
      width: size, 
      depth: size, 
      height: height,
      // Debug info for verification
      originalWeight: weight,
      normalizedWeight: normalizedWeight
    };
  }, [nodes]);

  const handleNodeClick = useCallback((event, nodeKey) => {
    event.stopPropagation();
    const [x, y] = nodeKey.split(',').map(Number);
    onNodeClick(x, y, nodeKey);
  }, [onNodeClick]);

  // Get edge color based on animation state
  const getEdgeColor = useCallback((nodeKey1, nodeKey2) => {
    if (!animationState || !animationState.active) {
      // Static mode - show final path edges with bright yellow
      if (pathKeys && pathKeys.has(nodeKey1) && pathKeys.has(nodeKey2)) {
        const pathArray = Array.from(pathKeys);
        const index1 = pathArray.indexOf(nodeKey1);
        const index2 = pathArray.indexOf(nodeKey2);
        if (Math.abs(index1 - index2) === 1) {
          return { color: '#ffff00', opacity: 1.0, lineWidth: 3 };
        }
      }
      return { color: '#333333', opacity: 0.3, lineWidth: 0.5 };
    }

    // Animation mode - only show current path progression
    if (animationState.currentPath && animationState.currentPath.length > 1) {
      const currentPathArray = animationState.currentPath;
      
      // Check if both nodes are in the current path and are consecutive
      for (let i = 0; i < currentPathArray.length - 1; i++) {
        const currentNode = currentPathArray[i];
        const nextNode = currentPathArray[i + 1];
        
        if ((nodeKey1 === currentNode && nodeKey2 === nextNode) ||
            (nodeKey1 === nextNode && nodeKey2 === currentNode)) {
          return { color: '#00ffff', opacity: 1.0, lineWidth: 3.5 };
        }
      }
    }

    // Current traversal edge - bright purple
    if (animationState.current && animationState.lastNode) {
      if ((nodeKey1 === animationState.current && nodeKey2 === animationState.lastNode) ||
          (nodeKey2 === animationState.current && nodeKey1 === animationState.lastNode)) {
        return { color: '#aa00ff', opacity: 1.0, lineWidth: 2.5 };
      }
    }

    // Default edge appearance - very dim
    return { color: '#222222', opacity: 0.2, lineWidth: 0.5 };
  }, [animationState, pathKeys]);

  // Create edge lines with dynamic styling - only show path edges for performance
  const edgeLines = useMemo(() => {
    const lines = [];
    
    // MAJOR PERFORMANCE OPTIMIZATION: Only show current path edges
    // This reduces from ~2000+ edges to ~50-100 edges maximum
    if (!animationState || !animationState.currentPath || animationState.currentPath.length < 2) {
      return lines;
    }
    
    const currentPath = animationState.currentPath;
    
    // Only render edges for the current path progression
    for (let i = 0; i < currentPath.length - 1; i++) {
      const nodeKey1 = currentPath[i];
      const nodeKey2 = currentPath[i + 1];
      
      const node1 = nodes.get(nodeKey1);
      const node2 = nodes.get(nodeKey2);
      
      if (!node1 || !node2) continue;
      
      // Get cube heights for proper centering
      const startNodeSize = getNodeSize(nodeKey1);
      const endNodeSize = getNodeSize(nodeKey2);
      
      const startPos = [
        node1.x * skip - halfSize + position[0],
        node1.y * skip - halfSize + position[1],
        position[2] + startNodeSize.height / 2
      ];
      const endPos = [
        node2.x * skip - halfSize + position[0],
        node2.y * skip - halfSize + position[1],
        position[2] + endNodeSize.height / 2
      ];

      lines.push({
        id: `path-${nodeKey1}-${nodeKey2}`,
        points: [startPos, endPos],
        color: '#00ffff',
        opacity: 1.0,
        lineWidth: 3.5
      });
    }
    
    return lines;
  }, [nodes, position, skip, halfSize, getNodeSize, animationState]);

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
      
      {/* Draw all nodes with optimized rendering */}
      {Array.from(nodes.entries()).map(([nodeKey, node], index) => {
        const nodeSize = getNodeSize(nodeKey);
        const nodeColor = getNodeColor(nodeKey);
        
        // Only important nodes cast/receive shadows for performance
        const isImportant = (startPoint && node.x === startPoint.x && node.y === startPoint.y) ||
                           (endPoint && node.x === endPoint.x && node.y === endPoint.y) ||
                           (animationState && animationState.current === nodeKey) ||
                           (pathKeys && pathKeys.has(nodeKey));
        
        return (
          <mesh
            key={nodeKey}
            position={[
              node.x * skip - halfSize + position[0],
              node.y * skip - halfSize + position[1],
              position[2] + nodeSize.height / 2 // Elevate mesh by half height to sit on ground
            ]}
            onClick={(event) => handleNodeClick(event, nodeKey)}
            scale={[nodeSize.width, nodeSize.height, nodeSize.depth]}
          >
            <primitive object={sharedGeometry} />
            <meshStandardMaterial 
              color={nodeColor.color || nodeColor}
              emissive={nodeColor.emissive || '#000000'}
              emissiveIntensity={nodeColor.emissiveIntensity || 0}
              roughness={0.9}
              metalness={0.0}
              receiveShadow={isImportant}
              castShadow={isImportant}
            />
          </mesh>
        );
      })}
    </>
  );
};

// FPS Counter Component
const FPSCounter = () => {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const animationId = useRef();

  useEffect(() => {
    const updateFPS = () => {
      frameCount.current++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime.current + 1000) {
        setFps(Math.round((frameCount.current * 1000) / (currentTime - lastTime.current)));
        frameCount.current = 0;
        lastTime.current = currentTime;
      }
      
      animationId.current = requestAnimationFrame(updateFPS);
    };
    
    animationId.current = requestAnimationFrame(updateFPS);
    
    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      color: '#00ff00',
      padding: '4px 8px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      fontWeight: 'bold'
    }}>
      {fps} FPS
    </div>
  );
};

export default function App() {
  // Performance-aware grid sizing
  const getOptimalGridSize = () => {
    // Reduced size for better performance (750 nodes = ~27x27 grid)
    return 750; // Reduced from 1000 to improve FPS
  };

  // Updated logic for perfectly centered grid
  const skip = 2;
  const count = getOptimalGridSize(); // Performance-aware grid size
  const gridSize = Math.ceil(Math.sqrt(count));
  
  // Calculate perfect centering - grid should be centered at origin (0,0,0)
  const totalSize = (gridSize - 1) * skip;
  const halfSize = totalSize / 2;
  const gridCenter = [0, 0, 0]; // Grid center at world origin

  // Generate graph structure instead of terrain weights
  const [noiseSeed, setNoiseSeed] = useState(42);
  const [noiseDetail, setNoiseDetail] = useState(4.0); // Increased default for more detailed terrain
  const graphData = useMemo(() => generateGraphStructure(gridSize, noiseSeed, noiseDetail), [gridSize, noiseSeed, noiseDetail]);

  // Pathfinding state
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [path, setPath] = useState([]);
  const [pathKeys, setPathKeys] = useState(new Set());

  // Animation state
  const [animationSteps, setAnimationSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(25); // Faster default speed
  const [animationState, setAnimationState] = useState(null);
  const [cycleCount, setCycleCount] = useState(0); // Track cycle number
  
  // Track if initial cycle has started to prevent re-triggering
  const initialCycleStarted = useRef(false);

  // Calculate Manhattan distance between two points
  const calculateDistance = useCallback((x1, y1, x2, y2) => {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }, []);

  // Generate random start and end points with minimum distance
  const generateRandomPoints = useCallback(() => {
    const minDistance = 50; // Minimum 50 nodes apart
    const maxAttempts = 100; // Prevent infinite loops
    
    // Create arrays of edge points for better pathfinding challenges
    const edgePoints = [];
    
    // Top edge
    for (let x = 0; x < gridSize; x++) {
      edgePoints.push({ x, y: 0 });
    }
    // Bottom edge
    for (let x = 0; x < gridSize; x++) {
      edgePoints.push({ x, y: gridSize - 1 });
    }
    // Left edge (excluding corners already added)
    for (let y = 1; y < gridSize - 1; y++) {
      edgePoints.push({ x: 0, y });
    }
    // Right edge (excluding corners already added)
    for (let y = 1; y < gridSize - 1; y++) {
      edgePoints.push({ x: gridSize - 1, y });
    }
    
    // Try edge points first (80% chance), then fallback to any points
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let startPoint, endPoint;
      
      if (attempt < maxAttempts * 0.8) {
        // Prefer edge points for more challenging pathfinding
        startPoint = edgePoints[Math.floor(Math.random() * edgePoints.length)];
        endPoint = edgePoints[Math.floor(Math.random() * edgePoints.length)];
      } else {
        // Fallback to any points
        startPoint = {
          x: Math.floor(Math.random() * gridSize),
          y: Math.floor(Math.random() * gridSize)
        };
        endPoint = {
          x: Math.floor(Math.random() * gridSize),
          y: Math.floor(Math.random() * gridSize)
        };
      }
      
      const distance = calculateDistance(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
      
      if (distance >= minDistance) {
        return {
          start: startPoint,
          end: endPoint,
          distance
        };
      }
    }
    
    // Final fallback: use opposite corners if no valid pair found
    const corners = [
      { x: 0, y: 0 },
      { x: gridSize - 1, y: 0 },
      { x: 0, y: gridSize - 1 },
      { x: gridSize - 1, y: gridSize - 1 }
    ];
    
    const startCorner = corners[0]; // Top-left
    const endCorner = corners[3];   // Bottom-right
    
    return {
      start: startCorner,
      end: endCorner,
      distance: calculateDistance(startCorner.x, startCorner.y, endCorner.x, endCorner.y)
    };
  }, [gridSize, calculateDistance]);

  // Auto-cycle effect - only run once to start first cycle
  useEffect(() => {
    // Prevent re-triggering when terrain randomizes
    if (initialCycleStarted.current) return;
    
    const autoCycle = () => {
      // Mark that initial cycle has started
      initialCycleStarted.current = true;
      
      // Generate new random points
      const { start, end, distance } = generateRandomPoints();
      
      setCycleCount(1);
      console.log(`🎯 Cycle 1: Random path (${start.x}, ${start.y}) → (${end.x}, ${end.y}), Distance: ${distance} nodes`);
      
      // Set the new points
      setStartPoint(start);
      setEndPoint(end);
      
      const startKey = `${start.x},${start.y}`;
      const endKey = `${end.x},${end.y}`;
      
      // Calculate the optimal path
      const result = findShortestGraphPath(startKey, endKey, graphData.nodes, graphData.edges);
      
      if (result.pathExists && result.path.length > 0) {
        // Create animation steps for the path progression
        const pathAnimationSteps = result.path.map((nodeKey, index) => ({
          type: 'pathProgress',
          current: nodeKey,
          pathSoFar: result.path.slice(0, index + 1),
          completed: index === result.path.length - 1,
          totalSteps: result.path.length
        }));
        
        setAnimationSteps(pathAnimationSteps);
        setCurrentStep(0);
        
        // Start animation immediately
        setIsAnimating(true);
        setAnimationState({
          active: true,
          current: null,
          lastNode: null,
          currentPath: [],
          completed: false
        });
        
        console.log(`✅ A* found optimal path! Length: ${result.path.length} nodes, Cost: ${result.distance.toFixed(2)}`);
        
        // Debug: Show weight-to-size mapping examples
        const sampleNodes = Array.from(graphData.nodes.entries()).slice(0, 5);
        console.log('🔍 Weight-to-Size Mapping Examples:');
        sampleNodes.forEach(([nodeKey, node]) => {
          const nodeSize = getNodeSize(nodeKey);
          console.log(`  Node ${nodeKey}: Weight ${node.weight.toFixed(2)} → Size ${nodeSize.width.toFixed(2)}x${nodeSize.height.toFixed(2)}`);
        });
      } else {
        console.log('❌ No path found, generating new random points...');
        // Try again immediately if no path found
        setTimeout(autoCycle, 100);
      }
    };
    
    // Start first cycle immediately - only run once
    const initialTimer = setTimeout(autoCycle, 500);
    
    return () => clearTimeout(initialTimer);
  }, [graphData, generateRandomPoints]); // Keep dependencies but use ref to prevent re-runs

  // Animation progression effect
  useEffect(() => {
    if (!isAnimating || animationSteps.length === 0) return;

    const timer = setTimeout(() => {
      if (currentStep < animationSteps.length - 1) {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        
        const step = animationSteps[nextStep];
        
        setAnimationState({
          active: true,
          current: step.current,
          lastNode: currentStep > 0 ? animationSteps[currentStep].current : null,
          currentPath: step.pathSoFar,
          completed: step.completed
        });

        // If animation completed, show final path and schedule next cycle
        if (step.completed) {
          setPathKeys(new Set(step.pathSoFar));
          setPath(step.pathSoFar);
          setIsAnimating(false);
          
          // Randomize terrain for next cycle - only when path is fully completed
          const newNoiseSeed = Math.floor(Math.random() * 1000) + 1;
          const newNoiseDetail = 2.0 + Math.random() * 4.0; // Range: 2.0 to 6.0 for more complex terrain
          
          console.log(`🌍 Terrain randomized - Seed: ${newNoiseSeed}, Detail: ${newNoiseDetail.toFixed(2)}`);
          
          setNoiseSeed(newNoiseSeed);
          setNoiseDetail(newNoiseDetail);
          
          // Wait 3 seconds then start next cycle
          setTimeout(() => {
            // Increment cycle count
            setCycleCount(prev => prev + 1);
            
            const { start, end, distance } = generateRandomPoints();
            
            console.log(`🎯 Cycle ${cycleCount + 1}: Random path (${start.x}, ${start.y}) → (${end.x}, ${end.y}), Distance: ${distance} nodes`);
            
            // Reset states
            setPath([]);
            setPathKeys(new Set());
            setAnimationState(null);
            
            // Set new points
            setStartPoint(start);
            setEndPoint(end);
            
            const startKey = `${start.x},${start.y}`;
            const endKey = `${end.x},${end.y}`;
            
            // Calculate new path
            const result = findShortestGraphPath(startKey, endKey, graphData.nodes, graphData.edges);
            
            if (result.pathExists && result.path.length > 0) {
              const pathAnimationSteps = result.path.map((nodeKey, index) => ({
                type: 'pathProgress',
                current: nodeKey,
                pathSoFar: result.path.slice(0, index + 1),
                completed: index === result.path.length - 1,
                totalSteps: result.path.length
              }));
              
              setAnimationSteps(pathAnimationSteps);
              setCurrentStep(0);
              setIsAnimating(true);
              setAnimationState({
                active: true,
                current: null,
                lastNode: null,
                currentPath: [],
                completed: false
              });
              
              console.log(`✅ A* found optimal path! Length: ${result.path.length} nodes, Cost: ${result.distance.toFixed(2)}`);
            } else {
              console.log('❌ No path found, generating new random points...');
              // Try again with new points if no path found
              setTimeout(() => {
                const retryPoints = generateRandomPoints();
                setStartPoint(retryPoints.start);
                setEndPoint(retryPoints.end);
              }, 100);
            }
          }, 3000);
        }
      } else {
        setIsAnimating(false);
      }
    }, animationSpeed);

    return () => clearTimeout(timer);
  }, [isAnimating, currentStep, animationSteps, animationSpeed, generateRandomPoints, graphData, cycleCount]);

  // Remove manual click handlers - now automated
  const handleNodeClick = useCallback(() => {
    // Disabled - automatic mode
  }, []);

  // Calculate grid dimensions for lighting positioning
  const totalSizeForLighting = (gridSize - 1) * skip;
  const halfSizeForLighting = totalSizeForLighting / 2;

  return (
    <div className="Canvas-Container">
      {/* Automatic Pathfinding Demo Controls */}
      {animationSteps.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          left: 8, 
          zIndex: 1000, 
          background: 'rgba(255,255,255,0.95)', 
          padding: '8px',
          borderRadius: '6px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          minWidth: '200px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold' }}>Automatic A* Demo</h4>
          <div style={{ marginBottom: '6px' }}>
            <button 
              onClick={() => setIsAnimating(true)} 
              disabled={isAnimating}
              style={{ marginRight: '3px', padding: '2px 6px', fontSize: '10px' }}
            >
              Resume
            </button>
            <button 
              onClick={() => setIsAnimating(false)} 
              disabled={!isAnimating}
              style={{ marginRight: '3px', padding: '2px 6px', fontSize: '10px' }}
            >
              Pause
            </button>
          </div>
          <div style={{ marginBottom: '5px' }}>
            <label style={{ display: 'block', marginBottom: '1px', fontSize: '10px' }}>Speed:</label>
            <input 
              type="range" 
              min="1" 
              max="200" 
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(Number(e.target.value))}
              style={{ width: '120px', height: '16px' }}
            />
            <span style={{ marginLeft: '4px', fontSize: '9px' }}>
              {animationSpeed}ms
            </span>
          </div>
          {startPoint && endPoint && (
            <div style={{ fontSize: '9px', color: '#666', marginBottom: '4px' }}>
              <div>Start: ({startPoint.x}, {startPoint.y})</div>
              <div>End: ({endPoint.x}, {endPoint.y})</div>
              <div>Distance: {calculateDistance(startPoint.x, startPoint.y, endPoint.x, endPoint.y)} nodes</div>
            </div>
          )}
          {animationSteps.length > 0 && (
            <div style={{ fontSize: '9px', color: '#666', marginTop: '4px' }}>
              <div style={{ marginBottom: '2px' }}>Progress: {currentStep + 1} / {animationSteps.length}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                <span><span style={{color: 'green'}}>●</span>Start</span>
                <span><span style={{color: 'red'}}>●</span>End</span>
                <span><span style={{color: '#aa00ff'}}>●</span>Current</span>
                <span><span style={{color: 'cyan'}}>●</span>Traversed</span>
                <span><span style={{color: 'yellow'}}>●</span>Complete</span>
              </div>
              <div style={{ fontSize: '8px', color: '#999', marginTop: '2px' }}>
                Auto-cycling every path completion...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading message when no animation yet */}
      {animationSteps.length === 0 && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          left: 8, 
          zIndex: 1000, 
          background: 'rgba(255,255,255,0.95)', 
          padding: '8px',
          borderRadius: '6px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          minWidth: '200px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 'bold' }}>Initializing A* Demo</h4>
          <div style={{ fontSize: '9px', color: '#666' }}>
            Generating random start/end points...
          </div>
        </div>
      )}

      <Canvas
        style={{ backgroundColor: 'black' }}
        camera={{ position: [0, 0, 80], fov: 60 }}
      >
        {/* Make camera look at grid center */}
        <FollowTarget target={[0, 0, 0]} />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* Very dark scene for fog of war effect */}
        <ambientLight intensity={0.01} />
        <directionalLight 
          position={[20, 20, 10]} 
          intensity={0.02} 
          color="#ffffff"
        />
        
        {/* Dynamic torch lighting - follows path direction */}
        {animationState && animationState.currentPath && animationState.currentPath.length > 1 && (
          (() => {
            const currentIndex = animationState.currentPath.length - 1;
            const currentNodeKey = animationState.currentPath[currentIndex];
            const previousNodeKey = animationState.currentPath[currentIndex - 1];
            
            const currentNode = graphData.nodes.get(currentNodeKey);
            const previousNode = graphData.nodes.get(previousNodeKey);
            
            if (!currentNode || !previousNode) return null;
            
            // Calculate movement direction
            const directionX = currentNode.x - previousNode.x;
            const directionY = currentNode.y - previousNode.y;
            
            // Normalize direction and create torch position slightly ahead
            const length = Math.sqrt(directionX * directionX + directionY * directionY);
            const normalizedX = length > 0 ? directionX / length : 0;
            const normalizedY = length > 0 ? directionY / length : 1; // Default forward if no movement
            
            const torchX = currentNode.x * skip - halfSizeForLighting;
            const torchY = currentNode.y * skip - halfSizeForLighting;
            const torchZ = 4; // Higher up like holding a torch
            
            // Target position ahead in movement direction
            const targetX = torchX + normalizedX * 3;
            const targetY = torchY + normalizedY * 3;
            const targetZ = 0;
            
            return (
              <>
                {/* Main torch spot light */}
                <spotLight
                  position={[torchX, torchY, torchZ]}
                  target-position={[targetX, targetY, targetZ]}
                  angle={Math.PI / 3} // 60 degree cone
                  penumbra={0.3}
                  intensity={8.0}
                  distance={12}
                  decay={1.5}
                  color="#aa00ff" // Purple to match current head node
                  castShadow
                />
                
                {/* Ambient torch glow around current position */}
                <pointLight
                  position={[torchX, torchY, torchZ - 1]}
                  intensity={2.0}
                  distance={6}
                  decay={2}
                  color="#aa00ff" // Purple glow to match current head
                />
              </>
            );
          })()
        )}
        
        {/* Start and end point lights */}
        {startPoint && (
          <pointLight
            position={[
              startPoint.x * skip - halfSizeForLighting,
              startPoint.y * skip - halfSizeForLighting,
              2
            ]}
            intensity={1.5}
            distance={5}
            decay={2}
            color="#00ff00" // Green to match start point
          />
        )}
        
        {endPoint && (
          <pointLight
            position={[
              endPoint.x * skip - halfSizeForLighting,
              endPoint.y * skip - halfSizeForLighting,
              2
            ]}
            intensity={1.5}
            distance={5}
            decay={2}
            color="#ff0000" // Red to match end point
          />
        )}

        {/* Optimized path lights - restore trail while maintaining performance */}
        {animationState && animationState.currentPath && animationState.currentPath.length > 0 && (() => {
          const maxLights = 12; // Increased from 8 to 12 for better trail
          const currentPath = animationState.currentPath;
          const currentIndex = currentPath.length - 1;
          
          // Create sliding window of recent nodes
          const startIndex = Math.max(0, currentIndex - maxLights + 1);
          const recentNodes = currentPath.slice(startIndex, currentIndex + 1);
          
          return recentNodes.map((nodeKey, index) => {
            const node = graphData.nodes.get(nodeKey);
            if (!node) return null;
            
            // Skip start and end points as they have their own lights
            const isStart = startPoint && node.x === startPoint.x && node.y === startPoint.y;
            const isEnd = endPoint && node.x === endPoint.x && node.y === endPoint.y;
            if (isStart || isEnd) return null;
            
            const isCurrentNode = nodeKey === animationState.current;
            const nodeAge = recentNodes.length - 1 - index; // 0 = current, higher = older
            
            // Render trail lights for more nodes (up to 8-10 recent nodes)
            if (nodeAge > 8) return null;
            
            // Intensity fades with age for nice trail effect
            let lightIntensity;
            let lightColor;
            
            if (isCurrentNode) {
              lightIntensity = 2.5; // Brightest for current
              lightColor = "#aa00ff"; // Purple for current
            } else {
              // Gradual fade for trail effect
              lightIntensity = Math.max(0.3, 2.0 - (nodeAge * 0.2));
              lightColor = "#00ffff"; // Cyan for trail
            }
            
            return (
              <pointLight
                key={`optimizedPathLight-${nodeKey}-${index}`}
                position={[
                  node.x * skip - halfSizeForLighting,
                  node.y * skip - halfSizeForLighting,
                  2
                ]}
                intensity={lightIntensity}
                distance={isCurrentNode ? 7 : 5}
                decay={2}
                color={lightColor}
              />
            );
          });
        })()}

        <OrbitControls />

        <GraphVisualization 
          position={[0, 0, 0]} 
          onNodeClick={handleNodeClick}
          startPoint={startPoint}
          endPoint={endPoint}
          pathKeys={pathKeys}
          graphData={graphData}
          animationState={animationState}
        />
      </Canvas>

      <FPSCounter />
    </div>
  );
}
