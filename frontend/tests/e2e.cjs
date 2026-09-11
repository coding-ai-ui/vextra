/*
 * Vestra's real-browser acceptance suite. Start Django :8000 and Vite :5173 first.
 * Run: node frontend/tests/e2e.cjs
 * Optional: PLAYWRIGHT_MODULE_PATH, PLAYWRIGHT_CHROMIUM_EXECUTABLE, E2E_BASE_URL,
 * VESTRA_PYTHON. Uses isolated, generated QA accounts and removes exactly those
 * accounts afterward through the local Django ORM. Existing accounts are untouched.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const artifactDir = path.join(root, 'artifacts', 'e2e', runId);
fs.mkdirSync(artifactDir, { recursive: true });
const username = `qa_${Date.now().toString(36)}`;
const email = `${username}@example.test`;
const password = 'Vestra-Forest-Learning-74!';
const results = [];
const browserErrors = [];
const consoleWarnings = [];
let intentionalErrors = false;
let createdUser = false;
const extraUsers = [];
let browser;
let page;
let context;

function playwrightModule() {
  const candidates = [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required for browser QA. Set PLAYWRIGHT_MODULE_PATH to an installed Playwright package.');
}

async function until(predicate, message, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  throw new Error(message);
}

async function check(name, action) {
  const start = Date.now();
  try {
    await action();
    results.push({ name, status: 'PASS', milliseconds: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'FAIL', message: error.message, milliseconds: Date.now() - start });
    console.error(`FAIL ${name}: ${error.message}`);
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  }
}

async function navigate(route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  await until(async () => !(await page.locator('.skeleton-grid').count()), `Loading did not complete on ${route}`);
}

async function revealPage() {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(400, window.innerHeight - 160)) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 45));
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(900);
}

async function screenshot(name) {
  await revealPage();
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  await page.screenshot({ path: path.join(artifactDir, `${name}-viewport.png`) });
}

async function overflowReport() {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      viewport: width,
      pageWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      offenders: [...document.querySelectorAll('body *')].filter(el => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return box.width > 0 && style.position !== 'fixed' && (box.right > width + 2 || box.left < -2);
      }).slice(0, 8).map(el => ({ element: el.tagName, className: String(el.className), right: Math.round(el.getBoundingClientRect().right) })),
    };
  });
}

async function dashboardData() {
  const received = page.waitForResponse(response => response.url().includes('/api/investments/') && response.request().method() === 'GET' && response.status() === 200);
  await navigate('/dashboard');
  return (await received).json();
}

async function save(amount) {
  await page.getByLabel('Simulated investment amount').fill(String(amount));
  const response = page.waitForResponse(res => res.url().includes('/api/investments/') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add to simulated portfolio' }).click();
  const saved = await response;
  assert.equal(saved.status(), 201, await saved.text());
  await page.getByText('Simulation saved', { exact: true }).waitFor();
  return saved.json();
}

async function login(identifier = email, secret = password) {
  await page.getByLabel('Email or username').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function responsiveScreens(routes, labelPrefix = '') {
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    for (const [name, route] of routes) {
      await check(`Responsive ${name} ${width}px`, async () => {
        await navigate(route);
        await revealPage();
        const overflow = await overflowReport();
        assert.ok(overflow.pageWidth <= overflow.viewport + 2, JSON.stringify(overflow));
        if ([1440, 768, 390].includes(width)) {
          await page.screenshot({ path: path.join(artifactDir, `${labelPrefix}${name}-${width}.png`), fullPage: true });
          await page.screenshot({ path: path.join(artifactDir, `${labelPrefix}${name}-${width}-viewport.png`) });
          if (name === 'dashboard') {
            await page.locator('.portfolio-charts').scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(artifactDir, `charts-${width}-viewport.png`) });
          }
        }
      });
    }
  }
}

async function main() {
  const { chromium } = playwrightModule();
  const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (fs.existsSync(installedChrome) ? installedChrome : undefined);
  browser = await chromium.launch({ executablePath, headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().includes('/api/')) browserErrors.push(`Static resource failed: ${response.status()} ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error' && !intentionalErrors && !message.text().includes('Failed to load resource')) browserErrors.push(message.text());
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  });

  let nova;
  let water;
  await check('Homepage, real project data and primary navigation', async () => {
    await navigate('/');
    assert.match(await page.locator('h1').innerText(), /Invest in[\s\S]*what matters/);
    assert.equal(await page.locator('.featured-grid .project-card').count(), 3); await screenshot('home-early-1440'); await page.setViewportSize({width:390,height:844}); await screenshot('home-early-390'); await page.setViewportSize({width:1440,height:1000});
    await page.locator('.hero-buttons').getByRole('link', { name: 'Explore projects' }).click();
    await page.getByLabel('Search projects').waitFor();
    const response = await page.request.get(`${baseURL}/api/projects/`);
    assert.equal(response.status(), 200);
    const projects = await response.json();
    assert.equal(projects.length, 10);
    nova = projects.find(project => project.title === 'Nova Energy');
    water = projects.find(project => project.title === 'AquaLoop');
    assert.ok(nova && water);
    assert.equal(Number(nova.expected_return), 15);
  });

  await check('Anonymous dashboard protection and destination restoration', async () => {
    await navigate('/dashboard');
    assert.match(page.url(), /\/login$/);
    await page.getByRole('link', { name: 'Create an account' }).click();
    assert.match(page.url(), /\/register$/);
  });

  await check('Registration validation and real account creation', async () => {
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    assert.ok(await page.locator('.auth-field-error').count() >= 3);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password', {exact:true}).fill('different-password');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    assert.match(await page.locator('#confirmPassword-error').innerText(), /match/i);
    await page.getByLabel('Confirm password', {exact:true}).fill(password);
    const registration = page.waitForResponse(res => res.url().includes('/api/users/register/') && res.status() === 201);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await registration;
    createdUser = true;
    await page.waitForURL('**/dashboard');
    await page.getByText('Find your first project', { exact: true }).waitFor();
    assert.equal(await page.locator('.portfolio-charts').count(), 0);
  });

  await check('Logout, invalid email login and successful email login', async () => {
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.waitForURL('**/login');
    intentionalErrors = true;
    await login(email, 'incorrect-password');
    await page.locator('.auth-form-message').waitFor();
    assert.match(await page.locator('.auth-form-message').innerText(), /do not match/);
    intentionalErrors = false;
    await login();
    await page.waitForURL('**/dashboard');
  });

  await check('Authentication persists after a full page reload', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Find your first project', { exact: true }).waitFor();
    assert.match(await page.locator('h1').innerText(), new RegExp(username));
  });

  await check('Live search, category, risk, sorting, URL state and no results', async () => {
    await navigate('/projects');
    assert.equal(await page.locator('.project-grid .project-card').count(), 10);
    await page.getByLabel('Search projects').fill('Nova Energy');
    const searchResponse = await page.request.get(`${baseURL}/api/projects/?search=Nova%20Energy`);
    const searchMatches = await searchResponse.json();
    await until(async () => await page.locator('.project-grid .project-card').count() === searchMatches.length, 'Search did not narrow the catalogue');
    assert.deepEqual(await page.locator('.project-card h3').allTextContents(), searchMatches.map(project => project.title));
    assert.ok(searchMatches.some(project => project.title === 'Nova Energy'));
    await page.getByLabel('Search projects').fill('no-matching-fictional-project');
    await page.getByText('A different idea is out there.', { exact: true }).waitFor();
    await page.locator('.results-meta').getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Category', { exact: true }).selectOption('Water');
    await until(async () => await page.locator('.project-card h3').count() === 2, 'Water filter did not return two projects');
    await page.getByLabel('Risk level', { exact: true }).selectOption('Low');
    await until(async () => await page.locator('.project-card h3').count() === 1, 'Combined risk filter failed');
    assert.equal(await page.locator('.project-card h3').innerText(), 'AquaLoop');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'AquaLoop', exact: true }).waitFor();
    await page.locator('.results-meta').getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Sort by', { exact: true }).selectOption('-expected_return');
    await until(async () => (await page.locator('.project-card h3').allTextContents())[0] === 'MedNova Labs', 'Highest-return ordering failed');
    await page.getByRole('button', { name: 'Clean Energy', exact: true }).click();
    await until(async () => await page.locator('.project-card h3').count() === 2, 'Quick category chip failed');
    await page.getByRole('link', { name: 'Nova Energy', exact: true }).click();
    await page.getByLabel('Simulated investment amount').waitFor();
    assert.match(await page.locator('h1').innerText(), /Nova Energy/);
  });

  await check('Simulator $500/$1,000/$5,000 previews and invalid amounts', async () => {
    for (const [amount, profit, total] of [[500, '+$75', '$575'], [1000, '+$150', '$1,150'], [5000, '+$750', '$5,750']]) {
      await page.locator('.simulator-quick-amounts').getByRole('button', { name: `$${amount.toLocaleString('en-US')}`, exact: true }).click();
      assert.equal(await page.locator('.simulation-profit strong').innerText(), profit);
      assert.equal(await page.locator('.simulation-total strong').innerText(), total);
    }
    for (const amount of ['0', '-4', '1.001', '1000001']) {
      await page.getByLabel('Simulated investment amount').fill(amount);
      await page.getByLabel('Simulated investment amount').blur();
      assert.equal(await page.getByRole('button', { name: 'Add to simulated portfolio' }).isDisabled(), true);
      assert.ok(await page.locator('#simulation-amount-error').isVisible());
    }
  });

  await check('Real save and exact $1,000 → $150 → $1,150 server result', async () => {
    const saved = await save(1000);
    assert.equal(saved.expected_profit, '150.00');
    assert.equal(saved.estimated_total, '1150.00');
    assert.equal(saved.expected_return_snapshot, '15.00');
    await page.getByRole('button', { name: 'View your portfolio' }).click();
    await page.locator('.portfolio-value-panel').waitFor();
    await until(async () => (await page.locator('.portfolio-dominant-value').innerText()) === '$1,150', 'Portfolio total did not settle to $1,150');
    assert.match(await page.locator('.portfolio-expected-gain').innerText(), /\+\$150/);
    await page.locator('.portfolio-charts').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.allocation-legend li').count(), 1);
    assert.match(await page.locator('.allocation-legend').innerText(), /Clean Energy[\s\S]*100%/);
  });

  await check('Duplicate-project aggregation, second category and actual chart totals', async () => {
    await navigate(`/projects/${nova.id}`);
    await save(500);
    await navigate(`/projects/${water.id}`);
    const savedWater = await save(2500);
    assert.equal(savedWater.expected_profit, '262.50');
    const data = await dashboardData();
    assert.equal(data.length, 3);
    const invested = data.reduce((sum, row) => sum + Number(row.amount), 0);
    const profit = data.reduce((sum, row) => sum + Number(row.expected_profit), 0);
    assert.equal(invested, 4000);
    assert.equal(profit, 487.5);
    await revealPage();
    assert.equal(await page.locator('.portfolio-dominant-value').innerText(), '$4,487.50');
    assert.match(await page.locator('.portfolio-supporting-metrics').innerText(), /\$4,000[\s\S]*3 saved simulations[\s\S]*12.2%[\s\S]*2 projects/);
    assert.equal(await page.locator('.investments-table tbody tr').count(), 3);
    assert.equal(await page.locator('.allocation-legend li').count(), 2);
    assert.match(await page.locator('.allocation-legend').innerText(), /Water[\s\S]*62.5%[\s\S]*Clean Energy[\s\S]*37.5%/);
    const chartRows = await page.locator('.outlook-panel table tbody tr').allTextContents();
    assert.equal(chartRows.length, 2);
    assert.ok(chartRows.some(row => row.includes('Nova Energy') && row.includes('$1,500') && row.includes('$1,725')));
    assert.ok(chartRows.some(row => row.includes('AquaLoop') && row.includes('$2,500') && row.includes('$2,762.50')));
    assert.ok(await page.locator('.recharts-surface').count() >= 2);
    fs.writeFileSync(path.join(artifactDir, 'chart-dom.html'), await page.locator('.portfolio-charts').innerHTML());
    const sectors = await page.locator('.recharts-pie-sector path').evaluateAll(elements => elements.map(element => ({ path: element.getAttribute('d'), width: element.getBBox().width, height: element.getBBox().height })));
    const bars = await page.locator('.recharts-bar-rectangle path').evaluateAll(elements => elements.map(element => ({ path: element.getAttribute('d'), width: element.getBBox().width, height: element.getBBox().height })));
    assert.equal(sectors.length, 2);
    assert.equal(bars.length, 4);
    assert.ok([...sectors, ...bars].every(shape => shape.path && shape.width > 0 && shape.height > 0), 'All chart marks must have visible geometry');
    await page.locator('.recharts-bar-rectangle path').last().hover();
    await page.locator('.vestra-chart-tooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('.vestra-chart-tooltip').innerText(), /Nova Energy|AquaLoop/);
    await page.mouse.move(0, 0);
  });

  await check('Animated portfolio values expose stable accessible names', async () => {
    const value = page.locator('.portfolio-dominant-value');
    assert.equal(await value.getByRole('img', { name: '$4,487.50', exact: true }).count(), 1);
    assert.match(await value.ariaSnapshot(), /\$4,487\.50/);
  });

  await check('Saved simulation rows reveal with a short stagger', async () => {
    await page.locator('.investments-section').scrollIntoViewIfNeeded();
    await until(async () => await page.locator('.investments-reveal').evaluate(el => el.classList.contains('is-visible')), 'Investment section did not reveal');
    const animations = await page.locator('.investments-table tbody tr').evaluateAll(rows => rows.map(row => ({ name: getComputedStyle(row).animationName, delay: getComputedStyle(row).animationDelay, duration: getComputedStyle(row).animationDuration })));
    assert.deepEqual(animations.map(row => row.delay), ['0s', '0.07s', '0.14s']);
    assert.ok(animations.every(row => row.name === 'investment-row-enter' && row.duration === '0.6s'));
  });

  await check('An open dashboard follows account changes in another tab', async () => {
    const otherUsername = `${username}_second`;
    const registration = await page.request.post(`${baseURL}/api/users/register/`, { data: { username: otherUsername, email: `${otherUsername}@example.test`, password } });
    assert.equal(registration.status(), 201);
    extraUsers.push(otherUsername);
    const signIn = await page.request.post(`${baseURL}/api/users/login/`, { data: { username: otherUsername, password } });
    assert.equal(signIn.status(), 200);
    const otherSession = await signIn.json();
    const otherTab = await context.newPage();
    let original;
    try {
      await otherTab.goto(`${baseURL}/about`, { waitUntil: 'networkidle' });
      original = await otherTab.evaluate(() => ({ auth: localStorage.getItem('vestra.auth'), user: localStorage.getItem('vestra.user') }));
      // Apply the same two storage writes as sign-in, using real API credentials.
      // The open dashboard must react to native cross-tab storage events.
      await otherTab.evaluate(session => {
        localStorage.setItem('vestra.auth', JSON.stringify({ access: session.access, refresh: session.refresh }));
        localStorage.setItem('vestra.user', JSON.stringify(session.user));
      }, otherSession);
      await until(async () => (await page.locator('h1').innerText()).includes(otherUsername), 'Dashboard did not follow the new account');
      await page.getByText('Find your first project', { exact: true }).waitFor();
      assert.equal(await page.locator('.portfolio-summary-grid, .investments-table, .portfolio-charts').count(), 0, 'The previous account portfolio must not remain visible');
    } finally {
      if (original) await otherTab.evaluate(session => {
        localStorage.setItem('vestra.auth', session.auth);
        localStorage.setItem('vestra.user', session.user);
      }, original);
      await otherTab.close();
    }
    await page.locator('.portfolio-dominant-value').waitFor({ state: 'attached' });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await until(async () => (await page.locator('.portfolio-dominant-value').innerText()) === '$4,487.50', 'Original account portfolio was not restored');
  });

  await check('JWT refresh and retry in the real browser', async () => {
    let rejected = false;
    const handler = async route => {
      if (!rejected && route.request().method() === 'GET') {
        rejected = true;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Token expired for the browser refresh test.' }) });
      }
      return route.continue();
    };
    intentionalErrors = true;
    await page.route('**/api/investments/', handler);
    const refreshed = page.waitForResponse(response => response.url().includes('/api/users/refresh/') && response.status() === 200);
    await navigate('/dashboard');
    const tokens = await (await refreshed).json();
    assert.ok(tokens.access && tokens.refresh);
    assert.equal(await page.locator('.investments-table tbody tr').count(), 3);
    await page.unroute('**/api/investments/', handler);
    intentionalErrors = false;
  });

  await check('Interactive hero, scroll storytelling and normal-motion reveals', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate('/');
    const slider = page.locator('#hero-amount');
    await slider.focus();
    await slider.press('Home');
    await slider.press('ArrowRight');
    assert.equal(await slider.inputValue(), '1500');
    await until(async () => (await page.locator('.hero-composition .preview-total').innerText()) === '$1,727.25', 'Hero allocation did not update the sample value');
    for (let index = 0; index < 4; index++) {
      await page.locator('.story-step').nth(index).evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await until(async () => (await page.locator('.story-stage-label').innerText()).includes(`0${index + 1} / 04`), `Scroll story did not advance to step ${index + 1}`);
    }
    await page.getByRole('button', { name: 'Preview Simulate', exact: true }).click();
    await page.getByRole('button', { name: 'Increase sample amount' }).click();
    assert.equal(await page.locator('.story-estimate strong').innerText(), '+$225');
    await page.locator('.featured-section').scrollIntoViewIfNeeded();
    await until(async () => (await page.locator('.featured-grid > .is-visible').count()) === 3, 'Featured projects did not reveal');
    await page.waitForTimeout(1050);
    const progress = await page.locator('.featured-grid .progress-track').first().evaluate(element => ({ expected: Number(element.getAttribute('aria-valuenow')), actual: element.firstElementChild.getBoundingClientRect().width / element.getBoundingClientRect().width * 100 }));
    assert.ok(Math.abs(progress.actual - progress.expected) < 1);
  });

  await responsiveScreens([['home', '/'], ['projects', '/projects'], ['details', `/projects/${nova.id}`], ['dashboard', '/dashboard']]);

  await check('Mobile navigation, Escape focus and route closure', async () => {
    await navigate('/');
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.click();
    assert.equal(await page.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
    await toggle.click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Projects', exact: true }).click();
    await page.getByLabel('Search projects').waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  });

  await check('Reduced-motion reveals, progress and live final metrics', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await navigate('/');
    const hiddenReveals = await page.locator('.reveal').evaluateAll(elements => elements.filter(el => Number(getComputedStyle(el).opacity) < 1).length);
    assert.equal(hiddenReveals, 0);
    await navigate(`/projects/${nova.id}`);
    const progress = await page.locator('.progress-track').first().evaluate(el => ({ expected: Number(el.getAttribute('aria-valuenow')), ratio: el.firstElementChild.getBoundingClientRect().width / el.getBoundingClientRect().width * 100, duration: getComputedStyle(el.firstElementChild).transitionDuration }));
    assert.ok(Math.abs(progress.expected - progress.ratio) < 1, JSON.stringify(progress));
    await navigate('/dashboard');
    assert.equal(await page.locator('.portfolio-dominant-value').innerText(), '$4,487.50');
    await screenshot('dashboard-reduced-motion-390');
    const rowAnimations = await page.locator('.investments-table tbody tr').evaluateAll(rows => rows.map(row => getComputedStyle(row).animationName));
    assert.ok(rowAnimations.every(name => name === 'none'), 'Reduced motion must disable investment-row entrances');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await check('404 routes and unknown project remain branded and recoverable', async () => {
    intentionalErrors = true;
    await navigate('/projects/99999999');
    await page.getByRole('heading', { name: "This idea isn't on the map." }).waitFor();
    await navigate('/this-page-does-not-exist');
    assert.match(await page.locator('h1').innerText(), /This opportunity/);
    await page.getByRole('link', { name: 'Return home', exact: true }).click();
    await page.locator('.hero').waitFor();
    intentionalErrors = false;
  });

  await check('API offline, retry, empty catalogue and visible loading states', async () => {
    intentionalErrors = true;
    let mode = 'offline';
    let release;
    const handler = async route => {
      if (mode === 'offline') return route.abort('connectionrefused');
      if (mode === 'empty') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      if (mode === 'loading') await new Promise(resolve => { release = resolve; });
      return route.continue();
    };
    await page.route('**/api/projects/?*', handler);
    await navigate('/projects');
    assert.match(await page.locator('.error-state').innerText(), /could not connect/i);
    mode = 'empty';
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('heading', { name: 'New possibilities are on their way.' }).waitFor();
    mode = 'loading';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('status', { name: 'Loading', exact: true }).waitFor();
    await until(() => Boolean(release), 'Loading interception did not start');
    await page.screenshot({ path: path.join(artifactDir, 'projects-loading-390.png') });
    release();
    await until(async () => await page.locator('.project-card').count() === 10, 'Loading state did not resolve');
    await page.unroute('**/api/projects/?*', handler);
    intentionalErrors = false;
  });

  await check('Failed JWT refresh clears the session and protects dashboard', async () => {
    intentionalErrors = true;
    await page.route('**/api/investments/', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Expired test access token."}' }));
    await page.route('**/api/users/refresh/', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Expired test refresh token."}' }));
    await navigate('/dashboard');
    await page.waitForURL('**/login');
    await page.unroute('**/api/investments/');
    await page.unroute('**/api/users/refresh/');
    intentionalErrors = false;
  });

  await check('Sign-in restores the project destination and pending simulation amount', async () => {
    await navigate(`/projects/${nova.id}`);
    await page.getByLabel('Simulated investment amount').fill('5000');
    await page.getByRole('button', { name: 'Sign in to save simulation' }).click();
    await page.waitForURL('**/login');
    await login();
    await page.waitForURL(`**/projects/${nova.id}#simulator`);
    await page.getByLabel('Simulated investment amount').waitFor();
    assert.equal(await page.getByLabel('Simulated investment amount').inputValue(), '5000');
    assert.equal(await page.locator('.simulation-total strong').innerText(), '$5,750');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
  });

  await responsiveScreens([['login', '/login'], ['register', '/register'], ['about', '/about'], ['404', '/this-page-does-not-exist']]);

  await check('Desktop navbar scroll state and keyboard focus visibility', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await navigate('/');
    assert.equal(await page.locator('.site-header').evaluate(el => el.classList.contains('is-scrolled')), false);
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    await until(async () => await page.locator('.site-header').evaluate(el => el.classList.contains('is-scrolled')), 'Navbar did not compact after scrolling');
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
    assert.notEqual(focus.tag, 'BODY');
    assert.notEqual(focus.outline, 'none');
  });

  await check('No unhandled browser errors', async () => {
    assert.deepEqual([...new Set(browserErrors)], []);
  });
}

(async () => {
  let failure;
  try { await main(); } catch (error) { failure = error; }
  finally {
    if (browser) await browser.close();
    if (createdUser && !process.env.E2E_KEEP_USER) for (const cleanupName of [username, ...extraUsers]) {
      const python = process.env.VESTRA_PYTHON || path.join(root, 'backend', process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python');
      const cleanup = spawnSync(python, ['manage.py', 'shell', '-c', "import os; from django.contrib.auth import get_user_model; name = os.environ['VESTRA_QA_USERNAME']; assert name.startswith('qa_'); users = get_user_model().objects.filter(username=name, email=name + '@example.test'); count = users.count(); users.delete(); print('Removed isolated QA accounts:', count)"], { cwd: path.join(root, 'backend'), env: { ...process.env, VESTRA_QA_USERNAME: cleanupName }, encoding: 'utf8' });
      if (cleanup.status === 0) console.log(`CLEANUP ${cleanupName}: removed account and its simulations`);
      else { console.error(`CLEANUP FAILED for ${cleanupName}: ${cleanup.stderr}`); if (!failure) failure = new Error('QA account cleanup failed'); }
    }
    const report = { runId, baseURL, artifactDir, results, browserErrors: [...new Set(browserErrors)], consoleWarnings: [...new Set(consoleWarnings)], cleanupUser: username, retainedUser: Boolean(process.env.E2E_KEEP_USER && createdUser), status: failure ? 'FAIL' : 'PASS' };
    fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`REPORT ${path.join(artifactDir, 'report.json')}`);
    console.log(`${report.status}: ${results.filter(result => result.status === 'PASS').length} checks passed; ${results.filter(result => result.status === 'FAIL').length} failed.`);
  }
  if (failure) { console.error(failure.stack); process.exitCode = 1; }
})();


