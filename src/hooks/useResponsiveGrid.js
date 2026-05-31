import { useState, useEffect, useMemo } from 'react';

const SKIP = 2;
const FOV_DEG = 60;
const FOV_RAD = (FOV_DEG * Math.PI) / 180;
const VIEWPORT_COVERAGE = 0.85;
const BASE_CAMERA_DISTANCE = 60;
const MIN_DIM = 15;
const MAX_DIM = 50;
const WIDE_BOOST = 1.2;
const WIDE_CAP = 60;

const getDimensions = (width, height) => {
  const aspectRatio = width / height;
  const visibleHeight = 2 * Math.tan(FOV_RAD / 2) * BASE_CAMERA_DISTANCE * VIEWPORT_COVERAGE;
  const visibleWidth = visibleHeight * aspectRatio;

  let gridWidth = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(visibleWidth / SKIP)));
  let gridHeight = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(visibleHeight / SKIP)));

  if (aspectRatio > 1.5) {
    gridWidth = Math.min(WIDE_CAP, Math.floor(gridWidth * WIDE_BOOST));
  } else if (aspectRatio < 0.8) {
    gridHeight = Math.min(WIDE_CAP, Math.floor(gridHeight * WIDE_BOOST));
  }

  return { gridWidth, gridHeight, totalNodes: gridWidth * gridHeight };
};

export const useResponsiveGrid = () => {
  const [windowSize, setWindowSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dimensions = useMemo(
    () => getDimensions(windowSize.width, windowSize.height),
    [windowSize.width, windowSize.height]
  );

  return { windowSize, ...dimensions };
};
