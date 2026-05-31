import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const SKIP = 2;
const TORCH_Z = 5;
const TRAIL_Z = 3.5;
const ENDPOINT_Z = 2;

const TORCH_COLOR = '#fff4e0';
const TRAIL_COLOR = '#e8f4ff';

const TORCH_BASE_INTENSITY = 24;
const TORCH_PULSE_AMP = 3;
const TORCH_PULSE_HZ = 0.2;
const TORCH_DISTANCE = 36;
const TORCH_DECAY = 1.6;

const TRAIL_LIGHT_COUNT = 18;
const TRAIL_INTENSITY = 13;
const TRAIL_DISTANCE = 26;
const TRAIL_DECAY = 1.4;

const COMPLETION_DURATION_S = 3;
const COMPLETION_PEAK_INTENSITY = 14;

const SceneLighting = ({
  startPoint,
  endPoint,
  animationState,
  isAnimating,
  path,
  completionStartTime,
  graphData,
  gridWidth,
  gridHeight,
}) => {
  const halfW = useMemo(() => ((gridWidth - 1) * SKIP) / 2, [gridWidth]);
  const halfH = useMemo(() => ((gridHeight - 1) * SKIP) / 2, [gridHeight]);

  const torchRef = useRef();
  const completionRef = useRef();
  const trailRefs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Torch at head: gentle pulse + follow latest node in current path
    const activePath = animationState?.currentPath;
    const headKey = activePath && activePath.length > 0
      ? activePath[activePath.length - 1]
      : null;
    const headNode = headKey !== null ? graphData.nodes.get(headKey) : null;

    if (torchRef.current) {
      if (headNode) {
        torchRef.current.visible = true;
        torchRef.current.position.set(
          headNode.x * SKIP - halfW,
          headNode.y * SKIP - halfH,
          TORCH_Z
        );
        torchRef.current.intensity =
          TORCH_BASE_INTENSITY + Math.sin(t * Math.PI * 2 * TORCH_PULSE_HZ) * TORCH_PULSE_AMP;
      } else {
        torchRef.current.visible = false;
      }
    }

    // Trail lights distributed along the visited path so the cubes behind
    // the head stay lit. As the path grows the trail spreads naturally.
    const trail = trailRefs.current;
    const trailSource = activePath && activePath.length > 1
      ? activePath
      : (!isAnimating && path && path.length > 1 ? path : null);

    if (trailSource) {
      const lastIdx = trailSource.length - 1;
      for (let i = 0; i < TRAIL_LIGHT_COUNT; i++) {
        const light = trail[i];
        if (!light) continue;
        // Spread fractions 1/(N+1) … N/(N+1), e.g. .17, .33, .5, .67, .83
        const fraction = (i + 1) / (TRAIL_LIGHT_COUNT + 1);
        const sampleIdx = Math.round(fraction * lastIdx);
        const node = graphData.nodes.get(trailSource[sampleIdx]);
        if (node) {
          light.visible = true;
          light.position.set(
            node.x * SKIP - halfW,
            node.y * SKIP - halfH,
            TRAIL_Z
          );
          // Subtle independent flicker per light so the trail feels alive
          const flicker = 0.85 + 0.15 * Math.sin(t * 2.3 + i * 1.7);
          light.intensity = TRAIL_INTENSITY * flicker;
        } else {
          light.visible = false;
        }
      }
    } else {
      for (let i = 0; i < TRAIL_LIGHT_COUNT; i++) {
        if (trail[i]) trail[i].visible = false;
      }
    }

    // Completion buildup
    if (completionRef.current) {
      if (completionStartTime) {
        const elapsed = (Date.now() - completionStartTime) / 1000;
        const p = Math.min(1, Math.max(0, elapsed / COMPLETION_DURATION_S));
        const eased = p * p * (3 - 2 * p);
        completionRef.current.intensity = eased * COMPLETION_PEAK_INTENSITY;
      } else {
        completionRef.current.intensity = 0;
      }
    }
  });

  const completionRadius = Math.max(halfW, halfH) * 2.5;

  return (
    <>
      <ambientLight intensity={0.06} />
      <directionalLight position={[20, 20, 10]} intensity={0.1} color="#ffffff" />

      <mesh position={[0, 0, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} metalness={0} />
      </mesh>

      <pointLight
        ref={torchRef}
        position={[0, 0, TORCH_Z]}
        intensity={TORCH_BASE_INTENSITY}
        distance={TORCH_DISTANCE}
        decay={TORCH_DECAY}
        color={TORCH_COLOR}
        visible={false}
      />

      {Array.from({ length: TRAIL_LIGHT_COUNT }, (_, i) => (
        <pointLight
          key={`trail-${i}`}
          ref={(el) => { trailRefs.current[i] = el; }}
          position={[0, 0, TRAIL_Z]}
          intensity={0}
          distance={TRAIL_DISTANCE}
          decay={TRAIL_DECAY}
          color={TRAIL_COLOR}
          visible={false}
        />
      ))}

      {startPoint && (
        <pointLight
          position={[startPoint.x * SKIP - halfW, startPoint.y * SKIP - halfH, ENDPOINT_Z]}
          intensity={10}
          distance={18}
          decay={1.4}
          color="#00ff00"
        />
      )}

      {endPoint && !isAnimating && path && path.length > 0 && (
        <pointLight
          position={[endPoint.x * SKIP - halfW, endPoint.y * SKIP - halfH, ENDPOINT_Z]}
          intensity={10}
          distance={18}
          decay={1.4}
          color="#ff0000"
        />
      )}

      {!isAnimating && path && path.length > 0 && (
        <pointLight
          ref={completionRef}
          position={[0, 0, 15]}
          intensity={0}
          distance={completionRadius}
          decay={1.8}
          color={TRAIL_COLOR}
        />
      )}
    </>
  );
};

export default SceneLighting;
