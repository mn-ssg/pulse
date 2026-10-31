(() => {
  /* ================= 튜닝 데스크: 밸런스 · 연출 · 소리 값은 모두 여기서 고친다 ================= */
  // 시간 = 프레임(60 = 1초) · 속도 = 1프레임에 움직이는 칸 수 · 반지름 = 칸 단위
  // 한 화면 미로 게임이라 점프 · 중력 · 대시는 없다. 그 자리를 꺾기(선입력) · 터널 · 카세트(PLAYBACK)가 맡는다
  const BALANCE = {
    hp:3,
    // 구역(스테이지) 표. drones: 나오는 드론(A1 추격 · A2 매복 · A3 변칙 · B 지우개), leave: 기지를 떠나는 시각
    // hero · drone · eraser: 속도, playback: 카세트 효과 길이, waves: 흩어짐(PATROL) ↔ 추격(CHASE) 길이를 번갈아
    stages:[
      { drones:['A1', 'A2'], leave:[0, 240], hero:.115, drone:.088, eraser:.06, playback:420, waves:[420, 1200, 420, 1200, 300] },
      { drones:['A1', 'A2', 'B'], leave:[0, 180, 420], hero:.118, drone:.093, eraser:.062, playback:360, waves:[360, 1200, 360, 1200, 300] },
      { drones:['A1', 'A2', 'A3', 'B'], leave:[0, 150, 330, 480], hero:.12, drone:.098, eraser:.066, playback:300, waves:[300, 1260, 300, 1260, 240] },
      // 4구역(순환선)은 3구역과 같은 압박 — 새 구역은 더 어려워지는 대신 다른 상황을 준다
      { drones:['A1', 'A2', 'A3', 'B'], leave:[0, 150, 330, 480], hero:.12, drone:.098, eraser:.066, playback:300, waves:[300, 1260, 300, 1260, 240] }
    ],
    // 4구역 다음부터: 구역을 한 바퀴 더 돌며 드론이 조금씩 빨라지고 카세트가 짧아진다(상한 · 하한까지만)
    scaling:{ drone:.003, maxDrone:.108, eraser:.003, maxEraser:.08, playback:20, minPlayback:200 },
    // 판정
    hitRadius:.62,      // 드론과 이 거리 안이면 부딪힘
    closeRadius:1.15,   // 이 안까지 다가왔다가 닿지 않고 빠져나가면 CLOSE
    cornerAssist:.32,   // 갈림길 이만큼 앞에서 미리 꺾는다(모서리 미리 돌기)
    turnLook:12,        // 선입력 표시: 앞으로 몇 칸 안의 갈림길까지 찾아 화살표를 띄울지
    // 시간
    ready:72,           // 첫 시작 READY
    retryReady:42,      // 게임오버 뒤 바로 재시작할 때 READY
    respawnReady:54,    // 맞은 뒤 다시 나올 때 READY
    dead:54,            // 맞은 뒤 신호가 끊겨 있는 시간
    lost:84,            // 마지막 하트를 잃고 도시 불이 꺼지는 시간(그 뒤 결과 화면)
    invincible:120,     // 다시 나온 뒤 보호 시간
    playbackSpeed:1.08, // PLAYBACK 동안 주인공 속도 배율
    disabledDrone:.55,  // PLAYBACK 동안 멈춘 드론이 떠도는 속도 배율
    playbackWarn:120,   // PLAYBACK이 이만큼 남으면 노란 종료 예고
    playbackGrace:30,   // PLAYBACK이 끝나는 순간 드론과 겹쳐 있어도 이만큼은 보호
    waveWarn:60,        // 추격이 시작되기 이만큼 전부터 드론 눈이 깜빡여 예고
    exitWarn:50,        // 드론이 기지를 떠나기 이만큼 전부터 기지 출구가 빨갛게 깜빡임
    droneExit:50, droneReturn:.3, returnWait:90,
    clear:210, live:300, liveAt:150, clearSkip:80, // 구역 복원 연출 · 순환선 개통 공연(IDIOTAPE) 길이 · 공연이 시작하는 시각 · 키로 넘기기까지
    overLock:30,        // 결과 화면에서 키 입력을 받기 시작하는 시각(실수로 넘기기 방지)
    overIdle:1500,      // 결과 화면에서 입력이 없으면 타이틀로
    titleIdle:900, infoPage:360, // 타이틀 방치 시 설명 · 기록 페이지
    // 점수 (train: 열차에 쓸려 간 드론 하나 · bside: 숨겨진 B-SIDE 테이프)
    points:{ tile:10, block:100, cas:50, catch:[200, 400, 800, 1600], close:50, clear:1000, perfect:3000, train:300, bside:500 }
  };

  // 구역 기믹의 길이 · 속도. 어디에 무엇을 언제 두는지는 js/districts.js
  // 새 기믹은 하나를 넣을 때마다 쉬워지는 쪽(드론을 쓸어 가는 열차, 드론도 막는 셔터, 지름길 골목, 드론이 헤매는 정전)을 함께 둔다
  const GIMMICK = {
    train:{ speed:.42, cars:2, car:4, gap:.17, warn:150, bell:24 },  // 8번 줄 열차: 속도(칸/프레임) · 칸 수 · 한 칸 길이(칸, 그림 train.png가 48px = 4칸) · 칸 사이 · 건널목 예고 · 종소리 간격
    shutter:{ open:330, shut:210, warn:48, roll:8 },             // 셔터: 열림 · 닫힘 · 닫히기 전 노란 예고 · 내려오는 시간
    closing:{ stagger:7, len:540 },                              // 셔터 일제 폐쇄(2구역): 하나씩 내려오는 간격 · 닫혀 있는 시간
    alley:{ wait:24, roll:20 },                                  // 골목: 블록이 켜진 뒤 문이 올라가기 시작하는 시각 · 올라가는 시간
    light:{ speed:.045, radius:1.35, spot:18, alarm:300, cool:240, hold:70 }, // 탐조등: 속도 · 빛 반지름(칸) · 들키기까지 · 경보 · 다음 경보까지 · 빛이 붙잡는 시간
    dark:{ warn:100, len:540, back:60, drone:.7, radius:46 },    // 정전: 깜빡임 · 어둠 · 복구 물결 · 드론 속도 배율 · 주인공 빛 반지름(px)
    ff:{ len:360, speed:1.6 },                                   // ▶▶ 빨리 감기: 길이 · 주인공 속도 배율
    rew:{ len:60, keep:360, step:3 },                            // ◀◀ 되감기: 연출 길이 · 되감는 길(최근 프레임) · 기록 간격
    ghost:{ rec:1200, step:2 },                                  // 과거의 나(4구역): 구역 처음부터 기록하는 길이 · 기록 간격
    lastN:10,                                                    // 남은 칸이 이 수 이하면 남은 칸이 박자에 맞춰 깜빡인다(마지막 불빛)
    pa:150                                                       // 안내방송 판이 떠 있는 시간
  };

  // 화면 연출: 세기 · 길이 · 개수 상한. 효과는 플레이어 행동에 대한 대답일 때만 — 장식으로 화면에 깔지 않는다
  // 미로는 확대 · 회전하지 않는다(픽셀이 고르지 않게 번진다). 흔들림도 논리 px 정수 단위로만
  const FEEL = {
    freezeHit:10, freezeCatch:4, freezeCassette:6, freezeClear:10,       // Hit Stop(세계만 멈추고 효과는 흐른다)
    shakeHit:10, shakeCatch:3, shakeMax:2,                                  // 흔들림 길이(프레임) · 최대 이동(논리 px)
    flash:1,                                                              // 화면 번쩍임 세기 배율
    particles:120, rings:12, pops:8, trail:8,                             // 개수 상한
    reduced:typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  };
  // 화면 흐름의 시간(프레임). 타이틀은 실제 미로 도시 그대로 — 시작하면 같은 도시가 게임판이 된다
  const UI = {
    titleIn:40,       // 타이틀: 어둠 속에서 도시가 떠오르는 시간
    logoAt:24, logoOn:30, // LED 로고가 켜지기 시작하는 시각 · 왼쪽부터 다 켜지는 데 걸리는 시간
    promptAt:84,      // PRESS ANY KEY가 나타나는 시각
    flicker:600,      // 로고 글자 하나가 잠깐 깜빡이는 간격(낡은 간판)
    demo:.15,         // 타이틀 데모: 길을 밝히며 다니는 주인공 속도
    demoHold:150,     // 데모가 도시를 다 밝힌 뒤 머무는 시간 → 불이 꺼지고 처음부터
    enter:30,         // 시작: 로고가 꺼지고 어둠이 걷히며 HUD가 들어오는 시간
    fadeIn:18,        // 재시작 · 다음 구역: 어둠에서 미로가 떠오르는 시간
    fadeOut:16,       // 구역이 끝날 때 어두워지는 시간
    hudIn:20          // HUD가 내려오는 시간
  };
  const motion = () => FEEL.reduced ? .25 : 1; // 흔들림 · 번쩍임에 곱한다(움직임 줄이기 설정을 따른다)

  // 소리: 최종 음량 = master × (music · sfx · amb). M 키로 음소거(저장된다). amb = 도시 환경음(바람 · 기계음 · 전기 잡음 · 멀리 차)
  const MIX = { master:.9, music:.55, sfx:.8, amb:.5 }; // 곡 파일 볼륨은 config.js의 BGM.volume

  // 음악 연출(js/music.js): 「Future That Never Comes」를 배경음이 아니라 연출로 쓴다. 곡에 하는 일은 음량 · 먹먹함(필터, Hz) · 테이프 속도 · 되감기뿐
  const SCORE = {
    enterLp:[320, 1100],   // 타이틀 → 게임: 도시 밖에서 듣는 것처럼 먹먹하게 시작(Hz)해서 조금 열린다
    readyLp:[1100, 2600],  // 첫 READY 동안 다가오고, GO에 활짝 열린다
    deadLp:600,            // 맞은 뒤 신호가 끊긴 동안
    clearLp:1300,          // 구역 복원 뒤 곡이 멀어진다(다음 구역 GO에 다시 들어온다)
    closingLp:2200,        // 2구역 폐점: 셔터가 닫혀 있는 동안 거리가 먹먹해진다
    darkLp:220, darkLevel:.4, // 정전: 저음만 남는다
    amb:{ title:1, run:.22, quiet:.6, dark:1 }, // 환경음 크기: 타이틀 · 플레이 · 곡이 멀어졌을 때 · 정전
    ff:1.06,               // ▶▶ 동안 곡도 조금 빨라진다(테이프처럼 음도 조금 올라간다)
    rewind:{ tape:1, ghost:20, scrub:.8 }, // ◀◀은 1초, 과거의 나는 20초 전으로 곡을 되감는다 · 역재생으로 들리는 길이(초)
    concertAt:157,         // 순환선 개통 공연(IDIOTAPE)이 열리면 곡이 이 자리(초, 곡에서 가장 큰 구간)로 감긴다
    // 루프(스테이지)마다 곡의 상태. lp 기본 필터 · rate 테이프 속도 · drop 아주 짧은 끊김 · wobble 음정 흔들림 · rev 짧은 역재생 (뒤 셋은 평균 간격, 초)
    // 1 · 2는 그대로, 3부터 아주 가끔 이상해지고, 5(4구역을 돌고 돌아온 도시)부터는 같은 곡이 낮고 느리게 들린다
    loops:[
      { lp:20000, rate:1 },
      { lp:20000, rate:1 },
      { lp:20000, rate:1, drop:24 },
      { lp:15000, rate:1, drop:22, wobble:30 },
      { lp:7500, rate:.955, drop:18, wobble:22, rev:36 },
      { lp:5200, rate:.93, drop:13, wobble:16, rev:26 }
    ],
    // 중요한 효과음이 날 때 곡을 잠깐 낮춘다(ducking): [곡 음량 배율, 유지 초]
    duck:{ hit:[.3, .7], lost:[.2, 1.2], cas:[.45, .4], ff:[.5, .3], rew:[.35, .5], catch:[.6, .25], alarm:[.4, .9], bell:[.8, .12], chime:[.45, 1.6],
           warn:[.75, .1], sweep:[.5, .35], clear:[.55, .7], bside:[.5, .7], lastcall:[.65, .5], chase:[.6, .35], train:[.7, .8], block:[.85, .15], go:[.8, .2] }
  };
  /* ================= BGM 설정: 「Future That Never Comes」 ================= */
  // 곡 파일을 audio/future-that-never-comes.mp3로 넣으면 다음 판부터 이 곡이 음악을 맡는다. 없으면 게임이 직접 연주하는 신스 음악
  // bpm   : 곡의 템포. 켜진 칸의 반짝임 · 블록 점등 · IDIOTAPE 공연이 이 박자를 따른다
  // beat0 : 곡에서 첫 박이 울리는 시각(초). 화면 박자가 소리보다 빠르면 키우고, 늦으면 줄인다
  // volume: 곡 볼륨(0~1). 효과음은 따로. 지금 곡은 꽉 찬 마스터(-11 LUFS)라 .3 — 효과음 · 경고음이 곡 위에 들린다
  // 들어온 곡(2026-10-21): 130 BPM, 첫 박 0.42초(onset 분석). 원본(DASH 형식 m4a)은 audio/source/, 게임용은 같은 소리를 진짜 MP3로 옮긴 것(-2dB, 피크 -0.5dBFS)
  const BGM = { src:'audio/future-that-never-comes.mp3', bpm:130, beat0:.42, volume:.3 };

  /* ================= 기본: 논리 해상도 480×270 (1920×1080에서 정확히 4배) ================= */
  // 높이 270 고정. 창이 16:9보다 넓으면 가로 시야 W만 넓힌다(~21:9). 미로는 늘 가운데
  // 미로 한 칸 = T px. 위쪽 MY px은 HUD 한 줄. MX는 fit()이 미로를 가운데 놓도록 정한다
  const BASE_W = 1920, BASE_H = 1080, H = 270, MIN_AR = 16 / 9, MAX_AR = 21 / 9;
  let W = BASE_W * H / BASE_H, SX = BASE_H / H, SY = BASE_H / H;
  const STEP = 1000 / 60;
  const T = 12, MY = 34;
  let MX = 24;
  const cv = document.getElementById('game');
  let ctx = cv.getContext('2d');
  // 선명도: 캔버스는 화면에 보이는 크기 × 기기 배율(devicePixelRatio)의 실제 픽셀로 만들고, 논리 1px = 기기 정수 px로 맞춘다
  // 6.1배처럼 정수가 아닌 배율이면 픽셀 폭이 6 · 7px로 들쭉날쭉하고 경계가 번진다 → 한 단계 작은 정수 배율을 쓰고 남는 몇 px은 밤색 여백
  // 정수로 맞추면 너무 작아지는 창(INT_MIN보다 작아짐)에서만 예전처럼 비율대로 늘린다
  const INT_MIN = .8;
  function fit() {
    const dpr = devicePixelRatio || 1, vw = innerWidth * dpr, vh = innerHeight * dpr;
    const exact = Math.min(vh / H, vw / (H * MIN_AR)), s = Math.floor(exact);
    if (s >= 1 && s / exact >= INT_MIN) {
      W = Math.min(Math.round(H * MAX_AR), Math.floor(vw / s));
      cv.width = W * s; cv.height = H * s; SX = SY = s;
    } else {
      const a = Math.min(MAX_AR, Math.max(MIN_AR, vw / vh));
      W = Math.round(H * a);
      const ch = Math.min(vh, vw / a), k = Math.min(1, 2160 / ch);
      cv.width = Math.round(ch * a * k); cv.height = Math.round(ch * k); SX = cv.width / W; SY = cv.height / H;
    }
    cv.style.width = cv.width / dpr + 'px'; cv.style.height = cv.height / dpr + 'px';
    MX = Math.round((W - 36 * T) / 2);
  }
  fit();
  addEventListener('resize', fit);

  /* ================= 색: 회색의 현재, 색의 과거 ================= */
  // 표지 규칙 그대로 — 무너진 도시와 UI는 무채색, 색은 플레이어가 되살린 것과 '뜻이 있는 상태'에만 쓴다
  // 한 색에 뜻은 하나: 청록 = 나 · 진행 / 보라 = 되살린 길 / 분홍 = 카세트 · PLAYBACK / 빨강 = 위험 · 피해 / 노랑 = 곧 끝남 · 아슬아슬
  const C = {
    // 무채색(화면의 대부분)
    ink:'#09090c', night:'#09090c', panel:'#0f0f13', line:'#26262e',
    road:'#18181d', roadHi:'#222229', roadLo:'#101014', node:'#3a3a45', // 꺼진 길 · 아직 안 지난 칸의 점
    dim:'#5d5d69', mist:'#a09fab', paper:'#ece8de', white:'#ffffff',
    city:'#a0a3b1',                                                     // 무너진 블록에 곱해 밤으로 낮춘다
    // 뜻이 있는 색
    cyan:'#5ff3ff', sky:'#2fb8ff',                                      // 나 · 진행
    violet:'#401db0', vlit:'#5e3ae0', deep:'#220f60', lav:'#c4b6ff',     // 되살린 길
    pink:'#ff4fd8', rose:'#ff9ae9',                                      // 카세트 · PLAYBACK
    red:'#ff3b5c', yellow:'#ffd23f'                                      // 위험 · 곧 끝남
  };
  const F_PIX = 'Silkscreen, monospace', F_NUM = '"Press Start 2P", monospace';
  /* ================= 그림: Higgsfield(GPT Image 2.5)에서 뽑아 게임 격자에 맞춘 픽셀아트 ================= */
  // 만든 방법 · 프롬프트 · 참고 이미지는 docs/higgsfield-assets.md. 이전 그림은 images/legacy/에 비교용으로만 남아 있다
  // 게임 안의 그림은 모두 픽셀아트다. 픽셀아트는 논리 px 정수배로만 그리고(imageSmoothing 끔), 고해상도 그림(생성 로고)만 부드럽게 줄여 그린다
  const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });
  const IMG = {};
  const FILES = { lit:'images/city-lit.png', gray:'images/city-gray.png', obj:'images/obj.png',
                  words:'images/words.png', band:'images/band.png' };
  // 로고: Higgsfield에서 뽑은 투명 배경 고해상도 로고. 파일이 없으면 코드로 짠 LED 간판 로고(js/render/logo.js)
  // 만드는 법(해상도 · 투명 배경 · Higgsfield 프롬프트)은 docs/higgsfield-assets.md
  const GEN = { logo:'images/generated/never-city-logo.png' };
  // 구역 콘텐츠 그림(Higgsfield GPT Image 2.5로 뽑아 게임 격자 · 픽셀 크기에 맞춘 것, docs/higgsfield-assets.md C01~C09)
  // 없으면 코드가 같은 자리에 픽셀 그림을 그린다(js/render/district.js)
  const CONTENT = { train:'images/generated/train.png', searchdrone:'images/generated/searchdrone.png', bside:'images/generated/bside.png',
                    repeat:'images/generated/repeat.png', alley:'images/generated/alley.png',
                    lit2:'images/generated/city-lit-2.png', gray2:'images/generated/city-gray-2.png', lit3:'images/generated/city-lit-3.png', gray3:'images/generated/city-gray-3.png' };
  const assetsReady = Promise.all([...Object.entries(FILES), ...Object.entries(GEN), ...Object.entries(CONTENT)].map(([k, f]) => load(f).then(i => { IMG[k] = i; })))
    .then(() => prepareArt());
  // city-lit.png: 미로 배치 가이드(docs/assets/layout-guide)를 참고 이미지로 넣어 뽑은 위에서 본 밤의 도시. 블록 19개를 찾아 칸에 맞춰 다시 조립했다
  //               한 칸 = 그림 CITY_K px (화면에선 반으로 줄여 T px). 길 자리는 비어 있고 길은 코드가 그린다
  // city-gray.png: 같은 그림을 Higgsfield 편집으로 불을 끄고 낡게 만든 폐허 상태(구도 · 건물이 그대로라 제자리에서 바뀐다)
  const CITY_K = 24;
  // 라이더는 그림 파일이 아니라 js/render/rider.js의 픽셀 지도에서 만든다(사람 · 차체 · 바퀴를 따로 움직이려고)
  // obj.png: 순찰 드론(a, 흰 렌즈 — 위험할 때 코드가 빨간 눈을 그린다) · 지우개 드론(b, 분홍 소거 빔) 4프레임씩, 카세트 · 브라운관 · 하트
  const OB = { a0:[0,0,26,13], a1:[27,0,26,13], a2:[54,0,26,13], a3:[81,0,26,13],
               b0:[108,0,22,24], b1:[131,0,22,24], b2:[154,0,22,24], b3:[177,0,22,24],
               cas:[200,0,15,10], tv:[216,0,16,17], heart:[233,0,9,8], heart0:[243,0,9,8] };
  // words.png: NEVER CITY 로고와 같은 꼴로 뽑은 그림 글자 (위 청록 · 아래 분홍, 남보라 외곽선). 높이 21px 픽셀아트 → 정수배로만 키운다
  const WD = { ready:[0,0,105,21], clear:[107,0,190,21], over:[299,0,164,21], perfect:[465,0,128,21], how:[595,0,198,21], playback:[795,0,153,21] };
  // 구역 그림의 자리: train.png = [앞 칸, 뒤 칸] 48×12(길 높이 그대로, 오른쪽을 본다) · searchdrone.png 26×9(렌즈 = 가운데 아래 4×3)
  // bside.png = [아직 안 들은 회색, 찾은 분홍] 15×10 · alley.png = [바닥등 있는 통로 한 칸 12×12, 철문 12×6]
  const TRAIN_CAR = [[0, 0, 48, 12], [50, 0, 48, 12]], SDRONE = [0, 0, 26, 9], BSIDE = [[0, 0, 15, 10], [17, 0, 15, 10]], ALLEY = { floor:[0, 0, 12, 12], door:[14, 0, 12, 6] };
  // band.png: LOOP NIGHT의 IDIOTAPE 연주자 홀로그램을 그대로 가져와 이 게임 색으로 물들인다. 줄마다 [기본, 타격A, 타격B]
  const BAND = { synth:{ n:3, w:87, h:120, y:0 }, drum:{ n:3, w:105, h:112, y:120 } };

  const ok = i => i && i.width;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function pix(img, m, x, y, dw, dh) { if (ok(img)) ctx.drawImage(img, m[0], m[1], m[2], m[3], Math.round(x), Math.round(y), dw || m[2], dh || m[3]); }
  const ob = (n, x, y) => pix(IMG.obj, OB[n], x, y);
  // 그림 글자: s배(정수) · 가운데 정렬
  const word = (n, cx, y, s = 1) => pix(IMG.words, WD[n], Math.round(cx - WD[n][2] * s / 2), Math.round(y), WD[n][2] * s, WD[n][3] * s);
  // 그림 한 부분의 사본을 만든다. how: 'tint' 한 색 실루엣 · 'hue' 밝기는 두고 색만 · 'gray' 회색(멈춘 드론)
  // 모두 합성 모드로만 만든다(픽셀을 읽지 않아 index.html을 직접 열어도 된다)
  const PART = new Map();
  function part(img, m, how, col = '') {
    const key = how + m.join() + col + img.src; if (PART.has(key)) return PART.get(key);
    const c = canvas(m[2], m[3]), g = c.getContext('2d');
    g.drawImage(img, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]);
    if (how === 'tint') { g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, m[2], m[3]); }
    else {
      g.globalCompositeOperation = how === 'gray' ? 'saturation' : 'color'; g.fillStyle = how === 'gray' ? '#808080' : col; g.fillRect(0, 0, m[2], m[3]);
      if (how === 'gray') { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#a3a3ab'; g.fillRect(0, 0, m[2], m[3]); }
      g.globalCompositeOperation = 'destination-in'; g.drawImage(img, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]);
    }
    PART.set(key, c); return c;
  }
  const tintPart = (img, m, col) => part(img, m, 'tint', col);
  const huePart = (img, m, col) => part(img, m, 'hue', col);
  const grayPart = (img, m) => part(img, m, 'gray');

  /* ================= 불러온 뒤 한 번만 만드는 그림 ================= */
  // ART.city: 무너진 도시(회색 지도)를 밤으로 낮춘 것. 색을 섞지 않고 명도만 내린다 — 되살린 블록의 색이 더 또렷해진다
  const ART = {};
  // ART.logoOff : 생성 로고를 어둡게 한 '꺼진 간판' · ART.logoGlow : 로고 빛 번짐(한 번만 흐리게 그려 둔다)
  function prepareLogo() {
    const L = IMG.logo; if (!ok(L)) return;
    const off = canvas(L.width, L.height), g = off.getContext('2d');
    g.drawImage(L, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#2c2546'; g.fillRect(0, 0, L.width, L.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(L, 0, 0);
    ART.logoOff = off;
    const k = .25, pad = 40, glow = canvas(Math.round(L.width * k) + pad * 2, Math.round(L.height * k) + pad * 2), q = glow.getContext('2d');
    if ('filter' in q) { q.filter = 'blur(10px)'; q.drawImage(L, pad, pad, L.width * k, L.height * k); ART.logoGlow = { c:glow, k, pad }; }
  }
  function prepareArt() {
    prepareLogo();
    ART.city = cityArt(C.city);
  }
  // 구역마다 밤 톤이 조금씩 다르다(js/districts.js의 tone — 3구역 통제구역은 더 어둡다). 그림 · 톤마다 한 번만 만들어 둔다
  const CITY_TONE = new Map();
  function cityArt(tone, img = IMG.gray) {
    const key = tone + (img && img.src);
    if (CITY_TONE.has(key)) return CITY_TONE.get(key);
    if (!ok(img)) return null;
    const c = canvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = tone; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    CITY_TONE.set(key, c); return c;
  }
  /* ================= 미로: 피그마 게임 장면처럼 도시 블록 사이를 지나는 길 (36×17칸) ================= */
  // . 길 · # 블록. city_lit.png · city_gray.png가 이 배치 그대로 그려져 있어서 칸을 바꾸면 지도도 다시 뽑아야 한다
  // 가운데 큰 블록은 표지의 원형 구조물(RING) = 드론 기지. 8번째 줄의 양 끝은 터널로 이어진다
  const MAP = [
    '....................................',
    '.####.####.####.####.####.####.####.',
    '.####.####.####.####.####.####.####.',
    '.####.####.####.####.####.####.####.',
    '....................................',
    '.#########.##############.#########.',
    '.#########.##############.#########.',
    '.#########.##############.#########.',
    '...........##############...........',
    '.####.####.##############.####.####.',
    '.####.####.##############.####.####.',
    '.####.####.##############.####.####.',
    '....................................',
    '.####.#########.####.#########.####.',
    '.####.#########.####.#########.####.',
    '.####.#########.####.#########.####.',
    '....................................'
  ];
  const MW = MAP[0].length, MH = MAP.length, WARP_Y = 8;
  const ROAD = MAP.map(r => [...r].map(c => c === '.'));
  // 구역마다 길이 조금씩 바뀐다(js/districts.js). 배치(MAP)는 그대로 두고 그 위에 층을 얹는다
  // BLOCK: 닫힌 셔터 · 통제선(길이지만 지금은 못 지나간다) / OPEN: 블록을 켜서 열린 골목(블록 안의 지름길)
  // WARP: 미로 밖 한 칸까지 길로 치는 줄(rows, 좌우) · 칸(cols, 위아래). 넘어가면 반대편으로
  const BLOCK = new Uint8Array(MW * MH), OPEN = new Uint8Array(MW * MH);
  const WARP = { rows:new Set([WARP_Y]), cols:new Set() };
  const isRoad = (x, y) => {
    if (x < 0 || x >= MW) return (x === -1 || x === MW) && WARP.rows.has(y);
    if (y < 0 || y >= MH) return (y === -1 || y === MH) && WARP.cols.has(x);
    const i = y * MW + x; return (ROAD[y][x] || OPEN[i] === 1) && !BLOCK[i];
  };
  // 그림용 길 모양: 셔터가 닫혀도 길 가장자리 음영은 그대로(열린 골목은 길로 이어 그린다)
  const roadShape = (x, y) => x < 0 || x >= MW || y < 0 || y >= MH ? isRoad(x, y) : ROAD[y][x] || OPEN[y * MW + x] === 1;
  const DV = { up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0] };
  const OPP = { up:'down', down:'up', left:'right', right:'left' };
  const DORDER = ['up', 'left', 'down', 'right']; // 같은 거리일 때 고르는 순서(Pac-Man과 같다)

  // 길 칸 번호: TILES[i] = [x, y], TID[y][x] = i
  const TILES = [], TID = MAP.map(r => new Array(r.length).fill(-1));
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (ROAD[y][x]) { TID[y][x] = TILES.length; TILES.push([x, y]); }
  const tid = (x, y) => x >= 0 && x < MW && y >= 0 && y < MH ? TID[y][x] : -1;

  // 블록: 붙어 있는 # 덩어리. edge = 블록을 둘러싼 길 칸(대각선 모서리 포함). 둘레가 모두 켜지면 블록에 불이 켜진다
  const BLOCKS = [];
  {
    const seen = MAP.map(r => new Array(r.length).fill(false));
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (ROAD[y][x] || seen[y][x]) continue;
      let w = 0, h = 0;
      while (x + w < MW && !ROAD[y][x + w]) w++;
      while (y + h < MH && !ROAD[y + h][x]) h++;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen[y + j][x + i] = true;
      const edge = [];
      for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) { const k = tid(i, j); if (k >= 0) edge.push(k); }
      BLOCKS.push({ x, y, w, h, edge, ring:w > 10, cells:Math.round(w * h / 12) });
    }
  }
  // 칸마다 그 칸을 둘레로 가진 블록들
  const TBLOCKS = TILES.map(() => []);
  BLOCKS.forEach((b, i) => b.edge.forEach(k => TBLOCKS[k].push(i)));
  const RING = BLOCKS.find(b => b.ring);
  // 위치는 칸 중심 좌표(정수 = 칸 한가운데). 기지 = 원형 구조물 한가운데, 드론은 위쪽 길(4번째 줄)로 떠오른다
  const START = { x:17, y:16 }, BASE = { x:RING.x + RING.w / 2 - .5, y:RING.y + RING.h / 2 - .5 }, GATE = { x:BASE.x, y:RING.y - 1 };
  const CASSETTES = [[0, 0], [MW - 1, 0], [0, MH - 1], [MW - 1, MH - 1]];
  const CORNERS = { tr:{ x:MW + 2, y:-3 }, tl:{ x:-3, y:-3 }, bl:{ x:-3, y:MH + 2 }, br:{ x:MW + 2, y:MH + 2 } };
  // 칸 중심 좌표 → 화면 좌표
  const px = x => MX + x * T + T / 2, py = y => MY + y * T + T / 2;
  /* ================= 화면 글자 ================= */
  // 규칙: 상황을 설명하는 분위기 문장은 쓰지 않는다. 조작 · 규칙 · 결과처럼 플레이에 바로 쓰이는 말만, 짧은 평서문으로
  // 화면으로 보여 줄 수 있는 것(드론이 멈춤 · 추격 시작 · 진행률)은 글로 다시 말하지 않는다
  const K = {
    t1:'길 밝히기', d1:'지나간 길에 불이 켜진다. 모든 길을 밝히면 클리어',
    t2:'블록 채우기', d2:'블록 둘레를 모두 밝히면 건물에도 불이 들어온다',
    t3:'드론', d3:'빨간 눈 드론에 닿으면 하트와 근처 길의 불을 잃는다',
    t4:'카세트', d4:'표시마다 효과가 다르다: 드론 멈춤 · 빨리 감기 · 되감기',
    t5:'미리 꺾기', d5:'갈림길 전에 누르면 화살표가 뜬 곳에서 꺾는다',
    keys:'이동  방향키 · WASD      일시정지  P      소리  M',
    goal:'모든 길을 밝히면 클리어',
    eraser:'지우개 드론은 길을 끈다',
    pause:'아무 키나 누르면 계속',
    playback:'멈춘 드론에 부딪히면 잡는다',
    // 테이프 종류(2구역부터): 주웠을 때 한 줄
    ff:'잠깐 빨라진다', rew:'드론이 기지로 되감긴다',
    // 구역 READY 한 줄(그 구역에서 처음 바뀌는 규칙)
    light:'탐조등에 들키면 드론이 쫓아온다', wrap:'가장자리는 반대편으로 이어진다',
    // 도시 안내방송: 곧 일어날 일만, 구역에서 처음 한 번
    paTrain:'열차가 들어옵니다', paShutter:'셔터가 내려갑니다', paClosing:'상가 셔터가 모두 내려갑니다', paDark:'전력 공급이 끊깁니다'
  };
  const DRONE_NAMES = { A1:'추격 드론', A2:'매복 드론', A3:'변칙 드론', B:'지우개 드론', train:'열차' };
  // 결과 화면의 한 줄: 무엇에 끝났는지에 따라 다음 판에 바로 써먹을 요령
  const TIPS = {
    A1:'추격 드론은 뒤를 바짝 쫓는다. 모퉁이에서 따돌리자',
    A2:'매복 드론은 내 앞길을 노린다. 마주 오면 옆길로',
    A3:'변칙 드론은 가까워지면 물러난다. 그 틈에 지나가자',
    B:'지우개 드론은 밝힌 길을 끈다. 카세트로 먼저 잡자',
    train:'건널목이 깜빡이면 비키자. 열차는 드론도 쓸어 간다',
    fade:'드론이 노랗게 깜빡이면 멈춤이 풀리기 직전이다'
  };
  const cause = h => h.kind === 'train' ? '열차에 치였다' : (h.fade ? '멈춤이 풀린 직후 ' : '') + DRONE_NAMES[h.kind] + '에 잡혔다';

  /* ================= 구역(스테이지) 표 ================= */
  // 값은 tuning.js의 BALANCE.stages. 흩어짐(PATROL)과 추격(CHASE)이 번갈아 온다 — Pac-Man처럼 흩어지는 동안이 숨 돌릴 틈
  const STAGES = BALANCE.stages;
  const stageCfg = n => {
    const s = STAGES[Math.min(n, STAGES.length) - 1], extra = Math.max(0, n - STAGES.length), d = BALANCE.scaling;
    return { ...s, drone:Math.min(d.maxDrone, s.drone + extra * d.drone), eraser:Math.min(d.maxEraser, s.eraser + extra * d.eraser),
             playback:Math.max(d.minPlayback, s.playback - extra * d.playback) };
  };
  // 점수: 칸 · 블록(크기만큼) · 카세트 · 멈춘 드론을 연달아 되감기 · 아슬아슬하게 비키기(CLOSE) · 구역 복원 · 한 번도 안 맞고 복원(PERFECT)
  const PT = BALANCE.points;
  const HP = BALANCE.hp, READY_T = BALANCE.ready, DEAD_T = BALANCE.dead, INV_T = BALANCE.invincible,
    CLOSE_R = BALANCE.closeRadius, HIT_R = BALANCE.hitRadius, CORNER = BALANCE.cornerAssist;
  const CLEAR_T = BALANCE.clear, LIVE_T = BALANCE.live, LIVE_AT = BALANCE.liveAt, IDLE_T = BALANCE.titleIdle, INFO_T = BALANCE.infoPage;
  /* ================= 구역(District): 구역마다 다른 도시, 구역 안에서도 계속 바뀌는 상황 ================= */
  // 구역이 바뀔 때 드론 속도만 오르지 않게, 구역마다 대표 장면 하나 · 새 기믹 하나를 두고 앞 구역의 기믹을 다른 방식으로 다시 쓴다
  // 기믹은 소개(안전한 곳에서 한 번) → 응용(다른 자리 · 다른 조합) → 조합(다음 구역에서 다른 기믹과 함께) 순서로 자란다
  // 시간 · 속도 숫자는 tuning.js의 GIMMICK. 여기엔 '어디에 · 무엇을 · 언제'와 그 이유만 둔다. 좌표는 미로 칸(x 0~35, y 0~16)
  //
  // 항목: name 구역 이름 · goal READY 한 줄 · tone 무너진 도시에 곱하는 밤 톤 · ad 전광판(ad 그대로 · flicker 가끔 D-0이 비친다 · loop D-0에서 되감김) · tapes 네 모서리 테이프(▶ play / ▶▶ ff / ◀◀ rew)
  //       train 8번 줄 열차(every 다음 열차까지) · shutters 주기 셔터 [x, y, 처음 닫히는 시각] · closing 한꺼번에 닫히는 셔터 줄
  //       alleys 블록을 켜면 열리는 골목 [x, 위 칸, 아래 칸] · lights 탐조등 · closed 통제선(처음엔 닫힘) · bside 숨긴 B-SIDE 자리
  //       warps 가장자리 이어짐 · repeat 꺼진 블록이 모두 같은 건물로 보임 · beats 진행률(p) 또는 시간(t, 프레임)에 맞춘 사건
  //       lapTone 돌아온 도시(5구역부터)의 밤 톤(없으면 보랏빛 회색) · art 그 구역의 도시 그림 [켜진 판, 폐허 판](js/assets.js의 CONTENT, 없으면 기본 도시)
  //       trace IDIOTAPE의 흔적(js/events.js의 '도시에 남은 공연의 흔적') · venue 순환선 개통 공연이 열릴 곳
  const DISTRICTS = [
    {
      // 1 중앙로 — 아직 정상인 밤. 새 기믹: 열차 · 골목
      // 흐름: 탐색(출발 칸 위 작은 블록이 첫 점등) → 5초: 첫 열차(주인공은 맨 아래 줄이라 안전하게 구경한다. 드론이 8번 줄에 있으면 쓸려 가는 걸 본다)
      //       → 큰 블록을 켜면 골목이 열린다(새 공간 · 지름길, 왼쪽 골목 안에 B-SIDE) → 50%: 열차 두 대가 양쪽에서 동시에(응용) → 마지막 불빛
      name:'중앙로', goal:K.goal, tone:'#a0a3b1', ad:'ad',
      tapes:['play', 'play', 'play', 'play'],
      train:{ every:1320 },
      // 8번 줄을 사이에 둔 좌우 큰 블록: 둘레에 8번 줄(선로)이 들어 있어서, 골목을 열려면 열차를 한 번은 상대해야 한다
      // 열린 골목은 x5 · x30을 위아래로 잇는 지름길이 되어 후반에 남은 칸을 찾으러 가는 길을 줄인다
      alleys:[[5, 5, 7], [30, 5, 7]],
      bside:[5, 6], trace:{ flyer:[5, 5] },
      beats:[{ t:300, do:'train' }, { p:.5, do:'twin' }]
    },
    {
      // 2 셔터 상가 — 문이 저절로 닫히는 거리(이상 현상이 늘어난다). 새 기믹: 셔터 · ▶▶ 빨리 감기
      // 흐름: 위쪽 가운데 셔터 둘이 번갈아 닫힌다(소개, 드론도 막힌다) → 15초: 열차(1구역 기믹, 이번엔 선로에서 빠져나갈 아래 길에 셔터가 있다 = 조합)
      //       → 35%: 폐점 — 12번 줄 상가 셔터 7개가 왼쪽부터 도미노처럼 닫혀 9초 동안 줄이 토막 난다(대표 장면, 길을 새로 읽어야 한다)
      //       → 아래 큰 블록을 켜면 골목(B-SIDE는 오른쪽 골목) → 마지막 불빛
      // 테이프: 위 모서리는 ▶(드론이 위쪽 길로 몰리는 PATROL 구석), 아래 모서리는 ▶▶(긴 맨 아래 줄 · 셔터가 다시 열리기 전에 돌아가기)
      name:'셔터 상가', goal:K.eraser, tone:'#a6a29c', ad:'flicker', art:['lit2', 'gray2'],
      tapes:['play', 'play', 'ff', 'ff'],
      train:{ every:1560 },
      // 위쪽 가운데 연결로 x15 · x20(4초에 처음 닫힌다 = 소개)과 선로(8번 줄)에서 아래로 빠지는 x5 · x30. 둘씩 엇갈려 닫혀서 한쪽이 닫히면 다른 쪽은 열려 있다
      shutters:[[15, 2, 240], [20, 2, 510], [5, 10, 375], [30, 10, 645]],
      closing:[[2, 12], [7, 12], [12, 12], [17, 12], [22, 12], [27, 12], [32, 12]],
      alleys:[[10, 13, 15], [25, 13, 15]],
      bside:[25, 14], trace:{ drift:[17, 12], rest:[25, 12] },
      beats:[{ t:900, do:'train' }, { p:.35, do:'closing' }]
    },
    {
      // 3 통제구역 — 조명과 길이 이상해진다. 새 기믹: 탐조등 · 통제선 · 정전 · ◀◀ 되감기
      // 흐름: 4번 · 12번 긴 줄을 탐조등 둘이 엇갈려 훑는다(빛 뒤를 따라가거나 옆길에서 기다리기) → 10초: 열차
      //       → 45%: 대정전 — 도시 불이 꺼지고 주인공 빛 · 방금 켠 길 · 드론 눈 · 열차 전조등만 보인다. 드론은 신호를 잃고 헤맨다(대표 장면, 숨 돌릴 틈)
      //       → 75%: 통제선이 풀리며 위쪽 x20 길이 열린다(처음부터 테이프 너머로 보이던 B-SIDE) → 마지막 불빛
      // 테이프: 아래 모서리 ◀◀ — 지우개 · 변칙 드론이 함께 나와 지워진 길이 가장 많아지는 구역이라 되감기가 가장 쓸모 있다
      name:'통제구역', goal:K.light, tone:'#7c7f8b', lapTone:'#76738a', ad:'flicker', art:['lit3', 'gray3'],
      tapes:['play', 'play', 'rew', 'rew'],
      train:{ every:1500 },
      lights:[{ row:4, x:35, dir:-1 }, { row:12, x:0, dir:1 }],
      closed:[[20, 1], [20, 2], [20, 3]],
      bside:[20, 2], trace:{ uv:[20, 1] },
      beats:[{ t:600, do:'train' }, { p:.45, do:'blackout' }, { p:.75, do:'checkpoint' }]
    },
    {
      // 4 순환선 — 지금 있는 곳이 진짜 도시인지 의심스러워진다. 새 기믹: 가장자리 이어짐 · 과거의 나 · 테이프 세 종류 섞기
      // 흐름: 꺼진 블록이 모두 같은 건물로 보인다(켜면 진짜 모습이 돌아온다) · 맨 위/아래 줄과 가운데 두 길이 반대편으로 이어진다
      //       → 8초: 열차 → 40%: 테이프가 되감기며 '과거의 나'가 이 구역 처음 20초 동안의 내 길을 다시 걷고, 꺼진 칸을 켜고, 끝난 자리에 B-SIDE를 남긴다(대표 장면)
      //       → 70%: 열차 두 대 → 마지막 불빛. 셔터 · 탐조등은 앞 구역의 것을 하나씩만 다시 쓴다(조합)
      name:'순환선', goal:K.wrap, tone:'#a29fb4', ad:'loop', repeat:true,
      tapes:['play', 'ff', 'rew', 'play'],
      train:{ every:1440 },
      warps:{ rows:[0, WARP_Y, MH - 1], cols:[15, 20] },
      shutters:[[5, 10, 300], [30, 10, 570]],
      lights:[{ row:4, x:0, dir:1 }],
      bside:'ghost', trace:{ ad:true }, venue:true,
      beats:[{ t:480, do:'train' }, { p:.4, do:'ghost' }, { p:.7, do:'twin' }]
    }
  ];
  // 4구역 다음은 다시 1구역부터(드론은 rules.js의 stageCfg대로 조금씩 빨라진다)
  const districtOf = n => DISTRICTS[(n - 1) % DISTRICTS.length];
  /* ================= 상태 ================= */
  // mode: title(실제 미로 도시 위의 로고 · 데모) → enter(도시 불이 꺼지고 그 도시가 게임판이 된다) → play ⇄ pause → over(결과) → 한 번 누르면 바로 play
  // play 안의 phase: ready(준비) → run → dead(맞음) → ready … / lost(마지막 하트, 도시 불이 꺼짐) → over / clear(구역 복원) → 다음 구역
  // 타이틀의 phase는 'demo'(점수 · 소리 · 드론 없이 데모 주인공이 길만 밝힌다)
  let mode = 'title', S = null, titleT = 0, idleT = 0, enterT = 0, enterDir = null, best = 0, bestStage = 1, newRecord = false, muted = false;
  // bsideMask: 지금까지 찾은 B-SIDE(구역마다 한 비트, 저장된다) · liveSeen: 순환선 개통 공연을 본 적이 있다(저장된다)
  let bsideMask = 0, liveSeen = false;
  try {
    best = +localStorage.getItem('nevercity-best') || 0; bestStage = +localStorage.getItem('nevercity-beststage') || 1;
    muted = localStorage.getItem('nevercity-muted') === '1'; bsideMask = +localStorage.getItem('nevercity-bside') || 0;
    liveSeen = localStorage.getItem('nevercity-live') === '1';
  } catch (e) {}

  function freshState() {
    return { stage:1, score:0, displayScore:0, hp:HP, anim:0, beatT:0, phase:'ready', phaseT:0, readyT:READY_T, hitThisStage:false,
             lit:new Uint8Array(TILES.length), litT:new Int32Array(TILES.length).fill(-999), eraseT:new Int32Array(TILES.length).fill(-999), litN:0,
             blocks:BLOCKS.map(() => ({ on:false, t:-999, off:-999 })),
             hero:null, drones:[], cas:[], playback:0, playMax:1, chain:0, waveI:0, waveT:0, chase:false, waveWarn:0, waveFx:0,
             // 효과(개수 상한은 FEEL): 파편 · 퍼지는 고리 · 떠오르는 점수 · PLAYBACK 잔상
             parts:[], rings:[], pops:[], trail:[], marks:[], view:{ fx:0, fy:0, lx:0, ly:0, kick:0, t:0, init:false },
             freeze:0, slow:0, flash:0, flashCol:C.white, shake:0, glitch:0, boot:0, bootMax:1, hudIn:0, fadeT:0, muteFx:0, out:null,
             banner:null, heartFx:-1, heartT:0, scoreFx:0, segFx:0, bestFx:0, beatBest:false, demoT:0,
             overT:0, clearOrder:null, live:false, perfect:false, concertDone:false, flyer:null, flutter:-999, bonus:[], streak:0, streakT:0, milestone:0,
             lastHit:null, collected:0, rewound:0, closes:0, peakLit:0, cleared:0, swept:0, bsides:0,
             // 구역(js/districts.js · js/machines.js · js/events.js): D = 지금 구역 표, stageT = 이 구역에서 실제로 움직인 시간(프레임)
             D:null, stageT:0, beats:[], beatsDone:[], closed:new Uint8Array(TILES.length), tone:null, lapIn:false,
             trains:[], trainNext:-1, trainDir:1, shut:[], alleys:[], lights:[], alarm:0, alarmCool:0, dark:null,
             ff:0, ffMax:1, rew:0, rewPath:null, hist:[], rec:[], ghost:null, bside:null, pa:null, paQ:[], last:false, lastT:0 };
  }
  function makeHero() { return { x:START.x, y:START.y, dir:'left', want:'left', moving:false, walk:0, inv:0, turn:0, spawn:0, bike:makeBike(), isHero:true }; }
  function makeDrone(kind, i, leave) {
    return { kind, x:BASE.x, y:BASE.y, dir:'up', state:'home', t:-leave, speed:0, frame:i * 7, near:false, back:0 };
  }
  // 새 구역 또는 피격 뒤: 주인공과 드론만 제자리로. resetCity면 칸 · 블록 · 카세트도 처음으로
  function placeActors(readyT) {
    const cfg = stageCfg(S.stage);
    S.hero = makeHero(); S.hero.spawn = 16; S.hero.bike.air = -26; // 다시 나올 땐 위에서 떨어져 내려앉는다
    S.drones = cfg.drones.map((k, i) => makeDrone(k, i, cfg.leave[i]));
    S.playback = 0; S.chain = 0; S.waveI = 0; S.waveT = 0; S.chase = false; S.waveWarn = 0;
    S.phase = 'ready'; S.phaseT = 0; S.readyT = readyT;
    S.trail.length = 0; S.slow = 0;
    // 테이프 효과 · 경보 · 지나가던 열차는 다시 나올 때 끝난다(열차는 다시 나온 직후에 오지 않게 조금 미룬다)
    S.ff = 0; S.rew = 0; S.rewPath = null; S.hist.length = 0; S.alarm = 0; S.trains.length = 0;
    if (S.trainNext >= 0) S.trainNext = Math.max(S.trainNext, 240);
  }
  function resetCity() {
    S.lit.fill(0); S.litT.fill(-999); S.eraseT.fill(-999); S.litN = 0;
    S.blocks.forEach(b => { b.on = false; b.t = -999; b.off = -999; });
    S.cas = CASSETTES.map(([x, y]) => ({ x, y, got:false, kind:'play' }));
    S.hitThisStage = false; S.live = false; S.perfect = false; S.flyer = null; S.clearOrder = null; S.out = null; S.milestone = 0; S.peakLit = 0;
    resetDistrict();
    lightTile(tid(START.x, START.y), true); // 출발 칸은 처음부터 켜져 있다
  }
  // 타이틀: 게임과 같은 도시. 데모 주인공이 출발 칸에서부터 길을 밝히며 돌아다닌다(드론 없음)
  function enterTitle() {
    S = freshState(); resetCity(); S.hero = makeHero(); Object.assign(S.hero, { x:10, y:WARP_Y }); S.phase = 'demo'; demoCam(true);
    titleT = 0; idleT = 0; setMode('title'); // 타이틀엔 곡이 없다(도시 환경음만, js/music.js)
  }
  // 타이틀에서 키를 누르면: 로고가 꺼지고 데모가 밝혀 둔 불이 주인공 자리에서부터 꺼지며, 카메라가 도시 전체로 물러난다
  // → 어두워진 그 도시(게임판과 같은 자리)에서 게임이 시작된다
  // 누른 방향키는 첫 이동으로 남는다
  function beginEnter(dir) {
    enterT = 0; enterDir = dir || null; setMode('enter'); S.camFrom = { ...S.cam };
    const h = S.hero; lightsOut(Math.round(h.x), Math.round(h.y), (Math.max(MW, MH) + 18) / (UI.enter * .8));
    ensureAudio(); music.start(true); sfx('enter'); // 곡은 여기서 처음부터 — 도시 밖에서 듣듯 먹먹하게 시작해 GO에 열린다
  }
  // retry: 결과 화면에서 바로 다시(타이틀을 거치지 않고, 준비도 짧게). 타이틀에서 들어온 첫 판은 도시가 이미 보이고 있어서 어둠에서 떠오르지 않는다
  // stage: 진단 · 테스트용(NEVERCITY.stage(n))으로 그 구역부터 시작
  function startGame(retry = false, dir = null, stage = 1) {
    S = freshState(); S.stage = stage; resetCity(); setupDistrict(); placeActors(retry ? BALANCE.retryReady : READY_T); newRecord = false;
    S.boot = S.bootMax = retry ? UI.fadeIn : 0; S.hudIn = UI.hudIn;
    if (dir) S.hero.want = dir;
    setMode('play'); music.start(retry); sfx(retry ? 'retry' : 'boot');
  }
  function setMode(m) {
    const prev = mode; mode = m;
    cv.style.cursor = m === 'title' || m === 'over' ? 'pointer' : 'default';
    rideSound();
    if (m === 'over') music.stop(true);
    if (m === 'title') muffle(20000, .3);
    else if (m === 'pause') { bgmPause(); muffle(700, .2); }
    else if (m === 'play' || m === 'enter') { if (prev === 'pause') bgmResume(); muffle(20000, m === 'enter' ? .5 : .2); }
  }
  function gameOver() {
    setMode('over'); S.overT = 0;
    if (S.score > best) { best = S.score; newRecord = true; }
    if (S.stage > bestStage) bestStage = S.stage;
    try { localStorage.setItem('nevercity-best', String(best)); localStorage.setItem('nevercity-beststage', String(bestStage)); } catch (e) {}
    sfx('over');
  }
  function toggleMute() {
    muted = !muted; applyMute();
    try { localStorage.setItem('nevercity-muted', muted ? '1' : '0'); } catch (e) {}
    if (S) S.muteFx = 90;
  }
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mod = (a, n) => ((a % n) + n) % n;
  const fpb = () => 3600 / BGM.bpm;
  // 공개 진단 API: 콘솔에서 NEVERCITY.state()로 지금 상태, NEVERCITY.lightAll()로 남은 칸을 모두 켜서 구역 복원 연출 확인
  // start · retry · tick(n) · steer(방향)은 테스트가 화면 없이 게임을 돌릴 때 쓴다
  window.NEVERCITY = {
    state:() => S, mode:() => mode, tiles:() => TILES.length, road:(x, y) => isRoad(x, y), blocks:() => BLOCKS,
    tuning:() => ({ BALANCE, FEEL, UI, MIX, GIMMICK, SCORE }),
    // 음악 연출: 지금 곡이 어떻게 들려야 하는지(plan) · 지금까지 일어난 곡 사건(log: 되감기 · 끊김 · 처음부터) · 마지막 덕킹
    mix:() => ({ plan:musicPlan(), log:mix.log.slice(), duck:mix.lastDuck }),
    // 실제 소리 상태(브라우저에서만): 곡이 흐르는지 · 곡 위치(초) · 테이프 속도 · 곡 필터 · 음량 · 덕킹 · 환경음. meter: 곡 · 효과음 · 환경음의 지금 크기(dBFS)
    audio:() => ac && { state:ac.state, song:bgm.active, playing:bgm.playing, pos:+bgmTime().toFixed(2), rate:bgm.rate, lp:Math.round(mLp.frequency.value),
                       level:+mLevel.gain.value.toFixed(3), duck:+mDuck.gain.value.toFixed(3), amb:+aLevel.gain.value.toFixed(3) },
    meter() {
      if (!ac) return null;
      if (!mix.meters) mix.meters = [['music', mLevel], ['sfx', sfxBus], ['amb', aLevel]].map(([k, n]) => { const a = ac.createAnalyser(); a.fftSize = 2048; n.connect(a); return [k, a]; });
      const o = {}; for (const [k, a] of mix.meters) { const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v; o[k] = +(10 * Math.log10(s / d.length + 1e-12)).toFixed(1); }
      return o;
    }, muted:() => muted, cue:() => S && S.hero ? turnAhead(S.hero) : null,
    start(dir) { startGame(false, dir); }, retry(dir) { startGame(true, dir); }, title() { enterTitle(); },
    tick(n = 1) { for (let i = 0; i < n; i++) update(); }, steer:d => steer(d),
    // 구역: NEVERCITY.stage(3)으로 3구역(통제구역)부터 · district()는 지금 구역 표 · bsides()는 찾은 B-SIDE 비트
    stage(n = 1, dir) { startGame(false, dir, n); }, district:() => S && S.D, districts:() => DISTRICTS, bsides:() => bsideMask, liveSeen:() => liveSeen,
    lightAll() { if (S && mode === 'play') TILES.forEach((_, i) => lightTile(i, true)); },
    lightAt(x, y) { if (S && mode === 'play') lightTile(tid(x, y), true); }, tileAt:(x, y) => tid(x, y),
    lightBut(n = 1) { if (S && mode === 'play') TILES.forEach((_, i) => { if (i >= n) lightTile(i, true); }); },
    // 한 프레임 그리는 데 걸리는 시간(ms): NEVERCITY.perf() → { median, p95, mean }. 캔버스는 몇 장마다 몰아서 그려서 p95가 튈 수 있다 — 평균(mean)이 16.7ms 안쪽이면 60fps
    perf(n = 120) { const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); render(); t.push(performance.now() - a); } const mean = t.reduce((a, b) => a + b, 0) / n; t.sort((a, b) => a - b); return { median:+t[n >> 1].toFixed(2), p95:+t[Math.floor(n * .95)].toFixed(2), mean:+mean.toFixed(2) }; }
  };
  /* ================= 소리 ================= */
  // 연결: 효과음(sfxBus) ───────────────────────────────────────────────────────┐
  //       곡 파일 · 신스 음악 → musicBus → 곡 필터(mLp) → 곡 덕킹(mDuck) → 곡 음량(mLevel) ─┼→ 먹먹하게 거르는 필터(일시정지) → 컴프레서 → 음소거 → 스피커
  //       도시 환경음(ambBus) → 환경음 음량(aLevel) ──────────────────────────────────┘
  // 곡이 지금 어떻게 들려야 하는지(필터 · 음량 · 테이프 속도 · 되감기)는 js/music.js가 정한다. 음량은 tuning.js의 MIX, 곡 연출 숫자는 SCORE
  // 곡 파일을 <audio>로 틀 때(file://)는 필터 대신 볼륨으로 따라간다
  let ac = null, noiseBuf = null, filt = null, sfxBus = null, musicBus = null, out = null, mLp = null, mDuck = null, mLevel = null, ambBus = null, aLevel = null;
  function ensureAudio() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        noiseBuf = ac.createBuffer(1, ac.sampleRate * .6, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        out = ac.createGain(); out.connect(ac.destination);
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
        comp.connect(out);
        filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 20000; filt.connect(comp);
        sfxBus = ac.createGain(); sfxBus.gain.value = MIX.sfx; sfxBus.connect(filt);
        mLevel = ac.createGain(); mLevel.gain.value = 0; mLevel.connect(filt);
        mDuck = ac.createGain(); mDuck.connect(mLevel);
        mLp = ac.createBiquadFilter(); mLp.type = 'lowpass'; mLp.frequency.value = SCORE.enterLp[0]; mLp.Q.value = .7; mLp.connect(mDuck);
        musicBus = ac.createGain(); musicBus.gain.value = MIX.music; musicBus.connect(mLp);
        aLevel = ac.createGain(); aLevel.gain.value = 0; aLevel.connect(filt);
        ambBus = ac.createGain(); ambBus.gain.value = MIX.amb; ambBus.connect(aLevel);
        bgm.gain = ac.createGain(); bgm.gain.gain.value = BGM.volume; bgm.gain.connect(musicBus);
        applyMute(); ambience.start(); music.timer || (music.timer = setInterval(() => music.tick(), 25));
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function applyMute() {
    if (out) out.gain.setTargetAtTime(muted ? 0 : MIX.master, ac.currentTime, .03);
    elVolume();
  }
  function tone(f1, f2, dur, type = 'square', vol = .05, at = 0, bus = sfxBus) {
    if (!ac) return;
    const t = at || ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + .02);
  }
  function noise(t, vol, len = .04, freq = 7000, type = 'highpass', bus = sfxBus) {
    if (!ac || !noiseBuf) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    s.connect(f).connect(g).connect(bus); s.start(t); s.stop(t + len + .02);
  }
  // 모든 소리의 높은 음역을 f(Hz)까지 dur초 동안 걸러낸다 (일시정지는 벽 너머처럼 먹먹하게)
  let muffled = false;
  function muffle(f, dur) {
    muffled = f < 5000; elVolume();
    if (!ac || !filt) return;
    const t = ac.currentTime, q = filt.frequency; q.cancelScheduledValues(t); q.setValueAtTime(q.value, t); q.exponentialRampToValueAtTime(f, t + dur);
  }

  /* ================= BGM 재생 ================= */
  // http(s)로 열면 Web Audio로, file://로 열면 <audio>로 재생. 파일이 없으면(404) 신스 음악(js/music.js)
  // rate = 테이프 속도(음과 빠르기가 함께 바뀐다). 곡 위치는 속도를 곱해 센다(화면 박자가 곡을 따라간다)
  const bgm = { buf:null, el:null, src:null, scrub:null, gain:null, pos0:0, t0:0, rate:1, pos:0, playing:false, active:false };
  fetch(BGM.src).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(b => new OfflineAudioContext(2, 1, 44100).decodeAudioData(b))
    .then(buf => { bgm.buf = buf; })
    .catch(e => {
      if (typeof e === 'number') return;
      const el = new Audio(); el.loop = true; el.preload = 'auto'; el.src = BGM.src;
      el.addEventListener('canplaythrough', () => { bgm.el = el; }, { once:true });
    });
  const bgmLen = () => bgm.buf ? bgm.buf.duration : bgm.el && bgm.el.duration || 1;
  function bgmPlay(t) {
    bgmHalt();
    if (bgm.buf && ac) {
      const s = ac.createBufferSource(); s.buffer = bgm.buf; s.loop = true; s.playbackRate.value = bgm.rate; s.connect(bgm.gain);
      s.start(0, mod(t, bgm.buf.duration)); bgm.src = s; bgm.pos0 = t; bgm.t0 = ac.currentTime;
    } else if (bgm.el) { bgm.el.currentTime = mod(t, bgmLen()); bgm.el.preservesPitch = false; bgm.el.playbackRate = bgm.rate; elVolume(); bgm.el.play().catch(() => {}); }
    bgm.playing = true;
  }
  function bgmHalt() {
    for (const k of ['src', 'scrub']) if (bgm[k]) { try { bgm[k].onended = null; bgm[k].stop(); } catch (e) {} bgm[k] = null; }
    if (bgm.el) bgm.el.pause(); bgm.playing = false;
  }
  const bgmTime = () => !bgm.playing ? bgm.pos : bgm.buf ? bgm.pos0 + (ac.currentTime - bgm.t0) * bgm.rate : bgm.el.currentTime;
  function bgmRate(r) {
    if (Math.abs(r - bgm.rate) < 1e-3) return;
    if (bgm.playing && bgm.buf) { bgm.pos0 = bgmTime(); bgm.t0 = ac.currentTime; }
    bgm.rate = r;
    if (bgm.src) bgm.src.playbackRate.setValueAtTime(r, ac.currentTime);
    if (bgm.el) { bgm.el.preservesPitch = false; bgm.el.playbackRate = r; }
  }
  // 곡 되감기: 지금 자리에서 scrub초만큼을 거꾸로 빠르게 들려준 뒤, sec초 앞에서 이어서 튼다(테이프를 되감는 소리)
  function bgmRewind(sec, scrub) {
    if (!bgm.playing) return;
    const p = bgmTime(), back = Math.max(0, p - sec), b = bgm.buf;
    if (!b || !ac) { if (bgm.el) bgm.el.currentTime = mod(back, bgmLen()); return; }
    const sr = b.sampleRate, n = Math.max(1, Math.floor(scrub * sr)), end = Math.floor(mod(p, b.duration) * sr), rev = ac.createBuffer(b.numberOfChannels, n, sr);
    for (let c = 0; c < b.numberOfChannels; c++) {
      const src = b.getChannelData(c), dst = rev.getChannelData(c);
      for (let i = 0; i < n; i++) { const j = end - i; dst[i] = src[j >= 0 ? j : j + src.length]; }
    }
    bgmHalt(); bgm.pos = back;
    const s = ac.createBufferSource(); s.buffer = rev; s.playbackRate.value = 2; s.connect(bgm.gain); s.start();
    bgm.scrub = s; s.onended = () => { if (bgm.scrub === s) { bgm.scrub = null; if (music.on && (mode === 'play' || mode === 'enter')) bgmPlay(back); } };
  }
  function bgmPause() { if (bgm.active && bgm.playing) { bgm.pos = bgmTime(); bgmHalt(); } }
  function bgmResume() { if (bgm.active) bgmPlay(bgm.pos); }
  // <audio>로 틀 땐 Web Audio 필터를 못 쓰니 음량으로만 따라간다
  function elVolume() {
    if (!bgm.el) return;
    const m = mix.plan || { level:0, lp:20000 };
    bgm.el.volume = muted ? 0 : clamp(BGM.volume * MIX.master * m.level * mix.duckV * (m.lp < 3000 ? .45 : 1) * (muffled ? .4 : 1));
  }
  // 박자 시계(프레임 단위): 곡이 있으면 곡 위치에서, 없으면 프레임을 센다
  const songBeat = () => bgm.active && bgm.playing ? Math.max(0, (mod(bgmTime(), bgmLen()) - BGM.beat0) * 60) : null;

  /* ================= 효과음 ================= */
  // 기준 크기: 자주 나는 소리(칸 켜기 · 꺾기)는 작게, 상태가 바뀌는 소리(카세트 · 피격 · 복원)는 크게
  // 위험 · 곧 일어날 일을 알리는 소리(건널목 종 · 경고 · 경보 · 안내방송 · 드론 출발)는 꽉 찬 곡에 묻히지 않게 한 단계 더 크게
  function sfx(n, x = 0) {
    if (SCORE.duck[n]) duck(n);
    if (!ac) return;
    const now = ac.currentTime;
    // 칸이 켜질 때: 아주 작은 픽. 쉬지 않고 이어 켤수록 음이 조금씩 올라간다(x = 연속 칸 수)
    if (n === 'tick') tone(660 + Math.min(16, x) * 45, 990 + Math.min(16, x) * 45, .035, 'square', .014);
    else if (n === 'turn') noise(now, .018, .025, 3500, 'bandpass');
    // 바이크: 출발 회전음 · 제동 마찰 · 내려앉는 쿵 · 선로 턱
    else if (n === 'rev') { tone(70, 260, .32, 'sawtooth', .045); noise(now, .04, .25, 700, 'lowpass'); }
    else if (n === 'skid') { noise(now, .028, .16, 2600, 'bandpass'); tone(900, 700, .12, 'triangle', .01); }
    else if (n === 'land') { tone(120, 50, .16, 'sine', .14); noise(now, .04, .08, 800, 'lowpass'); }
    else if (n === 'clack') { noise(now, .03, .03, 1800, 'bandpass'); tone(160, 90, .05, 'square', .018); }
    else if (n === 'block') { [523, 784, 1047].forEach((f, i) => tone(f, f * 1.01, .14, 'square', .03, now + i * .035)); noise(now, .03, .12, 5000); }
    else if (n === 'blockoff') { tone(700, 90, .25, 'square', .03); noise(now + .15, .06, .04, 6000); }
    else if (n === 'erase') noise(now, .022, .06, 3000, 'bandpass');
    else if (n === 'cas') { tone(110, 40, .3, 'sine', .22); noise(now, .05, .08, 1500, 'bandpass'); [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, .09, 'square', .04, now + .05 + i * .045)); }
    else if (n === 'catch') { tone(300 + x * 220, 1500 + x * 300, .18, 'square', .045); noise(now, .05, .2, 2500, 'bandpass'); tone(90, 40, .18, 'sine', .14); }
    else if (n === 'hit') { tone(180, 45, .4, 'sawtooth', .08); tone(70, 30, .35, 'sine', .25); noise(now, .1, .5, 900, 'lowpass'); noise(now + .08, .07, .6, 5000); }
    else if (n === 'lost') { tone(420, 40, 1.3, 'sawtooth', .05); tone(210, 22, 1.4, 'triangle', .07); noise(now + .1, .05, 1.2, 1200, 'lowpass'); }
    else if (n === 'close') { tone(1500, 2200, .07, 'triangle', .04); tone(2200, 3000, .12, 'sine', .03, now + .06); }
    else if (n === 'chase') { [880, 660, 880, 660].forEach((f, i) => tone(f, f, .07, 'square', .03, now + i * .09)); }
    else if (n === 'patrol') tone(660, 440, .16, 'triangle', .035);
    else if (n === 'warnwave') tone(1320, 1320, .04, 'square', .045);
    else if (n === 'exit') { tone(240, 480, .14, 'sawtooth', .04); noise(now, .05, .12, 2200, 'bandpass'); }
    else if (n === 'warn') tone(1760, 1760, .05, 'square', .055);
    else if (n === 'powerdown') { tone(700, 90, .32, 'square', .03); noise(now + .2, .08, .03, 6000); }
    else if (n === 'boot') { tone(60, 120, .25, 'sine', .2); noise(now, .05, .3, 4000); tone(1800, 2400, .12, 'sine', .02, now + .18); }
    // 시작: 간판이 꺼지고 도시 불이 꺼지며 물러난다 — 내려가는 전원 소리
    else if (n === 'enter') { tone(1100, 140, .5, 'sawtooth', .022); noise(now, .045, .5, 900, 'lowpass'); }
    else if (n === 'retry') { tone(300, 600, .08, 'square', .04); tone(600, 900, .08, 'square', .04, now + .08); noise(now, .04, .2, 4000); }
    else if (n === 'ready') [392, 523].forEach((f, i) => tone(f, f, .12, 'triangle', .05, now + i * .12));
    else if (n === 'go') [523, 784, 1047].forEach((f, i) => tone(f, f, .09, 'square', .045, now + i * .05));
    else if (n === 'milestone') [659, 880, 1175].forEach((f, i) => tone(f, f, .1, 'triangle', .04, now + i * .06));
    else if (n === 'clear') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f * 1.01, .12, 'square', .045, now + i * .08));
    else if (n === 'tally') tone(1200 + x * 80, 1200 + x * 80, .03, 'square', .022);
    else if (n === 'perfect') [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, .14, 'triangle', .06, now + .5 + i * .1));
    else if (n === 'record') [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, f, .1, 'triangle', .05, now + i * .07));
    else if (n === 'over') tone(392, 98, .7, 'triangle', .07);
    else if (n === 'pause') tone(440, 330, .1, 'square', .03);
    else if (n === 'select') { tone(880, 1320, .06, 'square', .035); noise(now, .02, .05, 6000); }
    else if (n === 'warp') { tone(200, 1200, .2, 'sawtooth', .025); noise(now, .04, .2, 2000, 'bandpass'); }
    // 구역 기계 · 사건
    else if (n === 'bell') { tone(1480, 1480, .07, 'square', .055); tone(1175, 1175, .07, 'square', .05, now + .1); }   // 건널목 종
    else if (n === 'train') { tone(311, 311, .35, 'sawtooth', .05); tone(392, 392, .35, 'sawtooth', .04); noise(now, .09, 1.6, 420, 'lowpass'); tone(55, 40, 1.5, 'sine', .14); }
    else if (n === 'sweep') { noise(now, .09, .25, 1800, 'bandpass'); tone(900, 120, .25, 'square', .04); tone(70, 35, .2, 'sine', .16); }
    else if (n === 'shutter') { for (let i = 0; i < 4; i++) noise(now + i * .03, .05 - i * .008, .03, 2600, 'bandpass'); tone(110, 60, .12, 'sine', .12, now + .12); }
    else if (n === 'shutterup') { for (let i = 0; i < 3; i++) noise(now + i * .04, .03, .03, 3200, 'bandpass'); }
    else if (n === 'jam') { tone(95, 80, .22, 'square', .035); noise(now, .04, .2, 1400, 'bandpass'); }
    else if (n === 'alley') { noise(now, .05, .4, 1500, 'bandpass'); tone(220, 440, .35, 'triangle', .03); }
    else if (n === 'alarm') { [0, .32].forEach(d => { tone(720, 1100, .3, 'sawtooth', .055, now + d); }); tone(1100, 720, .3, 'sawtooth', .045, now + .64); }
    else if (n === 'buzz') { tone(60, 60, .9, 'sawtooth', .03); for (let i = 0; i < 5; i++) noise(now + i * .16 + Math.random() * .05, .05, .03, 5000); }
    else if (n === 'darkout') { tone(320, 30, .9, 'sawtooth', .05); noise(now, .07, .8, 600, 'lowpass'); }
    else if (n === 'powerup') { tone(50, 420, .7, 'sawtooth', .03); [523, 659, 784].forEach((f, i) => tone(f, f, .16, 'triangle', .04, now + .5 + i * .07)); }
    else if (n === 'chime') { tone(784, 784, .32, 'triangle', .09); tone(622, 622, .45, 'triangle', .08, now + .3); }  // 안내방송 딩동
    else if (n === 'tapecut') { noise(now, .08, .08, 4000, 'highpass'); tone(1400, 300, .15, 'triangle', .03, now + .05); }
    else if (n === 'ff') { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, f, .05, 'square', .035, now + i * .025)); noise(now, .04, .3, 6000); }
    else if (n === 'rew') { tone(1600, 260, .45, 'sawtooth', .03); tone(1200, 200, .45, 'square', .018, now + .03); noise(now, .05, .45, 2400, 'bandpass'); }
    else if (n === 'ghost') { tone(260, 1300, .5, 'triangle', .04); noise(now, .04, .5, 2200, 'bandpass'); }
    else if (n === 'drop') [988, 784].forEach((f, i) => tone(f, f, .12, 'triangle', .04, now + i * .1));
    else if (n === 'bside') [587, 740, 880, 1175, 1480].forEach((f, i) => tone(f, f, .16, 'triangle', .05, now + i * .09));
    else if (n === 'lastcall') [880, 1109, 1319].forEach((f, i) => tone(f, f, .14, 'triangle', .055, now + i * .11));
  }

  // 엔진: 소리 하나를 켜 둔 채 높이 · 밝기 · 크기만 바꾼다(프레임마다 새 소리를 만들지 않는다)
  // 서 있으면 낮게 고르고(공회전), 달리면 오르고, 출발 순간 한 번 치솟고, ▶▶엔 한 단계 높다. Hit Stop · 쓰러짐 · 일시정지엔 꺼진다
  const engine = { osc:null, sub:null, lp:null, gain:null };
  function rideSound() {
    if (!ac || !sfxBus) return;
    if (!engine.osc) {
      engine.osc = ac.createOscillator(); engine.osc.type = 'sawtooth';
      engine.sub = ac.createOscillator(); engine.sub.type = 'square';
      engine.lp = ac.createBiquadFilter(); engine.lp.type = 'lowpass'; engine.lp.frequency.value = 400;
      engine.gain = ac.createGain(); engine.gain.gain.value = 0;
      engine.osc.connect(engine.lp); engine.sub.connect(engine.lp); engine.lp.connect(engine.gain).connect(sfxBus);
      engine.osc.start(); engine.sub.start();
    }
    const h = S && S.hero, live = mode === 'play' && S.freeze === 0 && !!h && (S.phase === 'run' || S.phase === 'ready');
    const v = live ? clamp(h.bike.speed / .2) : 0, kick = live ? h.bike.launch / LAUNCH : 0, t = ac.currentTime;
    const f = 34 + v * 44 + kick * 34 + (S && S.ff > 0 ? 16 : 0) + (live && v < .05 ? Math.sin(S.anim * .9) * 2 : 0);
    engine.osc.frequency.setTargetAtTime(f, t, .06); engine.sub.frequency.setTargetAtTime(f / 2, t, .06);
    engine.lp.frequency.setTargetAtTime(280 + v * 520 + kick * 700, t, .08);
    engine.gain.gain.setTargetAtTime(live ? .007 + v * .013 + kick * .022 : 0, t, .05);
  }
  /* ================= 음악 연출: 「Future That Never Comes」가 플레이 흐름에 반응한다 ================= */
  // 곡을 처음부터 끝까지 틀어 두는 배경음이 아니라, 도시 안으로 들어가고 · 도시가 이상해지고 · 시간이 되감기는 것을 소리로 보여 주는 연출
  // 곡에 하는 일은 네 가지뿐이다: 음량 · 먹먹함(필터) · 테이프 속도 · 되감기. 곡 자체를 잘게 자르거나 박자에 화면을 맞추지 않는다(리듬게임이 아니다)
  // musicPlan()이 지금 상태에서 곡이 어떻게 들려야 하는지(목표값)를 정하고, mixStep()이 매 프레임 그 값을 부드럽게 따라간다. 숫자는 tuning.js의 SCORE
  //
  // 흐름: 타이틀(곡 없음, 도시 환경음만) → 키를 누르면 도시 밖에서 듣듯 먹먹하게 시작 → READY 동안 다가와 GO에 활짝 → 구역 복원 뒤 멀어짐 → 다음 구역 GO에 다시
  //       정전: 불빛이 깜빡일 때 곡도 끊기고, 어둠 속엔 저음만 / ◀◀ · 과거의 나: 곡이 실제로 되감긴다 / ▶▶: 곡도 빨라진다 / 폐점: 셔터가 닫힌 동안 먹먹
  // 루프(스테이지): 1 · 2 그대로 → 3부터 아주 가끔 끊김 · 흔들림 → 5(4구역을 돌고 돌아온 도시): 곡이 멈춘 채 READY, GO에 처음부터 — 같은 곡이 낮고 느리게
  const mix = { plan:null, level:-1, lp:-1, amb:-1, duckV:1, duckEnd:0, duckDepth:1, lastDuck:null, log:[] };
  const loopOf = n => SCORE.loops[Math.min(SCORE.loops.length - 1, n <= 4 ? n - 1 : 4 + Math.floor((n - 5) / 4))];
  const lapOf = n => Math.floor((n - 1) / DISTRICTS.length); // 0 = 처음 한 바퀴, 1 = 돌아온 도시
  const towards = (a, b, k) => a * Math.pow(b / a, clamp(k)); // 필터는 귀에 고르게 들리도록 지수로 옮긴다

  function musicPlan() {
    const A = SCORE.amb, L = S ? loopOf(S.stage) : SCORE.loops[0], run = { level:1, lp:L.lp, rate:L.rate, amb:A.run };
    if (!S || mode === 'title') return { level:0, lp:SCORE.enterLp[0], rate:1, amb:A.title };
    if (mode === 'over') return { level:0, lp:L.lp, rate:L.rate, amb:A.title };
    if (mode === 'enter') {
      const k = clamp(enterT / UI.enter);
      return { level:.3 + .35 * k, lp:towards(SCORE.enterLp[0], SCORE.enterLp[1], k), rate:1, amb:A.title + (A.quiet - A.title) * k };
    }
    if (mode !== 'play') return run;
    const ph = S.phase;
    if (ph === 'ready') {
      if (S.lapIn) return { level:0, lp:L.lp, rate:L.rate, amb:A.dark }; // 돌아온 도시: 곡이 멈춘 채로 시작한다
      const k = clamp(S.phaseT / S.readyT), from = S.hero && S.hero.inv > 0 ? SCORE.deadLp : SCORE.readyLp[0];
      return { level:.75 + .25 * k, lp:towards(from, SCORE.readyLp[1], k), rate:L.rate, amb:A.quiet };
    }
    if (ph === 'dead') return { level:.7, lp:SCORE.deadLp, rate:L.rate, amb:A.quiet };
    if (ph === 'lost') return { level:0, lp:SCORE.deadLp, rate:L.rate, amb:A.dark };
    if (ph === 'clear') {
      const t = S.phaseT, live = S.live && t >= LIVE_AT - 30 && t < clearEnd() - UI.fadeOut;
      if (live) return run; // 순환선 개통 공연(IDIOTAPE) 동안은 곡이 가장 크게
      const k = clamp((t - 50) / 60);
      return { level:1 - .3 * k, lp:towards(L.lp, SCORE.clearLp, k), rate:L.rate, amb:A.run + (A.quiet - A.run) * k };
    }
    if (S.dark) {
      const d = S.dark;
      if (d.phase === 'warn') return { ...run, level:darkAlpha() > 0 ? .12 : 1 }; // 불빛이 깜빡일 때 곡도 함께 끊긴다
      if (d.phase === 'dark') return { level:SCORE.darkLevel, lp:SCORE.darkLp, rate:L.rate, amb:A.dark };
      const k = easeOut(clamp(d.t / GIMMICK.dark.back));
      return { level:SCORE.darkLevel + (1 - SCORE.darkLevel) * k, lp:towards(SCORE.darkLp, L.lp, k), rate:L.rate, amb:A.dark + (A.run - A.dark) * k };
    }
    const p = run;
    if (S.shut.some(s => !s.cycle && s.closed)) { p.lp = Math.min(p.lp, SCORE.closingLp); p.amb = A.quiet; }
    if (S.ff > 0) p.rate *= SCORE.ff;
    if (anomaly.wob > 0) p.rate *= .982;
    if (anomaly.drop > 0) p.level = 0;
    return p;
  }

  /* ================= 루프가 쌓일수록 생기는 이상 ================= */
  // 3루프부터 아주 가끔: 곡이 0.1초쯤 끊긴다(drop) · 음이 잠깐 내려앉는다(wobble) · 5루프부터 한순간 거꾸로 들린다(rev)
  // 정전 · 되감기 · 과거의 나처럼 이미 곡이 연출 중일 땐 끼어들지 않는다. 간격은 구역마다 정해진 값에서 조금씩 흔들린다(같은 판은 같은 순간에)
  const anomaly = { stage:0, drop:0, wob:0, next:{} };
  function anomalyStep() {
    if (anomaly.stage !== S.stage) { anomaly.stage = S.stage; anomaly.next = {}; }
    if (anomaly.drop > 0) anomaly.drop--; if (anomaly.wob > 0) anomaly.wob--;
    if (S.phase !== 'run' || S.dark || S.rew > 0 || S.ghost) return;
    const L = loopOf(S.stage);
    ['drop', 'wobble', 'rev'].forEach((k, i) => {
      if (!L[k]) return;
      if (anomaly.next[k] === undefined) { anomaly.next[k] = S.stageT + L[k] * 60 * (.6 + .8 * hash(S.stage * 13 + i)); return; }
      if (S.stageT < anomaly.next[k]) return;
      anomaly.next[k] = S.stageT + L[k] * 60 * (.6 + .8 * hash(S.stageT + i));
      if (k === 'drop') anomaly.drop = 5 + Math.floor(hash(S.stageT + 7) * 4);
      else if (k === 'wobble') anomaly.wob = 48;
      else songRewind(0, .3);
      mix.log.push(k);
    });
  }

  /* ================= 곡 되감기 · 덕킹 ================= */
  // sec초 전으로 곡을 되감는다(scrub초 동안 거꾸로 빠르게 들린 뒤 이어서). 곡 파일이 없으면 신스 음악의 마디를 되돌린다
  function songRewind(sec, scrub = SCORE.rewind.scrub) {
    mix.log.push('rewind:' + sec);
    if (!ac || !music.on) return;
    if (bgm.active) { bgmRewind(sec, scrub); return; }
    music.step = Math.max(0, music.step - Math.round(sec / (60 / BGM.bpm / 2)));
    music.next = ac.currentTime + scrub * .6;
    tone(1500, 220, scrub * .6, 'sawtooth', .02, 0, musicBus); noise(ac.currentTime, .03, scrub * .6, 2000, 'bandpass', musicBus);
  }
  // 곡의 t초 자리로 감는다(순환선 개통 공연: 곡에서 가장 큰 구간으로)
  function songSeek(t, scrub = .5) {
    mix.log.push('seek:' + t);
    if (!ac || !music.on || !bgm.active) return;
    bgmRewind(bgmTime() - t, scrub);
  }
  // 중요한 효과음(피격 · 테이프 · 경고 · 안내방송 …)이 날 때 곡을 잠깐 낮춘다. 더 깊은 덕킹이 걸려 있으면 그쪽을 지킨다
  function duck(name) {
    const [depth, hold] = SCORE.duck[name]; mix.lastDuck = name;
    if (!ac || !mDuck) return;
    const t = ac.currentTime;
    if (t < mix.duckEnd && depth >= mix.duckDepth) { if (t + hold <= mix.duckEnd) return; }
    else mix.duckDepth = depth;
    mix.duckEnd = Math.max(mix.duckEnd, t + hold);
    const g = mDuck.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.setTargetAtTime(mix.duckDepth, t, .015); g.setTargetAtTime(1, mix.duckEnd, .18);
    mix.duckV = mix.duckDepth; setTimeout(() => { mix.duckV = 1; elVolume(); }, hold * 1000); elVolume();
  }

  /* ================= 매 프레임: 목표값을 소리에 옮긴다 ================= */
  function mixStep() {
    if (S && mode === 'play') anomalyStep();
    const p = mix.plan = musicPlan();
    music.rate = p.rate;
    if (!ac || !mLevel) return;
    const t = ac.currentTime, set = (param, key, v, tc) => { if (Math.abs(v - mix[key]) <= 1e-3 * Math.max(1, v)) return; mix[key] = v; param.setTargetAtTime(v, t, tc); };
    set(mLevel.gain, 'level', p.level, p.level === 0 && anomaly.drop > 0 ? .004 : p.level < mix.level ? .05 : .15);
    set(mLp.frequency, 'lp', p.lp, S && S.dark ? .2 : .1);
    set(aLevel.gain, 'amb', p.amb, .5);
    bgmRate(p.rate);
    elVolume();
  }

  /* ================= 곡 시작 · 멈춤 ================= */
  // start(true): 새 판 — 곡을 처음부터(타이틀에서 들어올 때 · 결과 화면에서 다시). start(): 흐르고 있으면 그대로 둔다
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]; // Am7 · Fmaj7 · Cmaj7 · G(#11)
  const music = { on:false, next:0, step:0, timer:null, rate:1,
    start(fromTop = false) {
      ensureAudio(); if (!ac) return;
      if (!this.on || fromTop) { this.next = ac.currentTime + .06; this.step = 0; }
      this.on = true;
      bgm.active = !!(bgm.buf || bgm.el);
      if (!bgm.active) return;
      if (bgm.gain) { bgm.gain.gain.cancelScheduledValues(ac.currentTime); bgm.gain.gain.setValueAtTime(BGM.volume, ac.currentTime); }
      if (fromTop || (!bgm.playing && !bgm.scrub)) { bgm.rate = this.rate; bgmPlay(0); }
    },
    // 돌아온 도시의 GO: 곡을 처음부터 다시(그 루프의 테이프 속도로)
    restart() { mix.log.push('restart'); if (!ac) return; this.step = 0; this.next = ac.currentTime + .06; if (bgm.active) { bgm.rate = this.rate; bgmPlay(0); } },
    stop(fade) {
      this.on = false; if (!bgm.active || !ac) return;
      if (fade && bgm.gain) { bgm.gain.gain.setTargetAtTime(0, ac.currentTime, .35); setTimeout(() => { if (!this.on) { bgmHalt(); bgm.gain.gain.setValueAtTime(BGM.volume, ac.currentTime); } }, 1200); }
      else bgmHalt();
    },
    // 25ms마다: 도시 환경음의 가끔 나는 소리 + (곡 파일이 없을 때) 신스 음악
    tick() {
      ambience.tick();
      if (bgm.active) return;
      const live = mode === 'play' || mode === 'enter';
      if (!ac || !this.on || !live || (S && (S.phase === 'dead' || S.phase === 'lost'))) { if (ac) this.next = ac.currentTime + .05; return; }
      // 「Future That Never Comes」의 분위기: 새벽 · 꿈 · 아련함. 느린 아르페지오와 부드러운 베이스. 테이프 속도(rate)가 음과 빠르기를 함께 바꾼다
      const r = this.rate, st = 60 / BGM.bpm / 2 / r, play = S && S.playback > 0, fading = play && S.playback < BALANCE.playbackWarn, chase = S && (S.chase || S.alarm > 0) && mode === 'play';
      while (this.next < ac.currentTime + .12) {
        const i = this.step % 32, t = this.next, ch = CHORDS[Math.floor(this.step / 16) % 4], wob = (fading ? 1 + .03 * Math.sin(this.step * 1.7) : 1) * r;
        if (i % 4 === 0) tone(mtof(ch[0] - 12) * r, mtof(ch[0] - 12) * r, st * 3.6, 'triangle', .085, t, musicBus);
        if (chase && i % 4 === 2) tone(mtof(ch[0] - 12) * r, mtof(ch[0] - 12) * r, st * .9, 'triangle', .06, t, musicBus);
        tone(mtof(ch[i % 4] + 12) * wob, mtof(ch[i % 4] + 12) * wob, st * .9, 'square', .016, t, musicBus);
        if (i % 2 === 1 || chase) noise(t, chase ? .016 : .011, .03, 8000, 'highpass', musicBus);
        if (i % 8 === 4) noise(t, .035, .09, 1800, 'bandpass', musicBus);
        if (i % 8 === 0) tone(140 * r, 45 * r, .14, 'sine', .12, t, musicBus);
        if (play && i % 2 === 0) tone(mtof(ch[(i >> 1) % 4] + 24) * wob, mtof(ch[(i >> 1) % 4] + 24) * wob, st * .7, 'triangle', .03, t, musicBus);
        this.next += st; this.step++;
      }
    }
  };

  /* ================= 도시 환경음 ================= */
  // 늘 깔려 있는 것: 바람(아주 느리게 오르내리는 잡음) · 멀리서 도는 기계(낮은 맥놀이) · 전기 잡음(낮게 거른 120Hz)
  // 가끔 나는 것: 멀리 지나가는 차(왼쪽 → 오른쪽) · 전기가 튀는 소리 · 아주 먼 열차 경적
  // 타이틀 · 결과 화면 · 정전에선 앞으로 나오고, 곡이 흐를 땐 뒤로 물러난다(SCORE.amb)
  const ambience = { on:false, next:null,
    start() {
      if (this.on || !ac) return; this.on = true;
      const len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
      let v = 0; for (let i = 0; i < len; i++) { v = v * .985 + (Math.random() * 2 - 1) * .015; d[i] = v * 5; } // 거친 바람(갈색 잡음)
      const src = ac.createBufferSource(); src.buffer = b; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = .6;
      const wg = ac.createGain(); wg.gain.value = .45;
      const lfo = (f, depth, param) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = depth; o.connect(g).connect(param); o.start(); };
      lfo(.07, .25, wg.gain); lfo(.043, 200, bp.frequency);
      src.connect(bp).connect(wg).connect(ambBus); src.start();
      for (const [f, g0] of [[55, .045], [110.6, .025], [165.4, .008]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = g0; o.connect(g).connect(ambBus); o.start(); }
      const z = ac.createOscillator(), zl = ac.createBiquadFilter(), zg = ac.createGain(); z.type = 'sawtooth'; z.frequency.value = 120; zl.type = 'lowpass'; zl.frequency.value = 650; zg.gain.value = .005;
      z.connect(zl).connect(zg).connect(ambBus); z.start();
      const t = ac.currentTime; this.next = { car:t + 2.5, crack:t + 1.2, far:t + 11 };
    },
    tick() {
      if (!this.on) return;
      const t = ac.currentTime, n = this.next;
      if (t > n.car) { carPass(t); n.car = t + 5 + Math.random() * 9; }
      if (t > n.crack) { for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) noise(t + i * .03, .02, .015, 4500, 'highpass', ambBus); n.crack = t + 2 + Math.random() * 6; }
      if (t > n.far) { [220, 277].forEach(f => tone(f, f * .99, 1.4, 'triangle', .012, t + .02, ambBus)); n.far = t + 18 + Math.random() * 22; }
    }
  };
  // 멀리 지나가는 차: 낮게 거른 잡음이 왼쪽에서 오른쪽(또는 반대)으로 부풀었다 사라진다
  function carPass(t) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), dur = 2.4 + Math.random();
    s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(900, t + dur / 2); f.frequency.linearRampToValueAtTime(380, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + dur / 2); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let node = s.connect(f).connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(), dir = Math.random() < .5 ? -1 : 1; p.pan.setValueAtTime(-dir * .8, t); p.pan.linearRampToValueAtTime(dir * .8, t + dur); node = node.connect(p); }
    node.connect(ambBus); s.start(t); s.stop(t + dur + .05);
  }
  /* ================= 효과: 파편 · 고리 · 점수 · 알림 · 카메라 ================= */
  // 효과는 플레이어 행동에 대한 대답일 때만 낸다(블록 점등 · 카세트 · 잡기 · 피격 · 복원). 개수는 FEEL의 상한까지만
  // 좌표는 미로 기준(px − MX)으로 저장한다 — 창 크기가 바뀌어도 도시에 붙어 있다
  function burst(x, y, n, colors, speed = 1, up = .2) {
    const count = Math.min(n, FEEL.particles - S.parts.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = (.25 + Math.random()) * speed;
      S.parts.push({ x:x - MX, y:y - MY, vx:Math.cos(a) * v, vy:Math.sin(a) * v - up, t:16 + Math.random() * 14, c:colors[i % colors.length], s:i % 5 ? 1 : 2 });
    }
  }
  function ring(x, y, c, r = 20, life = 24, dash = false) { if (S.rings.length < FEEL.rings) S.rings.push({ x:x - MX, y:y - MY, c, r, t:life, max:life, dash }); }
  function pop(text, x, y, c = C.white, big = false) { if (S.pops.length >= FEEL.pops) S.pops.shift(); S.pops.push({ text, x:x - MX, y:y - MY, c, t:52, big }); }
  // 가운데 띠 알림: 게임의 흐름이 바뀌는 순간에만(PLAYBACK). art = words.png 글자 이름
  function banner(title, sub, c, life = 90, art = null) { S.banner = { title, sub, c, t:0, max:life, art }; }
  function flash(t, col = C.white) { S.flash = Math.max(S.flash, t); S.flashCol = col; }
  function shake(t) { S.shake = Math.max(S.shake, t); }
  function freeze(t) { S.freeze = Math.max(S.freeze, t); }
  function age(items, step) { let n = 0; for (let i = 0; i < items.length; i++) { const p = items[i]; step(p); if (p.t > 0) items[n++] = p; } items.length = n; }
  // 세계가 멈춰도(Hit Stop · 일시정지 제외) 흐르는 것들
  function stepFx() {
    age(S.parts, p => { p.t--; p.x += p.vx; p.y += p.vy; p.vy += .015; p.vx *= .97; });
    age(S.rings, p => { p.t--; });
    age(S.pops, p => { p.t--; p.y -= p.t > 34 ? .45 : .1; });
    age(S.trail, p => { p.t--; });
    age(S.marks, p => { p.t--; });
    if (S.banner && ++S.banner.t >= S.banner.max) S.banner = null;
    for (const k of ['flash', 'shake', 'glitch', 'heartT', 'scoreFx', 'segFx', 'waveFx', 'muteFx', 'hudIn', 'bestFx']) if (S[k] > 0) S[k]--;
    S.displayScore += (S.score - S.displayScore) * .2; if (Math.abs(S.score - S.displayScore) < 1) S.displayScore = S.score;
  }

  /* ================= 불이 꺼지는 물결 ================= */
  // 한 점(x, y)에서 길을 따라 바깥으로 퍼지며 켜진 칸 · 블록이 차례로 꺼진다(화면에서만 — 실제 칸 상태는 그대로)
  // 마지막 하트를 잃을 때 · 타이틀 데모가 다시 시작할 때 · 타이틀에서 게임으로 들어갈 때. rate = 1프레임에 퍼지는 칸 수
  function lightsOut(x, y, rate) {
    const order = TILES.map(([tx, ty]) => Math.abs(tx - x) + Math.abs(ty - y));
    S.out = { x, y, t:0, rate, order, max:Math.max(...order) };
  }
  const outDone = () => S.out && S.out.t * S.out.rate > S.out.max + 8;
  /* ================= 입력: 방향키(또는 WASD) 네 개가 전부. 타이틀 · 결과 화면은 아무 키나 ================= */
  // 누른 방향은 기억했다가 다음 갈림길에서 꺾는다(누르고 있지 않아도 된다). 타이틀 · 결과에서 누른 방향키도 첫 이동으로 남는다
  const KEYS = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
  const QUIET = ['ShiftLeft', 'ShiftRight', 'Tab', 'CapsLock', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'Fn', 'KeyM'];
  function steer(dir) {
    if (!DV[dir]) return;
    if (mode === 'pause') { setMode('play'); sfx('select'); }
    if (mode === 'enter') enterDir = dir;
    if (mode === 'play' && S.hero) S.hero.want = dir;
  }
  // 아무 키 · 클릭 · 탭: 지금 화면에서 '다음으로'
  function press(dir) {
    if (!S) return;
    ensureAudio(); idleT = 0;
    if (mode === 'title') { beginEnter(dir); return; }
    if (mode === 'over') { if (S.overT >= BALANCE.overLock) { sfx('select'); startGame(true, dir); } return; }
    if (mode === 'pause') { setMode('play'); sfx('select'); }
    if (mode === 'play' && S.phase === 'clear' && S.phaseT >= clearSkipAt()) endClear();
    if (dir) steer(dir);
  }
  function togglePause() {
    if (mode === 'play') { setMode('pause'); sfx('pause'); }
    else if (mode === 'pause') { setMode('play'); sfx('select'); }
  }
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || !S) return; // 그림 · 글꼴을 불러오는 중엔 무시
    const dir = KEYS[e.code];
    if (dir || e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyM') { if (!e.repeat) { ensureAudio(); toggleMute(); } return; }
    if (e.repeat) { if (dir && mode === 'play') steer(dir); return; }
    if (QUIET.includes(e.code)) return;
    idleT = 0;
    if (mode === 'enter') { if (dir) steer(dir); return; }
    if (mode === 'over' && e.code === 'Escape') { if (S.overT >= BALANCE.overLock) { sfx('select'); enterTitle(); } return; }
    if (mode === 'title' && e.code === 'Escape') return;
    if (mode === 'title' || mode === 'over') { press(dir); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (mode === 'pause' || e.code === 'Enter' || e.code === 'Space') { press(dir); return; }
    if (dir) steer(dir);
  });
  // 마우스: 화면을 누르면 아무 키와 같다(게임 중엔 무시)
  cv.addEventListener('pointerup', e => { if (e.pointerType !== 'touch' && mode !== 'play') press(null); });
  // 휴대폰: 화면을 밀면 그 방향, 톡 누르면 아무 키
  let touch0 = null, touchMoved = false;
  addEventListener('touchstart', e => { const t = e.touches[0]; touch0 = { x:t.clientX, y:t.clientY }; touchMoved = false; ensureAudio(); }, { passive:true });
  addEventListener('touchmove', e => {
    if (!touch0) return; const t = e.touches[0], dx = t.clientX - touch0.x, dy = t.clientY - touch0.y;
    if (Math.hypot(dx, dy) < 24) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (mode === 'play' || mode === 'enter') steer(dir); else if (!touchMoved) press(dir);
    touchMoved = true; touch0 = { x:t.clientX, y:t.clientY };
  }, { passive:true });
  addEventListener('touchend', () => { if (touch0 && !touchMoved && mode !== 'play') press(null); touch0 = null; }, { passive:true });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('pause'); });
  addEventListener('blur', () => { if (mode === 'play') setMode('pause'); });

  let promptHover = false;
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    promptHover = Math.abs(x - W / 2) < 110 && y > H - 38;
  });
  cv.addEventListener('pointerleave', () => { promptHover = false; });
  /* ================= 칸 이동: 주인공과 드론이 함께 쓰는 길 따라 움직이기 ================= */
  // 위치는 칸 중심 좌표. 칸 한가운데(정수 좌표)에 닿을 때마다 decide()가 다음 방향을 고르고, arrive()가 그 칸에서 할 일을 한다
  // 주인공은 갈림길 조금 앞(CORNER칸)에서 미리 꺾을 수 있다 — Pac-Man의 모서리 미리 돌기처럼, 쫓기는 쪽이 모서리에서 거리를 번다
  const EPS = 1e-4;
  const atC = e => Math.abs(e.x - Math.round(e.x)) < EPS && Math.abs(e.y - Math.round(e.y)) < EPS;
  function nextCenter(e) {
    const [dx, dy] = DV[e.dir];
    return { x:dx > 0 ? Math.floor(e.x + EPS) + 1 : dx < 0 ? Math.ceil(e.x - EPS) - 1 : Math.round(e.x),
             y:dy > 0 ? Math.floor(e.y + EPS) + 1 : dy < 0 ? Math.ceil(e.y - EPS) - 1 : Math.round(e.y) };
  }
  // 터널: 미로 밖 한 칸에 닿으면 반대편 밖 한 칸으로 옮겨 그대로 들어온다(4구역은 위아래로도 이어진다)
  function wrap(e) {
    if (e.dir === 'left' && e.x <= -1 + EPS) { e.x = MW; sfxWarp(e); } else if (e.dir === 'right' && e.x >= MW - EPS) { e.x = -1; sfxWarp(e); }
    else if (e.dir === 'up' && e.y <= -1 + EPS) { e.y = MH; sfxWarp(e); } else if (e.dir === 'down' && e.y >= MH - EPS) { e.y = -1; sfxWarp(e); }
  }
  // 터널을 지나는 순간: 양쪽 입구에서 고리가 퍼진다(주인공만 소리)
  const sfxWarp = e => {
    if (!e.isHero) return;
    sfx('warp'); S.trail.length = 0; if (e.bike) e.bike.springV += 1.1; // 터널 입구 턱
    if (e.dir === 'left' || e.dir === 'right') {
      ring(px(MW), py(e.y), C.cyan, 16, 18); ring(px(-1), py(e.y), C.cyan, 16, 18);
      burst(px(e.x < 0 ? 0 : MW - 1), py(e.y), 8, [C.cyan, C.white], .9);
    } else {
      ring(px(e.x), py(MH), C.cyan, 16, 18); ring(px(e.x), py(-1), C.cyan, 16, 18);
      burst(px(e.x), py(e.y < 0 ? 0 : MH - 1), 8, [C.cyan, C.white], .9);
    }
  };
  // 갈 수 있는 방향들 (뒤로 돌기는 막다른 곳에서만)
  function options(e) {
    const x = Math.round(e.x), y = Math.round(e.y), o = DORDER.filter(d => isRoad(x + DV[d][0], y + DV[d][1]));
    const f = o.filter(d => d !== OPP[e.dir]); return f.length ? f : o;
  }
  // dist칸만큼 움직인다. 남은 거리를 돌려준다(막혀서 멈추면 0보다 크다)
  function move(e, dist, decide, arrive) {
    for (let n = 0; n < 8 && dist > EPS; n++) {
      if (atC(e)) {
        e.x = Math.round(e.x); e.y = Math.round(e.y);
        decide(e);
        if (!e.dir || !isRoad(e.x + DV[e.dir][0], e.y + DV[e.dir][1])) { e.moving = false; return dist; }
      }
      e.moving = true;
      const c = nextCenter(e), rem = Math.abs(c.x - e.x) + Math.abs(c.y - e.y);
      if (e.isHero && e.want !== e.dir && e.want !== OPP[e.dir] && rem <= CORNER && isRoad(c.x + DV[e.want][0], c.y + DV[e.want][1])) {
        e.x = c.x; e.y = c.y; arrive(e); continue; // 모서리 미리 돌기: 중심으로 당겨 붙이고 다음 바퀴에서 꺾는다
      }
      const m = Math.min(dist, rem);
      e.x += DV[e.dir][0] * m; e.y += DV[e.dir][1] * m; dist -= m;
      if (rem - m < EPS) { e.x = c.x; e.y = c.y; wrap(e); arrive(e); }
    }
    return dist;
  }
  // 목표 칸에 가장 가까워지는 방향 (Pac-Man 유령과 같은 규칙: 갈림길마다 직선거리만 본다)
  function toward(e, tx, ty) {
    const x = Math.round(e.x), y = Math.round(e.y);
    let best = null, bd = Infinity;
    for (const d of options(e)) { const nx = x + DV[d][0], ny = y + DV[d][1], dd = (nx - tx) ** 2 + (ny - ty) ** 2; if (dd < bd) { bd = dd; best = d; } }
    return best;
  }
  /* ================= 주인공: 브라운관 전조등을 단 바이크로 지나간 칸을 과거의 색으로 켠다 ================= */
  function decideHero(h) {
    const prev = h.dir;
    if (h.want && isRoad(h.x + DV[h.want][0], h.y + DV[h.want][1])) h.dir = h.want;
    if (prev !== h.dir) turned(h, prev);
  }
  // 꺾는 순간: 바퀴 밑 불꽃 · 꺾는 쪽으로 기울었다 펴짐 · 모서리에 고무 자국 · 작은 마찰음 (선입력이 실제로 먹혔다는 손맛)
  // 앞 · 뒷모습에선 기울기가 보이고(앞모습은 좌우가 거울이라 반대로), 옆모습에선 스프링이 받는다
  function turned(h, prev) {
    h.turn = 6;
    const b = h.bike, x = px(h.x), y = py(h.y);
    if (prev && prev !== OPP[h.dir]) {
      const [ax, ay] = DV[prev], [bx, by] = DV[h.dir];
      if (h.dir === 'up' || h.dir === 'down') b.bank = (ax * by - ay * bx) * (h.dir === 'down' ? -.3 : .3);
      b.springV += .9;
      skidMark(x - ax * 5, y - ay * 5, x, y, 110); skidMark(x, y, x + bx * 4, y + by * 4, 110);
    } else if (prev) { b.brake = Math.max(b.brake, 8); skidMark(x - 3, y, x + 3, y, 90); }
    burst(x, y + 3, 4, [S.playback > 0 || S.ff > 0 ? C.pink : C.cyan, C.white], .55, .1);
    sfx('turn');
  }
  function arriveHero(h) {
    // B-SIDE는 켜야 할 칸이 아닌 골목 안에도 있다
    const b = S.bside;
    if (b && !b.got && bsideShown() && b.x === h.x && b.y === h.y) takeBside();
    const k = tid(h.x, h.y); if (k < 0) return;
    if (!S.lit[k]) { lightTile(k); S.streak = Math.min(S.streak + 1, 40); S.streakT = 0; }
    const c = S.cas.find(c => !c.got && c.x === h.x && c.y === h.y);
    if (c) takeCassette(c);
  }
  function heroStep() {
    const h = S.hero, cfg = stageCfg(S.stage);
    if (h.inv > 0) h.inv--;
    if (h.turn > 0) h.turn--;
    if (++S.streakT > 30) S.streak = 0;
    // 반대 방향은 언제든 바로 돌아선다
    if (h.dir && h.want === OPP[h.dir]) { const prev = h.dir; h.dir = h.want; turned(h, prev); }
    const sp = cfg.hero * (S.playback > 0 ? BALANCE.playbackSpeed : 1) * (S.ff > 0 ? GIMMICK.ff.speed : 1);
    const was = h.moving, left = move(h, sp, decideHero, arriveHero);
    h.walk += sp - left;
    stepBike(h, sp - left);
    // 출발(GO · 벽 앞에서 다시 갈 때) · 벽에 막혀 멈춘 순간(먼지 = 어디로도 못 간다는 신호)
    if (!was && h.moving) bikeGo(h, S.phaseT < 3 ? 1 : .55);
    if (was && !h.moving && h.dir) { bikeStop(h); burst(px(h.x) + DV[h.dir][0] * 5, py(h.y) + DV[h.dir][1] * 5 + 2, 3, [C.mist], .3, .05); }
    // PLAYBACK · 빨리 감기 동안: 지나온 자리에 분홍 잔상(테이프가 지난 장면을 다시 틀듯). 빨리 감기는 더 촘촘하게
    if ((S.playback > 0 || S.ff > 0) && h.moving && S.anim % (S.ff > 0 ? 2 : 4) === 0) {
      if (S.trail.length >= FEEL.trail) S.trail.shift();
      S.trail.push({ x:h.x, y:h.y, dir:h.dir, f:Math.floor(h.walk * 5) % 4, t:18, max:18 });
    }
    // 지나온 길 기록: ◀◀ 되감기는 최근 몇 초를, 4구역의 '과거의 나'는 구역 처음 20초를 다시 걷는다
    const G = GIMMICK;
    if (S.stageT % G.rew.step === 0) { S.hist.push([h.x, h.y, h.dir]); if (S.hist.length > G.rew.keep / G.rew.step) S.hist.shift(); }
    if (S.stageT % G.ghost.step === 0 && S.stageT < G.ghost.rec) S.rec.push([h.x, h.y, h.dir, h.moving]);
  }
  // 선입력 표시: 지금 가는 방향으로 앞으로 가다 처음 원하는 쪽이 열리는 갈림길(BALANCE.turnLook칸 안). 없으면 null
  function turnAhead(h) {
    if (!h.want || !h.dir || h.want === h.dir || h.want === OPP[h.dir]) return null;
    let x = Math.round(h.x), y = Math.round(h.y);
    const [dx, dy] = DV[h.dir], [wx, wy] = DV[h.want];
    // 이미 칸 가운데를 지났으면 다음 칸부터 본다
    if ((h.x - x) * dx + (h.y - y) * dy > EPS) { x += dx; y += dy; }
    for (let i = 0; i < BALANCE.turnLook; i++) {
      if (!isRoad(x, y)) return null;
      if (isRoad(x + wx, y + wy)) return { x, y };
      x += dx; y += dy;
    }
    return null;
  }

  /* ================= 바이크 몸짓: 그림만 움직인다(판정 · 속도 · 길은 그대로) ================= */
  // 바퀴는 실제로 간 거리로 돈다(터널을 건너뛴 좌표 차이가 아니라). 출발 · 멈춤 · 꺾기 · 선로 턱 · 착지마다 몸이 반응하고 스프링이 받는다
  // 미로 게임이라 점프는 없다. 그 자리를 선로 턱을 넘는 작은 뜀과 다시 나올 때 떨어져 내려앉는 착지가 맡는다
  const LAUNCH = 22, BRAKE = 14, RAIL_Y = [WARP_Y - .25, WARP_Y + 1 / 6];
  function makeBike() { return { speed:0, wheel:0, pitch:0, lean:0, spring:0, springV:0, bank:0, air:0, airV:0, launch:0, brake:0, idle:0, impact:0, face:-1, trail:[], py:0 }; }
  function stepBike(h, dist) {
    const b = h.bike, v = Math.max(0, dist);
    b.speed += (v - b.speed) * .2;
    b.wheel += v * T;
    if (h.dir === 'left' || h.dir === 'right') b.face = h.dir === 'left' ? -1 : 1;
    b.idle = v > 0 ? 0 : b.idle + 1;
    if (b.launch > 0) b.launch--;
    if (b.brake > 0) b.brake--;
    // 몸: 출발엔 뒤로 쏠리며 앞바퀴가 들리고, 제동엔 앞으로 쏠리며 앞이 눌린다. ▶▶ 동안엔 엎드린다
    const L = b.launch / LAUNCH, B = b.brake / BRAKE, tuck = S.ff > 0 && v > 0 ? .9 : 0;
    b.pitch += (-.14 * L * L + .08 * B - b.pitch) * .3;
    b.lean += (1.6 * L - 1.3 * B - tuck - b.lean) * .25;
    b.bank *= .82;
    // 스프링: 제자리로 돌아오려는 힘과 감쇠
    b.springV = (b.springV - b.spring * .3) * .7;
    b.spring = clamp(b.spring + b.springV, -2, 3);
    // 공중(선로 턱 · 착지): 중력으로 떨어지고, 닿는 순간 그 속도만큼 눌린다
    if (b.air < 0 || b.airV < 0) {
      b.airV += .34; b.air += b.airV;
      if (b.air >= 0) { const hitV = b.airV; b.air = b.airV = 0; b.springV += hitV * .7; if (hitV > 2.5) bikeLand(h); }
    }
    // 선로 두 줄을 세로로 넘을 때마다 바퀴가 턱에 걸려 살짝 뜬다(터널로 건너뛴 순간은 빼고)
    if (S.D && S.D.train && v > 0 && (h.dir === 'up' || h.dir === 'down') && Math.abs(h.y - b.py) < .5)
      for (const ry of RAIL_Y) if ((b.py - ry) * (h.y - ry) < 0) { b.airV = Math.min(b.airV, -1.1); b.springV += .8; sfx('clack'); }
    b.py = h.y;
    // 빛 꼬리: 꼬리등이 지나간 자리. 빠를수록 길고, 서 있으면 줄어든다
    const max = S.ff > 0 ? 26 : S.playback > 0 ? 18 : 12;
    if (v > 0) { b.trail.push([h.x, h.y]); while (b.trail.length > max) b.trail.shift(); }
    else if (b.trail.length) b.trail.shift();
  }
  // 출발: 뒷바퀴가 미끄러지며 앞이 들린다. 멈춤: 앞이 눌리고 짧은 스키드 자국
  function bikeGo(h, k = 1) {
    const b = h.bike; b.launch = Math.round(LAUNCH * k); b.springV -= .6 * k;
    const [dx, dy] = DV[h.dir], x = px(h.x), y = py(h.y);
    burst(x - dx * 12, y - dy * 12 + 4, Math.round(5 * k), [C.mist, C.dim], .5, .08);
    skidMark(x - dx * 4, y - dy * 4, x - dx * 13, y - dy * 13);
    if (k >= 1) sfx('rev');
  }
  function bikeStop(h) {
    const b = h.bike; b.brake = BRAKE; b.springV += 1.4;
    const [dx, dy] = DV[h.dir], x = px(h.x), y = py(h.y);
    skidMark(x - dx * 2, y - dy * 2, x - dx * 10, y - dy * 10);
    sfx('skid');
  }
  function bikeLand(h) {
    const x = px(h.x), y = py(h.y) + RIDER_GROUND;
    burst(x - 9, y, 3, [C.mist, C.dim], .45, .05); burst(x + 9, y, 3, [C.mist, C.dim], .45, .05);
    ring(x, y, C.mist, 14, 14); shake(3); sfx('land');
  }
  // 바닥 자국(그림만): 고무 자국이 길 위에 남았다 천천히 사라진다
  function skidMark(x0, y0, x1, y1, life = 150) {
    if (S.marks.length >= 24) S.marks.shift();
    S.marks.push({ x0:x0 - MX, y0:y0 - MY, x1:x1 - MX, y1:y1 - MY, t:life, max:life });
  }
  // 쓰러지는 동안: 차체가 미끄러지는 자리에 불꽃
  function crashStep() {
    const h = S.hero, t = S.phaseT; if (t > 22 || t % 2 || FEEL.reduced) return;
    const [dx, dy] = DV[h.dir || 'right'], k = easeOut(clamp(t / 24)) * 9 * (h.bike.impact || 1);
    burst(px(h.x) + dx * k, py(h.y) + dy * k + 4, 2, [C.yellow, C.white], .9, .25);
  }
  /* ================= 순찰 드론: 멈춘 미래의 감시자 ================= */
  // A1 추격: 주인공 칸을 곧장 노린다 · A2 매복: 주인공이 가는 방향 4칸 앞을 노린다 · A3 변덕: 멀면 쫓고 가까우면 제 구석으로 물러난다
  // B 지우개: 켜진 칸이 많은 쪽으로 다니며 지나간 칸을 다시 회색으로 돌린다 (Crush Roller에서 칠한 길을 더럽히는 침입자처럼)
  // 각 드론은 흩어짐(PATROL) 동안 자기 구석으로 간다 — 4가지 성격을 나눠 둔 건 Pac-Man처럼 너무 어렵거나 지루하지 않게 하려는 것
  const SCATTER = { A1:CORNERS.tr, A2:CORNERS.tl, A3:CORNERS.bl, B:CORNERS.br };
  // 탐조등에 들키면(S.alarm) 흩어짐 중이어도 모두 주인공을 쫓는다
  function droneTarget(d) {
    const h = S.hero, hx = Math.round(h.x), hy = Math.round(h.y);
    if (!S.chase && !(S.alarm > 0)) return SCATTER[d.kind];
    if (d.kind === 'A2') { const v = DV[h.dir || 'left']; return { x:hx + v[0] * 4, y:hy + v[1] * 4 }; }
    if (d.kind === 'A3') return Math.hypot(d.x - h.x, d.y - h.y) > 8 ? { x:hx, y:hy } : SCATTER.A3;
    return { x:hx, y:hy };
  }
  // 그 방향으로 곧게 n칸 안에 켜진 칸이 몇 개인가
  function litAhead(x, y, d, n = 7) {
    let c = 0;
    for (let i = 1; i <= n; i++) { x += DV[d][0]; y += DV[d][1]; const k = tid(x, y); if (k < 0) break; c += S.lit[k]; }
    return c;
  }
  // 정전(3구역) 동안엔 신호를 잃고 갈림길마다 아무 쪽으로나 간다
  const lost = () => S.dark && S.dark.phase === 'dark';
  function decideDrone(d) {
    const o = options(d);
    if (d.static || lost() || (d.kind === 'B' && Math.random() < .2)) { d.dir = o[Math.floor(Math.random() * o.length)]; return; }
    if (d.kind === 'B') {
      let best = -1, pick = [];
      for (const dir of o) { const n = litAhead(Math.round(d.x), Math.round(d.y), dir); if (n > best) { best = n; pick = [dir]; } else if (n === best) pick.push(dir); }
      d.dir = best > 0 ? pick[Math.floor(Math.random() * pick.length)] : toward(d, S.hero.x, S.hero.y);
      return;
    }
    const t = droneTarget(d); d.dir = toward(d, t.x, t.y) || d.dir;
  }
  function arriveDrone(d) {
    if (d.kind !== 'B' || d.static) return;
    const k = tid(d.x, d.y);
    if (k >= 0 && S.lit[k]) { eraseTile(k); burst(px(d.x), py(d.y), 3, [C.pink, C.mist], .5); if (S.anim % 3 === 0) sfx('erase'); }
  }
  // 기지(원형 구조물 가운데)에서 기다리는 자리
  const homePos = i => ({ x:BASE.x + (i - (S.drones.length - 1) / 2) * 1.6, y:BASE.y + Math.sin(S.anim / 20 + i) * .25 });
  function droneStep(d, i) {
    const cfg = stageCfg(S.stage);
    d.frame++;
    if (d.state === 'home') {
      if (++d.t >= 0) { d.state = 'exit'; d.t = 0; const p = homePos(i); d.hx = p.x; d.hy = p.y; sfx('exit'); }
      return;
    }
    if (d.state === 'exit') {
      const k = Math.min(1, ++d.t / BALANCE.droneExit), e = ease(k);
      d.x = d.hx + (GATE.x - d.hx) * e; d.y = d.hy + (GATE.y - d.hy) * k;
      if (k >= 1) {
        // 카세트가 재생 중이면 나오자마자 멈춘다(PLAYBACK 규칙은 모든 드론에 같다)
        d.state = 'run'; d.x = GATE.x; d.y = GATE.y; d.static = S.playback > 0;
        const t = droneTarget(d); d.dir = t.x < GATE.x ? 'left' : 'right';
        ring(px(d.x), py(d.y), d.static ? C.mist : C.red, 14, 20);
      }
      return;
    }
    if (d.state === 'back') {
      // 되감긴 드론: 테이프 노이즈가 되어 기지로 곧장 빨려 들어간다
      const dx = BASE.x - d.x, dy = BASE.y - d.y, dist = Math.hypot(dx, dy), v = BALANCE.droneReturn;
      if (dist < v) { d.state = 'home'; d.t = -BALANCE.returnWait; d.static = false; d.x = BASE.x; d.y = BASE.y; return; }
      d.x += dx / dist * Math.min(dist, v); d.y += dy / dist * Math.min(dist, v);
      return;
    }
    const sp = (d.kind === 'B' ? cfg.eraser : cfg.drone) * (d.static ? BALANCE.disabledDrone : 1) * (lost() ? GIMMICK.dark.drone : 1);
    move(d, sp, decideDrone, arriveDrone);
  }
  // 곧 기지를 떠날 드론이 있나(출구가 빨갛게 깜빡이는 예고)
  const exitSoon = () => S.drones.some(d => d.state === 'home' && d.t > -BALANCE.exitWarn);
  // 드론이 실제로 있는 곳(기지에서 기다리는 중이면 기지 안의 자리)
  function dronePos(d, i) { return d.state === 'home' ? homePos(i) : { x:d.x, y:d.y }; }
  /* ================= 칸 · 블록: 지나간 칸마다 과거가 켜진다 ================= */
  function lightTile(k, silent) {
    if (k < 0 || S.lit[k]) return;
    S.lit[k] = 1; S.litT[k] = S.anim; S.litN++; S.peakLit = Math.max(S.peakLit, S.litN);
    if (!silent) { S.score += PT.tile; sfx('tick', S.streak); } // 칸이 하얗게 한 번 번쩍이는 것은 drawRoads가 그린다
    checkBlocks(k, silent);
  }
  function eraseTile(k) {
    if (k < 0 || !S.lit[k] || S.closed[k]) return; // 통제선 안쪽 칸은 꺼지지 않는다(닿을 수 없는 칸이 꺼지면 구역을 끝낼 수 없다)
    S.lit[k] = 0; S.eraseT[k] = S.anim; S.litN--;
    checkBlocks(k);
  }
  const blockC = b => [MX + (b.x + b.w / 2) * T, MY + (b.y + b.h / 2) * T];
  // 둘레가 모두 켜지면 블록이 브라운관처럼 켜지고(가운데 한 줄 → 위아래로 열림), 둘레가 하나라도 꺼지면 다시 꺼진다 (Amidar처럼 둘러싸면 채워진다)
  function checkBlocks(k, silent) {
    for (const bi of TBLOCKS[k]) {
      const b = BLOCKS[bi], st = S.blocks[bi], all = b.edge.every(e => S.lit[e]);
      if (all && !st.on) {
        st.on = true; st.t = S.anim;
        if (!silent && S.phase === 'run') {
          const pts = PT.block * b.cells, [x, y] = blockC(b);
          S.score += pts; S.scoreFx = 16; pop('+' + pts, x, y - 4, C.cyan, true); sfx('block');
          ring(x, y, C.cyan, Math.max(b.w, b.h) * T * .6, 30); burst(x, y, 8, [C.cyan, C.lav, C.white], 1);
        }
      } else if (!all && st.on) {
        st.on = false; st.off = S.anim;
        if (S.phase === 'run') { const [x, y] = blockC(b); sfx('blockoff'); burst(x, y, 6, [C.mist, C.dim], .7); }
      }
    }
  }

  /* ================= 카세트: 과거를 재생하는 동안 미래의 드론은 회색으로 멈춘다 ================= */
  // Pac-Man의 파워 쿠키 · Amidar의 네 모서리 보너스에서 가져온 반전의 순간. 멈춘 드론에 부딪히면 테이프처럼 기지로 되감긴다
  // 줍는 순간: Hit Stop → 분홍 번쩍 · 고리 → PLAYBACK 글자 → 미로 테두리 · 주인공이 분홍으로 바뀌고 잔상, 음악 멜로디가 열린다
  // 2구역부터 테이프 위의 표시가 셋으로 나뉜다. 늘 정답인 테이프는 없다:
  //   ▶ PLAY  드론이 멈추고 잡을 수 있다 — 드론이 가까이 몰려 있을 때(점수 · 안전)
  //   ▶▶ FF   잠깐 빨라진다 — 남은 칸이 멀리 흩어졌을 때, 셔터가 닫히기 전 · 탐조등 사이를 지나갈 때(드론은 그대로 위험하다)
  //   ◀◀ REW  드론이 모두 기지로 되감기고, 최근에 지나온 길에서 꺼진 칸이 다시 켜진다 — 지우개 드론 · 피격으로 길이 많이 꺼졌을 때(잡기 점수는 없다)
  function takeCassette(c) {
    c.got = true; S.score += PT.cas; S.collected++;
    freeze(FEEL.freezeCassette); flash(5, C.pink);
    const x = px(c.x), y = py(c.y);
    ring(x, y, C.pink, 56, 36); ring(x, y, C.white, 20, 16); burst(x, y, 14, [C.pink, C.white], 1.4);
    if (c.kind === 'ff') { S.ff = S.ffMax = GIMMICK.ff.len; S.view.kick = 12; sfx('ff'); banner('FAST FORWARD', K.ff, C.pink, 90); return; }
    if (c.kind === 'rew') { rewind(); sfx('rew'); banner('REWIND', K.rew, C.pink, 100); return; }
    const cfg = stageCfg(S.stage);
    S.playback = S.playMax = cfg.playback; S.chain = 0;
    for (const d of S.drones) if (d.state === 'run') { d.static = true; d.near = false; if (d.dir) d.dir = OPP[d.dir]; }
    sfx('cas');
    banner('PLAYBACK', K.playback, C.pink, 100, 'playback');
  }
  function catchDrone(d) {
    d.state = 'back'; d.static = false; d.near = false; S.chain++; S.rewound++;
    const n = Math.min(S.chain, 4), pts = PT.catch[n - 1]; S.score += pts; S.scoreFx = 16;
    pop(String(pts), px(d.x), py(d.y) - 10, n >= 3 ? C.white : C.pink, n >= 2);
    sfx('catch', n - 1); freeze(FEEL.freezeCatch); shake(FEEL.shakeCatch);
    ring(px(d.x), py(d.y), C.pink, 24, 22); burst(px(d.x), py(d.y), 14, [C.pink, C.white, C.cyan], 1.3);
  }
  function endPlayback() {
    for (const d of S.drones) { d.static = false; d.near = false; }
    S.hero.inv = Math.max(S.hero.inv, BALANCE.playbackGrace); S.fadeT = 90;
    sfx('powerdown'); ring(px(S.hero.x), py(S.hero.y), C.mist, 20, 18);
  }

  /* ================= 피격: 신호가 끊기고, 그 자리 칸이 다시 회색으로 ================= */
  // Hit Stop(맞은 순간이 그대로 보인다) → 빨간 번쩍 · 짧은 화면 찢김(신호가 끊김) · 충격 고리 → 주변 칸이 안쪽부터 바깥으로 꺼짐 → HUD 하트가 깨진다
  // 마지막 하트면 phase 'lost': 맞은 자리에서부터 도시 전체의 불이 꺼진 뒤 결과 화면
  function hit(drone) {
    if (S.phase !== 'run') return;
    const h = S.hero, k0 = tid(Math.round(h.x), Math.round(h.y));
    S.hp--; S.hitThisStage = true; S.phaseT = 0; S.trail.length = 0; S.banner = null; S.slow = 0;
    const train = drone.kind === 'train', eraser = drone.kind === 'B';
    h.bike.impact = train ? 1.6 : 1;
    S.lastHit = { kind:drone.kind, x:h.x, y:h.y, fade:S.fadeT > 0 && !train };
    S.heartFx = S.hp; S.heartT = 48;
    // 부딪힌 것마다 반응이 다르다: 순찰 드론 = 불꽃 · 지우개 드론 = 분홍 잡음(신호가 지워진다) · 열차 = 더 긴 정지 · 큰 흔들림 · 차체 조각
    freeze(FEEL.freezeHit + (train ? 6 : 0)); shake(FEEL.shakeHit + (train ? 8 : 0)); flash(8, eraser ? C.pink : C.red); S.glitch = eraser ? 14 : 8;
    const x = px(h.x), y = py(h.y);
    ring(x, y, eraser ? C.pink : C.red, train ? 56 : 40, 32); ring(x, y, C.white, 16, 16);
    burst(x, y, train ? 28 : 18, eraser ? [C.pink, C.white, C.rose] : [C.yellow, C.white, C.red], train ? 2.2 : 1.6);
    burst(x, y - 4, train ? 10 : 5, [C.cyan, '#2a9fc0', C.paper], train ? 1.8 : 1.1, .6); // 차체 조각
    burst(x, y + 2, 8, [C.mist, C.dim], .9);
    // 길을 따라 2칸 안의 켜진 칸을 끈다(뒷면 특징 03). 화면에선 Hit Stop이 끝난 뒤 가까운 칸부터 차례로 꺼진다
    if (k0 >= 0) {
      let front = [k0]; const seen = new Set(front);
      for (let r = 0; r <= 2; r++) {
        const nxt = [];
        for (const k of front) {
          if (S.lit[k]) { eraseTile(k); S.eraseT[k] = S.anim + r * 4; }
          const [x, y] = TILES[k];
          for (const d of DORDER) { const n = tid(x + DV[d][0], y + DV[d][1]); if (n >= 0 && !seen.has(n)) { seen.add(n); nxt.push(n); } }
        }
        front = nxt;
      }
      if (S.lit[tid(START.x, START.y)] === 0) lightTile(tid(START.x, START.y), true);
    }
    sfx('hit');
    if (S.hp > 0) { S.phase = 'dead'; return; }
    S.phase = 'lost'; music.stop(true); sfx('lost');
    lightsOut(Math.round(h.x), Math.round(h.y), 1 / 1.2);
  }
  function afterHit() {
    placeActors(BALANCE.respawnReady); S.hero.inv = INV_T;
  }

  /* ================= 구역 복원 ================= */
  function stageClear() {
    S.phase = 'clear'; S.phaseT = 0; S.playback = 0; S.trail.length = 0; S.banner = null; S.cleared++;
    S.ff = 0; S.rew = 0; S.alarm = 0; S.dark = null; S.ghost = null; S.trains.length = 0; S.pa = null; S.paQ.length = 0;
    for (const d of S.drones) d.static = false;
    const bonus = PT.clear * S.stage; S.score += bonus; S.bonus = [['CLEAR BONUS', bonus]];
    S.perfect = !S.hitThisStage;
    if (S.perfect) { S.score += PT.perfect; S.bonus.push(['PERFECT', PT.perfect]); sfx('perfect'); }
    S.live = concertReady(); // IDIOTAPE: 오지 않던 순환선 개통 공연(js/events.js)
    // 복원 물결: 주인공 자리에서부터 칸마다 번쩍임이 퍼져 나간다
    const h = S.hero; S.clearOrder = TILES.map(([x, y]) => Math.abs(x - h.x) + Math.abs(y - h.y));
    // 아직 꺼져 있는 블록이 있으면(드론이 막 지운 둘레 등) 물결이 닿는 순서대로 마저 켠다
    BLOCKS.forEach((b, i) => { const st = S.blocks[i]; if (!st.on) { st.on = true; st.t = S.anim + Math.round((Math.abs(b.x + b.w / 2 - h.x) + Math.abs(b.y + b.h / 2 - h.y)) / .7); } });
    freeze(FEEL.freezeClear); flash(8);
    ring(px(h.x), py(h.y), C.cyan, 90, 44); ring(px(h.x), py(h.y), C.white, 40, 26); burst(px(h.x), py(h.y), 20, [C.cyan, C.lav, C.white], 1.8);
    sfx('clear');
  }
  const clearEnd = () => CLEAR_T + (S.live ? LIVE_T : 0);
  // 키로 넘기기: 마무리(화면이 어두워지는 부분)로 바로 건너뛴다. 공연이 열리는 판은 공연이 시작되고 2초 뒤부터
  const clearSkipAt = () => S.live ? LIVE_AT + 120 : BALANCE.clearSkip;
  function endClear() { S.phaseT = Math.max(S.phaseT, clearEnd() - UI.fadeOut); }
  function nextStage() {
    S.stage++; resetCity(); setupDistrict(); placeActors(READY_T);
    S.lapIn = lapOf(S.stage) > 0 && (S.stage - 1) % DISTRICTS.length === 0; // 4구역을 돌고 처음 구역으로 돌아왔다(루프가 한 바퀴)
    S.boot = S.bootMax = UI.fadeIn;
  }

  /* ================= 흩어짐 ↔ 추격 물결 ================= */
  // 카세트가 재생되는 동안은 시계가 멈춘다. 추격 1초 전부터 드론 눈이 깜빡이고, 바뀌는 순간 드론이 모두 방향을 뒤집는다(글 알림 없이 드론과 소리로)
  function waveStep() {
    if (S.playback > 0) return;
    const w = stageCfg(S.stage).waves;
    if (S.waveI >= w.length) { S.chase = true; return; }
    if (!S.chase && w[S.waveI] - S.waveT === BALANCE.waveWarn) S.waveWarn = BALANCE.waveWarn;
    if (S.waveWarn > 0 && --S.waveWarn % 15 === 0) sfx('warnwave');
    if (++S.waveT >= w[S.waveI]) {
      S.waveT = 0; S.waveI++; S.chase = !S.chase; S.waveWarn = 0;
      for (const d of S.drones) if (d.state === 'run' && d.dir) d.dir = OPP[d.dir];
      S.waveFx = 42;
      sfx(S.chase ? 'chase' : 'patrol');
    }
  }
  // 지금 물결이 얼마나 지났나(0~1) — HUD의 위협 막대
  const waveK = () => { const w = stageCfg(S.stage).waves; return S.waveI >= w.length ? 1 : S.waveT / w[S.waveI]; };

  /* ================= 부딪힘 · 아슬아슬 ================= */
  function collide() {
    const h = S.hero;
    for (const d of S.drones) {
      if (d.state !== 'run' || S.phase !== 'run') continue;
      let dx = Math.abs(d.x - h.x), dy = Math.abs(d.y - h.y);
      if (dx > MW / 2) dx = MW + 1 - dx; if (dy > MH / 2 && WARP.cols.size) dy = MH + 1 - dy; // 터널 · 가장자리 건너편끼리
      const dist = Math.hypot(dx, dy);
      if (dist < HIT_R) { if (d.static) catchDrone(d); else if (h.inv <= 0) hit(d); continue; }
      // Pac-Man CE DX처럼 드론이 바짝 다가오면 잠깐 느려지고(빠져나갈 마지막 기회), 닿지 않고 멀어지면 CLOSE! 점수
      if (!d.static && h.inv <= 0 && dist < CLOSE_R && !d.near) { d.near = true; S.slow = 14; }
      if (d.near && dist > CLOSE_R + .35) {
        d.near = false; S.score += PT.close; S.closes++;
        pop('CLOSE!', px(h.x), py(h.y) - 24, C.yellow); ring(px(h.x), py(h.y), C.yellow, 18, 16, true); sfx('close');
      }
    }
  }
  /* ================= 도시 기계: 셔터 · 골목 · 열차 ================= */
  // 어디에 무엇이 있는지는 js/districts.js, 길이 · 속도는 tuning.js의 GIMMICK. 길을 막고 여는 건 모두 maze.js의 BLOCK · OPEN 층으로 한다
  // 기계는 주인공과 드론을 똑같이 대한다: 닫힌 셔터는 드론도 막고, 열린 골목은 드론도 지나가고, 열차는 드론도 쓸어 간다
  const cellAt = (x, y) => y * MW + x;
  // 누가 그 칸에 있거나 그 칸으로 들어오는 중인가. 셔터 · 골목 문은 주인공이나 드론 위로 닫히지 않는다(갇히지 않게)
  function occupied(x, y) {
    const on = e => Math.abs(e.x - x) + Math.abs(e.y - y) < 1 - EPS;
    return on(S.hero) || S.drones.some(d => d.state === 'run' && on(d));
  }

  /* ================= 구역 준비 ================= */
  // 타이틀 데모 · 새 구역 직전: 길을 처음 배치로 되돌린다
  function resetDistrict() {
    BLOCK.fill(0); OPEN.fill(0); WARP.rows = new Set([WARP_Y]); WARP.cols = new Set();
    S.D = null; S.stageT = 0; S.beats = []; S.beatsDone = []; S.closed.fill(0); S.tone = null; S.lapIn = false;
    S.trains = []; S.trainNext = -1; S.trainDir = 1; S.shut = []; S.alleys = []; S.lights = []; S.alarm = 0; S.alarmCool = 0; S.dark = null;
    S.ff = 0; S.rew = 0; S.rewPath = null; S.hist = []; S.rec = []; S.ghost = null; S.bside = null; S.pa = null; S.paQ = []; S.last = false;
  }
  // 구역 표대로 기계 · 테이프 · B-SIDE를 놓는다. 통제선 안쪽 칸은 처음부터 켜진 것으로 친다(닿을 수 없는 칸이 남아 구역을 못 끝내지 않게)
  function setupDistrict() {
    const D = S.D = districtOf(S.stage), lap = lapOf(S.stage);
    if (D.warps) { WARP.rows = new Set(D.warps.rows); WARP.cols = new Set(D.warps.cols); }
    // 돌아온 도시(5구역부터): 같은 구역이지만 도시가 좌우로 뒤집히고(render/city.js) 밤 톤이 보랏빛 회색으로 바뀌고, 30%에 매번 과거의 내가 나타난다
    S.beats = lap > 0 && !D.beats.some(b => b.do === 'ghost') ? [...D.beats, { p:.3, do:'ghost' }] : D.beats;
    S.tone = lap > 0 ? D.lapTone || '#9a96ab' : D.tone;
    S.cas.forEach((c, i) => { c.kind = D.tapes[i]; });
    const sh = (x, y, o) => ({ x, y, closed:false, t:-999, warn:false, jam:false, ...o });
    S.shut = [...(D.shutters || []).map(([x, y, delay]) => sh(x, y, { cycle:true, delay })),
              ...(D.closing || []).map(([x, y], i) => sh(x, y, { cycle:false, i, closeAt:Infinity, openAt:Infinity }))];
    S.alleys = (D.alleys || []).map(([x, y0, y1]) => ({ x, y0, y1, open:false, at:-1, k:0,
      bi:BLOCKS.findIndex(b => x >= b.x && x < b.x + b.w && y0 >= b.y && y0 < b.y + b.h) }));
    S.lights = (D.lights || []).map(l => ({ row:l.row, x:l.x, y:l.row, dir:l.dir, spot:0, hold:0 }));
    for (const [x, y] of D.closed || []) { const k = tid(x, y); S.closed[k] = 1; BLOCK[cellAt(x, y)] = 1; lightTile(k, true); }
    if (D.bside === 'ghost') S.bside = { x:0, y:0, got:false, shown:false, ghost:true };
    else if (D.bside) {
      const [x, y] = D.bside;
      S.bside = { x, y, got:false, shown:true, alley:S.alleys.find(a => a.x === x && y >= a.y0 && y <= a.y1) || null };
    }
  }
  function machineStep() { shutterStep(); alleyStep(); }

  /* ================= 셔터 ================= */
  // 주기 셔터: delay에 처음 닫히고, 그 뒤로 닫힘(shut) → 열림(open)을 되풀이한다. 닫히기 warn 전부터 노랗게 깜빡인다(노랑 = 곧)
  // 한꺼번에 닫히는 셔터(2구역 폐점): beats가 closeAt · openAt을 정한다
  // 닫힐 차례인데 누가 서 있으면 걸려서 덜컹거리며 기다린다(노란 불꽃)
  function shutterStep() {
    const G = GIMMICK.shutter, cyc = G.open + G.shut;
    for (const s of S.shut) {
      let want, until;
      if (s.cycle) {
        const ph = S.stageT - s.delay;
        want = ph >= 0 && mod(ph, cyc) < G.shut; until = ph < 0 ? -ph : cyc - mod(ph, cyc);
      } else { want = S.stageT >= s.closeAt && S.stageT < s.openAt; until = s.closeAt - S.stageT; }
      s.warn = !s.closed && !want && until <= G.warn;
      if (s.warn && s.cycle) announce('shutter', K.paShutter);
      if (want && !s.closed) {
        if (occupied(s.x, s.y)) {
          if (!s.jam) sfx('jam');
          s.jam = true; if (S.anim % 6 === 0) burst(px(s.x), py(s.y), 2, [C.yellow, C.white], .5);
        } else { s.closed = true; s.jam = false; s.t = S.anim; BLOCK[cellAt(s.x, s.y)] = 1; sfx('shutter'); }
      } else if (!want && s.closed) { s.closed = false; s.t = S.anim; BLOCK[cellAt(s.x, s.y)] = 0; sfx('shutterup'); }
      else if (!want) s.jam = false;
    }
  }

  /* ================= 골목: 블록에 불이 들어오면 건물 사이 문이 올라간다 ================= */
  // 블록을 되살린 보상이 점수만이 아니라 길이 되게 — 블록 안을 위아래로 지나는 지름길(켜야 할 칸은 아니다)
  // 둘레가 꺼져 블록이 꺼지면 문이 다시 내려온다(안에 누가 있으면 나갈 때까지 기다린다)
  function setAlley(a, v) { for (let y = a.y0; y <= a.y1; y++) OPEN[cellAt(a.x, y)] = v; }
  function alleyBusy(a) { for (let y = a.y0; y <= a.y1; y++) if (occupied(a.x, y)) return true; return false; }
  function alleyStep() {
    const G = GIMMICK.alley;
    for (const a of S.alleys) {
      const on = S.blocks[a.bi].on;
      if (on && !a.open) {
        if (a.at < 0) a.at = S.anim;
        const t = S.anim - a.at;
        if (t === G.wait) sfx('alley');
        if (t >= G.wait) a.k = Math.min(1, a.k + 1 / G.roll);
        if (a.k >= 1) {
          a.open = true; setAlley(a, 1);
          for (const y of [a.y0 - .5, a.y1 + .5]) burst(px(a.x), py(y), 5, [C.lav, C.white], .7);
        }
      } else if (!on) {
        a.at = -1;
        if (a.open && !alleyBusy(a)) { a.open = false; setAlley(a, 0); sfx('shutter'); }
        if (!a.open) a.k = Math.max(0, a.k - 1 / G.roll);
      }
    }
  }

  /* ================= 열차: 8번 줄(터널 줄)을 가로지르는 빈 열차 ================= */
  // 왼쪽 터널에서 나와 원형 구조물 밑을 지나 오른쪽 터널로(다음 열차는 반대로). 건널목이 warn 동안 빨갛게 깜빡이고 종이 울린 뒤 들어온다
  // 주인공이 치이면 하트를 잃고, 드론이 치이면 기지로 쓸려 간다 — 쫓아오는 드론을 선로로 끌어들이는 판단이 생긴다
  const trainLen = () => { const G = GIMMICK.train; return G.cars * G.car + (G.cars - 1) * G.gap; };
  const trainSpan = tr => tr.dir > 0 ? [tr.x - trainLen(), tr.x] : [tr.x, tr.x + trainLen()];
  function spawnTrain(dir) {
    S.trains.push({ dir, x:dir > 0 ? -2 : MW + 1, warn:GIMMICK.train.warn });
    announce('train', K.paTrain);
  }
  function trainStep() {
    const G = GIMMICK.train;
    if (S.trainNext > 0 && --S.trainNext === 0) { spawnTrain(S.trainDir); S.trainDir = -S.trainDir; S.trainNext = S.D.train.every; }
    for (const tr of S.trains) {
      if (tr.warn > 0) { if (tr.warn % G.bell === 0) sfx('bell'); if (--tr.warn === 0) sfx('train'); continue; }
      tr.x += tr.dir * G.speed;
      const [lo, hi] = trainSpan(tr), on = e => Math.abs(e.y - WARP_Y) < .45 && e.x > lo - .45 && e.x < hi + .45;
      for (const d of S.drones) if (d.state === 'run' && on(d)) sweep(d);
      if (S.hero.inv <= 0 && on(S.hero)) { hit({ kind:'train' }); return; }
    }
    S.trains = S.trains.filter(tr => tr.dir > 0 ? trainSpan(tr)[0] < MW + 1 : trainSpan(tr)[1] > -2);
  }
  // 열차에 치인 드론: 하얗게 번쩍이며 기지로 쓸려 간다(잡기와 같은 되감김, 점수는 따로)
  function sweep(d) {
    d.state = 'back'; d.static = false; d.near = false; S.swept++;
    S.score += PT.train; S.scoreFx = 16; pop(String(PT.train), px(d.x), py(d.y) - 10, C.white, true);
    sfx('sweep'); shake(FEEL.shakeCatch);
    ring(px(d.x), py(d.y), C.white, 26, 22); burst(px(d.x), py(d.y), 12, [C.white, C.mist, C.red], 1.5);
  }
  /* ================= 구역 사건: 안내방송 · 탐조등 · 정전 · 테이프 · 과거의 나 · B-SIDE · 마지막 불빛 ================= */
  // 프레임마다(플레이 중에만): 구역 사건(beats) → 안내방송 → 열차 → 탐조등 → 정전 → 테이프 → 과거의 나 → 마지막 불빛
  function eventStep() {
    beatStep(); paStep(); trainStep();
    if (S.phase !== 'run') return; // 열차에 치였다
    lightStep(); darkStep(); tapeStep(); ghostStep(); lastStep(); traceStep();
  }

  /* ================= 구역 사건: 진행률 · 시간에 맞춰 한 번씩 ================= */
  // 표는 js/districts.js의 beats(돌아온 도시에선 과거의 나가 더해진다, setupDistrict). 진행률은 맞아서 꺼졌다 다시 켜도 한 번만 일어난다
  const BEATS = {
    train() { spawnTrain(S.trainDir); S.trainDir = -S.trainDir; S.trainNext = S.D.train.every; },
    twin() { spawnTrain(1); spawnTrain(-1); S.trainNext = S.D.train.every; },
    // 폐점: 왼쪽부터 하나씩 닫히고, 다시 열릴 땐 오른쪽부터
    closing() {
      const G = GIMMICK, list = S.shut.filter(s => !s.cycle), n = list.length, t0 = S.stageT + G.shutter.warn;
      list.forEach(s => { s.closeAt = t0 + s.i * G.closing.stagger; s.openAt = t0 + G.closing.len + (n - 1 - s.i) * G.closing.stagger; });
      announce('closing', K.paClosing);
    },
    blackout() { S.dark = { phase:'warn', t:0, start:0 }; announce('dark', K.paDark); sfx('buzz'); },
    // 통제선이 풀린다: 테이프가 끊어지고 막혀 있던 길에 차례로 불이 들어온다(처음부터 테이프 너머로 보이던 B-SIDE에 갈 수 있다)
    checkpoint() {
      (S.D.closed || []).forEach(([x, y], i) => { const k = tid(x, y); S.closed[k] = 0; BLOCK[cellAt(x, y)] = 0; S.litT[k] = S.anim + i * 4; });
      S.cutT = S.anim; sfx('tapecut');
    },
    ghost() { startGhost(); }
  };
  function beatStep() {
    const p = S.litN / TILES.length;
    S.beats.forEach((b, i) => {
      if (S.beatsDone[i] || (b.t !== undefined ? S.stageT < b.t : p < b.p)) return;
      S.beatsDone[i] = 1; BEATS[b.do]();
    });
  }

  /* ================= 안내방송: 원형 구조물 위의 한 줄 ================= */
  // 곧 일어날 일만 도시의 목소리로 알린다(이미 화면에 보이는 것은 말하지 않는다). 같은 안내는 게임을 켤 때마다 한 번만
  const PA_SEEN = new Set();
  function announce(key, text) {
    if (PA_SEEN.has(key)) return;
    PA_SEEN.add(key); S.paQ.push({ text, t:0, max:GIMMICK.pa });
  }
  // PLAYBACK 같은 알림 판이 떠 있으면 끝날 때까지 기다린다
  function paStep() {
    if (!S.pa && S.paQ.length && !S.banner) { S.pa = S.paQ.shift(); sfx('chime'); }
    if (S.pa && ++S.pa.t >= S.pa.max) S.pa = null;
  }

  /* ================= 탐조등(3 · 4구역): 긴 줄을 왕복하며 훑는 감시 드론의 빛 ================= */
  // 빛 안에 GIMMICK.light.spot 프레임 넘게 있으면 들킨다 → 흩어짐 중이어도 드론이 모두 쫓아오고(경보), 빛이 잠깐 주인공을 붙잡는다
  // 빛 뒤를 따라가거나 옆길에서 기다리면 된다. PLAYBACK 중(드론이 멈춤) · 보호 중 · 경보 직후엔 들키지 않는다. 정전 중엔 꺼진다
  function lightStep() {
    const G = GIMMICK.light, h = S.hero;
    if (S.alarm > 0) S.alarm--; else if (S.alarmCool > 0) S.alarmCool--;
    for (const l of S.lights) {
      if (S.dark) { l.spot = 0; continue; }
      if (l.hold > 0) { l.hold--; l.x += (h.x - l.x) * .15; l.y += (h.y - l.y) * .15; continue; }
      l.y += (l.row - l.y) * .1;
      l.x += l.dir * G.speed;
      if (l.x <= 0 || l.x >= MW - 1) { l.x = clamp(l.x, 0, MW - 1); l.dir = -l.dir; }
      const seen = Math.hypot(h.x - l.x, h.y - l.y) < G.radius && S.playback <= 0 && h.inv <= 0 && S.alarmCool <= 0;
      if (seen) { if (++l.spot >= G.spot) spotted(l); } else l.spot = Math.max(0, l.spot - 2);
    }
  }
  function spotted(l) {
    const G = GIMMICK.light;
    l.spot = 0; l.hold = G.hold; S.alarm = G.alarm; S.alarmCool = G.cool;
    for (const d of S.drones) if (d.state === 'run' && !d.static && d.dir) d.dir = OPP[d.dir]; // 쫓기 시작하는 신호(흩어짐 ↔ 추격과 같은 몸짓)
    S.waveFx = 42; sfx('alarm');
    ring(px(S.hero.x), py(S.hero.y), C.red, 30, 26);
  }

  /* ================= 정전(3구역 대표 장면) ================= */
  // warn: 블록 불이 몇 번 깜빡인다 → dark: 도시가 꺼진다. 보이는 건 주인공의 빛 · 방금 켠 길 · 드론의 빨간 눈 · 카세트 · 열차 전조등뿐
  //       드론은 신호를 잃고 갈림길마다 아무 쪽으로나 느리게 간다(숨 돌릴 틈). 탐조등도 꺼진다 · 이 동안 열차가 한 번 지나간다
  // → back: 원형 구조물에서부터 도시에 전기가 다시 퍼진다
  // 정전 화면의 어둠 세기(0~1). 깜빡임 단계에선 켜졌다 꺼졌다 — 곡도 이 값을 따라 끊긴다(js/music.js)
  function darkAlpha() {
    const d = S.dark, G = GIMMICK.dark; if (!d) return 0;
    if (d.phase !== 'warn') return .9;
    if (FEEL.reduced) return .4 * d.t / G.warn;
    return hash(Math.floor(d.t / 6) + 7) < .25 + .55 * d.t / G.warn ? .8 : 0; // 갈수록 꺼져 있는 시간이 길어진다
  }
  function darkStep() {
    const d = S.dark, G = GIMMICK.dark; if (!d) return;
    d.t++;
    if (d.phase === 'warn' && d.t >= G.warn) {
      d.phase = 'dark'; d.t = 0; d.start = S.anim; sfx('darkout');
      if (S.D.train) S.trainNext = 150;
    } else if (d.phase === 'dark' && d.t >= G.len) { d.phase = 'back'; d.t = 0; sfx('powerup'); }
    else if (d.phase === 'back' && d.t >= G.back) S.dark = null;
  }

  /* ================= 테이프: ▶▶ 빨리 감기 · ◀◀ 되감기 (▶ PLAYBACK은 progression.js) ================= */
  // 되감기: 기지 밖 드론을 모두 기지로 돌려보내고, 최근 몇 초 동안 지나온 길을 거꾸로 짚으며 꺼진 칸을 다시 켠다(분홍 잔상이 길을 거슬러 간다)
  function rewind() {
    for (const d of S.drones) {
      if (d.state === 'run') { d.state = 'back'; d.static = false; d.near = false; }
      else if (d.state === 'exit') { d.state = 'home'; d.t = -BALANCE.returnWait; d.x = BASE.x; d.y = BASE.y; }
    }
    S.rew = GIMMICK.rew.len; S.rewPath = S.hist.slice().reverse(); S.rewI = 0;
    songRewind(SCORE.rewind.tape); // 곡도 1초 되감긴다
  }
  function tapeStep() {
    if (S.ff > 0 && --S.ff === 0) { sfx('powerdown'); ring(px(S.hero.x), py(S.hero.y), C.mist, 20, 18); }
    if (S.rew > 0) {
      const P = S.rewPath, n = Math.floor((1 - --S.rew / GIMMICK.rew.len) * P.length);
      for (; S.rewI < n; S.rewI++) relight(P[S.rewI]);
      if (S.rew === 0) S.rewPath = null;
    }
  }
  // 기록된 자리의 칸이 꺼져 있으면 다시 켠다(되감기 · 과거의 나)
  function relight([x, y]) {
    const k = tid(Math.round(x), Math.round(y));
    if (k < 0 || S.lit[k] || S.closed[k]) return;
    lightTile(k); burst(px(x), py(y), 3, [C.pink, C.white], .5);
  }

  /* ================= 과거의 나(4구역 대표 장면) ================= */
  // 테이프가 되감기며, 이 구역 처음 20초 동안의 내가 분홍 잔상으로 나타나 그때의 길을 그대로 다시 걷는다
  // 그 사이 꺼진 칸을 다시 켜고, 다 걸은 자리에 B-SIDE를 남긴다(따라가 볼 이유)
  function startGhost() {
    if (S.rec.length < 30) return;
    S.ghost = { path:S.rec, i:0, t:0, end:0 }; sfx('ghost');
    songRewind(SCORE.rewind.ghost); // 곡이 20초 전으로 되감긴다 — 과거의 나가 걷는 동안 그때의 음악이 다시 흐른다
    ring(px(S.rec[0][0]), py(S.rec[0][1]), C.pink, 30, 30);
  }
  function ghostStep() {
    const g = S.ghost; if (!g) return;
    if (g.end) { if (++g.end > 30) S.ghost = null; return; }
    relight(g.path[g.i]);
    if (++g.t % GIMMICK.ghost.step === 0) g.i++;
    if (g.i >= g.path.length) { g.i = g.path.length - 1; g.end = 1; dropBside(); }
  }
  function dropBside() {
    const b = S.bside; if (!b || !b.ghost || b.shown) return;
    for (let i = S.ghost.path.length - 1; i >= 0; i--) {
      const [x, y] = S.ghost.path[i], rx = Math.round(x), ry = Math.round(y);
      if (tid(rx, ry) >= 0) { b.x = rx; b.y = ry; b.shown = true; ring(px(rx), py(ry), C.pink, 24, 26); sfx('drop'); return; }
    }
  }

  /* ================= B-SIDE: 구역마다 하나씩 숨긴 테이프 ================= */
  // 1 · 2구역: 블록을 켜야 열리는 골목 안 / 3구역: 통제선 너머(75%에 풀린다) / 4구역: 과거의 내가 남긴다. 찾은 것은 저장되어 기록 페이지에 남는다
  const bsideShown = () => { const b = S.bside; return !!b && b.shown && (!b.alley || b.alley.open); };
  function takeBside() {
    const b = S.bside; b.got = true; S.bsides++; S.score += PT.bside; S.scoreFx = 16;
    bsideMask |= 1 << ((S.stage - 1) % DISTRICTS.length);
    try { localStorage.setItem('nevercity-bside', String(bsideMask)); } catch (e) {}
    freeze(FEEL.freezeCatch); sfx('bside');
    pop('B-SIDE', px(b.x), py(b.y) - 12, C.pink, true);
    ring(px(b.x), py(b.y), C.pink, 34, 30); burst(px(b.x), py(b.y), 12, [C.pink, C.white, C.lav], 1.2);
  }

  /* ================= 마지막 불빛 ================= */
  // 남은 칸이 GIMMICK.lastN 이하면 남은 칸이 박자에 맞춰 깜빡인다 — 후반에 켜진 길만 걸으며 마지막 점을 찾아 헤매지 않게(그리는 건 city.js)
  function lastStep() {
    const left = TILES.length - S.litN;
    if (!S.last && left > 0 && left <= GIMMICK.lastN) { S.last = true; S.lastT = S.anim; sfx('lastcall'); }
    else if (S.last && left > GIMMICK.lastN) S.last = false;
  }

  /* ================= 도시에 남은 공연의 흔적: IDIOTAPE ================= */
  // 이 도시엔 순환선(원형 구조물)이 개통하는 날 IDIOTAPE의 공연이 잡혀 있었다. 전광판의 'D-1'은 끝내 오지 않은 그 공연 날이고,
  // 구역마다 숨긴 B-SIDE 테이프 4개는 그들의 잃어버린 녹음이다. 흔적은 모두 도시 안의 물건이고, 이름은 공연 날 전광판에만 한 번 나온다
  //   1 중앙로   : 왼쪽 골목 바닥에 떨어진 낡은 공연 전단지(B-SIDE 바로 옆). 블록을 켜야 골목이 열리니 찾는 사람만 본다
  //   2 셔터 상가: 폐점 셔터가 내려오는 순간, 그 밑에서 같은 전단지가 바람에 날려 오른쪽 골목 입구까지 굴러간다(골목 안에 B-SIDE)
  //   3 통제구역 : 정전이 되면 통제선 너머 바닥에 같은 표시(테이프 얼굴)가 형광으로 떠오른다(그 너머에 B-SIDE)
  //   4 순환선   : 전광판이 되감길 때 노이즈 사이로 그 표시가 한 프레임 비친다
  // B-SIDE를 모두 들은 사람이 순환선을 끝내면 그날이 온다: 전광판이 'IDIOTAPE · D-0'으로 바뀌고, 원형 구조물에서 공연이 열리고, 곡이 가장 큰 구간으로 감긴다
  // 못 찾아도 게임에는 아무 영향이 없다. 보상은 그 장면과, 이후 전광판 광고 · 기록 페이지에 남는 작은 표시뿐이다
  function concertReady() {
    if (!S.D || !S.D.venue || S.concertDone || bsideMask !== (1 << DISTRICTS.length) - 1) return false;
    S.concertDone = true; return true;
  }
  // 공연을 본 순간부터: 전광판 광고에 가끔 그 표시가 남고, 기록 페이지에 흔적이 생긴다(저장)
  function concertSeen() {
    liveSeen = true;
    try { localStorage.setItem('nevercity-live', '1'); } catch (e) {}
  }
  // 2구역: 폐점(beats의 closing)에서 가운데 셔터가 닫히는 순간 전단지가 날아오르고, 6초쯤 굴러 골목 입구에 멈춘다
  function traceStep() {
    const tr = S.D.trace; if (!tr) return;
    if (tr.drift && !S.flyer) {
      const s = S.shut.find(s => !s.cycle && s.x === tr.drift[0] && s.y === tr.drift[1]);
      if (s && S.stageT >= s.closeAt && s.closeAt !== Infinity) S.flyer = { t:0, from:tr.drift, to:tr.rest };
    }
    if (S.flyer && S.flyer.t < 360) S.flyer.t++;
    // 주인공이 전단지를 밟고 지나가면 살짝 들썩인다(그것뿐 — 줍는 물건이 아니다)
    const at = flyerAt(); if (at && S.hero.moving && Math.abs(S.hero.x - at[0]) + Math.abs(S.hero.y - at[1]) < .5 && S.anim - S.flutter > 30) S.flutter = S.anim;
  }
  // 전단지가 지금 있는 자리(칸 좌표, 소수). 1구역은 골목이 열려 있을 때만
  function flyerAt() {
    const tr = S.D && S.D.trace; if (!tr) return null;
    if (tr.flyer) { const a = S.alleys.find(a => a.x === tr.flyer[0] && tr.flyer[1] >= a.y0 && tr.flyer[1] <= a.y1); return !a || a.k > 0 ? tr.flyer : null; }
    if (tr.drift && S.flyer) {
      const k = easeOut(clamp(S.flyer.t / 360)), [x0, y0] = S.flyer.from, [x1, y1] = S.flyer.to;
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + Math.sin(S.flyer.t / 9) * .18 * (1 - k)];
    }
    return null;
  }
  /* ================= 타이틀 데모: 같은 도시를 주인공이 돌아다니며 길을 밝힌다 ================= */
  // 아케이드의 데모 화면처럼 게임이 무엇인지 글 없이 보여 준다. 점수 · 소리 · 드론 없이 길 밝히기와 블록 점등만
  // 갈림길마다 가장 가까운 꺼진 칸으로 가는 첫 방향을 고른다(길을 따라 잰 거리). 터널은 쓰지 않는다
  // 도시를 다 밝히면 UI.demoHold 동안 머문 뒤, 주인공 자리에서부터 불이 꺼지고 처음부터 다시
  function demoDir(x, y) {
    const start = tid(x, y); if (start < 0) return null;
    const first = new Map([[start, null]]), queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i], [cx, cy] = TILES[k];
      if (k !== start && !S.lit[k] && demoBand(k)) return first.get(k);
      for (const d of DORDER) {
        const n = tid(cx + DV[d][0], cy + DV[d][1]);
        if (n >= 0 && !first.has(n)) { first.set(n, k === start ? d : first.get(k)); queue.push(n); }
      }
    }
    return null;
  }
  // 데모는 가운데 띠(8~12번 줄)만 돈다: 라이더가 늘 간판 아래 · PRESS ANY KEY 위에 2배로 크게 보인다
  const demoBand = k => TILES[k][1] >= 8 && TILES[k][1] <= 12;
  const demoDone = () => TILES.every((_, k) => !demoBand(k) || S.lit[k]);
  // 카메라: 타이틀은 도시를 2배로 가까이 비추며 데모 주인공을 천천히 따라간다(주인공은 간판 아래쪽에 오도록). 미로 밖은 비추지 않는다
  const TITLE_ZOOM = 2;
  function demoCam(snap = false) {
    const h = S.hero, vw = W / 2 / TITLE_ZOOM, vh = H / 2 / TITLE_ZOOM;
    const tx = clamp(px(h.x), MX - 4 + vw, MX + MW * T + 4 - vw), ty = clamp(py(h.y) - 20, MY - 4 + vh, MY + MH * T + 4 - vh);
    if (snap || !S.cam) S.cam = { x:tx, y:ty };
    else { S.cam.x += (tx - S.cam.x) * .05; S.cam.y = ty; } // 위아래는 그대로 붙어 간다: 라이더는 늘 간판 아래, 도시가 그 밑으로 흐른다
  }
  function demoStep() {
    const h = S.hero;
    demoCam();
    if (h.turn > 0) h.turn--;
    if (S.out) {
      // 불이 다 꺼지면 도시를 처음 상태로(주인공은 그 자리에서 계속 걷는다)
      if (outDone()) resetCity();
    } else if (demoDone()) {
      if (++S.demoT >= UI.demoHold) { S.demoT = 0; lightsOut(Math.round(h.x), Math.round(h.y), .6); }
      return;
    }
    const decide = e => {
      const x = Math.round(e.x), y = Math.round(e.y);
      const inBand = o => { const k = tid(x + DV[o][0], y + DV[o][1]); return k >= 0 && demoBand(k); };
      const d = demoDir(x, y) || options(e).find(inBand) || options(e).find(o => tid(x + DV[o][0], y + DV[o][1]) >= 0);
      if (d !== e.dir) e.turn = 6;
      e.dir = e.want = d;
    };
    const arrive = e => { const k = tid(e.x, e.y); if (k >= 0 && !S.lit[k]) lightTile(k, true); };
    const left = move(h, UI.demo, decide, arrive);
    h.walk += UI.demo - left;
    stepBike(h, UI.demo - left);
  }
  /* ================= 프레임마다 (60Hz 고정) ================= */
  // Hit Stop(S.freeze) 동안엔 세계만 멈추고 효과는 계속 흐른다. 일시정지 동안엔 모두 멈춘다
  function update() {
    rideSound();
    if (mode !== 'pause') mixStep(); // 음악 연출(js/music.js)
    if (mode === 'title' || mode === 'enter') { titleStep(); return; }
    if (mode === 'over') { S.overT++; stepFx(); overTimeline(); if (S.overT > BALANCE.overIdle) enterTitle(); return; }
    if (mode !== 'play') return;
    stepFx();
    if (S.boot > 0) S.boot--;
    if (S.freeze > 0) { S.freeze--; return; }
    if (S.slow > 0) { S.slow--; if (S.slow % 2) return; } // 슬로모션: 세계는 한 프레임 걸러 움직인다
    S.anim++; viewStep();
    const sb = songBeat(); S.beatT = sb === null ? S.beatT + 1 : sb;
    S.phaseT++;
    if (S.out) S.out.t++;
    if (S.hero.spawn > 0) S.hero.spawn--;
    if (S.phase === 'ready') {
      if (S.phaseT === 1) sfx('ready');
      stepBike(S.hero, 0); // 서 있어도 엔진은 떨리고, 떨어져 내려앉는 착지도 여기서
      S.drones.forEach(d => { d.frame++; });
      if (S.phaseT >= S.readyT) {
        S.phase = 'run'; S.phaseT = 0; sfx('go'); ring(px(S.hero.x), py(S.hero.y), C.cyan, 20, 22);
        if (S.lapIn) { S.lapIn = false; music.restart(); } // 돌아온 도시: 멈춰 있던 곡이 처음부터, 그 루프의 속도로
      }
      return;
    }
    if (S.phase === 'dead') { crashStep(); if (S.phaseT >= DEAD_T) afterHit(); return; }
    if (S.phase === 'lost') { crashStep(); if (S.phaseT >= BALANCE.lost) gameOver(); return; }
    if (S.phase === 'clear') { clearTimeline(); return; }
    S.stageT++; machineStep(); // 셔터 · 골목 문은 움직이기 전에(누가 들어오는 중이면 닫히지 않는다)
    heroStep(); S.drones.forEach(droneStep); collide();
    if (S.phase !== 'run') return;
    eventStep(); // 구역 사건 · 열차 · 탐조등 · 정전 · 테이프(js/events.js)
    if (S.phase !== 'run') return;
    if (S.fadeT > 0) S.fadeT--;
    if (S.playback > 0) {
      S.playback--;
      // 끝나기 전: 화면 글 대신 드론 · 주인공 · 타이머가 노랗게 깜빡이고 짧은 경고음
      if (S.playback > 0 && S.playback <= BALANCE.playbackWarn && S.playback % 20 === 0) sfx('warn');
      if (S.playback === 0) endPlayback();
    }
    waveStep();
    // 25 · 50 · 75%: 알림 글 없이 HUD 진행 막대가 한 번 빛나고 짧은 소리
    const step = Math.floor(S.litN / TILES.length * 4);
    if (step > S.milestone && step < 4) { S.milestone = step; S.segFx = 40; sfx('milestone'); }
    // 최고 기록을 넘는 순간: 점수가 청록으로 바뀌고 NEW BEST가 잠깐
    if (best > 0 && S.score > best && !S.beatBest) { S.beatBest = true; S.bestFx = 120; sfx('record'); }
    if (S.litN >= TILES.length) stageClear();
  }
  // 타이틀 · 시작 전환: 데모 주인공이 길을 밝히고, 시작하면 불이 꺼지는 물결이 끝난 뒤 게임으로
  function titleStep() {
    titleT++; S.anim++; S.beatT++; viewStep();
    stepFx();
    if (S.out) S.out.t++;
    if (mode === 'title') {
      if (++idleT >= IDLE_T + INFO_T * 2) idleT = 0;
      demoStep();
      return;
    }
    if (++enterT >= UI.enter) startGame(false, enterDir);
  }
  // 구역 복원 순서: 물결 → STAGE CLEAR → 보너스가 하나씩 집계 → (PERFECT면 공연) → 화면이 어두워지고 다음 구역이 떠오른다
  function clearTimeline() {
    const t = S.phaseT;
    if (S.live && t === LIVE_AT - 12) songSeek(SCORE.concertAt); // 공연: 곡이 가장 큰 구간으로 감기며 무대가 열린다
    if (S.live && t === LIVE_AT) concertSeen();
    S.bonus.forEach((b, i) => { const at = 70 + i * 26; if (t >= at && t < at + 20 && t % 3 === 0) sfx('tally', i * 2 + (t - at) / 3); });
    if (t >= clearEnd()) nextStage();
  }
  // 결과 화면: 점수가 올라가며 집계되고, 기록이면 마지막에 축하음
  function overTimeline() {
    const t = S.overT;
    if (t > 26 && t < 62 && t % 3 === 0) sfx('tally', (t - 26) / 6);
    if (t === 66 && newRecord) sfx('record');
  }
  /* ================= 그리기 도구 · UI 부품 (디자인 시스템: docs/nevercity-design-system.md) ================= */
  // 글자 단계: 큰 알림 = words.png 그림 글자(정수배) / 제목 = Silkscreen 16 / 이름표 = Silkscreen 8 / 숫자 = Press Start 2P 8 · 16 / 한글 = 픽셀 한글 11 · 13
  // 픽셀 글꼴은 8의 배수 크기로만 쓴다(그래야 픽셀이 고르다). 글자 그림자는 1px 검정 하나만 — 빛 번짐(text glow)은 쓰지 않는다
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function txt(s, x, y, color, size = 8, align = 'left', shadow = C.ink, font = F_PIX, weight = '700') {
    ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'top';
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1); }
    ctx.fillStyle = color; ctx.fillText(s, Math.round(x), Math.round(y));
  }
  const num = (s, x, y, color, size = 8, align = 'left') => txt(s, x, y, color, size, align, C.ink, F_NUM, '400');
  const textW = (s, size = 8, font = F_PIX, weight = '700') => { ctx.font = `${weight} ${size}px ${font}`; return Math.ceil(ctx.measureText(s).width); };
  // 뒷면 태그와 같은 칩 (NEW RECORD 등)
  function chip(s, x, y, bg, fg = C.ink) {
    const w = textW(s) + 10;
    R(C.ink, x + 2, y + 2, w, 13); R(C.ink, x - 1, y - 1, w + 2, 15); R(bg, x, y, w, 13);
    txt(s, x + 5, y + 2, fg, 8, 'left', null); return w;
  }
  // 한글은 뒷면 헤드라인처럼 1비트 픽셀 글자로 (Noto Sans KR Black/Bold)
  const KCACHE = new Map();
  function kimg(str, size, color, weight) {
    const key = str + '|' + size + '|' + color + '|' + weight;
    if (KCACHE.has(key)) return KCACHE.get(key);
    const font = `${weight} ${size}px "Noto Sans KR", sans-serif`;
    const m = document.createElement('canvas').getContext('2d'); m.font = font;
    const w = Math.ceil(m.measureText(str).width) + 4, h = size + 8;
    const c = canvas(w, h), g = c.getContext('2d'); g.font = font; g.textBaseline = 'top'; g.fillStyle = '#fff'; g.fillText(str, 1, 1);
    try {
      const src = g.getImageData(0, 0, w, h), out = g.createImageData(w, h);
      const n = parseInt(color.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
      for (let i = 0; i < w * h; i++) if (src.data[i * 4 + 3] > 110) { out.data[i * 4] = r; out.data[i * 4 + 1] = gg; out.data[i * 4 + 2] = b; out.data[i * 4 + 3] = 255; }
      g.clearRect(0, 0, w, h); g.putImageData(out, 0, 0);
    } catch (e) { g.clearRect(0, 0, w, h); g.fillStyle = color; g.fillText(str, 1, 1); }
    KCACHE.set(key, c); return c;
  }
  function ktxt(str, x, y, color, size = 11, align = 'left', weight = 700) {
    const c = kimg(str, size, color, weight), s = kimg(str, size, C.ink, weight);
    const dx = Math.round(align === 'center' ? x - c.width / 2 : align === 'right' ? x - c.width : x);
    ctx.drawImage(s, dx + 1, Math.round(y) + 1); ctx.drawImage(c, dx, Math.round(y));
  }
  function dim(a, c = C.night) { if (a <= 0) return; ctx.globalAlpha = Math.min(1, a); R(c, 0, 0, W, H); ctx.globalAlpha = 1; }
  // 설명 목록 한 줄: 번호 상자 · 굵은 픽셀 한글 제목 · 회색 설명 · 오른쪽에 실제 게임 그림
  function feature(nn, title, desc, x, y, icon) {
    R(C.line, x, y, 18, 18);
    num(nn, x + 9, y + 5, C.paper, 8, 'center');
    ktxt(title, x + 28, y - 1, C.white, 13, 'left', 900);
    ktxt(desc, x + 28, y + 16, C.mist, 11, 'left', 700);
    if (icon) icon(x + 372, y + 10);
  }
  function dotted(x0, y, w = 372, c = C.line) { for (let x = x0; x < x0 + w; x += 4) R(c, x, y, 2, 1); }

  /* ================= UI 판 ================= */
  // 모든 판(READY · 복원 · 일시정지 · 결과)이 같은 모양: 어두운 바탕 · 1px 회색 테두리 · 위쪽 2px 선 하나만 색(색 = 그 판의 뜻)
  function panel(x, y, w, h, accent = C.line, a = .92) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.globalAlpha = a; R(C.panel, x, y, w, h); ctx.globalAlpha = 1;
    R(C.line, x, y, w, 1); R(C.line, x, y + h - 1, w, 1); R(C.line, x, y, 1, h); R(C.line, x + w - 1, y, 1, h);
    R(accent, x, y, w, 2);
  }
  // 이름표(회색) + 값(흰 숫자) 한 쌍. 가로로 놓을 때
  function stat(label, value, x, y, col = C.paper, align = 'left') {
    const lw = textW(label) + 6;
    if (align === 'right') { const vw = textW(value, 8, F_NUM, '400'); txt(label, x - vw - 6, y, C.mist, 8, 'right', null); num(value, x, y, col, 8, 'right'); return; }
    txt(label, x, y, C.mist, 8, 'left', null); num(value, x + lw, y, col, 8);
  }
  // 누르라는 안내(PRESS ANY KEY 등): 박자에 맞춰 밝기만 숨 쉰다. a = 전체 투명도
  function prompt(s, x, y, a = 1, align = 'center', t = S ? S.beatT : 0) {
    if (a <= 0) return;
    const k = 1 - (t % fpb()) / fpb();
    ctx.globalAlpha = a * (.6 + .4 * k * k); txt(s, x, y, C.paper, 8, align); ctx.globalAlpha = 1;
  }
  // 작은 픽셀 화살표(▶ 모양, 방향대로) — 선입력 표시
  function arrow(x, y, dir, c) {
    for (let r = 0; r < 4; r++) for (let i = -(3 - r); i <= 3 - r; i++) {
      const [ax, ay] = dir === 'right' ? [r, i] : dir === 'left' ? [-r, i] : dir === 'down' ? [i, r] : [i, -r];
      R(c, x + ax, y + ay, 1, 1);
    }
  }
  // 빛: 방사형 그라데이션을 색마다 한 번만 그려 두고 늘려 쓴다(매 프레임 그라데이션을 만들지 않는다)
  const GLOW = new Map();
  function glow(x, y, r, color, a) {
    if (a <= 0 || r <= 0) return;
    let c = GLOW.get(color);
    if (!c) {
      c = canvas(64, 64); const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, color); gr.addColorStop(.35, color + '66'); gr.addColorStop(1, color + '00');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOW.set(color, c);
    }
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(c, x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  /* ================= NEVER CITY 로고: LED 간판 ================= */
  // 표지 로고와 같은 구성(굵은 글자 · 위 청록 / 아래 분홍 · 남보라 받침과 보라 외곽선)을 LED 점 하나하나로 짠 픽셀 글자
  // 화면 배율마다 기기 픽셀 크기로 한 번만 그려 둔다 → 어떤 해상도에서도 점 경계가 선명하다(늘려서 흐려지는 일이 없다)
  // images/generated/never-city-logo.png(투명 배경 고해상도)가 있으면 같은 자리 · 같은 폭에 그 그림을 쓴다
  const LOGO_TEXT = 'NEVER CITY', LOGO_CELL = 3.5; // 점 한 칸 = 논리 3.5px(1080p에서 14px)
  const LOGO_GLYPHS = {
    N:['##..##', '###.##', '###.##', '######', '######', '##.###', '##.###', '##..##', '##..##'],
    E:['######', '######', '##....', '##....', '#####.', '##....', '##....', '######', '######'],
    V:['##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..', '..##..'],
    R:['#####.', '######', '##..##', '##..##', '#####.', '####..', '##.##.', '##..##', '##..##'],
    C:['.#####', '######', '##....', '##....', '##....', '##....', '##....', '######', '.#####'],
    I:['##', '##', '##', '##', '##', '##', '##', '##', '##'],
    T:['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
    Y:['##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..', '..##..']
  };
  // 줄마다 점 색: 위 네 줄 청록 → 가운데 흰 띠 → 아래 네 줄 분홍(표지 로고와 같은 구성)
  const LOGO_ROWS = ['#c9fdff', '#9cf8ff', '#6ff4ff', '#4ee0f5', '#f3ecff', '#ff9ce9', '#ff72e1', '#ff4fd8', '#d63bbf'];
  const LOGO_PLATE = '#150c2c', LOGO_DEPTH = '#08050f', LOGO_EDGE = '#6a3cf0', LOGO_OFF = '#2a1f47';

  let LOGO = null;
  function buildLogo() {
    const cell = Math.max(2, Math.round(LOGO_CELL * SX));
    if (LOGO && LOGO.cell === cell) return LOGO;
    // 1) 글자 칸: 받침 테두리 1칸을 두고 놓는다
    const lit = [], letters = [];
    let x = 1;
    for (const ch of LOGO_TEXT) {
      if (ch === ' ') { x += 3; continue; }
      const g = LOGO_GLYPHS[ch], mine = [];
      g.forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') { const p = [x + i, r + 1, r]; lit.push(p); mine.push(p); } }));
      letters.push(mine); x += g[0].length + 1;
    }
    const cols = x + 1, rows = 11;
    // 2) 간판: 글자 둘레 한 칸까지 덮는 직사각형 LED 판 · 1px 보라 테두리 · 아래로 반 칸 두께
    const make = () => canvas(cols * cell, rows * cell + (cell >> 1)), base = make(), b = base.getContext('2d');
    const lw = Math.max(1, Math.round(cell / 7)), bw = cols * cell, bh = rows * cell;
    b.fillStyle = LOGO_DEPTH; b.fillRect(0, bh, bw, cell >> 1);
    b.fillStyle = LOGO_PLATE; b.fillRect(0, 0, bw, bh);
    b.fillStyle = LOGO_EDGE; b.fillRect(0, 0, bw, lw); b.fillRect(0, bh - lw, bw, lw); b.fillRect(0, 0, lw, bh); b.fillRect(bw - lw, 0, lw, bh);
    // 3) LED 점: 모서리를 깎은 사각형 + 왼쪽 위 작은 반사. 꺼진 점은 받침보다 조금 밝은 남보라
    const gap = Math.max(1, Math.round(cell * .22)), d = cell - gap, o = gap >> 1;
    const dot = (g, X, Y, col, shine) => {
      g.fillStyle = col;
      if (d >= 5) { g.fillRect(X + 1, Y, d - 2, d); g.fillRect(X, Y + 1, d, d - 2); } else g.fillRect(X, Y, d, d);
      if (shine && d >= 6) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(X + 1, Y + 1, Math.round(d / 3), Math.round(d / 4)); }
    };
    // 판 전체에 꺼진 점이 깔리고(전광판), 글자 자리만 켜진다
    for (let cy = 1; cy < rows - 1; cy++) for (let cx = 1; cx < cols - 1; cx++) dot(b, cx * cell + o, cy * cell + o, LOGO_OFF, false);
    const off = make(), f = off.getContext('2d'); f.drawImage(base, 0, 0);
    const lamp = make(), l = lamp.getContext('2d'); l.drawImage(base, 0, 0);
    for (const [cx, cy, r] of lit) dot(l, cx * cell + o, cy * cell + o, LOGO_ROWS[r], true);
    // 4) 번짐: 켜진 점의 빛을 한 번만 흐리게 그려 둔다(간판 둘레의 빛). 캔버스 필터를 못 쓰는 브라우저에선 번짐 없이
    const pad = cell * 3, glowC = canvas(cols * cell + pad * 2, rows * cell + pad * 2), gg = glowC.getContext('2d');
    if ('filter' in gg) {
      gg.filter = `blur(${Math.round(cell * .9)}px)`;
      for (const [cx, cy, r] of lit) { gg.fillStyle = LOGO_ROWS[r]; gg.fillRect(pad + cx * cell, pad + cy * cell, cell, cell); }
    }
    LOGO = { cell, cols, rows, pad, w:cols * cell, h:rows * cell + (cell >> 1), on:lamp, off, glow:'filter' in gg ? glowC : null, letters };
    return LOGO;
  }
  // 로고의 논리 크기(가운데 정렬에 쓴다). 생성 로고는 LOGO_W 폭으로 부드럽게 줄여 그린다(LOOP NIGHT 로고와 같은 방식)
  const LOGO_W = 232;
  function logoSize() {
    if (ok(IMG.logo)) return { w:LOGO_W, h:LOGO_W * IMG.logo.height / IMG.logo.width };
    const L = buildLogo(); return { w:L.w / SX, h:L.h / SY };
  }
  // a: 투명도 · on: 켜진 정도(0~1, 왼쪽부터 켜진다) · flick: 잠깐 전압이 떨어지는 순간(-1 없음)
  function drawLogo(cx, cy, a = 1, on = 1, flick = -1) {
    if (a <= 0) return;
    if (ok(IMG.logo)) {
      const L = IMG.logo, { w, h } = logoSize(), x = cx - w / 2, y = cy - h / 2, f = w / L.width;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = a;
      // 꺼진 간판이 먼저 있고, 왼쪽부터 불이 들어온다. 켜지는 경계는 깜빡이며 지나간다
      if (ART.logoOff && on < 1) ctx.drawImage(ART.logoOff, x, y, w, h);
      if (on > 0) {
        const edge = on < 1 && Math.floor(on * 36) % 2 ? 10 : 0;
        ctx.save(); ctx.beginPath(); ctx.rect(x - 6, y - 6, (w + 12) * clamp(on) - edge, h + 12); ctx.clip();
        ctx.globalAlpha = a * (flick >= 0 ? .6 : 1); ctx.drawImage(L, x, y, w, h); ctx.restore();
        const G = ART.logoGlow;
        if (G) {
          const s = f / G.k; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .3 * clamp(on * 1.5 - .5) * (flick >= 0 ? .5 : 1);
          ctx.drawImage(G.c, x - G.pad * s, y - G.pad * s, G.c.width * s, G.c.height * s);
        }
      }
      ctx.restore();
      return;
    }
    const L = buildLogo(), m = ctx.getTransform(), dx = Math.round(m.e + (cx * SX) - L.w / 2), dy = Math.round(m.f + (cy * SY) - L.h / 2);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
    const cellOf = (src, [x, y]) => ctx.drawImage(src, x * L.cell, y * L.cell, L.cell, L.cell, dx + x * L.cell, dy + y * L.cell, L.cell, L.cell);
    if (on >= 1) {
      ctx.drawImage(L.on, dx, dy);
      if (L.letters[flick]) for (const c of L.letters[flick]) cellOf(L.off, c);
    } else {
      // 켜지는 순서: 글자마다 조금씩 늦게, 글자 안에선 두 번 깜빡인 뒤 한 번에(간판에 전기가 들어가듯)
      ctx.drawImage(L.off, dx, dy);
      L.letters.forEach((cells, i) => {
        const k = clamp(on * (L.letters.length + 2) - i);
        if (k >= 1 || (k > 0 && Math.floor(k * 6) % 2 === 0)) for (const c of cells) cellOf(L.on, c);
      });
    }
    if (on > 0 && L.glow) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * .32 * clamp(on * 1.5 - .5);
      ctx.drawImage(L.glow, dx - L.pad, dy - L.pad);
    }
    ctx.restore();
  }
  /* ================= 도시: 무너진 회색 블록 · 꺼진 길 · 되살린 길 ================= */
  // 미로 틀: 미로 바깥 4px에 1px 선 하나. PLAYBACK 동안만 분홍(지금 무엇이 켜져 있는지 화면 둘레로도 보인다). 터널(반대편으로 이어지는 곳)은 비워 둔다
  function drawFrame() {
    const x = MX - 4, y = MY - 4, w = MW * T + 8, h = MH * T + 8;
    R(C.ink, x, y, w, h);
    ctx.globalAlpha = S.playback > 0 ? .7 : 1;
    const c = S.playback > 0 ? C.pink : C.line;
    // 한 변을 따라 선을 긋되, 터널 칸 앞뒤 2px까지는 비운다
    const side = (horiz, at, gaps) => {
      const len = horiz ? w : h, cuts = [...gaps].map(g => (horiz ? MX - x : MY - y) + g * T - 2).sort((a, b) => a - b);
      let from = 0;
      for (const g of [...cuts, len]) { if (g > from) horiz ? R(c, x + from, at, g - from, 1) : R(c, at, y + from, 1, g - from); from = g + T + 4; }
    };
    side(true, y, WARP.cols); side(true, y + h - 1, WARP.cols); side(false, x, WARP.rows); side(false, x + w - 1, WARP.rows);
    ctx.globalAlpha = 1;
  }
  // 블록 하나: 꺼져 있으면 회색 폐허, 켜지면 색. 켜지고 꺼지는 순간은 브라운관 전원처럼(가운데 한 줄이 위아래로 열리고, 닫힌다)
  // 불이 꺼지는 물결(S.out)이 지나가면 닿는 순서대로 다시 닫힌다
  const CRT_ON = 22, CRT_OFF = 16;
  function blockOff(i) {
    const o = S.out; if (!o) return -1;
    const b = BLOCKS[i], d = Math.abs(b.x + b.w / 2 - o.x) + Math.abs(b.y + b.h / 2 - o.y);
    return (o.t * o.rate - d) / o.rate; // 물결이 이 블록에 닿은 뒤 지난 프레임(음수면 아직)
  }
  // 4구역(순환선): 꺼진 블록은 모두 같은 건물(맨 왼쪽 위 블록)을 이어 붙인 모습. 켜면 진짜 모습이 돌아온다
  function drawRepeated(g, b, dx, dy) {
    const R0 = ok(IMG.repeat) && cityArt(S.tone || C.city, IMG.repeat);
    if (R0) { // 일부러 특징 없이 뽑은 아파트 지붕 한 채(C09)를 블록마다 이어 붙인다
      for (let j = 0; j < b.h; j += 3) for (let i = 0; i < b.w; i += 4) {
        const w = Math.min(4, b.w - i), h = Math.min(3, b.h - j);
        ctx.drawImage(R0, 0, 0, w * CITY_K, h * CITY_K, dx + i * T, dy + j * T, w * T, h * T);
      }
      return;
    }
    const s = BLOCKS[0];
    for (let j = 0; j < b.h; j += s.h) for (let i = 0; i < b.w; i += s.w) {
      const w = Math.min(s.w, b.w - i), h = Math.min(s.h, b.h - j);
      ctx.drawImage(g, s.x * CITY_K, s.y * CITY_K, w * CITY_K, h * CITY_K, dx + i * T, dy + j * T, w * T, h * T);
    }
  }
  // 돌아온 도시: 지도 배치가 좌우 대칭이라 그림만 뒤집어도 블록 자리는 그대로다 — 같은 거리인데 어딘가 낯설다
  const MIRROR = new Map();
  function mirrored(img) {
    if (!ok(img)) return img;
    if (!MIRROR.has(img)) { const c = canvas(img.width, img.height), g = c.getContext('2d'); g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0); MIRROR.set(img, c); }
    return MIRROR.get(img);
  }
  const flipped = () => S.D && lapOf(S.stage) > 0;
  // 이 구역의 도시 그림: 2 · 3구역은 그 구역 그림(같은 배치, 다른 건물), 나머지는 기본 도시
  function districtArt() {
    const a = S.D && S.D.art, lit = a && ok(IMG[a[0]]) ? IMG[a[0]] : IMG.lit, gray = a && ok(IMG[a[1]]) ? IMG[a[1]] : IMG.gray;
    return [lit, cityArt(S.tone || C.city, gray) || gray];
  }
  function drawBlocks() {
    let [l, g] = districtArt(); if (!ok(g) || !ok(l)) return;
    if (flipped()) { g = mirrored(g); l = mirrored(l); }
    const repeat = S.D && S.D.repeat;
    // 지붕은 카메라 초점에서 조금 밀려나고(높이), 밀려난 쪽에 벽과 창문이 드러난다(js/render/environment.js). 지붕은 자기 블록 밖으로 나가지 않는다
    BLOCKS.forEach((b, i) => {
      const [ox, oy] = blockLean(b);
      if (!ox && !oy) { drawBlock(b, i, l, g, repeat); return; }
      const st = S.blocks[i];
      drawWalls(b, i, ox, oy, st.on && S.anim - st.t >= CRT_ON && blockOff(i) < 0);
      ctx.save(); ctx.beginPath(); ctx.rect(MX + b.x * T, MY + b.y * T, b.w * T, b.h * T); ctx.clip(); ctx.translate(ox, oy);
      drawBlock(b, i, l, g, repeat);
      ctx.restore();
    });
  }
  function drawBlock(b, i, l, g, repeat) {
    {
      const st = S.blocks[i], sx = b.x * CITY_K, sy = b.y * CITY_K, sw = b.w * CITY_K, sh = b.h * CITY_K;
      const dx = MX + b.x * T, dy = MY + b.y * T, dw = b.w * T, dh = b.h * T, cy = dy + dh / 2;
      const outK = blockOff(i);
      let on = st.on ? S.anim - st.t : -1, off = !st.on ? S.anim - st.off : 999;
      if (st.on && outK >= 0) { on = -1; off = outK; }
      if (on >= CRT_ON) { ctx.drawImage(l, sx, sy, sw, sh, dx, dy, dw, dh); drawBlockBeat(b, l); return; }
      if (repeat && !b.ring) drawRepeated(g, b, dx, dy); else ctx.drawImage(g, sx, sy, sw, sh, dx, dy, dw, dh);
      let band = 0, line = 0;
      if (on >= 0) { const k = on / CRT_ON; line = Math.min(1, k / .2); band = k < .2 ? 0 : ease((k - .2) / .8); }
      else if (off < CRT_OFF) { const k = off / CRT_OFF; band = k < .6 ? 1 - ease(k / .6) : 0; line = k < .6 ? 1 : 1 - (k - .6) / .4; }
      else return;
      const hh = Math.max(0, Math.round(dh * band));
      if (hh > 0) {
        const top = Math.round(cy - hh / 2);
        ctx.drawImage(l, sx, sy + (top - dy) * (CITY_K / T), sw, hh * (CITY_K / T), dx, top, dw, hh);
        ctx.globalAlpha = .35 * (1 - band); R(C.white, dx, top, dw, hh); ctx.globalAlpha = 1;
        R(C.white, dx, top, dw, 1); R(C.white, dx, top + hh - 1, dw, 1);
      }
      if (band < 1 && line > 0) {
        const lw = Math.round(dw * Math.min(1, line)); ctx.globalAlpha = .9;
        R(C.white, dx + (dw - lw) / 2, Math.round(cy) - 1, lw, 2); ctx.globalAlpha = 1;
      }
    }
  }
  // 켜진 블록: 박자마다 창이 한 번 숨 쉰다(음악에 맞춰 도시가 살아 있다)
  function drawBlockBeat(b, l) {
    const beat = (S.beatT % fpb()) / fpb();
    if (beat >= .2 || FEEL.reduced) return;
    ctx.globalAlpha = (.2 - beat) * .5; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(l, b.x * CITY_K, b.y * CITY_K, b.w * CITY_K, b.h * CITY_K, MX + b.x * T, MY + b.y * T, b.w * T, b.h * T);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // 원형 구조물(중앙 = 드론 기지): 드론이 곧 나오면 위쪽 출구가 빨갛게 깜빡인다
  function drawRelay() {
    if (S.phase !== 'run' || !exitSoon() || !((S.anim >> 3) % 2)) return;
    const gx = px(GATE.x), gy = py(GATE.y) + 7;
    R(C.red, gx - 5, gy + 1, 10, 2); arrow(gx, gy - 2, 'up', C.red);
  }
  // 길: 칸마다 가운데에 가로등 점 하나. 꺼진 칸은 어두운 아스팔트에 회색 점(아직 지나지 않은 곳 — Pac-Man의 쿠키처럼 할 일이 보인다)
  // 지나간 칸은 보라로 켜지고 점이 연보라 가로등이 된다. 켜지는 순간 칸 전체가 하얗게 한 번 번쩍인다
  function tileLit(k) {
    if (S.out) return S.lit[k] && S.out.t * S.out.rate < S.out.order[k];
    return S.lit[k] || S.anim < S.eraseT[k]; // 맞은 자리의 칸은 Hit Stop이 끝난 뒤 가까운 칸부터 꺼진다
  }
  // 마지막 불빛(남은 칸 GIMMICK.lastN 이하): 남은 칸의 점이 박자마다 하얗게 켜지고 작은 네모가 퍼진다 — 어디가 남았는지 멀리서도 보인다
  function lastBeacon(dx, dy, beat) {
    const on = beat < .5 || FEEL.reduced;
    R(on ? C.white : C.mist, dx + 5, dy + 5, 2, 2);
    if (beat < .35 && !FEEL.reduced) { const r = 2 + Math.round(beat / .35 * 4); ctx.globalAlpha = .6 * (1 - beat / .35); ctx.strokeStyle = C.white; ctx.lineWidth = 1; ctx.strokeRect(dx + 6 - r + .5, dy + 6 - r + .5, r * 2 - 1, r * 2 - 1); ctx.globalAlpha = 1; }
  }
  function drawRoads() {
    const a = S.anim, clear = S.phase === 'clear' ? S.phaseT : -1, beat = (S.beatT % fpb()) / fpb(), lamp = beat < .15 && !FEEL.reduced ? C.white : C.lav;
    for (let k = 0; k < TILES.length; k++) {
      const [x, y] = TILES[k], dx = MX + x * T, dy = MY + y * T;
      const up = !roadShape(x, y - 1), dn = !roadShape(x, y + 1), lf = !roadShape(x - 1, y), rt = !roadShape(x + 1, y);
      if (S.closed[k]) { R(C.roadLo, dx, dy, T, T); continue; } // 통제선 안쪽: 불 꺼진 바닥만(테이프는 district.js)
      if (!tileLit(k)) {
        R(C.road, dx, dy, T, T);
        if (up) R(C.roadHi, dx, dy, T, 1); if (dn) R(C.roadLo, dx, dy + T - 1, T, 1);
        if (lf) R(C.roadHi, dx, dy, 1, T); if (rt) R(C.roadLo, dx + T - 1, dy, 1, T);
        if (S.last && !S.lit[k]) lastBeacon(dx, dy, beat); else R(C.node, dx + 5, dy + 5, 2, 2);
        const e = a - S.eraseT[k];
        if (e >= 0 && e < 16) { // 지워진 칸: 테이프 노이즈가 잠깐 끓다가 꺼진다
          ctx.globalAlpha = 1 - e / 16;
          for (let i = 0; i < 6; i++) R(Math.random() < .5 ? C.white : C.pink, dx + Math.random() * T, dy + Math.random() * T, 1 + (Math.random() * 2 | 0), 1);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      R(C.violet, dx, dy, T, T);
      if (up) R(C.vlit, dx, dy, T, 1); if (dn) R(C.deep, dx, dy + T - 1, T, 1);
      if (lf) R(C.vlit, dx, dy, 1, T); if (rt) R(C.deep, dx + T - 1, dy, 1, T);
      R(lamp, dx + 5, dy + 5, 2, 2);
      const age = a - S.litT[k];
      if (age < 12) { ctx.globalAlpha = 1 - age / 12; R(C.white, dx, dy, T, T); ctx.globalAlpha = 1; }
      if (clear >= 0) { const d = Math.abs(clear * .7 - S.clearOrder[k]); if (d < 2) { ctx.globalAlpha = (2 - d) / 2; R(C.white, dx, dy, T, T); ctx.globalAlpha = 1; } }
      if (S.out) { const d = S.out.order[k] - S.out.t * S.out.rate; if (d < 5) { ctx.globalAlpha = (5 - d) / 5 * .6; R(C.ink, dx, dy, T, T); ctx.globalAlpha = 1; } }
    }
  }
  // 터널 입구: 미로 틀이 끊긴 자리(평소엔 8번째 줄 양 끝, 4구역은 위아래 가장자리도). 청록 점 세 개가 바깥으로 흐른다(지나갈 수 있다는 표시)
  function drawTunnels() {
    const dots = (x, y, horiz, out) => {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = ((S.anim >> 3) + i) % 3 === 0 ? .9 : .25;
        if (horiz) R(C.cyan, x + (out ? 2 : 0), y + 2 + i * 3, 2, 2); else R(C.cyan, x + 2 + i * 3, y + (out ? 2 : 0), 2, 2);
      }
      ctx.globalAlpha = 1;
    };
    for (const row of WARP.rows) {
      const y = MY + row * T;
      for (const [x, out] of [[MX - 4, false], [MX + MW * T, true]]) { R(C.road, x, y, 4, T); dots(x, y, true, out); }
    }
    for (const col of WARP.cols) {
      const x = MX + col * T;
      for (const [y, out] of [[MY - 4, false], [MY + MH * T, true]]) { R(C.road, x, y, T, 4); dots(x, y, false, out); }
    }
  }
  // 카세트: 네 모서리에서 박자에 맞춰 살짝 떠오르고, 아래에 분홍 빛 한 점(주울 것). 위에 테이프 종류 표시(▶ · ▶▶ · ◀◀)
  function drawCassettes() {
    if (!S.cas) return;
    const k = (S.beatT % fpb()) / fpb();
    for (const c of S.cas) {
      if (c.got) continue;
      const x = px(c.x), y = py(c.y) + (k < .25 ? -1 : 0);
      glow(x, py(c.y) + 1, 10, C.pink, .3 + (1 - k) * .25);
      ob('cas', x - 7, y - 5);
      if (S.D) tapeIcon(c.kind, x, y - 9);
    }
  }
  /* ================= 구역 그리기: 선로 · 건널목 · 열차 · 셔터 · 골목 · 통제선 · 탐조등 · 정전 · 전광판 · B-SIDE · 테이프 표시 ================= */
  // 새 물체도 색 규칙을 그대로 따른다: 무너진 도시의 기계는 무채색, 위험(열차 · 건널목 · 경보)은 빨강, 곧 닫힘 · 들킬락 말락은 노랑, 테이프는 분홍
  // 모두 논리 px 정수 단위로 찍은 픽셀 그림이다. 이 자리에 넣을 더 좋은 그림의 제작 지시서는 docs/higgsfield-assets.md의 '콘텐츠 확장 에셋'
  const tileX = x => MX + x * T, tileY = y => MY + y * T;

  /* ================= 선로 · 건널목 · 열차 ================= */
  // 선로: 열차가 다니는 구역에선 8번 줄에 늘 레일 두 줄이 보인다(열차를 보기 전에도 '여긴 선로'라는 걸 안다)
  // 레일은 길보다 한 단계 밝은 선(꺼진 길 위엔 회색, 켜진 길 위엔 밝은 보라)
  function drawRails() {
    if (!S.D || !S.D.train) return;
    const y = tileY(WARP_Y);
    for (let x = -1; x <= MW; x++) {
      const k = tid(x, WARP_Y); if (k < 0 && x >= 0 && x < MW) continue;
      const dx = x < 0 ? MX - 4 : x >= MW ? MX + MW * T : tileX(x), w = k < 0 ? 4 : T, c = k >= 0 && tileLit(k) ? C.vlit : C.roadHi;
      R(c, dx, y + 3, w, 1); R(c, dx, y + 8, w, 1);
    }
  }
  // 건널목: 열차가 오는 동안 8번 줄로 들어가는 길목마다 빨강 · 흰 차단선과 좌우로 번갈아 깜빡이는 신호등
  const CROSS = [];
  for (let x = 0; x < MW; x++) if (ROAD[WARP_Y][x]) for (const dy of [-1, 1]) if (ROAD[WARP_Y + dy] && ROAD[WARP_Y + dy][x]) CROSS.push([x, dy]);
  function drawCrossings() {
    if (!S.trains || !S.trains.length) return;
    const blink = (S.anim >> 3) % 2;
    for (const [x, dy] of CROSS) {
      const dx = tileX(x), by = dy < 0 ? tileY(WARP_Y) - 1 : tileY(WARP_Y + 1);
      for (let i = 0; i < T; i += 2) R((i >> 1) % 2 ? C.white : C.red, dx + i, by, 2, 1);
      R(blink ? C.red : '#3a1520', dx - 2, by - (dy < 0 ? 2 : -1), 2, 2);
      R(blink ? '#3a1520' : C.red, dx + T, by - (dy < 0 ? 2 : -1), 2, 2);
    }
  }
  // 열차 한 칸(위에서 본 지붕). 그림(train.png, C01)이 있으면 그것을 — 오른쪽을 보는 그림이라 왼쪽으로 갈 땐 뒤집는다
  // 전조등 · 꼬리등은 뜻이 있는 빛이라 그림 위에 늘 코드로 찍는다(흰 = 실제 빛, 빨강 = 위험)
  function trainCar(x0, w, y, lead, tail, dir) {
    x0 = Math.round(x0); w = Math.round(w);
    const front = dir > 0 ? x0 + w - 1 : x0, back = dir > 0 ? x0 : x0 + w - 1;
    if (ok(IMG.train)) {
      const m = TRAIN_CAR[lead ? 0 : 1];
      ctx.save(); ctx.translate(dir > 0 ? x0 : x0 + w, y - 1); ctx.scale(dir > 0 ? 1 : -1, 1);
      ctx.drawImage(IMG.train, m[0], m[1], m[2], m[3], 0, 0, w, T); ctx.restore();
      if (lead) { R(C.white, front, y + 1, 1, 2); R(C.white, front, y + 7, 1, 2); }
      if (tail) { R(C.red, back, y + 2, 1, 1); R(C.red, back, y + 7, 1, 1); }
      return;
    }
    R(C.ink, x0 - 1, y - 1, w + 2, 12);
    R('#2c2c35', x0, y, w, 10); R('#43434e', x0, y, w, 1); R('#1b1b21', x0, y + 9, w, 1);
    R('#22222a', x0 + 2, y + 4, w - 4, 2);
    for (let i = 5; i + 6 < w; i += 13) { R('#4a4a55', x0 + i, y + 2, 6, 6); R('#1b1b21', x0 + i, y + 7, 6, 1); R('#5d5d69', x0 + i, y + 2, 6, 1); }
    if (lead) { R(C.white, front, y + 1, 1, 2); R(C.white, front, y + 7, 1, 2); }
    if (tail) { R(C.red, back, y + 2, 1, 1); R(C.red, back, y + 7, 1, 1); }
  }
  function drawTrains() {
    if (!S.trains || !S.trains.length) return;
    const G = GIMMICK.train, y = tileY(WARP_Y), cy = py(WARP_Y);
    for (const tr of S.trains) {
      if (tr.warn > 0) {
        // 들어오기 전: 들어올 쪽 터널 입구가 전조등으로 점점 밝아진다
        const k = 1 - tr.warn / G.warn, ex = tr.dir > 0 ? MX - 4 : MX + MW * T + 4;
        glow(ex, cy, 10 + 10 * k, C.white, .15 + .35 * k);
        continue;
      }
      ctx.save(); ctx.beginPath();
      ctx.rect(MX - 4, y, 11 * T + 4, T); ctx.rect(MX + 25 * T, y, 11 * T + 4, T); // 원형 구조물 밑은 지하라 보이지 않는다
      ctx.clip();
      const hx = MX + tr.x * T + T / 2, cw = G.car * T, gw = G.gap * T;
      for (let i = 0; i < G.cars; i++) {
        const near = hx - tr.dir * i * (cw + gw), x0 = tr.dir > 0 ? near - cw : near;
        trainCar(x0, cw, y + 1, i === 0, i === G.cars - 1, tr.dir);
        if (i > 0) R('#1b1b21', tr.dir > 0 ? near : near - gw, y + 4, gw, 2); // 연결부
      }
      // 전조등 빛: 앞쪽 길 세 칸이 차례로 옅어진다
      for (let j = 0; j < 3; j++) { ctx.globalAlpha = .12 - j * .035; R(C.white, tr.dir > 0 ? hx + j * T : hx - (j + 1) * T, y + 1, T, T - 2); }
      ctx.globalAlpha = 1;
      ctx.restore();
      glow(hx + tr.dir * 6, cy, 16, C.white, .22);
    }
  }

  /* ================= 셔터 ================= */
  // 길을 가로지르는 4px 두께의 철문. 늘 길 가장자리에 문틀(회색 점 두 개)이 보이고, 닫히기 전엔 문틀이 노랗게 깜빡인다
  // 닫히는 동안 한쪽 끝에서 반대쪽으로 내려오고, 걸리면(누가 서 있으면) 반쯤 내려온 채 덜컹거린다
  function drawShutters() {
    if (!S.shut) return;
    const G = GIMMICK.shutter;
    for (const s of S.shut) {
      const across = roadShape(s.x - 1, s.y) && roadShape(s.x + 1, s.y); // 가로 길이면 문은 세로로 선다
      const dx = tileX(s.x), dy = tileY(s.y), cx = px(s.x), cy = py(s.y);
      const roll = clamp((S.anim - s.t) / G.roll), k = s.jam ? .35 + ((S.anim >> 1) % 2) * .05 : s.closed ? roll : 1 - roll;
      const warn = (s.warn || s.jam) && (S.anim >> 2) % 2, frame = warn ? C.yellow : C.dim;
      if (across) { R(frame, cx - 2, dy, 4, 1); R(frame, cx - 2, dy + T - 1, 4, 1); }
      else { R(frame, dx, cy - 2, 1, 4); R(frame, dx + T - 1, cy - 2, 1, 4); }
      if (k <= 0) continue;
      const len = Math.max(1, Math.round(T * k));
      if (across) {
        const ox = s.jam ? ((S.anim >> 1) % 2) : 0;
        R(C.ink, cx - 3 + ox, dy - 1, 6, len + 1);
        for (let i = 0; i < len; i++) R(i % 2 ? '#3a3a45' : '#5d5d69', cx - 2 + ox, dy + i, 4, 1);
      } else {
        const oy = s.jam ? ((S.anim >> 1) % 2) : 0;
        R(C.ink, dx - 1, cy - 3 + oy, len + 1, 6);
        for (let i = 0; i < len; i++) R(i % 2 ? '#3a3a45' : '#5d5d69', dx + i, cy - 2 + oy, 1, 4);
      }
    }
  }

  /* ================= 골목 ================= */
  // 닫혀 있을 땐 블록 위아래 가장자리에 작은 철문 두 개만 보인다(여기 뭔가 있다는 암시)
  // 블록이 켜지면 문이 올라가며 건물 사이 통로가 양 끝에서 안쪽으로 드러나고, 다 열리면 바닥등(되살린 길의 연보라)이 켜진다
  function drawAlleys() {
    if (!S.alleys) return;
    for (const a of S.alleys) {
      const dx = tileX(a.x), top = tileY(a.y0), bot = tileY(a.y1 + 1), h = bot - top, k = easeOut(a.k);
      const art = ok(IMG.alley);
      if (k > 0) {
        const r = Math.round(h / 2 * k);
        ctx.save(); ctx.beginPath(); ctx.rect(dx, top, T, r); ctx.rect(dx, bot - r, T, r); ctx.clip();
        for (let y = a.y0; y <= a.y1; y++) {
          if (art) pix(IMG.alley, ALLEY.floor, dx, tileY(y)); // 통로 한 칸(C03): 낡은 타일 바닥 · 벽 · 연보라 바닥등
          else { R(C.ink, dx, tileY(y), T, T); R(C.roadLo, dx + 1, tileY(y), T - 2, T); R(C.road, dx + 2, tileY(y), T - 4, T); }
        }
        ctx.restore();
        if (!art && a.open) for (let y = a.y0; y <= a.y1; y++) R(C.lav, dx + 5, tileY(y) + 5, 2, 2);
      }
      // 문: 열리는 만큼 위로 말려 올라가 얇아진다
      if (art) {
        const dh = Math.round(ALLEY.door[3] * (1 - k));
        if (dh > 0) {
          const d = ALLEY.door;
          ctx.drawImage(IMG.alley, d[0], d[1] + d[3] - dh, d[2], dh, dx, top, T, dh);
          ctx.save(); ctx.translate(0, bot * 2); ctx.scale(1, -1); ctx.drawImage(IMG.alley, d[0], d[1] + d[3] - dh, d[2], dh, dx, bot, T, dh); ctx.restore();
        }
        continue;
      }
      const door = Math.round(3 * (1 - k));
      if (door > 0) for (const y of [top, bot - door]) { R(C.ink, dx, y, T, door); R(C.dim, dx + 1, y + (y === top ? 0 : door - 1), T - 2, 1); }
    }
  }

  /* ================= 통제선(3구역) ================= */
  // 막힌 길: 어두운 길 바닥 · 열린 길과 맞닿은 자리에 흰 · 검 줄무늬 테이프(노랑은 '곧 끝남' 전용이라 쓰지 않는다)
  // 풀리는 순간 테이프가 가운데서 끊어져 양쪽으로 처진다
  function closedTile(k) { return S.closed && S.closed[k]; }
  function drawClosed() {
    if (!S.D || !S.D.closed) return;
    const cut = S.cutT !== undefined && S.cutT > -1 ? S.anim - S.cutT : -1;
    if (cut > 24) return;
    for (const [x, y] of S.D.closed) {
      const dx = tileX(x), dy = tileY(y);
      for (const d of DORDER) {
        const nx = x + DV[d][0], ny = y + DV[d][1], nk = tid(nx, ny);
        if (nk < 0 || closedTile(nk) || S.D.closed.some(([cx, cy]) => cx === nx && cy === ny)) continue;
        const vert = d === 'up' || d === 'down', ex = d === 'right' ? dx + T - 2 : dx, ey = d === 'down' ? dy + T - 2 : dy;
        const sag = cut < 0 ? 0 : Math.round(cut * .25);
        ctx.globalAlpha = cut < 0 ? 1 : 1 - cut / 24;
        // 길 폭 그대로 이어진 띠: 검은 테두리 1px 안에 흰 · 회색 줄무늬(3px씩)
        if (cut < 0) { if (vert) R(C.ink, dx - 1, ey - 1, T + 2, 4); else R(C.ink, ex - 1, dy - 1, 4, T + 2); }
        for (let i = 0; i < T; i++) {
          if (cut >= 0 && i >= 5 && i <= 6) continue; // 가운데가 끊겼다
          const c = Math.floor(i / 3) % 2 ? C.dim : C.paper;
          if (vert) R(c, dx + i, ey + sag, 1, 2); else R(c, ex + sag, dy + i, 2, 1);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ================= 탐조등(3 · 4구역) ================= */
  // 바닥의 빛 웅덩이(흰 빛 + 점선 테두리)와 그 위에 떠 있는 회색 감시 드론. 빛 안에 들어가면 테두리가 노래지고(곧 들킨다), 들키면 빨개진다
  function drawLightPools() {
    if (!S.lights || !S.lights.length || S.dark) return;
    const G = GIMMICK.light, r = G.radius * T;
    for (const l of S.lights) {
      const x = px(l.x), y = py(l.y), held = l.hold > 0, near = l.spot > 0;
      glow(x, y, r * 1.3, held ? C.red : C.white, held ? .3 : .14);
      ctx.globalAlpha = held ? .9 : .6; ctx.strokeStyle = held ? C.red : near ? C.yellow : C.mist; ctx.lineWidth = 1;
      if (!held && !near) ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  function drawLightDrones() {
    if (!S.lights || !S.lights.length || !ok(IMG.obj)) return;
    for (const [i, l] of S.lights.entries()) {
      const x = Math.round(px(l.x)), y = Math.round(py(l.y)) - 20 + Math.round(Math.sin((S.anim + i * 30) / 12)), lens = S.dark ? C.dim : l.hold > 0 ? C.red : null;
      ctx.globalAlpha = S.dark ? .35 : 1;
      if (ok(IMG.searchdrone)) { // 감시 드론 그림(C02). 렌즈는 그림의 가운데 아래 — 들키면 빨갛게, 정전이면 꺼진다
        pix(IMG.searchdrone, SDRONE, x - 13, y - 4);
        if (lens) { R(lens, x - 2, y + 1, 4, 3); R(lens, x - 1, y, 2, 1); }
      } else {
        ctx.drawImage(grayPart(IMG.obj, OB['a' + (Math.floor(S.anim / 6 + i) % 4)]), x - 13, y - 6);
        R(lens || C.white, x - 1, y + 1, 2, 2); // 렌즈 = 빛이 나오는 곳
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================= 정전(3구역) ================= */
  // 도시 위에 어둠을 덮고 빛이 있는 곳만 도려낸다(주인공 · 열차 전조등 · 카세트). 그 위에 정전 중에 켠 길과 드론의 빨간 눈을 다시 그린다
  let DARKC = null, HOLE = null;
  function holeSprite() {
    if (HOLE) return HOLE;
    HOLE = canvas(64, 64); const g = HOLE.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return HOLE;
  }
  function drawDark() {
    const d = S.dark, a = darkAlpha(); if (!d || a <= 0) return;
    const G = GIMMICK.dark;
    if (!DARKC || DARKC.width !== W) DARKC = canvas(W, H);
    const g = DARKC.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    g.globalAlpha = a; g.fillStyle = C.ink; g.fillRect(MX - 4, MY - 4, MW * T + 8, MH * T + 8); g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    const L = holeSprite(), hole = (x, y, r) => g.drawImage(L, x - r, y - r, r * 2, r * 2);
    if (S.hero) hole(px(S.hero.x), py(S.hero.y) - 4, G.radius);
    for (const tr of S.trains) if (tr.warn <= 0) { const hx = MX + tr.x * T + T / 2; for (let j = 0; j < 3; j++) hole(hx + tr.dir * (6 + j * 14), py(WARP_Y), 20 - j * 3); }
    for (const c of S.cas) if (!c.got) hole(px(c.x), py(c.y), 12);
    if (d.phase === 'back') hole(px(BASE.x), py(BASE.y), easeOut(d.t / G.back) * 560);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(DARKC, 0, 0); ctx.restore();
    if (d.phase === 'warn') return;
    // 어둠 위: 정전 중에 켠 길(내가 남긴 빛)
    for (let k = 0; k < TILES.length; k++) {
      if (!S.lit[k] || S.litT[k] < d.start) continue;
      const [x, y] = TILES[k], dx = tileX(x), dy = tileY(y);
      ctx.globalAlpha = .55; R(C.violet, dx, dy, T, T); ctx.globalAlpha = 1; R(C.lav, dx + 5, dy + 5, 2, 2);
    }
    // 드론의 빨간 눈(몸은 보이지 않는다)
    S.drones.forEach((dr, i) => {
      if (dr.state !== 'run' || dr.static) return;
      const p = dronePos(dr, i), x = px(p.x), y = py(p.y) - 3 + Math.round(Math.sin((S.anim + i * 11) / 9) * 1.2) + (dr.kind === 'B' ? 0 : 1);
      glow(x, y, 7, C.red, .35); R(C.red, x - 1, y - 1, 3, 3);
    });
    drawUV();
  }

  /* ================= 전광판: 원형 구조물 가운데의 작은 화면 ================= */
  // 평소엔 순환선(원형 구조물) 노선 그림과 'D-1'이 어둡게 떠 있다 — 언제나 개통 하루 전, 오지 않는 미래
  // 도시에 반응한다: 열차가 오면 열차 그림 · 탐조등에 들키면 내 모습(감시 화면) · 맞으면 노이즈 · 정전이면 꺼진다
  // 기지에서 기다리는 드론과 겹치지 않게 구멍의 아래쪽에 가는 띠로 둔다(감시 화면만 잠깐 크게 — 그땐 드론이 모두 밖에 있다)
  function screenBox(x0, y0, w, h, a = .85) {
    ctx.globalAlpha = a; R(C.ink, x0, y0, w, h); ctx.globalAlpha = 1;
    R(C.line, x0, y0, w, 1); R(C.line, x0, y0 + h - 1, w, 1); R(C.line, x0, y0, 1, h); R(C.line, x0 + w - 1, y0, 1, h);
  }
  function drawBillboard() {
    if (!S.D || (S.dark && darkAlpha() > 0)) return;
    const cx = Math.round(px(BASE.x)), cy = Math.round(py(BASE.y));
    if (S.phase === 'clear') {
      // 순환선 개통 공연(IDIOTAPE): 노이즈가 한 번 지나간 뒤 그날이 온다 — 표시 · 이름 · D-0. 무대가 열리면 화면은 꺼진다
      const t = S.phaseT - (LIVE_AT - 50);
      if (!S.live || t < 0 || t > 70) return;
      const w = 48, h = 14, x0 = cx - w / 2, y0 = cy + 3;
      screenBox(x0, y0, w, h, .92);
      if (t < 12) { for (let i = 0; i < 24; i++) R(Math.random() < .5 ? C.dim : C.mist, x0 + 2 + Math.random() * (w - 5), y0 + 2 + Math.random() * (h - 5), 1, 1); return; }
      ctx.globalAlpha = t > 58 ? (70 - t) / 12 : 1;
      mark(x0 + 4, y0 + 2, C.pink); ledText('IDIOTAPE', x0 + 14, y0 + 2, C.paper); ledText('D-0', x0 + 20, y0 + 8, C.white);
      ctx.globalAlpha = 1;
      return;
    }
    if (S.alarm > 0 && S.hero) { // 감시 화면: 회색으로 찍힌 내 모습 · 빨간 녹화 점
      const w = 40, h = 32, x0 = cx - w / 2, y0 = cy - h / 2;
      screenBox(x0, y0, w, h, .92);
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + 1, y0 + 1, w - 2, h - 2); ctx.clip();
      drawRider(S.hero, cx, y0 + 21, { tint:C.mist }); ctx.restore();
      if ((S.anim >> 4) % 2) R(C.red, x0 + 3, y0 + 3, 3, 3);
      return;
    }
    const w = 48, h = 14, x0 = cx - w / 2, y0 = cy + 3;
    screenBox(x0, y0, w, h);
    if (S.phase === 'dead' || S.phase === 'lost' || S.glitch > 0) { // 신호가 끊긴 화면
      for (let i = 0; i < 24; i++) R(Math.random() < .5 ? C.dim : C.mist, x0 + 2 + Math.random() * (w - 5), y0 + 2 + Math.random() * (h - 5), 1, 1);
      return;
    }
    if (S.trains.length) { // 열차 접근: 작은 열차가 오는 쪽에서 들어오고, 양 끝 빨간 점이 번갈아 깜빡인다
      const tr = S.trains[0], k = (S.anim % 50) / 50, tx = Math.round(tr.dir > 0 ? x0 + 6 + k * (w - 26) : x0 + w - 20 - k * (w - 26));
      R(C.mist, tx, y0 + 5, 14, 4); R(C.ink, tx + 6, y0 + 5, 1, 4); R(C.white, tr.dir > 0 ? tx + 13 : tx, y0 + 6, 1, 2);
      const b = (S.anim >> 3) % 2; R(b ? C.red : C.line, x0 + 2, y0 + 6, 2, 2); R(b ? C.line : C.red, x0 + w - 4, y0 + 6, 2, 2);
      return;
    }
    // 광고: 순환선 노선 그림(고리) + D-1
    // 구역이 갈수록 광고가 이상해진다: 1구역 그대로 → 2 · 3구역 10초에 한 번 D-0이 몇 프레임 비친다 → 4구역 D-0이 되었다가 되감긴다
    const loop = S.D.ad === 'loop', ph = S.anim % 600, zero = loop ? ph >= 420 && ph < 480 : S.D.ad === 'flicker' && ph < 5;
    if (loop && ph >= 480 && ph < 500) {
      for (let i = 0; i < 20; i++) R(C.dim, x0 + 2 + Math.random() * (w - 6), y0 + 2 + Math.random() * (h - 5), 2, 1);
      if (S.D.trace && S.D.trace.ad && ph >= 488 && ph < 491) mark(cx - 3, y0 + 4, C.pink); // 되감기는 노이즈 사이로 한 프레임 — 그 표시
      return;
    }
    const remember = liveSeen && ph >= 300 && ph < 345; // 공연을 본 뒤로는 광고 고리 자리에 가끔 그 표시가 남는다
    ctx.globalAlpha = .8;
    if (flipped()) { ctx.save(); ctx.translate(cx * 2, 0); ctx.scale(-1, 1); } // 돌아온 도시: 광고 글자까지 거울에 비친 것처럼
    const rx = x0 + 6, ry = y0 + 3;
    if (remember) mark(rx + 1, ry + 1, C.rose);
    else {
      R(C.mist, rx + 2, ry, 6, 1); R(C.mist, rx + 2, ry + 7, 6, 1); R(C.mist, rx, ry + 2, 1, 4); R(C.mist, rx + 9, ry + 2, 1, 4);
      R(C.mist, rx + 1, ry + 1, 1, 1); R(C.mist, rx + 8, ry + 1, 1, 1); R(C.mist, rx + 1, ry + 6, 1, 1); R(C.mist, rx + 8, ry + 6, 1, 1);
    }
    num(zero ? 'D-0' : 'D-1', x0 + 20, y0 + 3, zero ? C.white : C.paper, 8);
    if (flipped()) ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ================= B-SIDE · 테이프 표시 ================= */
  // B-SIDE: 아직 들어 보지 못한 테이프라 회색. 천천히 숨 쉬는 분홍 빛 한 점만 둔다(가까이 가면 또렷해진다)
  function drawBside() {
    if (!bsideShown() || S.bside.got || !ok(IMG.obj)) return;
    const b = S.bside, x = px(b.x), y = py(b.y), near = S.hero ? Math.hypot(S.hero.x - b.x, S.hero.y - b.y) < 4 : false;
    glow(x, y + 1, 10, C.pink, (near ? .35 : .14) + .08 * Math.sin(S.anim / 20));
    if (ok(IMG.bside)) pix(IMG.bside, BSIDE[0], x - 7, y - 5); else ctx.drawImage(grayPart(IMG.obj, OB.cas), Math.round(x - 7), Math.round(y - 5));
  }
  // 테이프 위의 작은 표시: ▶ PLAY · ▶▶ FF · ◀◀ REW (5px 높이, 검은 1px 그림자). (x, y) = 가운데
  function tapeIcon(kind, x, y, col = C.white) {
    const tri = (ox, back, c) => { for (let r = 0; r < 3; r++) R(c, x + ox + (back ? 2 - r : r), y - 2 + r, 1, 5 - r * 2); };
    const shape = c => { if (kind === 'ff') { tri(-3, false, c); tri(1, false, c); } else if (kind === 'rew') { tri(-3, true, c); tri(1, true, c); } else tri(-1, false, c); };
    ctx.save(); ctx.translate(1, 1); shape(C.ink); ctx.restore(); shape(col);
  }

  /* ================= IDIOTAPE의 흔적 (js/events.js) ================= */
  // 표시: 웃는 얼굴을 한 카세트(테이프 릴 두 개가 눈). 전단지 · 형광 낙서 · 전광판에서 같은 모양으로 되풀이된다 — "이거 아까도 본 것 같은데?"
  const MARK = ['#######', '##.#.##', '#######', '#.###.#', '##...##'];
  function mark(x, y, col, hole = null) {
    MARK.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') R(col, x + i, y + j, 1, 1); else if (hole) R(hole, x + i, y + j, 1, 1); }));
  }
  // 전광판 LED 글자(3×5). 이름은 공연 날 전광판에 한 번만 나온다
  const LED = { I:['###', '.#.', '.#.', '.#.', '###'], D:['##.', '#.#', '#.#', '#.#', '##.'], O:['###', '#.#', '#.#', '#.#', '###'], T:['###', '.#.', '.#.', '.#.', '.#.'],
                A:['.#.', '#.#', '###', '#.#', '#.#'], P:['##.', '#.#', '##.', '#..', '#..'], E:['###', '#..', '##.', '#..', '###'], '-':['...', '...', '###', '...', '...'], 0:['###', '#.#', '#.#', '#.#', '###'] };
  function ledText(str, x, y, col) { [...str].forEach((ch, k) => (LED[ch] || []).forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') R(col, x + k * 4 + i, y + j, 1, 1); }))); }
  // 낡은 공연 전단지(9×8): 바랜 종이 · 분홍 표시 · 청록 글줄 · 찢긴 모서리. 밟으면 살짝 들썩인다
  function flyer(x, y) {
    const lift = S.anim - S.flutter < 14 ? -Math.round(Math.sin((S.anim - S.flutter) / 14 * Math.PI) * 2) : 0;
    x = Math.round(x) - 4; y = Math.round(y) - 4 + lift;
    if (lift) R('rgba(0,0,0,.4)', x + 1, y + 8 - lift, 8, 1);
    R(C.ink, x - 1, y - 1, 11, 10); R('#b9b2a2', x, y, 9, 8); R('#8f897c', x, y + 7, 9, 1);
    mark(x + 1, y + 1, C.pink, '#b9b2a2'); R(C.sky, x + 1, y + 6, 6, 1);
    R(C.ink, x + 8, y, 1, 1); R(C.ink, x + 7, y, 1, 1); R(C.ink, x + 8, y + 1, 1, 1); // 찢긴 모서리
  }
  function drawTraces() {
    const at = S.D && flyerAt(); if (at) flyer(px(at[0]), py(at[1]));
  }
  // 3구역: 정전 중에만 통제선 너머 바닥에 형광 표시가 떠오른다(어둠 위에 그린다)
  function drawUV() {
    const tr = S.D && S.D.trace; if (!tr || !tr.uv || !S.dark || S.dark.phase !== 'dark') return;
    const x = px(tr.uv[0]), y = py(tr.uv[1]), a = .45 + .2 * Math.sin(S.anim / 18);
    glow(x, y, 9, C.pink, a * .5); ctx.globalAlpha = a; mark(x - 3, y - 2, C.pink); ctx.globalAlpha = 1;
  }
  /* ================= 라이더: 사람 · 차체 · 바퀴를 따로 그린다 ================= */
  // 표지 주인공(금발 · LED 두 개 달린 고글 · 흰 셔츠 · 로봇 오른팔 · 백팩)이 브라운관 전조등을 단 검은 바이크(청록 패널 · 청록 바퀴 테)를 탄다
  // 기준 디자인은 docs/assets/higgsfield-2026-10-28/rider-model-sheet.png. 1배 픽셀아트, 오른쪽(왼쪽은 뒤집기) · 뒤 · 앞
  // 그림은 scripts/rider-art.mjs가 도형으로 찍어 만든다. 사람과 차체가 다른 층이라
  //   바퀴는 실제로 간 거리만큼 돌고 · 차체는 스프링으로 눌렸다 돌아오고 · 사람은 가속에 뒤로, 제동에 앞으로 쏠린다
  // 다리는 옆모습에서 하나만 보이고, 앞 · 뒤에선 차체 옆판 뒤에 숨는다. 바퀴엔 살이 없다(돌아가는 살이 다리처럼 보이지 않게)
  const RIDER_ART = /*ART*/{
    pal:{ k:'#07080e', d:'#1a2030', m:'#2f3b55', l:'#55688c', e:'#9aa6bb', c:'#5ff3ff', b:'#2a9fc0', r:'#ff5470', t:'#e8fdff', T:'#5ff3ff', n:'#0e3b4a',
          K:'#07080e', W:'#f2eee4', G:'#b4b1c2', D:'#77748a', Y:'#ffcf4a', H:'#d48a2a', P:'#1d1d27', Q:'#363648', V:'#5ff3ff', F:'#efc39a', S:'#e9e9f2', E:'#8f97a8', M:'#5b6275' },
    sideBike:[
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '....................k.............',
      '...................kekkkkkkkk.....',
      '.............kkkkkkkkeemmmmmmk....',
      '..kkkk......klllllllllmlllllTk....',
      '.kmlllkkkkkkkmmmmmmmmmmmmmmmtk....',
      'krcccmldmmmmmmmmmmcccmmddddmTk....',
      '.kkbbccccmmmmmmmmmmtttmmmmmmmk....',
      '..kekbbbmmmmmmmmmmmmcccmmmmmk.....',
      '..kellleeccmddddddddcccddelk......',
      '...kkkkllllccddddddcccddkeklk.....',
      '.......kkkmmmmdddddbbddk.kelk.....',
      '......kkmmmmkkkkkkkkkkk..keklk....',
      '.....kmmmmkk..............kelk....',
      '.....kmmkk................kek.....',
      '......kk...................k......',
      '..................................',
      '..................................'
    ],
    sideRider:[
      '...............KYKYKYK............',
      '..............KYYYYYYYK...........',
      '..............KYYYYYYYYK..........',
      '..............KYYYYYYYYK..........',
      '..............KKKKKKKSKK..........',
      '..........KKKKKHHYYYFFFK..........',
      '.........KPPPQKKHHHYFFFK..........',
      '.........KPQQPPWWWWWWKK...........',
      '.........KWPPPWWWEEEEEK...........',
      '........KWWWWDDGGMMMMK............',
      '........KGGWWWWKKKKKK.............',
      '.......KPPPPPPPPPK................',
      '.......KPPPPPPPPPPK...............',
      '........KKKKKKKPPQK...............',
      '.............KKPQK................',
      '............KSSSK.................',
      '.............KKK..................',
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '..................................'
    ],
    upBike:[
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '.k..............k.',
      'kek............kek',
      '.kekkkkkkkkkkkkek.',
      '.kmmmddddddddmmmk.',
      '.kmcmmmmmmmmmmcmk.',
      '.kmcmccttttccmck..',
      '..kcddddddddddck..',
      '..kcddddrrddddck..',
      '...kmddddddddeek..',
      '....kkkkkkkkkelk..',
      '.............kk...'
    ],
    upRider:[
      '.....KYKYKYKK.....',
      '....KYYYYYYYYK....',
      '...KYYYYYYYYYYK...',
      '...KYYYYYYYYYYK...',
      '...KKKKKKKKKKKK...',
      '...KHHYYYYYYHHK...',
      '...KKHHHHHHHHK....',
      '..KWWWWWWWWWWWK...',
      '.KWWWWPQQQQQWWWK..',
      '.KWWWWPPPPPPWWEWK.',
      'KFWGWWPPSSPPWWWMEK',
      '.KKGWWPPPPPPWWKGK.',
      '...KKGGGGGGGGGKK..',
      '.....KKKKKKKKK....',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................'
    ],
    downBike:[
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      'k................k',
      'ekkkkkkkkkkkkkkkke',
      'keemmmmmmmmmmmmeek',
      '.kcmmTTTTTTTTmmck.',
      '.kcmmttttttttmmck.',
      '..kcmTTTTTTTTmmck.',
      '..kcmTnnTTnnnmck..',
      '..kcmmmmmmmmmmck..',
      '...kkebbbbbbekk...',
      '....kekkkkkkek....',
      '....kek....kek....',
      '.....k......k.....'
    ],
    downRider:[
      '.....KYKYKYKK.....',
      '....KYYYYYYYYK....',
      '...KYYYYYYYYYYK...',
      '...KYYYYYYYYYYK...',
      '...KKKSKKKKSKKK...',
      '...KHKKKKKKKKHK...',
      '...KYFFFFFFFFYK...',
      '....KFFGGGGFFK....',
      '...KKKKKKKKKKKK...',
      '.KKEWWWKKKKWWWWKK.',
      'KEMGGGWWWWWWWGGGFK',
      '.KKKKKKKKKKKKKKKK.',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................'
    ],
    wheel:[
      '...kkkkk...',
      '..kdddddk..',
      '.kddcccddk.',
      'kddcnnncddk',
      'kdcnnnnncdk',
      'kdcnnenncdk',
      'kdcnnnnncdk',
      'kddcnnncddk',
      '.kddcccddk.',
      '..kdddddk..',
      '...kkkkk...'
    ],
    tire:[
      '.kkkk.',
      'kddddk',
      'kdmmdk',
      'kddddk',
      'kdmmdk',
      'kddddk',
      '.kkkk.'
    ]
  }/*END*/;
  // 방향별 짜임(그림 좌표): 차체 · 사람 층, 바퀴 자리(왼쪽 위), 땅에 닿는 점. 옆모습의 앞 · 뒤 바퀴 중심은 들어 올릴 때의 축
  const RIG = {
    side:{ bike:'sideBike', rider:'sideRider', wheels:[[1, 13], [22, 13]], ground:[17, 24], rear:-10.5, front:10.5 },
    up:{ bike:'upBike', rider:'upRider', tire:[6, 16], ground:[9, 23] },
    down:{ bike:'downBike', rider:'downRider', tire:[6, 17], ground:[9, 24] }
  };
  const RIDER_GROUND = 5;   // 칸 중심에서 바퀴가 닿는 줄까지(px)
  // 그림 → 캔버스(층 · 색마다 한 번). tint = 한 색 실루엣(분홍 잔상 · 피격 번쩍 · 감시 화면)
  const RIDER_IMG = new Map();
  function riderLayer(name, tint = null, map = RIDER_ART[name]) {
    const key = name + (tint || '');
    if (RIDER_IMG.has(key)) return RIDER_IMG.get(key);
    const c = canvas(map[0].length, map.length), g = c.getContext('2d');
    map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = tint || RIDER_ART.pal[ch]; g.fillRect(x, y, 1, 1); } }));
    RIDER_IMG.set(key, c); return c;
  }
  // 바퀴 한 바퀴 = 8칸. 테두리 위 밝은 점 둘과 접지면 무늬 둘이 실제 굴러간 거리만큼 돈다(오른쪽으로 갈 때 시계 방향)
  const RIM = [[5, 2], [7, 3], [8, 5], [7, 7], [5, 8], [3, 7], [2, 5], [3, 3]], TREAD = [[7, 1], [9, 3], [9, 7], [7, 9], [3, 9], [1, 7], [1, 3], [3, 1]];
  function wheelFrame(i, tint) {
    const name = 'wheel' + (i & 3);
    if (!RIDER_IMG.has(name + (tint || ''))) {
      const m = RIDER_ART.wheel.map(r => [...r]);
      for (const j of [i & 3, (i & 3) + 4]) { const [rx, ry] = RIM[j], [tx, ty] = TREAD[j]; m[ry][rx] = 't'; m[ty][tx] = 'l'; }
      riderLayer(name, tint, m.map(r => r.join('')));
    }
    return riderLayer(name, tint);
  }
  // 앞 · 뒤 타이어 무늬 3장. i는 굴러간 칸 수(뒤로 갈 땐 음수) — 늘 0~2로 접는다(음수 나머지로 없는 줄을 읽으면 그리기가 멈춘다)
  function tireFrame(i, tint) {
    const f = mod(i, 3), name = 'tire' + f;
    if (!RIDER_IMG.has(name + (tint || ''))) {
      const m = RIDER_ART.tire.map(r => r.replace(/m/g, 'd'));
      for (let y = 1 + f; y < m.length - 1; y += 3) m[y] = m[y].slice(0, 2) + 'mm' + m[y].slice(4);
      riderLayer(name, tint, m);
    }
    return riderLayer(name, tint);
  }
  // 기기 픽셀 단위로만 움직인다(4배 화면이면 0.25px 단위). 픽셀 모양은 그대로, 움직임은 부드럽게
  const snap = v => Math.round(v * SX) / SX;
  const IDLE_BIKE = { speed:0, wheel:0, pitch:0, lean:0, spring:0, bank:0, air:0, idle:0 };
  // 한 대 그리기. x, y = 칸 중심. o.tint = 실루엣 색, o.alpha = 투명도, o.rim = 몸 둘레 빛(PLAYBACK)
  function drawRider(h, x, y, o = {}) {
    const dir = h.dir || 'down', b = h.bike || { ...IDLE_BIKE, wheel:(h.walk || 0) * T }, calm = FEEL.reduced;
    const side = dir === 'left' || dir === 'right', rig = RIG[side ? 'side' : dir], flip = dir === 'left';
    const gx = x, gy = y + RIDER_GROUND, air = b.air || 0, tint = o.tint || null;
    const spring = calm ? 0 : b.spring, lean = calm ? 0 : b.lean, pitch = calm ? 0 : b.pitch, bank = calm ? 0 : b.bank;
    const hum = !calm && b.speed < .01 && b.idle ? ((b.idle >> 1) % 2) * .25 : 0;      // 서 있을 때 엔진 떨림
    const bob = calm ? 0 : Math.sin(b.wheel * .35) * Math.min(1, b.speed * 9) * .35;      // 노면을 타는 작은 오르내림
    ctx.save(); ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    // 그림자: 떠 있으면 작아지고 옅어진다
    if (!tint) { const s = clamp(1 + air / 24); ctx.globalAlpha *= .5 * s + .2; R('#000', gx - (side ? 13 : 6) * s, gy - 1, (side ? 26 : 12) * s, 2); ctx.globalAlpha /= .5 * s + .2; }
    ctx.translate(snap(gx), snap(gy + air));
    if (flip) ctx.scale(-1, 1);
    if (side && pitch) { const p = pitch < 0 ? rig.rear : rig.front; ctx.translate(p, 0); ctx.rotate(pitch); ctx.translate(-p, 0); }
    if (bank) ctx.rotate(flip ? -bank : bank);
    const ox = -rig.ground[0], oy = -rig.ground[1];
    const pass = (dx, dy, t) => {
      if (side) { const f = Math.floor(b.wheel / 3.2); for (const [wx, wy] of rig.wheels) ctx.drawImage(wheelFrame(f, t), ox + wx + dx, oy + wy + dy); }
      else ctx.drawImage(tireFrame(Math.floor(b.wheel / 2.5) * (dir === 'up' ? 1 : -1), t), ox + rig.tire[0] + dx, oy + rig.tire[1] + dy);
      ctx.drawImage(riderLayer(rig.bike, t), ox + dx, snap(oy + dy + spring * .55 + hum));
      // 사람: 옆에선 뒤(가속) · 앞(제동)으로, 앞 · 뒤 모습에선 화면 위아래로 쏠린다
      const rx = side ? -lean : 0, ry = side ? Math.abs(lean) * .3 : dir === 'up' ? lean : -lean;
      ctx.drawImage(riderLayer(rig.rider, t), snap(ox + dx + rx), snap(oy + dy + spring + bob + ry + hum * .5));
    };
    if (o.rim) { ctx.globalAlpha *= .85; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pass(dx, dy, o.rim); ctx.globalAlpha /= .85; }
    pass(0, 0, tint);
    ctx.restore();
  }
  // 쓰러진 바이크: 맞은 순간 하얗게 번쩍(Hit Stop) → 차체는 옆으로 누우며 미끄러지고, 사람은 튕겨 나가 구른다 → 누운 채 연기
  // 움직이는 방향 = 마지막으로 달리던 방향. 앞 · 뒤로 달리다 맞아도 옆모습으로 쓰러진다(눕는 모양이 읽히게)
  function drawCrash(h, x, y) {
    const b = h.bike, t = S.freeze > 0 ? 0 : S.phaseT, k = easeOut(clamp(t / 24)), [dx, dy] = DV[h.dir || 'right'];
    const face = h.dir === 'left' || (h.dir !== 'right' && b.face < 0) ? 'left' : 'right', hard = b.impact || 1;
    if (S.freeze > 0) { drawRider(h, x, y, { tint:(S.freeze >> 1) % 2 ? C.white : C.red }); return; }
    const slide = 9 * hard * k, sx = x + dx * slide, sy = y + dy * slide;
    const lay = { ...h, dir:face, bike:{ ...b, pitch:0, lean:0, spring:0, bank:0, air:0, speed:0 } };
    // 차체: 기울어지며 납작하게(옆으로 누운 모습)
    ctx.save(); ctx.translate(snap(sx), snap(sy + RIDER_GROUND)); ctx.rotate((face === 'left' ? -1 : 1) * .35 * k); ctx.scale(1, 1 - .42 * k); ctx.translate(-sx, -(sy + RIDER_GROUND));
    drawRiderPart(lay, sx, sy); ctx.restore();
    // 사람: 포물선으로 날아가 한 바퀴 반 구르고 옆으로 눕는다
    const fly = clamp(t / 30), side = face === 'left' ? -1 : 1, spin = easeOut(fly) * Math.PI * 2;
    const rxp = sx + dx * 12 * hard * easeOut(fly) + side * 5 * fly, ryp = sy - 4 + fly * 5 + dy * 12 * hard * easeOut(fly) - Math.sin(fly * Math.PI) * 10 * hard;
    ctx.save(); ctx.translate(snap(rxp), snap(ryp)); ctx.scale(side, 1 - .3 * fly); ctx.rotate(spin); ctx.drawImage(riderLayer('sideRider'), -15, -8); ctx.restore();
    // 누운 뒤: 엔진에서 가는 연기
    if (t > 24 && !FEEL.reduced) for (let i = 0; i < 3; i++) {
      const a = mod(S.anim * .02 + i / 3, 1); ctx.globalAlpha = (1 - a) * .35; R(C.mist, sx + (i - 1) * 2 + Math.sin(a * 6 + i) * 2, sy - 2 - a * 14, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // 차체 층만(쓰러질 때 사람과 따로 움직인다)
  function drawRiderPart(h, x, y) {
    const rig = RIG.side;
    ctx.save(); ctx.translate(snap(x), snap(y + RIDER_GROUND)); if (h.dir === 'left') ctx.scale(-1, 1);
    const ox = -rig.ground[0], oy = -rig.ground[1];
    for (const [wx, wy] of rig.wheels) ctx.drawImage(wheelFrame(0), ox + wx, oy + wy);
    ctx.drawImage(riderLayer(rig.bike), ox, oy);
    ctx.restore();
  }
  /* ================= 길 위에 남는 것: 고무 자국 · 꼬리등 빛 · 전조등 ================= */
  // 미로는 움직이지 않는다. 대신 바이크가 지나간 흔적이 길 위에 남아 속도를 보여 준다
  function drawMarks() {
    if (!S.marks.length) return;
    ctx.save(); ctx.strokeStyle = '#04050a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const m of S.marks) {
      ctx.globalAlpha = .55 * Math.min(1, m.t / m.max * 1.6);
      ctx.beginPath(); ctx.moveTo(MX + m.x0, MY + m.y0 + 4); ctx.lineTo(MX + m.x1, MY + m.y1 + 4); ctx.stroke();
    }
    ctx.restore();
  }
  // 꼬리등 빛: 지나온 길을 따라 가늘어지는 한 줄(터널로 건너뛴 곳은 끊는다). 빠를수록 길고, 테이프가 켜지면 분홍
  function drawLightTrail() {
    const h = S.hero; if (!h || !h.bike || S.phase === 'dead' || S.phase === 'lost' || FEEL.reduced) return;
    const p = h.bike.trail, n = p.length; if (n < 2) return;
    const col = S.playback > 0 || S.ff > 0 ? C.pink : C.cyan;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = col;
    for (let i = 1; i < n; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i]; if (Math.abs(x1 - x0) + Math.abs(y1 - y0) > 1) continue;
      const k = i / n; ctx.globalAlpha = k * k * .5; ctx.lineWidth = k > .6 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(px(x0), py(y0) + 3); ctx.lineTo(px(x1), py(y1) + 3); ctx.stroke();
    }
    ctx.restore();
  }
  // 전조등: 앞바퀴 앞의 길을 비추는 빛 부채꼴(그림 한 장을 90°씩만 돌려 쓴다 — 픽셀이 번지지 않는다)
  let BEAM = null;
  function beam() {
    if (BEAM) return BEAM;
    BEAM = canvas(44, 22); const g = BEAM.getContext('2d'), gr = g.createLinearGradient(0, 0, 44, 0);
    gr.addColorStop(0, 'rgba(232,253,255,.95)'); gr.addColorStop(.5, 'rgba(95,243,255,.4)'); gr.addColorStop(1, 'rgba(95,243,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 9); g.lineTo(44, 0); g.lineTo(44, 22); g.lineTo(0, 13); g.closePath(); g.fill();
    return BEAM;
  }
  function drawHeadlight(h, x, y, a = 1) {
    const dir = h.dir || 'down', [dx, dy] = DV[dir], on = h.moving ? .2 : .12;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = on * a * (S.dark ? 1.8 : 1);
    ctx.translate(Math.round(x + dx * (dx ? 13 : 4)), Math.round(y + 3 + dy * (dy > 0 ? 6 : 10)));
    ctx.rotate(Math.atan2(dy, dx)); ctx.drawImage(beam(), 0, -11); ctx.restore();
  }
  /* ================= 주인공 · 드론 그리기 ================= */
  // 주인공 = 청록 빛(PLAYBACK 동안 분홍), 위험한 드론 = 빨간 눈, 멈춘 드론 = 회색. 색만 봐도 무엇이 무엇인지 안다
  // 주인공은 라이더 한 대(js/render/rider.js). 발밑 빛 웅덩이 · 앞을 비추는 브라운관 전조등 · 지나온 길의 꼬리등 빛
  function drawHero() {
    const h = S.hero; if (!h) return;
    const x = px(h.x), y = py(h.y);
    if (S.phase === 'dead' || S.phase === 'lost') { drawCrash(h, x, y); return; }
    const play = S.playback > 0 || S.ff > 0, fading = S.playback > 0 && S.playback < BALANCE.playbackWarn, col = play ? (fading && (S.playback >> 3) % 2 ? C.yellow : C.pink) : C.cyan;
    const fade = mode === 'enter' ? clamp(1 - enterT / 12) : 1;
    if (fade <= 0) return;
    glow(x, y + 4, play ? 16 : 12, col, (play ? .4 : .22) * fade);
    drawHeadlight(h, x, y, fade);
    // 보호 중: 깜빡인다(아케이드의 약속 그대로). PLAYBACK: 몸 둘레에 분홍 빛 테두리(능력이 켜진 몸)
    const blink = h.inv > 0 && (h.inv >> 2) % 2;
    drawRider(h, x, y, { alpha:(blink ? .35 : 1) * fade, rim:play ? col : null });
  }
  // PLAYBACK · 빨리 감기 잔상: 지나온 자리에 분홍 라이더가 옅게 남았다 사라진다(가장 최근 몇 장만 — 속도의 번짐)
  function drawTrail() {
    const h = S.hero; if (!h) return;
    for (const p of S.trail.slice(-4)) drawRider({ dir:p.dir, bike:h.bike }, px(p.x), py(p.y), { alpha:p.t / p.max * .22, tint:C.pink });
  }
  // 선입력 표시: 꺾을 갈림길 칸에 화살표. 가까워질수록 밝아진다
  function drawTurnCue() {
    const h = S.hero; if (!h || S.phase !== 'run' && S.phase !== 'ready') return;
    const c = turnAhead(h); if (!c) return;
    const x = px(c.x), y = py(c.y), [wx, wy] = DV[h.want], d = Math.abs(c.x - h.x) + Math.abs(c.y - h.y);
    const col = S.playback > 0 ? C.pink : C.cyan, k = Math.max(.65, 1 - d / BALANCE.turnLook), bob = (S.anim >> 3) % 2;
    ctx.globalAlpha = .6 * k; R(col, x - 5, y - 5, 10, 10); ctx.globalAlpha = .85; R(C.night, x - 4, y - 4, 8, 8);
    ctx.globalAlpha = k; arrow(x - wx * (2 - bob), y - wy * (2 - bob), h.want, col); // 상자 가운데에서 꺾을 쪽으로 까딱인다
    ctx.globalAlpha = 1;
  }
  // 드론: 위험하면 빨간 눈(추격 중엔 눈에 빨간 빛이 번진다). 카세트가 재생되면 회색으로 굳어 떨리고 머리 위에 ‖
  // 끝나 갈 땐 ‖가 노래지고 회색 ↔ 원래 모습으로 깜빡여 곧 다시 위험해진다는 걸 알린다. 잡히면 테이프 노이즈 줄이 되어 기지로
  function drawDrone(d, i) {
    const p = dronePos(d, i), x = px(p.x), gy = py(p.y), y = gy - 3 + Math.round(Math.sin((S.anim + i * 11) / 9) * 1.2);
    if (d.state === 'back') {
      for (let j = 0; j < 4; j++) { ctx.globalAlpha = .7 - j * .15; R(j % 2 ? C.pink : C.white, x - 7 + Math.random() * 4, y - 4 + j * 2, 10 + Math.random() * 4, 1); }
      ctx.globalAlpha = 1; return;
    }
    const fr = (d.kind === 'B' ? 'b' : 'a') + (Math.floor(d.frame / 6) % 4), m = OB[fr];
    if (!m || !ok(IMG.obj)) return;
    const sx = Math.round(x - m[2] / 2), sy = Math.round(y - (d.kind === 'B' ? 9 : 7));
    // 카세트 재생 중엔 기지에서 나오는 드론도 멈춘 모습(나오자마자 멈추니까)
    const fading = S.playback > 0 && S.playback < BALANCE.playbackWarn, blinkOn = fading && (S.playback >> 3) % 2;
    const still = (d.static || d.state === 'exit' && S.playback > 0) && !blinkOn || S.phase === 'clear';
    const danger = (d.state === 'run' || d.state === 'exit') && !still;
    const warn = S.waveWarn > 0 && (S.waveWarn >> 2) % 2;
    R('rgba(0,0,0,.45)', x - 5, gy + 4, 10, 2);
    if (d.state === 'home') ctx.globalAlpha = .6;
    if (still) {
      const jx = Math.random() < .3 ? (Math.random() < .5 ? -1 : 1) : 0;
      ctx.drawImage(grayPart(IMG.obj, m), sx + jx, sy);
      if (d.state === 'run') { const c = fading ? C.yellow : C.mist; R(c, x - 3, sy - 8, 2, 5); R(c, x + 1, sy - 8, 2, 5); }
    } else {
      const ex = x, ey = sy + (d.kind === 'B' ? 9 : 8);
      if (danger && (S.chase || S.alarm > 0 || warn)) glow(ex, ey + 3, 9, C.red, .32); // 추격 중: 드론 아래로 번지는 빨간 빛(몸은 가리지 않는다)
      pix(IMG.obj, m, sx, sy);
      if (danger && !warn) R(C.red, ex - 1, ey - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
    // 추격으로 바뀌는 순간 · 바뀌기 직전: 머리 위 느낌표
    if (d.state === 'run' && !d.static && ((S.waveFx > 0 && (S.chase || S.alarm > 0) && (S.waveFx >> 2) % 2) || warn)) txt('!', x, sy - 11, C.red, 8, 'center');
  }
  // 되감기 · 과거의 나: 분홍 반투명 라이더(테이프가 다시 트는 지난 장면). 되감기는 앞을 본 채 뒤로 달린다
  function drawGhostAt(x, y, dir, f, a) {
    drawRider({ dir, walk:f }, px(x), py(y), { alpha:a, tint:C.pink });
  }
  function drawGhosts() {
    if (S.rew > 0 && S.rewPath && S.rewPath.length) { const p = S.rewPath[Math.min(S.rewI, S.rewPath.length - 1)]; drawGhostAt(p[0], p[1], p[2], (S.anim >> 2) % 4, .55); }
    const g = S.ghost; if (!g) return;
    // 기록 사이(2프레임)는 이어서 그린다. 터널을 건너뛴 자리는 잇지 않는다
    const p = g.path[g.i], q = g.path[Math.min(g.i + 1, g.path.length - 1)], k = g.end ? 0 : (g.t % GIMMICK.ghost.step) / GIMMICK.ghost.step;
    const jump = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 1, x = jump ? p[0] : p[0] + (q[0] - p[0]) * k, y = jump ? p[1] : p[1] + (q[1] - p[1]) * k;
    drawGhostAt(x, y, p[2], p[3] ? (g.i >> 1) % 4 : 0, g.end ? .5 * (1 - g.end / 30) : .5);
  }
  function drawActors() {
    // 터널 밖으로 나간 모습은 미로 틀 안쪽에서만 보인다(위아래로 이어진 4구역은 위아래도)
    ctx.save(); ctx.beginPath(); ctx.rect(MX - 19, MY - 40, MW * T + 38, MH * T + 80); ctx.clip();
    drawMarks(); drawLightTrail(); drawTrail(); drawGhosts();
    const outside = e => e.y < -.01 || e.y > MH - .99;
    const edge = (e, draw) => () => {
      if (!outside(e)) { draw(); return; }
      ctx.save(); ctx.beginPath(); ctx.rect(MX - 1, MY - 4, MW * T + 2, MH * T + 8); ctx.clip(); draw(); ctx.restore();
    };
    const list = S.drones.map((d, i) => [dronePos(d, i).y, edge(d, () => drawDrone(d, i))]);
    if (S.hero) list.push([S.hero.y + .01, edge(S.hero, drawHero)]);
    list.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());
    ctx.restore();
  }
  // 파편 · 고리 · 떠오르는 점수
  function drawFx() {
    for (const r of S.rings) {
      const k = 1 - r.t / r.max, rad = r.r * (.15 + easeOut(k) * .85);
      ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = r.c; ctx.lineWidth = k < .3 ? 1.5 : 1;
      if (r.dash) ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.ellipse(MX + r.x, MY + r.y, rad, rad * .8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const p of S.parts) { ctx.globalAlpha = Math.min(1, p.t / 10); R(p.c, MX + p.x, MY + p.y, p.s, p.s); }
    for (const p of S.pops) {
      const a = Math.min(1, p.t / 14), s = p.big && p.t > 44 ? 1 + (p.t - 44) * .06 : 1;
      ctx.globalAlpha = a;
      if (s !== 1) { ctx.save(); ctx.translate(MX + p.x, MY + p.y); ctx.scale(s, s); txt(p.text, 0, 0, p.c, 8, 'center'); ctx.restore(); }
      else txt(p.text, MX + p.x, MY + p.y, p.c, 8, 'center');
    }
    ctx.globalAlpha = 1;
  }
  /* ================= HUD: 위 한 줄 = 생명 · 구역 | 점수 | 복원율 / 아래 = 그때만 필요한 것(PLAYBACK 타이머 · 추격 · 다음으로) ================= */
  // 미로 폭에 맞춰 양 끝 정렬. 이름표는 회색 Silkscreen 8, 값은 흰 Press Start 2P 8. 색은 뜻이 있을 때만(하트 · 진행 청록 · PLAYBACK 분홍)
  // HUD는 흔들리지 않고, 게임 그림보다 튀지 않는다. 화면 아래 줄은 평소엔 비어 있다
  const HUD_Y = 12;
  function drawHUD(k = 1) {
    if (k <= 0) return;
    const left = MX, right = MX + MW * T, y = HUD_Y;
    ctx.save(); ctx.globalAlpha = k; ctx.translate(0, Math.round(-(1 - k) * 12));
    // 생명: 잃는 순간 하트가 하얗게 번쩍인 뒤 조각나 떨어진다. 하나 남으면 마지막 하트가 빨갛게 뛴다
    for (let i = 0; i < HP; i++) {
      const x = left + i * 12;
      if (i === S.heartFx && S.heartT > 0) {
        const t = 48 - S.heartT;
        if (t < 10) { ob('heart', x, y); if ((t >> 1) % 2 === 0) ctx.drawImage(tintPart(IMG.obj, OB.heart, C.white), x, y); }
        else { ob('heart0', x, y); ctx.globalAlpha = k * Math.max(0, 1 - (t - 10) / 30); for (let j = 0; j < 4; j++) R(C.pink, x + 2 + (j % 2) * 4 + (j % 2 ? 1 : -1) * (t - 10) * .3, y + 2 + (j >> 1) * 3 + (t - 10) * (t - 10) * .012, 2, 2); ctx.globalAlpha = k; }
        continue;
      }
      ob(i < S.hp ? 'heart' : 'heart0', x, y);
      if (S.hp === 1 && i === 0 && S.phase === 'run' && (S.anim >> 4) % 2) { ctx.globalAlpha = .7 * k; ctx.drawImage(tintPart(IMG.obj, OB.heart, C.red), x, y); ctx.globalAlpha = k; }
    }
    stat('STAGE', String(S.stage).padStart(2, '0'), left + 48, y);
    // 점수: 크게 오를 때 살짝 튄다. 최고 기록을 넘으면 청록 + 옆에 NEW BEST
    const sf = S.scoreFx > 0 ? S.scoreFx / 16 : 0, beat = best > 0 && S.score > best;
    num(String(Math.round(S.displayScore)).padStart(7, '0'), W / 2, y - Math.round(sf * 2), beat ? C.cyan : C.paper, 8, 'center');
    if (S.bestFx > 0 && (S.bestFx > 40 || (S.bestFx >> 2) % 2)) txt('NEW BEST', W / 2 + 36, y, C.cyan, 8, 'left', null);
    // 복원율: 이름표 · 막대 · 숫자. 25% 단계를 넘으면 막대가 한 번 하얗게 빛난다
    const frac = S.litN / TILES.length, pct = Math.floor(frac * 100) + '%', bw = 56, bx = right - 40 - bw;
    num(pct, right, y, C.paper, 8, 'right');
    R(C.line, bx, y + 3, bw, 2); R(S.segFx > 0 && (S.segFx >> 2) % 2 ? C.white : C.cyan, bx, y + 3, Math.round(bw * frac), 2);
    txt('CITY', bx - 6, y, C.mist, 8, 'right', null);
    ctx.restore();
    drawStatus(k);
  }
  // 아래 줄: 지금 필요한 것 하나만 가운데에. 추격 중엔 왼쪽에 빨간 점과 CHASE
  function drawStatus(k) {
    const left = MX, right = MX + MW * T, y = MY + MH * T + 13;
    ctx.save(); ctx.globalAlpha = k;
    if (S.phase === 'clear') {
      if (S.phaseT >= clearSkipAt()) prompt('PRESS ANY KEY', W / 2, y, k);
    } else if (S.playback > 0 || S.ff > 0) {
      // 켜진 테이프마다: 종류 표시 · 카세트 · 남은 시간 막대 · 초. 끝나기 전엔 노랗게 깜빡인다. 둘이 함께 켜지면 나란히(막대가 짧아진다)
      const tapes = [];
      if (S.playback > 0) tapes.push(['play', S.playback, S.playMax, S.playback < BALANCE.playbackWarn]);
      if (S.ff > 0) tapes.push(['ff', S.ff, S.ffMax, S.ff < 60]);
      const bw = tapes.length > 1 ? 64 : 120, gw = 60 + bw, x0 = Math.round(W / 2 - (gw * tapes.length + 16 * (tapes.length - 1)) / 2);
      tapes.forEach(([kind, t, max, fading], i) => {
        const gx = x0 + i * (gw + 16), bx = gx + 30, col = fading && (t >> 3) % 2 ? C.yellow : C.pink;
        tapeIcon(kind, gx + 3, y + 3, col); ob('cas', gx + 9, y - 1);
        R(C.line, bx, y + 3, bw, 2); R(col, bx, y + 3, Math.ceil(bw * t / max), 2);
        num((t / 60).toFixed(1), bx + bw + 6, y, col, 8);
      });
    }
    if (S.phase === 'run' && S.playback <= 0 && (S.chase || S.alarm > 0 || S.waveWarn > 0)) { // 카세트 재생 중엔 추격 시계가 멈춘다. 탐조등 경보도 추격
      const on = S.alarm > 0 ? (S.anim >> 2) % 2 : S.chase ? (S.anim >> 4) % 2 : (S.waveWarn >> 2) % 2;
      R(on ? C.red : C.line, left, y + 2, 4, 4);
      txt('CHASE', left + 8, y, S.chase || S.alarm > 0 ? C.red : C.mist, 8, 'left', null);
    }
    if (muted || S.muteFx > 0) speaker(right - 10, y, !muted);
    ctx.restore();
  }
  // 소리 표시: 스피커 + 켜져 있으면 물결, 꺼져 있으면 ×
  function speaker(x, y, on) {
    const c = on ? C.mist : C.dim;
    R(c, x, y + 2, 2, 4); for (let i = 0; i < 3; i++) R(c, x + 2 + i, y + 2 - i, 1, 4 + i * 2);
    if (on) { R(c, x + 7, y + 2, 1, 4); R(c, x + 9, y + 1, 1, 6); }
    else for (let i = 0; i < 4; i++) { R(c, x + 7 + i, y + 2 + i, 1, 1); R(c, x + 10 - i, y + 2 + i, 1, 1); }
  }
  /* ================= 순환선 개통 공연(IDIOTAPE) ================= */
  // B-SIDE를 모두 들은 사람이 순환선을 끝내면(js/events.js의 concertReady), 오지 않던 개통 기념 공연이 원형 구조물에서 열린다
  // 전광판이 'IDIOTAPE · D-0'을 비춘 뒤(render/district.js) 무대의 홀로그램 투사기가 켜지고 세 멤버가 연주한다. 이름을 붙이는 UI는 없다
  // 연주자 그림은 LOOP NIGHT의 band.png를 그대로 쓰고, 이 게임의 분홍 · 청록으로 물들인다. 박자마다 타격 프레임
  function bandFrame(part, f) { const b = BAND[part]; return [b.w * (f % b.n), b.y, b.w, b.h]; }
  function drawLive() {
    if (S.phase !== 'clear' || !S.live || !ok(IMG.band)) return;
    const t = S.phaseT - LIVE_AT; if (t < 0) return;
    const a = Math.min(1, t / 30, (CLEAR_T + LIVE_T - LIVE_AT - t) / 30); if (a <= 0) return;
    const cx = px(BASE.x), cy = py(BASE.y) + 16, beat = Math.floor(S.beatT / fpb()), hitF = (S.beatT % fpb()) < fpb() * .3 ? 1 + (beat % 2) : 0;
    // 원형 구조물 가운데에서 빛 기둥이 솟고, 그 안에 세 멤버가 선다
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .4 * a;
    const g = ctx.createLinearGradient(0, cy - 64, 0, cy + 2); g.addColorStop(0, 'rgba(255,79,216,0)'); g.addColorStop(1, 'rgba(255,79,216,.85)');
    ctx.fillStyle = g; ctx.fillRect(cx - 66, cy - 64, 132, 66);
    ctx.globalCompositeOperation = 'source-over';
    const s = .46, parts = [['synth', -44], ['drum', 0], ['synth', 44]];
    parts.forEach(([p, ox], i) => {
      const m = bandFrame(p, (hitF + i) % 3), w = Math.round(m[2] * s), h = Math.round(m[3] * s), x = Math.round(cx + ox - w / 2), y = Math.round(cy - h);
      ctx.globalAlpha = .35 * a; ctx.drawImage(huePart(IMG.band, m, C.cyan), x + 2, y, w, h);
      ctx.globalAlpha = a * (Math.random() < .04 ? .45 : 1); ctx.drawImage(huePart(IMG.band, m, C.pink), x, y, w, h);
    });
    ctx.globalAlpha = .35 * a; for (let y = cy - 64; y < cy; y += 3) R(C.ink, cx - 66, y, 132, 1); // 투사된 빛의 결(홀로그램)
    ctx.globalAlpha = 1;
  }
  /* ================= 타이틀: 게임과 같은 도시 위의 LED 간판 ================= */
  // 따로 그린 표지 대신 실제 미로 도시가 첫 화면이다. 데모 주인공이 회색 도시의 길을 하나씩 밝히고, 둘러싼 블록이 색을 되찾는다
  // 화면 위엔 로고와 PRESS ANY KEY(그리고 기록이 있으면 BEST)만. 로고는 원형 구조물 위에 걸린 간판처럼
  // 켜짐: 어둠에서 도시가 떠오르고(UI.titleIn) → 간판 글자가 왼쪽부터 깜빡이며 켜진다(UI.logoOn) → PRESS ANY KEY
  // 평소엔 조용하다: 10초쯤에 한 번 간판 글자 하나가 잠깐 꺼졌다 켜진다(낡은 간판). PRESS ANY KEY는 박자에 밝기만 숨 쉰다
  // 시작: 누른 순간 PRESS ANY KEY가 두 번 번쩍 → 간판이 꺼지고, 데모가 밝힌 불이 주인공 자리에서부터 꺼진다 → 어두워진 같은 도시에서 게임이 시작된다
  let LOGO_SHADE = null;
  function logoShade() {
    if (LOGO_SHADE) return LOGO_SHADE;
    LOGO_SHADE = canvas(128, 64); const g = LOGO_SHADE.getContext('2d'), gr = g.createRadialGradient(64, 32, 0, 64, 32, 64);
    gr.addColorStop(0, 'rgba(9,9,12,.92)'); gr.addColorStop(.55, 'rgba(9,9,12,.7)'); gr.addColorStop(1, 'rgba(9,9,12,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    return LOGO_SHADE;
  }
  function logoFlick(t) {
    if (FEEL.reduced || t < UI.logoAt + UI.logoOn + 60) return -1;
    const ph = t % UI.flicker; if (ph >= 8 || (ph >> 1) % 2) return -1;
    return Math.floor(hash(Math.floor(t / UI.flicker)) * 8);
  }
  // 방치하면 같은 도시 위에 설명 한 장과 기록 한 장
  function drawInfo(page) {
    if (page === 1) {
      word('how', W / 2, 14);
      const t = titleT, list = [
        ['01', K.t1, K.d1, (x, y) => { for (let i = 0; i < 3; i++) { const on = i <= (t >> 4) % 4; R(on ? C.violet : C.road, x - 18 + i * 12, y - 6, 12, 12); R(on ? C.lav : C.node, x - 13 + i * 12, y - 1, 2, 2); } }],
        ['02', K.t2, K.d2, (x, y) => { const on = (t >> 5) % 2, b = BLOCKS[0]; ctx.drawImage(on ? IMG.lit : (ART.city || IMG.gray), b.x * CITY_K, b.y * CITY_K, b.w * CITY_K, b.h * CITY_K, x - 16, y - 12, 32, 24); }],
        ['03', K.t3, K.d3, (x, y) => { const m = OB['a' + ((t >> 3) % 4)]; pix(IMG.obj, m, x - 12, y - 8); R(C.red, x - 1, y - 1, 3, 3); }],
        ['04', K.t4, K.d4, (x, y) => { glow(x, y + 1, 10, C.pink, .35); ob('cas', x - 7, y - 3); tapeIcon(['play', 'ff', 'rew'][(t >> 5) % 3], x, y - 8); }],
        ['05', K.t5, K.d5, (x, y) => { R(C.cyan, x - 5, y - 5, 10, 10); R(C.ink, x - 4, y - 4, 8, 8); arrow(x + ((t >> 3) % 2), y, 'right', C.cyan); }]
      ];
      const lx = Math.round(W / 2 - 196);
      list.forEach(([nn, ti, d, ic], i) => { const y = 44 + i * 36; feature(nn, ti, d, lx, y, ic); if (i < list.length - 1) dotted(lx, y + 30, 392); });
      ktxt(K.keys, W / 2, 228, C.mist, 11, 'center', 700);
    } else {
      const by = 70;
      txt('BEST SCORE', W / 2, by, C.mist, 8, 'center', null);
      num(String(best).padStart(7, '0'), W / 2, by + 16, C.white, 16, 'center');
      txt('BEST STAGE', W / 2, by + 52, C.mist, 8, 'center', null);
      num(String(bestStage).padStart(2, '0'), W / 2, by + 66, C.white, 16, 'center');
      // 찾은 B-SIDE: 구역마다 테이프 하나(찾은 것은 분홍, 아직은 회색)
      txt('B-SIDE', W / 2, by + 98, C.mist, 8, 'center', null);
      DISTRICTS.forEach((_, i) => { const x = Math.round(W / 2 - 38 + i * 20), found = bsideMask >> i & 1;
        if (ok(IMG.bside)) { pix(IMG.bside, BSIDE[found ? 1 : 0], x, by + 112); return; }
        if (!ok(IMG.obj)) return; if (found) ob('cas', x, by + 112); else ctx.drawImage(grayPart(IMG.obj, OB.cas), x, by + 112); });
      if (liveSeen) mark(Math.round(W / 2 + 46), by + 114, C.rose); // 공연을 본 사람에게만: B-SIDE 옆의 작은 표시
      txt('TRACK 02  FUTURE THAT NEVER COMES', W / 2, by + 142, C.dim, 8, 'center', null);
    }
  }
  // 화면 가장자리를 낮추는 비네트 · 아래쪽 글자 자리를 받치는 어둠(타이틀에서만 — 도시를 2배로 비추는 동안 가장자리가 산만하지 않게)
  let VIGNETTE = null;
  function vignette() {
    if (VIGNETTE && VIGNETTE.width === W) return VIGNETTE;
    VIGNETTE = canvas(W, H); const g = VIGNETTE.getContext('2d'), gr = g.createRadialGradient(W / 2, H * .45, H * .35, W / 2, H * .45, W * .62);
    gr.addColorStop(0, 'rgba(9,9,12,0)'); gr.addColorStop(1, 'rgba(9,9,12,.85)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const b = g.createLinearGradient(0, H - 56, 0, H); b.addColorStop(0, 'rgba(9,9,12,0)'); b.addColorStop(1, 'rgba(9,9,12,.9)');
    g.fillStyle = b; g.fillRect(0, H - 56, W, 56);
    return VIGNETTE;
  }
  function drawTitle() {
    const t = titleT, entering = mode === 'enter', ek = entering ? ease(clamp(enterT / UI.enter)) : 0;
    // 카메라: 2배로 가까이 → 시작하면 게임판(1배, 같은 자리)으로 물러난다. 정수 배율일 땐 픽셀을 그대로, 물러나는 동안만 부드럽게
    const from = entering ? S.camFrom : S.cam, z = TITLE_ZOOM - (TITLE_ZOOM - 1) * ek;
    const cx = from.x + (W / 2 - from.x) * ek, cy = from.y + (H / 2 - from.y) * ek;
    ctx.save();
    ctx.setTransform(SX * z, 0, 0, SY * z, Math.round((W / 2 - cx * z) * SX), Math.round((H / 2 - cy * z) * SY));
    ctx.imageSmoothingEnabled = z !== Math.round(z);
    drawBoard();
    ctx.restore();
    ctx.globalAlpha = 1 - ek; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(vignette(), 0, 0); ctx.restore();
    dim(.22 * (1 - ek), C.ink);
    const ly = Math.round(H * .4), sz = logoSize();
    const it = entering ? -1 : idleT - IDLE_T, info = it >= 0 ? Math.min(1, it / 20, (INFO_T * 2 - it) / 20) : 0;
    const la = 1 - info;
    if (la > 0) {
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = la * (1 - ek);
      ctx.drawImage(logoShade(), W / 2 - sz.w * .85, ly - sz.h * 1.3, sz.w * 1.7, sz.h * 2.6); ctx.restore();
      const on = entering ? 1 - clamp(enterT / 10) : clamp((t - UI.logoAt) / UI.logoOn);
      drawLogo(W / 2, ly, la, on, entering ? -1 : logoFlick(t));
    }
    if (info > 0) { dim(.88 * info, C.ink); if (info >= 1) drawInfo(Math.floor(it / INFO_T) < 1 ? 1 : 2); }
    // 아래: 가운데 PRESS ANY KEY · 오른쪽 BEST(게임 HUD 아래 줄과 같은 자리, 같은 글자)
    const y = MY + MH * T + 13, ua = entering ? 0 : clamp((t - UI.promptAt) / 20);
    if (entering) { if (enterT < 8 && (enterT >> 1) % 2 === 0) txt('PRESS ANY KEY', W / 2, y, C.white, 8, 'center'); }
    else {
      if (promptHover) { ctx.globalAlpha = ua * .16; R(C.cyan, W / 2 - 88, y - 5, 176, 17); ctx.globalAlpha = 1; }
      prompt('PRESS ANY KEY', W / 2, y, ua, 'center', t);
    }
    if (best > 0 && !entering) { ctx.globalAlpha = ua; stat('BEST', String(best).padStart(7, '0'), MX + MW * T, y, C.paper, 'right'); ctx.globalAlpha = 1; }
    if (muted || S.muteFx > 0) speaker(MX, y, !muted);
    // 처음 켜질 때: 어둠에서 떠오른다
    if (t < UI.titleIn) dim(1 - ease(t / UI.titleIn), C.ink);
  }
  /* ================= 알림 · 준비 · 복원 · 일시정지 · 결과 ================= */
  // 게임 중 알림은 모두 원형 구조물(드론 기지 = 길이 없는 블록) 위 같은 자리에, 같은 판으로 — 길을 가리지 않는다
  const relayC = () => [px(BASE.x), py(BASE.y)];
  const RELAY_W = 168; // 원형 구조물 블록 폭 그대로(길 위로 넘치지 않는다)
  // 판이 위아래로 열리며 나타나고(inT) 마지막 outT 동안 닫힌다
  function openK(t, max, inT = 6, outT = 8) { return Math.min(1, t / inT, (max - t) / outT); }
  function popPanel(k, x, y, w, h, accent, draw) {
    if (k <= 0) return;
    const hh = Math.max(2, Math.round(h * Math.min(1, k * 1.2)));
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5);
    panel(x, y + Math.round((h - hh) / 2), w, hh, accent);
    if (k >= .8) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); draw(); }
    ctx.restore();
  }
  // PLAYBACK: 카세트를 주운 순간 한 번. 그림 글자 + 무엇을 하면 되는지 한 줄
  function drawBanner() {
    const b = S.banner; if (!b || S.phase !== 'run') return;
    const [cx, cy] = relayC(), h = b.sub ? 48 : 32, k = openK(b.t, b.max);
    popPanel(k, cx - RELAY_W / 2, cy - h / 2, RELAY_W, h, b.c, () => {
      const y = cy - h / 2;
      if (b.art && WD[b.art]) word(b.art, cx, y + 8); else txt(b.title, cx, y + 9, b.c, 16, 'center');
      if (b.sub) ktxt(b.sub, cx, y + 31, C.paper, 11, 'center');
    });
  }
  // 안내방송: 원형 구조물 위 가는 판 하나 — 스피커 그림 · 한 줄. 위쪽 선은 회색(도시의 목소리, 뜻을 가진 색이 아니다)
  function drawPA() {
    const p = S.pa; if (!p || S.phase !== 'run' || S.banner) return;
    const [cx, cy] = relayC(), h = 26, k = openK(p.t, p.max);
    popPanel(k, cx - RELAY_W / 2, cy - h / 2, RELAY_W, h, C.mist, () => {
      const tw = kimg(p.text, 11, C.paper, 700).width, x0 = Math.round(cx - (tw + 16) / 2), y = Math.round(cy - h / 2);
      speaker(x0, y + 9, true);
      ktxt(p.text, x0 + 16, y + 6, C.paper, 11, 'left');
    });
  }
  // READY: 구역 번호 · READY · 이번 판에 할 일 한 줄 · 남은 준비 시간. 맞고 다시 나올 땐 READY만(목표는 이미 안다)
  function drawReady() {
    if (S.phase !== 'ready') return;
    const [cx, cy] = relayC(), t = S.phaseT, again = S.hero.inv > 0;
    const k = Math.min(1, t / 8, (S.readyT - t + 4) / 6), h = again ? 46 : 62, y = cy - h / 2;
    popPanel(k, cx - RELAY_W / 2, y, RELAY_W, h, C.cyan, () => {
      // 위 줄: 구역 번호 · 구역 이름. 아래 줄: 이 구역에서 처음 바뀌는 규칙 한 줄
      const label = 'STAGE ' + String(S.stage).padStart(2, '0'), name = S.D ? S.D.name : '';
      const lw = textW(label), nw = name ? kimg(name, 11, C.paper, 700).width : 0, lx = Math.round(cx - (lw + (name ? 6 + nw : 0)) / 2);
      txt(label, lx, y + 7, C.mist, 8, 'left', null);
      if (name) ktxt(name, lx + lw + 6, y + 4, C.paper, 11, 'left');
      word('ready', cx, y + 16);
      if (!again) ktxt(S.D ? S.D.goal : K.goal, cx, y + 42, C.paper, 11, 'center');
      R(C.line, cx - 60, y + h - 5, 120, 1); R(C.cyan, cx - 60, y + h - 5, Math.round(120 * Math.min(1, t / S.readyT)), 1);
    });
    // 첫 READY에만: 주인공 머리 위 YOU
    if (again || t < 6) return;
    const hx = px(S.hero.x), hy = py(S.hero.y) - 30 - ((S.anim >> 4) % 2);
    txt('YOU', hx, hy - 9, C.cyan, 8, 'center'); arrow(hx, hy + 2, 'down', C.cyan);
  }
  // 구역 복원: STAGE CLEAR → 보너스가 차례로 집계. 한 번도 안 맞았으면 PERFECT 줄이 더해지고 공연으로 넘어간다
  function drawClear() {
    const t = S.phaseT, [cx, cy] = relayC();
    if (t < 30) return;
    if (S.live && t >= LIVE_AT - 50) { if (S.perfect && t >= LIVE_AT && (t >> 4) % 4) word('perfect', cx, MY + 8); return; } // 공연 동안엔 판을 닫는다
    // 구역 복원 중엔 플레이가 멈춰 있어서, STAGE CLEAR 글자 폭만큼은 원형 구조물 밖으로 넓혀도 된다
    const k = Math.min(1, (t - 30) / 8), h = 40 + S.bonus.length * 12, y = Math.round(cy - h / 2), pw = Math.max(RELAY_W, WD.clear[2] + 16);
    popPanel(k, cx - pw / 2, y, pw, h, S.perfect ? C.pink : C.cyan, () => {
      word('clear', cx, y + 8);
      S.bonus.forEach(([lab, v], i) => {
        const at = 70 + i * 26; if (t < at) return;
        const yy = y + 36 + i * 12, shown = Math.round(v * Math.min(1, (t - at) / 20));
        txt(lab, cx - 68, yy, i ? C.pink : C.mist, 8, 'left', null); num('+' + shown, cx + 68, yy, i ? C.pink : C.cyan, 8, 'right');
      });
    });
  }
  function drawPause() {
    dim(.72, C.ink); const w = 200, h = 92, x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2);
    panel(x, y, w, h, C.mist);
    txt('PAUSED', W / 2, y + 16, C.white, 16, 'center');
    ktxt(K.pause, W / 2, y + 42, C.paper, 11, 'center');
    dotted(x + 16, y + 64, w - 32);
    txt('P  RESUME', x + 16, y + 72, C.mist, 8, 'left', null); txt('M  SOUND', x + w - 16, y + 72, C.mist, 8, 'right', null);
  }
  // 결과: 꺼진 도시 위에 — GAME OVER · 무엇에 끝났는지 · 점수 집계 · 기록 · 이번 판의 숫자 · 다음 판을 위한 요령 한 줄
  // 아무 키 한 번이면 바로 다시(BALANCE.overLock 동안은 실수로 넘기지 않게 막는다)
  function drawGameOver() {
    const t = S.overT, cx = W / 2, hit = S.lastHit;
    dim(Math.min(.82, t / 18), C.ink);
    // GAME OVER: 조금 위에서 내려앉으며 나타난다
    const wk = easeOut(clamp((t - 4) / 14));
    if (wk > 0) { ctx.globalAlpha = wk; word('over', cx, 26 - Math.round((1 - wk) * 6), 2); ctx.globalAlpha = 1; }
    if (t < 14) return;
    if (hit) ktxt(cause(hit), cx, 78, C.paper, 11, 'center');
    const w = 276, h = 128, x = Math.round(cx - w / 2), y = 98;
    popPanel(Math.min(1, (t - 14) / 8), x, y, w, h, C.red, () => {
      // 점수: 0에서부터 올라간다(틱 소리와 함께). 기록이면 마지막에 NEW RECORD
      const cnt = FEEL.reduced ? 1 : ease(clamp((t - 26) / 36));
      txt('SCORE', x + 16, y + 16, C.mist, 8, 'left', null);
      num(String(Math.floor(S.score * cnt)).padStart(7, '0'), x + w - 16, y + 12, C.white, 16, 'right');
      txt('BEST', x + 16, y + 38, C.mist, 8, 'left', null);
      num(String(best).padStart(7, '0'), x + w - 16, y + 38, newRecord ? C.cyan : C.mist, 8, 'right');
      if (newRecord && t > 66 && (t >> 3) % 4) chip('NEW RECORD', x + 60, y + 35, C.cyan);
      dotted(x + 16, y + 56, w - 32);
      // CATCH = 잡은 드론 + 열차에 쓸려 간 드론. B-SIDE = 이번 판에 찾은 숨긴 테이프
      const stats = [['STAGE', String(S.stage).padStart(2, '0'), C.paper], ['CITY', Math.round(S.peakLit / TILES.length * 100) + '%', C.cyan],
                     ['CATCH', String(S.rewound + S.swept).padStart(2, '0'), C.pink], ['B-SIDE', String(S.bsides), S.bsides ? C.pink : C.paper]];
      stats.forEach(([lab, val, c], i) => { const xx = x + 16 + i * 64; txt(lab, xx, y + 66, C.mist, 8, 'left', null); num(val, xx, y + 78, c, 8); });
      dotted(x + 16, y + 96, w - 32);
      const tip = hit ? (hit.fade ? TIPS.fade : TIPS[hit.kind]) : '';
      if (tip) ktxt(tip, cx, y + 104, C.mist, 11, 'center');
    });
    if (t >= BALANCE.overLock) {
      if (promptHover) { ctx.globalAlpha = .15; R(C.cyan, cx - 110, 235, 220, 17); ctx.globalAlpha = 1; }
      prompt('PRESS ANY KEY TO RETRY', cx, 240, 1, 'center', t);
      txt('ESC  TITLE', cx, 254, C.dim, 8, 'center', null);
    }
  }
  /* ================= 도시의 깊이: 카메라 초점 → 기울어지는 지붕 · 벽 창문 → 길 위 전선 · 간판 → 날씨 · 바람 ================= */
  // 미로는 움직이지 않는다(확대 · 회전 없음). 대신 위에서 내려다보는 카메라 초점이 라이더를 천천히 따라가고,
  // 높은 것일수록 초점에서 멀리 밀려 보인다(지붕 1배 · 길 위 간판 1.6배). 바이크가 달리면 도시 전체가 조금씩 기울어 높이가 생긴다
  // 판정 · 길 모양에는 손대지 않는다. 지붕은 자기 블록 안에서만 움직이고, 전선 · 간판은 1px 선과 작은 판이라 길을 가리지 않는다
  const LEAN_K = .012, LEAN_MAX = 2.5;
  function viewStep() {
    const v = S.view, h = S.hero, cx = MX + MW * T / 2, cy = MY + MH * T / 2;
    if (!v.init) { v.fx = cx; v.fy = cy; v.init = true; }
    const tx = h ? cx + (px(h.x) - cx) * .55 : cx, ty = h ? cy + (py(h.y) - cy) * .55 : cy;
    v.fx += (tx - v.fx) * .05; v.fy += (ty - v.fy) * .05;
    // 앞을 본다: 달리는 쪽으로 화면이 1.5px 먼저 간다(멈추면 돌아온다). ▶▶이 켜지는 순간엔 반대로 한 번 당겨진다
    const go = h && h.dir && h.moving && (S.phase === 'run' || S.phase === 'demo'), [dx, dy] = go ? DV[h.dir] : [0, 0];
    v.lx += (dx * 1.5 - v.lx) * .06; v.ly += (dy * 1.5 - v.ly) * .06;
    if (v.kick > 0) v.kick--;
    v.t++;
    // 전선: 라이더가 밑을 지나가면 바람에 한 번 출렁인다
    if (h && go) for (const c of CABLES) if (Math.abs(c.tx - h.x) + Math.abs(c.ty - h.y) < .6 && c.pluck < 1) c.pluck = 2.4 + h.bike.speed * 8;
    for (const c of CABLES) c.pluck *= .96;
  }
  // 블록 지붕이 초점에서 밀려난 양(px, 기기 픽셀 단위). 원형 구조물(땅에 뚫린 드론 기지)은 높이가 없다
  function blockLean(b, k = 1) {
    if (FEEL.reduced || b.ring || !S.view || !S.view.init) return [0, 0];
    const v = S.view, bx = MX + (b.x + b.w / 2) * T, by = MY + (b.y + b.h / 2) * T;
    return [snap(clamp((bx - v.fx) * LEAN_K * k, -LEAN_MAX * k, LEAN_MAX * k)), snap(clamp((by - v.fy) * LEAN_K * 1.2 * k, -LEAN_MAX * k, LEAN_MAX * k))];
  }
  // 도시가 얼마나 살아났나(0~1): 복원율이 대부분, 구역이 깊어질수록 · 추격 · ▶▶에 조금씩 더. 창문 · 전선 등 · 간판 · 날씨가 이 값을 따른다
  function cityEnergy() {
    return clamp(.1 + S.litN / TILES.length * .6 + Math.min(3, S.stage - 1) * .06 + (S.chase ? .08 : 0) + (S.ff > 0 ? .15 : 0));
  }
  const climax = () => S.last || S.litN / TILES.length > .8; // 끝이 보이는 구간: 도시 전체가 박자를 탄다
  // 벽: 지붕이 밀려난 쪽에 드러나는 띠. 되살린 블록은 창마다 불이 켜져 있고, 폐허는 몇 개만 — 도시가 살아날수록 늘어난다
  const WIN = [C.cyan, C.pink, '#ffd9a0', C.lav];
  function drawWalls(b, i, ox, oy, on) {
    const x = MX + b.x * T, y = MY + b.y * T, w = b.w * T, h = b.h * T, e = cityEnergy();
    R('#0a0b11', x, y, w, h);
    const lit = j => on || hash(i * 31 + j) < .04 + e * .22;
    ctx.globalAlpha = on ? .9 : .5;
    if (Math.abs(ox) >= .75) { const cx = ox > 0 ? x : x + w - 1; for (let j = 2; j < h - 2; j += 3) if (lit(j)) R(WIN[(i + j) % 4], cx, y + j, 1, 1); }
    if (Math.abs(oy) >= .75) { const cy = oy > 0 ? y : y + h - 1; for (let j = 2; j < w - 2; j += 3) if (lit(j + 50)) R(WIN[(i + j) % 4], x + j, cy, 1, 1); }
    ctx.globalAlpha = 1;
  }

  /* ================= 길 위 전선 · 간판(맨 앞 층) ================= */
  // 전선: 양쪽이 블록인 길 칸 몇 곳을 가로지른다(지도에서 한 번 고른다). 양 끝은 지붕에 붙어 지붕과 같이 기울고, 가운데는 늘어져 바람에 흔들린다
  // 전선 등: 도시가 살아날수록 하나씩 켜지고, 끝이 보이는 구간엔 박자에 맞춰 깜빡인다
  const blockAt = (x, y) => BLOCKS.findIndex(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  const CABLES = [];
  TILES.forEach(([x, y], k) => {
    if (hash(k * 7.3 + 11) > .16) return;
    const u = blockAt(x, y - 1), d = blockAt(x, y + 1), l = blockAt(x - 1, y), r = blockAt(x + 1, y);
    if (u >= 0 && d >= 0 && !BLOCKS[u].ring && !BLOCKS[d].ring) CABLES.push({ tx:x, ty:y, a:u, b:d, vert:true, lamp:hash(k) < .55, pluck:0, seed:k });
    else if (l >= 0 && r >= 0 && !BLOCKS[l].ring && !BLOCKS[r].ring) CABLES.push({ tx:x, ty:y, a:l, b:r, vert:false, lamp:hash(k) < .55, pluck:0, seed:k });
  });
  // 간판: 블록 모서리에서 길 쪽으로 튀어나온 세로 네온 간판(높은 곳이라 지붕보다 더 기운다). 되살린 블록의 간판만 켜진다
  const SIGNS = BLOCKS.map((b, i) => ({ b, i })).filter(({ b, i }) => !b.ring && hash(i * 3.7 + 2) < .45).map(({ b, i }) => {
    const right = hash(i * 1.9) < .5;
    return { b, i, x:right ? b.x + b.w : b.x, y:b.y + Math.min(b.h - 1, 1 + Math.floor(hash(i * 5.1) * (b.h - 1))), right, col:hash(i * 2.3) < .5 ? C.pink : C.cyan };
  });
  function drawOverhead() {
    if (FEEL.reduced) return;
    const v = S.view, e = cityEnergy(), beat = (S.beatT % fpb()) / fpb(), pulse = climax() && beat < .2;
    ctx.save(); ctx.beginPath(); ctx.rect(MX - 4, MY - 4, MW * T + 8, MH * T + 8); ctx.clip();
    // 간판: 판(어두운 철판) · 네온 글자 세 칸 · 길 위에 떨어지는 빛
    for (const s of SIGNS) {
      const st = S.blocks[s.i], on = st.on && S.anim - st.t > 22, [ox, oy] = blockLean(s.b, 1.6);
      const x = MX + s.x * T + ox + (s.right ? 0 : -4), y = MY + s.y * T + oy;
      R('#06070b', x, y, 4, 9); R('#1c1f2b', x + 1, y + 1, 2, 7);
      const flick = on && hash(s.i + Math.floor(S.anim / 7)) < .03; // 가끔 한 칸이 깜빡인다(낡은 네온)
      if (on || hash(s.i * 9) < e * .5) {
        ctx.globalAlpha = on ? (flick ? .3 : 1) : .35;
        for (let j = 0; j < 3; j++) R(s.col, x + 1, y + 1 + j * 2 + (j > 0 ? j - 1 : 0), 2, 1);
        ctx.globalAlpha = 1;
        if (on) glow(x + 2 + (s.right ? 4 : -4), y + 6, 8, s.col, pulse ? .3 : .16);
      }
    }
    // 전선
    ctx.lineWidth = .75; ctx.lineCap = 'round';
    for (const c of CABLES) {
      const A = BLOCKS[c.a], B = BLOCKS[c.b], [ax, ay] = blockLean(A), [bx, by] = blockLean(B);
      const wind = Math.sin(v.t * .021 + c.seed) * .7 + Math.sin(v.t * .053 + c.seed * 2) * .3, sag = 1.6 + wind + Math.sin(v.t * .3 + c.seed) * c.pluck;
      let x0, y0, x1, y1, mx, my;
      if (c.vert) { x0 = x1 = MX + c.tx * T + 3 + (c.seed % 6); y0 = MY + c.ty * T - 1 + ay; y1 = MY + (c.ty + 1) * T + 1 + by; x0 += ax; x1 += bx; mx = (x0 + x1) / 2 + sag; my = (y0 + y1) / 2; }
      else { y0 = y1 = MY + c.ty * T + 3 + (c.seed % 6); x0 = MX + c.tx * T - 1 + ax; x1 = MX + (c.tx + 1) * T + 1 + bx; y0 += ay; y1 += by; mx = (x0 + x1) / 2; my = (y0 + y1) / 2 + sag; }
      ctx.globalAlpha = .75; ctx.strokeStyle = '#020306';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
      if (c.lamp && hash(c.seed * 1.7) < e + .05) {
        const lx = (x0 + 2 * mx + x1) / 4, ly = (y0 + 2 * my + y1) / 4, col = hash(c.seed) < .3 ? C.pink : '#ffd9a0';
        ctx.globalAlpha = 1; R(col, lx - .5, ly, 1, 1);
        glow(lx, ly + 2, 5, col, pulse ? .5 : .22);
      }
    }
    ctx.restore();
  }

  /* ================= 젖은 길 · 날씨 · 속도 ================= */
  // 켜진 길에 근처 네온이 비친다(젖은 아스팔트). 짧은 두 줄이 박자 없이 아주 천천히 일렁인다
  function drawRoadReflections() {
    ctx.save();
    const t = FEEL.reduced ? 0 : S.anim;
    for (let k = 0; k < TILES.length; k++) {
      if (!tileLit(k)) continue;
      const [x, y] = TILES[k], dx = MX + x * T, dy = MY + y * T;
      if ((x + y) % 3 !== 0) continue;
      ctx.globalAlpha = .1 + .06 * Math.sin(t * .035 + x + y);
      R(C.cyan, dx + 2, dy + 9, 7, 1); R(C.pink, dx + 4, dy + 10, 5, 1);
    }
    ctx.restore();
  }
  // 비: 두 겹(먼 비는 느리고 옅게, 가까운 비는 빠르고 굵게). 개수가 정해져 있고 매 프레임 만들지 않는다. 도시가 살아날수록 빛을 받아 조금 밝다
  // 바람: 라이더 주변에서만 진행 반대로 흐른다. ▶▶ 동안엔 판 전체를 가로지르는 흐름선과 화면 가장자리 어둠이 더해진다
  function drawCityWeather() {
    if (FEEL.reduced) return;
    const t = S.anim, e = cityEnergy(), h = S.hero, moving = h && h.moving && (S.phase === 'run' || S.phase === 'demo');
    ctx.save(); ctx.beginPath(); ctx.rect(MX, MY, MW * T, MH * T); ctx.clip();
    for (let layer = 0; layer < 2; layer++) {
      const n = (layer ? 12 : 18) + Math.round(e * 10), fall = layer ? .85 : .3;
      ctx.strokeStyle = layer ? '#7ea4bf' : '#445570'; ctx.lineWidth = layer ? .6 : .45;
      ctx.globalAlpha = (layer ? .14 : .1) * (1 + e * .6);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = MX + mod(hash(i + layer * 37) * MW * T - t * fall * .25, MW * T), y = MY + mod(hash(i + 73 + layer) * MH * T + t * fall, MH * T);
        ctx.moveTo(x, y); ctx.lineTo(x - 1.2, y + 2 + layer * 2);
      }
      ctx.stroke();
    }
    if (moving && h.bike.speed > .04) {
      const [dx, dy] = DV[h.dir], fast = S.ff > 0, length = fast ? 15 : 7;
      ctx.strokeStyle = fast ? C.pink : C.cyan; ctx.lineWidth = .7;
      for (let i = 0; i < 6; i++) {
        const age = mod(t * .045 + i * .17, 1), offset = (i % 2 ? 1 : -1) * (8 + (i % 3) * 3);
        const x = px(h.x) - dx * (8 + age * 23) - dy * offset, y = py(h.y) - dy * (8 + age * 23) + dx * offset + 3;
        ctx.globalAlpha = (1 - age) * (fast ? .28 : .12); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dx * length, y - dy * length); ctx.stroke();
      }
      if (fast) {
        // 흐름선: 진행 축을 따라 판 전체를 빠르게 지나간다(가늘고 옅게 — 길과 드론은 그대로 읽힌다)
        const span = dx ? MW * T : MH * T, cross = dx ? MH * T : MW * T;
        ctx.lineWidth = .6;
        for (let i = 0; i < 14; i++) {
          const along = mod(hash(i * 7.1) * span - t * (5 + hash(i) * 4) * (dx || dy), span), side = hash(i * 3.3) * cross, len = 14 + hash(i * 1.3) * 26;
          const x = dx ? MX + along : MX + side, y = dx ? MY + side : MY + along;
          ctx.globalAlpha = .1 + hash(i * 2.9) * .08; ctx.strokeStyle = i % 3 ? C.white : C.pink;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  // ▶▶ 동안: 화면 가장자리가 어두워져 시야가 좁아진다(속도에 눌리는 느낌). 켜지는 순간 가장 진하다
  function drawSpeedEdge() {
    if (FEEL.reduced || !S.ff || S.phase !== 'run') return;
    const k = Math.min(1, S.ff / 30) * (.45 + .3 * (S.view.kick / 12));
    ctx.save(); ctx.globalAlpha = k; ctx.imageSmoothingEnabled = true; ctx.drawImage(vignette(), 0, 0); ctx.restore();
  }
  // 미로 바깥 원경: 먼 도시의 실루엣 세 겹이 초점과 반대로 아주 조금씩 밀린다(화면 양옆 · 아래 여백에서만 보인다)
  function drawCityDepth() {
    const v = S && S.view && S.view.init ? S.view : null, t = FEEL.reduced ? 0 : S ? S.anim : 0, e = S ? cityEnergy() : .2;
    ctx.save();
    for (let layer = 0; layer < 3; layer++) {
      const stride = 13 + layer * 9, drift = t * (.008 + layer * .012) + (v ? (v.fx - W / 2) * (.02 + layer * .03) : 0);
      ctx.globalAlpha = .2 + layer * .06;
      for (let i = -1; i < W / stride + 1; i++) {
        const x = mod(i * stride - drift, W + stride) - stride, height = 4 + hash(i + layer * 21) * 13;
        R(layer === 2 ? '#193245' : '#132032', x, H - height, stride - 3, height);
        if (i % 3 === 0 && hash(i * 5 + layer) < .3 + e * .6) R(i % 2 ? C.pink : C.cyan, x + 3, H - height + 3, 1, 1);
      }
    }
    glow(MX - 10, H * .42, 38, C.cyan, .06 + e * .08);
    glow(MX + MW * T + 10, H * .65, 42, C.pink, .06 + e * .08);
    ctx.restore();
  }
  /* ================= 화면 그리기: 레이어 순서 ================= */
  // 미로(흔들림만, 정수 px) → 알림 판 → HUD(흔들리지 않는다) → 번쩍임 · 피격 순간의 찢김 → 일시정지 · 결과
  // 원경 · 기울어지는 지붕 · 길 위 전선 · 젖은 길 · 날씨는 그림만 바꾼다(js/render/environment.js). 판정 · HUD에는 영향이 없다
  function drawPlaybackWash() {
    if (S.playback <= 0) return;
    // 카세트가 재생되는 동안: 미로가 아주 살짝 분홍으로 물든다(테두리 · 주인공 · 멈춘 드론과 함께 지금 상태를 알린다)
    const k = Math.min(1, (S.playMax - S.playback) / 12, S.playback / 30);
    ctx.globalAlpha = .05 * k; R(C.pink, MX, MY, MW * T, MH * T); ctx.globalAlpha = 1;
  }
  // 구역 물체(js/render/district.js)는 땅에 붙은 것(선로 · 셔터 · 통제선) → 길 위를 지나는 것(열차 · 빛 웅덩이) → 떠 있는 것(감시 드론) 순서
  // 정전의 어둠은 그 모두를 덮고, 효과(파편 · 점수)와 선입력 화살표만 어둠 위에 남는다
  function drawBoard() {
    drawFrame(); drawBlocks(); drawAlleys(); drawBillboard(); drawRoads(); drawRoadReflections(); drawRails(); drawClosed(); drawShutters(); drawCrossings();
    drawRelay(); drawTunnels(); drawCassettes(); drawBside(); drawTraces(); drawTurnCue();
    drawPlaybackWash(); drawTrains(); drawLightPools(); drawActors(); drawLightDrones(); drawOverhead();
    if (S.dark) { drawDark(); drawTurnCue(); }
    drawCityWeather(); drawFx(); drawLive();
  }
  // 화면 찢김: 이미 그린 화면을 가로 띠 몇 개만 옆으로 밀어 다시 그린다(피격 = 신호가 끊기는 순간에만 몇 프레임)
  function tear(n, amp) {
    if (FEEL.reduced) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < n; i++) {
      const y = Math.floor(Math.random() * cv.height), h = Math.floor((2 + Math.random() * 6) * SY), dx = Math.round((Math.random() - .5) * 2 * amp * SX);
      ctx.drawImage(cv, 0, y, cv.width, h, dx, y, cv.width, h);
    }
    ctx.restore();
  }
  function render() {
    ctx.setTransform(SX, 0, 0, SY, 0, 0); ctx.imageSmoothingEnabled = false;
    R(C.ink, 0, 0, W, H);
    drawCityDepth();
    if (mode === 'title' || mode === 'enter') { drawTitle(); return; }
    // 미로가 보이는 정도: 재시작 · 다음 구역은 어둠에서 떠오르고(S.boot), 구역이 끝나면 어두워진다
    const inK = S.boot > 0 ? 1 - S.boot / S.bootMax : 1, end = clearEnd(), outK = S.phase === 'clear' && S.phaseT > end - UI.fadeOut ? clamp((end - S.phaseT) / UI.fadeOut) : 1, vis = Math.min(inK, outK);
    ctx.save();
    if (S.shake > 0) { const a = FEEL.shakeMax * Math.min(1, S.shake / 8) * motion(); ctx.translate(Math.round((Math.random() - .5) * 2 * a), Math.round((Math.random() - .5) * 2 * a)); }
    // 앞을 보는 카메라: 달리는 쪽으로 1.5px(▶▶이 켜지는 순간엔 반대로 당겨진다). 미로 전체는 늘 화면 안
    if (!FEEL.reduced) { const v = S.view, kick = v.kick / 12 * 2, [kx, ky] = S.hero && S.hero.dir ? DV[S.hero.dir] : [0, 0]; ctx.translate(-snap(v.lx - kx * kick), -snap(v.ly - ky * kick)); }
    drawBoard();
    ctx.restore();
    drawSpeedEdge();
    if (vis < 1) dim(1 - ease(vis), C.ink);
    if (mode === 'play') {
      if (vis >= 1) { drawBanner(); drawPA(); }
      if (S.phase === 'clear' && outK >= 1) drawClear();
      if (vis > .6) drawReady();
    }
    drawHUD(ease(1 - S.hudIn / UI.hudIn));
    if (S.flash > 0) { ctx.globalAlpha = Math.min(1, S.flash / 10) * .3 * FEEL.flash * motion(); R(S.flashCol, 0, 0, W, H); ctx.globalAlpha = 1; }
    if (S.glitch > 0 && mode === 'play') tear(2 + (S.glitch >> 2), 2 + S.glitch * .3);
    if (mode === 'pause') drawPause();
    if (mode === 'over') drawGameOver();
  }
  /* ================= 실행 ================= */
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }
  // 그림 · 글꼴을 불러오는 동안: 빈 검은 화면 대신 가운데 가는 선 하나가 차오른다(글꼴이 아직 없으니 글자는 쓰지 않는다)
  let loadT = 0;
  function drawLoading() {
    if (S) return;
    loadT++;
    ctx.setTransform(SX, 0, 0, SY, 0, 0); R(C.ink, 0, 0, W, H);
    const w = 48, x = Math.round(W / 2 - w / 2), y = Math.round(H / 2);
    R(C.line, x, y, w, 1); R(C.cyan, x, y, Math.round(w * Math.min(.95, loadT / 90)), 1);
    requestAnimationFrame(drawLoading);
  }
  requestAnimationFrame(drawLoading);
  const go = () => { KCACHE.clear(); enterTitle(); requestAnimationFrame(t => { last = t; frame(t); }); };
  // 한글 글꼴은 쓰는 글자만 받아 온다 — 화면에 나오는 한글을 모두 모아 미리 불러 둔다
  const KTEXT = [...Object.values(K), ...Object.values(TIPS), ...Object.values(DRONE_NAMES), ...DISTRICTS.map(d => d.name), '멈춤이 풀린 직후에 잡혔다 열차에 치였다'].join('');
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('700 8px Silkscreen'), document.fonts.load('8px "Press Start 2P"'), document.fonts.load('900 12px "Noto Sans KR"', KTEXT), document.fonts.load('700 12px "Noto Sans KR"', KTEXT)])
    : Promise.resolve();
  Promise.race([Promise.all([fontsReady, assetsReady]), new Promise(r => setTimeout(r, 3500))]).then(go, go);
})();
