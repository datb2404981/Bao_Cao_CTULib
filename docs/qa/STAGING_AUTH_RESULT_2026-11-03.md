# Kiểm thử authentication trên staging — 03/11/2026

## Kết quả

**42/42 nhóm kiểm tra HTTP đạt, 0 thất bại** trên backend staging thật. Đây là runner HTTP độc lập đối chiếu mã test case trong tài liệu Apidog của repository, không phải báo cáo chạy suite Apidog 7294 và không chứng minh toàn bộ module đạt.

- Backend: https://ctulib-api-staging.onrender.com
- Commit Render đã triển khai: `e69172efa71176feff47e531c489615d6c7fdae1`.
- Render báo Live, log kết nối Atlas thành công; `/health` trả 200.
- Origin kiểm tra: https://staging.bao-cao-ctulib.pages.dev
- Thời điểm runner (UTC): 2026-11-03T05:30:44.080Z
- Fixture: tạo READER mới qua register staging; không lưu mật khẩu, JWT hoặc refresh cookie. Account QA còn trong database; không xóa dữ liệu. Các phiên bổ sung do register/case-insensitive login có thể còn hiệu lực đến khi hết hạn; không tuyên bố đã dọn toàn bộ phiên.
- Mỗi dòng có thể chứa nhiều request/assertion. Không quy đổi 42 dòng thành 42 case suite Apidog đã Passed.

## Phạm vi đạt

Đăng ký thực sự và ghi DB; validation thiếu trường/kiểu dữ liệu/format/password; từ chối profile/role injection; trùng mã và email; login READER; JWT 900 giây, issuer/audience/jti/subject; cookie HttpOnly/Secure/SameSite=Strict/Path; no-store; CORS; mật khẩu sai; NoSQL injection; chuẩn hóa chữ thường; Origin thiếu/null/khác; thiếu cookie và sai cookie; refresh rotation và replay thu hồi phiên kế tiếp; logout thu hồi phiên và idempotency.

JWT chỉ được decode kiểm tra claims; không kiểm chứng chữ ký bằng secret. Kết quả login/refresh không thay thế kiểm tra DB nội bộ cho mọi invariant.

## Lỗi tích hợp frontend

- GET frontend staging: HTTP 200, HTML.
- POST `https://staging.bao-cao-ctulib.pages.dev/api/v1/auth/refresh`: HTTP **405**, chưa có reverse proxy API hoạt động.
- OPTIONS backend login với staging Origin: HTTP **204**, đúng Access-Control-Allow-Origin và Allow-Credentials=true.
- Pages Function proxy hiện mới ở working tree, chưa được triển khai. Chưa có browser E2E pass. Không đổi SameSite để che lỗi triển khai.

## Apidog và các ca chưa chạy

Suite 7294 mở được trong Apidog; UI hiển thị 85 test case và nhóm v3 cần fixture (43). Environment đang chọn Local Development Server (6926376). Đã thử soạn environment staging riêng nhưng chưa xác minh lưu thành công, chưa chạy suite; không sửa oracle để làm xanh. Notification đã tắt trong bản soạn suite, không gửi thông báo ra ngoài.

Chưa kiểm thử: fixture EMPLOYEE/ADMIN/locked, hết hạn theo clock, lỗi DB cưỡng bức, concurrency/race, toàn bộ suite và trình duyệt. Tài liệu LOGIN_CURRENT_CONTRACT.md chứa oracle cũ JWT 1800 giây/SameSite=Lax, trong khi commit đang deploy dùng JWT 900 giây/SameSite=Strict; cần phân biệt suite cũ và hợp đồng v3 trước khi đánh giá lỗi.

## Chi tiết runner HTTP

| Mã kiểm tra | Kết quả | Thời gian (ms) |
| --- | --- | --- |
| TC-REG-001 | PASS | 2125 |
| TC-REG-003A | PASS | 750 |
| TC-REG-003B | PASS | 288 |
| TC-REG-003C | PASS | 263 |
| TC-REG-003D | PASS | 354 |
| TC-REG-003E | PASS | 266 |
| TC-REG-004A | PASS | 283 |
| TC-REG-004B | PASS | 281 |
| TC-REG-005A | PASS | 257 |
| TC-REG-006A | PASS | 264 |
| TC-REG-006B | PASS | 257 |
| TC-REG-007A | PASS | 279 |
| TC-REG-008A | PASS | 352 |
| TC-REG-013 | PASS | 271 |
| TC-REG-011 | PASS | 260 |
| TC-REG-012A | PASS | 269 |
| TC-REG-009 | PASS | 489 |
| TC-REG-010 | PASS | 508 |
| TC-LOG-001 | PASS | 1380 |
| TC-LOG-001B-v3 | PASS | 1 |
| TC-SES-001-v3-cookie | PASS | 1 |
| TC-SES-010-CORS | PASS | 0 |
| TC-LOG-004 | PASS | 1015 |
| TC-LOG-008 | PASS | 255 |
| TC-LOG-007B | PASS | 1315 |
| origin-login-missing | PASS | 291 |
| origin-login-foreign | PASS | 259 |
| origin-login-null | PASS | 348 |
| origin-refresh-missing | PASS | 253 |
| origin-refresh-foreign | PASS | 264 |
| origin-refresh-null | PASS | 252 |
| origin-logout-missing | PASS | 462 |
| origin-logout-foreign | PASS | 304 |
| origin-logout-null | PASS | 268 |
| TC-REF-003 | PASS | 263 |
| TC-REF-004 | PASS | 259 |
| TC-REF-body-validation | PASS | 278 |
| TC-OUT-003 | PASS | 266 |
| TC-REF-001 | PASS | 1477 |
| TC-REF-008-replay | PASS | 1823 |
| TC-OUT-001 | PASS | 3158 |
| TC-OUT-002 | PASS | 952 |
