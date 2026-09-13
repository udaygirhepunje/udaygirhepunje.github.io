import { createServer, type Server } from 'node:http';
import { readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { parse as parseYaml } from 'yaml';

const DIST_DIR = resolve('dist');
const PDF_PATH = resolve(DIST_DIR, 'downloads/uday-girhepunje-resume.pdf');
const VIEWPORT = { width: 1200, height: 630 };

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

type OgTarget = {
  route: string;
  outputPath: string;
};

async function listHtmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(path);
      return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
    }),
  );
  return files.flat().sort((a, b) => a.localeCompare(b));
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function readMetaAttributes(tag: string) {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? ''));
  }
  return attributes;
}

async function discoverOgTargets(): Promise<OgTarget[]> {
  const targets = new Map<string, OgTarget>();

  for (const filePath of await listHtmlFiles(DIST_DIR)) {
    const html = await readFile(filePath, 'utf8');
    for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attributes = readMetaAttributes(match[0]);
      const property = attributes.get('property') ?? attributes.get('name');
      if (property?.toLowerCase() !== 'og:image') continue;

      const content = attributes.get('content');
      if (!content) continue;

      let pathname: string;
      try {
        pathname = new URL(content, 'https://portfolio.invalid').pathname;
      } catch {
        continue;
      }

      if (!pathname.startsWith('/og/') || !pathname.toLowerCase().endsWith('.png')) {
        continue;
      }

      const outputPath = resolve(DIST_DIR, `.${pathname}`);
      if (!outputPath.startsWith(`${resolve(DIST_DIR, 'og')}${sep}`)) continue;
      targets.set(outputPath, {
        route: `${pathname.slice(0, -'.png'.length).replace(/\/+$/, '')}/`,
        outputPath,
      });
    }
  }

  const configuredRoutes = process.env.OG_ROUTES?.split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  for (const route of configuredRoutes ?? []) {
    const pathname = new URL(route, 'https://portfolio.invalid').pathname;
    const name =
      pathname === '/'
        ? 'index'
        : pathname
            .replace(/^\/|\/$/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .toLowerCase();
    targets.set(resolve(DIST_DIR, 'og', `${name}.png`), {
      route: pathname,
      outputPath: resolve(DIST_DIR, 'og', `${name}.png`),
    });
  }

  return [...targets.values()].sort((a, b) => a.outputPath.localeCompare(b.outputPath));
}

function requestedFilePath(urlPath: string) {
  const decodedPath = decodeURIComponent(urlPath);
  const candidate = resolve(DIST_DIR, `.${decodedPath}`);
  if (candidate !== DIST_DIR && !candidate.startsWith(`${DIST_DIR}${sep}`)) return null;
  return extname(candidate) ? candidate : resolve(candidate, 'index.html');
}

async function startStaticServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const filePath = requestedFilePath(pathname);
      if (!filePath) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not determine the local server port');
  }

  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function waitForPage(page: Page, url: URL) {
  await page.goto(url.toString(), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function closeServer(server: Server | undefined) {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
}

async function main() {
  await readdir(DIST_DIR);

  let server: Server | undefined;
  let browser: Browser | undefined;

  try {
    const configuredBaseUrl = process.env.BUILD_ASSETS_BASE_URL?.trim();
    const serving = configuredBaseUrl
      ? { baseUrl: configuredBaseUrl.replace(/\/+$/, '') }
      : await startStaticServer();
    server = 'server' in serving ? serving.server : undefined;
    const baseUrl = serving.baseUrl;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

    await waitForPage(page, new URL('/resume/print/', `${baseUrl}/`));
    const resume = parseYaml(
      await readFile(resolve('src/content/settings/resume.yml'), 'utf8'),
    ) as { contact?: { phone?: string } };
    const phone = resume.contact?.phone?.trim();
    if (phone) {
      await page.locator('[data-pdf-phone]').evaluate((element, value) => {
        element.textContent = value;
      }, `+91 ${phone}`);
    }
    await mkdir(resolve(DIST_DIR, 'downloads'), { recursive: true });
    await page.pdf({
      path: PDF_PATH,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    const targets = await discoverOgTargets();
    for (const target of targets) {
      await waitForPage(page, new URL(target.route, `${baseUrl}/`));
      await mkdir(resolve(target.outputPath, '..'), { recursive: true });
      await page.screenshot({
        path: target.outputPath,
        type: 'png',
        fullPage: false,
      });
    }

    await rm(resolve(DIST_DIR, 'resume'), { recursive: true, force: true });
    console.log(`Generated resume PDF and ${targets.length} OG image(s).`);
  } finally {
    await browser?.close();
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error('Could not generate build assets:', error);
  process.exitCode = 1;
});
