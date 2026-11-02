# Dữ liệu cố định để kiểm thử đăng nhập

## Phạm vi

- `login-fixed-accounts.csv`: bốn tài khoản test cần chuẩn bị một lần trong database test.
- `login-fixed-cases.csv`: chín bộ đầu vào và kết quả mong đợi của POST /auth/login.
- Đây là credential dành riêng cho fixture test, không lấy từ tài khoản thật. Ngày 02/11/2026, cả bốn fixture đã được xác minh trên localhost:8080 và đánh dấu PREPARED. Trạng thái này chỉ áp dụng cho database đã xác minh, không mặc định áp dụng ở server khác.
- Không sinh mã, email hoặc mật khẩu ngẫu nhiên khi chạy đăng nhập. Không đăng ký lại trước mỗi lần chạy.

## Chuẩn bị tài khoản

1. Xác định cùng server và database test cho đăng ký và đăng nhập.
2. Kiểm tra các mã/email trong file tài khoản chưa thuộc dữ liệu khác. Nếu bị trùng dữ liệu có sẵn, không ghi đè; chọn bộ mã cố định khác và cập nhật đồng bộ hai CSV.
3. Tạo hai tài khoản `reader` và `locked` bằng POST /auth/register, gửi đúng ba trường ctuIdentifier, email, password trong CSV. Yêu cầu HTTP 201; HTTP 409 không chứng minh mật khẩu đang đúng.
4. Người quản lý dữ liệu test chuẩn bị `employee` và `admin` với đúng role, mật khẩu được bcrypt hash; đăng ký công khai luôn tạo READER nên không dùng đăng ký để xác nhận vai trò đặc quyền. Không tự thay đổi tài khoản thật.
5. Người quản lý dữ liệu test đặt riêng fixture `locked` thành isActive=false. Các fixture còn lại phải isActive=true. Trạng thái này không nằm trong body đăng ký.
6. Bảo đảm B9900099 không tồn tại để TC-LOG-005 kiểm tra đúng điều kiện.
7. Chỉ đổi preparationStatus sang PREPARED sau khi có bằng chứng chuẩn bị đúng dữ liệu. Case thiếu fixture để Blocked/Not Run, không đổi kết quả mong đợi để làm xanh.

## Dùng trong Apidog

### Nhóm đầy đủ 24 case

- Scenario `1969741` hiện mang tên **Đăng nhập - 24 case với tài khoản test cố định** và tham chiếu trực tiếp đủ 24 case của POST /auth/login. Cả 24 bước được chọn; Iterations=1, Threads=1, không dùng dataset 9 dòng để nhân số lượt chạy.
- Environment local đã gán loginIdentifier/loginPassword cho B9900001, employeeIdentifier/employeePassword cho CB99001, adminIdentifier/adminPassword cho ADMIN99001, lockedIdentifier/lockedPassword cho B9900002, clientOrigin=http://localhost:5173. Các case thường có preprocessor lấy các biến này và tạo input riêng (sai mật khẩu, chữ thường, tài khoản không tồn tại); không thay input NoSQL injection bằng credential hợp lệ.
- Body của tám case chờ (TC-SES-010B, TC-V3-LOGIN-001, TC-SES-009, TC-SES-008, TC-SES-007, TC-SES-002, TC-SES-003, TC-SES-005) dùng loginIdentifier/loginPassword thay tài khoản cũ hoặc biến fixture chưa gán. Giữ nguyên fixture gate và oracle browser/DB/fault/Origin/v3.
- Khi chạy nhóm endpoint sau cấu hình môi trường: 16 case hiện tại (15 case theo hợp đồng hiện tại cộng case độc giả cố định) Passed. Tám case còn lại có yêu cầu bằng chứng/triển khai ngoài việc tạo tài khoản; không coi HTTP 200 là Passed cho các case này. Kết quả chạy scenario cần đối chiếu báo cáo riêng.
- Đã đọc báo cáo scenario đủ 24 request: 16 Passed, 8 Failed, 0 UnTested; chi tiết và giới hạn kết luận tại `LOGIN_FIXED_RUN_RESULT.md`.

### Dataset 9 dòng để tham khảo các tổ hợp đăng nhập cơ bản

1. Tạo scenario riêng cho bộ dữ liệu cố định, tránh thay đổi các case đang có.
2. Thêm request POST /auth/login và chọn cùng environment/server đã chuẩn bị dữ liệu.
3. Dùng `login-fixed-cases.csv` làm dữ liệu chạy lặp, mỗi dòng một lượt. Ánh xạ hai cột caseLoginIdentifier và caseLoginPassword thành biến của lượt chạy tương ứng.
4. Body request:

```json
{
  "ctuIdentifier": "{{caseLoginIdentifier}}",
  "password": "{{caseLoginPassword}}"
}
```

5. Tắt các pre-processor random hoặc gán lại hai biến này trong request/scenario mới. Kiểm tra giá trị request thực tế đã khớp dòng CSV trước khi đánh giá kết quả; tránh biến local/environment cũ ghi đè dữ liệu.
6. Đối chiếu HTTP, status và message với expectedHttpStatus, expectedStatus, expectedMessage. HTTP 200 cần user.role và user.ctuIdentifier khớp expectedRole/expectedIdentifier; token không rỗng. HTTP 400/403 cần data=null, không cấp token/cookie mới.
7. Dùng cookie jar cô lập cho mỗi case. Có thể dùng các kiểm tra JWT/cookie hiện tại trong login-current.post-response.js, nhưng phải cấp LOGIN_CASE theo từng dòng; không dán script đó nguyên trạng khi chưa khai báo LOGIN_CASE.

## Ghi nhận kết quả

Giữ CSV đầu vào cố định. Ghi riêng caseId, thời gian, server/build, HTTP thực tế, status/message thực tế, kết quả Passed/Failed/Blocked và bằng chứng đã che token/cookie. Không sửa expected để khớp một response lỗi. JWT và accountId được sinh khi chạy nên kiểm tra cấu trúc/tính nhất quán, không so sánh nguyên token với giá trị cố định.

Các mật khẩu trong CSV chỉ dành cho fixture test riêng, không dùng cho tài khoản thật. Việc tạo file không tạo tài khoản hoặc thay đổi database.

## Kết quả chuẩn bị ngày 02/11/2026

- Đã tạo CB99001 (EMPLOYEE, isActive=true), ADMIN99001 (ADMIN, isActive=true), B9900002 (READER, isActive=false). Giữ nguyên B9900001 đã có và xác minh mật khẩu/role/trạng thái; không ghi đè tài khoản nào.
- Script `apps/backend/src/scripts/seed-login-test-accounts.ts` đối chiếu accountId của reader giữa API localhost:8080 và database trước khi tạo dữ liệu. Script từ chối tài khoản trùng nhưng khác thông tin, từ chối NODE_ENV=production, không in cấu hình kết nối hoặc token.
- Đã kiểm tra HTTP trực tiếp: ba tài khoản active trả 200 và đúng mã/role; tài khoản khóa đúng mật khẩu trả 403 với message `Tài khoản đã bị khóa`.
- Đã kiểm tra bốn trường hợp sai mật khẩu/không tồn tại trả 400, message `Sai thông tin đăng nhập`, data=null; mã reader viết thường đăng nhập 200 và trả mã chuẩn hóa.
- Đây là bằng chứng HTTP cơ bản của 9 dòng dữ liệu; chưa phải báo cáo chạy scenario Apidog hoặc kiểm chứng đầy đủ JWT, cookie, browser và session DB.
- Có thể chạy lại từ apps/backend bằng `pnpm exec tsx src/scripts/seed-login-test-accounts.ts`. Fixture đã đúng sẽ được giữ nguyên; fixture xung đột làm script dừng. Không cần chạy seed trước mỗi lượt test đăng nhập.
