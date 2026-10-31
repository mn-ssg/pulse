/* 05–09 GAME COVER → 패키지 열기 → 칩 → 게임기 → 부팅 */
import { THREE, V3, Q } from '../core/three.js';
import { scene, stage, canvas, rimL, plane, slab, extrude, chipShape, imgMat, canvasTex, vis, rayAt } from '../core/stage.js';
import { T } from '../core/assets.js';
import { GAMES, META, STEP_C, STAGE_Z, CAM_D, PW, PH, PD } from '../core/config.js';
import { S, L, mouse, cam } from '../core/state.js';
import { clamp, seg, lerp, ss, eio, eo, eob, tween, wait, snapT } from '../core/utils.js';
import { ac, SFX } from '../core/audio.js';
import { ov, showOv, showBack, flashText, lockScroll } from '../ui/overlay.js';
import { vid } from './vhs.js';

export const games = { ready:false, pkgs:[], bgPlanes:[], consoleG:null, conScreen:null, slotGlow:null };
const CAM_STAGE = new V3(0, 0, STAGE_Z + CAM_D), LOOK_STAGE = new V3(0, 0, STAGE_Z);
let bootT = -1, slotPulse = 0, chipDrag = null, bootTex, bootCtx;

/* ---------- 패키지 옆면 · 안쪽 · 칩 뒷면 (표지 체계를 이어서) ---------- */
function spineTex(g){ return canvasTex(128, 1150, (x, w, h) => {
  x.fillStyle = '#f2efe9'; x.fillRect(0, 0, w, h);
  x.save(); x.translate(w/2, h); x.rotate(-Math.PI/2); x.textBaseline = 'middle';
  x.fillStyle = '#111'; x.font = '900 54px Inter, Arial Black, sans-serif'; x.fillText('IDIOTAPE', 44, 2);
  x.fillStyle = '#111'; x.fillRect(370, -40, 640, 80);
  x.fillStyle = '#f2efe9'; x.font = '700 26px Inter, Arial, sans-serif'; x.fillText(`${g.name}  ·  ${g.track.split(' · ')[1]}`, 392, 2);
  x.fillStyle = '#8a8a8a'; x.font = '700 15px Inter, Arial, sans-serif'; x.fillText('IDIOTAPE  GAME SYSTEM', 1030, 0);
  x.restore();
  x.fillStyle = '#111'; x.fillRect(w/2 - 14, h - 1130, 28, 28);
}); }
function trayTex(g){ return canvasTex(1024, 1010, (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#202024'); gr.addColorStop(1, '#141416'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) x.strokeRect(40 + i*3, 40 + i*3, w - 80 - i*6, h - 80 - i*6);
  const cw = 380, ch = cw*META.chip[1]/META.chip[0], cx = w/2, cy = h/2 + 8;
  x.fillStyle = '#0c0c0e'; x.beginPath(); x.roundRect(cx - cw/2 - 16, cy - ch/2 - 16, cw + 32, ch + 32, 22); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#2a2a2e'; x.fillRect(cx - 60, cy + ch/2 + 2, 120, 12);
  x.fillStyle = 'rgba(242,239,233,.35)'; x.font = '500 22px "JetBrains Mono", monospace'; x.fillText('IDIOTAPE  GAME SYSTEM', 72, 92);
  x.textAlign = 'right'; x.fillText(g.code, w - 72, h - 70);
}); }
function lidTex(g){ return canvasTex(1024, 1010, (x, w, h) => {
  x.fillStyle = '#121214'; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 2; x.strokeRect(40, 40, w - 80, h - 80);
  const im = T.logo_idiotape.image, lw = 560, lh = lw*im.height/im.width;
  x.globalAlpha = .16; x.drawImage(im, (w - lw)/2, h*.42 - lh/2, lw, lh); x.globalAlpha = 1;
  x.fillStyle = 'rgba(242,239,233,.42)'; x.font = '500 22px "Noto Sans KR", sans-serif'; x.textAlign = 'center';
  x.fillText('이 게임은 대학 커뮤니케이션 디자인 과제를 위해 만든 가상의 제품입니다.', w/2, h - 150);
  x.fillText('실제 게임기 제조사 및 게임사와 관계가 없습니다.', w/2, h - 116);
  x.fillStyle = 'rgba(242,239,233,.3)'; x.font = '500 20px "JetBrains Mono", monospace'; x.fillText(`${g.name}  ·  ${g.code}`, w/2, h*.42 + lh/2 + 60);
}); }
function chipBackTex(g){ const im = T[g.id + '_chip'].image; return canvasTex(im.width, im.height, (x, w, h) => {
  x.save(); x.translate(w, 0); x.scale(-1, 1); x.drawImage(im, 0, 0, w, h); x.restore();
  x.globalCompositeOperation = 'source-atop';
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a2a2e'); gr.addColorStop(1, '#19191c'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = '#c9a14a'; x.fillRect(110 + i*50, 60, 30, 120); x.fillStyle = 'rgba(255,240,200,.35)'; x.fillRect(110 + i*50, 60, 30, 10); }
  x.fillStyle = 'rgba(242,239,233,.55)'; x.font = '700 30px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('IDIOTAPE', w/2, 330);
  x.font = '500 20px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(242,239,233,.35)'; x.fillText('GAME SYSTEM', w/2, 366); x.fillText(g.code, w/2, h - 200);
}); }

function makeChip(g){
  const CW = .36, CH = CW*META.chip[1]/META.chip[0], D = .03;
  const grp = new THREE.Group();
  const body = extrude(chipShape(CW*.955, CH*.965, .025, CW*.15), D*.9, new THREE.MeshStandardMaterial({ color:0x1d1d20, roughness:.5, metalness:.2 }));
  grp.add(body);
  const front = plane(CW, CH, imgMat(T[g.id + '_chip'])); front.position.z = D/2 + .001; grp.add(front);
  const back = plane(CW, CH, imgMat(chipBackTex(g))); back.rotation.y = Math.PI; back.position.z = -D/2 - .001; grp.add(back);
  grp.userData = { CW, CH, D, hit:[front, back, body] };
  return grp;
}
function makePkg(g, i){
  const root = new THREE.Group(); stage.add(root);
  const mBody = new THREE.MeshStandardMaterial({ color:0x111113, roughness:.32, metalness:.12, transparent:true });
  const base = new THREE.Group(); root.add(base);
  const bb = slab(PW, PH, PD*.5, .028, mBody); bb.position.z = -PD*.25; base.add(bb);
  const back = plane(PW*.994, PH*.994, imgMat(T[g.id + '_back'], { sheen:.05 })); back.rotation.y = Math.PI; back.position.z = -PD*.5 - .0016; base.add(back);
  const tray = plane(PW*.95, PH*.95, imgMat(trayTex(g))); tray.position.z = .0012; base.add(tray);
  const spine = plane(PD*.96, PH*.985, imgMat(spineTex(g))); spine.rotation.y = -Math.PI/2; spine.position.x = -PW/2 - .0016; base.add(spine);
  const lidPivot = new THREE.Group(); lidPivot.position.set(-PW/2, 0, .002); root.add(lidPivot);
  const lid = new THREE.Group(); lid.position.x = PW/2; lidPivot.add(lid);
  const lb = slab(PW, PH, PD*.5, .028, mBody); lb.position.z = PD*.25; lid.add(lb);
  const front = plane(PW*.994, PH*.994, imgMat(T[g.id + '_front'], { sheen:.06 })); front.position.z = PD*.5 + .0016; lid.add(front);
  const lin = plane(PW*.95, PH*.95, imgMat(lidTex(g))); lin.rotation.y = Math.PI; lin.position.z = -.0006; lid.add(lin);
  const chip = makeChip(g); chip.position.set(0, .004, .022); chip.visible = false; base.add(chip);
  const mats = [back, tray, spine, front, lin].map(m => m.material);
  const P = { g, i, root, base, lidPivot, lid, chip, mats, mBody, front, hit:[front, back, bb, lb, spine],
    dragYaw:0, dragVel:0, hover:0, tilt:new THREE.Vector2(), tiltT:new THREE.Vector2() };
  P.look = (sat, bright, op) => { for (const m of mats) { m.uniforms.uSat.value = sat; m.uniforms.uBright.value = bright; m.uniforms.uOpacity.value = op; }
    mBody.opacity = op; mBody.color.setScalar(.066*bright); };
  root.visible = false;
  return P;
}
function buildConsole(){
  const g = games.consoleG = new THREE.Group(); g.visible = false; stage.add(g);
  const CW = 1, CH = META.console[1]/META.console[0];
  const body = slab(CW*.962, CH*.86, .16, CH*.3, new THREE.MeshStandardMaterial({ color:0x18191b, roughness:.62, metalness:.12 }));
  body.position.z = -.081; g.add(body);
  const face = plane(CW, CH, imgMat(T.console)); face.position.z = .0012; g.add(face);
  const [u0, v0, u1, v1] = META.console_screen;
  bootTex = canvasTex(1248, 712, () => {}); bootCtx = bootTex.image.getContext('2d');
  const scr = games.conScreen = plane((u1 - u0)*CW, (v1 - v0)*CH, imgMat(bootTex, { radius:.006, aspect:(u1 - u0)/(v1 - v0)*CW/CH, bright:0 }));
  scr.position.set(((u0 + u1)/2 - .5)*CW, (.5 - (v0 + v1)/2)*CH, .0026); g.add(scr);
  const topY = CH*.43;
  const slot = plane(.2, .022, new THREE.MeshBasicMaterial({ color:0x000000 })); slot.rotation.x = -Math.PI/2; slot.position.set(0, topY + .0012, -.08); g.add(slot);
  const sg = games.slotGlow = plane(.26, .05, new THREE.MeshBasicMaterial({ color:0x5ff3ff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
  sg.rotation.x = -Math.PI/2; sg.position.set(0, topY + .002, -.08); g.add(sg);
  g.userData = { CW, CH, topY, slotZ:-.08, slot, face };
}
export function buildGames(){
  GAMES.forEach((g, i) => games.pkgs.push(makePkg(g, i)));
  GAMES.forEach(g => { const m = plane(1, 1, imgMat(T[g.id + '_blur'], { opacity:0, depthWrite:false, tint:g.glow, tintAmt:.18 })); m.position.z = -16; m.visible = false; stage.add(m); games.bgPlanes.push(m); });
  buildConsole();
  games.ready = true;
  resizeGames();
}
export function resizeGames(){ const v = vis(CAM_D + 16); games.bgPlanes.forEach(m => m.scale.set(v.w*1.15, v.h*1.15, 1)); }

/* ---------- 컬렉션 (스크롤) ---------- */
export const focusOf = pp => ss(seg(pp, .70, .765)) + ss(seg(pp, .835, .90));
export function collectionPose(i, pp, f){
  const P = games.pkgs[i], d = i - f, ad = Math.abs(d), k = 1 - Math.min(ad, 1);
  const loc = i === 0 ? seg(pp, .575, .73) : i === 1 ? seg(pp, .73, .87) : seg(pp, .87, 1.0);
  const sway = .3*Math.sin(Math.PI*2*loc)*k*(1 - P.hover);
  const enter = i === 0 ? 1 : ss(seg(pp, .555, .625));
  return {
    x:L.pkgX + d*L.spread + (1 - enter)*L.stage.w*.9*i, y:L.pkgY - ad*.12, z:-ad*2.6,
    // 마우스 위치에 따른 원근 · 기울기
    ry:-d*.6 + sway + P.dragYaw + k*(mouse.x*.16*(1 - P.hover) + P.tilt.x*.34), rx:k*(-mouse.y*.08*(1 - P.hover) - P.tilt.y*.22),
    s:L.pkgS*(1 - Math.min(ad, 1)*.2)*(1 + P.hover*.035), hz:P.hover*.18,
    sat:1 - Math.min(ad, 1)*.95, bright:1 - Math.min(ad, 1)*.62, op:enter*(1 - clamp(ad - 1.1))*(1 - Math.min(ad, 1)*.35),
  };
}
const bgBase = new THREE.Color(0x0e0e10), cA = new THREE.Color(), cB = new THREE.Color(), rimA = new THREE.Color(), rimB = new THREE.Color(), rimSky = new THREE.Color(0x9eeeff);
/* flip = 04에서 영상 화면이 첫 번째 패키지로 뒤집히는 위치 (vhs.js) */
export function updateCollection(P_, flip){
  if (!games.ready) return;
  S.focusF = focusOf(P_);
  games.pkgs.forEach((P, i) => {
    if (P_ < .5) { P.root.visible = false; return; }
    if (i === 0 && P_ < .575) {
      P.root.position.set(flip.sx, flip.sy, 0); P.root.rotation.set(0, flip.fl*Math.PI + Math.PI, 0); P.root.scale.setScalar(L.pkgS);
      P.look(1, 1, 1); P.root.visible = flip.fl >= .5;
    } else {
      const c = collectionPose(i, P_, S.focusF);
      P.root.position.set(c.x, c.y, c.z + c.hz); P.root.rotation.set(c.rx, c.ry, 0); P.root.scale.setScalar(c.s);
      P.look(c.sat, c.bright, c.op); P.root.visible = c.op > .01;
    }
    P.front.material.uniforms.uLight.value = .5 + mouse.x*.45*(1 - P.hover) + P.tilt.x*.45 + Math.sin(S.time*.4)*.08;
  });
  const bgIn = ss(seg(P_, .53, .62));
  games.bgPlanes.forEach((m, i) => { m.visible = bgIn > 0; if (m.visible) m.material.uniforms.uOpacity.value = bgIn*(1 - Math.min(Math.abs(i - S.focusF), 1))*.95; });
  const gi = Math.min(2, Math.floor(S.focusF)), gf = S.focusF - gi, gj = Math.min(2, gi + 1);
  cA.set(GAMES[gi].bg).lerp(cB.set(GAMES[gj].bg), gf);
  scene.background.copy(bgBase).lerp(cA, bgIn);
  rimL.color.copy(rimA.set(GAMES[gi].glow)).lerp(rimB.set(GAMES[gj].glow), gf).lerp(rimSky, 1 - bgIn);
}

/* ---------- 매 프레임 (모든 모드) ---------- */
export function updateGamesFrame(dt){
  if (!games.ready) return;
  games.pkgs.forEach((P, i) => {
    P.hover += ((S.hoverI === i && S.mode === 'scroll' ? 1 : 0) - P.hover)*(1 - Math.exp(-dt*10));
    if (!S.drag || S.drag.i !== i) P.dragVel *= .9;
    if (S.hoverI !== i) P.tiltT.multiplyScalar(Math.exp(-dt*6));
    P.tilt.lerp(P.tiltT, 1 - Math.exp(-dt*9));
  });
  const sg = games.slotGlow.material;
  sg.opacity = S.mode === 'insert' || S.mode === 'seq' ? (S.mode === 'insert' ? .35 + .3*Math.sin(S.time*5) : 0) + slotPulse*.4 : 0;
  slotPulse *= .9;
  if (S.mode === 'boot') {
    bootT += dt; games.conScreen.material.uniforms.uBright.value = Math.min(1, bootT*4); drawBoot(bootT);
    if (bootT > .65 && bootT - dt <= .65) SFX.chime();
    if (bootT > 3.3) { S.mode = 'ready'; S.busy = false; setStep(8); showBack(true); }
  } else if (S.mode === 'ready') { bootT += dt; drawBoot(bootT); }
}

/* 게임기 화면: 노이즈 → CRT → IDIOTAPE 로고 → 게임 로고 → PRESS START */
function drawBoot(t){
  const x = bootCtx, W = 1248, H = 712, g = S.sel >= 0 ? GAMES[S.sel] : GAMES[0];
  x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  if (t >= 0) {
    if (t < .4) { const n = 9; for (let yy = 0; yy < H; yy += n) for (let xx = 0; xx < W; xx += n) { const v = Math.random()*170|0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(xx, yy, n, n); } }
    else if (t < .62) { const k = (t - .4)/.22, h = Math.max(3, H*k*k); x.fillStyle = '#fff'; x.globalAlpha = 1 - k*.75; x.fillRect(0, H/2 - h/2, W, h); x.globalAlpha = 1; }
    else if (t < 2.2) {
      const k = ss(clamp((t - .62)/.45))*(1 - ss(clamp((t - 1.95)/.25)));
      const im = T.logo_idiotape.image, lw = 560, lh = lw*im.height/im.width;
      x.globalAlpha = k; x.drawImage(im, (W - lw)/2, H*.42 - lh/2, lw, lh);
      x.fillStyle = '#a3a1aa'; x.font = '500 22px "JetBrains Mono", monospace'; x.textAlign = 'center';
      if ('letterSpacing' in x) x.letterSpacing = '10px'; x.fillText('GAME SYSTEM', W/2 + 5, H*.42 + lh/2 + 52); if ('letterSpacing' in x) x.letterSpacing = '0px';
      const bw = 30, gap = 6, tot = STEP_C.length*(bw + gap) - gap, lk = clamp((t - .8)/1.0);
      STEP_C.forEach((c, i) => { x.fillStyle = i/STEP_C.length < lk ? c : '#1c1c20'; x.fillRect(W/2 - tot/2 + i*(bw + gap), H*.42 + lh/2 + 92, bw, 6); });
      x.globalAlpha = 1;
    } else {
      const k = ss(clamp((t - 2.2)/.5));
      const gr = x.createRadialGradient(W/2, H*.44, 20, W/2, H*.44, W*.62); gr.addColorStop(0, g.color + '2a'); gr.addColorStop(.55, g.color + '0c'); gr.addColorStop(1, '#000');
      x.globalAlpha = k; x.fillStyle = '#050506'; x.fillRect(0, 0, W, H); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      const im = T['logo_' + g.id].image, lw = Math.min(900, W*.74), lh = lw*im.height/im.width;
      const yy = H*.43 - lh/2 + (1 - k)*16;
      x.drawImage(im, (W - lw)/2, yy, lw, lh);
      x.fillStyle = '#a3a1aa'; x.font = '700 22px Silkscreen, monospace'; x.textAlign = 'center'; x.fillText(g.track.toUpperCase(), W/2, yy + lh + 48);
      if (t > 3.1 && Math.floor(t*2.2) % 2 === 0) { x.fillStyle = '#f2efe9'; x.font = '26px "Press Start 2P", monospace'; x.fillText('PRESS START', W/2, H*.86); }
      x.globalAlpha = 1;
    }
    x.fillStyle = 'rgba(0,0,0,.22)'; for (let yy = 0; yy < H; yy += 4) x.fillRect(0, yy, W, 1);
  }
  bootTex.needsUpdate = true;
}

/* ---------- 선택 → 열기 → 칩 → 게임기 ---------- */
export const chipHit = () => S.sel >= 0 ? games.pkgs[S.sel].chip.userData.hit : [];
export function slotWorld(lift){
  const g = games.consoleG, u = g.userData, P = games.pkgs[S.sel], ch = P.chip.userData.CH*P.chip.scale.x/g.scale.x;
  return g.localToWorld(new V3(0, u.topY + ch/2 + lift, u.slotZ));
}
const alignedQ = () => games.consoleG.getWorldQuaternion(new Q()).multiply(new Q().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
const setStep = n => { S.stepNow = n; S.stepFill = 0; };

export async function selectGame(i){
  if (!games.ready || S.mode !== 'scroll' || S.busy || S.p < .59) return;
  S.busy = true; S.mode = 'seq'; S.sel = i; ac(); lockScroll(true); vid.pause();
  const { pkgs, consoleG, conScreen, slotGlow } = games, P = pkgs[i], g = GAMES[i], st = L.stage;
  P.dragYaw = 0;
  document.documentElement.style.setProperty('--color-game', g.color);
  setStep(6); showBack(false); showOv(ov('ov-play'), 1);
  cam.sPos.copy(cam.pos); cam.sLook.copy(cam.look);
  const others = pkgs.filter(o => o !== P).map(o => ({ o, f:snapT(o.root), dir:Math.sign(o.i - i) }));
  const f0 = snapT(P.root), ry0 = P.root.rotation.y;
  const tgtS = L.pkgS*1.08, tgtP = new V3(0, L.portrait ? st.h*.06 : .05, .25);
  SFX.whoosh();
  await tween(.9, e => {
    others.forEach(({ o, f, dir }) => { o.root.position.x = f.pos.x + dir*e*st.w; o.look(0, .4, 1 - e); });
    P.root.position.lerpVectors(f0.pos, tgtP, e); P.root.rotation.set(lerp(P.root.rotation.x, 0, e), lerp(ry0, Math.round(ry0/(Math.PI*2))*Math.PI*2, e), 0);
    P.root.scale.setScalar(lerp(f0.s, tgtS, e)); P.look(1, 1, 1);
    cam.pos.lerpVectors(cam.sPos, CAM_STAGE, e); cam.look.lerpVectors(cam.sLook, LOOK_STAGE, e);
  }, eio);
  others.forEach(({ o }) => o.root.visible = false);
  S.stepFill = .35;
  SFX.open(); P.chip.visible = true;
  await tween(.95, e => { P.lidPivot.rotation.y = -2.62*e; S.stepFill = .35 + e*.3; }, eob);
  // 칩이 앞으로 나온다
  stage.attach(P.chip);
  const c0 = snapT(P.chip), chipS = L.chipH/P.chip.userData.CH;
  const ready = new V3(L.portrait ? .25 : st.w*.12, L.portrait ? st.h*.14 : st.h*.17, .55);
  const qR = new Q().setFromEuler(new THREE.Euler(-.08, -.25, .05));
  const pk0 = snapT(P.root), pkT = new V3(L.portrait ? -st.w*.28 : -st.w*.3, L.portrait ? st.h*.28 : st.h*.14, -.6);
  SFX.whoosh();
  await tween(1.05, e => {
    P.chip.position.lerpVectors(c0.pos, ready, e); P.chip.position.z += Math.sin(e*Math.PI)*.9;
    P.chip.quaternion.slerpQuaternions(c0.q, qR, e); P.chip.scale.setScalar(lerp(c0.s, chipS, e));
    P.root.position.lerpVectors(pk0.pos, pkT, ss(e)); P.root.scale.setScalar(lerp(pk0.s, L.pkgS*(L.portrait ? .45 : .58), ss(e))); P.root.rotation.y = lerp(P.root.rotation.y, .5, ss(e)*.2);
    S.stepFill = .65 + e*.35;
  }, eio);
  // 게임기가 올라온다
  consoleG.visible = true; consoleG.scale.setScalar(L.conW); conScreen.material.uniforms.uBright.value = 0;
  const chipWc = P.chip.userData.CW*chipS/L.conW;
  consoleG.userData.slot.scale.set(chipWc*1.1/.2, 1, 1); slotGlow.scale.set(chipWc*1.4/.26, 1, 1);
  setStep(7);
  await tween(.95, e => { consoleG.position.set(0, lerp(-st.h*1.1, L.conY, e), 0); consoleG.rotation.set(lerp(.9, .42, e), 0, 0); }, eob);
  P.chip.userData.readyPos = P.chip.position.clone(); P.chip.userData.readyQ = P.chip.quaternion.clone();
  S.mode = 'insert'; S.busy = false; showBack(true);
}

/* 칩 끌기: 슬롯 가까이 오면 끌려 들어간다. 그냥 누르면 자동으로 넣는다 */
export function startChipDrag(e){
  const P = games.pkgs[S.sel]; S.drag = { type:'chip', moved:0, x0:e.clientX, y0:e.clientY };
  chipDrag = { plane:new THREE.Plane(new V3(0, 0, 1), -P.chip.getWorldPosition(new V3()).z), off:null };
  moveChip(e, true); canvas.style.cursor = 'grabbing';
}
export function moveChip(e, first){
  if (!chipDrag) return; const chip = games.pkgs[S.sel].chip, d = S.drag;
  d.moved += first ? 0 : 1; if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.dragged = true;
  const hit = new V3(); if (!rayAt(e).ray.intersectPlane(chipDrag.plane, hit)) return;
  const local = stage.worldToLocal(hit.clone());
  if (first) { chipDrag.off = chip.position.clone().sub(local); return; }
  const want = local.add(chipDrag.off), hov = stage.worldToLocal(slotWorld(.06));
  const m = clamp(1 - want.distanceTo(hov)/(L.chipH*1.15));
  chip.position.lerpVectors(want, hov, m*m*.92);
  chip.quaternion.slerpQuaternions(chip.userData.readyQ, stage.quaternion.clone().invert().multiply(alignedQ()), ss(m));
  slotPulse = .4 + m*.6; chipDrag.m = m;
}
export function endChipDrag(d){
  const m = chipDrag ? chipDrag.m || 0 : 0; chipDrag = null;
  if (!d.dragged) { autoInsert(); return; }
  if (m > .35) { insertChip(); return; }
  const c = games.pkgs[S.sel].chip, f = snapT(c); S.busy = true;
  tween(.5, e => { c.position.lerpVectors(f.pos, c.userData.readyPos, e); c.quaternion.slerpQuaternions(f.q, c.userData.readyQ, e); }, eob).then(() => S.busy = false);
}
export async function autoInsert(){
  if (S.mode !== 'insert' || S.busy) return; S.busy = true; showBack(false);
  const c = games.pkgs[S.sel].chip, f = snapT(c);
  const hov = stage.worldToLocal(slotWorld(.06)), qa = stage.quaternion.clone().invert().multiply(alignedQ());
  await tween(.55, e => { c.position.lerpVectors(f.pos, hov, e); c.position.y += Math.sin(e*Math.PI)*.25; }, eio);
  const q1 = c.quaternion.clone();
  await tween(.45, e => c.quaternion.slerpQuaternions(q1, qa, e), eio);
  S.busy = false; insertChip();
}
async function insertChip(){
  if (S.mode !== 'insert') return; S.busy = true; S.mode = 'seq'; showBack(false);
  const { pkgs, consoleG } = games, P = pkgs[S.sel], c = P.chip, st = L.stage;
  const f = snapT(c), qa = stage.quaternion.clone().invert().multiply(alignedQ());
  const hov = stage.worldToLocal(slotWorld(.06)), into = stage.worldToLocal(slotWorld(-P.chip.userData.CH*c.scale.x/consoleG.scale.x*.62));
  await tween(.22, e => { c.position.lerpVectors(f.pos, hov, e); c.quaternion.slerpQuaternions(f.q, qa, e); }, eo);
  await tween(.32, e => c.position.lerpVectors(hov, into, e), t => t*t);
  consoleG.attach(c);
  SFX.click(); flashText('CLICK', slotWorld(.1)); S.stepFill = .5;
  await tween(.12, e => consoleG.position.y = L.conY - Math.sin(e*Math.PI)*.04);
  await wait(.18); SFX.lock(); flashText('LOCK', slotWorld(.1)); S.stepFill = 1;
  await wait(.35);
  // 전원 → 부팅
  setStep(8); SFX.power(); flashText('POWER ON', slotWorld(.1));
  const p0 = snapT(consoleG), r0 = consoleG.rotation.x, pk = snapT(P.root);
  const conW2 = Math.min(st.w*(L.portrait ? .98 : .74), st.h*1.35, 4.4);
  tween(1.1, e => { P.root.position.x = lerp(pk.pos.x, pk.pos.x - st.w*.6, e); P.look(1, 1, 1 - e); }, eio).then(() => P.root.visible = false);
  await tween(1.1, e => { consoleG.rotation.x = lerp(r0, 0, e); consoleG.position.y = lerp(p0.pos.y, L.portrait ? -st.h*.02 : -st.h*.01, e); consoleG.scale.setScalar(lerp(p0.s, conW2, e)); }, eio);
  bootT = 0; S.mode = 'boot';
}

/* 칩을 빼서 패키지에 다시 넣고 표지 선반으로 */
export async function backToCollection(){
  if (S.busy || (S.mode !== 'insert' && S.mode !== 'ready')) return; S.busy = true;
  const wasIn = S.mode === 'ready'; S.mode = 'seq'; showBack(false);
  const { pkgs, consoleG, conScreen } = games, P = pkgs[S.sel], c = P.chip, st = L.stage;
  setStep(7);
  if (wasIn) {
    bootT = -1; drawBoot(-1); conScreen.material.uniforms.uBright.value = 0;
    SFX.eject(); flashText('EJECT', slotWorld(.1));
    const lp = c.position.clone(), up = lp.clone(); up.y += P.chip.userData.CH*c.scale.x*.95;
    await tween(.4, e => c.position.lerpVectors(lp, up, e), eob);
    stage.attach(c);
  }
  // 패키지가 가운데로 돌아와 열린다
  P.root.visible = true;
  const pk = snapT(P.root), pkT = new V3(0, L.portrait ? st.h*.06 : .05, .25), c0 = snapT(c), trayPos = new V3(0, .004, .022);
  SFX.whoosh();
  await tween(1.0, e => {
    P.root.position.lerpVectors(pk.pos, pkT, e); P.root.scale.setScalar(lerp(pk.s, L.pkgS*1.08, e)); P.root.rotation.set(0, lerp(P.root.rotation.y, 0, e), 0);
    P.look(1, 1, Math.max(e, P.mats[0].uniforms.uOpacity.value));
    consoleG.position.y = lerp(consoleG.position.y, -st.h*1.2, e*e);
    const to = stage.worldToLocal(P.base.localToWorld(trayPos.clone()));
    c.position.lerpVectors(c0.pos, to, e); c.position.z += Math.sin(e*Math.PI)*.8;
    c.quaternion.slerpQuaternions(c0.q, stage.quaternion.clone().invert().multiply(P.base.getWorldQuaternion(new Q())), e); c.scale.setScalar(lerp(c0.s, P.root.scale.x, e));
  }, eio);
  P.base.attach(c); c.position.copy(trayPos); c.quaternion.identity(); c.scale.setScalar(1);
  consoleG.visible = false; consoleG.rotation.set(0, 0, 0);
  SFX.open();
  await tween(.7, e => P.lidPivot.rotation.y = -2.62*(1 - e), eio);
  c.visible = false; SFX.click();
  // 지금 스크롤 위치의 컬렉션 자세로
  const f = focusOf(S.p);
  pkgs.forEach(o => o.root.visible = true);
  const from = pkgs.map(o => snapT(o.root));
  await tween(.85, e => {
    pkgs.forEach((o, j) => { const cp = collectionPose(j, S.p, f);
      o.root.position.lerpVectors(from[j].pos, new V3(cp.x, cp.y, cp.z), e); o.root.scale.setScalar(lerp(from[j].s, cp.s, e));
      o.root.rotation.set(lerp(o.root.rotation.x, cp.rx, e), lerp(o.root.rotation.y, cp.ry, e), 0);
      o.look(o === P ? 1 : lerp(0, cp.sat, e), lerp(o === P ? 1 : .4, cp.bright, e), o === P ? 1 : lerp(0, cp.op, e)); });
  }, eio);
  showOv(ov('ov-play'), 0); lockScroll(false);
  S.sel = -1; S.mode = 'scroll'; S.busy = false;
}

/* 표지를 끌어 돌린 뒤 놓으면 앞/뒤로 맞춘다 */
export function snapYaw(P){ const tgt = Math.round((P.dragYaw + P.dragVel*6)/Math.PI)*Math.PI, from = P.dragYaw; tween(.6, e => P.dragYaw = lerp(from, tgt, e), eo); }
