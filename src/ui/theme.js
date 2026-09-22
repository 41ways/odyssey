/**
 * 화면 전체의 결 — 청동(靑銅).
 *
 * 두들겨 편 금속판에 새긴 글자. 획 굵기 대비가 크고 빛을 받는 면이 살아 있다.
 * 바탕은 그을린 쇠, 글자는 상아, 강조는 금 하나. 색을 더 늘리지 않는다.
 *
 * 글꼴 — 전에는 Bodoni Moda·Playfair Display(둘 다 패션지 쪽 디도네)를
 * 썼는데, 그리스 신화보다는 보그(Vogue) 표지에 가까운 결이었다.
 * 제목은 Cinzel(로마·그리스 비문에서 그대로 뜬 대문자꼴 — 코롭게, 갓
 * 오브 워, 300 류가 즐겨 쓰는 바로 그 글꼴)로, 영문 본문·카드는
 * Cormorant Garamond(오래된 인문주의 활자, Cinzel과 흔히 짝지어 쓰는
 * 조합)로 바꿨다. 한글은 송명(붓글씨 느낌, 획이 가늘다)에서 Hahmlet
 * 으로 — 두 서체 다 한글·라틴을 같이 그리는데, 획이 Cinzel·Cormorant
 * 쪽에 더 가까워 제목과 한 화면에 있을 때 덜 따로 논다. 시안을 여러
 * 벌 만들어 보여 주고 고른 것 (2026-09-22).
 */

export const PALETTE = {
  ground: '#14120f',     // 그을린 쇠
  ground2: '#1b1813',
  plate: '#2e2a22',      // 들린 판
  plateLip: '#3a3529',
  line: '#6b5628',       // 판 테두리
  lineDim: '#453820',
  gold: '#e8c884',       // 빛 받는 면
  goldDim: '#a08549',
  ivory: '#f0dcae',      // 글자
  text: '#d9c69c',
  textDim: '#8a7749',
  blood: '#a8322a',
  aegean: '#5f8fa0',     // 차가운 강조 — 아주 아껴 쓴다
}

/** 뇌문 한 마디. 가로로 반복해서 띠를 만든다. */
export const meanderURI = (color = PALETTE.gold, opacity = 0.9) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="14" viewBox="0 0 28 14">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2" stroke-linecap="square">
      <path d="M0 13 V3 H10 V9 H4 V7 H8"/>
      <path d="M14 1 V11 H24 V5 H18 V7 H22"/>
      <path d="M28 13 V3"/>
    </g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

/** 월계관 반쪽. 제목 양옆에 세운다. */
export const laurelURI = (color = PALETTE.gold) => {
  const leaves = Array.from({ length: 8 }, (_, i) => {
    const t = i / 7
    const x = 21 - t * 15, y = 3 + t * 54
    const rot = -32 - t * 24
    return `<ellipse cx="${x}" cy="${y}" rx="9" ry="3.8" fill="${color}" fill-opacity="${0.4 + t * 0.4}" transform="rotate(${rot} ${x} ${y})"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="62" viewBox="0 0 26 62">
    <path d="M23 1 Q3 30 8 61" fill="none" stroke="${color}" stroke-opacity="0.75" stroke-width="1.7"/>
    ${leaves}</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

/** 리벳 — 판을 고정한 못. 모서리에 박는다. */
export const rivet = (color = PALETTE.gold) =>
  `radial-gradient(circle, ${color}cc 0%, ${color}55 42%, transparent 62%)`

/** 모든 화면이 같이 쓰는 뼈대. 한 번만 넣는다. */
export function installTheme() {
  if (document.getElementById('odyssey-theme')) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2'
    + '?family=Cinzel:wght@400;500;600;700;800'
    + '&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500'
    + '&family=Hahmlet:wght@400;500;600;700'
    + '&display=swap'
  document.head.appendChild(link)

  const st = document.createElement('style')
  st.id = 'odyssey-theme'
  st.textContent = `
:root {
  --ground:${PALETTE.ground}; --ground2:${PALETTE.ground2};
  --plate:${PALETTE.plate}; --plate-lip:${PALETTE.plateLip};
  --line:${PALETTE.line}; --line-dim:${PALETTE.lineDim};
  --gold:${PALETTE.gold}; --gold-dim:${PALETTE.goldDim};
  --ivory:${PALETTE.ivory}; --text:${PALETTE.text}; --text-dim:${PALETTE.textDim};
  --blood:${PALETTE.blood}; --aegean:${PALETTE.aegean};

  /* 옛 이름 — 아직 쓰는 화면이 있어 남겨 둔다 */
  --ink:${PALETTE.ground}; --clay:#7a3a20; --clay-dim:#3d1c10;
  --ivory-dim:${PALETTE.textDim}; --bronze:${PALETTE.gold};

  --serif:'Cormorant Garamond','Hahmlet',"Apple SD Gothic Neo",serif;
  /* 제목 한 줄만 — 로마·그리스 비문 대문자꼴. 크게 뽑을수록 산다 */
  --display:'Cinzel','Cormorant Garamond','Hahmlet',serif;
  --body:'Hahmlet',"Apple SD Gothic Neo",serif;
}

/* 뇌문 띠 */
.meander {
  height:14px; background-image:${meanderURI()}; background-repeat:repeat-x;
  background-position:center; opacity:.5;
}
.meander.thin { opacity:.28; }

/* 청동판 — 위쪽 모서리에 빛이 걸리고 아래로 그늘진다 */
.pot-frame {
  border:1px solid var(--line);
  border-radius:3px;
  background:linear-gradient(180deg, var(--plate) 0%, ${PALETTE.ground2} 62%, ${PALETTE.ground} 100%);
  box-shadow:
    inset 0 1px 0 rgba(232,200,132,.22),
    inset 0 0 0 1px rgba(232,200,132,.08),
    0 18px 48px rgba(0,0,0,.62);
}
/* 네 모서리의 리벳 */
.riveted { position:relative; }
.riveted::before, .riveted::after {
  content:''; position:absolute; width:7px; height:7px; top:8px;
  background:${rivet()}; pointer-events:none;
}
.riveted::before { left:8px; }
.riveted::after { right:8px; }
`
  document.head.appendChild(st)
}
