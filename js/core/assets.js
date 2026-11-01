/* 이미지 · 폰트 불러오기. 텍스처 객체는 바로 만들어(재질에 먼저 연결) 그림은 도착하는 대로 올라간다 */
import { THREE } from './three.js';
import { MAXA, LITE } from './stage.js';
import { IMG_DIR, IMAGES } from './config.js';

export const T = {};
const loader = new THREE.TextureLoader();
/* 작은 화면 · 터치 기기: 아주 큰 그림(고해상도 도시 · 플레이어)은 이 폭으로 줄여 올려 GPU 메모리를 아낀다 */
const LITE_MAX = 2560;
function fit(t){
  const im = t.image;
  if (!LITE || !im || im.width <= LITE_MAX) return;
  const c = document.createElement('canvas'); c.width = LITE_MAX; c.height = Math.round(im.height*LITE_MAX/im.width);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
  t.image = c; t.needsUpdate = true;
}

export function loadImages(keys, onProgress){
  let done = 0;
  return Promise.all(keys.map(k => new Promise(resolve => {
    if (T[k]) { resolve(T[k]); return; }
    T[k] = loader.load(IMG_DIR + IMAGES[k],
      t => { fit(t); t.anisotropy = MAXA; onProgress?.(++done/keys.length); resolve(t); },
      undefined,
      () => { console.error(`[PULSE] image failed: ${IMAGES[k]}`); resolve(T[k]); });
  })));
}

/* 캔버스에 글자를 그리기 전에 폰트를 기다린다 (최대 3.5초) */
export const loadFonts = list => Promise.race([
  Promise.all(list.map(f => document.fonts.load(f).catch(() => null))),
  new Promise(r => setTimeout(r, 3500)),
]);
