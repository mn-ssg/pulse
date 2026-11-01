# LIVE WIRE RACER 배경 수정 — Higgsfield 프롬프트 기록 (2026-11-01)

기준: 피그마 「중간」 페이지 `265:1718` 「live wire racer 배경 수정사항」 (2736×1536)

## 참고 이미지 (Higgsfield에 올린 것)

| 번호 | 내용 | 피그마 |
|---|---|---|
| ① | 배경 수정사항 원본 2736×1536 | `265:1718` |
| ② | 지금 표지 앞면 그림 원본 1920×2160 (Set 3) | `77:560` 안의 이미지 |
| ③ | 주인공 캐릭터 1254×1254 | `84:2471` |

## 모델

- **Nano Banana Pro** (`nano_banana_pro`, 2K, 1장 2크레딧): 표지, 배경 시안, 하늘
  - 참고 이미지를 여러 장 받는다. 입력 그림의 인물·구도를 유지한 채 배경만 바꾸는 편집이 가장 안정적이고, 잉크 그림체를 따른다.
- **Nano Banana 2.1** (`nano_banana_2_1`, 4K, 4:1): 먼 빌딩·가까운 빌딩 띠
  - 4:1 비율을 지원하는 모델이라 가로로 긴 원경 띠를 한 장으로 뽑을 수 있다.
- **업스케일**: `bytedance` 4K. 고른 표지·배경에만 썼다.

## 표지 (고른 것: CV-3, 1:1) — 참고 ② ① ③ 순서

```
Edit Image 1, an ink-sketch game cover illustration. Keep the rider and motorbike from Image 1 unchanged: same pose, camera angle and position; spiky blond hair, black goggle visor with two white ring eyes, white shirt, mechanical gray arm and glove, black pants and boots, the front of the black motorbike with its glowing yellow pixel LED bar, and the red pixel electric-current trail streaming from the wheel. Image 3 shows the same character for reference; keep his design identical. Remove the 'LIVE WIRE RACER' title lettering completely and continue the highway road where it was. Replace only the background: the pale paper sky and gray city become a night megacity drawn in the same rough ink-pen hatching style, matching the mood of Image 2: dense skyscrapers rising up to the top edge, very tall towers, skybridges between buildings, spires, antennas, a small drone; low heavy dark blue-gray clouds with almost no open sky. Buildings are charcoal gray, slate navy and muted dusty purple, mostly unlit; only small scattered windows glow pale yellow and a few small signs glow red or amber-yellow. No pink, no cyan, no teal, no blue neon. Steel high-voltage transmission towers and power lines keep running along the elevated highway between the buildings, dark steel with small red warning lamps. The highway asphalt is dark gray with motion speed lines. The red current trail and the yellow LED bar must stay the brightest, most saturated things in the picture. Hand-drawn ink illustration with paper grain, not 3D, not photographic. Square composition, rider centered. Darker and moodier: heavier clouds, even fewer lit windows, most of the city an almost black-gray mass, so the red trail glows strongly.
```

다른 시안의 마지막 문장: CV-1 `Keep the background layout close to Image 2: a very tall tower behind the center and another on the right.` / CV-2 `One colossal tower rises directly behind the rider's head...`(분홍·청록 간판이 나와 제외) / CV-4 `The elevated highway runs into a canyon of skyscrapers...`

뒤처리
- 4K 그림을 원본과 같은 1920×2160으로 맞춘다.
- 원본 표지에서 제목 로고 부분만 오려 같은 픽셀 위치에 다시 얹는다. 로고 위치는 `images/title.webp`로 찾았다.
- 종이 결을 옅게 덧입힌다.
- 칩은 이 그림의 흑백판이다. 머리카락, LED 띠, 빨간 전류, 로고만 색을 남긴다.

## 게임 배경 시안 (고른 것: BG-4, 16:9) — 참고 ① ②

```
Wide panoramic illustration of a night megacity skyline for a racing game background. Match Image 1 in composition, density and mood, and draw it in the rough ink-pen hatching style of Image 2 (hand-drawn ink illustration with paper grain, not 3D, not photographic). Dense skyscrapers fill the frame up to the top edge: one very tall tower in the center and another on the right, skybridges connecting buildings, spires, antennas, two small drones. Low heavy dark blue-gray clouds, almost no open sky. Buildings are charcoal gray, slate navy and muted dusty purple. Most windows are dark; only small scattered windows glow pale yellow and a few small signs glow red or amber-yellow. No pink, no cyan, no teal, no blue neon. Viewed straight on at eye level from an elevated highway. The bottom edge is a flat band of dark blue-gray haze: no road, no cars, no people, no characters, no foreground objects, no text, no logos. Darker and moodier: heavier clouds and even fewer lit windows, the city almost a black-gray silhouette with rare pale yellow windows and two or three red signs.
```

## 게임 층 (참고: BG-4 + ①)

먼 빌딩 `city-far` — Nano Banana 2.1, 4:1, 4K
```
Extend Image 1 into a very wide 4:1 panorama of the same night megacity, in exactly the same rough ink-pen hatching illustration style, colors and lighting as Image 1 (mood of Image 2). Dense skyscrapers of varied heights across the whole width, with three very tall towers rising almost to the top edge, skybridges connecting buildings, spires, antennas, rooftop water tanks. Buildings are charcoal gray, slate navy and muted dusty purple; distant buildings paler blue-gray from haze, nearer ones darker. Most windows are dark; only small scattered windows glow pale yellow and a few small signs glow red or amber-yellow. No pink, no cyan, no teal, no blue neon. Near the far left and far right edges the buildings are lower. Replace the entire sky with a flat solid pure green (#00FF00) background: no clouds, no gradient, no texture, no haze in the sky, so the buildings can be cut out cleanly. The bottom of the image is a dark blue-gray haze band where the buildings' bases disappear. No drones, no people, no vehicles, no text, no logos.
```

가까운 빌딩 `city-near` — Nano Banana 2.1, 4:1, 4K
```
A very wide 4:1 strip of NEAR foreground city buildings at night, seen straight on from an elevated highway, drawn in exactly the same rough ink-pen hatching illustration style and colors as Image 1. Dark, detailed mid-rise and high-rise facades with heavy ink hatching, rooftop water tanks, antennas, pipes, ducts, fire escapes, empty billboard frames, a short skybridge. Taller blocks at the far left and far right, lower rooftops in the middle so a distant city behind would stay visible. Colors: very dark charcoal, slate navy, muted dusty purple. Most windows dark; a few small windows glow pale yellow and one or two small signs glow red or amber-yellow. No pink, no cyan, no teal. Everything above and between the buildings is a flat solid pure green (#00FF00) background with no clouds, no gradient and no haze. Building bases run along the bottom edge. No people, no vehicles, no drones, no text, no logos.
```

하늘 `city-sky` — Nano Banana Pro, 21:9, 2K
```
Only the sky of Image 1, with every building removed: low, heavy, dark blue-gray night clouds filling the whole frame, drawn in the same rough ink-pen hatching illustration style and colors as Image 1 (mood of Image 2). Slightly lighter, hazier blue-gray toward the bottom horizon, darker toward the top. No open bright sky, no moon, no stars, no buildings, no drones, no birds, no text. Soft and even enough to sit behind a city skyline.
```

뒤처리 (빌딩 두 층)
- 초록을 빼서 투명하게 만든다.
- 청록 기운은 회청색으로 누른다.
- 탑 꼭대기는 위로 갈수록 흐려지게 해 구름 속으로 사라지게 한다.
- 좌우 끝을 겹쳐 섞어서 가로로 반복해도 이음매가 보이지 않게 한다.
- 켜진 창문·간판을 골라 따로 떼어 `*-lit` 그림으로 만든다. 그 자리는 주변 색으로 메워 꺼진 그림을 만든다.

## 파일

- 게임이 불러오는 파일: `images/city-sky.webp`, `city-far.webp`, `city-far-lit.webp`, `city-near.webp`, `city-near-lit.webp`
- 투명 PNG 원본: `images/layers/`
- 꺼짐 → 켜짐: 게이트를 지나 철탑이 켜질 때마다 `*-lit` 그림이 블록 단위로 차례차례 켜진다. 첫 게이트에서 약 18%가 켜지고, 24개를 모두 켜면 100%가 된다 (`dist/game.js`의 `cityMat` · `cityLit`).
