import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Dev-only bridge to video-fx (see PLAN.md Phase 2). Serves the engine's work and
 * renders folders read-only under /work/ and /renders/, lists directories as JSON,
 * and accepts PUT of exactly one file kind, an anchors.json inside work/, so the page's
 * Save lands where `vidfx track` reads it. Local machine only; never part of a build.
 *
 *   VIDFX_ROOT=~/src/ops/creative/video-fx   (default)
 */
function vidfxBridge(): Plugin {
  const ROOT = (process.env.VIDFX_ROOT ?? path.join(os.homedir(), 'src/ops/creative/video-fx')).replace(/^~/, os.homedir())
  const MOUNTS: Record<string, string> = { '/work/': path.join(ROOT, 'work'), '/renders/': path.join(ROOT, 'renders') }
  const TYPES: Record<string, string> = { '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.yaml': 'text/yaml', '.npy': 'application/octet-stream', '.txt': 'text/plain' }
  return {
    name: 'vidfx-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const mount = Object.keys(MOUNTS).find((m) => url.startsWith(m))
        if (!mount) return next()
        const base = MOUNTS[mount]
        const file = path.normalize(path.join(base, decodeURIComponent(url.slice(mount.length))))
        if (!file.startsWith(base)) { res.statusCode = 403; return res.end('outside mount') }

        if (req.method === 'PUT') {
          if (mount !== '/work/' || !file.endsWith('anchors.json')) { res.statusCode = 405; return res.end('only work/**/anchors.json is writable') }
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            try { JSON.parse(body) } catch { res.statusCode = 400; return res.end('not JSON') }
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, body)
            res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, path: file, bytes: body.length }))
          })
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end() }
        if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found') }
        const st = fs.statSync(file)
        if (st.isDirectory()) {
          const entries = fs.readdirSync(file).filter((n) => !n.startsWith('.')).sort()
            .map((n) => { const s = fs.statSync(path.join(file, n)); return { name: n, dir: s.isDirectory(), size: s.size, mtime: s.mtimeMs } })
          res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(entries))
        }
        res.setHeader('content-type', TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
        res.setHeader('cache-control', 'no-store')
        if (req.method === 'HEAD') return res.end()
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig({ plugins: [react(), vidfxBridge()], server: { port: 5181, strictPort: true } })
