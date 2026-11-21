---
title: gitInsights
summary: A zero-server developer identity dashboard running Git analytics,
  streak tracking, and work-life balance audits entirely in the browser.
role: Creator and architect
problem: Developers lack visibility into their own contribution habits across
  public and private repositories without relying on invasive manager-facing
  dashboards.
outcome: Shipped a client-side dashboard with 53-week heatmaps, streak tracking,
  and Web Worker compute with zero user data stored on an application server.
duration: 2 months
technologies:
  - React
  - TypeScript
  - Vite
  - Mantine UI
  - TanStack Query
  - Zustand
  - Octokit
  - IndexedDB
  - Web Workers
links:
  - label: See Live
    url: https://udaygirhepunje.github.io/gitInsights/
  - label: GitHub
    url: https://github.com/udaygirhepunje/gitInsights
featured: true
hidden: false
order: 2
---
I built gitInsights as a zero-server developer identity dashboard. It gives developers visibility into their contribution patterns, 53-week commit heatmaps, streak tracking, and work-life balance metrics without productivity theater.

All data is fetched with GitHub OAuth and cached locally in IndexedDB. Metric calculations run inside client-side Web Workers, ensuring no user code or activity data touches an external server.