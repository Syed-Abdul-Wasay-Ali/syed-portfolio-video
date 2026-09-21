// ---------------------------------------------------------------------------
// Admin panel, full content manager for the portfolio.
//
//   words     : every editable string on the site (registry groups + each case
//               study + each brand + showcase/workflow items)
//   pictures  : every picture/video slot, replace, delete, add; deletes are
//               final (gone everywhere, no restore); whole case studies can be
//               deleted too; every slot previews
//               exactly like the portfolio (video plays in place,
//               youtube/instagram posts embed, images show uncropped)
//   sections  : show/hide + reorder sections on home / brand / case-study pages
//   concept   : the concept-images gallery manager (upload, caption, reorder)
//
// Reachable at  #/admin  (discreet link in the footer + header).
// Requires the local admin server (node admin-server.mjs) for saves; the
// passcode is a light client-side gate (change ADMIN_PASS below).
// Publishing: npm run build && npx gh-pages -d dist
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react'
import { BRANDS, type Brand } from '../data/brands'
import { projects, type MediaItem, type Project } from '../data/projects'
import MediaPanel from '../components/MediaPanel'
import { SHOWCASE } from '../data/showcase'
import { WORKFLOWS } from '../data/workflows'
import {
  UI_GROUPS,
  HOME_SECTIONS,
  BRAND_SECTIONS,
  PROJECT_SECTIONS,
  pk,
  bk,
  sck,
  wfk,
  collKey,
  type TextField,
} from '../data/text'
import {
  useRuntime,
  type ConceptImage,
  type RunContent,
  type SectionName,
  type TextVal,
} from '../data/runtime'

const ADMIN_PASS = 'Wasay710#' // change me
const SESSION_KEY = 'portfolio-admin-unlocked'

type Tab = 'words' | 'pictures' | 'sections' | 'concept'

// ---------------------------------------------------------------------------
// shared bits
// ---------------------------------------------------------------------------
async function api(path: string, body: unknown) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string }).error || `HTTP ${r.status}`)
  return j as { ok?: boolean; saved?: MediaItem[]; added?: MediaItem[]; content?: unknown }
}

// whole-case-study removal, canonical route, with a fallback for server
// builds started before /api/project/remove existed (same effect via the
// media store, id prefixed "project:").
async function apiProjectRemove(slug: string, restore: boolean) {
  try {
    return await api('/api/project/remove', { slug, restore })
  } catch {
    return await api('/api/media/remove', { src: `project:${slug}`, restore })
  }
}

// case studies removed from the site, canonical list + fallback store
const projRemovedFrom = (content: RunContent | null): string[] => [
  ...(content?.removedProjects ?? []),
  ...(content?.removedMedia ?? [])
    .filter((s) => s.startsWith('project:'))
    .map((s) => s.slice(8)),
]

const fileToBase64 = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(f)
  })

const readFiles = async (files: File[]) => {
  const out: { name: string; data: string }[] = []
  for (const f of files) out.push({ name: f.name, data: await fileToBase64(f) })
  return out
}

const inputCls =
  'w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-[13px] text-paper outline-none transition-colors focus:border-green'
const selectCls = inputCls
const btnCls =
  'rounded-md border border-green/40 px-4 py-2 font-mono text-[11px] uppercase tracking-wideish text-greenReadable transition-colors hover:border-greenBright hover:bg-green/10 focus-visible:border-green disabled:cursor-not-allowed disabled:opacity-40'
const btnSolid =
  'rounded-md bg-green px-4 py-2 font-mono text-[12px] uppercase tracking-wideish text-snow transition-colors hover:bg-paper hover:text-ink-950 focus-visible:border-green disabled:cursor-not-allowed disabled:opacity-40'
const smallBtn =
  'rounded border border-ink-600 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wideish text-paper/80 transition-colors hover:border-green hover:text-paper focus-visible:border-green disabled:cursor-not-allowed disabled:opacity-40'
const badgeCls =
  'rounded-sm bg-green/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wideish text-greenBright'

function Notice({ msg, err }: { msg: string; err: string }) {
  return (
    <>
      {msg && <p className="mt-3 font-mono text-[13px] text-greenBright">{msg}</p>}
      {err && <p className="mt-3 font-mono text-[13px] text-red-400">error: {err}</p>}
    </>
  )
}

const isVideoSrc = (src: string) => /\.(mp4|webm|mov|mkv|m4v)$/i.test(src)

// preview, renders a slot exactly the way the portfolio does: full image,
// playable video, or an embedded youtube / instagram post. Used everywhere an
// item can be edited or deleted, so you see the real thing before you touch it.
function MediaPreview({ item }: { item: MediaItem }) {
  const src = item.src
  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-sm bg-ink-950 font-mono text-[11px] text-muted">
        no file
      </div>
    )
  }
  if (/\.pdf$/i.test(src)) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video w-full items-center justify-center rounded-sm bg-ink-950 font-mono text-[11px] text-muted hover:text-paper"
      >
        📄 open pdf
      </a>
    )
  }
  const withKind: MediaItem = item.kind ? item : { ...item, kind: isVideoSrc(src) ? 'video' : 'image' }
  return (
    <div className="overflow-hidden rounded-sm bg-ink-950">
      <MediaPanel item={withKind} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// pictures: one slot card (replace / delete handler)
// ---------------------------------------------------------------------------
function SlotCard({
  label,
  src,
  sub,
  removed,
  busy,
  onReplace,
  onHide,
  hideLabel = 'delete',
  extra,
  media,
}: {
  label: string
  src?: string
  sub?: string
  removed?: boolean
  busy?: boolean
  onReplace?: (f: File) => void
  onHide?: () => void
  hideLabel?: string
  extra?: React.ReactNode
  media?: MediaItem
}) {
  if (removed) return null
  return (
    <div className="rounded-md border border-ink-600 bg-ink-800 p-2.5">
      <MediaPreview item={media ?? { src, label, kind: isVideoSrc(src ?? '') ? 'video' : 'image' }} />
      <p title={label} className="mt-2 line-clamp-1 font-mono text-[11px] text-paper/90">{label}</p>
      {sub && <p title={sub} className="line-clamp-1 font-mono text-[10px] text-muted">{sub}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onReplace && src && (
          <label className={`${smallBtn} cursor-pointer`}>
            replace
            <input
              type="file"
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) onReplace(f)
              }}
            />
          </label>
        )}
        {onHide && (
          <button type="button" disabled={busy} className={`${smallBtn} !text-red-400 hover:!border-red-400`} onClick={onHide}>
            ✕ {hideLabel}
          </button>
        )}
        {extra}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WORDS tab
// ---------------------------------------------------------------------------
type WField = TextField

const buildProjectFields = (p: Project): WField[] => {
  const s = p.slug
  const f = (k: string, label: string, def: string, multi = false): WField => ({
    k: pk(s, k),
    label,
    def,
    multi,
  })
  const out: WField[] = [
    f('title', 'title', p.title),
    f('subtitle', 'subtitle (line under the title)', p.subtitle ?? ''),
    f('role', 'role', p.role),
    f('year', 'year', p.year),
    f('status', 'status chip', p.status ?? ''),
    f('chain', 'process chain line', p.chain ?? ''),
    f('excerpt', 'excerpt (cards)', p.excerpt, true),
    f('overview', 'overview', p.overview, true),
    f('challenge', 'challenge', p.challenge, true),
    f('campaign.label', 'public-release link label', p.campaign?.label ?? ''),
    f('campaign.url', 'public-release url', p.campaign?.url ?? ''),
    { k: pk(s, 'approach'), label: 'approach, steps', list: p.approach },
    { k: pk(s, 'stack'), label: 'stack, chips', list: p.stack },
    { k: pk(s, 'contribution'), label: 'my contribution, chips', list: p.contribution ?? [] },
  ]
  if (p.production) {
    const pr = p.production
    out.push(
      f('production.objective', 'production, objective', pr.objective, true),
      f('production.input', 'production, input', pr.input, true),
      f('production.process', 'production, process', pr.process, true),
      f('production.control', 'production, control', pr.control, true),
      f('production.refinement', 'production, refinement', pr.refinement, true),
      f('production.output', 'production, output', pr.output, true),
    )
  }
  p.workflow.forEach((w, i) => out.push(f(`workflow.${i}.label`, `process step ${i + 1}`, w.label ?? '')))
  p.spec.forEach((row, i) => {
    out.push(f(`spec.${i}.label`, `spec ${i + 1}, label`, row.label))
    out.push(f(`spec.${i}.value`, `spec ${i + 1}, value`, row.value))
  })
  p.results.forEach((m, i) => out.push(f(`res.${i}.label`, `result ${i + 1}, caption`, m.label ?? '')))
  ;(p.stages ?? []).forEach((st, i) => out.push(f(`stage.${i}.label`, `stage ${i + 1}, label`, st.label ?? '')))
  if (p.beforeAfter) {
    out.push(f('ba.before.label', 'before, caption', p.beforeAfter.before.label ?? ''))
    out.push(f('ba.after.label', 'after, caption', p.beforeAfter.after.label ?? ''))
    out.push({ k: pk(s, 'ba.annotations'), label: 'before/after, annotations', list: p.beforeAfter.annotations ?? [] })
  }
  ;(p.formats ?? []).forEach((row, i) => {
    out.push(f(`fmt.${i}.label`, `format ${i + 1}, label`, row.label))
    if (row.note !== undefined) out.push(f(`fmt.${i}.note`, `format ${i + 1}, note`, row.note))
  })
  ;(p.placements ?? []).forEach((row, i) => {
    out.push(f(`pl.${i}.label`, `placement ${i + 1}, label`, row.label))
    if (row.note !== undefined) out.push(f(`pl.${i}.note`, `placement ${i + 1}, note`, row.note))
  })
  return out
}

const buildBrandFields = (b: Brand): WField[] => [
  { k: bk(b.slug, 'name'), label: 'brand name', def: b.name },
  { k: bk(b.slug, 'note'), label: 'note line (under the name)', def: b.note },
  { k: bk(b.slug, 'story'), label: 'story', def: b.story ?? '', multi: true },
]

const itemFields: WField[] = [
  ...SHOWCASE.flatMap((s): WField[] => [
    { k: sck(s.id, 'title'), label: `showcase ${s.id}, title`, def: s.title },
    { k: sck(s.id, 'note'), label: `showcase ${s.id}, note`, def: s.note ?? '', multi: true },
  ]),
  ...WORKFLOWS.flatMap((w): WField[] => [
    { k: wfk(w.id, 'title'), label: `workflow ${w.id}, title`, def: w.title },
    { k: wfk(w.id, 'note'), label: `workflow ${w.id}, note`, def: w.note ?? '', multi: true },
  ]),
]

function WordsTab() {
  const { content, refresh } = useRuntime()
  const [work, setWork] = useState<Record<string, TextVal>>({})
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [cat, setCat] = useState('hero')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setWork(content?.texts ? { ...content.texts } : {})
    setDeleted(new Set())
  }, [content])

  const fields: WField[] = useMemo(() => {
    if (cat.startsWith('P.')) {
      const slug = cat.slice(2)
      const p = projects.find((x) => x.slug === slug)
      return p ? buildProjectFields(p) : []
    }
    if (cat.startsWith('B.')) {
      const slug = cat.slice(2)
      const b = BRANDS.find((x) => x.slug === slug)
      return b ? buildBrandFields(b) : []
    }
    if (cat === 'items') return itemFields
    return UI_GROUPS.find((g) => g.id === cat)?.fields ?? []
  }, [cat])

  const shown = q.trim()
    ? fields.filter(
        (f) =>
          f.label.toLowerCase().includes(q.toLowerCase()) ||
          f.k.toLowerCase().includes(q.toLowerCase()),
      )
    : fields

  const valOf = (f: WField) => {
    if (deleted.has(f.k)) return f.list ? '' : (f.def ?? '')
    const v = work[f.k]
    if (typeof v === 'string') return v
    return f.def ?? ''
  }
  const listOf = (f: WField): string[] => {
    if (deleted.has(f.k)) return f.list ?? []
    const v = work[f.k]
    return Array.isArray(v) ? v : (f.list ?? [])
  }
  const edited = (k: string) => (content?.texts ? k in content.texts : false)

  const setVal = (k: string, v: TextVal) => {
    setWork((w) => ({ ...w, [k]: v }))
    setDeleted((d) => {
      if (!d.has(k)) return d
      const n = new Set(d)
      n.delete(k)
      return n
    })
  }
  const reset = (k: string) => {
    setWork((w) => {
      const n = { ...w }
      delete n[k]
      return n
    })
    setDeleted((d) => new Set(d).add(k))
  }

  const saveGroup = async () => {
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      const updates: Record<string, TextVal | null> = {}
      for (const f of fields) {
        if (deleted.has(f.k)) updates[f.k] = null
        else if (work[f.k] !== undefined) updates[f.k] = work[f.k]
      }
      if (Object.keys(updates).length === 0) {
        setMsg('nothing changed yet')
        return
      }
      await api('/api/text', { updates })
      await refresh()
      setMsg(`saved ${fields.filter((f) => updates[f.k] !== undefined).length} field(s)`)
    } catch (e) {
      setErr(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const options: { v: string; l: string }[] = [
    ...UI_GROUPS.map((g) => ({ v: g.id, l: g.label })),
    { v: 'items', l: 'Showcase & workflow items' },
    ...projects.map((p) => ({ v: 'P.' + p.slug, l: `Case study, ${p.title.slice(0, 58)}` })),
    ...BRANDS.map((b) => ({ v: 'B.' + b.slug, l: `Brand, ${b.name}` })),
  ]

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="panel h-fit p-5">
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">group</span>
          <select className={`${selectCls} mt-1.5`} value={cat} onChange={(e) => setCat(e.target.value)}>
            {options.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">search</span>
          <input className={`${inputCls} mt-1.5`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter fields…" />
        </label>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Every field saves as an override on top of the built-in copy. “reset” returns a field to the
          compiled default. Empty a field to hide that element on the site.
        </p>
        <button className={`${btnCls} mt-4 w-full`} onClick={() => void saveGroup()} disabled={busy}>
          {busy ? 'saving…' : `save ${fields.length} field(s)`}
        </button>
        <Notice msg={msg} err={err} />
      </div>

      <div className="grid gap-3.5">
        {shown.map((f) =>
          f.list ? (
            <ListInput
              key={f.k}
              field={f}
              items={listOf(f)}
              edited={edited(f.k)}
              onChange={(items) => setVal(f.k, items)}
              onReset={() => reset(f.k)}
            />
          ) : (
            <TextInput
              key={f.k}
              field={f}
              value={valOf(f)}
              edited={edited(f.k)}
              onChange={(v) => setVal(f.k, v)}
              onReset={() => reset(f.k)}
            />
          ),
        )}
        {shown.length === 0 && (
          <p className="font-mono text-[13px] text-muted">no fields match “{q}”.</p>
        )}
      </div>
    </div>
  )
}

function TextInput({
  field,
  value,
  edited,
  onChange,
  onReset,
}: {
  field: WField
  value: string
  edited: boolean
  onChange: (v: string) => void
  onReset: () => void
}) {
  return (
    <div className="rounded-md border border-ink-600 bg-ink-800 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">{field.label}</span>
        <span className="flex items-center gap-2">
          {edited && <span className={badgeCls}>edited</span>}
          {edited && (
            <button onClick={onReset} className="font-mono text-[11px] uppercase text-red-400 hover:underline">
              reset
            </button>
          )}
        </span>
      </div>
      {field.multi ? (
        <textarea
          rows={3}
          className={`${inputCls} mt-2 leading-relaxed`}
          value={value}
          placeholder="(empty)"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className={`${inputCls} mt-2`} placeholder="(empty)" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      <p className="mt-1.5 font-mono text-[10px] text-muted">key: {field.k}</p>
    </div>
  )
}

function ListInput({
  field,
  items,
  edited,
  onChange,
  onReset,
}: {
  field: WField
  items: string[]
  edited: boolean
  onChange: (items: string[]) => void
  onReset: () => void
}) {
  return (
    <div className="rounded-md border border-ink-600 bg-ink-800 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">
          {field.label}, list ({items.length})
        </span>
        <span className="flex items-center gap-2">
          {edited && <span className={badgeCls}>edited</span>}
          {edited && (
            <button onClick={onReset} className="font-mono text-[11px] uppercase text-red-400 hover:underline">
              reset
            </button>
          )}
        </span>
      </div>
      <div className="mt-2.5 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={inputCls}
              value={it}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
            />
            <button
              className={smallBtn}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              title="remove item"
            >
              ✕
            </button>
          </div>
        ))}
        <button className={smallBtn} onClick={() => onChange([...items, ''])}>
          + add item
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-muted">key: {field.k}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PICTURES tab
// ---------------------------------------------------------------------------
type PicArea = 'home' | 'project' | 'brand' | 'showcase' | 'workflows'

const HOME_EXTRAS: { group: string; items: [string, string][] }[] = [
  {
    group: 'Production pipeline strip (home)',
    items: [
      ['media/image-system/pipeline/product.jpg', 'stage 01, product'],
      ['media/image-system/pipeline/reference.jpg', 'stage 02, reference'],
      ['media/image-system/pipeline/generation.jpg', 'stage 03, generation'],
      ['media/image-system/pipeline/compositing.jpg', 'stage 04, compositing'],
      ['media/image-system/pipeline/lighting.jpg', 'stage 05, lighting'],
      ['media/image-system/pipeline/final.jpg', 'stage 06, final'],
    ],
  },
  {
    group: 'One product / many assets (home)',
    items: [
      ['media/image-system/assets/studio-hero.jpg', 'studio hero 16:9'],
      ['media/image-system/assets/bedroom-lifestyle.jpg', 'bedroom lifestyle 16:9'],
      ['media/image-system/assets/wide-room.jpg', 'wide room 16:9'],
      ['media/image-system/assets/product-page.jpg', 'product page 16:9'],
      ['media/image-system/assets/detail.jpg', 'close-up detail 4:3'],
      ['media/image-system/assets/mobile.jpg', 'mobile 4:5'],
      ['media/image-system/assets/social.jpg', 'social ad 9:16'],
    ],
  },
  {
    group: 'Showreel (home)',
    items: [
      ['media/reel/showreel-2026.mp4', 'showreel video (mp4)'],
      ['media/reel/showreel-2026-poster.jpg', 'showreel poster'],
    ],
  },
  {
    group: 'E-commerce concept page (ecommerce-image-system case study)',
    items: [
      ['media/ecommerce-image-system/desktop-hero.jpg', 'desktop hero'],
      ['media/ecommerce-image-system/desktop-lifestyle.jpg', 'desktop lifestyle'],
      ['media/ecommerce-image-system/desktop-detail.jpg', 'desktop detail'],
      ['media/ecommerce-image-system/thumb-01.jpg', 'thumb 01'],
      ['media/ecommerce-image-system/thumb-02.jpg', 'thumb 02'],
      ['media/ecommerce-image-system/thumb-03.jpg', 'thumb 03'],
      ['media/ecommerce-image-system/thumb-04.jpg', 'thumb 04'],
      ['media/ecommerce-image-system/mobile-hero.jpg', 'mobile hero'],
    ],
  },
  {
    group: 'Site files',
    items: [
      ['media/image-system/og-hero.jpg', 'social share image (1200x630)'],
      ['media/resume/Syed-Abdul-Wasay-Ali-Resume.pdf', 'resume PDF'],
    ],
  },
]

function PicturesTab() {
  const { content, refresh } = useRuntime()
  const [area, setArea] = useState<PicArea>('home')
  const [projSlug, setProjSlug] = useState(projects[0]?.slug ?? '')
  const [brandSlug, setBrandSlug] = useState(BRANDS[0]?.slug ?? '')
  const [brandSection, setBrandSection] = useState<SectionName>('stills')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const notice = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      const m = await fn()
      await refresh()
      if (typeof m === 'string') setMsg(m)
    } catch (e) {
      setErr(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const replace = (src: string) => (f: File) =>
    void notice(async () => {
      const data = await fileToBase64(f)
      await api('/api/media/replace', { src, file: { name: f.name, data } })
      return `replaced ${src}`
    })

  const removedSet = new Set(content?.removedMedia ?? [])
  const removedProjects = new Set(projRemovedFrom(content))
  const hide = (src: string) => void notice(async () => {
    await api('/api/media/remove', { src })
    return 'deleted, gone from the site'
  })
  const removeProject = (slug: string) => void notice(async () => {
    await apiProjectRemove(slug, false)
    return 'case study deleted, gone from the site'
  })

  const addFiles = (collection: string, label: string) => (files: File[]) =>
    void notice(async () => {
      const payload = await readFiles(files)
      const j = await api('/api/media/add', { collection, label, files: payload })
      return `added ${j.added?.length ?? payload.length} file(s)`
    })

  const renameAdded = (collection: string, src: string, label: string) =>
    void notice(async () => {
      await api('/api/media/edit', { collection, src, patch: { label } })
      return 'renamed'
    })
  const deleteAdded = (collection: string, src: string) =>
    void notice(async () => {
      await api('/api/media/edit', { collection, src, patch: { remove: true } })
      return 'deleted'
    })

  const liveProjects = projects.filter((p) => !removedProjects.has(p.slug))
  const selSlug = liveProjects.some((p) => p.slug === projSlug) ? projSlug : (liveProjects[0]?.slug ?? '')
  const project = liveProjects.find((p) => p.slug === selSlug)
  const brand = BRANDS.find((b) => b.slug === brandSlug)
  const brandBase =
    brandSection === 'stills' ? brand?.images : brandSection === 'animatics' ? brand?.animatics : brand?.films
  const brandUploads = content?.uploads?.[brandSlug]?.[brandSection] ?? []
  const brandRemoved = new Set(content?.removedItems?.[brandSlug]?.[brandSection] ?? [])
  const brandBaseVisible = (brandBase ?? []).filter((m) => !brandRemoved.has(m.src ?? '') && !removedSet.has(m.src ?? ''))
  const projColl = project ? collKey.projectResults(project.slug) : ''
  const projAdded = (content?.additions?.[projColl] ?? []) as MediaItem[]
  const showcaseAdded = (content?.additions?.[collKey.showcase] ?? []) as MediaItem[]

  const areaBtn = (k: PicArea, l: string) => (
    <button
      key={k}
      onClick={() => setArea(k)}
      className={`rounded-md border px-3.5 py-2 font-mono text-[11px] uppercase tracking-wideish transition-colors focus-visible:border-green ${
        area === k ? 'border-green bg-green/15 text-greenBright' : 'border-ink-600 text-muted hover:border-green/40 hover:text-paper'
      }`}
    >
      {l}
    </button>
  )

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {areaBtn('home', 'home page')}
        {areaBtn('project', 'case studies')}
        {areaBtn('brand', 'brands')}
        {areaBtn('showcase', 'showcase')}
        {areaBtn('workflows', 'workflows')}
      </div>
      <Notice msg={msg} err={err} />

      {area === 'home' && (
        <div className="mt-5 space-y-6">
          <p className="text-[13px] leading-relaxed text-muted">
            Replace any home-page image or video file. Same file name, new bytes, everything else
            stays. (Handles large files: give it a second.)
          </p>
          {HOME_EXTRAS.filter((g) => g.items.some(([src]) => !removedSet.has(src))).map((g) => (
            <div key={g.group}>
              <p className="eyebrow-green">{g.group}</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {g.items.map(([src, label]) =>
                  g.group === 'Site files' ? (
                    <SlotCard key={src} label={label} src={src} sub={src} busy={busy} onReplace={replace(src)} />
                  ) : (
                    <SlotCard
                      key={src}
                      label={label}
                      src={src}
                      sub={src}
                      busy={busy}
                      removed={removedSet.has(src)}
                      onReplace={replace(src)}
                      onHide={() => hide(src)}
                      
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {area === 'project' && (
        <div className="mt-5 space-y-6">
          <label className="block max-w-xl">
            <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">editing case study</span>
            <select
              className={`${selectCls} mt-1.5`}
              value={selSlug}
              onChange={(e) => setProjSlug(e.target.value)}
            >
              {liveProjects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title.slice(0, 70)}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-md border border-red-400/40 bg-ink-950 p-4">
            <p className="font-mono text-[11px] uppercase tracking-wideish text-red-400">delete a full case study</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Takes the whole study off the site, its card, its page and every section. It is gone
              for good and won't appear here again. Save & publish to push it live.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {liveProjects.map((p) => (
                <div
                  key={p.slug}
                  className="flex items-center justify-between gap-2 rounded border border-ink-600 px-2.5 py-2"
                >
                  <span title={p.title} className="min-w-0 truncate font-mono text-[11px] text-paper/85">
                    {p.title}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className={`flex-none ${smallBtn} !text-red-400 hover:!border-red-400`}
                    onClick={() => removeProject(p.slug)}
                  >
                    ✕ delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          {project && (
            <>
              {((project.cover && !removedSet.has(project.cover)) || (project.heroSrc && !removedSet.has(project.heroSrc))) && (
              <div>
                <p className="eyebrow-green">cover & hero</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {project.cover && (
                    <SlotCard
                      label="cover (cards)"
                      src={project.cover}
                      sub={project.cover}
                      busy={busy}
                      removed={removedSet.has(project.cover)}
                      onReplace={replace(project.cover)}
                      onHide={() => hide(project.cover!)}
                      
                    />
                  )}
                  {project.heroSrc && (
                    <SlotCard
                      label="hero frame"
                      src={project.heroSrc}
                      sub={project.heroSrc}
                      busy={busy}
                      removed={removedSet.has(project.heroSrc)}
                      onReplace={replace(project.heroSrc)}
                      onHide={() => hide(project.heroSrc!)}
                      
                    />
                  )}
                </div>
              </div>
              )}

              <div>
                <p className="eyebrow-green">results gallery ({project.results.filter((m) => !(m.src && removedSet.has(m.src))).length} + {projAdded.length} added)</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {project.results.map((m, i) => {
                    const src = m.src ?? ''
                    const rem = removedSet.has(src)
                    return (
                      <SlotCard
                        key={src + i}
                        label={m.label ?? `result ${i + 1}`}
                        src={src}
                        sub={src}
                        media={m.src ? m : undefined}
                        removed={rem}
                        busy={busy}
                        onReplace={src ? replace(src) : undefined}
                        onHide={() => hide(src)}
                        
                      />
                    )
                  })}
                  {projAdded.map((m) => (
                    <AddedCard
                      key={m.src}
                      item={m}
                      busy={busy}
                      onReplace={m.src ? replace(m.src) : undefined}
                      onRename={(label) => renameAdded(projColl, m.src ?? '', label)}
                      onDelete={() => deleteAdded(projColl, m.src ?? '')}
                    />
                  ))}
                </div>
                <AddFilesRow label="add pictures to this case study" onFiles={addFiles(projColl, '')} />
              </div>

              {(project.stages ?? []).filter((m) => !removedSet.has(m.src ?? '')).length > 0 && (
                <div>
                  <p className="eyebrow-green">stages</p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {(project.stages ?? []).map((m, i) => {
                      const src = m.src ?? ''
                      return src ? (
                        <SlotCard
                          key={src + i}
                          label={m.label ?? `stage ${i + 1}`}
                          src={src}
                          sub={src}
                          media={m}
                          busy={busy}
                          removed={removedSet.has(src)}
                          onReplace={replace(src)}
                          onHide={() => hide(src)}
                          
                        />
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {project.beforeAfter &&
                [project.beforeAfter.before, project.beforeAfter.after].filter((m) => !(m.src && removedSet.has(m.src))).length > 0 && (
                <div>
                  <p className="eyebrow-green">before / after</p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {[project.beforeAfter.before, project.beforeAfter.after].map((m, i) => {
                      const src = m.src ?? ''
                      return src ? (
                        <SlotCard
                          key={src + i}
                          label={i === 0 ? 'before' : 'after'}
                          src={src}
                          sub={src}
                          media={m}
                          busy={busy}
                          removed={removedSet.has(src)}
                          onReplace={replace(src)}
                          onHide={() => hide(src)}
                          
                        />
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {(project.formats ?? []).filter((m) => !removedSet.has(m.src ?? '')).length > 0 && (
                <div>
                  <p className="eyebrow-green">format frames</p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {(project.formats ?? []).map((m, i) => {
                      const src = m.src ?? ''
                      return src ? (
                        <SlotCard
                          key={src + i}
                          label={`${m.label} (${m.ratio})`}
                          src={src}
                          sub={src}
                          busy={busy}
                          removed={removedSet.has(src)}
                          onReplace={replace(src)}
                          onHide={() => hide(src)}
                          
                        />
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {(project.placements ?? []).filter((m) => !removedSet.has(m.src ?? '')).length > 0 && (
                <div>
                  <p className="eyebrow-green">placements</p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {(project.placements ?? []).map((m, i) => {
                      const src = m.src ?? ''
                      return src ? (
                        <SlotCard
                          key={src + i}
                          label={m.label}
                          src={src}
                          sub={src}
                          busy={busy}
                          removed={removedSet.has(src)}
                          onReplace={replace(src)}
                          onHide={() => hide(src)}
                          
                        />
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {area === 'brand' && (
        <div className="mt-5 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">brand</span>
              <select className={`${selectCls} mt-1.5`} value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)}>
                {BRANDS.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">section</span>
              <select className={`${selectCls} mt-1.5`} value={brandSection} onChange={(e) => setBrandSection(e.target.value as SectionName)}>
                <option value="stills">stills</option>
                <option value="animatics">animatics</option>
                <option value="films">films</option>
              </select>
            </label>
          </div>

          {brand && brand.logo && !removedSet.has(brand.logo) && (
            <>
              <p className="eyebrow-green">logo</p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <SlotCard
                  label={`${brand.name}, logo`}
                  src={brand.logo}
                  sub={brand.logo}
                  busy={busy}
                  removed={removedSet.has(brand.logo)}
                  onReplace={replace(brand.logo)}
                  onHide={() => hide(brand.logo!)}
                  
                />
              </div>
            </>
          )}

          <div>
            <p className="eyebrow-green">
              {brand?.name} · {brandSection}, {brandUploads.length} uploaded + {brandBaseVisible.length} built-in
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {brandUploads.map((m) => (
                <SlotCard
                  key={m.src ?? m.label}
                  label={m.label ?? m.src ?? ''}
                  src={m.src}
                  sub={m.src}
                  media={m.src ? m : undefined}
                  busy={busy}
                  onReplace={m.src ? replace(m.src) : undefined}
                  onHide={() =>
                    void notice(async () => {
                      await api('/api/remove', { brand: brandSlug, section: brandSection, src: m.src ?? m.label ?? '' })
                      return 'deleted'
                    })
                  }
                  hideLabel="delete"
                />
              ))}
              {brandBaseVisible.map((m, i) => {
                const src = m.src ?? ''
                const rem = brandRemoved.has(src) || removedSet.has(src)
                return (
                  <SlotCard
                    key={src + i}
                    label={m.label ?? src}
                    src={src}
                    sub={src}
                    media={m.src ? m : undefined}
                    removed={rem}
                    busy={busy}
                    onReplace={src ? replace(src) : undefined}
                    onHide={() =>
                      void notice(async () => {
                        await api('/api/remove', { brand: brandSlug, section: brandSection, src })
                        return 'deleted'
                      })
                    }
                  />
                )
              })}
            </div>
            <AddFilesRow
              label={`upload new ${brandSection} for ${brand?.name ?? ''}`}
              onFiles={(files) =>
                void notice(async () => {
                  const payload = await readFiles(files)
                  const j = await api('/api/upload', { brand: brandSlug, section: brandSection, files: payload })
                  return `uploaded ${j.saved?.length ?? payload.length} file(s)`
                })
              }
            />
          </div>
        </div>
      )}

      {area === 'showcase' && (
        <div className="mt-5 space-y-6">
          <div>
            <p className="eyebrow-green">showcase pieces ({SHOWCASE.filter((s) => !(s.src && removedSet.has(s.src))).length} + {showcaseAdded.length} added)</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {SHOWCASE.map((s) => {
                const rem = s.src ? removedSet.has(s.src) : false
                return (
                  <SlotCard
                    key={s.id}
                    label={`${s.id}, ${s.title}`}
                    src={s.poster ?? s.src}
                    sub={s.src}
                    media={s.src ? s : undefined}
                    removed={rem}
                    busy={busy}
                    onReplace={s.src ? replace(s.src) : undefined}
                    onHide={s.src ? () => hide(s.src!) : undefined}
                    
                    extra={
                      s.poster && (
                        <label className={`${smallBtn} cursor-pointer`}>
                          poster
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              e.target.value = ''
                              if (f) replace(s.poster!)(f)
                            }}
                          />
                        </label>
                      )
                    }
                  />
                )
              })}
              {showcaseAdded.map((m) => (
                <AddedCard
                  key={m.src}
                  item={m}
                  busy={busy}
                  onReplace={m.src ? replace(m.src) : undefined}
                  onRename={(label) => renameAdded(collKey.showcase, m.src ?? '', label)}
                  onDelete={() => deleteAdded(collKey.showcase, m.src ?? '')}
                />
              ))}
            </div>
            <AddFilesRow label="add showcase pieces" onFiles={addFiles(collKey.showcase, '')} />
          </div>
        </div>
      )}

      {area === 'workflows' && (
        <div className="mt-5 space-y-6">
          <div>
            <p className="eyebrow-green">workflow runs ({WORKFLOWS.filter((w) => !(w.src && removedSet.has(w.src))).length})</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {WORKFLOWS.map((w) => {
                const rem = w.src ? removedSet.has(w.src) : false
                return (
                  <SlotCard
                    key={w.id}
                    label={`${w.id}, ${w.title}`}
                    src={w.poster ?? w.src}
                    sub={w.src}
                    media={w.src ? w : undefined}
                    removed={rem}
                    busy={busy}
                    onReplace={w.src ? replace(w.src) : undefined}
                    onHide={w.src ? () => hide(w.src!) : undefined}
                    
                    extra={
                      <>
                        {w.poster && (
                          <label className={`${smallBtn} cursor-pointer`}>
                            poster
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                e.target.value = ''
                                if (f) replace(w.poster!)(f)
                              }}
                            />
                          </label>
                        )}
                        {w.output?.src && (
                          <label className={`${smallBtn} cursor-pointer`}>
                            output
                            <input
                              type="file"
                              accept={
                                /\.(mp4|webm|mov|mkv|m4v)$/i.test(w.output!.src) ? 'video/*' : 'image/*'
                              }
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                e.target.value = ''
                                if (f) replace(w.output!.src)(f)
                              }}
                            />
                          </label>
                        )}
                      </>
                    }
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function AddedCard({
  item,
  busy,
  onReplace,
  onRename,
  onDelete,
}: {
  item: MediaItem
  busy: boolean
  onReplace?: (f: File) => void
  onRename: (label: string) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(item.label ?? '')
  useEffect(() => setLabel(item.label ?? ''), [item.label])
  return (
    <div className="rounded-md border border-green/30 bg-ink-800 p-2.5">
      <MediaPreview item={item} />
      <input className={`${inputCls} mt-2 !py-1 !text-[12px]`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="caption" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className={smallBtn} disabled={busy} onClick={() => onRename(label)}>
          save caption
        </button>
        {onReplace && (
          <label className={`${smallBtn} cursor-pointer`}>
            replace
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) onReplace(f)
              }}
            />
          </label>
        )}
        <button className={`${smallBtn} !text-red-400 hover:!border-red-400`} disabled={busy} onClick={onDelete}>
          ✕ delete
        </button>
        <span className={badgeCls}>added</span>
      </div>
    </div>
  )
}

function AddFilesRow({ label, onFiles }: { label: string; onFiles: (files: File[]) => void }) {
  return (
    <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-ink-600 p-3.5 font-mono text-[12px] uppercase tracking-wideish text-muted transition-colors hover:border-green/40 hover:text-paper">
      + {label}
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </label>
  )
}

// ---------------------------------------------------------------------------
// SECTIONS tab
// ---------------------------------------------------------------------------
type Row = { k: string; label: string; on: boolean }

async function apiOrder(page: 'home' | 'brand' | 'project', order: string[]) {
  return api('/api/order', { page, order })
}

function SectionsPanel({
  page,
  defs,
  legacyHidden,
}: {
  page: 'home' | 'brand' | 'project'
  defs: { k: string; label: string }[]
  legacyHidden?: string[]
}) {
  const { content, refresh } = useRuntime()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const stored = content?.sectionOrder?.[page]
    if (stored) {
      const inStored = stored
        .map((k) => defs.find((d) => d.k === k))
        .filter((d): d is { k: string; label: string } => Boolean(d))
      const rest = defs.filter((d) => !stored.includes(d.k))
      setRows([
        ...inStored.map((d) => ({ ...d, on: true })),
        ...rest.map((d) => ({ ...d, on: false })),
      ])
    } else {
      const legacy = legacyHidden ?? []
      setRows(defs.map((d) => ({ ...d, on: !legacy.includes(d.k) })))
    }
  }, [content, page, defs, legacyHidden])

  const move = (i: number, dir: -1 | 1) => {
    setRows((r) => {
      const j = i + dir
      if (j < 0 || j >= r.length) return r
      const n = [...r]
      const [it] = n.splice(i, 1)
      n.splice(j, 0, it)
      return n
    })
  }
  const toggle = (i: number) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, on: !row.on } : row)))
  const showAll = () => setRows((r) => r.map((row) => ({ ...row, on: true })))

  const save = async () => {
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      await apiOrder(
        page,
        rows.filter((r) => r.on).map((r) => r.k),
      )
      await refresh()
      setMsg(`saved, ${rows.filter((r) => r.on).length} section(s) visible, in this order`)
    } catch (e) {
      setErr(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow-green">
          {page === 'home' ? 'home page' : page === 'brand' ? 'brand pages (shared)' : 'case-study pages (shared)'},
          order & visibility
        </p>
        <div className="flex gap-2">
          <button className={smallBtn} onClick={showAll}>
            show all
          </button>
          <button className={btnCls} disabled={busy} onClick={() => void save()}>
            {busy ? 'saving…' : 'save order'}
          </button>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`flex items-center gap-2 rounded-md border px-3 py-2.5 ${
              r.on ? 'border-green/40' : 'border-ink-600 opacity-60'
            }`}
          >
            <button className={smallBtn} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button className={smallBtn} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button
              className={smallBtn}
              onClick={() => toggle(i)}
              title={r.on ? 'hide section' : 'show section'}
            >
              {r.on ? '👁 visible' : '✕ hidden'}
            </button>
            <span className={`font-mono text-[13px] ${r.on ? 'text-paper' : 'text-muted line-through'}`}>
              {r.label}
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted">{r.k}</span>
          </div>
        ))}
      </div>
      <Notice msg={msg} err={err} />
    </div>
  )
}

function BrandVisibilityPanel() {
  const { content, refresh } = useRuntime()
  const [slug, setSlug] = useState(BRANDS[0]?.slug ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const keys: SectionName[] = ['story', 'projects', 'stills', 'animatics', 'films']
  const hidden = content?.hiddenSections?.[slug] ?? []

  const toggle = async (s: SectionName) => {
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      const next = hidden.includes(s) ? hidden.filter((x) => x !== s) : [...hidden, s]
      await api('/api/sections', { brand: slug, hidden: next })
      await refresh()
      setMsg('sections updated')
    } catch (e) {
      setErr(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel p-5">
      <p className="eyebrow-green">per-brand section visibility</p>
      <label className="mt-3 block max-w-sm">
        <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">brand</span>
        <select className={`${selectCls} mt-1.5`} value={slug} onChange={(e) => setSlug(e.target.value)}>
          {BRANDS.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 space-y-2">
        {keys.map((s) => {
          const off = hidden.includes(s)
          return (
            <button
              key={s}
              disabled={busy}
              onClick={() => void toggle(s)}
              className={`flex w-full items-center justify-between rounded-md border px-4 py-2.5 font-mono text-[12px] uppercase tracking-wideish transition-colors ${
                off ? 'border-ink-600 text-muted line-through' : 'border-green/40 text-paper hover:border-green'
              }`}
            >
              <span>{s}</span>
              <span className="text-[11px]">{off ? 'removed' : 'visible'}</span>
            </button>
          )
        })}
      </div>
      <Notice msg={msg} err={err} />
    </div>
  )
}

function SectionsTab() {
  return (
    <div className="mt-6 space-y-6">
      <SectionsPanel page="home" defs={HOME_SECTIONS} legacyHidden={undefined} />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionsPanel page="brand" defs={BRAND_SECTIONS} />
        <BrandVisibilityPanel />
      </div>
      <SectionsPanel page="project" defs={PROJECT_SECTIONS} />
      <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
        “Case-study pages (shared)” and “brand pages (shared)” apply to every case study / brand page.
        The per-brand toggles above switch individual brand sections back on or off (legacy layer,
        still respected alongside the order).
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CONCEPT images tab (moved from v1, unchanged behaviour)
// ---------------------------------------------------------------------------
function ConceptTab() {
  const { refresh } = useRuntime()
  const [cFiles, setCFiles] = useState<File[]>([])
  const [cCaption, setCCaption] = useState('')
  const [cGroup, setCGroup] = useState<'main' | 'photos'>('main')
  const [cDrafts, setCDrafts] = useState<Record<string, string>>({})
  const [cBusy, setCBusy] = useState(false)
  const [cMsg, setCMsg] = useState('')
  const [cErr, setCErr] = useState('')
  const [cItems, setCItems] = useState<ConceptImage[]>([])

  useEffect(() => {
    fetch('content.json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((c) => setCItems(Array.isArray(c.conceptImages) ? c.conceptImages : []))
      .catch(() => {})
  }, [])

  const cPost = async (path: string, payload: unknown) => {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j && j.error ? j.error : 'request failed')
    if (j && j.content && Array.isArray(j.content.conceptImages)) setCItems(j.content.conceptImages)
    return j
  }
  const cUpload = async () => {
    if (!cFiles.length) {
      setCErr('pick at least one image')
      return
    }
    setCBusy(true)
    setCMsg('')
    setCErr('')
    try {
      const files = await readFiles(cFiles)
      const j = await cPost('/api/concept/upload', { caption: cCaption, files, group: cGroup === 'photos' ? 'photos' : undefined })
      setCMsg('uploaded ' + ((j.saved && j.saved.length) || 0) + ' image(s)')
      setCFiles([])
      setCCaption('')
      await refresh()
    } catch (e) {
      setCErr(String((e && (e as Error).message) || e))
    } finally {
      setCBusy(false)
    }
  }
  const cOp = async (path: string, payload: unknown, okMsg: string) => {
    setCBusy(true)
    setCMsg('')
    setCErr('')
    try {
      await cPost(path, payload)
      setCMsg(okMsg)
      await refresh()
    } catch (e) {
      setCErr(String((e && (e as Error).message) || e))
    } finally {
      setCBusy(false)
    }
  }
  const cReplace = async (id: string, f: File | undefined) => {
    if (!f) return
    setCBusy(true)
    setCMsg('')
    setCErr('')
    try {
      await cPost('/api/concept/replace', { id, file: { name: f.name, data: await fileToBase64(f) } })
      setCMsg('replaced image')
      await refresh()
    } catch (e) {
      setCErr(String((e && (e as Error).message) || e))
    } finally {
      setCBusy(false)
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="rounded-md border border-ink-600 bg-ink-800 p-5">
        <p className="eyebrow-green">add workflow images</p>
        <p className="mt-2 font-mono text-[12px] text-muted">
          uploads land in the chosen section on the home page (AI × E-commerce band / photoshoot sub-band).
        </p>
        <label className="mt-4 block font-mono text-[11px] uppercase tracking-wideish text-slateAccent">
          section
          <select
            value={cGroup}
            onChange={(e) => setCGroup(e.target.value as 'main' | 'photos')}
            className="mt-1.5 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-[13px] text-paper outline-none transition-colors focus:border-green"
          >
            <option value="main">AI × E-commerce band</option>
            <option value="photos">AI Product Photoshoot images</option>
          </select>
        </label>
        <label className="mt-4 block font-mono text-[11px] uppercase tracking-wideish text-slateAccent">
          caption (optional, applies to this batch)
          <input
            value={cCaption}
            onChange={(e) => setCCaption(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-[13px] text-paper outline-none transition-colors focus:border-green"
            placeholder="e.g. workflow graphic 01"
          />
        </label>
        <div className="mt-3">
          <span className="block font-mono text-[11px] uppercase tracking-wideish text-slateAccent">
            images (multi-select ok)
          </span>
          <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-ink-600 p-3.5 font-mono text-[12px] uppercase tracking-wideish text-muted transition-colors hover:border-green/40 hover:text-paper">
            + choose files{cFiles.length ? `, ${cFiles.length} selected` : ''}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setCFiles(Array.from(e.target.files || []))}
              className="hidden"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void cUpload()}
          disabled={cBusy}
          className={`${btnSolid} mt-4`}
        >
          upload
        </button>
        <Notice msg={cMsg} err={cErr} />
      </div>
      <div className="rounded-md border border-ink-600 bg-ink-800 p-5">
        <p className="eyebrow-green">
          manage · {cItems.length} image{cItems.length === 1 ? '' : 's'}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cItems.map((m, idx) => (
            <div key={m.id} className="rounded-md border border-ink-600 bg-ink-800 p-2.5">
              <MediaPreview item={{ src: m.src, label: m.caption || '', kind: m.kind }} />
              {m.group === 'photos' && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wideish text-greenReadable">photoshoot sub-band</p>
              )}
              <input
                value={cDrafts[m.id] ?? m.caption ?? ''}
                onChange={(e) => setCDrafts({ ...cDrafts, [m.id]: e.target.value })}
                className="mt-2 w-full rounded-md border border-ink-600 bg-ink-950 px-2.5 py-1.5 font-mono text-[12px] text-paper outline-none transition-colors focus:border-green"
                placeholder="caption / title"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={cBusy || idx === 0}
                  onClick={() => void cOp('/api/concept/reorder', { id: m.id, dir: 'up' }, 'moved up')}
                  className={smallBtn}
                >
                  up
                </button>
                <button
                  type="button"
                  disabled={cBusy || idx === cItems.length - 1}
                  onClick={() => void cOp('/api/concept/reorder', { id: m.id, dir: 'down' }, 'moved down')}
                  className={smallBtn}
                >
                  down
                </button>
                <button
                  type="button"
                  disabled={cBusy}
                  onClick={() => void cOp('/api/concept/edit', { id: m.id, caption: cDrafts[m.id] ?? m.caption ?? '' }, 'caption saved')}
                  className={smallBtn}
                >
                  save caption
                </button>
                <label className={`${smallBtn} cursor-pointer`}>
                  replace
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0]
                      e.target.value = ''
                      void cReplace(m.id, f || undefined)
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={cBusy}
                  onClick={() => {
                    if (confirm('remove this image? this deletes the file.'))
                      void cOp('/api/concept/remove', { id: m.id }, 'image removed')
                  }}
                  className={`${smallBtn} !text-red-400 hover:!border-red-400`}
                >
                  remove
                </button>
              </div>
            </div>
          ))}
          {cItems.length === 0 && (
            <p className="col-span-full font-mono text-[12px] text-muted">
              no workflow images yet, upload some on the left.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// page shell
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// save & publish, one button: build the site, push it to GitHub Pages
// ---------------------------------------------------------------------------
type PublishStatus = {
  missing?: boolean
  running: boolean
  phase: string
  ok: boolean | null
  error: string | null
  last: { at: number } | null
  dirty: boolean
  logTail: string[]
}

function PublishBar() {
  const [st, setSt] = useState<PublishStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const r = await fetch('/api/publish/status', { cache: 'no-store' })
        if (r.status === 404) {
          if (live)
            setSt({ missing: true, running: false, phase: 'idle', ok: null, error: null, last: null, dirty: true, logTail: [] })
          return
        }
        if (!r.ok) return
        const j = (await r.json()) as PublishStatus
        if (live) setSt(j)
      } catch {
        /* server offline, the banner above already explains */
      }
    }
    load()
    const t = window.setInterval(load, 2500)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [])

  const publish = async () => {
    if (busy || st?.running || st?.missing) return
    setBusy(true)
    setFlash('')
    try {
      await api('/api/publish', {})
    } catch (e) {
      setFlash('could not start publish: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const running = !!st?.running
  const phase = st?.phase || 'idle'
  const lastAt = st?.last?.at ? new Date(st.last.at).toLocaleString() : null
  const upToDate = !!(st && !st.missing && !running && st.last && !st.dirty && !st.error)

  return (
    <div className="panel mt-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">save &amp; publish</p>
          <p className="mt-1 text-[13px] leading-relaxed text-paper/85">
            {st?.missing ? (
              <>
                This server is outdated, restart it (<span className="font-mono text-[12px] text-paper">node admin-server.mjs</span>) to get the publish button.
              </>
            ) : running ? (
              phase === 'publishing' ? 'Uploading to GitHub…' : 'Building the site…'
            ) : upToDate ? (
              <>
                Live on GitHub since <span className="text-paper">{lastAt}</span>, you are up to date.
              </>
            ) : (
              'You have changes that are not on the GitHub site yet.'
            )}
          </p>
          {(flash || st?.error) && <p className="mt-1 font-mono text-[11px] text-red-400">{flash || st?.error}</p>}
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={busy || running || !!st?.missing}
          className={`${btnSolid} ${busy || running || st?.missing ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          {running ? (phase === 'publishing' ? 'publishing…' : 'building…') : busy ? 'starting…' : 'save & publish'}
        </button>
      </div>
      {running && (
        <p className="mt-3 border-t border-ink-600 pt-3 font-mono text-[11px] leading-relaxed text-muted">
          takes about a minute, keep the server window open. {(st?.logTail || []).slice(-1)[0] || ''}
        </p>
      )}
    </div>
  )
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>('words')

  // is the local admin server reachable? (live gh-pages has no /api)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/content', { cache: 'no-store' })
      .then((r) => setServerOk(r.ok))
      .catch(() => setServerOk(false))
  }, [])

  if (!unlocked) {
    return (
      <main className="container-site flex min-h-[70vh] items-center justify-center pt-14">
        <form
          className="panel w-full max-w-md p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (pass === ADMIN_PASS) {
              sessionStorage.setItem(SESSION_KEY, '1')
              setUnlocked(true)
              setErr('')
            } else {
              setErr('wrong passcode')
            }
          }}
        >
          <p className="eyebrow-green">admin access</p>
          <h1 className="mt-2 font-display text-2xl font-black uppercase">Content manager</h1>
          <p className="mt-2 text-sm text-muted">
            Every word, every picture and every section of the portfolio, editable from here.
          </p>
          <label className="mt-4 block">
            <span className="font-mono text-[11px] uppercase tracking-wideish text-slateAccent">passcode</span>
            <div className="relative mt-1.5">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className={`${inputCls} !pr-11`}
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'hide passcode' : 'show passcode'}
                title={showPass ? 'hide passcode' : 'show passcode'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted transition-colors hover:text-paper"
              >
                {showPass ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          {err && <p className="mt-2 font-mono text-[12px] text-red-400">{err}</p>}
          <button type="submit" className={`${btnSolid} mt-5 w-full`}>
            unlock
          </button>
        </form>
      </main>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'words', label: 'words' },
    { id: 'pictures', label: 'pictures' },
    { id: 'sections', label: 'sections' },
    { id: 'concept', label: 'AI × E-commerce' },
  ]

  return (
    <main className="container-site pb-16 pt-20">
      <p className="eyebrow-green">admin</p>
      <h1 className="mt-2 font-display text-3xl font-black uppercase">Content manager</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Words · pictures · sections, everything on the portfolio edits from here and saves into{' '}
        <span className="font-mono text-[12px] text-paper">content.json</span> (plus media files).
        When you are done, hit <span className="font-mono text-[12px] text-paper">save &amp; publish</span> to push it
        to the live GitHub site.
      </p>

      {serverOk === true && <PublishBar />}

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`rounded-md border px-4 py-2 font-mono text-[11px] uppercase tracking-wideish transition-colors focus-visible:border-green ${
              tab === tb.id
                ? 'border-green bg-green/15 text-greenBright'
                : 'border-ink-600 text-muted hover:border-green/40 hover:text-paper'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {serverOk === false && (
        <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-400/10 p-4">
          <p className="font-mono text-[12px] uppercase tracking-wideish text-amber-300">
            local admin server offline
          </p>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-paper/80">
            Saving needs the local server. Run{' '}
            <span className="font-mono text-[12px] text-paper">node admin-server.mjs</span> in{' '}
            <span className="font-mono text-[12px] text-paper">syed-portfolio</span> and open{' '}
            <span className="font-mono text-[12px] text-paper">http://127.0.0.1:4173/#/admin</span>.
          </p>
        </div>
      )}

      {tab === 'words' && <WordsTab />}
      {tab === 'pictures' && <PicturesTab />}
      {tab === 'sections' && <SectionsTab />}
      {tab === 'concept' && <ConceptTab />}
    </main>
  )
}
