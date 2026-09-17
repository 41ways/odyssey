/**
 * poly.pizza 에서 소품 모델을 받아 온다.
 *
 * 규칙 하나 — **CC0 만 받는다.** CC-BY 도 쓸 수는 있지만 출처를 화면 어딘가에
 * 계속 달고 다녀야 하고, 하나라도 빠뜨리면 라이선스 위반이 된다.
 * 공개 저장소라 그 위험을 지지 않는다.
 *
 * 받은 파일은 art/props/ 에 원본으로 두고, prep 단계에서 public/models/ 로 간다.
 * 출처는 art/props/CREDITS.md 에 남긴다 — CC0 라 의무는 없지만 만든 사람은 적어 둔다.
 *
 *   node tools/fetch-props.mjs 돼지=pig 배=galley ...
 *   node tools/fetch-props.mjs --list pig          # 후보만 보고 고르기
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'art/props')

const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function search(term) {
  const r = await fetch(`https://poly.pizza/search/${encodeURIComponent(term)}`)
  if (!r.ok) throw new Error(`검색 실패 ${r.status}`)
  const h = await r.text()
  return [...new Set([...h.matchAll(/href="\/m\/([A-Za-z0-9_-]+)"/g)].map(m => m[1]))]
}

async function detail(id) {
  const r = await fetch(`https://poly.pizza/m/${id}`)
  if (!r.ok) return null
  const h = await r.text()
  const glb = h.match(/https:\/\/static\.poly\.pizza\/[A-Za-z0-9_.-]+\.glb/)?.[0]
  if (!glb) return null
  const lic = /CC0/.test(h) ? 'CC0' : /CC-?\s?BY/.test(h) ? 'CC-BY' : '?'
  // 제목과 만든 사람은 og 메타에 있다
  const og = h.match(/property="og:title"\s+content="([^"]+)"/)?.[1] ?? id
  const by = h.match(/href="\/u\/([^"]+)"/)?.[1] ?? ''
  const tri = h.match(/([\d,]+)\s*(?:Triangles|triangles|tris)/)?.[1] ?? ''
  return { id, glb, lic, title: strip(og), by, tri }
}

const args = process.argv.slice(2)
if (args[0] === '--list') {
  const ids = await search(args[1])
  for (const id of ids.slice(0, 16)) {
    const d = await detail(id)
    if (d) console.log(`${d.lic.padEnd(6)} ${String(d.tri).padStart(8)}  ${d.title.padEnd(28)} @${d.by}  ${d.id}`)
  }
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
const credits = []
for (const a of args) {
  const [name, term] = a.split('=')
  if (!term) { console.error(`쓰기: 이름=검색어 (받은 것: ${a})`); continue }
  // 'id:xxxx' 면 그것 하나만, 아니면 검색해서 첫 CC0
  let got = null
  if (term.startsWith('id:')) {
    const d = await detail(term.slice(3))
    if (d?.lic === 'CC0') got = d
    else if (d) console.log(`✗ ${name} — CC0 가 아니다 (${d.lic})`)
  } else {
    const ids = await search(term)
    for (const id of ids.slice(0, 20)) {
      const d = await detail(id)
      if (d?.lic === 'CC0') { got = d; break }
    }
  }
  if (!got) { console.log(`✗ ${name} — '${term}' 에서 CC0 를 못 찾았다`); continue }
  const buf = Buffer.from(await (await fetch(got.glb)).arrayBuffer())
  fs.writeFileSync(path.join(OUT, `${name}.glb`), buf)
  console.log(`✔ ${name}.glb  ${Math.round(buf.length / 1024)} KB  ${got.title} @${got.by}`)
  credits.push(`- ${name}.glb — ${got.title} by ${got.by} (CC0) · https://poly.pizza/m/${got.id}`)
}

if (credits.length) {
  const f = path.join(OUT, 'CREDITS.md')
  const head = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '# 소품 출처\n\n전부 CC0. 의무는 없지만 만든 사람은 적어 둔다.\n'
  fs.writeFileSync(f, head.trimEnd() + '\n' + credits.join('\n') + '\n')
}
