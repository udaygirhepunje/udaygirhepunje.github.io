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
    forks?: number;
    pushedAt?: string;
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

  const cleanUrl = (url: string) => url.toLowerCase().replace(/\/+$/, '');
  const githubByUrl = new Map(
    githubData.projects.map((repo) => [cleanUrl(repo.url), repo]),
  );

  const customProjects = custom.filter((entry) => !entry.data.hidden).map((entry) => {
    const ghLink = entry.data.links.find(
      (link) => link.label.toLowerCase() === 'github' || link.url.includes('github.com'),
    );
    const ghRepo = ghLink ? githubByUrl.get(cleanUrl(ghLink.url)) : undefined;

    return {
      source: 'custom' as const,
      slug: entry.id.replace(/\.(md|mdx)$/, ''),
      title: entry.data.title,
      summary: entry.data.summary,
      role: entry.data.role,
      problem: entry.data.problem || '',
      outcome: entry.data.outcome || entry.data.achievement || (ghRepo && ghRepo.stars > 0 ? `${ghRepo.stars} GitHub star${ghRepo.stars === 1 ? '' : 's'}` : ''),
      duration: entry.data.duration || '',
      tech: entry.data.technologies,
      links: entry.data.links,
      featured: entry.data.featured,
      order: entry.data.order,
      cover: entry.data.cover || '',
      coverAlt: entry.data.coverAlt || '',
      readmeHtml: ghRepo?.readmeHtml || '',
      stars: ghRepo?.stars,
      forks: ghRepo?.forks,
      pushedAt: ghRepo?.pushedAt,
      githubUrl: ghRepo?.url || ghLink?.url,
      entry,
    };
  });

  const customUrls = new Set(
    customProjects.flatMap((project) => project.links.map((link) => cleanUrl(link.url))),
  );

  const githubProjects = githubData.projects
    .filter((repo) => !customUrls.has(cleanUrl(repo.url)))
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
      stars: repo.stars,
      forks: repo.forks,
      pushedAt: repo.pushedAt,
      githubUrl: repo.url,
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
