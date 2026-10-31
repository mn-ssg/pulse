/* 합성 효과음 (Web Audio). 사용자가 한 번 누르기 전에는 소리를 만들지 않는다 */
import { S } from './state.js';

export const AUD = { ctx:null, on:true };

export function ac(){
  if (!AUD.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AUD.ctx = new C(); }
  if (AUD.ctx.state === 'suspended') AUD.ctx.resume();
  return AUD.ctx;
}
const ready = () => AUD.on && (AUD.ctx || S.gestured) ? ac() : null;

function tone(f0, f1, dur, type = 'square', vol = .05, delay = 0){
  const c = ready(); if (!c) return; const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .03);
}
function noise(dur, vol = .06, hp = 1500, delay = 0){
  const c = ready(); if (!c) return; const t = c.currentTime + delay;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate*dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f).connect(g).connect(c.destination); s.start(t);
}

export const SFX = {
  click(){ noise(.03,.14,3200); tone(2600,1900,.03,'square',.025); },
  open(){ noise(.1,.05,900); tone(320,190,.14,'triangle',.06); },
  whoosh(){ noise(.4,.035,500); },
  lock(){ tone(120,58,.18,'sine',.3); noise(.06,.12,700); tone(1700,1700,.035,'square',.03,.07); },
  power(){ tone(80,900,.5,'sawtooth',.03); tone(160,1800,.5,'square',.01); },
  chime(){ [523.25,659.25,783.99,1046.5].forEach((f,i) => tone(f,f,.16,'square',.035,i*.09)); tone(1046.5,1046.5,.55,'triangle',.05,.36); },
  start(){ tone(880,1760,.1,'square',.04); tone(1760,1760,.22,'square',.035,.1); },
  eject(){ tone(520,980,.09,'square',.035); noise(.05,.08,2200); },
  heart(v = 1){ tone(64,38,.17,'sine',.5*v); noise(.03,.05*v,150); tone(56,34,.14,'sine',.32*v,.2); },
  clack(){ noise(.05,.16,2400); tone(900,420,.05,'square',.025); },
  clunk(){ tone(95,46,.22,'sine',.45); noise(.08,.14,500); tone(1500,1500,.03,'square',.02,.07); },
  whir(){ tone(55,150,.8,'sawtooth',.012); noise(.8,.02,300); },
  hiss(d = 1){ noise(d,.03,2500); },
};
