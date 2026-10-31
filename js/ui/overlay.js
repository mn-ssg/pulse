/* 오버레이 공통 동작 (보이기 · 되돌아가기 버튼 · 짧은 표시 글자 · 스크롤 잠금) */
import { toScreen } from '../core/stage.js';

export const ov = id => document.getElementById(id);
export function showOv(el, o){
  if (el._o === o) return; el._o = o;                                  // 같은 값이면 스타일을 다시 쓰지 않는다
  el.style.opacity = o; el.classList.toggle('vis', o > .01); el.style.pointerEvents = o > .5 ? '' : 'none';
}
export const showBack = on => ov('back').classList.toggle('on', on);
export const lockScroll = on => { document.documentElement.style.overflow = on ? 'hidden' : ''; document.body.classList.toggle('locked', on); };
export function flashText(txt, worldPos){
  const el = ov('fx1'), s = toScreen(worldPos);
  el.textContent = txt; el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  el.animate([{ opacity:0, transform:'translate(-50%,-30%)' }, { opacity:1, transform:'translate(-50%,-80%)', offset:.25 }, { opacity:0, transform:'translate(-50%,-140%)' }],
    { duration:900, easing:'ease-out' });
}
