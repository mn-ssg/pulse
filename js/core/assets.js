/* 이미지 · 폰트 불러오기. 텍스처 객체는 바로 만들어(재질에 먼저 연결) 그림은 도착하는 대로 올라간다 */
import { THREE } from './three.js';
import { MAXA } from './stage.js';
import { IMG_DIR, IMAGES } from './config.js';

export const T = {};
const loader = new THREE.TextureLoader();

export function loadImages(keys, onProgress){
  let done = 0;
  return Promise.all(keys.map(k => new Promise(resolve => {
    if (T[k]) { resolve(T[k]); return; }
    T[k] = loader.load(IMG_DIR + IMAGES[k],
      t => { t.anisotropy = MAXA; onProgress?.(++done/keys.length); resolve(t); },
      undefined,
      () => { console.error(`[PULSE] image failed: ${IMAGES[k]}`); resolve(T[k]); });
  })));
}

/* 캔버스에 글자를 그리기 전에 폰트를 기다린다 (최대 3.5초) */
export const loadFonts = list => Promise.race([
  Promise.all(list.map(f => document.fonts.load(f).catch(() => null))),
  new Promise(r => setTimeout(r, 3500)),
]);
