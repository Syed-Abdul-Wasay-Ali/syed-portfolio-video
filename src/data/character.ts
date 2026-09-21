// ---------------------------------------------------------------------------
// Character consistency, home band 02 in the video-first build.
//
// One persona held across everything: character sheets built before a shot,
// character LoRAs trained in-house, de-age and 3D conversion workflows that
// keep the identity intact. Static list, not admin-managed: curated in the
// repo for the front page.
//
// HOW TO ADD MEDIA: drop files under public/media/ and fill `src` below.
// ---------------------------------------------------------------------------

export interface CharacterItem {
  id: string
  kind: 'image' | 'video'
  src: string
  poster?: string
  caption: string
}

// Grid order = array order: workflow artifacts first, delivered characters after.
export const CHARACTER: CharacterItem[] = [
  {
    id: 'ch1',
    kind: 'image',
    src: 'media/concept/workflow_character_sheet_hd.png',
    caption: 'Character sheet, one persona, every frame · qwen edit 2511',
  },
  {
    id: 'ch2',
    kind: 'image',
    src: 'media/concept/workflow_product_to_person_hd.png',
    caption: 'Product to person, same shoes onto the woman character · flux.2 klein edit',
  },
  {
    id: 'ch3',
    kind: 'image',
    src: 'media/brands/vi/stills/vi-fanfest-quiz-q2.jpg',
    caption: 'Cricky, one clay character, every match-day card · character LoRA on flux',
  },
  {
    id: 'ch4',
    kind: 'image',
    src: 'media/brands/vi/stills/vi-fanfest-quiz-x-12apr.jpg',
    caption: 'Cricky again, new scene, same face · character LoRA on flux',
  },
  {
    id: 'ch5',
    kind: 'image',
    src: 'media/ogilvy-cadbury-celebrations-memories/stills/cadbury-creating-memories-frame.png',
    caption: 'De-aged frame, schoolyard scene · SDXL + de-age LoRA + face swap',
  },
  {
    id: 'ch6',
    kind: 'image',
    src: 'media/ogilvy-cadbury-story-of-us-zoya-akhtar/stills/vday_f2088.png',
    caption: 'Real couples into 3D characters via the conversion app · SD 1.5 + ControlNet',
  },
]
