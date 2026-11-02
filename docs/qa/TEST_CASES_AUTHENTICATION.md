# BỘ TÀI LIỆU THIẾT KẾ KIỂM THỬ QA (CHUẨN ISTQB CTFL & CONTRACT-DRIVEN)
## PHÂN HỆ: AUTHENTICATION (XÁC THỰC NGƯỜI DÙNG)
- **Dự án**: CTULib (Hệ thống Quản lý Thư viện Đại học Cần Thơ)
- **Tiêu chuẩn áp dụng**: ISTQB Certified Tester Foundation Level (CTFL v4.0)
- **Phương pháp tiếp cận**: Shift-Left, Contract-First Testing, Risk-based Testing
- **Tài liệu cơ sở (Test Basis)**: Đặc tả OpenAPI 3.0.3 / 3.1.0 (`CTULib API` - Apidog Project ID: `1405851`)
- **Ngày cập nhật**: 31/10/2026
- **Trạng thái**: Thiết kế cập nhật, chưa thực thi; không xác nhận backend đã triển khai. Bộ tài liệu phiên bản v3.0 (Access JWT + refresh token có quản lý phiên)

---


> **Bộ login đang chạy:** suite `7295` gồm 15 case theo backend hiện tại (access JWT 1800 giây, refresh JWT, cookie Lax/Path=/, 7 ngày). Suite `7296` giữ 8 yêu cầu v3/DB/fault/browser ở trạng thái chờ. Các mục v3 bên dưới là test basis thiết kế; xem `LOGIN_CURRENT_CONTRACT.md` cho oracle đang chạy, không áp nguyên bộ v3 vào login hiện tại.

## 0. Hợp đồng xác thực v3 — quyết định thiết kế mới

Phạm vi thay đổi: tài liệu, OpenAPI và testware. Backend chưa được triển khai/kiểm thử theo hợp đồng này. Các thời hạn và tên cookie dưới đây là quyết định triển khai mới cho CTULib, không phải yêu cầu mặc định của JWT.

### 0.1. Token, cookie và client

- Giữ `data.token` để tương thích tên field cũ: đây là **access token**, JWT HS256, thời hạn 900 giây (15 phút). Login trả `data: {token, tokenType: "Bearer", expiresIn: 900, user}`; refresh trả `data: {token, tokenType: "Bearer", expiresIn: 900}`. Không trả refresh token trong JSON.
- Access JWT có `sub` (account ID), `role`, `iat`, `exp`, `iss: "ctulib-api"`, `aud: "ctulib-web"`, `jti` duy nhất. Xác thực chữ ký, thuật toán cho phép, issuer, audience và thời hạn; decode đơn thuần không xác minh chữ ký. Tại `now >= exp` phải từ chối. Không đưa password/passwordHash vào JWT.
- Refresh token là chuỗi opaque ngẫu nhiên mật mã 32 byte, mã hóa base64url không padding (43 ký tự); chỉ client nhận giá trị gốc qua cookie. Access JWT không thể dùng thay refresh token và ngược lại.
- Cookie tên `refreshToken`: `HttpOnly; SameSite=Strict; Path=/api/v1/auth`; không đặt Domain (host-only). Production HTTPS bắt buộc `Secure`; chỉ local HTTP development được bỏ Secure. Cookie login có `Max-Age=604800` giây. Không lưu refresh token vào LocalStorage, sessionStorage, biến JS frontend hoặc log.
- Phiên có thời hạn tuyệt đối 7 ngày kể từ login; rotation không kéo dài hạn phiên. Cookie sau refresh có Max-Age bằng số giây còn lại, làm tròn xuống; dưới 1 giây thì từ chối. Frontend giữ access token trong bộ nhớ, gửi `Authorization: Bearer <token>` cho API bảo vệ; gọi refresh sau reload để lấy access mới và chỉ chạy một refresh tại một thời điểm.
- Login, refresh và logout trả `Cache-Control: no-store`. Refresh/logout không dùng Bearer access token để xác thực và không nhận refresh token trong body, query hoặc Authorization header.
- Web deployment phải cùng site. CORS chỉ cho origin cấu hình trong `CLIENT_URL`, `Access-Control-Allow-Credentials: true`, không dùng wildcard. Trước xử lý login/refresh/logout, bắt buộc header `Origin` khớp origin cấu hình; thiếu, `null` hoặc khác origin trả 403, không thay đổi DB/cookie. Apidog phải gửi Origin hợp lệ. Đây là hợp đồng CSRF mới; test login cũ cần bổ sung header này.

### 0.2. Collection `refresh_tokens`

| Field | Kiểu | Quy định |
| :--- | :--- | :--- |
| `_id` | ObjectId | ID bản ghi token, tự tạo. |
| `accountId` | ObjectId | Bắt buộc, tham chiếu Account; index để tra phiên của tài khoản. |
| `sessionId` | String | UUID ngẫu nhiên cho một lần login; index, giữ nguyên trong các lần rotation của phiên. |
| `tokenHash` | String | SHA-256 dạng hex của refresh token ngẫu nhiên; required, unique index. Không dùng mật khẩu làm token. |
| `expiresAt` | Date | Hạn tuyệt đối của phiên, không đổi khi rotate. Kiểm tra trực tiếp mỗi request, không dựa vào TTL đã xóa hay chưa. |
| `isRevoked` | Boolean | required, mặc định false; true khi logout, rotation hoặc phát hiện replay. |
| `revokedAt` | Date | Thời điểm thu hồi, chỉ có khi đã thu hồi. |
| `replacedByTokenId` | ObjectId | Tham chiếu bản ghi token kế tiếp khi rotate; dùng phân biệt token đã dùng với logout. |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps. |

Giữ bản ghi token đã rotate cho đến `expiresAt` để phát hiện replay; TTL index `{expiresAt: 1}`, `expireAfterSeconds: 0` chỉ dọn dữ liệu. Không lưu access token trong collection này. Không trả tokenHash hoặc thông tin phiên nội bộ ra API.

### 0.3. Endpoint và trạng thái phiên

1. `POST /auth/login`: kiểm tra tài khoản/mật khẩu như các test cũ, sau khi qua Origin guard. Mỗi login tạo sessionId riêng. Chỉ trả 200 và Set-Cookie sau khi lưu DB thành công; DB lỗi trả 503, không cấp token/cookie.
2. `POST /auth/refresh`: body vắng mặt hoặc `{}`; Origin hợp lệ và cookie `refreshToken` bắt buộc. Body có field lạ/sai kiểu trả 400 trước xử lý token. Hợp lệ → 200, cấp JWT mới và cookie mới, đánh dấu token cũ revoked và liên kết token mới **nguyên tử** (transaction hoặc cơ chế tương đương). Không yêu cầu access token còn hạn.
3. Refresh token thiếu, sai định dạng, không tìm thấy, hết hạn hoặc revoked → 401 chung `Phiên đăng nhập không hợp lệ hoặc đã hết hạn`, `data: null`; xóa refresh cookie. Token đã rotate bị dùng lại → 401 và thu hồi mọi token còn hiệu lực cùng sessionId. Không thu hồi phiên khác của cùng tài khoản.
4. Hai refresh đồng thời với cùng token: tối đa một request 200; request còn lại 401 và thu hồi phiên do replay. Sau khi cả hai hoàn tất, token mới từ request thắng cũng không thể refresh tiếp. Không chấp nhận hai nhánh token còn hiệu lực, không trả 500. Client phải serialize refresh để tránh tự gây replay.
5. Tài khoản bị xóa → refresh 401 và thu hồi phiên; `LOCKED` → refresh 403 `Tài khoản bị khóa`, thu hồi mọi phiên của tài khoản, xóa cookie. Role trong access token mới lấy từ Account hiện tại, không lấy từ dữ liệu client hoặc snapshot cũ.
6. `POST /auth/logout`: Origin hợp lệ, body vắng mặt hoặc `{}`; không yêu cầu access JWT. Cookie hợp lệ/đã dùng → thu hồi toàn bộ sessionId, xóa cookie và trả 200 `{status: "success", message: "Đăng xuất thành công", data: null}`. Cookie thiếu, sai, hết hạn, không tồn tại hoặc đã revoked cũng trả cùng 200 (idempotent), không làm lộ phiên. Không thu hồi phiên khác. Cookie xóa dùng cùng Path, HttpOnly, SameSite, Secure production và `Max-Age=0`.
7. Logout **không** vô hiệu access JWT đã cấp ngay lập tức: JWT vẫn hợp lệ đến exp (tối đa 15 phút), trừ khi endpoint có kiểm tra trạng thái tài khoản riêng. Không triển khai blacklist trong phạm vi này. Không dùng GET /books công khai để kiểm tra JWT bị từ chối; dùng endpoint thực sự yêu cầu Bearer token.
8. Refresh/logout gặp DB lỗi khi cần đọc/ghi phiên → 503 `Dịch vụ xác thực tạm thời không khả dụng`, không cấp token/cookie mới hoặc tuyên bố thu hồi thành công. Transaction rotation phải rollback; token cũ dùng được khi DB phục hồi nếu chưa hết hạn/thu hồi. Frontend chỉ báo logout server thành công khi nhận 200.

### 0.4. Điều kiện kiểm thử và nguồn tham khảo

- Dùng tài khoản/dữ liệu tổng hợp, DB test cô lập; reset cookie jar và token theo từng case. Case nhiều phiên cần cookie jar riêng cho A/B. Không chạy mutation trên production.
- Biên thời gian dùng clock kiểm soát; không đợi 7 ngày. Quan sát DB để kiểm tra hash/rotation/thu hồi; mock response đơn thuần không chứng minh các hậu điều kiện này. Không ghi raw token vào báo cáo.
- Bắt lỗi replay/rotation/expiry dựa theo [RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14). Đây là API xác thực riêng của CTULib, không tuyên bố triển khai toàn bộ OAuth.
- Toàn bộ test thiết kế mới có trạng thái **Not Run**; chỉ đánh dấu Passed khi đã có bằng chứng thực thi trên backend tương ứng.

---

## 1. PHẦN KIỂM THỬ TĨNH & CÁC GIẢ ĐỊNH HỢP ĐỒNG (STATIC TESTING FINDINGS & CONTRACT GATES)

Trước khi thực thi kiểm thử động (Dynamic Testing), theo nguyên lý **Shift-Left Testing của ISTQB**, các điểm bất cập trong tài liệu cơ sở (OpenAPI Contract) cần được ghi nhận và quản lý rủi ro:

| Mã phát hiện (Finding ID) | Vị trí đặc tả | Vấn đề phát hiện trong tài liệu hợp đồng | Rủi ro phát sinh | Đề xuất xử lý / Tiêu chuẩn kiểm thử |
| :--- | :--- | :--- | :--- | :--- |
| **ST-AUTH-01** | Login / refresh / logout | Thay JWT đơn bằng access JWT + refresh token có rotation. | Token cũ có thể bị phát lại; logout không tự vô hiệu access JWT. | Áp dụng hợp đồng v3 bên dưới; kiểm tra DB, cookie và replay theo từng phiên. |
| **ST-AUTH-02** | `RegisterRequest` | Hợp đồng đăng ký tối giản dùng `additionalProperties: false`, chỉ nhận ba trường tài khoản. | Nguy cơ **Mass Assignment**: Hacker tiêm `"role": "ADMIN"` lúc đăng ký để leo thang đặc quyền. | Đã chốt additionalProperties=false; TC-REG-013 phải trả 400. |

---

## 2. BẢNG PHÂN TÍCH ĐIỀU KIỆN KIỂM THỬ (TEST CONDITIONS)

| Mã ĐK | Endpoint | Kỹ thuật ISTQB | Mục tiêu điều kiện kiểm thử |
| :--- | :--- | :--- | :--- |
| **COND-REG-01** | `POST /auth/register` | Use Case / Happy Path | Đăng ký thành công chỉ với ba trường tài khoản, không cần profile. |
| **COND-REG-02** | `POST /auth/register` | Equivalence Partitioning (EP) | Bắt lỗi thiếu từng trường bắt buộc theo schema. |
| **COND-REG-03** | `POST /auth/register` | EP / BVA | Xác thực định dạng và độ dài của `ctuIdentifier` (MSSV/MSCB). |
| **COND-REG-04** | `POST /auth/register` | EP / BVA | Xác thực định dạng email hợp lệ / không hợp lệ theo RFC 5322. |
| **COND-REG-05** | `POST /auth/register` | EP / BVA | Xác thực độ mạnh và độ dài mật khẩu `password`. |
| **COND-REG-06** | `POST /auth/register` | EP / BVA | Từ chối trường phoneNumber ngoài hợp đồng đăng ký (không kiểm tra định dạng profile). |
| **COND-REG-07** | `POST /auth/register` | BVA (Timezone aware) | Từ chối trường dateOfBirth ngoài hợp đồng đăng ký (không kiểm tra ngày sinh profile). |
| **COND-REG-08** | `POST /auth/register` | Decision Table / Conflict | Xử lý trùng lặp `ctuIdentifier` hoặc `email`. |
| **COND-REG-09** | `POST /auth/register` | Security / Mass Assignment | Ngăn chặn leo thang quyền hạn bằng cách tiêm `"role": "ADMIN"`. |
| **COND-REG-10** | `POST /auth/register` | Concurrency / Race Condition | Hai request đăng ký cùng MSSV đồng thời không làm crash server (không lỗi 500). |
| **COND-REG-11** | `POST /auth/register` | Security / Injection | Phòng thủ XSS và NoSQL/SQL Injection trong form đăng ký. |
| **COND-LOG-01** | `POST /auth/login` | Use Case / Token Verification | Đăng nhập thành công và giải mã JWT Claims (`sub`, `role`, `exp`). |
| **COND-LOG-02** | `POST /auth/login` | Decision Table | Xử lý sai tài khoản hoặc sai mật khẩu (HTTP 400, chống user enumeration). |
| **COND-LOG-03** | `POST /auth/login` | State Transition / Security | Xử lý tài khoản bị khóa `LOCKED` (HTTP 403, chống rò rỉ mật khẩu). |
| **COND-LOG-04** | `POST /auth/login` | EP / BVA | Chuẩn hóa chữ hoa/chữ thường và loại bỏ khoảng trắng thừa. |
| **COND-LOG-05** | `POST /auth/login` | Security / Injection | Chặn Bypass xác thực bằng NoSQL Object Injection (`$ne`, `$gt`). |
| **COND-OUT-01** | `POST /auth/logout` | Use Case | Thu hồi phiên bằng refresh cookie, kể cả access JWT đã hết hạn. |
| **COND-OUT-02** | `POST /auth/logout` | State Transition / Security | Logout lặp lại an toàn; refresh của phiên bị thu hồi bị từ chối. |
| **COND-OUT-03** | `POST /auth/logout` | EP / Security | Cookie thiếu/sai/hết hạn; origin không hợp lệ; DB lỗi không được báo thành công giả. |
| **COND-REF-01** | `POST /auth/refresh` | Use Case / State Transition | Cấp access token mới và rotate refresh token nguyên tử. |
| **COND-REF-02** | `POST /auth/refresh` | EP / BVA / Security | Hết hạn, thu hồi, replay, race, khóa tài khoản, CSRF và lỗi DB. |
| **COND-SES-01** | `POST /auth/login` | Security / Integration | Cookie, lưu hash phiên, claims, lỗi DB và Origin/CORS. |
| **COND-JWT-01** | `GET /loans` | EP / Security | JWT thiếu, sai Bearer, giả mạo, sai thuật toán, issuer hoặc audience. |

---

## 3. DANH SÁCH CA KIỂM THỬ NGUYÊN TỬ (ATOMIC TEST CASES)

> **Nguyên tắc thiết kế ISTQB**: Mỗi ca kiểm thử dưới đây là **nguyên tử (Atomic)**: 1 dữ liệu đầu vào $\rightarrow$ 1 luồng thực thi $\rightarrow$ 1 kết quả mong đợi duy nhất. Không gộp chung luồng Pass và Fail.

### PHẦN I: `POST /auth/register` — đăng ký tối giản

**Đăng ký cấp token ngay:** HTTP 201, message `Đăng ký tài khoản thành công, trả về Token và Thông tin user`, `data: {token, tokenType: "Bearer", expiresIn: 1800, user: {accountId, ctuIdentifier, email, role}}`. Không còn data=null cho đăng ký thành công. Refresh token chỉ qua cookie HttpOnly; không trả password/passwordHash/tokenHash trong JSON. Đây là cập nhật riêng cho register theo controller hiện tại; hợp đồng login/refresh v3 không tự thay đổi theo.

**Dữ liệu động trên Apidog:** mỗi request tự sinh `caseIdentifier` dạng `B` + 7 chữ số (8 ký tự) và `caseEmail` hợp lệ; chỉ thay các trường hợp lệ, giữ dữ liệu cố ý sai/thiếu của từng ca. Script nguồn: `docs/qa/apidog/register-data.pre-request.js`. Không đổi thông tin login fixture ngẫu nhiên. Hai ca 009/010 tự tạo account seed bằng cùng endpoint (cần HTTP 201), rồi chỉ lặp đúng MSSV hoặc email; seed lỗi làm ca thất bại. Chỉ chạy trên DB test: seed tạo account thật và không tự dọn dữ liệu. Mã số có không gian hữu hạn nên random không bảo đảm duy nhất tuyệt đối với DB; nếu ca thành công gặp 409 thật, kiểm tra xung đột rồi chạy lại trên dữ liệu test sạch.

Chốt ngày 31/10/2026: chỉ nhận ba trường bắt buộc `ctuIdentifier`, `email`, `password`. Account mặc định `role: READER`, `isActive: true`; mật khẩu được băm. Thông tin cá nhân cập nhật qua profile sau đăng ký, không thuộc payload đăng ký. Schema strict: trường ngoài hợp đồng trả 400.

Giữ mã case và Apidog ID để bảo toàn tham chiếu; các mã 003D/E, 007, 008, 011, 012A đã đổi mục tiêu. Tất cả Not Run. Dùng DB test cô lập; dữ liệu hợp lệ phải chưa tồn tại, trừ case trùng dữ liệu. Mỗi case: gửi một POST với payload bên dưới; kiểm tra HTTP, status, message và data. Case 201 phải kiểm tra thêm DB: account có mật khẩu băm, role READER, isActive true; case lỗi không tạo account. Các hậu điều kiện DB cần runner/quan sát riêng.

#### TC-REG-001: Đăng ký thành công với đúng ba trường tài khoản
- **Apidog ID**: `62448339`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-01.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 201; status=success; message=Đăng ký tài khoản thành công, trả về Token và Thông tin user; data là object có access token, tokenType=Bearer, expiresIn=1800 và user/account.

#### TC-REG-002: Đăng ký không cần thông tin profile
- **Apidog ID**: `62448340`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-01.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 201; status=success; message=Đăng ký tài khoản thành công, trả về Token và Thông tin user; data là object có access token, tokenType=Bearer, expiresIn=1800 và user/account.

#### TC-REG-003A: Bắt lỗi validation khi thiếu ctuIdentifier
- **Apidog ID**: `62448341`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "email": "{{caseEmail}}",
  "password": "Pass123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=ctuIdentifier.

#### TC-REG-003B: Bắt lỗi validation khi thiếu email
- **Apidog ID**: `62448342`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "password": "Pass123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=email.

#### TC-REG-003C: Bắt lỗi validation khi thiếu password
- **Apidog ID**: `62448343`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=password.

#### TC-REG-003D: Từ chối ctuIdentifier kiểu object
- **Apidog ID**: `62448344`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": {
    "$ne": null
  },
  "email": "{{caseEmail}}",
  "password": "Pass123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=ctuIdentifier.

#### TC-REG-003E: Từ chối email kiểu number
- **Apidog ID**: `62448345`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": 123,
  "password": "Pass123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=email.

#### TC-REG-004A: Từ chối ctuIdentifier là chuỗi rỗng hoặc toàn khoảng trắng
- **Apidog ID**: `62448346`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "    ",
  "email": "{{caseEmail}}",
  "password": "Pass123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=ctuIdentifier.

#### TC-REG-004B: Từ chối ctuIdentifier sai chuẩn định dạng Đại học Cần Thơ
- **Apidog ID**: `62448347`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "K123456",
  "email": "{{caseEmail}}",
  "password": "Pass123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=ctuIdentifier.

#### TC-REG-005A: Từ chối email thiếu ký tự @
- **Apidog ID**: `62448348`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "invalidemail.ctu.edu.vn",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=email.

#### TC-REG-006A: Từ chối mật khẩu rỗng
- **Apidog ID**: `62448349`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": ""
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=password.

#### TC-REG-006B: Từ chối mật khẩu dưới ngưỡng biên 8 ký tự (7 ký tự)
- **Apidog ID**: `62448350`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "1234567"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=password.

#### TC-REG-006C: Chấp nhận mật khẩu đúng 8 ký tự (Tại điểm biên hợp lệ)
- **Apidog ID**: `62448351`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-01.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "password"
}
```
- **Kết quả mong đợi**: HTTP 201; status=success; message=Đăng ký tài khoản thành công, trả về Token và Thông tin user; data là object có access token, tokenType=Bearer, expiresIn=1800 và user/account.

#### TC-REG-007A: Từ chối trường profile phoneNumber (A)
- **Apidog ID**: `62448352`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "phoneNumber": "090123456"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=phoneNumber.

#### TC-REG-008A: Từ chối trường profile dateOfBirth (A)
- **Apidog ID**: `62448353`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "dateOfBirth": "2099-01-01"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=dateOfBirth.

#### TC-REG-009: Đăng ký thất bại do trùng lặp ctuIdentifier (HTTP 409 Conflict)
- **Apidog ID**: `62448354`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-08.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{duplicateIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 409; status=error; message không rỗng; không lộ E11000; chuẩn bị sẵn account trùng đúng trường, trường còn lại không trùng.

#### TC-REG-010: Đăng ký thất bại do trùng lặp email (HTTP 409 Conflict)
- **Apidog ID**: `62448355`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-08.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{duplicateEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 409; status=error; message không rỗng; không lộ E11000; chuẩn bị sẵn account trùng đúng trường, trường còn lại không trùng.

#### TC-REG-013: Từ chối tự gán role ADMIN khi đăng ký
- **Apidog ID**: `62448356`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "role": "ADMIN"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=role.

#### TC-REG-004C: Từ chối MSSV sai độ dài 6 chữ số
- **Apidog ID**: `62491179`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "B240498",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=ctuIdentifier.

#### TC-REG-004D: Chấp nhận MSSV đúng định dạng CTU
- **Apidog ID**: `62491236`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-01.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 201; status=success; message=Đăng ký tài khoản thành công, trả về Token và Thông tin user; data là object có access token, tokenType=Bearer, expiresIn=1800 và user/account.

#### TC-REG-005B: Từ chối email thiếu domain
- **Apidog ID**: `62491237`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "user@",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=email.

#### TC-REG-005C: Từ chối email thiếu username
- **Apidog ID**: `62491238`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "@student.ctu.edu.vn",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=email.

#### TC-REG-005D: Từ chối email chứa khoảng trắng
- **Apidog ID**: `62491239`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "dat b2404981@student.ctu.edu.vn",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=email.

#### TC-REG-006D: Chấp nhận mật khẩu dài 128 ký tự
- **Apidog ID**: `62491240`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-01.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
}
```
- **Kết quả mong đợi**: HTTP 201; status=success; message=Đăng ký tài khoản thành công, trả về Token và Thông tin user; data là object có access token, tokenType=Bearer, expiresIn=1800 và user/account.

#### TC-REG-007B: Từ chối trường profile phoneNumber (B)
- **Apidog ID**: `62491241`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "phoneNumber": "090123456789"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=phoneNumber.

#### TC-REG-007C: Từ chối trường profile phoneNumber (C)
- **Apidog ID**: `62491242`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "phoneNumber": "0901234abc"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=phoneNumber.

#### TC-REG-007D: Từ chối trường profile phoneNumber (D)
- **Apidog ID**: `62491243`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "phoneNumber": "0901234567"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=phoneNumber.

#### TC-REG-008B: Từ chối trường profile dateOfBirth (B)
- **Apidog ID**: `62491244`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "dateOfBirth": "2004-05-15"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=dateOfBirth.

#### TC-REG-008C: Từ chối trường profile dateOfBirth (C)
- **Apidog ID**: `62491245`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "dateOfBirth": "2000-01-01"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=dateOfBirth.

#### TC-REG-008D: Từ chối trường profile dateOfBirth (D)
- **Apidog ID**: `62491246`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "dateOfBirth": "15/05/2004"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=dateOfBirth.

#### TC-REG-008E: Từ chối trường profile dateOfBirth (E)
- **Apidog ID**: `62491247`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "dateOfBirth": "2023-02-29"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=dateOfBirth.

#### TC-REG-011: Từ chối trường profile facultyId khi đăng ký
- **Apidog ID**: `62491248`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "facultyId": "000000000000000000000000"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=facultyId.

#### TC-REG-012A: Từ chối trường fullName chứa script khi đăng ký
- **Apidog ID**: `62491249`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-09.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "{{caseIdentifier}}",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!",
  "fullName": "<script>alert('xss')</script> Nguyễn Văn An"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=fullName.

#### TC-REG-012B: Từ chối chuỗi SQL injection ở MSSV
- **Apidog ID**: `62491250`; **Yêu cầu / điều kiện**: REQ-AUTH-01 / COND-REG-02.
- **Priority / Risk**: High / High; **Kỹ thuật**: EP / BVA; **Trạng thái**: Not Run.
- **Payload**:
```json
{
  "ctuIdentifier": "B2404981' OR '1'='1",
  "email": "{{caseEmail}}",
  "password": "StrongPassword123!"
}
```
- **Kết quả mong đợi**: HTTP 400; status=error; message không rỗng; data là mảng chứa field=ctuIdentifier.

#### TC-REG-014: Hai request đăng ký cùng MSSV đồng thời
- REQ-AUTH-01 / COND-REG-10; High / High; Concurrency; Not Run.
- Chuẩn bị MSSV chưa tồn tại và hai email khác nhau chưa tồn tại; mỗi body chỉ có ctuIdentifier, email, password hợp lệ. Gửi đồng thời hai POST cùng MSSV.
- Đúng một 201 và một 409, không 500; DB chỉ có một account cho MSSV. Cần runner song song và bằng chứng DB.

---

### PHẦN II: `POST /auth/login` (ĐĂNG NHẬP HỆ THỐNG)

#### Bảng quyết định kiểm thử đăng nhập chuẩn hóa (Normalized Decision Table):

| Quy tắc (Rule) | Trạng thái tài khoản | Tồn tại ctuIdentifier? | Mật khẩu khớp? | Kết quả mong đợi | Ghi chú bảo mật |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | `ACTIVE` | Có | Đúng | **HTTP 200 OK** | Cấp JWT Token + Claims |
| **R2** | `ACTIVE` | Không | Bất kỳ | **HTTP 400 Bad Request** | Thông báo: "Sai thông tin đăng nhập" |
| **R3** | `ACTIVE` | Có | Sai | **HTTP 400 Bad Request** | Thông báo: "Sai thông tin đăng nhập" |
| **R4** | `LOCKED` | Có | Đúng | **HTTP 403 Forbidden** | Thông báo: "Tài khoản bị khóa" |
| **R5** | `LOCKED` | Có | Sai | **HTTP 400 Bad Request** | Phải trả về 400 (chống xác minh mật khẩu của nick bị khóa) |

---

#### TC-LOG-001: Đăng nhập thành công với tài khoản Độc giả (`READER`)
- **ID**: `TC-LOG-001`
- **Mục tiêu**: Kiểm tra đăng nhập hợp lệ và trả về đúng schema `LoginSuccessResponse`.
- **Kỹ thuật**: Use Case Testing | **Priority**: High | **Risk**: High
- **Tiền điều kiện**: Tài khoản `ctuIdentifier: "B2404981"` ở trạng thái `ACTIVE`.
- **Payload**:
  ```json
  {
    "ctuIdentifier": "B2404981",
    "password": "StrongPassword123!"
  }
  ```
- **Kết quả mong đợi**:
  - HTTP `200 OK`
  - Body: `status: "success"`, `message: "Đăng nhập thành công"`
  - `data.token`: Access JWT hợp lệ; `data.tokenType: "Bearer"`, `data.expiresIn: 900`.
  - Cookie `refreshToken` được cấp; tạo một phiên mới và lưu bản băm token trong DB. Không trả refresh token trong JSON.
  - Áp dụng đầy đủ hợp đồng v3 ở mục 0; kiểm tra cookie, DB và token như TC-SES-001–006.
  - `data.user`: Chứa `accountId`, `ctuIdentifier: "B2404981"`, `email`, `role: "READER"`, `isActive: true`; không trả password/passwordHash hoặc thông tin profile.

---

#### TC-LOG-001B: Kiểm tra tính hợp lệ của JWT Claims (Token Contract Verification)
- **ID**: `TC-LOG-001B`
- **Mục tiêu**: Giải mã token nhận được từ `TC-LOG-001` để xác minh nội dung payload.
- **Kỹ thuật**: Security / Contract Testing | **Priority**: High | **Risk**: High
- **Hành động**: Decode chuỗi JWT nhận được từ phản hồi đăng nhập.
- **Kết quả mong đợi**:
  - Header: Thuật toán ký cố định `alg: "HS256"`, `typ: "JWT"`; verifier không chấp nhận thuật toán khác.
  - Payload:
    - `sub`: Khớp chính xác với `data.user.accountId`.
    - `role`: `"READER"`.
    - `iat` (Issued At): Timestamp hợp lệ tại thời điểm tạo.
    - `exp` (Expiration): Thời điểm hết hạn lớn hơn `iat` (`exp - iat = 900s`; kiểm tra thêm `iss: "ctulib-api"`, `aud: "ctulib-web"`, `jti` duy nhất).

---

#### TC-LOG-002: Đăng nhập thành công với tài khoản Thủ thư (`EMPLOYEE`)
- **ID**: `TC-LOG-002`
- **Mục tiêu**: Kiểm tra đăng nhập phân quyền cho nhân viên thư viện.
- **Kết quả mong đợi**: HTTP `200 OK`, `data.user.role: "EMPLOYEE"`; access JWT 900 giây, refresh cookie và phiên mới đúng hợp đồng v3.

---

#### TC-LOG-003: Đăng nhập thành công với tài khoản Quản trị (`ADMIN`)
- **ID**: `TC-LOG-003`
- **Mục tiêu**: Kiểm tra đăng nhập cho quản trị viên hệ thống.
- **Kết quả mong đợi**: HTTP `200 OK`, `data.user.role: "ADMIN"`; access JWT 900 giây, refresh cookie và phiên mới đúng hợp đồng v3.

---

#### TC-LOG-004: Đăng nhập thất bại do sai mật khẩu (Rule R3)
- **ID**: `TC-LOG-004`
- **Mục tiêu**: Kiểm tra từ chối khi nhập sai mật khẩu.
- **Payload**: `{"ctuIdentifier": "B2404981", "password": "WrongPassword999!"}`
- **Kết quả mong đợi**:
  - HTTP `400 Bad Request`
  - Body: `status: "error"`, `message: "Sai thông tin đăng nhập"`, `data: null`.

---

#### TC-LOG-005: Đăng nhập thất bại do tài khoản không tồn tại (Rule R2 - Chống User Enumeration)
- **ID**: `TC-LOG-005`
- **Mục tiêu**: Đảm bảo thông báo lỗi đồng nhất, không tiết lộ tài khoản có tồn tại hay không.
- **Payload**: `{"ctuIdentifier": "NONEXISTENT_USER", "password": "AnyPassword123!"}`
- **Kết quả mong đợi**:
  - HTTP `400 Bad Request`
  - Thông báo: `"Sai thông tin đăng nhập"` (KHÔNG thông báo "Người dùng không tồn tại").

---

#### TC-LOG-006: Đăng nhập thất bại do tài khoản bị khóa (Rule R4)
- **ID**: `TC-LOG-006`
- **Mục tiêu**: Ngăn chặn tài khoản bị khóa đăng nhập vào hệ thống khi nhập đúng mật khẩu.
- **Tiền điều kiện**: Tài khoản `B2409999` có cờ trạng thái `status: "LOCKED"`.
- **Payload**: Nhập đúng `ctuIdentifier: "B2409999"` và đúng mật khẩu.
- **Kết quả mong đợi**:
  - HTTP `403 Forbidden`
  - Body: `status: "error"`, `message: "Tài khoản bị khóa"`, `data: null`.

---

#### TC-LOG-006B: Xử lý tài khoản bị khóa khi nhập SAI mật khẩu (Rule R5)
- **ID**: `TC-LOG-006B`
- **Mục tiêu**: Chống rò rỉ trạng thái mật khẩu của tài khoản đang bị khóa.
- **Tiền điều kiện**: Tài khoản `B2409999` có `status: "LOCKED"`.
- **Payload**: Nhập `ctuIdentifier: "B2409999"` và mật khẩu **SAI**.
- **Kết quả mong đợi**:
  - HTTP `400 Bad Request` (Thông báo chung: "Sai thông tin đăng nhập").
  - Kẻ tấn công không thể dựa vào mã `403` để biết mật khẩu vừa đoán là đúng hay sai.

---

#### TC-LOG-007: Kiểm tra tính phân biệt chữ hoa/thường (Case Sensitivity)
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-LOG-007A (Mật khẩu phân biệt hoa thường)**: Mật khẩu đúng là `"StrongPassword123!"`, gửi `"strongpassword123!"` $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-LOG-007B (MSSV chuẩn hóa không phân biệt hoa thường)**: MSSV là `"B2404981"`, người dùng nhập `"b2404981"` kèm đúng mật khẩu $\rightarrow$ HTTP `200 OK` (Cơ chế trim & toLowerCase của backend).

---

#### TC-LOG-008: Chặn Bypass xác thực bằng NoSQL Object Injection
- **ID**: `TC-LOG-008`
- **Mục tiêu**: Đảm bảo không thể bypass login bằng kỹ thuật truyền Object MongoDB vào trường chuỗi.
- **Kỹ thuật**: Security Testing | **Priority**: Critical | **Risk**: Critical
- **Payload**:
  ```json
  {
    "ctuIdentifier": { "$ne": null },
    "password": { "$ne": null }
  }
  ```
- **Kết quả mong đợi**: HTTP `400 Bad Request` (Bị chặn ngay tại tầng Schema Validation hoặc Zod validator, không được truyền xuống query Mongoose).

---

### PHẦN III: `POST /auth/logout` — thu hồi phiên

#### TC-OUT-001: Đăng xuất thu hồi phiên hiện tại
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất thu hồi phiên hiện tại.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Phiên A có refresh token R0 hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Gửi POST với cookie refreshToken=R0 và Origin hợp lệ.
- **Kết quả mong đợi**: 200; status=success; data=null; xóa cookie đúng attributes; Cache-Control=no-store.
- **Hậu điều kiện**: Mọi token của sessionId A bị revoked; POST refresh bằng R0 trả 401.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-002: Đăng xuất lặp lại cùng token
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất lặp lại cùng token.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Phiên A đã logout; giữ giá trị R0 trong fixture cô lập. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Gửi lại POST logout với R0.
- **Kết quả mong đợi**: 200 cùng response thành công; tiếp tục xóa cookie.
- **Hậu điều kiện**: Phiên vẫn revoked; không tạo phiên mới.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-003: Đăng xuất khi thiếu refresh cookie
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất khi thiếu refresh cookie.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Cookie jar rỗng. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout không cookie, Origin hợp lệ.
- **Kết quả mong đợi**: 200 và cookie xóa Max-Age=0; không yêu cầu Authorization.
- **Hậu điều kiện**: Không sửa phiên khác.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-004: Đăng xuất với refresh token hết hạn
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất với refresh token hết hạn.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 hết hạn, bản ghi còn trong DB để mô phỏng TTL trễ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout cookie R0.
- **Kết quả mong đợi**: 200 và xóa cookie.
- **Hậu điều kiện**: Phiên hết hạn không thể refresh.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-005: Đăng xuất với refresh token không tồn tại
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất với refresh token không tồn tại.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Token ngẫu nhiên đúng định dạng không có trong DB. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với token đó.
- **Kết quả mong đợi**: 200 và xóa cookie; không tiết lộ token có tồn tại.
- **Hậu điều kiện**: Không sửa phiên khác.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-006: Đăng xuất khi access token hết hạn
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất khi access token hết hạn.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Refresh R0 hợp lệ; access JWT đã hết hạn. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với cookie R0; không gửi Bearer.
- **Kết quả mong đợi**: 200 và xóa cookie.
- **Hậu điều kiện**: Phiên A bị thu hồi.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-007: Đăng xuất không ảnh hưởng thiết bị khác
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Đăng xuất không ảnh hưởng thiết bị khác.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: A/B là hai phiên của cùng account, cookie jar riêng. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Logout A; sau đó refresh B.
- **Kết quả mong đợi**: Logout A 200; refresh B 200.
- **Hậu điều kiện**: A revoked; B rotate bình thường.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-008: Access JWT còn hạn sau đăng xuất
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Access JWT còn hạn sau đăng xuất.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Có access JWT còn hạn và endpoint bảo vệ đã xác nhận truy cập được. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Logout; dùng cùng JWT truy cập endpoint bảo vệ trước exp.
- **Kết quả mong đợi**: Logout 200; JWT vẫn được chấp nhận theo quyền; refresh của phiên trả 401.
- **Hậu điều kiện**: Không giả định logout đã blacklist access JWT.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-009: Từ chối logout từ origin khác
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Từ chối logout từ origin khác.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: Phiên A hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với Origin=https://evil.example và cookie A.
- **Kết quả mong đợi**: 403; không Set-Cookie.
- **Hậu điều kiện**: Phiên A không bị thu hồi.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-010: Không báo logout thành công khi DB lỗi
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Không báo logout thành công khi DB lỗi.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Phiên A hợp lệ; mô phỏng lỗi DB khi thu hồi. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với A.
- **Kết quả mong đợi**: 503; status=error; data=null; không xóa/cấp cookie.
- **Hậu điều kiện**: Không tuyên bố logout thành công; phục hồi DB và kiểm tra phiên chưa revoked.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-011: Logout token đã rotate thu hồi phiên kế tiếp
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Logout token đã rotate thu hồi phiên kế tiếp.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 đã rotate sang R1 cùng phiên A; B độc lập. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Logout bằng cookie R0.
- **Kết quả mong đợi**: 200; xóa cookie.
- **Hậu điều kiện**: R1 bị revoked; B không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-012: Logout cookie sai định dạng vẫn idempotent
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Logout cookie sai định dạng vẫn idempotent.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Origin hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với refreshToken=abc.
- **Kết quả mong đợi**: 200; xóa cookie.
- **Hậu điều kiện**: Không sửa phiên khác.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-013: Logout body chứa field lạ
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Logout body chứa field lạ.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Validation.
- **Tiền điều kiện**: Phiên A hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với JSON {"refreshToken":"abc"} và cookie A.
- **Kết quả mong đợi**: 400; không Set-Cookie.
- **Hậu điều kiện**: Phiên A không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-014: Logout thiếu Origin
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Logout thiếu Origin.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: Phiên A hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout có cookie A nhưng thiếu Origin.
- **Kết quả mong đợi**: 403; không Set-Cookie.
- **Hậu điều kiện**: Phiên A không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-OUT-015: Logout Origin null
- **Yêu cầu / endpoint**: REQ-AUTH-03 · `POST /auth/logout` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Logout Origin null.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: Phiên A hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST logout với Origin: null.
- **Kết quả mong đợi**: 403; không Set-Cookie.
- **Hậu điều kiện**: Phiên A không đổi.
- **Trạng thái thực thi**: Not Run.

### PHẦN IV: `POST /auth/refresh` — rotation và phát hiện replay

#### TC-REF-001: Refresh hợp lệ và rotation nguyên tử
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh hợp lệ và rotation nguyên tử.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 hợp lệ; clock còn hơn 1 giây trước expiresAt. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh với cookie R0, Origin hợp lệ, không Bearer.
- **Kết quả mong đợi**: 200; data.token là JWT mới, tokenType=Bearer, expiresIn=900; cookie R1 khác R0; no-store.
- **Hậu điều kiện**: R0 revoked và replacedByTokenId trỏ R1; chỉ R1 active trong phiên; expiresAt không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-002: Refresh khi access JWT đã hết hạn
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh khi access JWT đã hết hạn.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 còn hạn, access JWT hết hạn. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh với R0, không Bearer.
- **Kết quả mong đợi**: 200; access JWT mới sử dụng được trên endpoint bảo vệ.
- **Hậu điều kiện**: R0 được rotate.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-003: Thiếu refresh cookie
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Thiếu refresh cookie.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Cookie jar rỗng. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh không cookie.
- **Kết quả mong đợi**: 401; thông báo phiên không hợp lệ chung; data=null; xóa cookie; không cấp token.
- **Hậu điều kiện**: Không tạo phiên/token mới.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-004: Refresh cookie sai định dạng
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh cookie sai định dạng.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Không cần tài khoản. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh cookie refreshToken=abc.
- **Kết quả mong đợi**: 401; thông báo phiên không hợp lệ chung; data=null; xóa cookie; không cấp token.
- **Hậu điều kiện**: Không tạo phiên/token mới.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-005: Refresh token không tồn tại
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh token không tồn tại.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Token đúng dạng 43 ký tự, không có trong DB. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh với token đó.
- **Kết quả mong đợi**: 401; thông báo phiên không hợp lệ chung; data=null; xóa cookie; không cấp token.
- **Hậu điều kiện**: Không tạo phiên/token mới.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-006: Refresh token hết hạn dù TTL chưa xóa
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh token hết hạn dù TTL chưa xóa.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 có expiresAt < now, bản ghi còn tồn tại. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh với R0.
- **Kết quả mong đợi**: 401; thông báo phiên không hợp lệ chung; data=null; xóa cookie; không cấp token.
- **Hậu điều kiện**: Không tạo phiên/token mới.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-007: Refresh token đã logout
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh token đã logout.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 thuộc phiên đã logout. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh với R0.
- **Kết quả mong đợi**: 401; thông báo phiên không hợp lệ chung; data=null; xóa cookie; không cấp token.
- **Hậu điều kiện**: Không tạo phiên/token mới.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-008: Dùng lại token đã rotate thu hồi cả phiên
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Dùng lại token đã rotate thu hồi cả phiên.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / Replay.
- **Tiền điều kiện**: R0 đã rotate sang R1; phiên B độc lập. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh lại với R0; sau đó kiểm tra R1.
- **Kết quả mong đợi**: R0 trả 401; R1 cũng trả 401.
- **Hậu điều kiện**: Cả phiên A revoked; B không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-009: Hai refresh đồng thời cùng token
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Hai refresh đồng thời cùng token.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Concurrency / State Transition.
- **Tiền điều kiện**: R0 hợp lệ; hai request đồng bộ xuất phát. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Gửi hai POST refresh đồng thời dùng cùng R0; đợi cả hai xong rồi dùng token thắng.
- **Kết quả mong đợi**: Một 200 và một 401; không 500; refresh token thắng sau đó 401.
- **Hậu điều kiện**: Replay thu hồi phiên; không có hai nhánh active.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-010: Biên ngay tại thời điểm hết hạn
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Biên ngay tại thời điểm hết hạn.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Time BVA.
- **Tiền điều kiện**: Clock now bằng expiresAt của R0. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh bằng R0.
- **Kết quả mong đợi**: 401; xóa cookie.
- **Hậu điều kiện**: Không cấp token.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-011: Biên một giây trước hết hạn
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Biên một giây trước hết hạn.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Time BVA.
- **Tiền điều kiện**: Clock expiresAt - 1 giây, so sánh dùng cùng clock. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh bằng R0.
- **Kết quả mong đợi**: 200; cookie Max-Age=1; JWT expiresIn=900.
- **Hậu điều kiện**: Token mới giữ expiresAt cũ; không kéo dài phiên.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-012: Refresh khi account bị khóa
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh khi account bị khóa.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0/RB hợp lệ cùng account; Account chuyển LOCKED. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh bằng R0.
- **Kết quả mong đợi**: 403; message=Tài khoản bị khóa; data=null; xóa cookie.
- **Hậu điều kiện**: Mọi phiên của account bị revoked.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-013: Refresh khi account bị xóa
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh khi account bị xóa.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: R0 hợp lệ; Account đã bị xóa trong fixture. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh bằng R0.
- **Kết quả mong đợi**: 401; thông báo chung; xóa cookie.
- **Hậu điều kiện**: Phiên A revoked.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-014: Role mới lấy từ account hiện tại
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Role mới lấy từ account hiện tại.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Đổi account từ EMPLOYEE sang READER sau login. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh bằng R0.
- **Kết quả mong đợi**: 200; JWT mới có role=READER, sub đúng account.
- **Hậu điều kiện**: Không dùng role cũ hoặc role do client gửi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-015: Access JWT không thay refresh token
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Access JWT không thay refresh token.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Có access JWT hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh với cookie refreshToken=<access JWT>.
- **Kết quả mong đợi**: 401; xóa cookie.
- **Hậu điều kiện**: Không cấp token.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-016: Refresh token không dùng làm Bearer
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh token không dùng làm Bearer.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / Token confusion.
- **Tiền điều kiện**: Có R0 hợp lệ và endpoint yêu cầu JWT. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Gọi endpoint bảo vệ với Authorization: Bearer R0.
- **Kết quả mong đợi**: 401.
- **Hậu điều kiện**: R0 không bị rotate/thu hồi vì request này.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-017: Chặn object injection trong body refresh
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Chặn object injection trong body refresh.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / Injection.
- **Tiền điều kiện**: Phiên A hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh body {"refreshToken":{"$ne":null}} kèm cookie A.
- **Kết quả mong đợi**: 400; không Set-Cookie.
- **Hậu điều kiện**: Phiên A không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-018: Chặn refresh từ origin khác
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Chặn refresh từ origin khác.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: R0 hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh Origin=https://evil.example kèm R0.
- **Kết quả mong đợi**: 403; không Set-Cookie hoặc Access-Control-Allow-Origin cho origin lạ.
- **Hậu điều kiện**: R0 không bị dùng/thu hồi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-019: Chặn refresh thiếu Origin
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Chặn refresh thiếu Origin.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: R0 hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh không Origin.
- **Kết quả mong đợi**: 403; không Set-Cookie.
- **Hậu điều kiện**: R0 không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-020: Rollback rotation khi DB ghi lỗi
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Rollback rotation khi DB ghi lỗi.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Fault injection / Transaction.
- **Tiền điều kiện**: R0 hợp lệ; ép lỗi ghi giữa rotation. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh R0; phục hồi DB và thử lại.
- **Kết quả mong đợi**: Lần lỗi 503, không Set-Cookie/token; lần sau 200.
- **Hậu điều kiện**: Không mất R0 do rotation nửa chừng; không có orphan active token.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-021: Refresh không kéo dài hạn phiên
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh không kéo dài hạn phiên.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Time BVA.
- **Tiền điều kiện**: Login tại T0, expiresAt=T0+7 ngày; clock T0+1 ngày. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh R0.
- **Kết quả mong đợi**: 200; Max-Age=518400; expiresAt vẫn T0+7 ngày.
- **Hậu điều kiện**: Phiên không được gia hạn trượt.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-022: Refresh Origin null
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Refresh Origin null.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: R0 hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST refresh Origin: null.
- **Kết quả mong đợi**: 403; không Set-Cookie.
- **Hậu điều kiện**: R0 không đổi.
- **Trạng thái thực thi**: Not Run.

#### TC-REF-023: JWT bị từ chối tại exp
- **Yêu cầu / endpoint**: REQ-AUTH-04 · `POST /auth/refresh` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: JWT bị từ chối tại exp.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Time BVA.
- **Tiền điều kiện**: Có JWT được cấp; endpoint bảo vệ cho role này. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Đặt clock now=exp; gọi endpoint bằng JWT.
- **Kết quả mong đợi**: 401, kể cả chữ ký đúng.
- **Hậu điều kiện**: Không thay đổi refresh token.
- **Trạng thái thực thi**: Not Run.

### PHẦN V: Lưu phiên, cookie và tích hợp đăng nhập

#### TC-SES-001: Cookie login có thuộc tính bảo vệ
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Cookie login có thuộc tính bảo vệ.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / Cookie.
- **Tiền điều kiện**: Account ACTIVE, đúng mật khẩu, môi trường HTTPS production. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: POST login với Origin hợp lệ.
- **Kết quả mong đợi**: 200; Set-Cookie refreshToken có HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth, Max-Age=604800; không Domain; Cache-Control=no-store.
- **Hậu điều kiện**: DB có tokenHash; frontend JS không đọc refresh cookie.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-002: DB chỉ lưu hash refresh token
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: DB chỉ lưu hash refresh token.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / Storage.
- **Tiền điều kiện**: Account ACTIVE; được phép kiểm tra DB test. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login; tính SHA-256 token từ cookie trong test runner và đối chiếu DB.
- **Kết quả mong đợi**: tokenHash khớp hash 64 hex, không bằng token gốc; sessionId, accountId, expiresAt, timestamps đúng.
- **Hậu điều kiện**: Không lưu raw token/access JWT trong DB/log/JSON.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-003: Hai lần login tạo hai phiên độc lập
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Hai lần login tạo hai phiên độc lập.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Cùng account ACTIVE; cookie jars A/B riêng. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login lần lượt trong A và B.
- **Kết quả mong đợi**: Cả hai 200; token và sessionId khác nhau.
- **Hậu điều kiện**: Cả hai phiên active; không ghi đè phiên trước.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-004: Login thất bại không tạo phiên
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Login thất bại không tạo phiên.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Origin hợp lệ, account có sẵn. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login sai mật khẩu.
- **Kết quả mong đợi**: 400 như hợp đồng cũ; không cấp refresh cookie/token.
- **Hậu điều kiện**: Không tạo bản ghi refresh_tokens.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-005: Login không cấp token khi lưu phiên thất bại
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Login không cấp token khi lưu phiên thất bại.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / State Transition.
- **Tiền điều kiện**: Mô phỏng lỗi DB khi tạo refresh token sau kiểm tra mật khẩu. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login đúng thông tin.
- **Kết quả mong đợi**: 503; data=null; không Set-Cookie/token.
- **Hậu điều kiện**: Không có phiên mồ côi thành công giả.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-006: JWT mới có claims và hạn chính xác
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: JWT mới có claims và hạn chính xác.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / Contract.
- **Tiền điều kiện**: Account ACTIVE, Origin hợp lệ. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login; verify JWT bằng verifier tin cậy trong test backend.
- **Kết quả mong đợi**: HS256; sub/role đúng; iss=ctulib-api; aud=ctulib-web; exp-iat=900; jti không rỗng và duy nhất.
- **Hậu điều kiện**: Không đưa mật khẩu/hash vào JWT.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-007: Login từ origin khác bị từ chối
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Login từ origin khác bị từ chối.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: Account ACTIVE. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login đúng mật khẩu với Origin=https://evil.example.
- **Kết quả mong đợi**: 403; không Set-Cookie/token.
- **Hậu điều kiện**: Không tạo phiên.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-008: Login thiếu Origin bị từ chối
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Login thiếu Origin bị từ chối.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: Account ACTIVE. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login đúng mật khẩu nhưng không Origin.
- **Kết quả mong đợi**: 403; không Set-Cookie/token.
- **Hậu điều kiện**: Không tạo phiên.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-009: Login Origin null bị từ chối
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: Login Origin null bị từ chối.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Security / CSRF.
- **Tiền điều kiện**: Account ACTIVE. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Login đúng mật khẩu với Origin: null.
- **Kết quả mong đợi**: 403; không Set-Cookie/token.
- **Hậu điều kiện**: Không tạo phiên.
- **Trạng thái thực thi**: Not Run.

#### TC-SES-010: CORS cho origin frontend hợp lệ
- **Yêu cầu / endpoint**: REQ-AUTH-05 · `POST /auth/login` (TC-REF-016/023 gọi endpoint bảo vệ như nêu trong bước).
- **Mục tiêu**: CORS cho origin frontend hợp lệ.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: Integration / CORS.
- **Tiền điều kiện**: CLIENT_URL đã cấu hình, browser thực cùng site. Origin mặc định là CLIENT_URL, trừ case kiểm tra origin; cookie jar cô lập.
- **Dữ liệu / bước thực hiện**: Gửi preflight cho POST JSON từ CLIENT_URL, sau đó login với credentials: include.
- **Kết quả mong đợi**: Preflight thành công; Allow-Origin khớp chính xác; Allow-Credentials=true; browser nhận refresh cookie.
- **Hậu điều kiện**: Không wildcard; client giữ access token trong memory.
- **Trạng thái thực thi**: Not Run.

---

### PHẦN VI: Access JWT trên endpoint bảo vệ

Các ca này giữ lại coverage JWT thiếu/sai/giả mạo trước đây đặt ở logout; logout v3 dùng refresh cookie. Dùng GET /loans có yêu cầu Bearer, không dùng API sách công khai.

#### TC-JWT-001: API bảo vệ thiếu Authorization
- **Yêu cầu / điều kiện**: REQ-AUTH-06 / COND-JWT-01.
- **Mục tiêu**: API bảo vệ thiếu Authorization.
- **Endpoint**: `GET /loans`.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Security.
- **Tiền điều kiện / dữ liệu**: Tài khoản có quyền GET /loans; cookie jar rỗng. Token chỉ nằm trong fixture local của runner.
- **Bước thực hiện**: Không gửi Authorization.
- **Kết quả mong đợi**: HTTP 401, status=error, data=null; không truy cập dữ liệu bảo vệ.
- **Hậu điều kiện**: Không tạo, rotate hoặc thu hồi refresh token.
- **Trạng thái thực thi**: Not Run; xác minh token fixture đúng nguyên nhân cần kiểm tra.

#### TC-JWT-002: API bảo vệ thiếu tiền tố Bearer
- **Yêu cầu / điều kiện**: REQ-AUTH-06 / COND-JWT-01.
- **Mục tiêu**: API bảo vệ thiếu tiền tố Bearer.
- **Endpoint**: `GET /loans`.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Security.
- **Tiền điều kiện / dữ liệu**: fixtureAccessToken là JWT hợp lệ, chưa hết hạn. Token chỉ nằm trong fixture local của runner.
- **Bước thực hiện**: Gửi Authorization chứa token trực tiếp, không có Bearer.
- **Kết quả mong đợi**: HTTP 401, status=error, data=null; không truy cập dữ liệu bảo vệ.
- **Hậu điều kiện**: Không tạo, rotate hoặc thu hồi refresh token.
- **Trạng thái thực thi**: Not Run; xác minh token fixture đúng nguyên nhân cần kiểm tra.

#### TC-JWT-003: API bảo vệ từ chối chữ ký JWT bị sửa
- **Yêu cầu / điều kiện**: REQ-AUTH-06 / COND-JWT-01.
- **Mục tiêu**: API bảo vệ từ chối chữ ký JWT bị sửa.
- **Endpoint**: `GET /loans`.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Security.
- **Tiền điều kiện / dữ liệu**: JWT gốc hợp lệ; chỉ sửa một ký tự signature, giữ nguyên payload. Token chỉ nằm trong fixture local của runner.
- **Bước thực hiện**: Gửi Bearer token đã sửa signature.
- **Kết quả mong đợi**: HTTP 401, status=error, data=null; không truy cập dữ liệu bảo vệ.
- **Hậu điều kiện**: Không tạo, rotate hoặc thu hồi refresh token.
- **Trạng thái thực thi**: Not Run; xác minh token fixture đúng nguyên nhân cần kiểm tra.

#### TC-JWT-004: API bảo vệ từ chối thuật toán ngoài allowlist
- **Yêu cầu / điều kiện**: REQ-AUTH-06 / COND-JWT-01.
- **Mục tiêu**: API bảo vệ từ chối thuật toán ngoài allowlist.
- **Endpoint**: `GET /loans`.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Security.
- **Tiền điều kiện / dữ liệu**: Fixture JWT alg=none, exp còn hạn và các claims khác đúng. Token chỉ nằm trong fixture local của runner.
- **Bước thực hiện**: Gửi Bearer JWT alg=none.
- **Kết quả mong đợi**: HTTP 401, status=error, data=null; không truy cập dữ liệu bảo vệ.
- **Hậu điều kiện**: Không tạo, rotate hoặc thu hồi refresh token.
- **Trạng thái thực thi**: Not Run; xác minh token fixture đúng nguyên nhân cần kiểm tra.

#### TC-JWT-005: API bảo vệ từ chối issuer khác
- **Yêu cầu / điều kiện**: REQ-AUTH-06 / COND-JWT-01.
- **Mục tiêu**: API bảo vệ từ chối issuer khác.
- **Endpoint**: `GET /loans`.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Security.
- **Tiền điều kiện / dữ liệu**: Fixture JWT ký đúng key test HS256, chưa hết hạn, aud đúng nhưng iss khác ctulib-api. Token chỉ nằm trong fixture local của runner.
- **Bước thực hiện**: Gửi Bearer JWT sai issuer.
- **Kết quả mong đợi**: HTTP 401, status=error, data=null; không truy cập dữ liệu bảo vệ.
- **Hậu điều kiện**: Không tạo, rotate hoặc thu hồi refresh token.
- **Trạng thái thực thi**: Not Run; xác minh token fixture đúng nguyên nhân cần kiểm tra.

#### TC-JWT-006: API bảo vệ từ chối audience khác
- **Yêu cầu / điều kiện**: REQ-AUTH-06 / COND-JWT-01.
- **Mục tiêu**: API bảo vệ từ chối audience khác.
- **Endpoint**: `GET /loans`.
- **Priority / Risk**: High / High.
- **Kỹ thuật**: EP / Security.
- **Tiền điều kiện / dữ liệu**: Fixture JWT ký đúng key test HS256, chưa hết hạn, iss đúng nhưng aud khác ctulib-web. Token chỉ nằm trong fixture local của runner.
- **Bước thực hiện**: Gửi Bearer JWT sai audience.
- **Kết quả mong đợi**: HTTP 401, status=error, data=null; không truy cập dữ liệu bảo vệ.
- **Hậu điều kiện**: Không tạo, rotate hoặc thu hồi refresh token.
- **Trạng thái thực thi**: Not Run; xác minh token fixture đúng nguyên nhân cần kiểm tra.

---

## 4. MA TRẬN TRUY XUẤT NGUỒN GỐC (REQUIREMENTS TRACEABILITY MATRIX)

| Mã Yêu cầu | Endpoint API | Test Cases Tương Ứng (Atomic IDs) | Trạng thái bao phủ |
| :--- | :--- | :--- | :--- |
| **REQ-AUTH-01** (Đăng ký) | `POST /auth/register` | `TC-REG-001`, `TC-REG-002`, `TC-REG-003A-E`, `TC-REG-004`, `TC-REG-005A-D`, `TC-REG-006A-D`, `TC-REG-007A-D`, `TC-REG-008A-E`, `TC-REG-009`, `TC-REG-010`, `TC-REG-011`, `TC-REG-012A-B`, `TC-REG-013`, `TC-REG-014` | Thiết kế; chưa thực thi |
| **REQ-AUTH-02** (Đăng nhập) | `POST /auth/login` | `TC-LOG-001`, `TC-LOG-001B`, `TC-LOG-002`, `TC-LOG-003`, `TC-LOG-004`, `TC-LOG-005`, `TC-LOG-006`, `TC-LOG-006B`, `TC-LOG-007A-B`, `TC-LOG-008` | Thiết kế; chưa thực thi |
| **REQ-AUTH-03** (Đăng xuất) | `POST /auth/logout` | `TC-OUT-001–015` | Thiết kế, Not Run |
| **REQ-AUTH-04** (Refresh) | `POST /auth/refresh` và endpoint bảo vệ | `TC-REF-001–023` | Thiết kế, Not Run |
| **REQ-AUTH-05** (Phiên / cookie) | `POST /auth/login` | `TC-SES-001–010` | Thiết kế, Not Run |
| **REQ-AUTH-06** (Access JWT) | `GET /loans` | `TC-JWT-001–006`, `TC-REF-016`, `TC-REF-023` | Thiết kế, Not Run |

---

## 5. CHECKLIST CÁC THÔNG TIN DỰ ÁN CẦN CHỐT (CONTRACT CLARIFICATIONS CHECKLIST)

Để đội ngũ Backend (`apps/backend`) và QA thống nhất hoàn toàn khi triển khai mã nguồn, dưới đây là **5 quyết định thiết kế cần chốt**:

1. [x] **Token / Logout v3**: access JWT 15 phút + refresh cookie/DB hash, rotation, hạn phiên tuyệt đối 7 ngày; logout thu hồi phiên, không blacklist access JWT. Xem mục 0.
2. [x] **Quy tắc kiểm tra mật khẩu**: **ĐÃ CHỐT: Tối thiểu 8 ký tự** (Cho phép mọi ký tự hợp lệ, không ép buộc ký tự đặc biệt).
3. [x] **Định dạng `ctuIdentifier`**: **ĐÃ CHỐT: Chuẩn ĐH Cần Thơ** (Sinh viên `^B\d{7}$`, Cán bộ `^CB\d{5}$`, Admin `^ADMIN\d*$`).
4. [x] **Mã phản hồi HTTP khi trùng dữ liệu**: **ĐÃ CHỐT: HTTP 409 Conflict** (Chuẩn RESTful cho lỗi xung đột tài nguyên).
5. [ ] **Chính sách tự động khóa tài khoản khi nhập sai liên tiếp (Brute-force Policy)**:
   - Khóa tạm thời 15 phút sau 5 lần nhập sai liên tiếp?
   - Hay phiên bản này chỉ hỗ trợ khóa tài khoản thủ công qua cờ `status: "LOCKED"` do Admin thao tác?

## 6. Hướng dẫn chuyển đổi testware trên Apidog

- Thêm Origin={{clientOrigin}} cho mọi case login/refresh/logout, trừ case kiểm tra origin. Giữ `data.token` để các assertion JSONPath cũ vẫn tương thích.
- Thay toàn bộ TC-OUT-001–006 theo phiên bản v3; không giữ assertion Bearer bắt buộc cho logout. Thêm TC-OUT-007–015, TC-REF-001–023 và TC-SES-001–010.
- Sửa scenario auth smoke: login → lưu cookie và access token → gọi API bảo vệ → refresh → logout → refresh cũ bị từ chối. Không lưu raw token vào báo cáo.
- Module Authentication / Full System Test: thêm refresh và session cases, cập nhật dữ liệu cookie riêng từng test. Case DB/clock/race/browser cần fixture chuyên dụng, không đánh Passed chỉ từ assertion HTTP.
- Backend chưa triển khai hợp đồng mới; không chạy suite vào server hiện tại rồi diễn giải lỗi là hồi quy đã xác nhận.

### Cấu hình fixture cho các test case v3 trên Apidog

- `clientOrigin`: origin frontend chính xác, ví dụ `http://localhost:5173`; phải khớp CLIENT_URL. Không tự suy ra từ base URL API.
- `authFixtureId`: mã case đã chuẩn bị, ví dụ `TC-REF-001`. Preprocessor dừng request nếu mã này không khớp, tránh chạy nhầm fixture hoặc báo pass giả.
- `fixtureIdentifier`, `fixturePassword`: tài khoản tổng hợp trong DB test. `fixtureRefreshToken`, `fixtureAccessToken`: chỉ nạp vào biến tạm/local của test runner khi case yêu cầu; không lưu token thật vào cấu hình đồng bộ cloud hoặc tài liệu.
- Fixture chịu trách nhiệm làm sạch cookie jar, chuẩn bị trạng thái DB/clock và account theo từng ca. Test hai phiên dùng jar A/B riêng. Case clock/race/fault/browser/DB chưa được tự động hóa hoàn chỉnh: phải thực hiện các bước/hậu điều kiện trong tài liệu bằng runner phù hợp và ghi bằng chứng riêng.
- Assertion trên Apidog chỉ kiểm tra phần quan sát được qua HTTP/JSON/cookie. Một lần chạy HTTP xanh không đủ đánh Passed toàn bộ case nếu hậu điều kiện DB hoặc bước song song chưa được xác minh.
