/* 화면 크기에 맞춘 배치 값 (리사이즈마다 다시 계산) */
import { L } from './state.js';
import { vis } from './stage.js';
import { CAM_D, PH, PLAYER3D } from './config.js';

export function computeLayout(){
  L.portrait = innerWidth/innerHeight < .95; L.narrow = innerWidth < 820;
  const st = L.stage = vis(CAM_D); L.hero = vis(8.1);
  L.tape0 = Math.min(Math.min(L.hero.w*(L.portrait ? .84 : .62), 6.4)*.3, 2.0); L.tapeY0 = L.portrait ? -L.hero.h*.08 : -1.05;
  L.tapeS = Math.min(st.w*.4, st.h*.5*1.5, 2.4);
  L.pkgH = Math.min(st.h*(L.portrait ? .36 : .56), st.w*(L.portrait ? .62 : .4)); L.pkgS = L.pkgH/PH;
  L.pkgX = 0; L.pkgY = st.h*(L.portrait ? .06 : .04);                       // 표지는 가운데 (양끝 글자 없음)
  L.spread = L.portrait ? L.pkgH*.95 : Math.max(st.w*.4, L.pkgH*1.25);
  L.conW = Math.min(st.w*(L.portrait ? .96 : .62), st.h*1.3, 3.5);
  L.conY = -st.h*(L.portrait ? .12 : .2);
  L.chipH = st.h*(L.portrait ? .16 : .24);
  // 3D 플레이어 · 실제 크기 테이프 · 플레이어 위 모니터
  L.pw3 = Math.min(st.w*(L.portrait ? .9 : .62), st.h*(L.portrait ? .42 : .62)/PLAYER3D.ar);
  L.py3 = -st.h*(L.portrait ? .06 : .12);
  L.tr = PLAYER3D.tape*L.pw3;
  L.monW = L.pw3*.62; L.monH = L.monW*9/16;
  L.monY = L.py3 + L.pw3*PLAYER3D.ar*.5 + L.monH*.5 + .12;
}
