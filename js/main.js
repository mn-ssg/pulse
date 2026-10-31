/* PULSE — 진입점
   불러오기: 첫 화면(테이프 · 폰트)만 기다렸다가 바로 시작 → 월드 · 플레이어는 곧바로 뒤에서 → 게임 표지 · 게임기는 그다음 → 영상은 VHS 장면에 가까워질 때
   프레임: 스크롤 위치(p)가 타임라인이고, 하나의 박동(B.env)이 화면 전체를 움직인다 */
import { THREE } from './core/three.js';
import { renderer, scene, camera, resizeRenderer } from './core/stage.js';
import { IMAGE_GROUPS, FONTS } from './core/config.js';
import { loadImages, loadFonts } from './core/assets.js';
import { computeLayout } from './core/layout.js';
import { S, W, V, mouse, cam, maxScroll, pFromScroll, TRACK_VH } from './core/state.js';
import { $, lerp, runTweens, RM } from './core/utils.js';
import { buildTrace, initLogo, resizeLogo, wake, updatePulse, updateLogo, updateTrace } from './scenes/pulse.js';
import { buildTape, buildWorld, resizeWorld, updateCamera, updateTape, updateWorld, updateLeds } from './scenes/world.js';
import { buildPlayer, buildScreen, updateVhs, updateVideoState, initVideoControls, vid } from './scenes/vhs.js';
import { games, buildGames, resizeGames, updateCollection, updateGamesFrame } from './scenes/games.js';
import { buildHud, updateHud } from './ui/hud.js';
import { buildTypography, fitTypography, updateTypography } from './ui/typography.js';
import { initInput, noteGesture } from './ui/input.js';

/* ---------- 리사이즈 (한 프레임에 한 번만) ---------- */
let resizeQueued = false;
function resize(){
  resizeQueued = false;
  resizeRenderer(); computeLayout(); resizeLogo(); resizeWorld(); fitTypography();
  if (games.ready) resizeGames();
}
const queueResize = () => { if (!resizeQueued) { resizeQueued = true; requestAnimationFrame(resize); } };

/* ---------- 프레임 ---------- */
const clock = new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .1);
  if (S.mode === 'play') return;                                        // 게임 중엔 뒤의 3D를 그리지 않는다
  S.time += dt;
  if (S.mode === 'scroll') {
    S.pT = pFromScroll(scrollY/maxScroll());
    S.p += (S.pT - S.p)*(1 - Math.exp(-dt*(RM ? 30 : 5.5)));
    if (Math.abs(S.pT - S.p) < 1e-5) S.p = S.pT;
    if (!W.awake && (S.p > .004 || S.time > 2.4)) wake();
  }
  updatePulse(dt);
  S.vel = lerp(S.vel, (S.p - S.pPrev)/Math.max(dt, 1e-3)*dt, .2); S.pPrev = S.p;
  mouse.x += (mouse.tx - mouse.x)*(1 - Math.exp(-dt*4)); mouse.y += (mouse.ty - mouse.y)*(1 - Math.exp(-dt*4));
  runTweens(dt);
  if (S.mode === 'scroll') {
    const P_ = S.p;
    const flip = updateVhs(P_);                                        // 플레이어를 먼저 놓고 → 테이프 · 카메라가 그 자리를 따른다
    const { tr, cz } = updateCamera(P_, dt);
    updateTape(P_, tr, dt);
    updateWorld(P_, cz);
    updateCollection(P_, flip);
  } else S.reelSpin += dt*2;
  updateGamesFrame(dt);
  updateLeds();
  updateVideoState(dt);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  scene.updateMatrixWorld(); camera.updateMatrixWorld();
  updateLogo();
  updateTypography();
  updateTrace();
  updateHud();
  renderer.render(scene, camera);
  S.prevP = S.p;
}

/* ---------- 시작 ---------- */
async function start(){
  const bar = $('#loadBar'), pct = $('#loadPct');
  const progress = k => { bar.style.transform = `scaleX(${k})`; pct.textContent = `LOADING ${Math.round(k*100)}%`; };
  // 1) 첫 화면에 필요한 것만 기다린다
  const firstScreen = Promise.all([loadImages(IMAGE_GROUPS.intro, progress), loadFonts(FONTS.intro), document.querySelector('#logo img').decode().catch(() => {})]);
  loadImages(IMAGE_GROUPS.world);                                       // 2) 바로 다음 장면은 기다리지 않고 받기 시작
  await firstScreen;
  document.getElementById('track').style.height = TRACK_VH + 'vh';
  initLogo(); buildTypography(); buildTape(); buildWorld(); buildPlayer(); buildScreen(); buildTrace(); buildHud();
  initVideoControls(noteGesture); initInput();
  resize(); addEventListener('resize', queueResize);
  S.mode = 'scroll'; S.p = S.pT = pFromScroll(scrollY/maxScroll());
  progress(1); $('#load').classList.add('done');
  requestAnimationFrame(frame);
  // 3) 게임 표지 · 칩 · 게임기: 첫 화면이 뜬 뒤 뒤에서 불러 만든다
  await Promise.all([loadImages(IMAGE_GROUPS.games), loadFonts(FONTS.games)]);
  buildGames();
}
start();

/* QA용 읽기 전용 상태 (브라우저 콘솔: __pulse.mode 등) */
window.__pulse = { get mode(){ return S.mode; }, get p(){ return S.p; }, get boot(){ return V.boot; }, get ready(){ return games.ready; }, vid, wake };
