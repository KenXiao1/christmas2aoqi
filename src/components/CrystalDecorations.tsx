import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { SceneState } from '../config';
import type { DecorationsConfig } from '../themes';

interface CrystalDecorationsProps {
  state: SceneState;
  config: DecorationsConfig;
  treeHeight: number;
  treeRadius: number;
}

// 生成树形位置（稍微靠外）
const getTreePosition = (height: number, radius: number) => {
  const y = Math.random() * height - height / 2;
  const normalizedY = (y + height / 2) / height;
  const currentRadius = radius * (1 - normalizedY) * 0.9;
  const theta = Math.random() * Math.PI * 2;
  return new THREE.Vector3(
    currentRadius * Math.cos(theta),
    y,
    currentRadius * Math.sin(theta)
  );
};

// 单个几何体类型的实例组
const CrystalGroup = ({
  count,
  geometryType,
  config,
  state,
  treeHeight,
  treeRadius,
}: {
  count: number;
  geometryType: 'cube' | 'icosahedron';
  config: {
    colors: string[];
    material: { roughness: number; metalness: number; envMapIntensity: number };
  };
  state: SceneState;
  treeHeight: number;
  treeRadius: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);

  // 预计算数据
  const particleData = useMemo(() => {
    const data = [];
    const colors = config.colors.map((c) => new THREE.Color(c));

    for (let i = 0; i < count; i++) {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      const formedPos = getTreePosition(treeHeight, treeRadius);

      data.push({
        chaosPos,
        formedPos,
        currentPos: chaosPos.clone(),
        scale: 0.15 + Math.random() * 0.25,
        color: colors[i % colors.length],
        rotationSpeed: (Math.random() - 0.5) * 3,
        currentRotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
      });
    }
    return data;
  }, [count, config.colors, treeHeight, treeRadius]);

  // 几何体
  const geometry = useMemo(() => {
    if (geometryType === 'cube') {
      return new THREE.BoxGeometry(1, 1, 1);
    }
    return new THREE.IcosahedronGeometry(1, 0);
  }, [geometryType]);

  // 宝石/镜面材质
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: config.material.roughness,
        metalness: config.material.metalness,
        envMapIntensity: config.material.envMapIntensity,
      }),
    [config.material]
  );

  // 初始化
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

  // 动画
  useFrame((rootState, delta) => {
    if (!meshRef.current) return;

    const mesh = meshRef.current;
    const isFormed = state === 'FORMED' || state === 'FOCUS';
    const targetProgress = isFormed ? 1 : 0;
    const time = rootState.clock.elapsedTime;

    progressRef.current += (targetProgress - progressRef.current) * delta * 1.5;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    particleData.forEach((data, i) => {
      position.lerpVectors(data.chaosPos, data.formedPos, progressRef.current);
      data.currentPos.copy(position);

      // 持续缓慢旋转（宝石闪烁效果）
      data.currentRotation.y += delta * data.rotationSpeed * (isFormed ? 0.3 : 1);

      // FORMED 时添加微小浮动
      if (isFormed) {
        position.y += Math.sin(time * 2 + i) * 0.05;
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
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  );
};

export const CrystalDecorations = ({
  state,
  config,
  treeHeight,
  treeRadius,
}: CrystalDecorationsProps) => {
  // 分配数量给不同几何体类型
  const cubeCount = Math.floor(config.count * 0.5);
  const icoCount = config.count - cubeCount;

  const cubeConfig = config.types.find((t) => t.geometry === 'cube') || config.types[0];
  const icoConfig = config.types.find((t) => t.geometry === 'icosahedron') || config.types[1] || config.types[0];

  return (
    <>
      <CrystalGroup
        count={cubeCount}
        geometryType="cube"
        config={cubeConfig}
        state={state}
        treeHeight={treeHeight}
        treeRadius={treeRadius}
      />
      <CrystalGroup
        count={icoCount}
        geometryType="icosahedron"
        config={icoConfig}
        state={state}
        treeHeight={treeHeight}
        treeRadius={treeRadius}
      />
    </>
  );
};
