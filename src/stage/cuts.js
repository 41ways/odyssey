/**
 * 컷신 — 그림 몇 장으로 시간을 만든다.
 *
 * 영상을 흉내내지 않는다. 만화가 칸 사이에서 시간을 만드는 것처럼, 그림
 * 두세 장을 겹쳐 넘기면서 그 사이에 이야기를 넣는다 (ui/reel.js 가 그린다).
 *
 * ── 액자(interlude)와 무엇이 다른가 ──
 * 액자는 "지나온 뱃길을 박물관처럼 돌아보는" 장치다. 테두리가 있고, 낡고,
 * 이미 끝난 일이다. 컷신은 **지금 눈앞에서 벌어지는 일**이다. 테두리가 없고
 * 화면을 꽉 채우고 불티가 날린다.
 *
 * 그래서 쓰는 자리가 다르다 —
 *   판과 판 사이의 뱃길        → 액자
 *   무언가가 지금 일어나는 순간 → 컷신
 *
 * hold 는 그 장이 머무는 시간(ms)이다. 1.6~2.2초가 "넘어간다" 는 느낌의
 * 하한이다. 1초보다 짧으면 읽기 전에 넘어가서 슬라이드쇼가 되고,
 * 3초보다 길면 정지 화면으로 돌아간다.
 */

/** 트로이가 불탄다. 게임이 시작되는 이유. */
export const CUT_TROY = {
  mood: 'fire',
  where: '트로이 — 열 해째',
  shots: [
    { art: '/img/lude-opening.webp', hold: 2100,
      text: '십 년이 걸렸다. <em>트로이가 불탔다.</em>' },
    { art: '/img/lude-opening-b.webp', hold: 2100,
      text: '열두 척으로 떠났다.<br>집까지는 며칠이면 되는 거리였다.' },
    { art: '/img/lude-opening-c.webp', hold: 2400,
      text: '바다가 <em>스무 해</em>를 붙들었다.' },
  ],
}

/**
 * 폴리페모스가 동굴 문을 닫는다.
 *
 * 보스를 만나는 순간을 현판 한 장으로 넘기면 "갑자기 거인이 서 있다" 가 된다.
 * 갇혔다는 게 먼저 와야 그 뒤의 싸움이 도망이 아니라 파훼가 된다.
 */
export const CUT_CAVE = {
  mood: 'stone',
  where: '폴리페모스의 동굴',
  shots: [
    { art: '/img/lude-ismaros.webp', hold: 1800,
      text: '동굴에는 양 떼와 치즈가 있었다. 주인은 없었다.' },
    { art: '/img/lude-ismaros-b.webp', hold: 2000,
      text: '돌아온 것이 <em>바위로 문을 막았다.</em><br>스무 명이 밀어도 꼼짝하지 않는 바위였다.' },
    { art: '/img/boss/polyphemos.webp', hold: 2300,
      text: '그것이 우리를 세어 보았다.' },
  ],
}

/** 저승 — 피를 붓기 전. 손이 올라오는 것은 이 다음이다 (ui/reach.js). */
export const CUT_UNDER = {
  mood: 'under',
  where: '저승 — 해가 들지 않는 곳',
  shots: [
    { art: '/img/lude-underworld.webp', hold: 2000,
      text: '바다 끝에 해가 들지 않는 곳이 있었다.' },
    { art: '/img/rise/rise-agamemnon-1.webp', hold: 2200,
      text: '구덩이를 파고 <em>피를 부으라</em> 했다.<br>그러면 망자가 말을 한다고.' },
  ],
}

/** 소용돌이가 돈다. 갈림길을 고르기 전에 무엇을 고르는지 보여 준다. */
export const CUT_WHIRL = {
  mood: 'water',
  where: '메시나 해협',
  shots: [
    { art: '/img/lude-messina.webp', hold: 1900,
      text: '해협이 좁아진다. 양쪽 다 무사하지 않다.' },
    { art: '/img/lude-messina-b.webp', hold: 2000,
      text: '한쪽은 절벽, 한쪽은 <em>바다가 통째로 도는 자리.</em>' },
    { art: '/img/boss/charybdis.webp', hold: 2200,
      text: '여섯을 잃을 것인가, 배를 잃을 것인가.' },
  ],
}

/** 이타카가 보인다. 스무 해 만에. */
export const CUT_ITHACA = {
  mood: 'stone',
  where: '이타카 — 스무 해 만에',
  shots: [
    { art: '/img/lude-ithaca.webp', hold: 2000,
      text: '이십 년 만에 <em>이타카</em>가 보였다.' },
    { art: '/img/lude-ithaca-b.webp', hold: 2100,
      text: '홀에서는 잔치가 벌어지고 있었다.<br>내 것으로.' },
    { art: '/img/boss/antinoos.webp', hold: 2300,
      text: '거지 차림으로 들어간다. <em>아직은.</em>' },
  ],
}

/** 컷신마다 쓰는 그림. 미리 받아 두려고 한 군데 모아 둔다. */
export const ALL_CUTS = [CUT_TROY, CUT_CAVE, CUT_UNDER, CUT_WHIRL, CUT_ITHACA]

export const cutArt = cut => (cut?.shots ?? []).map(s => s.art).filter(Boolean)
