// Prepend: const SESSION_CASE_CODE = "TC-REF-001" (or a supported TC-OUT case).
// Fixed QA account; a fresh session for every execution. No token logging.
(function () {
  const code = SESSION_CASE_CODE;
  const root = String(pm.variables.get("sessionFixtureBaseUrl") || "http://localhost:8080").replace(/\/$/, "");
  const fixtureUrl = new URL(root);
  if (fixtureUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(fixtureUrl.hostname) ||
      fixtureUrl.pathname !== "/" || fixtureUrl.search || fixtureUrl.hash || fixtureUrl.username || fixtureUrl.password) {
    throw new Error("Fixture chỉ cho phép HTTP loopback, không có path hoặc credentials");
  }
  const rawUrl = pm.variables.replaceIn(pm.request.url.toString());
  if (/^https?:/.test(rawUrl) && new URL(rawUrl).origin !== root) {
    throw new Error("URL request phải cùng origin với sessionFixtureBaseUrl");
  }
  pm.variables.set("authFixtureId", "__not_prepared__");
  pm.variables.set("fixtureRefreshToken", "");
  pm.variables.set("fixtureAccessToken", "");
  pm.variables.set("fixtureIdentifier", "B9900001");
  pm.variables.set("fixturePassword", "QaReader123!");
  pm.request.headers.remove("Authorization");
  pm.request.headers.remove("Cookie");
  if (["TC-REF-019", "TC-OUT-014"].includes(code)) {
    pm.request.headers.remove("Origin");
  } else {
    pm.request.headers.upsert({ key: "Origin", value:
      ["TC-REF-022", "TC-OUT-015"].includes(code) ? "null" :
      ["TC-REF-018", "TC-OUT-009"].includes(code) ? "https://untrusted.example" :
      "http://localhost:5173" });
  }
  function ready(cookie, access) {
    // Apidog merges jar cookies with explicit headers. Clear only this request's domain.
    pm.cookies.jar().clear(pm.request.url);
    pm.variables.set("fixtureRefreshToken", cookie);
    pm.variables.set("fixtureAccessToken", access || "");
    pm.request.headers.upsert({ key: "Cookie", value: cookie ? "refreshToken=" + cookie : "" });
    pm.variables.set("authFixtureId", code);
  }
  if (["TC-REF-003", "TC-OUT-003"].includes(code)) { ready("", ""); return; }
  if (["TC-REF-004", "TC-OUT-012"].includes(code)) { ready("invalid-test-value", ""); return; }
  pm.sendRequest({ url: root + "/api/v1/auth/login", method: "POST",
    header: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: { mode: "raw", raw: JSON.stringify({ ctuIdentifier: "B9900001", password: "QaReader123!" }) },
  }, function (error, response) {
    if (error || !response || response.code !== 200) throw new Error("Không chuẩn bị được phiên test: login cần HTTP 200");
    const body = response.json();
    if (body.data?.user?.ctuIdentifier !== "B9900001" || body.data?.user?.role !== "READER") {
      throw new Error("Fixture login trả sai tài khoản");
    }
    const setCookie = response.headers.all().filter(h => h.key.toLowerCase() === "set-cookie")
      .map(h => h.value).find(v => /^refreshToken=/.test(v));
    const match = setCookie && /^refreshToken=([^;]+)/.exec(setCookie);
    if (!match || !body.data?.token) throw new Error("Fixture login thiếu cookie hoặc access token");
    const refresh = decodeURIComponent(match[1]);
    if (code === "TC-REF-015") { ready(body.data.token, body.data.token); return; }
    if (["TC-REF-007", "TC-OUT-002"].includes(code)) {
      pm.sendRequest({ url: root + "/api/v1/auth/logout", method: "POST", header: { Cookie: "refreshToken=" + refresh, Origin: "http://localhost:5173" } }, function (err, out) {
        if (err || !out || out.code !== 200) throw new Error("Không chuẩn bị được phiên đã logout");
        ready(refresh, body.data.token);
      });
    } else ready(refresh, body.data.token);
  });
})();
