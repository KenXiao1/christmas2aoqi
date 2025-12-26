import { useEffect, useRef } from 'react';
import { DrawingUtils, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';

import { type SceneState, TOTAL_NUMBERED_PHOTOS, GESTURE_CONFIG } from './config';

type GestureType = SceneState | 'NEXT_PHOTO' | 'PREV_PHOTO' | 'ENTER_FOCUS';

type GestureControllerProps = {
  onGesture: (gesture: GestureType, nearestTextureIndex?: number) => void;
  onMove: (speed: number) => void;
  onPitch: (speed: number) => void;
  onStatus: (status: string) => void;
  debugMode: boolean;
  sceneState: SceneState;
  getNearestPhotoIndex?: () => number;
};

export default function GestureController({
  onGesture,
  onMove,
  onPitch,
  onStatus,
  debugMode,
  sceneState,
  getNearestPhotoIndex,
}: GestureControllerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugModeRef = useRef(debugMode);
  const sceneStateRef = useRef(sceneState);
  const lastGestureRef = useRef<string | null>(null);
  const gestureDebounceRef = useRef<number>(0);

  useEffect(() => {
    debugModeRef.current = debugMode;
  }, [debugMode]);

  useEffect(() => {
    sceneStateRef.current = sceneState;
  }, [sceneState]);

  useEffect(() => {
    let isMounted = true;
    let gestureRecognizer: GestureRecognizer | undefined;
    let requestRef: number | undefined;
    let stream: MediaStream | undefined;

    const cleanup = () => {
      if (requestRef) cancelAnimationFrame(requestRef);
      requestRef = undefined;

      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      stream = undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeClose = (gestureRecognizer as any)?.close;
      if (typeof maybeClose === 'function') maybeClose.call(gestureRecognizer);
      gestureRecognizer = undefined;
    };

    const setup = async () => {
      onStatus('DOWNLOADING AI...');
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
        );
        if (!isMounted) return;

        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (!isMounted) return;

        onStatus('REQUESTING CAMERA...');
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!isMounted) return;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();
        if (!isMounted) return;

        onStatus('AI READY: SHOW HAND');
        predictWebcam();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        onStatus(`ERROR: ${message || 'MODEL FAILED'}`);
        cleanup();
      }
    };

    const predictWebcam = () => {
      const recognizer = gestureRecognizer;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!recognizer || !video || !canvas) return;

      if (video.videoWidth > 0) {
        const results = recognizer.recognizeForVideo(video, Date.now());

        const ctx = canvas.getContext('2d');
        const shouldDebug = debugModeRef.current;
        if (ctx) {
          if (shouldDebug) {
            if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
            if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const drawingUtils = new DrawingUtils(ctx);
            if (results.landmarks) {
              for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(
                  landmarks,
                  GestureRecognizer.HAND_CONNECTIONS,
                  { color: '#FFD700', lineWidth: 2 },
                );
                drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 1 });
              }
            }
          } else if (canvas.width || canvas.height) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        if (results.gestures.length > 0) {
          const name = results.gestures[0][0].categoryName;
          const score = results.gestures[0][0].score;
          const now = Date.now();

          if (score > GESTURE_CONFIG.confidenceThreshold) {
            // 对于 Thumb_Up/Down，只在手势变化时触发（不允许保持手势重复触发）
            const isPhotoSwitchGesture = name === 'Thumb_Up' || name === 'Thumb_Down';
            const shouldTrigger = isPhotoSwitchGesture
              ? name !== lastGestureRef.current  // 只允许手势变化时触发
              : (name !== lastGestureRef.current || now - gestureDebounceRef.current > 500);

            if (shouldTrigger) {
              lastGestureRef.current = name;
              gestureDebounceRef.current = now;

              const currentState = sceneStateRef.current;

              if (name === 'Open_Palm') {
                onGesture('CHAOS');
              } else if (name === 'Closed_Fist') {
                onGesture('FORMED');
              } else if (name === 'Pointing_Up') {
                // ☝️ 进入聚焦 - 选择最近的照片
                if (currentState !== 'FOCUS') {
                  const nearestIndex = getNearestPhotoIndex?.() ?? Math.floor(Math.random() * TOTAL_NUMBERED_PHOTOS);
                  onGesture('ENTER_FOCUS', nearestIndex);
                }
              } else if (name === 'Thumb_Up') {
                // 👍 上一张（仅在 FOCUS 模式，且只在手势变化时触发）
                if (currentState === 'FOCUS') {
                  onGesture('PREV_PHOTO');
                }
              } else if (name === 'Thumb_Down') {
                // 👎 下一张（仅在 FOCUS 模式，且只在手势变化时触发）
                if (currentState === 'FOCUS') {
                  onGesture('NEXT_PHOTO');
                }
              }

              if (shouldDebug) onStatus(`DETECTED: ${name}`);
            }
          }

          if (results.landmarks.length > 0) {
            const handX = results.landmarks[0][0].x;
            const handY = results.landmarks[0][0].y;

            // X轴控制旋转
            const rotationSpeed = (0.5 - handX) * GESTURE_CONFIG.rotationSensitivity;
            onMove(Math.abs(rotationSpeed) > GESTURE_CONFIG.rotationDeadZone ? rotationSpeed : 0);

            // Y轴控制俯仰
            const pitchSpeed = (0.5 - handY) * GESTURE_CONFIG.pitchSensitivity;
            onPitch(Math.abs(pitchSpeed) > GESTURE_CONFIG.pitchDeadZone ? pitchSpeed : 0);
          }
        } else {
          lastGestureRef.current = null;
          onMove(0);
          onPitch(0);
          if (shouldDebug) onStatus('AI READY: NO HAND');
        }
      }

      requestRef = requestAnimationFrame(predictWebcam);
    };

    setup();
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [onGesture, onMove, onPitch, onStatus, getNearestPhotoIndex]);

  return (
    <>
      <video
        ref={videoRef}
        style={{
          opacity: debugMode ? 0.6 : 0,
          position: 'fixed',
          top: 0,
          right: 0,
          width: debugMode ? '320px' : '1px',
          zIndex: debugMode ? 100 : -1,
          pointerEvents: 'none',
          transform: 'scaleX(-1)',
        }}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: debugMode ? '320px' : '1px',
          height: debugMode ? 'auto' : '1px',
          zIndex: debugMode ? 101 : -1,
          pointerEvents: 'none',
          transform: 'scaleX(-1)',
        }}
      />
    </>
  );
}

