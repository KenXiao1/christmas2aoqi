// 主题系统类型定义和导出
export type ThemeId = 'classic' | 'pink-fantasy' | 'sparkling-pink';

export interface FoliageConfig {
  count: number;
  colors: string[];
  geometry: 'points' | 'octahedron' | 'icosahedron' | 'dodecahedron' | 'tetrahedron';
  material: {
    roughness: number;
    metalness: number;
  };
}

export interface DecorationTypeConfig {
  geometry: 'cube' | 'icosahedron' | 'sphere' | 'cylinder';
  colors: string[];
  material: {
    roughness: number;
    metalness: number;
    envMapIntensity: number;
  };
}

export interface DecorationsConfig {
  count: number;
  types: DecorationTypeConfig[];
}

export interface SpiralRibbonConfig {
  enabled: boolean;
  particleCount: number;
  spirals: number;
  color: string;
}

export interface StarConfig {
  color: string;
  emissiveIntensity: number;
  style: 'classic' | 'delicate';
  sparkles: {
    count: number;
    color: string;
    size: number;
  };
}

export interface LightConfig {
  position: [number, number, number];
  intensity: number;
  color: string;
}

export interface LightingConfig {
  ambient: { intensity: number; color: string };
  points: LightConfig[];
  rimLights?: LightConfig[];
}

export interface PostProcessingConfig {
  bloom: {
    intensity: number;
    luminanceThreshold: number;
    luminanceSmoothing: number;
    radius: number;
  };
  vignette: {
    offset: number;
    darkness: number;
  };
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  background: string;
  foliage: FoliageConfig;
  decorations: DecorationsConfig;
  spiralRibbon?: SpiralRibbonConfig;
  star: StarConfig;
  lighting: LightingConfig;
  postProcessing: PostProcessingConfig;
  environmentPreset?: 'night' | 'sunset' | 'dawn' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
  // 保留经典主题的额外配置
  classicElements?: {
    lights: { count: number; colors: string[] };
    gifts: { count: number; colors: string[] };
  };
}

// 导出主题
export { classicTheme } from './classic';
export { pinkFantasyTheme } from './pink-fantasy';
export { sparklingPinkTheme } from './sparkling-pink';
