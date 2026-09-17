/**
 * 화면 톤 시안.
 *
 * 지금은 전체가 어둡다 — 소울라이크 쪽으로 잡았기 때문인데,
 * 그리스 로마 신화의 결은 오히려 밝고 건조한 빛에 가깝다.
 * 다섯 방향을 놓고 고른다. 스테이지 환경 위에 덮어씌우는 층이다.
 *
 *   ?look=marble  로 바로 볼 수 있고, L 키로 돌려 가며 본다.
 */
export const LOOKS = {
  /** 처음 잡았던 톤. 비교용으로 남겨 둔다. */
  souls: {
    name: '소울라이크 (옛 톤)',
    line: '어둡고 따뜻한 화염. 대비가 세고 그림자가 깊다',
    exposure: 1.05, bloom: 0.85, threshold: 0.62, vignette: 0.55,
  },

  /** ① 정오의 대리석 — 파르테논. 희고 건조하고 그림자가 파랗다. */
  marble: {
    name: '정오의 대리석',
    line: '흰 돌과 마른 빛. 그림자는 짧고 파랗다',
    bg: '#cfe0ee', fog: 0.008, fogColor: '#d8e6f2', exposure: 1.32,
    key: '#fff6e6', keyIntensity: 3.2, rim: '#9fc4e8', rimIntensity: 1.0,
    hemiSky: '#bcd8ef', hemiGround: '#c8b9a2', hemiIntensity: 1.25,
    groundTint: '#efe6d6', wallColor: '#b9ae99', rockColor: '#cfc4b0',
    bloom: 0.5, threshold: 0.8, vignette: 0.24,
  },

  /** ② 황금빛 오후 — 지중해 늦은 해. 따뜻하고 서정적. */
  golden: {
    name: '황금빛 오후',
    line: '낮게 깔린 해. 길고 따뜻한 그림자',
    bg: '#f0c98a', fog: 0.011, fogColor: '#f2cf9a', exposure: 1.22,
    key: '#ffd79a', keyIntensity: 3.0, rim: '#8fb0e0', rimIntensity: 1.2,
    hemiSky: '#e8c48f', hemiGround: '#8a6a45', hemiIntensity: 1.0,
    groundTint: '#f0d9b4', wallColor: '#a37c52', rockColor: '#c5a375',
    bloom: 0.8, threshold: 0.66, vignette: 0.3,
  },

  /** ③ 에게해 — 산토리니. 흰 벽과 청록 바다, 아주 맑다. */
  aegean: {
    name: '에게해',
    line: '흰 벽과 청록. 공기가 맑고 하늘이 높다',
    bg: '#9ed2e8', fog: 0.007, fogColor: '#b6ddec', exposure: 1.3,
    key: '#ffffff', keyIntensity: 3.1, rim: '#3fa8c8', rimIntensity: 1.6,
    hemiSky: '#8fd0e8', hemiGround: '#b0c8cf', hemiIntensity: 1.3,
    groundTint: '#e8eef0', wallColor: '#9ab4be', rockColor: '#cdd9de',
    bloom: 0.62, threshold: 0.78, vignette: 0.2,
  },

  /** ④ 도기 채색 — 흑색상 도기를 화면 전체로. 만화에 가깝게 또렷하다. */
  pottery: {
    name: '도기 채색',
    line: '테라코타 바탕에 검정과 상아. 색 수를 줄여 또렷하게',
    bg: '#c9743f', fog: 0.012, fogColor: '#cf8552', exposure: 1.18,
    key: '#ffe0b0', keyIntensity: 2.6, rim: '#6a2f1c', rimIntensity: 1.4,
    hemiSky: '#e09a62', hemiGround: '#5a2314', hemiIntensity: 1.1,
    groundTint: '#d98f57', wallColor: '#4a1c10', rockColor: '#7a3a20',
    bloom: 0.45, threshold: 0.82, vignette: 0.34,
  },

  /** ⑤ 프레스코 — 크노소스 벽화. 바랜 파스텔, 부드러운 빛, 낮은 대비. */
  fresco: {
    name: '프레스코',
    line: '바랜 회벽 그림. 부드러운 빛과 낮은 대비',
    bg: '#dcd2bd', fog: 0.013, fogColor: '#e2d9c6', exposure: 1.24,
    key: '#fff0d8', keyIntensity: 2.4, rim: '#c88f9a', rimIntensity: 1.1,
    hemiSky: '#cfd8cf', hemiGround: '#c0ab90', hemiIntensity: 1.45,
    groundTint: '#e6dcc6', wallColor: '#b3a68c', rockColor: '#cbbfa5',
    bloom: 0.4, threshold: 0.85, vignette: 0.18,
  },
}

// 기본은 정오의 대리석. 옛 톤은 목록 끝으로 보낸다.
export const LOOK_KEYS = ['marble', 'golden', 'aegean', 'pottery', 'fresco', 'souls']
