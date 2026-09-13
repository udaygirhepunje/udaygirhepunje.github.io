import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const USERNAME = 'udaygirhepunje';
const OUTPUT_PATH = resolve('src/generated/github.json');
const API_TIMEOUT_MS = 15_000;

type Repository = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics: string[];
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  fork: boolean;
  pushed_at: string;
};

type ContributionWeek = {
  contributionDays: Array<{
    date: string;
    contributionCount: number;
    contributionLevel: string;
    weekday: number;
  }>;
  firstDay: string;
};

type GeneratedData = {
  schemaVersion: 1;
  username: string;
  projects: Array<{
    name: string;
    description: string | null;
    url: string;
    homepage: string | null;
    topics: string[];
    language: string | null;
    stars: number;
    forks: number;
    archived: boolean;
    pushedAt: string;
    readmeMarkdown: string | null;
    readmeHtml: string | null;
  }>;
  stats: {
    publicRepoCount: number | null;
    totalContributions: number | null;
    pullRequestContributions: number | null;
    accountYears: number | null;
    contributionYears: number[];
    contributionCalendar: {
      totalContributions: number | null;
      weeks: ContributionWeek[];
    };
  };
};

function emptyData(): GeneratedData {
  return {
    schemaVersion: 1,
    username: USERNAME,
    projects: [],
    stats: {
      publicRepoCount: null,
      totalContributions: null,
      pullRequestContributions: null,
      accountYears: null,
      contributionYears: [],
      contributionCalendar: {
        totalContributions: null,
        weeks: [],
      },
    },
  };
}

function githubHeaders(token?: string, accept = 'application/vnd.github+json') {
  return {
    Accept: accept,
    'User-Agent': `${USERNAME}-portfolio-build`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFetch<T>(url: string, token?: string, accept?: string): Promise<T> {
  const response = await fetch(url, {
    headers: githubHeaders(token, accept),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}

async function fetchRepositories(token?: string): Promise<Repository[]> {
  const repositories: Repository[] = [];

  for (let page = 1; ; page += 1) {
    const batch = await githubFetch<Repository[]>(
      `https://api.github.com/users/${USERNAME}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`,
      token,
      'application/vnd.github+json, application/vnd.github.mercy-preview+json',
    );
    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  return repositories;
}

async function fetchReadme(repository: Repository, token?: string) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository.full_name}/readme`,
      {
        headers: githubHeaders(token, 'application/vnd.github.raw+json'),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      },
    );
    if (response.status === 404) return { markdown: null, html: null };
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

    const markdown = await response.text();
    const rendered = marked.parse(markdown, { async: false }) as string;
    const html = sanitizeHtml(rendered, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'details',
        'summary',
        'picture',
        'source',
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        source: ['srcset', 'media', 'type'],
        code: ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowProtocolRelative: false,
      transformTags: {
        a: (_tagName, attributes) => ({
          tagName: 'a',
          attribs: {
            ...attributes,
            rel: 'noopener noreferrer',
          },
        }),
        img: (_tagName, attributes) => ({
          tagName: 'img',
          attribs: {
            ...attributes,
            loading: 'lazy',
          },
        }),
      },
    });

    return { markdown, html };
  } catch (error) {
    console.warn(`Could not fetch README for ${repository.full_name}:`, error);
    return { markdown: null, html: null };
  }
}

async function fetchPublicRepoCount(token?: string): Promise<number> {
  const user = await githubFetch<{ public_repos: number }>(
    `https://api.github.com/users/${USERNAME}`,
    token,
  );
  return user.public_repos;
}

async function fetchContributions(token: string) {
  const today = new Date();
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59),
  );
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  from.setUTCDate(from.getUTCDate() + 1);

  const query = `
    query PortfolioContributions($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        createdAt
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              firstDay
              contributionDays {
                date
                contributionCount
                contributionLevel
                weekday
              }
            }
          }
          totalPullRequestContributions
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        login: USERNAME,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      user: {
        createdAt: string;
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: number;
            weeks: ContributionWeek[];
          };
          totalPullRequestContributions: number;
        };
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length || !payload.data?.user) {
    throw new Error(payload.errors?.map(({ message }) => message).join('; ') || 'GitHub user not found');
  }

  const user = payload.data.user;
  const collection = user.contributionsCollection;
  const createdAt = new Date(user.createdAt);
  const accountYears = Math.max(
    0,
    to.getUTCFullYear() -
      createdAt.getUTCFullYear() -
      (Date.UTC(to.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate()) >
      to.getTime()
        ? 1
        : 0),
  );

  return {
    totalContributions: collection.contributionCalendar.totalContributions,
    pullRequestContributions: collection.totalPullRequestContributions,
    accountYears,
    contributionYears: [],
    contributionCalendar: {
      totalContributions: collection.contributionCalendar.totalContributions,
      weeks: [...collection.contributionCalendar.weeks]
        .sort((a, b) => a.firstDay.localeCompare(b.firstDay))
        .map((week) => ({
          firstDay: week.firstDay,
          contributionDays: [...week.contributionDays].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),
    },
  };
}

async function writeGeneratedData(data: GeneratedData) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const token = process.env.GITHUB_TOKEN?.trim() || undefined;
  const data = emptyData();

  try {
    const repositories = await fetchRepositories(token);
    const portfolioRepositories = repositories
      .filter(
        (repository) =>
          !repository.fork &&
          repository.topics.some((topic) => topic.toLowerCase() === 'portfolio'),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    data.projects = await Promise.all(
      portfolioRepositories.map(async (repository) => {
        const readme = await fetchReadme(repository, token);
        return {
          name: repository.name,
          description: repository.description,
          url: repository.html_url,
          homepage: repository.homepage || null,
          topics: [...repository.topics].sort((a, b) => a.localeCompare(b)),
          language: repository.language,
          stars: repository.stargazers_count,
          forks: repository.forks_count,
          archived: repository.archived,
          pushedAt: repository.pushed_at,
          readmeMarkdown: readme.markdown,
          readmeHtml: readme.html,
        };
      }),
    );
  } catch (error) {
    console.warn('Could not sync GitHub projects; projects will be empty:', error);
  }

  try {
    data.stats.publicRepoCount = await fetchPublicRepoCount(token);
  } catch (error) {
    console.warn('Could not fetch the public repository count:', error);
  }

  if (token) {
    try {
      Object.assign(data.stats, await fetchContributions(token));
    } catch (error) {
      console.warn('Could not fetch GitHub contribution data:', error);
    }
  } else {
    console.warn('GITHUB_TOKEN is not set; contribution data will be empty.');
  }

  await writeGeneratedData(data);
  console.log(`Wrote ${data.projects.length} portfolio project(s) to ${OUTPUT_PATH}`);
}

main().catch(async (error) => {
  console.error('GitHub sync failed before data could be written:', error);
  try {
    await writeGeneratedData(emptyData());
  } catch (writeError) {
    console.error('Could not write fallback GitHub data:', writeError);
    process.exitCode = 1;
  }
});
