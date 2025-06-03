import React from 'react';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport } from '@react-three/drei';

// Components
import GraphVisualization from './components/GraphVisualization';
import ResponsiveCamera from './components/ResponsiveCamera';
import SceneLighting from './components/SceneLighting';
import Content from "./components/Content";
import FundName from './components/FundName/FundName';
import ContactForm from './components/ContactForm';

// Hooks
import { useResponsiveGrid } from './hooks/useResponsiveGrid';
import { usePathfinding } from './hooks/usePathfinding';

// Styles
import './App.css';

export default function App() {
  // Custom hooks for modular functionality
  const { gridWidth, gridHeight } = useResponsiveGrid();
  const {
    startPoint,
    endPoint,
    path,
    pathKeys,
    animationState,
    isAnimating,
    completionStartTime,
    graphData
  } = usePathfinding(gridWidth, gridHeight);

  return (
    <div className="Canvas-Container">

      <FundName/> 

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
        {/* Camera that adapts to grid size */}
        <ResponsiveCamera 
          target={[0, 0, 0]} 
          gridWidth={gridWidth} 
          gridHeight={gridHeight} 
        />

        {/* All lighting logic */}
        <SceneLighting
          startPoint={startPoint}
          endPoint={endPoint}
          animationState={animationState}
          isAnimating={isAnimating}
          path={path}
          pathKeys={pathKeys}
          completionStartTime={completionStartTime}
          graphData={graphData}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />

        {/* 3D Graph visualization */}
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

      <Content/>

        
      
        
    </div>
  );
}
