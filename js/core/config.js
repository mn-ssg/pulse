/* 데이터 · 파일 경로 · 타임라인 상수 (Figma · 프로젝트 파일 기준) */

export const GAMES = [
  { id:'ln',  slug:'loop-night',      name:'LOOP NIGHT',      no:'01', track:'TRACK 01 · Too Old to Die Young',               genre:'원버튼 러너',
    code:'IDT-TOLD-S1-KOR', color:'#19d3c5', glow:0x19d3c5, bg:0x07191b },
  { id:'nc',  slug:'never-city',      name:'NEVER CITY',      no:'02', track:'TRACK 02 · Future That Never Comes',            genre:'미로 아케이드',
    code:'IDT-FTNC-S1-KOR', color:'#ff4fd8', glow:0x5e3ae0, bg:0x0f0a20 },
  { id:'lwr', slug:'live-wire-racer', name:'LIVE WIRE RACER', no:'03', track:'TRACK 03 · Right Answer to the Wrong Question', genre:'아케이드 레이싱',
    code:'IDT-RAWQ-S3-KOR', color:'#ffc21a', glow:0xe5322d, bg:0x1a0c0a },
];
export const gameUrl = g => `games/${g.slug}/index.html`;

/* ---------- 파일 ---------- */
export const IMG_DIR = 'assets/images/';
export const LOGO = { src:'assets/images/brand/pulse-logo.webp', disc:[.693, .496] };   // Figma PULSE_logo 원본 · 디스크(심장) 위치
export const VIDEO = { src:'assets/videos/pulse-film.mp4', poster:'assets/videos/pulse-film-poster.webp' };
export const IMAGES = {
  logo_idiotape:'brand/idiotape-logo.webp',
  tape_front:'tape/tape-front.webp', tape_back:'tape/tape-back.webp',
  world_future:'world/world-future.webp', world_past:'world/world-past.webp', world_city:'world/city-still.webp',
  player_front:'player/player-front.webp', player_side:'player/player-side.webp',
  console:'console/game-console.webp',
  ...Object.fromEntries(GAMES.flatMap(g => [
    [`${g.id}_front`, `games/${g.slug}/cover-front.webp`], [`${g.id}_back`, `games/${g.slug}/cover-back.webp`],
    [`${g.id}_chip`, `games/${g.slug}/chip.webp`], [`${g.id}_blur`, `games/${g.slug}/cover-blur.webp`], [`logo_${g.id}`, `games/${g.slug}/logo.webp`],
  ])),
};
/* 불러오는 순서: 첫 화면 → 바로 다음 장면 → 게임 (main.js) */
export const IMAGE_GROUPS = {
  intro:['tape_front', 'tape_back'],
  world:['world_future', 'world_past', 'world_city', 'player_front', 'player_side'],
  games:['logo_idiotape', 'console', ...GAMES.flatMap(g => [`${g.id}_front`, `${g.id}_back`, `${g.id}_chip`, `${g.id}_blur`, `logo_${g.id}`])],
};
export const FONTS = {
  intro:['900 40px Archivo'],
  games:['900 40px Inter', '700 40px Inter', '500 20px "JetBrains Mono"', '500 20px "Noto Sans KR"', '700 20px Silkscreen', '400 20px "Press Start 2P"'],
};

/* ---------- 원본 그림 비율 (픽셀 크기가 아니라 비율로만 쓴다) ---------- */
export const META = {
  tape_front:[1800,1188], tape_back:[1800,1195], chip:[652,872], console:[2021,975],
  console_screen:[0.2003958436417615,0.08512820512820513,0.8179119247897081,0.8153846153846154],
  world_future:[720,1116], world_past:[1080,1920],
};

/* ---------- 무대 ---------- */
export const STAGE_Z = -14, CAM_D = 4.6, TAPE_W = 2.0;
export const TAPE_AR = META.tape_front[1]/META.tape_front[0];
export const PW = 1, PH = 1370/1390, PD = .115;                 // 게임 패키지 (표지 비율)
export const RED = 0xe8392e;
/* Figma '13 · 캐릭터와 소품' PLAYER의 정면도 · 측면도로 만든 3D 몸체 (가로 1 기준, 정면 텍스처 좌표 u→, v↓) */
export const PLAYER3D = {
  ar:.5191, depth:.36,                                         // 몸체 높이/너비 · 깊이/너비
  slot:[.352, .43, .632, .665],                                // 카세트 창 = 테이프가 들어가는 슬롯
  reels:[[.43, .572], [.557, .572]],
  leds:[[.69, .572, .022, 0xff2a2a], [.347, .842, .024, 0xff2a2a], [.69, .857, .022, 0xff2a2a], [.207, .11, .024, 0xff3030]],
  antenna:.094, tape:.25,                                       // 안테나 위치 · 실제 크기의 테이프 폭
  top:.105,                                                     // 손잡이 아래 몸체가 시작하는 높이 (위에서부터) = 윗면 높이
};

/* ---------- 타임라인 (스크롤 위치 p: 0~1) ---------- */
export const STEPS = ['INTRO', 'WORLD', 'ANIMATION', '→ GAME', 'GAMES', 'SELECT', 'INSERT', 'BOOT', 'PLAY'];
export const STEP_C = ['#3a3a40', '#4a4a52', '#5f5f6b', '#3b5bff', '#33d1f0', '#33d1f0', '#ff4fd8', '#ff4fd8', '#f2efe9'];
export const RANGES = [[0,.10], [.10,.30], [.30,.50], [.50,.60], [.60,1]];
export const FOCUS_P = [.655, .80, .95];                        // 각 게임 표지가 가운데 오는 스크롤 위치

/* 스크롤 길이 배분 [p, 누적 vh]: 타임라인 p는 그대로 두고, 타이포그래피 · VHS 장면에 실제 스크롤을 더 준다 */
export const P_MAP = [[0, 0], [.035, 90], [.275, 900], [.50, 1330], [1, 1930]];
