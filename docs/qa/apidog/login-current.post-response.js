// Current backend: access JWT 30 min, refresh JWT cookie, account-only response.
// Prepended per case: const LOGIN_CASE = {status, role, validation, cors};
const loginResponse = pm.response.json();

pm.test("HTTP và status đúng với ca đăng nhập", () => {
  pm.expect(pm.response.code).to.equal(LOGIN_CASE.status);
  pm.expect(loginResponse.status).to.equal(LOGIN_CASE.status === 200 ? "success" : "error");
});

function decodeJwt(token) {
  pm.expect(token).to.be.a("string").and.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const decode = (part) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - part.length % 4) % 4)));
  const parts = token.split(".");
  return { header: decode(parts[0]), payload: decode(parts[1]) };
}

const refreshCookie = pm.response.headers.all()
  .filter((h) => h.key.toLowerCase() === "set-cookie")
  .map((h) => h.value)
  .find((v) => /^refreshToken=/.test(v));

if (LOGIN_CASE.status === 200) {
  pm.test("message và account đăng nhập đúng", () => {
    pm.expect(loginResponse.message).to.equal("Đăng nhập thành công, trả về Token và Thông tin user");
    pm.expect(loginResponse.data).to.be.an("object");
    const account = loginResponse.data.user;
    pm.expect(account).to.be.an("object");
    pm.expect(account.accountId).to.be.a("string").and.match(/^[a-fA-F0-9]{24}$/);
    pm.expect(account.email).to.be.a("string").and.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    pm.expect(account.role).to.equal(LOGIN_CASE.role);
    const input = JSON.parse(pm.variables.replaceIn(pm.request.body.raw));
    pm.expect(account.ctuIdentifier).to.equal(input.ctuIdentifier.trim().toUpperCase());
    // fullName/profile and isActive are not required in the current response.
  });

  pm.test("access JWT khớp account và hết hạn sau 1800 giây", () => {
    pm.expect(loginResponse.data.tokenType).to.equal("Bearer");
    pm.expect(loginResponse.data.expiresIn).to.equal(1800);
    const jwt = decodeJwt(loginResponse.data.token);
    pm.expect(jwt.header.alg).to.equal("HS256");
    pm.expect(jwt.header.typ).to.equal("JWT");
    pm.expect(jwt.payload.accountId).to.equal(loginResponse.data.user.accountId);
    pm.expect(jwt.payload.ctuIdentifier).to.equal(loginResponse.data.user.ctuIdentifier);
    pm.expect(jwt.payload.role).to.equal(loginResponse.data.user.role);
    pm.expect(jwt.payload.iat).to.be.a("number");
    pm.expect(jwt.payload.exp).to.be.a("number");
    pm.expect(jwt.payload.exp - jwt.payload.iat).to.equal(1800);
    // Decoding checks response consistency; it does not verify the signature.
  });

  pm.test("refresh cookie là JWT, HttpOnly, Lax, Path=/ và 7 ngày", () => {
    pm.expect(refreshCookie).to.be.a("string");
    const raw = refreshCookie.match(/^refreshToken=([^;]+)/);
    pm.expect(raw).not.to.equal(null);
    const jwt = decodeJwt(decodeURIComponent(raw[1]));
    pm.expect(jwt.header.alg).to.equal("HS256");
    pm.expect(jwt.payload.accountId).to.equal(loginResponse.data.user.accountId);
    pm.expect(jwt.payload.exp - jwt.payload.iat).to.equal(604800);
    pm.expect(refreshCookie).to.match(/;\s*HttpOnly(?:;|$)/i);
    pm.expect(refreshCookie).to.match(/;\s*SameSite=Lax(?:;|$)/i);
    pm.expect(refreshCookie).to.match(/;\s*Path=\/(?:;|$)/i);
    pm.expect(refreshCookie).to.match(/;\s*Max-Age=604800(?:;|$)/i);
    if (pm.variables.replaceIn(pm.request.url.toString()).startsWith("https:")) {
      pm.expect(refreshCookie).to.match(/;\s*Secure(?:;|$)/i);
    }
  });
} else {
  pm.test("lỗi đăng nhập đúng và không cấp token/cookie mới", () => {
    pm.expect(loginResponse.message).to.be.a("string").and.not.empty;
    if (LOGIN_CASE.validation) {
      pm.expect(loginResponse.data).to.be.an("array");
      for (const field of ["ctuIdentifier", "password"]) {
        pm.expect(loginResponse.data.some((item) => item && item.field === field)).to.equal(true);
      }
    } else {
      pm.expect(loginResponse.message).to.equal(LOGIN_CASE.status === 403 ? "Tài khoản đã bị khóa" : "Sai thông tin đăng nhập");
      pm.expect(loginResponse.data).to.equal(null);
    }
    pm.expect(refreshCookie).to.equal(undefined);
  });
}

pm.test("JSON không lộ mật khẩu, hash hoặc refresh token", () => {
  const forbidden = ["password", "passwordHash", "tokenHash", "refreshToken"];
  function check(value) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      pm.expect(forbidden).not.to.include(key);
      check(value[key]);
    }
  }
  check(loginResponse);
});

if (LOGIN_CASE.cors) {
  pm.test("CORS response headers cho origin frontend hợp lệ", () => {
    pm.expect(pm.response.headers.get("Access-Control-Allow-Origin")).to.equal(pm.variables.get("clientOrigin"));
    pm.expect(pm.response.headers.get("Access-Control-Allow-Credentials")).to.equal("true");
  });
  // Actual preflight/browser cookie acceptance belongs to the separate manual case.
}
