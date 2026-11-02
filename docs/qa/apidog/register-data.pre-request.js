// Apidog pre-request script. Each case prepends: const AUTH_CASE_ID = "TC-REG-...";
// Variables are local to this execution. Do not randomize login fixture credentials.
function newIdentity() {
  return {
    identifier: "B" + String(Math.floor(Math.random() * 10000000)).padStart(7, "0"),
    email: "qa_" + Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 12) + "@student.ctu.edu.vn",
  };
}

const identity = newIdentity();
pm.variables.set("caseIdentifier", identity.identifier);
pm.variables.set("caseEmail", identity.email);

if (AUTH_CASE_ID === "TC-REG-009" || AUTH_CASE_ID === "TC-REG-010") {
  // A failed fixture must never reuse a value inherited from an earlier run.
  pm.variables.set("duplicateIdentifier", "__fixture_not_prepared__");
  pm.variables.set("duplicateEmail", "__fixture_not_prepared__");
  // Provision a fresh account so conflict tests work alone and in any order.
  function provision(attempt) {
    const seed = newIdentity();
    if (seed.identifier === identity.identifier || seed.email === identity.email) {
      if (attempt >= 5) throw new Error("Không tạo được hai identity khác nhau");
      return provision(attempt + 1);
    }
    const url = pm.variables.replaceIn(pm.request.url.toString());
    pm.sendRequest({
      url,
      method: "POST",
      header: { "Content-Type": "application/json" },
      body: {
        mode: "raw",
        raw: JSON.stringify({
          ctuIdentifier: seed.identifier,
          email: seed.email,
          password: "QaFixture123!",
        }),
      },
    }, (error, response) => {
      if (error) throw new Error("Không chuẩn bị được fixture đăng ký");
      if (response.code === 409 && attempt < 5) return provision(attempt + 1);
      if (response.code !== 201) {
        throw new Error("Fixture đăng ký cần HTTP 201, nhận " + response.code);
      }
      pm.variables.set("duplicateIdentifier", seed.identifier);
      pm.variables.set("duplicateEmail", seed.email);
    });
  }
  provision(1);
}
