// 빌드가 만든 파일. 직접 고치지 않는다(js/를 고치고 npm run build)
(() => {
'use strict';
  /* ================= 숫자: 밸런스 · 연출 · 소리 (여기만 고치면 된다) ================= */
  // 단위: 거리 m, 속도 km/h(표시) · m/s(계산), 시간 초. 고친 뒤 npm run build

  // 코스: 12km 고가도로 → 터널 → 정유 단지 → 변전소. 500m마다 철탑 게이트(24개)
  const COURSE = {
    length: 12000,
    gateFirst: 375, gateEvery: 500,   // 게이트는 늘 철탑 줄(125m마다) 위에 선다
    pylonEvery: 125,               // 길가 철탑 간격(게이트 철탑 사이에 3개씩)
    lanes: [-3.6, 0, 3.6],         // 차선 중심 x
    roadHalf: 8.2,                 // 가드레일 안쪽 x
    seed: 303                      // 코스는 늘 같다(기록 비교)
  };

  const SECTORS = [
    { id:'highway',  no:1, from:0,    to:3600,  en:'HIGHWAY',    ko:'고가도로' },
    { id:'tunnel',   no:2, from:3600, to:5300,  en:'TUNNEL',     ko:'송전 터널' },
    { id:'industry', no:3, from:5300, to:9300,  en:'REFINERY',   ko:'정유 단지' },
    { id:'final',    no:4, from:9300, to:12000, en:'SUBSTATION', ko:'변전소 직선로' }
  ];

  const BALANCE = {
    cruiseStart: 170, cruiseEnd: 345, // 기본 속도: 거리에 따라 계속 오른다(멈추지 않는 가속)
    throttle: .22, brake: .5,         // W · S가 기본 속도에 더하고 빼는 비율
    boost: .42, maxSpeed: 480,
    accel: .8, accelBoost: 2.6, decel: 1.9, // 목표 속도로 다가가는 빠르기(1/s)
    laneTime: .17,                    // 차선 하나 옮기는 시간
    laneRepeat: .2,                   // 방향키를 누르고 있으면 다음 차선까지
    cableHalf: .8,                    // 전선 위로 치는 좌우 거리
    hitHalf: 1.35,                    // 장애물에 부딪히는 좌우 거리
    nearHalf: 4.2,                    // 아슬아슬하게 비켜 간 거리(CLOSE)
    gateHalf: 1.6,                    // 게이트 차선 판정
    charge: .36, drain: .065,         // 전류가 차는 / 빠지는 빠르기(1/s)
    gateNeed: .1,                     // 철탑을 켜는 데 필요한 최소 전류
    boostTime: 3.4,                   // 과전류(OVERLOAD) 길이
    fuses: 3,
    crashSlow: .36, crashTime: .9, invuln: 1.8,
    startCurrent: .3
  };

  const SCORE = { meter: 1, gate: 500, chainStep: .25, chainMax: 2, close: 150, smash: 300, smashChain: 100, full: 5000, pass: 100, escape: 1000, thread: 400 };

  // 과전류(OVERLOAD): 부술 수 있는 것은 부수고 돌파한다. 부술 수 없는 것은 그대로 피해야 한다(부딪히면 퓨즈 하나 · 과전류 끝)
  //   부술 수 있다: 방호벽(barrier) · 바리케이드 · 버려진 차 · 스파크 케이블 · 유리 패널 · 공사 구간 방호벽 · 방전(흡수) · 정비차
  //   부술 수 없다: 화물차 · 크레인 컨테이너 · 무너지는 갠트리 · 분리대 · 무너진 차선 · 고가 붕괴
  const BREAK = {
    types: ['barrier', 'barricade', 'car', 'coil', 'panel', 'closure', 'arc', 'cart'],
    extend: .22,          // 하나 부술 때마다 과전류가 이만큼 늘어난다(최대 boostTime까지): 부수며 달리는 동안 이어진다
    dip: .97,             // 부수는 순간 속도 ×0.97 → 과전류 가속으로 바로 회복(타격감)
    light: { extend: .05, dip: .994, score: 100 },   // 공사 구간 방호벽 하나하나(9m마다 줄지어 있다)
    chainWindow: 1.2      // 이 시간 안에 이어 부수면 SMASH ×n
  };

  // 코스 위의 사건: 예고 시간 · 크기 · 벌칙. 어디에 무엇을 두는지는 course.js의 buildEvents
  const HAZARD = {
    truckV: 80, truckLen: 7.5, cartLen: 4.4, cartV: 60,   // km/h · m. 화물차는 같은 방향, 정비차는 마주 온다
    blink: .95, shift: 1.1,              // 화물차: 깜빡이(LED 화살표) → 옆 차선으로 옮기는 시간
    strikeWarn: 1.5,                     // 방전: 도착 1.5초 전에 바닥이 노랗게 끓고, 0.7초 전에 떨어진다
    fallWarn: 2.7, fallTime: .55,        // 갠트리 붕괴: 도착 2.7초 전에 기둥이 꺾이기 시작
    craneDwell: .95, craneMove: .55,     // 크레인 화물: 차선마다 머무는 시간 · 옮기는 시간
    chaseGap: 60, chaseMul: .97,         // 고가 붕괴: 60m 뒤(사이드미러에 보이는 거리)에서 기본 속도의 0.97배로 따라온다
    railCharge: 6, railBoost: .14,       // 고압 레일: 전류가 차는 빠르기 배율 · 속도 더하기
    scrapeSlow: .9,                      // 분리대에 긁히면 속도 ×0.9(퓨즈는 그대로)
    closureEvery: 9,                     // 공사 구간 방호벽 간격(m). 과전류로 들어가면 하나씩 부수며 지나간다
    darkFar: 52, darkFarLive: 130        // 터널 정전: 전류가 없을 때 / 전선 위일 때 보이는 거리
  };

  // 화면의 몸감: 시야각 · 흔들림 · 기울기 · 흐림
  // 평소엔 통제되어 있고, 가속 · 과전류 · 위험 순간에만 세진다
  const FEEL = {
    fov: 64, fovSpeed: 26, fovBoost: 14, fovKick: 6, fovAccel: 7, fovPunch: 16, fovPinch: 5,
    eye: 1.42, bob: .025, shake: .035, shakeCable: .02, shakeCrash: .5, shakeHigh: .03,
    lean: .16, leanCurve: 260, yawLane: .05, pushBack: .55,
    blurSpeed: .36, blurBoost: 1.1, chroma: .0022, chromaBoost: .008, chromaNear: .012,
    warpBoost: .045, slowNear: .55, slowCrash: .12, exposureSpeed: .07,
    pixelRatioMax: 1.5
  };

  // 화면 흐름의 시간
  const UI = {
    titleOut: .45, rise: .9, boot: 1.25,
    endRise: 2.2, endFade: 3.2, endIdle: 15, restartFade: .4, callout: 1.5, ticker: 2.6
  };

  const MIX = { master: .9, music: .5, sfx: .75, engine: .1, wind: .24, hum: .1, rumble: .5 };

  /* ================= BGM 설정: 「Right Answer to the Wrong Question」 ================= */
  // 곡 파일을 audio/right-answer-to-the-wrong-question.m4a로 넣고 npm run build 하면 이 곡이 음악을 맡는다.
  // 곡은 audio/의 파일을 그대로 불러온다 (웹사이트의 http 주소에서 실행).
  // 없으면 게임이 직접 연주하는 신스 음악(같은 박자)이 나온다.
  // bpm   : 곡의 템포. 전광판 · 계기판 깜빡임 · IDIOTAPE 공연이 이 박자를 따른다
  // beat0 : 곡에서 첫 박이 울리는 시각(초)
  // volume: 곡 볼륨(0~1)
  const BGM = { src:'audio/right-answer-to-the-wrong-question.m4a', bpm:128, beat0:0, volume:.55 };

  /* ================= 색: 회색의 폐허, 작동하는 것만 색 ================= */
  // 표지 규칙 그대로: 폐허(도로 · 철탑 · 도시)는 잉크와 회색, 색은 '작동하는 것'에만.
  // 색은 두 가지뿐이고 뜻이 하나씩이다.
  //   빨강 = 전류(내가 흘린 것 · 켜진 철탑 · 잔상 · 과전류)
  //   노랑 = 기계의 신호(LED 계기판 · 게이트 차선 표시 · 경고 줄무늬)
  // 부딪히면 색이 빠진다(회색 = 멈춘 미래). 따로 '피해 색'을 두지 않는다.
  const C = {
    paper:'#eeeae0', paper2:'#e2ddd0', haze:'#d6d1c4', fog:'#343a4a',   // fog: 밤 도시 아래쪽 안개(청회색)
    ink:'#111111', ink2:'#2a2a2a', ink3:'#3c3b38',
    grey1:'#bdbdbd', grey2:'#8a8a8a', grey3:'#5d5c58', concrete:'#bcb7ab',
    red:'#e5322d', redHot:'#ff6a3d', redDeep:'#a3201c',
    yellow:'#ffc21a', yellowHot:'#ffe27a', amber:'#ff9d1a',
    white:'#ffffff', panel:'#121214', ledOff:'#2b2a27'
  };
  const F_PIX = '"Silkscreen", monospace';
  const F_NUM = '"Press Start 2P", monospace';
  const F_KO = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const F_KOPIX = '"Galmuri11", "Silkscreen", monospace';

  // 화면은 늘 16:9 무대(1920×1080 기준) 안에 그린다. 남는 여백은 잉크색
  const STAGE_W = 1920, STAGE_H = 1080;

  /* ================= 코스: 12km를 한 번에 만든다 (씨앗이 같으면 늘 같은 길) ================= */
  // 코스는 데이터만 만든다(그림 · 소리 없음). 그리기는 render/world.js, 판정은 physics.js
  // 배치 규칙
  //  - 게이트 철탑은 500m마다. 게이트마다 '연결 차선'이 하나 있고, 그 차선으로 들어오는 전선(급전선)이 게이트까지 이어진다
  //  - 급전선을 따라 달리면 전류가 차고, 그대로 게이트를 지나면 철탑이 켜진다 → 길을 읽는 법 = 붉은 전류를 따라가기
  //  - 장애물 줄은 한 줄에 1~2차선만 막는다(늘 지나갈 차선이 있다). 게이트 75m 앞부터는 연결 차선을 막지 않는다
  //  - 정유 단지부터 급전선 중간이 끊어진다(끊어진 전선). 끊어진 자리에선 전류가 차지 않는다

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const laneX = i => COURSE.lanes[i];
  const kmh = mps => mps * 3.6;
  const mps = k => k / 3.6;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  function sectorAt(s) {
    for (const z of SECTORS) if (s < z.to) return z;
    return SECTORS[SECTORS.length - 1];
  }
  // 거리에 따른 기본 속도(km/h). 끝으로 갈수록 빨라진다
  function cruiseAt(s) {
    const t = clamp(s / COURSE.length, 0, 1);
    return lerp(BALANCE.cruiseStart, BALANCE.cruiseEnd, Math.pow(t, .85));
  }

  // 굽이 [시작, 끝, 곡률 1/m]: 양 끝은 코사인으로 부드럽게 들어가고 나온다. 변전소 직선로는 거의 곧다
  const CURVES = [
    [650, 1350, .0011], [1700, 2350, -.0014], [2650, 3250, .0009],
    [3950, 4700, -.0008],
    [5600, 6250, .0017], [6500, 7150, -.0018], [7450, 8300, .0012], [8550, 9100, -.0011],
    [9650, 10150, .00035]
  ];
  // 오르내림 [시작, 끝, 세로 곡률]: +면 길이 들리고, -면 꺾여 내려간다
  const HILLS = [
    [900, 1450, -.00026], [1450, 2000, .00026],
    [2350, 2850, .0002], [2850, 3350, -.0002],
    [5750, 6250, -.00022], [6250, 6750, .00022],
    [8100, 8600, .00016], [8600, 9100, -.00016]
  ];
  const TUNNEL = { s0: 3600, s1: 5300 };

  /* ================= 사건 표: 달린다 → 사건 → 반응 → 잠시 안정 → 새 사건 → 더 빠르게 ================= */
  // 구간마다 '소개 → 응용 → 쉼 → 큰 장면'. 게이트 차선은 늘 열어 두고, 사건이 게이트 차선 쪽으로 몰아 주게 놓는다
  // 사건의 종류(판정은 physics.js, 그림은 render/world.js)
  //   closure(막힌 차선) · gap(무너진 차선) · divider(분리대: 넘을 수 없는 차선 경계) · mover(화물차 · 마주 오는 정비차)
  //   crane(차선을 옮겨 다니는 화물) · arc(늦게 보이는 방전) · gantry(무너지는 갠트리) · chase(뒤에서 따라오는 붕괴) · rail(고압 레일)
  // 배치 이유는 docs/update-rhythm.md
  function buildEvents(R, gates) {
    const others = l => [0, 1, 2].filter(k => k !== l);
    const pickOf = arr => arr[Math.floor(R() * arr.length)];
    const gl = i => gates[i].lane;
    const spans = [], dividers = [], movers = [], cranes = [], extra = [], zones = [], calls = [], falls = [];
    const quiet = [[0, 520]], quietLane = [];

    /* SECTOR 01 고가도로: 배우기 */
    // ① 공사 구간 합류: 두 차선이 막히고 GRID 03 차선만 남는다(막힌 길이 게이트로 데려다준다)
    for (const l of others(gl(2))) spans.push({ kind: 'closure', lane: l, s0: 1010, s1: 1250 });
    quiet.push([960, 1290]);
    calls.push({ s: 905, en: 'MERGE', ko: '공사 구간 · 한 차선' });
    // ② 무인 화물차: 첫 대는 GRID 04 옆 차선에서 나란히 지나치고, 둘째 대는 GRID 05 차선에 있다가 추월하려는 쪽으로 끼어든다
    movers.push({ kind: 'truck', lane: pickOf(others(gl(3))), trigger: 1450, ahead: 260, v: HAZARD.truckV });
    movers.push({ kind: 'truck', lane: gl(4), trigger: 1950, ahead: 250, v: HAZARD.truckV - 6, shift: { gap: 88, to: gl(4) === 1 ? pickOf([0, 2]) : 1 } });
    quiet.push([1440, 2420]);
    calls.push({ s: 1470, en: 'FREIGHT', ko: '무인 화물차 서행' });
    // ③ 쉼: 오른쪽에 낡은 공연 포스터(IDIOTAPE 흔적 1, render/world.js)
    // ④ 고가 붕괴: 뒤에서 길이 무너지며 따라온다(사이드미러). 앞에서도 한 차선이 꺼진다. 멈추지 않으면 빠져나간다
    const chase = { s0: 2680, s1: 3330, gap: HAZARD.chaseGap, mul: HAZARD.chaseMul };
    const holeLane = pickOf(others(gl(6)));
    spans.push({ kind: 'gap', lane: holeLane, s0: 3030, s1: 3070 });
    extra.push({ s: 2780, lane: pickOf(others(gl(5))), type: 'barrier' });
    extra.push({ s: 3205, lane: pickOf(others(gl(6))), type: 'car' });
    quiet.push([2640, 3360]);
    calls.push({ s: 2685, en: 'COLLAPSE', ko: '고가 붕괴 · 멈추지 마시오' });

    /* SECTOR 02 송전 터널: 어둠 */
    // ⑤ 마주 오는 정비차: 어두운 터널에서 전조등이 먼저 보인다. 첫 대는 GRID 09 차선, 둘째 대는 게이트 옆 차선
    movers.push({ kind: 'cart', lane: gl(8), trigger: 3700, ahead: 520, v: -HAZARD.cartV });
    movers.push({ kind: 'cart', lane: pickOf(others(gl(8))), trigger: 3960, ahead: 560, v: -HAZARD.cartV });
    quiet.push([3980, 4440]);
    calls.push({ s: 3715, en: 'ONCOMING', ko: '정비차 역주행' });
    // ⑥ 정전: 천장 등이 꺼지고, 내 전류가 지나는 자리만 켜진다. 붉은 전선을 따라가면 길이 보인다(IDIOTAPE 흔적 2: 벽 낙서)
    zones.push({ kind: 'dark', s0: 4440, s1: 4800 });
    calls.push({ s: 4405, en: 'POWER FAIL', ko: '터널 정전' });

    /* SECTOR 03 정유 단지: 고르기 */
    // ⑦ 갈림길: 분리대가 길을 둘로 나눈다. 두 차선 쪽에 GRID 12와 장애물, 한 차선 쪽은 비어 있지만 게이트가 없다
    const g11 = gl(11), b = g11 === 0 ? 1 : g11 === 2 ? 0 : (R() < .5 ? 0 : 1);
    const wide = b === 0 ? [1, 2] : [0, 1];
    dividers.push({ s0: 5640, s1: 6040, b });
    extra.push({ s: 5705, lane: g11, type: 'coil' });
    extra.push({ s: 5965, lane: wide.find(l => l !== g11), type: 'barricade' });
    quiet.push([5600, 6060]);
    calls.push({ s: 5545, en: 'SPLIT', ko: '갈림길 · 분리대' });
    // ⑧ 크레인: 길 위를 가로지르는 갠트리 크레인이 화물을 차선마다 옮긴다(박자에 맞춰 머물고 움직인다)
    cranes.push({ s: 6560, seq: [0, 1, 2, 1], off: Math.floor(R() * 4) });
    quiet.push([6450, 6690]);
    calls.push({ s: 6390, en: 'CRANE', ko: '크레인 작업 중' });
    // ⑨ 쉼: IDIOTAPE 방송탑(7380). 정유 단지 게이트 넷(GRID 11~14)이 이 탑에 전기를 보낸다
    quiet.push([7120, 7470]);
    // ⑩ 방전 구간: 머리 위 전선에서 떨어지는 방전이 도착 1.5초 전에야 보인다. 한 줄에 한 차선, 다음 줄은 다른 차선
    zones.push({ kind: 'danger', s0: 7600, s1: 8440 });
    let prevArc = -1;
    for (const s of [7660, 7745, 7830, 7960, 8045, 8130, 8215, 8300]) {
      const g = gates.find(k => s > k.s - 76 && s < k.s + 14);
      let lanes = [0, 1, 2].filter(l => l !== prevArc && (!g || l !== g.lane));
      const lane = pickOf(lanes);
      extra.push({ s, lane, type: 'arc', reveal: HAZARD.strikeWarn });
      prevArc = lane;
    }
    quiet.push([7580, 8460]);
    calls.push({ s: 7590, en: 'DANGER', ko: '방전 구간' });
    // ⑪ 고압 레일: GRID 18의 급전선 대신 굵은 레일. 타면 전류가 순식간에 차고 빨라진다(SECTOR 04 앞의 BOOST)
    const rail = { lane: gl(17), s0: 8600, s1: gates[17].s + 2, gate: 17 };
    quietLane.push([8540, 8895, rail.lane]);
    calls.push({ s: 8570, en: 'HV RAIL', ko: '고압 레일 · 전류 충전' });
    // ⑪-2 검문소: 레일이 채워 준 전류로 과전류를 쓰는 자리. 부술 수 있는 것(유리 패널 · 바리케이드 · 방호벽 · 버려진 차 · 케이블)만
    //     두 차선씩 줄지어 막는다. 과전류면 그대로 직진하며 부수고, 아니면 한 칸씩 옮겨 가는 빈 차선을 따라 비켜 간다
    const free = [1, 0, 1, 2, 1, 0, 1], kinds = [['panel', 'panel'], ['barricade', 'panel'], ['barrier', 'barricade'], ['panel', 'car'], ['coil', 'panel'], ['barricade', 'barrier'], ['panel', 'panel']];
    [8950, 8998, 9046, 9094, 9142, 9190, 9238].forEach((s, i) => others(free[i]).forEach((l, k) => extra.push({ s, lane: l, type: kinds[i][k] })));
    quiet.push([8900, 9290]);
    calls.push({ s: 8905, en: 'CHECKPOINT', ko: '검문소 · 차단 구간' });

    /* SECTOR 04 변전소 직선로: 최고 속도 */
    // ⑫ 화물차 · 역주행: GRID 20을 지나자마자 그 차선으로 전조등이 온다
    movers.push({ kind: 'truck', lane: pickOf(others(gl(19))), trigger: 9420, ahead: 300, v: HAZARD.truckV });
    movers.push({ kind: 'cart', lane: gl(19), trigger: 9450, ahead: 700, v: -HAZARD.cartV - 10 });
    // ⑬ 두 대 사이로: 나란히 가는 화물차 두 대가 GRID 21 차선만 남긴다
    for (const l of others(gl(20))) movers.push({ kind: 'truck', lane: l, trigger: 9950, ahead: 300 + l * 4, v: HAZARD.truckV, pair: true });
    quiet.push([9600, 10460]);
    calls.push({ s: 9430, en: 'TRAFFIC', ko: '화물차 · 역주행' });
    // ⑭ 차선 축소: 짧은 공사 구간 셋이 한 칸씩 길을 옮기며 GRID 22 차선으로 몰아 준다
    const g21 = gl(21), seq = g21 === 0 ? [2, 1, 0] : g21 === 2 ? [0, 1, 2] : [1, 0, 1];
    [[10560, 10640], [10690, 10765], [10805, 10866]].forEach(([s0, s1], i) => { for (const l of others(seq[i])) spans.push({ kind: 'closure', lane: l, s0, s1 }); });
    quiet.push([10500, 10880]);
    calls.push({ s: 10475, en: 'NARROW', ko: '차선 축소' });
    // ⑮ 갠트리 붕괴: 길 위 갠트리가 무너져 두 차선을 막는다. GRID 23 차선만 남는다(과전류면 부수고 지나간다)
    const open = gl(22);
    falls.push({ s: 11160, open });
    for (const l of others(open)) extra.push({ s: 11160, lane: l, type: 'gantry', reveal: HAZARD.fallWarn });
    quiet.push([11080, 11240]);
    calls.push({ s: 10905, en: 'GANTRY', ko: '구조물 붕괴' });
    zones.push({ kind: 'gantries', s0: 9400, s1: 11900 });

    for (const z of [[1440, 2420], [3980, 4440], [9600, 10460]]) zones.push({ kind: 'traffic', s0: z[0], s1: z[1] });
    spans.sort((a, b2) => a.s0 - b2.s0);
    spans.forEach((sp, i) => { sp.id = 's' + i; });
    movers.sort((a, b2) => a.trigger - b2.trigger);
    movers.forEach((m, i) => { m.id = 'm' + i; });
    calls.sort((a, b2) => a.s - b2.s);
    return { spans, dividers, movers, cranes, extra, zones, calls, falls, chase, rail, quiet, quietLane };
  }

  // 1m 단위 곡률 표. 굽이 양 끝은 사인 창으로 0에서 시작해 0으로 끝나고, 가운데는 평평하게 유지된다
  function profile(list, n) {
    const a = new Float32Array(n);
    for (const [s0, s1, k] of list) {
      for (let s = Math.max(0, Math.floor(s0)); s < Math.min(n, s1); s++) {
        const t = (s - s0) / (s1 - s0);
        a[s] = k * Math.min(1, Math.sin(t * Math.PI) * 1.6);
      }
    }
    return a;
  }

  function buildCourse(seed = COURSE.seed) {
    const R = mulberry(seed), L = COURSE.length, N = L + 1600;
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const K = profile(CURVES, N), V = profile(HILLS, N);
    // 누적 방향(라디안): 먼 도시가 굽이를 따라 옆으로 미끄러지게 쓴다
    const heading = new Float32Array(N);
    for (let s = 1; s < N; s++) heading[s] = heading[s - 1] + K[s];

    /* --- 게이트 --- */
    const gates = [];
    let prev = 1;
    for (let s = COURSE.gateFirst, i = 0; s < L; s += COURSE.gateEvery, i++) {
      let lane;
      if (i === 0) lane = 1;                 // 첫 게이트: 출발한 가운데 전선 그대로
      else if (i === 1) lane = 0;            // 두 번째: 처음으로 전선을 바꿔 탄다
      else {
        lane = Math.floor(R() * 3);
        if (lane === prev && R() < .6) lane = (lane + 1 + Math.floor(R() * 2)) % 3;
      }
      gates.push({ i, s, lane, kind: (s > TUNNEL.s0 && s < TUNNEL.s1) ? 'tunnel' : 'pylon' });
      prev = lane;
    }

    /* --- 전선 --- */
    const cables = [];
    const addCable = (lane, s0, s1, gate = -1) => {
      if (s1 - s0 < 18) return;
      for (const c of cables) if (c.lane === lane && s0 < c.s1 + 6 && s1 > c.s0 - 6) return; // 같은 차선에 겹치지 않게
      cables.push({ id: cables.length, lane, s0, s1, gate });
    };
    // 출발 전선: 가운데 차선에서 첫 게이트까지 그대로 이어진다
    addCable(1, -40, gates[0].s + 2, 0);
    for (const g of gates) {
      if (g.i === 0) continue;
      const before = gates[g.i - 1].s;
      const len = 150 + R() * 140;
      const s0 = Math.max(before + 45, g.s - len), s1 = g.s + 2;
      const sec = sectorAt(g.s);
      if ((sec.no >= 3) && R() < .7) {
        // 끊어진 전선: 가운데 한 군데가 10~22m 비어 있다
        const cut = s0 + (s1 - s0) * (.3 + R() * .35), gap = 10 + R() * 12;
        addCable(g.lane, s0, cut, g.i);
        addCable(g.lane, cut + gap, s1, g.i);
      } else addCable(g.lane, s0, s1, g.i);
      // 다른 차선의 짧은 전선(게이트로 이어지지 않는다): 전류는 차지만 철탑은 못 켠다
      const others = [0, 1, 2].filter(l => l !== g.lane);
      const n = R() < .55 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const lane = pick(others);
        const a = before + 30 + R() * 140, b = a + 50 + R() * 110;
        addCable(lane, a, Math.min(b, g.s - 30));
      }
    }
    // 마지막 게이트 뒤 변전소까지
    addCable(1, gates[gates.length - 1].s + 60, L + 140);

    /* --- 사건 --- */
    const E = buildEvents(R, gates);
    // 고압 레일이 그 게이트의 급전선을 대신한다. 막힌 · 무너진 차선 위의 짧은 전선은 지운다
    for (let i = cables.length - 1; i >= 0; i--) {
      const c = cables[i];
      if (c.gate === E.rail.gate) { cables.splice(i, 1); continue; }
      if (c.gate < 0 && E.spans.some(sp => sp.lane === c.lane && c.s0 < sp.s1 + 10 && c.s1 > sp.s0 - 10)) cables.splice(i, 1);
      else if (c.gate < 0 && E.rail && c.lane === E.rail.lane && c.s0 < E.rail.s1 && c.s1 > E.rail.s0 - 10) cables.splice(i, 1);
    }
    cables.push({ lane: E.rail.lane, s0: E.rail.s0, s1: E.rail.s1, gate: E.rail.gate, rail: true });
    cables.sort((a, b) => a.s0 - b.s0);
    cables.forEach((c, i) => { c.id = i; });

    /* --- 장애물 --- */
    const TYPES = {
      highway: [['car', .4], ['barrier', .35], ['barricade', .25]],
      tunnel: [['barrier', .55], ['barricade', .45]],
      industry: [['coil', .35], ['car', .25], ['barrier', .2], ['barricade', .2]],
      final: [['barrier', .3], ['barricade', .25], ['coil', .25], ['car', .2]]
    };
    const typeFor = sec => {
      let r = R();
      for (const [t, w] of TYPES[sec.id]) { if ((r -= w) <= 0) return t; }
      return TYPES[sec.id][0][0];
    };
    const obstacles = [];
    const gateNear = s => gates.find(g => s > g.s - 75 && s < g.s + 14);
    obstacles.push({ s: 560, lane: 1, type: 'barrier' });   // 처음 비켜 가기: 가운데를 막고 왼쪽 급전선으로 보낸다
    // 사건 자리는 비워 둔다(사건이 그 자리의 장애물). 사건과 사건 사이에만 흩어 놓는다
    const quietAt = s => E.quiet.find(([a, b]) => s > a && s < b);
    let s = 760;
    while (s < L - 240) {
      const q = quietAt(s);
      if (q) { s = q[1] + 20 + R() * 30; continue; }
      const sec = sectorAt(s), v = mps(cruiseAt(s));
      const g = gateNear(s);
      if (g && Math.abs(s - g.s) < 14) { s = g.s + 16; continue; }
      const doubleP = sec.no === 1 ? .16 : sec.no === 2 ? .3 : sec.no === 3 ? .45 : .5;
      let lanes = [0, 1, 2];
      if (g) lanes = lanes.filter(l => l !== g.lane); // 게이트 앞 연결 차선은 비운다
      const ql = E.quietLane.find(([a, b]) => s > a && s < b);
      if (ql) lanes = lanes.filter(l => l !== ql[2]);  // 고압 레일 차선은 비운다
      const count = Math.min(lanes.length - (g ? 0 : 1), R() < doubleP ? 2 : 1);
      for (let k = 0; k < count && lanes.length; k++) {
        const lane = lanes.splice(Math.floor(R() * lanes.length), 1)[0];
        obstacles.push({ s: s + (k ? (R() - .5) * 6 : 0), lane, type: typeFor(sec) });
      }
      s += Math.max(78, v * (sec.no >= 3 ? 1.0 : 1.25)) + R() * 70;
    }
    for (const o of E.extra) obstacles.push({ ...o });
    obstacles.sort((a, b) => a.s - b.s);
    obstacles.forEach((o, i) => { o.id = i; });

    /* --- 전광판: 경고 문구가 붉게 흐른다. 가까이 와야 켜진다. 사건은 길 위 전광판이 먼저 알린다 --- */
    const boards = [
      { s: 70, kind: 'start' },
      { s: 760, msg: ['공사 구간 · 합류', '▼ 한 차선만 통행'] },
      { s: 1560, msg: ['무인 화물차 서행', '▲ 끊어진 전선 · 감전 주의'] },
      { s: 2560, msg: ['고가 붕괴 위험', '멈추지 마시오'] },
      { s: 3380, msg: ['SECTOR 02 송전 터널', '터널 1.7KM'] },
      { s: 4950, msg: ['RIGHT ANSWER', 'TO THE WRONG QUESTION'], tunnel: true },
      { s: 5480, msg: ['SECTOR 03 정유 단지', '갈림길 · 분리대 주의'] },
      { s: 6950, msg: ['방송탑 송전 대기', 'CH 03 · NO SIGNAL'] },
      { s: 7520, msg: ['방전 구간 · 낙뢰 주의', '속도 제한 없음'] },
      { s: 8480, msg: ['고압 레일', '전류를 모아라'] },
      { s: 8925, msg: ['검문소 · 통행 차단', '▲ ▲ ▲'] },
      { s: 9260, msg: ['SECTOR 04 변전소 직선로', '남은 거리 2.7KM'] },
      { s: 10440, msg: ['차선 축소', '▼ ▼ ▼'] },
      { s: 10990, msg: ['변전소 1KM', '멈추지 마시오'] }
    ];
    // IDIOTAPE 방송탑(정유 단지 오른쪽). 정유 단지 게이트 넷(feed)을 켜면 전기가 들어가 공연이 뜬다(render/world.js)
    // 흔적: 고가도로의 낡은 공연 포스터 · 터널 정전 구간의 벽 낙서 · 계기판의 일련번호 라벨
    const screen = { s: 7380, side: 1, feed: [10, 11, 12, 13] };
    const egg = { poster: 2530, tag: 4630 };

    /* --- 정유 단지 원경 구조물 --- */
    const scenery = [];
    for (let z = 5260; z < 9360; z += 30 + R() * 45) {
      const side = R() < .5 ? -1 : 1;
      scenery.push({ s: z, side, dist: 2 + R() * 46, kind: Math.floor(R() * 4), h: 30 + R() * 34 });
    }

    return {
      seed, length: L, N, K, V, heading, gates, cables, obstacles, boards, screen, egg, scenery, tunnel: TUNNEL,
      spans: E.spans, dividers: E.dividers, movers: E.movers, cranes: E.cranes, falls: E.falls, zones: E.zones,
      calls: E.calls, chase: E.chase, rail: E.rail,
      sectorAt, cruiseAt,
      zoneAt: (kind, s) => E.zones.find(z => z.kind === kind && s >= z.s0 && s < z.s1) || null
    };
  }

  /* ================= 숫자 표기 · CHAIN 배율 ================= */
  // 설명 화면 · 결과 판정은 없다. 엔딩은 FINISH · 시간 · 켠 철탑 수 한 줄, 나머지는 변전소에 켜진 불이 말한다


  // CHAIN 배율: 연속으로 켤수록 커진다(최대 3배)
  const chainMul = chain => 1 + Math.min(SCORE.chainMax, Math.max(0, chain - 1) * SCORE.chainStep);

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }
  const pad2 = n => String(n).padStart(2, '0');

  /* ================= 달리기 판정: 속도 · 차선 · 전류 · 게이트 · 충돌 · 사건 ================= */
  // 그림과 소리를 모르는 순수한 계산. update.js가 1/120초씩 부르고, 테스트가 그대로 돌린다
  // 판정이 남기는 사건(events)은 화면 · 소리가 한 프레임에 한 번 읽고 비운다

  const GEARS = [0, 72, 132, 196, 266, 348, 495];       // 단마다 최고 속도(km/h). 계기판 RPM · 엔진 소리용
  const easeOut = t => 1 - (1 - t) * (1 - t) * (1 - t);

  function newRun(course) {
    return {
      s: 0, v: 0, lane: 1, x: 0, xFrom: 0, laneT: 1, laneDir: 0, holdT: 0,
      current: BALANCE.startCurrent, full: false, boost: 0, boosts: 0,
      fuses: BALANCE.fuses, invuln: 0, crash: 0, crashes: 0,
      onCable: false, cable: null, cableIx: 0, cableT: 0,
      gateIx: 0, obsIx: 0, lit: 0, missLane: 0, missDry: 0, chain: 0, bestChain: 0,
      closes: 0, smashes: 0, lastClose: -99, score: 0, time: 0, top: 0,
      gates: new Array(course.gates.length).fill(0),   // 0 아직 · 1 켜짐 · -1 놓침
      done: false, out: false,
      rpm: .2, gear: 1,
      // 사건 상태: 화물차 · 정비차, 막힌 차선(한 번씩만 부딪힌다), 붕괴 추격, 분리대 긁힘
      mv: course.movers.map(() => ({ on: false, done: false, s: 0, x: 0, lane: 0, from: 0, to: -1, blink: 0, move: 0, dead: false, passed: false })),
      spanHit: {}, chase: { on: false, done: false, front: 0 }, scrapeT: 0, pairClose: 0, escaped: 0, dodges: 0,
      smashChain: 0, lastSmash: -9, broken: {},
      events: []
    };
  }

  function rpmFor(k) {
    let g = 1;
    while (g < 6 && k > GEARS[g]) g++;
    const t = clamp((k - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1]), 0, 1);
    return { gear: g, rpm: .3 + t * .66 };
  }

  // 지금 분리대 구간이고, from → to가 그 경계를 넘는가
  function dividerAcross(course, s, from, to) {
    for (const d of course.dividers) {
      if (s < d.s0 - 3 || s > d.s1) continue;
      const lo = Math.min(from, to), hi = Math.max(from, to);
      if (lo <= d.b && hi > d.b) return d;
    }
    return null;
  }

  function moveLane(r, d, course) {
    const nl = clamp(r.lane + d, 0, COURSE.lanes.length - 1);
    r.holdT = 0;
    if (nl === r.lane) { r.events.push({ t: 'edge', dir: d }); return; }
    // 분리대: 넘지 못하고 긁힌다(퓨즈는 그대로, 속도만 조금)
    if (course && dividerAcross(course, r.s, r.lane, nl)) {
      if (r.scrapeT <= 0) { r.v *= HAZARD.scrapeSlow; r.scrapeT = .45; r.events.push({ t: 'scrape', dir: d }); }
      return;
    }
    r.xFrom = r.x; r.lane = nl; r.laneT = 0; r.laneDir = d;
    r.events.push({ t: 'lane', dir: d, lane: nl });
  }

  // 크레인 화물의 좌우 위치: seq 차선마다 craneDwell 동안 머물고 craneMove 동안 옮긴다. 시계는 판의 시간
  function craneX(cr, time) {
    const step = HAZARD.craneDwell + HAZARD.craneMove, n = cr.seq.length;
    const k = time / step + cr.off, i = Math.floor(k), f = (k - i) * step;
    const a = laneX(cr.seq[((i % n) + n) % n]), b = laneX(cr.seq[(((i + 1) % n) + n) % n]);
    return f < HAZARD.craneDwell ? a : lerp(a, b, smooth((f - HAZARD.craneDwell) / HAZARD.craneMove));
  }
  const moverHalf = m => (m.kind === 'truck' ? HAZARD.truckLen : HAZARD.cartLen) / 2;

  const breakable = type => BREAK.types.includes(type);
  // 과전류 중 부술 수 있는 것: 부수고 돌파(속도가 잠깐 꺾였다 바로 회복, 과전류가 조금 늘어남)
  function smash(r, o) {
    const light = o.type === 'closure';
    r.smashes++;
    r.smashChain = r.time - r.lastSmash < BREAK.chainWindow ? r.smashChain + 1 : 1; r.lastSmash = r.time;
    const add = light ? BREAK.light.score : SCORE.smash + SCORE.smashChain * Math.min(5, r.smashChain - 1);
    r.score += add; r.v *= light ? BREAK.light.dip : BREAK.dip;
    r.boost = Math.min(BALANCE.boostTime, r.boost + (light ? BREAK.light.extend : BREAK.extend));
    r.events.push({ t: 'smash', o, chain: r.smashChain, add });
  }
  // 부딪힘: 과전류여도 부술 수 없는 것이면 퓨즈 하나 + 과전류 끝
  function hit(r, o) {
    if (r.boost > 0 && breakable(o.type)) { smash(r, o); return true; }
    if (r.invuln <= 0) {
      if (r.boost > 0) { r.boost = 0; r.events.push({ t: 'boostEnd', broken: true }); }
      crashRun(r, o); return true;
    }
    return false;
  }

  function stepRun(r, course, inp, dt) {
    if (r.done || r.out) return;
    const ev = r.events;
    r.time += dt;
    r.scrapeT = Math.max(0, r.scrapeT - dt);

    /* 차선: 누를 때마다 한 칸. 누르고 있으면 BALANCE.laneRepeat마다 한 칸 더 */
    if (inp.leftP || inp.rightP) moveLane(r, inp.leftP ? -1 : 1, course);
    else if (inp.left || inp.right) { r.holdT += dt; if (r.holdT > BALANCE.laneRepeat) moveLane(r, inp.left ? -1 : 1, course); }
    else r.holdT = 0;
    r.laneT = Math.min(1, r.laneT + dt / BALANCE.laneTime);
    r.x = lerp(r.xFrom, laneX(r.lane), easeOut(r.laneT));

    /* 속도: 기본 속도가 거리에 따라 계속 오르고, W · S · 과전류 · 고압 레일이 그 위에 더하고 뺀다 */
    const cruise = mps(course.cruiseAt(r.s));
    let mul = 1 + (inp.up ? BALANCE.throttle : 0) - (inp.down ? BALANCE.brake : 0);
    if (r.boost > 0) mul += BALANCE.boost;
    if (r.cable && r.cable.rail) mul += HAZARD.railBoost;
    let target = Math.min(mps(BALANCE.maxSpeed), cruise * mul);
    if (r.crash > 0) target *= .55;
    const rate = target > r.v ? (r.boost > 0 ? BALANCE.accelBoost : BALANCE.accel * (inp.up ? 1.5 : 1)) : BALANCE.decel * (inp.down ? 1.3 : 1);
    r.v += (target - r.v) * (1 - Math.exp(-rate * dt));
    const prevS = r.s;
    r.s += r.v * dt;
    r.score += (r.s - prevS) * SCORE.meter;
    r.top = Math.max(r.top, r.v);

    /* 전선: 앞바퀴가 전선 위에 있으면 전류가 찬다. 고압 레일은 몇 배 빠르다 */
    const cables = course.cables;
    while (r.cableIx < cables.length && cables[r.cableIx].s1 < r.s - 320) r.cableIx++;
    let on = null;
    for (let i = r.cableIx; i < cables.length && cables[i].s0 <= r.s; i++) {
      const c = cables[i];
      if (c.s1 >= r.s && Math.abs(r.x - laneX(c.lane)) < BALANCE.cableHalf) { on = c; break; }
    }
    if (on !== r.cable) {
      if (on) { ev.push({ t: 'cableOn', cable: on }); r.cableT = 0; }
      else ev.push({ t: 'cableOff', cable: r.cable });
      r.cable = on; r.onCable = !!on;
    }
    if (on) r.cableT += dt;

    /* 전류 · 과전류 */
    if (r.boost > 0) {
      r.boost -= dt;
      r.current = Math.max(0, r.boost / BALANCE.boostTime);
      if (r.boost <= 0) { r.boost = 0; r.current = 0; ev.push({ t: 'boostEnd' }); }
    } else if (on) r.current = Math.min(1, r.current + BALANCE.charge * (on.rail ? HAZARD.railCharge : 1) * dt);
    else r.current = Math.max(0, r.current - BALANCE.drain * dt);
    if (r.current >= 1 && !r.full && r.boost <= 0) { r.full = true; ev.push({ t: 'full' }); }
    if (r.current < 1) r.full = false;
    if (inp.boostP) {
      if (r.current >= 1 && r.boost <= 0) { r.boost = BALANCE.boostTime; r.boosts++; r.full = false; ev.push({ t: 'boost' }); }
      else if (r.boost <= 0) ev.push({ t: 'boostDenied' });
    }

    /* 게이트: 노란 ▼ 차선으로, 전류가 있는 채로 지나면 철탑이 켜진다. 과전류 중에는 어느 차선이든 켜진다 */
    const gates = course.gates;
    while (r.gateIx < gates.length && gates[r.gateIx].s <= r.s) {
      const g = gates[r.gateIx++];
      const inLane = Math.abs(r.x - laneX(g.lane)) < BALANCE.gateHalf;
      const live = r.current >= BALANCE.gateNeed;
      if (r.boost > 0 || (inLane && live)) {
        r.lit++; r.chain++; r.bestChain = Math.max(r.bestChain, r.chain);
        const add = Math.round(SCORE.gate * chainMul(r.chain));
        r.score += add; r.gates[g.i] = 1;
        ev.push({ t: 'gate', g, lit: true, chain: r.chain, add, viaBoost: r.boost > 0 && !(inLane && live) });
      } else {
        r.gates[g.i] = -1; r.chain = 0;
        if (!inLane) r.missLane++; else r.missDry++;
        ev.push({ t: 'gate', g, lit: false, reason: inLane ? 'dry' : 'lane' });
      }
    }

    /* 장애물(방전 · 무너지는 갠트리도 여기: 늦게 보일 뿐 같은 판정) */
    const obs = course.obstacles;
    while (r.obsIx < obs.length && obs[r.obsIx].s <= r.s) {
      const o = obs[r.obsIx++];
      const dx = r.x - laneX(o.lane), ax = Math.abs(dx);
      if (ax < BALANCE.hitHalf) hit(r, o);
      else if (ax < BALANCE.nearHalf && kmh(r.v) > 200 && r.invuln <= 0 && r.crash <= 0 && o.s - r.lastClose > 12) {
        r.closes++; r.score += SCORE.close; r.lastClose = o.s;
        if (o.reveal) r.dodges++;
        ev.push({ t: 'close', o, side: Math.sign(dx), add: SCORE.close });
      }
    }

    /* 막힌 차선 · 무너진 차선: 그 구간 안에서 그 차선에 있으면
       공사 구간을 과전류로 달리면 방호벽을 하나씩(closureEvery마다) 부수며 지나간다. 무너진 차선은 과전류여도 빠진다 */
    for (const sp of course.spans) {
      if (sp.s0 > r.s) break;
      if (sp.s1 < prevS || r.spanHit[sp.id]) continue;
      if (Math.abs(r.x - laneX(sp.lane)) >= BALANCE.hitHalf) continue;
      if (sp.kind === 'closure' && r.boost > 0) {
        const E = HAZARD.closureEvery, k0 = Math.max(0, Math.ceil((prevS - sp.s0) / E)), k1 = Math.floor((Math.min(r.s, sp.s1) - sp.s0) / E);
        for (let k = k0; k <= k1; k++) {
          const key = sp.id + ':' + k;
          if (r.broken[key]) continue;
          r.broken[key] = 1;
          smash(r, { id: key, span: sp.id, piece: k, s: sp.s0 + k * E, lane: sp.lane, type: 'closure' });
        }
      } else if (sp.s1 >= r.s && hit(r, { id: sp.id, s: r.s, lane: sp.lane, type: sp.kind === 'closure' ? 'wall' : sp.kind })) r.spanHit[sp.id] = true;
    }

    /* 분리대 머리: 경계 위(차선 사이)로 들어가면 부딪힌다 */
    for (const d of course.dividers) {
      if (prevS < d.s0 && r.s >= d.s0 && Math.abs(r.x - (laneX(d.b) + laneX(d.b + 1)) / 2) < .9) hit(r, { id: 'd' + d.s0, s: d.s0, lane: r.lane, x: r.x, type: 'divider' });
    }

    /* 크레인: 지나는 순간 화물이 내 차선에 있으면 */
    for (const cr of course.cranes) {
      if (prevS < cr.s && r.s >= cr.s) {
        const dx = r.x - craneX(cr, r.time), ax = Math.abs(dx);
        if (ax < 1.55) hit(r, { id: 'c' + cr.s, s: cr.s, lane: r.lane, x: r.x - dx, type: 'crane' });
        else if (ax < BALANCE.nearHalf && r.invuln <= 0) { r.closes++; r.dodges++; r.score += SCORE.close; ev.push({ t: 'close', o: { id: 'c' + cr.s, s: cr.s, type: 'crane' }, side: Math.sign(dx), add: SCORE.close }); }
      }
    }

    moverStep(r, course, dt, ev);
    chaseStep(r, course, dt, ev);

    r.crash = Math.max(0, r.crash - dt);
    r.invuln = Math.max(0, r.invuln - dt);

    const { gear, rpm } = rpmFor(kmh(r.v));
    if (gear !== r.gear) { ev.push({ t: 'shift', up: gear > r.gear, gear }); r.gear = gear; }
    r.rpm = rpm;

    if (r.s >= course.length && !r.out) {
      r.done = true;
      if (r.lit === gates.length) r.score += SCORE.full;
      r.score = Math.round(r.score);
      ev.push({ t: 'finish' });
    }
  }

  /* 화물차(같은 방향, 느림) · 정비차(마주 옴): 내가 trigger를 지나면 ahead 앞에 나타난다 */
  function moverStep(r, course, dt, ev) {
    const list = course.movers;
    for (let i = 0; i < list.length; i++) {
      const m = list[i], st = r.mv[i];
      if (st.done) continue;
      if (!st.on) {
        if (r.s < m.trigger) continue;
        if (r.s > m.trigger + 60) { st.done = true; continue; }     // ?s=로 지나쳐서 출발한 경우
        Object.assign(st, { on: true, s: m.trigger + m.ahead, lane: m.lane, x: laneX(m.lane), from: laneX(m.lane), to: -1, blink: 0, move: 0 });
        ev.push({ t: 'mover', m, st });
      }
      st.s += mps(m.v) * dt;
      // 화물차 차선 바꾸기: 내가 gap 안으로 다가오면 깜빡이(LED 화살표)를 켜고, blink 뒤에 옆 차선으로
      if (m.shift && st.to < 0 && !st.dead && st.s > r.s && st.s - r.s < m.shift.gap) { st.to = m.shift.to; st.blink = HAZARD.blink; ev.push({ t: 'blink', m, st }); }
      if (st.to >= 0 && st.blink > 0) { st.blink -= dt; if (st.blink <= 0) st.from = st.x; }
      else if (st.to >= 0 && st.move < 1) { st.move = Math.min(1, st.move + dt / HAZARD.shift); st.x = lerp(st.from, laneX(st.to), smooth(st.move)); if (st.move >= 1) st.lane = st.to; }
      // 차체 길이 안에서 좌우가 겹치면 부딪힘
      const rel = st.s - r.s, half = moverHalf(m), dx = r.x - st.x, ax = Math.abs(dx);
      if (!st.dead && Math.abs(rel) < half + .6 && ax < BALANCE.hitHalf) {
        if (hit(r, { id: m.id, s: st.s, lane: st.lane, x: st.x, type: m.kind })) st.dead = true;
      }
      // 나를 지나 뒤로 가면(추월 · 엇갈림): 바짝 붙어 지났으면 아슬아슬
      if (!st.passed && rel < -half) {
        st.passed = true;
        if (!st.dead && ax < BALANCE.nearHalf + .4 && r.invuln <= 0 && r.crash <= 0) {
          const add = m.kind === 'cart' ? SCORE.close * 2 : SCORE.pass;
          r.closes++; r.score += add;
          ev.push({ t: 'close', o: { id: m.id, s: st.s, lane: st.lane, type: m.kind }, side: Math.sign(dx), add, mover: true });
          if (m.pair && ++r.pairClose === 2) { r.score += SCORE.thread; ev.push({ t: 'thread', add: SCORE.thread }); }
        } else ev.push({ t: 'pass', m, side: Math.sign(dx) });
      }
      if (rel < -140) st.done = true;
    }
  }

  /* 고가 붕괴: s0를 지나면 gap 뒤에서 길이 무너지며 따라온다. 따라잡히면 퓨즈 하나, s1까지 버티면 빠져나간다 */
  function chaseStep(r, course, dt, ev) {
    const ch = course.chase, st = r.chase;
    if (!ch || st.done) return;
    if (!st.on) {
      if (r.s < ch.s0) return;
      if (r.s > ch.s0 + 80) { st.done = true; return; }
      st.on = true; st.front = r.s - ch.gap; ev.push({ t: 'chase' });
    }
    // 기본은 기본 속도의 mul배. 내가 빠르면 거울에 보이는 거리(gap)까지는 따라붙는다 — 빨리 달리면 버티고, 느려지면 잡힌다
    const base = mps(course.cruiseAt(st.front)) * ch.mul, gap = r.s - st.front;
    let v = gap > ch.gap ? Math.max(base, Math.min(r.v, base * 1.5)) : base;
    if (r.invuln > 0 || r.crash > 0) v = Math.min(v, r.v * .95);   // 다른 데 부딪혀 느려진 동안은 바로 뒤에서 멈칫한다
    st.front += v * dt;
    if (r.invuln > 0) st.front = Math.min(st.front, r.s - 7);
    if (st.front >= r.s - 1.5) {
      st.on = false; st.done = true;
      crashRun(r, { id: 'chase', s: r.s, lane: r.lane, x: r.x, type: 'collapse' });
      ev.push({ t: 'chaseEnd', escaped: false });
    } else if (r.s >= ch.s1) {
      st.on = false; st.done = true; r.escaped = 1; r.score += SCORE.escape;
      ev.push({ t: 'chaseEnd', escaped: true, add: SCORE.escape });
    }
  }

  function crashRun(r, o) {
    r.fuses--; r.crashes++;
    r.v *= BALANCE.crashSlow;
    r.current = 0; r.full = false;
    r.crash = BALANCE.crashTime; r.invuln = BALANCE.invuln;
    r.events.push({ t: 'crash', o, fuses: r.fuses });
    if (r.fuses <= 0) { r.out = true; r.score = Math.round(r.score); r.events.push({ t: 'blackout' }); }
  }

  // 결승 연출 · 정전 뒤: 판정 없이 미끄러지듯 선다
  function coastRun(r, dt, decel) {
    r.v = Math.max(0, r.v - decel * dt);
    r.s += r.v * dt;
    const { gear, rpm } = rpmFor(kmh(r.v)); r.gear = gear; r.rpm = rpm * (r.out ? .6 : 1);
  }

  /* ================= 앞길 읽기: 차선마다 '몇 m 더 가면 막히는가' ================= */
  // 아직 보이지 않는 것(방전 · 붕괴는 도착 몇 초 전에야 보인다)은 모른다. 사람이 보는 것과 같은 정보만 쓴다
  // 자동 주행 · 계기판 경고등 · 화면 위 표시가 함께 쓴다. out[lane] = 거리(m), what[lane] = 무엇
  function laneThreats(r, course, look = 600) {
    const out = [1e9, 1e9, 1e9], what = [null, null, null];
    const v = Math.max(8, r.v);
    const put = (l, d, o) => { if (d < out[l]) { out[l] = d; what[l] = o; } };
    // 과전류가 그 자리까지 남아 있으면 부술 수 있는 것은 위험이 아니다(그대로 돌진)
    const rams = (type, d) => r.boost > 0 && breakable(type) && r.boost - .15 > d / v;
    for (let i = r.obsIx; i < course.obstacles.length; i++) {
      const o = course.obstacles[i], d = o.s - r.s;
      if (d > look) break;
      if (o.reveal && d / v > o.reveal) continue;
      if (rams(o.type, d)) continue;
      put(o.lane, Math.max(0, d), o);
    }
    for (const sp of course.spans) {
      if (sp.s0 - r.s > look) break;
      if (sp.s1 < r.s || r.spanHit[sp.id]) continue;
      if (sp.kind === 'closure' && rams('closure', Math.max(0, sp.s1 - r.s))) continue;
      put(sp.lane, Math.max(0, sp.s0 - r.s), sp);
    }
    course.movers.forEach((m, i) => {
      const st = r.mv[i];
      if (!st.on || st.dead || st.passed) return;
      const closing = v - mps(m.v);
      if (closing <= 0) return;
      const d = Math.max(0, (st.s - r.s - moverHalf(m)) * v / closing);
      if (d > look || rams(m.kind, d)) return;
      put(st.lane, d, m);
      if (st.to >= 0) put(st.to, d, m);
    });
    for (const cr of course.cranes) {
      const d = cr.s - r.s;
      if (d < -1 || d > look) continue;
      for (const dt of [-.3, 0, .3]) {
        const x = craneX(cr, r.time + d / v + dt);
        for (let l = 0; l < 3; l++) if (Math.abs(laneX(l) - x) < 2.3) put(l, Math.max(0, d), cr);
      }
    }
    return { dist: out, what };
  }

  /* ================= 자동 주행: 테스트(코스가 끝까지 풀리는지)와 ?auto 화면 확인용 ================= */
  function autoInput(r, course, mem) {
    const inp = { left: false, right: false, up: false, down: false, leftP: false, rightP: false, boostP: false };
    const next = laneThreats(r, course).dist;
    // mem.look: 사람처럼 반응이 늦은 주행을 흉내 낼 때 더 멀리 보고 미리 움직인다(초)
    const danger = Math.max(40, r.v * (.85 + (mem.look || 0)) + 12);
    const g = course.gates[r.gateIx];
    let want = r.lane;
    if (g && g.s - r.s < 360) want = g.lane;
    else {
      const c = course.cables.find(c => c.s0 < r.s + 60 && c.s1 > r.s + 20);
      if (c) want = c.lane;
    }
    // 가는 길(지금 차선 → 원하는 차선) 위의 차선이 모두 안전하고, 분리대를 넘지 않아야 한다
    const pathSafe = (a, b) => {
      if (a === b) return next[a] >= danger;
      if (dividerAcross(course, r.s + r.v * .3, a, b)) return false;
      for (let l = a + Math.sign(b - a); ; l += Math.sign(b - a)) { if (next[l] < danger * .6) return false; if (l === b) break; }
      return next[b] >= danger;
    };
    if (!pathSafe(r.lane, want)) {
      const cand = [0, 1, 2].filter(l => pathSafe(r.lane, l));
      want = cand.length ? cand.sort((a, b) => Math.abs(a - r.lane) - Math.abs(b - r.lane))[0]
        : [0, 1, 2].filter(l => l === r.lane || !dividerAcross(course, r.s, r.lane, l)).sort((a, b) => next[b] - next[a])[0];
    }
    if (r.laneT >= 1 && (mem.cool -= 1 / 120) <= 0) {
      if (want < r.lane) { inp.leftP = true; mem.cool = .12; }
      else if (want > r.lane) { inp.rightP = true; mem.cool = .12; }
    }
    inp.down = next[r.lane] < danger * .7 && r.boost <= 0 && !r.chase.on;
    inp.up = !inp.down;
    inp.boostP = r.current >= 1;
    return inp;
  }

  /* ================= 그림 불러오기 ================= */
  // 모든 그림은 피그마 6주차 PPT의 LIVE WIRE RACER 표지(세트 3)를 참고 이미지로 넣어 Higgsfield에서 뽑았다(docs/higgsfield-assets.md)
  // 그림은 images/의 파일을 그대로 불러온다 (웹사이트의 http 주소에서 실행)
  const IMAGES = {
    title: 'images/title.webp',         // 타이틀 레터링(투명)
    cockpit: 'images/cockpit.webp',     // 1인칭 핸들 · 계기판(투명)
    pylon: 'images/pylon.webp',         // 철탑
    citySky: 'images/city-sky.webp',    // 원경 1: 낮게 깔린 구름(배경 수정사항)
    cityFar: 'images/city-far.webp', cityFarLit: 'images/city-far-lit.webp',     // 원경 2: 먼 고층 빌딩(꺼짐 · 켜진 창문)
    cityNear: 'images/city-near.webp', cityNearLit: 'images/city-near-lit.webp', // 원경 3: 가까운 빌딩(꺼짐 · 켜진 창문)
    portal: 'images/portal.webp',       // 터널 입구
    substation: 'images/substation.webp',
    car: 'images/prop0.webp', barrier: 'images/prop1.webp', barricade: 'images/prop2.webp', coil: 'images/prop3.webp',
    ind0: 'images/ind0.webp', ind1: 'images/ind1.webp', ind2: 'images/ind2.webp', ind3: 'images/ind3.webp',
    logo: 'images/idiotape.png',        // 표지 옆면의 IDIOTAPE 로고(흰색)
    paper: 'images/paper.png',          // 뒷면 종이 결
    band: 'images/band.png'             // IDIOTAPE 연주자(LOOP NIGHT에서 그대로)
  };
  const IMG = {};
  const embedded = (typeof window !== 'undefined' && window.LWR_ASSETS) || {};   // 웹사이트에선 비어 있다: images/ 파일을 그대로 쓴다
  const srcOf = path => embedded[path] || path;

  function loadImages(progress) {
    const names = Object.keys(IMAGES);
    let done = 0;
    return Promise.all(names.map(name => new Promise(resolve => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { IMG[name] = im; progress(++done / names.length); resolve(); };
      im.onerror = () => { console.warn('LIVE WIRE RACER: 그림을 못 읽었습니다', IMAGES[name]); progress(++done / names.length); resolve(); };
      im.src = srcOf(IMAGES[name]);
    })));
  }

  /* ================= 코드로 그리는 재질: 아스팔트 · 콘크리트 · 트러스 · 줄무늬 ================= */
  // 생성 그림을 넓게 늘리면 뭉개지는 반복 재질은 캔버스에 직접 그린다.
  // 규칙은 생성 그림과 같다: 종이색 바탕, 마른 붓 같은 긁힌 선, 잉크 테두리, 색은 노랑 줄무늬만

  const TEX = (() => {
    let R = mulberry(77);
    // 반복되는 재질의 이음매를 없앤다: 같은 씨앗으로 위 · 가운데 · 아래(또는 왼 · 가운데 · 오른쪽)에 세 번 그린다
    function tiled(ctx, W, H, seed, axis, fn) {
      const saved = R;
      for (const o of [-1, 0, 1]) {
        R = mulberry(seed); ctx.save();
        if (axis === 'y') ctx.translate(0, o * H); else ctx.translate(o * W, 0);
        fn(); ctx.restore();
      }
      R = saved;
    }
    const rnd = (a, b) => a + (b - a) * R();
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const grey = (v, a = 1) => `rgba(${v},${v},${v},${a})`;

    // 마른 붓 자국: 진행 방향으로 길게 긁힌 선 여러 개
    function dryBrush(ctx, x, y, len, w, col, vertical = true) {
      ctx.strokeStyle = col; ctx.lineCap = 'butt';
      const n = 3 + (R() * 4 | 0);
      for (let i = 0; i < n; i++) {
        ctx.lineWidth = rnd(.5, w);
        ctx.beginPath();
        const o = rnd(-w * 2, w * 2), l = len * rnd(.5, 1), st = rnd(0, len - l);
        if (vertical) { ctx.moveTo(x + o, y + st); ctx.lineTo(x + o + rnd(-1, 1), y + st + l); }
        else { ctx.moveTo(x + st, y + o); ctx.lineTo(x + st + l, y + o + rnd(-1, 1)); }
        ctx.stroke();
      }
    }
    function speckle(ctx, w, h, n, colA, colB, size = 2) {
      for (let i = 0; i < n; i++) { ctx.fillStyle = R() < .5 ? colA : colB; const s = rnd(.6, size); ctx.fillRect(rnd(0, w), rnd(0, h), s, s); }
    }
    // 거친 가장자리의 사각형(차선 · 줄무늬)
    function roughRect(ctx, x, y, w, h, col, rough = 2) {
      ctx.fillStyle = col;
      ctx.beginPath();
      const steps = Math.max(4, h / 6 | 0);
      ctx.moveTo(x + rnd(0, rough), y);
      for (let i = 0; i <= steps; i++) ctx.lineTo(x + rnd(-rough, rough), y + h * i / steps);
      for (let i = steps; i >= 0; i--) ctx.lineTo(x + w + rnd(-rough, rough), y + h * i / steps);
      ctx.closePath(); ctx.fill();
    }

    /* 도로: 폭 17.2m(가드레일 바깥 포함), 길이 24m 한 장이 반복된다. u = (x + 8.6) / 17.2 */
    function asphalt() {
      const W = 1024, H = 2048, [c, x] = mk(W, H);
      const pxm = W / 17.2, ux = m => (m + 8.6) * pxm, pym = H / 24;
      x.fillStyle = '#44474f'; x.fillRect(0, 0, W, H);
      tiled(x, W, H, 101, 'y', () => {
        // 큰 얼룩(아스팔트 결)
        for (let i = 0; i < 90; i++) {
          x.fillStyle = grey(R() < .5 ? 70 : 168, rnd(.03, .08));
          x.beginPath(); x.ellipse(rnd(0, W), rnd(0, H), rnd(20, 120), rnd(60, 380), 0, 0, 7); x.fill();
        }
        // 진행 방향 마른 붓 자국(표지의 도로처럼)
        for (let i = 0; i < 1400; i++) {
          const dark = R() < .62;
          dryBrush(x, rnd(0, W), rnd(-200, H), rnd(60, 520), dark ? 2.2 : 1.6, dark ? grey(rnd(14, 40), rnd(.2, .5)) : grey(rnd(135, 175), rnd(.13, .32)));
        }
        speckle(x, W, H, 9000, grey(25, .5), grey(165, .35), 2.4);
        // 바퀴 자국: 차선마다 두 줄
        for (const lc of COURSE.lanes) for (const o of [-.75, .75]) {
          x.fillStyle = grey(45, .12); x.fillRect(ux(lc + o) - 14, 0, 28, H);
          for (let i = 0; i < 40; i++) dryBrush(x, ux(lc + o) + rnd(-12, 12), rnd(-100, H), rnd(100, 500), 2, grey(30, .25));
        }
        // 금
        x.strokeStyle = grey(25, .7);
        for (let i = 0; i < 26; i++) {
          x.lineWidth = rnd(.8, 2.2); x.beginPath();
          let px = rnd(0, W), py = rnd(0, H); x.moveTo(px, py);
          for (let k = 0; k < 7; k++) { px += rnd(-28, 28); py += rnd(-40, 40); x.lineTo(px, py); }
          x.stroke();
        }
      });
      // 차선: 6m 칠하고 6m 비운다(한 장에 두 번). 가장자리는 실선
      const dash = (m, y0, len) => {
        roughRect(x, ux(m) - 9, y0 * pym, 18, len * pym, 'rgba(196,199,204,.6)', 2.5);
        for (let i = 0; i < 30; i++) dryBrush(x, ux(m) + rnd(-8, 8), y0 * pym + rnd(0, len * pym), rnd(10, 60), 1.5, grey(rnd(60, 120), .45));
      };
      for (const m of [-1.8, 1.8, -5.4, 5.4]) { dash(m, 1, 6); dash(m, 13, 6); }
      for (const m of [-7.05, 7.05]) {
        roughRect(x, ux(m) - 7, 0, 14, H, 'rgba(188,191,197,.5)', 2);
        for (let i = 0; i < 60; i++) dryBrush(x, ux(m) + rnd(-6, 6), rnd(0, H), rnd(10, 90), 1.4, grey(rnd(70, 130), .5));
      }
      // 가드레일 밑 그늘
      const gl = x.createLinearGradient(0, 0, ux(-7.6), 0); gl.addColorStop(0, 'rgba(20,20,20,.55)'); gl.addColorStop(1, 'rgba(20,20,20,0)');
      x.fillStyle = gl; x.fillRect(0, 0, ux(-7.6), H);
      const gr = x.createLinearGradient(W, 0, ux(7.6), 0); gr.addColorStop(0, 'rgba(20,20,20,.55)'); gr.addColorStop(1, 'rgba(20,20,20,0)');
      x.fillStyle = gr; x.fillRect(ux(7.6), 0, W - ux(7.6), H);
      return c;
    }

    /* 콘크리트 방호벽 안쪽 면: 길이 24m × 높이 1.2m. 4m마다 이음매, 한 장에 노랑 줄무늬 표지 하나 */
    function wall(tunnel = false) {
      const W = 1024, H = 256, [c, x] = mk(W, H);
      x.fillStyle = tunnel ? '#6d6a63' : '#4c5059'; x.fillRect(0, 0, W, H);
      tiled(x, W, H, tunnel ? 203 : 202, 'x', () => {
        for (let i = 0; i < 500; i++) dryBrush(x, rnd(0, W), rnd(-40, H), rnd(30, 200), 1.8, grey(rnd(40, 110), rnd(.1, .35)));
        speckle(x, W, H, 2600, grey(30, .4), grey(160, .32), 2);
      });
      x.fillStyle = grey(30, .5); x.fillRect(0, 0, W, 10);           // 윗선(잉크)
      x.fillStyle = grey(20, .8); x.fillRect(0, H - 14, W, 14);      // 바닥 그늘
      const pm = W / 24;
      for (let m = 0; m < 24; m += 4) { x.fillStyle = grey(20, .75); x.fillRect(m * pm, 0, 3, H); x.fillStyle = grey(170, .3); x.fillRect(m * pm + 3, 0, 2, H); }
      // 노랑-검정 줄무늬 표지(표지 그림의 가드레일처럼 작게)
      const sx = 10 * pm, sw = 1.6 * pm;
      x.save(); x.beginPath(); x.rect(sx, 26, sw, H - 60); x.clip();
      x.fillStyle = '#151515'; x.fillRect(sx, 26, sw, H - 60);
      x.fillStyle = C.yellow;
      for (let k = -8; k < 12; k++) { x.beginPath(); x.moveTo(sx + k * 22, 26); x.lineTo(sx + k * 22 + 11, 26); x.lineTo(sx + k * 22 + 11 + 120, H); x.lineTo(sx + k * 22 + 120, H); x.fill(); }
      for (let i = 0; i < 80; i++) dryBrush(x, sx + rnd(0, sw), rnd(20, H), rnd(10, 60), 1.4, grey(rnd(30, 200), .4));
      x.restore();
      x.strokeStyle = '#111'; x.lineWidth = 3; x.strokeRect(sx, 26, sw, H - 60);
      return c;
    }

    /* 강철 트러스(게이트 · 전광판 기둥): 투명한 틈이 있는 격자. 128px = 1m 높이 */
    function truss() {
      const W = 1024, H = 128, [c, x] = mk(W, H);
      const steel = () => grey(rnd(40, 70));
      x.lineCap = 'square';
      const bar = (x0, y0, x1, y1, w) => {
        x.strokeStyle = '#0d0d0d'; x.lineWidth = w + 4; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        x.strokeStyle = steel(); x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        x.strokeStyle = grey(150, .5); x.lineWidth = 1; x.beginPath(); x.moveTo(x0, y0 - w / 3); x.lineTo(x1, y1 - w / 3); x.stroke();
      };
      bar(0, 12, W, 12, 14); bar(0, H - 12, W, H - 12, 14);
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = i * W / n, b = (i + 1) * W / n;
        bar(a + 4, 14, b - 4, H - 14, 7); bar(b - 4, 14, a + 4, H - 14, 7); bar(a, 12, a, H - 12, 9);
      }
      x.fillStyle = '#ddd';
      for (let i = 0; i < n * 4; i++) { x.beginPath(); x.arc(i * W / (n * 4) + 6, 12, 2.2, 0, 7); x.arc(i * W / (n * 4) + 6, H - 12, 2.2, 0, 7); x.fill(); }
      return c;
    }

    function hazard(w = 256, h = 256, step = 32) {
      const [c, x] = mk(w, h);
      x.fillStyle = '#141414'; x.fillRect(0, 0, w, h);
      x.fillStyle = C.yellow;
      for (let k = -h / step; k < (w + h) / step; k++) {
        x.beginPath(); x.moveTo(k * step * 2, 0); x.lineTo(k * step * 2 + step, 0); x.lineTo(k * step * 2 + step - h, h); x.lineTo(k * step * 2 - h, h); x.fill();
      }
      for (let i = 0; i < 160; i++) dryBrush(x, rnd(0, w), rnd(0, h), rnd(8, 50), 1.3, grey(rnd(20, 230), .35), R() < .5);
      return c;
    }

    // 노란 ▼ 셰브론(게이트 앞 연결 차선 바닥). 위쪽이 진행 방향
    function chevron() {
      const [c, x] = mk(256, 256);
      x.fillStyle = C.yellow;
      for (const o of [0, 96]) {
        x.beginPath(); x.moveTo(20, 150 - o); x.lineTo(128, 70 - o); x.lineTo(236, 150 - o); x.lineTo(236, 196 - o); x.lineTo(128, 116 - o); x.lineTo(20, 196 - o); x.closePath(); x.fill();
      }
      x.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${rnd(.2, .8)})`; x.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 6), rnd(1, 3)); }
      return c;
    }

    // 접속판: 급전선이 게이트 아래에서 꽂히는 자리
    function plate() {
      const [c, x] = mk(256, 320);
      x.drawImage(hazard(256, 320, 26), 0, 0);
      x.fillStyle = '#2b2b2b'; x.fillRect(26, 26, 204, 268);
      for (let i = 0; i < 120; i++) dryBrush(x, rnd(26, 230), rnd(26, 294), rnd(10, 40), 1.2, grey(rnd(60, 160), .4));
      x.fillStyle = '#111'; x.beginPath(); x.arc(128, 160, 46, 0, 7); x.fill();
      x.strokeStyle = '#777'; x.lineWidth = 6; x.beginPath(); x.arc(128, 160, 40, 0, 7); x.stroke();
      x.fillStyle = '#999'; for (const [a, b] of [[40, 40], [216, 40], [40, 280], [216, 280]]) { x.beginPath(); x.arc(a, b, 6, 0, 7); x.fill(); }
      x.strokeStyle = '#000'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 314);
      return c;
    }

    function glow(size = 128) {
      const [c, x] = mk(size, size);
      const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.75)'); g.addColorStop(.5, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      return c;
    }
    // 바닥 전류 빛: 가로로 가운데가 밝은 띠
    function streak() {
      const [c, x] = mk(64, 8);
      const g = x.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 8);
      return c;
    }
    function shadow() {
      const [c, x] = mk(128, 64);
      const g = x.createRadialGradient(64, 32, 4, 64, 32, 64);
      g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(.6, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.save(); x.scale(1, .5); x.fillRect(0, 0, 128, 128); x.restore();
      return c;
    }
    // 고가도로 아래 땅: 연한 안개 속 무너진 블록
    function ground() {
      const W = 1024, H = 1024, [c, x] = mk(W, H);
      x.fillStyle = '#2a2f39'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) {
        x.fillStyle = grey(rnd(16, 60), rnd(.15, .4));
        const w = rnd(20, 90), h = rnd(20, 90); x.fillRect(rnd(0, W), rnd(0, H), w, h);
      }
      for (let i = 0; i < 1200; i++) dryBrush(x, rnd(0, W), rnd(0, H), rnd(20, 120), 1.2, grey(rnd(70, 120), rnd(.06, .18)), R() < .5);
      return c;
    }
    // 고무 피복 전선
    function cable() {
      const [c, x] = mk(64, 256);
      x.fillStyle = '#2c2e34'; x.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 16; i++) { x.strokeStyle = grey(rnd(90, 130), .7); x.lineWidth = 3; x.beginPath(); x.moveTo(0, i * 16); x.lineTo(64, i * 16 + 12); x.stroke(); }
      x.fillStyle = grey(210, .7); x.fillRect(21, 0, 9, 256);
      return c;
    }
    // 터널 천장 · 벽(어두운 콘크리트, 판 이음매)
    function tunnelPanel() {
      const W = 512, H = 512, [c, x] = mk(W, H);
      x.fillStyle = '#5b5852'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 700; i++) dryBrush(x, rnd(0, W), rnd(-40, H), rnd(30, 220), 1.8, grey(rnd(20, 90), rnd(.15, .4)));
      speckle(x, W, H, 2400, grey(25, .4), grey(170, .3), 2);
      x.fillStyle = '#1a1a1a';
      for (let i = 0; i <= 4; i++) { x.fillRect(0, i * H / 4 - 2, W, 4); }
      x.fillRect(0, 0, 4, H); x.fillRect(W / 2 - 2, 0, 4, H);
      return c;
    }

    /* ---------- 사건 물체: 같은 규칙(잉크 테두리 · 회색 물감 · 마른 붓). 노랑은 기계 신호에만 ---------- */
    const ink = (x, w = 8) => { x.strokeStyle = '#111'; x.lineWidth = w; x.lineJoin = 'round'; };
    function wash(x, x0, y0, w, h, base, n = 160, vertical = true) {
      x.fillStyle = base; x.fillRect(x0, y0, w, h);
      x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
      for (let i = 0; i < n; i++) dryBrush(x, rnd(x0, x0 + w), rnd(y0 - 20, y0 + h), rnd(20, h * .8), 1.8, grey(rnd(40, 120), rnd(.12, .35)), vertical);
      speckle(x, x0 + w, y0 + h, n * 3, grey(40, .35), grey(230, .3), 2);
      x.restore();
    }
    // 무인 화물차(뒤에서 본 모습). 가운데 검은 칸에 LED 판이 따로 붙는다(깜빡이 화살표)
    function truck() {
      R = mulberry(311);
      const [c, x] = mk(512, 512);
      wash(x, 64, 36, 384, 368, '#b8b3a7', 220);
      ink(x, 9); x.strokeRect(64, 36, 384, 368);
      x.lineWidth = 5; x.beginPath(); x.moveTo(256, 140); x.lineTo(256, 400); x.stroke();
      for (const rx of [150, 362]) { x.lineWidth = 7; x.beginPath(); x.moveTo(rx, 150); x.lineTo(rx, 392); x.stroke(); }
      x.fillStyle = '#121212'; x.fillRect(164, 62, 184, 66);
      x.drawImage(hazard(384, 32, 22), 64, 404);
      ink(x, 6); x.strokeRect(64, 404, 384, 32);
      x.fillStyle = '#1b1b1b'; x.fillRect(40, 436, 432, 26);
      x.fillStyle = '#0d0d0d'; x.fillRect(74, 460, 96, 50); x.fillRect(342, 460, 96, 50);
      x.fillStyle = C.yellow; x.fillRect(78, 372, 44, 22); x.fillRect(390, 372, 44, 22);
      ink(x, 4); x.strokeRect(78, 372, 44, 22); x.strokeRect(390, 372, 44, 22);
      x.fillStyle = '#e9e4d8'; x.fillRect(214, 440, 84, 20); x.fillStyle = '#111'; x.font = '700 15px Silkscreen'; x.textAlign = 'center'; x.fillText('LWR 03', 256, 456);
      x.font = '700 30px Silkscreen'; x.fillStyle = 'rgba(20,20,20,.75)'; x.fillText('AUTO FREIGHT', 256, 186);
      return c;
    }
    // 마주 오는 정비차(앞에서 본 모습). 전조등 자리는 흰 원, 빛은 코드가 덧그린다
    function cart() {
      R = mulberry(312);
      const [c, x] = mk(512, 384);
      wash(x, 70, 70, 372, 236, '#8e8a82', 160);
      ink(x, 9); x.strokeRect(70, 70, 372, 236);
      x.fillStyle = '#262626'; x.fillRect(108, 92, 296, 98);
      x.strokeStyle = grey(200, .35); x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(130 + i * 70, 100); x.lineTo(110 + i * 70, 182); x.stroke(); }
      ink(x, 6); x.strokeRect(108, 92, 296, 98);
      x.drawImage(hazard(372, 30, 20), 70, 290); ink(x, 5); x.strokeRect(70, 290, 372, 30);
      for (const hx of [140, 372]) { x.fillStyle = '#f4f1e8'; x.beginPath(); x.arc(hx, 248, 30, 0, 7); x.fill(); ink(x, 6); x.stroke(); }
      x.fillStyle = C.yellow; x.fillRect(232, 40, 48, 30); ink(x, 5); x.strokeRect(232, 40, 48, 30);
      x.fillStyle = '#0d0d0d'; x.fillRect(88, 320, 76, 56); x.fillRect(348, 320, 76, 56);
      return c;
    }
    // 무너진 차선: 찢긴 가장자리의 검은 구멍, 철근
    function hole() {
      R = mulberry(313);
      const W = 256, H = 512, [c, x] = mk(W, H);
      const edge = [];
      for (let i = 0; i <= 24; i++) edge.push([rnd(4, 26), i / 24 * H]);
      for (let i = 24; i >= 0; i--) edge.push([W - rnd(4, 26), i / 24 * H]);
      x.fillStyle = '#b5b0a5'; x.beginPath(); edge.forEach(([a, b], i) => i ? x.lineTo(a + (a < W / 2 ? -6 : 6), b) : x.moveTo(a - 6, b)); x.closePath(); x.fill();
      x.fillStyle = '#0b0b0b'; x.beginPath(); edge.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill();
      x.strokeStyle = '#4a4844'; x.lineWidth = 3;
      for (let i = 0; i < 14; i++) { const y = rnd(10, H - 10); x.beginPath(); x.moveTo(rnd(0, 30), y); x.lineTo(rnd(40, 110), y + rnd(-30, 30)); x.stroke(); x.beginPath(); x.moveTo(W - rnd(0, 30), y); x.lineTo(W - rnd(40, 110), y + rnd(-30, 30)); x.stroke(); }
      for (let i = 0; i < 80; i++) dryBrush(x, rnd(20, W - 20), rnd(0, H), rnd(10, 60), 1.4, grey(rnd(30, 70), .5));
      return c;
    }
    // 오래된 공연 포스터(광고판). 이름은 없다: 웃는 카세트 표시 · 숫자 · 머리글자만
    // 웃는 카세트(릴 두 개가 눈)는 NEVER CITY의 공연 전단지와 같은 표시다
    const MARK = ['#######', '##.#.##', '#######', '#.###.#', '##...##'];
    function mark(x, x0, y0, cell, col) { x.fillStyle = col; MARK.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') x.fillRect(x0 + i * cell, y0 + j * cell, cell - 2, cell - 2); })); }
    function poster() {
      R = mulberry(314);
      const W = 512, H = 288, [c, x] = mk(W, H);
      x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, W, H);
      wash(x, 14, 14, W - 28, H - 28, '#d9d3c5', 120);
      mark(x, 40, 52, 26, '#1d1c1a');
      x.fillStyle = '#1d1c1a'; x.textAlign = 'left';
      x.font = '700 40px Silkscreen'; x.fillText('ONE NIGHT', 236, 82);
      x.font = '700 40px Silkscreen'; x.fillText('LIVE', 236, 124);
      x.font = '700 18px Silkscreen'; x.fillStyle = '#3a3936'; x.fillText('SUBSTATION HALL  NO.3', 238, 156);
      x.fillStyle = '#1d1c1a'; x.fillRect(236, 172, 240, 3);
      x.font = '20px "Press Start 2P"'; x.fillText('11111101', 238, 210);
      x.font = '700 16px Silkscreen'; x.fillStyle = '#4a4844'; x.fillText('DG  ZZ  DR', 40, 222);
      x.fillText('LIVE TAPE  SIDE A', 238, 244);
      // 바래고 찢김: 오른쪽 아래 모서리 · 테이프 자국
      x.fillStyle = '#1a1a1a'; x.beginPath(); x.moveTo(W - 14, H - 96); x.lineTo(W - 14, H - 14); x.lineTo(W - 120, H - 14); x.lineTo(W - 70, H - 44); x.closePath(); x.fill();
      x.fillStyle = 'rgba(200,195,180,.55)'; x.fillRect(20, 6, 70, 22); x.fillRect(W - 92, 8, 66, 22);
      for (let i = 0; i < 60; i++) { x.fillStyle = grey(rnd(150, 230), rnd(.2, .5)); x.fillRect(rnd(14, W - 14), rnd(14, H - 14), rnd(4, 40), rnd(1, 3)); }
      return c;
    }
    // 터널 벽 낙서: 흰 스프레이. 같은 표시 · 머리글자 · 방송탑 쪽 화살표(7.4KM)
    function graffiti() {
      R = mulberry(315);
      const W = 512, H = 256, [c, x] = mk(W, H);
      const spray = (px, py, r, n) => { for (let i = 0; i < n; i++) { const a = R() * 7, d = Math.pow(R(), 1.6) * r; x.fillRect(px + Math.cos(a) * d, py + Math.sin(a) * d, 1.6, 1.6); } };
      x.fillStyle = 'rgba(242,239,230,.95)';
      MARK.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') { x.fillRect(30 + i * 24, 40 + j * 24, 22, 22); spray(41 + i * 24, 51 + j * 24, 16, 30); } }));
      for (let i = 0; i < 6; i++) { const dx = 40 + R() * 150; x.fillRect(dx, 160, 3, 14 + R() * 40); }
      x.font = '700 46px Silkscreen'; x.textAlign = 'left'; x.fillText('DG ZZ DR', 228, 96);
      x.lineWidth = 7; x.strokeStyle = 'rgba(242,239,230,.95)'; x.beginPath(); x.moveTo(232, 150); x.lineTo(410, 150); x.lineTo(386, 128); x.moveTo(410, 150); x.lineTo(386, 172); x.stroke();
      x.font = '26px "Press Start 2P"'; x.fillText('7.4KM', 232, 214); x.fillText('CH03', 400, 214);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(242,239,230,${rnd(.1, .4)})`; x.fillRect(rnd(0, W), rnd(0, H), 1.5, 1.5); }
      return c;
    }
    // 크레인 화물(컨테이너 옆면): 회색 골판 + 양 끝 노랑 줄무늬
    function container() {
      R = mulberry(316);
      const [c, x] = mk(512, 256);
      wash(x, 0, 0, 512, 256, '#a19c91', 140);
      x.strokeStyle = grey(30, .55); x.lineWidth = 4; for (let i = 0; i < 512; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); }
      x.drawImage(hazard(60, 256, 20), 0, 0); x.drawImage(hazard(60, 256, 20), 452, 0);
      ink(x, 10); x.strokeRect(0, 0, 512, 256);
      x.font = '700 40px Silkscreen'; x.fillStyle = 'rgba(17,17,17,.8)'; x.textAlign = 'center'; x.fillText('HV-03', 256, 140);
      return c;
    }
    // 방전 줄기(세로 64×512). 흰 심 + 노란 가장자리. 몇 장을 번갈아 쓴다
    function bolt(seed) {
      R = mulberry(400 + seed);
      const [c, x] = mk(64, 512);
      let px = 32; const pts = [[px, 0]];
      for (let y = 24; y <= 512; y += 24) { px = clamp(px + rnd(-16, 16), 8, 56); pts.push([px, y]); }
      for (const [w, col] of [[14, 'rgba(255,194,26,.35)'], [7, 'rgba(255,226,122,.9)'], [3, '#ffffff']]) {
        x.strokeStyle = col; x.lineWidth = w; x.lineJoin = 'miter'; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke();
      }
      for (let k = 0; k < 4; k++) {
        const [a, b] = pts[2 + Math.floor(R() * (pts.length - 4))];
        x.strokeStyle = 'rgba(255,226,122,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(a, b); x.lineTo(a + rnd(-26, 26), b + rnd(20, 60)); x.stroke();
      }
      return c;
    }

    // 검문소 유리 패널(뒤에서 본 모습): 얇은 철 틀 · 바랜 유리 · 꺼진 LED 줄 · 아래 줄무늬 · 다리 둘. 과전류면 깨진다
    function panel() {
      R = mulberry(317);
      const [c, x] = mk(512, 448);
      x.fillStyle = '#1b1b1b'; x.fillRect(96, 300, 18, 148); x.fillRect(398, 300, 18, 148);
      ink(x, 5); x.strokeRect(96, 300, 18, 148); x.strokeRect(398, 300, 18, 148);
      wash(x, 40, 30, 432, 270, '#d4d0c6', 90);
      x.fillStyle = 'rgba(255,255,255,.45)';
      for (const [a, w] of [[80, 46], [150, 18], [300, 60], [380, 14]]) { x.beginPath(); x.moveTo(40 + a, 30); x.lineTo(40 + a + w, 30); x.lineTo(40 + a + w - 120, 300); x.lineTo(40 + a - 120, 300); x.closePath(); x.fill(); }
      x.fillStyle = '#121212'; x.fillRect(70, 58, 372, 62);
      for (let i = 0; i < 30; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 7 === 0 ? 'rgba(255,194,26,.55)' : '#2a2927'; x.fillRect(78 + i * 12, 64 + j * 13, 8, 9); }
      x.drawImage(hazard(432, 34, 22), 40, 266); ink(x, 5); x.strokeRect(40, 266, 432, 34);
      ink(x, 10); x.strokeRect(40, 30, 432, 270);
      x.strokeStyle = 'rgba(17,17,17,.6)'; x.lineWidth = 2;
      for (let i = 0; i < 3; i++) { let px = 300 + rnd(-40, 40), py = 150 + rnd(-30, 30); x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += rnd(-40, 40); py += rnd(-30, 30); x.lineTo(px, py); } x.stroke(); }
      return c;
    }

    return { asphalt, wall, truss, hazard, chevron, plate, glow, streak, shadow, ground, cable, tunnelPanel, truck, cart, hole, poster, graffiti, container, bolt, panel, MARK };
  })();

  /* ================= LED 점 글자: 계기판 · 전광판 · 화면 알림이 모두 같은 점으로 그린다 ================= */
  // 타이틀 레터링(LIVE WIRE RACER)이 사각 LED 칸으로 되어 있어서, 게임 안의 큰 글자도 같은 칸으로 만든다
  // 글꼴을 원래 픽셀 크기로 한 번 그리고(rasterGlyphs), 켜진 픽셀마다 LED 점 하나를 찍는다

  const LED = (() => {
    const cache = new Map();
    const scratch = document.createElement('canvas');
    const sctx = scratch.getContext('2d', { willReadFrequently: true });

    // 글자를 1비트 격자로: {w, h, bits}
    function raster(text, font, px, opts = {}) {
      const key = `${font}|${px}|${text}|${opts.bold ? 1 : 0}`;
      if (cache.has(key)) return cache.get(key);
      const f = `${opts.bold ? '700 ' : ''}${px}px ${font}`;
      sctx.font = f;
      const w = Math.max(1, Math.ceil(sctx.measureText(text).width) + 2);
      const h = Math.ceil(px * 1.3) + 2;
      scratch.width = w; scratch.height = h;
      sctx.font = f; sctx.textBaseline = 'top'; sctx.fillStyle = '#fff';
      sctx.clearRect(0, 0, w, h);
      sctx.fillText(text, 1, 1);
      const data = sctx.getImageData(0, 0, w, h).data;
      const bits = new Uint8Array(w * h);
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 120) {
          bits[y * w + x] = 1;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      let out;
      if (x1 < 0) out = { w: 1, h: 1, bits: new Uint8Array(1) };
      else {
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1, b = new Uint8Array(cw * ch);
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) b[y * cw + x] = bits[(y + y0) * w + x + x0];
        out = { w: cw, h: ch, bits: b, top: y0 };
      }
      if (cache.size > 600) cache.clear();
      cache.set(key, out);
      return out;
    }

    // 점 하나: 사각 LED. 가운데가 더 밝다(타이틀의 LED 칸과 같은 모양)
    function dot(ctx, x, y, s, col, hot) {
      const g = s * .14;
      ctx.fillStyle = col;
      ctx.fillRect(x + g, y + g, s - g * 2, s - g * 2);
      if (hot) {
        ctx.fillStyle = hot;
        const c = s * .3;
        ctx.fillRect(x + s / 2 - c / 2, y + s / 2 - c / 2, c, c);
      }
    }

    // 격자를 그린다. off: 꺼진 점도 그릴 색(계기판 · 전광판), shear: 기울임(타이틀처럼 앞으로)
    function draw(ctx, g, x, y, s, col, opts = {}) {
      const hot = opts.hot || null;
      for (let j = 0; j < g.h; j++) {
        const dx = opts.shear ? (g.h - j) * s * opts.shear : 0;
        for (let i = 0; i < g.w; i++) {
          if (g.bits[j * g.w + i]) dot(ctx, x + i * s + dx, y + j * s, s, col, hot);
          else if (opts.off) dot(ctx, x + i * s + dx, y + j * s, s, opts.off, null);
        }
      }
    }

    // 화면 알림용 큰 글자: 검은 계단 판 + 오른쪽 아래 검은 그림자 + LED 칸 + 기울임 (타이틀 레터링의 문법)
    const wordCache = new Map();
    function word(text, o = {}) {
      const key = `${text}|${o.color}|${o.cell}|${o.font}|${o.px}`;
      if (wordCache.has(key)) return wordCache.get(key);
      const g = raster(text, o.font || F_NUM, o.px || 8);
      const cell = o.cell || 9, pad = 2, shear = o.shear ?? .2, ext = 2;
      const gw = g.w + pad * 2 + ext, gh = g.h + pad * 2 + ext;
      const W = Math.ceil(gw * cell + gh * cell * shear) + 4, H = Math.ceil(gh * cell) + 4;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d');
      // 판: 글자 격자를 pad칸만큼 부풀린 계단 모양
      const plate = new Uint8Array(gw * gh);
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) {
        for (let dy = -pad; dy <= pad; dy++) for (let dx = -pad; dx <= pad; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > pad + 1) continue;
          const px = i + pad + dx, py = j + pad + dy;
          if (px >= 0 && py >= 0 && px < gw && py < gh) plate[py * gw + px] = 1;
        }
      }
      const sx = j => (gh - j) * cell * shear;
      c.fillStyle = '#000';
      for (let k = ext; k >= 0; k--) {               // 그림자 → 판
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (plate[j * gw + i]) {
          c.fillRect(2 + (i + k) * cell + sx(j + k), 2 + (j + k) * cell, cell + .6, cell + .6);
        }
      }
      const col = o.color || C.red, hot = o.hot || (o.color === C.yellow ? C.yellowHot : '#ff9a7a');
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) {
        dot(c, 2 + (i + pad) * cell + sx(j + pad), 2 + (j + pad) * cell, cell, col, hot);
      }
      if (wordCache.size > 80) wordCache.clear();
      wordCache.set(key, cv);
      return cv;
    }

    return { raster, draw, dot, word, clear: () => { cache.clear(); wordCache.clear(); } };
  })();

  /* ================= 굽이 · 오르내림: 세계를 정점 셰이더에서 휘게 한다 ================= */
  // 판정은 곧은 길에서 하고(physics.js), 화면에서만 길이 휘어 보인다.
  // 카메라 앞 거리 d마다 옆 · 위로 얼마나 밀지 표(BEND_N칸)를 매 프레임 만들고, 모든 재질이 같은 표를 읽는다
  const BEND_N = 64, BEND_D = 820;
  const BEND = {
    uBendX: { value: new Float32Array(BEND_N) },
    uBendY: { value: new Float32Array(BEND_N) },
    uBendD: { value: BEND_D },
    uDropZ: { value: 1e6 }      // 고가 붕괴: 이 z보다 뒤(카메라 뒤쪽 +z)의 정점은 아래로 떨어진다
  };
  let bendHeading = 0;   // 앞쪽 끝의 방향(먼 도시를 옆으로 미는 데 쓴다)

  // s: 내 위치. K · V는 1m 단위 곡률(course.js)
  function updateBend(course, s) {
    const step = 4, total = BEND_D, K = course.K, V = course.V, n = course.N;
    let hx = 0, hy = 0, x = 0, y = 0, d = 0, idx = 0;
    const X = BEND.uBendX.value, Y = BEND.uBendY.value, per = total / (BEND_N - 1);
    X[0] = 0; Y[0] = 0; idx = 1;
    while (idx < BEND_N) {
      const si = Math.min(n - 1, Math.max(0, Math.floor(s + d)));
      hx += K[si] * step; hy += V[si] * step;
      x += hx * step; y += hy * step;
      d += step;
      if (d >= idx * per) { X[idx] = x; Y[idx] = y; idx++; }
    }
    bendHeading = hx;
  }

  // 재질에 휘기를 붙인다. Three.js 기본 재질의 project_vertex를 바꿔 끼운다
  function bendable(mat) {
    if (mat.userData.bent) return mat;
    mat.userData.bent = true;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
      if (prev) prev(shader, r);
      shader.uniforms.uBendX = BEND.uBendX;
      shader.uniforms.uBendY = BEND.uBendY;
      shader.uniforms.uBendD = BEND.uBendD;
      shader.uniforms.uDropZ = BEND.uDropZ;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uBendX[${BEND_N}];
uniform float uBendY[${BEND_N}];
uniform float uBendD;
uniform float uDropZ;
vec3 lwrBend(vec3 w){
  if (w.z > uDropZ) { float k = w.z - uDropZ; w.y -= k * k * .045 + k * .5; w.x += sin(w.z * 1.9 + w.x) * k * .03; }
  float d = -w.z;
  if (d > 0.0) {
    float t = clamp(d / uBendD, 0.0, 1.0) * ${BEND_N - 1}.0;
    int i0 = int(floor(t)); int i1 = min(i0 + 1, ${BEND_N - 1});
    float f = t - float(i0);
    w.x += mix(uBendX[i0], uBendX[i1], f);
    w.y += mix(uBendY[i0], uBendY[i1], f);
    if (d > uBendD) { w.x += (uBendX[${BEND_N - 1}] - uBendX[${BEND_N - 2}]) / (uBendD / ${BEND_N - 1}.0) * (d - uBendD); }
  }
  return w;
}`)
        .replace('#include <project_vertex>', `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 lwrW = modelMatrix * mvPosition;
lwrW.xyz = lwrBend(lwrW.xyz);
mvPosition = viewMatrix * lwrW;
gl_Position = projectionMatrix * mvPosition;`);
    };
    // 프로그램 캐시 키: 기본값(onBeforeCompile 글자)은 모든 휘는 재질이 같아지므로, 원래 함수의 글자를 넣어 구분한다
    const tag = prev ? prev.toString() : '';
    mat.customProgramCacheKey = () => 'lwrbend|' + tag;
    return mat;
  }

  /* ================= 소리: 곡 · 엔진 · 바람 · 전류 · 효과음 ================= */
  // 곡 파일(BGM.src: audio/의 곡 파일)이 있으면 그 곡을, 없으면 같은 박자의 신스 음악을 직접 연주한다
  // IDIOTAPE의 소리(아날로그 신스 + 생 드럼, 가사 없이 끝까지 절정)를 따라: 킥 · 스네어 · 하이햇 · 톱니파 베이스 · 스탭 · 아르페지오
  // 곡에 하는 일은 네 가지뿐: 크기 · 먹먹함(필터) · 덕킹 · 층 쌓기(속도가 오를수록 악기가 늘어난다)

  const AUDIO = (() => {
    let ac = null, master, comp, musicBus, musicFilter, sfxBus, engBus, windBus, humBus, rumbleBus;
    let muted = false;
    try { muted = localStorage.getItem('lwr.muted') === '1'; } catch (e) {}
    let file = null, fileOk = false, fileReady = false;
    let noiseBuf = null;
    const spb = 60 / BGM.bpm;
    let startAt = 0, playing = false, useFile = false, nextStep = 0, step = 0, layer = 0, timer = null, gen = 0;
    let eng = null, wind = null, hum = null;

    function ensure() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .18;
      master = ac.createGain(); master.gain.value = muted ? 0 : MIX.master;
      master.connect(comp); comp.connect(ac.destination);
      musicFilter = ac.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000; musicFilter.Q.value = .7;
      musicBus = ac.createGain(); musicBus.gain.value = MIX.music;
      musicFilter.connect(musicBus); musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = MIX.sfx; sfxBus.connect(master);
      engBus = ac.createGain(); engBus.gain.value = 0; engBus.connect(master);
      windBus = ac.createGain(); windBus.gain.value = 0; windBus.connect(master);
      humBus = ac.createGain(); humBus.gain.value = 0; humBus.connect(master);
      rumbleBus = ac.createGain(); rumbleBus.gain.value = 0; rumbleBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      buildEngine(); buildWind(); buildHum(); buildRumble();
      wireFile();
      return true;
    }
    // 곡은 페이지가 열리자마자 불러 둔다. START를 누를 때 이미 준비돼 있도록
    function loadFile() {
      // 웹사이트(http)에서는 곡 파일을 그대로 불러온다 (base64로 넣은 dist/bgm.js 대신 — 6MB 스크립트 파싱이 없다)
      file = new Audio(); file.loop = true; file.preload = 'auto';
      file.addEventListener('canplaythrough', () => { fileReady = true; wireFile(); }, { once: true });
      file.src = BGM.src;
    }
    // 곡을 소리 그래프(먹먹함 · 덕킹)에 잇는다. 그사이 신스 음악으로 달리고 있었으면 바로 곡으로 넘어간다
    function wireFile() {
      if (!ac || !fileReady || fileOk) return;
      try { const src = ac.createMediaElementSource(file); const g = ac.createGain(); g.gain.value = BGM.volume / MIX.music; src.connect(g); g.connect(musicFilter); fileOk = true; } catch (e) { return; }
      if (playing && !useFile) playFile();
    }
    function playFile() { useFile = true; file.currentTime = 0; file.play().catch(() => {}); startAt = ac.currentTime - BGM.beat0; }

    /* ---------- 엔진 · 바람 · 전류 ---------- */
    function buildEngine() {
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), o3 = ac.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sawtooth';
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3;
      const ws = ac.createWaveShaper(); const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.6); } ws.curve = curve;
      const g1 = ac.createGain(), g2 = ac.createGain(), g3 = ac.createGain(); g1.gain.value = .5; g2.gain.value = .22; g3.gain.value = .18;
      o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(ws); g2.connect(ws); g3.connect(ws); ws.connect(lp); lp.connect(engBus);
      o1.start(); o2.start(); o3.start();
      eng = { o1, o2, o3, lp };
    }
    function buildWind() {
      const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = .6;
      n.connect(bp); bp.connect(windBus); n.start();
      wind = { bp };
    }
    function buildHum() {
      const a = ac.createOscillator(), b = ac.createOscillator(); a.type = 'sawtooth'; b.type = 'sine';
      a.frequency.value = 100; b.frequency.value = 50;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = 13; tg.gain.value = .35;
      const hg = ac.createGain(); hg.gain.value = .6;
      trem.connect(tg); tg.connect(hg.gain);
      a.connect(lp); b.connect(lp); lp.connect(hg); hg.connect(humBus);
      a.start(); b.start(); trem.start();
      hum = { a };
    }
    // 고가 붕괴 · 큰 구조물: 낮게 울리는 땅울림(크기는 매 프레임 rumble(0~1)로)
    function buildRumble() {
      const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 1.2;
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 38; const og = ac.createGain(); og.gain.value = .5;
      n.connect(lp); lp.connect(rumbleBus); o.connect(og); og.connect(rumbleBus); n.start(); o.start();
    }
    // 매 프레임: 회전수 · 속도 · 스로틀 · 전선 위 여부
    function drive(o) {
      if (!ac) return;
      const t = ac.currentTime, r = o.rpm, v = o.kmh;
      const f = 34 + r * 150 + (o.boost ? 18 : 0);
      eng.o1.frequency.setTargetAtTime(f, t, .03);
      eng.o2.frequency.setTargetAtTime(f * .5, t, .03);
      eng.o3.frequency.setTargetAtTime(f * 1.007 * 2, t, .03);
      eng.lp.frequency.setTargetAtTime(500 + r * 2400 * (o.throttle ? 1.25 : .9) + (o.boost ? 1800 : 0), t, .05);
      engBus.gain.setTargetAtTime(o.on ? MIX.engine * (.55 + r * .45) * (o.dead ? .4 : 1) : 0, t, .08);
      wind.bp.frequency.setTargetAtTime(300 + v * 6, t, .1);
      windBus.gain.setTargetAtTime(o.on ? MIX.wind * Math.min(1.2, Math.pow(v / 300, 2)) : 0, t, .15);
      humBus.gain.setTargetAtTime(o.on && (o.live || o.boost) ? MIX.hum * (o.boost ? 1.6 : o.rail ? 2.2 : 1) : 0, t, .06);
      hum.a.frequency.setTargetAtTime(o.boost ? 150 : o.rail ? 130 : 100, t, .1);
      rumbleBus.gain.setTargetAtTime(MIX.rumble * (o.rumble || 0), t, .12);
    }

    /* ---------- 효과음 부품 ---------- */
    function env(g, t, a, d, peak) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
    function tone(type, f0, f1, dur, vol, at = 0, dest = sfxBus) {
      if (!ac) return; const t = ac.currentTime + at;
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      env(g, t, .005, dur, vol); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
    }
    function noise(dur, vol, type = 'bandpass', f = 1200, q = 1, at = 0, f1 = null, dest = sfxBus) {
      if (!ac) return; const t = ac.currentTime + at;
      const n = ac.createBufferSource(); n.buffer = noiseBuf;
      const flt = ac.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = q;
      if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, .004, dur, vol);
      n.connect(flt); flt.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + dur + .05);
    }
    // 왼쪽 · 오른쪽으로 치우친 소리(지나치는 것 · 마주 오는 것)
    function panned(pan, fn) {
      if (!ac) return;
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
      if (!p) return fn(sfxBus);
      p.pan.value = clamp(pan, -1, 1); p.connect(sfxBus); fn(p);
      setTimeout(() => { try { p.disconnect(); } catch (e) {} }, 2500);
    }
    function duck(amount = .45, time = .5) {
      if (!ac) return; const t = ac.currentTime;
      musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(MIX.music * amount, t + .03); musicBus.gain.linearRampToValueAtTime(MIX.music, t + time);
    }
    function muffle(freq, time) {
      if (!ac) return; const t = ac.currentTime;
      musicFilter.frequency.cancelScheduledValues(t); musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, t);
      musicFilter.frequency.exponentialRampToValueAtTime(freq, t + .05);
      if (time) musicFilter.frequency.exponentialRampToValueAtTime(18000, t + time);
    }

    const SFX = {
      select() { tone('square', 660, 660, .07, .18); tone('square', 990, 990, .09, .16, .07); },
      lane(d) { noise(.16, .3, 'bandpass', d > 0 ? 900 : 700, 1.2, 0, 2600); },
      edge() { noise(.12, .35, 'lowpass', 400, 1); tone('square', 90, 60, .1, .2); },
      gate(chain) {
        const base = 220 * Math.pow(2, Math.min(chain, 8) / 12);
        tone('square', base, base, .09, .22); tone('square', base * 1.5, base * 1.5, .1, .2, .06); tone('sawtooth', base * 2, base * 2, .3, .16, .12);
        noise(.35, .32, 'highpass', 3000, .7, 0, 9000);
        tone('sine', 60, 40, .3, .5);
        duck(.6, .4);
      },
      miss() { tone('square', 180, 110, .22, .22); noise(.2, .15, 'lowpass', 600, 1); },
      crash() {
        noise(.6, .9, 'lowpass', 2600, .8, 0, 120); tone('sine', 110, 30, .5, .9); tone('square', 300, 60, .3, .25);
        for (let i = 0; i < 6; i++) noise(.05, .35, 'highpass', 4000 + Math.random() * 3000, 2, .05 + Math.random() * .25);
        duck(.15, 1.2); muffle(320, 1.4);
      },
      close(side) { noise(.22, .38, 'bandpass', 1800, 2.4, 0, 500); tone('square', 1320, 1320, .04, .1, .05); },
      smash() { noise(.3, .7, 'bandpass', 1500, .8, 0, 200); tone('square', 880, 220, .18, .25); },
      boost() { tone('sawtooth', 110, 880, .7, .35); tone('sawtooth', 112, 900, .7, .3); noise(.9, .45, 'bandpass', 400, .7, 0, 6000); tone('sine', 80, 36, .8, .7); duck(.35, .8); },
      boostEnd() { tone('sawtooth', 600, 120, .4, .18); },
      denied() { tone('square', 140, 140, .08, .18); tone('square', 110, 110, .1, .16, .09); },
      full() { tone('square', 880, 880, .06, .14); tone('square', 1175, 1175, .06, .14, .07); tone('square', 1760, 1760, .12, .14, .14); },
      shift(up) { if (up) noise(.08, .2, 'bandpass', 2000, 2); },
      finish() { [262, 330, 392, 523, 659].forEach((f, i) => tone('sawtooth', f, f, .9, .12, i * .08)); noise(1.4, .3, 'highpass', 2000, .5, 0, 12000); },
      blackout() { tone('sawtooth', 220, 30, 1.8, .4); noise(1.2, .4, 'lowpass', 1600, 1, 0, 60); muffle(160, 0); },
      egg() { noise(.5, .25, 'bandpass', 900, 1.5, 0, 3000); [392, 523, 659, 784].forEach((f, i) => tone('square', f, f, .14, .12, .2 + i * .09)); muffle(18000, 0); },
      ui() { tone('square', 520, 520, .05, .12); },
      // START → 시동과 출발: 짧은 스타터 + 회전수가 치솟으며 달려 나간다
      ignite() { noise(.25, .35, 'bandpass', 300, 1.4, 0, 900); tone('sawtooth', 60, 220, .5, .3, .12); tone('square', 30, 110, .5, .2, .12); noise(.9, .25, 'bandpass', 500, .8, .15, 3000); },
      // 사건 예고(알림 띠가 내려올 때): 두 음 차임
      alert(warn) { tone('square', warn ? 988 : 784, warn ? 988 : 784, .07, .12); tone('square', warn ? 740 : 1046, warn ? 740 : 1046, .1, .12, .08); },
      // 지나치는 철탑 · 가로등 · 화물차: 좌우로 치우친 짧은 바람 소리
      pass(side, k = 1) { panned(side * .8, d => noise(.14 + k * .05, .14 * k, 'bandpass', 1400 + k * 600, 1.2, 0, 300, d)); },
      scrape(side) { panned(side * .7, d => { noise(.35, .5, 'highpass', 2500, 1.5, 0, 7000, d); noise(.25, .3, 'bandpass', 900, 2, .05, 400, d); }); },
      horn(side) { panned(side * .6, d => { tone('square', 330, 330, .55, .14, 0, d); tone('square', 262, 262, .55, .12, 0, d); tone('square', 330, 300, .5, .12, .6, d); }); },
      blink(side) { panned(side * .5, d => tone('square', 1800, 1800, .03, .05, 0, d)); },
      thread() { [659, 880, 1175].forEach((f, i) => tone('square', f, f, .08, .14, i * .05)); },
      escaped() { [523, 784, 1046, 1568].forEach((f, i) => tone('square', f, f, .1, .15, i * .06)); noise(.6, .25, 'highpass', 3000, .7, 0, 9000); },
      rail() { tone('sawtooth', 90, 360, .5, .25); noise(.5, .3, 'bandpass', 600, 1, 0, 4000); },
      powerDown() { tone('sawtooth', 300, 40, 1.1, .3); noise(.3, .3, 'highpass', 4000, 2); for (let i = 0; i < 5; i++) noise(.04, .25, 'highpass', 5000, 2, .1 + Math.random() * .6); muffle(520, 0); },
      powerUp() { tone('sawtooth', 50, 420, .9, .25); tone('square', 100, 800, .7, .1, .1); noise(.8, .25, 'bandpass', 500, .8, 0, 6000); muffle(18000, .05); },
      tunnelIn() { noise(.5, .45, 'lowpass', 900, .8, 0, 120); tone('sine', 70, 40, .5, .5); },
      tunnelOut() { noise(.9, .5, 'bandpass', 500, .6, 0, 6000); },
      hole() { noise(.9, .7, 'lowpass', 1400, .8, 0, 80); tone('sine', 60, 25, .9, .7); for (let i = 0; i < 5; i++) noise(.08, .3, 'bandpass', 600 + Math.random() * 800, 2, .1 + Math.random() * .5); },
      crackle() { for (let i = 0; i < 7; i++) noise(.03, .28, 'highpass', 4000 + Math.random() * 3000, 2, i * .045 + Math.random() * .02); },
      zap() { noise(.35, .7, 'highpass', 2000, .8, 0, 9000); tone('square', 1600, 90, .25, .25); tone('sawtooth', 120, 60, .3, .3); duck(.6, .3); },
      creak() { tone('sawtooth', 70, 48, 1.2, .25); tone('square', 140, 90, .9, .08, .2); for (let i = 0; i < 4; i++) noise(.06, .4, 'bandpass', 2400, 3, .3 + i * .18); },
      slam() { noise(1.0, .9, 'lowpass', 2000, .7, 0, 60); tone('sine', 90, 28, .9, .9); for (let i = 0; i < 8; i++) noise(.06, .35, 'highpass', 3500 + Math.random() * 3000, 2, .05 + Math.random() * .4); duck(.3, .9); },
      // 과전류로 부수는 소리: 재질마다(콘크리트 · 바리케이드 · 쇠 · 유리 · 전기). 이어 부술수록 반음씩 높아진다
      smash(kind, chain = 1) {
        const up = Math.pow(2, Math.min(chain - 1, 6) / 12);
        tone('sine', 95 * up, 30, .38, .85);
        if (kind === 'concrete') { noise(.5, .85, 'lowpass', 1900 * up, .8, 0, 110); for (let i = 0; i < 6; i++) noise(.05, .32, 'bandpass', 900 + Math.random() * 1800, 3, .04 + Math.random() * .3); }
        else if (kind === 'barricade') { noise(.28, .75, 'bandpass', 1500 * up, 1.2, 0, 300); tone('square', 320 * up, 110, .12, .22); for (let i = 0; i < 5; i++) noise(.04, .3, 'bandpass', 2200 + Math.random() * 1500, 4, .05 + Math.random() * .3); }
        else if (kind === 'metal') { for (const f of [182, 271, 413, 617]) tone('square', f * up, f * up * .92, .3, .1); noise(.55, .85, 'lowpass', 2600, .8, 0, 90); }
        else if (kind === 'glass') { noise(.7, .7, 'highpass', 3400, .7, 0, 9000); for (let i = 0; i < 12; i++) { const f = 2200 + Math.random() * 3600; tone('sine', f, f, .05, .08, .02 + Math.random() * .45); } noise(.2, .4, 'lowpass', 900, 1); }
        else { noise(.4, .75, 'highpass', 2000, .8, 0, 9000); tone('square', 1700 * up, 90, .28, .25); for (let i = 0; i < 6; i++) noise(.03, .3, 'highpass', 5000, 2, i * .04 + Math.random() * .03); }
        duck(.5, .35);
      },
      // 공사 구간 방호벽 하나하나(줄지어 부술 때): 짧고 가볍게
      crunch(chain = 1) { noise(.14, .5, 'lowpass', 1500 + Math.min(chain, 12) * 60, .9, 0, 200); tone('sine', 80, 40, .12, .45); },
      cut() { tone('sawtooth', 500, 80, .35, .25); noise(.25, .4, 'highpass', 3000, 1); },
      ghost(side) { panned(side * .6, d => noise(.6, .18, 'bandpass', 700, 1, 0, 3500, d)); },
      tag() { noise(.4, .12, 'bandpass', 1800, 6, 0, 2200); }
    };

    /* ---------- 신스 음악(곡 파일이 없을 때) ---------- */
    // 128 BPM, 16분음표 단위. 마디 4개 반복: Am Am F G. 층(layer): 1 킥+베이스, 2 +스네어 · 햇, 3 +스탭, 4 +아르페지오(과전류)
    const ROOT = [45, 45, 41, 43];                 // MIDI: A2 A2 F2 G2
    const CH = [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    const BASS = [0, 12, 0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 7, 12];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); env(g, t, .002, .28, .95); o.connect(g); g.connect(musicFilter); o.start(t); o.stop(t + .35); }
    function snare(t) {
      const n = ac.createBufferSource(); n.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = .6;
      const g = ac.createGain(); env(g, t, .002, .17, .45); n.connect(f); f.connect(g); g.connect(musicFilter); n.start(t, Math.random()); n.stop(t + .25);
      const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + .08); env(og, t, .002, .1, .3); o.connect(og); og.connect(musicFilter); o.start(t); o.stop(t + .15);
    }
    function hat(t, open) { const n = ac.createBufferSource(); n.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7600; const g = ac.createGain(); env(g, t, .001, open ? .16 : .035, open ? .16 : .11); n.connect(f); f.connect(g); g.connect(musicFilter); n.start(t, Math.random()); n.stop(t + .25); }
    function bass(t, m, len) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 1.006;
      f.type = 'lowpass'; f.Q.value = 9; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(180, t + len * .9);
      env(g, t, .004, len, .32); o.connect(f); o2.connect(f); f.connect(g); g.connect(musicFilter); o.start(t); o2.start(t); o.stop(t + len + .05); o2.stop(t + len + .05);
    }
    function stab(t, notes) {
      for (const m of notes) for (const det of [1, 1.008]) {
        const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
        o.type = 'sawtooth'; o.frequency.value = mtof(m) * det; f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(600, t + .22);
        env(g, t, .003, .24, .07); o.connect(f); f.connect(g); g.connect(musicFilter); o.start(t); o.stop(t + .3);
      }
    }
    function arp(t, m) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = mtof(m); env(g, t, .002, .09, .07); o.connect(g); g.connect(musicFilter); o.start(t); o.stop(t + .12); }
    function schedule() {
      if (!playing || useFile) return;
      const ahead = .12;
      while (nextStep < ac.currentTime + ahead) {
        const s = step % 16, bar = Math.floor(step / 16) % 4, t = nextStep;
        if (layer >= 1) { if (s % 4 === 0) kick(t); bass(t, ROOT[bar] + BASS[s], spb / 4 * .9); }
        if (layer >= 2) { if (s === 4 || s === 12) snare(t); if (s % 2 === 0) hat(t, s % 8 === 6); }
        if (layer >= 3 && (s === 2 || s === 7 || s === 10)) stab(t, CH[bar]);
        if (layer >= 4) arp(t, CH[bar][s % 3] + 12 + (s % 6 === 0 ? 12 : 0));
        nextStep += spb / 4; step++;
      }
    }

    function startMusic() {
      if (!ensure()) return;
      gen++;
      musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setValueAtTime(MIX.music, ac.currentTime);
      playing = true; layer = Math.max(layer, 1); useFile = false;
      if (fileOk) playFile();
      else { step = 0; nextStep = ac.currentTime + .05; startAt = nextStep; if (!timer) timer = setInterval(schedule, 25); }
      musicFilter.frequency.cancelScheduledValues(ac.currentTime); musicFilter.frequency.setValueAtTime(700, ac.currentTime);
    }
    function openMusic() { if (ac) muffle(18000, 0); }
    // 결승 뒤: 곡이 먹먹해지며 time초 동안 잦아들고 멈춘다(그 사이 새로 시작하면 그대로 둔다)
    function fadeMusic(time) {
      if (!ac || !playing) return;
      const t = ac.currentTime, my = gen;
      musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(0, t + time);
      musicFilter.frequency.cancelScheduledValues(t); musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, t); musicFilter.frequency.exponentialRampToValueAtTime(380, t + time);
      setTimeout(() => { if (gen === my) stopMusic(); }, time * 1000 + 60);
    }
    function stopMusic() {
      playing = false; layer = 0;
      if (file) file.pause();
    }
    function setLayer(n) { layer = n; }
    loadFile();

    return {
      ensure, drive, SFX, startMusic, stopMusic, openMusic, fadeMusic, setLayer, duck, muffle,
      get ready() { return !!ac; },
      // 화면 박자: 음악이 돌면 음악 시계, 아니면 같은 bpm의 벽시계
      beat() {
        if (ac && playing) {
          const t = useFile ? file.currentTime - BGM.beat0 : ac.currentTime - startAt;
          return Math.max(0, t / spb);
        }
        return performance.now() / 1000 / spb;
      },
      toggleMute() {
        muted = !muted;
        try { localStorage.setItem('lwr.muted', muted ? '1' : '0'); } catch (e) {}
        if (ac) master.gain.setTargetAtTime(muted ? 0 : MIX.master, ac.currentTime, .05);
        return muted;
      },
      get muted() { return muted; },
      get hasFile() { return fileOk; }
    };
  })();

  /* ================= 3D 세계: 고가도로 · 전선 · 철탑 · 게이트 · 장애물 · 터널 · 변전소 ================= */
  // 플레이어는 늘 z = 0에 있고 세계가 다가온다. 물체는 코스 위치 s에 있고, 화면 z = -(s - 내 s)
  // 모든 재질은 bendable()로 굽이를 따른다. 그림 물체(철탑 · 장애물 · 구조물)는 카메라를 보는 판이다

  const WORLD = (() => {
    let scene, cam, rear, course, run;
    const T = {}, M = {};
    const ahead = 860, behind = 70;
    const zOf = s => -(s - run.s);
    let time = 0;

    const tex = (src, o = {}) => {
      const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
      t.anisotropy = o.aniso ?? 8;
      if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      if (o.wrapS) t.wrapS = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    };
    const basic = (o) => bendable(new THREE.MeshBasicMaterial(o));
    // 빛 번짐: 종이 위라 더하기(additive)로 그리면 분홍으로 바랜다. 보통 섞기로 색을 '칠한다'
    const glowMat = (col, op = 1) => basic({ map: T.glow, color: col, transparent: true, opacity: op, depthWrite: false, fog: false });
    const add = o => { o.frustumCulled = false; scene.add(o); return o; };

    /* ---------- 공용 재질 ---------- */
    function materials() {
      T.asphalt = tex(TEX.asphalt(), { repeat: true, aniso: 16 });
      T.wall = tex(TEX.wall(false), { repeat: true });
      T.wallT = tex(TEX.wall(true), { repeat: true });
      T.truss = tex(TEX.truss(), { wrapS: true });
      T.hazard = tex(TEX.hazard(), { repeat: true });
      T.chevron = tex(TEX.chevron());
      T.plate = tex(TEX.plate());
      T.glow = tex(TEX.glow());
      T.streak = tex(TEX.streak());
      T.shadow = tex(TEX.shadow());
      T.ground = tex(TEX.ground(), { repeat: true });
      T.cable = tex(TEX.cable(), { repeat: true });
      T.tunnel = tex(TEX.tunnelPanel(), { repeat: true });
      for (const k of ['pylon', 'citySky', 'cityFar', 'cityFarLit', 'cityNear', 'cityNearLit', 'portal', 'substation', 'car', 'barrier', 'barricade', 'coil', 'ind0', 'ind1', 'ind2', 'ind3', 'logo']) if (IMG[k]) T[k] = tex(IMG[k], { aniso: 4 });
      for (const k of ['cityFar', 'cityFarLit', 'cityNear', 'cityNearLit']) T[k].wrapS = THREE.RepeatWrapping;
      M.glowRed = glowMat(C.red); M.glowHot = glowMat(C.redHot); M.glowYellow = glowMat(C.yellow); M.glowWhite = glowMat('#ffffff');
      M.steel = basic({ color: '#2a2a28' });
      M.ink = basic({ color: '#141414' });
    }

    /* ---------- 도로 · 방호벽 · 땅 ---------- */
    let road, walls = [], rails = [], groundM;
    function buildRoad() {
      const L = ahead + behind + 40;
      const g = new THREE.PlaneGeometry(17.2, L, 1, Math.round(L / 4));
      g.rotateX(-Math.PI / 2); g.translate(0, 0, -(L / 2 - behind - 20));
      T.asphalt.repeat.set(1, L / 24);
      road = add(new THREE.Mesh(g, basic({ map: T.asphalt })));
      for (const side of [-1, 1]) {
        const wg = new THREE.PlaneGeometry(L, 1.0, Math.round(L / 4), 1);
        wg.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2);
        wg.translate(side * COURSE.roadHalf, .5, -(L / 2 - behind - 20));
        const map = T.wall.clone(); map.needsUpdate = true; map.repeat.set(L / 24, 1);
        const w = add(new THREE.Mesh(wg, basic({ map, side: THREE.DoubleSide })));
        w.userData.side = side; walls.push(w);
        const rg = new THREE.BoxGeometry(.24, .2, L, 1, 1, Math.round(L / 4));
        rg.translate(side * (COURSE.roadHalf + .02), 1.06, -(L / 2 - behind - 20));
        rails.push(add(new THREE.Mesh(rg, M.ink)));
        // 바깥 덱 가장자리(고가도로 옆면)
        const dg = new THREE.PlaneGeometry(L, 3.4, Math.round(L / 8), 1);
        dg.rotateY(side < 0 ? -Math.PI / 2 : Math.PI / 2);
        dg.translate(side * (COURSE.roadHalf + .4), -1.6, -(L / 2 - behind - 20));
        add(new THREE.Mesh(dg, basic({ color: '#2b2f37', side: THREE.DoubleSide })));
      }
      const gg = new THREE.PlaneGeometry(3200, 2200, 16, 22);
      gg.rotateX(-Math.PI / 2); gg.translate(0, -34, -900);
      T.ground.repeat.set(10, 7);
      groundM = add(new THREE.Mesh(gg, basic({ map: T.ground, depthWrite: false })));
      groundM.renderOrder = -13;   // 하늘 다음, 빌딩 겹 아래: 방호벽 너머는 빌딩 아랫부분이 채운다
    }

    /* ---------- 원경 도시: 하늘 · 먼 빌딩 · 가까운 빌딩 세 겹(피그마 '배경 수정사항' 그림). 굽이를 돌면 가까운 겹일수록 더 옆으로 미끄러진다
       빌딩 겹은 '꺼진 그림' 위에 '켜진 창문 · 간판 그림'을 덧그린다. 철탑을 켤 때마다 블록 단위로 차례차례 불이 들어온다 ---------- */
    const sky = [];
    let farLayer, cityLights, cityLightData = [], cityLit = 0;
    const CITY_U = { uLit: { value: 0 }, uTime: { value: 0 } };
    function cityMat(map, lit, cells, seed) {
      const m = new THREE.MeshBasicMaterial({ map, transparent: true, fog: false, depthWrite: false });
      if (lit) {
        const u = { tLit: { value: lit }, uCells: { value: new THREE.Vector2(cells[0], cells[1]) }, uSeed: { value: seed } };
        m.onBeforeCompile = sh => {
          Object.assign(sh.uniforms, u, CITY_U);
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform sampler2D tLit; uniform vec2 uCells; uniform float uSeed, uLit, uTime;')
            .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec4 lt = texture2D(tLit, vMapUv);
    vec2 cell = floor(vec2(fract(vMapUv.x) * uCells.x, vMapUv.y * uCells.y));
    float ord = .02 + .96 * fract(sin(dot(cell + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
    float on = smoothstep(ord - .05, ord, uLit);
    float fl = .88 + .12 * sin(uTime * (2.0 + ord * 6.0) + ord * 40.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, min(lt.rgb * 1.3, vec3(1.0)), clamp(lt.a * on * fl * 1.25, 0.0, 1.0));
    diffuseColor.a = max(diffuseColor.a, lt.a * on);
  }`);
        };
      }
      return basic(m);
    }
    function buildSkyline() {
      const ar = k => IMG[k].width / IMG[k].height;
      const layers = [
        { k: 'citySky', z: -2300, h: 4600, w: 11000, y: -700, sh: .04 },
        { k: 'cityFar', lit: 'cityFarLit', z: -1180, h: 1200, y: -150, sh: .12, cells: [40, 9], seed: 3.1 },
        { k: 'cityNear', lit: 'cityNearLit', z: -640, h: 520, y: -190, sh: .3, cells: [22, 6], seed: 7.7 }
      ];
      for (const l of layers) {
        l.w = l.w || l.h * ar(l.k); l.off = 0;
        const map = T[l.k].clone(); map.needsUpdate = true; map.wrapS = l.lit ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(l.w, l.h), cityMat(map, l.lit && T[l.lit], l.cells, l.seed));
        m.position.set(0, l.y + l.h / 2, l.z); m.renderOrder = sky.length ? -12 + sky.length : -14;
        m.userData = l; add(m); sky.push(m);
      }
      farLayer = sky[1];
      // 첨탑 꼭대기 자리를 먼 빌딩 그림에서 찾아 항공 경고등 자리로 쓴다(켠 철탑 수만큼 켜진다)
      const im = IMG.cityFar, cv = document.createElement('canvas'), w = 512, h = Math.round(512 * im.height / im.width);
      cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, w, h);
      const a = cx.getImageData(0, 0, w, h).data, pts = [];
      for (let x = 2; x < w - 2; x += 1) for (let y = 2; y < h * .7; y++) {
        if (a[(y * w + x) * 4 + 3] > 170) { if (a[((y - 3) * w + x) * 4 + 3] < 50) pts.push([x / w, y / h]); break; }
      }
      const R = mulberry(9);
      const n = Math.min(110, pts.length), geo = new THREE.PlaneGeometry(1, 1);
      cityLights = new THREE.InstancedMesh(geo, basic({ map: T.glow, color: '#ffffff', transparent: true, depthWrite: false, fog: false }), n);
      cityLights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      cityLights.renderOrder = -9;
      const col = new THREE.Color();
      for (let k = 0; k < n; k++) {
        const p = pts[Math.floor(R() * pts.length)];
        cityLightData.push({ u: p[0], v: p[1], on: .05 + R() * .95, size: 4 + R() * 7, ph: R() * 6.28, yellow: R() < .3 });
        col.set(cityLightData[k].yellow ? C.yellow : C.red); cityLights.setColorAt(k, col);
      }
      add(cityLights);
    }

    /* ---------- 철탑 줄(125m마다 양쪽) · 다시 이어진 전선 ---------- */
    const pylons = [], wires = [];
    const PY = { h: 30, w: 30 * 482 / 1100, x: 16.5, base: -7 };
    const lampLocal = [[0, .994], [-.39, .796], [.36, .796], [-.47, .56], [.47, .56]]; // (x/폭, y/높이)
    function buildPylons() {
      const mat = basic({ map: T.pylon, alphaTest: .45, side: THREE.DoubleSide });
      const geo = new THREE.PlaneGeometry(PY.w, PY.h); geo.translate(0, PY.h / 2, 0);
      for (let i = 0; i < 18; i++) {
        const g = new THREE.Group();
        const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; g.add(m);
        const lamps = [];
        for (const [lx, ly] of lampLocal) {
          const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.glowRed); q.frustumCulled = false;
          q.position.set(lx * PY.w, ly * PY.h, .3); q.scale.setScalar(5); q.visible = false; g.add(q); lamps.push(q);
        }
        g.userData = { lamps, s: null };
        add(g); pylons.push(g);
      }
      // 처진 전선 한 칸(125m): 같은 모양을 재사용
      const pts = [];
      for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 4.2, -t * COURSE.pylonEvery)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const core = new THREE.TubeGeometry(curve, 36, .07, 4, false);
      const halo = new THREE.TubeGeometry(curve, 36, .42, 5, false);
      const coreM = basic({ color: C.red }), haloM = basic({ color: C.red, transparent: true, opacity: .32, depthWrite: false });
      for (let i = 0; i < 40; i++) {
        const g = new THREE.Group();
        const a = new THREE.Mesh(core, coreM), b = new THREE.Mesh(halo, haloM);
        a.frustumCulled = b.frustumCulled = false; g.add(a, b); g.visible = false;
        add(g); wires.push(g);
      }
    }
    const rowAllowed = s => s >= 0 && !(s > course.tunnel.s0 - 30 && s < course.tunnel.s1 + 30) && s < course.length + 240;
    // 그 철탑 줄이 속한 게이트(그 게이트를 켜면 다음 게이트까지 켜진다)
    const spanGate = s => Math.floor((s - COURSE.gateFirst) / COURSE.gateEvery);
    const gateLitAt = [];
    function rowLit(s) {
      // 출발 화면: 철탑 줄의 불이 지평선 쪽으로 차례로 달려간다
      if (mode === 'attract') { const k = ((time * 2.4 - s / COURSE.pylonEvery) % 9 + 9) % 9; return k < 1.3 ? 1 : 0; }
      const gi = spanGate(s);
      if (gi < 0) return 0;
      if (gi >= course.gates.length) return finishGlow;
      if (run.gates[gi] !== 1) return 0;
      const t0 = gateLitAt[gi]; if (t0 == null) return 1;
      const delay = (s - course.gates[gi].s) / 1400;     // 켜짐이 지평선 쪽으로 달려간다
      return clamp((time - t0 - delay) / .12, 0, 1);
    }

    /* ---------- 게이트: 철탑 사이 트러스 + 차선 LED 표지 3개 + 접속판 + 바닥 셰브론 ---------- */
    const gatePool = [];
    function signCanvas() { const c = document.createElement('canvas'); c.width = 128; c.height = 56; return c; }
    function buildGates() {
      const trussM = basic({ map: T.truss, alphaTest: .4, side: THREE.DoubleSide, color: '#bdbab2' });
      const plateM = basic({ map: T.plate, transparent: true, depthWrite: false });
      const chevM = basic({ map: T.chevron, transparent: true, depthWrite: false, opacity: .95 });
      for (let i = 0; i < 4; i++) {
        const g = new THREE.Group();
        const beamT = T.truss.clone(); beamT.needsUpdate = true; beamT.repeat.set(4, 1);
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(34, 1.6), basic({ map: beamT, alphaTest: .4, side: THREE.DoubleSide, color: '#c4c0b6' }));
        beam.position.set(0, 10.4, 0); g.add(beam);
        const beam2 = beam.clone(); beam2.position.z = -1.2; g.add(beam2);
        const signs = [];
        COURSE.lanes.forEach((lx, li) => {
          const box = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.3, .4), M.steel); box.position.set(lx, 8.25, -.6); g.add(box);
          for (const rx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.4, .08), M.ink); rod.position.set(lx + rx * 1.1, 9.6, -.6); g.add(rod); }
          const cv = signCanvas(), t = tex(cv, { aniso: 4 });
          const face = new THREE.Mesh(new THREE.PlaneGeometry(2.62, 1.12), basic({ map: t }));
          face.position.set(lx, 8.25, -.39); g.add(face);
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), glowMat(C.yellow, 0)); glow.position.set(lx, 8.25, -.3); g.add(glow);
          signs.push({ cv, t, face, glow, key: '' });
        });
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), plateM); plate.rotation.x = -Math.PI / 2; plate.position.y = .03; g.add(plate);
        const chev = [];
        for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), chevM); c.rotation.x = -Math.PI / 2; c.position.set(0, .025, 28 + k * 20); g.add(c); chev.push(c); }
        g.traverse(o => { o.frustumCulled = false; });
        g.userData = { signs, plate, chev, gate: null, beam, beam2 };
        add(g); gatePool.push(g);
      }
    }
    function drawSign(sg, mode, n) {
      const key = mode + n + (mode === 'arrow' ? Math.floor(time * 4) % 4 : '');
      if (sg.key === key) return;
      sg.key = key;
      const c = sg.cv.getContext('2d');
      c.fillStyle = '#0d0d0d'; c.fillRect(0, 0, 128, 56);
      const s = 4, off = C.ledOff;
      const grid = { w: 32, h: 14, bits: new Uint8Array(32 * 14) };
      const put = (g, ox, oy) => { for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) { const x = ox + i, y = oy + j; if (x >= 0 && y >= 0 && x < 32 && y < 14) grid.bits[y * 32 + x] = 1; } };
      let col = C.yellow;
      if (mode === 'arrow') {
        // ▼ 화살표가 아래로 흐른다
        const ph = Math.floor(time * 4) % 4;
        for (let j = 0; j < 7; j++) for (let i = j; i < 13 - j; i++) { const y = j + 3 + (ph % 2); grid.bits[y * 32 + 9 + i] = 1; }
        put(LED.raster(n, F_NUM, 8), 23, 3);
      } else if (mode === 'on') { col = C.red; put(LED.raster('ON', F_NUM, 8), 8, 3); }
      else if (mode === 'miss') { col = C.grey2; put(LED.raster('MISS', F_PIX, 8, { bold: true }), 3, 4); }
      LED.draw(c, grid, 0, 0, s, col, { off, hot: mode === 'off' ? null : (col === C.red ? '#ff9a7a' : C.yellowHot) });
      sg.t.needsUpdate = true;
    }

    /* ---------- 전선(도로 위) ---------- */
    const cablePool = [], cableState = new Map();
    function cableMaterial() {
      const u = { uS: { value: 0 }, uA: { value: 0 }, uB: { value: -1 }, uP: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 } };
      const m = new THREE.MeshBasicMaterial({ map: T.cable });
      m.userData.u = u;
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vD;')
          .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vD = -(modelMatrix * vec4(transformed, 1.0)).z;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vD; uniform float uS,uA,uB,uP,uFade,uTime;')
          .replace('#include <fog_fragment>', `
  float sp = uS + vD;
  float lit = step(uA, sp) * step(sp, uB) * uFade;
  float band = .5 + .5 * sin((sp - uTime * 70.0) * 1.3);
  vec3 hot = mix(vec3(.898,.196,.176), vec3(1.0,.52,.32), band * .7);
  float head = smoothstep(uP - 9.0, uP, sp) * step(sp, uP + .5) * step(uP, uB + .5);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hot + head * vec3(.4,.35,.25), lit);
  #include <fog_fragment>`);
      };
      bendable(m);
      return m;
    }
    function glowStripMaterial(u) {
      const m = new THREE.MeshBasicMaterial({ map: T.streak, color: C.red, transparent: true, depthWrite: false, fog: false });
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vD;')
          .replace('#include <fog_vertex>', '#include <fog_vertex>\n  vD = -(modelMatrix * vec4(transformed, 1.0)).z;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vD; uniform float uS,uA,uB,uP,uFade,uTime;')
          .replace('#include <opaque_fragment>', `
  float sp = uS + vD;
  float lit = step(uA, sp) * step(sp, uB) * uFade;
  float far = 1.0 - smoothstep(250.0, 700.0, vD);
  diffuseColor.a *= lit * (.42 + .16 * sin(sp * .7 - uTime * 30.0)) * far;
  #include <opaque_fragment>`);
      };
      bendable(m);
      return m;
    }
    function buildCables() {
      const geo = new THREE.CylinderGeometry(.075, .075, 1, 6, 64, true);
      geo.rotateX(Math.PI / 2); geo.translate(0, .075, -.5);
      const sg = new THREE.PlaneGeometry(1.7, 1, 1, 64); sg.rotateX(-Math.PI / 2); sg.translate(0, .04, -.5);
      T.cable.repeat.set(1, 60);
      for (let i = 0; i < 36; i++) {
        const m = cableMaterial();
        const mesh = new THREE.Mesh(geo, m);
        const strip = new THREE.Mesh(sg, glowStripMaterial(m.userData.u));
        mesh.frustumCulled = strip.frustumCulled = false;
        strip.renderOrder = 2;
        scene.add(mesh, strip);
        cablePool.push({ mesh, strip, u: m.userData.u, c: null });
      }
    }
    // 전선마다 켜진 구간 [a, b]와 달려 나가는 머리 p. 게이트를 켠 급전선은 계속 켜져 있다(잔상)
    function updateCableState(dt) {
      const c = run.cable;
      if (c) {
        let st = cableState.get(c.id);
        if (!st || st.fade < .99 && !st.perm) { st = { a: run.s, b: run.s, p: run.s, fade: 1, perm: st ? st.perm : false }; cableState.set(c.id, st); }
        st.a = Math.min(st.a, Math.max(c.s0, run.s - 260));
        st.p = Math.min(c.s1, Math.max(st.p, run.s) + run.v * 2.6 * dt);
        st.b = Math.max(st.b, st.p); st.fade = 1;
      }
      for (const [id, st] of cableState) {
        if (c && id === c.id) continue;
        if (st.perm) { st.fade = 1; continue; }
        st.fade -= dt / 1.8;
        if (st.fade <= 0) cableState.delete(id);
      }
    }
    function markFeeder(gi) {
      for (const c of course.cables) if (c.gate === gi) {
        const st = cableState.get(c.id) || { a: c.s0, b: c.s1, p: c.s1, fade: 1 };
        st.perm = true; st.fade = 1;
        cableState.set(c.id, st);
      }
    }

    /* ---------- 장애물(그림 판 + 바닥 그늘) ---------- */
    // 부술 수 있는 것은 전류가 가득 차거나 과전류일 때 둘레가 붉게 맥박친다(빨강 = 내 전류가 닿을 수 있는 것). 부술 수 없는 것엔 아무 표시가 없다
    const obsPool = [];
    const OB = { car: 2.9, barrier: 3.0, barricade: 3.2, coil: 3.0, panel: 3.3 };   // 실제보다 조금 크게: 멀리서도 읽히도록
    const SRC = {}, RIM = {};
    // 그림의 실루엣을 조금 부풀려 붉게 칠한 판(둘레 빛)
    function rimTex(img) {
      const w = 256, h = Math.round(256 * img.height / img.width), pad = 14, cv = document.createElement('canvas');
      cv.width = w + pad * 2; cv.height = h + pad * 2;
      const x = cv.getContext('2d');
      for (let a = 0; a < 16; a++) x.drawImage(img, pad + Math.cos(a / 16 * 6.283) * 9, pad + Math.sin(a / 16 * 6.283) * 9, w, h);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = C.red; x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'destination-out'; x.drawImage(img, pad, pad, w, h);
      return { t: tex(cv, { aniso: 4 }), k: (w + pad * 2) / w };
    }
    function buildObstacles() {
      const shadowM = basic({ map: T.shadow, transparent: true, depthWrite: false, color: '#000000', opacity: .8 });
      const mats = {}, rims = {};
      for (const k of Object.keys(OB)) {
        mats[k] = basic({ map: T[k], alphaTest: .45, side: THREE.DoubleSide });
        RIM[k] = rimTex(SRC[k]);
        rims[k] = basic({ map: RIM[k].t, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
      }
      for (let i = 0; i < 26; i++) {
        const g = new THREE.Group();
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mats.car);
        const rim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), rims.car); rim.visible = false;
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowM); sh.rotation.x = -Math.PI / 2; sh.position.y = .02;
        const spark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.glowYellow); spark.visible = false;
        // 반사판: 터널 · 정전 속에서도 장애물이 보이도록(노랑 = 기계 신호)
        const refl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow, .9)); refl.visible = false;
        g.add(sh, rim, plane, spark, refl); g.traverse(o => { o.frustumCulled = false; });
        g.userData = { plane, rim, sh, spark, refl, o: null, mats, rims };
        add(g); obsPool.push(g);
      }
    }
    // 둘레 빛의 세기: 과전류면 강하게, 가득 찼으면 박자에 맞춰 약하게, 아니면 없음
    function armed() {
      if (mode !== 'race') return 0;
      if (run.boost > 0) return .75 + .25 * Math.sin(time * 16);
      if (run.full) { const b = 1 - (AUDIO.beat() % 1); return .25 + .35 * b * b; }
      return 0;
    }

    /* ---------- 부서짐: 그림을 여섯 조각(3×2)으로 잘라 날린다 · 통째로 날아가는 차 · 끊어진 전기 ---------- */
    // 조각은 부딪힌 힘에 밀려 나보다 조금 빨리 앞으로 튀었다가, 공기에 잡혀 느려지며 내 양옆으로 스쳐 지나간다
    const FR_N = 72, frags = [], fragGeo = [], fragMats = {};
    function buildFrags() {
      for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 3; cx++) {
        const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv, u0 = cx / 3, u1 = (cx + 1) / 3, v0 = cy / 2, v1 = (cy + 1) / 2;
        uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0); uv.needsUpdate = true;
        fragGeo.push(g);
      }
      for (const k of Object.keys(OB).concat(['cart'])) fragMats[k] = basic({ map: T[k], alphaTest: .4, side: THREE.DoubleSide });
      for (let i = 0; i < FR_N; i++) { const m = new THREE.Mesh(fragGeo[0], fragMats.barrier); m.visible = false; m.frustumCulled = false; m.userData = { life: 0 }; add(m); frags.push(m); }
    }
    let frI = 0;
    function breakApart(type, sAbs, x, w, h, power = 1) {
      for (let k = 0; k < 6; k++) {
        const m = frags[frI = (frI + 1) % FR_N], cx = k % 3, cy = Math.floor(k / 3), u = m.userData;
        m.geometry = fragGeo[k]; m.material = fragMats[type] || fragMats.barrier; m.visible = true;
        m.scale.set(w / 3 * (.9 + Math.random() * .2), h / 2, 1);
        // 내 앞길(카메라)을 정면으로 가로지르지 않게: 옆으로 벌어지고, 가운데 조각은 머리 위로 넘어간다
        const px = x + (cx - 1) * w / 3, away = Math.sign(px - run.x) || (k % 2 ? 1 : -1);
        Object.assign(u, {
          s: sAbs + 1, x: px, y: h * (cy + .5) / 2,
          vx: away * (4 + Math.random() * 8) * power, vy: (cx === 1 ? 7 + Math.random() * 5 : 3 + Math.random() * 6) * power,
          vs: run.v * (1.04 + Math.random() * .22), rz: (Math.random() - .5) * 18, ry: (Math.random() - .5) * 10, life: 1.6, max: 1.6
        });
        m.rotation.set(0, 0, 0);
      }
    }
    // 통째로 날아가는 것(버려진 차 · 정비차): 앞으로 내던져져 굴렀다 떨어진다
    const flyers = [];
    function buildFlyers() {
      for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fragMats.car); m.visible = false; m.frustumCulled = false; m.userData = { life: 0 }; add(m); flyers.push(m); }
    }
    let flI = 0;
    function fling(type, sAbs, x, w, h) {
      const m = flyers[flI = (flI + 1) % flyers.length], u = m.userData;
      m.geometry = new THREE.PlaneGeometry(1, 1); m.material = fragMats[type]; m.visible = true; m.scale.set(w, h, 1);
      const side = x === 0 ? (Math.random() < .5 ? -1 : 1) : Math.sign(x);
      Object.assign(u, { s: sAbs + 2, x, y: h / 2, vx: side * (3 + Math.random() * 3), vy: 9 + Math.random() * 3, vs: run.v * 1.22, rz: side * -(5 + Math.random() * 3), h, life: 2.6, bounced: 0 });
      m.rotation.set(0, 0, 0);
    }
    // 끊어진 전기: 바닥에서 하늘로 짧게 튀는 방전 줄기 둘
    const zaps = [];
    function buildZaps() {
      for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9), basic({ map: boltTex[i % boltTex.length], transparent: true, depthWrite: false, fog: false })); m.visible = false; m.frustumCulled = false; m.userData = { life: 0 }; add(m); zaps.push(m); }
    }
    function zap(sAbs, x) {
      for (const m of zaps) if (m.userData.life <= 0) { Object.assign(m.userData, { s: sAbs + 3, x, life: .28 }); m.visible = true; return; }
    }
    // 부서지는 순간: 재질마다 다르게
    function shatter(o) {
      const type = o.type === 'closure' ? 'barrier' : o.type, x = o.x ?? laneX(o.lane);
      if (type === 'cart') { fling('cart', o.s, x, 2.6, 1.95); breakApart('cart', o.s, x, 2.6, 1.95, .6); burst(o.s + 2, x, 1, 34, ['#ffffff', C.yellow, C.redHot], 11, .7, .7); return; }
      if (type === 'arc') { burst(o.s + 2, x, .6, 40, [C.red, C.redHot, C.yellow, '#ffffff'], 12, .6, .6); zap(o.s, x); return; }   // 과전류가 방전을 삼킨다
      const w = OB[type], h = w * SRC[type].height / SRC[type].width, jx = x + (o.id != null && typeof o.id === 'number' ? Math.sin(o.id * 12.9) * .25 : 0);
      if (type === 'car') { fling('car', o.s, jx, w, h); breakApart('car', o.s, jx, w * .7, h * .5, .7); burst(o.s + 2, jx, 1, 30, ['#ffffff', C.yellow, '#8a8a8a'], 10, .7, .6); return; }
      breakApart(type, o.s, jx, w, h, o.type === 'closure' ? .8 : 1.1);
      if (type === 'panel') for (let i = 0; i < 46; i++) spark(o.s + 1, jx + (Math.random() - .5) * w, .4 + Math.random() * h, (Math.random() - .5) * 14, 2 + Math.random() * 7, run.v * (1 + Math.random() * .2), .5 + Math.random() * .4, .14 + Math.random() * .2, Math.random() < .8 ? '#ffffff' : C.yellowHot);
      else if (type === 'coil') { zap(o.s, jx); burst(o.s + 2, jx, .6, 42, [C.yellow, '#ffffff', C.yellowHot], 13, .55, .55); }
      else burst(o.s + 2, jx, .8, 22, ['#8a8a8a', '#cfcabd', '#ffffff'], 8, .7, .8);
      for (let i = 0; i < (o.type === 'closure' ? 3 : 7); i++) throwChunk(o.s + 1, jx + (Math.random() - .5) * w, .4 + Math.random() * h, (Math.random() - .5) * 12, 3 + Math.random() * 6, run.v * (1.02 + Math.random() * .2), .2 + Math.random() * .35, 1.2);
    }
    function stepBreaks(dt) {
      for (const m of frags) {
        const u = m.userData;
        if (u.life <= 0) { m.visible = false; continue; }
        u.life -= dt; u.vy -= 18 * dt; u.vs -= u.vs * 1.6 * dt; u.x += u.vx * dt; u.y = Math.max(.1, u.y + u.vy * dt); u.s += u.vs * dt;
        m.rotation.z += u.rz * dt; m.rotation.y += u.ry * dt;
        m.position.set(u.x, u.y, zOf(u.s));
        if (u.s < run.s - 30) u.life = 0;
      }
      for (const m of flyers) {
        const u = m.userData;
        if (u.life <= 0) { m.visible = false; continue; }
        u.life -= dt; u.vy -= 20 * dt; u.x += u.vx * dt; u.y += u.vy * dt; u.s += u.vs * dt;
        if (u.y < u.h * .45 && u.vy < 0) {
          u.y = u.h * .45; u.vy = -u.vy * .32; u.vs *= .55; u.vx *= .7; u.rz *= -.6;
          if (u.bounced++ < 2) { burst(u.s, u.x, .3, 18, ['#ffffff', C.yellow, '#8a8a8a'], 7, .5, .5); for (let i = 0; i < 4; i++) throwChunk(u.s, u.x, .3, (Math.random() - .5) * 6, 2 + Math.random() * 4, u.vs * .8, .2 + Math.random() * .3, 1); }
        }
        u.vs -= u.vs * .6 * dt;
        m.rotation.z += u.rz * dt;
        m.position.set(u.x, u.y, zOf(u.s));
        if (u.s < run.s - 40) u.life = 0;
      }
      for (const m of zaps) {
        const u = m.userData;
        if (u.life <= 0) { m.visible = false; continue; }
        u.life -= dt; m.visible = Math.random() < .8;
        m.material.map = boltTex[Math.floor(time * 30) % boltTex.length];
        m.scale.set(Math.random() < .5 ? -1 : 1, 1, 1);
        u.s += run.v * dt * .98;
        m.position.set(u.x + (Math.random() - .5) * .6, 4.5, zOf(u.s));
      }
    }

    /* ---------- 길가 가로등: 전류가 지나가면 노랗게 켜진다 ---------- */
    let lampHeads, lampGlows, lampPoles;
    const LAMP_N = 46, LAMP_EVERY = 40;
    function buildLamps() {
      const poleG = new THREE.BoxGeometry(.18, 9.6, .18); poleG.translate(0, 4.8, 0);
      lampPoles = new THREE.InstancedMesh(poleG, M.ink, LAMP_N);
      const armG = new THREE.BoxGeometry(2.3, .14, .14); armG.translate(-1.15, 9.5, 0);
      const headG = new THREE.BoxGeometry(.9, .22, .42);
      lampHeads = new THREE.InstancedMesh(headG, basic({ color: '#ffffff' }), LAMP_N);
      lampGlows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), M.glowYellow, LAMP_N);
      const arms = new THREE.InstancedMesh(armG, M.ink, LAMP_N);
      for (const m of [lampPoles, lampHeads, lampGlows, arms]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); add(m); }
      lampPoles.userData.arms = arms;
      const c = new THREE.Color(C.grey3);
      for (let i = 0; i < LAMP_N; i++) lampHeads.setColorAt(i, c);
    }

    /* ---------- 전광판(경고 문구가 붉게 흐른다) ---------- */
    const boardPool = [];
    function buildBoards() {
      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group();
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
        const t = tex(cv, { aniso: 4 });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.95), basic({ map: t }));
        panel.position.set(0, 7.6, .26);
        const box = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, .5), M.steel); box.position.set(0, 7.6, 0);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), glowMat(C.red, 0)); glow.position.set(0, 7.6, .4);
        const beamT = T.truss.clone(); beamT.needsUpdate = true; beamT.repeat.set(3, 1);
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(17, 1.3), basic({ map: beamT, alphaTest: .4, side: THREE.DoubleSide, color: '#c4c0b6' }));
        beam.position.set(0, 9.3, 0);
        const posts = [];
        for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.5, 10, .5), M.steel); p.position.set(sx * 8.5, 5, 0); posts.push(p); g.add(p); }
        g.add(box, panel, glow, beam);
        g.traverse(o => { o.frustumCulled = false; });
        g.userData = { cv, t, panel, glow, posts, beam, b: null, boot: 0, key: '' };
        add(g); boardPool.push(g);
      }
    }
    function drawBoard(u, b, on) {
      const c = u.cv.getContext('2d'), cell = 4, cols = 128, rows = 24;
      let key = 'off';
      let g = null, scroll = 0, col = C.red;
      if (on) {
        if (b.kind === 'start') {
          const m = startBoardText();
          col = m.col; g = LED.raster(m.text, m.font, m.px); key = m.text;
        } else {
          const idx = Math.floor(time / 2.6) % b.msg.length;
          const txt = b.msg[idx];
          g = LED.raster(txt, F_KOPIX, 12);
          if (g.w > cols - 4) { scroll = Math.floor((time * 26) % (g.w + cols)); key = txt + scroll; } else key = txt;
        }
        if (u.boot > 0 && Math.random() < .4) { key += 'b'; g = null; }
      }
      if (u.key === key) return;
      u.key = key;
      c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, 512, 96);
      const grid = { w: cols, h: rows, bits: new Uint8Array(cols * rows) };
      if (g) {
        const ox = scroll ? cols - scroll : Math.floor((cols - g.w) / 2), oy = Math.floor((rows - g.h) / 2);
        for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) { const x = ox + i, y = oy + j; if (x >= 0 && x < cols && y >= 0 && y < rows) grid.bits[y * cols + x] = 1; }
      }
      LED.draw(c, grid, 0, 0, cell, col, { off: '#222120', hot: col === C.red ? '#ff8a6a' : C.yellowHot });
      u.t.needsUpdate = true;
    }
    let startBoardText = () => ({ text: 'TRACK 03', font: F_NUM, px: 8, col: C.red });

    /* ---------- 터널 ---------- */
    let tunnel;
    let tunnelLamps, tunnelGlows;
    const TL_EVERY = 6;
    function buildTunnel() {
      const len = course.tunnel.s1 - course.tunnel.s0, g = new THREE.Group(), H = 10;
      const wallT = T.tunnel.clone(); wallT.needsUpdate = true; wallT.repeat.set(len / 9, 1.4);
      for (const side of [-1, 1]) {
        const wg = new THREE.PlaneGeometry(len, H, Math.round(len / 6), 1);
        wg.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2); wg.translate(side * (COURSE.roadHalf + .05), H / 2, -len / 2);
        g.add(new THREE.Mesh(wg, basic({ map: wallT, side: THREE.DoubleSide, color: '#7d7970' })));
        const hz = T.hazard.clone(); hz.needsUpdate = true; hz.repeat.set(len / 2.2, 1);
        const hg = new THREE.PlaneGeometry(len, .9, Math.round(len / 6), 1);
        hg.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2); hg.translate(side * (COURSE.roadHalf - .02), 1.7, -len / 2);
        g.add(new THREE.Mesh(hg, basic({ map: hz, side: THREE.DoubleSide })));
      }
      const ceilT = T.tunnel.clone(); ceilT.needsUpdate = true; ceilT.repeat.set(2, len / 9);
      const cg = new THREE.PlaneGeometry(COURSE.roadHalf * 2 + .2, len, 1, Math.round(len / 6));
      cg.rotateX(Math.PI / 2); cg.translate(0, H, -len / 2);
      g.add(new THREE.Mesh(cg, basic({ map: ceilT, side: THREE.DoubleSide, color: '#5c5952' })));
      // 갈비뼈 프레임
      const ribs = Math.floor(len / 12);
      const postG = new THREE.BoxGeometry(.7, H, .7), topG = new THREE.BoxGeometry(COURSE.roadHalf * 2, .8, .7);
      const rp = new THREE.InstancedMesh(postG, M.ink, ribs * 2), rt = new THREE.InstancedMesh(topG, basic({ color: '#2b2a27' }), ribs);
      const mx = new THREE.Matrix4();
      for (let i = 0; i < ribs; i++) {
        mx.makeTranslation(-COURSE.roadHalf + .2, H / 2, -i * 12); rp.setMatrixAt(i * 2, mx);
        mx.makeTranslation(COURSE.roadHalf - .2, H / 2, -i * 12); rp.setMatrixAt(i * 2 + 1, mx);
        mx.makeTranslation(0, H - .4, -i * 12); rt.setMatrixAt(i, mx);
      }
      g.add(rp, rt);
      // 천장 등: 두 줄. 전류가 지나가면 노랗게 켜졌다 꺼진다(빛줄기)
      const n = Math.floor(len / TL_EVERY) * 2;
      tunnelLamps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, .16, .5), basic({ color: '#ffffff' }), n);
      tunnelGlows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), M.glowYellow, n);
      tunnelGlows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const c = new THREE.Color(C.grey3);
      for (let i = 0; i < n; i++) {
        const z = -Math.floor(i / 2) * TL_EVERY, x = (i % 2 ? 3.4 : -3.4);
        mx.makeTranslation(x, H - .1, z); tunnelLamps.setMatrixAt(i, mx); tunnelLamps.setColorAt(i, c);
        mx.makeScale(0, 0, 0); tunnelGlows.setMatrixAt(i, mx);
      }
      g.add(tunnelLamps, tunnelGlows);
      // 입구 · 출구(구멍을 뚫은 그림 판). 구멍이 도로 폭과 터널 높이에 맞도록 크기를 정했다
      const pw = (COURSE.roadHalf * 2 + .2) / .546, ph = pw * IMG.portal.height / IMG.portal.width;
      const pm = basic({ map: T.portal, color: '#a2a8b4', alphaTest: .4, side: THREE.DoubleSide });
      for (const z of [0, -len]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), pm);
        p.position.set(0, -ph * .018 + ph / 2 - .3, z + .2); g.add(p);
      }
      g.traverse(o => { o.frustumCulled = false; if (o.material && !o.material.userData.bent) { bendable(o.material); o.material.userData.bent = true; } });
      g.userData = { len, n };
      add(g); tunnel = g;
    }

    /* ---------- 정유 단지 구조물 · 변전소 · IDIOTAPE 전광탑 ---------- */
    const scenePool = [];
    function buildScenery() {
      const mats = [0, 1, 2, 3].map(k => basic({ map: T['ind' + k], color: '#a2a8b4', alphaTest: .45, side: THREE.DoubleSide }));
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mats[0]);
        m.userData = { mats, item: null }; m.visible = false; add(m); scenePool.push(m);
      }
    }
    let sub, subLights = [], subRing, subLogo, eggScreen;
    function buildFinale() {
      const w = 160, h = w * IMG.substation.height / IMG.substation.width;
      sub = new THREE.Group();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic({ map: T.substation, alphaTest: .35, fog: false, transparent: true, side: THREE.DoubleSide }));
      m.position.y = -16 + h / 2; sub.add(m);
      // 그림에서 철탑 · 기둥 꼭대기를 찾아 불빛 자리로 쓴다(위가 비어 있고 바로 아래가 그림인 점 중 둘레보다 높은 곳)
      const tips = [];
      {
        const im = IMG.substation, cw = 400, ch = Math.round(400 * im.height / im.width);
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cw, ch);
        const a = cx.getImageData(0, 0, cw, ch).data, top = new Array(cw).fill(ch);
        for (let x = 0; x < cw; x++) for (let y = 0; y < ch * .85; y++) if (a[(y * cw + x) * 4 + 3] > 140) { top[x] = y; break; }
        for (let x = 3; x < cw - 3; x++) {
          const t = top[x];
          if (t >= ch * .85) continue;
          let peak = true;
          for (let k = -3; k <= 3; k++) if (k && top[x + k] < t) { peak = false; break; }
          if (peak && (!tips.length || x - tips[tips.length - 1][2] > 4)) tips.push([x / cw, t / ch, x]);
        }
      }
      tips.sort((p, q) => Math.abs(p[0] - .5) - Math.abs(q[0] - .5));   // 가운데부터 바깥으로 켜진다
      for (const [u, v] of tips.slice(0, 48)) {
        const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.glowRed); q.position.set((u - .5) * w, -16 + h * (1 - v), 1); q.scale.setScalar(7); q.visible = false; sub.add(q); subLights.push(q);
      }
      subRing = new THREE.Mesh(new THREE.RingGeometry(9.6, 12.2, 64), basic({ color: C.red, transparent: true, depthWrite: false, fog: false }));
      subRing.position.set(0, -16 + h * (1 - .33), 1.2); subRing.visible = false; sub.add(subRing);
      if (T.logo) {
        subLogo = new THREE.Mesh(new THREE.PlaneGeometry(17, 17 * 277 / 1520), basic({ map: T.logo, transparent: true, fog: false, depthWrite: false }));
        subLogo.position.set(0, -16 + h * (1 - .33), 1.4); subLogo.visible = false; sub.add(subLogo);
      }
      sub.traverse(o => { o.frustumCulled = false; });
      add(sub);
      // IDIOTAPE 전광탑: 평소엔 경고 문구, 조건을 채우면 공연
      const cv = document.createElement('canvas'); cv.width = 384; cv.height = 216;
      const t = tex(cv, { aniso: 4 });
      eggScreen = new THREE.Group();
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(17, 9.56), basic({ map: t }));
      const frame = new THREE.Mesh(new THREE.BoxGeometry(18, 10.6, .6), M.steel); frame.position.z = -.35;
      const legs = [-6, 6].map(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(.6, 22, .6), M.steel); l.position.set(x, -11 - 5.3, -.4); return l; });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(40, 22), glowMat(C.red, 0)); glow.position.z = .5;
      eggScreen.add(frame, scr, glow, ...legs);
      eggScreen.traverse(o => { o.frustumCulled = false; });
      eggScreen.userData = { cv, t, glow, key: '' };
      add(eggScreen);
    }

    /* ---------- 불꽃 입자 ---------- */
    let sparks; const SP_N = 220, sp = [];
    function buildSparks() {
      sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), basic({ map: T.glow, color: '#ffffff', transparent: true, depthWrite: false, fog: false }), SP_N);
      sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const c = new THREE.Color(C.yellow);
      for (let i = 0; i < SP_N; i++) { sp.push({ life: 0 }); sparks.setColorAt(i, c); }
      add(sparks);
    }
    let spI = 0;
    function spark(s, x, y, vx, vy, vs, life, size, col) {
      const p = sp[spI = (spI + 1) % SP_N];
      Object.assign(p, { s, x, y, vx, vy, vs, life, max: life, size, col });
      sparks.setColorAt(spI, new THREE.Color(col));
      sparks.instanceColor.needsUpdate = true;
    }
    function burst(s, x, y, n, cols, spd = 8, life = .6, size = .5) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = spd * (.3 + Math.random());
        spark(s, x, y, Math.cos(a) * v, Math.abs(Math.sin(a)) * v * .9 + 1, (Math.random() - .3) * v, life * (.5 + Math.random()), size * (.5 + Math.random()), cols[i % cols.length]);
      }
    }

    /* ================= 사건 그림: 막힌 차선 · 무너진 차선 · 분리대 · 화물차 · 크레인 · 방전 · 갠트리 붕괴 ================= */
    const tta = s => (s - run.s) / Math.max(8, run.v);   // 도착까지 몇 초(예고 연출은 거리 대신 시간으로 맞춘다)
    const fxq = [];                                       // 세계가 update.js에 알리는 순간(흔들림 · 소리)
    const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; return add(m); };

    /* ---------- 막힌 차선: 방호벽 판 9m마다 + 위 경광등(앞으로 차례로 깜빡) + 시작점의 LED 화살표 판(열린 차선 쪽) ---------- */
    let closureMesh, closureLamps;
    const CL_N = 160, CL_EVERY = 9, arrowPool = [], openDir = new Map();
    function buildClosures() {
      const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, .5, 0);
      closureMesh = inst(geo, basic({ map: T.barrier, alphaTest: .45, side: THREE.DoubleSide }), CL_N);
      closureLamps = inst(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow), CL_N);
      for (let i = 0; i < 6; i++) {
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48;
        const t = tex(cv, { aniso: 4 }), g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.7, .3), M.steel); box.position.set(0, 2.5, -.2);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), basic({ map: t, fog: false })); panel.position.set(0, 2.5, -.04);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.7, .18), M.ink); leg.position.set(0, .85, -.2);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6), glowMat(C.yellow, .28)); glow.position.set(0, 2.5, .05);
        g.add(box, leg, panel, glow); g.traverse(o => { o.frustumCulled = false; });
        g.userData = { cv, t, key: '' }; add(g); arrowPool.push(g);
      }
    }
    // 같은 자리에서 시작하는 막힘끼리 묶어, 막힌 차선마다 가장 가까운 열린 차선 쪽(-1 왼쪽 · +1 오른쪽)
    function closureDirs() {
      openDir.clear();
      for (const sp of course.spans) {
        if (sp.kind !== 'closure') continue;
        const shut = new Set(course.spans.filter(k => k.kind === 'closure' && k.s0 === sp.s0).map(k => k.lane));
        const open = [0, 1, 2].filter(l => !shut.has(l)).sort((a, b) => Math.abs(a - sp.lane) - Math.abs(b - sp.lane))[0];
        openDir.set(sp.id, Math.sign(open - sp.lane) || 1);
      }
    }
    function drawArrow(u, dir) {
      const ph = Math.floor(time * 6) % 4, key = dir + ':' + ph;
      if (u.key === key) return;
      u.key = key;
      const c = u.cv.getContext('2d'); c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, 96, 48);
      const grid = { w: 24, h: 12, bits: new Uint8Array(24 * 12) };
      for (let k = 0; k < 3; k++) {
        if (k === 3 - ph) continue;            // 화살표 셋 중 하나씩 꺼지며 열린 쪽으로 흐른다
        const ox = dir > 0 ? 2 + k * 7 : 21 - k * 7;
        for (let j = 0; j < 9; j++) { const w = 4 - Math.abs(j - 4); for (let i = 0; i <= w; i++) { const xx = dir > 0 ? ox + i : ox - i; if (xx >= 0 && xx < 24) grid.bits[(j + 1) * 24 + xx] = 1; } }
      }
      LED.draw(c, grid, 0, 0, 4, C.yellow, { off: '#222120', hot: C.yellowHot });
      u.t.needsUpdate = true;
    }

    let closureRim;
    function buildClosureRim() {
      const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, .5, 0);
      closureRim = inst(geo, basic({ map: RIM.barrier.t, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }), CL_N);
    }

    /* ---------- 무너진 차선: 멀리선 금 하나, 도착 2.3초 전에 쩍 벌어진다 ---------- */
    const holePool = [];
    function buildHoles() {
      const m = basic({ map: T.hole, transparent: true, depthWrite: false });
      for (let i = 0; i < 2; i++) {
        const h = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 10), m);
        h.rotation.x = -Math.PI / 2; h.position.y = .05; h.frustumCulled = false; h.renderOrder = 1; h.userData = { open: 0 };
        add(h); holePool.push(h);
      }
    }

    /* ---------- 분리대: 차선 경계를 따라 놓인 낮은 콘크리트 벽 + 노랑-검정 머리 + 반사판 ---------- */
    let divider, divRefl;
    function buildDivider() {
      divider = new THREE.Group();
      const map = T.wall.clone(); map.needsUpdate = true; map.wrapS = map.wrapT = THREE.RepeatWrapping;
      const bg = new THREE.BoxGeometry(.75, 1.1, 1, 1, 1, 90); bg.translate(0, .55, -.5);
      const body = new THREE.Mesh(bg, basic({ map }));
      const cg = new THREE.BoxGeometry(.9, .14, 1, 1, 1, 90); cg.translate(0, 1.16, -.5);
      const cap = new THREE.Mesh(cg, M.ink);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.45, 2.6), basic({ map: T.hazard })); nose.position.set(0, .72, .9);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.2), glowMat(C.yellow, .5)); glow.position.set(0, 1.9, 2.3);
      divider.add(body, cap, nose, glow); divider.traverse(o => { o.frustumCulled = false; });
      divider.userData = { body, cap, nose, glow, map };
      add(divider);
      divRefl = inst(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow, .9), 60);
    }

    /* ---------- 화물차(뒤 LED 판: 차선을 바꾸기 전 화살표) · 정비차(전조등 · 바닥 빛) ---------- */
    const moverPool = [];
    let cartRim, cartRimK = 1;
    function buildMovers() {
      { const r = rimTex(SRC.cart); cartRimK = r.k; cartRim = basic({ map: r.t, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }); }
      const shadowM = basic({ map: T.shadow, transparent: true, depthWrite: false, color: '#000000', opacity: .8 });
      const mats = { truck: basic({ map: T.truck, alphaTest: .4, side: THREE.DoubleSide }), cart: basic({ map: T.cart, alphaTest: .4, side: THREE.DoubleSide }) };
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mats.truck);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowM); sh.rotation.x = -Math.PI / 2; sh.position.y = .03;
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 36;
        const t = tex(cv, { aniso: 4 });
        const led = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic({ map: t, fog: false }));
        const lampA = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow)), lampB = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow));
        const beacon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.amber));
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#fff3d6', .55)); pool.rotation.x = -Math.PI / 2; pool.position.y = .05;
        const rim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cartRim); rim.visible = false;
        g.add(sh, pool, rim, body, led, lampA, lampB, beacon); g.traverse(o => { o.frustumCulled = false; });
        g.userData = { body, rim, sh, led, cv, t, lampA, lampB, beacon, pool, mats, key: '', kind: '' };
        add(g); moverPool.push(g);
      }
    }
    function drawTruckLed(u, mode) {
      const ph = Math.floor(time * 5) % 2, key = mode + ph;
      if (u.key === key) return;
      u.key = key;
      const c = u.cv.getContext('2d'); c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, 96, 36);
      const grid = { w: 24, h: 9, bits: new Uint8Array(24 * 9) };
      if (!mode) { for (let i = 2; i < 22; i++) if (i < 9 || i > 14) { grid.bits[3 * 24 + i] = 1; grid.bits[5 * 24 + i] = 1; } }
      else if (ph) for (let k = 0; k < 3; k++) for (let j = 0; j < 9; j++) {
        const w = 3 - Math.abs(j - 4) * .75, ox = mode > 0 ? 3 + k * 7 : 20 - k * 7;
        for (let i = 0; i <= w; i++) { const xx = mode > 0 ? ox + i : ox - i; if (xx >= 0 && xx < 24) grid.bits[j * 24 + xx] = 1; }
      }
      LED.draw(c, grid, 0, 0, 4, C.yellow, { off: '#222120', hot: C.yellowHot });
      u.t.needsUpdate = true;
    }

    /* ---------- 갠트리 크레인: 길을 가로지르는 크레인이 컨테이너를 차선마다 옮긴다 ---------- */
    let crane;
    function buildCrane() {
      const g = new THREE.Group(), legM = basic({ color: '#2b2a27' });
      for (const sx of [-1, 1]) for (const sz of [-1.6, 1.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.7, 17.4, .7), legM); l.position.set(sx * 11, 8.7, sz); g.add(l); }
      const bt = T.truss.clone(); bt.needsUpdate = true; bt.repeat.set(3, 1);
      for (const sz of [-1.6, 1.6]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(24, 1.8), basic({ map: bt, alphaTest: .4, side: THREE.DoubleSide, color: '#c4c0b6' })); b.position.set(0, 16.5, sz); g.add(b); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(24, .3, 3.6), M.steel); top.position.y = 17.5; g.add(top);
      const hz = new THREE.Mesh(new THREE.PlaneGeometry(22, .5), basic({ map: T.hazard })); hz.position.set(0, 15.4, 1.62); g.add(hz);
      const trolley = new THREE.Group();
      const tb = new THREE.Mesh(new THREE.BoxGeometry(3, 1.3, 3.8), basic({ color: '#3a3936' })); tb.position.y = 15.5; trolley.add(tb);
      const beacon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.amber)); beacon.position.set(0, 16.6, 2.1); trolley.add(beacon);
      for (const cx of [-.8, .8]) { const k = new THREE.Mesh(new THREE.BoxGeometry(.08, 11.3, .08), M.ink); k.position.set(cx, 9.4, 0); trolley.add(k); }
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.6, 5.6), basic({ map: T.container })); box.position.y = 2.6; trolley.add(box);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), basic({ map: T.shadow, transparent: true, depthWrite: false, color: '#000000', opacity: .75 })); sh.rotation.x = -Math.PI / 2; sh.position.y = .03; trolley.add(sh);
      g.add(trolley); g.traverse(o => { o.frustumCulled = false; });
      g.userData = { trolley, beacon, box, lastX: 0 };
      add(g); crane = g;
    }

    /* ---------- 방전: 길 위를 가로지르는 전선. 도착 1.5초 전 바닥이 노랗게 끓고, 0.7초 전에 줄기가 떨어진다 ---------- */
    const arcPool = [], boltTex = [];
    function buildArcs() {
      for (let k = 0; k < 4; k++) boltTex.push(tex(TEX.bolt(k), { aniso: 2 }));
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group();
        const boltM = basic({ map: boltTex[0], transparent: true, depthWrite: false, fog: false });
        const bolt = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 12.6), boltM); bolt.position.y = 6.3;
        const disk = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow)); disk.rotation.x = -Math.PI / 2; disk.position.y = .07;
        const core = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat('#ffffff')); core.position.y = .7;
        const top = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow)); top.position.y = 12.5;
        const wire = new THREE.Mesh(new THREE.BoxGeometry(33, .12, .12), M.ink); wire.position.y = 12.6;
        g.add(wire, disk, bolt, core, top); g.traverse(o => { o.frustumCulled = false; });
        g.userData = { bolt, disk, core, top, wire, boltM, o: null, warned: false, fired: false };
        add(g); arcPool.push(g);
      }
    }

    /* ---------- 갠트리 붕괴: 기둥이 꺾이고 보가 무너져 두 차선을 막는다. 열린 차선 위엔 매달린 보 ---------- */
    let fall = null;
    function buildFall() {
      const f = course.falls[0];
      if (!f) return;
      const g = new THREE.Group(), Y = 9.4;
      const bt = () => { const t = T.truss.clone(); t.needsUpdate = true; return t; };
      const posts = [-8.6, 8.6].map(px => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(.55, Y + .4, .55), M.steel); m.position.y = (Y + .4) / 2; p.add(m); p.position.x = px; g.add(p); return p; });
      const defs = f.open === 2 ? [[-8.6, 1.9, 'drop'], [1.9, 8.6, 'hinge']] : f.open === 0 ? [[-8.6, -1.9, 'hinge'], [-1.9, 8.6, 'drop']] : [[-8.6, -1.9, 'drop'], [-1.9, 1.9, 'shatter'], [1.9, 8.6, 'drop']];
      const pieces = defs.map(([x0, x1, mode]) => {
        const len = x1 - x0, t = bt(); t.repeat.set(len / 8, 1);
        const pv = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.5), basic({ map: t, alphaTest: .4, side: THREE.DoubleSide, color: '#c4c0b6' }));
        const pivotX = mode === 'hinge' ? (x0 < 0 ? x0 : x1) : (x0 + x1) / 2;
        pv.position.set(pivotX, Y, 0); m.position.x = (x0 + x1) / 2 - pivotX; pv.add(m);
        g.add(pv);
        return { pv, mode, len, pivotX, landed: false };
      });
      // 무너지는 쪽 보에 매달린 LED 판(▲ 경고가 깨진다)
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
      const t = tex(cv, { aniso: 4 });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.15), basic({ map: t, fog: false }));
      const host = pieces.find(p => p.mode === 'drop');
      panel.position.set(host.pv.children[0].position.x, -1.35, .2); host.pv.add(panel);
      g.traverse(o => { o.frustumCulled = false; });
      g.userData = { posts, pieces, cv, t, key: '', f, Y };
      add(g); fall = g;
    }
    function drawFallPanel(u, broken) {
      const key = broken ? 'b' + Math.floor(time * 14) % 3 : 'w' + Math.floor(time * 2) % 2;
      if (u.key === key) return;
      u.key = key;
      const c = u.cv.getContext('2d'); c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, 256, 48);
      const g = LED.raster(broken ? (Math.random() < .5 ? '▲ ▲ ▲' : '! ▲ !') : (key.endsWith('1') ? '▲ SLOW ▲' : '감속'), broken ? F_NUM : F_KOPIX, broken ? 8 : 12);
      const grid = { w: 64, h: 12, bits: new Uint8Array(64 * 12) };
      const ox = Math.floor((64 - g.w) / 2), oy = Math.floor((12 - g.h) / 2);
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i] && (!broken || Math.random() < .8)) { const xx = ox + i, yy = oy + j; if (xx >= 0 && xx < 64 && yy >= 0 && yy < 12) grid.bits[yy * 64 + xx] = 1; }
      LED.draw(c, grid, 0, 0, 4, broken ? C.red : C.yellow, { off: '#1f1e1c' });
      u.t.needsUpdate = true;
    }

    /* ---------- 고가 붕괴: 무너지는 자리에서 콘크리트 조각이 떨어지고, 몇 개는 나를 앞질러 날아간다 ---------- */
    let chunks; const CH_N = 60, chunk = [];
    function buildChunks() {
      chunks = inst(new THREE.BoxGeometry(1, 1, 1), basic({ color: '#6f6b63' }), CH_N);
      chunks.count = CH_N;
      for (let i = 0; i < CH_N; i++) chunk.push({ life: 0 });
    }
    let chI = 0;
    function throwChunk(sAbs, x, y, vx, vy, vs, size, life) {
      const p = chunk[chI = (chI + 1) % CH_N];
      Object.assign(p, { s: sAbs, x, y, vx, vy, vs, size, life, rx: Math.random() * 6, ry: Math.random() * 6 });
    }

    /* ---------- 속도감: 방호벽 위 반사봉(8m마다) · SECTOR 04 머리 위 갠트리 · 출발 화면의 붉은 잔상 ---------- */
    let delPosts, delRefl, overT, overP;
    const DEL_EVERY = 8, DEL_N = 120, OV_EVERY = 150;
    function buildSpeed() {
      const pg = new THREE.BoxGeometry(.12, .7, .12); pg.translate(0, .35, 0);
      delPosts = inst(pg, M.ink, DEL_N);
      delRefl = inst(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow, .85), DEL_N);
      const bt = T.truss.clone(); bt.needsUpdate = true; bt.repeat.set(2.6, 1);
      overT = inst(new THREE.PlaneGeometry(20, 1.3), basic({ map: bt, alphaTest: .4, side: THREE.DoubleSide, color: '#bdb9ae' }), 8);
      const og = new THREE.BoxGeometry(.45, 11, .45); og.translate(0, 5.5, 0);
      overP = inst(og, M.steel, 16);
    }
    const ghosts = [];
    function buildGhosts() {
      for (let i = 0; i < 2; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 60, 1, 8), basic({ map: T.streak, color: C.red, transparent: true, depthWrite: false, fog: false }));
        m.geometry.rotateX(-Math.PI / 2); m.position.y = .08; m.frustumCulled = false; m.visible = false; m.userData = { t: -1, lane: 0 };
        add(m); ghosts.push(m);
      }
    }

    /* ---------- IDIOTAPE 흔적: 광고판의 낡은 포스터(고가도로) · 터널 벽 낙서(정전 때 내 전류가 비출 때만) · 방송탑 송전선 ---------- */
    let poster, graffiti, feedWire;
    function buildTraces() {
      const pg = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.2), basic({ map: tex(TEX.poster(), { aniso: 8 }), color: '#9d988c' }));
      face.position.y = 8.6;
      const back = new THREE.Mesh(new THREE.BoxGeometry(11.6, 6.8, .4), M.steel); back.position.set(0, 8.6, -.25);
      for (const px of [-3.6, 3.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.45, 8.6, .45), M.steel); p.position.set(px, 4.3 - 2, -.3); pg.add(p); }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(9, .16, .16), M.ink); arm.position.set(0, 12.3, .6);
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(C.yellow, 0)); lamp.position.set(0, 12.1, .9);
      pg.add(back, face, arm, lamp); pg.traverse(o => { o.frustumCulled = false; });
      pg.userData = { face, lamp, k: 0 };
      add(pg); poster = pg;
      const gm = basic({ map: tex(TEX.graffiti(), { aniso: 8 }), transparent: true, depthWrite: false, color: '#000000' });
      graffiti = new THREE.Mesh(new THREE.PlaneGeometry(10, 5, 8, 1), gm);
      graffiti.rotation.y = Math.PI / 2; graffiti.position.set(-COURSE.roadHalf + .12, 4.3, 0); graffiti.frustumCulled = false; graffiti.userData = { k: 0 };
      add(graffiti);
      // 방송탑 → 길가 철탑 꼭대기로 늘어진 송전선(전기가 들어가면 붉게)
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(lerp(-6.5, -10.6, t), lerp(4.2, 2.6, t) - Math.sin(t * Math.PI) * 1.6, lerp(0, 6, t))); }
      feedWire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .09, 4, false), basic({ color: '#2a2a28' }));
      feedWire.frustumCulled = false;
    }

    /* ================= 만들기 ================= */
    function init(c, r) {
      course = c; run = r;
      scene = new THREE.Scene();
      scene.background = new THREE.Color(C.fog);
      scene.fog = new THREE.Fog(C.fog, 90, 760);
      cam = new THREE.PerspectiveCamera(FEEL.fov, 16 / 9, .1, 2600);
      rear = new THREE.PerspectiveCamera(46, 1, .3, 900);
      materials();
      for (const k of ['truck', 'cart', 'hole', 'container', 'panel']) { const cv = TEX[k](); T[k] = tex(cv, { aniso: 8 }); SRC[k] = cv; }
      for (const k of ['car', 'barrier', 'barricade', 'coil']) SRC[k] = IMG[k];
      buildRoad(); buildSkyline(); buildPylons(); buildGates(); buildCables(); buildObstacles();
      buildLamps(); buildBoards(); buildTunnel(); buildScenery(); buildFinale(); buildSparks();
      buildClosures(); buildHoles(); buildDivider(); buildMovers(); buildCrane(); buildArcs(); buildFall(); buildChunks(); buildSpeed(); buildGhosts(); buildTraces();
      buildFrags(); buildFlyers(); buildZaps(); buildClosureRim();
      eggScreen.add(feedWire);
      closureDirs();
      return { scene, cam, rear };
    }
    function reset(c, r) {
      course = c; run = r; cableState.clear(); gateLitAt.length = 0; finishGlow = 0; eggOn = 0; eggFired = false; eggWeak = 0;
      for (const p of sp) p.life = 0;
      for (const p of chunk) p.life = 0;
      for (const m of frags.concat(flyers, zaps)) { m.userData.life = 0; m.visible = false; }
      for (const g of obsPool) g.userData.o = null;
      for (const g of arcPool) Object.assign(g.userData, { o: null, warned: false, fired: false });
      for (const h of holePool) h.userData.open = 0;
      if (fall) for (const p of fall.userData.pieces) p.landed = false;
      smashed.clear(); fxq.length = 0; darkK = 0; rebootT = -1; exitT = -1; BEND.uDropZ.value = 1e6;
      closureDirs();
    }

    /* ================= 사건 → 세계 반응 ================= */
    const smashed = new Set();
    let finishGlow = 0, eggOn = 0, eggFired = false;
    function onEvent(e) {
      if (e.t === 'gate') {
        const g = e.g;
        if (e.lit) {
          gateLitAt[g.i] = time; markFeeder(g.i);
          burst(g.s + 2, laneX(g.lane), 8.2, 26, [C.red, C.redHot, C.yellow], 10, .8, .7);
        } else burst(g.s + 2, laneX(g.lane), 8.2, 6, [C.grey2], 4, .5, .4);
      } else if (e.t === 'smash' || e.t === 'crash') {
        const o = e.o, x = o.x ?? laneX(o.lane ?? run.lane);
        if (o.type === 'collapse') {
          for (let i = 0; i < 26; i++) throwChunk(run.s - 2, run.x + (Math.random() - .5) * 8, .2, (Math.random() - .5) * 6, 3 + Math.random() * 6, run.v * (.5 + Math.random() * .4), .3 + Math.random() * .6, 1.4);
          burst(run.s + 2, run.x, .5, 20, ['#8a8a8a', '#ffffff'], 7, .7, .7);
          return;
        }
        if (typeof o.id === 'number' || o.type === 'truck' || o.type === 'cart') smashed.add(o.id);
        if (e.t === 'smash') { shatter(o); burst(o.s + 1, x, 1, 16, [C.red, C.redHot], 9, .5, .5); }
        else burst(o.s, x, 1, 18, ['#ffffff', C.yellow], 9, .7, .6);
      } else if (e.t === 'boost') {
        burst(run.s + 6, run.x, .4, 24, [C.red, C.redHot], 7, .5, .5);
      } else if (e.t === 'scrape') {
        burst(run.s + 2, run.x + e.dir * 1.2, .5, 16, [C.yellow, '#ffffff'], 6, .4, .35);
      } else if (e.t === 'chase') {
        for (let i = 0; i < 12; i++) throwChunk(run.s - HAZARD.chaseGap, (Math.random() - .5) * 14, 0, (Math.random() - .5) * 4, 2 + Math.random() * 3, 0, .5 + Math.random() * .8, 2);
        for (let i = 0; i < 8; i++) { const side = i % 2 ? -1 : 1; throwChunk(run.s - 3, run.x + side * (2 + Math.random() * 5), 1.5 + Math.random() * 4, side * Math.random() * 2, 4 + Math.random() * 4, run.v * (1.15 + Math.random() * .25), .4 + Math.random() * .6, 1.4); }
      }
    }

    /* ================= 매 프레임: 사건 ================= */
    const sc = new THREE.Vector3();
    function setInst(m, i, x, y, z, sx, sy, sz = 1) { mx.compose(v3.set(x, y, z), q0, sc.set(sx, sy, sz)); m.setMatrixAt(i, mx); }
    function updateEvents(dt, s) {
      const vis = (a, b = a) => b > s - behind && a < s + ahead;

      /* 막힌 차선 */
      let ci = 0, ai = 0;
      const bh = IMG.barrier ? 3.3 * IMG.barrier.height / IMG.barrier.width : 1.4;
      for (const sp of course.spans) {
        if (sp.kind !== 'closure' || !vis(sp.s0, sp.s1)) continue;
        const dir = openDir.get(sp.id) || 1;
        const z0 = Math.max(sp.s0, sp.s0 + Math.ceil((s - behind - sp.s0) / CL_EVERY) * CL_EVERY);
        for (let z = z0, k = Math.round((z0 - sp.s0) / CL_EVERY); z <= Math.min(sp.s1, s + ahead) && ci < CL_N; z += CL_EVERY, k++) {
          if (run.broken[sp.id + ':' + k]) continue;            // 과전류로 부순 방호벽
          const x = laneX(sp.lane) + Math.sin(k * 2.3 + sp.lane) * .12;
          setInst(closureMesh, ci, x, 0, zOf(z), 3.3, bh);
          setInst(closureRim, ci, x, -.05 * bh, zOf(z) - .06, 3.3 * RIM.barrier.k, bh * RIM.barrier.k);
          const on = ((k * .5 - time * 4) % 3 + 3) % 3 < .9;   // 경광등이 앞으로 차례로 달려간다
          setInst(closureLamps, ci, x + dir * .9, bh + .3, zOf(z) + .1, on ? 3.4 : 1.1, on ? 3.4 : 1.1);
          ci++;
        }
        if (ai < arrowPool.length && sp.s0 > s - 4) {
          const A = arrowPool[ai++]; A.visible = true;
          A.position.set(laneX(sp.lane), 0, zOf(sp.s0 - 3));
          drawArrow(A.userData, dir);
        }
      }
      closureMesh.count = closureLamps.count = closureRim.count = ci;
      closureMesh.instanceMatrix.needsUpdate = closureLamps.instanceMatrix.needsUpdate = closureRim.instanceMatrix.needsUpdate = true;
      const arm = armed(); closureRim.visible = arm > 0; closureRim.material.opacity = arm;
      for (; ai < arrowPool.length; ai++) arrowPool[ai].visible = false;

      /* 무너진 차선: 금 → 도착 2.3초 전에 벌어진다 */
      let hi = 0;
      for (const sp of course.spans) {
        if (sp.kind !== 'gap' || !vis(sp.s0, sp.s1) || hi >= holePool.length) continue;
        const h = holePool[hi++], u = h.userData; h.visible = true;
        const want = mode === 'race' && tta(sp.s0) < 2.3 ? 1 : 0;
        if (want && u.open === 0) { fxq.push({ t: 'hole', s: sp.s0 }); for (let i = 0; i < 14; i++) throwChunk(sp.s0 + Math.random() * (sp.s1 - sp.s0), laneX(sp.lane) + (Math.random() - .5) * 3, .2, (Math.random() - .5) * 3, 2 + Math.random() * 4, 0, .3 + Math.random() * .5, 1.2); burst(sp.s0 + 8, laneX(sp.lane), .3, 18, ['#8a8a8a', '#cfcabd'], 5, .9, 1.1); }
        u.open = want ? Math.min(1, u.open + dt / .3) : 0;
        h.scale.set(lerp(.3, 3.5, smooth(u.open)), sp.s1 - sp.s0, 1);
        h.position.set(laneX(sp.lane), .05, zOf((sp.s0 + sp.s1) / 2));
      }
      for (; hi < holePool.length; hi++) holePool[hi].visible = false;

      /* 분리대 */
      const d = course.dividers.find(k => vis(k.s0, k.s1));
      divider.visible = !!d;
      let ri = 0;
      if (d) {
        const u = divider.userData, len = d.s1 - d.s0, x = (laneX(d.b) + laneX(d.b + 1)) / 2;
        divider.position.set(x, 0, zOf(d.s0));
        u.body.scale.z = u.cap.scale.z = len;
        u.map.repeat.set(len / 24, 1);
        u.nose.visible = u.glow.visible = d.s0 > s - 6;
        u.glow.material.opacity = .35 + .25 * Math.sin(time * 8);
        for (let z = Math.max(d.s0, Math.ceil((s - 20) / 10) * 10); z < Math.min(d.s1, s + 420) && ri < 60; z += 10) setInst(divRefl, ri++, x, 1.3, zOf(z), .9, .9);
      }
      divRefl.count = ri; divRefl.instanceMatrix.needsUpdate = true;

      /* 화물차 · 정비차 */
      let mi = 0;
      course.movers.forEach((m, i) => {
        const st = run.mv[i];
        if (!st.on || st.done || st.dead || !vis(st.s) || mi >= moverPool.length) return;
        const G = moverPool[mi++], u = G.userData; G.visible = true;
        if (u.kind !== m.kind) {
          u.kind = m.kind; u.body.material = u.mats[m.kind];
          const w = m.kind === 'truck' ? 3.0 : 2.6, h = m.kind === 'truck' ? 3.0 : 1.95;
          u.body.scale.set(w, h, 1); u.body.position.y = h / 2 - .02;
          u.sh.scale.set(w * 1.3, w * 1.5, 1);
          u.led.visible = m.kind === 'truck'; u.led.position.set(0, 2.44, .03); u.led.scale.set(1.08, .39, 1);
          u.pool.visible = m.kind === 'cart';
          u.rim.scale.set(w * cartRimK, h * cartRimK, 1); u.rim.position.set(0, h / 2 - .02, -.06);
          u.key = '';
        }
        G.position.set(st.x, 0, zOf(st.s));
        const ar = m.kind === 'cart' ? armed() : 0;
        u.rim.visible = ar > 0; if (ar > 0) cartRim.opacity = ar;
        if (m.kind === 'truck') {
          const blinkDir = st.to >= 0 && (st.blink > 0 || st.move < 1) ? Math.sign(laneX(st.to) - st.x) || 1 : 0;
          drawTruckLed(u, blinkDir);
          const ph = Math.floor(time * 5) % 2;
          u.lampA.position.set(-.91, .76, .05); u.lampB.position.set(.91, .76, .05);
          u.lampA.scale.setScalar(blinkDir < 0 && ph ? 2.6 : 1.1); u.lampB.scale.setScalar(blinkDir > 0 && ph ? 2.6 : 1.1);
          u.beacon.position.set(0, 3.15, .05); u.beacon.scale.setScalar(1.2 + Math.abs(Math.sin(time * 6 + i)) * 1.6);
          u.lampA.material.color.set(C.yellow); u.lampB.material.color.set(C.yellow);
        } else {
          // 마주 오는 정비차: 전조등이 멀리서부터(안개를 뚫고) 보이고, 바닥에 빛이 깔린다
          const flash = Math.floor(time * 3) % 2 ? 1 : .7;
          u.lampA.position.set(-.59, .69, .08); u.lampB.position.set(.59, .69, .08);
          u.lampA.scale.setScalar(4.2 * flash); u.lampB.scale.setScalar(4.2 * flash);
          u.lampA.material.color.set('#fff6e0'); u.lampB.material.color.set('#fff6e0');
          u.beacon.position.set(0, 1.75, .06); u.beacon.scale.setScalar(Math.floor(time * 6 + i) % 2 ? 2.4 : .6);
          u.pool.position.set(0, .05, 9); u.pool.scale.set(4.5, 16, 1);
        }
      });
      for (; mi < moverPool.length; mi++) moverPool[mi].visible = false;

      /* 크레인 */
      const cr = course.cranes.find(k => vis(k.s - 30, k.s + 30));
      crane.visible = !!cr;
      if (cr) {
        const u = crane.userData, x = craneX(cr, run.time), moving = Math.abs(x - u.lastX) > .002;
        crane.position.set(0, 0, zOf(cr.s));
        u.trolley.position.x = x;
        u.box.rotation.z = clamp((x - u.lastX) / Math.max(dt, .001) * -.03, -.12, .12) * .6 + u.box.rotation.z * .4;
        u.beacon.visible = true; u.beacon.scale.setScalar(moving ? (Math.floor(time * 8) % 2 ? 3 : .5) : 1.2);
        u.lastX = x;
      }

      /* 방전 */
      let ki = 0;
      for (const o of course.obstacles) {
        if (o.type !== 'arc') continue;
        if (!vis(o.s, o.s + 30) || ki >= arcPool.length) continue;
        const G = arcPool[ki++], u = G.userData; G.visible = true;
        if (u.o !== o) Object.assign(u, { o, warned: false, fired: false });
        G.position.set(laneX(o.lane), 0, zOf(o.s));
        u.wire.position.x = -laneX(o.lane);
        const tt = o.s > s ? tta(o.s) : -(s - o.s) / 60;
        const warn = mode === 'race' && tt < HAZARD.strikeWarn, strike = mode === 'race' && tt < HAZARD.strikeWarn * .47 && tt > -.4;
        if (warn && !u.warned) { u.warned = true; fxq.push({ t: 'arcWarn', o }); }
        if (strike && !u.fired) { u.fired = true; fxq.push({ t: 'arc', o }); burst(o.s, laneX(o.lane), .3, 22, [C.yellow, '#ffffff', C.yellowHot], 9, .6, .55); }
        u.disk.visible = warn && tt > -.4;
        u.disk.scale.setScalar((strike ? 5.5 : 2 + (1 - tt / HAZARD.strikeWarn) * 2.5) * (.85 + .15 * Math.sin(time * 40)));
        u.disk.material.color.set(strike ? '#fff3c4' : C.yellow);
        u.bolt.visible = strike; u.core.visible = strike;
        if (strike) { u.boltM.map = boltTex[Math.floor(time * 24) % boltTex.length]; u.bolt.scale.x = Math.random() < .5 ? -1 : 1; u.core.scale.setScalar(3 + Math.random() * 2); }
        u.top.visible = warn || Math.random() < .04;
        u.top.scale.setScalar(warn ? 2.5 + Math.random() * 2 : 1.2);
        if (warn && !strike && Math.random() < dt * 20) spark(o.s, laneX(o.lane) + (Math.random() - .5) * 2, .2, (Math.random() - .5) * 3, 3 + Math.random() * 3, 0, .4, .3, C.yellow);
      }
      for (; ki < arcPool.length; ki++) arcPool[ki].visible = false;

      /* 갠트리 붕괴 */
      if (fall) {
        const u = fall.userData, f = u.f;
        fall.visible = vis(f.s - 20, f.s + 20);
        if (fall.visible) {
          fall.position.set(0, 0, zOf(f.s));
          const tt = mode === 'race' ? tta(f.s) : 99;
          const pre = clamp((HAZARD.fallWarn - tt) / .35, 0, 1), k = clamp((HAZARD.fallWarn - .35 - tt) / HAZARD.fallTime, 0, 1);
          if (pre > 0 && !u.warned) { u.warned = true; fxq.push({ t: 'gantryWarn', s: f.s }); burst(f.s, f.open === 2 ? -8.6 : 8.6, 9, 20, [C.yellow, '#ffffff'], 6, .7, .5); }
          if (pre <= 0) u.warned = false;
          drawFallPanel(u, pre > 0);
          u.posts.forEach(p => { const fallsHere = (p.position.x < 0 && f.open !== 0) || (p.position.x > 0 && f.open !== 2); p.rotation.z = fallsHere ? -Math.sign(p.position.x) * (pre * .12 + k * k * 1.25) : 0; });
          for (const p of u.pieces) {
            const e = k * k;
            if (p.mode === 'drop') { p.pv.position.y = lerp(u.Y, .7, e); p.pv.rotation.z = Math.sin(k * Math.PI) * .1 * Math.sign(p.pivotX || 1); }
            else if (p.mode === 'hinge') p.pv.rotation.z = Math.sign(p.pivotX) * Math.asin(Math.min(1, (u.Y - 4.4) / p.len)) * e;
            else p.pv.visible = k < .35;
            if (k >= 1 && !p.landed) { p.landed = true; if (p.mode !== 'hinge') { fxq.push({ t: 'gantryLand', s: f.s }); burst(f.s, p.pivotX, 1, 30, [C.yellow, '#ffffff', '#8a8a8a'], 10, .9, .7); for (let i = 0; i < 8; i++) throwChunk(f.s, p.pivotX + (Math.random() - .5) * 5, 1, (Math.random() - .5) * 8, 3 + Math.random() * 5, (Math.random() - .3) * 8, .3 + Math.random() * .4, 1.3); } }
            if (k <= 0) { p.landed = false; p.pv.visible = true; if (p.mode === 'drop') p.pv.position.y = u.Y; p.pv.rotation.z = 0; }
          }
        }
      }

      /* 고가 붕괴: 무너지는 자리보다 뒤쪽 세계가 아래로 떨어진다(셰이더) + 조각 */
      const ch = run.chase;
      BEND.uDropZ.value = ch.front > 0 && (ch.on || ch.done) ? s - ch.front : 1e6;
      if (ch.on && Math.random() < dt * 30) throwChunk(ch.front + 1, (Math.random() - .5) * 15, -.2, (Math.random() - .5) * 3, 1 + Math.random() * 3, 0, .3 + Math.random() * .9, 1.6);
      // 무너지는 힘에 튄 조각이 나를 앞질러 날아간다(앞을 보고 있어도 뒤에서 무언가 오고 있다는 걸 안다)
      if (ch.on && Math.random() < dt * 3.5) { const side = Math.random() < .5 ? -1 : 1; throwChunk(s - 4, run.x + side * (2.5 + Math.random() * 4), 2 + Math.random() * 3, side * (1 + Math.random() * 2), 3 + Math.random() * 3, run.v * (1.18 + Math.random() * .2), .35 + Math.random() * .5, 1.3); }
      for (let i = 0; i < CH_N; i++) {
        const p = chunk[i];
        if (p.life <= 0) { setInst(chunks, i, 0, -999, 0, .0001, .0001); continue; }
        p.life -= dt; p.vy -= 16 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.vs * dt; p.rx += dt * 4; p.ry += dt * 3;
        q0.setFromEuler(eul.set(p.rx, p.ry, 0));
        mx.compose(v3.set(p.x, p.y, zOf(p.s)), q0, sc.setScalar(p.size)); chunks.setMatrixAt(i, mx);
        q0.identity();
      }
      chunks.instanceMatrix.needsUpdate = true;

      /* 속도감: 방호벽 위 반사봉 · SECTOR 04 머리 위 갠트리 */
      let di = 0;
      const d0 = Math.ceil((s - 16) / DEL_EVERY) * DEL_EVERY;
      for (let z = d0; z < s + 460 && di < DEL_N - 1; z += DEL_EVERY) {
        for (const side of [-1, 1]) {
          const x = side * (COURSE.roadHalf + .05);
          setInst(delPosts, di, x, 1.0, zOf(z), 1, 1);
          setInst(delRefl, di, x, 1.62, zOf(z) + .07, .5, .5);
          di++;
        }
      }
      delPosts.count = delRefl.count = di;
      delPosts.instanceMatrix.needsUpdate = delRefl.instanceMatrix.needsUpdate = true;
      delRefl.material.opacity = .45 + .5 * Math.max(inTunnel, darkK);
      const oz = course.zones.find(z => z.kind === 'gantries');
      let ov = 0;
      if (oz) for (let z = Math.max(oz.s0, Math.ceil((s - behind) / OV_EVERY) * OV_EVERY); z < Math.min(oz.s1, s + ahead) && ov < 8; z += OV_EVERY) {
        if (course.gates.some(g => Math.abs(g.s - z) < 30) || course.boards.some(b => Math.abs(b.s - z) < 30) || Math.abs(z - (course.falls[0] || { s: -1e9 }).s) < 30) continue;
        setInst(overT, ov, 0, 9.6, zOf(z), 1, 1);
        setInst(overP, ov * 2, -9.8, 0, zOf(z), 1, 1); setInst(overP, ov * 2 + 1, 9.8, 0, zOf(z), 1, 1);
        ov++;
      }
      overT.count = ov; overP.count = ov * 2;
      overT.instanceMatrix.needsUpdate = overP.instanceMatrix.needsUpdate = true;

      /* 출발 화면: 붉은 잔상이 차선을 따라 지평선으로 달려간다(앞서 달린 누군가의 전류) */
      for (const g of ghosts) {
        const u = g.userData;
        if (mode !== 'attract') { g.visible = false; u.t = -1; continue; }
        if (u.t < 0 && Math.random() < dt * .45) { u.t = 0; u.lane = Math.random() < .5 ? 0 : 2; }
        if (u.t >= 0) {
          u.t += dt; g.visible = true;
          const z = 30 - u.t * u.t * 520;
          g.position.set(laneX(u.lane), .08, z);
          g.material.opacity = clamp(1 - u.t / 1.6, 0, 1);
          if (u.t < .05) fxq.push({ t: 'ghost', lane: u.lane });
          if (u.t > 1.6) { u.t = -1; g.visible = false; }
        }
      }

      /* IDIOTAPE 흔적 1: 광고판 포스터. 전류를 가진 채 지나가면 광고판 등이 켜진다 */
      const eg = course.egg;
      poster.visible = vis(eg.poster - 20, eg.poster + 20);
      if (poster.visible) {
        const u = poster.userData;
        poster.position.set(COURSE.roadHalf + 7.5, 0, zOf(eg.poster)); poster.rotation.y = -.42;
        const near = isLive() && eg.poster - s < 260 ? 1 : 0;
        u.k += (near - u.k) * Math.min(1, dt * 3);
        u.face.material.color.set(col.set('#9d988c').lerp(TMP_WHITE, u.k));
        u.lamp.material.opacity = u.k * .8; u.lamp.scale.set(9, 3, 1);
      }
      /* 흔적 2: 터널 벽 낙서. 정전 속에서 내 전류가 천장 등을 켤 때만 보인다 */
      graffiti.visible = vis(eg.tag - 8, eg.tag + 8);
      if (graffiti.visible) {
        const u = graffiti.userData;
        graffiti.position.z = zOf(eg.tag);
        const lit = isLive() && Math.abs(eg.tag - s - 26) < 34 + run.v * .4 ? 1 : (darkK > .5 ? 0 : .35);
        u.k += (lit - u.k) * Math.min(1, dt * 6);
        graffiti.material.color.setScalar(u.k);
        if (u.k > .6 && !u.seen && eg.tag - s < 60) { u.seen = true; fxq.push({ t: 'tag' }); }
      }
    }
    const TMP_WHITE = new THREE.Color('#ffffff');
    const isLive = () => run.current > .2 || run.boost > 0;
    const eul = new THREE.Euler();
    function attractCables() {
      const c = course.cables.find(k => k.gate === 0);
      if (!c) return;
      const p = (time * 150) % 560 - 30;
      cableState.set(c.id, { a: Math.max(c.s0, p - 110), b: Math.min(c.s1, Math.max(c.s0, p)), p: Math.min(c.s1, p), fade: 1, perm: false });
    }

    /* ================= 매 프레임 ================= */
    const v3 = new THREE.Vector3(), mx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), col = new THREE.Color();
    const one = new THREE.Vector3(1, 1, 1);
    let inTunnel = 0, darkK = 0, rebootT = -1, exitT = -1, lastS = 0, mode = 'race', eggWeak = 0;
    const SUB_AHEAD = 380;   // 변전소는 결승선 380m 뒤: 결승 뒤 미끄러져 서면 바로 앞에 보인다
    const TUNNEL_FOG = new THREE.Color('#3f3c37'), TUNNEL_ROAD = new THREE.Color('#8d897f');
    const DARK_FOG = new THREE.Color('#0c0b0a'), DARK_ROAD = new THREE.Color('#4a4740');
    function update(dt, view) {
      time += dt;
      const s = run.s;
      updateBend(course, s);
      updateCableState(dt);
      if (mode === 'attract') attractCables();

      /* 도로 · 벽 무늬가 흐른다 */
      T.asphalt.offset.y = (s / 24) % 1;
      walls[0].material.map.offset.x = (s / 24) % 1;
      walls[1].material.map.offset.x = (-s / 24) % 1;
      T.ground.offset.y = (s / 320) % 1;

      /* 원경: 굽이 방향만큼 옆으로. 가까운 겹일수록 더 많이(코스 평균 방향 .25를 가운데로) */
      const hd = course.heading[Math.min(course.N - 1, Math.max(0, Math.floor(s)))] - .25;
      for (const l of sky) l.material.map.offset.x = l.userData.off - hd * l.userData.sh;

      /* 터널 안팎: 안개 · 원경. 정전 구간은 거의 까맣고, 내 전류가 천장 등을 켜는 자리만 보인다 */
      const tn = course.tunnel;
      const lampOn = run.current > .2 || run.boost > 0;
      const inside = s > tn.s0 + 4 && s < tn.s1 - 4 ? 1 : 0;
      inTunnel += (inside - inTunnel) * Math.min(1, dt * 3);
      if (mode === 'race') {
        if (s > tn.s0 && lastS <= tn.s0) fxq.push({ t: 'enter' });
        if (s > tn.s1 && lastS <= tn.s1) { fxq.push({ t: 'exit' }); exitT = 0; }
      }
      if (exitT >= 0) exitT += dt;
      const dz = course.zones.find(z => z.kind === 'dark');
      let dk = 0;
      if (dz && mode === 'race') {
        if (s > dz.s0 - 45 && s < dz.s0) dk = Math.random() < (s - dz.s0 + 45) / 45 ? 1 : 0;   // 깜빡이며 꺼진다
        else if (s >= dz.s0 && s < dz.s1) dk = 1;
        if (s >= dz.s0 && lastS < dz.s0) fxq.push({ t: 'dark' });
        if (s >= dz.s1 && lastS < dz.s1) { rebootT = 0; fxq.push({ t: 'reboot' }); }
      }
      if (rebootT >= 0) rebootT += dt;
      darkK += (dk - darkK) * Math.min(1, dt * (dk ? 16 : 5));
      const fogCol = col.set(C.fog).lerp(TUNNEL_FOG, inTunnel * .9).lerp(DARK_FOG, darkK);
      scene.fog.color.copy(fogCol); scene.background.copy(fogCol);
      scene.fog.far = lerp(760 - inTunnel * 360, lampOn ? HAZARD.darkFarLive : HAZARD.darkFar, darkK); scene.fog.near = lerp(90 - inTunnel * 50, 3, darkK);
      for (const l of sky) { l.visible = inTunnel < .95; l.material.color.setScalar(1 - darkK * .85); }
      cityLights.visible = inTunnel < .95;
      tunnel.visible = s > tn.s0 - ahead - 40 && s < tn.s1 + behind + 20;
      tunnel.position.z = zOf(tn.s0);
      groundM.visible = inTunnel < .95;
      road.material.color.set('#ffffff').lerp(TUNNEL_ROAD, inTunnel).lerp(DARK_ROAD, darkK);
      walls.forEach(w => w.material.color.set('#ffffff').lerp(TUNNEL_ROAD, inTunnel).lerp(DARK_ROAD, darkK));

      /* 철탑 줄 */
      const start = Math.ceil((s - behind) / COURSE.pylonEvery) * COURSE.pylonEvery;
      let pi = 0;
      const rowsShown = [];
      for (let rs = start; rs < s + ahead && pi < pylons.length - 1; rs += COURSE.pylonEvery) {
        if (!rowAllowed(rs)) continue;
        const lit = rowLit(rs);
        rowsShown.push({ s: rs, lit });
        for (const side of [-1, 1]) {
          const p = pylons[pi++]; p.visible = true;
          p.position.set(side * PY.x, PY.base, zOf(rs));
          p.scale.x = side;              // 반대쪽은 뒤집어서 같은 그림이 대칭으로 선다
          const L = p.userData.lamps;
          for (let k = 0; k < L.length; k++) {
            L[k].visible = lit > 0;
            if (lit > 0) { const f = .75 + .25 * Math.sin(time * 9 + rs * .1 + k); L[k].scale.setScalar((k === 0 ? 7 : 5) * lit * f); }
          }
        }
      }
      for (; pi < pylons.length; pi++) pylons[pi].visible = false;
      /* 다시 이어진 전선: 양쪽 끝 철탑이 모두 켜졌을 때 */
      let wi = 0;
      for (let k = 0; k + 1 < rowsShown.length; k++) {
        const a = rowsShown[k], b = rowsShown[k + 1];
        if (b.s - a.s !== COURSE.pylonEvery || a.lit < 1 || b.lit <= 0) continue;
        for (const side of [-1, 1]) for (const [lx, ly] of [[.36, .796], [.47, .56]]) {
          if (wi >= wires.length) break;
          const w = wires[wi++]; w.visible = true;
          w.position.set(side * (PY.x - lx * PY.w), PY.base + ly * PY.h, zOf(a.s));
          w.scale.set(1, 1, b.lit);
        }
      }
      for (; wi < wires.length; wi++) wires[wi].visible = false;

      /* 게이트 */
      let gi = 0;
      for (const g of course.gates) {
        if (g.s < s - behind) continue;
        if (g.s > s + ahead || gi >= gatePool.length) break;
        const G = gatePool[gi++], u = G.userData; G.visible = true;
        G.position.set(0, 0, zOf(g.s));
        const tunnelGate = g.kind === 'tunnel';
        u.beam.scale.x = u.beam2.scale.x = tunnelGate ? .49 : 1;
        u.beam.position.y = u.beam2.position.y = tunnelGate ? 9.5 : 10.4;
        u.plate.position.x = laneX(g.lane); u.plate.position.z = -1.6;
        u.chev.forEach(cm => { cm.position.x = laneX(g.lane); cm.visible = run.gates[g.i] === 0; });
        const st = run.gates[g.i];
        u.signs.forEach((sg, li) => {
          let mode = 'off';
          if (st === 1) mode = 'on';
          else if (st === -1) mode = li === g.lane ? 'miss' : 'off';
          else if (li === g.lane) mode = 'arrow';
          drawSign(sg, mode, pad2(g.i + 1));
          const gl = st === 1 ? .55 * (.8 + .2 * Math.sin(time * 12)) : (mode === 'arrow' ? .35 : 0);
          sg.glow.material.opacity = gl;
          sg.glow.material.color.set(st === 1 ? C.red : C.yellow);
        });
      }
      for (; gi < gatePool.length; gi++) gatePool[gi].visible = false;

      /* 전선 */
      let ci = 0;
      for (const c of course.cables) {
        if (c.s1 < s - behind) continue;
        if (c.s0 > s + ahead) break;
        if (ci >= cablePool.length) break;
        const P = cablePool[ci++];
        const s0 = Math.max(c.s0, s - behind), s1 = Math.min(c.s1, s + ahead);
        const wob = Math.sin(c.id * 3.1) * .12;
        P.mesh.visible = P.strip.visible = true;
        // 고압 레일: 굵고, 늘 켜져 있고, 앞으로 맥이 흐른다
        const rw = c.rail ? 2.2 : 1;
        P.mesh.position.set(laneX(c.lane) + (c.rail ? 0 : wob), 0, zOf(s0)); P.mesh.scale.set(rw, rw, s1 - s0);
        P.strip.position.copy(P.mesh.position); P.strip.scale.set(c.rail ? 2.6 : 1, 1, s1 - s0);
        const st = c.rail ? { a: c.s0, b: c.s1, p: c.s0 + ((time * 260) % (c.s1 - c.s0)), fade: 1 } : cableState.get(c.id), u = P.u;
        u.uS.value = s; u.uTime.value = time;
        if (st) { u.uA.value = st.a; u.uB.value = st.b; u.uP.value = st.p; u.uFade.value = st.fade; }
        else { u.uA.value = 1; u.uB.value = 0; u.uFade.value = 0; }
        P.strip.visible = !!st;
        if (c.rail && Math.random() < dt * 30) { const zz = Math.max(s + 4, c.s0) + Math.random() * 160; if (zz < c.s1) spark(zz, laneX(c.lane) + (Math.random() - .5) * .6, .25, (Math.random() - .5) * 4, 2 + Math.random() * 4, 0, .35, .35, Math.random() < .5 ? C.redHot : C.yellow); }
        // 머리에서 튀는 불꽃
        if (st && c === run.cable && st.p < c.s1 - 1 && Math.random() < dt * 40) spark(st.p, laneX(c.lane), .2, (Math.random() - .5) * 4, 2 + Math.random() * 3, 4, .35, .35, Math.random() < .5 ? C.redHot : C.yellow);
        if (st && st.p >= c.s1 - 1 && c === run.cable && Math.random() < dt * 25) spark(c.s1, laneX(c.lane), .25, (Math.random() - .5) * 6, 3 + Math.random() * 4, 2, .4, .4, C.yellow);
      }
      for (; ci < cablePool.length; ci++) { cablePool[ci].mesh.visible = cablePool[ci].strip.visible = false; }

      /* 장애물 */
      let oi = 0;
      const reflOn = inTunnel > .4 || darkK > .05, arm = armed();
      for (const o of course.obstacles) {
        if (o.s < s - behind) continue;
        if (o.s > s + ahead || oi >= obsPool.length) break;
        if (o.type === 'arc' || o.type === 'gantry') continue;     // 방전 · 갠트리는 따로 그린다
        const G = obsPool[oi++], u = G.userData;
        G.visible = !smashed.has(o.id);
        if (u.o !== o) {
          u.o = o; u.plane.material = u.mats[o.type]; u.rim.material = u.rims[o.type];
          const w = OB[o.type], im = SRC[o.type], h = w * im.height / im.width, rk = RIM[o.type].k;
          u.plane.scale.set(w, h, 1); u.plane.position.y = h / 2 - .05;
          u.rim.scale.set(w * rk, h * rk, 1); u.rim.position.set(0, h / 2 - .05, -.06);
          u.sh.scale.set(w * 1.25, w * .7, 1);
          u.spark.visible = o.type === 'coil'; u.spark.position.set(w * .38, h * .35, .1);
          u.jit = Math.sin(o.id * 12.9) * .25;
        }
        G.position.set(laneX(o.lane) + u.jit, 0, zOf(o.s));
        u.rim.visible = arm > 0; if (arm > 0) u.rim.material.opacity = arm * clamp(1 - (o.s - s - 300) / 200, 0, 1);
        u.refl.visible = reflOn;
        if (reflOn) { u.refl.position.set(0, .9, .2); u.refl.scale.setScalar(1.6 + .5 * Math.sin(time * 9 + o.id)); }
        if (o.type === 'coil') {
          const f = Math.random() < .3 ? 2.6 : 1.4;
          u.spark.scale.setScalar(f);
          if (o.s - s < 300 && Math.random() < dt * 12) spark(o.s, laneX(o.lane) + u.jit + 1, .55, (Math.random() - .3) * 5, 2 + Math.random() * 4, (Math.random() - .5) * 3, .45, .3, C.yellow);
        }
      }
      for (; oi < obsPool.length; oi++) obsPool[oi].visible = false;
      updateEvents(dt, s);
      stepBreaks(dt);

      /* 가로등 */
      const l0 = Math.ceil((s - behind) / LAMP_EVERY) * LAMP_EVERY;
      const arms = lampPoles.userData.arms;
      let li = 0;
      for (let ls = l0; ls < s + ahead && li < LAMP_N - 1; ls += LAMP_EVERY) {
        if (ls > tn.s0 - 10 && ls < tn.s1 + 10) continue;
        for (const side of [-1, 1]) {
          const z = zOf(ls + (side > 0 ? LAMP_EVERY / 2 : 0)), x = side * (COURSE.roadHalf + .35);
          mx.compose(v3.set(x, 0, z), q0, one); lampPoles.setMatrixAt(li, mx);
          mx.makeScale(side < 0 ? -1 : 1, 1, 1); mx.setPosition(x, 0, z); arms.setMatrixAt(li, mx);
          mx.makeTranslation(x - side * 2.3, 9.42, z); lampHeads.setMatrixAt(li, mx);
          const span = rowLit(ls) >= 1 ? .45 : 0;
          const near = lampOn ? clamp(1 - Math.abs(ls - s - 18) / (30 + run.v * .35), 0, 1) : 0;
          const k = Math.max(span, near);
          col.set(k > 0 ? C.yellow : C.grey3); lampHeads.setColorAt(li, col);
          mx.compose(v3.set(x - side * 2.3, 9.2, z + .3), q0, v3.clone().setScalar(k * 7 + .0001)); lampGlows.setMatrixAt(li, mx);
          li++;
        }
      }
      for (; li < LAMP_N; li++) { mx.makeScale(0, 0, 0); for (const m of [lampPoles, arms, lampHeads, lampGlows]) m.setMatrixAt(li, mx); }
      for (const m of [lampPoles, arms, lampHeads, lampGlows]) m.instanceMatrix.needsUpdate = true;
      lampHeads.instanceColor.needsUpdate = true;

      /* 터널 천장 등 */
      if (tunnel.visible) {
        const n = tunnel.userData.n;
        const i0 = Math.max(0, Math.floor((s - tn.s0 - 60) / TL_EVERY) * 2), i1 = Math.min(n, Math.floor((s - tn.s0 + 420) / TL_EVERY) * 2);
        for (let i = Math.max(0, i0 - 8); i < Math.min(n, i1 + 8); i++) {
          const ls = tn.s0 + Math.floor(i / 2) * TL_EVERY;
          const near = lampOn ? clamp(1 - Math.abs(ls - s - 26) / (34 + run.v * .4), 0, 1) : 0;
          const span = rowLit(ls - 1) >= 1 ? .3 : 0;
          const lit = run.gates.some((v, gi2) => v === 1 && Math.abs(course.gates[gi2].s - ls) < 250 && course.gates[gi2].kind === 'tunnel') ? .35 : span;
          let k = Math.max(near, lit);
          // 정전: 구간 안의 등은 내 전류가 지날 때만, 끝난 뒤의 등은 다시 켜질 때 멀리서부터 물결처럼
          if (dz && mode === 'race') {
            if (ls >= dz.s0 && ls < dz.s1) k = near * 1.3;
            else if (ls >= dz.s1 && (rebootT < 0 ? s > dz.s0 - 45 : rebootT < 1.2 && ls - s < 560 - rebootT * 900)) k = 0;
            if (s > dz.s0 - 45 && s < dz.s0 && Math.random() < .55) k = 0;
          }
          col.set(k > 0 ? C.yellow : C.grey3); tunnelLamps.setColorAt(i, col);
          mx.compose(v3.set(i % 2 ? 3.4 : -3.4, 9.75, -Math.floor(i / 2) * TL_EVERY), q0, v3.clone().setScalar(k * 6 + .0001));
          tunnelGlows.setMatrixAt(i, mx);
        }
        tunnelLamps.instanceColor.needsUpdate = true; tunnelGlows.instanceMatrix.needsUpdate = true;
      }

      /* 전광판 */
      let bi = 0;
      for (const b of course.boards) {
        if (b.s < s - behind || b.s > s + ahead) continue;
        if (bi >= boardPool.length) break;
        const G = boardPool[bi++], u = G.userData; G.visible = true;
        if (u.b !== b) { u.b = b; u.boot = 0; u.key = ''; u.on = false; }
        G.position.set(0, 0, zOf(b.s));
        const inT = b.s > tn.s0 && b.s < tn.s1;
        u.posts.forEach(p => { p.visible = !inT; }); u.beam.visible = !inT;
        const on = b.kind === 'start' || b.s - s < 460;
        if (on && !u.on) { u.on = true; u.boot = .45; }
        u.boot = Math.max(0, u.boot - dt);
        drawBoard(u, b, on);
        u.glow.material.opacity = on ? .22 + .08 * Math.sin(time * 6) : 0;
        u.glow.material.color.set(b.kind === 'start' ? startBoardText().col : C.red);
      }
      for (; bi < boardPool.length; bi++) boardPool[bi].visible = false;

      /* 정유 단지 구조물 */
      let si = 0;
      for (const it of course.scenery) {
        if (it.s < s - behind) continue;
        if (it.s > s + ahead + 200 || si >= scenePool.length) break;
        if (it.side === course.screen.side && Math.abs(it.s - course.screen.s) < 160) continue;   // 방송탑 앞은 비워 둔다
        const m = scenePool[si++]; m.visible = true;
        if (m.userData.item !== it) {
          m.userData.item = it; m.material = m.userData.mats[it.kind];
          const im = IMG['ind' + it.kind]; m.scale.set(it.h * im.width / im.height, it.h, 1);
        }
        m.position.set(it.side * (PY.x + 8 + it.dist), -16 + it.h / 2, zOf(it.s));
      }
      for (; si < scenePool.length; si++) scenePool[si].visible = false;

      /* IDIOTAPE 전광탑 */
      const scr = course.screen;
      eggScreen.visible = scr.s > s - behind && scr.s < s + ahead + 300;
      if (eggScreen.visible) {
        // 정유 단지의 랜드마크: 길 오른쪽 높이 선 커다란 방송탑 화면(멀리서부터 보이고, 길 쪽으로 비스듬히)
        eggScreen.position.set(scr.side * 34, 21, zOf(scr.s));
        eggScreen.rotation.y = -scr.side * .5;
        eggScreen.scale.setScalar(1.75);
        drawEgg(dt);
      }

      /* 변전소: 멀리서부터 흐릿하게 보이다가 다가온다 */
      const sd = course.length + SUB_AHEAD - s;
      sub.visible = sd < 2900;
      if (sub.visible) {
        sub.position.set(0, 0, -(sd));
        const op = clamp(1 - (sd - 600) / 2300, .08, 1);
        sub.children[0].material.opacity = op;
        sub.children[0].material.color.set(col.set(C.fog).lerp(new THREE.Color('#b9bec9'), op));
        const total = run.lit / course.gates.length;
        subLights.forEach((q, k) => { const f = k / subLights.length; q.visible = finishGlow > f * .8 && f < total + .01; q.scale.setScalar(7 * (.8 + .2 * Math.sin(time * 7 + k))); });
        subRing.visible = finishGlow > 0 && total > .5;
        subRing.material.opacity = finishGlow * (.6 + .4 * Math.sin(time * 5));
        if (subLogo) subLogo.visible = finishGlow > .5 && run.lit === course.gates.length;
      }

      /* 원경 도시 불빛: 출발 직후엔 거의 다 꺼져 있다. 게이트를 지나 철탑이 켜지면 창문 · 간판이 블록 단위로 켜지고, 켠 철탑이 늘수록 더 켜진다 */
      const far = farLayer, fu = far.userData, frac = run.lit / course.gates.length;
      const litTo = mode === 'attract' ? .03 : run.lit > 0 ? Math.max(.18 + .82 * frac, finishGlow * frac) : 0;
      cityLit += (litTo - cityLit) * Math.min(1, dt * (litTo > cityLit ? 1.6 : 3));
      CITY_U.uLit.value = cityLit * (1 - darkK); CITY_U.uTime.value = time;
      const show = cityLit * .95 * (1 - darkK);
      for (let k = 0; k < cityLightData.length; k++) {
        const d = cityLightData[k];
        let u = d.u - far.material.map.offset.x; u = ((u % 1) + 1) % 1;
        const on = d.on < show;
        const x = (u - .5) * fu.w, y = fu.y + fu.h * (1 - d.v);
        const sc = on ? d.size * (.75 + .25 * Math.sin(time * 3 + d.ph)) : 0;
        mx.compose(v3.set(x, y, fu.z + 2), q0, v3.clone().set(sc, sc, 1));
        cityLights.setMatrixAt(k, mx);
      }
      cityLights.instanceMatrix.needsUpdate = true;
      cityLights.position.x = 0;

      /* 불꽃 입자 */
      for (let i = 0; i < SP_N; i++) {
        const p = sp[i];
        if (p.life <= 0) { mx.makeScale(0, 0, 0); sparks.setMatrixAt(i, mx); continue; }
        p.life -= dt; p.vy -= 14 * dt; p.x += p.vx * dt; p.y = Math.max(.05, p.y + p.vy * dt); p.s += p.vs * dt;
        const k = Math.max(0, p.life / p.max), sc = p.size * (.4 + k);
        mx.compose(v3.set(p.x, p.y, zOf(p.s)), q0, v3.clone().set(sc, sc, 1));
        sparks.setMatrixAt(i, mx);
      }
      sparks.instanceMatrix.needsUpdate = true;

      /* 방송탑에 전기가 들어오면: 그 둘레 철탑 등과 정유 단지 굴뚝 불이 박자에 맞춰 뛴다 */
      if (eggOn && Math.abs(scr.s - s) < 700) {
        const b = AUDIO.beat(), pulse = Math.pow(1 - (b % 1), 3);
        for (const p of pylons) if (p.visible) for (const L of p.userData.lamps) if (L.visible) L.scale.multiplyScalar(1 + pulse * .8);
        if (Math.random() < dt * 6 * pulse) { const it = course.scenery[Math.floor(Math.random() * course.scenery.length)]; if (it && Math.abs(it.s - s) < 500 && it.s > s) burst(it.s, it.side * (PY.x + 8 + it.dist), -16 + it.h, 10, [C.red, C.yellow], 6, .8, 3); }
      }
      lastS = s;

      /* 카메라 */
      cam.position.set(view.x, view.y, 0);
      cam.fov = view.fov; cam.updateProjectionMatrix();
      cam.rotation.set(view.pitch, view.yaw, view.roll, 'YXZ');
      rear.position.set(view.x, view.y + .25, .6);
      rear.rotation.set(-.02, Math.PI, 0, 'YXZ');
    }

    /* IDIOTAPE 방송탑: 정유 단지 게이트 넷(screen.feed)이 이 탑에 전기를 보낸다
       0~1개: NO SIGNAL / 2~3개: 지직거리는 화면 사이로 웃는 카세트가 한 프레임씩 / 4개: 전기가 들어와 공연이 뜬다(CH 03 ON AIR)
       이름은 화면(세계 속 물건) 맨 아래 한 줄에만 나온다. 한 번 본 사람에겐 이후 판의 대기 화면에도 그 표시가 가끔 남는다 */
    let bandFrames = null, seenBefore = false;
    try { seenBefore = localStorage.getItem('lwr.onair') === '1'; } catch (e) {}
    function bandGrid(frame) {
      if (!bandFrames) {
        bandFrames = [];
        const im = IMG.band; if (!im) return null;
        const cv = document.createElement('canvas'), w = 105, h = 116; cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        for (let f = 0; f < 3; f++) {
          const gw = 48, gh = 44, out = { w: gw * 2 + 4, h: gh, bits: new Uint8Array((gw * 2 + 4) * gh), hot: new Uint8Array((gw * 2 + 4) * gh) };
          for (const [row, ox] of [[0, 0], [1, gw + 4]]) {
            cx.clearRect(0, 0, w, h); cx.drawImage(im, f * 105, row * 116, 105, 116, 0, 0, w, h);
            const d = cx.getImageData(0, 0, w, h).data;
            for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
              const sx = Math.floor(i * w / gw), sy = Math.floor(j * h / gh), k = (sy * w + sx) * 4;
              if (d[k + 3] > 100) { const lum = (d[k] + d[k + 1] + d[k + 2]) / 3; out.bits[j * out.w + ox + i] = 1; if (lum > 120) out.hot[j * out.w + ox + i] = 1; }
            }
          }
          bandFrames.push(out);
        }
      }
      return bandFrames[frame];
    }
    const feedLit = () => course.screen.feed.filter(i => run.gates[i] === 1).length;
    function drawEgg(dt) {
      const u = eggScreen.userData, c = u.cv.getContext('2d');
      const fed = feedLit(), all = fed === course.screen.feed.length;
      if (mode === 'race' && all && course.screen.s - run.s < 430 && !eggFired && !run.out) {
        eggFired = true; eggOn = 1;
        try { localStorage.setItem('lwr.onair', '1'); } catch (e) {}
        if (typeof onEgg === 'function') onEgg();
      }
      eggWeak = !eggOn && fed >= 2 ? 1 : 0;
      const beat = AUDIO.beat();
      const frame = eggOn ? Math.floor(beat * 2) % 3 : 0;
      const ghost = (eggWeak && Math.random() < .07) || (seenBefore && !eggOn && Math.floor(time / 2.2) % 5 === 4 && Math.floor(time * 4) % 3 === 0);
      const noise = eggWeak && !ghost && Math.random() < .35;
      const key = eggOn ? 'egg' + frame + (Math.floor(beat * 4) % 2) + (Math.floor(beat / 4) % 2) : ghost ? 'mark' : noise ? 'noise' + Math.floor(time * 30) : 'idle' + Math.floor(time / 2.2) % 2;
      u.glow.material.opacity = eggOn ? .35 + .15 * Math.sin(beat * Math.PI * 2) : eggWeak ? .1 + Math.random() * .08 : .06;
      u.glow.material.color.set(eggOn ? C.yellow : C.red);
      feedWire.material.color.set(eggOn ? C.red : eggWeak && Math.random() < .3 ? C.redDeep : '#2a2a28');
      if (u.key === key) return;
      u.key = key;
      c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, 384, 216);
      const cols = 96, rows = 54, cell = 4;
      const grid = { w: cols, h: rows, bits: new Uint8Array(cols * rows) };
      const hotGrid = { w: cols, h: rows, bits: new Uint8Array(cols * rows) };
      const put = (g, ox, oy, target = grid, hot = null) => { for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const x = ox + i, y = oy + j; if (x < 0 || y < 0 || x >= cols || y >= rows) continue; if (g.bits[j * g.w + i]) target.bits[y * cols + x] = 1; if (hot && hot[j * g.w + i]) hotGrid.bits[y * cols + x] = 1; } };
      const markGrid = (ox, oy, k) => { TEX.MARK.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { const x = ox + i * k + a, y = oy + j * k + b; if (x < cols && y < rows) grid.bits[y * cols + x] = 1; } })); };
      if (eggOn) {
        const b = bandGrid(frame);
        if (b) put(b, Math.floor((cols - b.w) / 2), 1, grid, b.hot);
        // 맨 아래 한 줄: 채널 이름과 방송 중 표시가 두 박자마다 번갈아
        const cap = LED.raster(Math.floor(beat / 4) % 2 ? 'CH03 ON AIR' : 'IDIOTAPE', F_PIX, 8, { bold: true });
        put(cap, Math.floor((cols - cap.w) / 2), rows - 8);
        LED.draw(c, grid, 0, 0, cell, C.red, { off: '#1d1c1b' });
        LED.draw(c, hotGrid, 0, 0, cell, C.yellow, {});
      } else if (ghost) {
        markGrid(27, 12, 6);
        LED.draw(c, grid, 0, 0, cell, C.red, { off: '#1d1c1b', hot: '#ff8a6a' });
      } else if (noise) {
        for (let i = 0; i < cols * rows; i++) grid.bits[i] = Math.random() < .28 ? 1 : 0;
        LED.draw(c, grid, 0, 0, cell, C.grey2, { off: '#1d1c1b' });
      } else {
        const txt = key.endsWith('1') ? 'CH 03' : 'NO SIGNAL';
        const g = LED.raster(txt, F_NUM, 8);
        put(g, Math.floor((cols - g.w) / 2), 16);
        put(LED.raster('▲ 감전 주의 ▲', F_KOPIX, 12), 22, 32);
        LED.draw(c, grid, 0, 0, cell, eggWeak ? C.red : C.grey2, { off: '#1d1c1b', hot: eggWeak ? '#ff8a6a' : null });
      }
      u.t.needsUpdate = true;
    }
    let onEgg = null;

    // 코스 위 한 점(s, x, y)을 화면 좌표(1920×1080 무대)로. 굽이 · 오르내림(정점 셰이더)과 같은 표로 옮긴 뒤 카메라로 비춘다
    const pv = new THREE.Vector3();
    function project(sAbs, x, y) {
      const d = sAbs - run.s;
      if (d < 2 || d > BEND_D) return null;
      const t = d / BEND_D * (BEND_N - 1), i0 = Math.floor(t), i1 = Math.min(i0 + 1, BEND_N - 1), f = t - i0;
      const bx = lerp(BEND.uBendX.value[i0], BEND.uBendX.value[i1], f), by = lerp(BEND.uBendY.value[i0], BEND.uBendY.value[i1], f);
      pv.set(x + bx, y + by, -d).project(cam);
      if (pv.z > 1 || pv.z < -1) return null;
      return [(pv.x * .5 + .5) * STAGE_W, (.5 - pv.y * .5) * STAGE_H, d];
    }

    return {
      init, reset, update, onEvent,
      setStartBoard: fn => { startBoardText = fn; },
      setFinish: v => { finishGlow = v; },
      setEggHandler: fn => { onEgg = fn; },
      eggActive: () => eggOn > 0,
      eggWeak: () => eggWeak > 0,
      setMode: m => { mode = m; },
      get mode() { return mode; },
      drainFx: () => fxq.splice(0, fxq.length),
      get dark() { return darkK; },
      get tunnel() { return inTunnel; },
      get exitT() { return exitT; },
      project,
      debug: () => ({ rows: [375, 500, 625, 750, 875].map(x => [x, rowLit(x), spanGate(x), gateLitAt[spanGate(x)]]), time, lamps: pylons.slice(0, 6).map(p => [p.position.z, p.userData.lamps[0].visible, p.visible]), cables: cablePool.filter(p => p.mesh.visible).map(p => [p.mesh.position.x, p.mesh.position.z, p.mesh.scale.z, p.u.uFade.value]), states: [...cableState.entries()] }),
      get scene() { return scene; }, get cam() { return cam; }, get rear() { return rear; },
      get time() { return time; }
    };
  })();

  /* ================= 화면 마무리: 속도 흐림 · 색 번짐 · 색 빠짐 · 종이 결 · 사이드미러 ================= */
  // 세계를 한 장에 그린 뒤, 화면 전체에 한 번만 셰이더를 지난다.
  // 효과는 '뜻'이 있을 때만: 속도(흐림) · 과전류(붉은 번짐) · 충돌(색 빠짐 · 번짐 튐) · 종이(늘 아주 약하게)

  const POST = (() => {
    let rt, rtMirror, mat, pscene, pcam, W = 1, H = 1;
    const U = {
      tScene: { value: null }, tMirror: { value: null }, tPaper: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2(.5, .44) },
      uBlur: { value: 0 }, uChroma: { value: 0 }, uDesat: { value: 0 }, uRed: { value: 0 },
      uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }, uVig: { value: .42 }, uGrain: { value: 1 }, uInk: { value: 0 },
      uMirL: { value: new THREE.Vector3(-1, -1, 0) }, uMirR: { value: new THREE.Vector3(-1, -1, 0) }, uMirOn: { value: 0 }, uMirRim: { value: 0 },
      uWarp: { value: 0 }, uWarpR: { value: 0 }, uExpo: { value: 1 }, uWhite: { value: 0 }, uEdge: { value: 0 }, uEdgeSide: { value: 0 },
      uRear: { value: new THREE.Vector4(0, 0, 0, 0) }, uRearOn: { value: 0 }
    };
    const frag = `
precision highp float;
uniform sampler2D tScene, tMirror, tPaper;
uniform vec2 uRes, uCenter; uniform float uTime, uBlur, uChroma, uDesat, uRed, uVig, uGrain, uInk, uMirOn, uMirRim;
uniform float uWarp, uWarpR, uExpo, uWhite, uEdge, uEdgeSide;
uniform vec4 uFlash, uRear; uniform vec3 uMirL, uMirR; uniform float uRearOn;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec3 mirror(vec2 px, vec3 m, vec3 col){
  vec2 d = (px - m.xy) / m.z;
  float r = length(d);
  if (r > 1.0 || m.z <= 0.0) return col;
  vec2 uv = vec2(.5 - d.x * .5, .5 + d.y * .5);
  vec3 c = texture2D(tMirror, uv).rgb;
  float l = dot(c, vec3(.299,.587,.114));
  c = mix(vec3(l), c, .85) * .9;
  // 고가 붕괴 중엔 거울 테두리가 붉게(뒤를 보라)
  c = mix(c, vec3(.898,.196,.176), smoothstep(.86, .97, r) * uMirRim);
  return mix(col, c, smoothstep(1.0, .96, r) * uMirOn);
}
void main(){
  vec2 uv = vUv;
  vec2 dir = uv - uCenter;
  float dist = length(dir * vec2(uRes.x / uRes.y, 1.0));
  // 충격파(과전류 · 큰 사건): 소실점에서 퍼지는 고리 하나가 화면을 순간 일그러뜨린다
  if (uWarp > 0.0) {
    float ring = smoothstep(.16, 0.0, abs(dist - uWarpR));
    uv += normalize(dir + 1e-5) * ring * uWarp;
    dir = uv - uCenter;
  }
  // 속도 흐림: 소실점 쪽으로 여러 번 겹쳐 읽는다. 가운데는 또렷하고 가장자리로 갈수록 흐르게
  float amt = uBlur * smoothstep(.12, .75, dist);
  float j = hash(uv * uRes + uTime) - .5;
  vec3 col = vec3(0.0); float tw = 0.0;
  for (int i = 0; i < 12; i++) {
    float t = (float(i) + j) / 11.0;
    float w = 1.0 - t * .55;
    col += texture2D(tScene, uv - dir * t * amt * .085).rgb * w; tw += w;
  }
  col /= tw;
  // 색 번짐(빨강 · 파랑 채널이 바깥으로 갈라진다)
  float ca = uChroma * smoothstep(.05, .8, dist);
  if (ca > 0.0) {
    col.r = mix(col.r, texture2D(tScene, uv + dir * ca * 4.0).r, .8);
    col.b = mix(col.b, texture2D(tScene, uv - dir * ca * 4.0).b, .8);
  }
  vec2 px = uv * uRes;
  col = mirror(px, uMirL, col);
  col = mirror(px, uMirR, col);
  // 후방 화면(고가 붕괴 때만): 사이드미러와 같은 뒤쪽 그림을 오른쪽 위 작은 모니터에. 거울처럼 좌우가 뒤집히고 주사선이 있다
  if (uRearOn > 0.0) {
    vec2 rp = (vUv * uRes - uRear.xy) / uRear.zw;
    if (rp.x > 0.0 && rp.x < 1.0 && rp.y > 0.0 && rp.y < 1.0) {
      vec3 rc = texture2D(tMirror, vec2(1.0 - rp.x, .18 + rp.y * .64)).rgb;
      rc *= .82 + .18 * step(.5, fract(rp.y * uRear.w / 3.0));
      col = mix(col, rc, uRearOn);
    }
  }
  // 색 빠짐(충돌 · 정전): 미래의 무채색으로
  float l = dot(col, vec3(.299,.587,.114));
  col = mix(col, vec3(l) * vec3(1.0, .99, .96), uDesat);
  // 과전류: 화면 가장자리부터 붉은 잉크가 번진다(가운데 길은 또렷하게 남긴다)
  vec3 hot = vec3(.898,.196,.176) * (.35 + l * .75);
  float edge = smoothstep(.38, 1.05, dist);
  col = mix(col, hot, uRed * edge);
  col = mix(col, col * vec3(1.0,.9,.88), uRed * .5);
  // 종이 결 + 가장자리 잉크
  float g = texture2D(tPaper, px / 256.0).r;
  col *= mix(1.0, .93 + g * .1, uGrain);
  float vig = smoothstep(.45, 1.15, dist);
  col *= 1.0 - vig * uVig;
  col = mix(col, vec3(.07), uInk * smoothstep(.25, 1.05, dist + hash(floor(px / 3.0)) * .12));
  // 속도에 따른 밝기(빠를수록 조금 밝고 또렷하게) · 터널을 나서는 순간의 하얀 빛
  col = clamp((col - .5) * (1.0 + (uExpo - 1.0) * .8) + .5 + (uExpo - 1.0) * .25, 0.0, 1.0);
  col = mix(col, vec3(1.0, .99, .95), uWhite * (.55 + .45 * smoothstep(.0, .9, dist)));
  // 위험 경고: 막힌 쪽 화면 가장자리가 노랗게 맥박친다(uEdgeSide -1 왼쪽 · 0 아래 · 1 오른쪽)
  if (uEdge > 0.0) {
    float e = uEdgeSide < -.5 ? smoothstep(.22, 0.0, vUv.x) : uEdgeSide > .5 ? smoothstep(.78, 1.0, vUv.x) : smoothstep(.2, 0.0, vUv.y) * smoothstep(.0, .3, abs(vUv.x - .5));
    col = mix(col, vec3(1.0, .76, .1), e * uEdge * .55);
  }
  col = mix(col, uFlash.rgb, uFlash.a);
  gl_FragColor = vec4(col, 1.0);
}`;
    const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

    function init(renderer) {
      rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });
      rtMirror = new THREE.WebGLRenderTarget(320, 320, { samples: 2 });
      U.tScene.value = rt.texture; U.tMirror.value = rtMirror.texture;
      const pt = new THREE.Texture(IMG.paper); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.needsUpdate = true;
      U.tPaper.value = pt;
      mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false });
      pscene = new THREE.Scene();
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false; pscene.add(q);
      pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    function resize(w, h) {
      W = w; H = h;
      rt.setSize(w, h);
      U.uRes.value.set(w, h);
    }
    function render(renderer, scene, cam, rear, mirrors) {
      if (mirrors || U.uRearOn.value > 0) {
        renderer.setRenderTarget(rtMirror);
        renderer.render(scene, rear);
      }
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.render(pscene, pcam);
    }
    return { init, resize, render, U, get size() { return [W, H]; } };
  })();

  /* ================= 1인칭 콕핏: 핸들 · LED 속도판 · 계기판 두 개 · 경고등 · 사이드미러 ================= */
  // 표지에서 오토바이 앞에 달린 노란 LED 판이 그대로 속도계가 된다(HUD가 화면 위가 아니라 기계 안에 있다)
  //   왼쪽 계기판 = 전류(CURRENT) · 오른쪽 계기판 = 회전수(RPM, 레드존) · 왼쪽 등 = 앞 차선 경고(노랑) · 오른쪽 등 = 전선 위(빨강)
  // 좌표는 콕핏 그림(2688×1520) 기준. 그림을 화면 폭에 맞추고 아래로 조금 내려 핸들이 화면 아래쪽에 오게 한다

  const COCKPIT = (() => {
    let cv, ctx, W = 1920, H = 1080, dpr = 1;
    const IW = 2688, IH = 1520;
    const GAUGE_L = [1082, 993], GAUGE_R = [1598, 993], GR = 122;
    const PANEL = { x: 1116, y: 776, w: 438, h: 84 }, COLS = 80, ROWS = 14, TZ = 50, TW = 30; // TZ · TW: 오른쪽 작은 칸
    const MIR_L = [164, 758, 116], MIR_R = [2523, 752, 116];
    const LAMP_WARN = [1267, 912], LAMP_LIVE = [1417, 912];
    let k = 1, ox = 0, oy = 0;
    const tf = { roll: 0, x: 0, y: 0 };
    const notes = { left: [], right: [] }, hazards = new Map();
    const lines = [], pix = [], specks = [], shards = [], hints = [];
    let tickerMsg = null, tickerT = 0, panelBoot = 0, panelOff = 0;

    function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); }
    function resize(w, h, ratio) {
      W = w; H = h; dpr = ratio;
      cv.width = Math.round(w * ratio); cv.height = Math.round(h * ratio);
      k = W / IW * 1.08; ox = (W - IW * k) / 2; oy = H * .6 - 604 * k;   // 바람막이 윗선이 화면 60% 높이에 오도록
    }
    // 콕핏 그림 좌표 → 화면 좌표(흔들림 · 기울기 포함)
    function toScreen(px, py) {
      let x = ox + px * k + tf.x, y = oy + py * k + tf.y;
      const cx = W / 2, cy = H * 1.1, c = Math.cos(tf.roll), s = Math.sin(tf.roll);
      const dx = x - cx, dy = y - cy;
      return [cx + dx * c - dy * s, cy + dx * s + dy * c];
    }
    function mirrors() {
      const a = toScreen(MIR_L[0], MIR_L[1]), b = toScreen(MIR_R[0], MIR_R[1]);
      return { L: [a[0], a[1], MIR_L[2] * k], R: [b[0], b[1], MIR_R[2] * k] };
    }

    /* ---------- 속도선: 잉크 붓 자국이 소실점에서 바깥으로 ----------
       아주 빠를 때와 과전류엔 색 있는 빛줄기(노랑 = 가로등 · 빨강 = 내 전류)가 섞이고, 가장자리로 먼지가 스친다 */
    function speedLines(dt, v, boost, vp, surge) {
      const want = clamp((v - 140) / 260, 0, 1) * 34 + boost * 30 + surge * 18;
      while (lines.length < want) {
        const hot = boost > 0 || surge > .2 ? Math.random() < .5 : v > 330 && Math.random() < .18;
        lines.push({ a: Math.random() * Math.PI * 2, r: .25 + Math.random() * .3, len: .05 + Math.random() * .12 + (hot ? .1 : 0), sp: .9 + Math.random() * 1.2, w: .6 + Math.random() * 1.8 + (hot ? 1.2 : 0), col: hot ? (boost > 0 || Math.random() < .5 ? 'r' : 'y') : 'k' });
      }
      const diag = Math.hypot(W, H) * .6;
      ctx.lineCap = 'round';
      for (let i = lines.length - 1; i >= 0; i--) {
        const l = lines[i];
        l.r += l.sp * dt * (1 + v / 220) * (1 + boost * 1.5 + surge);
        if (l.r > 1.25 || i >= want + 2) { lines.splice(i, 1); continue; }
        const c = Math.cos(l.a), s = Math.sin(l.a) * .62;
        const r0 = l.r * diag, r1 = (l.r + l.len * (1 + v / 300)) * diag;
        const alpha = Math.min(1, (l.r - .25) * 3) * .55;
        if (Math.abs(s * r0) > H * .55 && s > 0) continue;   // 콕핏 아래쪽은 건너뛴다
        ctx.strokeStyle = l.col === 'r' ? `rgba(229,50,45,${alpha})` : l.col === 'y' ? `rgba(255,194,26,${alpha})` : `rgba(20,20,20,${alpha * .7})`;
        ctx.lineWidth = l.w * (1 + l.r);
        ctx.beginPath(); ctx.moveTo(vp[0] + c * r0, vp[1] + s * r0); ctx.lineTo(vp[0] + c * r1, vp[1] + s * r1); ctx.stroke();
      }
      // 가장자리를 스치는 먼지(가까운 것일수록 빠르다: 원근 차이로 속도를 읽는다)
      const sw = clamp((v - 200) / 200, 0, 1) * 10 + surge * 8;
      if (Math.random() < sw * dt * 6) specks.push({ a: Math.random() * Math.PI * 2, r: .55, sp: 2.4 + Math.random() * 2, s: 2 + Math.random() * 4 });
      for (let i = specks.length - 1; i >= 0; i--) {
        const p = specks[i]; p.r += p.sp * dt * (1 + v / 200);
        if (p.r > 1.3) { specks.splice(i, 1); continue; }
        const c = Math.cos(p.a), s = Math.sin(p.a) * .62, r = p.r * diag;
        if (s > 0 && Math.abs(s * r) > H * .5) continue;
        ctx.fillStyle = `rgba(30,28,25,${.55 * Math.min(1, (p.r - .55) * 4)})`;
        ctx.save(); ctx.translate(vp[0] + c * r, vp[1] + s * r); ctx.rotate(p.a); ctx.fillRect(-p.s * 3 * p.r, -p.s / 2, p.s * 6 * p.r, p.s); ctx.restore();
      }
    }

    /* ---------- 부서진 파편이 카메라 바로 앞을 스쳐 간다(과전류로 부술 때) ----------
       부딪힌 자리(소실점 아래)에서 바깥으로, 가까워질수록 커지며 화면 밖으로 빠진다. 잉크 테두리 + 재질 색 */
    const SHARD = {
      concrete: ['#6f6b63', '#8a8a8a', '#bcb7ab', C.yellow],
      barricade: [C.yellow, '#1b1b1b', '#bdbdbd', C.red],
      metal: ['#2a2a28', '#5d5c58', '#bdbdbd'],
      glass: ['rgba(255,255,255,.88)', 'rgba(238,234,224,.75)', 'rgba(255,255,255,.6)'],
      electric: [C.yellow, '#ffffff', C.yellowHot]
    };
    function shatter(kind, vp, n = 16) {
      const cols = SHARD[kind] || SHARD.concrete, ox = vp[0], oy = vp[1] + 120;
      for (let i = 0; i < n; i++) {
        const a = (Math.random() - .5) * Math.PI * 1.7 - Math.PI / 2 + (Math.random() < .5 ? Math.PI : 0) * .0, sp = 900 + Math.random() * 1500;
        const ang = Math.random() * Math.PI * 2, dirx = Math.cos(ang), diry = Math.sin(ang) * .7 - .25;
        const pts = []; const m = 3 + (Math.random() < .5 ? 1 : 0);
        for (let k = 0; k < m; k++) { const q = k / m * Math.PI * 2 + Math.random() * .8; pts.push([Math.cos(q) * (.5 + Math.random() * .5), Math.sin(q) * (.5 + Math.random() * .5)]); }
        shards.push({ x: ox + dirx * 40, y: oy + diry * 40, vx: dirx * sp, vy: diry * sp, r: Math.random() * 6, vr: (Math.random() - .5) * 18, s: 10 + Math.random() * 26, life: .26 + Math.random() * .22, col: cols[i % cols.length], pts, line: kind === 'electric' && i % 2 === 0 });
      }
      while (shards.length > 90) shards.shift();
    }
    function drawShards(dt) {
      for (let i = shards.length - 1; i >= 0; i--) {
        const p = shards[i];
        p.life -= dt; if (p.life <= 0) { shards.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.r += p.vr * dt; p.s *= 1 + 3.2 * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life * 6);
        if (p.line) { ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-p.s, 0); ctx.lineTo(-p.s * .2, p.s * .3); ctx.lineTo(p.s * .3, -p.s * .2); ctx.lineTo(p.s, 0); ctx.stroke(); }
        else {
          ctx.beginPath(); p.pts.forEach(([a, b], k) => k ? ctx.lineTo(a * p.s, b * p.s) : ctx.moveTo(a * p.s, b * p.s)); ctx.closePath();
          ctx.fillStyle = p.col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 조작 안내: 화면 왼쪽 아래 작은 판(키 = 노랑, 이름 = 종이색). 잠깐 떴다가 사라진다 ---------- */
    function hint(tag, key, label, life = 4) {
      if (hints.some(h => h.tag === tag && h.t < h.life)) return;
      const a = LED.word(key, { color: C.yellow, cell: 3 }), b = LED.word(label, { color: '#eeeae0', cell: 3, hot: '#ffffff' });
      const cv = document.createElement('canvas'); cv.width = a.width + b.width + 6; cv.height = Math.max(a.height, b.height);
      const x = cv.getContext('2d'); x.drawImage(a, 0, 0); x.drawImage(b, a.width + 6, 0);
      hints.push({ tag, img: cv, t: 0, life });
    }
    function dismissHint(tag) { for (const h of hints) if (h.tag === tag && h.t < h.life - .4) h.t = h.life - .4; }
    function drawHints(dt) {
      let y = H * .57;
      for (let i = hints.length - 1; i >= 0; i--) {
        const h = hints[i];
        h.t += dt;
        if (h.t > h.life) { hints.splice(i, 1); continue; }
        const a = Math.min(1, h.t / .25, (h.life - h.t) / .4);
        ctx.globalAlpha = a; ctx.drawImage(h.img, 30 - (1 - Math.min(1, h.t / .25)) * 30, y - h.img.height); ctx.globalAlpha = 1;
        y -= h.img.height + 8;
      }
    }

    /* ---------- 앞바퀴에서 튀는 LED 조각(표지의 붉은 픽셀 잔상) ---------- */
    function pixelTrail(dt, live, boost, v) {
      const rate = (live ? 26 : 0) + boost * 70;
      let n = rate * dt + Math.random();
      while (n-- > 1) {
        const side = Math.random() < .5 ? -1 : 1;
        pix.push({ x: W / 2 + side * (40 + Math.random() * 160), y: H * (.9 + Math.random() * .1), vx: side * (300 + Math.random() * 700) * (1 + v / 300), vy: 120 + Math.random() * 260, life: .3 + Math.random() * .3, max: .5, s: 5 + Math.random() * 7, col: Math.random() < .62 ? C.red : (Math.random() < .6 ? C.yellow : C.redHot) });
      }
      for (let i = pix.length - 1; i >= 0; i--) {
        const p = pix[i];
        p.life -= dt; if (p.life <= 0) { pix.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.s += 40 * dt;
        const s = Math.round(p.s);
        ctx.globalAlpha = Math.min(1, p.life / .2);
        ctx.fillStyle = '#000'; ctx.fillRect(p.x - 1, p.y - 1, s + 2, s + 2);
        ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, s, s);
        ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.fillRect(p.x + s * .35, p.y + s * .35, s * .3, s * .3);
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- LED 속도판 ---------- */
    const panelGrid = { w: COLS, h: ROWS, bits: new Uint8Array(COLS * ROWS) };
    const hotGrid = { w: COLS, h: ROWS, bits: new Uint8Array(COLS * ROWS) };
    function blit(g, ox2, oy2, target = panelGrid, x0 = 0, x1 = COLS) {
      for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) {
        const x = ox2 + i, y = oy2 + j;
        if (x >= x0 && y >= 0 && x < x1 && y < ROWS) target.bits[y * COLS + x] = 1;
      }
    }
    let glowBuf = null;
    function glowData() {
      if (!glowBuf) { const c = document.createElement('canvas'); c.width = COLS; c.height = ROWS; const x = c.getContext('2d'); glowBuf = { cv: c, ctx: x, img: x.createImageData(COLS, ROWS) }; }
      return glowBuf;
    }
    function drawPanel(st) {
      panelGrid.bits.fill(0); hotGrid.bits.fill(0);
      const t = st.time;
      let col = st.boost ? C.red : C.yellow, hot = st.boost ? '#ffb08a' : C.yellowHot;
      if (panelBoot > 0) {
        // 켜질 때: 점이 왼쪽에서 오른쪽으로 쓸고 지나간 뒤 TRACK 03
        const p = 1 - panelBoot / UI.boot;
        if (p < .45) { const cx = Math.floor(p / .45 * COLS); for (let y = 0; y < ROWS; y++) for (let x = Math.max(0, cx - 6); x < cx; x++) panelGrid.bits[y * COLS + x] = 1; }
        else { blit(LED.raster('IDT 03', F_NUM, 8), 4, 3); blit(LED.raster('RAWQ', F_PIX, 8, { bold: true }), 52, 4); }
      } else if (panelOff > 0) {
        if (Math.random() < .25) blit(LED.raster('NO POWER', F_PIX, 8, { bold: true }), 14, 4);
        col = C.grey2;
      } else {
        // 속도(왼쪽, 큰 숫자)
        const kmhv = Math.round(st.kmh);
        const str = String(kmhv).padStart(3, ' ');
        for (let i = 0; i < 3; i++) if (str[i] !== ' ') blit(LED.raster(str[i], F_NUM, 16), 1 + i * 16, 0);
        // 오른쪽 작은 칸: 위 줄 단위/알림, 아래 줄 단 · 상태
        let top = 'KM/H', bot = 'G' + st.gear;
        if (st.attract) { top = 'PRESS ANY KEY'; bot = Math.floor(t * 1.5) % 2 ? 'TRK03' : 'IDLE'; }
        else if (tickerMsg && tickerT > 0) { top = tickerMsg[0]; bot = tickerMsg[1] ?? bot; }
        else if (st.full && !st.boost) { top = Math.floor(t * 3) % 2 ? 'PUSH' : 'SPACE'; bot = 'MAX'; }
        else if (st.boost) { top = 'OVER'; bot = 'LOAD'; }
        else if (st.live) bot = 'LIVE';
        const g1 = LED.raster(top, F_PIX, 8, { bold: true }), g2 = LED.raster(bot, F_PIX, 8, { bold: true });
        const scroll = (g, row) => {
          if (g.w <= TW) blit(g, TZ + Math.floor((TW - g.w) / 2), row, panelGrid, TZ, COLS);
          else blit(g, TZ + TW - Math.floor((t * 18) % (g.w + TW)), row, panelGrid, TZ, COLS);
        };
        scroll(g1, 1); scroll(g2, 8);
        for (let y = 1; y < ROWS - 1; y += 2) panelGrid.bits[y * COLS + TZ - 2] = 1;
      }
      // 화면 좌표로 그린다: 칸을 판 안에 맞춰 찍는다
      const cw = PANEL.w / COLS, ch = PANEL.h / ROWS, cs = Math.min(cw, ch);
      ctx.save();
      ctx.translate(PANEL.x, PANEL.y);
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(-4, -4, PANEL.w + 8, PANEL.h + 8);
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const on = panelGrid.bits[j * COLS + i];
        LED.dot(ctx, i * cw, j * ch, cs, on ? col : '#242320', on ? hot : null);
      }
      // 번짐: 켜진 점을 1칸 = 1px인 작은 그림에 찍고, 한 번에 흐리게 늘려 겹친다
      const gd = glowData(), rgb = col === C.red ? [229, 50, 45] : col === C.grey2 ? [138, 138, 138] : [255, 194, 26];
      for (let i = 0; i < COLS * ROWS; i++) { const on = panelGrid.bits[i]; gd.img.data[i * 4] = rgb[0]; gd.img.data[i * 4 + 1] = rgb[1]; gd.img.data[i * 4 + 2] = rgb[2]; gd.img.data[i * 4 + 3] = on ? 255 : 0; }
      gd.ctx.putImageData(gd.img, 0, 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .6; ctx.filter = 'blur(6px)'; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(gd.cv, 0, 0, PANEL.w, PANEL.h);
      ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    /* ---------- 계기판 ---------- */
    const A0 = Math.PI * .75, SWEEP = Math.PI * 1.5;   // 7시 반 → 4시 반, 시계 방향
    function needle(cx, cy, r, f, jit) {
      const a = A0 + SWEEP * f + jit;
      const x1 = cx + Math.cos(a) * r * .82, y1 = cy + Math.sin(a) * r * .82;
      const x0 = cx - Math.cos(a) * r * .14, y0 = cy - Math.sin(a) * r * .14;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = '#e9e3d4'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const xt = cx + Math.cos(a) * r * .6, yt = cy + Math.sin(a) * r * .6;
      ctx.strokeStyle = C.red; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(xt, yt); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a5955'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 7); ctx.fill();
    }
    function label(cx, cy, txt) {
      ctx.font = `700 15px ${F_PIX}`; ctx.textAlign = 'center'; ctx.fillStyle = '#d9d3c4'; ctx.fillText(txt, cx, cy);
    }
    function gauges(st) {
      // 왼쪽: 전류. 바깥 링에 붉은 LED 12칸
      const [lx, ly] = GAUGE_L, n = 12, lit = Math.ceil(st.current * n - .001);
      for (let i = 0; i < n; i++) {
        const a = A0 + SWEEP * (i + .5) / n;
        const on = i < lit && (!st.full || st.boost || Math.floor(st.time * 6) % 2 === 0);
        ctx.save(); ctx.translate(lx + Math.cos(a) * GR * .66, ly + Math.sin(a) * GR * .66); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = '#000'; ctx.fillRect(-11, -6, 22, 12);
        ctx.fillStyle = on ? C.red : '#33302c'; ctx.fillRect(-9, -4.5, 18, 9);
        if (on) { ctx.fillStyle = '#ff9a7a'; ctx.fillRect(-3, -1.5, 6, 3); }
        ctx.restore();
      }
      if (st.current > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 * st.current;
        const g = ctx.createRadialGradient(lx, ly, 10, lx, ly, GR); g.addColorStop(0, 'rgba(229,50,45,.0)'); g.addColorStop(.7, 'rgba(229,50,45,.35)'); g.addColorStop(1, 'rgba(229,50,45,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, GR, 0, 7); ctx.fill(); ctx.restore();
      }
      label(lx, ly + GR * .52, 'CURRENT');
      needle(lx, ly, GR, st.current, 0);
      // 오른쪽: 회전수. 레드존(빨간 띠)은 늘 그려져 있다
      const [rx, ry] = GAUGE_R;
      ctx.strokeStyle = C.red; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(rx, ry, GR * .86, A0 + SWEEP * .82, A0 + SWEEP); ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx, ry, GR * .86 + 5, A0 + SWEEP * .82, A0 + SWEEP); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx, ry, GR * .86 - 5, A0 + SWEEP * .82, A0 + SWEEP); ctx.stroke();
      label(rx, ry + GR * .52, 'RPM');
      // 단수: 가운데 아래 작은 노랑 LED
      const gg = LED.raster(String(st.gear), F_NUM, 8);
      ctx.save(); ctx.translate(rx - 15, ry + 26);
      LED.draw(ctx, gg, 0, 0, 4.2, C.yellow, { hot: C.yellowHot });
      ctx.restore();
      const jit = st.rpm > .9 ? (Math.random() - .5) * .05 : (Math.random() - .5) * .008;
      needle(rx, ry, GR, clamp(st.rpm, 0, 1), jit);
    }
    function lamp(p, col, on) {
      const [x, y] = p;
      ctx.fillStyle = on ? col : '#3a1513'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
      if (!on) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 2, x, y, 46); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3.5, 0, 7); ctx.fill();
      ctx.restore();
    }

    /* ---------- 화면 알림: 가운데 시야를 비우고 가장자리에 작은 LED 판 ----------
       왼쪽 = 방금 내가 한 일(GRID · MISS · CLOSE · SHORT · OVERLOAD), 오른쪽 = 곧 올 위험(MERGE · ONCOMING · COLLAPSE)
       타이틀 레터링과 같은 문법(검은 계단 판 · LED 칸 · 기울임)을 작게. 가장자리에서 미끄러져 들어와 짧게 머문다 */
    const TOP = 104, EDGE = 24;
    function callout(text, color = C.red, o = {}) {
      const list = notes[o.side || 'left'];
      if (o.replace) for (let i = list.length - 1; i >= 0; i--) if (list[i].tag === o.replace) list.splice(i, 1);
      list.push({
        img: LED.word(text, { color, cell: o.cell || 4, font: o.font, px: o.px }),
        sub: o.sub ? LED.word(o.sub, { color: o.subColor || C.yellow, cell: o.subCell || 2.4, font: o.subFont || F_KOPIX, px: o.subPx || 12, shear: .12 }) : null,
        t: 0, life: o.life || UI.callout, tag: o.tag || text, y: o.y
      });
      while (list.length > 3) list.shift();
    }
    function drawNotes(dt, side, y0) {
      const list = notes[side];
      let y = y0;
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        c.t += dt;
        if (c.t > c.life) { list.splice(i, 1); continue; }
        const p = c.t / c.life, slide = 1 - Math.pow(1 - Math.min(1, c.t / .16), 3);
        const a = p > .78 ? 1 - (p - .78) / .22 : 1;
        const flick = c.t < .14 && Math.random() < .35 ? .25 : 1;
        const iw = c.img.width, ih = c.img.height;
        const yy = c.y != null ? H * c.y : y;
        const x = side === 'left' ? EDGE - (1 - slide) * (iw + 40) : W - EDGE - iw + (1 - slide) * (iw + 40);
        ctx.globalAlpha = a * flick;
        ctx.drawImage(c.img, x, yy, iw, ih);
        let h = ih;
        if (c.sub) { const sw = c.sub.width, sx = side === 'left' ? x + 6 : x + iw - sw - 6; ctx.drawImage(c.sub, sx, yy + ih - 6, sw, c.sub.height); h += c.sub.height - 6; }
        ctx.globalAlpha = 1;
        if (c.y == null) y += h + 8;
      }
      return y;
    }
    // 이어지는 위험(붕괴 추격 · 방전 구간 · 정전): 오른쪽 맨 위 고정 판. 매 프레임 다시 불러야 남는다
    function hazard(key, text, o = {}) { const h = hazards.get(key) || { t: 0 }; Object.assign(h, { text, val: o.val ?? -1, max: o.max || 1, col: o.col || C.yellow, label: o.label || '', seen: .2 }); hazards.set(key, h); }
    function drawHazards(dt) {
      let y = TOP;
      for (const [key, h] of hazards) {
        h.seen -= dt; h.t += dt;
        if (h.seen <= 0) { hazards.delete(key); continue; }
        const img = LED.word(h.text, { color: h.col, cell: 4 }), iw = img.width, ih = img.height;
        const slide = 1 - Math.pow(1 - Math.min(1, h.t / .16), 3), x = W - EDGE - iw + (1 - slide) * (iw + 40);
        ctx.globalAlpha = Math.floor(h.t * 4) % 2 || h.t > 1.2 ? 1 : .55;
        ctx.drawImage(img, x, y, iw, ih);
        ctx.globalAlpha = 1;
        y += ih + 2;
        if (h.val >= 0) {
          // 거리 막대: 가까울수록 짧고 붉게. 숫자는 Press Start
          const bw = iw - 20, f = clamp(h.val / h.max, 0, 1), bx = x + 10;
          ctx.fillStyle = '#000'; ctx.fillRect(bx - 3, y - 3, bw + 6, 14);
          ctx.fillStyle = '#2b2a27'; ctx.fillRect(bx, y, bw, 8);
          ctx.fillStyle = f < .35 ? (Math.floor(h.t * 8) % 2 ? C.red : C.yellow) : C.yellow; ctx.fillRect(bx, y, bw * f, 8);
          ctx.font = `14px ${F_NUM}`; ctx.textAlign = 'right'; ctx.fillStyle = '#000';
          ctx.fillText(h.label, x + iw - 8 + 2, y + 32); ctx.fillStyle = '#fff'; ctx.fillText(h.label, x + iw - 8, y + 30);
          y += 40;
        }
        y += 8;
      }
      return y;
    }
    // 화면 위 표시(AR): 위험물 둘레에 노란 모서리 괄호 + 거리. 물체를 가리지 않고 테두리만
    function drawMarks(marks) {
      ctx.lineCap = 'square';
      for (const m of marks) {
        const sz = clamp(2400 / m.d, 16, 80) * (m.scale || 1), x = m.x, y = m.y - sz * .35, a = clamp((m.d - 6) / 30, 0, 1) * clamp((560 - m.d) / 120, 0, 1);
        if (a <= 0) continue;
        const blink = m.urgent && Math.floor(performance.now() / 90) % 2 ? .4 : 1;
        ctx.globalAlpha = a * blink;
        const L = sz * .32, x0 = x - sz, x1 = x + sz, y0 = y - sz * .75, y1 = y + sz * .75;
        for (const [w, col] of [[6, '#000'], [2.6, m.col || C.yellow]]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
          ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
          ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
          ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
          ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L);
          ctx.stroke();
        }
        if (m.label) {
          ctx.font = `700 15px ${F_PIX}`; ctx.textAlign = 'left';
          ctx.fillStyle = '#000'; ctx.fillText(m.label, x1 + 6 + 2, y0 + 12 + 2);
          ctx.fillStyle = m.col || C.yellow; ctx.fillText(m.label, x1 + 6, y0 + 12);
        }
        ctx.globalAlpha = 1;
      }
    }

    // 후방 화면 테두리(그림은 POST 셰이더가 칠한다): 검은 판 + 위에 REAR 이름표, 붉은 맥박
    const REAR = { x: 1606, y: 214, w: 290, h: 170 };
    function rearFrame(a) {
      if (a <= 0) return;
      const { x, y, w, h } = REAR, t = performance.now() / 1000;
      ctx.globalAlpha = a;
      ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
      ctx.lineWidth = 3; ctx.strokeStyle = Math.floor(t * 6) % 2 ? C.red : '#5d1512'; ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 5, y + h + 2, 92, 22);
      ctx.font = `700 14px ${F_PIX}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.red; ctx.fillText('● REAR', x + 2, y + h + 18);
      ctx.globalAlpha = 1;
    }

    // 계기판 사이 막대에 붙은 라벨 테이프(일련번호). 그냥 부품 번호처럼 보인다
    function dashLabel() {
      ctx.save();
      ctx.translate(1343, 1090); ctx.rotate(-.035);
      ctx.fillStyle = '#0d0d0d'; ctx.fillRect(-82, -15, 164, 30);
      ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-78, -12, 156, 24);
      ctx.font = `700 17px ${F_PIX}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText('S/N 11111101', 1, 2);
      ctx.fillStyle = '#d9d4c7'; ctx.fillText('S/N 11111101', 0, 0);
      ctx.restore();
    }

    /* ---------- 한 프레임 ---------- */
    function draw(st, dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      tickerT = Math.max(0, tickerT - dt);
      panelBoot = Math.max(0, panelBoot - dt);
      if (st.show) {
        speedLines(dt, st.kmh, st.boost ? 1 : 0, st.vp, st.surge || 0);
        if (st.marks) drawMarks(st.marks);
        drawShards(dt);
        pixelTrail(dt, st.live, st.boost ? 1 : 0, st.kmh);
        // 가속하면 몸이 뒤로 밀리듯 콕핏이 조금 내려가고 커진다. 출발 화면에선 아래에 내려가 있다가 올라온다
        const push = st.push || 0, rise = st.rise || 0;
        tf.roll = st.roll; tf.x = st.swayX; tf.y = st.bobY + rise + push * 16;
        ctx.save();
        const cx = W / 2, cy = H * 1.1, zs = 1 + push * .018;
        ctx.translate(cx + tf.x, cy + tf.y); ctx.rotate(tf.roll); ctx.scale(zs, zs); ctx.translate(-cx, -cy);
        ctx.translate(ox, oy); ctx.scale(k, k);
        if (IMG.cockpit) ctx.drawImage(IMG.cockpit, 0, 0);
        dashLabel();
        drawPanel(st);
        gauges(st);
        lamp(LAMP_WARN, C.yellow, st.warn && Math.floor(st.time * (st.warnFast ? 14 : 8)) % 2 === 0);
        lamp(LAMP_LIVE, C.red, st.live || st.boost);
        ctx.restore();
      }
      const yl = drawNotes(dt, 'left', TOP);
      drawHints(dt);
      const yr = drawHazards(dt);
      rearFrame(st.rear || 0);
      drawNotes(dt, 'right', st.rear > 0 ? Math.max(yr, REAR.y + REAR.h + 40) : yr);
    }

    return {
      init, resize, draw, callout, hazard, mirrors, REAR, shatter, hint, dismissHint,
      dismiss(tag) { for (const side of ['left', 'right']) { const l = notes[side]; for (let i = l.length - 1; i >= 0; i--) if (l[i].tag === tag) l.splice(i, 1); } },
      ticker(top, bot, t = 1.2) { tickerMsg = [top, bot]; tickerT = t; },
      boot() { panelBoot = UI.boot; },
      powerOff(v) { panelOff = v; },
      clearFx() { lines.length = 0; pix.length = 0; specks.length = 0; shards.length = 0; hints.length = 0; notes.left.length = 0; notes.right.length = 0; hazards.clear(); },
      get size() { return [W, H]; }
    };
  })();

  /* ================= 위쪽 띠 HUD: 발표 자료 머리말(● 번호 · 제목 · 쪽수)과 같은 문법 ================= */
  // 왼쪽: ● 03 LIVE WIRE RACER · 구간 / 가운데: 노선도(게이트 24개, 비넬리 지하철 노선도처럼) / 오른쪽: GRID · TIME · SCORE · 퓨즈
  // 숫자는 Press Start 2P, 이름표는 Silkscreen — 표지 뒷면과 같은 글꼴 규칙

  function reelSVG(cls = '') {
    const teeth = [0, 60, 120, 180, 240, 300].map(a => `<rect x="99" y="76" width="12" height="13" fill="#111" transform="rotate(${a} 105 105)"/>`).join('');
    const segs = [0, 120, 240].map(a => `<path d="${arcPath(105, 105, 93, a + 6, a + 114)}" stroke="#e5322d" stroke-width="22" fill="none" transform=""/>`).join('');
    return `<svg class="reel ${cls}" viewBox="0 0 210 210" aria-hidden="true">
<circle cx="105" cy="105" r="105" fill="#111"/>${segs}
<circle cx="105" cy="105" r="80" fill="#141414" stroke="#000" stroke-width="3"/>
<text x="105" y="58" class="reel-track">TRACK</text>
<g class="reel-hub"><circle cx="105" cy="105" r="32" fill="#ece8de"/>${teeth}<circle cx="105" cy="105" r="9" fill="#111"/></g>
<text x="105" y="166" class="reel-no">03</text></svg>`;
  }
  function arcPath(cx, cy, r, a0, a1) {
    const p = a => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  const HUD = (() => {
    const $ = id => document.getElementById(id);
    let el, dots = [], last = {}, tickT = 0;
    function init(course) {
      el = $('hud');
      $('hReel').innerHTML = reelSVG('reel-sm');
      const route = $('hStops'); route.innerHTML = '';
      dots = course.gates.map(g => {
        const d = document.createElement('i');
        d.className = 'stop';
        d.style.left = (g.s / course.length * 100) + '%';
        route.appendChild(d);
        return d;
      });
      for (const z of SECTORS) {
        if (!z.from) continue;
        const t = document.createElement('b'); t.className = 'tick'; t.style.left = (z.from / course.length * 100) + '%';
        t.textContent = pad2(z.no); route.appendChild(t);
      }
      const end = document.createElement('b'); end.className = 'tick tick-end'; end.style.left = '100%'; end.textContent = 'SUB'; route.appendChild(end);
      $('hTotal').textContent = pad2(course.gates.length);
    }
    function set(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
    function update(run, course, dt) {
      const sec = course.sectorAt(run.s);
      set('hSecNo', 'SECTOR ' + pad2(sec.no));
      set('hSecName', sec.ko);
      set('hGrid', pad2(run.lit));
      set('hTime', fmtTime(run.time));
      set('hScore', String(Math.round(run.score)).padStart(7, '0'));
      const p = clamp(run.s / course.length, 0, 1);
      if (Math.abs((last.p || 0) - p) > .0005) {
        last.p = p;
        $('hFill').style.transform = `scaleX(${p})`;
        $('hMe').style.left = (p * 100) + '%';
      }
      for (let i = 0; i < dots.length; i++) {
        const st = run.gates[i];
        const cls = st === 1 ? 'stop on' : st === -1 ? 'stop miss' : (i === run.gateIx ? 'stop next' : 'stop');
        if (dots[i].className !== cls) dots[i].className = cls;
      }
      const fz = $('hFuses').children;
      for (let i = 0; i < fz.length; i++) { const c = i < run.fuses ? 'fuse' : 'fuse blown'; if (fz[i].className !== c) fz[i].className = c; }
      const ch = run.chain >= 2 ? 'CHAIN ' + run.chain : '';
      set('hChain', ch);
      $('hReel').style.setProperty('--spin', (1.6 - clamp(kmh(run.v) / 480, 0, 1) * 1.45).toFixed(2) + 's');
    }
    let hideTimer = 0;
    function show(v) { clearTimeout(hideTimer); el.classList.remove('out'); el.hidden = !v; if (v) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } }
    // 끝날 때: 띠가 위로 걷힌 뒤 숨긴다
    function hide() { if (el.hidden) return; el.classList.remove('in'); el.classList.add('out'); clearTimeout(hideTimer); hideTimer = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 600); }
    function reset() { last = {}; tickT = 0; $('hTick').classList.remove('on'); }
    // 알림 띠: 영문 이름표(노랑) + 한글 한 줄. warn이면 이름표가 몇 번 깜빡인다
    function tick(en, ko, warn = false, life = UI.ticker) {
      const t = $('hTick');
      $('hTickEn').textContent = en; $('hTickKo').textContent = ko;
      t.classList.remove('warn'); void t.offsetWidth;
      t.classList.add('on'); t.classList.toggle('warn', warn);
      tickT = life;
    }
    function step(dt) { if (tickT > 0 && (tickT -= dt) <= 0) $('hTick').classList.remove('on'); }
    // 큰 충격 때 띠가 잠깐 떨린다
    function jolt(k) { const b = el.querySelector('.band'); b.style.setProperty('--jx', ((Math.random() - .5) * 14 * k).toFixed(1) + 'px'); b.style.setProperty('--jy', ((Math.random() - .5) * 8 * k).toFixed(1) + 'px'); }
    return { init, update, show, hide, reset, tick, step, jolt };
  })();

  /* ================= 화면: 불러오기 · 타이틀 · 엔딩 · 일시정지 ================= */
  // 타이틀과 엔딩은 따로 그린 화면이 아니다. 게임 화면 그대로 위에 글자만 얹는다. 둘은 같은 자리 · 같은 글자다
  //   타이틀: 위 = 6주차 표지의 LIVE WIRE RACER 레터링, 아래 = START
  //   엔딩:   위 = FINISH(또는 BLACKOUT, 같은 LED 칸), 가운데 = 한 줄 기록, 아래 = RESTART(START와 같은 판)
  // 켜질 땐 LED 칸이 왼쪽부터, 걷힐 땐 오른쪽부터 꺼진다. 설명 화면은 없다: 조작은 달리면서 화면 구석의 작은 안내로 익힌다(cockpit.js의 hint)

  const SCREENS = (() => {
    const $ = id => document.getElementById(id);
    let titleCv, tctx, startCv, sctx, startImg = null, endCv, ectx, tw = 0, th = 0, titleT = 0, leaveT = -1, ratio = 1;

    function init() {
      $('lReel').innerHTML = reelSVG('reel-md');
      titleCv = $('tTitle'); tctx = titleCv.getContext('2d');
      startCv = $('tStart'); sctx = startCv.getContext('2d');
      endCv = $('eEnd'); ectx = endCv.getContext('2d');
    }
    function resize(r0) {
      const r = ratio = Math.min(2, r0);
      tw = 1060; th = Math.round(1060 * 1081 / 2512);
      titleCv.width = Math.round(tw * r); titleCv.height = Math.round(th * r); tctx.setTransform(r, 0, 0, r, 0, 0);
      // START: 레터링과 같은 LED 칸 · 검은 계단 판 · 기울임(led.js의 word). 노랑 = 기계 신호(계기판 LED 판과 같은 색)
      startImg = LED.word('START', { color: C.yellow, cell: 6 });
      startCv.width = Math.round(startImg.width * r); startCv.height = Math.round(startImg.height * r);
      startCv.style.width = startImg.width + 'px'; startCv.style.height = startImg.height + 'px';
      sctx.setTransform(r, 0, 0, r, 0, 0);
      endCv.width = Math.round(1920 * r); endCv.height = Math.round(1080 * r); ectx.setTransform(r, 0, 0, r, 0, 0);
    }

    /* ---------- 불러오기 ---------- */
    function loading(p) { $('lFill').style.transform = `scaleX(${p})`; }
    function loaded() { const l = $('loading'); l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500); }

    /* ---------- 타이틀 ---------- */
    let titleVisible = false;
    function showTitle() {
      $('title').hidden = false;
      titleVisible = true; titleT = 0; leaveT = -1;
    }
    function hideTitle() { $('title').hidden = true; titleVisible = false; leaveT = -1; }
    function leaveTitle() { leaveT = 0; }
    // LED 칸 단위로 켜고 끈다: k = 0(모두 꺼짐) → 1(모두 켜짐). 경계는 깜빡인다. dir = 1이면 왼쪽부터 켜지고, -1이면 오른쪽부터 꺼진다
    function cells(c, im, w, h, k, cell) {
      const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
      for (let i = 0; i < cols; i++) {
        const f = i / cols;
        for (let j = 0; j < rows; j++) {
          const edge = k * 1.25 - f - (j % 3) * .02;
          if (edge > .05 || (edge > -.05 && Math.random() < .5)) c.drawImage(im, i * cell / w * im.width, j * cell / h * im.height, cell / w * im.width, cell / h * im.height, i * cell, j * cell, cell, cell);
        }
      }
    }
    // 세계가 먼저 0.5초 보이고 → 레터링이 LED처럼 왼쪽부터 켜지고 → START가 켜져 박자에 맞춰 숨 쉰다. 가끔 전류가 레터링을 훑고 지나간다
    function drawTitle(dt) {
      if (!titleVisible || !IMG.title) return;
      titleT += dt;
      if (leaveT >= 0 && (leaveT += dt) > UI.titleOut + .05) { hideTitle(); return; }
      const c = tctx, im = IMG.title;
      c.clearRect(0, 0, tw, th);
      const boot = leaveT >= 0 ? 1 - clamp(leaveT / UI.titleOut, 0, 1) * 1.25 : clamp((titleT - .5) / .9, 0, 1);
      if (boot < 1) cells(c, im, tw, th, boot, 22);
      else {
        c.drawImage(im, 0, 0, tw, th);
        const cyc = (titleT - 1.6) % 5;
        if (cyc > 0 && cyc < .9) {
          const x = -200 + cyc / .9 * (tw + 400), o = sweepBuf().ctx;
          o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, tw, th);
          o.drawImage(im, 0, 0, tw, th);
          o.globalCompositeOperation = 'source-in';
          const g = o.createLinearGradient(x - 120, 0, x + 120, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,240,210,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          o.fillStyle = g; o.fillRect(0, 0, tw, th);
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.drawImage(sweep.cv, 0, 0, tw, th);
          c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        }
      }
      // START: 레터링이 다 켜진 뒤 같은 방식으로 켜지고, 박자마다 밝기만 숨 쉰다. 누르면 두 번 깜빡이고 꺼진다
      const sw = startImg.width, sh = startImg.height;
      sctx.clearRect(0, 0, sw, sh);
      if (leaveT >= 0) { if (leaveT < .24 && Math.floor(leaveT / .06) % 2 === 0) sctx.drawImage(startImg, 0, 0); return; }
      const sk = clamp((titleT - 1.5) / .35, 0, 1);
      if (sk <= 0) return;
      const beat = AUDIO.beat(), k = 1 - (beat % 1);
      sctx.globalAlpha = sk < 1 ? 1 : .5 + .5 * k * k;
      if (sk < 1) cells(sctx, startImg, sw, sh, sk, 6); else sctx.drawImage(startImg, 0, 0);
      sctx.globalAlpha = 1;
    }
    let sweep = null;
    function sweepBuf() {
      if (!sweep) { const cv = document.createElement('canvas'); cv.width = tw; cv.height = th; sweep = { cv, ctx: cv.getContext('2d') }; }
      return sweep;
    }

    /* ---------- 엔딩: 멈춰 선 마지막 장면 위에 ---------- */
    // head: FINISH · BLACKOUT(타이틀 레터링 자리, 같은 LED 칸) / info: 한 줄 기록(작은 판 둘셋) / RESTART(START와 같은 판 · 같은 자리 · 같은 숨)
    let end = null;
    function showEnding(o) {
      end = {
        t: 0, leave: -1,
        head: LED.word(o.head, { color: o.color, cell: 9 }),
        info: o.info.map(([text, color]) => LED.word(text, { color, cell: 3.5 })),
        restart: LED.word('RESTART', { color: C.yellow, cell: 6 })
      };
      endCv.hidden = false;
    }
    function leaveEnding() { if (end && end.leave < 0) end.leave = 0; }
    function hideEnding() { end = null; endCv.hidden = true; }
    function drawEnding(dt) {
      if (!end) return;
      end.t += dt;
      const c = ectx, t = end.t;
      c.clearRect(0, 0, 1920, 1080);
      let k = 1;
      if (end.leave >= 0) { end.leave += dt; k = 1 - clamp(end.leave / UI.titleOut, 0, 1) * 1.25; if (end.leave > UI.titleOut + .05) { hideEnding(); return; } }
      const put = (img, x, y, from, dur, step) => {
        const on = end.leave >= 0 ? k : clamp((t - from) / dur, 0, 1);
        if (on <= 0) return;
        c.save(); c.translate(x, y);
        if (on < 1) cells(c, img, img.width, img.height, on, step); else c.drawImage(img, 0, 0);
        c.restore();
      };
      // 위: FINISH(하늘 자리, 불이 켜진 변전소 위). 가운데 아래 그 밑에 한 줄 기록. 변전소는 가리지 않는다
      const h = end.head;
      put(h, Math.round(960 - h.width / 2), 96, 0, .9, 9);
      const gap = 20, iw = end.info.reduce((a2, im) => a2 + im.width, 0) + gap * (end.info.length - 1);
      let x = Math.round(960 - iw / 2);
      for (const im of end.info) { put(im, x, 96 + h.height + 6, .7, .5, 3.5); x += im.width + gap; }
      // 아래: RESTART(START와 같은 자리). 다 켜지면 박자에 맞춰 밝기만 숨 쉰다. 누르면 두 번 깜빡이고 꺼진다
      const r = end.restart, rx = Math.round(960 - r.width / 2), ry = 600;
      if (end.leave >= 0) { if (end.leave < .24 && Math.floor(end.leave / .06) % 2 === 0) c.drawImage(r, rx, ry); return; }
      const rk = clamp((t - 1.3) / .35, 0, 1);
      if (rk <= 0) return;
      const beat = AUDIO.beat(), b = 1 - (beat % 1);
      c.globalAlpha = rk < 1 ? 1 : .5 + .5 * b * b;
      c.save(); c.translate(rx, ry);
      if (rk < 1) cells(c, r, r.width, r.height, rk, 6); else c.drawImage(r, 0, 0);
      c.restore();
      c.globalAlpha = 1;
    }

    function showPause(v) { $('pause').hidden = !v; }

    /* ---------- 번쩍임 ---------- */
    function flash(color, dur = .25, peak = 1) {
      const f = $('flash');
      f.style.transition = 'none'; f.style.background = color; f.style.opacity = peak;
      void f.offsetWidth;
      f.style.transition = `opacity ${dur}s ease-out`; f.style.opacity = 0;
    }
    function fade(to, dur) {
      const f = $('flash');
      f.style.transition = `opacity ${dur}s linear`; f.style.background = C.ink; f.style.opacity = to;
    }

    return {
      init, resize, loading, loaded, showTitle, hideTitle, leaveTitle, drawTitle, showEnding, leaveEnding, hideEnding, drawEnding, showPause, flash, fade,
      get titleVisible() { return titleVisible; }, get endingReady() { return !!end && end.leave < 0 && end.t > 1.3; }
    };
  })();

  /* ================= 입력: 키보드 · 터치 ================= */
  // ← → (A D) 전선 바꾸기 · ↑ (W) 가속 · ↓ (S) 감속 · SPACE 과전류 · P/ESC 일시정지 · M 소리
  // 휴대폰: 화면 왼쪽 · 오른쪽을 누르면 전선 바꾸기, 위로 밀면 과전류, 아래쪽을 누르고 있으면 감속

  const INPUT = (() => {
    const held = new Set(), pressed = new Set();
    const MAP = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'boost', Enter: 'enter', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyQ: 'quit'
    };
    let any = false, touchBrake = false;
    function down(code, repeat) {
      const a = MAP[code];
      if (!repeat) any = true;
      if (!a) return;
      if (!held.has(a) && !repeat) pressed.add(a);
      held.add(a);
    }
    function up(code) { const a = MAP[code]; if (a) held.delete(a); }
    addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      down(e.code, e.repeat);
      if (MAP[e.code] || e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', e => up(e.code));
    addEventListener('blur', () => held.clear());
    // 터치
    let t0 = null;
    addEventListener('pointerdown', e => {
      any = true;
      if (e.pointerType === 'mouse') return;
      t0 = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (e.clientY > innerHeight * .78) touchBrake = true;
    });
    addEventListener('pointerup', e => {
      touchBrake = false;
      if (!t0 || e.pointerType === 'mouse') return;
      const dx = e.clientX - t0.x, dy = e.clientY - t0.y;
      if (dy < -60 && Math.abs(dy) > Math.abs(dx)) pressed.add('boost');
      else if (Math.abs(dx) < 30 && Math.abs(dy) < 30) pressed.add(e.clientX < innerWidth / 2 ? 'left' : 'right');
      else if (Math.abs(dx) > 40) pressed.add(dx < 0 ? 'left' : 'right');
      t0 = null;
    });
    addEventListener('mousedown', () => { any = true; });

    // 판정에 넘기는 모양(physics.js)
    function race() {
      return {
        left: held.has('left'), right: held.has('right'), up: held.has('up'), down: held.has('down') || touchBrake,
        leftP: pressed.has('left'), rightP: pressed.has('right'), boostP: pressed.has('boost')
      };
    }
    return {
      race,
      took: a => pressed.has(a),
      held: a => held.has(a),
      anyKey: () => any,
      endFrame() { pressed.clear(); any = false; },
      clear() { held.clear(); pressed.clear(); any = false; }
    };
  })();

  /* ================= 상태 · 기록 · 진단 ================= */
  // 화면 흐름: boot → title(출발선 위 게임 화면 + 레터링 + START) → (아무 키: 레터링 · START가 걷히고 그 자리에서 출발) race
  //          → finish(변전소에 불) 또는 blackout(퓨즈가 모두 나감) → result → (아무 키) ready로 바로 다시

  const params = new URLSearchParams(location.search);
  const G = {
    phase: 'boot', t: 0, paused: false,
    course: null, run: null,
    auto: params.has('auto'), autoMem: { cool: 0 },
    startAt: Math.max(0, +(params.get('s') || 0)),
    view: { x: 0, y: FEEL.eye, fov: FEEL.fov, roll: 0, pitch: -.105, yaw: 0 },
    fx: {},
    sector: 1,
    rise: 1, ts: 1, slow: 0, slowK: 1, callIx: 0, lastRow: 0, lastLamp: 0, threat: null, warnFast: false, eggT: 0, rearOn: 0, endRise: false, endShown: false, endHud: false, endT: 0, laneN: 0, moveHint: false,
    rec: { score: 0, grid: 0, time: 0 }
  };
  try { Object.assign(G.rec, JSON.parse(localStorage.getItem('lwr.best') || '{}')); } catch (e) {}

  if (params.has('quick')) UI.boot = .3;
  // 운영체제에서 '동작 줄이기'를 켜면 흔들림 · 흐림 · 색 번짐을 줄인다
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) { FEEL.shake *= .3; FEEL.shakeCable *= .3; FEEL.shakeCrash *= .3; FEEL.shakeHigh *= .3; FEEL.blurSpeed *= .5; FEEL.blurBoost *= .5; FEEL.chroma *= .5; FEEL.chromaBoost *= .5; FEEL.chromaNear *= .5; FEEL.warpBoost *= .3; FEEL.slowNear = 1; FEEL.fovPunch *= .5; } } catch (e) {}
  function phase(p) { G.phase = p; G.t = 0; }
  // 화면 효과 값(update.js의 viewAndFx가 매 프레임 줄이고 더한다)
  function resetFx() {
    Object.assign(G.fx, { lean: 0, kick: 0, shake: 0, crash: 0, desat: 0, red: 0, ink: 0, flash: 0, gateFlash: 0, blackout: 0,
      accel: 0, push: 0, surge: 0, punch: 0, near: 0, nearSide: 0, white: 0, edge: 0, edgeSide: 0, warp: 0, warpT: 9, jolt: 0, rumble: 0, jab: 0, brace: 0 });
  }
  resetFx();

  function saveRecord(run) {
    const out = { newScore: false, newTime: false, best: G.rec };
    if (run.score > (G.rec.score || 0)) { G.rec.score = Math.round(run.score); out.newScore = true; }
    if (run.lit > (G.rec.grid || 0)) G.rec.grid = run.lit;
    if (run.done && (!G.rec.time || run.time < G.rec.time)) { G.rec.time = run.time; out.newTime = true; }
    try { localStorage.setItem('lwr.best', JSON.stringify(G.rec)); } catch (e) {}
    return out;
  }

  function newRace() {
    G.run = newRun(G.course);
    if (G.startAt) { G.run.s = G.startAt; G.run.gateIx = G.course.gates.findIndex(g => g.s > G.startAt); G.run.obsIx = G.course.obstacles.findIndex(o => o.s > G.startAt); if (G.run.gateIx < 0) G.run.gateIx = G.course.gates.length; if (G.run.obsIx < 0) G.run.obsIx = G.course.obstacles.length; }
    G.sector = G.course.sectorAt(G.run.s).no;
    resetFx();
    G.autoMem = { cool: 0 };
    G.callIx = G.course.calls.findIndex(c => c.s > G.run.s); if (G.callIx < 0) G.callIx = G.course.calls.length;
    G.ts = 1; G.slow = 0; G.prevV = 0; G.eggT = 0; G.threat = laneThreats(G.run, G.course);
    G.lastRow = Math.floor(G.run.s / COURSE.pylonEvery); G.lastLamp = Math.floor(G.run.s / 20);
  }

  /* ================= 프레임마다: 화면 흐름 · 판정 · 사건에 대한 반응 · 카메라 ================= */
  // 화면 글자 규칙: 가운데 시야(길 · 소실점)는 비운다. 내가 한 일은 왼쪽, 곧 올 위험은 오른쪽, 구간 · 예고는 위 알림 띠,
  // 짧은 상태는 계기판 LED 판, 위험물 자체엔 노란 괄호(AR). 큰 글자는 쓰지 않는다

  const SUB = 1 / 120;
  let acc = 0;
  // 부서지는 재질(소리 · 파편 색)
  const MATERIAL = { barrier: 'concrete', closure: 'concrete', barricade: 'barricade', car: 'metal', cart: 'metal', panel: 'glass', coil: 'electric', arc: 'electric' };
  // 과전류 중 내 차선 앞에서 곧 부술 것까지 몇 초
  function nextBreak(run) {
    if (run.boost <= 0) return 1e9;
    const v = Math.max(8, run.v);
    let best = 1e9;
    for (let i = run.obsIx; i < G.course.obstacles.length; i++) {
      const o = G.course.obstacles[i], d = o.s - run.s;
      if (d > 50) break;
      if (BREAK.types.includes(o.type) && Math.abs(run.x - laneX(o.lane)) < BALANCE.hitHalf) best = Math.min(best, d / v);
    }
    G.course.movers.forEach((m, i) => { const st = run.mv[i]; if (m.kind === 'cart' && st.on && !st.dead && !st.passed && Math.abs(run.x - st.x) < BALANCE.hitHalf) best = Math.min(best, (st.s - run.s) / (v - mps(m.v))); });
    return best;
  }
  const note = (text, col, o = {}) => COCKPIT.callout(text, col, o);
  const small = { subFont: F_NUM, subPx: 8, subCell: 2.4 };

  function eachEvent(run) {
    for (const e of run.events) {
      WORLD.onEvent(e);
      switch (e.t) {
        case 'lane': AUDIO.SFX.lane(e.dir); G.fx.kick += .35; if (++G.laneN >= 2) COCKPIT.dismissHint('move'); break;
        case 'edge': AUDIO.SFX.edge(); G.fx.shake += .25; break;
        case 'scrape':
          AUDIO.SFX.scrape(e.dir); G.fx.shake += .7; G.fx.edge = 1; G.fx.edgeSide = e.dir; G.fx.jolt = .4;
          COCKPIT.ticker('WALL', 'SLOW', .8);
          break;
        case 'cableOn':
          if (e.cable.rail) { AUDIO.SFX.rail(); G.fx.surge = 1; G.fx.warp = .55; G.fx.warpT = 0; note('HV RAIL', C.red, { sub: '전류 충전', tag: 'rail', replace: 'rail' }); COCKPIT.ticker('HV', 'RAIL', 1.4); }
          else COCKPIT.ticker('LIVE', 'WIRE', .7);
          break;
        case 'gate':
          if (e.lit) {
            AUDIO.SFX.gate(e.chain);
            note(`GRID ${pad2(e.g.i + 1)}`, C.red, { sub: e.viaBoost ? 'OVERLOAD' : e.chain >= 2 ? `CHAIN ${e.chain} +${e.add}` : `+${e.add}`, ...small, tag: 'gate', replace: 'gate' });
            COCKPIT.ticker('GRID', pad2(e.g.i + 1), 1.2);
            G.fx.gateFlash = 1; G.fx.kick += .6;
          } else {
            AUDIO.SFX.miss();
            note('MISS', C.grey1, { sub: e.reason === 'lane' ? '노란 ▼ 차선이 아니었다' : '전류가 비어 있었다', subColor: C.grey1, tag: 'gate', replace: 'gate' });
            COCKPIT.ticker('MISS', pad2(e.g.i + 1), 1.2);
          }
          break;
        case 'crash': {
          AUDIO.SFX.crash();
          const big = ['collapse', 'truck', 'cart', 'gantry', 'crane'].includes(e.o.type);
          G.fx.crash = 1; G.fx.shake += big ? 1.5 : 1; G.fx.jolt = 1;
          G.slow = FEEL.slowCrash; G.slowK = .06;                     // 부딪히는 순간 아주 잠깐 멈칫(Hit Stop)
          note('SHORT', C.grey1, { sub: `퓨즈 ${Math.max(0, e.fuses)}개 남음`, subColor: C.grey1, tag: 'crash', replace: 'crash' });
          if (e.o.type === 'collapse') { HUD.tick('CAUGHT', '붕괴에 휩쓸렸다', true, 1.6); AUDIO.SFX.hole(); }
          break;
        }
        case 'close': {
          AUDIO.SFX.close(e.side);
          COCKPIT.ticker('CLOSE', '+' + (e.add || SCORE.close), .7);
          G.fx.kick += .25; G.fx.near = 1; G.fx.nearSide = e.side;
          // 큰 것(마주 오는 차 · 방전 · 크레인)을 바짝 비키면 아주 잠깐 느려지고 왼쪽에 한 줄
          if (e.mover || e.o.reveal || e.o.type === 'crane') {
            G.slow = .16; G.slowK = FEEL.slowNear;
            note(e.o.type === 'cart' ? 'NEAR MISS' : e.o.type === 'truck' ? 'PASS' : 'DODGE', C.yellow, { sub: '+' + e.add, ...small, tag: 'close', replace: 'close', life: 1.1 });
          }
          break;
        }
        case 'pass': AUDIO.SFX.pass(-(e.side || 1), 1.6); break;
        case 'thread': AUDIO.SFX.thread(); note('THREAD', C.yellow, { sub: '+' + e.add, ...small, tag: 'thread' }); G.fx.warp = .45; G.fx.warpT = 0; break;
        case 'smash': {
          // 과전류로 부수는 순간: 짧고 강한 흔들림 · 번쩍임 · 충격파 · 파편이 카메라 앞을 스침 · 아주 잠깐 멈칫 → 바로 다시 가속
          const kind = MATERIAL[e.o.type] || 'concrete', light = e.o.type === 'closure';
          if (light) { AUDIO.SFX.crunch(e.chain); G.fx.jab = Math.max(G.fx.jab, .55); COCKPIT.shatter(kind, G.vp || [960, 470], 7); G.fx.punch = Math.max(G.fx.punch, .18); }
          else {
            AUDIO.SFX.smash(kind, e.chain);
            G.fx.jab = 1; G.fx.jolt = .7; G.fx.punch = .5; G.fx.warp = .8; G.fx.warpT = 0;
            G.fx.flash = Math.max(G.fx.flash, kind === 'glass' || kind === 'electric' ? .3 : .2);
            G.slow = .045; G.slowK = .2;
            COCKPIT.shatter(kind, G.vp || [960, 470], kind === 'glass' ? 26 : 16);
          }
          note('SMASH', C.red, { sub: e.chain > 1 ? `x${e.chain}  +${e.add}` : `+${e.add}`, ...small, tag: 'smash', replace: 'smash', life: 1.1 });
          COCKPIT.ticker('SMASH', 'x' + e.chain, .6);
          break;
        }
        case 'boost':
          AUDIO.SFX.boost(); AUDIO.setLayer(4);
          COCKPIT.dismissHint('over');
          note('OVERLOAD', C.red, { cell: 4.5, tag: 'boost', replace: 'boost', life: 1.2 });
          G.fx.flash = .5; G.fx.kick += 1.4; G.fx.warp = 1; G.fx.warpT = 0; G.fx.punch = 1; G.fx.jolt = .6;
          break;
        case 'boostEnd':
          if (e.broken) { AUDIO.SFX.cut(); COCKPIT.ticker('LOAD', 'CUT', 1); }   // 부술 수 없는 것에 부딪혀 과전류가 끊겼다
          else AUDIO.SFX.boostEnd();
          AUDIO.setLayer(3); break;
        case 'boostDenied': AUDIO.SFX.denied(); COCKPIT.ticker('NEED', 'FULL', .8); break;
        case 'full':
          AUDIO.SFX.full();
          break;
        case 'shift': AUDIO.SFX.shift(e.up); break;
        case 'mover': if (e.m.kind === 'cart') AUDIO.SFX.horn(Math.sign(laneX(e.m.lane) - G.run.x) || 1); break;
        case 'blink': AUDIO.SFX.blink(Math.sign(laneX(e.m.shift.to) - laneX(e.m.lane)) || 1); break;
        case 'chase': AUDIO.setLayer(3); G.fx.shake += .9; G.fx.jolt = .7; AUDIO.SFX.hole(); break;
        case 'chaseEnd':
          if (e.escaped) { AUDIO.SFX.escaped(); note('ESCAPED', C.yellow, { sub: '+' + e.add, ...small, tag: 'chase' }); G.fx.warp = .5; G.fx.warpT = 0; }
          break;
        case 'finish':
          // 결승선: 과전류 · 전선 위 상태를 내려놓고 미끄러지듯 선다(효과는 속도와 함께 잦아든다)
          run.boost = 0; run.cable = null; run.onCable = false; G.fx.surge = 0;
          phase('finish'); AUDIO.SFX.finish(); AUDIO.setLayer(2); break;
        case 'blackout': phase('blackout'); AUDIO.SFX.blackout(); AUDIO.stopMusic(); break;
      }
    }
    run.events.length = 0;
  }

  // 세계가 알린 순간들(터널 입구 · 출구, 정전 · 복구, 무너지는 차선, 방전, 갠트리)
  function worldFx() {
    for (const f of WORLD.drainFx()) {
      switch (f.t) {
        case 'enter': AUDIO.SFX.tunnelIn(); G.fx.shake += .35; G.fx.kick += .5; break;
        case 'exit': AUDIO.SFX.tunnelOut(); G.fx.white = 1; G.fx.kick += .8; break;
        case 'dark': AUDIO.SFX.powerDown(); G.fx.shake += .3; break;
        case 'reboot': AUDIO.SFX.powerUp(); G.fx.warp = .5; G.fx.warpT = 0; break;
        case 'hole': AUDIO.SFX.hole(); G.fx.shake += .9; G.fx.jolt = .5; break;
        case 'arcWarn': AUDIO.SFX.crackle(); break;
        case 'arc': AUDIO.SFX.zap(); G.fx.flash = Math.max(G.fx.flash, .16); G.fx.shake += f.o.lane === G.run.lane ? .6 : .25; break;
        case 'gantryWarn': AUDIO.SFX.creak(); break;
        case 'gantryLand': AUDIO.SFX.slam(); G.fx.shake += 1.4; G.fx.jolt = 1; break;
        case 'ghost': if (AUDIO.ready && G.phase === 'title') AUDIO.SFX.ghost(f.lane - 1); break;
        case 'tag': COCKPIT.ticker('CH03', 'SCAN', 1.4); AUDIO.SFX.tag(); break;
      }
    }
  }

  // 사건 예고: 길 위 전광판이 먼저 알리고, 그 사건 바로 앞에서 위 알림 띠가 내려온다
  function calls(run) {
    const list = G.course.calls;
    while (G.callIx < list.length && list[G.callIx].s <= run.s) {
      const c = list[G.callIx++];
      if (run.s - c.s > 120) continue;
      HUD.tick(c.en, c.ko, true); AUDIO.SFX.alert(true);
    }
  }

  // 이어지는 위험은 오른쪽 위 고정 판: 붕괴(거리 막대) · 방전 구간 · 정전 · 마주 오는 차(거리 막대)
  function hazards(run) {
    const ch = run.chase;
    if (ch.on) { const d = run.s - ch.front; COCKPIT.hazard('chase', 'COLLAPSE', { val: d, max: HAZARD.chaseGap, label: Math.round(d) + 'M', col: d < 35 ? C.red : C.yellow }); }
    if (G.course.zoneAt('danger', run.s)) COCKPIT.hazard('danger', 'DANGER', { col: C.red });
    if (WORLD.dark > .5) COCKPIT.hazard('dark', 'NO POWER', { col: C.grey1 });
    let near = 1e9;
    G.course.movers.forEach((m, i) => { const st = run.mv[i]; if (m.kind === 'cart' && st.on && !st.passed && !st.dead) near = Math.min(near, st.s - run.s); });
    if (near < 640) COCKPIT.hazard('cart', 'ONCOMING', { val: near, max: 640, label: Math.round(near) + 'M' });
    const f = G.course.falls[0];
    if (f && f.s > run.s && (f.s - run.s) / Math.max(8, run.v) < HAZARD.fallWarn) COCKPIT.hazard('fall', 'GANTRY', { col: C.red });
  }

  // 위험물 둘레의 노란 괄호(AR): 내 차선 바로 앞 · 마주 오는 차 · 차선을 바꾸는 화물차 · 보이기 시작한 방전 · 갠트리
  const marks = [];
  function arMarks(run) {
    marks.length = 0;
    const v = Math.max(8, run.v), th = G.threat;
    const w = th.what[run.lane], d = th.dist[run.lane];
    const markObs = (o, urgent) => { const p = WORLD.project(o.s, laneX(o.lane), o.type === 'arc' ? 1.1 : 1.4); if (p) marks.push({ x: p[0], y: p[1], d: p[2], urgent }); };
    if (w && d / v < 1.6) {
      if (w.kind === 'closure' || w.kind === 'gap') { const p = WORLD.project(Math.max(w.s0, run.s + 3), laneX(w.lane), 1.2); if (p) marks.push({ x: p[0], y: p[1], d: p[2], urgent: true }); }
      else if (w.seq) { const p = WORLD.project(w.s, craneX(w, run.time), 2.6); if (p) marks.push({ x: p[0], y: p[1], d: p[2], urgent: true, scale: 1.3 }); }
      else if (w.lane != null && w.s != null && !w.kind) markObs(w, true);
    }
    G.course.movers.forEach((m, i) => {
      const st = run.mv[i];
      if (!st.on || st.dead || st.passed || !(m.kind === 'cart' || st.to >= 0)) return;
      const p = WORLD.project(st.s, st.x, m.kind === 'cart' ? 1 : 1.6);
      if (p) marks.push({ x: p[0], y: p[1], d: p[2], label: m.kind === 'cart' ? Math.round(st.s - run.s) + 'M' : (st.to > st.lane ? '▶' : '◀'), urgent: Math.abs(st.x - run.x) < 2, scale: 1.25 });
    });
    for (let i = run.obsIx; i < G.course.obstacles.length; i++) {
      const o = G.course.obstacles[i];
      if (o.s - run.s > 420) break;
      if (o.reveal && (o.s - run.s) / v < o.reveal && o !== w) markObs(o, o.lane === run.lane);
      // 과전류 중 내 차선의 부술 수 있는 것: 붉은 괄호(표적). 노란 괄호(피해야 할 것)와 나뉜다
      else if (run.boost > 0 && o.lane === run.lane && BREAK.types.includes(o.type) && (o.s - run.s) / v < 1.1) { const p = WORLD.project(o.s, laneX(o.lane), 1.3); if (p) marks.push({ x: p[0], y: p[1], d: p[2], col: C.red }); }
    }
    return marks;
  }

  // 지나치는 철탑 줄 · 가로등: 빠를수록 짧고 촘촘한 바람 소리(좌우)
  function passSounds(run) {
    const k = kmh(run.v), row = Math.floor(run.s / COURSE.pylonEvery), lamp = Math.floor(run.s / 20);
    if (row !== G.lastRow) { G.lastRow = row; if (k > 150) AUDIO.SFX.pass(Math.random() < .5 ? -1 : 1, .45 + k / 600); }
    if (lamp !== G.lastLamp) { G.lastLamp = lamp; if (k > 250) AUDIO.SFX.pass(lamp % 2 ? 1 : -1, .3); }
  }

  // 출발 전광판 글자: 타이틀 동안엔 TRACK 03, 출발하는 순간 GO가 깜빡인다
  WORLD.setStartBoard(() => {
    if (G.phase === 'title') return { text: 'TRACK 03', font: F_NUM, px: 8, col: C.red };
    if (G.phase === 'race' && G.t < 2.5) return Math.floor(G.t * 6) % 2 ? { text: 'GO', font: F_NUM, px: 16, col: C.yellow } : { text: 'GO', font: F_NUM, px: 16, col: C.red };
    return { text: 'LIVE WIRE', font: F_NUM, px: 8, col: C.red };
  });
  // 방송탑에 전기가 들어간 순간: 이름을 화면에 띄우지 않는다. 탑 화면(세계 속 물건)과 소리 · 계기판 한 줄로만
  WORLD.setEggHandler(() => { G.run.egg = true; AUDIO.SFX.egg(); AUDIO.setLayer(4); COCKPIT.ticker('CH03', 'ON AIR', 4.5); G.eggT = 5; });

  /* ---------- 단계별 ---------- */
  function update(dt) {
    G.t += dt;
    if (INPUT.took('mute')) { const m = AUDIO.toggleMute(); COCKPIT.ticker(m ? 'MUTE' : 'SOUND', m ? 'OFF' : 'ON', 1); }
    // 카메라 자리: 타이틀 = 1(눈높이 위 · 콕핏 없음), 달리는 동안 = 0. 엔딩에서 바이크가 서면 천천히 다시 타이틀 자리로 올라간다
    if (G.phase === 'title') G.rise = 1;
    else if (G.endRise) G.rise = Math.min(1, G.rise + dt / UI.endRise);
    else G.rise = Math.max(0, G.rise - dt / UI.rise);
    HUD.step(dt);
    switch (G.phase) {
      case 'title': return updTitle(dt);
      case 'race': return updRace(dt);
      case 'finish': return updFinish(dt);
      case 'blackout': return updBlackout(dt);
    }
  }

  // 타이틀 = 출발선 위 게임 화면 그대로 + 레터링 + START. 아무 키(또는 클릭 · 탭) → 레터링 · START만 걷히고 그 자리에서 출발한다
  // 설명 화면은 없다. 오래 두어도 타이틀은 그대로다
  function updTitle(dt) {
    if (INPUT.anyKey() && !INPUT.took('mute') && G.t > .6) {
      AUDIO.ensure(); AUDIO.SFX.ignite();
      SCREENS.leaveTitle(); WORLD.setMode('race'); HUD.reset();
      launch();
    }
  }
  // 출발: 카운트다운 없이 그 자리에서. 세계는 멈추지 않는다
  // 카메라가 타이틀 자리에서 눈높이로 내려오고(UI.rise), 그동안 콕핏이 아래에서 올라오며 바이크가 바로 달려 나간다
  // 곡은 먹먹하게 들어와 출발과 함께 열리고, 위쪽 띠 HUD는 장면이 자리 잡은 뒤(0.45초) 내려온다
  function launch() {
    phase('race');
    G.finishDecel = 0; G.endHud = false; G.endShown = false; G.endRise = false; G.moveHint = false; G.laneN = 0; G.overHintT = -99;
    COCKPIT.boot(); COCKPIT.clearFx();
    AUDIO.startMusic(); AUDIO.muffle(700, .8); AUDIO.setLayer(2);
    G.run.v = mps(50); G.hudIn = false;
    G.fx.kick += .8;
  }
  function updRace(dt) {
    const run = G.run;
    if (!G.hudIn && G.t > .45) { G.hudIn = true; HUD.show(true); }
    // 조작은 달리면서: 출발 1.2초 뒤 왼쪽 아래에 작게(두 번 옮기면 바로 사라진다). SPACE는 처음 전류가 가득 찰 때
    if (!G.moveHint && G.t > 1.2) { G.moveHint = true; if (G.laneN < 2) COCKPIT.hint('move', 'A / D', 'MOVE', 4.5); }
    // 전류가 가득 찼는데 과전류를 아직 한 번도 안 써 봤으면(MOVE 안내가 끝난 뒤에), 14초마다 다시
    if (run.full && !run.boosts && G.t > 6 && G.t - G.overHintT > 14) { G.overHintT = G.t; COCKPIT.hint('over', 'SPACE', 'OVERLOAD', 6); }
    if (INPUT.took('pause')) { G.paused = !G.paused; SCREENS.showPause(G.paused); AUDIO.muffle(G.paused ? 400 : 18000, 0); if (!G.paused) AUDIO.openMusic(); }
    if (G.paused) {
      if (INPUT.took('quit')) { G.paused = false; SCREENS.showPause(false); toTitle(); }
      return;
    }
    // 아주 짧은 느려짐(아슬아슬 · 충돌): 판정 시계만 늦춘다
    G.slow = Math.max(0, G.slow - dt);
    G.ts = G.slow > 0 ? G.slowK : Math.min(1, G.ts + dt * 6);
    let inp = INPUT.race();
    acc += dt * G.ts;
    while (acc >= SUB) {
      if (G.auto) inp = autoInput(run, G.course, G.autoMem);
      stepRun(run, G.course, inp, SUB);
      acc -= SUB;
      // 눌림 신호는 첫 단계에서만
      inp = { ...inp, leftP: false, rightP: false, boostP: false };
      if (G.phase !== 'race') break;
    }
    // 음악 층: 속도가 오를수록 악기가 늘어난다(과전류 · 방송탑 공연 중엔 맨 위 층)
    G.eggT = Math.max(0, (G.eggT || 0) - dt);
    if (run.boost <= 0 && G.eggT <= 0) AUDIO.setLayer(run.chase.on || kmh(run.v) > 290 ? 3 : 2);
    // 구간이 바뀌면 위 알림 띠로
    const sec = G.course.sectorAt(run.s);
    if (sec.no !== G.sector) { G.sector = sec.no; HUD.tick(`SECTOR ${pad2(sec.no)}`, sec.ko); AUDIO.SFX.alert(false); }
    calls(run);
    eachEvent(run);
    worldFx();
    G.threat = laneThreats(run, G.course, 700);
    hazards(run);
    passSounds(run);
    HUD.update(run, G.course, dt);
  }
  /* ---------- 엔딩: 마지막 장면이 그대로 엔딩 화면이 된다(LOOP NIGHT처럼 결과창 없이) ----------
     결승선을 넘으면 그대로 미끄러지듯 서고(늘 결승선 190m 뒤, 변전소가 켠 만큼 켜진다), 위쪽 띠가 걷히고, 곡이 먹먹하게 잦아든다
     바이크가 거의 서면 카메라가 천천히 타이틀 자리로 올라가며 콕핏이 내려가고(출발의 거꾸로),
     타이틀 레터링이 있던 자리에 FINISH, 그 아래 한 줄 기록, START가 있던 자리에 RESTART
     RESTART → 글자가 걷히고 잠깐 잉크로 덮였다가 출발선에서 처음 START와 똑같이 출발한다. 오래 두면 타이틀로 돌아간다
     정전(BLACKOUT)도 같은 흐름: 전기가 끊겨 곡이 바로 멈추고, 색이 빠진 채 선다 */
  function updFinish(dt) {
    const run = G.run;
    if (!G.finishDecel) G.finishDecel = Math.max(8, run.v * run.v / (2 * 190));
    coastRun(run, dt, G.finishDecel);
    WORLD.setFinish(clamp((G.t - .6) / 1.8, 0, 1));
    endStep(dt, true);
  }
  function updBlackout(dt) {
    const run = G.run;
    coastRun(run, dt, 34);
    G.fx.blackout = clamp(G.t / 1.4, 0, 1);
    COCKPIT.powerOff(G.t > .6 ? 1 : 0);
    endStep(dt, false);
  }
  function endStep(dt, fin) {
    const run = G.run;
    worldFx();
    HUD.update(run, G.course, dt);
    if (G.restarting) {
      if (G.t > UI.restartFade) {
        G.restarting = false;
        SCREENS.hideEnding(); COCKPIT.powerOff(0); WORLD.setFinish(0);
        newRace(); WORLD.reset(G.course, G.run); HUD.reset();
        G.endRise = false; G.rise = 1;
        SCREENS.fade(0, .5);
        launch();
      }
      return;
    }
    if (G.t > .6 && !G.endHud) { G.endHud = true; HUD.hide(); COCKPIT.clearFx(); if (fin) AUDIO.fadeMusic(UI.endFade); }
    if (G.t > (fin ? 1.8 : 1.4)) G.endRise = true;
    if (G.t > (fin ? 2.8 : 2.2) && !G.endShown) {
      G.endShown = true; G.endT = G.t;
      const hadTime = !!G.rec.time, rec = saveRecord(run), total = G.course.gates.length;
      const grid = [`GRID ${pad2(run.lit)}/${pad2(total)}`, C.red];
      SCREENS.showEnding(fin
        ? { head: 'FINISH', color: C.red, info: [[`TIME ${fmtTime(run.time)}`, C.yellow], grid, ...(rec.newTime && hadTime ? [['BEST', C.yellow]] : [])] }
        : { head: 'BLACKOUT', color: C.grey1, info: [grid, [`${(run.s / 1000).toFixed(1)}KM`, C.grey1]] });
    }
    if (!G.endShown) return;
    if (SCREENS.endingReady && INPUT.anyKey() && !INPUT.took('mute')) {
      AUDIO.SFX.select();
      if (INPUT.took('quit') || INPUT.took('pause')) { toTitle(); return; }
      SCREENS.leaveEnding(); AUDIO.SFX.ignite();
      G.restarting = true; G.t = 0; SCREENS.fade(1, UI.restartFade);
    } else if (G.t - G.endT > UI.endIdle) toTitle();
  }
  function toTitle() {
    AUDIO.stopMusic(); HUD.show(false); COCKPIT.clearFx(); COCKPIT.powerOff(0); WORLD.setFinish(0);
    SCREENS.hideEnding(); G.endRise = false; G.restarting = false;
    newRace(); WORLD.reset(G.course, G.run); WORLD.setMode('attract'); HUD.reset();
    SCREENS.fade(0, .3);
    SCREENS.showTitle();
    phase('title');
  }

  /* ---------- 카메라 · 화면 효과 ---------- */
  // 평소엔 통제되어 있다(속도에 따라 조금씩). 가속 · 과전류 · 고압 레일 · 아슬아슬 · 충돌 · 붕괴 추격 때만 세진다
  const proj = new THREE.Vector3();
  const punchK = p => p > 0 ? Math.sin(Math.min(1, (1 - p) * 4) * Math.PI / 2) * p : 0;
  function viewAndFx(dt) {
    const run = G.run, v = G.view, f = G.fx, K = G.course.K;
    if (!run) return;
    const racing = G.phase === 'race' || G.phase === 'finish';
    const k = kmh(run.v), sp = clamp((k - 100) / 380, 0, 1);
    const live = run.onCable, boost = run.boost > 0 ? 1 : 0;
    // 기울기: 차선을 옮기는 쪽으로, 굽이 안쪽으로
    const laneVel = run.laneT < 1 ? run.laneDir * (1 - run.laneT) : 0;
    const kc = K[Math.min(G.course.N - 1, Math.floor(run.s + 25))];
    const curveLean = clamp(kc * run.v * run.v / 9.8, -1.4, 1.4) * .17;
    f.lean += (-laneVel * FEEL.lean - curveLean - f.lean) * Math.min(1, dt * 9);
    // 가속도: 속도가 오를 땐 뒤로 밀리고(시야 넓게 · 콕핏 아래로), 줄면 앞으로 쏠린다
    const a = dt > 0 ? (run.v - (G.prevV ?? run.v)) / dt : 0; G.prevV = run.v;
    f.accel += (clamp(a / 22, -1, 1) - f.accel) * Math.min(1, dt * 4);
    if (run.cable && run.cable.rail) f.surge = Math.max(f.surge, .75);
    f.surge = Math.max(0, f.surge - dt * .9);
    f.push += (clamp(Math.max(0, f.accel) + f.red * .7 + f.surge * .5, 0, 1.2) - f.push) * Math.min(1, dt * 5);
    f.kick = Math.max(0, f.kick - dt * 3.2);
    f.shake = Math.max(0, f.shake - dt * 2.4);
    f.crash = Math.max(0, f.crash - dt / 1.15);
    f.flash = Math.max(0, f.flash - dt * 2.4);
    f.gateFlash = Math.max(0, f.gateFlash - dt * 3.5);
    f.punch = Math.max(0, f.punch - dt * 1.4);
    f.near = Math.max(0, f.near - dt * 3.2);
    f.white = Math.max(0, f.white - dt * 1.1);
    f.edge = Math.max(0, f.edge - dt * 2.5);
    f.warpT += dt;
    f.jolt = Math.max(0, f.jolt - dt * 2.2);
    f.jab = Math.max(0, f.jab - dt * 9);
    // 부수기 직전(0.16초 안): 화면이 순간 조여든다 → 부수는 순간 펀치로 풀린다
    const nb = G.phase === 'race' ? nextBreak(run) : 1e9;
    f.brace += ((nb < .16 ? 1 - nb / .16 : 0) - f.brace) * Math.min(1, dt * 30);
    HUD.jolt(f.jolt);
    f.red += ((boost ? 1 : 0) - f.red) * Math.min(1, dt * (boost ? 6 : 2));
    // 붕괴 추격: 가까울수록 땅울림 · 흔들림
    const ch = run.chase, gap = ch.on ? run.s - ch.front : 999;
    f.rumble = ch.on ? clamp(1.15 - gap / 100, .25, 1) : Math.max(0, f.rumble - dt);
    const danger = G.course.zoneAt('danger', run.s) ? 1 : 0;
    const t = WORLD.time;
    const amp = f.jab * .16 + FEEL.shake * sp * sp + FEEL.shakeHigh * Math.max(0, sp - .7) * 3 + (live ? FEEL.shakeCable : 0) + f.shake * .12 + f.crash * FEEL.shakeCrash * .4 + boost * .03 + f.rumble * .05 + danger * .012 + f.surge * .02;
    const nx = (Math.sin(t * 41.3) * .6 + Math.sin(t * 67.1) * .4) * amp, ny = (Math.sin(t * 53.7) * .6 + Math.sin(t * 89.9) * .4) * amp;
    const bob = Math.sin(t * (6 + sp * 8)) * FEEL.bob * (.3 + sp);
    // 타이틀 자리(rise = 1): 눈높이보다 조금 위에서 지평선을 조금 낮게 본다(하늘이 레터링 자리). 출발하면 UI.rise 동안 눈높이로 내려온다
    const rise = G.rise * G.rise * (3 - 2 * G.rise);
    v.x = run.x + nx;
    v.y = FEEL.eye + ny + bob - f.crash * .25 + rise * .9;
    v.roll = f.lean + nx * .25 + Math.sin(t * 13) * f.crash * .12;
    v.yaw = -laneVel * FEEL.yawLane + Math.sin(t * .25) * .015 * rise;
    v.pitch = -.105 + ny * .3 + (INPUT.held('down') && racing ? -.014 : 0) - f.crash * .04 + f.accel * .012 + rise * .12;
    v.fov = FEEL.fov + FEEL.fovSpeed * sp + FEEL.fovBoost * f.red + FEEL.fovKick * Math.min(1.5, f.kick) * .6
      + FEEL.fovAccel * f.accel + FEEL.fovPunch * punchK(f.punch) - FEEL.fovPinch * f.near + f.surge * 4 + rise * 4 - 9 * f.brace;
    if (G.phase === 'finish') v.fov += (FEEL.fov - v.fov) * clamp(G.t / 2, 0, 1);

    // 화면 마무리 셰이더 값
    const U = POST.U;
    U.uTime.value = t;
    U.uBlur.value = (racing ? FEEL.blurSpeed * sp * sp + FEEL.blurBoost * f.red + f.surge * .35 : 0) + f.crash * .6 + f.near * .18;
    U.uChroma.value = FEEL.chroma * sp + FEEL.chromaBoost * f.red + f.crash * .02 + f.kick * .0015 + FEEL.chromaNear * f.near + .012 * f.brace + .01 * f.jab;
    U.uDesat.value = Math.max(f.crash * .92, f.blackout * .96);
    U.uRed.value = f.red * .8;
    U.uInk.value = f.crash * .5 + f.blackout * .55;
    U.uWarpR.value = f.warpT * 1.5;
    U.uWarp.value = f.warpT < .7 ? FEEL.warpBoost * f.warp * (1 - f.warpT / .7) : 0;
    U.uExpo.value = 1 + (racing ? FEEL.exposureSpeed * sp : 0) + f.surge * .04 - WORLD.dark * .05;
    U.uWhite.value = f.white * .85;
    // 내 차선이 곧 막히면(0.8초 안) 아래쪽 가장자리가 노랗게 맥박친다. 분리대에 긁히면 그쪽
    const th = G.threat, urgent = G.phase === 'race' && th && th.dist[run.lane] < run.v * .8;
    G.warnFast = !!urgent;
    U.uEdge.value = Math.max(f.edge, urgent ? .55 + .45 * Math.sin(t * 22) : 0, ch.on ? f.rumble * (.25 + .2 * Math.sin(t * 10)) : 0);
    U.uEdgeSide.value = f.edge > .05 ? f.edgeSide : 0;
    U.uMirRim.value = ch.on ? .6 + .4 * Math.sin(t * 9) : 0;
    if (f.flash > 0) U.uFlash.value.set(1, .97, .9, f.flash * .5);
    else if (f.gateFlash > 0) U.uFlash.value.set(.9, .2, .17, f.gateFlash * .12);
    else U.uFlash.value.set(0, 0, 0, 0);
    // 소실점: 앞 400m 지점을 화면에 비춰 본다(흐림 · 속도선 · 충격파의 중심)
    const bx = BEND.uBendX.value[Math.round(400 / BEND_D * (BEND_N - 1))], by = BEND.uBendY.value[Math.round(400 / BEND_D * (BEND_N - 1))];
    proj.set(bx, FEEL.eye + by, -400).project(WORLD.cam);
    U.uCenter.value.set(clamp(proj.x * .5 + .5, .2, .8), clamp(proj.y * .5 + .5, .25, .75));
    G.vp = [U.uCenter.value.x * STAGE_W, (1 - U.uCenter.value.y) * STAGE_H];
  }

  /* ================= 시작: 무대 맞추기 · 불러오기 · 루프 ================= */

  THREE.ColorManagement.enabled = false;
  const stage = document.getElementById('stage');
  const glCanvas = document.getElementById('gl');
  const fxCanvas = document.getElementById('fx');
  let renderer = null, scale = 1, glRatio = 1, last = performance.now(), frameMs = 16, slowT = 0, fastT = 0;
  let quality = 1;

  // 16:9 무대를 창 가운데에. 캔버스는 실제 화면 픽셀로, 글자 · UI는 CSS 배율로
  function fit() {
    scale = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    const dpr = devicePixelRatio || 1;
    glRatio = Math.min(FEEL.pixelRatioMax, dpr) * scale * quality;
    if (renderer) {
      renderer.setPixelRatio(glRatio);
      renderer.setSize(STAGE_W, STAGE_H, false);
      const [w, h] = [Math.round(STAGE_W * glRatio), Math.round(STAGE_H * glRatio)];
      POST.resize(w, h);
    }
    COCKPIT.resize(STAGE_W, STAGE_H, Math.min(2, dpr) * scale);
    SCREENS.resize(Math.min(2, dpr) * scale);
  }

  async function boot() {
    COCKPIT.init(fxCanvas);
    document.getElementById('lReel').innerHTML = reelSVG('reel-md');
    const fontsReady = Promise.all(['700 16px Silkscreen', '16px Silkscreen', '16px "Press Start 2P"', '700 16px Galmuri11'].map(f => document.fonts.load(f).catch(() => null)));
    let pi = 0, pf = 0;
    const prog = () => SCREENS.loading(pi * .85 + pf * .15);
    await Promise.all([loadImages(p => { pi = p; prog(); }), fontsReady.then(() => { pf = 1; prog(); })]);
    LED.clear();
    G.course = buildCourse();
    G.run = newRun(G.course);
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.autoClear = true;
    WORLD.init(G.course, G.run);
    POST.init(renderer);
    SCREENS.init(); HUD.init(G.course);
    fit();
    addEventListener('resize', fit);
    // 셰이더를 미리 한 번 컴파일해 둔다(첫 출발에서 멈칫하지 않도록)
    // 숨겨 둔 사건 물체(화물차 · 크레인 · 방전 · 갠트리)도 모두 켠 채 컴파일한다
    viewAndFx(0); WORLD.update(0, G.view);
    const hidden = []; WORLD.scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    renderer.compile(WORLD.scene, WORLD.cam);
    for (const o of hidden) o.visible = false;
    SCREENS.loaded();
    newRace(); WORLD.reset(G.course, G.run);
    if (params.has('skip')) { AUDIO.ensure(); WORLD.setMode('race'); HUD.reset(); G.rise = 0; launch(); }
    else { WORLD.setMode('attract'); SCREENS.showTitle(); phase('title'); }
    requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
    // 세계는 처음부터 끝까지 늘 보인다(타이틀 · 엔딩도 같은 세계 위의 글자)
    if (SCREENS.titleVisible) SCREENS.drawTitle(dt);
    SCREENS.drawEnding(dt);
    {
      viewAndFx(dt);
      if (!G.paused) WORLD.update(dt * (G.phase === 'race' ? G.ts : 1), G.view);
      const title = G.phase === 'title', run = G.run;
      AUDIO.drive({ on: !G.endShown && (!title || AUDIO.ready), rpm: title ? .24 + .3 * Math.pow(Math.max(0, Math.sin(WORLD.time * 1.7)), 14) : run.rpm, kmh: kmh(run.v), throttle: INPUT.held('up'), boost: run.boost > 0, live: run.onCable, rail: !!(run.cable && run.cable.rail), rumble: G.fx.rumble, dead: G.phase === 'blackout' });
      const cockpitOn = !params.has('clean');
      const m = COCKPIT.mirrors();
      const U = POST.U;
      U.uMirOn.value = cockpitOn ? 1 : 0;
      U.uMirL.value.set(m.L[0] * glRatio, (STAGE_H - m.L[1]) * glRatio, m.L[2] * glRatio);
      U.uMirR.value.set(m.R[0] * glRatio, (STAGE_H - m.R[1]) * glRatio, m.R[2] * glRatio);
      // 고가 붕괴 동안 후방 화면: 뒤를 보는 카메라를 조금 높여 무너지는 길이 보이게
      G.rearOn += ((G.run.chase.on ? 1 : 0) - G.rearOn) * Math.min(1, dt * 5);
      const R = COCKPIT.REAR;
      U.uRearOn.value = G.rearOn > .02 ? G.rearOn : 0;
      U.uRear.value.set(R.x * glRatio, (STAGE_H - R.y - R.h) * glRatio, R.w * glRatio, R.h * glRatio);
      WORLD.rear.position.y += G.rearOn * 2.2; WORLD.rear.rotation.x = -.02 - G.rearOn * .1; WORLD.rear.fov = 46 + G.rearOn * 14; WORLD.rear.updateProjectionMatrix();
      const t0 = performance.now();
      POST.render(renderer, WORLD.scene, WORLD.cam, WORLD.rear, cockpitOn);
      const booting = G.phase === 'race' && G.t < UI.boot, wave = Math.sin(clamp(G.t / UI.boot, 0, 1) * Math.PI);
      const racing = G.phase === 'race', th = G.threat;
      const rise = G.rise * G.rise * (3 - 2 * G.rise);
      if (!G.paused) COCKPIT.draw({
        show: cockpitOn, time: WORLD.time, kmh: kmh(run.v), gear: run.gear, attract: title,
        rpm: title ? .24 : booting ? Math.max(run.rpm, wave) : run.rpm,
        current: title ? .3 : booting ? Math.max(run.current, wave) : run.current,
        full: run.full, boost: run.boost > 0, live: run.onCable && !title && G.phase !== 'blackout',
        warn: racing && th && th.dist[run.lane] < Math.max(60, run.v * 1.3), warnFast: G.warnFast,
        marks: racing ? arMarks(run) : null,
        roll: -G.view.roll * .35, swayX: -G.fx.lean * 60, bobY: (G.view.y - FEEL.eye - rise * .9) * 40, vp: G.vp || [960, 470],
        rise: rise * 640, push: G.fx.push, surge: G.fx.surge, rear: G.rearOn
      }, dt);
      governor(performance.now() - t0, dt);
    }
    INPUT.endFrame();
    requestAnimationFrame(frame);
  }

  // 느린 기기: 그리기 해상도를 낮춘다(글자 · UI는 그대로 선명)
  function governor(ms, dt) {
    if (params.has('fixed')) return;
    frameMs += (dt * 1000 - frameMs) * .05;
    if (frameMs > 21) { slowT += dt; fastT = 0; } else if (frameMs < 13) { fastT += dt; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT > 2.5 && quality > .6) { quality = Math.max(.6, quality - .15); slowT = 0; fit(); }
    if (fastT > 6 && quality < 1) { quality = Math.min(1, quality + .1); fastT = 0; fit(); }
  }

  // 콘솔 진단: LWR.state(), LWR.perf()
  window.LWR = {
    get G() { return G; },
    state: () => ({ phase: G.phase, s: G.run && Math.round(G.run.s), kmh: G.run && Math.round(kmh(G.run.v)), lit: G.run && G.run.lit, fuses: G.run && G.run.fuses, crashes: G.run && G.run.crashes, closes: G.run && G.run.closes, egg: !!(G.run && G.run.egg), quality }),
    perf: () => ({ frameMs: +frameMs.toFixed(2), quality, glRatio: +glRatio.toFixed(2), calls: renderer && renderer.info.render.calls, tris: renderer && renderer.info.render.triangles }),
    course: () => G.course,
    world: () => WORLD
  };

  boot();

})();
