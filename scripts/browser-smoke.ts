import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium, firefox, webkit, type BrowserType } from 'playwright';

const pages = ['/', '/projects/', '/about/', '/journal/', '/colophon/'];

async function startServer() {
  const dist = resolve('dist');
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      const candidate = resolve(dist, `.${decodeURIComponent(pathname)}`);
      if (candidate !== dist && !candidate.startsWith(`${dist}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const file = extname(candidate) ? candidate : resolve(candidate, 'index.html');
      const body = await readFile(file);
      const type = extname(file) === '.html' ? 'text/html' : extname(file) === '.css' ? 'text/css' : undefined;
      response.writeHead(200, type ? { 'Content-Type': type } : undefined).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start test server');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function checkBrowser(name: string, browserType: BrowserType, baseUrl: string) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    for (const route of pages) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`${name}: ${route} returned ${response?.status()}`);
      if (!(await page.locator('main').isVisible())) throw new Error(`${name}: ${route} has no visible main`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('details.mobile-menu summary').click();
    if (!(await page.locator('details.mobile-menu a[href="/about/"]').isVisible())) {
      throw new Error(`${name}: mobile navigation did not open`);
    }

    if (errors.length) throw new Error(`${name}: browser errors:\n${errors.join('\n')}`);
    await context.close();

    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJs.newPage();
    const response = await noJsPage.goto(baseUrl);
    if (!response?.ok() || !(await noJsPage.locator('h1').isVisible())) {
      throw new Error(`${name}: no-JavaScript fallback failed`);
    }
    await noJs.close();
    console.log(`${name}: pages, mobile nav, and no-JavaScript fallback passed`);
  } finally {
    await browser.close();
  }
}

const configuredUrl = process.env.PREVIEW_URL;
const local = configuredUrl ? null : await startServer();
const baseUrl = configuredUrl || local!.baseUrl;

try {
  for (const [name, browser] of [
    ['Chromium', chromium],
    ['Firefox', firefox],
    ['WebKit', webkit],
  ] as const) {
    await checkBrowser(name, browser, baseUrl);
  }
} finally {
  await new Promise<void>((resolvePromise, reject) => {
    if (!local) return resolvePromise();
    local.server.close((error) => error ? reject(error) : resolvePromise());
  });
}
