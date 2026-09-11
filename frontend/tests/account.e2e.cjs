/* Real account and portfolio acceptance tests. Run with Django :8000 and Vite :5173 or E2E_BASE_URL for the production preview. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const python = process.env.VESTRA_PYTHON || path.join(root, 'backend/venv/Scripts/python.exe');
const artifactDir = path.join(root, 'artifacts/account-e2e', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(artifactDir, { recursive: true });
const username = `qa_account_${Date.now().toString(36)}`;
const actor = `${username}_reply`;
const password = 'Learning-Forest-Account-74!';
const results = []; const browserErrors = []; const consoleWarnings = [];
const created = [];
let browser; let page;

async function waitFor(predicate, message, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 80)); }
  throw new Error(message);
}
async function check(name, action) {
  try { await action(); results.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message }); if (page) await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
}
async function request(url, method = 'GET', body, token) {
  const response = await fetch(`${base}/api${url}`, { method, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function navigate(route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.locator('.account-skeleton, .skeleton-grid').waitFor({ state: 'detached' });
}
async function revealAndCapture(name) {
  await page.evaluate(async () => { for (let top = 0; top < document.documentElement.scrollHeight; top += 550) { window.scrollTo({ top, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 25)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  await page.screenshot({ path: path.join(artifactDir, `${name}-viewport.png`) });
}
function django(code, name = username) {
  const result = spawnSync(python, ['manage.py', 'shell', '-c', code], { cwd: path.join(root, 'backend'), env: { ...process.env, VESTRA_ACCOUNT_QA_USERNAME: name }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Django verification helper failed');
  return result.stdout.trim().split('\n').at(-1);
}

async function main() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ headless: true, ...(fs.existsSync(executablePath) ? { executablePath } : {}) });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); if (message.type() === 'warning') consoleWarnings.push(message.text()); });
  await request('/users/register/', 'POST', { username, email: `${username}@example.test`, password }); created.push(username);
  await request('/users/register/', 'POST', { username: actor, email: `${actor}@example.test`, password }); created.push(actor);
  const actorToken = (await request('/users/login/', 'POST', { username: actor, password })).access;
  const projects = await request('/projects/');
  const nova = projects.find(project => project.title === 'Nova Energy');
  const aqua = projects.find(project => project.title === 'AquaLoop');
  assert.ok(nova && aqua, 'Seeded educational projects are required');
  await check('Real sign-in and empty account pages', async () => {
    await navigate('/login');
    await page.getByLabel('Email or username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.getByRole('heading', { name: /Your portfolio starts/ }).waitFor();
    for (const [route, heading] of [['/saved', "You haven't saved any projects yet."], ['/following', "You aren't following any projects yet."], ['/notifications', 'A little quiet, for now.'], ['/portfolio', /Your portfolio starts/]]) {
      await navigate(route); await page.getByRole('heading', { name: heading }).waitFor();
    }
  });
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('vestra.auth')).access);
  await request(`/projects/${nova.id}/save/`, 'POST', {}, token);
  await request(`/projects/${aqua.id}/follow/`, 'POST', {}, token);
  await check('Saved and followed collections use actual persisted projects', async () => {
    await navigate('/saved'); assert.equal(await page.locator('.project-card').count(), 1); assert.match(await page.locator('.project-card h3').innerText(), /Nova Energy/);
    await navigate('/following'); assert.equal(await page.locator('.project-card').count(), 1); assert.match(await page.locator('.project-card h3').innerText(), /AquaLoop/);
  });
  const first = await request('/investments/', 'POST', { project_id: nova.id, amount: '1000.00' }, token);
  await request('/investments/', 'POST', { project_id: nova.id, amount: '500.00' }, token);
  await request('/investments/', 'POST', { project_id: aqua.id, amount: '2500.00' }, token);
  await check('Portfolio totals, actual history and chart geometry', async () => {
    assert.equal(first.expected_profit, '150.00');
    await navigate('/portfolio');
    await waitFor(async () => (await page.locator('.portfolio-dominant-value').innerText()) === '$4,487.50', 'Portfolio total does not match API scenarios');
    assert.equal(await page.locator('.portfolio-allocation-table tbody tr').count(), 3);
    assert.equal(await page.locator('.allocation-legend li').count(), 2);
    assert.equal(await page.locator('.portfolio-history-chart .recharts-line').count(), 2);
    assert.ok(await page.locator('.portfolio-history-chart .recharts-line-curve').count() >= 2);
    const sectors = await page.locator('.recharts-pie-sector path').evaluateAll(elements => elements.map(element => element.getBBox().width));
    assert.equal(sectors.length, 2); assert.ok(sectors.every(width => width > 0));
    const history = await request('/investments/history/', 'GET', undefined, token);
    assert.equal(history.at(-1).value, '4487.50');
    assert.equal(await page.locator('.portfolio-impact-list li').count(), 2);
  });
  await check('Allocation editor validates, calculates and persists changes', async () => {
    const edit = page.getByRole('button', { name: 'Change allocation for Nova Energy, $1,000', exact: true });
    await edit.click();
    const dialog = page.getByRole('dialog', { name: 'Refine your allocation' });
    await dialog.waitFor();
    await dialog.getByLabel('Simulated amount (USD)').fill('0');
    await dialog.getByRole('button', { name: 'Update allocation' }).click();
    assert.match(await dialog.getByRole('alert').innerText(), /greater than/);
    await dialog.getByLabel('Simulated amount (USD)').fill('2000');
    assert.match(await dialog.locator('.account-scenario-preview').innerText(), /\$300/);
    const updated = page.waitForResponse(response => response.url().includes(`/api/investments/${first.id}/`) && response.request().method() === 'PATCH');
    await dialog.getByRole('button', { name: 'Update allocation' }).click();
    assert.equal((await updated).status(), 200);
    await dialog.waitFor({ state: 'hidden' });
    await waitFor(async () => (await page.locator('.portfolio-dominant-value').innerText()) === '$5,637.50', 'Revised portfolio did not refresh');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('button', { name: 'Change allocation for Nova Energy, $2,000', exact: true }).count(), 1);
  });
  await check('Allocation removal requires confirmation and updates actual history', async () => {
    const remove = page.getByRole('button', { name: 'Remove allocation for Nova Energy, $500', exact: true });
    await remove.click();
    const dialog = page.getByRole('dialog', { name: 'Remove this allocation?' });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await remove.evaluate(element => document.activeElement === element), true);
    assert.equal(await page.locator('.portfolio-allocation-table tbody tr').count(), 3);
    await remove.click(); await dialog.getByRole('button', { name: 'Remove allocation', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await waitFor(async () => await page.locator('.portfolio-allocation-table tbody tr').count() === 2, 'Allocation removal not reflected');
    await waitFor(async () => (await page.locator('.portfolio-dominant-value').innerText()) === '$5,062.50', 'Portfolio value after removal is wrong');
    const history = await request('/investments/history/', 'GET', undefined, token);
    assert.equal(history.at(-1).allocated, '4500.00'); assert.equal(history.at(-1).value, '5062.50');
  });
  await check('Settings validate and save profile, interests, avatar and preferences', async () => {
    await navigate('/settings');
    await page.getByLabel('Email address', { exact: true }).fill('invalid');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('Enter a valid email address.', { exact: true }).waitFor();
    await page.getByLabel('Email address', { exact: true }).fill(`${username}@example.test`);
    await page.getByLabel('First name', { exact: true }).fill('Rowan');
    await page.getByLabel('Your bio', { exact: false }).fill('Learning how clean energy and water projects fit together.');
    await page.getByRole('radio', { name: 'violet avatar' }).check();
    await page.getByRole('button', { name: 'Clean Energy', exact: true }).click();
    await page.getByRole('switch', { name: /Reactions to your comments/ }).uncheck();
    const response = page.waitForResponse(item => item.url().includes('/api/users/me/') && item.request().method() === 'PATCH');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    assert.equal((await response).status(), 200);
    await page.getByText('Changes saved', { exact: true }).waitFor();
    const actual = await request('/users/me/', 'GET', undefined, token);
    assert.equal(actual.first_name, 'Rowan'); assert.equal(actual.avatar, 'violet'); assert.equal(actual.notify_reactions, false); assert.ok(actual.interests.includes('Clean Energy'));
    await navigate('/profile'); assert.match(await page.locator('.profile-identity-panel').innerText(), /Rowan/); assert.match(await page.locator('.profile-bio').innerText(), /Learning how clean energy/);
    assert.equal(await page.locator('.profile-identity-panel .avatar-violet').count(), 1);
  });
  const comment = await request(`/projects/${nova.id}/comments/`, 'POST', { body: 'How does storage help this educational energy scenario?' }, token);
  await request(`/projects/${nova.id}/comments/`, 'POST', { body: 'Storage can move fictional solar production into evening hours.', parent: comment.id }, actorToken);
  await request(`/projects/${nova.id}/comments/`, 'POST', { body: 'The impact description also explains the local access goals.', parent: comment.id }, actorToken);
  await check('Actual replies generate notifications; mark one and mark all persist', async () => {
    await navigate('/notifications');
    assert.equal(await page.locator('.notification-list li.is-unread').count(), 2);
    await page.locator('.notification-list').getByRole('button', { name: /Mark .* as read/ }).first().click();
    await waitFor(async () => await page.locator('.notification-list li.is-unread').count() === 1, 'Read status did not refresh');
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await waitFor(async () => await page.locator('.notification-list li.is-unread').count() === 0, 'Mark-all did not update');
    await page.getByRole('button', { name: /^Unread/ }).click();
    await page.getByRole('heading', { name: "You're all caught up." }).waitFor();
    assert.equal((await request('/community/notifications/', 'GET', undefined, token)).unread_count, 0);
  });
  await check('Dashboard and profile are personalized from real account actions', async () => {
    await navigate('/dashboard'); assert.match(await page.locator('h1').innerText(), /Rowan/);
    assert.match(await page.locator('.account-activity-list').innerText(), /Nova Energy/);
    assert.match(await page.locator('.account-project-list').first().innerText(), /Nova Energy/);
    await navigate('/profile'); assert.match(await page.locator('.profile-comment-list').innerText(), /How does storage help/);
    assert.match(await page.locator('.profile-stats-grid').innerText(), /1\s*Comments/);
  });
  for (const width of [1920, 1728, 1440, 1280, 1024, 768, 430, 390]) {
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 1000 });
    for (const route of ['/dashboard', '/portfolio', '/saved', '/following', '/notifications', '/profile', '/settings']) {
      await check(`${route} responsive at ${width}px`, async () => {
        await navigate(route);
        const overflow = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, page: document.documentElement.scrollWidth }));
        assert.ok(overflow.body <= width + 1 && overflow.page <= width + 1, JSON.stringify(overflow));
        const contentOverflow = await page.locator('main .account-page *').evaluateAll(elements => elements.filter(element => { const box = element.getBoundingClientRect(); const style = getComputedStyle(element); return box.width > 5 && box.right > innerWidth + 2 && style.position !== 'fixed' && !element.closest('.sr-only, dialog:not([open])'); }).slice(0, 4).map(element => `${element.tagName}.${element.className}`));
        assert.deepEqual(contentOverflow, [], 'Account content overflow');
        if ([1440, 390].includes(width)) await revealAndCapture(`${route.slice(1)}-${width}`);
      });
    }
  }
  await check('Mobile dialog focus containment, Escape and reduced motion', async () => {
    await navigate('/portfolio');
    const edit = page.getByRole('button', { name: 'Change allocation for Nova Energy, $2,000', exact: true });
    await edit.click(); const dialog = page.getByRole('dialog', { name: 'Refine your allocation' });
    const size = await dialog.boundingBox(); assert.ok(size.width <= 390 - 20);
    for (let index = 0; index < 8; index++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true); }
    await page.screenshot({ path: path.join(artifactDir, 'edit-dialog-390.png') });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await edit.evaluate(element => document.activeElement === element), true);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await navigate('/portfolio');
    assert.equal(await page.locator('.portfolio-dominant-value').innerText(), '$5,062.50');
    const motion = await page.locator('.portfolio-impact-track span').first().evaluate(element => getComputedStyle(element).animationName);
    assert.equal(motion, 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await check('Saved and followed collections connect back to projects and persist removals', async () => {
    await navigate('/saved');
    await page.getByRole('button', { name: 'Unsave Nova Energy', exact: true }).click();
    await page.getByRole('heading', { name: "You haven't saved any projects yet." }).waitFor();
    assert.equal((await request('/community/saved/', 'GET', undefined, token)).length, 0);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: "You haven't saved any projects yet." }).waitFor();
    await navigate('/following');
    await page.getByRole('link', { name: 'View details', exact: true }).click();
    await page.getByRole('heading', { name: 'AquaLoop', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Following', exact: true }).click();
    await page.getByRole('button', { name: 'Follow project', exact: true }).waitFor();
    await navigate('/following');
    await page.getByRole('heading', { name: "You aren't following any projects yet." }).waitFor();
    assert.equal((await request('/community/following/', 'GET', undefined, token)).length, 0);
  });
  await check('Password reset request, valid reset and new credential sign-in', async () => {
    await navigate('/forgot-password'); await page.getByLabel('Email address', { exact: true }).fill(`${username}@example.test`);
    await page.getByRole('button', { name: 'Send reset link' }).click(); await page.getByRole('heading', { name: 'Check your inbox.' }).waitFor();
    const reset = JSON.parse(django("import os,json; from django.contrib.auth import get_user_model; from django.contrib.auth.tokens import default_token_generator; from django.utils.http import urlsafe_base64_encode; from django.utils.encoding import force_bytes; user=get_user_model().objects.get(username=os.environ['VESTRA_ACCOUNT_QA_USERNAME']); print(json.dumps({'uid':urlsafe_base64_encode(force_bytes(user.pk)), 'token':default_token_generator.make_token(user)}))"));
    const anonymous = await browser.newPage({ viewport: { width: 390, height: 844 } });
    anonymous.on('pageerror', error => browserErrors.push(error.message));
    anonymous.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); if (message.type() === 'warning') consoleWarnings.push(message.text()); });
    await anonymous.goto(`${base}/reset-password?uid=${encodeURIComponent(reset.uid)}&token=${encodeURIComponent(reset.token)}`);
    await anonymous.getByLabel('New password', { exact: true }).fill(`${password}Next`);
    await anonymous.getByLabel('Confirm new password', { exact: true }).fill(`${password}Next`);
    await anonymous.getByRole('button', { name: 'Set new password' }).click();
    await anonymous.getByRole('heading', { name: 'A new beginning.' }).waitFor();
    await anonymous.screenshot({ path: path.join(artifactDir, 'reset-success-390.png'), fullPage: true });
    const login = await request('/users/login/', 'POST', { username, password: `${password}Next` });
    assert.ok(login.access && login.refresh); await anonymous.close();
  });
  await check('No unexpected browser console errors or warnings', async () => { assert.deepEqual([...new Set(browserErrors)], []); assert.deepEqual([...new Set(consoleWarnings)], []); });
}

(async () => {
  let failure;
  try { await main(); } catch (error) { failure = error; process.stderr.write(`${error.stack}\n`); }
  finally {
    if (browser) await browser.close();
    for (const name of created) {
      try { django("import os; from django.contrib.auth import get_user_model; name=os.environ['VESTRA_ACCOUNT_QA_USERNAME']; assert name.startswith('qa_account_'); users=get_user_model().objects.filter(username=name,email=name+'@example.test'); users.delete(); print('Removed isolated account')", name); }
      catch (error) { failure ||= error; }
    }
    const report = { status: failure ? 'FAIL' : 'PASS', base, artifactDir, results, browserErrors, consoleWarnings, retainedUser: false };
    fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
    process.stdout.write(`REPORT ${path.join(artifactDir, 'report.json')}\n`);
    if (failure) process.exitCode = 1;
  }
})();
