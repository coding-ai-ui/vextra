import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import axios from 'axios';
import { authDestination, validateLogin, validateRegistration } from '../src/Services/authValidation.js';

// Test the actual Axios interceptors against a real local HTTP server. No API,
// browser, external network access, credentials, or additional packages needed.
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
let mode = 'success';
let refreshes = 0;
let onRefresh;
let service;
const server = http.createServer(async (request, response) => {
  const requestMode = mode;
  const send = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
  };
  if (request.url === '/api/users/refresh/') {
    refreshes += 1;
    onRefresh?.();
    await new Promise((resolve) => setTimeout(resolve, requestMode === 'delayed' ? 120 : 35));
    if (requestMode === 'invalid') return send(401, { detail: 'Token is invalid' });
    if (requestMode === 'offline') return send(503, { detail: 'Temporarily unavailable' });
    return send(200, { access: 'fresh-access', refresh: 'rotated-refresh' });
  }
  if (request.url === '/api/users/login/') return send(401, { detail: 'Invalid credentials' });
  if (request.headers.authorization === 'Bearer fresh-access' && requestMode !== 'retry-invalid') return send(200, { ok: true });
  if (request.url === '/api/late/') await new Promise((resolve) => setTimeout(resolve, 90));
  return send(401, { detail: 'Expired access token' });
});

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // Route both clients (normal API and refresh) to the test server, without
  // rewriting source or adding test-only behavior to the production module.
  const makeClient = axios.create;
  axios.create = (options) => makeClient({ ...options, baseURL: `http://127.0.0.1:${server.address().port}/api` });
  try {
    service = await import('../src/Services/api.js');
  } finally {
    axios.create = makeClient;
  }
});

beforeEach(() => {
  mode = 'success';
  refreshes = 0;
  onRefresh = undefined;
  service.clearAuthTokens();
  storage.clear();
});

after(async () => {
  service.clearAuthTokens();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('concurrent expired requests share one refresh and persist both rotated tokens', async () => {
  service.setAuthTokens({ access: 'expired-access', refresh: 'original-refresh' });
  const responses = await Promise.all([
    service.default.get('/protected/'),
    service.default.get('/protected/'),
    service.default.get('/protected/'),
  ]);
  assert.ok(responses.every((response) => response.data.ok));
  assert.equal(refreshes, 1);
  assert.deepEqual(service.getAuthTokens(), { access: 'fresh-access', refresh: 'rotated-refresh' });
  assert.deepEqual(JSON.parse(storage.get(service.TOKEN_STORAGE_KEY)), service.getAuthTokens());
});

test('a late 401 retries the already-refreshed access token without a second rotation', async () => {
  service.setAuthTokens({ access: 'expired-access', refresh: 'original-refresh' });
  await Promise.all([service.default.get('/protected/'), service.default.get('/late/')]);
  assert.equal(refreshes, 1);
});

test('an invalid refresh clears tokens and cached identity and announces logout', async () => {
  mode = 'invalid';
  service.setAuthTokens({ access: 'expired-access', refresh: 'invalid-refresh' });
  storage.set('vestra.user', JSON.stringify({ id: 1, username: 'demo' }));
  let cleared = 0;
  const listener = () => { cleared += 1; };
  window.addEventListener(service.AUTH_CLEARED_EVENT, listener);
  try {
    await assert.rejects(service.default.get('/protected/'));
    assert.equal(refreshes, 1);
    assert.equal(service.getAuthTokens(), null);
    assert.equal(storage.has('vestra.user'), false);
    assert.equal(storage.has(service.TOKEN_STORAGE_KEY), false);
    assert.equal(cleared, 1);
  } finally {
    window.removeEventListener(service.AUTH_CLEARED_EVENT, listener);
  }
});

test('temporary server failures preserve the session for a later retry', async () => {
  mode = 'offline';
  service.setAuthTokens({ access: 'expired-access', refresh: 'valid-refresh' });
  await assert.rejects(service.default.get('/protected/'));
  assert.equal(service.getAuthTokens().refresh, 'valid-refresh');
  mode = 'success';
  assert.equal((await service.default.get('/protected/')).data.ok, true);
});

test('logout cancels a pending refresh and cannot resurrect its session', async () => {
  mode = 'delayed';
  service.setAuthTokens({ access: 'expired-access', refresh: 'valid-refresh' });
  const started = new Promise((resolve) => { onRefresh = resolve; });
  const pending = service.default.get('/protected/').then(() => null, (error) => error);
  await started;
  service.clearAuthTokens();
  assert.ok(axios.isCancel(await pending));
  assert.equal(service.getAuthTokens(), null);
  assert.equal(storage.has(service.TOKEN_STORAGE_KEY), false);
});

test('a new login cancels an old refresh and preserves the new session', async () => {
  mode = 'delayed';
  service.setAuthTokens({ access: 'expired-access', refresh: 'old-refresh' });
  const started = new Promise((resolve) => { onRefresh = resolve; });
  const pending = service.default.get('/protected/').then(() => null, (error) => error);
  await started;
  service.setAuthTokens({ access: 'new-login-access', refresh: 'new-login-refresh' });
  assert.ok(axios.isCancel(await pending));
  assert.equal(service.getAuthTokens().access, 'new-login-access');
});

test('credential failures bypass refresh and do not invalidate a current session', async () => {
  service.setAuthTokens({ access: 'expired-access', refresh: 'valid-refresh' });
  await assert.rejects(service.default.post('/users/login/', { username: 'demo', password: 'incorrect' }, { skipAuth: true }));
  assert.equal(refreshes, 0);
  assert.equal(service.getAuthTokens().refresh, 'valid-refresh');
});

test('a failed authenticated retry ends the session after exactly one refresh', async () => {
  mode = 'retry-invalid';
  service.setAuthTokens({ access: 'expired-access', refresh: 'valid-refresh' });
  await assert.rejects(service.default.get('/protected/'));
  assert.equal(refreshes, 1);
  assert.equal(service.getAuthTokens(), null);
});

test('an unauthenticated request never attempts refresh', async () => {
  await assert.rejects(service.default.get('/protected/'));
  assert.equal(refreshes, 0);
});

test('registration validates required credentials, email, password strength, and confirmation', () => {
  const valid = { username: 'vestra_learner', email: 'learner@example.com', password: 'ExamplePass42!', confirmPassword: 'ExamplePass42!' };
  assert.deepEqual(validateRegistration(valid), {});
  assert.deepEqual(Object.keys(validateRegistration({ username: '', email: '', password: '', confirmPassword: '' })), ['username', 'email', 'password', 'confirmPassword']);
  assert.ok(validateRegistration({ ...valid, email: 'invalid@' }).email);
  assert.ok(validateRegistration({ ...valid, username: 'contains spaces' }).username);
  assert.ok(validateRegistration({ ...valid, username: 'contains@email' }).username);
  assert.ok(validateRegistration({ ...valid, username: 'x'.repeat(151) }).username);
  assert.ok(validateRegistration({ ...valid, password: 'short' }).password);
  assert.ok(validateRegistration({ ...valid, password: '12345678' }).password);
  assert.ok(validateRegistration({ ...valid, password: '        ' }).password);
  assert.ok(validateRegistration({ ...valid, password: 'x'.repeat(129) }).password);
  assert.ok(validateRegistration({ ...valid, confirmPassword: 'different' }).confirmPassword);
  assert.deepEqual(validateRegistration({ ...valid, username: 'Adéọlá' }), {});
});

test('login accepts an email or username and requires a password', () => {
  assert.deepEqual(validateLogin({ username: 'learner@example.com', password: 'ExamplePass42!' }), {});
  assert.deepEqual(validateLogin({ username: 'learner', password: 'ExamplePass42!' }), {});
  assert.deepEqual(Object.keys(validateLogin({ username: ' ', password: '' })), ['username', 'password']);
});

test('auth redirect retains search and hash and rejects external destinations and auth loops', () => {
  assert.equal(authDestination({ from: { pathname: '/projects/1', search: '?view=detail', hash: '#simulator' } }), '/projects/1?view=detail#simulator');
  assert.equal(authDestination({ from: '/projects/1#simulator', resumeState: { amount: '5000' } }), '/projects/1#simulator');
  for (const from of ['https://example.com', '//example.com', '/\\example.com', '/login', '/register?next=elsewhere']) {
    assert.equal(authDestination({ from }), '/dashboard');
  }
  assert.equal(authDestination(null), '/dashboard');
});

test('API errors hide backend HTML and provide usable connection and server messages', () => {
  assert.match(service.errorMessage(new Error('Network failed')), /could not connect/);
  assert.match(service.errorMessage({ response: { status: 503, data: '<html>traceback</html>' } }), /temporarily unavailable/);
  assert.equal(service.errorMessage({ response: { status: 400, data: { detail: 'Choose a valid amount.' } } }), 'Choose a valid amount.');
  assert.equal(service.errorMessage({ response: { status: 404, data: '<html>not found</html>' } }, 'This project is unavailable.'), 'This project is unavailable.');
});
