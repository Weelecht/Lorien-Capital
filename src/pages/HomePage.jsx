import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';

import GraphVisualization from '../components/GraphVisualization';
import ResponsiveCamera from '../components/ResponsiveCamera';
import SceneLighting from '../components/SceneLighting';
import Content from '../components/Content/Content';
import FundName from '../components/FundName/FundName';
import ContactForm from '../components/ContactForm';
import PortfolioHeading from '../components/PortfolioHeading';

import { useResponsiveGrid } from '../hooks/useResponsiveGrid';
import { usePathfinding } from '../hooks/usePathfinding';

import '../App.css';

const MOBILE_QUERY = '(max-width: 768px)';
const LANDSCAPE_PHONE_QUERY = '(orientation: landscape) and (max-height: 600px)';

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

export default function HomePage() {
  const { gridWidth, gridHeight } = useResponsiveGrid();
  const {
    startPoint,
    endPoint,
    path,
    pathKeys,
    animationState,
    isAnimating,
    completionStartTime,
    graphData,
  } = usePathfinding(gridWidth, gridHeight);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isLandscape = useMediaQuery(LANDSCAPE_PHONE_QUERY);

  useEffect(() => {
    document.body.classList.toggle('landscape-mode', isLandscape);
    return () => document.body.classList.remove('landscape-mode');
  }, [isLandscape]);

  return (
    <div className={`Canvas-Container ${isLandscape ? 'landscape-mode' : ''}`}>
      <FundName />
      <PortfolioHeading />

      <Canvas
        style={{
          backgroundColor: 'black',
          display: 'block',
          width: '100%',
          height: '100vh',
          position: 'relative',
        }}
        camera={{
          fov: isMobile ? 70 : 60,
          position: [0, 0, 80],
          near: 0.1,
          far: 1000,
        }}
        dpr={isMobile ? [1, 1] : [1, 1.5]}
        gl={{
          alpha: false,
          antialias: !isMobile,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <ResponsiveCamera target={[0, 0, 0]} gridWidth={gridWidth} gridHeight={gridHeight} />

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

        <GraphVisualization
          position={[0, 0, 0]}
          startPoint={startPoint}
          endPoint={endPoint}
          pathKeys={pathKeys}
          graphData={graphData}
          animationState={animationState}
          isAnimating={isAnimating}
          path={path}
        />

        <EffectComposer disableNormalPass multisampling={isMobile ? 0 : 2}>
          <Bloom
            intensity={isMobile ? 0.6 : 0.9}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      <div className="content-wrapper">
        <Content />
        <ContactForm />
      </div>
    </div>
  );
}
