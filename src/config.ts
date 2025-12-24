export type SceneState = 'CHAOS' | 'FORMED';

// --- 动态生成照片列表 (1.jpg ~ 6.jpg) ---
export const TOTAL_NUMBERED_PHOTOS = 6;
// 6.jpg 是竖幅照片，其他都是正方形
export const PORTRAIT_PHOTO_INDEX = 5; // 对应 6.jpg (0-indexed)
export const bodyPhotoPaths = Array.from(
  { length: TOTAL_NUMBERED_PHOTOS },
  (_, i) => `/photos/${i + 1}.jpg`
);

// --- 视觉配置 ---
export const CONFIG = {
  colors: {
    emerald: '#004225',
    gold: '#FFD700',
    silver: '#ECEFF1',
    red: '#D32F2F',
    green: '#2E7D32',
    white: '#FFFFFF',
    warmLight: '#FFD54F',
    lights: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
    borders: ['#FFFAF0', '#F0E68C', '#E6E6FA', '#FFB6C1', '#98FB98', '#87CEFA', '#FFDAB9'],
    giftColors: ['#D32F2F', '#FFD700', '#1976D2', '#2E7D32'],
    candyColors: ['#FF0000', '#FFFFFF'],
  },
  counts: {
    foliage: 15000,
    ornaments: 12, // 6张照片 × 2个 = 12个装饰品
    elements: 200,
    lights: 400,
  },
  tree: { height: 22, radius: 9 },
  photos: {
    body: bodyPhotoPaths,
  },
} as const;

