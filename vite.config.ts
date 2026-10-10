import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn, spawnSync } from 'node:child_process'

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
 *   POST /projects/<name>/save-as {to}   copies project.json (renamed), media/, shots/ to projects/<to>/ (A2, Save As…)
 *   Media Bin (A3): POST /projects/<name>/media (raw body, x-filename) copies a file into media/ and records it in
 *   project.json; POST …/media/from-path {path, link} copies or links a file on this Mac; POST …/media/<id>/rename {to};
 *   DELETE …/media/<id>; GET …/media-info (exists, usedBy shots); GET …/thumb/<id> (ffmpeg first frame, cached in
 *   media/.thumbs/); GET …/media-file/<id> streams a linked file. Every write returns the project document.
 */
function vidfxBridge(): Plugin {
  const ROOT = (process.env.VIDFX_ROOT ?? path.join(os.homedir(), 'src/ops/creative/video-fx')).replace(/^~/, os.homedir())
  const VIDFX = path.join(ROOT, '.venv/bin/vidfx')
  const PROJECTS = (process.env.PROJECTS_ROOT ?? path.join(os.homedir(), 'src/ops/creative/projects')).replace(/^~/, os.homedir())
  const MOUNTS: Record<string, string> = { '/work/': path.join(ROOT, 'work'), '/renders/': path.join(ROOT, 'renders'), '/shots/': path.join(ROOT, 'shots'), '/projects/': PROJECTS }
  const SAFE_NAME = /^[A-Za-z0-9][\w.-]{0,63}$/
  const readProject = (name: string) => { try { return JSON.parse(fs.readFileSync(path.join(PROJECTS, name, 'project.json'), 'utf8')) } catch { return null } }
  const TYPES: Record<string, string> = { '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.yaml': 'text/yaml', '.npy': 'application/octet-stream', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.md': 'text/markdown' }
  const CMDS = new Set(['probe', 'keyframes', 'track', 'crops', 'render', 'stills', 'script', 'effects'])
  const SAFE_ARG = /^[-\w.,=:/]+$/   // no spaces, no shell metacharacters; spawn without a shell anyway
  const SAFE_SHOT = /^[\w.-]+$/
  const readBody = (req: import('node:http').IncomingMessage) => new Promise<string>((resolve) => { let b = ''; req.on('data', (c) => { b += c }); req.on('end', () => resolve(b)) })
  const readRaw = (req: import('node:http').IncomingMessage) => new Promise<Buffer>((resolve) => { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))) })
  const writeProject = (name: string, doc: unknown) => fs.writeFileSync(path.join(PROJECTS, name, 'project.json'), JSON.stringify(doc, null, 2))
  const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.bmp': 'image/bmp',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.json': 'application/json', '.pdf': 'application/pdf' }
  const SAFE_FILE = /^[\w][\w.+ -]{0,120}$/
  /** Facts about a media file: ffprobe for images/video/audio, the XML for an svg. */
  const probeMedia = (file: string) => {
    const ext = path.extname(file).toLowerCase(); const type = MIME[ext] ?? 'application/octet-stream'; const out: Record<string, unknown> = { type, size: fs.statSync(file).size }
    if (ext === '.svg') {
      const root = /<svg\b[^>]*>/i.exec(fs.readFileSync(file, 'utf8').slice(0, 4000))?.[0] ?? ''
      const a = (n: string) => { const m = new RegExp(`\\b${n}="([^"]+)"`).exec(root); return m && !m[1].includes('%') ? parseFloat(m[1]) : NaN }
      let w = a('width'), h = a('height'); const vb = /\bviewBox="([^"]+)"/.exec(root)
      if (!(w > 0 && h > 0) && vb) { const p = vb[1].trim().split(/[\s,]+/).map(Number); if (p.length === 4) { w = p[2]; h = p[3] } }
      if (w > 0 && h > 0) { out.width = Math.round(w); out.height = Math.round(h) }
      return out
    }
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf8' })
    try {
      const j = JSON.parse(r.stdout || '{}'); const st = j.streams?.[0]
      if (st?.width) { out.width = st.width; out.height = st.height }
      if (type.startsWith('video/')) { const [n, d] = String(st?.r_frame_rate ?? '0/1').split('/').map(Number); if (n && d) out.fps = +(n / d).toFixed(3); if (j.format?.duration) out.duration = +Number(j.format.duration).toFixed(2) }
    } catch { /* not probeable; keep type and size */ }
    return out
  }
  const uniqueName = (dir: string, base: string) => { const ext = path.extname(base); const stem = base.slice(0, base.length - ext.length); let n = base, i = 2; while (fs.existsSync(path.join(dir, n))) n = `${stem}-${i++}${ext}`; return n }
  const mediaPath = (project: string, m: { file: string }) => (path.isAbsolute(m.file) ? m.file : path.join(PROJECTS, project, m.file))
  const addMedia = (project: string, file: string, extra: Record<string, unknown>) => {
    const doc = readProject(project); const rel = path.isAbsolute(file) ? file : path.relative(path.join(PROJECTS, project), file)
    const base = path.basename(file); let id = base, i = 2; while ((doc.media ?? []).some((m: { id: string }) => m.id === id)) id = `${base}-${i++}`
    const item = { id, file: rel, added: new Date().toISOString(), ...probeMedia(file), ...extra }
    doc.media = [...(doc.media ?? []), item]; doc.modified = item.added; writeProject(project, doc); return doc
  }

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

        const saveAs = /^\/projects\/([A-Za-z0-9][\w.-]{0,63})\/save-as$/.exec(url)
        if (saveAs) {
          if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
          const from = saveAs[1]; const src = readProject(from)
          if (!src) { res.statusCode = 404; return res.end('unknown project') }
          let body: { to?: string }
          try { body = JSON.parse(await readBody(req)) } catch { res.statusCode = 400; return res.end('not JSON') }
          const to = body.to
          if (!to || !SAFE_NAME.test(to) || to === from) { res.statusCode = 400; return res.end('bad target name') }
          const dst = path.join(PROJECTS, to)
          if (fs.existsSync(dst)) { res.statusCode = 409; return res.end('project exists') }
          for (const d of ['media', 'shots', 'work', 'renders']) fs.mkdirSync(path.join(dst, d), { recursive: true })
          for (const d of ['media', 'shots']) { const sd = path.join(PROJECTS, from, d); if (fs.existsSync(sd)) fs.cpSync(sd, path.join(dst, d), { recursive: true }) }
          const doc = { ...src, name: to, created: new Date().toISOString(), modified: new Date().toISOString() }
          fs.writeFileSync(path.join(dst, 'project.json'), JSON.stringify(doc, null, 2))
          res.statusCode = 201; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(doc))
        }

        // ── Media Bin (A3) ──
        const mm = /^\/projects\/([A-Za-z0-9][\w.-]{0,63})\/(media|media-info|thumb|media-file)(?:\/([^/]+))?(?:\/(from-path|rename))?$/.exec(url)
        if (mm && !(mm[2] === 'media' && req.method === 'GET')) {
          const project = mm[1]; const doc = readProject(project)
          if (!doc) { res.statusCode = 404; return res.end('unknown project') }
          const mediaDir = path.join(PROJECTS, project, 'media'); fs.mkdirSync(mediaDir, { recursive: true })
          const id = mm[3] ? decodeURIComponent(mm[3]) : ''; const sub = mm[4]
          const find = () => (doc.media ?? []).find((m: { id: string }) => m.id === id)
          const sendDoc = (d: unknown, code = 200) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(d)) }
          if (mm[2] === 'media' && req.method === 'POST' && !mm[3]) {                                  // import (copy) an uploaded file
            const name = decodeURIComponent(String(req.headers['x-filename'] ?? '')); const base = path.basename(name)
            if (!SAFE_FILE.test(base)) { res.statusCode = 400; return res.end('bad file name') }
            const target = path.join(mediaDir, uniqueName(mediaDir, base)); fs.writeFileSync(target, await readRaw(req))
            return sendDoc(addMedia(project, target, { source: name }), 201)
          }
          if (mm[2] === 'media' && req.method === 'POST' && id === 'from-path' && !sub) {                // copy or link a file on this Mac
            let body: { path?: string; link?: boolean }
            try { body = JSON.parse(await readBody(req)) } catch { res.statusCode = 400; return res.end('not JSON') }
            const src = (body.path ?? '').replace(/^~(?=$|\/)/, os.homedir())
            if (!path.isAbsolute(src) || !fs.existsSync(src) || !fs.statSync(src).isFile()) { res.statusCode = 400; return res.end('path must be an existing file') }
            if (body.link) return sendDoc(addMedia(project, src, { source: src, linked: true }), 201)
            const target = path.join(mediaDir, uniqueName(mediaDir, path.basename(src))); fs.copyFileSync(src, target)
            return sendDoc(addMedia(project, target, { source: src }), 201)
          }
          if (mm[2] === 'media' && req.method === 'POST' && sub === 'rename') {
            let body: { to?: string }; try { body = JSON.parse(await readBody(req)) } catch { res.statusCode = 400; return res.end('not JSON') }
            const m = find(); const to = (body.to ?? '').trim()
            if (!m) { res.statusCode = 404; return res.end('no such media') }
            if (!SAFE_FILE.test(to) || (doc.media as { id: string }[]).some((x) => x.id === to)) { res.statusCode = 400; return res.end('bad or duplicate name') }
            m.id = to; doc.modified = new Date().toISOString(); writeProject(project, doc); return sendDoc(doc)
          }
          if (mm[2] === 'media' && req.method === 'DELETE' && mm[3] && !sub) {
            const m = find(); if (!m) { res.statusCode = 404; return res.end('no such media') }
            if (!m.linked) { const p = mediaPath(project, m); if (p.startsWith(mediaDir) && fs.existsSync(p)) fs.unlinkSync(p); const th = path.join(mediaDir, '.thumbs', `${m.id}.jpg`); if (fs.existsSync(th)) fs.unlinkSync(th) }
            doc.media = doc.media.filter((x: { id: string }) => x.id !== id); doc.modified = new Date().toISOString(); writeProject(project, doc); return sendDoc(doc)
          }
          if (mm[2] === 'media-info' && req.method === 'GET') {                                        // exists + usedBy (shot files that mention the basename)
            const shotsDir = path.join(PROJECTS, project, 'shots')
            const shots = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir).filter((n) => n.endsWith('.yaml')).map((n) => ({ name: n.replace(/\.yaml$/, ''), text: fs.readFileSync(path.join(shotsDir, n), 'utf8') })) : []
            const info: Record<string, unknown> = {}
            for (const m of doc.media ?? []) { const b = path.basename(m.file); info[m.id] = { exists: fs.existsSync(mediaPath(project, m)), usedBy: shots.filter((s) => s.text.includes(b)).map((s) => s.name) } }
            return sendDoc(info)
          }
          if ((mm[2] === 'thumb' || mm[2] === 'media-file') && req.method === 'GET' && mm[3]) {
            const m = find(); if (!m) { res.statusCode = 404; return res.end('no such media') }
            const src = mediaPath(project, m); if (!fs.existsSync(src)) { res.statusCode = 404; return res.end('missing') }
            let file = src
            if (mm[2] === 'thumb' && m.type !== 'image/svg+xml') {
              const tdir = path.join(mediaDir, '.thumbs'); fs.mkdirSync(tdir, { recursive: true }); file = path.join(tdir, `${m.id}.jpg`)
              if (!fs.existsSync(file) || fs.statSync(file).mtimeMs < fs.statSync(src).mtimeMs) {
                const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', m.duration ? String(Math.min(1, m.duration / 2)) : '0', '-i', src, '-frames:v', '1', '-vf', 'scale=320:-2', file])
                if (r.status !== 0 || !fs.existsSync(file)) { res.statusCode = 415; return res.end('no thumbnail for this type') }
              }
            }
            res.setHeader('content-type', TYPES[path.extname(file).toLowerCase()] ?? MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'); res.setHeader('cache-control', 'no-store')
            res.setHeader('content-length', String(fs.statSync(file).size)); return fs.createReadStream(file).pipe(res)
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
