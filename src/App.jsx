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

// Responsive camera component that adjusts to window size
const ResponsiveCamera = ({ target = [0, 0, 0], gridWidth, gridHeight }) => {
  const { camera, size } = useThree();
  
  useEffect(() => {
    // Calculate optimal camera distance to fit grid in viewport
    const aspectRatio = size.width / size.height;
    
    // Calculate the grid's actual world size
    const skip = 2;
    const worldWidth = (gridWidth - 1) * skip;
    const worldHeight = (gridHeight - 1) * skip;
    
    // Camera field of view
    const fov = 60; // degrees
    const fovRadians = (fov * Math.PI) / 180;
    
    // Calculate distance needed to fit the grid with some padding
    const padding = 1.1; // 10% padding around the grid
    
    // Calculate distance for height constraint
    const distanceForHeight = (worldHeight * padding) / (2 * Math.tan(fovRadians / 2));
    
    // Calculate distance for width constraint
    const distanceForWidth = (worldWidth * padding) / (2 * Math.tan(fovRadians / 2) * aspectRatio);
    
    // Use the larger distance to ensure full grid is visible
    let cameraDistance = Math.max(distanceForHeight, distanceForWidth);
    
    // Ensure reasonable distance bounds
    cameraDistance = Math.max(20, Math.min(150, cameraDistance));
    
    // Update camera position
    camera.position.set(0, 0, cameraDistance);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, size, target, gridWidth, gridHeight]);

  useFrame(() => {
    camera.lookAt(...target);
  });

  return null;
};

const GraphVisualization = ({ position, startPoint, endPoint, pathKeys, graphData, animationState, gridWidth, gridHeight, isAnimating, path }) => {
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
      
      // Update FPS every 2 seconds instead of every second for better performance
      if (currentTime >= lastTime.current + 2000) {
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
  // State to track window dimensions
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Calculate responsive grid dimensions based on viewport space (90% usage with 5% padding)
  const getResponsiveGridDimensions = () => {
    const aspectRatio = windowSize.width / windowSize.height;
    
    // Node spacing in world units
  const skip = 2;
    
    // Camera settings
    const fov = 60; // degrees
    const fovRadians = (fov * Math.PI) / 180;
    
    // Calculate optimal camera distance based on desired grid coverage
    // We want the grid to fill about 85% of the viewport
    const viewportCoverage = 0.85;
    
    // Calculate world dimensions that would fill the viewport at different camera distances
    // Start with a reasonable camera distance and work backwards
    let cameraDistance = 60; // Base distance
    
    // Calculate visible world dimensions at this distance
    const visibleHeight = 2 * Math.tan(fovRadians / 2) * cameraDistance * viewportCoverage;
    const visibleWidth = visibleHeight * aspectRatio;
    
    // Calculate grid dimensions that fit in this visible area
    let gridWidth = Math.floor(visibleWidth / skip);
    let gridHeight = Math.floor(visibleHeight / skip);
    
    // Ensure minimum dimensions for pathfinding
    gridWidth = Math.max(15, gridWidth);
    gridHeight = Math.max(15, gridHeight);
    
    // Ensure maximum dimensions for performance
    gridWidth = Math.min(50, gridWidth);
    gridHeight = Math.min(50, gridHeight);
    
    // Adjust for aspect ratio - make grid more rectangular to match screen
    if (aspectRatio > 1.5) {
      // Wide screen - make grid wider
      gridWidth = Math.min(60, Math.floor(gridWidth * 1.2));
    } else if (aspectRatio < 0.8) {
      // Tall screen - make grid taller
      gridHeight = Math.min(60, Math.floor(gridHeight * 1.2));
    }
    
    const totalNodes = gridWidth * gridHeight;
    
    return { gridWidth, gridHeight, totalNodes };
  };

  // Updated logic for responsive rectangular grid
  const skip = 2; // Node spacing in world units
  const { gridWidth, gridHeight, totalNodes } = getResponsiveGridDimensions();
  
  // Calculate perfect centering - grid should be centered at origin (0,0,0)
  const totalSizeWidth = (gridWidth - 1) * skip;
  const totalSizeHeight = (gridHeight - 1) * skip;
  const halfSizeWidth = totalSizeWidth / 2;
  const halfSizeHeight = totalSizeHeight / 2;
  const gridCenter = [0, 0, 0]; // Grid center at world origin

  // Generate graph structure for rectangular grid
  const [noiseSeed, setNoiseSeed] = useState(42);
  const [noiseDetail, setNoiseDetail] = useState(1.0 + Math.random() * 5.0); // Random initial detail: 1.0 to 6.0
  const graphData = useMemo(() => generateGraphStructure(gridWidth, gridHeight, noiseSeed, noiseDetail), [gridWidth, gridHeight, noiseSeed, noiseDetail]);

  // Pathfinding state
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [path, setPath] = useState([]);
  const [pathKeys, setPathKeys] = useState(new Set());

  // Animation state
  const [animationSteps, setAnimationSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(8); // Increased to 125 FPS for ultra-smooth animation
  const [animationState, setAnimationState] = useState(null);
  const [cycleCount, setCycleCount] = useState(0); // Track cycle number
  
  // Track if initial cycle has started to prevent re-triggering
  const initialCycleStarted = useRef(false);
  // Use ref to track animation steps to avoid dependency array issues
  const animationStepsRef = useRef([]);
  // Animation timing ref for smooth requestAnimationFrame
  const lastAnimationTime = useRef(0);

  // Window resize handler for responsiveness
  useEffect(() => {
    const handleResize = () => {
      // Update window size state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      
      // Force React Three Fiber to recalculate on resize
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    for (let x = 0; x < gridWidth; x++) {
      edgePoints.push({ x, y: 0 });
    }
    // Bottom edge
    for (let x = 0; x < gridWidth; x++) {
      edgePoints.push({ x, y: gridHeight - 1 });
    }
    // Left edge (excluding corners already added)
    for (let y = 1; y < gridHeight - 1; y++) {
      edgePoints.push({ x: 0, y });
    }
    // Right edge (excluding corners already added)
    for (let y = 1; y < gridHeight - 1; y++) {
      edgePoints.push({ x: gridWidth - 1, y });
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
          x: Math.floor(Math.random() * gridWidth),
          y: Math.floor(Math.random() * gridHeight)
        };
        endPoint = {
          x: Math.floor(Math.random() * gridWidth),
          y: Math.floor(Math.random() * gridHeight)
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
      { x: gridWidth - 1, y: 0 },
      { x: 0, y: gridHeight - 1 },
      { x: gridWidth - 1, y: gridHeight - 1 }
    ];
    
    const startCorner = corners[0]; // Top-left
    const endCorner = corners[3];   // Bottom-right
    
    return {
      start: startCorner,
      end: endCorner,
      distance: calculateDistance(startCorner.x, startCorner.y, endCorner.x, endCorner.y)
    };
  }, [gridWidth, gridHeight, calculateDistance]);

  // Function to start a new pathfinding cycle
  const startNewCycle = useCallback(() => {
    // Generate new random points
    const { start, end, distance } = generateRandomPoints();
    
    setCycleCount(prev => prev + 1);
    
    // Randomize terrain ONLY when generating new start/end points
    const newNoiseSeed = Math.floor(Math.random() * 1000) + 1;
    const newNoiseDetail = 1.0 + Math.random() * 5.0; // Range: 1.0 to 6.0 for more complex terrain
    
    setNoiseSeed(newNoiseSeed);
    setNoiseDetail(newNoiseDetail);
    
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
      // Create animation steps for smooth path progression
      const pathAnimationSteps = result.path.map((nodeKey, index) => ({
        type: 'pathProgress',
        current: nodeKey,
        currentPath: result.path.slice(0, index + 1),
        completed: index === result.path.length - 1,
        totalSteps: result.path.length
      }));
      
      setAnimationSteps(pathAnimationSteps);
      animationStepsRef.current = pathAnimationSteps;
      setCurrentStep(0);
      
      // Start animation immediately with first step
      setIsAnimating(true);
      setAnimationState({
        active: true,
        current: pathAnimationSteps[0].current,
        lastNode: null,
        currentPath: pathAnimationSteps[0].currentPath || [pathAnimationSteps[0].current],
        completed: pathAnimationSteps[0].completed
      });
    } else {
      // Try again immediately if no path found
      setTimeout(() => startNewCycle(), 100);
    }
  }, [generateRandomPoints, graphData.nodes, graphData.edges]);

  // Auto-cycle effect - only run once to start first cycle
  useEffect(() => {
    // Prevent re-triggering when terrain randomizes
    if (initialCycleStarted.current) return;
    
    const autoCycle = () => {
      // Mark that initial cycle has started
      initialCycleStarted.current = true;
      
      startNewCycle();
    };
    
    // Start first cycle immediately - only run once
    const initialTimer = setTimeout(autoCycle, 500);
    
    return () => clearTimeout(initialTimer);
  }, [startNewCycle]); // Use startNewCycle as dependency

  // Animation progression effect - Ultra smooth with requestAnimationFrame
  useEffect(() => {
    if (!isAnimating || animationStepsRef.current.length === 0) return;

    const nextStepIndex = currentStep + 1;
    
    const progressToNextStep = () => {
      if (nextStepIndex < animationStepsRef.current.length) {
        const step = animationStepsRef.current[nextStepIndex];
        
        // Always handle steps normally - no special completion handling
        setCurrentStep(nextStepIndex);
        setAnimationState({
          active: true,
          current: step.current,
          lastNode: animationStepsRef.current[currentStep].current,
          currentPath: step.currentPath || [step.current],
          completed: step.completed
        });
        
        // If this was the final step, smoothly transition to completion after a brief delay
        if (step.completed) {
          setTimeout(() => {
            setAnimationState({
              active: false,
              current: step.current,
              lastNode: step.current,
              currentPath: step.currentPath || [step.current],
              completed: true
            });
            setPathKeys(new Set(step.currentPath || []));
            setPath(step.currentPath || []);
            setIsAnimating(false);
            
            // Start next cycle after 3 seconds
            setTimeout(() => {
              startNewCycle();
            }, 3000);
          }, animationSpeed); // Small delay to show the final step
        }
      } else {
        // Animation is complete
        setIsAnimating(false);
      }
    };

    // Ultra-smooth animation using requestAnimationFrame
    let animationId;
    
    const smoothAnimate = (currentTime) => {
      if (currentTime - lastAnimationTime.current >= animationSpeed) {
        lastAnimationTime.current = currentTime;
        progressToNextStep();
      } else {
        // Continue animation loop
        animationId = requestAnimationFrame(smoothAnimate);
      }
    };
    
    // Start the smooth animation
    animationId = requestAnimationFrame(smoothAnimate);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isAnimating, currentStep, animationSpeed, startNewCycle]);

  // Calculate grid dimensions for lighting positioning
  const totalSizeForLightingWidth = (gridWidth - 1) * skip;
  const totalSizeForLightingHeight = (gridHeight - 1) * skip;
  const halfSizeForLightingWidth = totalSizeForLightingWidth / 2;
  const halfSizeForLightingHeight = totalSizeForLightingHeight / 2;

  return (
    <div className="Canvas-Container">
      <Canvas
        style={{ 
          backgroundColor: 'black',
          display: 'block',
          width: '100%',
          height: '100%'
        }}
        camera={{ 
          fov: 60,
          position: [0, 0, 80],
          near: 0.1,
          far: 1000
        }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) => {
          gl.setSize(window.innerWidth, window.innerHeight);
          // Optimize WebGL settings for performance
          gl.powerPreference = "high-performance";
          gl.antialias = false; // Disable for better performance
        }}
      >
        {/* Make camera look at grid center */}
        <ResponsiveCamera target={[0, 0, 0]} gridWidth={gridWidth} gridHeight={gridHeight} />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>

        {/* Very dark scene for fog of war effect */}
        <ambientLight intensity={0.04} />
        <directionalLight 
          position={[20, 20, 10]} 
          intensity={0.12} 
          color="#ffffff"
          castShadow
        />
        
        {/* Ground plane for shadows */}
        <mesh
          position={[0, 0, -1]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        
        {/* Dynamic torch lighting - follows path direction */}
        {animationState?.currentPath?.length > 1 && (() => {
          const currentIndex = animationState.currentPath.length - 1;
          const currentNodeKey = animationState.currentPath[currentIndex];
          
          const currentNode = graphData.nodes.get(currentNodeKey);
          if (!currentNode) return null;
          
          const torchX = currentNode.x * skip - halfSizeForLightingWidth;
          const torchY = currentNode.y * skip - halfSizeForLightingHeight;
          const torchZ = 4;
          
          return (
            <pointLight
              key="torch"
              position={[torchX, torchY, torchZ]}
              intensity={8.0}
              distance={15}
              decay={2}
              color="#aa00ff"
            />
          );
        })()}
        
        {/* Start and end point lights */}
        {startPoint && (
          <pointLight
            position={[
              startPoint.x * skip - halfSizeForLightingWidth,
              startPoint.y * skip - halfSizeForLightingHeight,
              2
            ]}
            intensity={2.0}
            distance={6}
            decay={2}
            color="#00ff00"
          />
        )}
        
        {endPoint && (
          <pointLight
            position={[
              endPoint.x * skip - halfSizeForLightingWidth,
              endPoint.y * skip - halfSizeForLightingHeight,
              2
            ]}
            intensity={2.0}
            distance={6}
            decay={2}
            color="#ff0000"
          />
        )}

        {/* Progressive path illumination - every third node during animation */}
        {animationState?.currentPath?.filter((_, index) => index % 3 === 0 || index === animationState.currentPath.length - 1).map((nodeKey, index) => {
          const node = graphData.nodes.get(nodeKey);
          if (!node) return null;
          
          // Skip start and end points
          const isStart = startPoint && node.x === startPoint.x && node.y === startPoint.y;
          const isEnd = endPoint && node.x === endPoint.x && node.y === endPoint.y;
          if (isStart || isEnd) return null;
          
          // Progressive lighting - every other node with consistent intensity
          const intensity = 2.8;
          
          return (
            <pointLight
              key={`progressiveLight-${nodeKey}`}
              position={[
                node.x * skip - halfSizeForLightingWidth,
                node.y * skip - halfSizeForLightingHeight,
                3.0
              ]}
              intensity={intensity}
              distance={8}
              decay={2}
              color="#ffffff"
            />
          );
        })}

        {/* Completed path illumination - all nodes with gradual brightness buildup */}
        {!isAnimating && path.length > 0 && pathKeys.size > 0 && path.map((nodeKey, index) => {
          const node = graphData.nodes.get(nodeKey);
          if (!node) return null;
          
          // Skip start and end points (they have their own lights)
          const isStart = startPoint && node.x === startPoint.x && node.y === startPoint.y;
          const isEnd = endPoint && node.x === endPoint.x && node.y === endPoint.y;
          if (isStart || isEnd) return null;
          
          // Gradual brightness buildup over 3 seconds
          const completionDuration = 3000; // 3 seconds
          const currentTime = Date.now();
          const cycleDuration = currentTime % (completionDuration + 500); // Add buffer for cycle timing
          const buildupProgress = Math.min(1.0, cycleDuration / completionDuration); // 0 to 1 over 3 seconds
          
          // Smooth easing function for more natural buildup
          const easedProgress = buildupProgress * buildupProgress * (3 - 2 * buildupProgress); // Smooth step
          
          // Path gradient: darker at start, brighter toward end
          const pathProgress = index / (path.length - 1); // 0 to 1
          
          // Gradually build from drawing intensity (2.8) to final gradient (2.0 to 5.0)
          const startIntensity = 2.8; // Same as drawing phase
          const targetBaseIntensity = 2.0 + (pathProgress * 3.0); // Final gradient target
          const currentBaseIntensity = startIntensity + (targetBaseIntensity - startIntensity) * easedProgress;
          
          // Add gentle pulsing effect that grows with the buildup
          const pulseEffect = Math.sin(Date.now() * 0.008 + index * 0.2) * (0.5 * easedProgress);
          const intensity = currentBaseIntensity + pulseEffect;
          
          return (
            <pointLight
              key={`completionLight-${nodeKey}`}
              position={[
                node.x * skip - halfSizeForLightingWidth,
                node.y * skip - halfSizeForLightingHeight,
                4.0
              ]}
              intensity={intensity}
              distance={10}
              decay={1.8}
              color="#ffffff" // White light to illuminate the terrain
            />
          );
        })}

        <OrbitControls />

        <GraphVisualization 
          position={[0, 0, 0]} 
          startPoint={startPoint}
          endPoint={endPoint}
          pathKeys={pathKeys}
          graphData={graphData}
          animationState={animationState}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          isAnimating={isAnimating}
          path={path}
        />
      </Canvas>

      <FPSCounter />
    </div>
  );
}
