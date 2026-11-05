import { writeFile } from 'node:fs/promises';

// Chỉ tạo/xóa các bản ghi QA của lần chạy này; không dùng dữ liệu sẵn có.
const base = 'http://localhost:8080';
const prefix = `QA_FACULTY_RETEST_${Date.now()}`;
const owned = new Set();
const results = [];
const missing = '000000000000000000000001';
async function call(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return { code: response.status, body: await response.json() };
}
async function check(id, method, path, body, code, verify = () => true) {
  try {
    const actual = await call(method, path, body);
    const pass = actual.code === code && verify(actual.body);
    results.push({ id, method, path, expectedCode: code, actualCode: actual.code, pass,
      response: Array.isArray(actual.body.data)
        ? { ...actual.body, data: { count: actual.body.data.length } } : actual.body });
    if (method === 'POST' && actual.code === 201 && actual.body.data?.facultyName?.startsWith(prefix)) {
      owned.add(actual.body.data._id);
    }
    return actual;
  } catch (error) {
    results.push({ id, method, path, pass: false, error: error.message });
  }
}
const success = body => body.status === 'success';
const errorMessage = message => body => body.status === 'error' && body.message === message;
try {
  await check('LIST', 'GET', '/faculty', undefined, 200, b => success(b) && Array.isArray(b.data));
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const body = method === 'PUT' ? { facultyName: prefix } : undefined;
    await check(`${method}_BAD_ID`, method, '/faculty/invalid', body, 400, errorMessage('Mã khoa không hợp lệ'));
    await check(`${method}_NOT_FOUND`, method, `/faculty/${missing}`, body, 404, errorMessage('Khoa không tồn tại'));
  }
  const invalid = [
    ['EMPTY_BODY', {}, 'facultyName'],
    ['MISSING_NAME', { description: 'x' }, 'facultyName'],
    ['NULL_NAME', { facultyName: null }, 'facultyName'],
    ['NUMBER_NAME', { facultyName: 1 }, 'facultyName'],
    ['BOOL_NAME', { facultyName: true }, 'facultyName'],
    ['ARRAY_NAME', { facultyName: [] }, 'facultyName'],
    ['OBJECT_NAME', { facultyName: {} }, 'facultyName'],
    ['EMPTY_NAME', { facultyName: '' }, 'facultyName'],
    ['SPACE_NAME', { facultyName: '   ' }, 'facultyName'],
    ['NAME_101', { facultyName: 'A'.repeat(101) }, 'facultyName'],
    ['NULL_DESC', { facultyName: prefix, description: null }, 'description'],
    ['NUMBER_DESC', { facultyName: prefix, description: 1 }, 'description'],
    ['ARRAY_DESC', { facultyName: prefix, description: [] }, 'description'],
    ['DESC_1001', { facultyName: prefix, description: 'A'.repeat(1001) }, 'description'],
    ['EXTRA_FIELD', { facultyName: prefix, extra: true }, 'extra'],
  ];
  const first = await check('CREATE_VALID', 'POST', '/faculty', { facultyName: prefix, description: 'original' }, 201, success);
  const id = first?.body?.data?._id;
  if (!owned.has(id)) throw new Error('Không tạo được fixture riêng; dừng các ca phụ thuộc.');
  for (const method of ['POST', 'PUT']) {
    for (const [label, body, field] of invalid) {
      await check(`${method}_${label}`, method, method === 'POST' ? '/faculty' : `/faculty/${id}`, body, 400,
        b => b.status === 'error' && b.message === 'Dữ liệu gửi lên không hợp lệ' && b.errors?.some(e => e.field === field));
    }
  }
  await check('GET_EXISTING', 'GET', `/faculty/${id}`, undefined, 200, b => success(b) && b.data?.facultyName === prefix);
  await check('DUPLICATE', 'POST', '/faculty', { facultyName: prefix }, 409, errorMessage('Khoa đã tồn tại'));
  await check('DUPLICATE_TRIM', 'POST', '/faculty', { facultyName: ` ${prefix} ` }, 409, errorMessage('Khoa đã tồn tại'));
  const variants = [
    ['NAME_100', { facultyName: prefix.padEnd(100, 'A') }],
    ['DESC_1000', { facultyName: prefix + '_DESC', description: 'A'.repeat(1000) }],
    ['EMPTY_DESC', { facultyName: prefix + '_EMPTY', description: '' }],
    ['TRIM', { facultyName: ` ${prefix}_TRIM `, description: ' text ' }],
  ];
  for (const [label, body] of variants) {
    await check(`CREATE_${label}`, 'POST', '/faculty', body, 201,
      b => success(b) && b.data?.facultyName === body.facultyName.trim() &&
        (body.description === undefined || b.data.description === body.description.trim()));
  }
  await check('UPDATE_VALID', 'PUT', `/faculty/${id}`, { facultyName: prefix + '_UPDATED', description: 'updated' }, 200, success);
  await check('UPDATE_PERSISTED', 'GET', `/faculty/${id}`, undefined, 200,
    b => success(b) && b.data?.facultyName === prefix + '_UPDATED' && b.data.description === 'updated');
  await check('UPDATE_DUPLICATE', 'PUT', `/faculty/${id}`, { facultyName: prefix + '_DESC' }, 409,
    errorMessage('Dữ liệu đã tồn tại'));
  await check('UPDATE_SAME_NAME', 'PUT', `/faculty/${id}`, { facultyName: prefix + '_UPDATED' }, 200, success);
  await check('UPDATE_NAME_100', 'PUT', `/faculty/${id}`, { facultyName: (prefix + '_UP').padEnd(100, 'B'), description: 'B'.repeat(1000) }, 200, success);
  // Hai request trùng đồng thời chỉ được tạo một bản ghi.
  const race = await Promise.all([call('POST', '/faculty', { facultyName: prefix + '_RACE' }), call('POST', '/faculty', { facultyName: prefix + '_RACE' })]);
  for (const r of race) if (r.code === 201 && r.body.data?.facultyName === prefix + '_RACE') owned.add(r.body.data._id);
  results.push({ id: 'CONCURRENT_DUPLICATE', expectedCodes: [201, 409], actualCodes: race.map(r => r.code).sort(),
    pass: JSON.stringify(race.map(r => r.code).sort()) === '[201,409]', responses: race.map(r => r.body) });
} finally {
  for (const id of owned) {
    await check(`CLEANUP_${id}`, 'DELETE', `/faculty/${id}`, undefined, 200, success);
    await check(`VERIFY_DELETED_${id}`, 'GET', `/faculty/${id}`, undefined, 404, errorMessage('Khoa không tồn tại'));
  }
  const report = { time: new Date().toISOString(), source: 'HTTP trực tiếp; chưa lấy được test case Apidog (connector 429)',
    criteria: 'Review code: ID sai 400, không tồn tại 404, trùng 409; kiểm tra status, dữ liệu và errors.',
    total: results.length, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
  await writeFile(new URL('./faculty-http-retest-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, failures: results.filter(r => !r.pass) }, null, 2));
}
