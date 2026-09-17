import fs from 'node:fs'
import path from 'node:path'

/**
 * 개발 중 화면을 파일로 뽑는 통로.
 * 페이지에서 window.__shot('이름') 을 부르면 shots/ 에 png 가 떨어진다.
 * 3D 캔버스와 DOM(HUD) 을 한 장으로 합친다.
 */
const shotEndpoint = () => ({
  name: 'shot-endpoint',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        try {
          const { name, data } = JSON.parse(body)
          const dir = path.resolve(import.meta.dirname, 'shots')
          fs.mkdirSync(dir, { recursive: true })
          const safe = String(name).replace(/[^\w.-]/g, '_')
          fs.writeFileSync(path.join(dir, safe), Buffer.from(data.split(',')[1], 'base64'))
          res.end(JSON.stringify({ ok: true, file: safe }))
        } catch (err) {
          res.statusCode = 500
          res.end(String(err))
        }
      })
    })
  },
})

/**
 * 그림을 받아 두는 통로 — art/gen/ 으로 떨어진다.
 *
 * 컷신 그림은 제미나이에서 만든다. 그런데 브라우저의 내려받기는 같은 탭에서
 * 여러 장을 연달아 저장하려 들면 막히고, 막히면 사용자가 손으로 허용해 줘야
 * 한다. 그래서 내려받지 않고 **여기로 보낸다** — 페이지에서 캔버스로 읽어
 * data URL 로 만들어 POST 하면 끝이다.
 *
 * 개발 서버에만 붙는다 (configureServer). 빌드된 결과물에는 없다.
 * 다른 출처(gemini.google.com)에서 부르므로 CORS 를 열어 둔다 —
 * 열어도 되는 이유는 이 통로가 배포에 안 나가기 때문이다.
 */
const dropEndpoint = () => ({
  name: 'drop-endpoint',
  configureServer(server) {
    server.middlewares.use('/__drop', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      // https 페이지가 http://localhost 로 보내는 건 크롬이 '사설망 요청' 으로
      // 막는다 (Private Network Access). 서버가 이 한 줄로 받겠다고 말해야 통한다 —
      // 이게 없으면 원인이 CORS 처럼 보이는데 CORS 를 다 열어도 안 뚫린다.
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
      if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
      if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        try {
          const { name, data } = JSON.parse(body)
          const dir = path.resolve(import.meta.dirname, 'art', 'gen')
          fs.mkdirSync(dir, { recursive: true })
          const safe = String(name).replace(/[^\w.-]/g, '_')
          const buf = Buffer.from(data.split(',')[1], 'base64')
          fs.writeFileSync(path.join(dir, safe), buf)
          res.end(JSON.stringify({ ok: true, file: safe, bytes: buf.length }))
        } catch (err) {
          res.statusCode = 500
          res.end(String(err))
        }
      })
    })
  },
})

export default {
  plugins: [shotEndpoint(), dropEndpoint()],
  server: { port: 5180, strictPort: false },
  build: { target: 'es2022', outDir: 'dist' },
}
