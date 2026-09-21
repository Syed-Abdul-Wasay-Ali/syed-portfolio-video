// ---------------------------------------------------------------------------
// gen-ats-text.mjs, build-time generator for the portfolio's TEXT layer.
//
// WHY: the site is a React SPA, the served index.html has an empty #root,
// so anything that doesn't execute JavaScript (ATS systems, scrapers,
// preview bots, JS-disabled browsers) sees NO content at all. This script
// renders the portfolio's real content to plain semantic HTML and embeds it
// into index.html between the ATS-TEXT markers, inside <section
// id="portfolio-text">. That block is hidden the moment JS runs
// (html.js #portfolio-text{display:none}) and visible to everyone else,
// no flash for normal visitors, full text for machines.
//
// Runs automatically on every `npm run build` via the "prebuild" script,
// so it always matches the compiled site data + public/content.json.
//
// DO NOT hand-edit the generated block in index.html, it is replaced on
// every build. Edit the source data (src/data/*) or this script instead.
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INDEX = path.join(ROOT, 'index.html')
const CONTENT = path.join(ROOT, 'public', 'content.json')
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'ats')
const START = '<!--ATS-TEXT-START-->'
const END = '<!--ATS-TEXT-END-->'
const SITE_URL = 'https://syed-abdul-wasay-ali.github.io/syed-portfolio-video/'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// ---- 1. compile + load the site's data modules (plain TS, no React) -------
// These data files are pure (no runtime imports), so compiling each with the
// project's own TypeScript (no extra dependency) yields self-contained ESM.
const TSOUT = path.join(CACHE, 'ts')
fs.rmSync(TSOUT, { recursive: true, force: true })
fs.mkdirSync(TSOUT, { recursive: true })
const tscBin = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
const dataFiles = ['projects.ts', 'showcase.ts', 'brands.ts', 'workflows.ts', 'text.ts', 'social.ts', 'character.ts'].map((f) =>
  path.join('src', 'data', f)
)
const tsc = spawnSync(
  process.execPath,
  [
    tscBin,
    ...dataFiles,
    '--outDir',
    TSOUT,
    '--module',
    'esnext',
    '--target',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--jsx',
    'preserve',
    '--skipLibCheck',
    '--noCheck',
    '--ignoreConfig',
  ],
  { cwd: ROOT, encoding: 'utf8' }
)
if (tsc.status !== 0) {
  console.error('[gen-ats-text] tsc failed:\n' + (tsc.stdout || '') + (tsc.stderr || ''))
  process.exit(1)
}
const mod = (n) => import(pathToFileURL(path.join(TSOUT, n)).href)
const [P, SH, BR, WF, TX, SOC, CH] = await Promise.all(
  ['projects.js', 'showcase.js', 'brands.js', 'workflows.js', 'text.js', 'social.js', 'character.js'].map(mod)
)
const D = {
  projectsByDate: P.projectsByDate,
  SHOWCASE: SH.SHOWCASE,
  BRANDS: BR.BRANDS,
  WORKFLOWS: WF.WORKFLOWS,
  CHARACTER: CH.CHARACTER,
  DEF: TX.DEF,
  DEF_LIST: TX.DEF_LIST,
  EMAIL: SOC.EMAIL,
  LINKEDIN_URL: SOC.LINKEDIN_URL,
  GITHUB_URL: SOC.GITHUB_URL,
  RESUME_URL: SOC.RESUME_URL,
}

// ---- 2. runtime overrides (public/content.json) ----------------------------
let content = {}
try {
  content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'))
} catch {
  /* no runtime file, compiled defaults still apply */
}
const texts = content.texts || {}
const removedSet = new Set([...(content.removedMedia || []), ...(content.removedProjects || [])])
const removedProjects = new Set((content.removedProjects || []).map((s) => String(s).replace(/^project:/, '')))
const T = (k) => {
  const t = texts[k]
  if (typeof t === 'string' && t.trim()) return t
  return D.DEF.get(k) ?? ''
}
const TL = (k) => {
  const t = texts[k]
  if (Array.isArray(t) && t.length) return t
  return D.DEF_LIST.get(k) ?? []
}

// ---- 3. build the text fragment --------------------------------------------
const out = []
const p = (s) => out.push(s)

p('<section id="portfolio-text" aria-label="Text version of this portfolio">')
p(`<h1>${esc(T('site.title'))}</h1>`)
p(
  `<p>${esc(T('header.name'))}, ${esc(T('header.tagline'))}. Text version of the interactive portfolio (images &amp; video). Full site: <a href="${esc(SITE_URL)}">${esc(SITE_URL)}</a></p>`
)
p(
  `<p>${esc(T('hero.introLead'))} Ogilvy ${esc(T('hero.introMid'))} cleanDirty.ai${esc(T('hero.introTail'))}</p>`
)
p(`<p>${esc(T('hero.keywords'))}</p>`)
p(
  `<p>Contact: <a href="mailto:${esc(D.EMAIL)}">${esc(D.EMAIL)}</a> · <a href="${esc(D.LINKEDIN_URL)}">LinkedIn</a> · <a href="${esc(D.GITHUB_URL)}">GitHub</a> · <a href="${esc(D.RESUME_URL)}">Resume (PDF)</a></p>`
)

// about
p('<h2>About</h2>')
for (const k of ['about.p1', 'about.p2', 'about.p3', 'about.p4']) p(`<p>${esc(T(k))}</p>`)

// experience
const jobs = []
for (let i = 1; i <= 6; i++) {
  const role = T(`about.t${i}.role`)
  if (!role) break
  jobs.push({
    role,
    org: T(`about.t${i}.org`),
    location: T(`about.t${i}.location`),
    dates: T(`about.t${i}.dates`),
    note: T(`about.t${i}.note`),
    bullets: TL(`about.t${i}.bullets`),
  })
}
if (jobs.length) {
  p(`<h2>${esc(T('about.exp'))}</h2>`)
  for (const j of jobs) {
    p(`<h3>${esc(j.role)}, ${esc(j.org)}</h3>`)
    p(`<p class="pt-meta">${esc(j.location)} ${esc(j.dates)}</p>`)
    if (j.note) p(`<p>${esc(j.note)}</p>`)
    if (j.bullets.length) p(`<ul>${j.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`)
  }
}

// skills
const skillGroups = []
for (let i = 1; i <= 8; i++) {
  const label = T(`about.sg${i}.label`)
  const items = TL(`about.sg${i}.items`)
  if (!label && !items.length) break
  skillGroups.push({ label, items })
}
if (skillGroups.length) {
  p('<h2>Skills</h2><ul>')
  for (const g of skillGroups) p(`<li><strong>${esc(g.label)}:</strong> ${esc(g.items.join(', '))}</li>`)
  p('</ul>')
}

// what i solve
const solve = []
for (let i = 1; i <= 8; i++) {
  const title = T(`whatibuild.${i}.title`)
  if (!title) break
  solve.push({ title, desc: T(`whatibuild.${i}.desc`) })
}
if (solve.length) {
  p(`<h2>${esc(T('whatibuild.title'))}</h2>`)
  p(`<p>${esc(T('whatibuild.sub'))}</p><ul>`)
  for (const s of solve) p(`<li><strong>${esc(s.title)}</strong>, ${esc(s.desc)}</li>`)
  p('</ul>')
}

// craft controls
const craft = []
for (let i = 1; i <= 8; i++) {
  const term = T(`craft.p${i}.term`)
  if (!term) break
  craft.push({ term, line: T(`craft.p${i}.line`) })
}
if (craft.length) {
  p(`<h2>${esc(T('craft.title'))}</h2>`)
  p(`<p>${esc(T('craft.sub'))}</p><ul>`)
  for (const c of craft) p(`<li><strong>${esc(c.term)}</strong>, ${esc(c.line)}</li>`)
  p('</ul>')
}

// case studies
const kept = D.projectsByDate.filter((pr) => !removedProjects.has(pr.slug))
p(`<h2>Selected work, case studies (${kept.length})</h2>`)
for (const pr of kept) {
  p(`<h3>${esc(pr.title)}</h3>`)
  const meta = [pr.role, pr.company, pr.year, pr.status].filter(Boolean).join(' · ')
  p(`<p class="pt-meta">${esc(meta)}</p>`)
  if (pr.subtitle) p(`<p class="pt-meta">${esc(pr.subtitle)}</p>`)
  p(`<p>${esc(pr.excerpt)}</p>`)
  if (pr.spec?.length)
    p(`<p class="pt-meta">Spec: ${esc(pr.spec.slice(0, 8).map((s) => `${s.label}: ${s.value}`).join(' · '))}</p>`)
  if (pr.contribution?.length) p(`<p class="pt-meta">Contribution: ${esc(pr.contribution.join('; '))}</p>`)
  if (pr.stack?.length) p(`<p class="pt-meta">Stack: ${esc(pr.stack.join(', '))}</p>`)
  const labels = []
  for (const it of [...(pr.results || []), ...(pr.stages || []), ...(pr.workflow || [])]) {
    if (!it || !it.src || removedSet.has(it.src)) continue
    const l = it.label || it.hrefLabel
    if (l && !labels.includes(l)) labels.push(l)
  }
  if (labels.length)
    p(`<p class="pt-meta">Media: ${esc(labels.slice(0, 12).join(' · '))}${labels.length > 12 ? ' · …' : ''}</p>`)
  if (pr.campaign) p(`<p class="pt-meta">Campaign: <a href="${esc(pr.campaign.url)}">${esc(pr.campaign.label)}</a></p>`)
}

// concept images (home band), captions from runtime content
const concept = Array.isArray(content.conceptImages) ? content.conceptImages : []
const mainCaps = concept.filter((c) => c.group !== 'photos' && c.caption)
const photoCaps = concept.filter((c) => c.group === 'photos' && c.caption)
if (mainCaps.length || photoCaps.length) {
  p('<h2>Concept images, AI × e-commerce</h2>')
  if (mainCaps.length) p(`<ul>${mainCaps.map((c) => `<li>${esc(c.caption)}</li>`).join('')}</ul>`)
  if (photoCaps.length) {
    p('<h3>AI Product Photoshoot Images</h3>')
    p(`<ul>${photoCaps.map((c) => `<li>${esc(c.caption)}</li>`).join('')}</ul>`)
  }
}

// character consistency (home band), static list
if (D.CHARACTER.length) {
  p(`<h2>${esc(T('character.title'))}</h2>`)
  p(`<p>${esc(T('character.sub'))}</p><ul>`)
  for (const it of D.CHARACTER) if (it.caption) p(`<li>${esc(it.caption)}</li>`)
  p('</ul>')
}

// showcase
const show = [...D.SHOWCASE, ...(content.additions?.showcase || [])]
if (show.length) {
  p(`<h2>${esc(T('showcase.title'))}</h2>`)
  p(`<p>${esc(T('showcase.sub'))}</p><ul>`)
  for (const it of show) {
    const line = [it.title || it.label, it.note].filter(Boolean).join(', ')
    if (line) p(`<li>${esc(line)}</li>`)
  }
  p('</ul>')
}

// workflows
if (D.WORKFLOWS.length) {
  p('<h2>ComfyUI workflows</h2><ul>')
  for (const wf of D.WORKFLOWS) {
    const line = [wf.title, wf.note].filter(Boolean).join(', ')
    const outNote = wf.output?.label ? ` (output: ${wf.output.label})` : ''
    p(`<li>${esc(line + outNote)}</li>`)
  }
  p('</ul>')
}

// brands, all names (mirrors the site's brand ticker); notes only where media exists
if (D.BRANDS.length) {
  p(`<h2>${esc(T('brandssec.title'))}</h2>`)
  p(`<p>${esc(T('brandssec.sub').replace('{n}', String(D.BRANDS.length)))}</p><ul>`)
  for (const b of D.BRANDS) {
    const has = (b.images?.length || 0) + (b.animatics?.length || 0) + (b.films?.length || 0) > 0 || (b.projects?.length || 0) > 0
    p(`<li>${esc(b.name)}${has && b.note ? ', ' + esc(b.note) : ''}</li>`)
  }
  p('</ul>')
}

// contact
p('<h2>Contact</h2>')
p(`<p>${esc(T('contact.sub'))}</p>`)
p(
  `<p><a href="mailto:${esc(D.EMAIL)}">${esc(D.EMAIL)}</a> · <a href="${esc(D.LINKEDIN_URL)}">${esc(T('contact.row2.label'))}</a> · <a href="${esc(D.GITHUB_URL)}">GitHub</a> · <a href="${esc(D.RESUME_URL)}">${esc(D.RESUME_URL)}</a></p>`
)
p(`<p>${esc(T('contact.row3.label'))} ${esc(T('contact.row3.value'))}</p>`)
p('</section>')

const fragment = out.join('\n')

// ---- 4. inject into index.html between the markers --------------------------
const src = fs.readFileSync(INDEX, 'utf8')
const i = src.indexOf(START)
const j = src.indexOf(END)
if (i < 0 || j < 0) {
  console.error('[gen-ats-text] markers ' + START + ' / ' + END + ' not found in index.html, aborting')
  process.exit(1)
}
const next = src.slice(0, i + START.length) + '\n' + fragment + '\n    ' + src.slice(j)
if (next !== src) fs.writeFileSync(INDEX, next)

const words = fragment.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
console.log(
  `[gen-ats-text] text layer: ${(fragment.length / 1024).toFixed(1)} KB, ~${words} words, ` +
    `${kept.length} case studies, ${concept.length} concept captions, ${show.length} showcase, ` +
    `${D.WORKFLOWS.length} workflows, ${D.BRANDS.length} brands`
)
