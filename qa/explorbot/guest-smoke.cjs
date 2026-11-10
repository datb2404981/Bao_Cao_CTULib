const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const baseUrl = (process.env.EXPLORBOT_URL || 'http://127.0.0.1:5174').replace(/\/$/, '');
const reportDir = join(__dirname, 'output', 'reports');
const checks = [];
const apiErrors = new Set();
const pageErrors = [];

function record(name, passed, details) {
  checks.push({ name, status: passed ? 'PASS' : 'FAIL', details });
}

async function visit(page, route) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(450);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const width of [1366, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      page.on('pageerror', (error) => pageErrors.push(`${width}px: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 500) {
          const url = new URL(response.url());
          apiErrors.add(`${response.status()} ${url.pathname}`);
        }
      });

      await visit(page, 'catalog');
      record(`Danh mục sách mở được (${width}px)`,
        await page.getByRole('heading', { name: 'Tra cứu Học liệu & Giáo trình' }).isVisible()
          && await page.locator('input[type="search"]').count() === 1,
        'Trang danh mục có tiêu đề và ô tìm kiếm.');

      await visit(page, 'auth');
      record(`Biểu mẫu đăng nhập hiển thị (${width}px)`,
        await page.locator('input[name="ctuIdentifier"]').count() === 1
          && await page.locator('input[type="password"]').count() === 1,
        'Có mã định danh và mật khẩu.');

      await page.locator('button[type="submit"]').click();
      record(`Kiểm tra trường bắt buộc (${width}px)`,
        await page.getByText('Vui lòng nhập mã định danh.').isVisible()
          && await page.getByText('Vui lòng nhập mật khẩu.').isVisible(),
        'Gửi biểu mẫu trống phải hiển thị lỗi ở cả hai trường.');

      for (const route of ['dashboard', 'my-loans']) {
        await visit(page, route);
        const denied = await page.getByText('Không có quyền truy cập').isVisible().catch(() => false);
        const redirected = page.url().includes('/#/auth');
        record(`Khách không truy cập ${route} (${width}px)`, denied || redirected,
          `Trạng thái chặn=${denied}, chuyển hướng=${redirected}.`);
      }

      for (const route of ['catalog', 'auth', 'dashboard', 'my-loans']) {
        await visit(page, route);
        const actualWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        record(`Không tràn ngang ${route} (${width}px)`, actualWidth <= width,
          `Chiều rộng nội dung ${actualWidth}px trên viewport ${width}px.`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  record('Không có lỗi JavaScript chưa xử lý', pageErrors.length === 0,
    pageErrors.length ? pageErrors.join(' | ') : 'Không ghi nhận pageerror.');

  const failures = checks.filter((check) => check.status === 'FAIL');
  const status = apiErrors.size ? 'BLOCKED' : 'PASS';
  checks.push({ name: 'Phản hồi API khi tải trang', status,
    details: apiErrors.size
      ? `Phản hồi lỗi máy chủ cần xác minh với backend QA: ${[...apiErrors].join(', ')}`
      : 'Không ghi nhận HTTP 5xx.' });

  await mkdir(reportDir, { recursive: true });
  const report = {
    createdAt: new Date().toISOString(), baseUrl, checks,
    passed: checks.filter((check) => check.status === 'PASS').length,
    failed: failures.length,
    blocked: checks.filter((check) => check.status === 'BLOCKED').length,
  };
  const markdown = [
    '# Báo cáo kiểm thử khói CTULib (khách)', '',
    `Ngày chạy: ${report.createdAt}`, `Môi trường: ${baseUrl}`, '',
    `PASS ${report.passed} | FAIL ${report.failed} | BLOCKED ${report.blocked}`, '',
    ...checks.map((check) => `- **${check.status}** ${check.name}. ${check.details}`),
    '', 'Phạm vi: luồng khách, giao diện desktop/mobile. Các luồng cần tài khoản và ghi dữ liệu phải chạy trên database QA riêng.',
  ].join('\n');
  await writeFile(join(reportDir, 'ctulib-guest-smoke-latest.json'), JSON.stringify(report, null, 2));
  await writeFile(join(reportDir, 'ctulib-guest-smoke-latest.md'), markdown);
  process.stdout.write(`${markdown}\n`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
