import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { generateGraphStructure, findShortestGraphPath } from '../utils/dijkstra';

export const usePathfinding = (gridWidth, gridHeight) => {
  // State
  const [noiseSeed, setNoiseSeed] = useState(42);
  const [noiseDetail, setNoiseDetail] = useState(1.0 + Math.random() * 5.0);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [path, setPath] = useState([]);
  const [pathKeys, setPathKeys] = useState(new Set());
  const [animationSteps, setAnimationSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed] = useState(8); // 125 FPS
  const [animationState, setAnimationState] = useState(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [completionStartTime, setCompletionStartTime] = useState(null);
  const [currentGraphData, setCurrentGraphData] = useState(null);

  // Refs
  const initialCycleStarted = useRef(false);
  const animationStepsRef = useRef([]);
  const lastAnimationTime = useRef(0);

  // Generate initial graph structure - only when grid dimensions change
  const initialGraphData = useMemo(() => 
    generateGraphStructure(gridWidth, gridHeight, noiseSeed, noiseDetail), 
    [gridWidth, gridHeight] // Only depend on grid size
  );

  // Use current graph data if available, otherwise use initial
  const graphData = currentGraphData || initialGraphData;

  // Calculate Manhattan distance
  const calculateDistance = useCallback((x1, y1, x2, y2) => {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }, []);

  // Generate random start and end points
  const generateRandomPoints = useCallback(() => {
    const minDistance = 50;
    const maxAttempts = 100;
    
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
    const { start, end } = generateRandomPoints();
    
    setCycleCount(prev => prev + 1);
    
    // Randomize terrain
    const newNoiseSeed = Math.floor(Math.random() * 1000) + 1;
    const newNoiseDetail = 1.0 + Math.random() * 5.0;
    
    setNoiseSeed(newNoiseSeed);
    setNoiseDetail(newNoiseDetail);
    
    // Reset states
    setPath([]);
    setPathKeys(new Set());
    setAnimationState(null);
    setCompletionStartTime(null);
    
    // Set new points
    setStartPoint(start);
    setEndPoint(end);
    
    const startKey = `${start.x},${start.y}`;
    const endKey = `${end.x},${end.y}`;
    
    // Generate new graph with new noise values
    const newGraphData = generateGraphStructure(gridWidth, gridHeight, newNoiseSeed, newNoiseDetail);
    
    // Update the current graph data
    setCurrentGraphData(newGraphData);
    
    // Calculate new path using the new graph
    const result = findShortestGraphPath(startKey, endKey, newGraphData.nodes, newGraphData.edges);
    
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

  // Initialize graph data on first mount
  useEffect(() => {
    if (!currentGraphData) {
      setCurrentGraphData(initialGraphData);
    }
  }, [initialGraphData, currentGraphData]);

  // Auto-cycle effect - only run once to start first cycle
  useEffect(() => {
    if (initialCycleStarted.current) return;
    
    const autoCycle = () => {
      initialCycleStarted.current = true;
      startNewCycle();
    };
    
    const initialTimer = setTimeout(autoCycle, 500);
    
    return () => clearTimeout(initialTimer);
  }, [startNewCycle]);

  // Animation progression effect
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
            setCompletionStartTime(Date.now());
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
            
            // Start next cycle after 1 second
            setTimeout(() => {
              startNewCycle();
            }, 1000);
          }, animationSpeed);
        }
      } else {
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
        animationId = requestAnimationFrame(smoothAnimate);
      }
    };
    
    animationId = requestAnimationFrame(smoothAnimate);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isAnimating, currentStep, animationSpeed, startNewCycle]);

  return {
    // State
    startPoint,
    endPoint,
    path,
    pathKeys,
    animationState,
    isAnimating,
    cycleCount,
    completionStartTime,
    graphData,
    noiseSeed,
    noiseDetail,
    
    // Functions
    startNewCycle
  };
}; 