/* global document, getComputedStyle, matchMedia, window */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import axe from 'axe-core';
import { chromium, devices, firefox, webkit } from 'playwright-core';

const dist = resolve('dist');
const mount = '/portfolio';
const widths = [375, 390, 768, 1024, 1440, 1920];
const mime = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  pdf: 'application/pdf',
  vcf: 'text/vcard; charset=utf-8',
};
const screenshotDir = process.env.ARTEM_SCREENSHOTS;
const browserName = process.env.BROWSER || 'chromium';
const engines = { chromium, firefox, webkit };
let baseUrl;
let browser;

// Serve exported files the way a directory-based static host serves them.
const server = createServer(async (request, response) => {
  const { pathname, search } = new URL(request.url, 'http://localhost');
  const path = pathname.startsWith(`${mount}/`) ? pathname.slice(mount.length) : pathname;
  if (path === '/card') {
    response.writeHead(308, { Location: `${pathname}/${search}` }).end();
    return;
  }
  const file = join(dist, path.endsWith('/') ? `${path}index.html` : path);
  try {
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[file.split('.').pop()] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});

before(async () => {
  assert.ok(engines[browserName], `Unsupported browser engine: ${browserName}`);
  await Promise.all(['index.html', 'card/index.html', 'artem-kotliar.vcf', 'assets/resume.pdf'].map((name) => access(join(dist, name))));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  let executablePath = process.env.BROWSER_PATH;
  if (browserName === 'chromium' && !executablePath) {
    executablePath = await access('/usr/bin/chromium').then(() => '/usr/bin/chromium', () => undefined);
  }
  browser = await engines[browserName].launch({ executablePath });
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
});

after(async () => {
  await browser?.close();
  if (server.listening) await new Promise((done) => server.close(done));
});

async function checkPage(options, checks) {
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url || 'browser'})`);
    });
    page.on('response', (response) => {
      if (response.url().startsWith(baseUrl) && response.status() >= 400) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(baseUrl) && request.failure()?.errorText !== 'net::ERR_ABORTED') {
        errors.push(`${request.failure()?.errorText} ${request.url()}`);
      }
    });
    await checks(page, context);
    assert.deepEqual(errors, [], 'Browser errors');
  } finally {
    await context.close();
  }
}

async function open(page, path) {
  const response = await page.goto(`${baseUrl}${path}`);
  assert.equal(response?.status(), 200, path);
}

async function assertNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
  }));
  assert.ok(dimensions.content <= dimensions.viewport + 1, `Horizontal overflow on ${page.url()}: ${JSON.stringify(dimensions)}`);
}

async function assertVisible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 3000 });
}

async function assertHidden(locator) {
  await locator.waitFor({ state: 'hidden', timeout: 3000 });
}

function cardActions(page) {
  return [
    ...['Save Contact', 'LinkedIn', 'View Portfolio'].map((name) => page.getByRole('link', { name, exact: true })),
    page.getByRole('link', { name: /^Email\b/ }),
  ];
}

async function assertCardControls(page, mobileViewport = false) {
  for (const control of cardActions(page)) {
    await assertVisible(control);
    if (mobileViewport) {
      const bounds = await control.boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44, `Small contact action: ${await control.innerText()}`);
      assert.ok(bounds.y + bounds.height <= page.viewportSize().height, `Contact action below the first screen: ${await control.innerText()}`);
    }
  }
}

for (const width of widths) {
  test(`${width}px portfolio and NFC card layout`, async () => {
    const height = width < 768 ? 812 : 900;
    await checkPage({ viewport: { width, height }, hasTouch: width < 1024 }, async (page) => {
      await open(page, '/');
      await assertVisible(page.getByRole('heading', { name: 'Artem Kotliar', exact: true }));
      await assertNoOverflow(page);
      if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `portfolio-${width}.png`), animations: 'disabled' });
      await open(page, '/card');
      assert.equal(new URL(page.url()).pathname, '/card/');
      await assertVisible(page.getByRole('heading', { name: 'Artem Kotliar', exact: true }));
      await assertNoOverflow(page);
      await assertCardControls(page, width < 768);
      if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `card-${width}.png`), animations: 'disabled' });
    });
  });
}

async function download(page, name) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name, exact: true }).first().click(),
  ]);
  assert.equal(await file.failure(), null);
  return readFile(await file.path());
}

test('the exported card works on a project-site subpath and serves valid local downloads', async () => {
  await checkPage({ acceptDownloads: true }, async (page) => {
    await open(page, `${mount}/card`);
    assert.equal(new URL(page.url()).pathname, `${mount}/card/`);
    await assertCardControls(page);
    const canonicalUrl = 'https://artem-kotliar.me/card/';
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonicalUrl);
    assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'), canonicalUrl);
    const preview = new URL(await page.locator('meta[property="og:image"]').getAttribute('content'));
    const previewResponse = await page.request.get(`${baseUrl}${mount}${preview.pathname}`);
    assert.equal(previewResponse.status(), 200);
    assert.match(previewResponse.headers()['content-type'], /^image\//);
    assert.equal(await page.getByRole('link', { name: 'LinkedIn', exact: true }).getAttribute('href'), 'https://www.linkedin.com/in/artem-kotliar');
    assert.equal(await page.getByRole('link', { name: 'GitHub', exact: true }).getAttribute('href'), 'https://github.com/NotRyuzaki01');
    assert.equal(await page.getByRole('link', { name: /^Email\b/ }).getAttribute('href'), 'mailto:artem.kotliar.work@gmail.com');

    const vCard = (await download(page, 'Save Contact')).toString();
    assert.match(vCard, /^BEGIN:VCARD\r\nVERSION:[34]\.0\r\n/);
    assert.match(vCard, /^FN:Artem Kotliar\r?$/m);
    assert.match(vCard, /^EMAIL[^:]*:artem\.kotliar\.work@gmail\.com\r?$/m);
    assert.ok(vCard.endsWith('END:VCARD\r\n'));
    assert.doesNotMatch(vCard, /^(TEL|ADR|BDAY|GEO|PHOTO)([;:]|\.)/mi);
    const resume = await download(page, 'Résumé PDF');
    assert.equal(resume.subarray(0, 5).toString(), '%PDF-');
    await page.getByRole('link', { name: 'View Portfolio', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, `${mount}/`);
    await assertVisible(page.getByRole('heading', { name: 'Artem Kotliar', exact: true }));
  });
});

for (const mode of ['native', 'cancelled', 'fallback', 'manual']) {
  test(`card share handles ${mode} mode`, async () => {
    await checkPage({}, async (page) => {
      await page.addInitScript((mode) => {
        window.shareCalls = [];
        window.clipboardWrites = [];
        const share = mode === 'native' || mode === 'cancelled' ? async (data) => {
          window.shareCalls.push(data);
          if (mode === 'cancelled') throw new DOMException('Cancelled', 'AbortError');
        } : undefined;
        Object.defineProperty(navigator, 'share', { value: share });
        Object.defineProperty(navigator, 'canShare', { value: () => Boolean(share) });
        Object.defineProperty(navigator, 'clipboard', { value: {
          writeText: async (value) => {
            if (mode === 'manual') throw new Error('Clipboard is unavailable');
            window.clipboardWrites.push(value);
          },
        } });
        if (mode === 'manual') document.execCommand = () => false;
      }, mode);
      await open(page, `${mount}/card/index.html?source=nfc#card`);
      await page.getByRole('button', { name: 'Share Profile', exact: true }).click();
      const url = `${baseUrl}${mount}/card/`;
      if (mode === 'manual') {
        const field = page.locator('[data-copy-recovery]');
        await assertVisible(field);
        assert.equal(await field.inputValue(), url);
      }
      if (mode === 'fallback') {
        await assertVisible(page.getByText('Profile link copied.', { exact: true }));
        assert.deepEqual(await page.evaluate(() => window.clipboardWrites), [url]);
      }
      if (mode === 'native' || mode === 'cancelled') {
        const [share] = await page.evaluate(() => window.shareCalls);
        assert.equal(share.url, url);
        assert.deepEqual(await page.evaluate(() => window.clipboardWrites), []);
      }
      if (mode === 'cancelled') assert.equal((await page.locator('[data-feedback]').textContent()).trim(), '');
    });
  });
}

test('static navigation and details work with JavaScript disabled', async () => {
  await checkPage({ javaScriptEnabled: false }, async (page) => {
    await open(page, `${mount}/`);
    await assertVisible(page.getByRole('heading', { name: 'Artem Kotliar', exact: true }));
    for (const id of ['projects', 'experience', 'skills', 'education', 'contact']) {
      await assertVisible(page.locator(`nav a[href="#${id}"]`).first());
      await assertVisible(page.locator(`#${id}`));
    }
    assert.ok(await page.locator('#projects [data-project]:visible').count() >= 6);
    const project = page.locator('#projects [data-project-details]').first();
    await project.locator('summary').click();
    assert.equal(await project.evaluate((details) => details.open), true);
    await open(page, `${mount}/card/`);
    await assertCardControls(page);
    await assertHidden(page.locator('[data-share]'));
  });
});

test('project directory supports filters, detail windows, maximize, close and focus return', async () => {
  await checkPage({ reducedMotion: 'reduce' }, async (page) => {
    await open(page, '/');
    const projects = page.locator('#projects');
    const cards = projects.locator('[data-project]');
    const total = await cards.count();
    await page.locator('nav a[href="#projects"]').first().click();
    await page.waitForURL('**/#projects');
    const cloud = projects.locator('[data-filter="cloud"]');
    await cloud.click();
    assert.equal(await cloud.getAttribute('aria-pressed'), 'true');
    const cloudCount = await cards.filter({ visible: true }).count();
    assert.ok(cloudCount > 0 && cloudCount < total);
    await assertVisible(cards.filter({ hasText: 'Cloud Message Board' }));
    await assertHidden(cards.filter({ hasText: 'WasteWise' }));
    await projects.locator('[data-filter="all"]').click();
    assert.equal(await cards.filter({ visible: true }).count(), total);

    const opener = cards.filter({ hasText: 'WasteWise' }).locator('[data-project-open]');
    await opener.click();
    const dialog = page.locator('#project-window');
    await assertVisible(dialog);
    assert.match(await dialog.innerText(), /WasteWise/);
    const maximize = dialog.locator('[data-expand-window]');
    const previousWidth = (await dialog.boundingBox()).width;
    await maximize.click();
    assert.equal(await maximize.getAttribute('aria-pressed'), 'true');
    assert.ok((await dialog.boundingBox()).width >= previousWidth);
    await dialog.locator('[data-close-dialog]').click();
    await assertHidden(dialog);
    assert.equal(await opener.evaluate((button) => button === document.activeElement), true);
  });
});

test('experience and skill details expand, and skill filtering resets', async () => {
  await checkPage({}, async (page) => {
    await open(page, '/');
    const experience = page.locator('#experience details').filter({ hasText: 'Peer Mentor' });
    const initialState = await experience.evaluate((details) => details.open);
    await experience.locator('summary').click();
    assert.equal(await experience.evaluate((details) => details.open), !initialState);

    const skills = page.locator('#skills');
    const cards = skills.locator('[data-skill]');
    const total = await cards.filter({ visible: true }).count();
    const group = skills.locator('[data-filter]:not([data-filter="all"])').first();
    await group.click();
    assert.equal(await group.getAttribute('aria-pressed'), 'true');
    const visibleCards = cards.filter({ visible: true });
    assert.ok(await visibleCards.count() > 0);
    assert.ok(await visibleCards.count() < total);
    const skill = visibleCards.first();
    await skill.locator('summary').click();
    assert.equal(await skill.evaluate((details) => details.open), true);
    await skills.locator('[data-filter="all"]').click();
    assert.equal(await cards.filter({ visible: true }).count(), total);
  });
});

test('command palette uses the keyboard to open, search, navigate and close', async () => {
  await checkPage({ reducedMotion: 'reduce' }, async (page) => {
    await open(page, '/');
    await page.keyboard.press('Tab');
    assert.match(await page.locator(':focus').innerText(), /skip/i);
    const opener = page.locator('[data-open-palette]').first();
    const palette = page.locator('#command-palette');
    const search = palette.locator('[data-command-search]');
    await opener.focus();
    await page.keyboard.press('ControlOrMeta+k');
    await assertVisible(palette);
    assert.equal(await search.evaluate((input) => input === document.activeElement), true);
    await page.keyboard.press('Escape');
    await assertHidden(palette);
    assert.equal(await opener.evaluate((button) => button === document.activeElement), true);
    await opener.click();
    await search.fill('education');
    const commands = palette.locator('[data-command]').filter({ visible: true });
    assert.equal(await commands.count(), 1);
    assert.match(await commands.first().innerText(), /education/i);
    await search.press('Enter');
    await assertHidden(palette);
    await page.waitForURL('**/#education');
  });
});

test('portfolio contact terminal copies the verified email and navigates to the card', async () => {
  await checkPage({}, async (page) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: {
        writeText: async (value) => { window.copiedValue = value; },
      } });
    });
    await open(page, `${mount}/#contact`);
    const terminal = page.locator('#contact');
    const email = 'artem.kotliar.work@gmail.com';
    assert.equal(await terminal.locator('a[href^="mailto:"]').first().getAttribute('href'), `mailto:${email}`);
    await terminal.locator(`[data-copy="${email}"]`).click();
    assert.equal(await page.evaluate(() => window.copiedValue), email);
    await terminal.locator('a[href$="/card/"], a[href="card/"]').click();
    await page.waitForURL(`**${mount}/card/`);
  });
});

test('both routes respect reduced motion and pass WCAG A/AA axe checks', async () => {
  await checkPage({ reducedMotion: 'reduce' }, async (page) => {
    for (const path of ['/', '/card/']) {
      await open(page, path);
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      assert.notEqual(await page.locator('html').evaluate((html) => getComputedStyle(html).scrollBehavior), 'smooth');
      const animations = await page.evaluate(() => document.getAnimations().map((animation) => animation.effect.getComputedTiming().duration));
      assert.ok(animations.every((duration) => duration <= 20), `Unexpected motion on ${path}: ${animations}`);
      await page.addScriptTag({ content: axe.source });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
        return result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
      });
      assert.deepEqual(violations, [], `Accessibility violations on ${path}`);
    }
  });
});

if (browserName !== 'firefox') {
  for (const device of ['iPhone 8', 'iPhone 13', 'Pixel 7']) {
    test(`${device} mobile browser profile serves primary card actions`, async () => {
      const profile = { ...devices[device] };
      delete profile.defaultBrowserType;
      await checkPage(profile, async (page) => {
        await open(page, '/card/');
        await assertNoOverflow(page);
        await assertCardControls(page, true);
      });
    });
  }
}
