import { installTheme, meanderURI } from './theme.js'

/**
 * 막간.
 *
 * 판이 끝나자마자 다음 판이 시작되면 아홉 번 싸운 기억만 남는다.
 * 사이에 한 호흡을 넣어야 "돌아가는 길"이 된다.
 *
 * 글줄을 하나씩 띄우고 뒤에는 그 뱃길에 맞는 장면을 깐다.
 * 마우스로는 넘어가지 않는다 — 읽는 중에 한 번 클릭했다고 이야기가 날아가면
 * 다시는 안 읽게 된다. 넘기려면 아래 건너뛰기를 직접 누른다.
 */
const CSS = `
#lude { position:absolute; inset:0; z-index:62; display:none;
  pointer-events:none; font-family:var(--body); overflow:hidden; background:#05040a;
  /* 판을 지날수록 오른다. 0 = 갓 건 액자, 1 = 스무 해 걸려 있던 것 */
  --wear:0;
  /* 액자가 빛에 닿기까지 걸리는 시간. 처음 켤 때와 옆으로 옮겨 갈 때가 다르다 */
  --on-delay:.25s; }
#lude.on { display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:clamp(18px, 3.2vh, 40px); padding:4vh 24px;
  pointer-events:auto; cursor:default; }

/* ── 뱃길 장면 ───────────────────────────────────────────
   판마다 같은 바다를 보여 주면 일곱 번 같은 데를 지난 것이 된다.
   어디를 떠나 어디로 가는지에 따라 하늘과 물을 바꾼다. */
#lude .scene { position:absolute; inset:0; opacity:0; transition:opacity 1.4s ease;
  filter:saturate(.7) brightness(.42); }
#lude.on .scene { opacity:1; }
/* 액자 뒤로 물린 장면 위에 어둠 한 겹 — 액자가 떠 보이게 */
#lude .scrim { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 80% 70% at 50% 45%, rgba(4,3,6,.55), rgba(3,2,5,.92) 100%); }

/* 그림은 액자에 걸린다.
   화면 가득 깔면 배경이 되고, 배경이 되면 그냥 지나간다.

   여러 장이면 한자리에서 갈아 끼우지 않는다. 벽에 나란히 걸어 놓고
   카메라가 옆으로 옮겨 간다 — 액자도 조명도 같이 흘러야 '그림이 바뀐' 게
   아니라 '내가 옮겨 간' 것으로 읽힌다.

   처음엔 어둠뿐이고, 위에서 조명 하나가 켜지면서 첫 액자만 떠오른다. */
#lude .hall { position:relative; flex:0 1 auto; width:100%; height:min(60vh, 62%);
  overflow:hidden; }
/* transform 이 걸려 있어 이 칸 자체가 스태킹 컨텍스트다. z-index 를 안 주면
   0 으로 취급돼서, 뒤에 있어야 할 빛기둥(z-index 1)이 액자 위로 올라온다. */
#lude .wall { position:absolute; inset:0; display:flex; z-index:2;
  transition:transform 1.9s cubic-bezier(.45,.02,.25,1); }
#lude .slot { position:relative; flex:0 0 100%; height:100%;
  display:flex; align-items:center; justify-content:center; }

/* ── 조명 ──────────────────────────────────────────────
   등은 천장에 박혀 있다. 액자가 옆으로 흘러도 빛은 제자리다 —
   그래서 .lamp 와 .fixture 는 미끄러지는 .wall 밖, .hall 에 직접 붙인다.

   ── 빛이 어디 있어야 하는가 ──
   그림용 등은 액자 위에 달려 아래로 내리쬔다. 빛은 전구에서 나와
   **그림 앞을 지나** 그림 면에 닿는다. 그러니 기둥은 액자 앞(z-index 6)이다.
   뒤에 두면 액자 뒤를 비추는 꼴이 되어, 걸린 그림이 아니라 뒤에서
   조명을 쏜 반투명 판때기가 된다.

   ── 앞에 두면서 스티커처럼 안 보이게 ──
   전에 앞에 뒀을 때 그림 위에 얹힌 삼각형으로 보인 이유는 둘이다:
   (1) clip-path 로 자른 하드 엣지, (2) 그냥 덮어씌우는 합성.
   그래서 이렇게 바꾼다 —
   · 모양은 clip-path 가 아니라 **꼭짓점에서 퍼지는 conic-gradient**.
     원뿔의 각도 경계 자체가 그라데이션이라 자른 자국이 없다.
   · 합성은 **screen**. 더하기만 한다 — 어떤 경우에도 그림을 덮거나
     탁하게 만들 수 없고, 어두운 벽에서만 기둥으로 드러난다.
   · 거리 감쇠는 꼭짓점 중심 radial 마스크. 전구에서 멀수록 죽는다.

   ── 각도 ──
   전구는 hall 맨 위 가운데. 화면에서 '바로 아래' 는 conic 기준 180deg.
   반각 θ 짜리 원뿔은 from (180-θ)deg 에 0~2θ 구간을 쓰면 아래를 중심으로
   대칭이 된다. 액자 아래끝(hall 높이의 약 0.9)에서 액자 반폭(약 0.27 × hall
   너비)까지 닿으려면 θ ≈ 30도. 속심은 그 절반쯤인 16도. */

/* 등. 놋쇠 갓 아래 전구 한 줄 — 빛이 시작되는 점 */
#lude .fixture { position:absolute; left:50%; top:0; z-index:7;
  width:clamp(110px, 19%, 210px); height:9px; transform:translateX(-50%);
  pointer-events:none; opacity:0; transition:opacity 1.2s ease .25s; }
#lude .fixture::before { content:''; position:absolute; inset:0;
  border-radius:3px 3px 7px 7px;
  background:linear-gradient(180deg, #6a5738 0%, #3a2f1e 58%, #1b160e 100%);
  box-shadow:0 3px 8px rgba(0,0,0,.85), inset 0 1px 0 rgba(216,180,112,.55); }
#lude .fixture::after { content:''; position:absolute; left:9%; right:9%; bottom:-2px;
  height:3px; border-radius:2px; background:rgba(255,240,208,.96);
  box-shadow:0 0 14px 5px rgba(255,224,166,.75), 0 0 36px 14px rgba(255,216,146,.3); }

/* 빛기둥. 액자 앞을 지난다. screen 이라 더하기만 한다. */
#lude .lamp { position:absolute; left:50%; top:2px; z-index:6;
  width:150%; height:116%; transform:translateX(-50%);
  pointer-events:none; mix-blend-mode:screen;
  opacity:0; transition:opacity 1.6s ease .3s; }

/* 바깥 원뿔 — 반각 30도. 꼭짓점이 곧 전구 자리(50% 0%) */
#lude .lamp .halo { position:absolute; inset:0; display:block; filter:blur(12px);
  background:conic-gradient(from 150deg at 50% 0%,
    transparent 0deg,
    rgba(255,234,192,.045) 11deg,
    rgba(255,240,206,.10) 26deg,
    rgba(255,240,206,.10) 34deg,
    rgba(255,234,192,.045) 49deg,
    transparent 60deg);
  -webkit-mask-image:radial-gradient(ellipse 46% 104% at 50% 0%,
    #000 4%, rgba(0,0,0,.6) 42%, transparent 88%);
  mask-image:radial-gradient(ellipse 46% 104% at 50% 0%,
    #000 4%, rgba(0,0,0,.6) 42%, transparent 88%); }

/* 속심 — 반각 16도. 이게 있어야 번진 얼룩이 아니라 기둥으로 읽힌다 */
#lude .lamp .core { position:absolute; inset:0; display:block; filter:blur(6px);
  background:conic-gradient(from 164deg at 50% 0%,
    transparent 0deg,
    rgba(255,248,230,.16) 7deg,
    rgba(255,250,236,.20) 14deg,
    rgba(255,248,230,.16) 25deg,
    transparent 32deg);
  -webkit-mask-image:radial-gradient(ellipse 34% 96% at 50% 0%, #000 3%, transparent 66%);
  mask-image:radial-gradient(ellipse 34% 96% at 50% 0%, #000 3%, transparent 66%); }

/* 먼지. 빛을 가로지르는 것이 있어야 빛에 부피가 생긴다 */
#lude .lamp .motes { position:absolute; inset:0; display:block; overflow:hidden;
  -webkit-mask-image:conic-gradient(from 152deg at 50% 0%,
    transparent 0deg, #000 14deg, #000 42deg, transparent 56deg);
  mask-image:conic-gradient(from 152deg at 50% 0%,
    transparent 0deg, #000 14deg, #000 42deg, transparent 56deg); }
#lude .lamp .motes i { position:absolute; width:2px; height:2px; border-radius:50%;
  background:rgba(255,242,212,.8); box-shadow:0 0 4px 1px rgba(255,232,186,.45);
  animation:mote linear infinite; }
@keyframes mote {
  0%   { transform:translate3d(0,0,0) scale(.6); opacity:0; }
  14%  { opacity:.8; }
  76%  { opacity:.42; }
  100% { transform:translate3d(var(--dx), 96px, 0) scale(1); opacity:0; }
}

/* 벽물듦. 액자 뒤 벽이 같이 떠야 액자가 '벽에 걸린' 게 된다 — 이것도 고정 */
#lude .glowwall { position:absolute; left:50%; top:50%; z-index:0;
  width:96%; height:124%; transform:translate(-50%, -50%);
  pointer-events:none; opacity:0; transition:opacity 1.6s ease .35s;
  background:radial-gradient(ellipse 48% 42% at 50% 36%,
    rgba(126,100,60,.30) 0%, rgba(76,59,34,.12) 48%, transparent 78%);
  filter:blur(30px); }

#lude.lit .fixture,
#lude.lit .lamp,
#lude.lit .glowwall { opacity:1; }

#lude .frame { position:relative; z-index:2;
  width:min(940px, 78vw); max-height:82%; aspect-ratio:1049/603;
  background-image:url("/img/frame.webp?v=4");
  background-size:100% 100%; background-repeat:no-repeat;
  /* 어두운 쪽과 밝은 쪽의 filter 함수 개수를 맞춰 둔다. 길이가 다르면
     브라우저가 짧은 쪽을 초기값으로 채워서 보간하는데, 그 규칙에 기대는
     것보다 양쪽을 같은 모양으로 적어 두는 편이 읽기도 쉽고 안전하다.
     여기 drop-shadow 는 '그림자 없음' 을 뜻하는 자리 채우기다. */
  filter:brightness(.18) saturate(.6) sepia(0) contrast(1)
         drop-shadow(0 0 0 rgba(0,0,0,0));
  /* 어두워질 때 — 빠르다.
     빛이 원뿔이 되면서 얇아졌다. 액자는 바로 옆으로 밀려나는 게 아니라
     '빛에서 빠져나가는' 것이라, 벗어나는 건 순식간이고 닿는 건 한참 걸린다.

     기하로 뽑은 숫자다 — 반각 30도 원뿔이 액자 세로 중앙(전구에서 240px
     아래)에서 갖는 반폭은 240·tan30 = 139px. 액자 반폭은 342px. 벽은
     1.9초에 1280px 를 미끄러지니 674px/s.
       나가는 액자가 빛을 완전히 벗어나기까지  (342+139)/674 = 0.71초
       들어오는 액자가 빛에 닿기 시작          (1280-481)/674 = 1.19초
     CSS 는 '그 상태로 들어가는' 쪽 전이를 쓰므로, 어두운 상태의 전이는
     여기(.frame 기본), 밝은 상태의 전이는 아래 .here 규칙에 적는다. */
  transition:filter .68s ease-in;
  will-change:filter; }
/* 조명이 켜지면 액자가 떠오른다. 지금 서 있는 칸만 —
   지나온 액자는 다시 어둠으로 물러난다.

   낡음은 같은 액자 한 장으로 낸다. 금박이 빛을 잃고(brightness·saturate),
   누렇게 뜨고(sepia), 골이 깊어진다(contrast). */
/* 밝아질 때 — 늦다. 들어오는 액자는 1.19초쯤 지나야 빛에 닿는다. */
#lude.lit .slot.here .frame {
  /* 롱핸드로 쪼갠다. 단축에 var() 를 섞으면 롱핸드 전부가
     pending-substitution 이 되어 읽기도 디버깅하기도 나빠진다 —
     var() 는 delay 하나에만 둔다. */
  transition-property:filter;
  transition-duration:.72s;
  transition-timing-function:ease-out;
  transition-delay:var(--on-delay);
  filter:brightness(calc(1 - .26 * var(--wear)))
         saturate(calc(1 - .40 * var(--wear)))
         sepia(calc(.24 * var(--wear)))
         contrast(calc(1 + .12 * var(--wear)))
         drop-shadow(0 24px 40px rgba(0,0,0,.75)); }

/* 때. 금박 위에만 앉아야 한다 — 화폭에 묻으면 그림에 낀 무늬로 읽힌다.
   액자 그림은 알파가 통째로 불투명이라 그걸로는 못 잘라 낸다.
   화폭(.pane, z-index 2)보다 아래에 깔면 가운데는 화폭이 덮어 준다. */
#lude .frame::before { content:''; position:absolute; inset:0; z-index:1;
  pointer-events:none; mix-blend-mode:multiply;
  opacity:calc(var(--wear) * .85);
  background:
    radial-gradient(ellipse 128% 92% at 50% 0%,
      rgba(26,19,10,0) 38%, rgba(22,16,9,.58) 100%),
    repeating-linear-gradient(118deg, rgba(34,25,13,.30) 0 2px, transparent 2px 9px),
    repeating-linear-gradient(-74deg, rgba(12,9,5,.22) 0 1px, transparent 1px 13px); }



/* 화폭 — 액자 안쪽 구멍의 실제 자리 */
#lude .pane { position:absolute; left:9.8%; right:11.2%; top:17.1%; bottom:12.4%;
  overflow:hidden; z-index:2;
  background:radial-gradient(ellipse 66% 58% at 50% 46%, #17102a 0%, #0a0714 58%, #050309 100%);
  /* 테 안쪽 턱이 그림에 드리우는 그늘 */
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.85), inset 0 6px 22px rgba(0,0,0,.75),
             inset 0 -4px 16px rgba(0,0,0,.5); }
#lude .plate-img { position:absolute; inset:0; background-size:cover;
  background-position:center; opacity:0; transition:opacity 1.0s ease; }
#lude .plate-img.in { opacity:1; }
/* 오려 낸 인물은 꽉 채우지 않는다 — 액자 안에 세워 둔다 */
#lude .plate-img.fig { background-size:contain; background-repeat:no-repeat;
  background-position:center bottom; }
/* 화폭도 같이 나이를 먹는다 — 니스가 누레지고 실금이 간다 */
#lude .pane::before { content:''; position:absolute; inset:0; pointer-events:none; z-index:3;
  mix-blend-mode:multiply; opacity:calc(var(--wear) * .38);
  background:
    radial-gradient(ellipse 78% 68% at 50% 44%,
      rgba(126,90,34,0) 26%, rgba(104,72,26,.46) 100%),
    /* 실금. 촘촘하고 고르면 화면에 낀 무늬로 읽힌다 — 성글게, 두 각을 어긋나게 */
    repeating-linear-gradient(63deg, rgba(0,0,0,.07) 0 1px, transparent 1px 27px),
    repeating-linear-gradient(-24deg, rgba(0,0,0,.05) 0 1px, transparent 1px 41px); }
#lude .pane::after { content:''; position:absolute; inset:0; pointer-events:none; z-index:2;
  background:linear-gradient(180deg, rgba(4,3,6,.34) 0%, transparent 24%,
    transparent 66%, rgba(4,3,6,.52) 100%); }

/* 글 뒤에 그늘 한 겹. 그림이 밝으면 흰 글씨가 그대로 묻힌다 —
   화면 전체를 어둡게 하면 그림이 죽으니 글 있는 띠만 눌러 준다. */
#lude.dim .hall { opacity:0; transition:opacity 1.1s ease; }
#lude .plate { position:relative; flex:0 0 auto; text-align:center;
  width:min(860px, 90vw); padding:10px 20px; opacity:1;
  transition:opacity 1.0s ease, transform 1.2s ease; }
#lude .plate::before { content:''; position:absolute; inset:-30% -18%;
  background:radial-gradient(ellipse 60% 58% at 50% 50%,
    rgba(4,3,6,.72) 0%, rgba(4,3,6,.46) 48%, transparent 84%);
  pointer-events:none; }
#lude .plate > * { position:relative; }
/* 마지막 글줄이 뚝 끊기지 않게 한 번 접고 나간다 */
#lude .plate.out { opacity:0; transform:translateY(-8px); }
#lude .band { height:14px; background-image:${meanderURI('#c8973e', 0.85)};
  background-repeat:repeat-x; background-position:center; opacity:.35; }
#lude .line { min-height:4.2em; display:grid; place-items:center; margin:22px 0 18px; }
#lude .line span { display:block; font-family:var(--serif); font-size:clamp(19px, 2.0vw, 26px); line-height:1.9;
  letter-spacing:.06em; color:#f4ead6; opacity:0; transform:translateY(12px);
  transition:opacity .8s ease, transform .9s cubic-bezier(.2,.8,.3,1);
  text-shadow:0 2px 6px rgba(0,0,0,.95), 0 4px 22px rgba(0,0,0,.9), 0 0 60px rgba(0,0,0,.8); }
#lude .line span.in { opacity:1; transform:none; }
#lude .line span em { color:#ffd9a0; font-style:normal; }
#lude .dest { font-family:var(--serif); font-size:13px; letter-spacing:.44em;
  text-indent:.44em; color:#e0b264; opacity:0; transition:opacity .8s ease;
  text-shadow:0 2px 10px rgba(0,0,0,.95); }
#lude .dest.in { opacity:1; }
#lude .skip { position:absolute; right:26px; bottom:22px; font-family:var(--serif);
  font-size:11px; letter-spacing:.26em; text-indent:.26em; color:#7d7160;
  border:1px solid #3b3227; border-radius:2px; padding:9px 16px 9px 18px;
  background:rgba(12,9,6,.6); cursor:pointer; opacity:0;
  transition:opacity .6s ease .9s, color .14s, border-color .14s, background .14s; }
#lude.on .skip { opacity:1; }
#lude .skip:hover { color:var(--ivory); border-color:var(--bronze); background:rgba(40,28,16,.8); }
`

const waves = (n = 7, step = 11) => Array.from({ length: n }, (_, i) =>
  `<div class="wave" style="top:${8 + i * step}%"></div>`).join('')

const SHIP = cls => `<svg class="ship ${cls}" viewBox="0 0 118 64" fill="none">
  <path d="M8 46 h102 l-12 12 H20 z" fill="#0a0e18" stroke="#3b4a68" stroke-width="1.2"/>
  <path d="M59 6 v40" stroke="#3b4a68" stroke-width="2"/>
  <path d="M59 10 q26 10 0 26 z" fill="#131a2a" stroke="#4a5c80" stroke-width="1.2"/>
  <path d="M59 12 q-22 9 0 22 z" fill="#0e1422" stroke="#3b4a68" stroke-width="1"/>
</svg>`

const seaLike = (name, extra = '') => () => `<div class="scene ${name}">
  <div class="sky"></div><div class="orb"></div>
  <div class="water">${waves()}</div>
  <div class="horizon"></div>${extra}${SHIP('')}
</div>`

/** 판마다 다른 뱃길. 이름은 stages.js 의 interludeFor 가 정한다. */
const SCENES = {
  sea: seaLike('sea'),
  dawn: seaLike('dawn', '<div class="glare"></div>'),
  storm: () => `<div class="scene storm">
    <div class="sky"></div>
    <div class="water">${waves(9, 9)}</div>
    <div class="horizon"></div>${SHIP('toss')}
    <div class="flash"></div>
  </div>`,
  fire: () => `<div class="scene fire">${Array.from({ length: 40 }, () => {
    const l = Math.random() * 100, d = (Math.random() * 8).toFixed(1), s = (6 + Math.random() * 6).toFixed(1)
    return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;animation:ashUp ${s}s linear ${d}s infinite"></i>`
  }).join('')}</div>`,
  ashdawn: () => `<div class="scene ashdawn">
    <div class="orb"></div>
    <div class="water">${waves(6, 12)}</div>
    <div class="horizon"></div>${SHIP('')}
    ${Array.from({ length: 26 }, () => {
      const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
      return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;background:#c9bcd8;animation:ashUp ${s}s linear ${d}s infinite"></i>`
    }).join('')}
  </div>`,
  whirl: () => `<div class="scene whirl">
    ${Array.from({ length: 7 }, (_, i) => {
      const r = 90 + i * 74
      return `<div class="ring" style="width:${r}px;height:${Math.round(r * 0.34)}px"></div>`
    }).join('')}
    <div class="eye"></div>${SHIP('toss')}
  </div>`,
  landfall: seaLike('landfall', '<div class="land"></div>'),
  under: () => `<div class="scene under">${Array.from({ length: 30 }, () => {
    const l = Math.random() * 100, d = (Math.random() * 9).toFixed(1), s = (7 + Math.random() * 7).toFixed(1)
    return `<i class="ember" style="left:${l.toFixed(1)}%;bottom:-6px;background:#b49ce8;animation:ashUp ${s}s linear ${d}s infinite"></i>`
  }).join('')}</div>`,
  night: () => `<div class="scene night">
    <div class="orb"></div>
    ${[8, 21, 79, 92].map(l => `<div class="col" style="left:${l}%"></div>`).join('')}
  </div>`,
}

export class Interlude {
  constructor(root) {
    installTheme()
    const st = document.createElement('style')
    st.textContent = CSS
    document.head.appendChild(st)
    this.el = document.createElement('div')
    this.el.id = 'lude'
    root.appendChild(this.el)
    this._pre = new Set()
    // 액자는 모든 막간이 쓴다. 지금 받아 두면 첫 막간에서 디코딩을 안 기다린다.
    this.preload(['/img/frame.webp?v=4'])
  }

  /**
   * 미리 받아 둔다.
   *
   * 그림을 막간이 열릴 때 받으면, 네트워크는 빨라도(로컬 4ms) **디코딩이
   * 메인 스레드에서** 일어난다. 하필 그 순간이 액자·조명·먼지가 한꺼번에
   * 올라오는 때라 눈에 띄게 버벅인다. 화면이 조용할 때 미리 풀어 둔다.
   */
  preload(urls) {
    for (const u of urls) {
      if (!u || this._pre.has(u)) continue
      this._pre.add(u)
      const img = new Image()
      img.decoding = 'async'
      img.src = u
      img.decode?.().catch(() => {})
    }
  }

  /**
   * @param o.lines   한 줄씩 뜰 글. 각 { text, hold }
   * @param o.dest    아래에 작게 뜨는 목적지 (선택)
   * @param o.scene   SCENES 의 이름 — sea·dawn·storm·fire·ashdawn·whirl·landfall·night
   * @param o.art      액자에 넣을 그림. 한 장이면 문자열, 글줄마다 갈려면 배열.
   *                    없거나 못 불러오면 조용히 CSS 장면이 남는다
   * @param o.figure    true 면 오려 낸 인물로 본다 — 꽉 채우지 않고 액자 안에 세운다
   * @param o.wear      액자가 얼마나 낡았는지. 0 = 갓 건 것, 1 = 스무 해 걸려 있던 것
   */
  /** 막이 내려온 뒤에 닫는다 — 곧바로 닫으면 그 틈으로 지난 판이 보인다. */
  close() {
    this.el.classList.remove('on', 'lit')
    document.body.style.cursor = ''
  }

  play({ lines, dest, scene = 'sea', art = null, figure = false, wear = 0, keepOpen = false }) {
    return new Promise(resolve => {
      const timers0 = []
      const arts = art ? (Array.isArray(art) ? art : [art]) : []
      const back = (SCENES[scene] ? SCENES[scene]() : SCENES.sea()) + '<div class="scrim"></div>'
      // 액자 하나에 그림 하나. 벽에 나란히 걸어 두고 통째로 옆으로 민다.
      const wall = arts.map((src, i) => `
        <div class="slot${i === 0 ? ' here' : ''}">
          <div class="frame">
            <div class="pane">
              <div class="plate-img${figure ? ' fig' : ''}" data-i="${i}" data-src="${src}"></div>
            </div>
          </div>
        </div>`).join('')

      // 빛기둥 속 먼지. 자리도 속도도 제각각이어야 공기처럼 보인다 —
      // 줄 맞춰 떨어지면 비가 된다.
      const motes = Array.from({ length: 22 }, () => {
        const l = (18 + Math.random() * 64).toFixed(1)
        const t = (Math.random() * 62).toFixed(1)
        const dur = (7 + Math.random() * 9).toFixed(1)
        const delay = (-Math.random() * 12).toFixed(1)
        const dx = (Math.random() * 26 - 13).toFixed(0)
        return `<i style="left:${l}%;top:${t}%;--dx:${dx}px;animation-duration:${dur}s;animation-delay:${delay}s"></i>`
      }).join('')

      // 조명 한 벌. 미끄러지는 벽 밖에 둔다 — 등은 천장에 박혀 있다.
      const lights = `
        <div class="glowwall"></div>
        <div class="lamp"><span class="halo"></span><span class="core"></span><span class="motes">${motes}</span></div>
        <div class="fixture"></div>`

      this.el.innerHTML = `${back}
        ${arts.length ? `<div class="hall"><div class="wall">${wall}</div>${lights}</div>` : ''}
        <div class="plate">
          <div class="band"></div>
          <div class="line"><span></span></div>
          ${dest ? `<div class="dest">${dest}</div>` : ''}
          <div class="band"></div>
        </div>
        <button class="skip" type="button">SKIP</button>`
      this.el.classList.remove('dim')
      // 액자가 얼마나 낡았는지. CSS 가 이 하나로 금박·때·니스를 같이 민다
      this.el.style.setProperty('--wear', String(Math.min(1, Math.max(0, wear))))
      this.el.style.setProperty('--on-delay', '.25s')
      this.el.classList.add('on')
      // 조명은 한 박자 늦게 켠다 — 어둠이 먼저 있어야 켜지는 게 보인다
      timers0.push(setTimeout(() => this.el.classList.add('lit'), 520))
      document.body.style.cursor = 'default'

      // 그림은 받아지고 나서야 붙인다. 없는 파일이면 CSS 장면 그대로 간다.
      const plates = [...this.el.querySelectorAll('.plate-img')]
      for (const el of plates) {
        const probe = new Image()
        probe.onload = () => {
          el.style.backgroundImage = `url("${el.dataset.src}")`
          el.dataset.ready = '1'
          el.classList.add('in')
        }
        // 못 받은 칸은 빈 채로 둔다. 지우면 뒤 칸들이 앞으로 당겨져 순서가 어긋난다.
        probe.onerror = () => el.classList.add('in')
        probe.src = el.dataset.src
      }
      /** n번째 액자 앞으로 옮겨 간다. 없는 번호면 마지막 그림 앞에 선다.
          조명도 같이 옮긴다 — 켜져 있는 건 서 있는 자리 하나뿐이다. */
      const wallEl = this.el.querySelector('.wall')
      const slots = [...this.el.querySelectorAll('.slot')]
      let moved = false
      const showPlate = n => {
        if (!slots.length) return
        const i = Math.min(n, slots.length - 1)
        // 처음 켤 때는 곧바로 밝아져야 한다 — 어둠 속에서 한참 기다리게 되면
        // 조명이 켜지는 게 아니라 로딩이 걸린 것처럼 보인다.
        // 옆으로 옮겨 가기 시작한 뒤부터 '늦게 밝아지는' 값을 쓴다.
        if (i > 0 && !moved) {
          moved = true
          this.el.style.setProperty('--on-delay', '1.19s')
        }
        slots.forEach((el, k) => el.classList.toggle('here', k === i))
        if (wallEl && slots.length > 1) wallEl.style.transform = `translateX(${-i * 100}%)`
      }

      const span = this.el.querySelector('.line span')
      const destEl = this.el.querySelector('.dest')
      const timers = timers0
      let done = false

      const finish = () => {
        if (done) return
        done = true
        timers.forEach(clearTimeout)
        removeEventListener('keydown', skip)
        // keepOpen 이면 화면을 켠 채로 넘긴다. 다음 판의 막이 내려온 뒤 close() 가 닫는다.
        this.el.classList.remove('lit')
        if (!keepOpen) this.close()
        resolve()
      }
      const skip = e => {
        // 이동·공격 키로 실수로 넘기지 않게 — Esc 와 건너뛰기 단추만 받는다
        if (e && e.code !== 'Escape') return
        finish()
      }
      this.el.querySelector('.skip')?.addEventListener('click', () => finish())
      timers.push(setTimeout(() => addEventListener('keydown', skip), 500))

      let t = 350
      lines.forEach((l, i) => {
        timers.push(setTimeout(() => {
          span.classList.remove('in')
          showPlate(i)                 // 글이 바뀌기 조금 전에 그림부터 넘어간다
          timers.push(setTimeout(() => { span.innerHTML = l.text; span.classList.add('in') }, 320))
        }, t))
        t += (l.hold ?? 2600)
      })
      if (destEl) timers.push(setTimeout(() => destEl.classList.add('in'), Math.max(600, t - 1400)))
      // 마지막 글줄을 한 번 접고 나간다. 그대로 끊으면 읽다 만 것처럼 남는다.
      const plate = this.el.querySelector('.plate')
      // 마지막에는 조명이 먼저 꺼진다
      timers.push(setTimeout(() => {
        plate?.classList.add('out')
        this.el.classList.remove('lit')
        this.el.classList.add('dim')
      }, t + 200))
      timers.push(setTimeout(finish, t + 1300))
    })
  }
}
