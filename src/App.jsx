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

const GraphVisualization = ({ position, startPoint, endPoint, pathKeys, graphData, animationState, getNodeColor, gridWidth, gridHeight }) => {
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
  const defaultMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.0
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
        color: '#00ffff',
        opacity: 1.0,
        lineWidth: 3.5
      });
    }
    
    return lines;
  }, [nodes, position, skip, halfSizeWidth, halfSizeHeight, getNodeSize, animationState]);

  // PERFORMANCE OPTIMIZATION: Group nodes by material type to reduce state changes
  const nodeGroups = useMemo(() => {
    const groups = {
      critical: [], // Start, end, current nodes
      path: [],     // Path nodes
      terrain: []   // Regular terrain nodes
    };

    for (const [nodeKey, node] of nodes.entries()) {
      const nodeSize = getNodeSize(nodeKey);
      const nodeColor = getNodeColor(nodeKey);
      
      // Determine if this is a critical node (needs shadows and special treatment)
      const isCritical = (startPoint && node.x === startPoint.x && node.y === startPoint.y) ||
                        (endPoint && node.x === endPoint.x && node.y === endPoint.y) ||
                        (animationState && animationState.current === nodeKey);
      
      const nodeData = {
        key: nodeKey,
        position: [
          node.x * skip - halfSizeWidth + position[0],
          node.y * skip - halfSizeHeight + position[1],
          position[2] + nodeSize.height / 2
        ],
        scale: [nodeSize.width, nodeSize.height, nodeSize.depth],
        color: nodeColor.color || nodeColor,
        emissive: nodeColor.emissive || '#000000',
        emissiveIntensity: nodeColor.emissiveIntensity || 0
      };

      if (isCritical) {
        groups.critical.push(nodeData);
      } else if (animationState?.currentPath?.includes(nodeKey) || pathKeys?.has(nodeKey)) {
        groups.path.push(nodeData);
      } else {
        groups.terrain.push(nodeData);
      }
    }

    return groups;
  }, [nodes, getNodeSize, getNodeColor, startPoint, endPoint, animationState, pathKeys, skip, halfSizeWidth, halfSizeHeight, position]);

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
        >
          <meshStandardMaterial 
            color={nodeData.color}
            emissive={nodeData.emissive}
            emissiveIntensity={nodeData.emissiveIntensity}
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
      ))}
      
      {/* PERFORMANCE OPTIMIZATION: Render path nodes without shadows */}
      {nodeGroups.path.map((nodeData) => (
        <mesh
          key={nodeData.key}
          position={nodeData.position}
          scale={nodeData.scale}
          geometry={sharedGeometry}
        >
          <meshStandardMaterial 
            color={nodeData.color}
            emissive={nodeData.emissive}
            emissiveIntensity={nodeData.emissiveIntensity}
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
      ))}
      
      {/* PERFORMANCE OPTIMIZATION: Render terrain nodes without shadows or emissive */}
      {nodeGroups.terrain.map((nodeData) => (
        <mesh
          key={nodeData.key}
          position={nodeData.position}
          scale={nodeData.scale}
          geometry={sharedGeometry}
          material={defaultMaterial}
        >
          <meshStandardMaterial 
            color={nodeData.color}
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
  const [noiseDetail, setNoiseDetail] = useState(4.0); // Increased default for more detailed terrain
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
  const [animationSpeed, setAnimationSpeed] = useState(10); // Very fast animation speed
  const [animationState, setAnimationState] = useState(null);
  const [cycleCount, setCycleCount] = useState(0); // Track cycle number
  
  // Track if initial cycle has started to prevent re-triggering
  const initialCycleStarted = useRef(false);

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
      
      // Set the new points
      setStartPoint(start);
      setEndPoint(end);
      
      const startKey = `${start.x},${start.y}`;
      const endKey = `${end.x},${end.y}`;
      
      // Calculate the optimal path
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
      } else {
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
          currentPath: step.currentPath || [step.current],
          completed: step.completed
        });

        // If animation completed, show final path and schedule next cycle
        if (step.completed) {
          setPathKeys(new Set(step.currentPath || []));
          setPath(step.currentPath || []);
          setIsAnimating(false);
          
          // Wait 3 seconds then start next cycle (terrain will change when new points are set)
          setTimeout(() => {
            // Increment cycle count
            setCycleCount(prev => prev + 1);
            
            // Randomize terrain ONLY when generating new start/end points
            const newNoiseSeed = Math.floor(Math.random() * 1000) + 1;
            const newNoiseDetail = 2.0 + Math.random() * 4.0; // Range: 2.0 to 6.0 for more complex terrain
            
            setNoiseSeed(newNoiseSeed);
            setNoiseDetail(newNoiseDetail);
            
            const { start, end, distance } = generateRandomPoints();
            
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
            } else {
              // Try again immediately if no path found
              setTimeout(autoCycle, 100);
            }
          }, 3000);
        }
      } else {
        setIsAnimating(false);
      }
    }, animationSpeed);

    return () => clearTimeout(timer);
  }, [isAnimating, currentStep, animationSteps, animationSpeed, generateRandomPoints, graphData, cycleCount]);

  // Calculate grid dimensions for lighting positioning
  const totalSizeForLightingWidth = (gridWidth - 1) * skip;
  const totalSizeForLightingHeight = (gridHeight - 1) * skip;
  const halfSizeForLightingWidth = totalSizeForLightingWidth / 2;
  const halfSizeForLightingHeight = totalSizeForLightingHeight / 2;

  // Shared function to get node colors for both visualization and lighting
  const getNodeColor = useCallback((nodeKey) => {
    const [x, y] = nodeKey.split(',').map(Number);
    
    // Check if this node is the start point - bright green emissive
    if (startPoint && x === startPoint.x && y === startPoint.y) {
      return { color: '#00ff00', emissive: '#00ff00', emissiveIntensity: 1.0 };
    }
    
    // Check if this node is the end point - bright red emissive
    if (endPoint && x === endPoint.x && y === endPoint.y) {
      return { color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 1.0 };
    }
    
    // Animation states (only if animation is active)
    if (animationState && animationState.active) {
      // Current node being traversed - bright purple emissive
      if (animationState.current === nodeKey) {
        return { color: '#aa00ff', emissive: '#aa00ff', emissiveIntensity: 1.5 };
      }
      
      // Path nodes already traversed - cyan emissive
      if (animationState.currentPath && animationState.currentPath.includes(nodeKey)) {
        return { color: '#00ffff', emissive: '#00ffff', emissiveIntensity: 1.2 };
      }
    } else {
      // Static mode - show final path with yellow emissive
      if (pathKeys && pathKeys.has(nodeKey)) {
        return { color: '#ffff00', emissive: '#ffff00', emissiveIntensity: 1.2 };
      }
    }
    
    // Default terrain cubes - grayscale based on weight, no emissive
    const node = graphData.nodes.get(nodeKey);
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
  }, [startPoint, endPoint, pathKeys, graphData.nodes, animationState]);

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

        {/* Progressive path illumination - optimized for performance */}
        {animationState?.currentPath?.filter((_, index) => index % 3 === 0 || index === animationState.currentPath.length - 1).map((nodeKey, index) => {
          const node = graphData.nodes.get(nodeKey);
          if (!node) return null;
          
          // Skip start and end points
          const isStart = startPoint && node.x === startPoint.x && node.y === startPoint.y;
          const isEnd = endPoint && node.x === endPoint.x && node.y === endPoint.y;
          if (isStart || isEnd) return null;
          
          // Progressive lighting - fewer lights for better performance
          const intensity = 1.5 + index * 0.5; // Simpler calculation
          
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

        <OrbitControls />

        <GraphVisualization 
          position={[0, 0, 0]} 
          startPoint={startPoint}
          endPoint={endPoint}
          pathKeys={pathKeys}
          graphData={graphData}
          animationState={animationState}
          getNodeColor={getNodeColor}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />
      </Canvas>

      <FPSCounter />
    </div>
  );
}
