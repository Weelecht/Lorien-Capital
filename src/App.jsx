import React, { useEffect } from 'react';
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

  // Handle phone rotation
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerHeight < window.innerWidth;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobileDevice && isLandscape && window.innerHeight < 600) {
        // Force landscape mode for mobile devices
        document.body.style.transform = 'rotate(90deg)';
        document.body.style.transformOrigin = 'left top';
        document.body.style.width = '100vh';
        document.body.style.height = '100vw';
        document.body.style.overflowX = 'auto';
        document.body.style.overflowY = 'hidden';
        document.body.style.position = 'absolute';
        document.body.style.top = '100%';
        document.body.style.left = '0';
        
        // Apply same transform to root and canvas container
        const root = document.getElementById('root');
        const canvasContainer = document.querySelector('.Canvas-Container');
        
        if (root) {
          root.style.transform = 'rotate(90deg)';
          root.style.transformOrigin = 'left top';
          root.style.width = '100vh';
          root.style.height = '100vw';
          root.style.position = 'absolute';
          root.style.top = '100%';
          root.style.left = '0';
        }
        
        if (canvasContainer) {
          canvasContainer.style.transform = 'rotate(90deg)';
          canvasContainer.style.transformOrigin = 'left top';
          canvasContainer.style.width = '100vh';
          canvasContainer.style.height = '100vw';
          canvasContainer.style.position = 'absolute';
          canvasContainer.style.top = '100%';
          canvasContainer.style.left = '0';
        }
      } else {
        // Reset to normal mode
        document.body.style.transform = '';
        document.body.style.transformOrigin = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.body.style.overflowX = '';
        document.body.style.overflowY = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        
        const root = document.getElementById('root');
        const canvasContainer = document.querySelector('.Canvas-Container');
        
        if (root) {
          root.style.transform = '';
          root.style.transformOrigin = '';
          root.style.width = '';
          root.style.height = '';
          root.style.position = '';
          root.style.top = '';
          root.style.left = '';
        }
        
        if (canvasContainer) {
          canvasContainer.style.transform = '';
          canvasContainer.style.transformOrigin = '';
          canvasContainer.style.width = '';
          canvasContainer.style.height = '';
          canvasContainer.style.position = '';
          canvasContainer.style.top = '';
          canvasContainer.style.left = '';
        }
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
    };
  }, []);

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
