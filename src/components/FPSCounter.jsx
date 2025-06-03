import React, { useState, useRef, useEffect } from 'react';

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

export default FPSCounter; 