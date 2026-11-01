/* 화면 위 DOM: 하단 진행 막대 · PULSE 단어 · VHS 표시/조작 · 표지 제목. 요소는 한 번만 찾아 둔다 */
import { V3 } from '../core/three.js';
import { toScreen } from '../core/stage.js';
import { GAMES, STEPS, STEP_C, RANGES, PH } from '../core/config.js';
import { S, W, V, B, scrollToP } from '../core/state.js';
import { $, clamp, seg, ss } from '../core/utils.js';
import { ov, showOv } from './overlay.js';
import { vhs, vid } from '../scenes/vhs.js';
import { games } from '../scenes/games.js';

const el = {};
let segs = [], osdTxt = '', gtI = -1;
const pt = new V3();

export function buildHud(){
  const tl = $('#tl');
  tl.innerHTML = STEPS.map((s, i) => `<li style="--c:${STEP_C[i]}"><button type="button" aria-label="${String(i + 1).padStart(2, '0')} ${s}"><span class="seg"><i></i></span></button></li>`).join('');
  segs = [...tl.querySelectorAll('li')].map((li, i) => {
    const btn = li.querySelector('button');
    btn.addEventListener('click', () => { if (i < 5 && S.mode === 'scroll') scrollToP(RANGES[i][0] + (i === 4 ? .06 : .025)); });
    return { bar:li.querySelector('i'), btn, f:-1, dis:null };
  });
  Object.assign(el, { intro:ov('ov-intro'), anim:ov('ov-anim'), games:ov('ov-games'), osd:$('#osd'), vctl:$('#vctl'), seekCv:$('#vSeek canvas'), seek:$('#vSeek'),
    vTime:$('#vTime'), vDur:$('#vDur'), vol:$('#vVol'), volSeg:[...document.querySelectorAll('#vVol i')],
    vPlay:$('#vPlay'), vSnd:$('#vSnd'), gt:$('#gt'), gtName:$('#gt b'), gtInfo:$('#gt small') });
}

function updateTimeline(){
  const P_ = S.p, sc = S.mode === 'scroll';
  segs.forEach((s, i) => {
    let f;
    if (i < 5) f = (sc || i < 4) ? seg(P_, RANGES[i][0], RANGES[i][1]) : 1;
    else f = sc ? 0 : (i + 1 < S.stepNow ? 1 : i + 1 === S.stepNow ? S.stepFill : 0);
    f = Math.round(f*1000)/1000;
    if (f !== s.f) { s.f = f; s.bar.style.transform = `scaleX(${f})`; }
    const dis = i >= 5 || !sc;
    if (dis !== s.dis) { s.dis = dis; s.btn.disabled = dis; }
  });
}

/* 재생바: 회색 길 위로 청록 전류가 차오르고, 머리에서 심전도가 박동(B.env)에 맞춰 뛴다. 멈추면 회색 평선 */
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s/60)).padStart(2, '0') + ':' + String(s%60).padStart(2, '0'); };
const ECG = [[-30,0],[-22,0],[-20,-.12],[-18,0],[-14,0],[-12,.2],[-10,-1],[-8,.45],[-6,0],[-3,-.14],[0,0]];
function drawSeek(k, live){
  const cv = el.seekCv, r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(r.width*d), h = Math.round(r.height*d);
  if (!w || !h) return;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const x = cv.getContext('2d'), y0 = h/2, hx = Math.max(2*d, k*w), amp = live ? (5 + B.env*9)*d : 0;
  x.clearRect(0, 0, w, h); x.lineCap = 'round'; x.lineJoin = 'round';
  x.strokeStyle = '#2f2f36'; x.lineWidth = 2*d; x.setLineDash([2*d, 3*d]);                   // 아직 재생하지 않은 길: 테이프처럼 점선
  x.beginPath(); x.moveTo(hx, y0); x.lineTo(w, y0); x.stroke(); x.setLineDash([]);
  const col = live ? '#5ff3ff' : '#8a8992';
  x.strokeStyle = col; x.lineWidth = 2*d; x.shadowColor = live ? 'rgba(95,243,255,.85)' : 'transparent'; x.shadowBlur = live ? 8*d : 0;
  x.beginPath(); x.moveTo(0, y0);
  for (const [px, py] of ECG) { const xx = hx + px*d; if (xx > 0) x.lineTo(xx, y0 + py*amp); }
  x.stroke();
  x.fillStyle = live ? '#eaffff' : '#8a8992'; x.beginPath(); x.arc(hx, y0, (live ? 2.6 + B.env*1.2 : 2.4)*d, 0, Math.PI*2); x.fill();
  x.shadowBlur = 0;
}
/* 음량 미터: 정한 음량까지 켜지고, 재생 중엔 그 안에서 박동에 맞춰 칸이 오르내린다. 음소거면 모두 회색 */
function drawVol(live){
  const n = el.volSeg.length, lv = vid.muted ? 0 : vid.volume, top = lv*n, show = live ? top*(.62 + .38*B.env) : top;
  el.volSeg.forEach((s, i) => { const on = i < Math.round(top); s.classList.toggle('on', on); s.style.opacity = on && i >= Math.ceil(show) ? .38 : 1; });
  const v = Math.round(lv*100); if (String(v) !== el.vol.getAttribute('aria-valuenow')) el.vol.setAttribute('aria-valuenow', v);
}

export function updateHud(){
  updateTimeline();
  if (S.mode !== 'scroll') { [el.intro, el.anim, el.games].forEach(o => showOv(o, 0)); return; }
  const P_ = S.p;
  showOv(el.intro, W.awake ? (1 - seg(P_, .005, .02))*clamp((W.t - 2.2)/.6) : 0);

  // 03 VHS 표시 + 최소한의 조작
  const ao = V.boot > 1.25 && P_ > .38 && P_ < .495 ? 1 : 0;
  showOv(el.anim, ao);
  if (ao) {
    const scr = vhs.scrPlane, tl = toScreen(scr.localToWorld(pt.set(-.5, .5, 0))), br = toScreen(scr.localToWorld(pt.set(.5, -.5, 0)));
    el.osd.style.transform = `translate(${Math.max(tl.x, 0) + 14}px, ${Math.max(tl.y, 0) + 12}px)`;
    const paused = vid.paused && V.boot > 2, txt = V.ended ? '■ END' : paused ? '|| PAUSE' : '▶ PLAY';
    if (txt !== osdTxt) { osdTxt = txt; el.osd.textContent = txt; }
    el.osd.style.opacity = (V.boot < 3.8 || paused) ? (paused && Math.floor(S.time*2) % 2 ? .35 : 1) : 0;
    const vx = Math.max(16, tl.x), vw = Math.min(innerWidth - 16, br.x) - vx, vy = Math.min(br.y + 8, innerHeight - 60);   // 화면을 채워도 조작은 화면 안에
    el.vctl.style.transform = `translate(${Math.round(vx)}px, ${Math.round(vy)}px)`; el.vctl.style.width = Math.round(Math.max(200, vw)) + 'px';
    const k = vid.duration ? vid.currentTime/vid.duration : 0;
    const live = !vid.paused && !V.ended;
    drawSeek(k, live); el.vctl.classList.toggle('paused', !live);
    const tt = fmt(vid.currentTime), dd = fmt(vid.duration);
    if (tt !== el.vTime.textContent) { el.vTime.textContent = tt; el.seek.setAttribute('aria-valuenow', Math.round(k*100)); el.seek.setAttribute('aria-valuetext', tt); }
    if (dd !== el.vDur.textContent) el.vDur.textContent = dd;
    drawVol(live);
    el.vPlay.setAttribute('aria-pressed', String(!vid.paused)); el.vSnd.setAttribute('aria-pressed', String(!vid.muted));
    el.vSnd.classList.toggle('nudge', vid.muted && !vid.paused && Math.floor(S.time*1.6) % 2 === 0);
  }

  // 05 표지 아래 제목 하나
  const go = games.ready ? ss(seg(P_, .605, .64)) : 0;
  showOv(el.games, go);
  if (go > 0) {
    const fi = Math.round(S.focusF), g = GAMES[fi];
    if (fi !== gtI) { gtI = fi; el.gtName.textContent = g.name; el.gtInfo.textContent = `TRACK ${g.no} · ${g.genre}`; document.documentElement.style.setProperty('--color-game', g.color); }
    const s = toScreen(games.pkgs[fi].root.localToWorld(pt.set(0, -PH/2, 0)));
    el.gt.style.transform = `translate(${s.x}px, ${s.y + 22}px) translateX(-50%)`;
    el.gt.style.opacity = clamp(1 - Math.abs(fi - S.focusF)*2.4);
    el.gt.classList.toggle('hov', S.hoverI === fi);
  }
}
