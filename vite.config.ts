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
 *   PUT  /work/<shot>/anchors.json  the page's Save; PUT /shots/<name>.animation.md the exported script (only these two kinds are writable)
 *   GET  /shots/**                 read-only (shot files, exported scripts)
 *   POST /vidfx/run  {cmd, shot, args?}  runs an allow-listed vidfx command (incl. `script`) on a shot file and
 *                                        streams its output; the page is the operator console
 *   VIDFX_ROOT=~/src/ops/creative/video-fx   (default)
 *   Projects (app frame A1): PROJECTS_ROOT=~/src/ops/creative/projects; one directory per project
 *   (project.json, media/, shots/, work/, renders/).
 *   GET  /projects                 list [{name, modified, canvas, shots, media}]
 *   POST /projects {name, canvas}  create the directory + project.json (409 if it exists)
 *   GET  /projects/<name>/**       files and listings as above; PUT writable: project.json, work/**\/anchors.json, shots/*.animation.md
 *   POST /vidfx/run {project}      runs the command on projects/<name>/shots/<shot>.yaml
 */
function vidfxBridge(): Plugin {
  const ROOT = (process.env.VIDFX_ROOT ?? path.join(os.homedir(), 'src/ops/creative/video-fx')).replace(/^~/, os.homedir())
  const VIDFX = path.join(ROOT, '.venv/bin/vidfx')
  const PROJECTS = (process.env.PROJECTS_ROOT ?? path.join(os.homedir(), 'src/ops/creative/projects')).replace(/^~/, os.homedir())
  const MOUNTS: Record<string, string> = { '/work/': path.join(ROOT, 'work'), '/renders/': path.join(ROOT, 'renders'), '/shots/': path.join(ROOT, 'shots'), '/projects/': PROJECTS }
  const SAFE_NAME = /^[A-Za-z0-9][\w.-]{0,63}$/
  const readProject = (name: string) => { try { return JSON.parse(fs.readFileSync(path.join(PROJECTS, name, 'project.json'), 'utf8')) } catch { return null } }
  const TYPES: Record<string, string> = { '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.yaml': 'text/yaml', '.npy': 'application/octet-stream', '.txt': 'text/plain' }
  const CMDS = new Set(['probe', 'keyframes', 'track', 'crops', 'render', 'stills', 'script'])
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
          let body: { cmd?: string; shot?: string; args?: string[]; project?: string }
          try { body = JSON.parse(await readBody(req)) } catch { res.statusCode = 400; return res.end('not JSON') }
          const { cmd, shot, args = [], project } = body
          if (!cmd || !CMDS.has(cmd)) { res.statusCode = 400; return res.end(`cmd must be one of ${[...CMDS].join(', ')}`) }
          if (cmd !== 'probe' && !(shot && SAFE_SHOT.test(shot))) { res.statusCode = 400; return res.end('shot name required') }
          if (project !== undefined && !(typeof project === 'string' && SAFE_NAME.test(project) && readProject(project))) { res.statusCode = 400; return res.end('unknown project') }
          if (!Array.isArray(args) || !args.every((a) => typeof a === 'string' && SAFE_ARG.test(a))) { res.statusCode = 400; return res.end('bad args') }
          const shotFile = project ? path.join(PROJECTS, project, 'shots', `${shot}.yaml`) : `shots/${shot}.yaml`
          const argv = cmd === 'probe' ? args : [shotFile, ...args]
          res.statusCode = 200; res.setHeader('content-type', 'text/plain; charset=utf-8'); res.setHeader('cache-control', 'no-store')
          res.write(`$ vidfx ${cmd} ${argv.join(' ')}\n`)
          const child = spawn(VIDFX, [cmd, ...argv], { cwd: ROOT })
          child.stdout.on('data', (d) => res.write(d)); child.stderr.on('data', (d) => res.write(d))
          child.on('close', (code) => res.end(`\nexit ${code}\n`))
          child.on('error', (e) => res.end(`\nerror ${e.message}\nexit 127\n`))
          req.on('close', () => { if (child.exitCode === null) child.kill() })
          return
        }

        // ── projects (A1) ──
        if (url === '/projects') {
          if (req.method === 'GET') {
            fs.mkdirSync(PROJECTS, { recursive: true })
            const list = fs.readdirSync(PROJECTS).filter((n) => SAFE_NAME.test(n)).map((n) => ({ n, p: readProject(n) })).filter((x) => x.p)
              .map(({ n, p }) => ({ name: n, modified: p.modified ?? '', canvas: p.canvas, shots: (p.shots ?? []).length, media: (p.media ?? []).length }))
              .sort((a, b) => (a.modified < b.modified ? 1 : -1))
            res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(list))
          }
          if (req.method === 'POST') {
            let body: { name?: string; canvas?: { width: number; height: number; fps: number } }
            try { body = JSON.parse(await readBody(req)) } catch { res.statusCode = 400; return res.end('not JSON') }
            const { name, canvas = { width: 1920, height: 1080, fps: 25 } } = body
            if (!name || !SAFE_NAME.test(name)) { res.statusCode = 400; return res.end('bad project name') }
            if (![canvas.width, canvas.height, canvas.fps].every((n) => typeof n === 'number' && n > 0)) { res.statusCode = 400; return res.end('canvas needs width, height, fps') }
            const dir = path.join(PROJECTS, name)
            if (fs.existsSync(dir)) { res.statusCode = 409; return res.end('project exists') }
            for (const d of ['media', 'shots', 'work', 'renders']) fs.mkdirSync(path.join(dir, d), { recursive: true })
            const t = new Date().toISOString()
            const doc = { version: 1, name, created: t, modified: t, canvas, media: [], shots: [] }
            fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(doc, null, 2))
            res.statusCode = 201; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(doc))
          }
          res.statusCode = 405; return res.end()
        }

        // ── files ──
        const mount = Object.keys(MOUNTS).find((m) => url.startsWith(m))
        if (!mount) return next()
        const base = MOUNTS[mount]
        const file = path.normalize(path.join(base, decodeURIComponent(url.slice(mount.length))))
        if (!file.startsWith(base)) { res.statusCode = 403; return res.end('outside mount') }

        if (req.method === 'PUT') {
          const rel = path.relative(base, file)
          const inProject = mount === '/projects/' && /^[A-Za-z0-9][\w.-]{0,63}\//.test(rel) && readProject(rel.split('/')[0])
          const writable = (mount === '/work/' && file.endsWith('anchors.json')) || (mount === '/shots/' && file.endsWith('.animation.md'))
            || (inProject && (/^[^/]+\/project\.json$/.test(rel) || /^[^/]+\/work\/.*anchors\.json$/.test(rel) || /^[^/]+\/shots\/[^/]+\.animation\.md$/.test(rel)))
          if (!writable) { res.statusCode = 405; return res.end('only anchors.json under work/, shots/*.animation.md and a project\'s project.json are writable') }
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
