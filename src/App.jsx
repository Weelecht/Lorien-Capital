import React, { useEffect, useState } from 'react';
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

  // State for landscape mode
  const [isLandscape, setIsLandscape] = useState(false);

  // Detect mobile device for performance optimization
  const isMobile = window.innerWidth <= 768;

  // Handle phone rotation - simpler approach
  useEffect(() => {
    const handleOrientationChange = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isLandscapeMode = window.innerHeight < window.innerWidth;
      
      if (isMobileDevice && isLandscapeMode && window.innerHeight < 600) {
        setIsLandscape(true);
        // Add landscape class to body for CSS targeting
        document.body.classList.add('landscape-mode');
      } else {
        setIsLandscape(false);
        document.body.classList.remove('landscape-mode');
      }
    };

    // Initial check
    handleOrientationChange();

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
      document.body.classList.remove('landscape-mode');
    };
  }, []);

  return (
    <div className={`Canvas-Container ${isLandscape ? 'landscape-mode' : ''}`}>
      <Header/>
      <FundName/> 
      <PortfolioHeading/>

      <Canvas
        style={{ 
          backgroundColor: 'black',
          display: 'block',
          width: '100%',
          height: isLandscape ? '100vh' : '100vh'
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
