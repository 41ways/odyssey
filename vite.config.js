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

export default {
  plugins: [shotEndpoint()],
  server: { port: 5180, strictPort: false },
  build: { target: 'es2022', outDir: 'dist' },
}
