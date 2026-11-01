/* GLSL */

export const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const RBOX = `float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }`;

/* 이미지 판: 무채색 ↔ 색("작동하는 것만 색"), 둥근 모서리, 반사광, 주사선, 구멍(플레이어 도어) */
export const FS = `uniform sampler2D map; uniform float uSat,uOpacity,uBright,uRadius,uAspect,uSheen,uLight,uScan,uFlick;
uniform vec4 uCrop, uHole; uniform vec3 uTint; uniform float uTintAmt; varying vec2 vUv;
${RBOX}
void main(){
  if (uHole.z > uHole.x && vUv.x > uHole.x && vUv.x < uHole.z && vUv.y > uHole.y && vUv.y < uHole.w) discard;
  vec4 c = texture2D(map, uCrop.xy + vUv * uCrop.zw);
  float g = dot(c.rgb, vec3(.299,.587,.114));
  c.rgb = mix(vec3(g), c.rgb, uSat);
  c.rgb = mix(c.rgb, uTint, uTintAmt) * uBright;
  float a = 1.;
  if (uRadius > 0.) { vec2 p = (vUv - .5) * vec2(uAspect, 1.); float d = rbox(p, vec2(uAspect*.5, .5), uRadius); float w = fwidth(d); a = 1. - smoothstep(-w, w, d); }
  if (uSheen > 0.) { float s = smoothstep(.18, 0., abs(vUv.x*.75 + vUv.y*.55 - uLight)); c.rgb += uSheen * s; }
  if (uScan > 0.) { float l = sin(vUv.y * 900.) * .5 + .5; c.rgb *= 1. - uScan*.22*l; }
  c.rgb *= 1. - uFlick;
  float al = c.a * a * uOpacity;
  if (al < .003) discard;
  gl_FragColor = vec4(c.rgb, al);
}`;

/* VHS 화면: 노이즈 · 트래킹 · 주사선 → 실제 영상 */
export const SCREEN_FS = `uniform sampler2D map; uniform float uOpacity,uNoise,uTrackY,uTrack,uTime,uBright,uRadius,uAspect,uScan,uWhite; varying vec2 vUv;
${RBOX}
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv = vUv;
  float band = exp(-pow((uv.y - uTrackY)*12., 2.)) * uTrack;
  uv.x += band*(h2(vec2(floor(uv.y*140.), floor(uTime*30.))) - .5)*.08 + uTrack*sin(uv.y*36. + uTime*24.)*.002;
  vec3 c = texture2D(map, clamp(uv, 0., 1.)).rgb;
  float n = h2(floor(vUv*vec2(360.,200.)) + floor(uTime*50.)*.37);
  c = mix(c, vec3(n*.9), clamp(uNoise + band*.5, 0., 1.));
  c *= 1. - uScan*.22*(sin(vUv.y*900.)*.5 + .5);
  c = mix(c, vec3(1.), uWhite);
  c *= uBright;
  vec2 p = (vUv - .5)*vec2(uAspect, 1.); float dd = rbox(p, vec2(uAspect*.5, .5), uRadius); float w = fwidth(dd); float a = 1. - smoothstep(-w, w, dd);
  gl_FragColor = vec4(c, a*uOpacity);
}`;

const ECG = `float gs(float u, float c, float w){ float k = (u-c)/w; return exp(-k*k); }
float ecg(float u){ return .11*gs(u,.17,.035) - .16*gs(u,.305,.011) + gs(u,.33,.011) - .3*gs(u,.356,.012) + .2*gs(u,.56,.05); }`;

/* 인트로 심전도 선 (화면 기준): 처음엔 평평한 회색 선, 첫 박동이 지나가며 켜진다 */
export const TRACE_VS = `void main(){ gl_Position = vec4(position.xy, 0., 1.); }`;
export const TRACE_FS = `uniform vec2 uRes; uniform float uDpr,uTime,uPhase,uBeat,uAlpha,uAmp,uY,uFront,uSingle,uDead,uLiveTo; uniform vec3 uCol;
${ECG}
float wave(float x){ float u = uSingle > .5 ? clamp(.33 + (x - uFront)*.5, 0., 1.) : fract(.33 + x*.5 - uPhase); return ecg(u); }
void main(){
  vec2 px = gl_FragCoord.xy / uDpr;
  float x = px.x - uRes.x*.5, yy = px.y - uRes.y*.5 - uY;
  float hw = uRes.x*.5, xn = x/hw, e = 1./hw;
  float f0 = wave(xn)*uAmp, d1 = (wave(xn+e) - wave(xn-e))*uAmp*.5;
  float d = max(abs(yy - f0)/sqrt(1. + d1*d1), abs(yy) - uAmp*1.1 - 2.);
  float edge = smoothstep(1.03, .8, abs(xn));
  float core = smoothstep(2.1, .6, d), halo = exp(-d/6.)*(.3 + uBeat*.55);
  vec3 live = uCol*(core*1.3 + halo) + vec3(core)*(.25 + uBeat*.4);
  vec3 dead = vec3(.2)*core;
  float dm = uDead * smoothstep(uLiveTo - .08, uLiveTo + .02, xn);
  gl_FragColor = vec4(mix(live, dead, dm)*edge*uAlpha, 1.);
}`;

/* 전류선: 같은 선이 길을 따라 심장 박동 → 비트 → 전기 신호 → 에너지로 바뀐다 */
export const CURRENT_VS = `uniform float uTime, uPhase, uBeat; varying vec2 vUv; varying vec4 vW; varying float vF;
float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i+1.), f*f*(3.-2.*f)); }
${ECG}
void main(){ vUv = uv; float x = uv.x; vec3 p = position;
  float wH = 1. - smoothstep(.2, .27, x);
  float wB = smoothstep(.2, .27, x)*(1. - smoothstep(.45, .52, x));
  float wE = smoothstep(.45, .52, x)*(1. - smoothstep(.7, .77, x));
  float wN = smoothstep(.7, .77, x);
  vW = vec4(wH, wB, wE, wN);
  float y = wH*ecg(fract(.33 + x*9. - uPhase))*.2;
  float m = fract(x*14. - uPhase*2.);
  y += wB*(exp(-m*3.)*.9 + .2*exp(-fract(m*2.)*7.))*(sin(x*900. + uTime*9.)*.6 + (n1(x*500. + uTime*20.) - .5)*.8)*.1;
  y += wE*(tanh(sin(x*140. - uTime*8.)*6.)*.045 + (n1(x*700. + uTime*40.) - .5)*.06);
  p.y += y;
  p += normal*.016*wN*(1.2 + uBeat*1.2);
  vF = .5 + .5*sin(x*90. - uTime*24.);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.); }`;
export const CURRENT_FS = `uniform float uReveal,uOpacity,uBeat; varying vec2 vUv; varying vec4 vW; varying float vF;
void main(){ float x = vUv.x; if (x > uReveal) discard;
  vec3 col = vec3(.91,.22,.18)*vW.x + vec3(1.,.31,.85)*vW.y + vec3(.37,.95,1.)*vW.z + vec3(1.,.9,.7)*vW.w;
  float rim = 1. - abs(vUv.y*2. - 1.);
  float head = smoothstep(.06, .0, uReveal - x)*2.2;
  float a = (.35 + .65*rim)*(.55 + .45*vF)*uOpacity*(1. + uBeat*.5);
  gl_FragColor = vec4(col*(1.2 + head) + vec3(head*.6), a); }`;

/* 02 월드 도시: 꺼진 도시(city-still) → 불 켜진 도시(city-lit). 고가도로에 전류가 들어온 자리부터 번지고(도로를 따라 먼저 → 양옆 건물),
   번지는 가장자리엔 청록 전류 띠가 깜빡인다. 창문 · 간판은 칸마다 조금씩 늦게 툭툭 켜진다 */
export const CITY_FS = `uniform sampler2D map, mapLit; uniform vec3 uRoad[12]; uniform vec2 uSeed, uSeedRoad;
uniform float uOpacity,uBright,uSat,uLitBright,uLitSat,uSpread,uBand,uTime,uFlash,uPulse,uShadeAmt; uniform vec4 uShade;
varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(h21(i), h21(i + vec2(1.,0.)), f.x), mix(h21(i + vec2(0.,1.)), h21(i + vec2(1.,1.)), f.x), f.y); }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
void main(){
  vec3 st = texture2D(map, vUv).rgb, li = texture2D(mapLit, vUv).rgb;
  /* 도로 곡선까지의 거리(가로를 그림 비율로 늘린 좌표)와 곡선 위 위치 s(0 = 화면 아래로 들어오는 곳) */
  vec2 p = vec2(vUv.x*1.7817, vUv.y);
  float dmin = 1e3, s = 0.;
  for (int i = 0; i < 11; i++) {
    vec2 a = uRoad[i].xy, ab = uRoad[i+1].xy - a;
    float h = clamp(dot(p - a, ab)/dot(ab, ab), 0., 1.), d = length(p - a - ab*h);
    if (d < dmin) { dmin = d; s = mix(uRoad[i].z, uRoad[i+1].z, h); }
  }
  /* 바닥 전류선의 머리 뒤(uSeed)에서 먼저 번져 고가도로에 닿고(uSeedRoad: 닿는 곳의 s · 거리), 그다음 도로를 따라 달린 뒤 양옆 건물로 */
  float tRoad = uSeedRoad.y*.55 + abs(s - uSeedRoad.x)*.6 + dmin*.95, tSeed = length(p - uSeed)*.55;
  float t = min(tSeed, tRoad) + (vnoise(p*7.) - .5)*.2 + (vnoise(p*26.) - .5)*.06;
  float area = 1. - smoothstep(uSpread - .05, uSpread, t);
  /* 광원(창문 · 간판 · 가로등 · 전류): 불 켜진 그림에서만 밝은 곳 */
  float lm = smoothstep(.14, .32, lum(li) - lum(st)*.55) * smoothstep(.45, .7, max(li.r, max(li.g, li.b)));
  float cyan = smoothstep(.02, .14, li.b - li.r) * smoothstep(.0, .1, li.g - li.r);   // 도로 전류는 번짐과 함께, 나머지는 칸마다 늦게
  float pop = smoothstep(0., .015, uSpread - t - .05 - h21(floor(vUv*vec2(56., 31.)))*.24);
  float on = mix(pop, 1., cyan);
  vec3 offC = vec3(.15,.16,.19)*(.55 + lum(st)*.9);
  vec3 lc = mix(li, offC, lm*(1. - on)) + li*lm*on*uPulse;
  lc = mix(vec3(lum(lc)), lc, uLitSat) * uLitBright * (1. + uFlash*.35);
  vec3 sc = mix(vec3(lum(st)), st, uSat) * uBright;
  vec3 c = mix(sc, lc, area);
  /* 번지는 가장자리: 얇은 청록 띠가 깜빡인다 */
  float bx = (t - uSpread + .01)/(fwidth(t)*2.2 + .0006);
  float band = exp(-bx*bx) + .22*exp(-bx*bx*.06);   // 화면에서 몇 픽셀 굵기의 선 + 옅은 번짐
  float fl = (.7 + .3*sin(uTime*43. + t*140.)) * (h21(vec2(floor(uTime*20.), floor(t*36.))) > .18 ? 1. : .3);
  c += vec3(.373,.953,1.) * band * fl * uBand * .85;
  /* 큰 글자 뒤만 살짝 어둡게 (화면 좌표 타원) */
  if (uShadeAmt > 0.) { vec2 q = (gl_FragCoord.xy - uShade.xy)/uShade.zw; c *= 1. - uShadeAmt*exp(-dot(q, q)*1.6); }
  if (uOpacity < .003) discard;
  gl_FragColor = vec4(c, uOpacity);
}`;
