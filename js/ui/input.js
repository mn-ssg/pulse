/* 입력: 포인터 · 키보드 · 버튼. 모든 리스너는 시작할 때 한 번만 붙인다 */
import { canvas, pick } from '../core/stage.js';
import { FOCUS_P } from '../core/config.js';
import { S, W, B, V, mouse, scrollToP } from '../core/state.js';
import { $, clamp } from '../core/utils.js';
import { AUD, ac, SFX } from '../core/audio.js';
import { wake } from '../scenes/pulse.js';
import { world } from '../scenes/world.js';
import { vhs, vid, togglePlay, ensureVideo } from '../scenes/vhs.js';
import { games, selectGame, startChipDrag, moveChip, endChipDrag, chipHit, autoInsert, backToCollection, snapYaw } from '../scenes/games.js';
import { startGame, exitGame } from '../scenes/game-loader.js';

export const noteGesture = () => { S.gestured = true; };
const tapeZone = () => S.p > .25 && S.p < .37;
const screenZone = () => V.boot > 1.2 && S.p > .38 && S.p < .495;
const inShelf = () => S.mode === 'scroll' && S.p > .6 && games.ready;
const focused = () => games.pkgs[Math.round(S.focusF)];
function pickSide(e){ const f = Math.round(S.focusF); let r = -1; games.pkgs.forEach((P, i) => { if (r < 0 && i !== f && P.root.visible && pick(P.hit, e)) r = i; }); return r; }

function onPointerMove(e){
  mouse.tx = e.clientX/innerWidth*2 - 1; mouse.ty = -(e.clientY/innerHeight*2 - 1);
  const d = S.drag;
  if (d && d.type === 'pkg') { const dx = e.clientX - d.x, P = games.pkgs[d.i]; d.moved += Math.abs(dx) + Math.abs(e.clientY - d.y0); d.x = e.clientX; P.dragYaw += dx*.009; P.dragVel = dx*.009; return; }
  if (d && d.type === 'chip') { moveChip(e); return; }
  if (e.pointerType !== 'mouse') return;
  let cursor = '';
  if (inShelf()) {
    const P = focused(), h = pick(P.hit, e);
    S.hoverI = h ? P.i : -1; cursor = h ? 'grab' : (pickSide(e) >= 0 ? 'pointer' : '');
    if (h) { const lp = P.root.worldToLocal(h.point.clone()); P.tiltT.set(clamp(lp.x*2, -1, 1), clamp(lp.y*2, -1, 1)); }
  } else if (S.mode === 'scroll') {
    if ((tapeZone() && (pick(world.tapeParts.hit, e) || pick([vhs.body], e))) || (screenZone() && pick([vhs.scrPlane], e))) cursor = 'pointer';
  } else if (S.mode === 'insert') cursor = pick(chipHit(), e) ? 'grab' : '';
  else if (S.mode === 'ready') cursor = pick([games.consoleG.userData.face], e) ? 'pointer' : '';
  canvas.style.cursor = cursor;
}

function onPointerDown(e){
  noteGesture();
  if (S.mode === 'loading') return;
  if (!W.awake) { ac(); wake(); return; }
  if (inShelf()) {
    const P = focused(), h = pick(P.hit, e);
    if (h) { S.drag = { type:'pkg', i:P.i, x:e.clientX, y0:e.clientY, moved:0 }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
    else { const side = pickSide(e); if (side >= 0) scrollToP(FOCUS_P[side]); }
  } else if (S.mode === 'scroll' && S.p < .1) { ac(); B.extra = Math.min(1.2, B.extra + .9); SFX.heart(.9); }
  else if (S.mode === 'scroll' && tapeZone() && (pick(world.tapeParts.hit, e) || pick([vhs.body], e))) { ac(); SFX.click(); ensureVideo(); scrollToP(.395); }
  else if (S.mode === 'scroll' && screenZone() && pick([vhs.scrPlane], e)) togglePlay();
  else if (S.mode === 'insert') { if (pick(chipHit(), e)) { startChipDrag(e); canvas.setPointerCapture(e.pointerId); } }
  else if (S.mode === 'ready') { if (pick([games.consoleG.userData.face, games.conScreen], e)) startGame(); }
}

function onPointerUp(){
  const d = S.drag; if (!d) return;
  S.drag = null; canvas.style.cursor = '';
  if (d.type === 'pkg') {
    const P = games.pkgs[d.i];
    if (d.moved < 8) { P.dragYaw = Math.round(P.dragYaw/(Math.PI*2))*Math.PI*2; selectGame(d.i); }
    else snapYaw(P);
  } else if (d.type === 'chip') endChipDrag(d);
}

function onKey(e){
  noteGesture(); if (!W.awake && S.mode === 'scroll') wake();
  if (e.key === 'Escape') { if (S.mode === 'play') exitGame(); else if (S.mode === 'insert' || S.mode === 'ready') backToCollection(); }
  if (e.key !== 'Enter') return;
  if (S.mode === 'ready') startGame();
  else if (S.mode === 'insert') autoInsert();
  else if (inShelf()) selectGame(Math.round(S.focusF));
}

function onSound(){
  noteGesture(); AUD.on = !AUD.on;
  if (!vid.paused) vid.muted = !AUD.on || V.forceMute;
  const b = $('#sound'); b.textContent = AUD.on ? 'SOUND ON' : 'SOUND OFF'; b.setAttribute('aria-pressed', AUD.on);
  if (AUD.on) { ac(); SFX.click(); }
}

export function initInput(){
  addEventListener('pointermove', onPointerMove, { passive:true });
  canvas.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);
  addEventListener('keydown', onKey);
  $('#sound').addEventListener('click', onSound);
  $('#back').addEventListener('click', () => backToCollection());
  $('#exit').addEventListener('click', exitGame);
}
