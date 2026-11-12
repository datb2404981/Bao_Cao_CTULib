import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";

// Không đọc file .env của môi trường phát triển trong bài kiểm thử.
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.CLIENT_URL = "http://localhost:5173";

let server: Server;
let baseUrl: string;

before(async () => {
  const { app } = await import("../src/app.js");
  server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Không tìm được địa chỉ máy chủ thử nghiệm");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});

for (const endpoint of ["/loans", "/penalties", "/dashboard/stats"]) {
  for (const prefix of ["", "/api/v1"]) {
    const path = `${prefix}${endpoint}`;
    test(`${path} yêu cầu đăng nhập`, async () => {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.json();
      assert.equal(response.status, 401);
      assert.equal(body.status, "error");
    });
  }
}
