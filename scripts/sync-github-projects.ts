import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Optional .env file
  }
}

const GITHUB_ACCOUNTS = ['udaygirhepunje', 'uday-appdirect'] as const;
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
  default_branch?: string;
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
  accounts: string[];
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
    username: GITHUB_ACCOUNTS[0],
    accounts: [...GITHUB_ACCOUNTS],
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
    'User-Agent': `${GITHUB_ACCOUNTS[0]}-portfolio-build`,
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

async function fetchRepositoriesForUser(username: string, token?: string): Promise<Repository[]> {
  const repositories: Repository[] = [];

  for (let page = 1; ; page += 1) {
    const batch = await githubFetch<Repository[]>(
      `https://api.github.com/users/${username}/repos?type=owner&sort=updated&direction=desc&per_page=100&page=${page}`,
      token,
      'application/vnd.github+json, application/vnd.github.mercy-preview+json',
    );
    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  return repositories;
}

function getTokenForAccount(username: string): string | undefined {
  if (username === 'uday-appdirect') {
    return (
      process.env.WORK_GITHUB_TOKEN?.trim() ||
      process.env.GITHUB_WORK_TOKEN?.trim() ||
      process.env.GITHUB_TOKEN?.trim() ||
      undefined
    );
  }
  return process.env.GITHUB_TOKEN?.trim() || undefined;
}

async function fetchAllRepositories(): Promise<Repository[]> {
  const allRepositories: Repository[] = [];
  for (const username of GITHUB_ACCOUNTS) {
    const token = getTokenForAccount(username);
    try {
      const repos = await fetchRepositoriesForUser(username, token);
      allRepositories.push(...repos);
    } catch (error) {
      console.warn(`Could not fetch repositories for ${username}:`, error);
    }
  }
  return allRepositories;
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
    const branch = repository.default_branch || 'main';
    const rawBaseUrl = `https://raw.githubusercontent.com/${repository.full_name}/${branch}/`;
    const repoBlobUrl = `https://github.com/${repository.full_name}/blob/${branch}/`;

    const resolveUrl = (hrefOrSrc: string | undefined, baseUrl: string): string => {
      if (!hrefOrSrc) return '';
      const trimmed = hrefOrSrc.trim();
      if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('#') || trimmed.startsWith('mailto:')) {
        return trimmed;
      }
      const cleanPath = trimmed.replace(/^\.?\//, '');
      return `${baseUrl}${cleanPath}`;
    };

    const html = sanitizeHtml(rendered, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'details',
        'summary',
        'picture',
        'source',
        'img',
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ['href', 'name', 'target', 'rel'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        source: ['srcset', 'media', 'type'],
        code: ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto', 'data'],
      allowProtocolRelative: false,
      transformTags: {
        a: (_tagName, attributes) => {
          const attribs: Record<string, string> = {
            ...attributes,
            rel: 'noopener noreferrer',
            target: '_blank',
          };
          if (attributes.href) {
            attribs.href = resolveUrl(attributes.href, repoBlobUrl);
          }
          return { tagName: 'a', attribs };
        },
        img: (_tagName, attributes) => {
          const attribs: Record<string, string> = {
            ...attributes,
            loading: 'lazy',
          };
          if (attributes.src) {
            attribs.src = resolveUrl(attributes.src, rawBaseUrl);
          }
          return { tagName: 'img', attribs };
        },
      },
    });

    return { markdown, html };
  } catch (error) {
    console.warn(`Could not fetch README for ${repository.full_name}:`, error);
    return { markdown: null, html: null };
  }
}

async function fetchPublicRepoCount(): Promise<number | null> {
  let total = 0;
  let successCount = 0;

  for (const username of GITHUB_ACCOUNTS) {
    const token = getTokenForAccount(username);
    try {
      const user = await githubFetch<{ public_repos: number }>(
        `https://api.github.com/users/${username}`,
        token,
      );
      if (typeof user.public_repos === 'number') {
        total += user.public_repos;
        successCount += 1;
      }
    } catch (error) {
      console.warn(`Could not fetch the public repository count for ${username}:`, error);
    }
  }

  return successCount > 0 ? total : null;
}

type UserContributionsResult = {
  createdAt: string;
  totalContributions: number;
  pullRequestContributions: number;
  weeks: ContributionWeek[];
};

async function fetchContributionsForUser(
  username: string,
  token: string,
  from: Date,
  to: Date,
): Promise<UserContributionsResult | null> {
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
        login: username,
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL returned ${response.status} for ${username}`);
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
    console.warn(
      `GitHub GraphQL errors for ${username}:`,
      payload.errors?.map(({ message }) => message).join('; '),
    );
    return null;
  }

  const user = payload.data.user;
  return {
    createdAt: user.createdAt,
    totalContributions: user.contributionsCollection.contributionCalendar.totalContributions,
    pullRequestContributions: user.contributionsCollection.totalPullRequestContributions,
    weeks: user.contributionsCollection.contributionCalendar.weeks,
  };
}

function getContributionLevel(count: number): string {
  if (count <= 0) return 'NONE';
  if (count <= 2) return 'FIRST_QUARTILE';
  if (count <= 5) return 'SECOND_QUARTILE';
  if (count <= 9) return 'THIRD_QUARTILE';
  return 'FOURTH_QUARTILE';
}

async function fetchContributions() {
  const today = new Date();
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59),
  );
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  from.setUTCDate(from.getUTCDate() + 1);

  const results: UserContributionsResult[] = [];

  for (const username of GITHUB_ACCOUNTS) {
    const token = getTokenForAccount(username);
    if (!token) {
      console.warn(`No GitHub token available for ${username}; skipping contributions.`);
      continue;
    }
    try {
      const userResult = await fetchContributionsForUser(username, token, from, to);
      if (userResult) results.push(userResult);
    } catch (error) {
      console.warn(`Could not fetch contribution data for ${username}:`, error);
    }
  }

  if (results.length === 0) {
    throw new Error('No contribution data could be fetched for any GitHub account');
  }

  const earliestCreatedAt = results.reduce((earliest, res) => {
    const current = new Date(res.createdAt);
    return current < earliest ? current : earliest;
  }, new Date(results[0].createdAt));

  const accountYears = Math.max(
    0,
    to.getUTCFullYear() -
      earliestCreatedAt.getUTCFullYear() -
      (Date.UTC(to.getUTCFullYear(), earliestCreatedAt.getUTCMonth(), earliestCreatedAt.getUTCDate()) >
      to.getTime()
        ? 1
        : 0),
  );

  const totalPullRequestContributions = results.reduce(
    (sum, res) => sum + res.pullRequestContributions,
    0,
  );

  type DayInfo = {
    date: string;
    contributionCount: number;
    contributionLevel: string;
    weekday: number;
  };
  const daysByDate = new Map<string, DayInfo>();

  for (const res of results) {
    for (const week of res.weeks) {
      for (const day of week.contributionDays) {
        const existing = daysByDate.get(day.date);
        if (existing) {
          existing.contributionCount += day.contributionCount;
        } else {
          daysByDate.set(day.date, {
            date: day.date,
            contributionCount: day.contributionCount,
            contributionLevel: day.contributionLevel,
            weekday: day.weekday,
          });
        }
      }
    }
  }

  const templateWeeks = results[0].weeks;
  const mergedWeeks: ContributionWeek[] = templateWeeks
    .map((week) => {
      const contributionDays = week.contributionDays
        .map((day) => {
          const mergedDay = daysByDate.get(day.date);
          const count = mergedDay ? mergedDay.contributionCount : day.contributionCount;
          return {
            date: day.date,
            contributionCount: count,
            contributionLevel: getContributionLevel(count),
            weekday: day.weekday,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        firstDay: week.firstDay,
        contributionDays,
      };
    })
    .sort((a, b) => a.firstDay.localeCompare(b.firstDay));

  const totalContributions = Array.from(daysByDate.values()).reduce(
    (sum, day) => sum + day.contributionCount,
    0,
  );

  return {
    totalContributions,
    pullRequestContributions: totalPullRequestContributions,
    accountYears,
    contributionYears: [],
    contributionCalendar: {
      totalContributions,
      weeks: mergedWeeks,
    },
  };
}

async function writeGeneratedData(data: GeneratedData) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const data = emptyData();

  try {
    const repositories = await fetchAllRepositories();
    const portfolioRepositories = repositories
      .filter(
        (repository) =>
          !repository.fork &&
          repository.topics.some((topic) => topic.toLowerCase() === 'portfolio'),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    data.projects = await Promise.all(
      portfolioRepositories.map(async (repository) => {
        const token = getTokenForAccount(repository.full_name.split('/')[0]);
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
    data.stats.publicRepoCount = await fetchPublicRepoCount();
  } catch (error) {
    console.warn('Could not fetch the public repository count:', error);
  }

  const hasAnyToken = GITHUB_ACCOUNTS.some((username) => Boolean(getTokenForAccount(username)));

  if (hasAnyToken) {
    try {
      Object.assign(data.stats, await fetchContributions());
    } catch (error) {
      console.warn('Could not fetch GitHub contribution data:', error);
    }
  } else {
    console.warn('No GITHUB_TOKEN or WORK_GITHUB_TOKEN set; contribution data will be empty.');
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
