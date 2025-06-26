import React from 'react';

const SceneLighting = ({ 
  startPoint, 
  endPoint, 
  animationState, 
  isAnimating, 
  path, 
  pathKeys, 
  completionStartTime, 
  graphData, 
  gridWidth, 
  gridHeight 
}) => {
  const skip = 2;
  
  // Calculate grid dimensions for lighting positioning
  const totalSizeForLightingWidth = (gridWidth - 1) * skip;
  const totalSizeForLightingHeight = (gridHeight - 1) * skip;
  const halfSizeForLightingWidth = totalSizeForLightingWidth / 2;
  const halfSizeForLightingHeight = totalSizeForLightingHeight / 2;

  return (
    <>
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
            intensity={15.0}
            distance={25}
            decay={1.8}
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
          intensity={12.0}
          distance={20}
          decay={1.2}
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
          intensity={12.0}
          distance={20}
          decay={1.2}
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
      {!isAnimating && path.length > 0 && pathKeys.size > 0 && completionStartTime && path.map((nodeKey, index) => {
        const node = graphData.nodes.get(nodeKey);
        if (!node) return null;
        
        // Skip start and end points (they have their own lights)
        const isStart = startPoint && node.x === startPoint.x && node.y === startPoint.y;
        const isEnd = endPoint && node.x === endPoint.x && node.y === endPoint.y;
        if (isStart || isEnd) return null;
        
        // Gradual brightness buildup over 3 seconds from completion start
        const completionDuration = 3000; // 3 seconds
        const currentTime = Date.now();
        const timeSinceCompletion = currentTime - completionStartTime;
        const buildupProgress = Math.min(1.0, Math.max(0.0, timeSinceCompletion / completionDuration)); // 0 to 1 over 3 seconds
        
        // Smooth easing function for more natural buildup
        const easedProgress = buildupProgress * buildupProgress * (3 - 2 * buildupProgress); // Smooth step
        
        // Determine if this node was lit during animation (every 3rd node + last node)
        const wasLitDuringAnimation = (index % 3 === 0) || (index === path.length - 1);
        
        // Starting intensity: 2.8 if was lit during animation, 0 if not
        const animationIntensity = wasLitDuringAnimation ? 2.8 : 0.0;
        
        // Path gradient: darker at start, brighter toward end
        const pathProgress = index / (path.length - 1); // 0 to 1
        
        // Final target intensity based on position in path
        const targetBaseIntensity = 2.0 + (pathProgress * 3.0); // Final gradient target (2.0 to 5.0)
        
        // Gradually build from animation intensity to target intensity
        const currentBaseIntensity = animationIntensity + (targetBaseIntensity - animationIntensity) * easedProgress;
        
        // Add gentle pulsing effect that grows with the buildup (only for nodes that reach significant brightness)
        const pulseEffect = Math.sin(currentTime * 0.008 + index * 0.2) * (0.3 * easedProgress * (currentBaseIntensity / 5.0));
        const intensity = currentBaseIntensity + pulseEffect;
        
        // Only render light if intensity is meaningful (avoid unnecessary lights)
        if (intensity < 0.1) return null;
        
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
    </>
  );
};

export default SceneLighting; 