# BỘ TÀI LIỆU THIẾT KẾ KIỂM THỬ QA (CHUẨN ISTQB CTFL & CONTRACT-DRIVEN)
## PHÂN HỆ: AUTHENTICATION (XÁC THỰC NGƯỜI DÙNG)
- **Dự án**: CTULib (Hệ thống Quản lý Thư viện Đại học Cần Thơ)
- **Tiêu chuẩn áp dụng**: ISTQB Certified Tester Foundation Level (CTFL v4.0)
- **Phương pháp tiếp cận**: Shift-Left, Contract-First Testing, Risk-based Testing
- **Tài liệu cơ sở (Test Basis)**: Đặc tả OpenAPI 3.0.3 / 3.1.0 (`CTULib API` - Apidog Project ID: `1405851`)
- **Ngày cập nhật**: 30/10/2026
- **Trạng thái**: Hoàn thiện phiên bản v2.0 (Khắc phục toàn diện các điểm mù và vi phạm tính nguyên tử)

---

## 1. PHẦN KIỂM THỬ TĨNH & CÁC GIẢ ĐỊNH HỢP ĐỒNG (STATIC TESTING FINDINGS & CONTRACT GATES)

Trước khi thực thi kiểm thử động (Dynamic Testing), theo nguyên lý **Shift-Left Testing của ISTQB**, các điểm bất cập trong tài liệu cơ sở (OpenAPI Contract) cần được ghi nhận và quản lý rủi ro:

| Mã phát hiện (Finding ID) | Vị trí đặc tả | Vấn đề phát hiện trong tài liệu hợp đồng | Rủi ro phát sinh | Đề xuất xử lý / Tiêu chuẩn kiểm thử |
| :--- | :--- | :--- | :--- | :--- |
| **ST-AUTH-01** | `POST /auth/logout` (Line 130) | Kiến trúc đã chốt: **Stateless JWT thuần túy**. Server không lưu Blacklist; client chịu trách nhiệm xóa token khỏi LocalStorage/Cookie sau khi nhận 200 OK. | Không kiểm thử server-side revocation (401) vì hệ thống không duy trì trạng thái phiên trên server. | Đã chuẩn hóa `TC-OUT-002`: Kiểm tra phía Client xóa token, còn Server chỉ trả về `200 OK` (Idempotent). |
| **ST-AUTH-02** | `RegisterRequest` | Schema OpenAPI thiếu `additionalProperties: false`, chưa khóa trường lạ. | Nguy cơ **Mass Assignment**: Hacker tiêm `"role": "ADMIN"` lúc đăng ký để leo thang đặc quyền. | Bổ sung `TC-REG-013` kiểm tra chống leo thang đặc quyền lúc đăng ký. |
| **ST-AUTH-03** | Apidog `_auth_register.json` | Example trường `phoneNumber: 901234567` (kiểu `number`, mất số 0), trong khi schema là `type: string`. | Lệch kiểu dữ liệu giữa mock example và schema validator. | Bắt buộc client gửi chuỗi định dạng số di động có số 0 ở đầu (`"0901234567"`). |
| **ST-AUTH-04** | `POST /auth/register` (400) | Response `400` chỉ khai báo `ValidationErrorResponse` (data dạng mảng `[{field, message}]`). Chưa quy định rõ lỗi trùng dữ liệu (Unique constraint). | Trùng `ctuIdentifier`/`email` sẽ trả về `ValidationErrorResponse` hay `ErrorResponse` (hoặc chuẩn RESTful `409 Conflict`)? | Kiểm tra tính nhất quán: Bắt buộc trả về đúng cấu trúc JSON thông báo trường bị trùng lặp, không được trả về `500`. |
| **ST-AUTH-05** | `dateOfBirth` | Ràng buộc *"trước ngày hiện tại"* phụ thuộc vào múi giờ (Timezone). | Chênh lệch giữa server UTC và client `+07:00` (Việt Nam) lúc nửa đêm có thể gây lỗi xác thực sai lệch. | Kiểm tra dynamic boundary tính theo múi giờ hệ thống `+07:00`. |

---

## 2. BẢNG PHÂN TÍCH ĐIỀU KIỆN KIỂM THỬ (TEST CONDITIONS)

| Mã ĐK | Endpoint | Kỹ thuật ISTQB | Mục tiêu điều kiện kiểm thử |
| :--- | :--- | :--- | :--- |
| **COND-REG-01** | `POST /auth/register` | Use Case / Happy Path | Đăng ký thành công (đủ trường hoặc chỉ trường bắt buộc). |
| **COND-REG-02** | `POST /auth/register` | Equivalence Partitioning (EP) | Bắt lỗi thiếu từng trường bắt buộc theo schema. |
| **COND-REG-03** | `POST /auth/register` | EP / BVA | Xác thực định dạng và độ dài của `ctuIdentifier` (MSSV/MSCB). |
| **COND-REG-04** | `POST /auth/register` | EP / BVA | Xác thực định dạng email hợp lệ / không hợp lệ theo RFC 5322. |
| **COND-REG-05** | `POST /auth/register` | EP / BVA | Xác thực độ mạnh và độ dài mật khẩu `password`. |
| **COND-REG-06** | `POST /auth/register` | EP / BVA | Xác thực định dạng số điện thoại `phoneNumber`. |
| **COND-REG-07** | `POST /auth/register` | BVA (Timezone aware) | Kiểm tra ngày sinh `dateOfBirth` trước ngày hiện tại (múi giờ +07:00). |
| **COND-REG-08** | `POST /auth/register` | Decision Table / Conflict | Xử lý trùng lặp `ctuIdentifier` hoặc `email`. |
| **COND-REG-09** | `POST /auth/register` | Security / Mass Assignment | Ngăn chặn leo thang quyền hạn bằng cách tiêm `"role": "ADMIN"`. |
| **COND-REG-10** | `POST /auth/register` | Concurrency / Race Condition | Hai request đăng ký cùng MSSV đồng thời không làm crash server (không lỗi 500). |
| **COND-REG-11** | `POST /auth/register` | Security / Injection | Phòng thủ XSS và NoSQL/SQL Injection trong form đăng ký. |
| **COND-LOG-01** | `POST /auth/login` | Use Case / Token Verification | Đăng nhập thành công và giải mã JWT Claims (`sub`, `role`, `exp`). |
| **COND-LOG-02** | `POST /auth/login` | Decision Table | Xử lý sai tài khoản hoặc sai mật khẩu (HTTP 400, chống user enumeration). |
| **COND-LOG-03** | `POST /auth/login` | State Transition / Security | Xử lý tài khoản bị khóa `LOCKED` (HTTP 403, chống rò rỉ mật khẩu). |
| **COND-LOG-04** | `POST /auth/login` | EP / BVA | Chuẩn hóa chữ hoa/chữ thường và loại bỏ khoảng trắng thừa. |
| **COND-LOG-05** | `POST /auth/login` | Security / Injection | Chặn Bypass xác thực bằng NoSQL Object Injection (`$ne`, `$gt`). |
| **COND-OUT-01** | `POST /auth/logout` | Use Case | Đăng xuất thành công với Bearer Token hợp lệ. |
| **COND-OUT-02** | `POST /auth/logout` | State Transition / Security | Thu hồi phiên / Blacklist token sau khi đăng xuất. |
| **COND-OUT-03** | `POST /auth/logout` | EP / Negative | Xử lý token thiếu, sai định dạng, hết hạn hoặc giả mạo signature. |

---

## 3. DANH SÁCH CA KIỂM THỬ NGUYÊN TỬ (ATOMIC TEST CASES)

> **Nguyên tắc thiết kế ISTQB**: Mỗi ca kiểm thử dưới đây là **nguyên tử (Atomic)**: 1 dữ liệu đầu vào $\rightarrow$ 1 luồng thực thi $\rightarrow$ 1 kết quả mong đợi duy nhất. Không gộp chung luồng Pass và Fail.

### PHẦN I: `POST /auth/register` (ĐĂNG KÝ TÀI KHOẢN ĐỘC GIẢ)

#### TC-REG-001: Đăng ký thành công với đầy đủ thông tin hợp lệ
- **ID**: `TC-REG-001`
- **Mục tiêu**: Đăng ký thành công tài khoản mới với tất cả các trường hợp lệ (bắt buộc + tùy chọn).
- **Kỹ thuật**: Use Case Testing | **Priority**: High | **Risk**: High
- **Tiền điều kiện**: `ctuIdentifier` "B2404981" và `email` "datb2404981@student.ctu.edu.vn" chưa tồn tại. Mã khoa `64f1b2c3e4b0a1a2b3c4d5e7` tồn tại trong hệ thống.
- **Payload kiểm thử**:
  ```json
  {
    "ctuIdentifier": "B2404981",
    "email": "datb2404981@student.ctu.edu.vn",
    "password": "StrongPassword123!",
    "fullName": "Nguyễn Văn Đạt",
    "phoneNumber": "0901234567",
    "dateOfBirth": "2004-05-15",
    "address": "Khu II, ĐH Cần Thơ",
    "facultyId": "64f1b2c3e4b0a1a2b3c4d5e7"
  }
  ```
- **Kết quả mong đợi**:
  - HTTP `201 Created`
  - Body:
    ```json
    {
      "status": "success",
      "message": "Đăng ký thành công",
      "data": null
    }
    ```
  - **Hậu điều kiện**: Bản ghi độc giả được lưu vào DB với vai trò mặc định `READER`, mật khẩu được băm an toàn (`bcrypt`), không lưu plain-text.

---

#### TC-REG-002: Đăng ký thành công chỉ với các trường bắt buộc (Không gửi optional fields)
- **ID**: `TC-REG-002`
- **Mục tiêu**: Xác nhận hệ thống chấp nhận đăng ký khi không gửi `dateOfBirth`, `address`, `facultyId`.
- **Kỹ thuật**: Boundary Value Analysis | **Priority**: High | **Risk**: Medium
- **Tiền điều kiện**: `ctuIdentifier` "B2404982" và `email` "mai.b2404982@student.ctu.edu.vn" chưa tồn tại.
- **Payload kiểm thử**:
  ```json
  {
    "ctuIdentifier": "B2404982",
    "email": "mai.b2404982@student.ctu.edu.vn",
    "password": "StrongPassword123!",
    "fullName": "Trần Thị Mai",
    "phoneNumber": "0912345678"
  }
  ```
- **Kết quả mong đợi**: HTTP `201 Created`, `status: "success"`.

---

#### TC-REG-003: Bắt lỗi validation khi thiếu từng trường bắt buộc
- **Nhóm ca kiểm thử**: `TC-REG-003A` đến `TC-REG-003E`
- **Kỹ thuật**: Equivalence Partitioning (Negative) | **Priority**: High | **Risk**: High
- **Bảng ca kiểm thử nguyên tử**:

| Test Case ID | Trường bị thiếu trong Payload | Kết quả mong đợi (HTTP & Schema) |
| :--- | :--- | :--- |
| **TC-REG-003A** | Thiếu `ctuIdentifier` | HTTP `400 Bad Request`, `data` chứa item có `field: "ctuIdentifier"` |
| **TC-REG-003B** | Thiếu `email` | HTTP `400 Bad Request`, `data` chứa item có `field: "email"` |
| **TC-REG-003C** | Thiếu `password` | HTTP `400 Bad Request`, `data` chứa item có `field: "password"` |
| **TC-REG-003D** | Thiếu `fullName` | HTTP `400 Bad Request`, `data` chứa item có `field: "fullName"` |
| **TC-REG-003E** | Thiếu `phoneNumber` | HTTP `400 Bad Request`, `data` chứa item có `field: "phoneNumber"` |

---

#### TC-REG-004: Xác thực định dạng mã định danh `ctuIdentifier` theo chuẩn CTU
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-REG-004A (Rỗng hoặc khoảng trắng)**: Gửi `"ctuIdentifier": "    "` $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-004B (Sai định dạng CTU)**: Gửi `"ctuIdentifier": "K123456"` (không bắt đầu bằng B hoặc CB) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-004C (Sai độ dài MSSV)**: Gửi `"ctuIdentifier": "B240498"` (chỉ có 6 số thay vì 7 số) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-004D (Hợp lệ chuẩn CTU)**: Gửi `"ctuIdentifier": "B2404981"` $\rightarrow$ HTTP `201 Created`.

---

#### TC-REG-005: Từ chối đăng ký khi email sai định dạng RFC 5322
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-REG-005A**: Gửi email thiếu ký tự `@` (`"datb2404981student.ctu.edu.vn"`) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-005B**: Gửi email thiếu domain (`"datb2404981@"`) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-005C**: Gửi email thiếu username (`"@student.ctu.edu.vn"`) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-005D**: Gửi email chứa khoảng trắng (`"dat b2404981@student.ctu.edu.vn"`) $\rightarrow$ HTTP `400 Bad Request`.
- **Kết quả mong đợi chung**: HTTP `400 Bad Request`, `field: "email"`, thông báo "Email không đúng định dạng".

---

#### TC-REG-006: Kiểm tra chính sách độ an toàn mật khẩu (Password Policy)
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-REG-006A (Biên dưới không hợp lệ)**: Gửi mật khẩu rỗng `""` $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-006B (Dưới ngưỡng biên 8 ký tự)**: Gửi mật khẩu độ dài 7 ký tự (`"1234567"`) $\rightarrow$ HTTP `400 Bad Request` (Chính sách: Mật khẩu tối thiểu 8 ký tự).
  - **TC-REG-006C (Tại điểm biên hợp lệ)**: Gửi mật khẩu đúng 8 ký tự (`"12345678"`) $\rightarrow$ HTTP `201 Created` (Không bắt buộc ký tự đặc biệt).
  - **TC-REG-006D (Biên trên hợp lệ)**: Gửi mật khẩu độ dài 128 ký tự $\rightarrow$ HTTP `201 Created`.

---

#### TC-REG-007: Xác thực số điện thoại di động Việt Nam (`phoneNumber`)
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-REG-007A (Thiếu chữ số)**: Gửi `"phoneNumber": "090123456"` (9 số) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-007B (Thừa chữ số)**: Gửi `"phoneNumber": "090123456789"` (12 số) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-007C (Chứa chữ cái)**: Gửi `"phoneNumber": "0901234abc"` $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-007D (Đầu số chuẩn 10 số hợp lệ)**: Gửi `"phoneNumber": "0901234567"` $\rightarrow$ HTTP `201 Created`.

---

#### TC-REG-008: Kiểm tra quy tắc ngày sinh `dateOfBirth` theo múi giờ (+07:00)
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-REG-008A (Ngày tương lai)**: Gửi `dateOfBirth` lớn hơn ngày hiện tại $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-008B (Ngày hiện tại - Boundary)**: Gửi `dateOfBirth` bằng chính ngày hôm nay (tính theo giờ VN +07:00) $\rightarrow$ HTTP `400 Bad Request` (Đặc tả: *"phải trước ngày hiện tại"*).
  - **TC-REG-008C (Ngày hôm qua - Boundary hợp lệ)**: Gửi `dateOfBirth` là ngày hôm qua $\rightarrow$ Hợp lệ về mặt kỹ thuật trường date.
  - **TC-REG-008D (Sai định dạng ISO)**: Gửi `dateOfBirth: "15/05/2004"` (định dạng DD/MM/YYYY) $\rightarrow$ HTTP `400 Bad Request`.
  - **TC-REG-008E (Ngày không tồn tại)**: Gửi `dateOfBirth: "2023-02-29"` (năm không nhuận) $\rightarrow$ HTTP `400 Bad Request`.

---

#### TC-REG-009: Đăng ký thất bại do trùng lặp `ctuIdentifier` (HTTP 409 Conflict)
- **ID**: `TC-REG-009`
- **Mục tiêu**: Kiểm tra tính duy nhất (Uniqueness) của mã định danh trường.
- **Tiền điều kiện**: Tài khoản `ctuIdentifier: "B2404981"` đã tồn tại trong DB.
- **Payload**: Gửi payload đăng ký với `ctuIdentifier: "B2404981"` và email mới chưa dùng.
- **Kết quả mong đợi**:
  - HTTP `409 Conflict` (Chuẩn RESTful về xung đột tài nguyên đã tồn tại)
  - Body trả về cấu trúc lỗi rõ ràng: thông báo trùng lặp tại trường `ctuIdentifier`.
  - Không tạo thêm tài khoản mới trong cơ sở dữ liệu.

---

#### TC-REG-010: Đăng ký thất bại do trùng lặp `email` (HTTP 409 Conflict)
- **ID**: `TC-REG-010`
- **Mục tiêu**: Kiểm tra tính duy nhất của email người dùng.
- **Tiền điều kiện**: Email `reader@example.com` đã được liên kết với một tài khoản độc giả khác.
- **Payload**: Gửi `ctuIdentifier` mới nhưng `email: "reader@example.com"`.
- **Kết quả mong đợi**: HTTP `409 Conflict`, thông báo lỗi email đã được sử dụng.

---

#### TC-REG-011: Đăng ký thất bại khi `facultyId` không tồn tại
- **ID**: `TC-REG-011`
- **Mục tiêu**: Xác thực tính toàn vẹn khóa ngoại tham chiếu đến bảng Khoa/Viện.
- **Payload**: `"facultyId": "000000000000000000000000"` (Cú pháp ObjectId hợp lệ nhưng không có trong DB).
- **Kết quả mong đợi**: HTTP `400 Bad Request`, thông báo mã khoa không tồn tại.

---

#### TC-REG-012: Kiểm tra chống tấn công XSS và Injection trong form đăng ký
- **Nhóm ca kiểm thử nguyên tử**:
  - **TC-REG-012A (Stored XSS)**: Gửi `fullName: "<script>alert('xss')</script> Nguyễn Văn An"` $\rightarrow$ Backend phải sanitize mã độc hoặc encode HTML entities khi lưu trữ; không làm hỏng phản hồi JSON.
  - **TC-REG-012B (SQL/NoSQL Injection)**: Gửi `ctuIdentifier: "B2404981' OR '1'='1"` $\rightarrow$ Hệ thống xử lý an toàn dưới dạng chuỗi thuần túy, không gây lỗi cú pháp DB.

---

#### TC-REG-013: Phòng thủ tấn công leo thang quyền hạn (Mass Assignment Defense)
- **ID**: `TC-REG-013`
- **Mục tiêu**: Đảm bảo khách vãng lai không thể tự cấp quyền `ADMIN` hoặc thay đổi trạng thái khi đăng ký.
- **Kỹ thuật**: Security / Adversarial Testing | **Priority**: Critical | **Risk**: Critical
- **Payload kiểm thử**:
  ```json
  {
    "ctuIdentifier": "B2404990",
    "email": "hacker@student.ctu.edu.vn",
    "password": "StrongPassword123!",
    "fullName": "Kẻ Tấn Công",
    "phoneNumber": "0909999999",
    "role": "ADMIN",
    "status": "ACTIVE",
    "permissions": ["MANAGE_BOOKS", "SUPER_ADMIN"]
  }
  ```
- **Kết quả mong đợi**:
  - Cách 1 (Khuyến nghị): HTTP `400 Bad Request` nếu backend cấu hình strict schema (`additionalProperties: false`).
  - Cách 2: HTTP `201 Created` NHƯNG trong cơ sở dữ liệu, tài khoản mới tạo **bắt buộc chỉ có `role: "READER"`**, các trường `role`, `status`, `permissions` bị filter bỏ hoàn toàn.

---

#### TC-REG-014: Kiểm tra Race Condition khi gửi đồng thời 2 request đăng ký cùng MSSV
- **ID**: `TC-REG-014`
- **Mục tiêu**: Kiểm tra tính bất biến (Concurrency Integrity) khi có 2 request đăng ký cùng `ctuIdentifier: "B2404991"` trong cùng 1 mili-giây.
- **Kỹ thuật**: Concurrency / Non-functional Testing | **Priority**: High | **Risk**: High
- **Hành động**: Dùng kịch bản tự động bắn 2 request đồng thời.
- **Kết quả mong đợi**:
  - Chính xác 1 request thành công (`201 Created`).
  - Request còn lại nhận về HTTP `409 Conflict`.
  - **Tuyệt đối không được xảy ra mã lỗi `500 Internal Server Error`** do unhandled Mongo `E11000 duplicate key error`.

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
  - Body: `status: "success"`, `message: "Đăng nhập thành công, trả về Token và thông tin user"`
  - `data.token`: Chuỗi JWT hợp lệ.
  - `data.user`: Chứa `accountId`, `ctuIdentifier: "B2404981"`, `role: "READER"`, `fullName`.

---

#### TC-LOG-001B: Kiểm tra tính hợp lệ của JWT Claims (Token Contract Verification)
- **ID**: `TC-LOG-001B`
- **Mục tiêu**: Giải mã token nhận được từ `TC-LOG-001` để xác minh nội dung payload.
- **Kỹ thuật**: Security / Contract Testing | **Priority**: High | **Risk**: High
- **Hành động**: Decode chuỗi JWT nhận được từ phản hồi đăng nhập.
- **Kết quả mong đợi**:
  - Header: Thuật toán ký `alg: "HS256"` (hoặc `RS256`), `typ: "JWT"`.
  - Payload:
    - `sub` hoặc `accountId`: Khớp chính xác với `data.user.accountId`.
    - `role`: `"READER"`.
    - `iat` (Issued At): Timestamp hợp lệ tại thời điểm tạo.
    - `exp` (Expiration): Thời điểm hết hạn lớn hơn `iat` (ví dụ: `exp - iat = 86400s` cho token 1 ngày).

---

#### TC-LOG-002: Đăng nhập thành công với tài khoản Thủ thư (`EMPLOYEE`)
- **ID**: `TC-LOG-002`
- **Mục tiêu**: Kiểm tra đăng nhập phân quyền cho nhân viên thư viện.
- **Kết quả mong đợi**: HTTP `200 OK`, `data.user.role: "EMPLOYEE"`.

---

#### TC-LOG-003: Đăng nhập thành công với tài khoản Quản trị (`ADMIN`)
- **ID**: `TC-LOG-003`
- **Mục tiêu**: Kiểm tra đăng nhập cho quản trị viên hệ thống.
- **Kết quả mong đợi**: HTTP `200 OK`, `data.user.role: "ADMIN"`.

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

### PHẦN III: `POST /auth/logout` (ĐĂNG XUẤT HỆ THỐNG)

#### TC-OUT-001: Đăng xuất thành công với Token hợp lệ
- **ID**: `TC-OUT-001`
- **Mục tiêu**: Đăng xuất thành công với token còn hạn.
- **Header**: `Authorization: Bearer <valid_token>`
- **Kết quả mong đợi**:
  - HTTP `200 OK`
  - Body: `status: "success"`, `message: "Đăng xuất thành công"`, `data: null`.

---

#### TC-OUT-002: Kiểm tra tính lũy thừa (Idempotency) và xóa token Client-side (Stateless Logout)
- **ID**: `TC-OUT-002`
- **Mục tiêu**: Xác nhận kiến trúc Stateless JWT: server luôn trả về 200 OK khi có token hợp lệ, client chịu trách nhiệm xóa token khỏi bộ nhớ để chấm dứt phiên.
- **Kỹ thuật**: State Transition & Idempotency Testing | **Priority**: High | **Risk**: Medium
- **Các bước thực hiện**:
  1. Gửi `POST /auth/logout` với token hợp lệ $T_1$ $\rightarrow$ Nhận `200 OK`.
  2. Gửi tiếp lần 2 với cùng token $T_1$.
- **Kết quả mong đợi**:
  - Phía Client: Token $T_1$ được dọn sạch khỏi LocalStorage/Cookie, người dùng được chuyển hướng về trang Login.
  - Phía Server: Trả về HTTP `200 OK` (Thao tác logout an toàn và có tính lũy thừa, không phát sinh lỗi).

---

#### TC-OUT-003: Đăng xuất thất bại khi thiếu Authorization Header
- **ID**: `TC-OUT-003`
- **Mục tiêu**: Từ chối request không có header xác thực.
- **Header**: Không gửi header `Authorization`.
- **Kết quả mong đợi**: HTTP `401 Unauthorized`, `message: "Thiếu hoặc sai thông tin xác thực, token hết hạn."`.

---

#### TC-OUT-004: Đăng xuất thất bại với Token đã hết hạn (Expired Token)
- **ID**: `TC-OUT-004`
- **Mục tiêu**: Xử lý token quá hạn.
- **Header**: `Authorization: Bearer <expired_token>`
- **Kết quả mong đợi**: HTTP `401 Unauthorized`.

---

#### TC-OUT-005: Đăng xuất thất bại với Token có chữ ký giả mạo (Invalid Signature)
- **ID**: `TC-OUT-005`
- **Mục tiêu**: Kiểm tra kiểm tra tính toàn vẹn chữ ký mật mã.
- **Header**: `Authorization: Bearer <token_bị_sửa_payload_hoặc_signature>`
- **Kết quả mong đợi**: HTTP `401 Unauthorized`.

---

#### TC-OUT-006: Đăng xuất thất bại khi Header không có tiền tố `Bearer`
- **ID**: `TC-OUT-006`
- **Mục tiêu**: Kiểm tra bắt buộc tiền tố `Bearer ` theo chuẩn RFC 6750.
- **Header**: `Authorization: <token_không_có_chữ_Bearer>`
- **Kết quả mong đợi**: HTTP `401 Unauthorized`.

---

## 4. MA TRẬN TRUY XUẤT NGUỒN GỐC (REQUIREMENTS TRACEABILITY MATRIX)

| Mã Yêu cầu | Endpoint API | Test Cases Tương Ứng (Atomic IDs) | Trạng thái bao phủ |
| :--- | :--- | :--- | :--- |
| **REQ-AUTH-01** (Đăng ký) | `POST /auth/register` | `TC-REG-001`, `TC-REG-002`, `TC-REG-003A-E`, `TC-REG-004`, `TC-REG-005A-D`, `TC-REG-006A-D`, `TC-REG-007A-D`, `TC-REG-008A-E`, `TC-REG-009`, `TC-REG-010`, `TC-REG-011`, `TC-REG-012A-B`, `TC-REG-013`, `TC-REG-014` | 100% Functional & Security |
| **REQ-AUTH-02** (Đăng nhập) | `POST /auth/login` | `TC-LOG-001`, `TC-LOG-001B`, `TC-LOG-002`, `TC-LOG-003`, `TC-LOG-004`, `TC-LOG-005`, `TC-LOG-006`, `TC-LOG-006B`, `TC-LOG-007A-B`, `TC-LOG-008` | 100% Functional & Security |
| **REQ-AUTH-03** (Đăng xuất) | `POST /auth/logout` | `TC-OUT-001`, `TC-OUT-002`, `TC-OUT-003`, `TC-OUT-004`, `TC-OUT-005`, `TC-OUT-006` | 100% Token Lifecycle |

---

## 5. CHECKLIST CÁC THÔNG TIN DỰ ÁN CẦN CHỐT (CONTRACT CLARIFICATIONS CHECKLIST)

Để đội ngũ Backend (`apps/backend`) và QA thống nhất hoàn toàn khi triển khai mã nguồn, dưới đây là **5 quyết định thiết kế cần chốt**:

1. [x] **Cơ chế Logout**: **ĐÃ CHỐT: Stateless JWT thuần túy** (Server trả 200 OK, Client tự hủy token).
2. [x] **Quy tắc kiểm tra mật khẩu**: **ĐÃ CHỐT: Tối thiểu 8 ký tự** (Cho phép mọi ký tự hợp lệ, không ép buộc ký tự đặc biệt).
3. [x] **Định dạng `ctuIdentifier`**: **ĐÃ CHỐT: Chuẩn ĐH Cần Thơ** (Sinh viên `^B\d{7}$`, Cán bộ `^CB\d{5}$`, Admin `^ADMIN\d*$`).
4. [x] **Mã phản hồi HTTP khi trùng dữ liệu**: **ĐÃ CHỐT: HTTP 409 Conflict** (Chuẩn RESTful cho lỗi xung đột tài nguyên).
5. [ ] **Chính sách tự động khóa tài khoản khi nhập sai liên tiếp (Brute-force Policy)**:
   - Khóa tạm thời 15 phút sau 5 lần nhập sai liên tiếp?
   - Hay phiên bản này chỉ hỗ trợ khóa tài khoản thủ công qua cờ `status: "LOCKED"` do Admin thao tác?
