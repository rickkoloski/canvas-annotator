import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

/**
 * Dev-only bridge to video-fx (PLAN.md Phase 2, tranche 1.1 + 1.5). Local machine only;
 * never part of a build.
 *   GET  /work/** , /renders/**   files (with HTTP Range, so <video> can seek) and dir listings as JSON
 *   PUT  /work/<shot>/anchors.json  the page's Save (only this file kind is writable)
 *   POST /vidfx/run  {cmd, shot, args?}  runs an allow-listed vidfx command on a shot file and
 *                                        streams its output; the page is the operator console
 *   VIDFX_ROOT=~/src/ops/creative/video-fx   (default)
 */
function vidfxBridge(): Plugin {
  const ROOT = (process.env.VIDFX_ROOT ?? path.join(os.homedir(), 'src/ops/creative/video-fx')).replace(/^~/, os.homedir())
  const VIDFX = path.join(ROOT, '.venv/bin/vidfx')
  const MOUNTS: Record<string, string> = { '/work/': path.join(ROOT, 'work'), '/renders/': path.join(ROOT, 'renders') }
  const TYPES: Record<string, string> = { '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.yaml': 'text/yaml', '.npy': 'application/octet-stream', '.txt': 'text/plain' }
  const CMDS = new Set(['probe', 'keyframes', 'track', 'crops', 'render', 'stills'])
  const SAFE_ARG = /^[-\w.,=:/]+$/   // no spaces, no shell metacharacters; spawn without a shell anyway
  const SAFE_SHOT = /^[\w.-]+$/
  const readBody = (req: import('node:http').IncomingMessage) => new Promise<string>((resolve) => { let b = ''; req.on('data', (c) => { b += c }); req.on('end', () => resolve(b)) })

  return {
    name: 'vidfx-bridge',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]

        // ── engine runner ──
        if (url === '/vidfx/run') {
          if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
          let body: { cmd?: string; shot?: string; args?: string[] }
          try { body = JSON.parse(await readBody(req)) } catch { res.statusCode = 400; return res.end('not JSON') }
          const { cmd, shot, args = [] } = body
          if (!cmd || !CMDS.has(cmd)) { res.statusCode = 400; return res.end(`cmd must be one of ${[...CMDS].join(', ')}`) }
          if (cmd !== 'probe' && !(shot && SAFE_SHOT.test(shot))) { res.statusCode = 400; return res.end('shot name required') }
          if (!Array.isArray(args) || !args.every((a) => typeof a === 'string' && SAFE_ARG.test(a))) { res.statusCode = 400; return res.end('bad args') }
          const argv = cmd === 'probe' ? args : [`shots/${shot}.yaml`, ...args]
          res.statusCode = 200; res.setHeader('content-type', 'text/plain; charset=utf-8'); res.setHeader('cache-control', 'no-store')
          res.write(`$ vidfx ${cmd} ${argv.join(' ')}\n`)
          const child = spawn(VIDFX, [cmd, ...argv], { cwd: ROOT })
          child.stdout.on('data', (d) => res.write(d)); child.stderr.on('data', (d) => res.write(d))
          child.on('close', (code) => res.end(`\nexit ${code}\n`))
          child.on('error', (e) => res.end(`\nerror ${e.message}\nexit 127\n`))
          req.on('close', () => { if (child.exitCode === null) child.kill() })
          return
        }

        // ── files ──
        const mount = Object.keys(MOUNTS).find((m) => url.startsWith(m))
        if (!mount) return next()
        const base = MOUNTS[mount]
        const file = path.normalize(path.join(base, decodeURIComponent(url.slice(mount.length))))
        if (!file.startsWith(base)) { res.statusCode = 403; return res.end('outside mount') }

        if (req.method === 'PUT') {
          if (mount !== '/work/' || !file.endsWith('anchors.json')) { res.statusCode = 405; return res.end('only work/**/anchors.json is writable') }
          const body = await readBody(req)
          try { JSON.parse(body) } catch { res.statusCode = 400; return res.end('not JSON') }
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, body)
          res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: true, path: file, bytes: body.length }))
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
        res.setHeader('accept-ranges', 'bytes')
        // HTTP Range (tranche 1.1): <video> seeking needs it
        const range = req.headers.range
        let start = 0, end = st.size - 1
        if (range) {
          const m = /^bytes=(\d*)-(\d*)$/.exec(range)
          if (!m) { res.statusCode = 416; res.setHeader('content-range', `bytes */${st.size}`); return res.end() }
          if (m[1]) start = Number(m[1]); if (m[2]) end = Number(m[2])
          if (!m[1] && m[2]) { start = Math.max(0, st.size - Number(m[2])); end = st.size - 1 }
          if (start > end || start >= st.size) { res.statusCode = 416; res.setHeader('content-range', `bytes */${st.size}`); return res.end() }
          end = Math.min(end, st.size - 1)
          res.statusCode = 206; res.setHeader('content-range', `bytes ${start}-${end}/${st.size}`)
        }
        res.setHeader('content-length', String(end - start + 1))
        if (req.method === 'HEAD') return res.end()
        fs.createReadStream(file, { start, end }).pipe(res)
      })
    },
  }
}

export default defineConfig({ plugins: [react(), vidfxBridge()], server: { port: 5181, strictPort: true } })
