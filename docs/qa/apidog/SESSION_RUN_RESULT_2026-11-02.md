# Kết quả chạy refresh và logout ngày 02/11/2026

## Môi trường và phạm vi

- Backend CTULib chạy tại http://localhost:8080; llama-server đã chuyển sang 8082.
- Dùng code đang có trong working tree; không sửa backend hoặc assertion trong lần kiểm tra này.
- Scenario Apidog 1971050: 36 bước, Iterations=1, Threads=1, Local Development Server, không dataset.
- Đây là kiểm tra refresh/logout; không kết luận cho đăng ký, đăng nhập hoặc API nghiệp vụ khác.

## Kết quả trực tiếp trên Apidog

- Finished: 36; Passed: 0; Failed: 36; Untested: 0.
- Assertions Executed: 161; Failed: 90 (71 assertion đạt).
- Duration: 6.44 s; Response Time: 2.34 s; Average Response Time: 59 ms.
- TC-REF-003: HTTP 401, response khớp schema; ba assertion về HTTP 401, status error và không cấp access token đều đạt. Assertion xóa refresh cookie thất bại vì thiếu Set-Cookie.
- Đã mở Actual Request của TC-REF-003: POST http://localhost:8080/auth/refresh, Origin http://localhost:5173, Cookie rỗng, body rỗng. Không có refresh token chen vào request này trong lượt đã kiểm tra.
- TC-REF-004 và TC-REF-007 trả 401.
- TC-REF-017 (object injection) trả 200, không phải 400 theo oracle.
- TC-REF-018, TC-REF-019 và TC-REF-022 trả 200, không phải 403 theo oracle Origin guard.

## Kiểm tra HTTP độc lập

Chạy `node docs/qa/apidog/check-session-isolation.mjs http://localhost:8080` thành công hai lần. Lần thứ hai lưu tại `session-isolation-result.json`.

Mỗi lần có 13 kiểm tra đạt: 10 request thiếu cookie trả 401, 3 request dùng cookie hợp lệ trả 200 qua ba vòng login/refresh/logout. Script tự logout phiên fixture. Node fetch không dùng cookie jar tự động; kết quả này không thay thế kiểm chứng Apidog.

## Phân loại và giới hạn

- Backend hiện chưa đạt hợp đồng v3: refresh chưa rotate cookie, response hiện dùng expiresIn=1800; nhánh thiếu cookie không xóa cookie; Origin guard và validation body refresh chưa đáp ứng oracle.
- 19 case DB/clock/concurrency/rotation vẫn thiếu fixture chuyên biệt như liệt kê trong SESSION_FIXTURES.md. Dù runner ghi Failed, không được quy mọi lỗi của nhóm này thành lỗi backend; HTTP trùng kỳ vọng cũng không chứng minh điều kiện đã được chuẩn bị đúng.
- TC-REF-003 ở đầu scenario đã được kiểm tra Actual Request. Chưa chứng minh độ ổn định cookie jar với mọi thứ tự hoặc khi nhiều runner Apidog chạy đồng thời.
- Không thay assertion để làm xanh, không lưu token hoặc mật khẩu vào báo cáo.

## Việc cần sửa tiếp

1. Chốt hợp đồng expiresIn và cookie clearing, rồi triển khai đúng hợp đồng.
2. Bổ sung Origin guard và body validation cho refresh/logout theo oracle đã chốt.
3. Triển khai rotation/replay và fixture DB/clock/race còn thiếu.
4. Chạy lại scenario sau sửa; bổ sung kiểm chứng thiếu cookie sau các bước login/refresh trong chính Apidog.
