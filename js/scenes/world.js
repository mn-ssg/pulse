/* 02 카메라 이동 · VIDEO TAPE · 월드 · 전류선 · LED 먼지 */
import { THREE, V3, Q } from '../core/three.js';
import { scene, camera, plane, slab, litMat, cropUV, glowMesh, vis, LITE, renderer } from '../core/stage.js';
import { VS, CURRENT_VS, CURRENT_FS, CITY_FS } from '../core/shaders.js';
import { T } from '../core/assets.js';
import { META, STAGE_Z, CAM_D, TAPE_W } from '../core/config.js';
import { S, L, W, B, V, mouse, cam } from '../core/state.js';
import { clamp, seg, lerp, ss, eio, bump, RM } from '../core/utils.js';
import { tapeFrames, insertEase, vhsCamera } from './vhs.js';

export const world = { tape:null, tapeParts:null, reels:[], cityPlane:null, currentLine:null, leds:null };

/* 고가도로 가운데 선 (city-still 픽셀 좌표, 화면 아래로 들어오는 곳 → 왼쪽 뒤로 휘어 들어가는 끝) */
const CITY_ROAD = [[905,898],[890,780],[872,690],[850,610],[820,545],[780,490],[725,440],[660,395],[590,360],[520,330],[460,316],[410,318]];

/* ---------- build ---------- */
export function buildTape(){
  const TH = TAPE_W*META.tape_front[1]/META.tape_front[0];
  const tape = world.tape = new THREE.Group(); scene.add(tape);
  const bodyMat = new THREE.MeshStandardMaterial({ color:0x1a1a1c, roughness:.6, metalness:.1, transparent:true });
  const body = slab(TAPE_W*.972, TH*.955, .17, .07, bodyMat); tape.add(body);
  // 앞 · 뒤 그림도 플레이어와 같은 빛을 받는다 (같은 공간의 물체)
  const front = plane(TAPE_W, TH, litMat(T.tape_front, { sat:0 })); front.position.z = .0865; tape.add(front);
  const back = plane(TAPE_W, TAPE_W*META.tape_back[1]/META.tape_back[0], litMat(T.tape_back, { sat:0 })); back.rotation.y = Math.PI; back.position.z = -.0865; tape.add(back);
  // 릴은 같은 그림에서 잘라 돌린다 (원본 그림 좌표)
  const Wd = META.tape_front[0], H = META.tape_front[1], R = 112;
  [[525, 561], [1271, 562]].forEach(([cx, cy]) => {
    const ru = R/Wd, rv = R/H, u = cx/Wd, v = 1 - cy/H;
    const m = new THREE.Mesh(cropUV(new THREE.CircleGeometry(R/Wd*TAPE_W, 48), [u - ru, v - rv, 2*ru, 2*rv]), litMat(T.tape_front, { sat:0 }));
    m.position.set((u - .5)*TAPE_W, (v - .5)*TH, .0885); tape.add(m); world.reels.push(m);
  });
  const halo = glowMesh(0x5ff3ff, 1); halo.scale.set(TAPE_W*1.9, TH*2.2, 1); halo.position.z = -.12; tape.add(halo);   // 펄스가 닿는 순간의 빛
  for (const m of [body, front, back, ...world.reels]) m.castShadow = true;
  world.tapeParts = { body, bodyMat, front, back, halo, TH, mats:[bodyMat, front.material, back.material, ...world.reels.map(r => r.material)], hit:[front, back, body] };
}

export function buildWorld(){
  const worldG = new THREE.Group(); scene.add(worldG);
  // 배경 도시: 꺼진 그림과 같은 구도의 불 켜진 그림을 겹쳐, 전류가 들어온 고가도로부터 불이 번진다 ("폐허는 회색, 작동하는 것만 색")
  const [iw, ih] = META.world_city, road = [];
  let acc = 0;
  CITY_ROAD.forEach(([x, y], i) => { if (i) acc += Math.hypot(x - CITY_ROAD[i - 1][0], y - CITY_ROAD[i - 1][1]); road.push(new V3(x/ih, 1 - y/ih, acc)); });
  road.forEach(r => r.z /= acc);
  const city = world.cityPlane = plane(1, 1, new THREE.ShaderMaterial({ vertexShader:VS, fragmentShader:CITY_FS, transparent:true, depthWrite:false,
    uniforms:{ map:{value:T.world_city}, mapLit:{value:T.world_city_lit}, uRoad:{value:road}, uOpacity:{value:0}, uBright:{value:.4}, uSat:{value:0},
      uLitBright:{value:1}, uLitSat:{value:1}, uSpread:{value:-1}, uBand:{value:0}, uTime:{value:0}, uFlash:{value:0}, uPulse:{value:0},
      uSeed:{value:new THREE.Vector2(.4, .2)}, uSeedRoad:{value:new THREE.Vector2(0, .3)},
      uShade:{value:new THREE.Vector4(0, 0, 1, 1)}, uShadeAmt:{value:0} } }));
  city.userData.road = road;
  city.position.set(0, 1.5, -40); worldG.add(city);
  // 바닥을 따라 무대까지 가는 전류선
  const pts = []; for (let k = 0; k <= 40; k++) { const z = lerp(4, STAGE_Z + .05, k/40), u = k/40; pts.push(new V3(lerp(-1.4, 0, ss(u)) + Math.sin(k*1.7)*.12*(1 - u), lerp(-.82, -.6, ss(u)) + Math.sin(k*.9)*.04*(1 - u), z)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const line = world.currentLine = new THREE.Mesh(new THREE.TubeGeometry(curve, LITE ? 700 : 1400, .016, 6, false), new THREE.ShaderMaterial({
    vertexShader:CURRENT_VS, fragmentShader:CURRENT_FS, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uReveal:{value:0}, uTime:{value:0}, uOpacity:{value:0}, uPhase:{value:0}, uBeat:{value:0} } }));
  line.userData.curve = curve; worldG.add(line);
  // LED 먼지 (게임 로고 색): 첫 박동 전엔 회색 · 정지
  const N = LITE ? 44 : 72;
  const leds = world.leds = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, .05, .01), new THREE.MeshBasicMaterial({ transparent:true, opacity:.9, depthWrite:false }), N);
  const pal = [0xe5322d, 0xffc21a, 0x5ff3ff, 0xff4fd8, 0x5ff3ff, 0xffc21a].map(c => new THREE.Color(c));
  leds.userData.items = Array.from({ length:N }, (_, i) => {
    let x = (Math.random()*2 - 1)*7.5, y = (Math.random()*2 - 1)*3.8;
    if (Math.abs(x) < 1.6 && Math.abs(y) < 1.2) x += Math.sign(x || 1)*2.2;
    return { p:new V3(x, y, 4 - Math.random()*26), c:pal[i % pal.length], s:.5 + Math.random()*1.4, ph:Math.random()*6.28 };
  });
  scene.add(leds);
}

export function resizeWorld(){ const v = vis(40 + 9); world.cityPlane.scale.set(v.h*1.25*1.78, v.h*1.25, 1); }

/* ---------- scroll ---------- */
const SPREAD0 = -.05;   // 번짐 시작 위치 (도로 곡선 위 s · 화면 아래 가장자리 기준으로 맞춘 값)
const cp = new V3(), fwd = new V3(), stg = new V3(), cl = new V3(), vp = new V3(), vl = new V3(), tpos = new V3(), tq = new Q(), qWob = new Q(), eul = new THREE.Euler();

/* 원본 카메라(정면 → 월드 속으로 → 무대) → 테이프 주위를 돌고, 플레이어 · 슬롯 · 모니터 안으로 (vhs.js) */
export function updateCamera(P_, dt){
  const tr = eio(seg(P_, .05, .30)), sw = Math.sin(tr*Math.PI);
  const cz = lerp(9, STAGE_Z + CAM_D, tr);
  cp.set(sw*.6 + mouse.x*.22*(1 - tr*.4), .1 - sw*.18 + mouse.y*.14, cz);
  fwd.set(sw*.25, -.08*sw, cz - 9); stg.set(0, 0, STAGE_Z);
  cl.lerpVectors(fwd, stg, ss(seg(P_, .2, .3)));
  if (P_ > .27) {                                                      // 같은 3D 공간 안에서 이어지는 카메라
    tapeFrames(); vhsCamera(P_, vp, vl);
    const w = ss(seg(P_, .27, .30)); cp.lerp(vp, w); cl.lerp(vl, w);
  }
  const kc = 1 - Math.exp(-dt*(P_ > .27 ? 8 : 14)); cam.pos.lerp(cp, kc); cam.look.lerp(cl, kc);
  return { tr, cz };
}

/* 테이프: 인트로에선 로고 아래 → 타이포그래피 동안 숨었다가 → 무대에서 펄스를 받아 켜지고 → 같은 크기 그대로 회전 · 정렬돼 슬롯 안으로 */
export function updateTape(P_, tr, dt){
  const { tape, tapeParts, reels } = world, env = B.env, mv = W.awake && !RM ? 1 : 0;
  const introOut = ss(seg(P_, .015, .035)), stageIn = ss(seg(P_, .27, .285));   // 타이포그래피가 끝난 뒤 무대에 나타난다
  const op = Math.max(1 - introOut, stageIn);
  tape.visible = op > .002 && P_ < .382;
  if (!tape.visible) { S.reelSpin += dt*(V.boot >= 0 ? 5 : .5); return; }
  if (P_ < .1) {                                                       // 인트로 (원본 경로)
    const a = ss(seg(P_, 0, .1)), ts = lerp(L.tape0, L.tape0*1.15, a)/TAPE_W;
    tpos.set(0, lerp(L.tapeY0, L.tapeY0*.4, a) - Math.sin(tr*Math.PI)*.55, lerp(0, STAGE_Z, tr));
    tq.setFromEuler(eul.set(lerp(.2, 0, tr) - mouse.y*.1, -.45 + Math.sin(S.time*.6)*.08*mv + mouse.x*.15, 0));
    tape.position.copy(tpos); tape.quaternion.copy(tq); tape.scale.setScalar(ts);
  } else {                                                             // 무대: 플레이어를 기준으로 한 자리들
    const f = tapeFrames(), hov = f.hover;
    const grow = ss(seg(P_, .27, .30));                                 // 카메라가 다가오는 만큼 실제 크기로 (화면 속 크기는 그대로)
    let s = lerp(L.tapeS/TAPE_W, f.s, grow);
    tpos.copy(hov.pos); tq.copy(hov.q);
    tpos.y += Math.sin(S.time*1.3)*.012*mv + env*.006;
    tq.multiply(qWob.setFromEuler(eul.set(0, Math.sin(S.time*.5)*.06*mv, 0)));
    const al = eio(seg(P_, .335, .358));                                // 슬롯 방향으로 회전 · 정렬
    if (al > 0) { tpos.lerp(f.align.pos, al); tpos.y += Math.sin(al*Math.PI)*.08*L.pw3; tq.slerp(f.align.q, al); s = f.s; }
    const k = seg(P_, .358, .38);                                       // 밀어 넣고 → 끌려 들어간다
    if (k > 0) { tpos.lerpVectors(f.align.pos, f.inside.pos, insertEase(k)); tq.copy(f.align.q); }
    tape.position.copy(tpos); tape.quaternion.copy(tq); tape.scale.setScalar(s);
  }
  for (const m of tapeParts.mats) m.opacity = op;
  const pw = ss(seg(P_, .275, .30));                                   // 펄스가 닿으면 색
  for (const m of [tapeParts.front, tapeParts.back, ...reels]) { const mt = m.material; mt.userData.uSat.value = P_ < .1 ? 0 : pw; mt.emissiveIntensity = .42 + .5*bump(P_, .275, .31) + env*.05*pw; }
  tapeParts.halo.material.opacity = op*(bump(P_, .275, .315)*.55 + (P_ > .3 ? env*.06 : 0));
  S.reelSpin += dt*(Math.abs(S.vel)*60 + (P_ > .28 ? 2.2 : 0) + (V.boot >= 0 ? 3 : 0));
  reels.forEach(r => r.rotation.z = -S.reelSpin);
}

/* 월드: 같은 길에서 전류선이 맥박 → 비트 → 전기 신호 → 에너지로 바뀌고, 에너지가 닿은 도시가 깨어난다 (타이포그래피와 박자를 맞춘다)
   ELECTRICITY 끝: 전류가 화면 아래 고가도로로 들어온다 → CITY: 도로를 따라 번져 화면 전체가 켜진다 → ENERGY ~ WORLD: 켜진 채 박동에 맞춰 숨 쉰다
   → 무대: 어두워지되 색이 약하게 남는다. 모두 스크롤 위치로만 정해지므로 거꾸로 올리면 같은 순서로 꺼진다 */
const shadeEl = { el:null, p:-1 };
export function updateWorld(P_, cz){
  const { cityPlane, currentLine } = world;
  cityPlane.visible = P_ > .06 && P_ < .57;
  if (cityPlane.visible) {
    const u = cityPlane.material.uniforms, stg = ss(seg(P_, .3, .37)), full = ss(seg(P_, .19, .2));
    u.uOpacity.value = ss(seg(P_, .07, .16))*(1 - ss(seg(P_, .46, .56)));
    // 세로 화면은 그림 가운데만 보이므로 번짐 끝값을 줄여 CITY 동안 같은 빠르기로 화면을 채운다
    u.uSpread.value = lerp(SPREAD0, lerp(1.2, 2.1, clamp((camera.aspect - .45)/1.15)), ss(seg(P_, .149, .197)));
    seedFromLine(P_, u);
    u.uBand.value = P_ > .145 ? 1 - ss(seg(P_, .192, .2)) : 0;
    u.uBright.value = lerp(.4, .26, stg); u.uSat.value = 0;
    u.uLitBright.value = lerp(.9, .46, stg); u.uLitSat.value = lerp(1, .45, stg);
    u.uFlash.value = bump(P_, .165, .2);
    u.uPulse.value = B.env*.22*full*(1 - stg)*(W.awake && !RM ? 1 : 0);
    u.uTime.value = S.time;
    shade(P_, u);
  }
  currentLine.visible = P_ > .095 && P_ < .4;
  if (currentLine.visible) {
    const headZ = lerp(cz - 2.2, STAGE_Z, ss(seg(P_, .12, .285))), u = currentLine.material.uniforms;
    u.uReveal.value = clamp((4 - headZ)/(4 - STAGE_Z));
    u.uOpacity.value = ss(seg(P_, .1, .13))*(1 - ss(seg(P_, .33, .4)));
    u.uPhase.value = B.phase; u.uBeat.value = B.env; u.uTime.value = S.time;
  }
}
/* 번짐 시작점 = 바닥 전류선 머리가 화면에서 겹쳐 보이는 도시 그림 위의 점 (ELECTRICITY 끝 위치로 고정 · 스크롤 위치로만 정해진다) */
const sv = new V3(), sh = new V3(), sd = new V3();
function seedFromLine(P_, u){
  const pp = Math.min(P_, .152), czp = lerp(9, STAGE_Z + CAM_D, eio(seg(pp, .05, .30)));
  const headZ = lerp(czp - 2.2, STAGE_Z, ss(seg(pp, .12, .285)));
  world.currentLine.userData.curve.getPoint(clamp((4 - headZ)/(4 - STAGE_Z)), sh);
  const cp = world.cityPlane, c = camera;
  sd.copy(sh).sub(c.position).normalize(); const k = (cp.position.z - c.position.z)/sd.z;
  sv.copy(c.position).addScaledVector(sd, k);
  const iu = clamp((sv.x - cp.position.x)/cp.scale.x + .5), iv = clamp((sv.y - cp.position.y)/cp.scale.y + .5);
  const q = u.uSeed.value.set(iu*1.7817, iv), road = cp.userData.road;
  let dm = 1e9, sq = 0;
  for (let i = 0; i < road.length - 1; i++) {
    const ax = road[i].x, ay = road[i].y, bx = road[i + 1].x - ax, by = road[i + 1].y - ay;
    const h = clamp(((q.x - ax)*bx + (q.y - ay)*by)/(bx*bx + by*by)), d = Math.hypot(q.x - ax - bx*h, q.y - ay - by*h);
    if (d < dm) { dm = d; sq = lerp(road[i].z, road[i + 1].z, h); }
  }
  u.uSeedRoad.value.set(sq, dm);
}
/* 불 켜진 배경 위 큰 글자: 지금 보이는 단어 뒤만 살짝 어둡게 (화면 픽셀 좌표 타원) */
const TY = [...document.querySelectorAll('.ty[data-p]')].map(el => ({ el, r:el.dataset.p.split(' ').map(Number), big:el.querySelector('.ty-xl, .ty-l') || el }));
function shade(P_, u){
  const lit = ss(seg(P_, .16, .2))*(1 - ss(seg(P_, .3, .34)));
  let best = null, bw = 0;
  for (const t of TY) { const w = bump(P_, t.r[0], t.r[1]); if (w > bw) { bw = w; best = t; } }
  if (!best || lit <= 0) { u.uShadeAmt.value = 0; return; }
  const r = best.big.getBoundingClientRect(), k = renderer.getPixelRatio(), H = innerHeight;
  if (r.width < 2) { u.uShadeAmt.value = 0; return; }
  u.uShade.value.set((r.left + r.width/2)*k, (H - r.top - r.height/2)*k, Math.max(r.width*.75, 160)*k, Math.max(r.height*1.1, 120)*k);
  u.uShadeAmt.value = .38*lit*Math.min(1, bw*1.6);
}

/* LED 먼지: PULSE가 오면 깨어나 색이 들고 박동에 맞춰 뛴다 ("작동하는 것만 색") */
const m4 = new THREE.Matrix4(), qI = new Q(), sc = new V3(), pos = new V3(), gray = new THREE.Color(), col = new THREE.Color();
export function updateLeds(){
  const { leds } = world, p = S.p, t = S.time, scroll = S.mode === 'scroll';
  const pw = scroll ? Math.max(W.energy*.55, ss(seg(p, .03, .3))) : 1;
  leds.material.opacity = scroll ? lerp(.9, .35, ss(seg(p, .32, .5))) : .3;
  const mv = W.awake && !RM ? 1 : 0, beat = 1 + B.env*.5*W.energy;
  leds.userData.items.forEach((it, i) => {
    pos.copy(it.p); pos.y += Math.sin(t*.4*it.s + it.ph)*.25*mv; pos.x += Math.cos(t*.3*it.s + it.ph)*.15*mv;
    sc.setScalar((.8 + it.s*.5)*(.75 + .25*Math.sin(t*2*it.s + it.ph)*mv)*beat); m4.compose(pos, qI, sc); leds.setMatrixAt(i, m4);
    const gv = (it.c.r*.3 + it.c.g*.59 + it.c.b*.11)*.6; gray.setRGB(gv, gv, gv); col.copy(gray).lerp(it.c, pw*.85); leds.setColorAt(i, col);
  });
  leds.instanceMatrix.needsUpdate = true; leds.instanceColor.needsUpdate = true;
}
