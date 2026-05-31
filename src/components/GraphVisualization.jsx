import React, { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { coordToKey } from '../utils/dijkstra';

const SKIP = 2;
const WEIGHT_MIN = 0.1;
const WEIGHT_MAX = 25.0;
const SIZE_MIN = 0.4;
const SIZE_MAX = 2.5;
const HEIGHT_MIN = 0.3;
const HEIGHT_MAX = 4.0;

const sizeForWeight = (weight) => {
  const normalized = Math.max(0, Math.min(1, (weight - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)));
  const curved = Math.pow(normalized, 0.8);
  return {
    size: SIZE_MIN + (SIZE_MAX - SIZE_MIN) * curved,
    height: HEIGHT_MIN + (HEIGHT_MAX - HEIGHT_MIN) * curved,
    grayLinear: 1 - normalized,
  };
};

// Albedo color (multiplied by lights). Path/current colors are bright so even
// without lighting the cube reads as glowing — the emissive channel below adds
// self-illumination on top of that.
const COLOR_START = new THREE.Color('#00ff00');
const COLOR_END = new THREE.Color('#ff0000');
const COLOR_CURRENT = new THREE.Color('#ffffff');
const COLOR_PATH = new THREE.Color('#e8f4ff');

// Per-instance emissive HDR values (>1.0 is fine, bloom catches them).
// Format: [r, g, b].
const EMISSIVE_START = [0.0, 2.4, 0.0];
const EMISSIVE_END = [2.4, 0.0, 0.0];
const EMISSIVE_CURRENT = [4.0, 4.0, 4.0];
const EMISSIVE_PATH = [2.2, 2.5, 3.1];

const GraphVisualization = ({
  position,
  startPoint,
  endPoint,
  pathKeys,
  graphData,
  animationState,
  isAnimating,
  path,
}) => {
  const meshRef = useRef();
  const prevHighlightsRef = useRef(new Set());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const { nodes, gridWidth, gridHeight } = graphData;
  const halfW = ((gridWidth - 1) * SKIP) / 2;
  const halfH = ((gridHeight - 1) * SKIP) / 2;
  const count = nodes.size;

  // Owned geometry so we can attach a per-instance emissive attribute to it.
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Material with per-instance emissive injected via onBeforeCompile.
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute vec3 instanceEmissive;
           varying vec3 vInstanceEmissive;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vInstanceEmissive = instanceEmissive;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vInstanceEmissive;`
        )
        .replace(
          'vec3 totalEmissiveRadiance = emissive;',
          'vec3 totalEmissiveRadiance = emissive + vInstanceEmissive;'
        );
    };
    return mat;
  }, []);

  // Pre-compute static per-node data once per graph regen.
  const { keyToIndex, baseColors } = useMemo(() => {
    const k2i = new Map();
    const base = new Float32Array(count * 3);
    let i = 0;
    for (const [key, node] of nodes.entries()) {
      const { grayLinear } = sizeForWeight(node.weight);
      k2i.set(key, i);
      base[i * 3] = grayLinear;
      base[i * 3 + 1] = grayLinear;
      base[i * 3 + 2] = grayLinear;
      i++;
    }
    return { keyToIndex: k2i, baseColors: base };
  }, [nodes, count]);

  // (Re)attach per-instance emissive attribute whenever node count changes.
  useEffect(() => {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceEmissive', attr);
    return () => {
      geometry.deleteAttribute('instanceEmissive');
    };
  }, [count, geometry]);

  // Layout pass: matrices + base colors + zero emissive. Runs on graph regen.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let i = 0;
    for (const node of nodes.values()) {
      const { size, height } = sizeForWeight(node.weight);
      dummy.position.set(
        node.x * SKIP - halfW + position[0],
        node.y * SKIP - halfH + position[1],
        position[2] + height / 2
      );
      dummy.scale.set(size, height, size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tmpColor.setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
      mesh.setColorAt(i, tmpColor);
      i++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const emissive = mesh.geometry.getAttribute('instanceEmissive');
    if (emissive) {
      emissive.array.fill(0);
      emissive.needsUpdate = true;
    }
    prevHighlightsRef.current = new Set();
  }, [nodes, baseColors, halfW, halfH, position, dummy, tmpColor]);

  // Highlight pass: only touch instances whose state changed.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.instanceColor) return;
    const colors = mesh.instanceColor.array;
    const emissiveAttr = mesh.geometry.getAttribute('instanceEmissive');
    if (!emissiveAttr) return;
    const emissive = emissiveAttr.array;
    const base = baseColors;
    const prev = prevHighlightsRef.current;
    const next = new Set();

    const write = (idx, color, emissiveTriple) => {
      colors[idx * 3] = color.r;
      colors[idx * 3 + 1] = color.g;
      colors[idx * 3 + 2] = color.b;
      emissive[idx * 3] = emissiveTriple[0];
      emissive[idx * 3 + 1] = emissiveTriple[1];
      emissive[idx * 3 + 2] = emissiveTriple[2];
      next.add(idx);
    };

    // Restore previously highlighted instances to base.
    for (const idx of prev) {
      colors[idx * 3] = base[idx * 3];
      colors[idx * 3 + 1] = base[idx * 3 + 1];
      colors[idx * 3 + 2] = base[idx * 3 + 2];
      emissive[idx * 3] = 0;
      emissive[idx * 3 + 1] = 0;
      emissive[idx * 3 + 2] = 0;
    }

    const activePath = animationState?.currentPath;
    if (activePath) {
      for (const k of activePath) {
        const idx = keyToIndex.get(k);
        if (idx !== undefined) write(idx, COLOR_PATH, EMISSIVE_PATH);
      }
    } else if (!isAnimating && pathKeys && pathKeys.size) {
      for (const k of pathKeys) {
        const idx = keyToIndex.get(k);
        if (idx !== undefined) write(idx, COLOR_PATH, EMISSIVE_PATH);
      }
    }

    if (animationState?.current !== undefined) {
      const idx = keyToIndex.get(animationState.current);
      if (idx !== undefined) write(idx, COLOR_CURRENT, EMISSIVE_CURRENT);
    }

    if (startPoint) {
      const idx = keyToIndex.get(coordToKey(startPoint.x, startPoint.y, gridWidth));
      if (idx !== undefined) write(idx, COLOR_START, EMISSIVE_START);
    }
    // End node stays dark until the path reaches it (i.e. completion).
    const pathComplete = !isAnimating && path && path.length > 0;
    if (endPoint && pathComplete) {
      const idx = keyToIndex.get(coordToKey(endPoint.x, endPoint.y, gridWidth));
      if (idx !== undefined) write(idx, COLOR_END, EMISSIVE_END);
    }

    prevHighlightsRef.current = next;
    mesh.instanceColor.needsUpdate = true;
    emissiveAttr.needsUpdate = true;
  }, [animationState, startPoint, endPoint, isAnimating, path, pathKeys, keyToIndex, baseColors, gridWidth]);

  // Single Line through the visited path.
  const linePoints = useMemo(() => {
    let pts = null;
    if (animationState?.currentPath && animationState.currentPath.length >= 2) {
      pts = animationState.currentPath;
    } else if (!isAnimating && path && path.length >= 2) {
      pts = path;
    }
    if (!pts) return null;

    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const node = nodes.get(pts[i]);
      if (!node) {
        out[i] = [0, 0, 0];
        continue;
      }
      const { height } = sizeForWeight(node.weight);
      out[i] = [
        node.x * SKIP - halfW + position[0],
        node.y * SKIP - halfH + position[1],
        position[2] + height / 2,
      ];
    }
    return out;
  }, [animationState, isAnimating, path, nodes, halfW, halfH, position]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
      />

      {linePoints && (
        <Line points={linePoints} color="#ffffff" lineWidth={3.5} transparent opacity={1.0} />
      )}
    </>
  );
};

export default GraphVisualization;
