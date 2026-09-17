/**
 * 화면 전체의 결.
 *
 * 흑색상 도기(black-figure pottery) 를 기준으로 잡았다 — 테라코타 바탕에 흑색과 상아색,
 * 테두리는 뇌문(그리스 키 무늬). 금은 아껴 쓴다. 다 금칠하면 도기가 아니라 트로피가 된다.
 */

export const PALETTE = {
  ink: '#140f0b',        // 흑색 — 도기의 검은 부분
  clay: '#8c3a24',       // 테라코타
  clayDim: '#4a1f14',
  ivory: '#ead9bb',      // 상아 — 글자색
  ivoryDim: '#9c8e77',
  bronze: '#c8973e',
  aegean: '#3d7f8c',     // 에게해 청록 — 차가운 강조
  blood: '#a8322a',
}

/** 뇌문 한 마디. 가로로 반복해서 띠를 만든다. */
export const meanderURI = (color = '#c8973e', opacity = 0.85) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="14" viewBox="0 0 28 14">
    <g fill="none" stroke="${color}" stroke-opacity="${opacity}" stroke-width="2" stroke-linecap="square">
      <path d="M0 13 V3 H10 V9 H4 V7 H8"/>
      <path d="M14 1 V11 H24 V5 H18 V7 H22"/>
      <path d="M28 13 V3"/>
    </g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

/** 월계관 반쪽. 제목 양옆에 세운다. */
export const laurelURI = (color = '#c8973e') => {
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6
    const x = 20 - t * 14, y = 4 + t * 52
    const rot = -30 - t * 26
    return `<ellipse cx="${x}" cy="${y}" rx="8.5" ry="3.6" fill="${color}" fill-opacity="${0.35 + t * 0.4}" transform="rotate(${rot} ${x} ${y})"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="62" viewBox="0 0 26 62">
    <path d="M22 2 Q4 30 8 60" fill="none" stroke="${color}" stroke-opacity="0.7" stroke-width="1.6"/>
    ${leaves}</svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

/** 모든 화면이 같이 쓰는 뼈대. 한 번만 넣는다. */
export function installTheme() {
  if (document.getElementById('odyssey-theme')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Gowun+Batang:wght@400;700&display=swap'
  document.head.appendChild(link)

  const st = document.createElement('style')
  st.id = 'odyssey-theme'
  st.textContent = `
:root {
  --ink:${PALETTE.ink}; --clay:${PALETTE.clay}; --clay-dim:${PALETTE.clayDim};
  --ivory:${PALETTE.ivory}; --ivory-dim:${PALETTE.ivoryDim};
  --bronze:${PALETTE.bronze}; --aegean:${PALETTE.aegean}; --blood:${PALETTE.blood};
  --serif:'Cinzel','Gowun Batang',"Apple SD Gothic Neo",serif;
  --body:'Gowun Batang',"Apple SD Gothic Neo",serif;
}
.meander {
  height:14px; background-image:${meanderURI()}; background-repeat:repeat-x;
  background-position:center; opacity:.55;
}
.meander.thin { height:14px; opacity:.32; }
/* 도기 테두리 — 얇은 청동선 두 줄 사이에 뇌문 */
.pot-frame {
  border:1px solid #4a3623;
  box-shadow:inset 0 0 0 1px rgba(200,151,62,.18), 0 18px 48px rgba(0,0,0,.6);
  background:
    linear-gradient(180deg, rgba(34,24,16,.97), rgba(18,13,9,.98));
}
`
  document.head.appendChild(st)
}
