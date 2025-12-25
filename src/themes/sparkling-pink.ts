import type { ThemeConfig } from './index';

export const sparklingPinkTheme: ThemeConfig = {
    id: 'sparkling-pink',
    name: '璀璨粉色',
    background: '#050005',

    foliage: {
        count: 15000,
        colors: [
            '#FF007F', // 亮洋粉
            '#FF1493', // 深粉
            '#C71585', // 中紫罗兰
            '#FF69B4', // 热粉
            '#DB7093', // 苍紫罗兰
        ],
        geometry: 'octahedron',
        material: {
            roughness: 0.3,
            metalness: 0.4,
        },
    },

    decorations: {
        count: 800,
        types: [
            {
                // 金色装饰
                geometry: 'icosahedron',
                colors: ['#FFD700', '#F0E68C', '#DAA520'],
                material: {
                    roughness: 0.1,
                    metalness: 1.0,
                    envMapIntensity: 2.0,
                },
            },
            {
                // 白色/银色装饰
                geometry: 'sphere',
                colors: ['#FFFFFF', '#FDF5E6', '#F5F5F5'],
                material: {
                    roughness: 0.1,
                    metalness: 0.8,
                    envMapIntensity: 1.5,
                },
            },
            {
                // 粉色水晶
                geometry: 'icosahedron',
                colors: ['#FF69B4', '#FFB6C1'],
                material: {
                    roughness: 0.0,
                    metalness: 0.5,
                    envMapIntensity: 2.5,
                },
            },
        ],
    },

    spiralRibbon: {
        enabled: true,
        particleCount: 2000,
        spirals: 5,
        color: '#FFFFFF', // 纯白发光带
    },

    star: {
        color: '#FFD700', // 金黄色星星，如图片所示
        emissiveIntensity: 5, // 强发光
        style: 'classic',
        sparkles: {
            count: 400,
            color: '#FFFACD',
            size: 6,
        },
    },

    lighting: {
        ambient: { intensity: 0.4, color: '#2a0015' },
        points: [
            { position: [20, 20, 20], intensity: 60, color: '#FF1493' },
            { position: [-20, 10, -20], intensity: 40, color: '#FFD700' },
            { position: [0, 5, 15], intensity: 30, color: '#FFFFFF' },
        ],
    },

    postProcessing: {
        bloom: {
            intensity: 2.0, // 增加辉光强度使之“璀璨”
            luminanceThreshold: 0.2, // 较低阈值让更多颜色参与辉光
            luminanceSmoothing: 0.1,
            radius: 0.6,
        },
        vignette: {
            offset: 0.1,
            darkness: 1.2,
        },
    },
    environmentPreset: 'night',
};
