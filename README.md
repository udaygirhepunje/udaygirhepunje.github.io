# udaygirhepunje.github.io

Uday Girhepunje's static portfolio. Astro builds the site. Pages CMS edits the content. GitHub Actions refreshes repository data, creates the résumé PDF and Open Graph images, then deploys to GitHub Pages.

## Edit content without code

1. Open [Pages CMS](https://app.pagescms.org).
2. Sign in with GitHub and install the Pages CMS GitHub App for this repository.
3. Open one of the forms:
   - Profile for headline, contact links, and open-to-work.
   - Résumé for experience, education, and skills.
   - Projects for custom projects and case-study copy.
   - Journal for articles, photographs, and artwork.
4. Save. Pages CMS commits to `master`; the deploy workflow publishes the change.

Uploaded files live in `public/media`. All authored content remains in git.

## Add a GitHub project

Add the `portfolio` topic to a public repository owned by `udaygirhepunje` or `uday-appdirect`. The scheduled workflow picks it up within six hours. To publish sooner, open Actions, choose **Deploy portfolio**, then **Run workflow**.

GitHub owns the repository name, README, language, topics, stars, and links. Add a CMS project entry with the same GitHub URL when you need a custom role, outcome, cover, or description. The CMS copy wins.

## Work locally

Requires Node 24.

```sh
npm install
npm run dev
```

`npm run build` refreshes public repository data and builds `dist`. Contribution figures require `GITHUB_TOKEN`; without it, those sections hide.

```sh
GITHUB_TOKEN="$(gh auth token)" npm run build
npm run check
```

To create the PDF and share images after a build:

```sh
npx playwright install chromium
npm run generate:assets
```

## Content files

- `src/content/settings/profile.yml`
- `src/content/settings/resume.yml`
- `src/content/projects/*.md`
- `src/content/journal/*.md`
- `.pages.yml`

The generated PDF comes from the résumé YAML. The phone number is injected into the PDF during generation and is not shipped in the public résumé HTML.
