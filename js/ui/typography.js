/* PULSE 설명 — Figma '20 · 우선순위'의 NAMING CONCEPT · SETTING PRIORITIES를 문단이 아니라 타이포그래피로.
   각 장면(.ty)은 data-p="시작 끝"(타임라인 p)에서 보이고, 안의 요소는 data-t="들어옴 시작·끝 나감 시작·끝"(장면 안 0~1)에 맞춰 움직인다.
   data-fx: rise(기본) | scale | clip(왼쪽부터 드러남) · data-fit: 화면 폭 대비 단어 폭 */
import { S, B } from '../core/state.js';
import { clamp, ss, eo } from '../core/utils.js';

const DEF_T = [.05, .3, .75, .95];
let layer, scenes = [], visible = false;

export function buildTypography(){
  layer = document.getElementById('type');
  scenes = [...layer.querySelectorAll('.ty')].map(el => {
    const [a, b] = el.dataset.p.split(' ').map(Number);
    const items = [...el.querySelectorAll('[data-t], .ty-xl')].map(n => ({
      n, fx:n.dataset.fx || 'rise', t:(n.dataset.t || DEF_T.join(' ')).split(' ').map(Number), o:-1, tf:'' }));
    return { el, a, b, items, on:false, kind:[...el.classList].find(c => c.startsWith('ty-') ) };
  });
  // ELECTRICITY: 글자마다 깜빡이도록 나눈다
  layer.querySelectorAll('[data-split]').forEach(n => { n.innerHTML = [...n.textContent].map(c => `<span>${c}</span>`).join(''); });
}

/* 큰 단어는 화면 폭에 맞춰 글자 크기를 정한다 */
export function fitTypography(){
  layer.querySelectorAll('[data-fit]').forEach(n => {
    n.style.fontSize = '100px';
    const w = n.getBoundingClientRect().width || 1;
    n.style.fontSize = (parseFloat(n.dataset.fit)*innerWidth/w*100).toFixed(1) + 'px';
  });
}

function setStyle(it, op, tf){
  const o = Math.round(op*1000)/1000;
  if (o !== it.o) { it.o = o; it.n.style.opacity = o; }
  if (tf !== it.tf) { it.tf = tf; it.n.style.transform = tf; }
}

export function updateTypography(){
  const P_ = S.p, show = S.mode === 'scroll' && P_ > .025 && P_ < .28;
  if (show !== visible) {
    visible = show; layer.style.visibility = show ? 'visible' : 'hidden';
    if (!show) for (const sc of scenes) { sc.on = false; sc.el.style.visibility = 'hidden'; }   // 자식의 visible이 부모 hidden을 이기지 않게
  }
  if (!show) return;
  const env = B.env;
  for (const sc of scenes) {
    const k = (P_ - sc.a)/(sc.b - sc.a), on = k > 0 && k < 1;
    if (!on) { if (sc.on) { sc.on = false; sc.el.style.visibility = 'hidden'; } continue; }
    if (!sc.on) { sc.on = true; sc.el.style.visibility = 'visible'; }
    for (const it of sc.items) {
      const [i0, i1, o0, o1] = it.t;
      const t = ss(clamp((k - i0)/(i1 - i0))), o = ss(clamp((k - o0)/(o1 - o0)));
      let tf;
      if (it.fx === 'scale') tf = `scale(${((1.22 - .22*eo(t))*(1 - o*.12)*(1 + env*.03)).toFixed(4)})`;
      else if (it.fx === 'clip') { tf = `translateY(${(-o*30).toFixed(1)}px)`; it.n.style.clipPath = `inset(-10% ${((1 - t)*100).toFixed(2)}% -10% 0)`; }
      else if (it.fx === 'shrink') tf = `translate(${(-o*28).toFixed(2)}vw, ${(-o*30).toFixed(2)}vh) scale(${(1 - o*.75).toFixed(4)}) scale(${(1 + env*.035).toFixed(4)})`;
      else tf = `translateY(${((1 - t)*46 - o*36).toFixed(1)}px)`;
      setStyle(it, t*(1 - o), tf);
    }
    effects(sc, k, env);
  }
}

/* 장면별: 박동 · 전기 · 도시 점등 · 에너지 */
function effects(sc, k, env){
  const el = sc.el;
  if (sc.kind === 'ty-elec') {                                         // 전류처럼 몇 글자가 튄다
    el.querySelectorAll('[data-split] span').forEach(s => {
      const hit = Math.random() < .06;
      s.style.opacity = hit ? .35 : 1; s.style.transform = hit ? `translateY(${(Math.random()*8 - 4).toFixed(1)}px)` : '';
    });
    el.style.setProperty('--flick', (.55 + Math.random()*.45).toFixed(2));
  } else if (sc.kind === 'ty-city') {                                  // 멈춘 도시 → 전류가 지나간 곳부터 켜진다
    el.style.setProperty('--on', ss(clamp((k - .3)/.35)).toFixed(4));
  } else if (sc.kind === 'ty-energy') {
    el.style.setProperty('--e', (.35 + env*.65).toFixed(3));
  }
}
