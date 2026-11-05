/* 여러 모듈이 함께 읽고 쓰는 상태 */
import { V3 } from './three.js';
import { P_MAP } from './config.js';

export const S = {
  p:0, pT:0, pPrev:0, prevP:0, vel:0,   // 스크롤 위치(부드럽게) · 목표 · 이전 프레임 · 속도
  time:0,
  mode:'loading',                        // loading | scroll | seq | insert | boot | ready | play
  busy:false,
  sel:-1,                                // 고른 게임 번호
  focusF:0,                              // 가운데에 있는 표지(소수 = 넘어가는 중)
  hoverI:-1,
  reelSpin:0,
  gestured:false,                        // 사용자가 누른 적이 있는가 (소리 정책)
  stepNow:6, stepFill:0,                 // 타임라인 6~9단계
  drag:null,                             // { type:'pkg'|'chip', ... }
};
export const L = {};                     // 레이아웃 (리사이즈마다 다시 계산)
export const mouse = { x:0, y:0, tx:0, ty:0 };
export const cam = { pos:new V3(0, 0, 9), look:new V3(), sPos:new V3(), sLook:new V3() };
export const W = { awake:false, t:0, energy:0 };                 // PULSE: 정지 → 첫 박동 → 깨어남
export const B = { phase:.5, bpm:66, env:0, extra:0 };           // 박동 시계
export const V = { boot:-1, userPaused:false, ended:false, pending:false, shake:0, forceMute:false };   // 영상

export const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);

/* 실제 스크롤(0~1) ↔ 타임라인 p. 장면마다 스크롤 길이를 다르게 준다 (config P_MAP) */
const TOTAL = P_MAP[P_MAP.length - 1][1];
export const TRACK_VH = TOTAL;
export function pFromScroll(r){
  const v = Math.min(1, Math.max(0, r))*TOTAL;
  for (let i = 1; i < P_MAP.length; i++) { const [p0, v0] = P_MAP[i - 1], [p1, v1] = P_MAP[i]; if (v <= v1) return p0 + (p1 - p0)*(v - v0)/(v1 - v0); }
  return 1;
}
export function scrollFromP(p){
  for (let i = 1; i < P_MAP.length; i++) { const [p0, v0] = P_MAP[i - 1], [p1, v1] = P_MAP[i]; if (p <= p1) return (v0 + (v1 - v0)*(p - p0)/(p1 - p0))/TOTAL; }
  return 1;
}
export const scrollToP = (x, smooth = true) => scrollTo({ top:scrollFromP(x)*maxScroll(), behavior:smooth ? 'smooth' : 'auto' });
