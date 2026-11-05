/* 03 VHS — Figma PLAYER의 정면도 · 측면도로 만든 실제 3D 플레이어. 테이프가 같은 공간에서 회전 · 정렬돼 슬롯으로 들어가고,
   모니터에서 시작된 영상 쪽으로 카메라가 들어가 화면을 채운다 */
import { THREE, V3, Q } from '../core/three.js';
import { stage, camera, plane, slab, litMat, cropUV, glowMesh, reelRingTex } from '../core/stage.js';
import { VS, SCREEN_FS } from '../core/shaders.js';
import { T } from '../core/assets.js';
import { PLAYER3D as P3, PW, PH, TAPE_W, TAPE_AR, STAGE_Z, CAM_D, VIDEO } from '../core/config.js';
import { S, L, B, V, mouse, scrollToP } from '../core/state.js';
import { $, clamp, seg, lerp, ss, eo, eob, eio, bump, RM } from '../core/utils.js';
import { AUD, SFX } from '../core/audio.js';

export const vid = document.getElementById('vid');
const videoTex = new THREE.VideoTexture(vid);
export const vhs = { playerG:null, body:null, front:null, slot:null, flapPivot:null, flap:null, cavLight:null, glows:[], reelGlows:[], reelRings:[], antGlow:null,
  top:null, screenG:null, scrPlane:null, bezel:null };

/* ---------- build ---------- */
export function buildPlayer(){
  const g = vhs.playerG = new THREE.Group(); g.visible = false; stage.add(g);
  const { ar, depth } = P3, [u0, v0, u1, v1] = P3.slot;               // v는 위에서 아래
  const dark = new THREE.MeshStandardMaterial({ color:0x2e2e33, roughness:.62, metalness:.12 });   // 윗면 · 아랫면 · 뒷면: 정면도의 어두운 금속 톤 (반사 환경이 없으니 금속성은 낮게)
  const front = vhs.front = litMat(T.player_front, { sat:.06, hole:[u0, 1 - v1, u1, 1 - v0] });
  const side = litMat(T.player_side, { sat:.06 });
  const geo = new THREE.BoxGeometry(1, ar, depth);
  const uv = geo.attributes.uv; for (let i = 4; i < 8; i++) uv.setX(i, 1 - uv.getX(i)); uv.needsUpdate = true;   // 왼쪽 면은 측면도를 뒤집어
  const pos = geo.attributes.position; for (let i = 8; i < 12; i++) pos.setY(i, ar/2 - P3.top*ar); pos.needsUpdate = true;   // 윗면은 손잡이 꼭대기가 아니라 몸체 높이에 (손잡이 뒤에 판이 떠 보이지 않게)
  // 윗면: 정면도에서 손잡이 바로 아래 금속 띠를 이어 붙인다 (앞 모서리 = 띠의 위쪽) — 맨 단색 판으로 보이지 않게
  const top = vhs.top = litMat(T.player_front, { sat:.06 });
  for (const [i, u, v] of [[8, .33, .19], [9, .97, .19], [10, .33, .11], [11, .97, .11]]) uv.setXY(i, u, 1 - v);
  const body = vhs.body = new THREE.Mesh(geo, [side, side, top, dark, front, dark]);
  body.castShadow = body.receiveShadow = true; g.add(body);

  // 슬롯: 정면도의 카세트 창을 실제로 뚫고, 안쪽은 어두운 공간
  const sw = u1 - u0, sh = (v1 - v0)*ar, sx = (u0 + u1)/2 - .5, sy = (.5 - (v0 + v1)/2)*ar, fz = depth/2;
  vhs.slot = { sw, sh, sx, sy, fz };
  const cav = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, depth*.8), new THREE.MeshStandardMaterial({ color:0x0a0a0c, roughness:.9, side:THREE.BackSide }));
  cav.position.set(sx, sy, fz - depth*.4); g.add(cav);
  const cl = vhs.cavLight = glowMesh(0x5ff3ff, 1); cl.scale.set(sw*.95, sh*.85, 1); cl.position.set(sx, sy, fz - depth*.78); g.add(cl);
  // 플랩: 같은 픽셀, 위쪽 경첩으로 테이프에 밀려 안쪽으로 열린다
  const piv = vhs.flapPivot = new THREE.Group(); piv.position.set(sx, sy + sh/2, fz + .001); g.add(piv);
  const flap = vhs.flap = new THREE.Mesh(cropUV(new THREE.PlaneGeometry(sw, sh), [u0, 1 - v1, sw, v1 - v0]), litMat(T.player_front, { sat:.06 }));
  flap.position.y = -sh/2; flap.receiveShadow = true; piv.add(flap);
  const fb = plane(sw, sh, dark); fb.rotation.y = Math.PI; fb.position.set(0, -sh/2, -.002); piv.add(fb);
  // 불빛: LED · 릴(플랩과 함께 움직인다)
  for (const [u, v, r, c] of P3.leds) { const m = glowMesh(c, r*4); m.position.set(u - .5, (.5 - v)*ar, fz + .004); g.add(m); vhs.glows.push(m); }
  for (const [u, v] of P3.reels) {
    const x = u - .5 - sx, y = (.5 - v)*ar - sy;
    const m = glowMesh(0x5ff3ff, .07); m.position.set(x, y, .003); flap.add(m); vhs.reelGlows.push(m);
    const rr = plane(.032, .032, new THREE.MeshBasicMaterial({ map:reelRingTex, color:0xb8fdff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    rr.position.set(x, y, .004); flap.add(rr); vhs.reelRings.push(rr);
  }
  // 안테나: 정면도에서 몸체 위로 솟은 부분은 실제 3D로
  const ant = new THREE.Group(); ant.position.set(P3.antenna - .5, ar/2, fz - .035); g.add(ant);
  const metal = new THREE.MeshStandardMaterial({ color:0x2c2c30, roughness:.35, metalness:.8 });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.006, .009, .27, 10), metal); rod.position.y = .135; rod.castShadow = true; ant.add(rod);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), metal); tip.position.y = .272; ant.add(tip);
  vhs.antGlow = new THREE.Mesh(new THREE.CylinderGeometry(.0098, .0098, .055, 10), new THREE.MeshBasicMaterial({ color:0x5ff3ff, transparent:true, opacity:0 }));
  vhs.antGlow.position.y = .12; ant.add(vhs.antGlow);
  // 바닥 그림자 (테이프 · 플레이어가 같은 빛 아래 있다)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.12, depth + .14), new THREE.ShadowMaterial({ opacity:.38 }));   // 몸체 바로 아래만 (바닥이 없는 월드에서 판처럼 보이지 않게)
  floor.rotation.x = -Math.PI/2; floor.position.set(0, -ar/2 - .002, .04); floor.receiveShadow = true; g.add(floor);
}

export function buildScreen(){
  const g = vhs.screenG = new THREE.Group(); stage.add(g);
  const bz = vhs.bezel = slab(1, 1, .07, .04, new THREE.MeshStandardMaterial({ color:0x0b0b0d, roughness:.4, metalness:.2, transparent:true, opacity:0 }));
  bz.position.z = -.04; g.add(bz);
  vhs.scrPlane = plane(1, 1, new THREE.ShaderMaterial({ vertexShader:VS, fragmentShader:SCREEN_FS, transparent:true,
    uniforms:{ map:{value:videoTex}, uOpacity:{value:0}, uNoise:{value:1}, uTrackY:{value:0}, uTrack:{value:0}, uTime:{value:0}, uBright:{value:1},
      uRadius:{value:.012}, uAspect:{value:16/9}, uScan:{value:.25}, uWhite:{value:0} } }));
  vhs.scrPlane.position.z = .002; g.add(vhs.scrPlane);
}

/* ---------- 테이프가 지나갈 자리 (플레이어 기준 → 월드). 크기는 처음부터 끝까지 같다 ---------- */
const TW = P3.tape, TH = TW*TAPE_AR;                                     // 플레이어 폭 1 기준 테이프 폭 · 높이
const qFlat = new Q().setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));   // 라벨을 위로, 눕혀서 슬롯 쪽으로
const qUp = new Q().setFromEuler(new THREE.Euler(.06, -.32, 0));
const frames = { hover:{ pos:new V3(), q:new Q() }, align:{ pos:new V3(), q:new Q() }, inside:{ pos:new V3(), q:new Q() }, slot:new V3(), s:1 };
const qW = new Q();
export function tapeFrames(){
  const g = vhs.playerG, { sx, sy, sh, fz } = vhs.slot;
  stage.updateMatrixWorld(true); g.getWorldQuaternion(qW);
  g.localToWorld(frames.hover.pos.set(sx, sy + sh/2 + .2, fz + .26)); frames.hover.q.copy(qW).multiply(qUp);
  g.localToWorld(frames.align.pos.set(sx, sy, fz + TH/2 + .03)); frames.align.q.copy(qW).multiply(qFlat);
  g.localToWorld(frames.inside.pos.set(sx, sy, fz - TH/2 - .025)); frames.inside.q.copy(qW).multiply(qFlat);
  g.localToWorld(frames.slot.set(sx, sy, fz));
  frames.s = L.tr/TAPE_W;
  return frames;
}
/* 밀어 넣다가(느리게) 마지막엔 기계가 끌어당긴다(빠르게) */
export const insertEase = k => k < .62 ? .42*(k/.62) : .42 + .58*Math.pow((k - .62)/.38, 2.2);

/* ---------- 카메라: 테이프 주위를 돌다가 → 플레이어가 드러나고 → 슬롯 → 모니터 안으로 ---------- */
const kp = { a:new V3(), b:new V3(), la:new V3(), lb:new V3() }, tmp = new V3(), tmp2 = new V3();
function vhsKey(i, out, look){
  const f = frames, pw = L.pw3, st = L.stage;
  const mon = tmp2.set(0, L.monY, 0); stage.localToWorld(mon);
  switch (i) {
    case 0: { const d = L.tr*2.7; look.copy(f.hover.pos); out.copy(f.hover.pos).add(tmp.set(d*.2, d*.1, d)); break; }                 // 테이프 가까이
    case 1: { const d = L.tr*2.7, a = -.24; look.copy(f.hover.pos); out.copy(f.hover.pos).add(tmp.set(Math.sin(a)*d, d*.22, Math.cos(a)*d)); break; }  // 주위를 돈다 (배경 판 안에서)
    case 2: { vhs.playerG.getWorldPosition(look); look.y += pw*.08; out.copy(look).add(tmp.set(pw*.22, pw*.3, pw*1.62)); break; }  // 플레이어가 드러난다
    case 3: { look.copy(f.slot); out.copy(f.slot).add(tmp.set(pw*.16, pw*.22, pw*1.05)); break; }                                    // 슬롯 앞
    case 4: { const top = L.monY + L.monH/2, bot = L.py3 - P3.ar*pw/2, cy = (top + bot)/2;                                          // 플레이어 + 모니터
      look.set(0, cy, 0); stage.localToWorld(look); out.copy(look).add(tmp.set(0, .08, (top - bot)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*1.12)); break; }
    case 5: { const tH = Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);                                                            // 영상이 화면을 채운다
      const d = Math.max((L.monH/2)/(tH*.95), (L.monW/2)/(tH*camera.aspect*.95)); look.copy(mon); out.copy(mon).add(tmp.set(0, 0, d)); break; }
    default: look.set(0, 0, STAGE_Z); out.set(0, .1, STAGE_Z + CAM_D);                                                                // 무대 기본
  }
}
const KEYS = [[.30, 0], [.326, 1], [.35, 2], [.372, 3], [.395, 4], [.435, 5], [.475, 5], [.50, 6]];
export function vhsCamera(P_, pos, look){
  let i = 0; while (i < KEYS.length - 1 && P_ > KEYS[i + 1][0]) i++;
  const [p0, k0] = KEYS[i], [p1, k1] = KEYS[Math.min(i + 1, KEYS.length - 1)];
  vhsKey(k0, kp.a, kp.la); vhsKey(k1, kp.b, kp.lb);
  const t = p1 > p0 ? ss(seg(P_, p0, p1)) : 1;
  pos.lerpVectors(kp.a, kp.b, t); look.lerpVectors(kp.la, kp.lb, t);
  const still = P_ > .42 && P_ < .48 ? 0 : 1;                           // 영상을 보는 동안은 고정
  pos.x += mouse.x*.08*still; pos.y += mouse.y*.05*still;
}

/* ---------- 영상은 장면에 가까워질 때만 불러온다 ---------- */
export function ensureVideo(){
  if (vid.src) return;
  vhs.scrPlane.material.uniforms.map.value = new THREE.TextureLoader().load(VIDEO.poster);   // 첫 프레임이 오기 전엔 포스터
  vid.addEventListener('loadeddata', () => { vhs.scrPlane.material.uniforms.map.value = videoTex; }, { once:true });
  vid.preload = 'auto'; vid.src = VIDEO.src;
}

/* ---------- scroll: 플레이어 · 플랩 · 모니터. 04에서 화면이 첫 번째 패키지로 뒤집히는 위치(sx, sy, fl)를 돌려준다 ---------- */
export function updateVhs(P_){
  const { playerG, front, flap, flapPivot, cavLight, glows, reelGlows, reelRings, antGlow, screenG, scrPlane, bezel } = vhs, env = B.env;
  const rise = eo(seg(P_, .302, .342)), out = eio(seg(P_, .475, .505));   // 테이프만 보이는 순간 뒤에 아래에서 올라온다
  playerG.visible = P_ > .298 && P_ < .51;
  if (playerG.visible) {
    const shake = RM ? 0 : V.shake*Math.sin(S.time*95)*.01;
    playerG.position.set(shake, lerp(L.py3 - L.stage.h*1.1, L.py3, rise) - out*L.stage.h, lerp(-1.2, 0, rise));
    playerG.scale.setScalar(L.pw3);
    // 플랩: 테이프가 밀고 들어가는 동안 열리고, 다 들어가면 닫힌다
    const k = seg(P_, .358, .38);
    flapPivot.rotation.x = 1.15*ss(seg(k, .02, .3))*(1 - ss(seg(P_, .38, .387)));
    const on = V.boot < 0 ? 0 : ss(clamp(V.boot/.55));
    for (const m of [front, flap.material, vhs.top]) { m.userData.uSat.value = lerp(.06, 1, on); m.emissiveIntensity = lerp(.3, .5, on)*(1 + bump(V.boot, 0, .25)*.6); }
    flap.material.color.setScalar(P_ < .37 ? .28 : lerp(.28, 1, ss(seg(P_, .372, .386))));   // 빈 창은 어둡게 → 테이프가 들어가면 카세트가 보인다
    glows.forEach(g => g.material.opacity = on*(.5 + env*.4));
    reelGlows.forEach(g => g.material.opacity = on*(.55 + env*.4));
    reelRings.forEach(r => { r.material.opacity = on*.75; r.rotation.z = -S.reelSpin; });
    cavLight.material.opacity = .04 + on*.25;
    antGlow.material.opacity = on*(.6 + env*.4);
  }

  // 모니터 (원본 베젤 화면): 플레이어 위에서 노이즈 · 트래킹 → 영상
  const bt = V.boot, fl = eio(seg(P_, .50, .575)), sh = eio(seg(P_, .50, .545));
  const sy = lerp(L.monY, L.pkgY, fl), sx = 0;
  screenG.visible = bt > .1 && P_ > .375 && fl < .5;
  if (screenG.visible) {
    const ow = ss(seg(bt, .15, .42)), oh = eob(seg(bt, .42, .82));
    const sW = lerp(L.monW, L.pkgH*PW/PH*.97, sh), sH = lerp(L.monH, L.pkgH*.97, sh);
    const sWo = sW*Math.max(ow, .002), sHo = sH*Math.max(oh, .007);
    scrPlane.scale.set(sWo, sHo, 1);
    const su = scrPlane.material.uniforms;
    su.uAspect.value = sWo/sHo; su.uTime.value = S.time;
    su.uOpacity.value = bt > .12 ? 1 : 0;
    su.uNoise.value = 1 - ss(seg(bt, 1.25, 1.95));
    su.uTrack.value = bump(bt, 1.05, 2.3)*1.1 + (vid.paused && bt > 2 ? .2 : 0);
    su.uTrackY.value = 1.1 - ((bt*.55) % 1.3);
    su.uWhite.value = (1 - ss(seg(bt, .4, .7)))*.92;
    su.uScan.value = lerp(lerp(.6, .25, ss(seg(bt, 1.3, 2.1))), .05, ss(seg(P_, .40, .43)));   // 화면을 채우면 주사선은 거의 없앤다
    su.uBright.value = 1 + bump(bt, .35, .6)*.5;
    bezel.scale.set(sWo + .09*(1 - sh)*oh + .02, sHo + .09*(1 - sh)*oh + .02, 1 + sh*.6);
    bezel.material.opacity = ss(oh); bezel.position.z = -.0355*bezel.scale.z;
    screenG.position.set(sx, sy, .06);
    screenG.rotation.y = fl*Math.PI;
  }
  if (S.prevP < .358 && P_ >= .358 && P_ < .37) SFX.clack();
  return { sx, sy, fl };
}

/* ---------- 재생 ---------- */
const hasGesture = () => (navigator.userActivation ? navigator.userActivation.hasBeenActive : S.gestured);
export function playVideo(){
  if (V.pending) return; V.pending = true;
  if (V.ended) { vid.currentTime = 0; V.ended = false; }
  vid.muted = !(AUD.on && hasGesture()) || V.forceMute;
  vid.play().catch(() => { vid.muted = true; return vid.play(); }).catch(() => {}).finally(() => { V.pending = false; });
}
export function togglePlay(){
  if (V.boot < 1.2) return;
  if (vid.paused) { V.userPaused = false; playVideo(); } else { V.userPaused = true; vid.pause(); }
  SFX.click();
}
export function updateVideoState(dt){
  const p = S.p;
  if (S.mode === 'scroll') {
    if (p > .2) ensureVideo();                                          // VHS 장면에 가까워지면 미리 받기 시작
    if (V.boot < 0 && p >= .381) { V.boot = 0; V.shake = 1; SFX.clunk(); SFX.whir(); }   // 철컥 → 전원
    else if (V.boot >= 0 && p < .37) { V.boot = -1; V.userPaused = false; V.ended = false; if (!vid.paused) vid.pause(); }
  }
  if (V.boot >= 0) {
    const b0 = V.boot; V.boot += dt;
    if (b0 < .42 && V.boot >= .42) SFX.hiss(1.3);
    if (b0 < 1.25 && V.boot >= 1.25) SFX.start();
    // 모니터에서 영상이 시작되면 (더 내리지 않았을 때) 카메라가 화면 안으로 들어간다
    if (b0 < 2.4 && V.boot >= 2.4 && S.mode === 'scroll' && S.pT > .375 && S.pT < .42) scrollToP(.44);
  }
  // 화면 밖이거나 탭이 숨으면 멈춘다
  const want = S.mode === 'scroll' && V.boot > 1.25 && p > .378 && p < .5 && !V.userPaused && !V.ended && document.visibilityState === 'visible';
  if (want && vid.paused) playVideo(); else if (!want && !vid.paused && !document.fullscreenElement) vid.pause();
  V.shake *= Math.exp(-dt*8);
}

/* ---------- 조작 버튼 (한 번만 연결) ---------- */
export function initVideoControls(noteGesture){
  vid.addEventListener('ended', () => { V.ended = true; });
  $('#vPlay').addEventListener('click', () => { noteGesture(); togglePlay(); });
  $('#vSnd').addEventListener('click', () => { noteGesture(); vid.muted = !vid.muted; V.forceMute = vid.muted; if (!vid.muted && vid.volume === 0) vid.volume = .8; if (vid.paused && !vid.muted) { V.userPaused = false; playVideo(); } });
  $('#vFull').addEventListener('click', () => {
    noteGesture(); const f = vid.requestFullscreen || vid.webkitRequestFullscreen;
    if (f) { vid.controls = true; const r = f.call(vid); if (r && r.catch) r.catch(() => {}); } else if (vid.webkitEnterFullscreen) vid.webkitEnterFullscreen();
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) vid.controls = false; });
  const sk = $('#vSeek'); let seeking = false;
  const seekTo = e => { const r = sk.getBoundingClientRect(), k = clamp((e.clientX - r.left)/r.width); if (vid.duration) { vid.currentTime = k*vid.duration; V.ended = false; } };
  sk.addEventListener('pointerdown', e => { seeking = true; sk.setPointerCapture(e.pointerId); seekTo(e); });
  sk.addEventListener('pointermove', e => { if (seeking) seekTo(e); });
  sk.addEventListener('pointerup', () => seeking = false);
  sk.addEventListener('keydown', e => {
    if (!vid.duration) return;
    if (e.key === 'ArrowRight') vid.currentTime = Math.min(vid.duration, vid.currentTime + 5);
    if (e.key === 'ArrowLeft') vid.currentTime = Math.max(0, vid.currentTime - 5);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' && !vid.paused) vid.pause(); });
  // 음량: LED 미터를 누르거나 끌어서 정한다. 0이면 음소거, 올리면 소리가 켜진다. 이 브라우저에서만 기억한다
  const vol = $('#vVol');
  try { const s = parseFloat(localStorage.getItem('pulse.vol')); vid.volume = s >= 0 && s <= 1 ? s : .8; } catch (e) { vid.volume = .8; }
  { const t = vid.volume; vid.volume = t === .5 ? .4 : .5; if (vid.volume === t) vol.classList.add('na'); vid.volume = t; }   // iOS는 음량을 바꿀 수 없다
  const setVol = v => {
    v = Math.round(clamp(v)*20)/20; vid.volume = v; vid.muted = v === 0; V.forceMute = vid.muted;
    if (v > 0 && vid.paused && !V.ended) { V.userPaused = false; playVideo(); }
    try { localStorage.setItem('pulse.vol', String(v)); } catch (e) {}
  };
  let volDrag = false;
  const volAt = e => { const r = vol.getBoundingClientRect(); setVol((e.clientX - r.left - 2)/(r.width - 4)); };
  vol.addEventListener('pointerdown', e => { noteGesture(); volDrag = true; vol.setPointerCapture(e.pointerId); volAt(e); });
  vol.addEventListener('pointermove', e => { if (volDrag) volAt(e); });
  vol.addEventListener('pointerup', () => volDrag = false);
  vol.addEventListener('keydown', e => {
    const cur = vid.muted ? 0 : vid.volume;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); noteGesture(); setVol(cur + .1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); noteGesture(); setVol(cur - .1); }
  });
}
