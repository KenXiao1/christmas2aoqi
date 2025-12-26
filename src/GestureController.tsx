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

  // 计时器：用于防误触
  const exitGestureTimerRef = useRef<number | null>(null);
  const enterFocusTimerRef = useRef<number | null>(null);
  const EXIT_CONFIRM_DURATION = 400; // 退出保持 400ms
  const ENTER_CONFIRM_DURATION = 250; // 进入保持 250ms（过滤握拳移动中的闪变）

  // 使用 refs 保持回调引用
  const onGestureRef = useRef(onGesture);
  const onMoveRef = useRef(onMove);
  const onPitchRef = useRef(onPitch);
  const getNearestPhotoIndexRef = useRef(getNearestPhotoIndex);

  useEffect(() => {
    debugModeRef.current = debugMode;
  }, [debugMode]);

  useEffect(() => {
    sceneStateRef.current = sceneState;
  }, [sceneState]);

  useEffect(() => {
    onGestureRef.current = onGesture;
    onMoveRef.current = onMove;
    onPitchRef.current = onPitch;
    getNearestPhotoIndexRef.current = getNearestPhotoIndex;
  }, [onGesture, onMove, onPitch, getNearestPhotoIndex]);

  useEffect(() => {
    let isMounted = true;
    let gestureRecognizer: GestureRecognizer | undefined;
    let requestRef: number | undefined;
    let stream: MediaStream | undefined;

    const cleanup = () => {
      if (requestRef) cancelAnimationFrame(requestRef);
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeClose = (gestureRecognizer as any)?.close;
      if (typeof maybeClose === 'function') maybeClose.call(gestureRecognizer);
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
        onStatus(`ERROR: MODEL FAILED`);
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
        if (ctx && debugModeRef.current) {
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const drawingUtils = new DrawingUtils(ctx);
          if (results.landmarks) {
            for (const landmarks of results.landmarks) {
              drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: '#FFD700', lineWidth: 2 });
              drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', lineWidth: 1 });
            }
          }
        }

        if (results.gestures.length > 0) {
          const name = results.gestures[0][0].categoryName;
          const score = results.gestures[0][0].score;
          const now = Date.now();

          if (score > GESTURE_CONFIG.confidenceThreshold) {
            const currentState = sceneStateRef.current;
            const isExitGesture = name === 'Open_Palm' || name === 'Closed_Fist';

            // 1. 聚焦模式下的“退出”确认逻辑 (400ms)
            if (currentState === 'FOCUS' && isExitGesture) {
              if (!exitGestureTimerRef.current) {
                exitGestureTimerRef.current = now;
              } else if (now - exitGestureTimerRef.current > EXIT_CONFIRM_DURATION) {
                onGestureRef.current(name === 'Open_Palm' ? 'CHAOS' : 'FORMED');
                exitGestureTimerRef.current = null;
                lastGestureRef.current = name;
              }
              enterFocusTimerRef.current = null; // 清除进入计时器
            }
            // 2. 非聚焦模式下的“进入聚焦”确认逻辑 (250ms)
            else if (currentState !== 'FOCUS' && name === 'Pointing_Up') {
              if (!enterFocusTimerRef.current) {
                enterFocusTimerRef.current = now;
              } else if (now - enterFocusTimerRef.current > ENTER_CONFIRM_DURATION) {
                const nearestIndex = getNearestPhotoIndexRef.current?.() ?? 0;
                onGestureRef.current('ENTER_FOCUS', nearestIndex);
                enterFocusTimerRef.current = null;
                lastGestureRef.current = name;
              }
              exitGestureTimerRef.current = null; // 清除退出计时器
            }
            // 3. 通用即时指令（翻页、非聚焦下的散开/聚合）
            else {
              exitGestureTimerRef.current = null;
              enterFocusTimerRef.current = null;

              const isSwitch = name === 'Thumb_Up' || name === 'Thumb_Down';
              const shouldTrigger = isSwitch
                ? name !== lastGestureRef.current
                : (name !== lastGestureRef.current || now - gestureDebounceRef.current > 500);

              if (shouldTrigger) {
                lastGestureRef.current = name;
                gestureDebounceRef.current = now;

                if (name === 'Open_Palm' && currentState !== 'FOCUS') {
                  onGestureRef.current('CHAOS');
                } else if (name === 'Closed_Fist' && currentState !== 'FOCUS') {
                  onGestureRef.current('FORMED');
                } else if (name === 'Thumb_Up' && currentState === 'FOCUS') {
                  onGestureRef.current('PREV_PHOTO');
                } else if (name === 'Thumb_Down' && currentState === 'FOCUS') {
                  onGestureRef.current('NEXT_PHOTO');
                }
              }
            }
          }
        } else {
          lastGestureRef.current = null;
          exitGestureTimerRef.current = null;
          enterFocusTimerRef.current = null;
          onMoveRef.current(0);
          onPitchRef.current(0);
        }

        if (results.landmarks.length > 0) {
          const handX = results.landmarks[0][0].x;
          const handY = results.landmarks[0][0].y;
          const rot = (0.5 - handX) * GESTURE_CONFIG.rotationSensitivity;
          onMoveRef.current(Math.abs(rot) > GESTURE_CONFIG.rotationDeadZone ? rot : 0);
          const pit = (0.5 - handY) * GESTURE_CONFIG.pitchSensitivity;
          onPitchRef.current(Math.abs(pit) > GESTURE_CONFIG.pitchDeadZone ? pit : 0);
        }
      }

      requestRef = requestAnimationFrame(predictWebcam);
    };

    setup();
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [onStatus]);

  return (
    <>
      <video ref={videoRef} style={{ opacity: debugMode ? 0.6 : 0, position: 'fixed', top: 0, right: 0, width: debugMode ? '320px' : '1px', zIndex: debugMode ? 100 : -1, pointerEvents: 'none', transform: 'scaleX(-1)' }} playsInline muted autoPlay />
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, right: 0, width: debugMode ? '320px' : '1px', zIndex: debugMode ? 101 : -1, pointerEvents: 'none', transform: 'scaleX(-1)' }} />
    </>
  );
}
