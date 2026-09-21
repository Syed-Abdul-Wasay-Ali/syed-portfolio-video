import { useState } from 'react'
import { useT } from '../data/runtime'
import type { MediaItem } from '../data/projects'
import { CHARACTER } from '../data/character'
import MediaPanel from './MediaPanel'
import Lightbox from './Lightbox'
import Reveal from './Reveal'

// Character consistency, home band 02 in the video-first build.
// Workflow artifacts plus delivered characters that had to stay themselves:
// character sheets, trained character LoRAs, de-age and conversion passes.
// The list is static in src/data/character.ts (files under public/media/).
export default function CharacterSection() {
  const t = useT()

  const [lightbox, setLightbox] = useState<number | null>(null)

  // Renders nothing until there is real media, no empty grids.
  if (CHARACTER.length === 0) return null

  const shown = CHARACTER.map((m) => ({
    id: m.id,
    kind: m.kind,
    src: m.src,
    label: m.caption || 'character tile',
    title: m.caption || '',
  }))

  return (
    <section id="character" className="scroll-mt-16 py-10 sm:py-12">
      <div className="container-site">
        <div className="max-w-2xl">
          <p className="eyebrow-green">{t('character.tag')}</p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
            {t('character.title')}
          </h2>
          <p className="mt-3 text-muted">{t('character.sub')}</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((item, i) => (
            <Reveal key={item.id} delay={(i % 4) * 70}>
              <button
                onClick={() => setLightbox(i)}
                className="tilt-3d panel disc-hover group block w-full text-left hover:border-green"
                data-tilt
                data-tilt-max="8"
              >
                <div className="relative">
                  <MediaPanel item={item} />
                </div>
                {item.title && (
                  <div className="border-t border-ink-600 p-3.5">
                    <h3 className="font-display text-base text-paper transition-colors group-hover:text-greenReadable">
                      {item.title}
                    </h3>
                  </div>
                )}
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox
          items={shown as MediaItem[]}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={(i) => setLightbox(i)}
        />
      )}
    </section>
  )
}
