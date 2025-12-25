import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

import { CONFIG, type SceneState } from './config';

const TreeCanvas = lazy(() => import('./TreeCanvas'));
const GestureController = lazy(() => import('./GestureController'));

export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<SceneState>('CHAOS');
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [aiStatus, setAiStatus] = useState('AI: OFF');
  const [debugMode, setDebugMode] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [showScene, setShowScene] = useState(false);

  // 新增：聚焦相关状态
  const [focusedPhotoIndex, setFocusedPhotoIndex] = useState<number>(-1);
  const [focusedPhotoPosition, setFocusedPhotoPosition] = useState<THREE.Vector3 | null>(null);
  const [previousState, setPreviousState] = useState<'CHAOS' | 'FORMED'>('FORMED');
  const [isMobile, setIsMobile] = useState(false);

  // 移动端检测
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(max-width: 768px)').matches
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 进入聚焦模式
  const enterFocusMode = useCallback((photoIndex: number, position: THREE.Vector3) => {
    if (sceneState === 'FOCUS') return;
    setPreviousState(sceneState as 'CHAOS' | 'FORMED');
    setFocusedPhotoIndex(photoIndex);
    setFocusedPhotoPosition(position);
    setSceneState('FOCUS');
    setRotationSpeed(0);
  }, [sceneState]);

  // 退出聚焦模式
  const exitFocusMode = useCallback(() => {
    if (sceneState !== 'FOCUS') return;
    setSceneState(previousState);
    setFocusedPhotoIndex(-1);
    setFocusedPhotoPosition(null);
  }, [sceneState, previousState]);

  // 手势回调 - FOCUS 模式下特殊处理
  const handleGesture = useCallback((gesture: SceneState) => {
    if (sceneState === 'FOCUS') {
      // FOCUS 模式下：Closed_Fist (FORMED) 退出聚焦，忽略 Open_Palm
      if (gesture === 'FORMED') exitFocusMode();
      return;
    }
    setSceneState(gesture);
  }, [sceneState, exitFocusMode]);

  // 手势移动回调 - FOCUS 模式下忽略
  const handleMove = useCallback((speed: number) => {
    if (sceneState === 'FOCUS') return;
    setRotationSpeed(speed);
  }, [sceneState]);

  useEffect(() => {
    const enable = () => setShowScene(true);

    const requestIdleCallback = (window as any).requestIdleCallback as
      | undefined
      | ((cb: () => void, opts?: { timeout: number }) => number);
    const cancelIdleCallback = (window as any).cancelIdleCallback as undefined | ((id: number) => void);

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(enable, { timeout: 1500 });
      return () => cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(enable, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (gestureEnabled) setAiStatus('INITIALIZING...');
    else {
      setAiStatus('AI: OFF');
      setRotationSpeed(0);
      setDebugMode(false);
    }
  }, [gestureEnabled]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      >
        {showScene ? (
          <Suspense fallback={null}>
            <TreeCanvas
              sceneState={sceneState}
              rotationSpeed={rotationSpeed}
              focusedPhotoIndex={focusedPhotoIndex}
              focusedPhotoPosition={focusedPhotoPosition}
              onPhotoClick={enterFocusMode}
              onExitFocus={exitFocusMode}
            />
          </Suspense>
        ) : null}
      </div>

      {gestureEnabled ? (
        <Suspense fallback={null}>
          <GestureController
            onGesture={handleGesture}
            onMove={handleMove}
            onStatus={setAiStatus}
            debugMode={debugMode}
          />
        </Suspense>
      ) : null}

      {/* UI - Stats */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '40px',
          color: '#888',
          zIndex: 10,
          fontFamily: 'sans-serif',
          userSelect: 'none',
        }}
      >
        <div style={{ marginBottom: '15px' }}>
          <p
            style={{
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Memories
          </p>
          <p style={{ fontSize: '24px', color: '#FFD700', fontWeight: 'bold', margin: 0 }}>
            {CONFIG.counts.ornaments.toLocaleString()}{' '}
            <span style={{ fontSize: '10px', color: '#555', fontWeight: 'normal' }}>
              POLAROIDS
            </span>
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Foliage
          </p>
          <p style={{ fontSize: '24px', color: '#004225', fontWeight: 'bold', margin: 0 }}>
            {(CONFIG.counts.foliage / 1000).toFixed(0)}K{' '}
            <span style={{ fontSize: '10px', color: '#555', fontWeight: 'normal' }}>
              EMERALD NEEDLES
            </span>
          </p>
        </div>
      </div>

      {/* UI - Buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '40px',
          zIndex: 10,
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          onClick={() => setGestureEnabled((v) => !v)}
          style={{
            padding: '12px 15px',
            backgroundColor: gestureEnabled ? '#FFD700' : 'rgba(0,0,0,0.5)',
            border: '1px solid #FFD700',
            color: gestureEnabled ? '#000' : '#FFD700',
            fontFamily: 'sans-serif',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          {gestureEnabled ? '手势控制 开' : '手势控制 关'}
        </button>
        {/* DEBUG 按钮 - 移动端隐藏 */}
        {!isMobile && (
          <button
            onClick={() => setDebugMode((v) => !v)}
            disabled={!gestureEnabled}
            style={{
              padding: '12px 15px',
              backgroundColor: debugMode ? '#FFD700' : 'rgba(0,0,0,0.5)',
              border: '1px solid #FFD700',
              color: debugMode ? '#000' : '#FFD700',
              fontFamily: 'sans-serif',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: gestureEnabled ? 'pointer' : 'not-allowed',
              opacity: gestureEnabled ? 1 : 0.5,
              backdropFilter: 'blur(4px)',
            }}
          >
            {debugMode ? '隐藏调试' : '调试'}
          </button>
        )}
        <button
          onClick={() => {
            if (sceneState === 'FOCUS') {
              exitFocusMode();
            } else {
              setSceneState((s) => (s === 'CHAOS' ? 'FORMED' : 'CHAOS'));
            }
          }}
          style={{
            padding: '12px 30px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            color: '#FFD700',
            fontFamily: 'serif',
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          {sceneState === 'FOCUS' ? '退出聚焦' : sceneState === 'CHAOS' ? '聚合成树' : '散开'}
        </button>
      </div>

      {/* UI - AI Status */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: aiStatus.includes('ERROR') ? '#FF0000' : 'rgba(255, 215, 0, 0.4)',
          fontSize: '10px',
          letterSpacing: '2px',
          zIndex: 10,
          background: 'rgba(0,0,0,0.5)',
          padding: '4px 8px',
          borderRadius: '4px',
        }}
      >
        {aiStatus}
      </div>
    </div>
  );
}
