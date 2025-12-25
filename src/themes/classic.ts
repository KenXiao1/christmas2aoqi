import type { ThemeConfig } from './index';

export const classicTheme: ThemeConfig = {
  id: 'classic',
  name: '经典圣诞',
  background: '#000300',

  foliage: {
    count: 15000,
    colors: ['#004225'],
    geometry: 'points',
    material: { roughness: 0.5, metalness: 0 },
  },

  decorations: {
    count: 200,
    types: [
      {
        geometry: 'cube',
        colors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'],
        material: { roughness: 0.4, metalness: 0.3, envMapIntensity: 1 },
      },
      {
        geometry: 'sphere',
        colors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'],
        material: { roughness: 0.4, metalness: 0.3, envMapIntensity: 1 },
      },
      {
        geometry: 'cylinder',
        colors: ['#FF0000', '#FFFFFF'],
        material: { roughness: 0.4, metalness: 0.3, envMapIntensity: 1 },
      },
    ],
  },

  star: {
    color: '#FFD700',
    emissiveIntensity: 2,
    style: 'classic',
    sparkles: { count: 600, color: '#ECEFF1', size: 8 },
  },

  lighting: {
    ambient: { intensity: 0.4, color: '#003311' },
    points: [
      { position: [30, 30, 30], intensity: 100, color: '#FFD54F' },
      { position: [-30, 10, -30], intensity: 50, color: '#FFD700' },
      { position: [0, -20, 10], intensity: 30, color: '#ffffff' },
    ],
  },

  postProcessing: {
    bloom: {
      intensity: 1.5,
      luminanceThreshold: 0.8,
      luminanceSmoothing: 0.1,
      radius: 0.5,
    },
    vignette: { offset: 0.1, darkness: 1.2 },
  },

  classicElements: {
    lights: { count: 400, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'] },
    gifts: { count: 200, colors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'] },
  },
};
