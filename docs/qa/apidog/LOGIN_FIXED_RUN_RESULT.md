# Kết quả đăng nhập với dữ liệu cố định

Ngày đối chiếu: 02/11/2026. Nguồn: báo cáo Apidog của scenario `1969741`, **Đăng nhập - 24 case với tài khoản test cố định**, environment Local Development Server, localhost:8080.

## Bằng chứng thực thi

- Completed; Total Requests=24; Passed=16; Failed=8; UnTested=0; Duration=4.90s.
- 1 iteration; 98 assertions, 20 assertions failed. Số assertion lỗi không đồng nghĩa số lỗi backend độc lập.
- Cả 24 bước tham chiếu case gốc; không lặp dataset 9 dòng. Bốn fixture đã chuẩn bị: B9900001 (READER active), CB99001 (EMPLOYEE active), ADMIN99001 (ADMIN active), B9900002 (READER locked).
- 16 case hiện tại Passed: case độc giả cố định; TC-LOG-001, 001B, 002, 003, 004, 005, 006, 006B, 007A, 007B, 008; TC-SES-001, 004, 006, 010.
- Báo cáo cũ của scenario dữ liệu cơ bản có 9 requests, 9 Passed. Báo cáo đó chỉ bao phủ các tổ hợp đăng nhập cơ bản, không thay thế nhóm 24 case.

## Phân tích tám case chưa đạt

| Case | Quan sát và giới hạn kết luận |
| --- | --- |
| TC-SES-010B | HTTP 200, còn gate yêu cầu bằng chứng preflight/credentials/cookie acceptance trong browser. Chưa đủ bằng chứng để kết luận chức năng browser đúng hoặc sai. |
| TC-V3-LOGIN-001 | HTTP 200 với đúng B9900001. Assertion báo expected 900 nhưng actual 1800 cho metadata và JWT lifetime; thiếu header phục vụ kiểm tra no-store; refresh cookie chứa JWT, không khớp mẫu opaque 43 ký tự. Đây là khác biệt hợp đồng v3 và triển khai hiện tại, không phải sai credential. Gate v3 vẫn giữ. |
| TC-SES-009 | Origin null: HTTP 200, trong khi oracle v3 mong bị từ chối. Gate fixture/v3 vẫn giữ; cần xác nhận yêu cầu Origin guard có thuộc phiên bản đang nghiệm thu không. |
| TC-SES-008 | Thiếu Origin: HTTP 200, trong khi oracle v3 mong bị từ chối. Không được đổi oracle sang 200 chỉ để Passed. |
| TC-SES-007 | Origin khác: HTTP 200, trong khi oracle v3 mong bị từ chối. CORS header không tự chứng minh server đã từ chối đăng nhập. |
| TC-SES-002 | HTTP 200; cần kiểm chứng DB chỉ lưu hash refresh token. HTTP thành công không chứng minh hậu điều kiện DB; giữ gate. |
| TC-SES-003 | HTTP 200; cần hai lần đăng nhập, cookie jars độc lập và bằng chứng hai phiên. Một request HTTP không đủ; giữ gate. |
| TC-SES-005 | Cần mô phỏng lỗi lưu phiên trước khi kỳ vọng 503/không cấp token. Tài khoản active cố định không thay thế fault fixture; chưa kết luận lỗi xử lý sự cố khi chưa tái hiện điều kiện này. |

## Kết luận trong phạm vi bằng chứng

Các lỗi đăng nhập ban đầu gồm dữ liệu random chưa đăng ký, tài khoản không đúng role/trạng thái và credential cũ không khớp. Sau sửa dữ liệu, 16 case theo hợp đồng hiện tại Passed. Không kết luận toàn bộ API không có lỗi: một số yêu cầu v3 khác triển khai hiện tại, còn các case browser/DB/fault thiếu bằng chứng riêng.

Không sửa backend hoặc nới assertion để làm xanh báo cáo. Không đặt authFixtureId chỉ nhằm vượt gate khi chưa có bằng chứng chuẩn bị điều kiện tương ứng. Báo cáo này không chứa token, cookie hoặc cấu hình kết nối database.
