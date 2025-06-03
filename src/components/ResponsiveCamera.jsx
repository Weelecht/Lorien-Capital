import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

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

export default ResponsiveCamera; 