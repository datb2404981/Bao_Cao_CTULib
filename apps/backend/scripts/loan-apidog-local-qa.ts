import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { AccountModel } from "../src/models/user.model.js";
import bookModel from "../src/models/book.model.js";
import employeeModel from "../src/models/employee.model.js";
import loanRecordModel, { LOAN_STATUSES } from "../src/models/loanRecord.model.js";
import readerModel from "../src/models/reader.model.js";

// Chạy các case GET /loans đã được xuất trong báo cáo CLI gốc.
// Mỗi case dùng lại cùng database QA sau khi drop/seed riêng, không chạm DB phát triển.
const uri = process.env.CTULIB_TEST_MONGODB_URI;
if (!uri) throw new Error("Thiếu CTULIB_TEST_MONGODB_URI");
const dbUrl = new URL(uri);
if (!(["localhost", "127.0.0.1"].includes(dbUrl.hostname)) ||
    !/^\/ctulib_qa_loan_apidog_[a-zA-Z0-9_]+$/.test(dbUrl.pathname) ||
    !dbUrl.searchParams.has("replicaSet")) {
  throw new Error("Chỉ chấp nhận Mongo replica set loopback và database ctulib_qa_loan_apidog_*");
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultReport = path.join(repoRoot, "apidog-reports/loan-penalty-attempt/apidog-report-2026-11-10-00-51-49-127-0.json");
const sourcePath = process.env.APIDOG_LOAN_SOURCE_REPORT ?? defaultReport;
const secret = randomBytes(32).toString("hex");
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.ACCESS_TOKEN_SECRET_KEY = secret;

type CollectionCase = {
  metaInfo?: { httpApiCaseName?: string };
  request: { url: { port: string; host: string[] }; baseUrl: string };
  event?: { listen: string; script: { exec: string[] } }[];
};
type CliCollection = { item: { item: CollectionCase[] }[]; [key: string]: unknown };

const findCaseId = (testCase: CollectionCase) => {
  const script = testCase.event?.find(event => event.listen === "prerequest")?.script.exec.join("\n");
  const id = script?.match(/const QA_CASE = \{"id":\s*"([A-Z0-9-]+)"/)?.[1];
  if (!id) throw new Error("Không tìm được ID test case trong script Apidog");
  return id;
};

const fixture = async () => {
  const [r1, r2, admin] = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
  const password = randomBytes(24).toString("hex");
  const hashed = await bcrypt.hash(password, 4);
  await AccountModel.insertMany([
    { _id: r1, ctuIdentifier: "B9900001", email: `${r1}@qa.invalid`, password: hashed, role: "READER" },
    { _id: r2, ctuIdentifier: "B9900002", email: `${r2}@qa.invalid`, password: hashed, role: "READER" },
    { _id: admin, ctuIdentifier: "ADMIN99101", email: `${admin}@qa.invalid`, password: hashed, role: "ADMIN" },
  ]);
  await readerModel.insertMany([r1, r2].map(_id => ({ _id, facultyId: new Types.ObjectId() })));
  // ADMIN không có MANAGE_LOANS nên phải trả 403 khi tra cứu danh sách.
  await employeeModel.create({ _id: admin, permissionIds: [] });

  const books = await bookModel.insertMany(Array.from({ length: LOAN_STATUSES.length + 1 }, (_, i) => ({
    title: `Apidog QA sách ${i}`, bookType: "TEXTBOOK", facultyId: new Types.ObjectId(),
    authorIds: [], coverPrice: 100000, totalCopies: 5, availableCopies: 3,
  })));
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await loanRecordModel.insertMany([
    ...LOAN_STATUSES.map((status, i) => ({
      readerId: r1, bookId: books[i]._id, status,
      reservationDate: new Date(now - 12 * day),
      reservationExpiryDate: new Date(now + day),
      ...(status === "Đang mượn" || status === "Quá hạn" || status === "Chờ nộp phạt" || status === "Đã trả"
        ? { handoverDate: new Date(now - 10 * day), dueDate: new Date(now + (status === "Đang mượn" ? 3 : -3) * day) }
        : {}),
      ...(status === "Đã trả" || status === "Chờ nộp phạt" ? { actualReturnDate: new Date(now - day) } : {}),
    })),
    { readerId: r2, bookId: books[LOAN_STATUSES.length]._id, status: "Đang mượn",
      reservationDate: new Date(now - 2 * day), reservationExpiryDate: new Date(now + day),
      handoverDate: new Date(now - day), dueDate: new Date(now + 6 * day) },
  ]);
  const expired = jwt.sign({ accountId: r1.toHexString(), ctuIdentifier: "B9900001", role: "READER" }, secret, {
    algorithm: "HS256", expiresIn: -60, subject: r1.toHexString(), issuer: "ctulib-api", audience: "ctulib-web",
  });
  return { r1: r1.toHexString(), r2: r2.toHexString(), password, expired };
};

const runCli = async (cliFile: string, outDir: string, id: string) => {
  const args = ["run", cliFile, "-r", "cli,json", "--on-error", "end", "--out-dir", outDir,
    "--env-var", `qaPreparedCaseId=${id}`, "--env-var", "qaFixtureVersion=ctulib-business-v1"];
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn("apidog", args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (buffer: Buffer) => { if (output.length < 12000) output += buffer.toString().slice(0, 12000 - output.length); });
    }
    child.once("error", reject);
    child.once("close", code => resolve({ code: code ?? 1, output }));
  });
};

const main = async () => {
  let ownsDb = false;
  let server: Server | undefined;
  let tempDir: string | undefined;
  const requested = new Set(process.argv.slice(2));
  const results: { id: string; passed: boolean; reason?: string }[] = [];
  try {
    const parsed = JSON.parse(await readFile(sourcePath, "utf8")) as { collection?: CliCollection };
    if (!parsed.collection?.item?.[0]?.item?.length) throw new Error("Báo cáo nguồn không có collection Apidog");
    const cases = parsed.collection.item.flatMap(item => item.item);
    const selected = cases.filter(item => requested.size === 0 || requested.has(findCaseId(item)));
    if (!selected.length) throw new Error("Không có case được chọn trong báo cáo nguồn");

    await mongoose.connect(uri!, { serverSelectionTimeoutMS: 8000 });
    const collections = await mongoose.connection.db!.listCollections().toArray();
    if (collections.length) throw new Error("DB QA không rỗng; hãy chọn tên database khác để tránh xóa dữ liệu");
    ownsDb = true;
    const { app } = await import("../src/app.js");
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
      listener.once("error", reject);
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Không tìm được cổng QA");
    const port = addr.port;
    tempDir = await mkdtemp(path.join(tmpdir(), "ctulib-loan-apidog-"));

    for (const original of selected) {
      const id = findCaseId(original);
      const scriptText = original.event?.find(event => event.listen === "prerequest")?.script.exec.join("\n") ?? "";
      if (/"blocked":\s*true/.test(scriptText)) {
        results.push({ id, passed: false, reason: "Apidog đánh dấu blocked: chưa chốt expected contract" });
        continue;
      }
      // Fixture được xóa và tạo lại trước MỖI case, tương ứng guard qaPreparedCaseId.
      await mongoose.connection.dropDatabase();
      const data = await fixture();
      const item = structuredClone(original);
      item.request.url.port = String(port);
      item.request.url.host = ["127", "0", "0", "1"];
      item.request.baseUrl = `http://127.0.0.1:${port}/api/v1`;
      for (const event of item.event ?? []) {
        if (event.listen !== "prerequest") continue;
        const current = event.script.exec.join("\n");
        const revised = current
          .replaceAll("http://localhost:8080/auth/login", `http://127.0.0.1:${port}/api/v1/auth/login`)
          .replaceAll("http://localhost:8080", `http://127.0.0.1:${port}`)
          .replaceAll(":8080", `:${port}`)
          .replace(/pm\.variables\.set\("qaR1AccountId","[0-9a-f]+"\);/, `pm.variables.set("qaR1AccountId","${data.r1}");`)
          .replace(/pm\.variables\.set\("qaR2AccountId","[0-9a-f]+"\);/, `pm.variables.set("qaR2AccountId","${data.r2}");`)
          .replace(/const QA_LOGIN = \{[^;]+\};/, match => {
            const login = JSON.parse(match.slice("const QA_LOGIN = ".length, -1)) as { ctuIdentifier: string };
            return `const QA_LOGIN = ${JSON.stringify({ ctuIdentifier: login.ctuIdentifier, password: data.password })};`;
          });
        // JWT được ký bằng khóa QA của chính process và đã hết hạn thực sự.
        event.script.exec = [`pm.variables.set("qaExpiredAccessToken", ${JSON.stringify(data.expired)});`, revised];
      }
      const oneCase = structuredClone(parsed.collection);
      oneCase.item = [{ item: [item] }];
      const caseDir = path.join(tempDir, id);
      await (await import("node:fs/promises")).mkdir(caseDir, { recursive: true });
      const collectionFile = path.join(caseDir, "collection.apidog-cli.json");
      await writeFile(collectionFile, JSON.stringify(oneCase), { mode: 0o600 });
      const outputDir = path.join(repoRoot, "apidog-reports/loan-local", id);
      await (await import("node:fs/promises")).mkdir(outputDir, { recursive: true });
      const result = await runCli(collectionFile, outputDir, id);
      const reports = (await readdir(outputDir)).filter(file => file.endsWith(".json")).sort();
      const reportFile = reports.at(-1);
      let passed = false;
      let reason: string | undefined;
      if (reportFile) {
        const report = JSON.parse(await readFile(path.join(outputDir, reportFile), "utf8")) as {
          run?: { stats?: { steps?: { total: number; passed: number; failed: number } }; failures?: { error?: { message?: string } }[] };
        };
        const stats = report.run?.stats?.steps;
        passed = result.code === 0 && !!stats && stats.total === 1 && stats.passed === 1 && stats.failed === 0;
        reason = passed ? undefined : `CLI=${result.code}; steps=${JSON.stringify(stats)}; ${report.run?.failures?.[0]?.error?.message ?? ""}`;
      } else reason = `CLI=${result.code}; ${result.output.slice(-700)}`;
      results.push({ id, passed, ...(reason ? { reason } : {}) });
      console.log(`${passed ? "PASS" : "FAIL"} ${id}${reason ? `: ${reason.slice(0, 240)}` : ""}`);
    }
    const passed = results.filter(result => result.passed).length;
    console.log(`Apidog GET /loans QA: ${passed}/${results.length} PASS; chỉ kiểm chứng các case có trong báo cáo nguồn.`);
    if (passed !== results.length) process.exitCode = 1;
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    if (ownsDb && mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
};

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
