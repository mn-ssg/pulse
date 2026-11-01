# PULSE

IDIOTAPE 애니메이션과 게임 3종을 하나의 흐름으로 경험하는 3D 인터랙티브 웹사이트 (커뮤니케이션 디자인).

PULSE Intro → Concept → VIDEO TAPE → PLAYER → 애니메이션 → GAME COVER → 패키지 → 칩 → 게임기 → 실제 게임

## 실행

ES 모듈과 영상 스트리밍을 쓰므로 `index.html`을 파일로 직접 열지 말고 **로컬 서버**로 연다.

- WebStorm / IntelliJ: `index.html` 우클릭 → Open in Browser
- VS Code: Live Server 확장
- 터미널: `npx serve .` 또는 `python3 -m http.server` (영상 탐색은 Range를 지원하는 서버가 더 매끄럽다)

## 폴더 구조

```
index.html                 마크업 (CSS · JS는 아래 파일)
css/main.css               디자인 토큰(:root) → 기본 → 헤더·타임라인 → 장면별 오버레이 → 게임 레이어 → 반응형
js/
  main.js                  진입점: 불러오기 순서 · 프레임 루프 · 리사이즈
  core/
    three.js               three.js를 한 곳에서 불러온다
    config.js              게임 데이터 · 파일 경로 · 타임라인 상수   ← 이미지/게임을 바꿀 땐 여기만
    state.js               여러 모듈이 함께 쓰는 상태
    utils.js               수학 · 이징 · 트윈
    stage.js               렌더러 · 카메라 · 재질 · 도형 도우미 · 클릭 판정
    shaders.js             GLSL
    assets.js              이미지 · 폰트 불러오기
    audio.js               합성 효과음
    layout.js              화면 크기별 배치 값
  scenes/
    pulse.js               01 PULSE 로고(Figma PULSE_logo) 점등 · 심전도 선 · 박동
    world.js               02 카메라 이동 · 테이프 · 월드 · 전류선 · LED
    vhs.js                 03 3D 플레이어 · 슬롯 · 테이프 삽입 · 화면 줌인 · 영상 재생
    games.js               05–09 표지 · 칩 · 게임기 · 부팅
    game-loader.js         게임 iframe 열기/닫기
  ui/
    hud.js                 진행 막대 · PULSE 단어 · VHS 표시 · 표지 제목
    input.js               포인터 · 키보드 · 버튼
    typography.js          02 PULSE 설명 타이포그래피 (Figma NAMING CONCEPT · SETTING PRIORITIES)
    overlay.js             오버레이 공통 동작
  vendor/                  three.js r160 (+ 라이선스)
assets/
  images/
    brand/                 IDIOTAPE 로고 · PULSE 로고 (Figma PULSE_logo 원본)
    tape/                  비디오 테이프 앞 · 뒤
    world/                 도시 배경: city-still(꺼짐) · city-lit(켜짐, 같은 구도) — 02 WORLD에서 전류가 번지며 회색 → 색
    player/                카세트 플레이어 정면 · 측면 (Figma '13 · 캐릭터와 소품', 3D 상자 면 텍스처)
    console/               게임기
    games/<게임>/          cover-front · cover-back · chip · cover-blur · logo (Figma '18 · 선택한 게임 3')
  videos/
    pulse-film.mp4         애니메이션 (1080p H.264, 웹 스트리밍용 faststart)
    pulse-film-poster.webp
games/
  loop-night/              각 게임은 독립 폴더 (index.html · dist/ · images/ · audio/ · fonts/)
  never-city/
  live-wire-racer/
```

## 불러오는 순서

1. 첫 화면: 테이프 그림 + PULSE 폰트만 기다렸다가 바로 시작
2. 곧바로 뒤에서: 월드 · 플레이어 그림
3. 그다음: 게임 표지 · 칩 · 게임기 (만들어지면 표지 장면이 나타난다)
4. 영상: 스크롤이 VHS 장면에 가까워질 때 받기 시작
5. 게임: 칩을 넣고 START를 눌렀을 때만 iframe으로 연다. EXIT하면 iframe을 비워 소리 · 메모리를 정리한다

## 이름 규칙

파일 · 폴더는 영문 소문자 kebab-case (`never-city/cover-front.webp`). 새 그림을 넣을 땐 `js/core/config.js`의 `IMAGES`에 경로를 추가한다.
