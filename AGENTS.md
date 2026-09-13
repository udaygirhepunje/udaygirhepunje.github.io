# Agent notes

This is Uday Girhepunje's public portfolio at `udaygirhepunje.github.io`. Recruiter-first: a hiring manager should learn who he is, see work with numbers, and download a résumé. Personal journal sits last on the home page. The build is static Astro. There is no application server.

Commands, CMS login, and local setup live in `README.md` and `package.json`. This file is the unwritten contract.

## Content or chrome

Decide which you are changing before you open files.

- **Content** is profile, résumé, projects, journal, and media. It lives in git as YAML and Markdown. Pages CMS is the editor. After a content-only change, the site still builds from those files.
- **Chrome** is layout, type, motion, and ingestion. It lives in `src/`, `scripts/`, and `.github/workflows/`.

Done when the change has one owner: a content file, or a component. Mixing a one-off string into a `.astro` file when `profile.yml` already holds it is the wrong owner.

## Map

```
src/content/settings/   profile.yml, resume.yml
src/content/projects/   curated case studies (Markdown)
src/content/journal/    articles, photography, artwork, notes
src/lib/data.ts         merges CMS projects with GitHub ingest
src/generated/          github.json at build time, gitignored
src/pages/              routes, including /og/* and /resume/print
src/layouts/            BaseLayout, OgLayout
src/components/         Header, lists, TOC, lightbox
src/styles/global.css   tokens, type scale, theme, view transitions
public/media/           uploads
.pages.yml              Pages CMS forms (keep in lockstep with content.config.ts)
scripts/                GitHub sync, PDF and OG generation, browser smoke
```

`udaygirhepunje` (personal) and `uday-appdirect` (work) are the tracked GitHub users. Public repos tagged `portfolio` from either account are ingested on build and on the six-hour Actions schedule. Contribution metrics, calendars, PRs, and public repo counts are aggregated across both accounts.

## Content rules

GitHub owns repo name, README, language, topics, stars, and links. A CMS project with the same GitHub URL wins for role, outcome, cover, and copy.

Résumé YAML is the source of truth for experience, skills, and claims. Site copy and the generated PDF both read it. The phone number is PDF-only: inject it in `scripts/generate-build-assets.ts`, never render it in public HTML.

Journal `type` is `article`, `photography`, `artwork`, or `note`. Covers live under `/media/` with `coverAlt`. Drafts stay out of listings.

New CMS fields need the Zod schema in `src/content.config.ts` and the matching field in `.pages.yml` in the same change.

When GitHub stats are missing, hide the figures. Do not invent counts.

## Print folio

Paper, ink, hairline rules, tracked mono labels, serif display. Quiet, not loud.

- Instrument Serif: display, page titles, ledes, figures.
- IBM Plex Sans: body.
- IBM Plex Mono: eyebrows, nav, tags, buttons.

Load Latin subsets only. Preload those files from `BaseLayout`. Dark theme is `html.theme-dark` plus hex tokens first, `oklch()` and `light-dark()` inside `@supports`.

Home name uses `.display`. Every other H1 uses `.page-title`. Section heads use `.section-title`. List rows use `--type-list`. Intros use `.lede`. Stats and the footer email use `--type-figure`. Labels use `--type-label`.

New sizes go on the `:root` type tokens in `src/styles/global.css`. Page CSS consumes the tokens. Titles wrap on the line. Do not cap them with tiny `ch` widths.

Projects and journal entries are documents with URLs, OG images, and case-study fields. They are pages, not modals.

## Progressive enhancement

Every new browser feature ships with a path that still reads and navigates.

| Feature | Fallback |
| --- | --- |
| Cross-document View Transitions | Normal navigation |
| Theme wipe via `startViewTransition` | Instant class toggle |
| `oklch()` / `light-dark()` | Hex tokens and `theme-dark` |
| `animation-timeline: view()` | Static list |
| Popover lightbox | `<dialog>` |
| `prefers-reduced-motion` | Instant, no wipe |

`mix-blend-mode: normal` and `animation-fill-mode: forwards` on the theme wipe are required so the last clipped frame holds until the transition ends.

Theme toggle: half-circle glyph, larger hit target than the old character. Dark expands out of the button. Light contracts back into it. The glyph stays put.

Journal TOC (`TableOfContents.astro`) marks the heading in view with `aria-current="location"`. Links still work with JavaScript off.

## Copy

Site prose is Uday's voice: specific, numbered when the résumé has a number, no puffery. Sentence-case headings. Straight quotes. Follow the workspace unslop rule for anything the visitor reads.

## Verify

UI, layout, routing, or rendered data: exercise the flow in the browser, including the other routes that share the state you touched. `npm run check` for types. `npm run test:browser` after a production `dist` when the change affects pages or fallbacks.

Contribution charts and GitHub project cards need `GITHUB_TOKEN` locally. Without it those blocks omit, which is expected.
