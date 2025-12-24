# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive 3D Christmas tree web app built with React, Three.js (via React Three Fiber), and MediaPipe AI gesture recognition. Features 45K+ particles, photo ornaments, and hand gesture control for tree state and camera rotation.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # TypeScript compile + Vite production build
npm run lint     # ESLint check
npm run preview  # Preview production build
```

## Architecture

### Component Structure

```
App.tsx                    # Root: UI controls, state management, lazy loading
├── TreeCanvas.tsx         # 3D scene (lazy loaded)
│   ├── Foliage           # 15K particle tree body with GLSL shaders
│   ├── PhotoOrnaments    # 300 Polaroid-style photo frames
│   ├── ChristmasElements # 200 gifts, ornaments, candy canes
│   ├── FairyLights       # 400 twinkling lights
│   └── TopStar           # Golden star (FORMED state only)
└── GestureController.tsx  # MediaPipe hand tracking (lazy loaded)
```

### Key Files

- **src/config.ts** - Central configuration: colors, particle counts, tree dimensions, photo paths. Modify `TOTAL_NUMBERED_PHOTOS` to change photo count.
- **public/photos/** - User photos: `top.jpg` for star, `1.jpg`-`31.jpg` for ornaments.

### State Flow

- `sceneState`: `'CHAOS'` (dispersed) / `'FORMED'` (assembled tree)
- `aiStatus`: AI toggle and gesture detection status
- `rotationSpeed`: Camera rotation from hand position tracking
- Gesture callbacks flow: GestureController → App → TreeCanvas

### Performance Optimizations

- TreeCanvas and GestureController are lazy-loaded via `React.lazy()`
- AI/MediaPipe only loads when user enables it (not on initial render)
- Canvas DPR capped at [1, 1.5]
- Photo textures wrapped in separate Suspense boundary

### 3D Rendering

- Custom GLSL shaderMaterial for foliage particles with morphing animation
- BufferGeometry with Float32Array attributes for GPU-optimized rendering
- useFrame hook for animation loops
- Post-processing: Bloom + Vignette effects
- Environment: night preset with 5K star particles

### Gesture Recognition

- MediaPipe models loaded from CDN on demand
- Open_Palm → CHAOS, Closed_Fist → FORMED
- Hand X/Y position maps to camera rotation speed
- Debug mode overlays hand landmarks on video feed
