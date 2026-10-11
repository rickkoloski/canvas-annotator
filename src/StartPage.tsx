import { useEffect, useState } from 'react'
import { BrandMark } from './Brand'
import { bridgePaths, listProjects, pageUrl, readRecent, type ProjectDoc, type ProjectSummary } from './project'

/**
 * Start page (walk 4 P3, Rick 2026-10-11): Camtasia's Welcome window for us. Two states: no project → New / Open /
 * Recent; a project with nothing selected → the project home, its shots and animations as cards. The June vector
 * demo stays reachable from the header chips as the standalone tool, but it is no longer the landing.
 */
export const APP_NAME = 'PortableMind Creative Suite'

export function Welcome({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]); const recent = readRecent()
  useEffect(() => { listProjects().then(setProjects).catch(() => setProjects([])) }, [])
  const byName = Object.fromEntries(projects.map((p) => [p.name, p]))
  const rows = [...recent.filter((n) => byName[n]), ...projects.map((p) => p.name).filter((n) => !recent.includes(n))].slice(0, 8)
  return (
    <div data-testid="start-welcome" className="max-w-[920px] mx-auto pt-10">
      <div className="flex items-center gap-5 mb-8">
        <BrandMark className="w-20 h-20" />
        <div>
          <h2 className="font-ws-body text-3xl font-semibold text-ws-text-primary">{APP_NAME}</h2>
          <p className="text-ws-text-secondary mt-1">Projects, media, tracked effects and animations for PortableMind's videos.</p>
        </div>
      </div>
      <div className="flex gap-3 mb-8">
        <button data-testid="welcome-new" onClick={onNew} className="ann-btn !text-sm !px-4 !py-2 !text-[#1a0e07] !bg-[rgba(224,155,88,.85)]">New Project…</button>
        <button data-testid="welcome-open" onClick={onOpen} className="ann-btn !text-sm !px-4 !py-2">Open Project…</button>
      </div>
      <h3 className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage mb-2">Recent projects</h3>
      {rows.length === 0 && <p className="text-sm text-ws-text-tertiary">None yet. New Project… starts one: a folder with its media, shots and animations.</p>}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {rows.map((n) => { const p = byName[n]; return (
          <a key={n} data-testid={`welcome-recent-${n}`} href={pageUrl(n)} className="glass rounded-xl px-4 py-3 hover:border-ws-terracotta block">
            <div className="font-ws-mono text-sm text-ws-text-primary">{n}</div>
            <div className="font-ws-mono text-[0.65rem] text-ws-text-tertiary mt-1">{p ? `${p.canvas.width}×${p.canvas.height} · ${p.shots} shot${p.shots === 1 ? '' : 's'} · ${p.media} media · ${p.modified ? new Date(p.modified).toLocaleDateString() : ''}` : ''}</div>
          </a>) })}
      </div>
    </div>
  )
}

export function ProjectHome({ project, onNewShot, onNewAnimation }: { project: ProjectDoc; onNewShot: () => void; onNewAnimation: () => void }) {
  const paths = bridgePaths(project.name)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true; const out: Record<string, string> = {}
    const probe = async (key: string, url: string) => { try { const r = await fetch(url, { method: 'HEAD' }); if (r.ok) out[key] = url } catch { /* none */ } }
    Promise.all([
      ...project.shots.map((s) => probe(`shot:${s}`, `${paths.work(s)}/keyframes_sample/frame_0000.jpg`)),
      ...(project.animations ?? []).map((a) => probe(`anim:${a}`, `${paths.work(a)}/still_12.png`)),
    ]).then(() => { if (alive) setThumbs({ ...out }) })
    return () => { alive = false }
  }, [project.name, project.shots.length, project.animations?.length])   // eslint-disable-line react-hooks/exhaustive-deps
  const Card = ({ testid, href, title, sub, thumb }: { testid: string; href: string; title: string; sub: string; thumb?: string }) => (
    <a data-testid={testid} href={href} className="glass rounded-xl overflow-hidden hover:border-ws-terracotta block">
      <div className="bg-black/40 aspect-video flex items-center justify-center">{thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : <span className="font-ws-mono text-xs text-ws-text-tertiary">{sub}</span>}</div>
      <div className="px-3 py-2"><div className="font-ws-mono text-sm text-ws-text-primary truncate">{title}</div><div className="font-ws-mono text-[0.62rem] text-ws-text-tertiary">{sub}</div></div>
    </a>
  )
  return (
    <div data-testid="start-home" className="pt-2">
      <div className="flex items-center gap-4 mb-6">
        <BrandMark className="w-12 h-12" />
        <div><h2 className="font-ws-body text-2xl font-semibold text-ws-text-primary">{project.name}</h2>
          <p className="font-ws-mono text-xs text-ws-text-tertiary">{project.canvas.width}×{project.canvas.height} · {project.canvas.fps} fps · {project.media.length} media · the Media Bin is in the rail on the left</p></div>
      </div>
      <section className="mb-6">
        <div className="flex items-center gap-3 mb-2"><h3 className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">Shots <span className="text-ws-text-tertiary normal-case tracking-normal">· tracked composites on footage</span></h3><button data-testid="home-new-shot" onClick={onNewShot} className="ann-btn">New Shot…</button></div>
        {project.shots.length === 0 && <p className="text-sm text-ws-text-tertiary">None yet. A shot is a clip from the Media Bin with motion trackers and effects on it.</p>}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {project.shots.map((s) => <Card key={s} testid={`home-shot-${s}`} href={pageUrl(project.name, s)} title={s} sub="shot" thumb={thumbs[`shot:${s}`]} />)}
        </div>
      </section>
      <section>
        <div className="flex items-center gap-3 mb-2"><h3 className="font-ws-mono text-[0.6rem] tracking-[0.22em] uppercase text-ws-sage">Animations <span className="text-ws-text-tertiary normal-case tracking-normal">· Remotion</span></h3><button data-testid="home-new-anim" onClick={onNewAnimation} className="ann-btn">New Animation…</button></div>
        {(project.animations ?? []).length === 0 && <p className="text-sm text-ws-text-tertiary">None yet.</p>}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {(project.animations ?? []).map((a) => <Card key={a} testid={`home-anim-${a}`} href={pageUrl(project.name, undefined, undefined, a)} title={a} sub="animation" thumb={thumbs[`anim:${a}`]} />)}
        </div>
      </section>
    </div>
  )
}
