# Syed Abdul Wasay Ali, Portfolio

A Behance-style portfolio for AI generation work: ComfyUI pipelines, custom LoRAs,
video workflows, and automation. Dark graphite + amber, monospaced workflow
metadata as the design signature.

**Stack:** Vite + React 19 + TypeScript + Tailwind CSS 3.4. Static output in `dist/`.

---

## Run locally

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # production build -> dist/
npm run preview    # serve the production build
```

Deploy `dist/` anywhere static: **Netlify**, **Vercel**, **GitHub Pages** (it uses
hash routing, so no server rewrites are needed).

## Live deployment (GitHub Pages)

- **Repo:** https://github.com/syed-abdul-wasay-ali/syed-portfolio (public)
- **Live URL:** https://syed-abdul-wasay-ali.github.io/syed-portfolio-video/
- Pages serves the `gh-pages` branch (built `dist/` content only).

Update the live site:

```bash
npm run build            # rebuild dist/
npx gh-pages -d dist     # push dist/ to gh-pages branch -> live in ~1-2 min
```

Source (`main` branch) is pushed with:

```bash
git add -A && git commit -m "..." && git push
```

Note: `vite.config.ts` uses `base: './'` so built assets work on the Pages
sub-path. `server.py` serves `dist/` for local preview at http://127.0.0.1:4173.

---

## Admin panel, words / pictures / sections

Edit the entire portfolio (every word, every picture, every section) without
touching code:

```bash
node admin-server.mjs          # serves dist/ + the admin API
# open http://127.0.0.1:4173/#/admin   (passcode lives in src/pages/AdminPage.tsx)
```

Four tabs:

- **words**, every string on the site: hero, section copy, footer, plus each
  case study (title, overview, production notes, spec values, captions…) and
  each brand (name, note, story). Field overrides are stored in
  `content.json → texts`; the compiled defaults live in `src/data/text.ts`.
  “reset” returns a field to its default; emptying a field hides that element.
- **pictures**, replace any image/video in place (same filename; previous
  file backed up under `.admin-backups/`), hide/restore gallery items, and add
  new pictures to case studies / showcase / brands. Covers every slot: home
  bands, case-study covers + results + stages + before/after + formats +
  placements, brand logos + galleries, showcase, workflows, the résumé PDF and
  the social share image.
- **sections**, show/hide + reorder sections on the home page, brand pages
  and case-study pages (shared order per page type; per-brand toggles kept).
- **concept images**, the concept gallery (upload, caption, reorder, replace).

All edits save into `public/content.json` plus files under `public/media/`,
so the built site picks them up with no code changes. To publish, hit
**save & publish** at the top of the panel, it builds the site and pushes it
to GitHub Pages (~15 s), and the bar tells you when you're live. Or by hand:

```bash
npm run build && npx gh-pages -d dist
```

Notes:

- Saving needs the local server, the panel shows a warning banner when it
  isn’t running (the live gh-pages copy is read-only).
- After editing `admin-server.mjs`, restart the server process (it keeps the
  code it booted with).
- Replaced media keeps its filename; the local server sends `Cache-Control:
  no-store` so changes appear on reload.

---

## How to add a project

### 1. Drop your media in

```
public/media/<slug>/
├── cover.jpg               # card thumbnail (landscape, ~1280x800)
├── video/
│   ├── hero.mp4            # hero video (also referenced in results)
│   └── spot-02.mp4
├── stills/
│   ├── frame-01.jpg
│   └── frame-02.jpg
└── workflow/
    ├── ref2v.png           # ComfyUI workflow screenshots
    └── sampler-ab.png
```

Keep filenames short and English. Videos: mp4/webm. Images: jpg/png.

### 2. Add an entry in `src/data/projects.ts`

Copy one existing object, change the fields:

- `slug`, url-safe name, matches the media folder
- `title`, `company` (`'cleanDirty.ai'` | `'Ogilvy'`), `role`, `year`
- `cover`, `/media/<slug>/cover.jpg`
- `spec`, the mono parameter strip (base model, sampler, steps, …). Real
  numbers sell the story, this is the site's signature element.
- `overview` / `challenge` / `approach`, the case-study narrative:
  what shipped, the obstacle, how you got past it (open-source first).
- `stack`, chips (models, nodes, tools).
- `workflow`, screenshots: `{ label: 'ref2v main graph', src: '/media/<slug>/workflow/ref2v.png' }`
- `results`, videos/images: `{ kind: 'video', label: '...', src: '...' }`

If you haven't added the media yet, leave `src` out, the site renders an
intentional node-graph placeholder with the label, so the layout always looks
finished.

### 3. Rebuild

```bash
npm run build
```

---

## How to add brand media

Brands live in `src/data/brands.ts` (16 brands pre-seeded). Each brand page
shows three galleries: **stills** (images), **animatics** (videos), **final
films** (videos).

### 1. Drop per-brand media in

```
public/media/brands/<slug>/
├── logo.png|svg|webp        # shown on a white tile (transparent bg ideal)
├── stills/
│   ├── kv-01.jpg
│   └── kv-02.jpg
├── animatic/
│   └── spot-15s.mp4
└── film/
    └── final-20s.mp4
```

Slugs: `cadbury-dairy-milk, milka, maaza, sunsilk, ponds, vaseline, castrol,
fevicol, ifb, tata-safari, parachute, daawat, tata-sky, venus, dove, himalaya,
nestle-ceregrow, colgate`.

### 2. Wire the media in `src/data/brands.ts`

For the matching brand, set `logo: '/media/brands/<slug>/logo.png'` and fill
`src` on the entries in `images` / `animatics` / `films` (keep the labels or
rename them). Unfilled entries show an intentional placeholder.

---

## How to add showcase media

Personal concept ads and images live in `src/data/showcase.ts` with a
filterable section on the home page (02, showcase).

### 1. Drop media in

```
public/media/showcase/
├── ads/            # concept ad spots (.mp4/.webm videos or .jpg/.png stills)
└── images/         # personal / experiment images (.jpg/.png)
```

### 2. Wire items in `src/data/showcase.ts`

Each item: `{ id, title, tag: 'concept-ad' | 'image', kind, src, label }`.
Set `src` to `/media/showcase/ads/spot-01.mp4` or
`/media/showcase/images/experiment-01.jpg`. Empty `src` renders an
intentional placeholder. `title` shows under the card and in the lightbox.

---

## How to add workflow demos

ComfyUI workflow screen recordings and their outputs live in
`src/data/workflows.ts` (their own home section (04) workflows).

### 1. Drop media in

```
public/media/workflows/
├── run.mp4          # workflow screen recordings (.mp4/.webm)
├── run-poster.jpg   # poster frame for the video
└── output.jpg       # run outputs (.jpg/.png), attach to the video item
```

### 2. Wire items in `src/data/workflows.ts`

Each item: `{ id, title, kind, src, label, note? }`. For videos also set
`poster` (a frame grab). Compress screen recordings before committing,
keep `public/media/` web-light (a ~30s 1280px recording lands near 1 MB
with `-crf 26 -movflags +faststart`, audio kept). Empty `src` renders an
intentional placeholder.

Outputs are ATTACHED to their video item via `output: { src, label? }`, a
small thumbnail sits on the tile corner and the lightbox shows the image
beside the video. Never add a run's output as a separate tile.

---

## Things to customize

Most copy now edits from the admin panel (see above), the files below hold
the compiled defaults that the admin overrides on top of:

- Footer email: `src/data/social.ts` (`EMAIL`); admin-editable default mirrored in `src/data/text.ts` (`social.email`)
- Bio copy: `src/components/About.tsx`, `src/components/Hero.tsx`
- Capabilities: `src/components/Capabilities.tsx`
- Demo case studies in `src/data/projects.ts` are sample text, replace with
  the real stories + real parameters for maximum credibility.

## Design notes

- Palette (cyberpunk Spider-Verse): deep indigo canvas `#0B0A1E` (surfaces
  `#171633`/`#131228`), cool white text `#F5F4FF` (muted `#9A98CF`), neon
  magenta accent `#FF36C8` (bright `#FF7DE0`, deep `#7A0F5C`), electric cyan
  `#00E5FF`, acid yellow `#FFE45C`. Header: indigo blur bar with a
  3px green top strip, green hairline border and green scroll-progress bar.
- Type: Archivo (display) / Instrument Sans (body) / IBM Plex Mono (metadata)
- Every card carries a mono "spec strip" with the real pipeline parameters,
  that's the signature. Keep it authentic: real model names, real samplers.
- Motion: hero scanline sweep + floating ambient orbs + staggered entrance,
  scroll-reveal (IntersectionObserver, `.reveal`), card hover glow + cover zoom,
  animated dashed node links + pulsing sockets, header scroll-progress bar,
  lightbox fade. All animations respect `prefers-reduced-motion`.
