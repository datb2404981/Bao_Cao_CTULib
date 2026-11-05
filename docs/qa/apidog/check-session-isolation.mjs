// Independent HTTP diagnostic; does not execute or replace Apidog v3 assertions.
import assert from 'node:assert/strict';

const root = new URL(process.argv[2] || 'http://localhost:8080');
assert(root.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(root.hostname), 'Only local test servers are allowed');
assert(root.pathname === '/' && !root.search && !root.hash && !root.username && !root.password, 'Use an origin only');
const results = [];
async function request(path, cookie, body) {
  const headers = { Origin: 'http://localhost:5173' };
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(new URL(path, root), {
    method: 'POST', headers, redirect: 'error',
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
}
async function missing(label) {
  const response = await request('/api/v1/auth/refresh');
  const body = await response.json();
  assert.equal(response.status, 401, `${label}: expected HTTP 401; verify the listening service`);
  assert.equal(body.status, 'error');
  assert.equal(body.data, null);
  results.push({ step: label, status: response.status });
}
await missing('missing cookie before login');
for (let iteration = 1; iteration <= 3; iteration++) {
  let cookie;
  try {
    const login = await request('/api/v1/auth/login', undefined, { ctuIdentifier: 'B9900001', password: 'QaReader123!' });
    assert.equal(login.status, 200, 'Fixed QA account login must succeed');
    const body = await login.json();
    assert.equal(body.data?.user?.ctuIdentifier, 'B9900001');
    assert.equal(body.data?.user?.role, 'READER');
    cookie = login.headers.getSetCookie().find(value => value.startsWith('refreshToken='))?.split(';')[0];
    assert(cookie, 'Login must issue a refresh cookie');
    await missing(`round ${iteration}: missing cookie after login`);
    const refresh = await request('/api/v1/auth/refresh', cookie);
    assert.equal(refresh.status, 200, 'Positive control with explicit cookie must succeed');
    // Keep the latest cookie for cleanup if rotation is implemented later.
    cookie = refresh.headers.getSetCookie().find(value => value.startsWith('refreshToken='))?.split(';')[0] || cookie;
    results.push({ step: `round ${iteration}: explicit valid cookie`, status: refresh.status });
    await missing(`round ${iteration}: missing cookie after refresh`);
  } finally {
    if (cookie) {
      const logout = await request('/api/v1/auth/logout', cookie);
      assert.equal(logout.status, 200, 'Fixture session cleanup must succeed');
    }
  }
  await missing(`round ${iteration}: missing cookie after logout`);
}
console.log(JSON.stringify({ server: root.origin, passed: results.length, results }, null, 2));
