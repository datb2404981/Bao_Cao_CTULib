/**
 * Chạy từng test case gốc của Apidog suite 7413 trên Express và MongoDB QA tạm.
 *
 * Input lấy từ `apidog test-case get` (không chứa dữ liệu sản xuất). Script giữ
 * nguyên test assertions; chỉ thay URL, credential QA và seed tiền điều kiện.
 * Mỗi lần chạy dùng DB loopback trống, xóa DB sau khi hoàn tất.
 *
 * APIDOG_CASES_DIR=/tmp/ctulib-apidog-7413-cases \
 * CTULIB_TEST_MONGODB_URI='mongodb://127.0.0.1:27055/ctulib_qa_loan_apidog_...?...' \
 * pnpm --filter @ctulib/backend exec tsx scripts/loan-apidog-suite-qa.ts [CASE-ID...]
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { AccountModel } from "../src/models/user.model.js";
import bookModel from "../src/models/book.model.js";
import employeeModel from "../src/models/employee.model.js";
import loanRecordModel, { LOAN_STATUSES, type LoanStatus } from "../src/models/loanRecord.model.js";
import penaltyRecordModel from "../src/models/penaltyRecord.model.js";
import permissionModel from "../src/models/permission.model.js";
import readerModel from "../src/models/reader.model.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const casesDir = process.env.APIDOG_CASES_DIR;
const uri = process.env.CTULIB_TEST_MONGODB_URI;
if (!uri || !casesDir) throw new Error("Cần CTULIB_TEST_MONGODB_URI và APIDOG_CASES_DIR");
const dbUrl = new URL(uri);
if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname)
  || !/^\/ctulib_qa_loan_apidog_[a-zA-Z0-9_]+$/.test(dbUrl.pathname)
  || !dbUrl.searchParams.has("replicaSet")) {
  throw new Error("Chỉ nhận Mongo replica set loopback, DB ctulib_qa_loan_apidog_*");
}

const sourceReport = path.join(repoRoot,
  "apidog-reports/loan-penalty-attempt/apidog-report-2026-11-10-00-51-49-127-0.json");
const secret = randomBytes(32).toString("hex");
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET_KEY = secret;

type Parameter = { name: string; value?: string; enable?: boolean; type?: string };
type RawCase = {
  id: number; projectId: number; testSuiteId: number; name: string; path: string;
  parameters?: { path?: Parameter[]; query?: Parameter[] };
  requestBody?: { type: string; data?: string };
  preProcessors: { data: string }[]; postProcessors: { data: string }[];
};
type CaseMeta = { id: string; actor: string; mode: string; blocked: boolean; clock: string };
type Basis = { tien_dieu_kien?: string; http_mong_doi?: string };
type ExportItem = {
  name: string; metaInfo?: Record<string, unknown>;
  responseDefinition?: Record<string, unknown>;
  request: {
    method: string; baseUrl: string; url: {
      host: string[]; protocol: string; port: string; path: string[];
      variable: { key: string; value: string; disabled: boolean; type: string }[];
      query: { key: string; value: string; disabled: boolean }[];
    };
    body: Record<string, unknown>; header: { key: string; value: string }[];
  };
  event: { listen: string; script: { exec: string[] } }[];
};
type ExportCollection = { item: { item: ExportItem[]; name?: string }[]; [key: string]: unknown };
type CaseData = { definition: RawCase; qa: CaseMeta; basis: Basis };
type Ids = Record<string, Types.ObjectId>;

const parseNamedJson = <T>(text: string, name: string): T => {
  // Phần mô tả "Test basis" chứa dấu ; trong JSON string, nên lấy cả dòng.
  const match = name === "Test basis"
    ? text.match(/^\/\/ Test basis: (\{[^\n]+\})$/m)
    : text.match(new RegExp(`const ${name} = (\\{[^\\n]+?\\});`));
  if (!match) throw new Error(`Thiếu ${name}`);
  return JSON.parse(match[1]) as T;
};
const actorIds: Record<string, string> = {
  R1: "B9900001", R2: "B9900002", R_LIMIT2: "B9900103", R_LIMIT3: "B9900104",
  R_OVERDUE: "B9900105", R_FINE: "B9900106", R_MANUAL: "B9900107",
  E_BOOK: "CB99101", E_HANDOVER: "CB99102", E_RETURN: "CB99103",
  E_COLLECT: "CB99104", E_VIEW: "CB99105", ADMIN_NONE: "ADMIN99101",
};
const isReader = (name: string) => name.startsWith("R");
const now = () => new Date();
const day = 86400000;
const shift = (days: number) => new Date(Date.now() + days * day);
const validId = (value?: string): value is string => !!value && /^[a-f0-9]{24}$/i.test(value);
const objectId = (value?: string) => validId(value) ? new Types.ObjectId(value) : new Types.ObjectId();
const idParam = (testCase: RawCase, name: string) =>
  testCase.parameters?.path?.find(param => param.name === name)?.value;

const seedActors = async () => {
  const ids: Ids = Object.fromEntries(Object.keys(actorIds).map(name => [name, new Types.ObjectId()]));
  const password = randomBytes(24).toString("hex");
  const hashed = await bcrypt.hash(password, 4);
  await AccountModel.insertMany(Object.entries(actorIds).map(([actor, ctuIdentifier]) => ({
    _id: ids[actor], ctuIdentifier,
    email: `${ids[actor]}@qa.invalid`, password: hashed,
    role: isReader(actor) ? "READER" : actor === "ADMIN_NONE" ? "ADMIN" : "EMPLOYEE",
  })));
  await readerModel.insertMany(Object.entries(ids).filter(([actor]) => isReader(actor))
    .map(([, _id]) => ({ _id, facultyId: new Types.ObjectId() })));
  const permissions = await permissionModel.insertMany([
    { permissionName: "MANAGE_LOANS", description: "QA quyền quản lý phiếu" },
    { permissionName: "APPROVE_HANDOVER", description: "QA quyền duyệt bàn giao" },
    { permissionName: "PROCESS_RETURN", description: "QA quyền nhận trả" },
    { permissionName: "COLLECT_PENALTY", description: "QA quyền thu phạt" },
  ]);
  const permission = Object.fromEntries(permissions.map(p => [p.permissionName, p._id]));
  await employeeModel.insertMany(Object.entries(ids).filter(([actor]) => !isReader(actor))
    .map(([actor, _id]) => ({
      _id,
      permissionIds: actor === "E_HANDOVER" ? [permission.APPROVE_HANDOVER]
        : actor === "E_RETURN" ? [permission.PROCESS_RETURN]
        : actor === "E_COLLECT" ? [permission.COLLECT_PENALTY] : [],
    })));
  return { ids, password };
};

const seedBook = async (desiredId?: string, options: { available?: number; circulation?: boolean } = {}) => {
  const _id = objectId(desiredId);
  await bookModel.create({
    _id, title: "Sách QA Apidog", bookType: "TEXTBOOK", facultyId: new Types.ObjectId(),
    authorIds: [], coverPrice: 100000, totalCopies: 5,
    availableCopies: options.available ?? 3,
    isAvailableForCirculation: options.circulation ?? true,
  });
  return _id;
};

const seedLoan = async (readerId: Types.ObjectId, bookId: Types.ObjectId, options: {
  id?: string; status?: LoanStatus; expired?: boolean; overdue?: boolean;
  actualReturn?: boolean; condition?: string;
} = {}) => {
  const status = options.status ?? "Đang mượn";
  const hasHandover = !["Đặt lịch mượn", "Đã huỷ"].includes(status);
  const hasReturn = options.actualReturn ?? ["Chờ nộp phạt", "Đã trả"].includes(status);
  const loan = await loanRecordModel.create({
    _id: objectId(options.id), readerId, bookId, status,
    reservationDate: shift(-3), reservationExpiryDate: options.expired ? shift(-1) : shift(2),
    ...(hasHandover ? { handoverDate: shift(-2), dueDate: options.overdue ? shift(-0.8) : shift(3) } : {}),
    ...(hasReturn ? { actualReturnDate: shift(-0.2), returnCondition: options.condition ?? "GOOD" } : {}),
  });
  return loan;
};

const seedPenalty = async (loanRecordId: Types.ObjectId, options: {
  id?: string; paid?: boolean; total?: number; condition?: string;
  mixedOverdueDamage?: boolean;
} = {}) => {
  const total = options.total ?? 25000;
  // COLLECT-002: phạt trễ một ngày 5.000đ + hư hại 20% của 100.000đ.
  // Đặt dueDate dựa trên actualReturnDate để tránh sai số làm tròn ngày.
  const actualReturnDate = options.mixedOverdueDamage ? shift(-0.2) : undefined;
  if (options.mixedOverdueDamage) {
    if (total !== 25000) throw new Error("Fixture COLLECT-002 phải có tổng phạt 25.000đ");
    await loanRecordModel.updateOne({ _id: loanRecordId }, {
      $set: { actualReturnDate, dueDate: new Date(actualReturnDate!.getTime() - day),
        returnCondition: "DAMAGED" },
    });
  }
  return penaltyRecordModel.create({
    _id: objectId(options.id), loanRecordId, issuedDate: actualReturnDate ?? shift(-0.5),
    overdueDays: options.mixedOverdueDamage || total === 5000 ? 1 : 0,
    appliedCoverPrice: 100000,
    damagePercentage: options.condition === "LOST" ? 100
      : options.mixedOverdueDamage ? 20 : total === 25000 ? 25 : 0,
    overdueFee: options.mixedOverdueDamage || total === 5000 ? 5000 : 0,
    damageFee: options.mixedOverdueDamage ? 20000 : total === 5000 ? 0 : total,
    totalPenalty: total, paymentStatus: options.paid ? "Đã thanh toán" : "Chờ thanh toán",
    ...(options.paid ? { paymentDate: shift(-0.1), amountCollected: total, paymentMethod: "CASH" } : {}),
  });
};

const seedCase = async ({ definition: c, qa, basis }: CaseData, ids: Ids) => {
  const prefix = qa.id.split("-").slice(0, -1).join("-");
  const number = Number(qa.id.split("-").at(-1));
  const reader = ids[qa.actor] && isReader(qa.actor) ? ids[qa.actor] : ids.R1;
  if (prefix === "AUTH") return;
  if (prefix === "LOAN-LIST") {
    const books = await Promise.all(Array.from({ length: LOAN_STATUSES.length + 1 }, () => seedBook()));
    for (let i = 0; i < LOAN_STATUSES.length; i++) {
      const status = LOAN_STATUSES[i];
      const loan = await seedLoan(ids.R1, books[i], { status, overdue: status === "Quá hạn" });
      if (status === "Chờ nộp phạt") await seedPenalty(loan._id);
    }
    await seedLoan(ids.R2, books[books.length - 1]);
    return;
  }
  if (prefix === "RESERVE") {
    let body: { bookId?: string } = {};
    try { body = JSON.parse(c.requestBody?.data ?? "{}") as { bookId?: string }; } catch { /* body intentionally invalid */ }
    const available = number === 13 ? 0 : number === 18 ? 1 : number === 1 ? 4 : 3;
    // RESERVE-016 dùng ObjectId hợp lệ nhưng không có sách trong DB (404).
    // Seed sách ở đây sẽ vô tình biến case thành đặt sách thành công.
    const book = number === 16 ? objectId(body.bookId) : await seedBook(
      validId(body.bookId) ? body.bookId : undefined,
      { available, circulation: number !== 14 },
    );
    if (number === 4) {
      // Phiếu vẫn là Đang mượn dù dueDate đã quá hạn, chưa được scheduler cập nhật.
      await seedLoan(reader, await seedBook(), { status: "Đang mượn", overdue: true });
    }
    if (number === 5) {
      const pending = await seedLoan(reader, await seedBook(), { status: "Chờ nộp phạt" });
      await seedPenalty(pending._id);
    }
    if (number === 6) {
      // Cố ý để cờ khóa tổng hợp chưa đồng bộ, phải kiểm tra khóa thủ công riêng.
      await readerModel.updateOne({ _id: reader }, {
        $set: { isBorrowingManuallyBlocked: true, isBorrowingBlocked: false },
      });
    }
    if (number === 2 || number === 3) {
      for (let i = 0; i < (number === 2 ? 2 : 3); i++) {
        await seedLoan(reader, await seedBook(), { status: i % 2 ? "Đang mượn" : "Đặt lịch mượn" });
      }
    }
    const duplicateStatus: Partial<Record<number, LoanStatus[]>> = {
      8: ["Đặt lịch mượn"], 9: ["Đang mượn"], 10: ["Quá hạn"],
      11: ["Chờ nộp phạt"], 12: ["Đã trả", "Đã huỷ"],
    };
    for (const status of duplicateStatus[number] ?? []) {
      const loan = await seedLoan(reader, book, { status, overdue: status === "Quá hạn" });
      if (status === "Chờ nộp phạt") await seedPenalty(loan._id);
    }
    return;
  }
  if (prefix === "LOAN-DETAIL" || prefix === "CANCEL" || prefix === "HANDOVER" || prefix === "RETURN") {
    const id = idParam(c, "loanId");
    const missing = prefix === "LOAN-DETAIL" ? number === 3
      : prefix === "CANCEL" ? number === 8
      : prefix === "HANDOVER" ? number === 7 : number === 25;
    if (missing || !validId(id)) return;
    const book = await seedBook();
    let status: LoanStatus = "Đang mượn";
    if (prefix === "LOAN-DETAIL") status = number === 4 ? "Chờ nộp phạt" : "Đang mượn";
    if (prefix === "CANCEL") status = ({
      1: "Đặt lịch mượn", 2: "Đặt lịch mượn", 3: "Đang mượn", 4: "Quá hạn",
      5: "Chờ nộp phạt", 6: "Đã trả", 7: "Đã huỷ",
    } satisfies Partial<Record<number, LoanStatus>>)[number] ?? "Đặt lịch mượn";
    if (prefix === "HANDOVER") status = number === 6 ? "Đang mượn" : "Đặt lịch mượn";
    if (prefix === "RETURN") status = [2, 3, 24, 29, 31].includes(number) ? "Quá hạn"
      : number === 26 ? "Đặt lịch mượn" : number === 27 ? "Chờ nộp phạt"
      : number === 28 ? "Đã trả" : "Đang mượn";
    const owner = (prefix === "CANCEL" && number === 2) || (prefix === "LOAN-DETAIL" && number === 2)
      ? ids.R2 : reader;
    const loan = await seedLoan(owner, book, {
      id, status, expired: prefix === "HANDOVER" && number === 5,
      overdue: status === "Quá hạn", condition: "GOOD",
    });
    if (status === "Chờ nộp phạt") await seedPenalty(loan._id);
    // Thiếu giá chốt là một case 400 thực sự, không chỉnh assertion.
    if (prefix === "RETURN" && number === 30) {
      await bookModel.collection.updateOne({ _id: book }, { $unset: { coverPrice: "" } });
    }
    return;
  }
  if (prefix === "PENALTY-LIST") {
    const query = Object.fromEntries((c.parameters?.query ?? []).map(p => [p.name, p.value]));
    const fixedLoan = validId(query.loanId) ? query.loanId : undefined;
    for (let i = 0; i < 4; i++) {
      const book = await seedBook();
      const owner = i === 3 ? ids.R2 : ids.R1;
      const loan = await seedLoan(owner, book, { id: i === 0 ? fixedLoan : undefined, status: "Chờ nộp phạt" });
      await seedPenalty(loan._id, { paid: i % 2 !== 0 });
    }
    return;
  }
  if (prefix === "PENALTY-DETAIL" || prefix === "COLLECT") {
    const penaltyId = idParam(c, "penaltyId");
    const missing = prefix === "PENALTY-DETAIL" ? number === 3 : number === 25;
    if (missing || !validId(penaltyId)) return;
    const book = await seedBook();
    const owner = prefix === "COLLECT" && number === 6 ? ids.R_MANUAL : ids.R1;
    const loan = await seedLoan(owner, book, {
      status: prefix === "COLLECT" && number === 17 ? "Đã trả" : "Chờ nộp phạt",
      condition: prefix === "COLLECT" && number === 3 ? "LOST" : "GOOD",
    });
    let body: { expectedTotalPenalty?: number } = {};
    try { body = JSON.parse(c.requestBody?.data ?? "{}") as typeof body; } catch { /* invalid JSON */ }
    const total = prefix === "COLLECT" && number === 1 ? 5000
      : prefix === "COLLECT" && [3, 4].includes(number) ? 100000
      : 25000;
    await seedPenalty(loan._id, {
      id: penaltyId, total,
      paid: prefix === "PENALTY-DETAIL" ? number === 2 : number === 16,
      condition: prefix === "COLLECT" && number === 3 ? "LOST" : "GOOD",
      mixedOverdueDamage: prefix === "COLLECT" && number === 2,
    });
    if (prefix === "COLLECT") {
      await readerModel.updateOne({ _id: owner }, { $set: {
        isBorrowingBlocked: true, isBorrowingManuallyBlocked: number === 6,
      } });
      if (number === 5) await seedLoan(owner, await seedBook(), { status: "Quá hạn", overdue: true });
      // Không điều chỉnh số tiền kỳ vọng trong request; mismatch cần trả 409.
      void body;
    }
    return;
  }
  throw new Error(`Chưa biết seed case ${qa.id}; tiền điều kiện: ${basis.tien_dieu_kien ?? ""}`);
};

const methodFor = (pathValue: string) => {
  if (pathValue === "/loans") return "GET";
  if (pathValue === "/penalties" || /^\/(?:loans|penalties)\/\{\w+\}$/.test(pathValue)) return "GET";
  return "PATCH";
};

const prepareItem = (template: ExportItem, { definition: c, qa }: CaseData, port: number,
  actorPassword: string, ids: Ids, expired: string) => {
  const item = structuredClone(template);
  const method = qa.id.startsWith("RESERVE-") ? "POST" : methodFor(c.path);
  const urlParts = c.path.split("/").filter(Boolean);
  item.name = c.name;
  item.metaInfo = { ...(item.metaInfo ?? {}), httpApiCaseId: c.id,
    httpApiCaseName: c.name, httpApiPath: c.path, httpApiMethod: method.toLowerCase() };
  // Template gốc là AUTH-010 (expected 401). responseDefinition của template
  // sẽ gây false FAIL "It should be 401" cho mọi case khác. Test script gốc
  // đã có kiểm tra HTTP và wrapper riêng nên bỏ định nghĩa response mẫu đó.
  delete item.responseDefinition;
  item.request.method = method;
  item.request.baseUrl = `http://127.0.0.1:${port}/api/v1`;
  item.request.url = {
    host: ["127", "0", "0", "1"], protocol: "http", port: String(port),
    path: ["api", "v1", ...urlParts.map(part => part.startsWith("{")
      ? idParam(c, part.slice(1, -1)) ?? "missing" : part)],
    variable: (c.parameters?.path ?? []).map(p => ({
      key: p.name, value: p.value ?? "", disabled: p.enable === false, type: p.type ?? "string",
    })),
    query: (c.parameters?.query ?? []).map(p => ({
      key: p.name, value: p.value ?? "", disabled: p.enable === false,
    })),
  };
  item.request.body = c.requestBody?.type === "application/json"
    ? { mode: "raw", raw: c.requestBody.data ?? "", options: { raw: { language: "json" } } }
    : {};
  item.request.header = [{ key: "User-Agent", value: "ctulib-apidog-isolated-qa" },
    ...(c.requestBody?.type === "application/json" ? [{ key: "Content-Type", value: "application/json" }] : [])];
  for (const event of item.event) {
    const original = event.listen === "prerequest" ? c.preProcessors[0]?.data
      : event.listen === "test" ? c.postProcessors[0]?.data : undefined;
    if (!original) continue;
    const prefix = "if (JSON.setEnableBigInt) { JSON.setEnableBigInt(undefined); }\n";
    if (event.listen === "test") { event.script.exec = [prefix, original]; continue; }
    const revised = original
      .replaceAll("http://localhost:8080/auth/login", `http://127.0.0.1:${port}/api/v1/auth/login`)
      .replaceAll("http://localhost:8080", `http://127.0.0.1:${port}`)
      .replaceAll(":8080", `:${port}`)
      .replace(/pm\.variables\.set\("qaR1AccountId","[a-f0-9]+"\);/,
        `pm.variables.set("qaR1AccountId","${ids.R1}");`)
      .replace(/pm\.variables\.set\("qaR2AccountId","[a-f0-9]+"\);/,
        `pm.variables.set("qaR2AccountId","${ids.R2}");`)
      .replace(/const QA_LOGIN = \{[^;]+\};/, match => {
        const login = JSON.parse(match.slice("const QA_LOGIN = ".length, -1)) as { ctuIdentifier: string };
        if (!Object.values(actorIds).includes(login.ctuIdentifier)) throw new Error("QA actor chưa được khai báo");
        return `const QA_LOGIN = ${JSON.stringify({ ctuIdentifier: login.ctuIdentifier, password: actorPassword })};`;
      });
    event.script.exec = [prefix, `pm.variables.set("qaExpiredAccessToken", ${JSON.stringify(expired)});`, revised];
  }
  return item;
};

const runCli = async (collectionFile: string, reportDir: string, id: string) => {
  const args = ["run", collectionFile, "-r", "json", "--on-error", "end", "--out-dir", reportDir,
    "--env-var", `qaPreparedCaseId=${id}`, "--env-var", "qaFixtureVersion=ctulib-business-v1"];
  return new Promise<number>((resolve, reject) => {
    const proc = spawn("apidog", args, { cwd: repoRoot, stdio: "ignore" });
    proc.once("error", reject);
    proc.once("close", code => resolve(code ?? 1));
  });
};

const main = async () => {
  let server: Server | undefined;
  let tempDir: string | undefined;
  let ownsDb = false;
  const selected = new Set(process.argv.slice(2));
  const runLabel = process.env.APIDOG_QA_RUN;
  if (runLabel && !/^[a-z0-9_-]{1,50}$/.test(runLabel))
    throw new Error("APIDOG_QA_RUN chỉ cho phép a-z, 0-9, _ và -");
  const results: { id: string; state: "PASS" | "FAIL" | "BLOCKED"; detail?: string }[] = [];
  try {
    const rawCases = await Promise.all((await readdir(casesDir!))
      .filter(name => /^\d+\.json$/.test(name)).map(async name => {
        const result = JSON.parse(await readFile(path.join(casesDir!, name), "utf8")) as RawCase;
        // Apidog trả testSuiteId=0 khi đọc chi tiết từng case; danh sách 157 ID
        // được tải riêng từ suite 7413. Chỉ xác nhận project/module trên payload.
        if (result.projectId !== 1405851 || result.moduleId !== 1504230 || result.type !== "TEST_CASE")
          throw new Error(`Case ${name} không thuộc module loan/penalty dự kiến`);
        const script = result.preProcessors?.[0]?.data ?? "";
        return { definition: result,
          qa: parseNamedJson<CaseMeta>(script, "QA_CASE"),
          basis: parseNamedJson<Basis>(script, "Test basis") };
      }));
    const cases = rawCases.filter(({ qa }) => !selected.size || selected.has(qa.id)
      || [...selected].some(s => qa.id.startsWith(`${s}-`)));
    if (!cases.length) throw new Error("Không tìm thấy case cần chạy");
    const original = JSON.parse(await readFile(sourceReport, "utf8")) as { collection: ExportCollection };
    const collection = original.collection;
    const template = collection.item.flatMap(i => i.item).find(item => !!item.request);
    if (!template) throw new Error("Báo cáo mẫu không có Apidog request");
    await mongoose.connect(uri!, { serverSelectionTimeoutMS: 8000 });
    if ((await mongoose.connection.db!.listCollections().toArray()).length)
      throw new Error("DB QA không rỗng, dừng để tránh xóa dữ liệu của lần chạy khác");
    ownsDb = true;
    const { app } = await import("../src/app.js");
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("QA server không có port");
    tempDir = await mkdtemp(path.join(tmpdir(), "ctulib-apidog-7413-"));

    for (const current of cases) {
      const id = current.qa.id;
      if (current.qa.blocked) {
        results.push({ id, state: "BLOCKED", detail: "Apidog đánh dấu blocked" });
        console.log(`BLOCKED ${id}`);
        continue;
      }
      try {
        await mongoose.connection.dropDatabase();
        const { ids, password } = await seedActors();
        await seedCase(current, ids);
        const expired = jwt.sign({ accountId: ids.R1.toHexString(), ctuIdentifier: "B9900001", role: "READER" },
          secret, { algorithm: "HS256", expiresIn: -60, subject: ids.R1.toHexString(),
            issuer: "ctulib-api", audience: "ctulib-web" });
        const item = prepareItem(template, current, address.port, password, ids, expired);
        const cloned = structuredClone(collection);
        cloned.item = [{ name: "Apidog suite 7413 isolated case", item: [item] }];
        const caseDir = path.join(tempDir, id);
        await mkdir(caseDir, { recursive: true });
        const input = path.join(caseDir, "collection.json");
        await writeFile(input, JSON.stringify(cloned), { mode: 0o600 });
        const status = await runCli(input, caseDir, id);
        const reportName = (await readdir(caseDir)).find(file => file.startsWith("apidog-report") && file.endsWith(".json"));
        if (!reportName) throw new Error(`Apidog CLI exit=${status}, không sinh report`);
        const report = JSON.parse(await readFile(path.join(caseDir, reportName), "utf8")) as {
          run?: { stats?: { steps?: { total: number; passed: number; failed: number } };
            failures?: { error?: { message?: string } }[] };
        };
        const steps = report.run?.stats?.steps;
        const passed = status === 0 && steps?.total === 1 && steps?.passed === 1 && steps?.failed === 0;
        const detail = passed ? undefined : `CLI=${status}, steps=${JSON.stringify(steps)}, ${report.run?.failures?.[0]?.error?.message ?? ""}`;
        results.push({ id, state: passed ? "PASS" : "FAIL", ...(detail ? { detail } : {}) });
        console.log(`${passed ? "PASS" : "FAIL"} ${id}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        results.push({ id, state: "FAIL", detail });
        console.log(`FAIL ${id}: ${detail.slice(0, 160)}`);
      }
    }
    const outputDir = path.join(repoRoot, "apidog-reports/loan-local-suite-7413");
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, `summary${runLabel ? `-${runLabel}` : ""}.json`), JSON.stringify({
      source: "Apidog project 1405851, suite 7413, assertion nguyên bản, fixture QA từng case",
      generatedAt: new Date().toISOString(), total: cases.length,
      passed: results.filter(r => r.state === "PASS").length,
      failed: results.filter(r => r.state === "FAIL").length,
      blocked: results.filter(r => r.state === "BLOCKED").length,
      cases: results,
      note: "Chỉ xác minh HTTP assertions; DB/race cần integration tests độc lập.",
    }, null, 2));
    console.log(`Apidog suite 7413 isolated: ${results.filter(r => r.state === "PASS").length}/${cases.length} PASS, ${results.filter(r => r.state === "FAIL").length} FAIL, ${results.filter(r => r.state === "BLOCKED").length} BLOCKED`);
    if (results.some(r => r.state !== "PASS")) process.exitCode = 1;
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
    if (ownsDb && mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
};

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
