import type { ThemeConfig } from './index';

export const pinkFantasyTheme: ThemeConfig = {
  id: 'pink-fantasy',
  name: '粉色梦幻',
  background: '#0a0005',

  foliage: {
    count: 12000,
    colors: [
      '#FF007F', // 亮洋粉
      '#C71585', // 深紫罗兰
      '#FF69B4', // 热粉
      '#800080', // 紫色
      '#FF1493', // 深粉
    ],
    geometry: 'octahedron',
    material: {
      roughness: 0.4, // 增加粗糙度减少过亮反射
      metalness: 0.3, // 降低金属感
    },
  },

  decorations: {
    count: 1200,
    types: [
      {
        // 改为浅紫色点缀，不再使用黄色
        geometry: 'icosahedron',
        colors: ['#E6E6FA', '#D8BFD8', '#DDA0DD'],
        material: {
          roughness: 0.2,
          metalness: 0.8,
          envMapIntensity: 1.0,
        },
      },
      {
        // 白色点缀
        geometry: 'sphere',
        colors: ['#FFFFFF', '#FDF5E6'],
        material: {
          roughness: 0.1,
          metalness: 0.5,
          envMapIntensity: 1.0,
        },
      },
    ],
  },

  spiralRibbon: {
    enabled: true,
    particleCount: 1500,
    spirals: 4,
    color: '#FFB6C1', // 浅粉色丝带，比纯白更和谐
  },

  star: {
    color: '#FF69B4', // 切换为热粉色星星，不再使用黄色
    emissiveIntensity: 2, // 大幅降低发光强度防止过曝
    style: 'delicate', // 换回精致形状
    sparkles: {
      count: 200,
      color: '#FFB6C1',
      size: 4,
    },
  },

  lighting: {
    ambient: { intensity: 0.3, color: '#2a001a' }, // 降低环境光
    points: [
      { position: [20, 20, 20], intensity: 40, color: '#FF007F' }, // 降低亮度
      { position: [-20, 10, -20], intensity: 30, color: '#800080' },
      { position: [0, 5, 10], intensity: 20, color: '#FFFFFF' },
    ],
    rimLights: [
      { position: [0, 10, -20], intensity: 50, color: '#FF00FF' },
      { position: [15, 0, -10], intensity: 40, color: '#FF69B4' },
    ],
  },

  postProcessing: {
    bloom: {
      intensity: 1.2, // 大幅降低辉光强度
      luminanceThreshold: 0.8, // 提高阈值，只有极亮的点才发光
      luminanceSmoothing: 0.1,
      radius: 0.4,
    },
    vignette: {
      offset: 0.2,
      darkness: 1.1,
    },
  },
  environmentPreset: 'night',
};
