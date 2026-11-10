import fs from 'node:fs'
import path from 'node:path'

const endpointId = Number(process.argv[2])
const outputDir = process.argv[3]
if (!Number.isSafeInteger(endpointId) || endpointId < 1 || !outputDir) {
  throw new Error('Cách dùng: node generate-apidog-cases.mjs <endpointId> <outputDir>')
}
fs.mkdirSync(outputDir, { recursive: true })

const checkStatus = (code) => `const body = pm.response.json();
pm.test('HTTP ${code}', () => pm.expect(pm.response.code).to.equal(${code}));
pm.test('Response contract', () => {
  pm.expect(body.status).to.equal('${code === 200 ? 'success' : 'error'}');
  ${code === 200 ? 'pm.expect(body.data).to.be.an("object");' : 'pm.expect(body.message).to.be.a("string"); pm.expect(body.data).to.equal(null);'}
});`

const statsScript = `${checkStatus(200)}
const valueAt = (name) => name.split('.').reduce((value, part) => value && value[part], body.data);
const metrics = [
  ['books.totalTitles','expectedTotalTitles'],
  ['books.totalCopies','expectedTotalCopies'],
  ['books.availableCopies','expectedAvailableCopies'],
  ['books.outOfStockCount','expectedOutOfStockCount'],
  ['readers.totalReaders','expectedReaders'],
  ['loans.borrowingCount','expectedBorrowing'],
  ['loans.overdueCount','expectedOverdue'],
  ['loans.pendingPenaltyCount','expectedPendingPenalty'],
  ['penalties.unpaidPenalty','expectedUnpaidPenalty'],
  ['penalties.collectedPenalty','expectedCollectedPenalty']
];
for (const [metric, variable] of metrics) {
  pm.test(metric, () => {
    const expected = Number(pm.iterationData.get(variable));
    pm.expect(Number.isFinite(expected), 'Missing test dataset: ' + variable).to.equal(true);
    pm.expect(valueAt(metric)).to.equal(expected);
  });
}
pm.test('Doanh thu đã thu không tính các khoản chưa thanh toán', () => pm.expect(body.data.penalties.totalRevenue).to.equal(Number(pm.iterationData.get('expectedCollectedPenalty'))));
pm.test('Danh sách hết sách không lẫn đầu sách ngừng lưu hành', () => {
  const books = body.data.books.outOfStockList;
  pm.expect(books).to.be.an('array').with.lengthOf(1);
  pm.expect(books[0].title).to.equal('QA Dashboard - hết sách');
  pm.expect(books[0].availableCopies).to.equal(0);
});`

const makeCase = ({ name, categoryId, header, expected, script }) => ({
  name,
  categoryId,
  apiDetailId: endpointId,
  method: 'get',
  path: '/api/v1/dashboard/stats',
  parameters: {
    path: [], query: [], cookie: [],
    header: header ? [{ id: 'dashboard-auth', name: 'Authorization', value: header, type: 'string', enable: true }] : []
  },
  commonParameters: {},
  requestBody: { type: 'none' },
  auth: { type: 'noauth' },
  postProcessors: [{ type: 'customScript', data: script ?? checkStatus(expected), defaultEnable: true, enable: true }]
})

const cases = [
  { file: '01-staff-stats.json', name: 'DASH-001: Nhân viên được cấp MANAGE_LOANS xem thống kê đúng fixture', categoryId: 1967040, header: 'Bearer {{dashboardStaffToken}}', expected: 200, script: statsScript },
  { file: '02-no-token.json', name: 'DASH-002: Không có access token bị từ chối', categoryId: 1967043, expected: 401 },
  { file: '03-bad-token.json', name: 'DASH-003: Token không hợp lệ bị từ chối', categoryId: 1967043, header: 'Bearer invalid.invalid.invalid', expected: 401 },
  { file: '04-reader.json', name: 'DASH-004: Độc giả không được xem thống kê', categoryId: 1967043, header: 'Bearer {{dashboardReaderToken}}', expected: 403 },
  { file: '05-staff-without-permission.json', name: 'DASH-005: Nhân viên không có MANAGE_LOANS bị từ chối', categoryId: 1967043, header: 'Bearer {{dashboardNoPermissionToken}}', expected: 403 }
]
for (const item of cases) {
  fs.writeFileSync(path.join(outputDir, item.file), JSON.stringify(makeCase(item), null, 2) + '\n')
}
