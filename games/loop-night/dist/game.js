(() => {
  /* ================= BGM 설정: 「Too Old to Die Young」 ================= */
  // 음원 파일을 src 경로에 넣으면(LOOP NIGHT/audio/too-old-to-die-young.mp3) 다음 판부터 이 곡이 음악을 맡는다.
  // 파일이 없으면 지금처럼 게임이 직접 연주하는 신스 음악. mp3 · m4a · ogg · wav 모두 가능(확장자에 맞게 src만 바꾸면 된다)
  // bpm   : 곡의 템포. 전기 게이트 · BEAT JUMP · 박자 가이드 · 공연 연출이 모두 이 박자를 따른다
  // beat0 : 곡에서 첫 박(킥)이 울리는 시각(초). 화면 박자가 소리보다 빠르면 키우고, 늦으면 줄인다
  // drop  : 곡에서 가장 센 드롭이 터지는 시각(초). 정하면 IDIOTAPE LIVE가 시작될 때 곡을 드롭 직전으로 넘겨 화면의 드롭과 같은 순간에 터진다.
  //         null이면 곡은 그대로 흐르고, 공연의 드롭을 다음 마디 첫 박에 맞춘다
  // volume: 곡 볼륨(0~1). 효과음은 따로
  const BGM = { src:'audio/too-old-to-die-young.mp3', bpm:120, beat0:0, drop:null, volume:.8 };

  /* ================= 기본: 기준 화면 1920×1080 = 논리 해상도 480×270의 정확히 4배 ================= */
  // 높이 270은 고정. 창 비율이 16:9와 다르면 늘이지 않고 가로 시야 W를 넓히거나 줄여 화면을 꽉 채운다(16:10 ~ 21:9). 그보다 극단적인 비율에서만 남는 쪽에 여백
  // 월드는 원래 높이를 그대로 쓴다: DECK = 도로 아래 가장자리(고가도로 상판 앞면). 늘어난 VIEW_TOP만큼은 천장 쪽 시야라서 도로가 화면 아래에 맞닿는 구도는 그대로
  const BASE_W = 1920, BASE_H = 1080, H = 270, DECK = 256, VIEW_TOP = H - DECK, MIN_AR = 16 / 10, MAX_AR = 21 / 9;
  let W = BASE_W * H / BASE_H, SX = BASE_H / H, SY = BASE_H / H;
  const GROUND = 208, HX = 120, TRACK = 2600, STEP = 1000 / 60;
  const GRAV = 0.45, JUMP1 = -7.6, JUMP2 = -6.6, SPRING = -10.8, STOMP = -7.2, HPMAX = 5, GAUGE = 50, CLIMAX_T = 108;
  const SECRET_AT = 1150, SECRET_LAP = 5, SIGN_GAP = 90;
  // IDIOTAPE LIVE: 5의 배수 바퀴(5, 10, 15…)에만 벽에 IDIOTAPE 무대 그림이 걸리고, 그 그림이 화면에 들어오면 공연이 게임을 점거한다(약 6초)
  // 바퀴가 넘어가기 전에 끝나도록 LIVE_END에서 끊는다
  const liveLap = L => L % SECRET_LAP === 0;
  const LIVE_T = 360, LIVE_IN = 24, LIVE_OUT = 40, LIVE_END = 2500;
  // 낙하: 이 도로는 도시 위 고가도로(표지 그림)라서, 구멍 아래는 빈 공간이 아니라 도로 상판 → 트러스 → 도시 협곡이다
  // SLAB 상판 앞면 두께 · TRUSS under.png 위쪽 트러스 띠 높이 · FAR 협곡 원경(느리게 움직여 멀어 보임) · CAM 카메라가 따라 내려가는 최대 깊이
  const SLAB = 8, TRUSS = 78, FALL_T = 40, FALL_G = .5, FALL_VMAX = 8, CAM_MAX = 340, FAR_Y0 = 160, FAR_PX = .35, FAR_PY = .45;
  const cv = document.getElementById('game');
  let ctx = cv.getContext('2d'); // HUD를 서서히 켤 때만 잠깐 다른 캔버스로 바꿔 그린다
  // 캔버스의 실제 픽셀 = 화면에 보이는 크기 × 기기 배율 (1080p 전체 화면이면 정확히 1920×1080). CSS로 다시 늘이지 않아 픽셀이 흐려지지 않는다
  function fit() {
    const vw = innerWidth, vh = innerHeight, ar = vw / vh, a = Math.min(MAX_AR, Math.max(MIN_AR, ar));
    W = Math.round(H * a);
    const cw = a === ar ? vw : Math.min(vw, vh * a), ch = a === ar ? vh : Math.min(vh, vw / a);
    const k = Math.min(devicePixelRatio || 1, 2160 / ch);
    cv.width = Math.round(cw * k); cv.height = Math.round(ch * k);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    SX = cv.width / W; SY = cv.height / H;
  }
  fit();
  addEventListener('resize', fit);
  // 표지·뒷면과 같은 색
  const C = {
    teal:'#19d3c5', glow:'#2fe0d0', deep:'#0e7c7b', white:'#ffffff', paper:'#ece8de', ink:'#111111', night:'#06111a',
    gray:'#8a8a8a', mist:'#8fa6b0', red:'#e53935', yellow:'#ffd23f', pink:'#ff5d8f', out:'#24495a'
  };
  const FEVER = [C.pink, C.yellow, C.teal];
  const F_PIX = 'Silkscreen, monospace', F_NUM = '"Press Start 2P", monospace';

  /* ================= 그림: 표지·게임 장면 이미지를 참고로 Higgsfield에서 뽑아 다듬은 것 ================= */
  const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });
  const IMG = {};
  const FILES = { hero:'images/hero.png', bg:'images/bg.png', haz:'images/haz.png', hud:'images/hud.png', words:'images/words.png', ring:'images/ring.png', logo:'images/logo.png', egg:'images/egg.png', under:'images/under.png', signs:'images/signs.png', keys:'images/keys.png', band:'images/band.png', hero_x:'images/hero-x.png', gate:'images/gate.png' };
  // under.png: bg.png·표지를 참고로 Higgsfield에서 뽑은 고가도로 아래 도시. 0~TRUSS행은 상판 밑 트러스, 그 아래는 협곡
  const assetsReady = Promise.all(Object.entries(FILES).map(([k, f]) => load(f).then(i => { IMG[k] = i; })));
  // logo.png: Figma 게임 표지 그림의 LOOP NIGHT 로고를 Higgsfield 배경 제거로 오려낸 고해상도 투명 PNG(주인공 부츠를 걷고 받침 안쪽 구멍을 메움)
  // words.png: 그 로고를 참고로 Higgsfield(GPT Image 2.5)에서 같은 글꼴로 뽑은 GAME OVER · HOW TO PLAY · PERFECT — LED 도트, 위 흰색·아래 청록 띠, 검은 받침, 청록 계단 외곽선
  const HZ = { drone:[0,0,19,16], bar:[21,0,25,22], crate:[48,0,27,38], block:[77,0,27,14], spring:[106,0,19,12], gate:[127,0,73,48], sign:[202,0,13,18], car:[217,0,52,18], broken:[271,0,18,9], cas:[291,0,16,10] };
  const HU = { portrait:[0,0,51,48], bar10:[53,0,151,22], seg:[206,0,42,14], ring0:[250,0,52,50], ring1:[304,0,51,50], arm:[357,0,48,48], bar5:[407,0,82,22] };
  const WD = { over:[0, 0, 1641, 332], how:[1645, 0, 1805, 332], perfect:[3454, 0, 1275, 332] };
  // signs.png: 위험물 스프라이트·배경·표지를 참고로 Higgsfield에서 뽑은 간판과 점프대
  // o = 네온만 꺼진 같은 그림(깜빡임용) · n = 네온 픽셀만 남긴 흰 마스크(색 번짐·반짝임을 네온에만 입히려고)
  const SG = { low64:[0,0,64,23], low64o:[65,0,64,23], low50:[130,0,50,18], low50o:[181,0,50,18], low36:[232,0,36,13], low36o:[269,0,36,13],
               jump:[306,0,48,19], jumpo:[355,0,48,19], pad:[404,0,31,8], pado:[436,0,31,8], rw:[468,0,20,75], rwo:[489,0,20,75],
               low64n:[510,0,64,23], low50n:[575,0,50,18], low36n:[626,0,36,13], jumpn:[663,0,48,19], padn:[712,0,31,8], rwn:[744,0,20,75] };
  // keys.png: Higgsfield로 뽑은 카세트 데크 버튼(↑)을 ←/→로 돌린 것. 방향마다 켜짐 · o 꺼짐 · n 네온 마스크(능력 색을 입힘)
  const KY = { up:[0,0,24,24], upo:[25,0,24,24], upn:[50,0,24,24], left:[75,0,24,24], lefto:[100,0,24,24], leftn:[125,0,24,24],
               right:[150,0,24,24], righto:[175,0,24,24], rightn:[200,0,24,24] };
  // gate.png: bg.png·간판을 스타일 참고로 Higgsfield에서 뽑은 Loop Gateway 부품 — 천장 마운트(링 중심 28,80) · 카세트 릴 · 바닥 받침(링 중심 36,25)
  const GT = { mount:[0, 0, 56, 109], reel:[57, 0, 40, 40], base:[98, 0, 73, 68] };
  // hero_x.png: hero.png 8프레임을 참고로 Higgsfield에서 뽑은 변신 형태(TAPE-RUNNER) — 바이저 눈 · 머리끝 발광, 몸을 두른 네온 회로, 뒤로 흩어지는 노이즈 픽셀
  // 윗줄(0~CH) = 변신한 몸, 아랫줄(CH~2CH) = 네온 픽셀만 남긴 흰 마스크(능력 색을 입힌다). 프레임 배치는 hero.png와 같다
  // band.png: egg.png의 IDIOTAPE를 참고로 Higgsfield에서 뽑은 연주자 홀로그램(3줄마다 주사선). 줄마다 [기본, 타격A, 타격B] 3프레임, 프레임 크기 w×h
  const BAND = { synth:{ n:3, w:87, h:120, y:0 }, drum:{ n:3, w:105, h:112, y:120 } };
  const SLOT5 = [[7,19],[21,34],[36,48],[50,62],[65,78]], SLOT9 = [[6,20],[22,36],[38,51],[53,67],[69,82],[85,98],[100,114],[116,129],[131,143]];
  const ok = i => i && i.width;
  function pix(img, m, x, y, dw, dh) { if (ok(img)) ctx.drawImage(img, m[0], m[1], m[2], m[3], Math.round(x), Math.round(y), dw || m[2], dh || m[3]); }
  function hi(img, m, x, y, s = .5) { if (ok(img)) ctx.drawImage(img, m[0], m[1], m[2], m[3], x, y, m[2] * s, m[3] * s); }
  const hz = (n, x, y) => pix(IMG.haz, HZ[n], x, y);
  // 간판 그림의 일부 줄·영역만 (r = 그림 안 [x, y, w, h])
  const sgPart = (k, r, x, y) => pix(IMG.signs, [SG[k][0] + r[0], SG[k][1] + r[1], r[2], r[3]], x + r[0], y + r[1]);
  // 그림 한 칸을 한 색으로 칠한 사본 (네온 마스크에 색을 입힐 때)
  const TCACHE = new Map();
  function tintPart(img, m, col) {
    const key = m.join() + col + img.src; if (TCACHE.has(key)) return TCACHE.get(key);
    const c = document.createElement('canvas'); c.width = m[2]; c.height = m[3];
    const g = c.getContext('2d'); g.drawImage(img, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, m[2], m[3]);
    TCACHE.set(key, c); return c;
  }
  const sgTint = (k, col) => tintPart(IMG.signs, SG[k], col);
  // 고해상도 글자를 높이 WORD_H(논리 px)로 부드럽게 줄여 그린다(가운데 정렬)
  function word(n, cx, y) {
    const m = WD[n], img = IMG.words; if (!ok(img)) return;
    const h = WORD_H, w = m[2] * h / m[3];
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, m[0], m[1], m[2], m[3], cx - w / 2, y, w, h); ctx.restore();
  }

  const CW = 37, CH = 38;
  let TINT = null, XTINT = null;
  // 그림의 한 줄(sy부터 CH 높이)을 한 색으로 칠한 사본
  function tintRow(img, sy, col) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = CH;
    const g = c.getContext('2d'); g.drawImage(img, 0, sy, img.width, CH, 0, 0, img.width, CH);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, CH);
    return c;
  }
  function makeTints() {
    const x = IMG.hero_x;
    // 변신 네온: 능력마다 다른 색 · 흰색 몸 실루엣은 변신 순간 번쩍임용
    if (ok(x)) { XTINT = { body:tintRow(x, 0, C.white) }; for (const col of [C.pink, C.white, C.yellow, C.red, C.glow]) XTINT[col] = tintRow(x, CH, col); }
    const s = IMG.hero; if (!ok(s)) return;
    TINT = {};
    for (const col of [C.teal, C.pink, C.yellow, C.white, C.red]) {
      const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
      const g = c.getContext('2d'); g.drawImage(s, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
      TINT[col] = c;
    }
  }
  function heroFrame(img, f, x, y, s = 1) {
    if (!ok(img)) { R(C.white, x - 6, y - 30, 12, 30); return; }
    ctx.drawImage(img, f * CW, 0, CW, CH, Math.round(x - 18 * s), Math.round(y - CH * s), CW * s, CH * s);
  }
  const runFrame = (anim, speed) => Math.floor(anim / Math.max(2, Math.round(6 - speed * .6))) % 6;

  /* ================= 코스 ================= */
  // B 바리케이드 · W 블록 · T 상자 · P 구멍 · D 드론 · E 전기 게이트 · S 스프링 · L 낮은 간판 · C 뒤에서 오는 차 / lap 등장 바퀴, max 마지막 바퀴, m 움직이는 드론 바퀴, w 폭
  // 낮은 간판: 판 아래가 바닥에서 SIGN_GAP 높이. 톡(약 0.13초 이하) 눌러 낮게 뛰면 통과, 꾹 눌러 높게 뛰면 머리가 부딪힌다
  // 뒤차는 이미 뛰어야 하는 장애물 위를 지나가게 둔다(620 → 바리케이드 880 · 1035 → 상자 쌍 · 2120 → 바리케이드 2380) — 속도가 바뀌어도 지나는 자리가 드론 밑 같은 틈에 걸리지 않게
  // 6바퀴부터는 속도 대신 '아까 본 구간의 의미'가 바뀐다: 6바퀴 드론 구간 끝에 뒤차 + 엉킨 상자 쌍 · 하늘 길(OVERDRIVE) / 7바퀴 DROPOUT 복귀 / 8바퀴 두 번째 바리케이드 위에 간판(낮게 톡)
  const OBS = [
    {p:200,t:'B'},{p:360,t:'D'},{p:500,t:'S'},{p:720,t:'P'},{p:880,t:'B'},{p:950,t:'B',lap:2},
    {p:1060,t:'D'},{p:1120,t:'D'},{p:1270,t:'T'},{p:1420,t:'E'},{p:1610,t:'P'},{p:1740,t:'D',m:3},
    {p:1880,t:'W'},{p:1915,t:'B',lap:3},{p:2020,t:'S'},{p:2080,t:'P',w:64},{p:2240,t:'E',lap:2},
    {p:2380,t:'B'},{p:2500,t:'D',lap:2},
    {p:985,t:'L',w:50,max:1},{p:1862,t:'L',w:50},{p:706,t:'L',w:64,lap:2},{p:944,t:'L',w:36,lap:8},
    {p:620,t:'C',lap:2},{p:1320,t:'C',lap:3},{p:2120,t:'C',lap:4},{p:1035,t:'C',lap:5},
    // tangle: 5바퀴부터 테이프가 엉켜 바로 뒤에 한 번 더 찍힌 복제. 진짜로 부딪히고, FF DASH로 끊을 수 있다
    {p:246,t:'B',lap:5,tangle:1},{p:1322,t:'T',lap:5,tangle:1},{p:2426,t:'B',lap:5,tangle:1}
  ];
  const SIZE = { B:[25,22], W:[27,14], T:[27,38], P:[36,0], D:[19,16], E:[73,48], S:[19,12], L:[50,0], C:[0,0] };
  const PICK = [];
  const arc = (c, peak, n = 5, gap = 15) => { const h = (n - 1) / 2; for (let i = -h; i <= h; i++) PICK.push({ p:c + i * gap, h:Math.round(peak * (1 - (i * i) / ((h + 1) * (h + 1)))) + 6 }); };
  // 카세트 줄은 공중에 떠 있어서 점프해야 먹는다 (h 24는 짧게 톡, 40은 꾹). lap: 그 바퀴부터 나타난다
  const row = (s, n = 5, h = 40, lap = 1) => { for (let i = 0; i < n; i++) PICK.push({ p:s + i * 15, h, lap }); };
  arc(212, 48); arc(600, 118, 7, 18); row(790); arc(892, 48); arc(1180, 84, 3);
  arc(1284, 64); row(1500); arc(1628, 48); row(1790, 5, 24); arc(2112, 104, 7, 16); arc(2392, 48); row(2440);
  // 하늘 길(6바퀴~): 전기 게이트 위 높은 줄. 2단 점프로는 안 닿고 OVERDRIVE의 3단 점프로만 — 능력을 고르면 새 길이 열린다
  row(1404, 5, 140, 6);

  /* ================= 바퀴별 난이도: 난이도 숫자는 전부 여기서만 조정한다 ================= */
  // 바퀴가 오를수록 확실히 어려워지되, 한 바퀴에 새 요소는 한두 개만 — 속도 · 디버프 · 장애물 · 화면 효과가 한꺼번에 곱해져 오르지 않게
  // 1 이해한다 · 2 조금 빨라졌다 · 3 능력을 써야겠다 · 4 집중해야 한다 · 5 미쳐가기 시작한다(새 패턴 · 연출 위주, 수치는 조금만) · 6+ 시스템을 쓰면 더 간다
  // speed     기본 달리기 속도(px/프레임, 3 = 100%)
  // debuffs   이 바퀴의 테이프 마모(약한 것 → 센 것). 바퀴를 넘을 때마다 한 칸씩 차오르고 PURIFY는 맨 뒤(가장 센 것)부터 걷는다. 동시에 MAX_DEBUFF개까지
  //           4바퀴에서 NOISE가 DROPOUT으로 굳고, 5바퀴는 HEAD CLEAN(VHS 자동 헤드 청소)이 DROPOUT을 걷어 새 마모(TANGLE)와 IDIOTAPE에 집중하게 한다
  // drop      DROPOUT [주기, 끊김 길이](프레임) · wow WOW 동안 박자 밖 점프 높이 배율 · carWarn 뒤차 ! 경고(프레임)
  // power     능력 지속시간 배율(BREAK · OVERDRIVE · CLEAN, 과열은 그만큼 짧아진다) — 후반일수록 능력도 같이 자란다
  // gauge     게이지 충전 배율 · gateGauge 게이트 접근 구간(GATE_AP[0] 안)의 카세트 배율 — 5바퀴 직전에 능력을 준비해 들어가게
  // echo      SYNC 높이 허용(±px, 잔상 강화) · vfx 화면 고장 연출 세기 0~1(판정과 무관한 연출만, 장애물 테두리 빛도 이만큼)
  // clean     바퀴가 바뀌며 사라진 마모를 알리는 이름(테이프 라벨)
  const MAX_DEBUFF = 3, MIN_REACT = 45;
  const LOOPS = [null,
    { speed:3.00, debuffs:[],                         drop:null,     wow:1,   carWarn:62, power:1,    gauge:1,    gateGauge:1, echo:8,  vfx:0   },
    { speed:3.30, debuffs:['NOISE'],                  drop:null,     wow:1,   carWarn:60, power:1,    gauge:1,    gateGauge:1, echo:8,  vfx:.15 },
    { speed:3.55, debuffs:['NOISE', 'WOW'],           drop:null,     wow:.94, carWarn:56, power:1,    gauge:1,    gateGauge:1, echo:8,  vfx:.3  },
    { speed:3.80, debuffs:['WOW', 'DROPOUT'],         drop:[360,30], wow:.94, carWarn:52, power:1.05, gauge:1.1,  gateGauge:2, echo:8,  vfx:.5  },
    { speed:3.95, debuffs:['WOW', 'TANGLE'],          drop:null,     wow:.94, carWarn:50, power:1.1,  gauge:1.1,  gateGauge:1, echo:9,  vfx:.8, clean:'HEAD CLEAN' },
    { speed:4.10, debuffs:['WOW', 'TANGLE'],          drop:null,     wow:.94, carWarn:48, power:1.15, gauge:1.15, gateGauge:1, echo:10, vfx:.85 },
    { speed:4.25, debuffs:['WOW', 'TANGLE', 'DROPOUT'], drop:[330,36], wow:.94, carWarn:46, power:1.2, gauge:1.2, gateGauge:1, echo:10, vfx:.9  },
    { speed:4.40, debuffs:['WOW', 'TANGLE', 'DROPOUT'], drop:[315,40], wow:.93, carWarn:44, power:1.25, gauge:1.25, gateGauge:1, echo:11, vfx:1 }];
  // 9바퀴부터(Soft Cap): 마지막 줄에서 LOOP_CAP 쪽으로 바퀴마다 남은 거리의 SOFT만큼만 다가간다 — 계속 어려워지지만 증가 폭이 점점 줄어든다
  const LOOP_CAP = { speed:4.9, drop:[300,44], wow:.92, carWarn:42, power:1.35, gauge:1.35, echo:12, vfx:1 }, SOFT = .25;
  const CFG = [];
  function lapCfg(L) {
    if (CFG[L]) return CFG[L];
    const last = LOOPS.length - 1;
    if (L <= last) return (CFG[L] = LOOPS[Math.max(1, L)]);
    const a = LOOPS[last], k = 1 - Math.pow(1 - SOFT, L - last), mix = (x, y) => x + (y - x) * k;
    const c = Object.assign({}, a, { gateGauge:1, clean:null });
    for (const f in LOOP_CAP) c[f] = Array.isArray(a[f]) ? a[f].map((v, i) => Math.round(mix(v, LOOP_CAP[f][i]))) : mix(a[f], LOOP_CAP[f]);
    c.carWarn = Math.round(c.carWarn);
    return (CFG[L] = c);
  }
  // 숨은 보정(Dynamic Difficulty): 같은 바퀴에서 계속 실패할 때만 아주 조금 돕고, 잘한다고 더 어렵게 만들지는 않는다
  // 판을 넘어: 같은 바퀴에서 연속 게임오버(2번째부터 0.5씩) · 판 안에서: 한 바퀴에 2번 넘게 부딪힘(0.5씩). 0~1을 ramp씩 천천히 오가고, 그 바퀴를 넘기면 사라진다
  // assist 1일 때 speed 속도 −4%(장애물 사이 시간 +4%) · gauge 게이지 +10% · drop DROPOUT 끊김 −20% · car 뒤차 경고 +8프레임
  const DDA = { speed:.04, gauge:.1, drop:.2, car:8, ramp:.004 };
  // IDIOTAPE LIVE 첫 CALM_T 프레임 동안 지나갈 구간(CALM_FROM부터)은 1바퀴 배치만 남는다 — 연출을 알아보는 동안 정보가 넘치지 않게.
  // 바퀴가 시작될 때 이미 정해져 있어서, 보이던 장애물이 눈앞에서 사라지는 일은 없다
  const CALM_T = 150, CALM_FROM = SECRET_AT - 300;
  // 코스 검증: 착지해서 다시 뛸 틈이 없는 장애물 묶음은 MAX_CHAIN개까지, 2단 점프 한 번 안에 넘을 수 있어야 한다(TIMING 프레임 여유 포함)
  const MAX_CHAIN = 3, TIMING = 4;

  /* ================= 화면 글자 ================= */
  const K = {
    t1:'점프', d1:'길게 누르면 높이, 공중에서 한 번 더',
    t2:'낮은 간판', d2:'간판 아래선 짧게 톡 눌러 낮게 점프',
    t3:'드론 밟기', d3:'위에서 밟으면 부서지고 다시 튀어 오른다',
    t4:'뒤에서 오는 차', d4:'! 표시가 뜨면 차가 지날 때 공중에',
    t5:'전기 게이트', d5:'박자에 맞춰 꺼지는 순간 통과',
    t6:'되감기', d6:'잔상 없이 부딪히면 2초 전으로 되감긴다',
    t7:'CLIMAX', d7:'게이지가 차면 방향키로 ←돌파 ↑정화 →가속',
    pu:'마모 한 단계 제거 · 잠시 마모 면역 · 잔상 복구', br:'짧은 무적 돌진 · 연속으로 부술수록 점수 · 2단 점프 불가', od:'가속 · 높은 점프 · 3단 점프 · 잔상이 장애물을 부순다',
    t8:'잔상', d8:'지난 루프의 나. 대신 맞고, 같이 넘으면 SYNC',
    tw:'바퀴마다 테이프가 닳고(동시에 최대 3개), 대신 새 기능이 생긴다',
    w1:'화면에 약한 CRT 노이즈', a1:'지난 루프의 내가 따라온다',
    w2:'박자 밖 점프는 낮아진다', a2:'박자에 뛰면 더 높이',
    w3:'신호가 끊겨 장애물이 윤곽만 남는다', a3:'잔상이 앞서 달려 길을 보여준다',
    deck:'능력 지속시간 · 게이지 충전이 늘었다', hc:'헤드를 닦았다',
    w4:'화면이 찢어지고 장애물이 겹친다', a4:'공중에서 3번째 누르면 빨리감기',
    pause:'스페이스바를 누르면 계속'
  };

  // 테이프 마모: 마모(▼)와 그걸 이겨낼 데크 기능(▲)이 짝으로 들어온다. 어느 바퀴에 무엇이 걸리는지는 LOOPS 표의 debuffs가 정한다
  // 데크 기능은 2~5바퀴에 하나씩 생겨 계속 남는다(마모를 걷어내도)
  const TAPE = [null,
    { bad:'NOISE', badK:K.w1, good:'ECHO', goodK:K.a1 },
    { bad:'WOW', badK:K.w2, good:'BEAT JUMP', goodK:K.a2 },
    { bad:'DROPOUT', badK:K.w3, good:'ECHO LEAD', goodK:K.a3 },
    { bad:'TANGLE', badK:K.w4, good:'FF DASH', goodK:K.a4 }];
  const BAD_K = {}; for (const t of TAPE) if (t) BAD_K[t.bad] = t.badK;
  // CLIMAX 선택: 게이지가 차면 세계가 느려지고 방향키로 하나를 고른다
  // ← BREAK 공격·돌파: 짧게(CLIMAX_T) 무적으로 부수며 지나간다. 대신 몸이 무거워 2단 점프·FF DASH가 막히고, 끝나면 HEAT_T 동안 과열(게이지 안 참 · 2단 점프 불가)
  // ↑ PURIFY 생존·정화: 지금 걸린 가장 센 마모를 걷어내고(이번 바퀴 동안 · 다음 바퀴에 다시 한 칸 닳는다. 마모가 없으면 다음 바퀴 마모를 미리 봉인),
  //                     CLEAN 동안 모든 마모 면역 · 잃은 잔상 하나 복구 · SYNC 판정이 넓어지고 게이지가 계속 찬다
  //                     마모가 많을수록 CLEAN이 길어져서 후반일수록 값어치가 오른다. 단 CLEAN 중에도 게이지가 차므로, PURIFY만 연달아 골라
  //                     마모 면역이 끊기지 않는 일이 없게 CLEAN은 한 바퀴의 절반쯤만 덮는다(CLEAN_T + CLEAN_PER × 마모, 바퀴 표의 power 배율)
  // → OVERDRIVE 속도·숙련: 무적 없이 빠르고 높이 뛴다(3단 점프). 넘은 장애물은 바짝 붙은 잔상들이 부수고(ECHO STRIKE), 그동안 번 게이지는 끝날 때 1.5배로 돌려받는다
  // 안 고르면 PICK_T 뒤 선택 없이 게이지가 PICK_KEEP만큼 남는다 — 흐름은 멈추지 않고, 어느 쪽도 기본값이 되지 않게
  const POWERS = { up:{ name:'PURIFY', col:C.white, k:K.pu }, left:{ name:'BREAK', col:C.pink, k:K.br }, right:{ name:'OVERDRIVE', col:C.yellow, k:K.od } };
  const PICK_T = 100, PICK_SLOW = .3, PICK_KEEP = .6, DRIVE_T = 300, HEAT_T = 60, CLEAN_T = 150, CLEAN_PER = 30;
  const BREAK_JUMP = .92, OD_JUMP = 1.1, OD_SPEED = 1.4, OD_BANK = 1.5;
  // 변신 연출: 입력 → XF_STOP 동안 Hit Stop(세계 정지, 실루엣이 하얗게) → 4프레임째 변신 → XF_IN까지 화면 반응(줌 · RGB 분리 · 플래시 · 베이스) → 능력 실행
  // 끝나기 XF_OUT 전부터 네온이 아래부터 꺼지고 잔상이 몸으로 모이며, 끝나는 순간 테이프 띠가 끊겨 날아간다(XF_SNAP)
  const XCOL = { left:C.pink, up:C.white, right:C.yellow }, XACC = { left:C.red, up:C.glow, right:C.white };
  const XF_STOP = 8, XF_IN = 22, XF_OUT = 24, XF_SNAP = 20;
  // Loop Gateway (TAPE RIFT): 천장 릴과 바닥 릴 사이에 세로로 감긴 자기 테이프, 그 사이가 찢어진 시간 균열 — 균열 안에선 이번 바퀴의 실제 장면이 거꾸로 흐른다
  // GATE_AP 접근 1·2·3단계 거리(px) · WARP_T 통과 연출(바퀴가 쌓일수록 WARP_PER씩 길어져 최대 1초) · OSD_T 루프 번호 표시(처음 OSD_BIG 동안 가운데 크게)
  // SNAP_EVERY 프레임마다 화면을 녹화해 SNAP_MAX장까지 남긴다 (균열 · 되감기 필름 · 과거 장면 깜빡임)
  const GATE_TOP = 26, GATE_BOT = 186, REEL_R = 20, RIFT_W = 18;
  // 타이틀: 실제 게임 세계가 플레이 속도로 흐르는 화면 위에 로고와 PRESS ANY KEY만. 카메라를 TITLE_CAM만큼 내려 고가도로 아래 도시까지 보인다
  // 출발선 앞 구간엔 게이트가 GATE_GAP마다 똑같이 다시 지나가서, 세계 자체가 반복된다는 걸 말없이 보여준다
  // IDLE_T 동안 입력이 없으면 설명·기록 페이지(INFO_T씩 4장)를 같은 배경 위에 보여주고 돌아온다
  // 시작(ENTER_T, 약 1초): 로고가 사라지고 → 카메라가 플레이 위치로 올라오며 → 주인공이 달려 들어와(ENTER_CTRL부터 조작) → HUD가 켜진다
  // LOGO_W 로고 폭(논리 px, 예전 픽셀 로고와 같은 폭) · WORD_H words.png 글자 높이(논리 px)
  const TITLE_CAM = 150, GATE_GAP = 720, IDLE_T = 1200, INFO_T = 360, ENTER_T = 56, ENTER_CTRL = 34, LOGO_W = 214, LOGO_GLOW = .2, WORD_H = 26;
  const GATE_AP = [600, 300, 120], WARP_T = 45, WARP_PER = 4, OSD_T = 150, OSD_BIG = 72, SNAP_EVERY = 20, SNAP_MAX = 36;
  // 깨진 CRT 자막으로 새어 나오는 시스템 메시지 (LOOP_은 지금 바퀴 번호가 붙는다)
  const GLITCH = ['REWIND', 'TIME ERROR', 'AGAIN', '00:00:00', '<<', 'TRACKING', 'ERR 0x0F', 'LOOP_'], GLITCH_HIT = ['REWIND', '<<', '-00:00:01:36', 'ERR'];

  /* ================= 상태 ================= */
  let mode = 'title', held = false, S = null, titleT = 0, idleT = 0;
  let best = 0, bestLoop = 1, newRecord = false;
  try { best = +localStorage.getItem('loopnight-best') || 0; bestLoop = +localStorage.getItem('loopnight-bestloop') || 1; } catch (e) {}
  // 플레이 로그: CLIMAX 선택마다 방향 · 바퀴 · 마모 · HP · 잔상 수, 능력이 끝날 때 그동안 번 점수와 맞았는지(hit) · 그 사이 게임오버(died)
  // 콘솔에서 LOOPNIGHT.log()로 방향별 선택률 표, LOOPNIGHT.clear()로 비우기. 대기 화면 기록 페이지에도 선택률 한 줄
  const LOG_KEY = 'loopnight-picks', LOG_MAX = 500;
  let picks = [];
  try { picks = JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) {}
  const savePicks = () => { try { localStorage.setItem(LOG_KEY, JSON.stringify(picks)); } catch (e) {} };
  const pickRate = () => {
    const n = { left:0, up:0, right:0 }; for (const p of picks) if (p.dir in n) n[p.dir]++;
    const all = n.left + n.up + n.right; return all ? { all, left:n.left / all, up:n.up / all, right:n.right / all } : null;
  };
  // 피격 로그: 부딪힐 때마다 무엇에(B 바리케이드 · W 블록 · T 상자 · D 드론 · E 게이트 · L 간판 · P 구멍 · C 뒤차) · 바퀴 · 걸린 마모 ·
  // DROPOUT/IDIOTAPE 중이었나 · 켜진 능력 · 잔상이 막았나(guarded) · 그 피격으로 게임오버(fatal). LOOPNIGHT.log()에 사망 원인 표로 나온다
  const HIT_KEY = 'loopnight-hits', FAIL_KEY = 'loopnight-fails';
  let hits = [], fails = { lap:0, n:0 };
  try { hits = JSON.parse(localStorage.getItem(HIT_KEY)) || []; fails = JSON.parse(localStorage.getItem(FAIL_KEY)) || fails; } catch (e) {}
  const saveHits = () => { try { localStorage.setItem(HIT_KEY, JSON.stringify(hits)); localStorage.setItem(FAIL_KEY, JSON.stringify(fails)); } catch (e) {} };
  window.LOOPNIGHT = {
    log() {
      const NAME = { left:'← BREAK', up:'↑ PURIFY', right:'→ OVERDRIVE', none:'(시간 초과)' }, rate = pickRate(), sum = {}, laps = {};
      for (const p of picks) {
        const r = sum[p.dir] || (sum[p.dir] = { n:0, hit:0, died:0, gain:0 });
        r.n++; r.hit += p.hit ? 1 : 0; r.died += p.died ? 1 : 0; r.gain += p.gain || 0;
        if (p.dir === 'none') continue;
        const b = p.lap >= 5 ? 'LOOP 5+' : 'LOOP ' + p.lap, l = laps[b] || (laps[b] = { '← BREAK':0, '↑ PURIFY':0, '→ OVERDRIVE':0 });
        l[NAME[p.dir]]++;
      }
      const table = {};
      for (const d of ['left', 'up', 'right', 'none']) {
        const r = sum[d]; if (!r) continue;
        table[NAME[d]] = { '선택률':d === 'none' || !rate ? '-' : (rate[d] * 100).toFixed(1) + '%', '횟수':r.n, '능력 중 피격':r.hit, '게임오버':r.died, '평균 획득 점수':d === 'none' ? '-' : Math.round(r.gain / r.n) };
      }
      console.table(table); console.table(laps);
      // 바퀴별 피격 원인 · 게임오버 원인(그 순간의 조건 포함)
      const byLap = {}, fatal = {};
      for (const h of hits) {
        const c = h.t + (h.tangle ? '(엉킴)' : ''), r = byLap['LOOP ' + h.lap] || (byLap['LOOP ' + h.lap] = {});
        r[c] = (r[c] || 0) + 1;
        if (h.fatal) { const k = 'LOOP ' + h.lap + ' · ' + c + (h.drop ? ' · DROPOUT' : '') + (h.live ? ' · IDIOTAPE' : '') + (h.power ? ' · ' + h.power : ''); fatal[k] = (fatal[k] || 0) + 1; }
      }
      console.table(byLap); console.table(fatal);
      return picks.length;
    },
    // 코스 검증 결과: 바퀴마다 장애물 수 · 가장 긴 묶음 · 가장 빠듯한 여유(프레임) · 검증이 끈 장애물
    validate(n = 12) { const t = {}; for (let L = 1; L <= n; L++) { const v = validateLap(L); t['LOOP ' + L] = { '속도':lapCfg(L).speed.toFixed(2), '장애물':v.n, '최장 묶음':v.chain, '최소 여유(f)':v.slack, '끈 것':v.cut.join(' ') || '-' }; } console.table(t); },
    clear() { picks = []; hits = []; fails = { lap:0, n:0 }; savePicks(); saveHits(); }
  };
  // 속도: 바퀴 표의 기본 속도(숨은 보정만큼 느리게) + BREAK 돌진, OVERDRIVE 배율. 어떤 경우에도 장애물이 화면에 들어와 닿기까지 MIN_REACT 프레임은 남긴다
  const speedOf = () => Math.min((W + 20 - HX) / MIN_REACT,
    (lapCfg(S.lap).speed * (1 - DDA.speed * S.assist) + (S.climax > 0 ? 0.8 : 0)) * (S.drive > 0 ? OD_SPEED : 1));
  // 곡이 있으면 곡의 템포 고정, 없으면 신스 음악이 바퀴·CLIMAX에 따라 빨라진다
  const bpm = () => bgm.active ? BGM.bpm : (116 + Math.min(8, S ? S.lap : 1) * 5) * (S && (S.climax > 0 || S.drive > 0) ? 1.12 : 1);
  const fpb = () => 3600 / bpm();
  const score = () => Math.floor(S.total / 10) + Math.floor(S.pts);
  const newRec = () => new Float32Array(Math.ceil(TRACK / 4) + 2);

  function freshState() {
    return { d:-220, prevD:-220, total:0, pts:0, lap:1, y:GROUND, vy:0, ground:true, jumps:0, spin:0, buf:0, queued:false, noCut:false,
          hp:HPMAX, inv:0, shake:0, flash:0, freeze:0, slow:0, banner:0, bannerWord:null, sub:'', enter:null,
          rec:newRec(), ghosts:[], hist:[], past:[], rw:null, pendingRewind:false, live:0, liveLen:0, liveIn:LIVE_IN, liveDone:false, beatHit:false, anim:0, beatT:0, overT:0,
          pops:[], parts:[], debris:[], gauge:0, climax:0, combo:0, chain:0, lapHit:false, falling:0, cars:[], springT:{},
          cam:0, camV:0, trail:[], fallX:0, fallSp:0, padPh:{}, guardFx:null, echoIn:0, ff:0, ffUsed:false, tapeCard:0, beatFx:0, pick:null, pickFx:null, drive:0, cleanFx:0,
          heat:0, clean:0, cleanMax:1, smash:0, odBank:0, lost:[], pickLog:null, climaxMax:CLIMAX_T, driveMax:DRIVE_T,
          wear:0, seal:0, card:null, assist:0, lapHits:0, lastHit:null,
          xfIn:null, xfOut:null, rings:[], xfp:[], odTrail:[], cleanW:0,
          warp:null, osd:null, gateCue:false, reel:0, pastFx:0, pastFilm:null,
          broken:new Set(), got:new Set(), near:new Set(), fired:new Set() };
  }
  // 타이틀: 새 세계를 만들어 카메라를 내린 채 흘려보낸다. 소리가 이미 허용된 뒤(게임오버 뒤 돌아온 경우)면 곡이 벽 너머처럼 먹먹하게 흐른다
  function enterTitle() {
    S = freshState(); S.d = S.prevD = -(W - HX) - 80 - GATE_GAP / 2; S.cam = TITLE_CAM;
    titleT = 0; idleT = 0; snaps.length = 0;
    setMode('title');
    if (ac && ac.state === 'running') { music.start(); muffle(700, .4); }
  }
  // 시작: 세계는 멈추지 않는다. 다가오는 게이트 가운데 첫 장애물이 아직 화면 밖에 있을 만큼 앞선 것을 출발선(p = 0)으로 삼는다
  // 게이트가 GATE_GAP마다 반복되니 그만큼 좌표를 옮겨도 화면은 그대로다. 곡은 처음부터 다시 틀지 않고 먹먹함만 걷어낸다
  function startGame(fromOver) {
    const j = Math.max(0, Math.floor(-(S.d + W - HX - 120) / GATE_GAP));
    S.d += j * GATE_GAP; S.prevD += j * GATE_GAP;
    S.enter = { t:fromOver ? 18 : 0 }; newRecord = false;
    setMode('play');
    if (music.on) muffle(20000, .5); else { music.start(); muffle(20000, .05); }
    sfx('play');
  }
  function setMode(m) {
    const prev = mode; mode = m;
    if (m === 'over') music.stop(true);
    if (m !== 'play') muffle(20000, .05);
    if (bgm.active && m === 'pause' && prev === 'play') { bgm.pos = bgmTime(); bgmHalt(); }
    if (bgm.active && m === 'play' && prev === 'pause') bgmPlay(bgm.pos);
  }
  function gameOver() {
    setMode('over'); S.overT = 0;
    if (S.pickLog) { S.pickLog.died = true; endPower(); }
    // 숨은 보정용: 같은 바퀴에서 연속으로 몇 번 끝났나 · 마지막 피격이 사망 원인
    fails = fails.lap === S.lap ? { lap:S.lap, n:fails.n + 1 } : { lap:S.lap, n:1 };
    if (S.lastHit) S.lastHit.fatal = true;
    saveHits();
    if (score() > best) { best = score(); newRecord = true; }
    if (S.lap > bestLoop) bestLoop = S.lap;
    try { localStorage.setItem('loopnight-best', String(best)); localStorage.setItem('loopnight-bestloop', String(bestLoop)); } catch (e) {}
    sfx('over');
  }

  /* ================= 소리 ================= */
  let ac = null, noiseBuf = null, master = null, cut = null;
  function ensureAudio() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        master = ac.createBiquadFilter(); master.type = 'lowpass'; master.frequency.value = 20000;
        cut = ac.createGain(); master.connect(cut).connect(ac.destination); // 게이트 통과 때 모든 소리를 순간 끊는 스위치
        bgm.gain = ac.createGain(); bgm.gain.connect(master);
        bgm.an = ac.createAnalyser(); bgm.an.fftSize = 64; bgm.fq = new Uint8Array(32); bgm.gain.connect(bgm.an);
      } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tone(f1, f2, dur, type = 'square', vol = .05, at = 0) {
    if (!ac) return;
    const t = at || ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function noise(t, vol, len = .04, freq = 7000, type = 'highpass') {
    if (!ac || !noiseBuf) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + len + .02);
  }
  // 모든 소리의 높은 음역을 f(Hz)까지 dur초 동안 걸러낸다 (선택 중 먹먹하게 → 고르면 확 열림)
  function muffle(f, dur) {
    if (!ac || !master) return;
    const t = ac.currentTime, q = master.frequency; q.cancelScheduledValues(t); q.setValueAtTime(q.value, t); q.exponentialRampToValueAtTime(f, t + dur);
    if (bgm.el && bgm.active) bgm.el.volume = BGM.volume * (f < 5000 ? .4 : 1); // <audio> 재생은 필터 대신 볼륨으로
  }

  // 오디오를 순간 끊는다(sec초 뒤 복귀) · 바로 되살린다
  function audioCut(sec) { if (!cut) return; const t = ac.currentTime, g = cut.gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.setValueAtTime(1, t + sec); }
  function audioOn() { if (!cut) return; const t = ac.currentTime; cut.gain.cancelScheduledValues(t); cut.gain.setValueAtTime(1, t); }

  /* ================= BGM 재생 ================= */
  // http(s)로 열면 Web Audio로 재생: 정확한 박자 시계 · 되감기 때 곡을 실제로 거꾸로 감기 · 필터 · 실제 스펙트럼.
  // file://로 열어 파일을 직접 읽을 수 없으면 <audio>로 재생(박자는 맞추고, 거꾸로 감기는 생략). 파일이 없으면(404) 신스 음악
  const bgm = { buf:null, rev:null, el:null, src:null, gain:null, an:null, fq:null, startAt:0, pos:0, playing:false, active:false };
  fetch(BGM.src).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(b => new OfflineAudioContext(2, 1, 44100).decodeAudioData(b))
    .then(buf => {
      bgm.buf = buf;
      const rev = new AudioBuffer({ length:buf.length, numberOfChannels:buf.numberOfChannels, sampleRate:buf.sampleRate });
      for (let c = 0; c < buf.numberOfChannels; c++) rev.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
      bgm.rev = rev;
    })
    .catch(e => {
      if (typeof e === 'number') return;
      const el = new Audio(); el.loop = true; el.preload = 'auto'; el.src = BGM.src;
      el.addEventListener('canplaythrough', () => { bgm.el = el; }, { once:true });
    });
  // 곡 위치 t(초)부터 재생. rev면 그 위치에서 거꾸로(rate배 빠르게) — 되감기 소리
  function bgmPlay(t, rev = false, rate = 1) {
    bgmHalt();
    if (bgm.buf && ac) {
      const s = ac.createBufferSource(), len = bgm.buf.duration;
      s.buffer = rev ? bgm.rev : bgm.buf; s.loop = true; s.playbackRate.value = rate; s.connect(bgm.gain);
      s.start(0, rev ? mod(len - t, len) : mod(t, len));
      bgm.src = s; bgm.startAt = ac.currentTime - t;
    } else if (bgm.el && !rev) { bgm.el.currentTime = mod(t, bgm.el.duration || 1); bgm.el.play().catch(() => {}); }
    bgm.playing = !rev;
  }
  // 게이트에 다가가는 동안: 곡을 거꾸로 돌린 소리가 통과 순간까지 아주 작게 차오른다 (Web Audio로 곡을 읽었을 때만)
  function bgmGhost(dur) {
    if (!bgm.rev || !ac || !bgm.playing) return;
    const s = ac.createBufferSource(), g = ac.createGain(), len = bgm.buf.duration, t = ac.currentTime;
    s.buffer = bgm.rev; s.connect(g).connect(master);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.2 * BGM.volume, t + dur);
    s.start(t, mod(len - bgmTime(), len)); s.stop(t + dur); bgm.ghost = s;
  }
  function bgmHalt() { if (bgm.src) { try { bgm.src.stop(); } catch (e) {} bgm.src = null; } if (bgm.el) bgm.el.pause(); bgm.playing = false; }
  // 곡 안의 지금 위치(초). Web Audio에선 곡이 반복돼도 계속 이어지는 값이라 박자가 끊기지 않는다
  const bgmTime = () => !bgm.playing ? bgm.pos : bgm.buf ? ac.currentTime - bgm.startAt : bgm.el.currentTime;
  // 게임의 박자 시계(beatT, 프레임 단위)와 곡 위치(초)를 오간다
  const songToBeat = t => Math.max(0, (t - BGM.beat0) * 60), beatToSong = bt => bt / 60 + BGM.beat0;
  // 매 프레임: DROPOUT이면 곡이 신호 끊긴 듯 작아지고, WOW(테이프 늘어짐)면 음정이 살짝 출렁인다
  function bgmFx() {
    const v = BGM.volume * (dropOn() ? .15 : 1);
    if (bgm.gain) bgm.gain.gain.setTargetAtTime(v, ac.currentTime, .06); else if (bgm.el) bgm.el.volume = v;
    if (bgm.src) bgm.src.playbackRate.value = 1 + wowAmt() * Math.sin(ac.currentTime * 5.3);
  }
  function sfx(n, x = 0) {
    if (!ac) return;
    const now = ac.currentTime;
    if (n === 'jump') { tone(330, 660, .09); noise(now, .03, .05, 3000); }
    else if (n === 'jump2') { tone(520, 1040, .1, 'square', .045); noise(now, .04, .08, 2000); }
    else if (n === 'spring') { tone(200, 900, .25, 'square', .05); tone(400, 1800, .25, 'triangle', .03); }
    else if (n === 'stomp') { tone(600 + x * 80, 200, .1, 'square', .06); noise(now, .07, .08, 1500, 'bandpass'); }
    else if (n === 'close') { tone(1500, 2200, .07, 'triangle', .04); tone(2200, 3000, .12, 'sine', .03, now + .06); }
    else if (n === 'warn') tone(880, 880, .07, 'square', .05);
    else if (n === 'car') noise(now, .14, .5, 600, 'lowpass');
    else if (n === 'zap') noise(now, .06, .12, 4000, 'bandpass');
    else if (n === 'rewind') { tone(1200, 120, .7, 'sawtooth', .05); noise(now, .05, .7, 2500, 'bandpass'); }
    else if (n === 'play') { tone(300, 600, .08, 'square', .04); tone(600, 900, .08, 'square', .04, now + .08); }
    else if (n === 'whoosh') noise(now, .06, .35, 1200, 'bandpass');
    else if (n === 'pick') tone(880 + x * 40, 1320 + x * 40, .06, 'square', .035);
    else if (n === 'hit') { tone(160, 60, .22, 'sawtooth', .07); noise(now, .06, .15, 800, 'lowpass'); }
    else if (n === 'fall') { tone(500, 60, .55, 'triangle', .07); noise(now, .05, .6, 900, 'bandpass'); }
    else if (n === 'wire') { tone(1800, 500, .06, 'square', .025); noise(now, .04, .08, 5000, 'bandpass'); }
    else if (n === 'smash') { tone(220, 50, .15, 'sawtooth', .06); noise(now, .08, .1, 2000); }
    else if (n === 'go') [523, 784, 1047].forEach((f, i) => tone(f, f, .1, 'square', .05, now + i * .06));
    else if (n === 'lap') [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .08, 'square', .045, now + i * .07));
    else if (n === 'perfect') [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, .09, 'square', .05, now + i * .06));
    else if (n === 'climax') [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.01, .08, 'square', .05, now + i * .05));
    else if (n === 'secret') [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, .1, 'triangle', .06, now + i * .09));
    else if (n === 'over') tone(392, 98, .6, 'triangle', .07);
    else if (n === 'beat') tone(1568, 1568, .05, 'square', .03);
    else if (n === 'riser') { tone(220, 1760, x || .4, 'sawtooth', .035); noise(now, .05, Math.min(.6, x || .4), 3000, 'bandpass'); }
    else if (n === 'livedrop') { tone(120, 30, .5, 'sine', .28); noise(now, .12, .6, 6000); [440, 554, 659, 880].forEach(f => tone(f, f, .3, 'square', .025)); }
    else if (n === 'pickOpen') { tone(880, 180, .35, 'sawtooth', .035); noise(now, .05, .4, 600, 'lowpass'); }
    else if (n === 'choose') { [[523, 784, 1047], [392, 587, 784], [659, 988, 1319]][x].forEach((f, i) => tone(f, f * 1.01, .35, 'square', .04, now + i * .03)); noise(now, .07, .4, 2500, 'bandpass'); }
    else if (n === 'deny') tone(140, 110, .15, 'square', .05);
    // 변신: 몸을 울리는 낮은 베이스 펄스 + 능력마다 다른 윗소리 / 해제: 피치가 떨어지며 테이프가 툭 끊긴다
    else if (n === 'xform') {
      tone(95, 32, .5, 'sine', .32); noise(now, .1, .3, 260, 'lowpass');
      if (x === 1) { tone(220, 55, .35, 'sawtooth', .05, now + .07); noise(now + .07, .08, .2, 1200, 'bandpass'); }
      else if (x === 0) { tone(1046, 1568, .45, 'sine', .045, now + .07); tone(1568, 2093, .45, 'triangle', .025, now + .1); }
      else { tone(330, 1760, .3, 'square', .03, now + .07); noise(now + .07, .06, .3, 4000, 'bandpass'); }
    }
    // 게이트: 다가가면 거꾸로 감긴 심벌처럼 통과 순간까지 차오르는 소리(x = 남은 초) · 통과 때 테이프가 감기며 피치가 떨어지는 소리(x = 길이) · 새 바퀴의 강한 재진입
    else if (n === 'swell') {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.setValueAtTime(1200, now); f.frequency.exponentialRampToValueAtTime(7000, now + x);
      g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(.09, now + x);
      s.connect(f).connect(g).connect(master); s.start(now); s.stop(now + x);
    }
    else if (n === 'tapewarp') { tone(1400, 70, x, 'sawtooth', .05); tone(320, 40, x, 'square', .025); noise(now, .07, x, 2200, 'bandpass'); }
    else if (n === 'reentry') { tone(160, 38, .55, 'sine', .34); noise(now, .1, .7, 5000); [262, 392, 523, 784].forEach((f, i) => tone(f, f, .35, 'square', .03, now + i * .02)); }
    else if (n === 'powerdown') { tone(700, 90, .32, 'square', .03); noise(now + .2, .12, .03, 6000); }
    else if (n === 'ff') { tone(300, 2400, .28, 'sawtooth', .035); noise(now, .05, .3, 3000, 'bandpass'); }
    else if (n === 'drop') { noise(now, .09, .5, 4000); tone(880, 60, .3, 'square', .03); }
    else if (n === 'guard') { tone(1600, 400, .18, 'square', .045); noise(now, .08, .25, 6000); tone(330, 110, .3, 'sawtooth', .04, now + .05); }
    else if (n === 'sync') [523, 659, 784, 1047].slice(0, x + 1).forEach(f => tone(f, f, .16, 'triangle', .045));
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const BASS = [45,45,57,45,43,43,55,43,41,41,53,41,43,43,55,47];
  const LEAD = [69,72,76,81,76,72,69,64];
  const music = { on:false, next:0, step:0, timer:null,
    start() { ensureAudio(); if (!ac) return; this.on = true; this.next = ac.currentTime + .06; this.step = 0;
      bgm.active = !!(bgm.buf || bgm.el);
      if (bgm.active) { if (bgm.gain) { bgm.gain.gain.cancelScheduledValues(ac.currentTime); bgm.gain.gain.value = BGM.volume; } else bgm.el.volume = BGM.volume; bgmPlay(0); }
      if (!this.timer) this.timer = setInterval(() => this.tick(), 25); },
    // fade: 게임오버 땐 곡이 1.2초 동안 서서히 사라진다
    stop(fade) {
      this.on = false; if (!bgm.active) return;
      if (fade && bgm.gain) { bgm.gain.gain.setTargetAtTime(0, ac.currentTime, .35); setTimeout(() => { if (!this.on) bgmHalt(); }, 1200); }
      else bgmHalt();
    },
    tick() {
      if (bgm.active) return;
      if (!ac || !this.on || (mode !== 'play' && mode !== 'title') || (S && (S.rw || S.warp))) { if (ac) this.next = ac.currentTime + .05; return; }
      const fever = S && S.climax > 0, st = 60 / bpm() / 2, wow = S ? wowAmt() : 0, lost = S && dropOn(), live = S && liveK() > .2 && S.liveLen - S.live >= S.liveIn;
      while (this.next < ac.currentTime + .12) {
        const i = this.step % 16, t = this.next;
        const fl = 1 + wow * Math.sin(t * 5.3);
        if (live) {
          const root = BASS[i & 12] + 24;
          if (i % 2 === 0) tone(160, 40, .14, 'sine', .22, t);
          else noise(t, .045, .07, 8000);
          if (i % 4 === 2) noise(t, .08, .12, 1500, 'bandpass');
          tone(mtof(BASS[i] - 12), mtof(BASS[i] - 12), st * .8, 'sawtooth', .05, t);
          tone(mtof(root + [0, 7, 12, 7][i % 4]), mtof(root + [0, 7, 12, 7][i % 4]), st * .6, 'square', .03, t);
          this.next += st; this.step++; continue;
        }
        if (lost) noise(t, .03, st, 5000);
        else tone(mtof(BASS[i]) * fl, mtof(BASS[i]) * .999 * fl, st * .9, 'triangle', .09, t);
        if (i % 4 === 0) tone(150, 45, .12, 'sine', .14, t);
        if (i % 2 === 1) noise(t, .022);
        if (i % 8 === 4) noise(t, .05, .1, 1800, 'bandpass');
        if (lost) { /* 신호가 끊긴 동안 멜로디 없음 */ }
        else if (fever) tone(mtof(LEAD[i % 8] + 12), mtof(LEAD[i % 8] + 12), st * .7, 'square', .03, t);
        else if (i % 4 === 2) tone(mtof(BASS[i] + 24), mtof(BASS[i] + 24), st * .45, 'square', .018, t);
        this.next += st; this.step++;
      }
    }
  };

  /* ================= 입력: 타이틀은 아무 키나, 그 뒤로는 스페이스바 하나로 점프·재개 ================= */
  function press() {
    ensureAudio(); held = true;
    if (mode === 'title') { startGame(); return; }
    if (mode === 'over') { if (S.overT > 45) { enterTitle(); startGame(true); } return; }
    if (mode === 'pause') { setMode('play'); return; }
    if (S.enter && S.enter.t < ENTER_CTRL) return; // 주인공이 아직 달려 들어오는 중
    if (!S.rw) S.queued = true;
  }
  const DIRS = { ArrowUp:'up', KeyW:'up', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right' };
  addEventListener('keydown', e => {
    if (mode === 'title' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (DIRS[e.code] || e.code === 'Space') e.preventDefault();
      press(); held = e.code === 'Space'; return;
    }
    const dir = DIRS[e.code];
    if (dir) { e.preventDefault(); if (mode === 'play' && S && S.pick && !S.rw && !e.repeat) choose(dir); return; }
    if (e.code !== 'Space') return;
    e.preventDefault(); if (!e.repeat) press();
  });
  addEventListener('keyup', e => { if (e.code === 'Space') held = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('pause'); });

  /* ================= 진행 ================= */
  // 그 바퀴에 깔리는 장애물: 등장 바퀴 범위 · IDIOTAPE 첫 구간(calm) 제외 · 엉킨 복제는 그 바퀴에 TANGLE이 걸릴 때만 · 코스 검증이 끈 것 제외
  const present = (o, L) => (o.lap || 1) <= L && (!o.max || L <= o.max) && !calmCut(o, L);
  const active = (o, L) => present(o, L) && (!o.tangle || (debuffsAt(L).includes('TANGLE') && !S.clean)) && !validateLap(L).off.has(o);
  // 뒤차는 내 옆을 지나는 자리(경고 + 약 17프레임 뒤)로 따진다
  const carAt = (o, L) => o.p + lapCfg(L).speed * (lapCfg(L).carWarn + 17);
  const calmCut = (o, L) => {
    if (!liveLap(L) || (o.lap || 1) <= 1) return false;
    const x = o.t === 'C' ? carAt(o, L) : o.p;
    return x >= CALM_FROM && x < CALM_FROM + lapCfg(L).speed * CALM_T;
  };
  const wOf = o => o.w || SIZE[o.t][0];
  /* ---------- 코스 검증 ---------- */
  // 점프 궤적을 게임과 같은 방식(프레임마다 vy += GRAV, y += vy)으로 계산한다. k = 높이 배율(WOW 박자 밖), dbl = 떨어지기 직전 2단 점프
  // n = 높이 h보다 높이 떠 있는 프레임 수, rise = 바닥에서 h를 넘기까지 걸리는 프레임
  function arcAbove(h, k, dbl) {
    let y = 0, v = JUMP1 * k, n = 0, rise = 0, two = !dbl;
    for (let t = 1; t < 240; t++) {
      if (!two && v > 0 && y + v + GRAV >= -h) { v = JUMP2 * k; two = true; }
      v += GRAV; y += v;
      if (y >= 0) break;
      if (-y > h) { n++; if (!rise) rise = t; }
    }
    return { n, rise:rise || 99 };
  }
  // 바퀴 L에 깔릴 장애물을 그 바퀴의 가장 느린 속도(숨은 보정 포함)와 WOW 박자 밖 점프로 넘을 수 있는지 미리 확인한다
  // 낮은 간판 아래 지면 장애물은 간판 밑에서 16px 이상 여유가 있어야 하고, 사이에서 내려왔다 다시 오를 시간이 없는 묶음은 MAX_CHAIN개까지 · 2단 점프 한 번에 넘을 수 있어야 한다
  // 전기 게이트는 박자로 푸는 장애물(꺼진 순간 지나가거나 뛰어넘는다)이라 이웃과 묶지 않고, 켜져 있어도 혼자 2단 점프로 넘을 수 있는지만 본다
  // 어기면 나중에 덧붙은 장애물부터(엉킨 복제 → 늦게 등장하는 순) 그 바퀴에서 끄고 콘솔에 알린다 — 코스를 손으로 고쳐도 회피 불가능한 조합이 깔리지 않게
  const VALID = [], HAZ_H = { B:20, W:12, T:36, E:46 }, HERO_W = 12;
  function validateLap(L) {
    if (VALID[L]) return VALID[L];
    const c = lapCfg(L), v = c.speed * (1 - DDA.speed), k = c.debuffs.includes('WOW') ? c.wow : 1, tangle = c.debuffs.includes('TANGLE');
    const off = new Set(), res = VALID[L] = { off, cut:[], n:0, chain:0, slack:99 };
    const signs = OBS.filter(o => o.t === 'L' && present(o, L)).map(o => [o.p + 2 - HERO_W / 2, o.p + wOf(o) - 2 + HERO_W / 2]);
    for (let tries = 0; tries < 20; tries++) {
      // 지면 장애물: 히트박스(± 몸 반폭)를 지나는 동안 높이 h 위 · 구멍: 몸 가운데가 들어가는 동안 공중
      const hz = OBS.filter(o => present(o, L) && !off.has(o) && (!o.tangle || tangle) && (HAZ_H[o.t] || o.t === 'P')).map(o => {
        const x0 = o.t === 'E' ? o.p + 16 : o.p + 3, x1 = o.t === 'E' ? o.p + 57 : o.p + wOf(o) - 3;
        return o.t === 'P' ? { o, a:x0, b:x1, h:0 } : { o, a:x0 - HERO_W / 2, b:x1 + HERO_W / 2, h:HAZ_H[o.t] };
      }).sort((p, q) => p.a - q.a);
      let bad = null;
      for (const z of hz) if (z.h > SIGN_GAP - 50 && signs.some(([s0, s1]) => z.a < s1 && z.b > s0)) bad = bad || [z];
      const chains = []; let cur = null;
      for (const z of hz) {
        if (cur && z.o.t !== 'E' && cur.list[0].o.t !== 'E' && (z.a - cur.b) / v < arcAbove(cur.h, k).rise + arcAbove(z.h, k).rise + 1) { cur.list.push(z); cur.b = Math.max(cur.b, z.b); cur.h = Math.max(cur.h, z.h); continue; }
        chains.push(cur = { a:z.a, b:z.b, h:z.h, list:[z] });
      }
      res.n = hz.length; res.chain = 0; res.slack = 99;
      for (const ch of chains) {
        const need = (ch.b - ch.a) / v + TIMING, can = arcAbove(ch.h, k, true).n;
        res.slack = Math.min(res.slack, Math.floor(can - need)); res.chain = Math.max(res.chain, ch.list.length);
        if (can < need || ch.list.length > MAX_CHAIN) bad = bad || ch.list;
      }
      if (!bad) break;
      const opt = bad.filter(z => z.o.tangle || (z.o.lap || 1) > 1).sort((p, q) => (q.o.tangle ? 99 : q.o.lap) - (p.o.tangle ? 99 : p.o.lap));
      if (!opt.length) { console.warn('LOOP NIGHT: LOOP ' + L + ' 넘기 힘든 묶음', bad.map(z => z.o.t + z.o.p).join(' ')); break; }
      off.add(opt[0].o); res.cut.push(opt[0].o.t + opt[0].o.p);
    }
    if (res.cut.length) console.warn('LOOP NIGHT: LOOP ' + L + ' 검증으로 끈 장애물', res.cut.join(' '));
    return res;
  }
  function eachObs(fn, ahead = 20) {
    for (const off of [0, TRACK]) {
      const L = off ? S.lap + 1 : S.lap;
      for (let i = 0; i < OBS.length; i++) {
        const o = OBS[i]; if (o.t === 'C' || !active(o, L)) continue;
        const sx = Math.round(o.p + off - S.d + HX);
        if (sx < -90 || sx > W + ahead) continue;
        const key = L + ':' + i; if (S.broken.has(key)) continue;
        fn(o, sx, key, L);
      }
    }
  }
  function droneTop(o, L) {
    if (o.m && L >= o.m) return GROUND - 64 + Math.round(Math.sin((S.anim + o.p) / 14) * 10);
    return GROUND - 50 + Math.round(Math.sin(S.anim / 10) * 1.5);
  }
  const gatePhase = o => S.beatT / fpb() + o.p / 97;
  const gateOn = o => Math.floor(gatePhase(o)) % 4 < 2;
  const gateSoon = o => { const ph = gatePhase(o); return Math.floor(ph) % 4 === 3 && ph % 1 > .6; };
  // 공연 세기: 라이저 동안 0→1, 끝나기 전 1→0 · 조명 색은 마디마다 넘어간다
  const liveK = () => S && S.live > 0 ? Math.min(1, (S.liveLen - S.live) / S.liveIn, S.live / LIVE_OUT) : 0;
  const LIVE_COL = [C.pink, C.teal, C.yellow, '#8f6bff'];
  // 테이프 마모: S.wear = 이 바퀴 마모 목록(LOOPS의 debuffs) 앞에서부터 몇 개가 걸려 있나. 바퀴를 넘을 때마다 한 칸씩 차오르되 목록 길이까지만(넘친 만큼 쌓이지 않아
  // PURIFY가 후반에도 늘 한 칸을 실제로 걷는다). PURIFY는 맨 뒤(가장 센 것)부터 걷고, 마모가 없을 때 쓰면 seal: 다음 바퀴에 차오르는 한 칸을 막는다
  // 걸린 마모는 CLEAN 동안 모두 꺼진다 · wearMax = 얻은 데크 기능 단계(2~5바퀴에 하나씩, 걷어내도 유지)
  const lapDebuffs = L => lapCfg(L).debuffs.slice(0, MAX_DEBUFF);
  const nextWear = () => Math.min(lapDebuffs(S.lap + 1).length, S.wear + (S.seal ? 0 : 1));
  const debuffsAt = L => lapDebuffs(L).slice(0, L === S.lap ? S.wear : nextWear());
  const activeDebuffs = () => S.clean > 0 ? [] : debuffsAt(S.lap);
  const has = n => S.clean <= 0 && debuffsAt(S.lap).includes(n);
  const wearMax = () => Math.min(4, S.lap - 1);
  // WOW: 걸린 마모가 많을수록 곡이 더 출렁인다
  const wowAmt = () => has('WOW') ? .004 * activeDebuffs().length : 0;
  // BREAK와 과열 동안은 몸이 무겁다(2단 점프 · FF DASH 불가), OVERDRIVE 동안은 공중에서 한 번 더 뛴다
  const heavy = () => S.climax > 0 || S.heat > 0;
  const airMax = () => heavy() ? 1 : S.drive > 0 ? 3 : 2;
  const onBeat = () => { const f = fpb(), ph = S.beatT % f; return Math.min(ph, f - ph) <= 5; };
  // DROPOUT: 주기마다 DROP_PRE 프레임 지직거림으로 예고한 뒤 신호가 끊긴다(주기 · 길이는 바퀴 표, 숨은 보정만큼 짧게). 끊긴 동안에도 장애물 윤곽은 남는다
  const DROP_PRE = 30;
  const dropCfg = () => lapCfg(S.lap).drop || [300, 0];
  const dropLen = () => Math.round(dropCfg()[1] * (1 - DDA.drop * S.assist));
  const dropPh = () => !has('DROPOUT') || S.rw || loopBusy() || S.cam > 0 || S.live > 0 ? -1 : (S.anim + 140) % dropCfg()[0];
  const dropWarn = () => { const p = dropPh(); return p >= 0 && p < DROP_PRE; };
  const dropOn = () => { const p = dropPh(); return p >= DROP_PRE && p < DROP_PRE + dropLen(); };
  // 뒤차 경고: 바퀴 표(+ 숨은 보정). 경고가 뜬 뒤 차가 닿기까지(약 14프레임 더) MIN_REACT는 남긴다
  const carWarn = () => Math.max(MIN_REACT - 14, Math.round(lapCfg(S.lap).carWarn + DDA.car * S.assist));
  // 잔상 자리: 평소엔 뒤에서 따라오고, 신호가 끊길 땐(ECHO LEAD) 앞으로 달려 나가 지난 루프의 길을 먼저 보여준다
  // OVERDRIVE 동안엔 표지 그림처럼 바짝 붙어 겹쳐 달린다
  // 게이트 2단계부터는 시간이 거꾸로 흐르기 시작해, 잔상들이 뒤에서 앞으로 미끄러져 나간다
  const echoSlot = i => gateZone() >= 2 ? HX + 22 * (i + 1) : dropWarn() || dropOn() ? HX + 34 * (i + 1) : S.drive > 0 ? HX - 7 * (i + 1) : HX - 24 * (i + 1);
  // 점프대 충전: 약 110px 앞부터 다가갈수록 0→1, 지나치면 0
  const padCharge = sx => { const d = sx - HX; return d < -19 ? 0 : Math.max(0, Math.min(1, (110 - d) / 90)); };
  // WOW(3바퀴~): 테이프가 늘어져 박자를 벗어난 점프는 낮아진다(바퀴 표의 wow). 대신 박자에 맞추면(BEAT JUMP) 원래보다 높이 뛰고 게이지가 찬다
  // BREAK 중엔 몸이 무거워 낮게(높이 85%), OVERDRIVE 중엔 높게(높이 120%) 뛴다
  function jump(n) {
    const beat = wearMax() >= 2 && onBeat(), k = (beat ? 1.05 : has('WOW') ? lapCfg(S.lap).wow : 1) * (S.climax > 0 ? BREAK_JUMP : S.drive > 0 ? OD_JUMP : 1);
    if (n === 1) { S.vy = JUMP1 * k; S.jumps = 1; sfx('jump'); }
    else { S.vy = JUMP2 * k; S.jumps++; S.spin = 18; sfx('jump2'); burst(HX, S.y - 4, 8, S.drive > 0 ? [C.yellow, C.white] : [C.teal, C.white], 1.4); }
    if (beat) { S.beatFx = 14; addGauge(1); sfx('beat'); }
    if (beat && liveK() > .3) { S.pts += 100; pop('CHEER +100', HX, S.y - 48, C.pink); burst(HX, S.y - 10, 10, LIVE_COL, 2); }
    S.ground = false; S.noCut = false;
  }
  // FF DASH(5바퀴~): 공중에서 세 번째로 누르면 빨리감기 — 잠깐 그 높이에 떠서 빠르게 앞으로 가고, 그동안 장애물을 통과하며 엉킨 장애물은 끊는다
  function ffDash() { S.ff = 16; S.ffUsed = true; S.vy = 0; S.spin = 0; sfx('ff'); burst(HX, S.y - 16, 10, [C.white, C.glow], 1.6); }
  function burst(x, y, n, colors, spd = 1.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (.4 + Math.random()) * spd;
      S.parts.push({ x, y, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 1, life:20 + Math.random() * 14, c:colors[i % colors.length] });
    }
  }
  const pop = (text, x, y, c = C.yellow) => S.pops.push({ text, x, y, t:60, c });
  // 능력이 켜져 있는 동안 맞으면 플레이 로그에 남긴다
  const markHit = () => { if (S.pickLog) { S.pickLog.hit = true; savePicks(); } };
  function damage() {
    S.hp--; S.combo = 0; S.chain = 0; S.lapHit = true; markHit();
    if (S.hp <= 0) { gameOver(); return false; }
    return true;
  }
  // 피격 기록(사망 원인 · 숨은 보정): o = 부딪힌 것 { t, tangle }
  function logHit(o, guarded) {
    S.lapHits++;
    const e = { lap:S.lap, t:o.t, tangle:!!o.tangle, guarded, deb:activeDebuffs().join('+'), drop:dropOn() || dropWarn(), live:S.live > 0,
                power:xfDir() ? POWERS[xfDir()].name : S.heat > 0 ? 'OVERHEAT' : '', hp:S.hp, fatal:false };
    hits.push(e); if (hits.length > LOG_MAX) hits.shift(); saveHits(); S.lastHit = e;
  }
  // onGuard: 잔상이 대신 맞았을 때 부딪힌 것을 부수는 일 · o: 부딪힌 것(피격 기록용)
  function hurt(onGuard, o) {
    logHit(o, S.ghosts.length > 0);
    if (S.ghosts.length) { guard(onGuard); return; }
    S.shake = 14; S.freeze = 8; S.flash = 6; sfx('hit');
    burst(HX, S.y - 14, 12, [C.red, C.white]);
    if (damage()) S.pendingRewind = true;
  }
  // 잔상이 대신 맞는다: 가장 가까운 지난 루프의 내가 달려들어 부딪힌 것을 부수고 흩어진다. HP와 되감기는 그대로지만
  // 실수는 실수라 콤보와 PERFECT는 잃는다. 구멍은 못 막는다(잔상은 뒤에서 달리니까)
  function guard(onGuard) {
    const g = S.ghosts.shift();
    S.lost.push(g); if (S.lost.length > 3) S.lost.shift(); // 흩어진 잔상은 PURIFY로 되살릴 수 있다
    S.guardFx = { x:g.x, t:16 }; markHit();
    S.combo = 0; S.chain = 0; S.lapHit = true; S.inv = 50; S.freeze = 6; S.shake = 8; S.flash = 3;
    burst(HX, S.y - 16, 18, [C.teal, C.white, C.glow], 2.4);
    pop('ECHO GUARD', HX, S.y - 48, C.glow); sfx('guard');
    if (onGuard) onGuard();
  }
  // 구멍에 빠짐: 구멍 가운데쪽으로 미끄러지며 멈추고(fallX) 상판을 뚫고 도시로 떨어진다. 깨진 가장자리 조각이 먼저 쏟아진다
  function fall(sx, w) {
    S.past.push({ d:S.d, total:S.total, y:GROUND, vy:0, ground:true, jumps:0, beatT:S.beatT });
    S.falling = FALL_T; S.ground = false; S.vy = 1.5; S.trail = [];
    S.fallX = S.d + sx + w / 2 - HX; S.fallSp = speedOf();
    for (let i = 0; i < 10; i++) S.parts.push({ x:sx + 3 + Math.random() * (w - 6), y:GROUND + Math.random() * 4, vx:(Math.random() - .5) * .8, vy:1 + Math.random() * 2, g:.55, life:60, c:['#1a5e77', '#051e31', C.yellow][i % 3] });
    sfx('fall'); logHit({ t:'P' }, false);
    if (damage()) S.pendingRewind = true;
  }
  function stepFall() {
    S.falling--;
    S.vy = Math.min(FALL_VMAX, S.vy + FALL_G); S.y += S.vy;
    if (S.d < S.fallX) { const dx = Math.min(S.fallX - S.d, S.fallSp); S.d += dx; S.total += dx; }
    S.fallSp *= .8;
    // 카메라는 몸이 상판을 지난 뒤부터 따라가고, 몸보다 조금 빨리 내려가 점점 아래(도착할 곳)를 더 보여준다
    const prev = S.cam;
    S.cam = Math.max(0, Math.min(CAM_MAX, (S.y - GROUND - 10) * 1.3)); S.camV = S.cam - prev;
    S.trail.push({ y:S.y, cam:S.cam });
    // 전선을 스치면 불꽃: 몇 층을 지나 떨어졌는지 손에 잡히게
    const mid = S.y - 16;
    for (const c of CABLES) { const cy = cableY(c, HX); if (mid - S.vy < cy && mid >= cy) { sfx('wire'); burst(HX, cy, 8, [C.glow, C.white], 1.6); } }
  }
  // 되감기: 부딪히면 테이프가 약 1.6초 전으로 되감긴다 (잃어버린 왕관의 시간 능력을 카세트로 옮긴 것)
  // 떨어졌을 때는 낙하부터 거꾸로 감아서, 구멍으로 다시 빨려 올라가는 모습이 먼저 보인다
  function startRewind() {
    S.pendingRewind = false;
    if (S.past.length < (S.trail.length ? 1 : 2)) { S.inv = 80; return; }
    S.rw = { snaps:S.past.slice(), i:S.past.length - 1, rise:S.trail };
    S.trail = []; S.cars = []; sfx('rewind');
    // 곡도 테이프처럼 거꾸로 감긴다: 되감기 화면이 도는 시간 동안 되돌아갈 지점(가장 오래된 기록의 박자)까지
    if (bgm.active) {
      const now = bgmTime(), back = now - beatToSong(S.rw.snaps[0].beatT), dur = (S.rw.rise.length + S.rw.snaps.length) / 3 / 60;
      bgm.pos = now - back; bgmPlay(now, true, Math.max(1, Math.min(4, back / Math.max(dur, .1))));
    }
  }
  function endRewind() {
    const s = S.rw.snaps[0];
    Object.assign(S, { d:s.d, prevD:s.d, total:s.total, y:s.y, vy:s.vy, ground:s.ground, jumps:s.jumps, beatT:s.beatT, falling:0, noCut:true, cam:0, camV:0, ff:0, ffUsed:false });
    S.rw = null; S.past = []; S.hist = []; S.inv = 80; sfx('play');
    if (bgm.active) bgmPlay(beatToSong(s.beatT));
  }
  // OVERDRIVE 중에 번 게이지는 쌓아 뒀다가 끝날 때 돌려받고, BREAK와 과열 중엔 차지 않는다. CLEAN 중엔 그대로 찬다
  // 충전량은 바퀴 표의 gauge 배율(후반일수록 많이) × 숨은 보정
  const gaugeMul = () => lapCfg(S.lap).gauge * (1 + DDA.gauge * S.assist);
  function addGauge(n) {
    if (S.drive > 0) { S.odBank += n; return; }
    if (S.climax > 0 || S.heat > 0 || S.pick) return;
    S.gauge = Math.min(GAUGE, S.gauge + n * gaugeMul());
    if (S.gauge >= GAUGE) openPick();
  }
  // 게이지가 차면: 세계가 느려지고(30%) 소리가 먹먹해지며, 주인공 둘레에 방향 키 세 개가 차례로 켜진다
  function openPick() { S.pick = { t:0, acc:0 }; S.flash = 3; sfx('pickOpen'); muffle(700, .2); }
  // 마모가 있으면 걷어내고, 없으면 다음 바퀴 마모를 미리 봉인한다(한 바퀴 앞까지만)
  const canPurify = () => S.wear > 0 || !S.seal;
  // 능력 지속시간: 바퀴 표의 power 배율(과열은 그만큼 짧게)
  const powerT = t => Math.round(t * lapCfg(S.lap).power);
  function logPick(dir) {
    const e = { dir, lap:S.lap, wear:S.wear, hp:S.hp, ghosts:S.ghosts.length, s0:score(), hit:false, died:false, gain:0, at:Date.now() };
    picks.push(e); if (picks.length > LOG_MAX) picks.shift(); savePicks();
    return e;
  }
  // 능력이 끝나면 그동안 번 점수를 로그에 적는다
  function endPower(dir) { const e = S.pickLog; if (!e || (dir && e.dir !== dir)) return; e.gain = score() - e.s0; S.pickLog = null; savePicks(); }
  // 고른 순간: 짧게 멈칫 + 플래시 + 소리가 확 열리고, 능력이 바로 시작된다
  function choose(dir) {
    if (dir === 'up' && !canPurify()) { sfx('deny'); return; }
    S.pick = null; S.pickFx = { dir, t:48, sub:'' };
    S.freeze = XF_STOP; S.flash = 0; S.shake = 6; S.xfIn = { dir, t:0 }; S.xfOut = null;
    const n = dir === 'up' ? 0 : dir === 'left' ? 1 : 2; sfx('choose', n); sfx('xform', n); muffle(20000, .45);
    endPower(); S.pickLog = logPick(dir);
    if (dir === 'left') { S.climax = S.climaxMax = powerT(CLIMAX_T); S.smash = 0; sfx('climax'); }
    else if (dir === 'up') purify();
    else { S.drive = S.driveMax = powerT(DRIVE_T); S.odBank = 0; }
  }
  // 시간 안에 못 고르면: 아무 능력도 켜지지 않고 게이지가 조금 빠진 채 남는다
  function skipPick() {
    S.pick = null; S.gauge = GAUGE * PICK_KEEP; muffle(20000, .3); sfx('deny');
    pop('NO PICK', HX, S.y - 48, C.mist);
    const e = logPick('none'); e.gain = 0; savePicks();
  }
  function purify() {
    // 화면에 있던 엉킨 장애물은 풀려 흩어진다 (마모를 걷어내기 전에 찾아야 보인다)
    eachObs((o, sx, key) => { if (o.tangle) { S.broken.add(key); burst(sx + wOf(o) / 2, GROUND - 14, 14, [C.white, C.glow, '#8a5a3a'], 2); } });
    const list = debuffsAt(S.lap), w = list.length;
    S.pickFx.sub = w > 0 ? list[w - 1] + ' OFF' : 'NEXT LOOP SEALED';
    if (S.wear > 0) S.wear--; else S.seal = 1;
    S.gauge = 0; S.cleanFx = 40 + XF_STOP; S.cleanW = w; S.inv = Math.max(S.inv, 40);
    S.clean = S.cleanMax = powerT(CLEAN_T + CLEAN_PER * w);
    if (S.lost.length && S.ghosts.length < 3) {
      const g = S.lost.pop(); g.x = HX; g.flash = 24; S.ghosts.push(g); S.echoIn = 0;
      pop('ECHO RESTORED', HX, S.y - 60, C.glow);
    }
  }
  // CLEAN이 끝나 마모가 돌아올 때, 이미 화면 안에 있는 엉킨 장애물이 눈앞에서 갑자기 생기지 않게 한다
  function endClean() { eachObs((o, sx, key) => { if (o.tangle) S.broken.add(key); }); endPower('up'); xfEnd('up'); }
  // BREAK로 부술 때마다: 연속으로 부술수록 +100 × 연속 횟수(최대 ×5)
  function smash(x, y, px, py) {
    S.smash++; const v = 100 * Math.min(5, S.smash);
    S.pts += v; S.shake = 6; sfx('smash');
    burst(x, y, 12 + S.smash * 2, [C.white, C.pink, C.yellow], 2.2);
    // BREAK 변신: 부딪힌 자리에서 큰 사각 픽셀 파편과 충격파
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, v2 = 1.5 + Math.random() * 2.5; S.parts.push({ x, y, vx:Math.cos(a) * v2, vy:Math.sin(a) * v2 - 1.5, life:24 + Math.random() * 12, c:i % 2 ? C.pink : C.white, s:3 }); }
    S.rings.push({ x, y, t:14, max:14, r:26, c:C.pink });
    pop(S.smash > 1 ? 'SMASH x' + S.smash + ' +' + v : '+' + v, px, py, C.pink);
  }
  // OVERDRIVE: 넘은 장애물에 바짝 붙어 달리던 잔상들이 부딪혀 부순다 (구멍은 부술 수 없다)
  function echoStrike(o, i, m) {
    const sx = Math.round(o.p - S.d + HX), w = wOf(o);
    const y = o.t === 'D' ? droneTop(o, S.lap) + 8 : o.t === 'L' ? GROUND - SIGN_GAP - 8 : GROUND - SIZE[o.t][1] / 2;
    S.broken.add(S.lap + ':' + i); S.shake = 4; sfx('smash');
    if (o.t === 'D') S.debris.push({ x:sx, y:y - 8, vy:-2 });
    burst(sx + w / 2, y, 10 + m * 4, [C.yellow, C.pink, C.white], 2.4);
  }
  /* ---------- 변신 상태 ---------- */
  // 지금 변신한 능력(겹치면 BREAK > OVERDRIVE > PURIFY 순으로 보인다)과 남은 프레임
  const xfDir = () => S.climax > 0 ? 'left' : S.drive > 0 ? 'right' : S.clean > 0 ? 'up' : null;
  const xfLeft = () => S.climax > 0 ? S.climax : S.drive > 0 ? S.drive : S.clean;
  // 네온 세기 0~1: 끝나기 XF_OUT 전부터 줄어들며(접촉 불량처럼 가끔 깜빡) 꺼진다
  function xfK() {
    const left = xfLeft(); if (left >= XF_OUT) return 1;
    return hash(S.anim * .37) < .15 ? .2 : left / XF_OUT;
  }
  // 능력이 끝난 순간: 다른 능력이 아직 켜져 있지 않으면 테이프가 끊기며 원래 모습으로
  function xfEnd(dir) { if (xfDir()) return; S.xfOut = { dir, t:XF_SNAP, ph:ribbonPh(dir) }; sfx('powerdown'); burst(HX, S.y - 19, 10, [XCOL[dir], C.white], 1.2); }
  // 매 프레임 변신 이펙트 재료: BREAK 박자 충격파 · PURIFY 원형 파동과 모여드는 픽셀 · OVERDRIVE 네온 궤적 · 과열 연기
  function xfStep() {
    const d = xfDir(), cy = S.y - 19;
    if (d === 'left' && S.beatHit) S.rings.push({ x:HX, y:cy, t:16, max:16, r:34, c:C.pink });
    if (d === 'up') {
      if (S.anim % 45 === 0) S.rings.push({ x:HX, y:cy, t:44, max:44, r:60, c:C.white, soft:true });
      if (S.anim % 3 === 0) S.xfp.push({ a:Math.random() * Math.PI * 2, r:26 + Math.random() * 16, life:24, c:Math.random() < .5 ? C.white : C.glow });
    }
    if (d === 'right' && !S.falling) S.odTrail.push({ t:S.total, y:S.y - 14 });
    S.odTrail = S.odTrail.filter(p => S.total - p.t < HX + 20);
    if (S.heat > 0 && S.anim % 3 === 0) S.parts.push({ x:HX - 6 + Math.random() * 12, y:S.y - 14 - Math.random() * 16, vx:-.2, vy:-.5, g:-.01, life:26, c:Math.random() < .5 ? '#5a2a30' : C.red });
  }
  const comboMult = () => Math.min(S.drive > 0 ? 8 : 5, 1 + Math.floor(S.combo / 8));
  // 충전 구간: 게이트에 다가가는 동안(gateGauge > 1인 바퀴만) 카세트가 하얗게 달아올라 게이지가 더 찬다 — 5바퀴 직전에 능력을 준비해 들어가게
  const chargeZone = () => lapCfg(S.lap).gateGauge > 1 && gateZone() >= 1;
  function collect(x, y) {
    S.combo++;
    const mult = comboMult(), boost = chargeZone();
    S.pts += 50 * mult * (S.drive > 0 ? 2 : 1);
    burst(x, y, boost ? 9 : 5, boost ? [C.white, C.yellow] : [C.yellow, C.teal], 1.1);
    sfx('pick', Math.min(10, S.combo % 10));
    addGauge(boost ? lapCfg(S.lap).gateGauge : 1);
  }
  function nextLap() {
    const g = Math.min(4, S.lap - 1); // 이번 전환의 고장 단계: 1→2 바퀴 0 … 5바퀴부터 4
    S.ghosts.unshift({ rec:S.rec, x:-40, flash:0 }); if (S.ghosts.length > 3) S.ghosts.pop();
    S.echoIn = 160;
    S.rec = newRec();
    const perfect = !S.lapHit; S.lapHit = false;
    const before = debuffsAt(S.lap), pw0 = lapCfg(S.lap).power, nw = nextWear();
    S.lap++; S.wear = nw; S.seal = 0; S.lapHits = 0;
    // 테이프 라벨: 새로 걸린 마모(▼) · 바퀴가 걷어낸 마모(✦ clean) · 새 데크 기능(▲, 2~5바퀴) 또는 능력 성장(▲ DECK, 표에 있는 바퀴까지)
    const now = debuffsAt(S.lap), c = lapCfg(S.lap), card = [];
    for (const d of now) if (!before.includes(d)) card.push({ k:'bad', name:d, text:BAD_K[d] });
    if (c.clean) for (const d of before) if (!now.includes(d)) card.push({ k:'clean', name:c.clean, text:d + ' 해제 · ' + K.hc });
    if (S.lap <= 5) card.push({ k:'good', name:TAPE[wearMax()].good, text:TAPE[wearMax()].goodK });
    else if (S.lap < LOOPS.length && c.power > pw0) card.push({ k:'good', name:'DECK +' + Math.round((c.power - 1) * 100) + '%', text:K.deck });
    S.card = card.length ? card : null; S.tapeCard = card.length ? 240 : 0;
    const keep = s => new Set([...s].filter(k => k.startsWith(S.lap + ':')));
    S.broken = keep(S.broken); S.got = keep(S.got); S.near = keep(S.near); S.fired = keep(S.fired);
    S.banner = 0;
    if (perfect) {
      S.pts += 1000; S.banner = 110; S.bannerWord = 'perfect';
      S.sub = S.hp < HPMAX ? 'HP +1   BONUS +1000' : 'BONUS +1000';
      if (S.hp < HPMAX) S.hp++;
      S.lapSfx = 'perfect'; // 되감기가 끝나 음악이 다시 들어올 때 울린다
    }
    S.liveDone = false;
    startWarp(g);
  }
  /* ---------- Loop Gateway ---------- */
  // 게이트(이번 바퀴 끝)까지 남은 거리와 접근 단계 1·2·3. 통과 중·낙하 중엔 0
  const gateDist = () => TRACK - S.d;
  const gateZone = () => { if (!S || S.warp || S.falling || S.d < 0) return 0; const d = gateDist(); return d < GATE_AP[2] ? 3 : d < GATE_AP[1] ? 2 : d < GATE_AP[0] ? 1 : 0; };
  // 되감기 연출이나 가운데 OSD가 떠 있는 동안은 다른 안내(PERFECT · 테이프 라벨 · ECHO 이름표)가 기다린다
  const loopBusy = () => !!S.warp || (!!S.osd && S.osd.t < OSD_BIG);
  // 릴 회전: 평소 앞으로 돌다가 1단계에서 느려지고 2단계부터 거꾸로, 3단계와 통과 중엔 빠르게 되감는다
  const reelSpin = () => { const d = gateDist(); return S.warp ? -.6 : d < GATE_AP[2] ? -.3 : d < GATE_AP[1] ? -.08 : d < GATE_AP[0] ? .06 * (d - GATE_AP[1]) / (GATE_AP[0] - GATE_AP[1]) : .06; };
  function gateStep() {
    S.reel += reelSpin();
    const z = gateZone();
    if (z >= 1 && !S.gateCue) { S.gateCue = true; const sec = gateDist() / Math.max(1, speedOf()) / 60; sfx('swell', sec); bgmGhost(sec); }
    // 2단계부터: 주변 픽셀이 세계와 반대 방향(뒤 → 앞)으로 흐른다
    if (z >= 2 && S.anim % 2 === 0) S.parts.push({ x:Math.random() * W * .7, y:10 + Math.random() * (GROUND - 20), vx:speedOf() * .5 + 2 + Math.random() * 2, vy:0, g:.0001, life:28, c:Math.random() < .5 ? C.glow : C.white, s:1 });
  }
  // 게이트 통과: 세계가 멈추고, 녹화해 둔 이번 바퀴 장면이 거꾸로 빠르게 감긴다. 오디오가 순간 끊긴 뒤 테이프 감기는 소리와 함께 피치가 떨어지고, 곡도 실제로 거꾸로 감긴다
  function startWarp(g) {
    const len = Math.min(60, WARP_T + WARP_PER * g);
    S.warp = { t:0, len, g, film:snaps.slice().reverse() };
    S.cars = []; S.gateCue = false;
    if (bgm.ghost) { try { bgm.ghost.stop(); } catch (e) {} bgm.ghost = null; }
    audioCut(.07); sfx('tapewarp', len / 60); muffle(900, len / 60 * .8);
    if (bgm.active) { const now = bgmTime(), rate = 3; bgm.pos = now - rate * len / 60; bgmPlay(now, true, rate); }
  }
  function warpStep() {
    const w = S.warp; w.t++; S.reel += reelSpin();
    // 4→5바퀴부터: 음악이 끊기듯 더듬는다
    if (w.g >= 3 && cut && w.t > 5) cut.gain.setValueAtTime((w.t >> 1) % 3 === 0 ? 0 : 1, ac.currentTime);
    if (w.t >= w.len) endWarp();
  }
  // 되감기가 끝나면: 음악이 강하게 다시 들어오고(신스 음악은 마디 처음부터), 화면이 안정되며 VHS OSD에 새 루프 번호가 뜬다
  // 3→4바퀴부터는 지난 장면이 통과 뒤에도 잠깐 현재 화면에 겹쳐 남는다
  function endWarp() {
    const w = S.warp; S.warp = null;
    audioOn(); muffle(20000, .05); sfx('reentry');
    if (S.lapSfx) { sfx(S.lapSfx); S.lapSfx = null; }
    if (bgm.active) bgmPlay(bgm.pos);
    music.step = 0;
    S.osd = { t:0, lap:S.lap, g:w.g };
    S.pastFx = w.g >= 2 ? 40 : 0; S.pastFilm = w.film;
    S.shake = 6 + w.g * 2; S.flash = 3;
    snaps.length = 0;
  }
  // 녹화: 이번 바퀴의 화면을 반 해상도로 남긴다
  const snaps = [];
  let snapAt = -1;
  function snapshot() {
    if (snapAt === S.anim) return; snapAt = S.anim;
    const c = document.createElement('canvas'); c.width = Math.round(W / 2); c.height = Math.round(H / 2);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(cv, 0, 0, c.width, c.height);
    snaps.push(c); if (snaps.length > SNAP_MAX) snaps.shift();
  }

  // 타이틀: 세계가 플레이 속도로 흐른다(주인공 · 충돌 없음). 게이트 한 칸만큼 지나면 그만큼 뒤로 감아도 화면은 그대로다
  function titleStep() {
    titleT++; idleT++; S.anim++;
    S.beatT = bgm.active && bgm.playing ? songToBeat(bgmTime()) : S.beatT + 1;
    const sp = speedOf(); S.prevD = S.d; S.d += sp; S.total += sp; S.reel += .06;
    if (S.d >= -(W - HX) - 80) { S.d -= GATE_GAP; S.prevD -= GATE_GAP; }
    if (idleT >= IDLE_T + INFO_T * 4) idleT = 0;
  }
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  function update() {
    if (mode === 'title') { titleStep(); return; }
    if (mode === 'over') {
      S.overT++;
      if (S.falling > 0) stepFall();
      stepFx(0);
      if (S.overT > 720) enterTitle();
      return;
    }
    if (mode !== 'play') return;
    // 시작 전환: 카메라가 플레이 위치로 올라오고, 주인공이 들어와 자리를 잡는 순간 조작이 열린다
    if (S.enter) {
      const e = S.enter; e.t++;
      S.cam = TITLE_CAM * (1 - ease(Math.min(1, e.t / 36))); S.camV = 0;
      if (e.t === ENTER_CTRL) sfx('go');
      if (e.t >= ENTER_T) { S.enter = null; S.cam = 0; }
    }
    if (S.guardFx && --S.guardFx.t <= 0) S.guardFx = null;
    if (S.pickFx && --S.pickFx.t <= 0) S.pickFx = null;
    if (S.cleanFx > 0) S.cleanFx--;
    // 변신 연출은 Hit Stop 동안에도 흐른다(세계만 멈춘다)
    if (S.xfIn && ++S.xfIn.t >= XF_IN) S.xfIn = null;
    if (S.xfOut && --S.xfOut.t <= 0) S.xfOut = null;
    if (S.osd && ++S.osd.t >= OSD_T) S.osd = null;
    if (S.pastFx > 0) S.pastFx--;
    if (S.warp) { warpStep(); return; }
    if (S.freeze > 0) { S.freeze--; if (S.freeze === 0 && S.pendingRewind && !S.falling) startRewind(); return; }
    if (S.rw) {
      S.anim++;
      if (S.rw.rise.length) {
        let t; for (let k = 0; k < 3 && S.rw.rise.length; k++) t = S.rw.rise.pop();
        S.camV = t.cam - S.cam; S.y = t.y; S.cam = t.cam;
        return;
      }
      S.cam = 0; S.camV = 0;
      S.rw.i -= 3;
      const s = S.rw.snaps[Math.max(0, S.rw.i)];
      S.d = s.d; S.total = s.total; S.y = s.y;
      if (S.rw.i <= 0) endRewind();
      return;
    }
    if (S.pick) {
      if (++S.pick.t >= PICK_T) skipPick();
      else { S.pick.acc += PICK_SLOW; if (S.pick.acc < 1) return; S.pick.acc -= 1; }
    }
    if (S.slow > 0) { S.slow--; if (S.slow % 2) { stepFx(0); return; } }

    S.anim++;
    // 숨은 보정: 목표치(같은 바퀴 연속 게임오버 · 이번 바퀴 피격 수)로 천천히 다가간다
    const goal = Math.min(1, Math.max(0, S.lap === fails.lap ? (fails.n - 1) * .5 : 0, (S.lapHits - 2) * .5));
    S.assist += Math.max(-DDA.ramp, Math.min(DDA.ramp, goal - S.assist));
    const pbt = S.beatT;
    S.beatT = bgm.active && bgm.playing ? songToBeat(bgmTime()) : S.beatT + 1;
    S.beatHit = Math.floor(S.beatT / fpb()) !== Math.floor(pbt / fpb()); // 이번 프레임에 박이 넘어갔나
    if (bgm.active) bgmFx();
    const sp = S.falling ? 0 : speedOf() * (S.ff > 0 ? 2.4 : 1);
    S.prevD = S.d; S.d += sp; S.total += sp;
    if (S.climax > 0 || S.drive > 0) S.pts += sp / 10;
    if (S.d >= TRACK) { S.d -= TRACK; S.prevD -= TRACK; S.past = []; nextLap(); }

    if (S.queued) {
      S.queued = false;
      if (!S.falling) {
        if (S.ground) jump(1);
        else if (S.vy > 0 && GROUND - S.y < 14) S.buf = 8;
        else if (S.jumps < airMax()) jump(2);
        else if (wearMax() >= 4 && !S.ffUsed && !heavy()) ffDash();
      }
    }
    if (S.buf > 0) { S.buf--; if (S.ground && !S.falling) { jump(1); S.buf = 0; } }
    if (S.spin > 0) S.spin--;

    if (S.falling > 0) {
      stepFall();
      if (S.falling === 0) { if (S.pendingRewind) { startRewind(); return; } S.y = GROUND; S.vy = 0; S.ground = true; S.jumps = 0; S.cam = 0; S.camV = 0; }
    } else if (S.ff > 0) { S.ff--; S.vy = 0; }
    else if (!S.ground) {
      if (!held && !S.noCut && S.vy < -3) S.vy = -3;
      S.vy += GRAV; S.y += S.vy;
      if (S.y >= GROUND) {
        S.y = GROUND; S.vy = 0; S.ground = true; S.jumps = 0; S.chain = 0; S.noCut = false; S.ffUsed = false;
        burst(HX, GROUND - 1, 3, ['#3d5868'], .7);
      }
    }
    if (!S.falling && S.inv === 0) { S.past.push({ d:S.d, total:S.total, y:S.y, vy:S.vy, ground:S.ground, jumps:S.jumps, beatT:S.beatT }); if (S.past.length > 96) S.past.shift(); }
    if (S.d >= 0) S.rec[Math.floor(S.d / 4)] = Math.max(0, GROUND - S.y);
    S.hist.push(S.y); if (S.hist.length > 20) S.hist.shift();
    S.ghosts.forEach((g, i) => { const tx = echoSlot(i); g.x += (tx - g.x) * .09; if (g.flash) g.flash--; });
    if (S.echoIn > 0 && !loopBusy()) S.echoIn--;
    if (S.tapeCard > 0 && !loopBusy() && S.banner <= 0) S.tapeCard--;
    if (S.beatFx > 0) S.beatFx--;
    xfStep(); gateStep();
    if (dropPh() === DROP_PRE) sfx('drop');

    // 뒤에서 오는 차
    for (const off of [0, TRACK]) {
      const L = off ? S.lap + 1 : S.lap;
      OBS.forEach((o, i) => {
        if (o.t !== 'C' || !active(o, L)) return;
        const p = o.p + off, key = L + ':' + i;
        if (S.prevD < p && S.d >= p && !S.fired.has(key)) { S.fired.add(key); S.cars.push({ t:0, warn:carWarn(), x:-60, passed:false }); }
      });
    }
    const hx = HX - 6, hw = 12, hy = S.y - 30, hh = 30;
    for (const car of S.cars) {
      car.t++;
      if (car.t < car.warn) { if (car.t % 12 === 1) sfx('warn'); continue; }
      if (car.t === car.warn) sfx('car');
      car.x += 9;
      const bx = car.x + 4, bw = 44, by = GROUND - 15;
      if (!S.falling && !S.ff && bx < hx + hw && bx + bw > hx) {
        if (S.y > by + 2 && S.climax > 0 && !car.passed) { car.passed = true; smash(car.x + 26, GROUND - 9, HX, S.y - 48); car.x = W + 200; }
        else if (S.y > by + 2 && S.climax === 0 && S.inv === 0) { hurt(() => { burst(car.x + 26, GROUND - 9, 14, [C.white, C.red, C.gray], 2.4); car.x = W + 200; }, { t:'C' }); return; }
        else if (!car.passed && S.y <= by + 2) { car.passed = true; S.pts += 150; pop('DODGE +150', HX, S.y - 48, C.teal); sfx('close'); }
      }
    }
    S.cars = S.cars.filter(c => c.x < W + 60);

    if (!S.falling) {
      let stop = false;
      eachObs((o, sx, key, L) => {
        if (stop || mode !== 'play' || S.freeze) return;
        const w = wOf(o), h = SIZE[o.t][1];
        if (o.t === 'P') {
          if (S.ground && S.inv === 0 && S.climax === 0 && HX > sx + 3 && HX < sx + w - 3) { fall(sx, w); stop = true; }
          return;
        }
        if (o.t === 'S') {
          S.padPh[key] = (S.padPh[key] || 0) + 1 + 2.5 * padCharge(sx) + (S.springT[key] ? 4 : 0);
          if (sx < hx + hw && sx + w > hx && S.y >= GROUND - 14 && (S.ground || S.vy > 0)) {
            S.vy = SPRING; S.ground = false; S.jumps = 1; S.noCut = true; S.springT[key] = 10; S.pts += 50;
            sfx('spring'); burst(HX, GROUND - 6, 10, [C.yellow, C.white], 1.8); pop('BOING!', HX, S.y - 48, C.yellow);
          }
          return;
        }
        let b;
        if (o.t === 'D') { const t = droneTop(o, L); b = { x:sx + 2, y:t + 3, w:w - 4, h:h - 5 }; }
        else if (o.t === 'E') { if (!gateOn(o)) return; b = { x:sx + 16, y:GROUND - 46, w:41, h:44 }; }
        else if (o.t === 'L') b = { x:sx + 2, y:0, w:w - 4, h:GROUND - SIGN_GAP + 4 }; // 그림 머리끝(판정 +8px)이 판에 4px 닿으면 충돌
        else b = { x:sx + 3, y:GROUND - h + 2, w:w - 6, h:h - 2 };
        const xo = b.x < hx + hw && b.x + b.w > hx;
        if (S.ff > 0) {
          if (o.tangle && xo && b.y < hy + hh && b.y + b.h > hy) {
            S.broken.add(key); S.pts += 150; S.shake = 4; sfx('smash');
            burst(b.x + b.w / 2, b.y + b.h / 2, 14, [C.pink, C.glow, C.white], 2.2); pop('CUT +150', HX, S.y - 48, C.pink);
          }
          return;
        }
        if (xo && b.y < hy + hh && b.y + b.h > hy) {
          if (o.t === 'D' && S.vy > 0 && S.y - S.vy <= b.y + 6) {
            S.broken.add(key); S.chain++; S.vy = STOMP; S.jumps = 1; S.noCut = true; S.freeze = 3; S.shake = 4;
            S.pts += 200 * S.chain; addGauge(3);
            S.debris.push({ x:sx, y:b.y, vy:-2 });
            burst(sx + 9, b.y + 4, 12, [C.white, C.teal, C.red], 2);
            pop(S.chain > 1 ? 'STOMP x' + S.chain : 'STOMP +200', HX, S.y - 48, C.white); sfx('stomp', S.chain);
          } else if (S.climax > 0) {
            S.broken.add(key);
            smash(b.x + b.w / 2, o.t === 'L' ? b.h - 8 : b.y + b.h / 2, b.x + b.w / 2, o.t === 'L' ? b.h + 4 : b.y - 6);
          } else if (S.inv === 0) { if (o.t === 'E') sfx('zap'); hurt(() => S.broken.add(key), o); stop = true; }
        } else if (xo && !S.ground && o.t !== 'D' && o.t !== 'E' && !S.near.has(key)) {
          const gap = o.t === 'L' ? hy - (b.y + b.h) : b.y - S.y;
          if (gap >= 0 && gap < 8) { S.near.add(key); S.pts += 100; S.slow = 16; pop('CLOSE! +100', HX, S.y - 48, C.white); sfx('close'); burst(HX, S.y, 8, [C.teal, C.white], 1.4); }
        }
      });
      if (stop || mode !== 'play') return;
      // SYNC: 장애물 한가운데를 지나는 순간, 지난 루프의 나와 같은 높이(±8)로 떠 있으면 그 잔상들이 내 몸에 겹친다
      // 같은 동작을 여러 루프 동안 다듬을수록(맞춘 잔상이 많을수록) 보상이 커진다
      if (S.ghosts.length && !S.ground && !S.rw) {
        const h = GROUND - S.y, idx = Math.floor(S.d / 4);
        OBS.forEach((o, i) => {
          if (o.t === 'C' || o.t === 'S' || !active(o, S.lap) || S.broken.has(S.lap + ':' + i)) return;
          const c = o.p + wOf(o) / 2;
          if (!(S.prevD < c && S.d >= c) || h < 6) return;
          // 허용 높이는 바퀴 표의 echo(후반일수록 넓게), CLEAN 중엔 테이프가 깨끗해 +6 더 넓다
          const tol = lapCfg(S.lap).echo + (S.clean > 0 ? 6 : 0);
          const hit = S.drive > 0 ? S.ghosts.slice() : S.ghosts.filter(g => { const e = g.rec[idx] || 0; return e > 6 && Math.abs(e - h) <= tol; });
          if (!hit.length) return;
          const m = hit.length, strike = S.drive > 0 && o.t !== 'P';
          hit.forEach(g => { g.x = HX - 2; g.flash = 16; });
          S.pts += 100 * m * (S.drive > 0 ? 2 : 1); addGauge(1 + m);
          if (strike) echoStrike(o, i, m);
          pop(strike ? (m > 1 ? 'ECHO STRIKE x' + m : 'ECHO STRIKE') : m > 1 ? 'SYNC x' + m : 'SYNC', HX, S.y - 48, strike ? C.yellow : C.glow); sfx('sync', m);
          burst(HX, S.y - 16, 6 + m * 3, [C.glow, C.white], 1.3);
        });
      }
    }

    for (const off of [0, TRACK]) {
      const L = off ? S.lap + 1 : S.lap;
      for (let i = 0; i < PICK.length; i++) {
        const k = PICK[i], key = L + ':' + i;
        if (S.got.has(key) || k.lap > L) continue;
        const sx = k.p + off - S.d + HX;
        if (sx < HX - 16 || sx > HX + 16) continue;
        const py = GROUND - k.h;
        if (sx + 7 > hx && sx - 7 < hx + hw && py > hy && py - 10 < hy + hh) { S.got.add(key); collect(sx, py - 4); }
      }
    }
    // BREAK가 끝나면 아주 짧은 무적 뒤 과열(후반일수록 짧게). OVERDRIVE가 끝나면 쌓아 둔 게이지를 1.5배로 돌려받는다. CLEAN이 끝나면 마모가 돌아온다
    if (S.climax > 0) { S.climax--; S.gauge = GAUGE * S.climax / S.climaxMax; if (S.climax === 0) { S.gauge = 0; S.inv = 20; S.heat = Math.round(HEAT_T / lapCfg(S.lap).power); endPower('left'); xfEnd('left'); } }
    if (S.drive > 0) {
      S.drive--; S.gauge = GAUGE * S.drive / S.driveMax;
      if (S.drive === 0) {
        const n = Math.round(S.odBank * OD_BANK); S.odBank = 0; endPower('right'); xfEnd('right');
        if (n) { pop('CHARGE +' + Math.round(Math.min(1, n * gaugeMul() / GAUGE) * 100) + '%', HX, S.y - 60, C.yellow); addGauge(n); }
      }
    }
    if (S.heat > 0) S.heat--;
    if (S.clean > 0 && --S.clean === 0) endClean();
    // IDIOTAPE LIVE: 무대 그림이 화면 오른쪽 끝에 들어오는 순간 라이저 → liveIn 뒤 드롭. 박자마다 꽃가루, 마디 첫 박엔 양옆 연주자에게서 픽셀이 터진다
    // 드롭 맞추기: 곡에 drop이 정해져 있으면 곡을 드롭 직전으로 넘기고(DJ 컷), 아니면 다음 마디 첫 박까지 라이저를 늘인다
    const liveAt = SECRET_AT - (W - HX) + 20;
    if (liveLap(S.lap) && !S.liveDone && !S.rw && S.prevD < liveAt && S.d >= liveAt) {
      const f = fpb(), toBar = (4 - (S.beatT / f) % 4) * f;
      if (bgm.active && BGM.drop != null) { S.liveIn = LIVE_IN; bgmPlay(BGM.drop - LIVE_IN / 60); }
      else S.liveIn = Math.round(toBar < 12 ? toBar + 4 * f : toBar);
      S.liveDone = true; S.liveLen = S.live = Math.max(S.liveIn + 120, Math.min(LIVE_T, Math.floor((LIVE_END - S.d) / speedOf()))); sfx('riser', S.liveIn / 60);
    }
    if (S.live > 0) {
      const t = S.liveLen - S.live, f = fpb();
      // 드롭: 시간이 잠깐 늘어진다(반 속도 12프레임) — 화면이 터지는 순간 손이 바빠지지 않게
      if (t === S.liveIn) { sfx('livedrop'); S.flash = 7; S.shake = 8; S.slow = 24; }
      if (t >= S.liveIn && S.beatHit) {
        for (let i = 0; i < 6; i++) { const left = i % 2; S.parts.push({ x:left ? Math.random() * 110 : W - Math.random() * 110, y:-VIEW_TOP - 4, vx:(Math.random() - .5) * .6, vy:.6 + Math.random(), g:.015, life:150, c:LIVE_COL[(i + Math.floor(S.beatT / f)) % 4] }); }
        if (Math.floor(S.beatT / f) % 4 === 0) { burst(56, 120, 16, LIVE_COL, 2.6); burst(W - 56, 120, 16, LIVE_COL, 2.6); }
      }
      if (--S.live === 0) { S.pts += 500; pop('ENCORE +500', HX, S.y - 60, C.yellow); sfx('secret'); }
    }
    for (const k in S.springT) if (--S.springT[k] <= 0) delete S.springT[k];
    if (S.inv > 0) S.inv--;
    if (S.banner > 0 && !loopBusy()) S.banner--;
    if (S.flash > 0) S.flash--;
    if (S.shake > 0) S.shake--;
    stepFx(sp);
  }
  function stepFx(sp) {
    for (const p of S.parts) { p.x += p.vx - sp * .5; p.y += p.vy; p.vy += p.g || .12; p.life--; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const d of S.debris) { d.x -= sp; d.vy += .35; d.y = Math.min(GROUND - 9, d.y + d.vy); }
    S.debris = S.debris.filter(d => d.x > -30);
    for (const p of S.pops) { p.t--; p.y -= .4; }
    S.pops = S.pops.filter(p => p.t > 0);
    for (const r of S.rings) r.t--;
    S.rings = S.rings.filter(r => r.t > 0);
    for (const p of S.xfp) { p.r *= .86; p.life--; }
    S.xfp = S.xfp.filter(p => p.life > 0 && p.r > 1);
  }

  /* ================= 그리기 도구 ================= */
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const mod = (a, n) => ((a % n) + n) % n;
  function txt(s, x, y, color, size = 8, align = 'left', shadow = C.ink, font = F_PIX, weight = '700') {
    ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'top';
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, x + 1, y + 1); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  const num = (s, x, y, color, size = 8, align = 'left') => txt(s, x, y, color, size, align, C.ink, F_NUM, '400');
  // 뒷면 태그와 같은 칩 (RUNNER · 1 PLAYER)
  function chip(s, x, y, bg, fg = C.ink) {
    ctx.font = `700 8px ${F_PIX}`; const w = Math.ceil(ctx.measureText(s).width) + 10;
    R(C.ink, x + 2, y + 2, w, 13); R(C.ink, x - 1, y - 1, w + 2, 15); R(bg, x, y, w, 13);
    txt(s, x + 5, y + 2, fg, 8, 'left', null); return w;
  }
  // 한글은 표지 헤드라인처럼 1비트 픽셀 글자로 (Noto Sans KR Black/Bold)
  const KCACHE = new Map();
  function kimg(str, size, color, weight) {
    const key = str + '|' + size + '|' + color + '|' + weight;
    if (KCACHE.has(key)) return KCACHE.get(key);
    const font = `${weight} ${size}px "Noto Sans KR", sans-serif`;
    const m = document.createElement('canvas').getContext('2d'); m.font = font;
    const w = Math.ceil(m.measureText(str).width) + 4, h = size + 8;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.font = font; g.textBaseline = 'top'; g.fillStyle = '#fff'; g.fillText(str, 1, 1);
    const src = g.getImageData(0, 0, w, h), out = g.createImageData(w, h);
    const n = parseInt(color.slice(1), 16), r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    for (let i = 0; i < w * h; i++) if (src.data[i * 4 + 3] > 110) { out.data[i * 4] = r; out.data[i * 4 + 1] = gg; out.data[i * 4 + 2] = b; out.data[i * 4 + 3] = 255; }
    g.clearRect(0, 0, w, h); g.putImageData(out, 0, 0);
    KCACHE.set(key, c); return c;
  }
  function ktxt(str, x, y, color, size = 12, align = 'left', weight = 900) {
    const c = kimg(str, size, color, weight), s = kimg(str, size, C.ink, weight);
    const dx = Math.round(align === 'center' ? x - c.width / 2 : align === 'right' ? x - c.width : x);
    ctx.drawImage(s, dx + 1, Math.round(y) + 1); ctx.drawImage(c, dx, Math.round(y));
  }
  function dim(a, c = '#02060a') { ctx.globalAlpha = a; R(c, 0, 0, W, H); ctx.globalAlpha = 1; }

  /* ================= 배경 (월드 좌표: 0~DECK, 위로 VIEW_TOP만큼 천장이 더 보인다) ================= */
  function drawBG(s, speed, fever, anim, beat) {
    R(C.night, 0, -VIEW_TOP, W, DECK + VIEW_TOP);
    const bg = IMG.bg;
    if (ok(bg)) {
      const per = bg.width * 2;
      for (let x = -mod(Math.round(s), per); x < W; x += per) {
        ctx.drawImage(bg, x, 0);
        ctx.save(); ctx.translate(x + per, 0); ctx.scale(-1, 1); ctx.drawImage(bg, 0, 0); ctx.restore();
        // 늘어난 천장: bg 맨 위 줄들(균일한 천장 어둠)을 위로 뒤집어 이어 붙인다
        ctx.save(); ctx.translate(x, 0); ctx.scale(1, -1); ctx.drawImage(bg, 0, 0, bg.width, VIEW_TOP, 0, 0, bg.width, VIEW_TOP); ctx.restore();
        ctx.save(); ctx.translate(x + per, 0); ctx.scale(-1, -1); ctx.drawImage(bg, 0, 0, bg.width, VIEW_TOP, 0, 0, bg.width, VIEW_TOP); ctx.restore();
      }
    }
    const lamp = fever ? FEVER[(anim >> 3) % 3] : C.teal;
    if (beat) { ctx.globalAlpha = fever ? .16 : .06; R(lamp, 0, -VIEW_TOP, W, GROUND + VIEW_TOP); ctx.globalAlpha = 1; }
    if (fever) { ctx.globalAlpha = .12; R(lamp, 0, -VIEW_TOP, W, GROUND + VIEW_TOP); ctx.globalAlpha = 1; }
    if (speed > 3.6) {
      ctx.globalAlpha = Math.min(.5, (speed - 3.6) * .3);
      for (let i = 0; i < 9; i++) R(fever ? lamp : C.glow, W - mod(s * 2.4 + i * 71, W + 60), 50 + ((i * 37) % 130), 20 + (i * 13) % 30, 1);
      ctx.globalAlpha = 1;
    }
  }
  /* ================= 고가도로 아래: 구멍 너머와 낙하 장면 ================= */
  // 아래 그림들도 터널처럼 박자에 맞춰 숨 쉰다 (BEAT 박자 순간 · BEATP 박자 안 위치 0~1 · LAMP 지금 조명 색)
  let BEAT = false, BEATP = 0, LAMP = C.teal;
  const CABLES = [{ y:DECK + SLAB + 100, sag:10, off:0 }, { y:DECK + SLAB + 170, sag:14, off:140 }], CABLE_SPAN = 300, FOG = [DECK + SLAB + 130, DECK + SLAB + 235], SIGN_X = 150;
  // 전선은 CABLE_SPAN마다 기둥에 걸려 늘어지고, 도로보다 느리게(0.6배) 흘러 멀리 있는 것처럼 보인다
  const cableY = (c, x) => { const u = mod(x + S.total * .6 + c.off, CABLE_SPAN) / CABLE_SPAN; return c.y + Math.round(c.sag * 4 * u * (1 - u)); };
  function mirrorTile(img, sy, sh, dy, scroll) {
    const per = img.width * 2;
    for (let x = -mod(Math.round(scroll), per); x < W; x += per) {
      ctx.drawImage(img, 0, sy, img.width, sh, x, dy, img.width, sh);
      ctx.save(); ctx.translate(x + per, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, sy, img.width, sh, 0, dy, img.width, sh); ctx.restore();
    }
  }
  // 협곡 원경: 도로보다 느리게 움직여 멀리 있는 것처럼 보인다. 구멍 안과 낙하 장면이 같은 그림이라 떨어지기 전부터 어디로 가는지 보인다
  function drawCity(top, bottom) {
    R('#02090f', 0, top, W, bottom - top);
    const img = IMG.under, cam = Math.round(S.cam);
    if (ok(img)) mirrorTile(img, TRUSS, img.height - TRUSS, FAR_Y0 + Math.round(cam * (1 - FAR_PY)), S.total * FAR_PX);
    if (BEAT) { ctx.globalAlpha = .08; R(LAMP, 0, top, W, bottom - top); ctx.globalAlpha = 1; }
  }
  // 전선: 박자마다 전기가 흐른다 (터널 조명과 전기 게이트가 박자에 맞춰 깜빡이는 이유)
  function cable(c) {
    for (let x = 0; x < W; x += 2) { const y = cableY(c, x); R('#24495a', x, y - 1, 2, 1); R('#02090f', x, y, 2, 2); }
    const px = Math.round(BEATP * W);
    for (let k = 0; k < 10; k++) { ctx.globalAlpha = 1 - k / 10; R(k ? LAMP : C.white, px - k * 2, cableY(c, px - k * 2) - 1, 2, 3); }
    ctx.globalAlpha = 1;
  }
  // 되감기 간판: 낙하가 끝나는 깊이에 걸려 있다. 떨어질 땐 ◀◀가 박자에 깜빡이고, 테이프가 감기면 네온이 확 밝아진다
  // 부딪히면 되감긴다는 규칙(설명 06)을 세계 안에서 다시 보여준다
  const RW_ARROWS = [5, 60, 9, 8];
  function rewindSign(x, y) {
    neonSign('rw', x, y, 5, S.anim, 1, !!S.rw);
    if (!S.rw && !(BEAT || BEATP > .5)) sgPart('rwo', RW_ARROWS, x, y);
    if (S.rw) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7; pix(IMG.signs, SG.rw, x, y); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }
  // 떨어질 때만 보이는 상판 아래: 트러스(도로와 같이 움직임) → 구멍으로 새는 터널 불빛 → 안개층 → 전선·간판, 마지막으로 상판 앞면
  function drawUnderDeck(pits) {
    const cam = Math.round(S.cam); if (cam <= 0) return;
    const top = DECK + SLAB, bottom = DECK + cam;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
    drawCity(top, bottom);
    if (ok(IMG.under)) mirrorTile(IMG.under, 0, TRUSS, top, S.total);
    // 구멍으로 새어 내려오는 터널 불빛: 떨어진 자리이자 되감기로 돌아갈 길
    for (const [px, pw] of pits) {
      const g = ctx.createLinearGradient(0, top, 0, top + 260); g.addColorStop(0, 'rgba(189,243,238,.3)'); g.addColorStop(1, 'rgba(189,243,238,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px + pw, top); ctx.lineTo(px + pw + 16, top + 260); ctx.lineTo(px - 16, top + 260); ctx.closePath(); ctx.fill();
    }
    // 안개층: 한 겹씩 뚫고 지날 때마다 내려간 깊이가 느껴진다
    for (const fy of FOG) {
      const g = ctx.createLinearGradient(0, fy - 18, 0, fy + 18); g.addColorStop(0, 'rgba(143,166,176,0)'); g.addColorStop(.5, 'rgba(143,166,176,.14)'); g.addColorStop(1, 'rgba(143,166,176,0)');
      ctx.fillStyle = g; ctx.fillRect(0, fy - 18, W, 36);
    }
    for (const c of CABLES) cable(c);
    if (mode !== 'title' && !S.enter) rewindSign(SIGN_X, cableY(CABLES[1], SIGN_X + 10) - 1);
    ctx.restore();
    // 상판 앞면: 도로 가장자리와 같은 색, 반사등 줄이 여기가 고가도로의 끝선이라는 걸 알려준다
    R('#1a5e77', 0, DECK, W, 1); R('#03141f', 0, DECK + 1, W, SLAB - 1);
    for (let x = -mod(Math.round(S.total), 24); x < W; x += 24) R(C.glow, x, DECK + 4, 2, 1);
  }
  // 낙하 속도선(카메라가 빨리 내려갈수록 길어짐)과 깊이 안개(아래 거리의 빛이 차오름). 화면 기준으로 그린다
  function drawFallFx() {
    if (S.cam <= 0) return;
    const depth = S.cam / CAM_MAX, k = Math.min(1, Math.abs(S.camV) / 6);
    const g = ctx.createLinearGradient(0, H * .4, 0, H); g.addColorStop(0, 'rgba(25,211,197,0)'); g.addColorStop(1, `rgba(25,211,197,${(.2 * depth).toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(0, H * .4, W, H * .6);
    if (k < .05) return;
    for (let i = 0; i < 16; i++) {
      const x = (i * 71 + 23) % W, len = 4 + (i % 4) * 4 + Math.round(k * 20);
      const y = mod(i * 113 - S.cam * (1.3 + (i % 3) * .3), H + 60) - 30;
      ctx.globalAlpha = k * (.2 + (i % 3) * .12);
      R(i % 6 === 0 ? C.pink : i % 2 ? C.glow : C.white, x, y, 1, len);
    }
    ctx.globalAlpha = 1;
  }
  /* ================= 테이프 마모 (바퀴 표대로, 화면 효과는 HUD를 건드리지 않는다) ================= */
  // NOISE: 약한 CRT 스노우와 천천히 굴러 내려가는 밝은 띠. 마모가 걸려 있는 동안 늘 깔리고, 걸린 마모가 많을수록 눈이 조금씩 늘어난다
  function drawTapeNoise() {
    const n = activeDebuffs().length; if (!n || S.rw || S.live > 0 || mode !== 'play') return;
    ctx.globalAlpha = .18;
    for (let i = 0; i < 20 + n * 10; i++) R(Math.random() < .5 ? C.white : C.mist, Math.random() * W, Math.random() * H, 1, 1);
    ctx.globalAlpha = .05; R(C.white, 0, (S.anim * .7) % (H + 40) - 20, W, 10); ctx.globalAlpha = 1;
  }
  // TANGLE(5바퀴~): 강한 글리치 — VHS 트래킹 띠가 화면을 훑으며 그 줄이 옆으로 밀리고, 가끔 화면 전체가 분홍빛으로 이중으로 번진다(세기는 바퀴 표의 vfx)
  function drawTangle() {
    if (!has('TANGLE') || S.rw || S.live > 0 || mode !== 'play') return;
    const v = lapCfg(S.lap).vfx;
    const dur = 40, ph = (S.anim + 53) % 150;
    if (ph < dur) {
      const bh = 12, by = Math.round(H - bh - ph / dur * (H - bh)), dx = ((ph >> 1) % 2 ? 1 : -1) * 3;
      const y0 = Math.round(by * SY), h0 = Math.round(bh * SY);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv, 0, y0, cv.width, h0, Math.round(dx * SX), y0, cv.width, h0); ctx.restore();
      ctx.globalAlpha = .18; R(C.white, 0, by, W, 1); ctx.globalAlpha = .25; R(C.pink, 0, by + bh, W, 1); ctx.globalAlpha = 1;
    }
    if ((S.anim + 90) % 240 < 6) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3 * v;
      ctx.drawImage(cv, Math.round(3 * SX), 0); ctx.restore();
      ctx.globalAlpha = .08 * v; R(C.pink, 0, 0, W, H); ctx.globalAlpha = 1;
    }
  }
  // DROPOUT: 신호가 끊기는 동안 세계가 잡음에 묻힌다. 색과 디테일은 잃어도 장애물 윤곽(한 색 실루엣)은 잡음 위에 남는다 — 무엇이 어디 있는지는 늘 보이게
  // 잔상과 나도 잡음 위에 남는다. 직전엔 지직거림이 늘며 예고
  function drawDropout() {
    const p = dropPh(), len = dropLen(); if (p < 0 || p >= DROP_PRE + len) return;
    const top = Math.round(S.cam) - VIEW_TOP;
    if (p < DROP_PRE) {
      ctx.globalAlpha = .5;
      for (let i = 0; i < p * 2; i++) R(Math.random() < .5 ? C.white : C.glow, Math.random() * W, top + Math.random() * H, 1 + (Math.random() * 3 | 0), 1);
      ctx.globalAlpha = 1; return;
    }
    const k = p - DROP_PRE, fade = Math.min(1, k / 4, (len - k) / 6);
    ctx.globalAlpha = .74 * fade; R(C.night, 0, top, W, H);
    ctx.globalAlpha = .55 * fade;
    for (let i = 0; i < 220; i++) R(Math.random() < .7 ? '#3d5868' : C.mist, Math.random() * W, top + Math.random() * H, 1 + (Math.random() * 2 | 0), 1);
    for (let i = 0; i < 3; i++) R(C.white, 0, top + Math.random() * H, W, 1);
    hazardOutline(.75 * fade);
    ctx.globalAlpha = 1;
  }
  // 장애물 윤곽: 그림 모양 그대로 한 색으로. 신호처럼 가끔 흐려질 뿐 사라지지 않는다. 점프대는 노랗게(밟을 곳)
  const HZ_OF = { B:'bar', W:'block', T:'crate', D:'drone' };
  function hazardOutline(a) {
    const col = C.mist;
    eachObs((o, sx, key, L) => {
      ctx.globalAlpha = a * (hash(S.anim * .31 + o.p) < .12 ? .55 : 1);
      const n = HZ_OF[o.t];
      if (n) { const y = o.t === 'D' ? droneTop(o, L) : GROUND - HZ[n][3]; if (ok(IMG.haz)) ctx.drawImage(tintPart(IMG.haz, HZ[n], col), sx, y); else R(col, sx, y, HZ[n][2], HZ[n][3]); }
      else if (o.t === 'E' && ok(IMG.haz)) {
        if (gateOn(o)) ctx.drawImage(tintPart(IMG.haz, HZ.gate, col), sx, GROUND - 48);
        else for (const dx of [0, 58]) ctx.drawImage(tintPart(IMG.haz, [HZ.gate[0] + dx, 0, 15, 48], col), sx + dx, GROUND - 48);
      }
      else if (o.t === 'P') { const w = wOf(o); R(col, sx, GROUND, 2, 12); R(col, sx + w - 2, GROUND, 2, 12); R(C.yellow, sx - 12, GROUND + 3, 12, 2); }
      else if (o.t === 'S') R(C.yellow, sx - 4, GROUND - 4, 27, 3);
      else if (o.t === 'L') {
        const w = wOf(o), k = w >= 60 ? 'low64' : w >= 44 ? 'low50' : 'low36', m = SG[k], x = Math.round(sx + (w - m[2]) / 2), y = GROUND - SIGN_GAP + 1 - m[3];
        for (const rx of LOW_ROD[k]) R(col, x + rx + 1, -VIEW_TOP, 2, y + VIEW_TOP);
        if (ok(IMG.signs)) ctx.drawImage(tintPart(IMG.signs, m, col), x, y); else R(col, x, y, m[2], m[3]);
      }
    });
    ctx.globalAlpha = 1;
  }
  // 박자 가이드(WOW~): 발밑 괄호가 다음 박자를 향해 좁혀 들고, 박자 순간(±5프레임)엔 하얗게 — 지금 뛰면 BEAT JUMP
  function drawBeatGuide() {
    if (wearMax() < 2 || S.rw || S.falling || mode !== 'play') return;
    const f = fpb(), rem = 1 - (S.beatT % f) / f, off = Math.round(8 + rem * 14), on = onBeat(), y = GROUND + 2, c = on ? C.white : C.glow;
    ctx.globalAlpha = on ? .9 : .4;
    for (const sd of [-1, 1]) { const x = HX + sd * off; R(c, x, y, 1, 5); R(c, sd < 0 ? x : x - 2, y, 3, 1); R(c, sd < 0 ? x : x - 2, y + 4, 3, 1); }
    if (S.beatFx) { const r = 6 + (14 - S.beatFx) * 2; ctx.globalAlpha = S.beatFx / 14; R(C.white, HX - r, GROUND, r * 2, 1); R(C.glow, HX - r - 4, GROUND + 3, r * 2 + 8, 1); }
    ctx.globalAlpha = 1;
  }
  // 엉킨 테이프(5바퀴~): 원본 바로 뒤에 한 번 더 찍힌 복제 — 진짜로 부딪힌다. 갈색 자기 테이프가 감겨 있고 색이 번져 원본과 구분된다
  function tangleFx(o, sx) {
    const m = HZ[{ B:'bar', T:'crate', W:'block' }[o.t]], y = GROUND - m[3];
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .4; pix(IMG.haz, m, sx - 2, y); ctx.globalAlpha = .25; pix(IMG.haz, m, sx + 2, y);
    ctx.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 3; k++) for (let x = -3; x < m[2] + 3; x++) {
      const ty = Math.round(y + m[3] * (.25 + k * .25) + Math.sin((x + S.anim * (k + 1) * .3 + k * 7) / 3) * 3);
      ctx.globalAlpha = .9; R('#3a2418', sx + x, ty, 1, 2); ctx.globalAlpha = .6; R('#8a5a3a', sx + x, ty, 1, 1);
    }
    if ((S.anim >> 2) % 6 === 0) { ctx.globalAlpha = .7; pix(IMG.haz, [m[0], m[1] + (m[3] >> 1), m[2], 3], sx + 3, y + (m[3] >> 1)); }
    ctx.globalAlpha = 1;
  }
  function ringAt(cx, cy, size, rot, alpha = 1) {
    if (!ok(IMG.ring)) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.drawImage(IMG.ring, -size / 2, -size / 2, size, size); ctx.restore();
  }
  /* ================= Loop Gateway: TAPE RIFT ================= */
  // 천장 마운트 · 바닥 받침 → 균열 → 양옆 자기 테이프 → 위아래 릴 순으로 그린다 (주인공보다 뒤)
  // 바퀴가 쌓일수록(gl) 색이 번지고(1) · 균열 속 장면이 번쩍이고(2) · 테이프가 끊기고 릴이 흔들리고(3) · 게이트 자체가 찢어진다(4)
  function drawRift(gx, gl, near) {
    const top = GATE_TOP + 6, bot = GATE_BOT - 6, film = S.warp ? S.warp.film : snaps, tick = S.anim >> 2;
    ctx.save(); ctx.beginPath();
    for (let y = top; y <= bot; y += 4) ctx.lineTo(gx - RIFT_W + Math.floor(hash(y * .37 + tick * .11) * 4), y);
    for (let y = bot; y >= top; y -= 4) ctx.lineTo(gx + RIFT_W - Math.floor(hash(y * .53 + tick * .17) * 4), y);
    ctx.closePath(); ctx.clip();
    R('#03141f', gx - RIFT_W, top, RIFT_W * 2, bot - top);
    // 균열 속: 녹화된 이번 바퀴 장면이 새 장면 → 옛 장면 순으로 거꾸로 넘어간다 (주인공이 있던 자리를 가운데로)
    if (film.length) {
      const n = film.length, f = film[n - 1 - (Math.floor(S.anim / (S.warp ? 1 : 3)) % n)], fw = (bot - top) * W / H;
      ctx.globalAlpha = .8; ctx.drawImage(f, gx - fw * HX / W, top, fw, bot - top);
    }
    ctx.globalAlpha = .22 + .2 * near; R(C.glow, gx - RIFT_W, top, RIFT_W * 2, bot - top);
    ctx.globalAlpha = .3; for (let y = top + (S.anim % 3); y < bot; y += 3) R(C.ink, gx - RIFT_W, y, RIFT_W * 2, 1);
    ctx.globalAlpha = .7; for (let i = 0; i < 6 + gl * 4; i++) R(C.white, gx - RIFT_W + Math.random() * RIFT_W * 2, top + Math.random() * (bot - top), 2, 1);
    // 트래킹 띠가 아래에서 위로 감겨 올라간다(되감기)
    ctx.globalAlpha = .55; R(C.white, gx - RIFT_W, bot - mod(S.anim * 3, bot - top), RIFT_W * 2, 2);
    if (gl >= 2 && hash(S.anim * .41 + gx) < .08) { ctx.globalAlpha = .6; R(C.white, gx - RIFT_W, top, RIFT_W * 2, bot - top); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // 세로로 감긴 자기 테이프: 가까워질수록 떨리고, 3단계부터는 군데군데 끊겨 끝이 늘어진다
  function tapeStrand(x, gl, side, near) {
    const gap = GATE_TOP + 50 + side * 40, gapH = gl >= 3 ? 8 + gl * 3 : 0;
    for (let y = GATE_TOP; y < GATE_BOT; y += 2) {
      if (Math.abs(y - gap) < gapH) continue;
      const wob = Math.round(Math.sin(y / 9 + S.anim / 5 + side) * (.5 + near * 1.5 + (gl >= 3 ? 1 : 0)));
      R('#1a0f0a', x + wob, y, 2, 2); R('#6b4a30', x + wob + (side < 0 ? 0 : 1), y, 1, 2);
    }
  }
  function reel(cx, cy, gl) {
    if (!ok(IMG.gate)) { ringAt(cx, cy, REEL_R * 2, S.reel); return; }
    const m = GT.reel, wob = gl >= 3 ? Math.round(Math.sin(S.anim * .7 + cy) * (gl - 2)) : 0;
    ctx.save(); ctx.translate(cx + wob, cy); ctx.rotate(S.reel + (gl >= 4 ? Math.sin(S.anim * .9) * .4 : 0));
    ctx.drawImage(IMG.gate, m[0], m[1], m[2], m[3], -m[2] / 2, -m[3] / 2, m[2], m[3]);
    if (gl >= 1) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18 + .06 * gl;
      ctx.drawImage(tintPart(IMG.gate, m, C.pink), -m[2] / 2 - 1 - (gl >> 1), -m[3] / 2); ctx.drawImage(tintPart(IMG.gate, m, C.glow), -m[2] / 2 + 1 + (gl >> 1), -m[3] / 2);
    }
    ctx.restore();
  }
  function drawGateway() {
    const ps = [TRACK, 0];
    for (let p = -GATE_GAP; p > S.d - HX - 60; p -= GATE_GAP) ps.push(p); // 출발선 앞 구간(타이틀 · 출발 전)의 반복 게이트
    for (const p of ps) {
      const gx = Math.round(p - S.d + HX);
      if (gx < -60 || gx > W + 60) continue;
      const gl = p === TRACK ? Math.min(4, S.lap - 1) : Math.max(0, Math.min(4, S.lap - 2)), near = p === TRACK ? Math.max(0, 1 - gateDist() / GATE_AP[0]) : 0;
      // 다가갈수록 균열 둘레가 청록으로 번진다
      ctx.globalAlpha = .06 + .14 * near; R(C.teal, gx - 30, -VIEW_TOP, 60, GROUND + VIEW_TOP); ctx.globalAlpha = 1;
      if (ok(IMG.gate)) {
        pix(IMG.gate, GT.mount, gx - 28, GATE_TOP - 80);
        pix(IMG.gate, GT.base, gx - 36, GATE_BOT - 25);
      }
      drawRift(gx, gl, near);
      tapeStrand(gx - REEL_R, gl, -1, near); tapeStrand(gx + REEL_R - 2, gl, 1, near);
      reel(gx, GATE_TOP, gl); reel(gx, GATE_BOT, gl);
      // 4단계: 게이트 자체가 가로로 찢어지고 가끔 색이 뒤집힌다
      if (gl >= 4 && ok(IMG.gate)) {
        for (let i = 0; i < 3; i++) {
          const y = Math.floor(hash(S.anim * .13 + i * 7) * (GATE_BOT - GATE_TOP)) + GATE_TOP - 20, dx = Math.round((hash(S.anim * .29 + i) - .5) * 10);
          pix(IMG.gate, [GT.mount[0], 70, GT.mount[2], 4], gx - 28 + dx, y);
        }
        if (hash(S.anim * .07 + gx) < .06) { ctx.globalCompositeOperation = 'difference'; R(C.white, gx - 40, -VIEW_TOP, 80, GROUND + VIEW_TOP); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
  }
  /* ---------- 깨진 CRT 자막 ---------- */
  const LANE_TOP = 96; // 화면 기준: 이보다 아래는 장애물(간판 판 · 드론 · 지면)이 지나가는 높이
  // 세계가 고장 나며 새어 나오는 시스템 메시지: 같은 자리에 몇 프레임 머물다 사라지고, 가로 띠로만 보이며 색이 갈라진다 (UI가 아니라 화면의 고장)
  // yMax: 자막이 내려올 수 있는 가장 아래(게임 중엔 장애물이 지나는 높이를 덮지 않게 위쪽에만)
  function glitchText(n, seed, big, words = GLITCH, yMax = H - 38) {
    for (let i = 0; i < n; i++) {
      const r = k => hash(seed * 7.13 + i * 31.7 + k * 3.1);
      let w = words[Math.floor(r(1) * words.length)];
      if (w === 'LOOP_') w += String(S.lap).padStart(2, '0');
      const size = big && r(2) < .35 ? 16 : 8, x = Math.round(12 + r(3) * (W - 130)), y = Math.round(18 + r(4) * (yMax - 18));
      ctx.font = `700 ${size}px ${F_PIX}`; const tw = Math.ceil(ctx.measureText(w).width);
      const band = Math.max(3, Math.floor((.35 + r(5) * .65) * (size + 2))), by = y - 1 + Math.floor(r(6) * (size + 3 - band));
      ctx.save(); ctx.beginPath(); ctx.rect(x - 4, by, tw + 8, band); ctx.clip();
      ctx.globalAlpha = .6; R(C.ink, x - 3, y - 2, tw + 6, size + 4);
      ctx.globalAlpha = .95; txt(w, x - 1 - (size >> 3), y, C.pink, size, 'left', null); txt(w, x + 1 + (size >> 3), y, C.glow, size, 'left', null); txt(w, x, y, C.white, size, 'left', null);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // 화면 기준 캔버스 띠 밀기 (y·h 논리 좌표, dx 논리 px)
  function shiftBand(y, h, dx, x = 0, w = W) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = Math.round(x * SX), sy = Math.round(y * SY), sw = Math.round(w * SX), sh = Math.max(1, Math.round(h * SY));
    ctx.drawImage(cv, sx, sy, sw, sh, sx + Math.round(dx * SX), sy, sw, sh); ctx.restore();
  }
  // 게이트 접근(화면 기준): 1단계 게이트 쪽이 살짝 출렁 · 3단계 RGB 분리가 커지고, 화면 일부가 1~2프레임씩 과거 장면으로 깜빡이며 자막이 새기 시작
  // 과거 장면 조각과 자막은 화면 위쪽(LANE_TOP 위, 천장 쪽)에만 — 지면 · 간판 높이의 장애물을 가리지 않는다
  function drawGateFx(cam) {
    const z = gateZone(); if (!z || mode !== 'play') return;
    const gx = Math.round(TRACK - S.d + HX), gl = Math.min(4, S.lap - 1), near = Math.max(0, 1 - gateDist() / GATE_AP[0]);
    for (let i = 0; i < 2 + z; i++) { const y = Math.floor(hash(S.anim * .21 + i * 5) * (H - 10)); shiftBand(y, 3 + z, Math.round(Math.sin(S.anim * .5 + i) * (1 + near * 2)), Math.max(0, gx - 60), 120); }
    if (z < 3) return;
    const amp = 1 + gl * .7;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .14 + .05 * gl;
    ctx.drawImage(cv, Math.round(amp * SX), 0); ctx.restore();
    if (snaps.length && S.anim % 5 < 2) {
      const sd = Math.floor(S.anim / 5), f = snaps[Math.floor(hash(sd) * snaps.length)];
      const w = 80 + Math.floor(hash(sd + .3) * 140), h = 30 + Math.floor(hash(sd + .6) * 30), x = Math.floor(hash(sd + .9) * (W - w)), y = Math.floor(hash(sd + 1.2) * (LANE_TOP - h));
      ctx.globalAlpha = .55; ctx.drawImage(f, x / 2, y / 2, w / 2, h / 2, x, y, w, h); ctx.globalAlpha = 1;
    }
    glitchText(1 + (gl >> 1), Math.floor(S.anim / 3), false, GLITCH, LANE_TOP - 14);
  }
  /* ---------- 통과: 시간 되감기 ---------- */
  // 카메라: 순간 줌 아웃(0.88) → 되감는 동안 천천히 → 끝에 빠르게 줌 인(1.08 → 1)
  function warpZoom() {
    if (!S.warp) return 1;
    const p = S.warp.t / S.warp.len;
    return p < .2 ? 1 - .12 * p / .2 : p < .82 ? .88 + .04 * (p - .2) / .62 : 1.08 - .08 * (p - .82) / .18;
  }
  function drawWarp(hero, cam) {
    const w = S.warp, p = w.t / w.len, g = w.g, film = w.film, n = film.length, z = warpZoom();
    const shake = g >= 3 ? 2 + g : 1;
    ctx.save();
    ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake));
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    // 화면이 가로로 늘어나며 녹화된 장면들이 거꾸로 빠르게 넘어간다. 3→4바퀴부터는 지나간 장면과 지금 화면이 겹쳐 보인다
    if (p < .82 && n) {
      const q = Math.min(1, p / .82), k = Math.min(n - 1, Math.floor(q * n)), st = 1 + .16 * Math.sin(q * Math.PI);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(st, 1 / (1 + (st - 1) * .5)); ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = Math.min(1, p * 14) * (g >= 2 ? .7 : 1); ctx.drawImage(film[k], 0, 0, W, H);
      if (k + 1 < n) { ctx.globalAlpha = .35; ctx.drawImage(film[k + 1], -8, 0, W, H); }
      ctx.restore();
    }
    ctx.globalAlpha = .16; R('#0b2a33', -20, -20, W + 40, H + 40);
    // 파티클이 거꾸로 흐른다(오른쪽으로)
    for (let i = 0; i < 30; i++) { const len = 6 + (i % 4) * 5; ctx.globalAlpha = .35 + (i % 3) * .15; R(i % 3 ? C.glow : C.white, mod(i * 53 + w.t * (8 + (i % 5) * 3), W + 40) - 20, (i * 37) % H, len, 1); }
    // 주인공: 잔상이 앞쪽에서 몸으로 거꾸로 겹쳐 들어온다
    ctx.save(); ctx.translate(0, VIEW_TOP - cam);
    if (TINT) for (let i = 4; i >= 1; i--) { ctx.globalAlpha = .45 - i * .08; heroFrame(TINT[i % 2 ? C.teal : C.white], hero.f, HX + i * 10 * (1 - p), hero.y); }
    ctx.globalAlpha = 1; if (hero.xf) xfBody(hero.f, hero.y, hero.xf); else heroFrame(IMG.hero, hero.f, HX, hero.y);
    ctx.restore();
    ctx.restore(); ctx.globalAlpha = 1;
    // VHS: 스캔라인 폭주 · 트래킹 에러 띠 · 위아래 가장자리가 테이프처럼 말림 · RGB 분리
    for (let i = 0; i < 10 + g * 6; i++) { ctx.globalAlpha = .2 + Math.random() * .2; R(C.white, 0, Math.random() * H, W, 1); }
    ctx.globalAlpha = 1;
    const ty = mod(w.t * 11, H + 30) - 15;
    shiftBand(ty, 14 + g * 4, (Math.random() * 2 - 1) * (6 + g * 3));
    for (let r = 0; r < 5; r++) { const c = (5 - r) * (5 - r) * .5 * Math.sin(w.t * .6 + r); shiftBand(H - 6 * (r + 1), 6, c); shiftBand(6 * r, 6, -c); }
    ctx.globalAlpha = .5; R(C.ink, 0, H - 4, W, 4); R(C.ink, 0, 0, W, 3); ctx.globalAlpha = 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3 + .05 * g;
    ctx.drawImage(cv, Math.round((2 + g * 1.5) * SX), 0); ctx.restore();
    // 5바퀴 이후: 시간 시스템 붕괴 — 색 반전 · 화면 찢김
    if (g >= 4) {
      if (w.t % 7 === 0) { ctx.globalCompositeOperation = 'difference'; R(C.white, 0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
      for (let i = 0; i < 3; i++) shiftBand(Math.random() * H, 8 + Math.random() * 24, (Math.random() * 2 - 1) * 24);
    }
    glitchText(2 + g * 2, Math.floor(w.t / 2), true);
    // 첫 프레임 플래시 → 끝에선 화면이 꺼지며 00:00:00:00
    if (w.t < 2) { ctx.globalAlpha = .8; R(C.white, 0, 0, W, H); }
    if (p >= .82) {
      ctx.globalAlpha = .85 * (1 - (p - .82) / .18); R('#02060a', 0, 0, W, H);
      ctx.globalAlpha = 1; if ((w.t >> 1) % 2 === 0) num('00:00:00:00', W / 2, H / 2 - 8, C.white, 16, 'center');
    }
    ctx.globalAlpha = 1;
  }
  // 3→4바퀴부터: 통과 뒤에도 지나간 장면이 지금 화면 위에 반투명으로 잠깐 남는다
  function drawPastFx() {
    const f = S.pastFilm; if (!S.pastFx || !f || !f.length) return;
    ctx.globalAlpha = .28 * S.pastFx / 40; ctx.drawImage(f[Math.floor(hash(S.pastFx >> 2) * f.length)], 0, 0, W, H); ctx.globalAlpha = 1;
  }
  /* ---------- 루프 번호 OSD ---------- */
  // 되감기가 끝나고 화면이 안정되는 순간 VHS 화면 표시처럼: 가운데 크게(▶ PLAY · LOOP // 03 · 타임코드 · REC ●) → 오른쪽 아래로 작아져 잠시 남는다
  // 타임코드는 새 루프 시작부터 실제로 흐르고, 시간이 많이 고장 난 뒤(g 4)엔 숫자가 깨진다
  const tc = t => '00:00:' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(Math.floor(t / 2) % 30).padStart(2, '0');
  const playTri = (x, y, c) => { for (let i = 0; i < 7; i++) R(c, x, y + i, Math.min(i, 6 - i) + 1, 1); };
  function drawOSD() {
    const o = S.osd; if (!o || mode !== 'play') return;
    const lap = String(o.lap).padStart(2, '0'), bad = o.g >= 4 && hash(o.t * .7) < .3;
    const L = 'LOOP // ' + (bad ? lap[0] + String.fromCharCode(48 + Math.floor(hash(o.t) * 10)) : lap), T = bad ? tc(Math.floor(hash(o.t * 1.3) * 99999)) : tc(o.t);
    const rec = (o.t >> 4) % 2 === 0;
    if (o.t < OSD_BIG) {
      const open = Math.min(1, o.t / 6), close = o.t > OSD_BIG - 8 ? (OSD_BIG - o.t) / 8 : 1, jit = o.t < 8 || (o.g >= 3 && hash(o.t * .3) < .12) ? Math.round((hash(o.t) - .5) * 8) : 0;
      const x0 = Math.round(W / 2 - 80) + jit, y0 = Math.round(H / 2 - 40), cy = y0 + 24;
      ctx.save(); ctx.translate(0, cy); ctx.scale(1, Math.max(.05, open * close)); ctx.translate(0, -cy);
      if (o.t < 16 || (o.t >> 3) % 2 === 0) { playTri(x0, y0 + 1, C.white); txt('PLAY', x0 + 11, y0, C.white, 8, 'left'); }
      num(L, x0 - 1, y0 + 14, C.pink, 16); num(L, x0 + 1, y0 + 14, C.glow, 16); num(L, x0, y0 + 14, C.white, 16);
      num(T, x0, y0 + 38, C.white, 8);
      if (rec) { R(C.red, x0 + 126, y0 + 38, 6, 6); txt('REC', x0 + 136, y0 + 37, C.white, 8, 'left'); }
      ctx.restore();
    } else {
      ctx.globalAlpha = Math.min(1, (OSD_T - o.t) / 20);
      num(L.replace(/ /g, ''), W - 8, H - 30, C.white, 8, 'right'); num(T, W - 8, H - 18, C.mist, 8, 'right');
      if (rec) R(C.red, W - 88, H - 30, 5, 5);
      ctx.globalAlpha = 1;
    }
  }
  // 벽의 IDIOTAPE 무대 그림: 설명 없이 그냥 벽에 걸려 있다가, 공연이 시작되면 테두리가 박자마다 조명 색으로 번쩍인다
  function drawSecret() {
    if (!liveLap(S.lap)) return;
    const sx = Math.round(SECRET_AT - S.d + HX);
    if (sx < -160 || sx > W) return;
    const k = liveK(), f = fpb(), kick = 1 - (S.beatT % f) / f;
    R(k ? LIVE_COL[Math.floor(S.beatT / f / 4) % 4] : C.out, sx - 3, 59, 156, 92); R('#000', sx - 1, 61, 152, 88);
    if (!ok(IMG.egg)) return;
    ctx.drawImage(IMG.egg, sx, 64);
    if (k) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * k * kick; ctx.drawImage(IMG.egg, sx, 64); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }
  /* ================= IDIOTAPE LIVE ================= */
  // 스펙트럼(i = 0 낮은 대역 … 15 높은 대역): 곡이 Web Audio로 흐르면 실제 주파수, 아니면 킥에 크게·높은 대역은 잘게 출렁이는 가짜 값
  const eq = (i, kick) => bgm.playing && bgm.buf ? Math.min(1, bgm.fq[Math.min(31, 1 + Math.floor(i * i / 8))] / 230) : Math.min(1, (i < 6 ? .35 + .65 * kick : .25 + .35 * kick) * (.6 + .4 * Math.abs(Math.sin(i * 1.3 + S.anim * (.08 + (i % 5) * .03)))));
  // 홀로그램 연주자: 박자 순간엔 타격 포즈(짝수·홀수 박마다 A/B 번갈아), 박 사이엔 기본 포즈 — 킥에 맞춰 내려치고, 킥마다 조명 색 잔상이 겹친다. 발밑엔 빛 무대
  function holo(n, x, k, kick, col) {
    const b = BAND[n]; if (!ok(IMG.band)) return;
    const fr = kick > .55 ? 1 + Math.floor(S.beatT / fpb()) % 2 : 0, m = [fr * b.w, b.y, b.w, b.h], y = GROUND - 2 - b.h;
    ctx.globalAlpha = .3 * k; R(col, x + 6, GROUND - 3, b.w - 12, 2);
    ctx.globalAlpha = .62 * k; pix(IMG.band, m, x, y);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .4 * k * kick; ctx.drawImage(tintPart(IMG.band, m, col), x + 2, y);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  // 공연 배경(월드 뒤쪽 — 장애물·주인공은 늘 그 위에 또렷하다): 마디마다 바뀌는 조명 색과 박자 펄스, 천장에서 흔들리는 무대 빔, 벽면 EQ
  function drawLiveBack() {
    const k = liveK(); if (!k) return;
    if (bgm.an && bgm.playing) bgm.an.getByteFrequencyData(bgm.fq);
    const f = fpb(), kick = 1 - (S.beatT % f) / f, bar = Math.floor(S.beatT / f / 4), col = LIVE_COL[bar % 4], top = -VIEW_TOP;
    ctx.globalAlpha = k * (.1 + .14 * kick * kick); R(col, 0, top, W, GROUND - top);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x0 = W * (.14 + i * .24), x1 = x0 + Math.sin(S.anim / 28 + i * 1.7) * 90, len = 230;
      ctx.globalAlpha = k * (.06 + .08 * kick); ctx.fillStyle = LIVE_COL[(bar + i) % 4];
      ctx.beginPath(); ctx.moveTo(x0 - 2, top); ctx.lineTo(x0 + 2, top); ctx.lineTo(x1 + 22, top + len); ctx.lineTo(x1 - 22, top + len); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let x = 2, i = 0; x < W; x += 8, i++) { const h = Math.round(eq(i % 16, kick) * 26 * k); ctx.globalAlpha = .22 * k; R(LIVE_COL[(i >> 3) % 4], x, 176 - h, 6, h); }
    ctx.globalAlpha = 1;
  }
  // 홀로그램은 벽(무대 그림) 앞 공중에 뜬다 — 벽 다음, 장애물 전에 그린다
  function drawLiveHolo() {
    const k = liveK(); if (!k) return;
    const f = fpb(), kick = 1 - (S.beatT % f) / f, bar = Math.floor(S.beatT / f / 4);
    holo('synth', 0, k, kick, LIVE_COL[(bar + 1) % 4]);
    holo('drum', W - BAND.drum.w, k, kick, LIVE_COL[(bar + 2) % 4]);
  }
  // 공연 앞쪽(화면 가장자리만): 양 끝 LED EQ 기둥, HUD 사이 위쪽 스펙트럼, 테두리를 도는 체이스 라이트.
  // 마디 첫 박엔 3프레임 RGB 분리, 드롭 순간엔 강한 글리치 — 가운데 플레이 영역은 짧은 순간 말고는 덮지 않는다
  function drawLiveFront() {
    const k = liveK(); if (!k || mode !== 'play') return;
    const f = fpb(), ph = S.beatT % f, kick = 1 - ph / f, beatN = Math.floor(S.beatT / f), t = S.liveLen - S.live;
    for (const side of [0, 1]) {
      const lv = eq(side ? 3 : 1, kick) * k, x = side ? W - 7 : 1;
      for (let c = 0; c < 16 && c / 16 < lv; c++) { ctx.globalAlpha = .85; R(c > 12 ? C.pink : c > 8 ? C.yellow : C.glow, x, H - 8 - c * 16, 6, 12); }
    }
    for (let x = 112, i = 0; x < W - 112; x += 5, i++) { ctx.globalAlpha = .8; R(LIVE_COL[(i >> 2) % 4], x, 0, 4, Math.round(eq(i % 16, kick) * 7 * k)); }
    const P = 2 * (W + H);
    for (let j = 0; j < 28; j++) {
      const p = (j / 28 * P + S.anim * 3) % P, c = LIVE_COL[(j + beatN) % 4];
      const [x, y] = p < W ? [p, 0] : p < W + H ? [W - 3, p - W] : p < 2 * W + H ? [2 * W + H - p, H - 3] : [0, P - p];
      ctx.globalAlpha = k; R(c, x, y, 3, 3);
    }
    ctx.globalAlpha = 1;
    const drop = t >= S.liveIn - 2 && t < S.liveIn + 8, bar1 = beatN % 4 === 0 && ph < 3;
    if (drop || bar1) {
      const amp = drop ? 6 : 2;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < (drop ? 5 : 2); i++) {
        const y0 = Math.round(Math.random() * H * SY), h0 = Math.round((4 + Math.random() * 10) * SY);
        ctx.drawImage(cv, 0, y0, cv.width, h0, Math.round((Math.random() * 2 - 1) * amp * SX), y0, cv.width, h0);
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (drop ? .45 : .28) * k; ctx.drawImage(cv, Math.round(amp * .6 * SX), 0);
      ctx.restore();
    }
  }
  // 장애물 테두리 빛: 화면 고장 연출(바퀴 표의 vfx · IDIOTAPE · DROPOUT 예고)이 셀수록 옅은 빛 테두리를 둘러 어두운 배경 · 연출 속에서도 모양이 읽히게(1바퀴엔 없다)
  const rimK = () => mode !== 'play' ? 0 : Math.min(1, lapCfg(S.lap).vfx + liveK() * .6 + (dropWarn() ? .3 : 0));
  function hzRim(n, x, y) {
    const a = rimK();
    if (a > 0 && ok(IMG.haz)) {
      const c = tintPart(IMG.haz, HZ[n], C.paper); ctx.globalAlpha = .4 * a;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(c, Math.round(x) + ox, Math.round(y) + oy);
      ctx.globalAlpha = 1;
    }
    hz(n, x, y);
  }
  function drawObs(o, sx, key, L, anim) {
    const t = o.t, base = GROUND;
    if (t === 'B') hzRim('bar', sx, base - 22);
    else if (t === 'W') hzRim('block', sx, base - 14);
    else if (t === 'T') hzRim('crate', sx, base - 38);
    else if (t === 'D') {
      const top = droneTop(o, L);
      hzRim('drone', sx, top);
      if ((anim >> 2) % 2) { ctx.globalAlpha = .5; R(C.glow, sx + 5, top + 16, 2, 3); R(C.glow, sx + 12, top + 16, 2, 3); ctx.globalAlpha = 1; }
    } else if (t === 'E') {
      if (gateOn(o)) {
        hz('gate', sx, base - 48);
        if ((anim >> 1) % 2) { ctx.globalAlpha = .3; R(C.glow, sx + 15, base - 46, 43, 44); ctx.globalAlpha = 1; }
      } else {
        pix(IMG.haz, [HZ.gate[0], 0, 15, 48], sx, base - 48); pix(IMG.haz, [HZ.gate[0] + 58, 0, 15, 48], sx + 58, base - 48);
        if (gateSoon(o) && (anim >> 1) % 2) for (let i = 0; i < 5; i++) R(C.white, sx + 18 + Math.random() * 36, base - 44 + Math.random() * 40, 2, 1);
      }
    } else if (t === 'S') jumpPad(sx, base, padCharge(sx), S.springT[key] || 0);
    else if (t === 'P') {
      // 무너진 상판 구멍: 검은 빈칸이 아니라 아래 도시가 보인다 (떨어지면 실제로 가는 곳)
      const w = wOf(o), bot = DECK + SLAB;
      ctx.save(); ctx.beginPath(); ctx.rect(sx, base, w, bot - base); ctx.clip();
      drawCity(base, bot);
      // 위는 상판 그늘로 어둡고, 아래로 갈수록 먼 거리의 불빛이 올라온다: 한눈에 '깊다'
      const g = ctx.createLinearGradient(0, base, 0, bot); g.addColorStop(0, 'rgba(2,6,10,.95)'); g.addColorStop(.35, 'rgba(2,6,10,0)'); g.addColorStop(1, 'rgba(25,211,197,.3)');
      ctx.fillStyle = g; ctx.fillRect(sx, base, w, bot - base);
      // 가장자리에서 부스러기가 계속 떨어진다: 지금도 무너지는 자리라는 경고, 빠른 속도에서도 눈에 걸리는 움직임
      for (let k = 0; k < 3; k++) { const ph = (anim + k * 16 + o.p) % 48; ctx.globalAlpha = 1 - ph / 48; R('#1a5e77', sx + 3 + (k * 11 + o.p) % (w - 6), base + ph, 1, 2); }
      ctx.globalAlpha = 1;
      ctx.restore();
      // 잘린 단면(어두움) + 아래 도시 불빛이 비추는 안쪽 모서리 + 삐져나온 철근
      R('#02090f', sx, base, 2, bot - base); R('#02090f', sx + w - 2, base, 2, bot - base);
      ctx.globalAlpha = .75; R(C.glow, sx + 2, base + 8, 1, bot - base - 8); R(C.glow, sx + w - 3, base + 8, 1, bot - base - 8); ctx.globalAlpha = 1;
      R(C.gray, sx + 1, base + 4, 4, 1); R(C.gray, sx + w - 4, base + 9, 3, 1); R(C.gray, sx + 1, DECK + 3, 3, 1); R(C.gray, sx + w - 3, DECK + 5, 2, 1);
      R('#1a5e77', sx, base, 3, 1); R('#1a5e77', sx + w - 3, base, 3, 1);
      for (let i = 0; i < 3; i++) R(i % 2 ? C.ink : C.yellow, sx - 12 + i * 4, base + 3, 4, 2);
    } else if (t === 'L') signboard(sx, base - SIGN_GAP, wOf(o), -VIEW_TOP, o.p, sx < HX + 150);
  }
  /* ================= 살아 있는 네온 간판 ================= */
  // 꺼진 그림 위에 켜진 그림을 겹친다. 박자마다 네온이 살짝 부풀고(음악에 맞춰 숨 쉬는 도시), 아주 가끔 접촉 불량처럼 꺼지고,
  // 더 드물게 VHS 트래킹처럼 한 줄이 밀리며 색이 번지고, 약 2.5초마다 CRT 주사선이 훑고 내려간다. 간판마다 seed가 달라 함께 깜빡이지 않는다
  // calm: 플레이어가 지금 읽어야 하는 간판은 깜빡이거나 찢어지지 않는다 · keep: 아래쪽에서 효과가 건드리지 않을 줄 수
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  function neonSign(k, x, y, seed, t, lit = 1, calm = false, keep = 0) {
    const m = SG[k], w = m[2], h = m[3] - keep;
    pix(IMG.signs, SG[k + 'o'], x, y);
    if (!calm && hash((t >> 2) * 1.31 + seed) < .03) lit *= .15;
    ctx.globalAlpha = lit; pix(IMG.signs, m, x, y);
    if (BEAT && lit > .5) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25; pix(IMG.signs, m, x, y); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
    if (calm || !ok(IMG.signs)) return;
    const g = t >> 3;
    if (hash(g * .73 + seed * 1.7) < .015) {
      const r = 2 + Math.floor(hash(g + .5) * (h - 6)), bh = 2 + Math.floor(hash(g + .9) * 2), dx = hash(g + .3) < .5 ? -2 : 2;
      ctx.drawImage(IMG.signs, m[0], m[1] + r, w, bh, x + dx, y + r, w, bh);
      ctx.globalAlpha = .55; ctx.drawImage(sgTint(k + 'n', C.pink), 0, 0, w, h, x - 1, y, w, h); ctx.globalAlpha = 1;
    }
    const sl = (t + seed * 7) % 150;
    if (sl >= 3 && sl < h - 3) { ctx.globalAlpha = .16; R(C.white, x + 3, y + sl, w - 6, 1); ctx.globalAlpha = 1; }
  }
  // 낮은 간판: 천장에서 내려온 막대 두 개가 고정쇠를 잡고, 판 아래 노란 줄무늬의 가장자리가 부딪히는 선
  // 멀리 있을 땐 살아 있는 간판이지만, 다가와 높이를 재야 할 때는 또렷하게 멈추고, 줄무늬(판정 선)는 어떤 효과도 건드리지 않는다
  const LOW_ROD = { low64:[7, 52], low50:[6, 40], low36:[4, 29] };
  function signboard(x, bottom, w, top = 0, seed = 0, calm = false, t = S ? S.anim : 0) {
    const k = w >= 60 ? 'low64' : w >= 44 ? 'low50' : 'low36', m = SG[k];
    x = Math.round(x + (w - m[2]) / 2); const y = bottom + 1 - m[3];
    for (const rx of LOW_ROD[k]) { R(C.ink, x + rx, top, 4, y - top + 1); R('#3d5868', x + rx + 1, top, 2, y - top + 1); }
    neonSign(k, x, y, seed, t, 1, calm, 5);
  }
  /* ================= 점프대 ================= */
  // 장애물(회청색 금속 · 청록/빨강)과 다른 노란색: 밟은 뒤 나오는 BOING·불꽃과 같은 색이라 밟기 전부터 결과를 약속한다
  const PAD_UP = Math.round(SPRING * SPRING / (2 * GRAV)); // 점프대가 올려주는 높이
  function chevron(cx, y, c) { for (let r = 0; r < 5; r++) { R(c, cx - r - 1, y + r, 2, 2); R(c, cx + 1 + r, y + r, 2, 2); } }
  // 판: 바닥에 낮게 붙어 있다(넘을 물건이 아니라 밟을 바닥). 가까워지면 달아오르고, 밟으면 판이 튀어 오르며 스프링이 보인다
  // 그림의 0~3행은 위판(밟으면 튀어 오름), 4~7행은 바닥에 박힌 받침
  const PAD_TOP = [0, 0, 31, 4], PAD_BASE = [0, 4, 31, 4];
  function jumpPad(x, base, charge, t) {
    const lift = t ? Math.round(Math.sin(t / 10 * Math.PI) * 6) : 0, ready = charge > .8 && (S.anim >> 2) % 2;
    const px = x - 6, py = base - SG.pad[3], lit = .5 + .5 * charge;
    ctx.globalAlpha = .15 + .3 * charge; R(C.yellow, px + 2, base, 27, 2);
    ctx.globalAlpha = .06 + .14 * charge; R(C.yellow, px - 1, base + 2, 33, 3); ctx.globalAlpha = 1;
    sgPart('pado', PAD_BASE, px, py); ctx.globalAlpha = lit; sgPart('pad', PAD_BASE, px, py); ctx.globalAlpha = 1;
    for (let k = 0; k < lift; k++) R(k % 2 ? C.gray : C.yellow, x + 4 + (k % 2) * 6, py + 3 - k, 5, 1);
    sgPart('pado', PAD_TOP, px, py - lift); ctx.globalAlpha = lit; sgPart('pad', PAD_TOP, px, py - lift);
    if ((t || ready) && ok(IMG.signs)) { ctx.globalAlpha = .8; ctx.drawImage(sgTint('padn', C.white), 0, 0, 31, 4, px, py - lift, 31, 4); }
    ctx.globalAlpha = 1;
  }
  // 위로 오르는 화살표 기류: 방향(위)과 높이(실제로 떠오르는 높이까지만)를 보여준다
  function padBeam(x, base, key, charge) {
    const t = S.springT[key] || 0, top = base - PAD_UP, h = base - 8 - top, a0 = .1 + .14 * charge + (t ? .25 : 0);
    const g = ctx.createLinearGradient(0, base - 6, 0, top); g.addColorStop(0, `rgba(255,210,63,${a0.toFixed(3)})`); g.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 1, top, 21, base - 6 - top);
    const ph = S.padPh[key] || 0;
    for (let i = 0; i < 6; i++) {
      const p = mod(ph + i * h / 6, h);
      ctx.globalAlpha = Math.min(1, (1 - p / h) * (.45 + .5 * charge) + (t ? .3 : 0));
      chevron(x + 9, Math.round(base - 14 - p), t ? C.white : C.yellow);
    }
    ctx.globalAlpha = 1;
  }
  // 가드레일에 단 표지판: LOW 간판과 같은 짜임에 노란 네온. 처음 보는 사람에게 이름을 알려주는 길가 표지
  // 다가가면(charge) 밝아지고 화살표가 한 칸 위로 튀며 하얗게 깜빡인다. 읽어야 할 거리에선 깜빡임·글리치가 멈춘다
  const JUMP_ARROW = [6, 4, 7, 8];
  function jumpSign(padX, charge, seed) {
    const m = SG.jump, x = Math.round(padX - m[2] - 6), y = 120, rail = 178, post = y + m[3];
    R(C.ink, x + 22, post, 4, rail - post); R('#3d5868', x + 23, post, 2, rail - post);
    ctx.globalAlpha = .06 + .12 * charge; R(C.yellow, x - 3, y - 3, m[2] + 6, 21); ctx.globalAlpha = 1;
    neonSign('jump', x, y, seed, S.anim, .55 + .45 * charge, charge > .3, 4);
    if (charge > .5 && (S.anim >> 3) % 2 && ok(IMG.signs)) {
      ctx.globalAlpha = .8; ctx.drawImage(sgTint('jumpn', C.white), JUMP_ARROW[0], JUMP_ARROW[1], JUMP_ARROW[2], JUMP_ARROW[3], x + JUMP_ARROW[0], y + JUMP_ARROW[1] - 1, JUMP_ARROW[2], JUMP_ARROW[3]); ctx.globalAlpha = 1;
    }
  }
  function drawWorldObjects() {
    eachObs((o, sx, key, L) => { if (o.t === 'P') drawObs(o, sx, key, L, S.anim); });
    eachObs((o, sx, key) => { if (o.t === 'S') { const c = padCharge(sx); jumpSign(sx, c, o.p); padBeam(sx, GROUND, key, c); } }, 70);
    for (const off of [0, TRACK]) {
      const L = off ? S.lap + 1 : S.lap;
      for (let i = 0; i < PICK.length; i++) {
        const k = PICK[i];
        if (S.got.has(L + ':' + i) || k.lap > L) continue;
        const sx = Math.round(k.p + off - S.d + HX), cy = GROUND - k.h - 10 + Math.round(Math.sin((S.anim + k.p) / 9));
        if (sx < -12 || sx > W + 12) continue;
        hz('cas', sx - 8, cy);
        // 충전 구간의 카세트는 하얗게 달아오른다
        if (!off && chargeZone() && TRACK - k.p < GATE_AP[0] && ok(IMG.haz)) { ctx.globalAlpha = .35 + .35 * Math.sin((S.anim + k.p) / 4); ctx.drawImage(tintPart(IMG.haz, HZ.cas, C.white), sx - 8, cy); ctx.globalAlpha = 1; }
      }
    }
    eachObs((o, sx, key, L) => { if (o.t !== 'P') { drawObs(o, sx, key, L, S.anim); if (o.tangle) tangleFx(o, sx); } });
    for (const d of S.debris) hz('broken', d.x, d.y);
  }
  function drawCars() {
    for (const car of S.cars) {
      if (car.t < car.warn) {
        const blink = (car.t >> 3) % 2;
        ctx.globalAlpha = .22 + .2 * blink;
        const grad = ctx.createLinearGradient(0, 0, 100, 0); grad.addColorStop(0, '#fff6c8'); grad.addColorStop(1, 'rgba(255,246,200,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, GROUND - 24, 100, 22); ctx.globalAlpha = 1;
        if (blink) pix(IMG.haz, HZ.sign, 10, GROUND - 52, 19, 26);
      } else {
        hz('car', car.x, GROUND - 18);
        ctx.globalAlpha = .5; R('#fff6c8', car.x + 52, GROUND - 12, 34, 2); ctx.globalAlpha = 1;
      }
    }
  }
  // 잔상 = 테이프에 겹쳐 녹음된 지난 루프의 나. 바퀴를 마칠 때마다 하나씩(최대 3) 뒤에서 그 바퀴의 움직임을 그대로 다시 달린다
  // 청록 실루엣은 이것만 뜻한다: 몇 개가 따라오는지가 곧 남은 보호막 수(대신 맞기)
  function drawGhosts() {
    if (!TINT) return;
    S.ghosts.forEach((g, i) => {
      const p = S.d - (HX - g.x);
      const hgt = p >= 0 ? (g.rec[Math.floor(mod(p, TRACK) / 4)] || 0) : 0;
      const f = hgt > .5 ? 6 : runFrame(S.anim + (i + 1) * 4, speedOf());
      if (echoSlot(i) - g.x > 3) {
        ctx.globalAlpha = .45;
        for (let k = 0; k < 4; k++) R(C.glow, g.x - 24 - k * 9 - (S.anim * 4 + k * 13) % 14, GROUND - hgt - 32 + k * 7, 18 + k * 5, 1);
      }
      ctx.globalAlpha = .55 - .13 * i;
      heroFrame(TINT[C.teal], f, g.x, GROUND - hgt);
      if (g.flash) { ctx.globalAlpha = g.flash / 16 * .8; heroFrame(TINT[C.white], f, g.x, GROUND - hgt); }
      // 새로 합류한 잔상에 잠깐 이름표
      if (i === 0 && S.echoIn > 0 && !loopBusy()) { ctx.globalAlpha = Math.min(1, S.echoIn / 30); txt('ECHO', g.x, GROUND - hgt - 50, C.glow, 8, 'center'); }
    });
    ctx.globalAlpha = 1;
  }
  // 대신 맞기: 잔상이 하얗게 달려들어 내 몸에 부딪히고, 루프 고리 모양으로 흩어진다
  function drawGuardFx() {
    const g = S.guardFx; if (!g || !TINT) return;
    const k = Math.min(1, (16 - g.t) / 5), x = g.x + (HX - g.x) * k;
    ctx.globalAlpha = .85 * g.t / 16; heroFrame(TINT[C.white], 6, x, S.y);
    ringAt(HX, S.y - 19, 18 + (16 - g.t) * 5, (16 - g.t) / 4, g.t / 16 * .9);
    ctx.globalAlpha = 1;
  }
  /* ================= 변신 (TAPE-RUNNER) ================= */
  // 자기 테이프 띠: 몸 둘레 기운 타원 궤도를 도는 검은 띠. back = 몸 뒤로 지나가는 반쪽(몸보다 먼저 그린다)
  // cut(0~1) = 끊긴 정도: 두 조각이 반대로 날아가며 처진다
  const ribbonPh = d => S.anim * (d === 'right' ? .22 : d === 'left' ? .16 : .08);
  const ribbonR = it => it < 10 ? 46 - it * 2.4 : 22 + Math.sin(S.anim / 9) * 1.5;
  function tapeRibbon(cx, cy, r, ph, back, a, col, cut = 0) {
    for (let i = 0; i < 44; i++) {
      const t = ph + i / 44 * Math.PI * 1.75, sn = Math.sin(t);
      if ((sn < 0) !== back) continue;
      const side = i < 22 ? -1 : 1;
      const x = cx + Math.cos(t) * r + side * cut * 18, y = cy + sn * r * .3 - Math.cos(t) * r * .22 + side * cut * 6 + cut * cut * 16;
      ctx.globalAlpha = a; R('#1a0f0a', x, y, 2, 2); R('#6b4a30', x, y, 2, 1);
      if (i % 9 === (S.anim >> 1) % 9) R(col, x, y, 2, 1);
    }
    ctx.globalAlpha = 1;
  }
  function drawRings() {
    for (const r of S.rings) {
      const k = r.t / r.max, rad = 4 + r.r * (1 - k);
      if (r.soft) { ctx.globalAlpha = .35 * k; ctx.strokeStyle = r.c; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * .85, 0, 0, Math.PI * 2); ctx.stroke(); continue; }
      ctx.globalAlpha = .9 * k;
      for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; R(i % 4 ? r.c : C.white, r.x + Math.cos(a) * rad, r.y + Math.sin(a) * rad * .85, 2, 2); }
    }
    ctx.globalAlpha = 1;
  }
  // OVERDRIVE 네온 궤적: 지나간 자리에 노란 선이 남아 세계와 함께 뒤로 흘러간다(능력이 끝나도 화면 밖으로 나갈 때까지)
  function drawOdTrail() {
    const T = S.odTrail;
    for (let i = 0; i < T.length; i++) {
      const p = T[i], x = HX - (S.total - p.t), nx = i + 1 < T.length ? HX - (S.total - T[i + 1].t) : x + 1;
      ctx.globalAlpha = .85 * (1 - (S.total - p.t) / (HX + 20)); R(C.yellow, x, p.y, Math.max(1, Math.ceil(nx - x)), 1);
      if (i % 3 === 0) { ctx.globalAlpha *= .5; R(C.white, x, p.y - 1, 1, 1); }
    }
    ctx.globalAlpha = 1;
  }
  // 몸 뒤: 충격파 · 궤적 · 테이프 뒤쪽 반 · 방향마다 다른 잔상 (끝나 갈수록 잔상 간격이 좁아져 몸으로 합쳐진다)
  // ← 크고 거칠게 떨리는 붉은 잔상 · → 길고 빠른 잔상과 앞쪽에 순간 겹치는 에코 · ↑ 몸을 감싸는 흰 빛
  function drawXfBack(o) {
    drawOdTrail(); drawRings();
    const d = o.xf, it = S.xfIn ? S.xfIn.t : 99; if (!d || !TINT || it < 4) return;
    const k = xfK(), cy = o.y - 19, hy = i => o.hist && o.hist.length ? o.hist[Math.max(0, o.hist.length - 1 - i * 3)] : o.y;
    tapeRibbon(HX, cy, ribbonR(it), ribbonPh(d), true, 1, XCOL[d]);
    if (d === 'left') for (let i = 3; i >= 1; i--) { ctx.globalAlpha = (.42 - i * .1) * k; heroFrame(TINT[i % 2 ? C.pink : C.red], o.f, HX - i * 11 * k + Math.round(Math.random() * 2 - 1), hy(i), 1 + .08 * i * k); }
    else if (d === 'right') {
      for (let i = 6; i >= 1; i--) { ctx.globalAlpha = (.5 - i * .07) * k; heroFrame(TINT[i % 2 ? C.yellow : C.white], o.f, HX - i * 9 * k, hy(i)); }
      if (S.anim % 26 < 3 && k === 1) { ctx.globalAlpha = .35; heroFrame(TINT[C.yellow], o.f, HX + 10, o.y); ctx.globalAlpha = .18; heroFrame(TINT[C.yellow], o.f, HX + 20, o.y); }
    } else if (XTINT) { ctx.globalAlpha = .22 * k; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) heroFrame(XTINT.body, o.f, HX + ox, o.y + oy); }
    ctx.globalAlpha = 1;
  }
  // 변신한 몸: 변신 순간엔 하얀 실루엣 → 변신 그림 위로 흰빛이 빠지며 드러난다. 네온은 박자에 숨 쉬고, 끝나 갈 땐 아래부터 꺼진다
  // OVERDRIVE는 가끔 2프레임씩 앞으로 튀어 프레임이 건너뛴 듯 보인다(판정은 그대로)
  function xfBody(f, y, d) {
    const it = S.xfIn ? S.xfIn.t : 99, x = HX + (d === 'right' && S.anim % 26 < 2 ? 3 : 0);
    if (!XTINT || !TINT) { heroFrame(IMG.hero, f, x, y); return; }
    if (it < 4) { heroFrame(TINT[C.white], f, x, y); return; }
    const k = xfK(), neon = XTINT[XCOL[d]], dx = Math.round(x - 18), dy = Math.round(y - CH), rows = Math.ceil(CH * k);
    if (k < 1) heroFrame(IMG.hero, f, x, y);
    ctx.globalAlpha = k; heroFrame(IMG.hero_x, f, x, y);
    if (rows > 0) {
      ctx.globalAlpha = BEAT ? 1 : .85; ctx.drawImage(neon, f * CW, 0, CW, rows, dx, dy, CW, rows);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (BEAT ? .45 : .28) * k;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(neon, f * CW, 0, CW, rows, dx + ox, dy + oy, CW, rows);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (it < 10) { ctx.globalAlpha = (10 - it) / 6; heroFrame(XTINT.body, f, x, y); }
    ctx.globalAlpha = 1;
  }
  // 몸 앞: 테이프 앞쪽 반 · 변신 순간 궤도에서 모여드는 픽셀과 RGB 분리 · PURIFY의 모여드는 픽셀 · 해제 때 끊겨 날아가는 테이프
  function drawXfFront(o) {
    const d = o.xf, it = S.xfIn ? S.xfIn.t : 99, cy = o.y - 19;
    if (d) {
      tapeRibbon(HX, cy, ribbonR(it), ribbonPh(d), false, it < 4 ? it / 4 : 1, XCOL[d]);
      if (it < 12) for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2 + it * .06, rr = 42 * (1 - it / 12);
        ctx.globalAlpha = 1 - it / 14; R(i % 3 ? XCOL[d] : C.white, HX + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8, 2, 2);
      }
      if (it >= 4 && it < 14 && TINT) {
        const k = 1 - (it - 4) / 10, sp = Math.round(4 * k);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 * k;
        heroFrame(TINT[C.pink], o.f, HX - sp, o.y); heroFrame(TINT[C.teal], o.f, HX + sp, o.y);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const p of S.xfp) { ctx.globalAlpha = Math.min(1, p.life / 10); R(p.c, HX + Math.cos(p.a) * p.r, cy + Math.sin(p.a) * p.r * .8, 1, 1); }
    }
    if (S.xfOut) {
      const p = 1 - S.xfOut.t / XF_SNAP, c = XCOL[S.xfOut.dir];
      tapeRibbon(HX, cy, 22, S.xfOut.ph, true, 1 - p, c, p); tapeRibbon(HX, cy, 22, S.xfOut.ph, false, 1 - p, c, p);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 - p * 2, rr = 26 * (1 - p); ctx.globalAlpha = 1 - p * .8; R(i % 2 ? c : C.white, HX + Math.cos(a) * rr, cy + Math.sin(a) * rr * .8, 1, 1); }
    }
    ctx.globalAlpha = 1;
  }
  // 변신 순간의 카메라: Hit Stop 동안 주인공 쪽으로 확 당겨졌다가(1.1배) 능력이 시작되며 풀린다
  function xfZoom() {
    const t = S.xfIn ? S.xfIn.t : -1; if (t < 0) return 1;
    return t < 4 ? 1 + .1 * t / 4 : t < XF_STOP ? 1.1 : 1 + .1 * Math.pow(1 - (t - XF_STOP) / (XF_IN - XF_STOP), 2);
  }
  // 화면 기준 이펙트: BREAK 몸 주변 가로 찢김 · OVERDRIVE 위아래 가장자리 속도선 · 변신 순간 플래시(흰색 → 능력 색)
  function drawXfScreen(cam) {
    const d = xfDir(), it = S.xfIn ? S.xfIn.t : 99, hy = Math.round(S.y + VIEW_TOP - cam);
    if (mode !== 'play') return;
    if (d === 'left' && it >= XF_STOP && (S.anim >> 1) % 3 === 0) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 2; i++) {
        const by = hy - 40 + Math.floor(Math.random() * 40), bh = 2 + Math.floor(Math.random() * 4), dx = (Math.random() < .5 ? -1 : 1) * (2 + Math.floor(Math.random() * 3));
        const sx = Math.round((HX - 30) * SX), sy = Math.round(by * SY), sw = Math.round(64 * SX), sh = Math.round(bh * SY);
        ctx.drawImage(cv, sx, sy, sw, sh, sx + Math.round(dx * SX), sy, sw, sh);
      }
      ctx.restore();
    }
    if (d === 'right') {
      const k = xfK();
      for (let i = 0; i < 14; i++) {
        const len = 24 + (i * 13) % 40, y = i % 2 === 0 ? 3 + (i * 7) % 26 : H - 4 - (i * 7) % 26, x = W - mod(S.anim * (9 + (i % 4) * 2) + i * 67, W + len);
        ctx.globalAlpha = (.25 + (i % 3) * .12) * k; R(i % 4 ? C.yellow : C.white, x, y, len, 1);
      }
    }
    if (S.xfIn && it >= 4 && it < 9) { ctx.globalAlpha = .5 * (1 - (it - 4) / 5); R(it < 6 ? C.white : XCOL[S.xfIn.dir], 0, 0, W, H); }
    ctx.globalAlpha = 1;
  }
  function drawHero(o) {
    const { y, f, hist, speed, anim, blink, fever } = o;
    if (o.fall) {
      // 떨어질 땐 잔상이 위로 남고(되감길 땐 아래로) 몸이 앞으로 기운다: 스스로 뛴 점프와 구분되는 실수의 자세
      const dy = (S.rw ? -1 : 1) * Math.min(18, S.vy * 2.2);
      if (TINT) for (let i = 3; i >= 1; i--) { ctx.globalAlpha = .34 - i * .08; heroFrame(TINT[C.teal], f, HX, y - i * dy); }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(HX, y - 19); ctx.rotate(Math.min(.45, (y - GROUND) / 600)); ctx.translate(-HX, 19 - y);
      heroFrame(IMG.hero, f, HX, y); ctx.restore();
      return;
    }
    // 몸 뒤 색 잔상은 변신(drawXfBack)이 맡는다. 평소 청록 실루엣은 '지난 루프의 나'만 뜻한다
    const trail = !!o.xf;
    const col = i => trail ? (i % 2 ? XCOL[o.xf] : XACC[o.xf]) : C.teal;
    // FF DASH: 하얀 빨리감기 자국이 길게 끌리고 앞에 ▶▶ (청록 실루엣 = 잔상과 섞이지 않게 흰색)
    if (S && S.ff > 0 && TINT) {
      for (let i = 3; i >= 1; i--) { ctx.globalAlpha = .5 - i * .12; heroFrame(TINT[C.white], f, HX - i * 12, y); }
      ctx.globalAlpha = 1;
      for (const ax of [HX + 16, HX + 21]) for (let r = 0; r < 5; r++) R(C.white, ax, y - 26 + r, r <= 2 ? r + 1 : 5 - r, 1);
    }
    const lines = trail ? 6 : speed > 3.8 ? 5 : 3;
    ctx.globalAlpha = trail ? .7 : .45;
    for (let k = 0; k < lines; k++) {
      const len = 10 + ((anim * 7 + k * 23) % 26);
      const off = (anim * 3 + k * 17) % 22, ly = y - 6 - ((k * 9 + (anim >> 1)) % 26);
      // 게이트 2단계부터는 속도선이 앞에서 뒤가 아니라 뒤에서 앞으로(시간이 거꾸로) 흐른다
      if (gateZone() >= 2) R(col(k), HX + 18 + off, ly, len, 1); else R(col(k), HX - 20 - len - off, ly, len, 1);
    }
    ctx.globalAlpha = 1;
    if (o.xf) xfBody(f, y, o.xf);
    else if (!blink) heroFrame(IMG.hero, f, HX, y);
  }
  const heroPose = () => (S.falling > 0 || !S.ground) ? (S.spin > 0 ? 7 : 6) : runFrame(S.anim, speedOf());

  /* ================= HUD: 게임 장면 이미지와 같은 구성 ================= */
  function bar(frame, slots, x, y, frac, col) {
    hi(IMG.hud, HU[frame], x, y);
    const total = slots.length * frac;
    slots.forEach(([a, b], i) => {
      const f = Math.max(0, Math.min(1, total - i)); if (f <= 0) return;
      const w = (b - a) / 2 * f, sx = x + a / 2, sy = y + 3.5;
      if (col) { ctx.globalAlpha = .92; R(col, sx, sy, w, 5); ctx.globalAlpha = 1; }
      else if (ok(IMG.hud)) ctx.drawImage(IMG.hud, HU.seg[0] + 3, HU.seg[1] + 3, HU.seg[2] - 6, HU.seg[3] - 6, sx, sy, w, 5);
    });
  }
  function drawHUD() {
    const fever = S.climax > 0, fcol = fever ? FEVER[(S.anim >> 2) % 3] : S.drive > 0 ? C.yellow : S.pick ? ((S.pick.t >> 2) % 2 ? C.white : C.yellow) : null;
    // 게이지 이름표: 지금 켜진 능력(과열 · CLEAN 포함)을 보여준다. CLEAN은 남은 시간을 옆에 하얀 막대로
    const label = S.pick ? 'CHOOSE' : fever ? 'BREAK' : S.drive > 0 ? 'OVERDRIVE' : S.heat > 0 ? 'OVERHEAT' : S.clean > 0 ? 'CLEAN' : 'CLIMAX';
    const lcol = fcol || (S.heat > 0 ? ((S.anim >> 2) % 2 ? C.red : C.pink) : S.clean > 0 ? C.white : C.mist);
    hi(IMG.hud, HU.portrait, 6, 6);
    bar('bar5', SLOT5, 33, 8, S.hp / HPMAX, S.hp <= 1 && (S.anim >> 3) % 2 ? C.red : null);
    txt('HP', 34, 21, C.mist, 8, 'left', null);
    // 지금 걸린 마모(CLEAN 동안은 꺼진 채 회색): 무엇이 나를 방해하는지 늘 보이게
    let dx = 8;
    for (const d of debuffsAt(S.lap)) { const c = S.clean > 0 ? '#3c4a52' : C.pink; tri(dx, 36, false, c); txt(d, dx + 10, 34, c, 8, 'left', null); dx += 16 + Math.ceil(ctx.measureText(d).width); }
    const mult = comboMult();
    if (mult > 1) num('x' + mult, 80, 10, mult > 5 ? C.pink : C.yellow, 8);
    hi(IMG.hud, HU.arm, 6, H - 30);
    bar('bar10', SLOT9, 33, H - 21, S.gauge / GAUGE, fcol);
    txt(label, 34, H - 31, lcol, 8, 'left', null);
    if (S.clean > 0 && !S.pick) { const lw = Math.ceil(ctx.measureText(label).width); R(C.white, 34 + lw + 4, H - 28, Math.ceil(36 * S.clean / S.cleanMax), 2); }
    const rx = W - 32, ry = 4, prog = Math.max(0, Math.min(1, S.d / TRACK));
    hi(IMG.hud, HU.ring0, rx, ry);
    if (ok(IMG.hud)) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(rx + 13, ry + 12.5); ctx.arc(rx + 13, ry + 12.5, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.closePath(); ctx.clip();
      hi(IMG.hud, HU.ring1, rx, ry); ctx.restore();
    }
    num(String(S.lap), rx + 13, ry + 9, C.white, 8, 'center');
    txt('LOOP', rx - 4, ry + 8, C.mist, 8, 'right', null);
    num(String(score()).padStart(7, '0'), W - 8, ry + 30, C.white, 8, 'right');
  }

  /* ================= CLIMAX 선택 ================= */
  // 선택 UI: 주인공 둘레에 카세트 데크 버튼 세 개가 차례로 깜빡이며 켜진다(↑ PURIFY · ← BREAK · → OVERDRIVE). 둘레 링이 남은 시간
  const KEY_AT = { up:[0, -46], left:[-44, 0], right:[44, 0] };
  function keycap(dir, x, y, lit, col) {
    x = Math.round(x - 12); y = Math.round(y - 12);
    pix(IMG.keys, KY[dir + 'o'], x, y);
    if (lit <= 0 || !ok(IMG.keys)) return;
    const neon = tintPart(IMG.keys, KY[dir + 'n'], col);
    ctx.globalAlpha = lit; pix(IMG.keys, KY[dir], x, y); ctx.drawImage(neon, x, y);
    ctx.globalAlpha = lit * .35; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(neon, x + ox, y + oy);
    ctx.globalAlpha = 1;
  }
  const keyPos = dir => { const [dx, dy] = KEY_AT[dir]; return [HX + dx, Math.max(38, Math.round(S.y + VIEW_TOP - S.cam) - 19 + dy)]; };
  function drawPick() {
    if (!S.pick || S.rw || mode !== 'play') return;
    const t = S.pick.t, cx = HX, cy = Math.round(S.y + VIEW_TOP - S.cam) - 19;
    ctx.globalAlpha = .7; ctx.strokeStyle = C.white; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 26, -Math.PI / 2, -Math.PI / 2 + (1 - t / PICK_T) * Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ringAt(cx, cy, 64, t / 10, .2);
    Object.keys(POWERS).forEach((dir, i) => {
      const p = POWERS[dir], dis = dir === 'up' && !canPurify(), [x, y] = keyPos(dir);
      const on = t < 4 + i * 4 ? 0 : t < 14 + i * 4 ? ((t >> 1) % 2 ? 1 : .3) : 1;
      keycap(dir, x, y, dis ? 0 : on, p.col);
      const lc = dis ? '#3c4a52' : p.col;
      if (dir === 'up') txt(p.name, x, y - 22, lc, 8, 'center');
      else if (dir === 'left') txt(p.name, x - 15, y - 4, lc, 8, 'right');
      else txt(p.name, x + 15, y - 4, lc, 8, 'left');
    });
  }
  // 고른 순간: 고른 버튼만 네온이 켜진 채 남고 나머지는 꺼지며, CRT가 휘청이고 색이 번진 뒤 능력 이름이 크게 떴다 사라진다
  function drawPickFx() {
    const f = S.pickFx; if (!f) return;
    const k = 48 - f.t, p = POWERS[f.dir];
    if (k < 14) {
      const amp = (14 - k) / 14 * 4;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let y = 0; y < H; y += 6) {
        const y0 = Math.round(y * SY), h0 = Math.round((y + 6) * SY) - y0;
        ctx.drawImage(cv, 0, y0, cv.width, h0, Math.round(Math.sin(y * .09 + k * .9) * amp * SX), y0, cv.width, h0);
      }
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 * (14 - k) / 14; ctx.drawImage(cv, Math.round(3 * SX), 0);
      ctx.restore();
    }
    if (k < 18) Object.keys(POWERS).forEach(dir => {
      const [x, y] = keyPos(dir);
      if (dir === f.dir) keycap(dir, x, y, 1, p.col);
      else { ctx.globalAlpha = Math.max(0, 1 - k / 8); pix(IMG.keys, KY[dir + 'o'], Math.round(x - 12), Math.round(y - 12)); ctx.globalAlpha = 1; }
    });
    const ny = H / 2 - 44, s = k < 6 ? 1 + (6 - k) * .1 : 1;
    ctx.globalAlpha = Math.min(1, f.t / 10);
    ctx.save(); ctx.translate(W / 2, ny); ctx.scale(s, s);
    txt(p.name, -2, 0, C.pink, 24, 'center', null); txt(p.name, 2, 0, C.glow, 24, 'center', null); txt(p.name, 0, 0, p.col, 24, 'center');
    ctx.restore();
    ktxt(p.k, W / 2, ny + 30, C.paper, 11, 'center', 700);
    if (f.sub) txt(f.sub, W / 2, ny + 48, C.mist, 8, 'center');
    ctx.globalAlpha = 1;
  }
  // PURIFY: 화면의 노이즈가 캐릭터 주변부터 원형으로 걷힌다. 걷어낸 마모만큼의 노이즈를 원 밖에만 다시 그리고, 원의 가장자리가 하얗게 번진다
  // Hit Stop 동안(처음 XF_STOP)은 원이 아직 열리지 않는다
  function drawCleanFx(cam) {
    if (!S.cleanFx) return;
    const t = Math.max(0, 40 - S.cleanFx), r = t * t * .45 + t * 4, fade = Math.min(1, S.cleanFx / 40), cx = HX, cy = Math.round(S.y + VIEW_TOP - cam) - 19;
    ctx.globalAlpha = .35;
    for (let i = 0; i < 120 + S.cleanW * 60; i++) { const x = Math.random() * W, y = Math.random() * H; if (Math.hypot(x - cx, (y - cy) * 1.2) > r) R(Math.random() < .5 ? C.white : C.mist, x, y, 1 + (Math.random() * 2 | 0), 1); }
    if (r > 0) {
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r / 1.2, 0, 0, Math.PI * 2);
      ctx.globalAlpha = .1 * fade; ctx.fillStyle = C.glow; ctx.fill();
      ctx.globalAlpha = .75 * fade; ctx.strokeStyle = C.white; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // ▲▼ 작은 픽셀 삼각형 (테이프 마모 표·라벨)
  const tri = (x, y, up, c) => { for (let r = 0; r < 4; r++) R(c, x + (up ? 3 - r : r), y + r, (up ? r : 3 - r) * 2 + 1, 1); };
  // ◆ 작은 픽셀 마름모 (걷힌 마모)
  const diamond = (x, y, c) => { for (let r = 0; r < 5; r++) { const w = r <= 2 ? r * 2 + 1 : (4 - r) * 2 + 1; R(c, x + 3 - (w >> 1), y + r, w, 1); } };
  // 바퀴가 바뀌어 무엇이 달라졌는지 위쪽에 카세트 라벨처럼: 새로 닳은 것(▼) · 바퀴가 걷어 준 것(◆) · 새 기능이나 능력 성장(▲)
  function drawTapeCard() {
    const card = S.card; if (!card || S.tapeCard <= 0 || loopBusy() || S.banner > 0 || mode !== 'play') return;
    const w = 272, x = Math.round(W / 2 - w / 2), y = 34, h = 20 + card.length * 13;
    ctx.globalAlpha = Math.min(1, S.tapeCard / 20, (240 - S.tapeCard) / 12);
    R(C.ink, x + 2, y + 2, w, h); R(C.ink, x - 1, y - 1, w + 2, h + 2); R('#0a1c26', x, y, w, h); R(C.teal, x, y, w, 2);
    txt('LOOP ' + S.lap + '  TAPE WEAR', x + 6, y + 5, C.mist, 8, 'left', null);
    card.forEach((l, i) => {
      const ly = y + 19 + i * 13, col = l.k === 'bad' ? C.pink : l.k === 'clean' ? C.white : C.glow;
      if (l.k === 'clean') diamond(x + 6, ly + 1, col); else tri(x + 6, ly + 2, l.k === 'good', col);
      txt(l.name, x + 16, ly, col, 8, 'left', null); ktxt(l.text, x + 92, ly - 2, l.k === 'bad' ? C.paper : C.white, 11, 'left', 700);
    });
    ctx.globalAlpha = 1;
  }
  function feature(nn, title, desc, x, y, icon) {
    R(C.ink, x + 2, y + 2, 18, 18); R(C.deep, x, y, 18, 18);
    num(nn, x + 9, y + 5, C.white, 8, 'center');
    ktxt(title, x + 28, y - 1, C.white, 13, 'left', 900);
    ktxt(desc, x + 28, y + 16, C.mist, 11, 'left', 700);
    if (icon) icon(x + 300, y + 10);
  }
  function dotted(x0, y) { for (let x = x0 - 4; x < x0 + 361; x += 4) R('#1d4a52', x, y, 2, 1); }
  /* ================= 타이틀 ================= */
  // 화면 위엔 로고와 PRESS ANY KEY만. 로고 뒤에만 아주 옅은 타원 어둠과 그림자를 깔아(박스 없이) 흐르는 배경이 그대로 보이면서도 읽힌다
  // 평소엔 조용하다: 6~9초에 한 번 로고가 몇 프레임 살짝 찢어지며 색이 갈라지거나 밝기가 흔들리고, PRESS ANY KEY는 박자에 맞춰 밝기만 숨 쉰다
  // 색 갈라짐용 사본: 실루엣을 칠하지 않고 로고에 색을 곱한다 — 검은 받침은 검은 채로 남아 밝은 글자만 분홍/청록으로 번진다
  const SPLIT = new Map();
  function splitTint(img, col) {
    const key = img.src + col; if (SPLIT.has(key)) return SPLIT.get(key);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    SPLIT.set(key, c); return c;
  }
  function drawLogo(a, t) {
    const lg = IMG.logo; if (!ok(lg) || a <= 0) return;
    // 표지 로고(고해상도): 예전 픽셀 로고와 같은 폭 LOGO_W(논리 px), 같은 자리에 부드럽게 줄여 그린다
    const w = LOGO_W, h = w * lg.height / lg.width, x = W / 2 - w / 2, y = H * .3 - h / 2, cy = y + h / 2;
    const g = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, w * .62); g.addColorStop(0, `rgba(2,6,10,${(.6 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(2,6,10,0)');
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(1, .4); ctx.translate(-W / 2, -cy); ctx.fillStyle = g; ctx.fillRect(0, cy - w * .62, W, w * 1.24); ctx.restore();
    // 시작해서 사라지는 중엔 글리치 없이 조용히 빠진다
    const cyc = t % 480, gl = mode === 'title' && cyc > 470 - Math.floor(hash(Math.floor(t / 480)) * 90) && cyc <= 474 - Math.floor(hash(Math.floor(t / 480)) * 90), flick = mode === 'title' && (cyc === 233 || cyc === 235);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if ('filter' in ctx) { ctx.filter = 'blur(3px)'; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = LOGO_GLOW * a; ctx.drawImage(lg, x, y, w, h); ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = a * (flick ? .55 : 1); ctx.drawImage(lg, x, y, w, h);
    if (gl) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 * a;
      ctx.drawImage(splitTint(lg, C.pink), x - 2, y, w, h); ctx.drawImage(splitTint(lg, C.glow), x + 2, y, w, h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      const s = h / lg.height;
      for (let i = 0; i < 2; i++) { const sy = Math.floor(hash(t * .7 + i) * lg.height * .8), sh = Math.max(1, Math.floor(lg.height * (.08 + hash(t + i) * .1))); ctx.drawImage(lg, 0, sy, lg.width, sh, x + (i ? 2 : -2), y + sy * s, w, sh * s); }
    }
    ctx.restore();
  }
  function drawPressKey(a, t) {
    if (a <= 0) return;
    const f = fpb(), k = 1 - (S.beatT % f) / f, y = H - 34;
    ctx.globalAlpha = a * (.5 + .4 * k * k); txt('PRESS ANY KEY', W / 2, y, C.paper, 8, 'center');
    if (hash(Math.floor(t / 2) * .37) < .02) { ctx.globalAlpha = .5 * a; txt('PRESS ANY KEY', W / 2 - 1, y, C.pink, 8, 'center', null); txt('PRESS ANY KEY', W / 2 + 1, y, C.glow, 8, 'center', null); }
    ctx.globalAlpha = 1;
  }
  // 방치하면 같은 배경 위에 설명 · 테이프 마모 표 · 기록이 한 장씩 (원래 대기 화면의 그 페이지들)
  function drawInfo(page) {
    const oy = (H - DECK) / 2;
    if (page === 1 || page === 2) {
      word('how', W / 2, 16 + oy);
      const list = page === 1
        ? [['01', K.t1, K.d1, (x, y) => TINT && heroFrame(TINT[C.teal], 6, x, y + 18)], ['02', K.t2, K.d2, (x, y) => signboard(x - 18, y + 8, 36, y - 16, 3, false, titleT)],
           ['03', K.t3, K.d3, (x, y) => hz('drone', x - 10, y - 4)], ['04', K.t4, K.d4, (x, y) => pix(IMG.haz, HZ.sign, x - 6, y - 8)]]
        : [['05', K.t5, K.d5, (x, y) => pix(IMG.haz, HZ.gate, x - 18, y - 12, 37, 24)], ['06', K.t6, K.d6, (x, y) => ringAt(x, y + 2, 26, titleT / 20)], ['07', K.t7, K.d7, (x, y) => hz('cas', x - 8, y - 2)],
           ['08', K.t8, K.d8, (x, y) => { if (!TINT) return; ctx.globalAlpha = .3; heroFrame(TINT[C.teal], 1, x - 16, y + 18); ctx.globalAlpha = .55; heroFrame(TINT[C.teal], 1, x - 5, y + 18); ctx.globalAlpha = 1; heroFrame(IMG.hero, 1, x + 7, y + 18); }]];
      const step = 40, lx = Math.round(W / 2 - 178);
      list.forEach(([nn, t, d, ic], i) => { const y = 46 + oy + i * step; feature(nn, t, d, lx, y, ic); if (i < list.length - 1) dotted(lx, y + 33); });
      txt(page === 1 ? 'SPACE = JUMP' : 'ARROW KEYS = CLIMAX CHOICE', W / 2, 206 + oy, '#3c6a74', 8, 'center', null);
    } else if (page === 3) {
      // 테이프 마모 표: 바퀴마다 무엇이 닳고(▼) 무엇이 생기는지(▲)
      txt('TAPE WEAR', W / 2, 12 + oy, C.teal, 16, 'center');
      ktxt(K.tw, W / 2, 34 + oy, C.mist, 11, 'center', 700);
      const lx = Math.round(W / 2 - 178);
      for (let i = 1; i <= 4; i++) {
        const t = TAPE[i], y = 58 + oy + (i - 1) * 42;
        chip(i < 4 ? 'LOOP ' + (i + 1) : 'LOOP 5+', lx, y + 6, C.teal);
        tri(lx + 70, y + 3, false, C.pink); txt(t.bad, lx + 80, y + 1, C.pink, 8, 'left', null); ktxt(t.badK, lx + 150, y - 1, C.paper, 11, 'left', 700);
        tri(lx + 70, y + 19, true, C.glow); txt(t.good, lx + 80, y + 17, C.glow, 8, 'left', null); ktxt(t.goodK, lx + 150, y + 15, C.white, 11, 'left', 700);
        if (i < 4) dotted(lx, y + 36);
      }
    } else {
      const by = Math.round((H - 35) / 2) - 35;
      txt('BEST SCORE', W / 2, by, C.teal, 16, 'center');
      num(String(best).padStart(7, '0'), W / 2, by + 32, C.white, 16, 'center');
      txt('BEST LOOP ' + bestLoop, W / 2, by + 62, C.mist, 8, 'center');
      const r = pickRate(), pc = v => Math.round(v * 100) + '%';
      if (r) txt('BREAK ' + pc(r.left) + '   PURIFY ' + pc(r.up) + '   OVERDRIVE ' + pc(r.right), W / 2, by + 86, '#3c6a74', 8, 'center', null);
    }
  }
  // 타이틀 위에 얹는 것 전부: 아주 약한 CRT 그레인 · 로고(또는 방치 중엔 설명 페이지) · PRESS ANY KEY. a = 전체 세기(시작하면 빠르게 사라진다)
  function drawTitleUI(a) {
    ctx.globalAlpha = .06 * a; for (let i = 0; i < 40; i++) R(Math.random() < .5 ? C.white : C.mist, Math.random() * W, Math.random() * H, 1, 1); ctx.globalAlpha = 1;
    const it = idleT - IDLE_T, info = mode === 'title' && it >= 0 ? Math.min(1, it / 20, (INFO_T * 4 - it) / 20) : 0;
    if (info > 0) {
      dim(.84 * info);
      if (info >= 1) drawInfo(1 + Math.floor(it / INFO_T));
    }
    drawLogo(a * (1 - info), titleT);
    drawPressKey(a, titleT);
  }
  // HUD를 서서히 켤 때: 다른 캔버스에 그려 한 번에 투명도를 입힌다
  const hudCv = document.createElement('canvas'), hudCtx = hudCv.getContext('2d');
  function drawHudLayer(a) {
    if (a >= 1) { drawHUD(); return; }
    if (a <= 0) return;
    if (hudCv.width !== cv.width || hudCv.height !== cv.height) { hudCv.width = cv.width; hudCv.height = cv.height; }
    const main = ctx; ctx = hudCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, hudCv.width, hudCv.height); ctx.setTransform(SX, 0, 0, SY, 0, 0); ctx.imageSmoothingEnabled = false;
    drawHUD(); ctx = main;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(hudCv, 0, 0); ctx.restore();
  }

  /* ================= 화면 그리기 ================= */
  function drawRewindFx() {
    ctx.globalAlpha = .28; R('#0b2a33', 0, 0, W, H); ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { const y = (S.anim * 7 + i * 47) % H; ctx.globalAlpha = .25; R(C.white, 0, y, W, 1 + (i % 2)); }
    ctx.globalAlpha = .7;
    for (let i = 0; i < 3; i++) { const y = (S.anim * 13 + i * 90) % H; R('#cfeee9', Math.random() * 40, y, W, 2); }
    ctx.globalAlpha = 1;
    glitchText(2, Math.floor(S.anim / 3), false, GLITCH_HIT);
  }
  function render() {
    ctx.setTransform(SX, 0, 0, SY, 0, 0); ctx.imageSmoothingEnabled = false;
    R(C.night, 0, 0, W, H); // 카메라가 줌 아웃되면(게이트 통과) 세계가 화면을 다 덮지 못하니, 가장자리에 지난 프레임이 남지 않게 먼저 지운다
    const title = mode === 'title', fever = S.climax > 0, beat = (S.beatT % fpb()) < 4, cam = Math.round(S.cam);
    BEAT = beat && !S.rw; BEATP = (S.beatT % fpb()) / fpb(); LAMP = fever ? FEVER[(S.anim >> 3) % 3] : C.teal;
    const pits = []; eachObs((o, sx) => { if (o.t === 'P') pits.push([sx, wOf(o)]); });
    ctx.save();
    const z = xfZoom() * warpZoom();
    if (z !== 1) { const zy = Math.round(S.y + VIEW_TOP - cam) - 19; ctx.translate(HX, zy); ctx.scale(z, z); ctx.translate(-HX, -zy); }
    if (S.shake > 0) ctx.translate(Math.round((Math.random() - .5) * 5), Math.round((Math.random() - .5) * 4));
    else if (liveK() > .3 && S.beatT % fpb() < 2) ctx.translate(Math.round(Math.random() * 2 - 1), Math.round(Math.random() * 2 - 1));
    ctx.translate(0, VIEW_TOP - cam);
    drawBG(S.total, S.falling || cam ? 0 : speedOf(), fever, S.anim, beat && !S.rw);
    drawLiveBack();
    drawUnderDeck(pits);
    drawSecret(); drawLiveHolo(); drawGateway(); drawWorldObjects(); drawDropout();
    if (S.pick && !S.rw) { ctx.globalAlpha = .4; R('#02060a', 0, cam - VIEW_TOP, W, H); ctx.globalAlpha = 1; }
    drawGhosts(); drawGuardFx(); drawBeatGuide();
    const xf = S.falling > 0 || S.y > GROUND ? null : xfDir();
    const hero = { y:S.y, f:heroPose(), hist:S.rw ? null : S.hist, speed:speedOf(), anim:S.anim, blink:S.inv > 0 && !fever && !xf && (S.inv >> 2) % 2 === 1, fever, drive:S.drive > 0, xf };
    // 시작 전환: 주인공이 화면 왼쪽 밖에서 제자리로 달려 들어온다 (타이틀엔 주인공이 없다)
    const enterX = S.enter ? -(HX + 40) * (1 - ease(Math.max(0, Math.min(1, (S.enter.t - 10) / 24)))) : 0;
    ctx.save(); ctx.translate(Math.round(enterX), 0);
    if (!title) drawXfBack(hero);
    if (title) { /* 타이틀: 세계만 흐른다 */ }
    else if (S.falling > 0 || S.y > GROUND) {
      // 도로 위 + 구멍 안 + 상판 아래에서만 보인다 (도로 단면 속으로 파묻혀 보이지 않게)
      ctx.save(); ctx.beginPath(); ctx.rect(0, -H, W, GROUND + H);
      for (const [px, pw] of pits) ctx.rect(px, GROUND, pw, DECK + SLAB - GROUND);
      ctx.rect(0, DECK + SLAB, W, H + CAM_MAX); ctx.clip();
      drawHero({ ...hero, blink:false, hist:null, fall:true }); ctx.restore();
    }
    else drawHero(hero);
    if (!title) drawXfFront(hero);
    ctx.restore();
    drawCars();
    for (const p of S.parts) R(p.c, p.x, p.y, p.s || 2, p.s || 2);
    ctx.restore();
    drawXfScreen(cam);
    if (mode === 'play' && !S.warp && !S.rw && S.anim % SNAP_EVERY === 0) snapshot();
    drawFallFx();
    drawTapeNoise(); drawTangle(); drawLiveFront(); drawGateFx(cam); drawPastFx();
    if (S.warp) drawWarp(hero, cam);
    if (mode === 'play' && dropOn() && (S.anim >> 3) % 2) txt('NO SIGNAL', W / 2, 40, C.white, 8, 'center');
    if (S.slow > 0 && !loopBusy()) { ctx.globalAlpha = .12; R(C.white, 0, 0, W, H); ctx.globalAlpha = 1; }
    if (S.rw) drawRewindFx();
    if (!title) drawHudLayer(S.enter ? (S.enter.t - 24) / 20 : 1);
    drawTapeCard();
    drawOSD();
    drawCleanFx(cam);
    drawPick();
    for (const p of S.pops) txt(p.text, p.x, p.y + VIEW_TOP - cam, p.c, 8, 'center');
    if (S.flash > 0) { ctx.globalAlpha = S.flash / 10 * .6; R(C.white, 0, 0, W, H); ctx.globalAlpha = 1; }
    if (mode === 'play') drawPickFx();
    if (title) drawTitleUI(1);
    else if (S.enter && S.enter.t < 18) drawTitleUI(1 - S.enter.t / 18);
    if (mode === 'play') {
      if (S.banner > 0 && !loopBusy()) {
        if (S.bannerWord) word(S.bannerWord, W / 2, H / 2 - 44);
        if ((S.banner >> 3) % 2 === 0) txt(S.sub, W / 2, H / 2 - 4, C.white, 8, 'center');
      }
    }
    if (mode === 'pause') { dim(.6); txt('PAUSED', W / 2, H / 2 - 32, C.white, 16, 'center'); ktxt(K.pause, W / 2, H / 2 - 4, C.mist, 12, 'center', 700); }
    if (mode === 'over') {
      dim(Math.min(.7, S.overT / 40));
      if (S.overT > 20) {
        const cy = H / 2;
        word('over', W / 2, cy - 76);
        txt('SCORE', W / 2 - 60, cy - 32, C.mist, 8); num(String(score()).padStart(7, '0'), W / 2 + 70, cy - 32, C.white, 8, 'right');
        txt('BEST', W / 2 - 60, cy - 16, C.mist, 8); num(String(best).padStart(7, '0'), W / 2 + 70, cy - 16, C.white, 8, 'right');
        txt('LOOP', W / 2 - 60, cy, C.mist, 8); num(String(S.lap), W / 2 + 70, cy, C.white, 8, 'right');
        if (newRecord) txt('NEW RECORD', W / 2, cy + 32, C.teal, 8, 'center');
        if (S.overT > 45 && (S.overT >> 5) % 2 === 0) txt('PRESS START', W / 2, cy + 80, C.paper, 8, 'center');
      }
    }
  }

  /* ================= 실행 ================= */
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }
  const go = () => { makeTints(); KCACHE.clear(); enterTitle(); requestAnimationFrame(t => { last = t; frame(t); }); };
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('700 8px Silkscreen'), document.fonts.load('8px "Press Start 2P"'), document.fonts.load('900 12px "Noto Sans KR"', Object.values(K).join('')), document.fonts.load('700 12px "Noto Sans KR"', Object.values(K).join(''))])
    : Promise.resolve();
  Promise.race([Promise.all([fontsReady, assetsReady]), new Promise(r => setTimeout(r, 3500))]).then(go, go);
})();
