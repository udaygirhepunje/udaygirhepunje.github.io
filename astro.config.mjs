import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkGithubAlerts from 'remark-github-alerts';

export default defineConfig({
  site: 'https://udaygirhepunje.github.io',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/og/') && !page.includes('/resume/print/'),
    }),
  ],
  markdown: {
    remarkPlugins: [remarkGithubAlerts],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
