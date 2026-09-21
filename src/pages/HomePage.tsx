import Hero from '../components/Hero'
import KineticMarquee from '../components/KineticMarquee'
import PipelineStrip from '../components/PipelineStrip'
import WhatIBuild from '../components/WhatIBuild'
import BrandsSection from '../components/BrandsSection'
import WorkGrid from '../components/WorkGrid'
import AssetFamily from '../components/AssetFamily'
import ShowcaseSection from '../components/ShowcaseSection'
import ConceptImagesSection from '../components/ConceptImagesSection'
import CharacterSection from '../components/CharacterSection'
import Capabilities from '../components/Capabilities'
import WorkflowsSection from '../components/WorkflowsSection'
import CraftSection from '../components/CraftSection'
import About from '../components/About'
import CtaBand from '../components/CtaBand'
import { useRuntime } from '../data/runtime'
import { useBrandListOV } from '../data/overrides'
import { brandHasContent } from '../data/brands'
import type { ReactNode } from 'react'

// Home order (video-first build): hero → the production pipeline strip → logo
// ticker → video concepts (showcase) → character consistency → AI × e-commerce
// concept images → what-i-solve → case studies → one product / many assets →
// systems → workflow + stack → craft → brands → about → contact.
//
// The admin "sections" tab controls visibility AND order: when
// content.sectionOrder.home exists it is authoritative (only listed sections
// render, in that order). Otherwise the legacy pageSections hide-list applies.
export default function HomePage() {
  const { content } = useRuntime()
  const order = content?.sectionOrder?.home
  const hidden = content?.pageSections ?? []
  const brands = useBrandListOV()

  const all: { k: string; node: ReactNode }[] = [
    { k: 'hero', node: <Hero key="hero" /> },
    { k: 'pipeline', node: <PipelineStrip key="pipeline" /> },
    {
      k: 'marquee',
      node: (
        // red logo ticker: brand logos as white chips on two lines moving in
        // opposite directions (hover pauses the scroll, see .marquee:hover).
        // Brands with media lead the line and open on click; the rest stay as
        // texture. Brands without a logo fall back to the name.
        <KineticMarquee
          key="marquee"
          variant="red"
          rows={2}
          speed={26}
          items={brands.map((b) => ({
            label: b.name,
            img: b.logo,
            ...(brandHasContent(b, content) ? { to: `#/brand/${b.slug}` } : {}),
          }))}
        />
      ),
    },
    { k: 'showcase', node: <ShowcaseSection key="showcase" /> },
    { k: 'character', node: <CharacterSection key="character" /> },
    { k: 'concept-images', node: <ConceptImagesSection key="concept-images" /> },
    { k: 'whatibuild', node: <WhatIBuild key="whatibuild" /> },
    { k: 'workgrid', node: <WorkGrid key="workgrid" /> },
    { k: 'assets', node: <AssetFamily key="assets" /> },
    { k: 'capabilities', node: <Capabilities key="capabilities" /> },
    { k: 'workflows', node: <WorkflowsSection key="workflows" /> },
    { k: 'craft', node: <CraftSection key="craft" /> },
    { k: 'brands', node: <BrandsSection key="brands" compact /> },
    { k: 'about', node: <About key="about" /> },
    { k: 'contact', node: <CtaBand key="contact" /> },
  ]

  const visible = order
    ? (order
        .map((k) => all.find((s) => s.k === k))
        .filter(Boolean) as { k: string; node: ReactNode }[])
    : all.filter((s) => !hidden.includes(s.k))

  return <>{visible.map((s) => s.node)}</>
}
