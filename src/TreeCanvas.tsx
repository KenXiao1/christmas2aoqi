import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  CameraControls,
  Environment,
  Float,
  PerspectiveCamera,
  shaderMaterial,
  Sparkles,
  Stars,
  useTexture,
} from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { MathUtils } from 'three';
import * as random from 'maath/random';

import { CONFIG, PORTRAIT_PHOTO_INDEX, type SceneState } from './config';

// --- Shader Material (Foliage) ---
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(CONFIG.colors.emerald), uProgress: 0 },
  `uniform float uTime; uniform float uProgress; attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vMix;
  float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; }
  void main() {
    vUv = uv;
    vec3 noise = vec3(sin(uTime * 1.5 + position.x), cos(uTime + position.y), sin(uTime * 1.5 + position.z)) * 0.15;
    float t = cubicInOut(uProgress);
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = (60.0 * (1.0 + aRandom)) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vMix = t;
  }`,
  `uniform vec3 uColor; varying float vMix;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
    vec3 finalColor = mix(uColor * 0.3, uColor * 1.2, vMix);
    gl_FragColor = vec4(finalColor, 1.0);
  }`,
);
extend({ FoliageMaterial });

// --- Helper: Tree Shape ---
const getTreePosition = () => {
  const h = CONFIG.tree.height;
  const rBase = CONFIG.tree.radius;
  const y = Math.random() * h - h / 2;
  const normalizedY = (y + h / 2) / h;
  const currentRadius = rBase * (1 - normalizedY);
  const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return [r * Math.cos(theta), y, r * Math.sin(theta)] as const;
};

// --- Component: Foliage ---
const Foliage = ({ state }: { state: SceneState }) => {
  const materialRef = useRef<any>(null);
  const { positions, targetPositions, randoms } = useMemo(() => {
    const count = CONFIG.counts.foliage;
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const spherePoints = random.inSphere(new Float32Array(count * 3), {
      radius: 25,
    }) as Float32Array;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = spherePoints[i * 3];
      positions[i * 3 + 1] = spherePoints[i * 3 + 1];
      positions[i * 3 + 2] = spherePoints[i * 3 + 2];

      const [tx, ty, tz] = getTreePosition();
      targetPositions[i * 3] = tx;
      targetPositions[i * 3 + 1] = ty;
      targetPositions[i * 3 + 2] = tz;
      randoms[i] = Math.random();
    }
    return { positions, targetPositions, randoms };
  }, []);

  useFrame((rootState, delta) => {
    if (!materialRef.current) return;
    materialRef.current.uTime = rootState.clock.elapsedTime;
    // FOCUS 状态视为 FORMED
    const targetProgress = state === 'CHAOS' ? 0 : 1;
    materialRef.current.uProgress = MathUtils.damp(
      materialRef.current.uProgress,
      targetProgress,
      1.5,
      delta,
    );
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aTargetPos" args={[targetPositions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// --- Component: Photo Ornaments (Double-Sided Polaroid) ---
const PhotoOrnaments = ({
  state,
  focusedTextureIndex,
  onPhotoClick,
  onRegisterPosition,
}: {
  state: SceneState;
  focusedTextureIndex: number;
  onPhotoClick: (textureIndex: number) => void;
  onRegisterPosition: (textureIndex: number, position: THREE.Vector3) => void;
}) => {
  const textures = useTexture(CONFIG.photos.body);
  const count = CONFIG.counts.ornaments;
  const groupRef = useRef<THREE.Group>(null);

  // 正方形照片几何体
  const squarePhotoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const squareBorderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);

  // 竖幅照片几何体 (6.jpg aspect ratio ~3:4)
  const portraitPhotoGeometry = useMemo(() => new THREE.PlaneGeometry(0.75, 1), []);
  const portraitBorderGeometry = useMemo(() => new THREE.PlaneGeometry(0.95, 1.5), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 70,
        (Math.random() - 0.5) * 70,
      );
      const h = CONFIG.tree.height;
      const y = Math.random() * h - h / 2;
      const rBase = CONFIG.tree.radius;
      const currentRadius = rBase * (1 - (y + h / 2) / h) + 0.5;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta),
      );

      const isBig = Math.random() < 0.2;
      const baseScale = isBig ? 2.2 : 0.8 + Math.random() * 0.6;
      const weight = 0.8 + Math.random() * 1.2;
      const borderColor =
        CONFIG.colors.borders[Math.floor(Math.random() * CONFIG.colors.borders.length)];

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 1.0,
        y: (Math.random() - 0.5) * 1.0,
        z: (Math.random() - 0.5) * 1.0,
      };
      const chaosRotation = new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );

      const textureIndex = i % textures.length;
      const isPortrait = textureIndex === PORTRAIT_PHOTO_INDEX;

      return {
        chaosPos,
        targetPos,
        scale: baseScale,
        weight,
        textureIndex,
        isPortrait,
        borderColor,
        currentPos: chaosPos.clone(),
        chaosRotation,
        rotationSpeed,
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5,
      };
    });
  }, [textures, count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED' || state === 'FOCUS';
    const isFocus = state === 'FOCUS';
    const time = stateObj.clock.elapsedTime;

    groupRef.current.children.forEach((group, i) => {
      const objData = data[i];
      const isThisFocused = isFocus && objData.textureIndex === focusedTextureIndex;

      // FOCUS 模式下，非聚焦的照片淡出/隐藏
      if (isFocus) {
        const targetScale = isThisFocused ? objData.scale : 0;
        const currentScale = group.scale.x;
        const newScale = MathUtils.lerp(currentScale, targetScale, delta * 3);
        group.scale.setScalar(newScale);
      } else {
        // 非 FOCUS 模式恢复原始缩放
        const currentScale = group.scale.x;
        const newScale = MathUtils.lerp(currentScale, objData.scale, delta * 3);
        group.scale.setScalar(newScale);
      }

      // 位置动画
      if (!isThisFocused) {
        const target = isFormed ? objData.targetPos : objData.chaosPos;
        objData.currentPos.lerp(target, delta * (isFormed ? 0.8 * objData.weight : 0.5));
        group.position.copy(objData.currentPos);
      }

      if (isFormed && !isFocus) {
        // FORMED 模式：面向树心 + wobble
        const targetLookPos = new THREE.Vector3(
          group.position.x * 2,
          group.position.y + 0.5,
          group.position.z * 2,
        );
        group.lookAt(targetLookPos);

        const wobbleX =
          Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
        const wobbleZ =
          Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) * 0.05;
        group.rotation.x += wobbleX;
        group.rotation.z += wobbleZ;
      } else if (!isFormed) {
        // CHAOS 模式：自由旋转
        group.rotation.x += delta * objData.rotationSpeed.x;
        group.rotation.y += delta * objData.rotationSpeed.y;
        group.rotation.z += delta * objData.rotationSpeed.z;
      }
      // FOCUS 模式：不做任何动画，保持静止
    });
  });

  // 点击处理 - 传递 textureIndex
  const handleClick = useCallback(
    (textureIndex: number, event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onPhotoClick(textureIndex);
    },
    [onPhotoClick]
  );

  // 获取当前聚焦照片的位置（供相机使用）
  const getFocusedPosition = useCallback(() => {
    if (focusedTextureIndex < 0) return null;
    // 找到第一个匹配的 textureIndex 的照片
    const matchingData = data.find(d => d.textureIndex === focusedTextureIndex);
    if (!matchingData) return null;
    const pos = matchingData.currentPos.clone();
    pos.y -= 6; // 添加 group 的 Y 偏移
    return pos;
  }, [focusedTextureIndex, data]);

  // 注册所有照片位置，以便相机能找到聚焦照片
  useEffect(() => {
    // 注册所有照片位置（每个 textureIndex 取第一个匹配的）
    const registered = new Set<number>();
    data.forEach(d => {
      if (!registered.has(d.textureIndex)) {
        const pos = d.currentPos.clone();
        pos.y -= 6;
        onRegisterPosition(d.textureIndex, pos);
        registered.add(d.textureIndex);
      }
    });
  }, [data, onRegisterPosition]);

  // 聚焦时更新位置
  useEffect(() => {
    if (state === 'FOCUS' && focusedTextureIndex >= 0) {
      const pos = getFocusedPosition();
      if (pos) {
        onRegisterPosition(focusedTextureIndex, pos);
      }
    }
  }, [state, focusedTextureIndex, getFocusedPosition, onRegisterPosition]);

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        const photoGeo = obj.isPortrait ? portraitPhotoGeometry : squarePhotoGeometry;
        const borderGeo = obj.isPortrait ? portraitBorderGeometry : squareBorderGeometry;

        return (
          <group
            key={i}
            scale={[obj.scale, obj.scale, obj.scale]}
            rotation={state === 'CHAOS' ? obj.chaosRotation : [0, 0, 0]}
            onClick={(e) => handleClick(obj.textureIndex, e)}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = 'default')}
          >
            {/* 正面 */}
            <group position={[0, 0, 0.015]}>
              <mesh geometry={photoGeo}>
                <meshStandardMaterial
                  map={textures[obj.textureIndex]}
                  roughness={0.5}
                  metalness={0}
                  emissive={CONFIG.colors.white}
                  emissiveMap={textures[obj.textureIndex]}
                  emissiveIntensity={1.0}
                  side={THREE.FrontSide}
                />
              </mesh>
              <mesh geometry={borderGeo} position={[0, -0.15, -0.01]}>
                <meshStandardMaterial
                  color={obj.borderColor}
                  roughness={0.9}
                  metalness={0}
                  side={THREE.FrontSide}
                />
              </mesh>
            </group>
            {/* 背面 */}
            <group position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
              <mesh geometry={photoGeo}>
                <meshStandardMaterial
                  map={textures[obj.textureIndex]}
                  roughness={0.5}
                  metalness={0}
                  emissive={CONFIG.colors.white}
                  emissiveMap={textures[obj.textureIndex]}
                  emissiveIntensity={1.0}
                  side={THREE.FrontSide}
                />
              </mesh>
              <mesh geometry={borderGeo} position={[0, -0.15, -0.01]}>
                <meshStandardMaterial
                  color={obj.borderColor}
                  roughness={0.9}
                  metalness={0}
                  side={THREE.FrontSide}
                />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};

// --- Component: Christmas Elements ---
const ChristmasElements = ({ state }: { state: SceneState }) => {
  const count = CONFIG.counts.elements;
  const groupRef = useRef<THREE.Group>(null);

  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const caneGeometry = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
      );
      const h = CONFIG.tree.height;
      const y = Math.random() * h - h / 2;
      const rBase = CONFIG.tree.radius;
      const currentRadius = rBase * (1 - (y + h / 2) / h) * 0.95;
      const theta = Math.random() * Math.PI * 2;

      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta),
      );

      const type = Math.floor(Math.random() * 3);
      let color: string;
      let scale = 1;
      if (type === 0) {
        color =
          CONFIG.colors.giftColors[Math.floor(Math.random() * CONFIG.colors.giftColors.length)];
        scale = 0.8 + Math.random() * 0.4;
      } else if (type === 1) {
        color =
          CONFIG.colors.giftColors[Math.floor(Math.random() * CONFIG.colors.giftColors.length)];
        scale = 0.6 + Math.random() * 0.4;
      } else {
        color = Math.random() > 0.5 ? CONFIG.colors.red : CONFIG.colors.white;
        scale = 0.7 + Math.random() * 0.3;
      }

      const rotationSpeed = {
        x: (Math.random() - 0.5) * 2.0,
        y: (Math.random() - 0.5) * 2.0,
        z: (Math.random() - 0.5) * 2.0,
      };
      return {
        type,
        chaosPos,
        targetPos,
        color,
        scale,
        currentPos: chaosPos.clone(),
        chaosRotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ),
        rotationSpeed,
      };
    });
  }, [boxGeometry, sphereGeometry, caneGeometry, count]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // FOCUS 状态视为 FORMED
    const isFormed = state === 'FORMED' || state === 'FOCUS';
    groupRef.current.children.forEach((child, i) => {
      const item = data[i];
      const target = isFormed ? item.targetPos : item.chaosPos;
      item.currentPos.lerp(target, delta * (isFormed ? 0.8 : 0.5));
      child.position.copy(item.currentPos);

      if (!isFormed) {
        child.rotation.x += delta * item.rotationSpeed.x;
        child.rotation.y += delta * item.rotationSpeed.y;
        child.rotation.z += delta * item.rotationSpeed.z;
      }
    });
  });

  const giftMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CONFIG.colors.red,
        emissive: CONFIG.colors.gold,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.3,
      }),
    [],
  );

  const candyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CONFIG.colors.white,
        emissive: CONFIG.colors.red,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.3,
      }),
    [],
  );

  return (
    <group ref={groupRef}>
      {data.map((item, i) => (
        <mesh
          key={i}
          geometry={item.type === 0 ? boxGeometry : item.type === 1 ? sphereGeometry : caneGeometry}
          material={item.type === 2 ? candyMaterial : giftMaterial}
          scale={[item.scale, item.scale, item.scale]}
          rotation={state === 'CHAOS' ? item.chaosRotation : [0, 0, 0]}
        >
          <meshStandardMaterial color={item.color} />
        </mesh>
      ))}
    </group>
  );
};

// --- Component: Fairy Lights ---
const FairyLights = ({ state }: { state: SceneState }) => {
  const count = CONFIG.counts.lights;
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.15, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
      );
      const [x, y, z] = getTreePosition();
      const targetPos = new THREE.Vector3(x, y, z);
      const color =
        CONFIG.colors.lights[Math.floor(Math.random() * CONFIG.colors.lights.length)];
      return {
        chaosPos,
        targetPos,
        color,
        currentPos: chaosPos.clone(),
        twinkleOffset: Math.random() * 10,
      };
    });
  }, [count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    // FOCUS 状态视为 FORMED
    const isFormed = state === 'FORMED' || state === 'FOCUS';
    const time = stateObj.clock.elapsedTime;

    groupRef.current.children.forEach((child, i) => {
      const light = data[i];
      const target = isFormed ? light.targetPos : light.chaosPos;
      light.currentPos.lerp(target, delta * (isFormed ? 1.2 : 0.6));
      child.position.copy(light.currentPos);

      const twinkle = (Math.sin(time * 3 + light.twinkleOffset) + 1) / 2;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mat = (child as any).material as THREE.MeshStandardMaterial | undefined;
      if (mat) mat.emissiveIntensity = 1 + twinkle * 2;
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((light, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial
            color={light.color}
            emissive={light.color}
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// --- Component: Top Star ---
const TopStar = ({ state }: { state: SceneState }) => {
  const groupRef = useRef<THREE.Group>(null);

  const starGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 2;
    const innerRadius = 0.8;
    const spikes = 5;

    // For a 5-pointed star: 10 vertices alternating outer/inner
    // Start from top (PI/2) and go clockwise
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
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 2,
    });
  }, []);

  const goldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: CONFIG.colors.gold,
        emissive: CONFIG.colors.gold,
        emissiveIntensity: 2,
        roughness: 0.1,
        metalness: 1.0,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.5;
    // FOCUS 状态视为 FORMED
    const targetScale = state === 'CHAOS' ? 0 : 1;
    groupRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      delta * 3,
    );
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <mesh geometry={starGeometry} material={goldMaterial} />
      </Float>
    </group>
  );
};

// --- Main Scene Experience ---
const Experience = ({
  sceneState,
  rotationSpeed,
  focusedTextureIndex,
  onPhotoClick,
  onExitFocus,
}: {
  sceneState: SceneState;
  rotationSpeed: number;
  focusedTextureIndex: number;
  onPhotoClick: (textureIndex: number) => void;
  onExitFocus: () => void;
}) => {
  const controlsRef = useRef<any>(null);
  const prevFocusIndex = useRef(-1);
  const photoPositionsRef = useRef<Map<number, THREE.Vector3>>(new Map());

  // 注册照片位置的回调（由 PhotoOrnaments 调用）
  const registerPhotoPosition = useCallback((textureIndex: number, position: THREE.Vector3) => {
    photoPositionsRef.current.set(textureIndex, position.clone());
  }, []);

  // 聚焦相机动画
  useEffect(() => {
    if (!controlsRef.current) return;

    if (sceneState === 'FOCUS' && focusedTextureIndex >= 0 && focusedTextureIndex !== prevFocusIndex.current) {
      // 延迟获取位置，等待照片动画完成
      const timer = setTimeout(() => {
        const pos = photoPositionsRef.current.get(focusedTextureIndex);
        if (pos) {
          // 计算相机位置：照片正前方，距离照片 5 单位
          const cameraDistance = 5;
          const direction = pos.clone().normalize();
          const cameraPos = pos.clone().add(direction.multiplyScalar(cameraDistance));

          // 平滑移动相机到照片前方
          controlsRef.current.setLookAt(
            cameraPos.x, cameraPos.y, cameraPos.z,
            pos.x, pos.y, pos.z,
            true // enableTransition
          );
        }
      }, 50);
      prevFocusIndex.current = focusedTextureIndex;
      return () => clearTimeout(timer);
    }

    // 退出 FOCUS 模式时重置
    if (sceneState !== 'FOCUS') {
      prevFocusIndex.current = -1;
    }
  }, [sceneState, focusedTextureIndex]);

  // 非聚焦模式的旋转控制
  useFrame(() => {
    if (!controlsRef.current) return;
    // FOCUS 模式下不旋转
    if (sceneState === 'FOCUS' || rotationSpeed === 0) return;
    controlsRef.current.rotate(rotationSpeed, 0, false);
  });

  // 点击空白区域退出聚焦
  const handleMissedClick = useCallback(() => {
    if (sceneState === 'FOCUS') {
      onExitFocus();
    }
  }, [sceneState, onExitFocus]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 8, 60]} fov={45} />
      <CameraControls
        ref={controlsRef}
        minDistance={sceneState === 'FOCUS' ? 3 : 30}
        maxDistance={sceneState === 'FOCUS' ? 15 : 120}
        maxPolarAngle={Math.PI / 1.7}
      />

      <color attach="background" args={['#000300']} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="night" background={false} />

      <ambientLight intensity={0.4} color="#003311" />
      <pointLight position={[30, 30, 30]} intensity={100} color={CONFIG.colors.warmLight} />
      <pointLight position={[-30, 10, -30]} intensity={50} color={CONFIG.colors.gold} />
      <pointLight position={[0, -20, 10]} intensity={30} color="#ffffff" />

      <group position={[0, -6, 0]} onPointerMissed={handleMissedClick}>
        <Foliage state={sceneState} />
        <ChristmasElements state={sceneState} />
        <FairyLights state={sceneState} />
        <TopStar state={sceneState} />
        <Suspense fallback={null}>
          <PhotoOrnaments
            state={sceneState}
            focusedTextureIndex={focusedTextureIndex}
            onPhotoClick={onPhotoClick}
            onRegisterPosition={registerPhotoPosition}
          />
        </Suspense>
        <Sparkles
          count={600}
          scale={50}
          size={8}
          speed={0.4}
          opacity={0.4}
          color={CONFIG.colors.silver}
        />
      </group>

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.1}
          intensity={1.5}
          radius={0.5}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={1.2} />
      </EffectComposer>
    </>
  );
};

export default function TreeCanvas({
  sceneState,
  rotationSpeed,
  focusedTextureIndex,
  onPhotoClick,
  onExitFocus,
}: {
  sceneState: SceneState;
  rotationSpeed: number;
  focusedTextureIndex: number;
  onPhotoClick: (textureIndex: number) => void;
  onExitFocus: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ toneMapping: THREE.ReinhardToneMapping, powerPreference: 'high-performance' }}
    >
      <Experience
        sceneState={sceneState}
        rotationSpeed={rotationSpeed}
        focusedTextureIndex={focusedTextureIndex}
        onPhotoClick={onPhotoClick}
        onExitFocus={onExitFocus}
      />
    </Canvas>
  );
}

