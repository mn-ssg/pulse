/* 게임 실행 · 종료: 게임기 화면으로 들어가 iframe으로 실제 게임을 연다. 나오면 iframe을 비워 소리 · 메모리 · 이벤트를 모두 정리한다 */
import { THREE, V3 } from '../core/three.js';
import { camera } from '../core/stage.js';
import { GAMES, gameUrl, STAGE_Z, CAM_D } from '../core/config.js';
import { S, cam } from '../core/state.js';
import { $, tween, wait, eio } from '../core/utils.js';
import { SFX } from '../core/audio.js';
import { ov, showOv, showBack } from '../ui/overlay.js';
import { games, backToCollection } from './games.js';

const layer = $('#play'), frame = $('#frame'), flash = $('#flashw');
const CAM_STAGE = new V3(0, 0, STAGE_Z + CAM_D), LOOK_STAGE = new V3(0, 0, STAGE_Z);

function openFrame(g){
  layer.hidden = false;
  frame.title = g.name;
  frame.onload = () => { try { frame.contentWindow.focus(); } catch (_) {} frame.focus(); };
  frame.src = gameUrl(g);
}
function closeFrame(){
  frame.onload = null;
  frame.src = 'about:blank';                                            // 게임 문서 · 오디오 · 리스너가 함께 사라진다
  layer.hidden = true;
}

export async function startGame(){
  if (S.mode !== 'ready' || S.busy) return; S.busy = true; S.mode = 'seq'; showBack(false); SFX.start();
  const g = GAMES[S.sel], { consoleG, conScreen } = games;
  S.stepNow = 9; S.stepFill = 0;
  // 게임기 화면에 꽉 차게 다가간다
  const sp = conScreen.getWorldPosition(new V3()), sw = conScreen.scale.x*consoleG.scale.x*conScreen.geometry.parameters.width, sh = conScreen.geometry.parameters.height*consoleG.scale.x;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const d = Math.min((sh/2)/Math.tan(fov/2), (sw/2)/(Math.tan(fov/2)*camera.aspect))*.94;
  cam.sPos.copy(cam.pos); cam.sLook.copy(cam.look);
  const tp = sp.clone().add(new V3(0, 0, d));
  await tween(1.0, e => { cam.pos.lerpVectors(cam.sPos, tp, e); cam.look.lerpVectors(cam.sLook, sp, e); }, t => t*t*t);
  flash.style.transition = 'none'; flash.style.opacity = .85;
  openFrame(g);
  requestAnimationFrame(() => { flash.style.transition = 'opacity .6s'; flash.style.opacity = 0; layer.classList.add('on'); });
  S.mode = 'play'; S.busy = false; S.stepFill = 1; showOv(ov('ov-play'), 0);
}

export async function exitGame(){
  if (S.mode !== 'play' || S.busy) return; S.busy = true; S.mode = 'seq';
  layer.classList.remove('on');
  await wait(.35); closeFrame();
  showOv(ov('ov-play'), 1); S.stepNow = 8; S.stepFill = 0;
  cam.sPos.copy(cam.pos); cam.sLook.copy(cam.look);
  await tween(.9, e => { cam.pos.lerpVectors(cam.sPos, CAM_STAGE, e); cam.look.lerpVectors(cam.sLook, LOOK_STAGE, e); }, eio);
  S.busy = false; S.mode = 'ready'; await backToCollection();
}
