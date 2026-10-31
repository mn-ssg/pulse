/* 01 PULSE — Figma PULSE_logo 원본이 인트로의 중심. 형태는 그대로 두고 빛만 움직인다:
   어둠 → 심전도 신호가 로고의 펄스 라인으로 들어와 디스크까지 점등 → 다음 박동에 전체 점등 + 디스크에서 파동 → 박동마다 뛰고 빛이 훑는다
   스크롤: NAMING CONCEPT의 큰 PULSE가 되었다가 작아지며 빠진다 */
import { THREE } from '../core/three.js';
import { scene, renderer } from '../core/stage.js';
import { TRACE_VS, TRACE_FS } from '../core/shaders.js';
import { RED, LOGO } from '../core/config.js';
import { S, L, W, B } from '../core/state.js';
import { clamp, seg, lerp, ss, eio, RM } from '../core/utils.js';
import { SFX } from '../core/audio.js';

let trace, logo, rings = [], ringI = 0, lit = 0, full = false, lastBeat = 0;
const G = { w:0, h:0, cx:0, cy:0 };                                       // 인트로 위치의 로고 (px)

/* 인트로 심전도 선 (화면 전체에 그리는 판 하나) — 로고의 펄스 라인과 같은 높이 */
export function buildTrace(){
  trace = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader:TRACE_VS, fragmentShader:TRACE_FS,
    transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uRes:{value:new THREE.Vector2(1, 1)}, uDpr:{value:1}, uTime:{value:0}, uPhase:{value:0}, uBeat:{value:0}, uAlpha:{value:1},
      uAmp:{value:0}, uY:{value:0}, uFront:{value:-3}, uSingle:{value:0}, uDead:{value:1}, uLiveTo:{value:-3}, uCol:{value:new THREE.Color(RED)} } }));
  trace.frustumCulled = false; trace.renderOrder = 50; scene.add(trace);
}

export function initLogo(){
  logo = document.getElementById('logo');
  rings = [...logo.querySelectorAll('.logo-ring')];
}
export function resizeLogo(){
  G.w = Math.min(innerWidth*(L.portrait ? .86 : .56), 1180); G.h = G.w*256/1317;
  G.cx = innerWidth/2; G.cy = innerHeight*(L.portrait ? .42 : .38);
  logo.style.width = G.w + 'px';
  document.documentElement.style.setProperty('--logo-h', G.h + 'px');
}

/* ---------- 박동 ---------- */
export function wake(){ if (W.awake) return; W.awake = true; W.t = 0; }
export function updatePulse(dt){
  if (W.awake) { const t0 = W.t; W.t += dt; if (t0 < .55 && W.t >= .55) { SFX.heart(1); B.extra = .7; } }
  W.energy = W.awake ? ss(clamp((W.t - .9)/1.4)) : 0;
  B.extra *= Math.exp(-dt*4.5);
  if (!W.awake || W.t < 1.15) { B.env = B.extra; B.phase = .5; return; }   // .5 = 다음 박동이 화면 왼쪽 끝에서 들어온다
  B.phase += dt*B.bpm/60;
  const f = B.phase % 1, lub = Math.exp(-f*9), dub = f > .2 ? Math.exp(-(f - .2)*11)*.55 : 0;
  B.env = Math.min(1.3, Math.max(lub, dub)*W.energy + B.extra);
}
export const pulseFront = () => W.awake ? lerp(-1.6, 1.7, clamp(W.t/1.15)) : -3;

function ring(scale = 1){
  const r = rings[ringI++ % rings.length];
  r.animate([{ transform:'translate(-50%,-50%) scale(.25)', opacity:.9 }, { transform:`translate(-50%,-50%) scale(${4.2*scale})`, opacity:0 }],
    { duration:RM ? 1 : 1300, easing:'cubic-bezier(.2,.7,.3,1)' });
}

/* ---------- 매 프레임 ---------- */
export function updateLogo(){
  const P_ = S.p, sc = S.mode === 'scroll';
  const show = sc && P_ < .095;
  logo.style.visibility = show ? 'visible' : 'hidden';
  if (!show) return;
  // 점등: 첫 신호는 디스크(심장)까지 → 다음 박동에 전체
  const beat = Math.floor(B.phase);
  if (W.awake && W.t >= 1.15 && beat !== lastBeat) {                   // 박동 순간
    lastBeat = beat;
    if (!full) { full = true; logo.classList.add('lit'); B.extra = Math.max(B.extra, .9); ring(1.3); }
    else if (P_ < .03) ring(.8);
  }
  const frontPx = (pulseFront() + 1)/2*innerWidth, u = (frontPx - (G.cx - G.w/2))/G.w;
  const target = full ? 1.06 : W.awake ? clamp(u, 0, LOGO.disc[0]) : 0;
  lit += (target - lit)*(full ? .2 : .5);
  const env = B.env;
  // 인트로 → NAMING CONCEPT의 큰 PULSE → 작아지며 빠진다
  const toNaming = ss(seg(P_, .03, .055)), out = eio(seg(P_, .072, .092));
  const cy = lerp(G.cy, innerHeight*(L.portrait ? .36 : .34), toNaming);
  const tx = lerp(G.cx, innerWidth*(L.portrait ? .5 : .14) + G.w*.17, out), ty = lerp(cy, innerHeight*.12, out);
  const s = lerp(1, .86, toNaming)*lerp(1, .34, out)*(1 + env*.022*(1 - out));
  logo.style.transform = `translate(${tx - G.w/2}px, ${ty - G.h/2}px) scale(${s.toFixed(4)})`;
  logo.style.opacity = (1 - ss(seg(P_, .08, .092))).toFixed(3);
  logo.style.setProperty('--lit', lit.toFixed(4));
  logo.style.setProperty('--glow', (full ? .22 + env*.6 : 0).toFixed(3));        // 전체가 켜진 뒤에만 빛이 번진다
  G.lineY = ty;                                                          // 심전도 선을 로고의 펄스 라인에 맞춘다
}

export function updateTrace(){
  const u = trace.material.uniforms, H = innerHeight;
  const al = (S.mode === 'scroll' || S.mode === 'loading') ? 1 - ss(seg(S.p, .01, .04)) : 0;
  trace.visible = al > .001;
  if (!trace.visible) return;
  u.uRes.value.set(innerWidth, H); u.uDpr.value = renderer.getPixelRatio(); u.uTime.value = S.time; u.uPhase.value = B.phase; u.uBeat.value = B.env;
  u.uSingle.value = W.awake && W.t < 1.15 ? 1 : 0;
  u.uFront.value = pulseFront();
  u.uDead.value = W.awake ? 1 - ss(clamp((W.t - .9)/.5)) : 1;
  u.uLiveTo.value = u.uFront.value + .65;
  u.uAmp.value = W.awake ? H*.07 : 0;
  u.uY.value = H/2 - (G.lineY ?? G.cy);
  u.uAlpha.value = al;
}
