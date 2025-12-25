import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { SceneState } from '../config';
import type { FoliageConfig } from '../themes';

interface PinkFoliageProps {
  state: SceneState;
  config: FoliageConfig;
  treeHeight: number;
  treeRadius: number;
}

// 生成树形位置
const getTreePosition = (height: number, radius: number) => {
  const y = Math.random() * height - height / 2;
  const normalizedY = (y + height / 2) / height;
  const currentRadius = radius * (1 - normalizedY);
  const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
};

export const PinkFoliage = ({ state, config, treeHeight, treeRadius }: PinkFoliageProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);

  // 预计算所有粒子数据
  const particleData = useMemo(() => {
    const data = [];
    const colors = config.colors.map((c) => new THREE.Color(c));

    for (let i = 0; i < config.count; i++) {
      // CHAOS 位置：球体内随机
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50
      );

      // FORMED 位置：树形
      const formedPos = getTreePosition(treeHeight, treeRadius);

      data.push({
        chaosPos,
        formedPos,
        currentPos: chaosPos.clone(),
        scale: 0.12 + Math.random() * 0.12,
        color: colors[i % colors.length],
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        ),
        currentRotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
      });
    }
    return data;
  }, [config.count, config.colors, treeHeight, treeRadius]);

  // 创建几何体和材质
  const geometry = useMemo(() => {
    switch (config.geometry) {
      case 'icosahedron':
        return new THREE.IcosahedronGeometry(1, 0);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(1, 0);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(1, 0);
      case 'octahedron':
      default:
        return new THREE.OctahedronGeometry(1, 0);
    }
  }, [config.geometry]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: config.material.roughness,
        metalness: config.material.metalness,
        envMapIntensity: 2.0, // 稍微增加环境贴图强度
        flatShading: true,
      }),
    [config.material.roughness, config.material.metalness]
  );

  // 初始化实例矩阵和颜色
  useMemo(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    particleData.forEach((data, i) => {
      matrix.compose(
        data.currentPos,
        new THREE.Quaternion().setFromEuler(data.currentRotation),
        new THREE.Vector3(data.scale, data.scale, data.scale)
      );
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.copy(data.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [particleData]);

  // 动画循环
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const isFormed = state === 'FORMED' || state === 'FOCUS';
    const targetProgress = isFormed ? 1 : 0;

    // 平滑过渡
    progressRef.current += (targetProgress - progressRef.current) * delta * 1.5;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    particleData.forEach((data, i) => {
      // 位置插值
      position.lerpVectors(data.chaosPos, data.formedPos, progressRef.current);
      data.currentPos.copy(position);

      // CHAOS 模式下旋转
      if (!isFormed) {
        data.currentRotation.x += delta * data.rotationSpeed.x;
        data.currentRotation.y += delta * data.rotationSpeed.y;
        data.currentRotation.z += delta * data.rotationSpeed.z;
      }

      quaternion.setFromEuler(data.currentRotation);
      scale.setScalar(data.scale);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, config.count]}
      frustumCulled={false}
    />
  );
};
