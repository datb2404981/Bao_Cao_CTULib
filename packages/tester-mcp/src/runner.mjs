import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, realpath, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(
  process.env.TESTER_PROJECT_ROOT || fileURLToPath(new URL('../../../', import.meta.url))
);
const outputRoot = join(projectRoot, 'qa', 'explorbot', 'output');
const lockDirectory = join(outputRoot, '.tester-mcp.lock');
const lockOwnerFile = join(lockDirectory, 'owner.json');
const baseUrl = (process.env.TESTER_BASE_URL || 'http://127.0.0.1:5174').replace(/\/$/, '');
const apiUrl = process.env.TESTER_API_URL || 'http://127.0.0.1:8080';
const ollamaUrl = process.env.TESTER_OLLAMA_URL || 'http://127.0.0.1:11434';
const pnpmBinary = process.env.TESTER_PNPM_BIN || 'pnpm';
const qaDbUri = 'mongodb://127.0.0.1:27029/ctulib_qa_loan_tests?replicaSet=ctulibQArs';
const loanQaDbUri = 'mongodb://127.0.0.1:27029/ctulib_explorbot_e2e?replicaSet=ctulibQArs';
const qaBookId = '56e6630ff48c0647904890f3';
const outputLimit = 14000;
let busy = null;

const lockOwner = async () => {
  try {
    const owner = JSON.parse(await readFile(lockOwnerFile, 'utf8'));
    return { pid: owner.pid, workflow: owner.workflow, startedAt: owner.startedAt };
  } catch {
    return { workflow: 'Không xác định (kiểm tra khóa QA còn sót)' };
  }
};

// Atomic mkdir also excludes workflows started by a different MCP process.
// An abandoned lock is deliberately not removed automatically. A crashed
// parent might have left a browser or a database-writing child alive.
export const acquireWorkflowLock = async (workflowName) => {
  await mkdir(outputRoot, { recursive: true });
  try {
    await mkdir(lockDirectory);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = await lockOwner();
    throw new Error(`QA đang có lượt kiểm thử khác (${owner.workflow}, PID ${owner.pid ?? '?'}). ` +
      `Chỉ xóa khóa ${lockDirectory} sau khi xác minh tiến trình cũ đã kết thúc.`);
  }
  try {
    await writeFile(lockOwnerFile, JSON.stringify({
      pid: process.pid, workflow: workflowName, startedAt: new Date().toISOString()
    }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    await rmdir(lockDirectory).catch(() => {});
    throw error;
  }
  return async () => {
    await unlink(lockOwnerFile);
    await rmdir(lockDirectory);
  };
};

const assertLocalQaTarget = () => {
  if (baseUrl !== 'http://127.0.0.1:5174' || apiUrl !== 'http://127.0.0.1:8080') {
    throw new Error('Kiểm thử tương tác chỉ được phép trên frontend QA 127.0.0.1:5174 và API QA 127.0.0.1:8080.');
  }
};

const redact = (value) => {
  let safe = String(value);
  for (const [name, secret] of Object.entries(process.env)) {
    if (/(PASSWORD|TOKEN|API_KEY|SECRET)/i.test(name) && secret?.length >= 6) {
      safe = safe.replaceAll(secret, '[REDACTED]');
    }
  }
  return safe.replace(/Bearer\s+[A-Za-z0-9_.\-]+/gi, 'Bearer [REDACTED]');
};

const tail = (previous, chunk) => (previous + chunk.toString('utf8')).slice(-outputLimit);

export const validatePage = (page) => {
  if (typeof page !== 'string' || !/^\/(?:#\/)?[a-zA-Z0-9/_-]{1,120}$/.test(page)) {
    throw new Error('Đường dẫn trang phải có dạng /#/auth hoặc /#/catalog.');
  }
  return page;
};

export const validatePlanName = (name) => {
  if (typeof name !== 'string' || basename(name) !== name || !/^[\w-]+\.md$/.test(name)) {
    throw new Error('Chỉ nhận tên file .md trong thư mục kế hoạch QA.');
  }
  return name;
};

export const validatePlanIndex = (index = '1') => {
  if (typeof index !== 'string' || !/^\d{1,2}(?:[-,]\d{1,2})*$/.test(index)) {
    throw new Error('Chỉ số test hợp lệ là 1, 1-3 hoặc 1,3.');
  }
  return index;
};

export const buildArgs = (action, params = {}) => {
  switch (action) {
    case 'smoke':
      return ['qa:smoke'];
    case 'loan':
      return ['qa:loan'];
    case 'plan':
      return ['qa:plan', validatePage(params.page), '--focus', params.focus, '--max-tests', String(params.maxTests)];
    case 'explore':
      return ['qa:explore', validatePage(params.page), '--focus', params.focus,
        '--max-tests', String(params.maxTests), '--max-duration', String(params.durationMinutes)];
    case 'context':
      return ['qa:context', validatePage(params.page)];
    case 'run_plan':
      return ['exec', 'explorbot', 'test',
        join('qa', 'explorbot', 'output', 'plans', validatePlanName(params.name)),
        validatePlanIndex(params.index)];
    default:
      throw new Error('Lệnh QA không được hỗ trợ.');
  }
};

const spawnCommand = (args, env, timeoutMs) => new Promise((resolveDone) => {
  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let settled = false;
  const child = spawn(pnpmBinary, args, {
    cwd: projectRoot,
    env: { ...process.env, EXPLORBOT_URL: baseUrl,
      EXPLORBOT_AI_PROVIDER: process.env.TESTER_AI_PROVIDER || 'ollama', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true
  });
  const terminate = (signal) => {
    if (!child.pid) return;
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch {
      // Tiến trình đã kết thúc.
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    terminate('SIGTERM');
    const forceTimer = setTimeout(() => terminate('SIGKILL'), 1500);
    forceTimer.unref();
  }, timeoutMs);
  child.stdout?.on('data', (chunk) => { stdout = tail(stdout, chunk); });
  child.stderr?.on('data', (chunk) => { stderr = tail(stderr, chunk); });
  const settle = (exitCode, error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolveDone({
      command: args.join(' '),
      ok: !error && !timedOut && exitCode === 0,
      exitCode,
      timedOut,
      elapsedMs: Date.now() - startedAt,
      stdout: redact(stdout),
      stderr: redact(stderr),
      ...(error ? { error: redact(error.message) } : {})
    });
  };
  child.on('error', (error) => settle(null, error));
  child.on('close', (code) => settle(code));
});

const verifyQaBackend = async () => {
  const expression = `
    const opts = db.adminCommand({ getCmdLineOpts: 1 }).parsed;
    const book = db.books.findOne({ _id: ObjectId('${qaBookId}') }, { availableCopies: 1 });
    const safe = db.getName() === 'ctulib_explorbot_e2e' && opts.net?.port === 27029
      && opts.net?.bindIp === '127.0.0.1' && db.hello().isWritablePrimary;
    print(JSON.stringify({ safe, stock: book?.availableCopies }));
  `;
  const mongoResult = await spawnCommand(
    ['exec', 'mongosh', loanQaDbUri, '--quiet', '--eval', expression], {}, 15000
  );
  if (!mongoResult.ok) throw new Error('Không xác minh được MongoDB QA: ' + mongoResult.stderr);
  let snapshot;
  try {
    snapshot = JSON.parse(mongoResult.stdout.trim().split('\n').at(-1));
  } catch {
    throw new Error('MongoDB QA không trả kết quả xác minh hợp lệ.');
  }
  if (!snapshot.safe || !Number.isInteger(snapshot.stock) || snapshot.stock < 1) {
    throw new Error('MongoDB QA không đúng cấu hình hoặc chưa có sách thử nghiệm.');
  }
  for (const origin of [apiUrl, baseUrl]) {
    const response = await fetch(origin + '/book?limit=12', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('API QA không sẵn sàng qua ' + origin);
    const items = (await response.json()).data?.items;
    if (items?.length !== 12 || !items.some((item) =>
      item.bookId === qaBookId && item.availableCopies === snapshot.stock)) {
      throw new Error('API ở ' + origin + ' chưa khớp dữ liệu MongoDB QA. Chặn kiểm thử có ghi dữ liệu.');
    }
  }
};

const workflow = async (name, commands, requiresQaVerification = false) => {
  if (busy) return { ok: false, error: 'Một lượt kiểm thử đang chạy: ' + busy };
  busy = name;
  let releaseLock;
  try {
    await access(join(projectRoot, 'explorbot.config.js'));
    releaseLock = await acquireWorkflowLock(name);
    if (requiresQaVerification) await verifyQaBackend();
    const results = [];
    for (const command of commands) {
      const result = await spawnCommand(command.args, command.env, command.timeoutMs);
      results.push(result);
      if (!result.ok) break;
    }
    return { ok: results.length === commands.length && results.every((result) => result.ok),
      workflow: name, qaVerified: requiresQaVerification, results };
  } finally {
    if (releaseLock) await releaseLock();
    busy = null;
  }
};

const limits = (value, min, max, label) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(label + ' phải từ ' + min + ' đến ' + max + '.');
  }
};

export const runAction = async (action, params = {}) => {
  assertLocalQaTarget();
  const aiActions = ['plan', 'explore', 'context', 'run_plan'];
  if (aiActions.includes(action) && params.page !== undefined) validatePage(params.page);
  if (['plan', 'explore'].includes(action)) {
    if (typeof params.focus !== 'string' || params.focus.trim().length < 5 || params.focus.length > 240) {
      throw new Error('Chủ đề kiểm thử cần từ 5 đến 240 ký tự.');
    }
    limits(params.maxTests, 1, 10, 'Số test');
  }
  if (action === 'explore') limits(params.durationMinutes, 1, 15, 'Thời gian khám phá');
  if (action === 'run_plan') {
    const file = join(outputRoot, 'plans', validatePlanName(params.name));
    const actual = await realpath(file);
    if (!actual.startsWith(join(outputRoot, 'plans') + sep)) throw new Error('Đường dẫn plan ngoài thư mục QA.');
  }

  if (action === 'regression') {
    return workflow(action, [
      { args: ['--filter', '@ctulib/frontend', 'test'], timeoutMs: 120000 },
      { args: ['--filter', '@ctulib/backend', 'test'], env: { CTULIB_TEST_MONGODB_URI: qaDbUri }, timeoutMs: 120000 },
      { args: ['build'], timeoutMs: 120000 },
      { args: ['qa:smoke'], timeoutMs: 120000 }
    ]);
  }

  const args = buildArgs(action, params);
  const startedAt = Date.now();
  const artifactKinds = action === 'plan' ? ['plans']
    : ['explore', 'run_plan'].includes(action) ? ['reports', 'tests'] : [];
  const priorArtifacts = new Map();
  for (const kind of artifactKinds) {
    priorArtifacts.set(kind, new Map((await listArtifacts(kind)).map((file) =>
      [file.name, file.modifiedAt])));
  }
  const timeoutMs = action === 'smoke' ? 120000
    : action === 'loan' ? 180000
    : action === 'explore' ? (params.durationMinutes + 2) * 60000
    : 360000;
  const result = await workflow(action, [{ args, timeoutMs }],
    ['loan', 'explore', 'run_plan'].includes(action));
  if (artifactKinds.length) {
    const updated = [];
    for (const kind of artifactKinds) {
      const latest = await listArtifacts(kind);
      updated.push(...latest.filter((file) =>
        priorArtifacts.get(kind).get(file.name) !== file.modifiedAt &&
        new Date(file.modifiedAt).getTime() >= startedAt - 2000
      ).map((file) => ({ kind, name: file.name, modifiedAt: file.modifiedAt })));
    }
    result.artifacts = updated;
    const requiredKind = action === 'plan' ? 'plans' : 'reports';
    if (result.ok && !updated.some((file) => file.kind === requiredKind)) {
      result.ok = false;
      result.artifactError = 'Không có ' + requiredKind + ' mới từ lượt kiểm thử này.';
    }
    if (action === 'explore' || action === 'run_plan') {
      result.testOutcome = result.results?.some((entry) => entry.timedOut)
        ? 'BLOCKED' : result.ok ? 'REVIEW_REQUIRED' : 'FAILED';
      for (const file of updated.filter((entry) => entry.kind === 'reports' && entry.name.endsWith('.md'))) {
        const report = await readArtifact('reports', file.name);
        if (/no successful assertions|no assertions|AI request timeout/i.test(report.text)) {
          result.ok = false;
          result.testOutcome = 'BLOCKED';
          result.artifactError = 'Explorbot timeout hoặc không tạo được assertion xác minh.';
          break;
        }
      }
    }
  }
  if (['smoke', 'loan'].includes(action)) {
    const reportFile = join(outputRoot, 'reports',
      action === 'smoke' ? 'ctulib-guest-smoke-latest.json' : 'ctulib-loan-lifecycle-latest.json');
    try {
      const fileStats = await stat(reportFile);
      if (fileStats.mtimeMs < startedAt - 2000) throw new Error('Báo cáo chưa cập nhật từ lượt chạy này.');
      const data = JSON.parse(await readFile(reportFile, 'utf8'));
      result.report = action === 'smoke'
        ? { createdAt: data.createdAt, passed: data.passed, failed: data.failed, blocked: data.blocked }
        : { createdAt: data.createdAt, summary: data.summary, loanId: data.loanId, initialStock: data.initialStock };
      const counts = action === 'smoke'
        ? { failed: data.failed, blocked: data.blocked }
        : { failed: data.summary?.FAIL, blocked: data.summary?.BLOCKED };
      if (counts.failed || counts.blocked) result.ok = false;
    } catch (error) {
      result.report = { error: error.message };
      result.ok = false;
    }
  }
  return result;
};

export const listArtifacts = async (kind = 'reports') => {
  if (!['reports', 'plans', 'tests'].includes(kind)) throw new Error('Loại đầu ra không hợp lệ.');
  const folder = join(outputRoot, kind);
  try {
    const files = await readdir(folder, { withFileTypes: true });
    const details = await Promise.all(files.filter((file) => file.isFile()).map(async (file) => {
      const stats = await stat(join(folder, file.name));
      return { name: file.name, bytes: stats.size, modifiedAt: stats.mtime.toISOString() };
    }));
    return details.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 30);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

export const readArtifact = async (kind, name) => {
  const allowed = {
    reports: /^[\w.-]+\.(?:md|json)$/,
    plans: /^[\w.-]+\.md$/,
    tests: /^[\w.-]+\.(?:md|js|cjs|mjs|ts)$/
  };
  if (!allowed[kind] || typeof name !== 'string' || basename(name) !== name || !allowed[kind].test(name)) {
    throw new Error('Tên file hoặc loại tài liệu QA không được phép.');
  }
  const root = join(outputRoot, kind);
  const actual = await realpath(join(root, name));
  if (!actual.startsWith(root + sep)) throw new Error('File không thuộc thư mục QA.');
  const contents = await readFile(actual, 'utf8');
  return { kind, name, text: redact(contents.slice(0, 50000)), truncated: contents.length > 50000 };
};

const httpStatus = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2800) });
    return { reachable: true, statusCode: res.status };
  } catch (error) {
    return { reachable: false, reason: error.cause?.code || error.name };
  }
};

const tcpStatus = (port) => new Promise((done) => {
  const socket = connect({ host: '127.0.0.1', port });
  const finish = (reachable) => { socket.destroy(); done(reachable); };
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
  socket.setTimeout(2800, () => finish(false));
});

export const getStatus = async () => {
  const [frontend, backend, mongoQa, ollama] = await Promise.all([
    httpStatus(baseUrl),
    httpStatus(apiUrl + '/book?limit=12'),
    tcpStatus(27029),
    httpStatus(ollamaUrl + '/api/tags')
  ]);
  let models = [];
  if (ollama.reachable) {
    try {
      const res = await fetch(ollamaUrl + '/api/tags', { signal: AbortSignal.timeout(3000) });
      models = (await res.json()).models?.map((model) => model.name) || [];
    } catch {
      models = [];
    }
  }
  let currentWorkflow = busy;
  if (!currentWorkflow) {
    try {
      await access(lockDirectory);
      currentWorkflow = await lockOwner();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { projectRoot, busy: currentWorkflow, frontend, backend, mongoQa: { port: 27029, reachable: mongoQa }, ollama, models };
};
