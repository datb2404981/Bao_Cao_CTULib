# Bộ kiểm thử đăng nhập theo backend hiện tại

- Apidog project: `1405851`; endpoint: `46212848`.
- Suite chạy hiện tại: **Đăng nhập hiện tại — JWT 30 phút** (`7295`), 15 case.
- Suite riêng: **Đăng nhập — v3 và kiểm thử thủ công** (`7296`), 8 case, Not Run.

## Hợp đồng đang kiểm tra

- Thành công HTTP 200, message `Đăng nhập thành công, trả về Token và Thông tin user`.
- JSON `data: {token, tokenType: "Bearer", expiresIn: 1800, user: {accountId,ctuIdentifier,email,role}}`. Không yêu cầu fullName hoặc isActive.
- Access JWT HS256 có accountId, ctuIdentifier, role, iat, exp; exp-iat=1800. Decode chỉ kiểm tra cấu trúc/consistency, không chứng minh chữ ký hợp lệ.
- Refresh JWT qua cookie HttpOnly; SameSite=Lax; Path=/; Max-Age=604800; JWT refresh exp-iat=604800; Secure khi production HTTPS.
- Không có assertion no-store, issuer/audience/jti, opaque 43 ký tự hoặc Origin guard trong suite hiện tại. Giữ các yêu cầu v3 đó ở backlog, không thay kỳ vọng thành HTTP 200 để che thiếu triển khai.
- Sai tài khoản/mật khẩu: 400 và `Sai thông tin đăng nhập`; account bị khóa + đúng mật khẩu: 403 và `Tài khoản đã bị khóa`.
- NoSQL object input: 400, data là validation array chứa đúng hai field. Response 400 chấp nhận ErrorResponse hoặc ValidationErrorResponse.

## Fixture và phạm vi bằng chứng

- Các ca thường không yêu cầu authFixtureId. READER dùng loginIdentifier/loginPassword; EMPLOYEE dùng employeeIdentifier/employeePassword; ADMIN dùng adminIdentifier/adminPassword; account khóa dùng lockedIdentifier/lockedPassword. Phải có account phù hợp trong DB test. Không random thông tin login tới account không tồn tại, không tự tạo quyền ADMIN/EMPLOYEE.
- Giá trị mặc định READER trong Apidog lấy từ request mà người dùng đã xác nhận đăng nhập được; có thể ghi đè bằng environment. Không ghi credential thật vào báo cáo.
- clientOrigin mặc định cho local: http://localhost:5173, có thể ghi đè; phải khớp CLIENT_URL khi kiểm tra CORS headers.
- TC-SES-010 chỉ kiểm tra response headers CORS qua HTTP; TC-SES-010B dành riêng cho browser/preflight/credentials:include/cookie acceptance. Không coi HTTP xanh là bằng chứng browser đầy đủ.
- TC-SES-004 chỉ kiểm tra lỗi không cấp token/cookie qua HTTP, không tuyên bố DB không tạo record. Kiểm tra DB cần fixture/bằng chứng riêng.
- Các case DB/fault/multiple-session/Origin guard chưa sẵn sàng được gắn [chờ fixture/v3], category Other và loại khỏi Module Authentication/Full System Test đang chạy. Các gate fixture trong nhóm thủ công được giữ để tránh Passed giả.

## Các ca chạy hiện tại

| Case | Apidog ID |
| --- | --- |
| TC-SES-006: Access JWT khớp account và có hạn 1800 giây | `62499377` |
| TC-SES-010: Kiểm tra CORS response headers cho frontend (HTTP) | `62499495` |
| TC-SES-001: Cookie login có thuộc tính bảo vệ | `62499371` |
| TC-LOG-001B: Kiểm tra cấu trúc và claims JWT khi đăng nhập | `62491234` |
| TC-LOG-007B: MSSV không phân biệt chữ hoa/thường (Case Insensitivity) | `62448366` |
| TC-LOG-008: Chặn Bypass xác thực bằng NoSQL Object Injection | `62448367` |
| TC-SES-004: Login thất bại không cấp token/cookie (HTTP) | `62499374` |
| TC-LOG-003: Đăng nhập thành công với tài khoản Quản trị (ADMIN) | `62448359` |
| TC-LOG-006B: Tài khoản bị khóa nhưng nhập SAI mật khẩu (Chống leak password) | `62448364` |
| TC-LOG-006: Đăng nhập thất bại do tài khoản bị khóa (Đúng mật khẩu) | `62448362` |
| TC-LOG-002: Đăng nhập thành công với tài khoản Thủ thư (EMPLOYEE) | `62448358` |
| TC-LOG-001: Đăng nhập thành công với tài khoản Độc giả (READER) | `62448357` |
| TC-LOG-007A: Mật khẩu phân biệt chữ hoa/thường (Case Sensitivity) | `62448365` |
| TC-LOG-005: Đăng nhập thất bại do tài khoản không tồn tại (Chống Enumeration) | `62448361` |
| TC-LOG-004: Đăng nhập thất bại do sai mật khẩu | `62448360` |

## Kiểm tra đã thực hiện

- Validate JSON bằng CLI schema, kiểm tra cú pháp scripts.
- VM với response giả lập: 15 case chấp nhận response đúng; từ chối sai TTL, cookie 168 ngày, opaque token trong hợp đồng JWT, thiếu HttpOnly và lộ password.
- Đọc lại sau lưu trên Apidog. Không chạy request tới backend, không đánh Passed các ca chưa thực thi.
