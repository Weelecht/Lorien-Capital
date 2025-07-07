import React from 'react';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport } from '@react-three/drei';

// Components
import GraphVisualization from './components/GraphVisualization';
import ResponsiveCamera from './components/ResponsiveCamera';
import SceneLighting from './components/SceneLighting';
import Content from "./components/Content/Content";
import FundName from './components/FundName/FundName';
import ContactForm from './components/ContactForm';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import PortfolioHeading from './components/PortfolioHeading';

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

  // Detect mobile device for performance optimization
  const isMobile = window.innerWidth <= 768;

  return (
    <div className="Canvas-Container">
      <Header/>
      <FundName/> 
      <PortfolioHeading/>

      <Canvas
        style={{ 
          backgroundColor: 'black',
          display: 'block',
          width: '100%',
          height: '100vh'
        }}
        camera={{ 
          fov: isMobile ? 70 : 60, // Wider FOV for mobile
          position: [0, 0, 80],
          near: 0.1,
          far: 1000
        }}
        dpr={isMobile ? [1, 1] : [1, 1.5]} // Lower DPR for mobile performance
        onCreated={({ gl }) => {
          gl.setSize(window.innerWidth, window.innerHeight);
          // Optimize WebGL settings for performance
          gl.powerPreference = "high-performance";
          gl.antialias = !isMobile; // Disable antialiasing on mobile for better performance
          gl.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5));
        }}
        gl={{
          alpha: false,
          antialias: !isMobile,
          powerPreference: "high-performance",
          stencil: false,
          depth: true
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

      <div className="content-wrapper">
        <Content/>
        <ContactForm/>
      </div>
      
      <Footer/>
 
    </div>
  );
}
