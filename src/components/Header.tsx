import { useEffect, useState } from 'react'
import LinkedInIcon from './LinkedInIcon'
import GitHubIcon from './GitHubIcon'
import ThemeSelect from './ThemeSelect'
import { LINKEDIN_URL, GITHUB_URL, RESUME_URL } from '../data/social'
import { useRuntime, useT } from '../data/runtime'

// Nav order mirrors the home page section order (video concepts first, character
// consistency next, brands last).
// `section` maps to the home section key used by the admin's section manager.
const LINKS = [
  { href: '#showcase', section: 'showcase', labelKey: 'nav.showcase', label: 'Showcase' },
  { href: '#character', section: 'character', labelKey: 'nav.character', label: 'Character' },
  { href: '#concept-images', section: 'concept-images', labelKey: 'nav.concepts', label: 'Editing' },
  { href: '#work', section: 'workgrid', labelKey: 'nav.work', label: 'Work' },
  { href: '#capabilities', section: 'capabilities', labelKey: 'nav.systems', label: 'Systems' },
  { href: '#workflows', section: 'workflows', labelKey: 'nav.workflows', label: 'Workflows' },
  { href: '#brands', section: 'brands', labelKey: 'nav.brands', label: 'Brands' },
  { href: '#about', section: 'about', labelKey: 'nav.about', label: 'About' },
]

const NAV_SECTIONS = LINKS.map((l) => l.section)

export default function Header() {
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)
  const { content } = useRuntime()
  const t = useT()
  const order = content?.sectionOrder?.home
  // sectionOrder (admin v2) wins when present; pageSections is the legacy hide-list
  const hidden = order
    ? NAV_SECTIONS.filter((k) => !order.includes(k))
    : (content?.pageSections ?? [])
  const conceptCount = content?.conceptImages?.length ?? 0
  const links = LINKS.filter(
    (l) =>
      !hidden.includes(l.section) &&
      (l.href !== '#concept-images' || conceptCount > 0),
  )
  const resumeUrl = t('social.resume', RESUME_URL)
  const linkedinUrl = t('social.linkedin', LINKEDIN_URL)
  const githubUrl = t('social.github', GITHUB_URL)

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      setProgress(max > 0 ? Math.min(1, doc.scrollTop / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // close the mobile menu whenever the hash changes (link tapped)
  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  return (
    <header className="site-header fixed inset-x-0 top-0 z-40 border-b border-green/30 bg-canvas/85 backdrop-blur">
      {/* magenta strip */}
      <div aria-hidden="true" className="header-strip absolute inset-x-0 top-0 h-[3px] bg-green" />
      <div className="container-site flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <ThemeSelect />
        <a href="#/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span aria-hidden="true" className="disc h-2 w-2" />
          <span className="flex flex-col leading-none">
            <span className="whitespace-nowrap font-display text-base tracking-tight text-paper">
              {t('header.name')}
            </span>
            <span className="mt-1 hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-wideish text-violet md:inline">
              {t('header.tagline')}
            </span>
          </span>
          </a>
        </div>

        {/* desktop nav */}
        <nav className="hidden items-center gap-4 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="glitch-link font-mono text-[11px] uppercase tracking-wideish text-muted transition-colors"
            >
              {t(l.labelKey, l.label)}
            </a>
          ))}
          <a
            href="#/admin"
            className="rounded-md border border-ink-500 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wideish text-muted transition-colors hover:border-greenBright hover:text-greenReadable"
          >
            {t('header.admin')}
          </a>
          <a href={resumeUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5">
            {t('header.resume')}
          </a>
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !py-1.5"
            aria-label="View LinkedIn profile"
          >
            <LinkedInIcon className="h-3.5 w-3.5" />
            {t('header.linkedin')}
          </a>
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !px-2.5 !py-1.5"
            aria-label="GitHub profile"
          >
            <GitHubIcon className="h-4 w-4" />
          </a>
        </nav>

        {/* mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-green/30 text-paper transition-colors hover:border-greenBright hover:text-greenReadable md:hidden"
        >
          <span className="relative block h-3.5 w-5">
            <span
              className={`absolute left-0 top-0 h-[2px] w-full bg-current transition-transform duration-200 ${
                open ? 'translate-y-[6px] rotate-45' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[6px] h-[2px] w-full bg-current transition-opacity duration-200 ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`absolute left-0 top-[12px] h-[2px] w-full bg-current transition-transform duration-200 ${
                open ? '-translate-y-[6px] -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </div>

      {/* mobile dropdown panel */}
      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-green/20 bg-canvas/95 backdrop-blur md:hidden"
        >
          <div className="container-site flex flex-col py-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 font-mono text-sm uppercase tracking-wideish text-paper transition-colors hover:text-greenReadable"
              >
                {t(l.labelKey, l.label)}
              </a>
            ))}
            <a
              href={resumeUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="btn-ghost mt-2 justify-center !py-2.5"
            >
              {t('header.resume')}
            </a>
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="btn-ghost mt-2 justify-center !py-2.5"
              aria-label="View LinkedIn profile"
            >
              <LinkedInIcon className="h-4 w-4" />
              {t('header.linkedin')}
            </a>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="btn-ghost mt-2 justify-center !py-2.5"
              aria-label="GitHub profile"
            >
              <GitHubIcon className="h-4 w-4" />
              github
            </a>
            <a
              href="#/admin"
              onClick={() => setOpen(false)}
              className="mt-2 justify-center rounded-md border border-ink-500 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wideish text-muted transition-colors hover:border-greenBright hover:text-greenReadable"
            >
              {t('header.admin')}
            </a>
          </div>
        </nav>
      )}

      {/* scroll progress */}
      <div
        aria-hidden="true"
        className="header-progress absolute bottom-0 left-0 h-[2px] bg-green transition-[width] duration-150 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </header>
  )
}
