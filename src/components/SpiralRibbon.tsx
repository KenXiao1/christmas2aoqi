import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { SceneState } from '../config';
import type { SpiralRibbonConfig } from '../themes';

interface SpiralRibbonProps {
  state: SceneState;
  config: SpiralRibbonConfig;
  treeHeight: number;
  treeRadius: number;
}

export const SpiralRibbon = ({ state, config, treeHeight, treeRadius }: SpiralRibbonProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);

  // 螺旋粒子数据
  const ribbonData = useMemo(() => {
    const particles = [];
    const totalTurns = config.spirals;

    for (let i = 0; i < config.particleCount; i++) {
      const t = i / config.particleCount; // 0 到 1

      // 螺旋参数
      const y = treeHeight * t - treeHeight / 2;
      const normalizedY = t;
      const currentRadius = treeRadius * (1 - normalizedY) + 0.3; // 稍微在树外
      const theta = t * totalTurns * Math.PI * 2;

      // FORMED 位置：螺旋线
      const formedPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );

      // CHAOS 位置：分散
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 70
      );

      particles.push({
        formedPos,
        chaosPos,
        currentPos: chaosPos.clone(),
        scale: 0.06 + Math.random() * 0.04,
        rotationOffset: Math.random() * Math.PI * 2,
        currentRotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
      });
    }

    return particles;
  }, [config.particleCount, config.spirals, treeHeight, treeRadius]);

  // 四面体几何体
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(1, 0), []);

  // 粉色材质（带发光）
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 0.5, // 降低发光，防止过曝
        roughness: 0.2,
        metalness: 0.8,
      }),
    [config.color]
  );

  // 初始化
  useMemo(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const matrix = new THREE.Matrix4();

    ribbonData.forEach((data, i) => {
      matrix.compose(
        data.currentPos,
        new THREE.Quaternion().setFromEuler(data.currentRotation),
        new THREE.Vector3(data.scale, data.scale, data.scale)
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [ribbonData]);

  // 动画
  useFrame((rootState, delta) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const isFormed = state === 'FORMED' || state === 'FOCUS';
    const targetProgress = isFormed ? 1 : 0;
    const time = rootState.clock.elapsedTime;

    progressRef.current += (targetProgress - progressRef.current) * delta * 2;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    ribbonData.forEach((data, i) => {
      position.lerpVectors(data.chaosPos, data.formedPos, progressRef.current);
      data.currentPos.copy(position);

      // 缓慢旋转
      data.currentRotation.y = time * 0.5 + data.rotationOffset;
      data.currentRotation.x = time * 0.3 + data.rotationOffset;

      quaternion.setFromEuler(data.currentRotation);
      scale.setScalar(data.scale);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!config.enabled) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, config.particleCount]}
      frustumCulled={false}
    />
  );
};
