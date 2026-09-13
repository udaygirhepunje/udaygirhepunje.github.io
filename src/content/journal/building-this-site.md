---
title: Building this site
description: Why I chose a static Astro site, native browser transitions, modern CSS, and a small file-based CMS.
type: article
publishedAt: 2026-09-06
cover: /media/building-this-site.jpg
coverAlt: Overlapping cream paper sheets with hairline rules, a navy circle stamp, and a bone folder.
tags:
  - Astro
  - CSS
  - portfolio
draft: false
---

I wanted a portfolio that I could keep current without turning it into another application to maintain. The pages are static. The content is in git. The interesting parts come from the browser.

## Why Astro

Most pages on this site are documents. A project page needs a title, a case study, and a README. An article needs readable HTML. Neither needs a React runtime.

Astro gives me content collections with schemas and renders the result to HTML. JavaScript is limited to the theme switch, filters, and fallbacks for browser features. That keeps the first response useful on a slow phone and makes a broken script less dramatic.

## Content without a server

Pages CMS is the editor. It writes YAML, Markdown, and media files into this repository. GitHub Actions builds those files and deploys them to GitHub Pages.

There is no content database to export later. Removing the CMS would remove the editor, not the content.

Public repositories tagged `portfolio` are read during the build. Their names, links, languages, topics, and READMEs stay current without a component edit. Case-study copy remains curated because a repository description is not a hiring story.

## View Transitions, with an exit

The site opts into native cross-document View Transitions. A project title keeps its identity as navigation moves from the list to the detail page. Browsers that support it draw the morph. Other browsers perform a normal navigation.

The theme switch uses `document.startViewTransition` for a short color wipe. The code checks that the method exists first. Reduced-motion uses the same instant path as an unsupported browser.

That fallback is important. Navigation cannot depend on an animation API.

## CSS I could use for real

The palette is written in hex first, then upgraded to `oklch()` inside `@supports`. Titles use `text-wrap: balance`. Body introductions use `text-wrap: pretty`. Ignoring either property still produces readable text.

The project list uses a view timeline for a small entry shift. Without `animation-timeline`, it is simply a list. Image overlays use the Popover API where available, with a dialog path behind it.

| Feature | Supported browser | Fallback |
| --- | --- | --- |
| Cross-document View Transitions | Shared project and article motion | Normal page navigation |
| `oklch()` and `light-dark()` | Perceptual color tokens | Hex tokens and a theme class |
| `animation-timeline: view()` | Short list-entry motion | Static rows |
| Popover and `@starting-style` | Animated top-layer overlay | Dialog with instant open |
| `text-wrap: balance` and `pretty` | Cleaner headings and paragraphs | Normal wrapping |

## Build output

The same résumé YAML renders the about page and an A4 PDF. A build-only Playwright pass adds the private phone number to the PDF, captures Open Graph cards, then removes the print HTML from the deployed files.

GitHub's API supplies the activity figures. If it is unavailable, those figures disappear. The site does not substitute made-up counts.

This is a first release. The useful test is whether someone can tell what I do, inspect the work, and download the résumé without learning how the site works.
