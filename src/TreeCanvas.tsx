import {
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  CameraControls,
  Environment,
  Float,
  PerformanceMonitor,
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
const Foliage = ({ state, count }: { state: SceneState; count: number }) => {
  const materialRef = useRef<any>(null);
  const { positions, targetPositions, randoms } = useMemo(() => {
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
  }, [count]);

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
  count,
}: {
  state: SceneState;
  focusedTextureIndex: number;
  onPhotoClick: (textureIndex: number) => void;
  onRegisterPosition: (textureIndex: number, position: THREE.Vector3) => void;
  count: number;
}) => {
  const textures = useTexture(CONFIG.photos.body);
  const groupRef = useRef<THREE.Group>(null);
  const tmpLookAt = useMemo(() => new THREE.Vector3(), []);

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

      if (isThisFocused) {
        // FOCUS 模式：聚焦的照片绕Y轴旋转面向相机
        const camera = stateObj.camera;
        const dx = camera.position.x - group.position.x;
        const dz = camera.position.z - group.position.z;
        const targetRotationY = Math.atan2(dx, dz);
        group.rotation.y = MathUtils.lerp(group.rotation.y, targetRotationY, delta * 5);
        // 保持X和Z旋转为0，让照片保持水平
        group.rotation.x = MathUtils.lerp(group.rotation.x, 0, delta * 5);
        group.rotation.z = MathUtils.lerp(group.rotation.z, 0, delta * 5);
      } else if (isFormed && !isFocus) {
        // FORMED 模式：面向树心 + wobble
        tmpLookAt.set(
          group.position.x * 2,
          group.position.y + 0.5,
          group.position.z * 2,
        );
        group.lookAt(tmpLookAt);

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
const ChristmasElements = ({ state, count }: { state: SceneState; count: number }) => {
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
const FairyLights = ({ state, count }: { state: SceneState; count: number }) => {
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
const TopStar = ({ state, emissiveIntensity }: { state: SceneState; emissiveIntensity: number }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetScaleVec = useMemo(() => new THREE.Vector3(), []);

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
        emissiveIntensity,
        roughness: 0.1,
        metalness: 1.0,
      }),
    [emissiveIntensity],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.5;
    // FOCUS 状态视为 FORMED
    const targetScale = state === 'CHAOS' ? 0 : 1;
    targetScaleVec.setScalar(targetScale);
    groupRef.current.scale.lerp(targetScaleVec, delta * 3);
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
type SceneQuality = {
  dprMax: number;
  foliageCount: number;
  ornamentsCount: number;
  elementsCount: number;
  lightsCount: number;
  starsCount: number;
  sparklesCount: number;
  enableEnvironment: boolean;
  composerMultisampling: number;
  bloomIntensity: number;
  bloomRadius: number;
  bloomMipmapBlur: boolean;
  vignetteDarkness: number;
  cameraResetTransition: boolean;
  starEmissiveIntensity: number;
  keyLightIntensity: number;
  fillLightIntensity: number;
  bottomLightIntensity: number;
};

const Experience = ({
  sceneState,
  rotationSpeed,
  pitchSpeed,
  focusedTextureIndex,
  onPhotoClick,
  onExitFocus,
  onCameraRef,
  onPhotoPositionsRef,
  quality,
  effectsEnabled,
}: {
  sceneState: SceneState;
  rotationSpeed: number;
  pitchSpeed: number;
  focusedTextureIndex: number;
  onPhotoClick: (textureIndex: number) => void;
  onExitFocus: () => void;
  onCameraRef: (ref: any) => void;
  onPhotoPositionsRef: (ref: Map<number, THREE.Vector3>) => void;
  quality: SceneQuality;
  effectsEnabled: boolean;
}) => {
  const controlsRef = useRef<any>(null);
  const prevFocusIndex = useRef(-1);
  const photoPositionsRef = useRef<Map<number, THREE.Vector3>>(new Map());

  // 注册照片位置的回调（由 PhotoOrnaments 调用）
  const registerPhotoPosition = useCallback((textureIndex: number, position: THREE.Vector3) => {
    photoPositionsRef.current.set(textureIndex, position.clone());
  }, []);

  // 初始化相机目标点，让树聚合后在画面中央
  useEffect(() => {
    if (!controlsRef.current) return;
    // 设置相机看向树的中心位置 (0, -6, 0)
    controlsRef.current.setLookAt(0, 8, 60, 0, -6, 0, false);
    // 传递 controlsRef 给父组件
    onCameraRef(controlsRef.current);
  }, [onCameraRef]);

  // 传递 photoPositionsRef 给父组件
  useEffect(() => {
    onPhotoPositionsRef(photoPositionsRef.current);
  }, [onPhotoPositionsRef]);

  const isResettingRef = useRef(false);

  // 相机动画处理：聚焦和重置
  useEffect(() => {
    if (!controlsRef.current) return;

    if (sceneState === 'FOCUS' && focusedTextureIndex >= 0 && focusedTextureIndex !== prevFocusIndex.current) {
      // 聚焦模式：平滑移动到照片正前方
      const timer = setTimeout(() => {
        const pos = photoPositionsRef.current.get(focusedTextureIndex);
        if (pos) {
          // 计算照片正面朝向的方向
          const faceDirection = new THREE.Vector3(pos.x, 0.5, pos.z).normalize();
          const cameraDistance = 5;
          const cameraPos = pos.clone().add(faceDirection.multiplyScalar(cameraDistance));

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

    // 当切换到 FORMED 状态（聚合为树）时，重置相机到正视全貌
    if (sceneState === 'FORMED') {
      isResettingRef.current = true;
      // 0, 8, 60 是相机位置，0, -6, 0 是树的中心看向点
      controlsRef.current.setLookAt(0, 8, 60, 0, -6, 0, quality.cameraResetTransition).then(() => {
        isResettingRef.current = false;
      });
      prevFocusIndex.current = -1;
    } else if (sceneState !== 'FOCUS') {
      prevFocusIndex.current = -1;
      isResettingRef.current = false;
    }
  }, [sceneState, focusedTextureIndex, quality.cameraResetTransition]);

  // 非聚焦模式的旋转和俯仰控制
  useFrame(() => {
    if (!controlsRef.current) return;
    // FOCUS 模式或正在重置相机时，不处理手势旋转
    if (sceneState === 'FOCUS' || isResettingRef.current) return;

    // 水平旋转
    if (rotationSpeed !== 0) {
      controlsRef.current.rotate(rotationSpeed, 0, false);
    }
    // 垂直俯仰
    if (pitchSpeed !== 0) {
      controlsRef.current.rotate(0, pitchSpeed, false);
    }
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
        minPolarAngle={Math.PI / 4} // 限制最小俯角，防止变成完全的俯视图
        maxPolarAngle={Math.PI / 1.5} // 限制最大仰角，防止从正下方看
      />

      <color attach="background" args={['#000300']} />
      <Stars radius={100} depth={50} count={quality.starsCount} factor={4} saturation={0} fade speed={1} />
      {quality.enableEnvironment ? <Environment preset="night" background={false} /> : null}

      <ambientLight intensity={0.4} color="#003311" />
      <pointLight position={[30, 30, 30]} intensity={quality.keyLightIntensity} color={CONFIG.colors.warmLight} />
      <pointLight position={[-30, 10, -30]} intensity={quality.fillLightIntensity} color={CONFIG.colors.gold} />
      <pointLight position={[0, -20, 10]} intensity={quality.bottomLightIntensity} color="#ffffff" />

      <group position={[0, -6, 0]} onPointerMissed={handleMissedClick}>
        <Foliage state={sceneState} count={quality.foliageCount} />
        <ChristmasElements state={sceneState} count={quality.elementsCount} />
        <FairyLights state={sceneState} count={quality.lightsCount} />
        <TopStar state={sceneState} emissiveIntensity={quality.starEmissiveIntensity} />
        <Suspense fallback={null}>
          <PhotoOrnaments
            state={sceneState}
            focusedTextureIndex={focusedTextureIndex}
            onPhotoClick={onPhotoClick}
            onRegisterPosition={registerPhotoPosition}
            count={quality.ornamentsCount}
          />
        </Suspense>
        <Sparkles
          count={quality.sparklesCount}
          scale={50}
          size={8}
          speed={0.4}
          opacity={0.4}
          color={CONFIG.colors.silver}
        />
      </group>

      {effectsEnabled ? (
        <EffectComposer multisampling={quality.composerMultisampling}>
          <Bloom
            luminanceThreshold={0.8}
            luminanceSmoothing={0.1}
            intensity={quality.bloomIntensity}
            radius={quality.bloomRadius}
            mipmapBlur={quality.bloomMipmapBlur}
          />
          <Vignette eskil={false} offset={0.1} darkness={quality.vignetteDarkness} />
        </EffectComposer>
      ) : null}
    </>
  );
};

export interface TreeCanvasHandle {
  getNearestPhotoIndex: () => number;
}

const TreeCanvas = forwardRef<TreeCanvasHandle, {
  isMobile?: boolean;
  sceneState: SceneState;
  rotationSpeed: number;
  pitchSpeed: number;
  focusedTextureIndex: number;
  onPhotoClick: (textureIndex: number) => void;
  onExitFocus: () => void;
}>(function TreeCanvas({
  isMobile,
  sceneState,
  rotationSpeed,
  pitchSpeed,
  focusedTextureIndex,
  onPhotoClick,
  onExitFocus,
}, ref) {
  const cameraControlsRef = useRef<any>(null);
  const photoPositionsRef = useRef<Map<number, THREE.Vector3>>(new Map());
  const isMobileDevice =
    isMobile ??
    (typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      (navigator.maxTouchPoints > 0 || window.matchMedia('(max-width: 768px)').matches));

  const quality = useMemo<SceneQuality>(() => {
    if (!isMobileDevice) {
      return {
        dprMax: 1.5,
        foliageCount: CONFIG.counts.foliage,
        ornamentsCount: CONFIG.counts.ornaments,
        elementsCount: CONFIG.counts.elements,
        lightsCount: CONFIG.counts.lights,
        starsCount: 5000,
        sparklesCount: 600,
        enableEnvironment: true,
        composerMultisampling: 4,
        bloomIntensity: 1.5,
        bloomRadius: 0.5,
        bloomMipmapBlur: true,
        vignetteDarkness: 1.2,
        cameraResetTransition: true,
        starEmissiveIntensity: 2,
        keyLightIntensity: 100,
        fillLightIntensity: 50,
        bottomLightIntensity: 30,
      };
    }

    return {
      dprMax: 1.25,
      foliageCount: Math.round(CONFIG.counts.foliage * 0.6),
      ornamentsCount: CONFIG.counts.ornaments,
      elementsCount: Math.round(CONFIG.counts.elements * 0.45),
      lightsCount: Math.round(CONFIG.counts.lights * 0.5),
      starsCount: 1800,
      sparklesCount: 250,
      enableEnvironment: false,
      composerMultisampling: 0,
      bloomIntensity: 0.9,
      bloomRadius: 0.45,
      bloomMipmapBlur: false,
      vignetteDarkness: 1.0,
      cameraResetTransition: false,
      starEmissiveIntensity: 1.4,
      keyLightIntensity: 70,
      fillLightIntensity: 35,
      bottomLightIntensity: 25,
    };
  }, [isMobileDevice]);

  const clampDpr = useCallback((maxDpr: number) => {
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(Math.max(deviceDpr, 1), maxDpr);
  }, []);

  const [dpr, setDpr] = useState(() => clampDpr(quality.dprMax));
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const degradedRef = useRef(false);

  useEffect(() => {
    degradedRef.current = false;
    setEffectsEnabled(true);
    setDpr(clampDpr(quality.dprMax));
  }, [clampDpr, quality.dprMax]);

  const handlePerformanceDecline = useCallback(() => {
    if (!isMobileDevice || degradedRef.current) return;
    degradedRef.current = true;
    setDpr(1);
    setEffectsEnabled(false);
  }, [isMobileDevice]);

  // 暴露 getNearestPhotoIndex 方法给父组件
  useImperativeHandle(ref, () => ({
    getNearestPhotoIndex: () => {
      if (!cameraControlsRef.current || photoPositionsRef.current.size === 0) {
        return 0;
      }

      // 获取相机位置
      const cameraPosition = new THREE.Vector3();
      cameraControlsRef.current.getPosition(cameraPosition);

      // 找到最近的照片
      let nearestIndex = 0;
      let minDistance = Infinity;

      photoPositionsRef.current.forEach((pos, index) => {
        const distance = cameraPosition.distanceTo(pos);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = index;
        }
      });

      return nearestIndex;
    }
  }), []);

  const handleCameraRef = useCallback((controlsRef: any) => {
    cameraControlsRef.current = controlsRef;
  }, []);

  const handlePhotoPositionsRef = useCallback((positions: Map<number, THREE.Vector3>) => {
    photoPositionsRef.current = positions;
  }, []);

  return (
    <Canvas
      dpr={dpr}
      gl={{
        antialias: !isMobileDevice,
        toneMapping: THREE.ReinhardToneMapping,
        powerPreference: 'high-performance',
      }}
    >
      <PerformanceMonitor onDecline={handlePerformanceDecline} />
      <Experience
        sceneState={sceneState}
        rotationSpeed={rotationSpeed}
        pitchSpeed={pitchSpeed}
        focusedTextureIndex={focusedTextureIndex}
        onPhotoClick={onPhotoClick}
        onExitFocus={onExitFocus}
        onCameraRef={handleCameraRef}
        onPhotoPositionsRef={handlePhotoPositionsRef}
        quality={quality}
        effectsEnabled={effectsEnabled}
      />
    </Canvas>
  );
});

export default TreeCanvas;

