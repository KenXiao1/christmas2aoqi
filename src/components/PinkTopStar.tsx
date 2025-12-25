import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

import type { SceneState } from '../config';
import type { StarConfig } from '../themes';

interface PinkTopStarProps {
  state: SceneState;
  config: StarConfig;
  treeHeight: number;
}

export const PinkTopStar = ({ state, config, treeHeight }: PinkTopStarProps) => {
  const groupRef = useRef<THREE.Group>(null);

  // 精致纤薄的五角星几何体
  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = config.style === 'delicate' ? 1.5 : 2;
    const innerRadius = config.style === 'delicate' ? 0.5 : 0.8;
    const spikes = 5;

    for (let i = 0; i < spikes * 2; i++) {
      const angle = Math.PI / 2 - (i * Math.PI) / spikes;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: config.style === 'delicate' ? 0.1 : 0.5, // 纤薄
      bevelEnabled: true,
      bevelThickness: config.style === 'delicate' ? 0.02 : 0.1,
      bevelSize: config.style === 'delicate' ? 0.02 : 0.1,
      bevelSegments: 2,
    });
  }, [config.style]);

  // 发光材质
  const starMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: config.emissiveIntensity,
        roughness: 0.3,
        metalness: 0.5,
      }),
    [config.color, config.emissiveIntensity]
  );

  // 动画
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // 缓慢旋转
    groupRef.current.rotation.y += delta * 0.3;

    // 缩放动画
    const targetScale = state === 'CHAOS' ? 0 : 1;
    groupRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 3
    );
  });

  return (
    <group ref={groupRef} position={[0, treeHeight / 2 + 1.5, 0]}>
      <Float
        speed={config.style === 'delicate' ? 3 : 2}
        rotationIntensity={config.style === 'delicate' ? 0.3 : 0.2}
        floatIntensity={config.style === 'delicate' ? 0.3 : 0.2}
      >
        <mesh geometry={starGeometry} material={starMaterial} />

        {/* 动态 Sparkles 粒子 */}
        <Sparkles
          count={config.sparkles.count}
          scale={config.style === 'delicate' ? 4 : 5}
          size={config.sparkles.size}
          speed={1.5}
          opacity={0.8}
          color={config.sparkles.color}
        />
      </Float>

      {/* 外围光晕（仅 delicate 风格） */}
      {config.style === 'delicate' && (
        <mesh>
          <ringGeometry args={[1.8, 2.5, 32]} />
          <meshBasicMaterial
            color={config.color}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};
