/* 수학 · 이징 · 트윈 · DOM 도우미 */
export const $ = s => document.querySelector(s);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (p, a, b) => clamp((p - a)/(b - a));
export const lerp = (a, b, t) => a + (b - a)*t;
export const ss = t => t*t*(3 - 2*t);
export const eio = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
export const eo = t => 1 - Math.pow(1 - t, 3);
export const eob = t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3*Math.pow(t - 1, 3) + c1*Math.pow(t - 1, 2); };
export const eos = t => { const c1 = .65, c3 = c1 + 1; return 1 + c3*Math.pow(t - 1, 3) + c1*Math.pow(t - 1, 2); };   // 아주 작은 오버슈트(약 1.5%)
export const bump = (p, a, b) => Math.sin(Math.PI*seg(p, a, b));
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 트윈: await tween(초, e => {...}, 이징). 프레임 루프의 runTweens가 진행시킨다 */
const tweens = [];
export const tween = (dur, fn, ease = x => x) => new Promise(res => tweens.push({ t:0, dur, fn, ease, res }));
export const wait = s => tween(s, () => {});
export function runTweens(dt){
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt; const k = clamp(w.t/w.dur); w.fn(w.ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); w.res(); }
  }
}
export const snapT = o => ({ pos:o.position.clone(), q:o.quaternion.clone(), s:o.scale.x });
