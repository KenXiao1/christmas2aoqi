import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';

import { type SceneState, TOTAL_NUMBERED_PHOTOS } from './config';
import type { TreeCanvasHandle } from './TreeCanvas';

const TreeCanvas = lazy(() => import('./TreeCanvas'));
const GestureController = lazy(() => import('./GestureController'));

// 默认自动旋转速度（弧度/帧）
const AUTO_ROTATION_SPEED = 0.002;

export default function GrandTreeApp() {
  const [sceneState, setSceneState] = useState<SceneState>('CHAOS');
  const [rotationSpeed, setRotationSpeed] = useState(0);
  const [pitchSpeed, setPitchSpeed] = useState(0);
  const [aiStatus, setAiStatus] = useState('AI: OFF');
  const [debugMode, setDebugMode] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [showScene, setShowScene] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [showGestureHint, setShowGestureHint] = useState(false);

  // 聚焦相关状态 - 使用 textureIndex (0-5) 而非 ornamentIndex (0-11)
  const [focusedTextureIndex, setFocusedTextureIndex] = useState<number>(-1);
  const [previousState, setPreviousState] = useState<'CHAOS' | 'FORMED'>('FORMED');
  const [isMobile, setIsMobile] = useState(false);

  // TreeCanvas ref 用于获取最近照片索引
  const treeCanvasRef = useRef<TreeCanvasHandle | null>(null);

  // 引导弹窗状态
  const [showGuide, setShowGuide] = useState(false);

  // 滑动手势相关
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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

  // 首次访问显示引导弹窗
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('christmas-tree-guide-seen');
    if (!hasSeenGuide) {
      // 延迟显示，等待场景加载
      const timer = setTimeout(() => setShowGuide(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeGuide = useCallback(() => {
    setShowGuide(false);
    localStorage.setItem('christmas-tree-guide-seen', 'true');
  }, []);

  // 打开帮助弹窗
  const openGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  // 进入聚焦模式
  const enterFocusMode = useCallback((textureIndex: number) => {
    if (sceneState === 'FOCUS') {
      // 已在 FOCUS 模式，直接切换到新照片
      setFocusedTextureIndex(textureIndex);
      return;
    }
    setPreviousState(sceneState as 'CHAOS' | 'FORMED');
    setFocusedTextureIndex(textureIndex);
    setSceneState('FOCUS');
    setRotationSpeed(0);
  }, [sceneState]);

  // 退出聚焦模式
  const exitFocusMode = useCallback(() => {
    if (sceneState !== 'FOCUS') return;
    setSceneState(previousState);
    setFocusedTextureIndex(-1);
  }, [sceneState, previousState]);

  // 下一张照片 - 纯循环
  const nextPhoto = useCallback(() => {
    if (sceneState !== 'FOCUS' || focusedTextureIndex === -1) return;
    setFocusedTextureIndex((prev) => (prev + 1) % TOTAL_NUMBERED_PHOTOS);
  }, [sceneState, focusedTextureIndex]);

  // 上一张照片 - 纯循环
  const prevPhoto = useCallback(() => {
    if (sceneState !== 'FOCUS' || focusedTextureIndex === -1) return;
    setFocusedTextureIndex((prev) => (prev - 1 + TOTAL_NUMBERED_PHOTOS) % TOTAL_NUMBERED_PHOTOS);
  }, [sceneState, focusedTextureIndex]);

  // 手势回调 - 支持更多手势
  type GestureType = SceneState | 'NEXT_PHOTO' | 'PREV_PHOTO' | 'ENTER_FOCUS';
  const handleGesture = useCallback((gesture: GestureType, nearestTextureIndex?: number) => {
    // 无论当前在什么模式，如果是直接的粒子状态指令，都直接切换
    if (gesture === 'CHAOS' || gesture === 'FORMED') {
      if (sceneState === 'FOCUS') {
        setFocusedTextureIndex(-1);
      }
      setSceneState(gesture);
      return;
    }

    if (gesture === 'ENTER_FOCUS') {
      // ☝️ Pointing_Up 进入聚焦
      if (sceneState !== 'FOCUS' && nearestTextureIndex !== undefined && nearestTextureIndex >= 0) {
        enterFocusMode(nearestTextureIndex);
      }
      return;
    }

    if (sceneState === 'FOCUS') {
      // FOCUS 模式下的手势处理
      if (gesture === 'NEXT_PHOTO') nextPhoto(); // 👎 下一张
      if (gesture === 'PREV_PHOTO') prevPhoto(); // 👍 上一张
      return;
    }
  }, [sceneState, enterFocusMode, nextPhoto, prevPhoto]);

  // 手势移动回调 - FOCUS 模式下忽略
  const handleMove = useCallback((speed: number) => {
    if (sceneState === 'FOCUS') return;
    setRotationSpeed(speed);
    // 当手势控制有输入时，标记用户正在交互
    setIsUserInteracting(speed !== 0);
  }, [sceneState]);

  // 手势俯仰回调 - FOCUS 模式下忽略
  const handlePitch = useCallback((speed: number) => {
    if (sceneState === 'FOCUS') return;
    setPitchSpeed(speed);
  }, [sceneState]);

  // 计算最终旋转速度：FOCUS 模式不旋转，用户交互时使用手势速度，否则自动旋转
  const effectiveRotationSpeed = sceneState === 'FOCUS'
    ? 0
    : (gestureEnabled && isUserInteracting ? rotationSpeed : AUTO_ROTATION_SPEED);

  // 计算最终俯仰速度：FOCUS 模式不俯仰
  const effectivePitchSpeed = sceneState === 'FOCUS'
    ? 0
    : (gestureEnabled ? pitchSpeed : 0);

  // 获取最近照片索引的回调（供 GestureController 使用）
  const getNearestPhotoIndex = useCallback(() => {
    return treeCanvasRef.current?.getNearestPhotoIndex() ?? 0;
  }, []);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (sceneState !== 'FOCUS') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextPhoto();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPhoto();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sceneState, nextPhoto, prevPhoto, exitFocusMode]);

  // 触屏滑动手势
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (sceneState !== 'FOCUS') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [sceneState]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (sceneState !== 'FOCUS' || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    const SWIPE_THRESHOLD = 50;

    if (absDeltaY > absDeltaX && deltaY > SWIPE_THRESHOLD) {
      // 下滑退出
      exitFocusMode();
    } else if (absDeltaX > absDeltaY && absDeltaX > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        // 左滑 → 下一张
        nextPhoto();
      } else {
        // 右滑 → 上一张
        prevPhoto();
      }
    }
    touchStartRef.current = null;
  }, [sceneState, nextPhoto, prevPhoto, exitFocusMode]);

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
    if (gestureEnabled) {
      setAiStatus('INITIALIZING...');
      // 首次启用时显示手势提示
      setShowGestureHint(true);
      // 5秒后自动隐藏
      const timer = setTimeout(() => setShowGestureHint(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setAiStatus('AI: OFF');
      setRotationSpeed(0);
      setPitchSpeed(0);
      setDebugMode(false);
      setIsUserInteracting(false);
      setShowGestureHint(false);
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
              ref={treeCanvasRef}
              sceneState={sceneState}
              rotationSpeed={effectiveRotationSpeed}
              pitchSpeed={effectivePitchSpeed}
              focusedTextureIndex={focusedTextureIndex}
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
            onPitch={handlePitch}
            onStatus={setAiStatus}
            debugMode={debugMode}
            sceneState={sceneState}
            getNearestPhotoIndex={getNearestPhotoIndex}
          />
        </Suspense>
      ) : null}

      {/* 虚拟方向键 - 桌面端 FOCUS 模式显示 */}
      {sceneState === 'FOCUS' && !isMobile && (
        <>
          <button
            onClick={prevPhoto}
            style={{
              position: 'absolute',
              left: '40px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              color: '#FFD700',
              fontSize: '24px',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="上一张"
          >
            &lt;
          </button>
          <button
            onClick={nextPhoto}
            style={{
              position: 'absolute',
              right: '40px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              color: '#FFD700',
              fontSize: '24px',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="下一张"
          >
            &gt;
          </button>
        </>
      )}

      {/* UI - Top Bar */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '40px',
          right: '40px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Author Credit & Help */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              color: '#888',
              fontFamily: 'sans-serif',
              fontSize: '12px',
            }}
          >
            by{' '}
            <a
              href="https://kenxiao.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#FFD700',
                textDecoration: 'none',
              }}
            >
              Ken Xiao
            </a>
          </div>
          <button
            onClick={openGuide}
            style={{
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255, 215, 0, 0.4)',
              borderRadius: '4px',
              color: 'rgba(255, 215, 0, 0.7)',
              fontFamily: 'sans-serif',
              fontSize: '11px',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >
            ?
          </button>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          {/* AI Status */}
          <div
            style={{
              color: aiStatus.includes('ERROR') ? '#FF0000' : 'rgba(255, 215, 0, 0.4)',
              fontSize: '10px',
              letterSpacing: '2px',
              background: 'rgba(0,0,0,0.5)',
              padding: '4px 8px',
              borderRadius: '4px',
              marginRight: '10px',
            }}
          >
            {aiStatus}
          </div>
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
              backdropFilter: 'blur(4px)',
            }}
          >
            {sceneState === 'FOCUS' ? '退出聚焦' : sceneState === 'CHAOS' ? '聚合成树' : '散开'}
          </button>
        </div>
      </div>


      {/* 手势提示 UI - 启用手势控制时显示 */}
      {showGestureHint && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            backgroundColor: 'rgba(0, 20, 10, 0.9)',
            border: '1px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '12px',
            padding: '16px 24px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.2)',
            animation: 'fadeIn 0.3s ease-out',
          }}
          onClick={() => setShowGestureHint(false)}
        >
          <div
            style={{
              color: '#FFD700',
              fontFamily: 'sans-serif',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            手势控制
          </div>
          <div
            style={{
              color: '#fff',
              fontFamily: 'sans-serif',
              fontSize: '13px',
              lineHeight: 1.8,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '4px 12px',
            }}
          >
            <span>🖐️</span><span>张开手掌 → 散开粒子</span>
            <span>✊</span><span>握拳 → 聚合成树</span>
            <span>☝️</span><span>竖食指 → 查看照片</span>
            <span>👍👎</span><span>大拇指 → 切换照片</span>
          </div>
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'sans-serif',
              fontSize: '11px',
              marginTop: '10px',
              textAlign: 'center',
            }}
          >
            点击关闭
          </div>
        </div>
      )}

      {/* 引导弹窗 */}
      {showGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={closeGuide}
        >
          <div
            style={{
              backgroundColor: 'rgba(0, 20, 10, 0.95)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '12px',
              padding: isMobile ? '24px 20px' : '40px 50px',
              maxWidth: isMobile ? '90%' : '580px',
              width: isMobile ? 'auto' : '580px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 40px rgba(255, 215, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                color: '#FFD700',
                fontFamily: 'serif',
                fontSize: isMobile ? '20px' : '28px',
                marginBottom: isMobile ? '20px' : '28px',
                textAlign: 'center',
                letterSpacing: '2px',
              }}
            >
              {isMobile ? '操作指南' : '操作指南'}
            </h2>

            {isMobile ? (
              // 移动端内容
              <div style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '14px', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: '#FFD700', marginBottom: '8px', fontWeight: 'bold' }}>基础操作</div>
                  <div>点击右上角按钮切换圣诞树状态</div>
                  <div>点击照片进入聚焦浏览</div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: '#FFD700', marginBottom: '8px', fontWeight: 'bold' }}>照片浏览</div>
                  <div>← 左滑：下一张</div>
                  <div>→ 右滑：上一张</div>
                  <div>↓ 下滑：退出聚焦</div>
                </div>
                <div>
                  <div style={{ color: '#FFD700', marginBottom: '8px', fontWeight: 'bold' }}>手势控制（可选）</div>
                  <div>开启后用手势控制圣诞树</div>
                </div>
              </div>
            ) : (
              // 桌面端内容
              <div style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '16px', lineHeight: 2 }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: '#FFD700', marginBottom: '10px', fontWeight: 'bold', fontSize: '17px' }}>基础操作</div>
                  <div>点击右上角按钮切换圣诞树状态</div>
                  <div>点击照片进入聚焦浏览</div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: '#FFD700', marginBottom: '10px', fontWeight: 'bold', fontSize: '17px' }}>照片浏览</div>
                  <div>← → 方向键：切换照片</div>
                  <div>ESC：退出聚焦</div>
                  <div>或点击左右两侧的导航按钮</div>
                </div>
                <div>
                  <div style={{ color: '#FFD700', marginBottom: '10px', fontWeight: 'bold', fontSize: '17px' }}>手势控制（可选）</div>
                  <div>✋ 张开手掌：散开粒子</div>
                  <div>✊ 握拳：聚合成树</div>
                  <div>☝️ 指向上：进入聚焦</div>
                  <div>👍 / 👎：切换照片</div>
                </div>
              </div>
            )}

            <button
              onClick={closeGuide}
              style={{
                marginTop: isMobile ? '24px' : '32px',
                width: '100%',
                padding: isMobile ? '12px 24px' : '14px 28px',
                backgroundColor: '#FFD700',
                border: 'none',
                borderRadius: '6px',
                color: '#000',
                fontFamily: 'sans-serif',
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              开始体验
            </button>

            {/* AI 生成声明 */}
            <div
              style={{
                marginTop: '16px',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: isMobile ? '10px' : '11px',
                fontFamily: 'sans-serif',
                lineHeight: 1.5,
              }}
            >
              Images are generated by Google AI Model Gemini-3-pro-image-preview (Nanobanana Pro). If any content seems inappropriate, please{' '}
              <a
                href="https://kenxiao.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255, 215, 0, 0.6)', textDecoration: 'none' }}
              >
                contact me
              </a>
              .
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
