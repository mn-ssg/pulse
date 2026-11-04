/* three.js 무대: 렌더러 · 카메라 · 조명 · 재질 · 도형 도우미 · 화면 좌표 · 클릭 판정 */
import { THREE, V3 } from './three.js';
import { VS, FS } from './shaders.js';
import { STAGE_Z } from './config.js';

export const canvas = document.getElementById('gl');
/* 작은 화면 · 터치 기기는 가볍게 (픽셀 밀도 · 선 정밀도 · 먼지 수) */
export const LITE = matchMedia('(max-width: 820px), (pointer: coarse)').matches;

export const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LITE ? 1.5 : 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = !LITE;                                    // 테이프 · 플레이어가 같은 빛 아래 그림자를 드리운다
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const MAXA = renderer.capabilities.getMaxAnisotropy();

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0e10);
export const camera = new THREE.PerspectiveCamera(35, 1, .05, 220);
scene.add(new THREE.HemisphereLight(0xc8cbd8, 0x08080a, 1.1));
/* 주 조명: 방향은 원본과 같고(3, 5, 7), 그림자 범위를 무대에 맞추려고 무대 쪽에 둔다 */
export const keyL = new THREE.DirectionalLight(0xffffff, 2.2); keyL.position.set(3, 5, 7 + STAGE_Z); keyL.target.position.set(0, 0, STAGE_Z);
keyL.castShadow = !LITE; keyL.shadow.mapSize.set(1024, 1024); keyL.shadow.bias = -.0006; keyL.shadow.normalBias = .02;
Object.assign(keyL.shadow.camera, { left:-4, right:4, top:4, bottom:-4, near:1, far:26 });
scene.add(keyL, keyL.target);
export const rimL = new THREE.DirectionalLight(0x9eeeff, 1.0); rimL.position.set(-6, 2, -2); scene.add(rimL);

/* 무대(영상 · 패키지 · 게임기가 서는 곳) */
export const stage = new THREE.Group(); stage.position.z = STAGE_Z; scene.add(stage);

/* ---------- 재질 · 도형 ---------- */
export function imgMat(tex, o = {}){
  return new THREE.ShaderMaterial({ vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:o.depthWrite ?? true,
    side:o.side ?? THREE.FrontSide, blending:o.blending ?? THREE.NormalBlending,
    uniforms:{ map:{value:tex}, uSat:{value:o.sat ?? 1}, uOpacity:{value:o.opacity ?? 1}, uBright:{value:o.bright ?? 1},
      uRadius:{value:o.radius ?? 0}, uAspect:{value:o.aspect ?? 1}, uSheen:{value:o.sheen ?? 0}, uLight:{value:.4}, uScan:{value:0}, uFlick:{value:0},
      uCrop:{value:new THREE.Vector4(...(o.crop ?? [0,0,1,1]))}, uHole:{value:new THREE.Vector4(...(o.hole ?? [0,0,0,0]))},
      uTint:{value:new THREE.Color(o.tint ?? 0)}, uTintAmt:{value:o.tintAmt ?? 0} } });
}
export const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
/* 조명을 받는 이미지 재질: 테이프 · 플레이어가 같은 빛 · 그림자 안에 있도록. 무채색↔색(uSat), 구멍(uHole: 슬롯) */
export function litMat(tex, o = {}){
  const m = new THREE.MeshStandardMaterial({ map:tex, emissiveMap:tex, emissive:0xffffff, emissiveIntensity:o.glow ?? .42,
    roughness:o.rough ?? .5, metalness:o.metal ?? .2, transparent:true, alphaTest:.02, side:o.side ?? THREE.FrontSide });
  const uSat = { value:o.sat ?? 1 }, uHole = { value:new THREE.Vector4(...(o.hole ?? [0, 0, 0, 0])) };
  m.userData.uSat = uSat; m.userData.uHole = uHole;
  m.onBeforeCompile = sh => {
    sh.uniforms.uSat = uSat; sh.uniforms.uHole = uHole;
    sh.fragmentShader = 'uniform float uSat; uniform vec4 uHole;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (uHole.z > uHole.x && vMapUv.x > uHole.x && vMapUv.x < uHole.z && vMapUv.y > uHole.y && vMapUv.y < uHole.w) discard;
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.299,.587,.114))), diffuseColor.rgb, uSat);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(vec3(dot(totalEmissiveRadiance, vec3(.299,.587,.114))), totalEmissiveRadiance, uSat);`);
  };
  m.customProgramCacheKey = () => 'pulse-lit';
  return m;
}
/* 텍스처를 복제하지 않고 도형의 UV만 잘라 쓴다 ([u, v, w, h], v는 아래에서 위) */
export function cropUV(geo, [u, v, w, h]){
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i)*w, v + uv.getY(i)*h);
  uv.needsUpdate = true; return geo;
}
export function rrShape(w, h, r){ const s = new THREE.Shape(), x = -w/2, y = -h/2; r = Math.min(r, w/2, h/2);
  s.moveTo(x+r, y); s.lineTo(x+w-r, y); s.quadraticCurveTo(x+w, y, x+w, y+r); s.lineTo(x+w, y+h-r); s.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  s.lineTo(x+r, y+h); s.quadraticCurveTo(x, y+h, x, y+h-r); s.lineTo(x, y+r); s.quadraticCurveTo(x, y, x+r, y); return s; }
export function chipShape(w, h, r, n){ const s = new THREE.Shape(), x = -w/2, y = -h/2;
  s.moveTo(x+r, y); s.lineTo(x+w-r, y); s.quadraticCurveTo(x+w, y, x+w, y+r); s.lineTo(x+w, y+h-n); s.lineTo(x+w-n, y+h);
  s.lineTo(x+r, y+h); s.quadraticCurveTo(x, y+h, x, y+h-r); s.lineTo(x, y+r); s.quadraticCurveTo(x, y, x+r, y); return s; }
export function extrude(shape, d, mat){ const b = Math.min(d*.28, .02);
  const g = new THREE.ExtrudeGeometry(shape, { depth:Math.max(.001, d - 2*b), bevelEnabled:true, bevelThickness:b, bevelSize:b*.8, bevelSegments:3, curveSegments:10 });
  g.center(); return new THREE.Mesh(g, mat); }
export const slab = (w, h, d, r, mat) => extrude(rrShape(w, h, r), d, mat);
export function canvasTex(w, h, draw){ const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = MAXA; return t; }

export const glowTex = canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.22, 'rgba(255,255,255,.5)'); g.addColorStop(.55, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w); });
export const reelRingTex = canvasTex(128, 128, x => { x.strokeStyle = '#fff'; x.lineWidth = 7; x.beginPath(); x.arc(64, 64, 50, 0, Math.PI*2); x.stroke();
  for (let i = 0; i < 6; i++) { x.save(); x.translate(64, 64); x.rotate(i/6*Math.PI*2); x.fillStyle = '#fff'; x.fillRect(-5, -44, 10, 16); x.restore(); } });
export function glowMesh(color, size){
  const m = plane(1, 1, new THREE.MeshBasicMaterial({ map:glowTex, color, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
  m.scale.setScalar(size); return m;
}

/* ---------- 화면 크기 · 좌표 ---------- */
export function vis(d){ const h = 2*d*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2); return { h, w:h*camera.aspect }; }
export function resizeRenderer(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w/h;
  camera.fov = Math.max(35, THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(46)/2)/camera.aspect)));
  camera.updateProjectionMatrix();
}
const tmpS = new V3();
export function toScreen(v){ tmpS.copy(v).project(camera); return { x:(tmpS.x*.5 + .5)*innerWidth, y:(-tmpS.y*.5 + .5)*innerHeight, z:tmpS.z }; }

/* ---------- 클릭 판정 ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function rayAt(e){ ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight)*2 + 1); ray.setFromCamera(ndc, camera); return ray; }
export const pick = (objs, e) => rayAt(e).intersectObjects(objs, true)[0];
