import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const FOV_DEG = 60;
const FOV_RAD = (FOV_DEG * Math.PI) / 180;
const TAN_HALF_FOV = Math.tan(FOV_RAD / 2);
const PADDING = 1.1;
const MIN_DISTANCE = 20;
const MAX_DISTANCE = 150;
const SKIP = 2;
const DOLLY_AMPLITUDE = 1.5;
const DOLLY_HZ = 0.0133;

const ResponsiveCamera = ({ target = [0, 0, 0], gridWidth, gridHeight }) => {
  const { camera, size } = useThree();
  const baseDistanceRef = useRef(80);

  useEffect(() => {
    const aspect = size.width / size.height;
    const worldW = (gridWidth - 1) * SKIP;
    const worldH = (gridHeight - 1) * SKIP;

    const dForHeight = (worldH * PADDING) / (2 * TAN_HALF_FOV);
    const dForWidth = (worldW * PADDING) / (2 * TAN_HALF_FOV * aspect);

    let distance = Math.max(dForHeight, dForWidth);
    distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance));

    baseDistanceRef.current = distance;
    camera.position.set(0, 0, distance);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, size, target, gridWidth, gridHeight]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    camera.position.z = baseDistanceRef.current + Math.sin(t * Math.PI * 2 * DOLLY_HZ) * DOLLY_AMPLITUDE;
    camera.lookAt(...target);
  });

  return null;
};

export default ResponsiveCamera;
