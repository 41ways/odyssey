/**
 * 받침을 보고 조사를 고른다.
 *
 * "안티파테스을(를) 눕힌다", "에우릴로코스이(가) 쓰러졌다" 가 화면에 그대로
 * 떴다. 괄호 조사는 서류의 어법이지 이야기의 어법이 아니다 — 한 줄짜리
 * 화면 글에서는 그 괄호 하나가 "사람이 안 쓴 문장" 으로 읽힌다.
 *
 * 한글 음절은 코드값이 (초성·중성·종성) 순서로 쌓여 있어서, 0xAC00 을 뺀
 * 나머지를 28 로 나눈 나머지가 곧 받침이다. 0 이면 받침이 없다.
 * 한글이 아닌 글자로 끝나면(숫자·라틴) 받침 없는 쪽으로 보낸다 — 이름이
 * 전부 한글이라 그 경우가 오면 어차피 어느 쪽도 정답이 아니다.
 */
export function josa(word, withJong, withoutJong) {
  const s = String(word ?? '').trim()
  if (!s) return withoutJong
  const c = s.charCodeAt(s.length - 1)
  if (!(c >= 0xac00 && c <= 0xd7a3)) return withoutJong
  return (c - 0xac00) % 28 ? withJong : withoutJong
}

/** 자주 쓰는 짝들 */
export const eulReul = w => josa(w, '을', '를')
export const iGa = w => josa(w, '이', '가')
export const eunNeun = w => josa(w, '은', '는')
export const gwaWa = w => josa(w, '과', '와')
