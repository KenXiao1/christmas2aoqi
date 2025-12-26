# Interactive 3D Christmas Tree

A high-fidelity 3D Christmas tree web application built with **React**, **Three.js (React Three Fiber)**, and **MediaPipe AI gesture recognition**.

![Preview](public/preview.png)
<img width="3168" height="1636" alt="image" src="https://github.com/user-attachments/assets/b35d368c-538b-4573-810e-3d2ac5775dc4" />
<img width="3103" height="1709" alt="image" src="https://github.com/user-attachments/assets/997a7a3e-af20-4cbd-920f-8f34a73ebbee" />



## Features

- **45,000+ Particles** - Glowing particle tree with custom GLSL shaders and morphing animations
- **Photo Ornaments** - 300 Polaroid-style frames displaying your photos, with focus mode for browsing
- **AI Gesture Control** - Hand tracking via MediaPipe for touchless interaction
- **Christmas Decorations** - Fairy lights, gifts, ornaments, candy canes, and a golden top star
- **Post-processing Effects** - Bloom, vignette, and 5K star background

## Demo

[View Demo](https://christmas2aoqi.netlify.app/)

### Gesture Controls

| Gesture | Action |
|---------|--------|
| Open Palm | Disperse particles (CHAOS mode) |
| Closed Fist | Assemble tree (FORMED mode) |
| Pointing Up | Focus on nearest photo |
| Thumbs Up/Down | Navigate photos in focus mode |
| Hand Movement (X) | Rotate camera horizontally |
| Hand Movement (Y) | Tilt camera vertically |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Customizing Photos

1. Place photos in `public/photos/`:
   - `top.jpg` - Star photo (displayed on tree top)
   - `1.jpg`, `2.jpg`, ... `N.jpg` - Ornament photos

2. Update photo count in `src/config.ts`:
   ```ts
   TOTAL_NUMBERED_PHOTOS: 31  // Change to match your photo count
   ```

## Architecture

```
App.tsx                    # Root: UI controls, state management
├── TreeCanvas.tsx         # 3D scene (lazy loaded)
│   ├── Foliage           # 15K particle tree with GLSL shaders
│   ├── PhotoOrnaments    # Polaroid-style photo frames
│   ├── ChristmasElements # Gifts, ornaments, candy canes
│   ├── FairyLights       # Twinkling lights
│   └── TopStar           # Golden star (FORMED state)
└── GestureController.tsx  # MediaPipe hand tracking (lazy loaded)
```

## Performance Optimizations

- **Lazy Loading** - TreeCanvas and GestureController load on demand
- **AI on Demand** - MediaPipe only loads when user enables gesture control
- **Optimized DPR** - Canvas capped at [1, 1.5] device pixel ratio
- **Separate Suspense** - Photo textures don't block other rendering

## Tech Stack

- React 18 + Vite
- Three.js / React Three Fiber
- @react-three/drei & @react-three/postprocessing
- MediaPipe Tasks Vision (Google)

## Changelog

- **Y-axis Camera Control** - Hand vertical movement controls camera pitch
- **Focus Mode Debounce** - Thumb gestures trigger only on state change
- **Nearest Photo Selection** - Pointing Up selects closest photo to camera
- **Confidence Threshold** - Raised to 0.65 to reduce false positives
- **Camera Dead Zone** - Increased to 0.03 to reduce jitter
- **Auto Rotation** - Slow elegant rotation when not interacting
- **Photo Billboard** - Photos rotate to face camera in focus mode
- **Camera Centering** - Initial view targets tree center (0, -6, 0)
- **Performance** - LCP reduced from ~2675ms to ~1592ms


---

Merry Christmas!
<br>
🌕🌕🌕🌕🌕🌕🌕🌕🌕🌕🌕
<br>
🌕🌕🌕🌕🌕🌕🌘🌑🌒🌕🌕 
<br>
🌕🌕🌕🌕🌕🌘🌑🌑🌑🌒🌕
<br>
🌕🌕🌕🌕🌕🌕🌘🌑🌑🌒🌕
<br>
🌕🌕🍎🌕🌕🌕🌗🌘🌑🌓🌕
<br>
🌕🌕🌑🌒🌕🌕🌘🌑🌑🌕🌕
<br>
🌕🌕🌘🌑🌔🌖🌑🌑🌑🌖🌕
<br>
🌕🌕🌕🌘🌑🌑🌑🌑🌑🌔🌕 
<br>
🌕🌕🌖🌑🌑🌑🌑🌑🌑🌒🌕
<br>
~~平安夜就要吃bad apple~~
