const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const webUrl = 'http://127.0.0.1:5174';
const apiUrl = 'http://127.0.0.1:8080';
const mongoUri = 'mongodb://127.0.0.1:27029/ctulib_explorbot_e2e?replicaSet=ctulibQArs';
const bookId = '56e6630ff48c0647904890f3';
const bookTitle = 'Lập trình Web với Node.js và TypeScript';
const reportDir = join(__dirname, 'output', 'reports');
const reader = { identifier: process.env.CTULIB_QA_READER_ID, password: process.env.CTULIB_QA_READER_PASSWORD };
const employee = { identifier: process.env.CTULIB_QA_EMPLOYEE_ID, password: process.env.CTULIB_QA_EMPLOYEE_PASSWORD };

const checks = [];
const issues = { javascript: [], http5xx: [], requests: [] };
let loanId = null;
let initialStock = null;
let browser;
let stage = '';

const steps = [
  'Môi trường QA và dữ liệu mẫu',
  'Đăng nhập độc giả trên desktop',
  'Tìm sách và mở chi tiết',
  'Đặt mượn qua giao diện',
  'Phiếu độc giả và giảm tồn kho',
  'Đăng nhập nhân viên và mở đúng phiếu',
  'Bàn giao sách và giữ nguyên tồn kho',
  'Tiếp nhận trả sách và hoàn tồn kho',
  'Độc giả xem trạng thái đã trả',
  'Giao diện và phiên đăng nhập trên mobile',
  'Lỗi JavaScript và phản hồi HTTP 5xx',
];

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const mongoSnapshot = (id = null) => {
  // A fixed URI and server-side guards prevent accidental writes to a non-QA database.
  const expression = `
    const opts = db.adminCommand({ getCmdLineOpts: 1 }).parsed;
    if (db.getName() !== 'ctulib_explorbot_e2e' || opts.net?.port !== 27029 || opts.net?.bindIp !== '127.0.0.1' || !db.hello().isWritablePrimary) {
      throw new Error('Isolated QA MongoDB required');
    }
    const book = db.books.findOne({ _id: ObjectId('${bookId}') }, { availableCopies: 1 });
    const account = db.acounts.findOne({ ctuIdentifier: '${reader.identifier}', role: 'READER' }, { _id: 1 });
    const loanCollection = db.getCollectionNames().find(name => name === 'load_records');
    const loan = ${id ? `loanCollection && db.getCollection(loanCollection).findOne({ _id: ObjectId('${id}') })` : 'null'};
    print(JSON.stringify({ db: db.getName(), bookStock: book?.availableCopies, readerId: account ? String(account._id) : null, loan: loan ? { _id: String(loan._id), status: loan.status, bookId: String(loan.bookId), readerId: String(loan.readerId) } : null }));
  `;
  const output = execFileSync('mongosh', [mongoUri, '--quiet', '--eval', expression], { encoding: 'utf8', timeout: 15000 });
  return JSON.parse(output.trim().split('\n').at(-1));
};

const step = async (name, action) => {
  stage = name;
  try {
    const details = await action();
    checks.push({ name, status: 'PASS', details: details || '' });
    process.stdout.write(`PASS ${name}${details ? ` — ${details}` : ''}\n`);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    checks.push({ name, status: 'FAIL', details });
    process.stderr.write(`FAIL ${name} — ${details}\n`);
    throw error;
  }
};

const track = (page, label) => {
  page.on('pageerror', error => issues.javascript.push(`${label}: ${error.message.slice(0, 250)}`));
  page.on('response', response => {
    if (response.status() >= 500) {
      issues.http5xx.push(`${label}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      issues.requests.push(`${label}: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`);
    }
  });
};

const login = async (page, account) => {
  await page.goto(`${webUrl}/#/auth`);
  await page.locator('input[name="ctuIdentifier"]').fill(account.identifier);
  await page.locator('input[type="password"]').fill(account.password);
  const loginResponse = page.waitForResponse(response => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập vào hệ thống' }).click();
  const response = await loginResponse;
  expect(response.status() === 200, `Đăng nhập trả HTTP ${response.status()}`);
  await page.waitForURL(url => !url.hash.startsWith('#/auth'));
};

const assertStock = (expected, expectedStatus) => {
  const snapshot = mongoSnapshot(loanId);
  expect(snapshot.bookStock === expected, `Tồn kho ${snapshot.bookStock}, mong đợi ${expected}`);
  expect(snapshot.loan?._id === loanId, 'Không tìm thấy phiếu trong MongoDB QA');
  expect(snapshot.loan?.status === expectedStatus, `Trạng thái DB ${snapshot.loan?.status}, mong đợi ${expectedStatus}`);
  expect(snapshot.loan?.bookId === bookId, 'Phiếu không thuộc cuốn sách đã kiểm thử');
  expect(snapshot.loan?.readerId === snapshot.readerId, 'Phiếu không thuộc độc giả QA');
  return `Phiếu ${loanId}, trạng thái ${expectedStatus}, tồn ${snapshot.bookStock}`;
};

const loanRow = (page) => page.locator('.loan-table tbody tr').filter({ hasText: loanId.slice(-8).toUpperCase() });

const assertNoOverflow = async (page, width) => {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth <= width, `Tràn ngang ${scrollWidth}px ở viewport ${width}px`);
};

const report = async () => {
  for (const name of steps) {
    if (!checks.some(check => check.name === name)) checks.push({ name, status: 'BLOCKED', details: `Chưa chạy sau bước ${stage}` });
  }
  const data = {
    createdAt: new Date().toISOString(), environment: { webUrl, apiUrl, database: 'ctulib_explorbot_e2e' },
    bookId, loanId, initialStock, checks, issues,
    summary: Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(status => [status, checks.filter(check => check.status === status).length])),
  };
  const markdown = [
    '# Báo cáo kiểm thử E2E vòng đời mượn sách CTULib', '',
    `Thời điểm: ${data.createdAt}`, `Database: ${data.environment.database}`,
    `Sách: ${bookTitle} (${bookId})`, `Phiếu kiểm thử: ${loanId || 'chưa tạo'}`,
    `Tồn ban đầu: ${initialStock ?? 'chưa xác định'}`,
    `PASS ${data.summary.PASS} | FAIL ${data.summary.FAIL} | BLOCKED ${data.summary.BLOCKED}`, '',
    ...checks.map(check => `- **${check.status}** ${check.name}. ${check.details}`), '',
    `Lỗi JavaScript: ${issues.javascript.length}; HTTP 5xx: ${issues.http5xx.length}; request thất bại: ${issues.requests.length}.`,
    ...[...issues.javascript, ...issues.http5xx, ...issues.requests].map(item => `- ${item}`), '',
    'Luồng Playwright có kịch bản cố định. Explorbot AI exploratory testing được đánh giá độc lập.',
  ].join('\n');
  await mkdir(reportDir, { recursive: true });
  await Promise.all([
    writeFile(join(reportDir, 'ctulib-loan-lifecycle-latest.json'), JSON.stringify(data, null, 2)),
    writeFile(join(reportDir, 'ctulib-loan-lifecycle-latest.md'), markdown),
  ]);
  process.stdout.write(`\n${markdown}\n`);
  if (data.summary.FAIL || data.summary.BLOCKED) process.exitCode = 1;
};

async function main() {
  try {
    await step(steps[0], async () => {
      expect(/^B9\d{6}$/.test(reader.identifier || '') && /^CB9\d{4}$/.test(employee.identifier || ''), 'Chỉ cho phép định danh tài khoản QA mẫu');
      expect(reader.password && employee.password, 'Thiếu biến môi trường chứa mật khẩu tài khoản QA');
      const snapshot = mongoSnapshot();
      expect(snapshot.readerId && Number.isInteger(snapshot.bookStock), 'Thiếu fixture độc giả hoặc sách QA');
      const response = await fetch(`${apiUrl}/book?limit=12`);
      expect(response.ok, `API sách trả HTTP ${response.status}`);
      const body = await response.json();
      const target = body.data?.items?.find(book => book.bookId === bookId);
      expect(body.data?.items?.length === 12 && target?.availableCopies === snapshot.bookStock,
        'Danh mục API không khớp dữ liệu MongoDB QA');
      initialStock = snapshot.bookStock;
      expect(initialStock > 0, 'Sách QA đã hết bản khả dụng');
      return `DB độc lập và API đồng nhất, số bản ban đầu ${initialStock}`;
    });

    browser = await chromium.launch({ headless: true });
    const readerContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const readerPage = await readerContext.newPage();
    track(readerPage, 'reader-desktop');

    await step(steps[1], async () => {
      await login(readerPage, reader);
      await readerPage.getByRole('heading', { name: 'Phiếu mượn của tôi' }).waitFor();
      return 'Phiên độc giả hoạt động, điều hướng tới phiếu của tôi';
    });

    await step(steps[2], async () => {
      await readerPage.goto(`${webUrl}/#/catalog`);
      await readerPage.getByRole('searchbox', { name: 'Tìm tên sách hoặc tác giả' }).fill(bookTitle);
      const card = readerPage.locator(`[data-book-id="${bookId}"]`).first();
      await card.waitFor({ state: 'visible' });
      await card.getByRole('button', { name: `Xem chi tiết sách ${bookTitle}` }).click();
      await readerPage.getByRole('dialog', { name: 'Chi tiết sách' }).waitFor();
      await assertNoOverflow(readerPage, 1366);
      return `Tìm và mở ${bookId}`;
    });

    await step(steps[3], async () => {
      await readerPage.getByRole('dialog', { name: 'Chi tiết sách' }).getByRole('button', { name: 'Đặt mượn' }).click();
      const dialog = readerPage.getByRole('dialog', { name: 'Xác nhận đặt mượn' });
      await dialog.waitFor();
      const responsePromise = readerPage.waitForResponse(response =>
        response.url().includes('/api/v1/loans') && response.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Xác nhận đặt mượn' }).click();
      const response = await responsePromise;
      const body = await response.json();
      expect(response.status() === 201 || response.status() === 200,
        `Đặt mượn trả HTTP ${response.status()}: ${body.message || 'lỗi không xác định'}`);
      loanId = body.data?.loanId;
      expect(/^[0-9a-f]{24}$/i.test(loanId || ''), 'API không trả ID phiếu hợp lệ');
      await readerPage.getByRole('heading', { name: 'Đặt mượn thành công' }).waitFor();
      return `Đặt mượn qua UI thành công, ID ${loanId}`;
    });

    await step(steps[4], async () => {
      await readerPage.getByRole('button', { name: 'Xem phiếu của tôi' }).click();
      await readerPage.getByRole('heading', { name: 'Phiếu mượn của tôi' }).waitFor();
      await loanRow(readerPage).getByText('Đặt lịch mượn').waitFor();
      return assertStock(initialStock - 1, 'Đặt lịch mượn');
    });

    const employeeContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const employeePage = await employeeContext.newPage();
    track(employeePage, 'employee-desktop');
    await step(steps[5], async () => {
      await login(employeePage, employee);
      await employeePage.goto(`${webUrl}/#/loans`);
      await employeePage.getByRole('heading', { name: 'Quản lý mượn – trả' }).waitFor();
      await loanRow(employeePage).getByRole('button', { name: 'Xử lý' }).click();
      await employeePage.getByRole('region', { name: 'Xử lý phiếu đã chọn' }).waitFor();
      return `Nhân viên mở đúng phiếu ${loanId}`;
    });

    await step(steps[6], async () => {
      const selected = employeePage.getByRole('region', { name: 'Xử lý phiếu đã chọn' });
      await selected.getByRole('button', { name: 'Xác nhận bàn giao' }).click();
      await selected.getByRole('checkbox', { name: 'Tôi đã kiểm tra và xác nhận thao tác này.' }).check();
      const responsePromise = employeePage.waitForResponse(response => response.url().endsWith(`/loans/${loanId}/handover`) && response.request().method() === 'PATCH');
      await selected.getByRole('button', { name: 'Xác nhận thực hiện' }).click();
      const response = await responsePromise;
      expect(response.ok(), `Bàn giao trả HTTP ${response.status()}`);
      await employeePage.getByRole('status').filter({ hasText: 'Đã xác nhận bàn giao sách' }).waitFor();
      return assertStock(initialStock - 1, 'Đang mượn');
    });

    await step(steps[7], async () => {
      const selected = employeePage.getByRole('region', { name: 'Xử lý phiếu đã chọn' });
      await selected.getByRole('button', { name: 'Tiếp nhận trả' }).click();
      await selected.getByRole('spinbutton', { name: 'Tỷ lệ hư hại (%)' }).fill('0');
      await selected.getByRole('checkbox', { name: 'Tôi đã kiểm tra và xác nhận thao tác này.' }).check();
      const responsePromise = employeePage.waitForResponse(response => response.url().endsWith(`/loans/${loanId}/return`) && response.request().method() === 'PATCH');
      await selected.getByRole('button', { name: 'Xác nhận thực hiện' }).click();
      const response = await responsePromise;
      expect(response.ok(), `Nhận trả HTTP ${response.status()}`);
      await employeePage.getByRole('status').filter({ hasText: 'Đã tiếp nhận trả sách' }).waitFor();
      return assertStock(initialStock, 'Đã trả');
    });

    await step(steps[8], async () => {
      // Trang đã mở trước khi thủ thư xử lý nên phải tải lại lịch sử trong SPA.
      const historyResponse = readerPage.waitForResponse(response =>
        response.url().includes('/api/v1/loans/me') && response.request().method() === 'GET');
      await readerPage.getByRole('button', { name: 'Làm mới', exact: true }).click();
      const response = await historyResponse;
      expect(response.ok(), `Tải lại lịch sử trả HTTP ${response.status()}`);
      const body = await response.json();
      expect(body.data?.records?.some(record => record._id === loanId && record.status === 'Đã trả'),
        'API lịch sử chưa trả về phiếu ở trạng thái Đã trả');
      await loanRow(readerPage).getByText('Đã trả').waitFor();
      await assertNoOverflow(readerPage, 1366);
      return `Độc giả thấy phiếu ${loanId} đã trả`;
    });

    await step(steps[9], async () => {
      const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const mobilePage = await mobileContext.newPage();
      track(mobilePage, 'reader-mobile');
      try {
        await login(mobilePage, reader);
        await mobilePage.getByRole('heading', { name: 'Phiếu mượn của tôi' }).waitFor();
        await loanRow(mobilePage).getByText('Đã trả').waitFor();
        await assertNoOverflow(mobilePage, 390);
        await mobilePage.goto(`${webUrl}/#/catalog`);
        await mobilePage.getByRole('heading', { name: 'Tra cứu Học liệu & Giáo trình' }).waitFor();
        await assertNoOverflow(mobilePage, 390);
      } finally { await mobileContext.close(); }
      return 'Độc giả xem phiếu đã trả và danh mục trên viewport 390px';
    });

    await step(steps[10], async () => {
      expect(!issues.javascript.length, issues.javascript.join(' | '));
      expect(!issues.http5xx.length, issues.http5xx.join(' | '));
      return 'Không ghi nhận JavaScript pageerror hoặc HTTP 5xx';
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (!checks.some(check => check.status === 'FAIL')) {
      checks.push({ name: steps.find(name => !checks.some(check => check.name === name)) || stage, status: 'FAIL', details });
    }
    process.stderr.write(`Dừng E2E tại ${stage}: ${details}\n`);
  } finally {
    if (browser) await browser.close();
    await report();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
