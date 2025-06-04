import { useState, useEffect } from 'react';

export const useResponsiveGrid = () => {
  // State to track window dimensions
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Calculate responsive grid dimensions based on viewport space
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

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { gridWidth, gridHeight, totalNodes } = getResponsiveGridDimensions();

  return {
    windowSize,
    gridWidth,
    gridHeight,
    totalNodes
  };
}; 