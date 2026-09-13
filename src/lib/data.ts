import { getCollection } from 'astro:content';
import github from '../generated/github.json';

interface GithubData {
  projects: Array<{
    name: string;
    description: string | null;
    url: string;
    homepage: string | null;
    topics: string[];
    language: string | null;
    stars: number;
    readmeHtml: string | null;
  }>;
  stats: {
    publicRepoCount: number | null;
    totalContributions: number | null;
    pullRequestContributions: number | null;
    accountYears: number | null;
    contributionCalendar: {
      weeks: Array<{
        firstDay: string;
        contributionDays: Array<{ contributionCount: number }>;
      }>;
    };
  };
}

const githubData = github as unknown as GithubData;

export async function getProfile() {
  const [entry] = await getCollection('profile');
  if (!entry) throw new Error('Profile content is missing');
  return entry.data;
}

export async function getResume() {
  const [entry] = await getCollection('resume');
  if (!entry) throw new Error('Résumé content is missing');
  return entry.data;
}

export async function getJournal() {
  const entries = await getCollection('journal', ({ data }) => !data.draft);
  return entries.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export async function getProjects() {
  const custom = await getCollection('projects');
  const customProjects = custom.filter((entry) => !entry.data.hidden).map((entry) => ({
    source: 'custom' as const,
    slug: entry.id.replace(/\.(md|mdx)$/, ''),
    title: entry.data.title,
    summary: entry.data.summary,
    role: entry.data.role,
    problem: entry.data.problem || '',
    outcome: entry.data.outcome || entry.data.achievement || '',
    duration: entry.data.duration || '',
    tech: entry.data.technologies,
    links: entry.data.links,
    featured: entry.data.featured,
    order: entry.data.order,
    cover: entry.data.cover || '',
    coverAlt: entry.data.coverAlt || '',
    readmeHtml: '',
    entry,
  }));

  const customUrls = new Set(
    customProjects.flatMap((project) => project.links.map((link) => link.url.toLowerCase())),
  );

  const githubProjects = githubData.projects
    .filter((repo) => !customUrls.has(repo.url.toLowerCase()))
    .map((repo, index) => ({
      source: 'github' as const,
      slug: slugify(repo.name),
      title: humanize(repo.name),
      summary: repo.description || 'Open-source project on GitHub.',
      role: 'Creator and maintainer',
      problem: '',
      outcome: repo.stars > 0 ? `${repo.stars} GitHub star${repo.stars === 1 ? '' : 's'}` : '',
      duration: '',
      tech: [repo.language, ...repo.topics].filter(Boolean) as string[],
      links: [
        { label: 'GitHub', url: repo.url },
        ...(repo.homepage ? [{ label: 'Live site', url: repo.homepage }] : []),
      ],
      featured: false,
      order: 100 + index,
      cover: '',
      coverAlt: '',
      readmeHtml: repo.readmeHtml || '',
      entry: null,
    }));

  return [...customProjects, ...githubProjects].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order,
  );
}

export function getGithubStats() {
  const weeks = githubData.stats.contributionCalendar.weeks.map((week) => ({
    firstDay: week.firstDay,
    count: week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0),
  }));

  return {
    publicRepoCount: githubData.stats.publicRepoCount,
    totalContributions: githubData.stats.totalContributions,
    pullRequestContributions: githubData.stats.pullRequestContributions,
    accountYears: githubData.stats.accountYears,
    weeks,
  };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function humanize(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
