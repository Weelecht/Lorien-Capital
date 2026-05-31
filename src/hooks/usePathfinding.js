import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { generateGraphStructure, findShortestGraphPath, coordToKey } from '../utils/dijkstra';

const ANIMATION_SPEED_MS = 8;          // ~125 steps/sec
const COMPLETION_HOLD_MS = 1000;       // pause on completed path
const MIN_PATH_DISTANCE = 50;          // minimum Manhattan distance between endpoints
const MAX_PLACEMENT_ATTEMPTS = 100;    // attempts to pick endpoints
const MAX_RETRY_CYCLES = 5;            // stop infinite recursion if no path
const MAX_WAYPOINTS = 2;               // up to N interior waypoints per path
const WAYPOINT_INSET = 3;              // keep waypoints away from grid edge
const WAYPOINT_MIN_SEPARATION = 10;    // Manhattan distance between waypoints/endpoints
const WAYPOINT_SAMPLE_ATTEMPTS = 40;

const sampleEdgePoint = (gridWidth, gridHeight) => {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.floor(Math.random() * gridWidth), y: 0 };
  if (side === 1) return { x: Math.floor(Math.random() * gridWidth), y: gridHeight - 1 };
  if (side === 2) return { x: 0, y: Math.floor(Math.random() * gridHeight) };
  return { x: gridWidth - 1, y: Math.floor(Math.random() * gridHeight) };
};

const sampleAnyPoint = (gridWidth, gridHeight) => ({
  x: Math.floor(Math.random() * gridWidth),
  y: Math.floor(Math.random() * gridHeight),
});

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const pickEndpoints = (gridWidth, gridHeight) => {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const useEdge = attempt < MAX_PLACEMENT_ATTEMPTS * 0.8;
    const start = useEdge ? sampleEdgePoint(gridWidth, gridHeight) : sampleAnyPoint(gridWidth, gridHeight);
    const end = useEdge ? sampleEdgePoint(gridWidth, gridHeight) : sampleAnyPoint(gridWidth, gridHeight);
    if (manhattan(start, end) >= MIN_PATH_DISTANCE) return { start, end };
  }
  return {
    start: { x: 0, y: 0 },
    end: { x: gridWidth - 1, y: gridHeight - 1 },
  };
};

const sampleInteriorPoint = (gridWidth, gridHeight) => {
  const insetW = Math.max(0, gridWidth - 2 * WAYPOINT_INSET);
  const insetH = Math.max(0, gridHeight - 2 * WAYPOINT_INSET);
  return {
    x: WAYPOINT_INSET + Math.floor(Math.random() * insetW),
    y: WAYPOINT_INSET + Math.floor(Math.random() * insetH),
  };
};

const pickWaypoints = (start, end, gridWidth, gridHeight) => {
  const count = Math.floor(Math.random() * (MAX_WAYPOINTS + 1)); // 0..MAX_WAYPOINTS
  if (count === 0) return [];

  const taken = [start, end];
  const waypoints = [];
  let attempts = 0;
  while (waypoints.length < count && attempts < WAYPOINT_SAMPLE_ATTEMPTS) {
    attempts++;
    const candidate = sampleInteriorPoint(gridWidth, gridHeight);
    let ok = true;
    for (const p of taken) {
      if (manhattan(p, candidate) < WAYPOINT_MIN_SEPARATION) { ok = false; break; }
    }
    if (ok) {
      waypoints.push(candidate);
      taken.push(candidate);
    }
  }
  return waypoints;
};

const buildWaypointPath = (start, end, gridWidth, gridHeight, graph) => {
  const waypoints = pickWaypoints(start, end, gridWidth, gridHeight);
  const stops = [start, ...waypoints, end];
  const fullPath = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const fromKey = coordToKey(stops[i].x, stops[i].y, gridWidth);
    const toKey = coordToKey(stops[i + 1].x, stops[i + 1].y, gridWidth);
    const segment = findShortestGraphPath(fromKey, toKey, graph);
    if (!segment.pathExists || segment.path.length === 0) return null;
    if (i === 0) fullPath.push(...segment.path);
    else fullPath.push(...segment.path.slice(1));
  }
  return fullPath;
};

export const usePathfinding = (gridWidth, gridHeight) => {
  const [graphData, setGraphData] = useState(() =>
    generateGraphStructure(gridWidth, gridHeight, 42, 1.0 + Math.random() * 5.0)
  );
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [path, setPath] = useState([]);
  const [pathKeys, setPathKeys] = useState(() => new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationState, setAnimationState] = useState(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [completionStartTime, setCompletionStartTime] = useState(null);

  const animationStepsRef = useRef([]);
  const stepIndexRef = useRef(0);
  const lastTickRef = useRef(0);
  const retryCountRef = useRef(0);
  const initialCycleStarted = useRef(false);

  // Regenerate graph when grid size changes
  const gridSig = useMemo(() => `${gridWidth}x${gridHeight}`, [gridWidth, gridHeight]);
  useEffect(() => {
    setGraphData(generateGraphStructure(gridWidth, gridHeight, 42, 1.0 + Math.random() * 5.0));
  }, [gridSig, gridWidth, gridHeight]);

  const startNewCycle = useCallback(() => {
    const { start, end } = pickEndpoints(gridWidth, gridHeight);
    const newSeed = Math.floor(Math.random() * 1000) + 1;
    const newDetail = 1.0 + Math.random() * 5.0;
    const newGraph = generateGraphStructure(gridWidth, gridHeight, newSeed, newDetail);

    const fullPath = buildWaypointPath(start, end, gridWidth, gridHeight, newGraph);

    if (!fullPath || fullPath.length === 0) {
      if (retryCountRef.current < MAX_RETRY_CYCLES) {
        retryCountRef.current++;
        setTimeout(startNewCycle, 100);
      }
      return;
    }

    retryCountRef.current = 0;
    setCycleCount((n) => n + 1);
    setGraphData(newGraph);
    setStartPoint(start);
    setEndPoint(end);
    setPath([]);
    setPathKeys(new Set());
    setCompletionStartTime(null);

    animationStepsRef.current = fullPath;
    stepIndexRef.current = 0;
    lastTickRef.current = 0;

    setAnimationState({
      active: true,
      current: fullPath[0],
      currentPath: [fullPath[0]],
      completed: false,
    });
    setIsAnimating(true);
  }, [gridWidth, gridHeight]);

  // Kick off first cycle once
  useEffect(() => {
    if (initialCycleStarted.current) return;
    const timer = setTimeout(() => {
      initialCycleStarted.current = true;
      startNewCycle();
    }, 500);
    return () => clearTimeout(timer);
  }, [startNewCycle]);

  // rAF-driven animation progression
  useEffect(() => {
    if (!isAnimating) return;
    let frameId;

    const tick = (now) => {
      if (now - lastTickRef.current < ANIMATION_SPEED_MS) {
        frameId = requestAnimationFrame(tick);
        return;
      }
      lastTickRef.current = now;

      const steps = animationStepsRef.current;
      const nextIndex = stepIndexRef.current + 1;

      if (nextIndex >= steps.length) {
        // Final step reached: lock in the completed path and schedule next cycle
        const finalPath = steps.slice();
        setIsAnimating(false);
        setAnimationState({
          active: false,
          current: finalPath[finalPath.length - 1],
          currentPath: finalPath,
          completed: true,
        });
        setPath(finalPath);
        setPathKeys(new Set(finalPath));
        setCompletionStartTime(Date.now());
        setTimeout(startNewCycle, COMPLETION_HOLD_MS);
        return;
      }

      stepIndexRef.current = nextIndex;
      const currentPath = steps.slice(0, nextIndex + 1);
      setAnimationState({
        active: true,
        current: steps[nextIndex],
        currentPath,
        completed: false,
      });
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isAnimating, startNewCycle]);

  return {
    startPoint,
    endPoint,
    path,
    pathKeys,
    animationState,
    isAnimating,
    cycleCount,
    completionStartTime,
    graphData,
    startNewCycle,
  };
};
