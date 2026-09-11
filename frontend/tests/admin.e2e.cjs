/* Real browser + local database admin acceptance. Run Django :8000 and preview :4173.
 * Only exact generated QA users/projects/inbox entries are created and cleaned.
 * The preserved primary administrator is inspected read-only; its data is never changed.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const python = process.env.VESTRA_PYTHON || path.join(root, 'backend/venv/Scripts/python.exe');
const marker = `qa_admin_${Date.now().toString(36)}`;
const password = `Learning-Admin-${Date.now().toString(36)}!`;
const adminEmail = `${marker}@example.test`;
const memberEmail = `${marker}_member@example.test`;
const createdEmail = `${marker}_created@example.test`;
const projectTitle = `${marker} Community Solar Research and Local Energy Learning Initiative`;
const artifactDir = path.join(root, 'artifacts/admin-e2e', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(artifactDir, { recursive: true });
const checks = [], errors = [], warnings = [];
let browser, context, page, fixture = {}, expectedHttpError = false;

function orm(code, data = {}) {
  const script = `import os, json, sys\nos.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')\nimport django\ndjango.setup()\nfrom django.contrib.auth import get_user_model\nfrom projects.models import Project\nfrom community.models import Comment, Report, InboxMessage\nfrom investments.models import Investment\nUser = get_user_model()\ndata = json.load(sys.stdin)\n${code}`;
  const result = spawnSync(python, ['-c', script], { cwd: path.join(root, 'backend'), input: JSON.stringify(data), encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'Local fixture operation failed.');
  return result.stdout.trim() ? JSON.parse(result.stdout.trim()) : null;
}
async function until(action, message, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await action()) return; await page.waitForTimeout(80); }
  throw new Error(message);
}
async function check(name, action) {
  try { await action(); checks.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { checks.push({ name, status: 'FAIL', message: error.message }); if (page) await page.screenshot({ path: path.join(artifactDir, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
}
async function go(route) {
  await page.goto(baseURL + route, { waitUntil: 'networkidle' });
  await until(async () => !(await page.locator('.admin-skeleton,.auth-loading').count()), `Loading did not finish: ${route}`);
}
async function adminApi(url, method = 'GET', data) {
  const tokens = await page.evaluate(() => JSON.parse(localStorage.getItem('vestra.auth')));
  const response = await context.request.fetch(baseURL + '/api' + url, { method, data, headers: { Authorization: `Bearer ${tokens.access}` } });
  return { status: response.status(), data: response.status() === 204 ? null : await response.json() };
}
async function screenshot(name) {
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 650) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 25)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  await page.screenshot({ path: path.join(artifactDir, `${name}-viewport.png`) });
}
async function fit() {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), font: getComputedStyle(document.body).fontFamily }));
  assert.ok(sizes.width <= sizes.viewport + 1, `Horizontal overflow: ${JSON.stringify(sizes)}`);
  assert.match(sizes.font, /Manrope/);
  assert.ok(await page.locator('h1').first().isVisible(), 'Page heading must be visible');
  assert.ok(!(await page.locator('body').innerText()).includes('undefined'), 'No undefined text');
}

(async () => {
  fixture = orm(`admin = User.objects.create_user(username=data['marker'], email=data['admin'], password=data['password'], first_name='QA', last_name='Administrator')\nadmin.profile.role = 'admin'\nadmin.profile.save(update_fields=['role'])\nmember = User.objects.create_user(username=data['marker']+'_member', email=data['member'], password=data['password'], first_name='QA', last_name='Contributor')\nprimary = User.objects.filter(email__iexact='talyn2007@gmail.com').first()\nprint(json.dumps({'admin': admin.pk, 'member': member.pk, 'primary': primary.pk if primary else None}))`, { marker, admin: adminEmail, member: memberEmail, password });
  const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !expectedHttpError) errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  await check('Admin routes require login and preserve destination', async () => { await go('/admin/projects'); assert.match(page.url(), /\/admin\/login$/); });
  await check('Admin signs in through existing JWT authentication', async () => {
    await page.getByLabel('Email address', { exact: true }).fill(adminEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in to admin' }).click();
    await page.waitForURL('**/admin/projects');
    await until(async () => !(await page.locator('.admin-skeleton').count()), 'Admin project list did not load');
  });
  await check('Admin creates and previews a complete project draft', async () => {
    await page.getByRole('link', { name: 'Add project' }).click();
    const values = { title: projectTitle, short_description: 'A locally grounded educational project for exploring community energy choices.', description: 'This project investigates accessible community solar and the choices behind shared infrastructure. All financial information is simulated for learning.', organization: 'QA Community Research Cooperative', location: 'Lagos, Nigeria', objective: 'Help learners understand long term infrastructure scenarios.', impact: 'Explore accessible clean energy and community learning.', impact_area: 'Climate and communities', impact_score: '87', tags: 'community, research, solar', sustainability: 'Community ownership\nRenewable energy generation\nTransparent scenario reporting', funding_goal: '100000', current_funding: '25000', expected_return: '15', duration: '12' };
    for (const [name, value] of Object.entries(values)) await page.locator(`[name="${name}"]`).fill(value);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Project preview' });
    await dialog.waitFor({ state: 'visible' });
    assert.ok((await dialog.innerText()).includes(projectTitle));
    assert.ok((await dialog.innerText()).includes('Community ownership'));
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).evaluate(el => el === document.activeElement), true);
    const responseWait = page.waitForResponse(response => response.url().endsWith('/api/projects/') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    const response = await responseWait; assert.equal(response.status(), 201); fixture.project = await response.json();
    await page.waitForURL('**/admin/projects?status=draft');
    assert.equal(fixture.project.status, 'draft');
  });
  await check('Draft is persisted and excluded from public API and page', async () => {
    const response = await context.request.get(baseURL + '/api/projects/');
    assert.ok(!(await response.json()).some(project => project.id === fixture.project.id));
    assert.equal((await context.request.get(baseURL + `/api/projects/${fixture.project.slug}/`)).status(), 404);
    assert.equal(orm("print(json.dumps(Project.objects.get(pk=data['id']).status))", { id: fixture.project.id }), 'draft');
    await go('/admin');
    const stats = await adminApi('/users/admin/stats/');
    const draftMetric = page.locator('.admin-stat-grid article').filter({ hasText: 'Project drafts' });
    await until(async () => Number((await draftMetric.locator('strong').innerText()).replaceAll(',', '')) === stats.data.draft_projects, 'Draft dashboard count differs from database');
  });
  await check('Existing draft edits persist and publish to the correct public page', async () => {
    await go(`/admin/projects/${fixture.project.id}/edit`);
    assert.equal(await page.locator('[name="title"]').inputValue(), projectTitle);
    assert.equal(await page.locator('[name="tags"]').inputValue(), 'community, research, solar');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL('**/admin/projects');
    await go(`/projects/${fixture.project.slug}`);
    assert.equal(await page.locator('h1').innerText(), projectTitle);
    assert.ok((await page.locator('body').innerText()).includes('QA Community Research Cooperative'));
    fixture.moderation = orm(`project = Project.objects.get(pk=data['project'])\nmember = User.objects.get(pk=data['member'])\nadmin = User.objects.get(pk=data['admin'])\ncomment = Comment.objects.create(project=project, author=member, body=data['marker']+' thoughtful community energy discussion. '+('Longword' * 100))\nreply = Comment.objects.create(project=project, author=admin, parent=comment, body=data['marker']+' Reply preserved during moderation.')\nreport = Report.objects.create(comment=comment, reporter=admin, reason=data['marker']+' Review whether this discussion stays relevant.')\nmessage = InboxMessage.objects.create(kind='contact', name='QA Contributor', email=data['email'], subject=data['marker']+' A question about community learning', message='Please explain how the educational impact indicator relates to these scenarios.')\nprint(json.dumps({'comment': comment.pk, 'reply': reply.pk, 'report': report.pk, 'message': message.pk}))`, { project: fixture.project.id, member: fixture.member, admin: fixture.admin, marker, email: memberEmail });
  });
  await check('Admin can search and filter actual reported comments', async () => {
    await go('/admin/comments');
    await page.getByLabel('Search comments', { exact: true }).fill(marker);
    await page.getByLabel('Project', { exact: true }).selectOption(String(fixture.project.id));
    await page.getByLabel('Author', { exact: true }).selectOption(String(fixture.member));
    await page.getByLabel('Status', { exact: true }).selectOption('reported');
    await until(async () => (await page.locator('.admin-comment-card').count()) === 1, 'Comment filters did not resolve to the report');
    assert.ok((await page.locator('.admin-comment-card').innerText()).includes('thoughtful community energy discussion'));
  });
  await check('Admin hides/unhides a comment, and public body visibility follows database state', async () => {
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    await page.getByRole('button', { name: 'Unhide', exact: true }).waitFor({ state: 'visible' });
    const hidden = await context.request.get(baseURL + `/api/projects/${fixture.project.id}/comments/`);
    assert.equal((await hidden.json()).find(comment => comment.id === fixture.moderation.comment).body, '');
    await page.getByRole('button', { name: 'Unhide', exact: true }).click();
    await page.getByRole('button', { name: 'Hide', exact: true }).waitFor({ state: 'visible' });
  });
  await check('Admin dismisses a report and can find it in resolved review history', async () => {
    await go('/admin/reports');
    await page.getByLabel('Search comments', { exact: true }).fill(marker);
    await until(async () => (await page.locator('.admin-comment-card').count()) === 1, 'Report search failed');
    await page.getByRole('button', { name: 'Dismiss report', exact: true }).click();
    await until(async () => !(await page.locator('.admin-comment-card').count()), 'Dismissed report stayed open');
    await page.getByLabel('Status', { exact: true }).selectOption('dismissed');
    await until(async () => (await page.locator('.admin-comment-card').count()) === 1, 'Dismissed report history missing');
    assert.equal(orm("print(json.dumps(Report.objects.get(pk=data['id']).status))", { id: fixture.moderation.report }), 'dismissed');
  });
  await check('Feedback dialog opens, resolves persisted contact message, and shows resolved inbox', async () => {
    await go('/admin/feedback');
    await page.getByLabel('Search feedback').fill(marker);
    await page.locator('.admin-inbox-row').click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor({ state: 'visible' });
    assert.match(await dialog.getByRole('link', { name: 'Reply by email' }).getAttribute('href'), /^mailto:/);
    await dialog.getByRole('button', { name: 'Mark resolved' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByLabel('Status', { exact: true }).selectOption('resolved');
    assert.equal(await page.locator('.admin-inbox-row').count(), 1);
    assert.equal(orm("print(json.dumps(InboxMessage.objects.get(pk=data['id']).status))", { id: fixture.moderation.message }), 'resolved');
  });
  await check('Admin creates a member through the user form and views non-sensitive account details', async () => {
    await go('/admin/users/new');
    await page.getByLabel('Full name', { exact: true }).fill('QA New Learning Member');
    await page.getByLabel('Email address', { exact: true }).fill(createdEmail);
    await page.getByLabel('Initial password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    assert.equal(await page.locator('[name="password"]').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.getByRole('button', { name: 'Create user', exact: true }).click();
    await page.waitForURL(/\/admin\/users\/\d+$/);
    fixture.created = Number(page.url().split('/').pop());
    const response = await adminApi(`/users/admin/users/${fixture.created}/`);
    assert.ok(!('password' in response.data) && !('access' in response.data) && !('refresh' in response.data));
    assert.equal(await page.locator('h1').innerText(), 'QA New Learning Member');
  });
  await check('Admin edits member fields, role and access with database persistence', async () => {
    await page.getByRole('link', { name: 'Edit account', exact: true }).click();
    await page.getByLabel('Full name', { exact: true }).fill('QA Updated Learning Member');
    await page.getByLabel('Role', { exact: true }).selectOption('admin');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.waitForURL(`**/admin/users/${fixture.created}`);
    assert.equal(await page.locator('h1').innerText(), 'QA Updated Learning Member');
    assert.equal((await adminApi(`/users/admin/users/${fixture.created}/`)).data.role, 'admin');
  });
  await check('Primary administrator remains protected, and current administrator cannot revoke own access', async () => {
    for (const id of [fixture.admin, fixture.primary].filter(Boolean)) {
      await go(`/admin/users/${id}`);
      assert.equal(await page.getByRole('button', { name: 'Delete account', exact: true }).count(), 0);
      await page.getByRole('link', { name: 'Edit account', exact: true }).click();
      assert.ok(await page.getByLabel('Role', { exact: true }).isDisabled());
      assert.ok(await page.getByLabel('Account can sign in').isDisabled());
      if (id === fixture.primary) assert.ok(await page.getByLabel('Email address', { exact: true }).evaluate(el => el.readOnly));
    }
  });
  const routes = [['overview','/admin'],['projects','/admin/projects'],['project-editor',`/admin/projects/${fixture.project.id}/edit`],['users','/admin/users'],['user-details',`/admin/users/${fixture.member}`],['user-editor',`/admin/users/${fixture.member}/edit`],['comments',`/admin/comments?project=${fixture.project.id}`],['reports','/admin/reports?status=dismissed'],['feedback','/admin/feedback']];
  for (const width of [1920, 1728, 1440, 1280, 1024, 768, 430, 390]) {
    await check(`Admin pages, forms, tables and dialogs fit ${width}px`, async () => {
      await page.setViewportSize({ width, height: 1000 });
      for (const [name, route] of routes) {
        await go(route); await fit(); await screenshot(`${name}-${width}`);
        if (name === 'project-editor') {
          await page.getByRole('button', { name: 'Preview', exact: true }).click();
          await page.getByRole('dialog', { name: 'Project preview' }).waitFor({ state: 'visible' });
          const box = await page.getByRole('dialog', { name: 'Project preview' }).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
          await page.screenshot({ path: path.join(artifactDir, `preview-dialog-${width}.png`) });
          await page.keyboard.press('Escape');
        }
      }
    });
  }
  await check('Mobile admin navigation traps/restores focus and closes after navigation', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await go('/admin');
    const opener = page.getByRole('button', { name: 'Open admin navigation' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Admin workspace' }); await dialog.waitFor({ state: 'visible' });
    for (let index = 0; index < 14; index++) { await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(el => el.contains(document.activeElement))); }
    await page.keyboard.press('Escape'); assert.ok(await opener.evaluate(el => el === document.activeElement));
    await opener.click(); await dialog.getByRole('link', { name: 'Comments', exact: true }).click();
    await page.waitForURL('**/admin/comments'); await dialog.waitFor({ state: 'hidden' });
  });
  await check('Delete confirmation cancels safely, then soft-deletes text while preserving replies', async () => {
    await go(`/admin/comments?project=${fixture.project.id}&user=${fixture.member}`);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(orm("print(json.dumps(Comment.objects.get(pk=data['id']).is_deleted))", { id: fixture.moderation.comment }), false);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete comment', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const result = orm("comment = Comment.objects.get(pk=data['comment'])\nprint(json.dumps({'deleted': comment.is_deleted, 'body': comment.body, 'reply': Comment.objects.filter(pk=data['reply'], parent=comment).exists()}))", fixture.moderation);
    assert.deepEqual(result, { deleted: true, body: '', reply: true });
  });
  await check('Projects with simulations explain deletion protection and retain portfolio history', async () => {
    orm("Investment.objects.create(user_id=data['member'], project_id=data['project'], amount='1000.00')", { member: fixture.member, project: fixture.project.id });
    await go('/admin/projects'); await page.getByLabel('Search projects', { exact: true }).fill(marker);
    await page.getByRole('button', { name: `Delete ${projectTitle}`, exact: true }).click();
    const dialog = page.getByRole('dialog'); assert.match(await dialog.innerText(), /cannot be deleted/);
    expectedHttpError = true;
    const responseWait = page.waitForResponse(response => response.url().endsWith(`/projects/admin/${fixture.project.id}/`) && response.request().method() === 'DELETE');
    await dialog.getByRole('button', { name: 'Delete project', exact: true }).click();
    assert.equal((await responseWait).status(), 409); await dialog.getByRole('alert').waitFor({ state: 'visible' });
    await page.waitForTimeout(100); expectedHttpError = false;
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(orm("print(json.dumps(Investment.objects.filter(project_id=data['project'], user_id=data['member']).count()))", { member: fixture.member, project: fixture.project.id }), 1);
  });
  await check('Admin deletes only the generated member account through confirmed UI action', async () => {
    await go(`/admin/users/${fixture.created}`);
    await page.getByRole('button', { name: 'Delete account', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete account', exact: true }).click();
    await page.waitForURL('**/admin/users');
    assert.equal(orm("print(json.dumps(User.objects.filter(pk=data['id'], email=data['email']).exists()))", { id: fixture.created, email: createdEmail }), false);
  });
  await check('Admin logout confirmation closes the session and public navigation has no admin links', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 }); await go('/admin');
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click();
    await page.waitForURL('**/admin/login');
    await go('/projects');
    assert.equal(await page.locator('header a[href^="/admin"],footer a[href^="/admin"]').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('vestra.auth')), null);
  });
  await check('Admin browser has no unexpected console errors or warnings', async () => { assert.deepEqual(errors, []); assert.deepEqual(warnings, []); });
})().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  try {
    orm(`assert data['marker'].startswith('qa_admin_')\naccounts = User.objects.filter(email__in=data['emails'], username__startswith=data['marker'])\nInvestment.objects.filter(user__in=accounts).delete()\nProject.objects.filter(title=data['title']).delete()\nInboxMessage.objects.filter(email__in=data['emails'], subject__startswith=data['marker']).delete()\naccounts.delete()`, { marker, emails: [adminEmail, memberEmail, createdEmail], title: projectTitle });
  } catch (error) { errors.push(`Fixture cleanup failed: ${error.message}`); process.exitCode = 1; }
  const report = { status: process.exitCode ? 'FAIL' : 'PASS', checks, errors, warnings, fixturesRemoved: !errors.some(error => error.startsWith('Fixture cleanup')), baseURL };
  fs.writeFileSync(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`Admin report: ${path.join(artifactDir, 'report.json')}\n`);
});
