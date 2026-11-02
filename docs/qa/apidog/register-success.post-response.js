// Registration with automatic sign-in. Access token is allowed in data.token.
const registration = pm.response.json();

pm.test("đăng ký trả HTTP 201 và status success", () => {
  pm.expect(pm.response.code).to.equal(201);
  pm.expect(registration.status).to.equal("success");
});

pm.test("message đăng ký thành công", () => {
  pm.expect(registration.message).to.equal(
    "Đăng ký tài khoản thành công, trả về Token và Thông tin user",
  );
});

pm.test("data chứa access token và metadata", () => {
  pm.expect(registration.data).to.be.an("object");
  pm.expect(registration.data.token).to.be.a("string").and.match(
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  );
  pm.expect(registration.data.tokenType).to.equal("Bearer");
  pm.expect(registration.data.expiresIn).to.equal(1800);
});

pm.test("data.user chứa account độc giả vừa tạo", () => {
  const account = registration.data.user;
  pm.expect(account).to.be.an("object");
  pm.expect(account.accountId).to.be.a("string").and.match(/^[a-fA-F0-9]{24}$/);
  pm.expect(account.ctuIdentifier).to.be.a("string").and.not.empty;
  pm.expect(account.email).to.be.a("string").and.not.empty;
  pm.expect(account.role).to.equal("READER");

  // Compare with the actual request, including variables generated in pre-request.
  if (pm.request.body && typeof pm.request.body.raw === "string") {
    const input = JSON.parse(pm.variables.replaceIn(pm.request.body.raw));
    pm.expect(account.ctuIdentifier).to.equal(input.ctuIdentifier.trim().toUpperCase());
    pm.expect(account.email).to.equal(input.email.trim());
  }
});

pm.test("không lộ mật khẩu, hash hoặc refresh token trong JSON", () => {
  const forbidden = ["password", "passwordHash", "tokenHash", "refreshToken"];
  function check(value) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      pm.expect(forbidden).not.to.include(key);
      check(value[key]);
    }
  }
  check(registration);
});
