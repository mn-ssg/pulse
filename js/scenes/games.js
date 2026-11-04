/* 05–09 GAME COVER → 패키지 열기 → 칩 → 게임기 → 부팅 */
import { THREE, V3, Q } from '../core/three.js';
import { scene, stage, canvas, rimL, plane, slab, extrude, rrShape, chipShape, imgMat, litMat, canvasTex, glowTex, glowMesh, vis, rayAt, toScreen, LITE } from '../core/stage.js';
import { VS, GLASS_FS } from '../core/shaders.js';
import { T } from '../core/assets.js';
import { GAMES, META, STEP_C, STAGE_Z, CAM_D, PW, PH, PD } from '../core/config.js';
import { S, L, mouse, cam } from '../core/state.js';
import { clamp, seg, lerp, ss, eio, eo, eob, eos, tween, wait, snapT } from '../core/utils.js';
import { ac, SFX } from '../core/audio.js';
import { ov, showOv, showBack, flashText, lockScroll } from '../ui/overlay.js';
import { vid } from './vhs.js';

export const games = { ready:false, pkgs:[], bgPlanes:[], consoleG:null, conScreen:null, slotGlow:null, chipShadow:null, conShadow:null, backGlow:null };
/* 삽입 단계의 게임기 기울기: 정면 사진이 덜 찌그러지는 범위에서 윗면 · 오른쪽 옆면이 함께 보이게 */
const TILT_X = .24, TILT_Y = -.1;
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
  body.castShadow = !LITE;
  const front = plane(CW, CH, litMat(T[g.id + '_chip'], { glow:.62, rough:.55 })); front.position.z = D/2 + .001; grp.add(front);
  const back = plane(CW, CH, litMat(chipBackTex(g), { glow:.62, rough:.55 })); back.rotation.y = Math.PI; back.position.z = -D/2 - .001; grp.add(back);
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
/* 게임기 외곽선: 정면 사진의 알파에서 열마다 위 · 아래 끝점을 뽑아 단순화한 THREE.Shape (처음 한 번만) */
function simplify(p, eps){
  if (p.length < 3) return p;
  const [ax, ay] = p[0], [bx, by] = p[p.length - 1], dx = bx - ax, dy = by - ay, n = Math.hypot(dx, dy) || 1;
  let best = 0, bi = 0;
  for (let i = 1; i < p.length - 1; i++) { const d = Math.abs(dx*(ay - p[i][1]) - dy*(ax - p[i][0]))/n; if (d > best) { best = d; bi = i; } }
  return best > eps ? [...simplify(p.slice(0, bi + 1), eps).slice(0, -1), ...simplify(p.slice(bi), eps)] : [p[0], p[p.length - 1]];
}
function consoleOutline(CW, CH){
  const im = T.console.image, w = 512, h = Math.round(w*CH/CW);
  let a = null;
  try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(im, 0, 0, w, h); a = x.getImageData(0, 0, w, h).data; }
  catch (e) { console.warn('[PULSE] console outline: alpha unreadable, using rounded rect', e); }
  const top = [], bot = [];
  if (a) for (let i = 0; i < w; i++) {
    let t = -1, b = -1;
    for (let j = 0; j < h; j++) if (a[(j*w + i)*4 + 3] > 128) { if (t < 0) t = j; b = j + 1; }
    if (t >= 0) { top.push([i + .5, t]); bot.push([i + .5, b]); }
  }
  if (top.length < w*.5) return rrShape(CW, CH, CH*.3);
  const pts = [...simplify(top, .35), ...simplify(bot, .35).reverse()];
  return new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2((px/w - .5)*CW, (.5 - py/h)*CH)));
}
/* 몸체 재질: 무광 짙은 회색. 앞 모서리를 따라 청록 띠(사진의 테두리가 옆면으로 이어진다), 화면 자리 · 슬롯 입구는 셰이더에서 뚫는다 */
function bodyMat(U){
  const m = new THREE.MeshStandardMaterial({ color:0x26282b, roughness:.6, metalness:.1 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vLp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLp = position;');
    sh.fragmentShader = 'varying vec3 vLp; uniform vec3 uRim; uniform vec2 uRimZ; uniform vec4 uSlot, uScr; uniform float uCapZ;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vLp.z > uCapZ && abs(vLp.x - uScr.x) < uScr.z && abs(vLp.y - uScr.y) < uScr.w) discard;
        if (vLp.y > uSlot.w && abs(vLp.x) < uSlot.x && vLp.z > uSlot.y && vLp.z < uSlot.z) discard;
        float rim = smoothstep(uRimZ.x, uRimZ.y, vLp.z)*(1. - smoothstep(uRimZ.y, uRimZ.y*.3, vLp.z));   // 앞 모서리 bevel에만 (캡은 사진 뒤)
        diffuseColor.rgb = mix(diffuseColor.rgb, uRim, rim);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uRim*rim*.35;`);
  };
  m.customProgramCacheKey = () => 'pulse-console-body';
  return m;
}
function buildConsole(){
  const g = games.consoleG = new THREE.Group(); g.visible = false; stage.add(g);
  const CW = 1, CH = META.console[1]/META.console[0], D = CW*.10, bt = .014, bs = .011;   // 너비 1 · 두께 10% · 모서리 둥글기
  const [u0, v0, u1, v1] = META.console_screen;
  const sw = (u1 - u0)*CW, sh = (v1 - v0)*CH, sx = ((u0 + u1)/2 - .5)*CW, sy = (.5 - (v0 + v1)/2)*CH;
  const topY = CH/2 + bs, slotZ = -D/2;
  // 몸체: 외곽선 그대로 extrude. 앞면 캡 z = 0, 뒤로 D
  const U = { uRim:{ value:new THREE.Color(0x05a1a8) }, uRimZ:{ value:new THREE.Vector2(-.005, -.0015) }, uCapZ:{ value:-bt - .001 },
    uScr:{ value:new THREE.Vector4(sx, sy, sw/2, sh/2) }, uSlot:{ value:new THREE.Vector4(0, 0, 0, topY) } };
  const shape = consoleOutline(CW, CH);
  const geo = new THREE.ExtrudeGeometry(shape, { depth:D - 2*bt, bevelEnabled:true, bevelThickness:bt, bevelSize:bs, bevelSegments:4 });
  geo.translate(0, 0, -(D - bt));
  const body = new THREE.Mesh(geo, bodyMat(U)); body.castShadow = body.receiveShadow = !LITE; g.add(body);
  // 앞면: 같은 외곽선에 사진을 UV로 맞춰 붙인다 (조명을 받는 재질, 화면 자리는 구멍)
  const fg = new THREE.ShapeGeometry(shape), uv = fg.attributes.uv, pos = fg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i)/CW + .5, pos.getY(i)/CH + .5);
  const face = new THREE.Mesh(fg, litMat(T.console, { glow:.6, rough:.55, metal:.1, hole:[u0, 1 - v1, u1, 1 - v0] })); face.position.z = .001; face.receiveShadow = !LITE; g.add(face);
  // 화면: 살짝 들어간 자리에 부팅 화면 + 유리 (안쪽 벽은 어둡게)
  const dark = new THREE.MeshStandardMaterial({ color:0x07070a, roughness:.9, side:THREE.BackSide });
  const rec = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, .014), dark); rec.position.set(sx, sy, 0); g.add(rec);   // 안쪽 벽 · 바닥(z -.007)
  bootTex = canvasTex(1248, 712, () => {}); bootCtx = bootTex.image.getContext('2d');
  const scr = games.conScreen = plane(sw, sh, imgMat(bootTex, { radius:.006, aspect:sw/sh, bright:0 }));
  scr.position.set(sx, sy, -.0046); g.add(scr);
  const glass = plane(sw, sh, new THREE.ShaderMaterial({ vertexShader:VS, fragmentShader:GLASS_FS, transparent:true, depthWrite:false, uniforms:{ uOpacity:{ value:1 } } }));
  glass.position.set(sx, sy, -.004); glass.renderOrder = 1; g.add(glass);
  // 슬롯: 윗면 가운데에 실제로 파인 홈 (셰이더로 입구를 뚫고, 안쪽은 어두운 상자). 크기는 칩에 맞춰 fitSlot()
  const hide = new THREE.MeshBasicMaterial({ visible:false });
  const cav = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [dark, dark, hide, dark, dark, dark]); g.add(cav);
  const lipMat = new THREE.MeshBasicMaterial({ color:0xa9dfe3, transparent:true, opacity:.55, depthWrite:false });
  const lips = [0, 1].map(() => { const m = plane(1, 1, lipMat); m.rotation.x = -Math.PI/2; g.add(m); return m; });
  const glowM = new THREE.MeshBasicMaterial({ map:glowTex, color:0x5ff3ff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
  const sg = games.slotGlow = plane(1, 1, glowM); sg.rotation.x = -Math.PI/2; g.add(sg);                 // 홈 안쪽에서 새어 나오는 빛
  const sg2 = plane(1, 1, glowM); sg2.rotation.x = -Math.PI/2; g.add(sg2);                              // 입구 위로 번지는 빛
  // 칩 그림자: 칩이 슬롯 위로 올수록 윗면에 진해진다
  const cs = games.chipShadow = plane(1, 1, new THREE.MeshBasicMaterial({ map:glowTex, color:0x000000, transparent:true, opacity:0, depthWrite:false }));
  cs.rotation.x = -Math.PI/2; cs.visible = false; g.add(cs);
  // 바닥 그림자 (무대에 두고 게임기를 따라간다)
  const fs = games.conShadow = plane(1, 1, new THREE.MeshBasicMaterial({ map:glowTex, color:0x000000, transparent:true, opacity:0, depthWrite:false }));
  fs.visible = false; stage.add(fs);                                                                     // 아랫변 바로 뒤, 카메라를 향한 타원 (위쪽 반은 몸체에 가려진다)
  const bg = games.backGlow = glowMesh(0xffffff, 1); bg.position.z = -3; bg.visible = false; stage.add(bg);
  g.userData = { CW, CH, D, topY, slotZ, face, U, cav, lips, sg2, slotDepth:0 };
}
/* 홈 · 입구 · 빛을 칩 크기(게임기 기준)에 맞춘다 */
function fitSlot(cw, ch, cd){
  const g = games.consoleG, u = g.userData, w = cw*1.08, d = cd*1.6, depth = Math.min(ch*.75 + .02, u.CH*.44);
  u.slotDepth = depth; u.U.uSlot.value.set(w/2, u.slotZ - d/2, u.slotZ + d/2, u.topY - .004);
  u.cav.scale.set(w, depth, d); u.cav.position.set(0, u.topY - depth/2, u.slotZ);
  u.lips.forEach((m, i) => { m.scale.set(w*1.03, .0022, 1); m.position.set(0, u.topY + .0006, u.slotZ + (i ? 1 : -1)*(d/2 + .0014)); });
  games.slotGlow.scale.set(w*1.1, d*2.4, 1); games.slotGlow.position.set(0, u.topY - depth*.3, u.slotZ);
  u.sg2.scale.set(w*1.5, d*3.5, 1); u.sg2.position.set(0, u.topY + .001, u.slotZ);
  games.chipShadow.scale.set(cw*1.25, Math.max(u.D*.95, cd*3), 1);
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
  updateConsoleShadows();
  if (S.mode === 'boot') {
    bootT += dt; games.conScreen.material.uniforms.uBright.value = Math.min(1, bootT*4); drawBoot(bootT);
    if (bootT > .65 && bootT - dt <= .65) SFX.chime();
    if (bootT > 3.3) { S.mode = 'ready'; S.busy = false; setStep(8); showBack(true); }
  } else if (S.mode === 'ready') { bootT += dt; drawBoot(bootT); }
}

/* 칩 그림자(윗면) · 바닥 그림자 · 게임기 뒤 밝은 배경: 게임기 위치를 따라 매 프레임 */
const tmpV = new V3();
function updateConsoleShadows(){
  const { consoleG:g, chipShadow:cs, conShadow:fs, backGlow:bg } = games, u = g.userData, st = L.stage;
  fs.visible = bg.visible = g.visible;
  cs.visible = false;
  if (!g.visible) return;
  const s = g.scale.x, rx = g.rotation.x, rise = clamp((g.position.y + st.h*.8)/(L.conY + st.h*.8));
  fs.scale.set(u.CW*s*.9, u.CW*s*.26, 1);
  fs.position.set(g.position.x, g.position.y - u.CH/2*s*Math.cos(rx) - u.CW*s*.02, g.position.z - u.CH/2*s*Math.sin(rx) - u.D*s - .03);
  fs.material.opacity = .5*rise;
  bg.position.set(g.position.x, g.position.y + u.CH*s*.1, -3); bg.scale.setScalar(u.CW*s*2.4); bg.material.opacity = .14*rise;
  if (S.sel < 0) return;
  const c = games.pkgs[S.sel].chip; if (c.parent !== stage) return;
  const lp = g.worldToLocal(c.getWorldPosition(tmpV)), k = c.scale.x/s, cw = c.userData.CW*k, ch = c.userData.CH*k;
  const hb = lp.y - ch/2 - u.topY;                                    // 칩 아랫변과 윗면 사이 높이
  if (Math.abs(lp.x) > u.CW*.44 || hb < -ch*.2) return;
  const near = clamp(1 - hb/(ch*1.1));
  if (near <= 0) return;
  cs.visible = true; cs.material.opacity = .45*near*near;
  cs.position.set(lp.x, u.topY + .0015, clamp(lp.z, -u.D*.9, -.012));
  cs.scale.set(cw*(1.1 + (1 - near)*.5), Math.max(u.D*.9, cw*.35)*(1 + (1 - near)*.6), 1);
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
  return g.localToWorld(new V3(0, u.topY + ch/2 + lift, u.slotZ));          // 칩 가운데: 아랫변이 홈 입구에서 lift만큼
}
const alignedQ = () => games.consoleG.getWorldQuaternion(new Q()).multiply(new Q().setFromEuler(new THREE.Euler(Math.PI, 0, 0)));
const setStep = n => { S.stepNow = n; S.stepFill = 0; };

export async function selectGame(i){
  if (!games.ready || S.mode !== 'scroll' || S.busy || S.p < .59) return;
  S.busy = true; S.mode = 'seq'; S.sel = i; ac(); lockScroll(true); vid.pause();
  const { pkgs, consoleG, conScreen } = games, P = pkgs[i], g = GAMES[i], st = L.stage;
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
  // 열린 패키지는 왼쪽 위 뒤로 물러나 흐려진다 (화면 안에 다 들어오게, 시선은 게임기와 칩으로)
  const pk0 = snapT(P.root), pkT = new V3(L.portrait ? -st.w*.17 : -st.w*.3, L.portrait ? st.h*.3 : st.h*.3, -1.4), pkS = L.pkgS*(L.portrait ? .45 : .58)*.85;
  SFX.whoosh();
  await tween(1.05, e => {
    P.chip.position.lerpVectors(c0.pos, ready, e); P.chip.position.z += Math.sin(e*Math.PI)*.9;
    P.chip.quaternion.slerpQuaternions(c0.q, qR, e); P.chip.scale.setScalar(lerp(c0.s, chipS, e));
    P.root.position.lerpVectors(pk0.pos, pkT, ss(e)); P.root.scale.setScalar(lerp(pk0.s, pkS, ss(e))); P.root.rotation.y = lerp(P.root.rotation.y, .5, ss(e)*.2);
    P.look(1, 1, 1 - .78*ss(clamp(e*1.05/.4)));
    S.stepFill = .65 + e*.35;
  }, eio);
  // 게임기가 올라온다
  consoleG.visible = true; consoleG.scale.setScalar(L.conW); conScreen.material.uniforms.uBright.value = 0;
  const k = chipS/L.conW; fitSlot(P.chip.userData.CW*k, P.chip.userData.CH*k, P.chip.userData.D*k);
  games.backGlow.material.color.set(g.glow).lerp(new THREE.Color(0xffffff), .55);
  setStep(7);
  await tween(.95, e => { consoleG.position.set(0, lerp(-st.h*1.1, L.conY, e), 0); consoleG.rotation.set(lerp(.6, TILT_X, e), TILT_Y*e, 0); }, eos);
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
  const hov = stage.worldToLocal(slotWorld(.05)), into = stage.worldToLocal(slotWorld(-P.chip.userData.CH*c.scale.x/consoleG.scale.x*.75));   // 꽂힌 뒤 25%만 보인다
  await tween(.22, e => { c.position.lerpVectors(f.pos, hov, e); c.quaternion.slerpQuaternions(f.q, qa, e); }, eo);
  await wait(.08);                                                      // 슬롯 바로 위에서 멈칫
  const mid = hov.clone().lerp(into, .7);
  await tween(.13, e => c.position.lerpVectors(hov, mid, e), t => t*t);  // 빠르게 70%
  await tween(.26, e => c.position.lerpVectors(mid, into, e), eo);      // 마지막 30%는 천천히
  consoleG.attach(c);
  SFX.click(); flashText('CLICK', slotWorld(.1)); S.stepFill = .5;
  await tween(.12, e => consoleG.position.y = L.conY - Math.sin(e*Math.PI)*.04);
  await wait(.18); SFX.lock(); flashText('LOCK', slotWorld(.1)); S.stepFill = 1;
  await wait(.35);
  // 전원 → 부팅
  setStep(8); SFX.power(); flashText('POWER ON', slotWorld(.1));
  const p0 = snapT(consoleG), r0 = consoleG.rotation.x, ry0 = consoleG.rotation.y, pk = snapT(P.root), op0 = P.mats[0].uniforms.uOpacity.value;
  const conW2 = Math.min(st.w*(L.portrait ? .98 : .74), st.h*1.35, 4.4);
  tween(1.1, e => { P.root.position.x = lerp(pk.pos.x, pk.pos.x - st.w*.6, e); P.look(1, 1, op0*(1 - e)); }, eio).then(() => P.root.visible = false);
  await tween(1.1, e => { consoleG.rotation.set(lerp(r0, 0, e), lerp(ry0, 0, e), 0); consoleG.position.y = lerp(p0.pos.y, L.portrait ? -st.h*.02 : -st.h*.01, e); consoleG.scale.setScalar(lerp(p0.s, conW2, e)); }, eio);
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

/* QA: 칩 · 슬롯 입구의 화면 좌표 (브라우저 콘솔 · 자동 테스트용) */
export function qaPoints(){
  if (S.sel < 0 || !games.consoleG.visible) return null;
  const c = games.pkgs[S.sel].chip;
  return { chip:toScreen(c.getWorldPosition(new V3())), slot:toScreen(slotWorld(.06)) };
}
