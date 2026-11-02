# Fixture kiểm thử refresh và đăng xuất

## Cập nhật sau khi backend chuyển sang v3

- Đã lưu Base URL của môi trường Local Development Server đang dùng thành `http://localhost:8080/api/v1`. Các path kế thừa `/auth/*` trên Apidog được ghép thành `/api/v1/auth/*`; không thêm prefix lần nữa vào path khi dùng môi trường này. Base URL áp dụng cho cả module trong môi trường đã chọn.
- Đã cập nhật đủ 17 preprocessor fixture HTTP: login/logout phụ gọi `/api/v1/auth/*` và gửi Origin hợp lệ; request chính vẫn giữ Origin đặc biệt theo từng case. Không thay assertion hoặc bỏ gate.
- Chạy lại scenario 1971050: 36 Finished, 17 Passed, 19 Failed; 161 assertions, 29 Failed; duration 7.45 s, Iterations=1, Threads=1. 17 case có fixture HTTP đều Passed.
- Actual Request của TC-REF-003 đã xác minh là `POST http://localhost:8080/api/v1/auth/refresh`, Cookie rỗng, Origin hợp lệ, trả 401 và đạt bốn assertion.
- TC-REF-005 vẫn Failed vì preprocessor yêu cầu fixture đúng case, dù HTTP 401 và các assertion response đạt. 19 case còn lại vẫn cần fixture chuyên biệt; kết quả HTTP riêng lẻ không chứng minh DB/clock/race/replay.
- Script `check-session-isolation.mjs` đã đổi path sang v3; chạy lại đạt 13/13 kiểm tra HTTP, tự logout phiên fixture.
- Các mục bên dưới mô tả các lượt chạy trước và được giữ làm lịch sử.

Kết quả mới hơn: xem `SESSION_RUN_RESULT_2026-11-02.md`. Sau khi chuyển llama-server sang 8082, đã chạy lại scenario trên CTULib cổng 8080: 36 Failed, 90/161 assertion Failed; TC-REF-003 gửi Cookie rỗng và trả 401. Mục kiểm tra cổng 8081 bên dưới là lịch sử trước khi giải quyết xung đột cổng.

## Kiểm tra tiếp ngày 02/11/2026

- Scenario 1971050 đã được kiểm tra trực tiếp trên UI: 36 bước được chọn, Iterations=1, Threads=1, Local Development Server, No Test Data.
- Báo cáo đang mở có 36/36 Failed, request `/auth/refresh` trả 404. Kiểm tra listener xác nhận cổng 8080 hiện thuộc `llama-server`, không phải CTULib. Kết quả này không đánh giá được hành vi auth hoặc khả năng cô lập cookie.
- Đã chạy backend CTULib tạm ở `http://localhost:8081` và chạy `node docs/qa/apidog/check-session-isolation.mjs http://localhost:8081`: 13/13 kiểm tra HTTP đạt. Gồm 10 request thiếu cookie trả 401 và 3 positive control có cookie hợp lệ trả 200; mỗi vòng có login riêng và logout dọn phiên.
- Script chẩn đoán dùng Node fetch không có cookie jar tự động. Nó xác nhận hành vi backend với cookie được kiểm soát, **không chứng minh cookie jar của Apidog đã được cô lập**, không chạy hoặc thay thế assertions v3.
- Nguồn pre-request hiện hỗ trợ biến `sessionFixtureBaseUrl` (mặc định `http://localhost:8080`), chỉ chấp nhận HTTP localhost/127.0.0.1 và yêu cầu request chính cùng origin. Thay đổi nguồn này **chưa được đồng bộ vào 17 preprocessor đã lưu trên Apidog**.
- Để chạy lại scenario trên cổng 8081, cần đồng bộ 17 preprocessor từ nguồn, đặt `sessionFixtureBaseUrl=http://localhost:8081` và đổi Base URL của environment test tương ứng. Chỉ đổi Base URL là chưa đủ vì bản script đã lưu dùng cứng cổng 8080. Không dừng dịch vụ khác để giành cổng.
- Chưa có báo cáo chạy lại Apidog hợp lệ; 19 fixture chuyên biệt bên dưới vẫn chưa hoàn thành. Giữ nguyên mọi assertion v3.

## Cấu hình đã lưu trên Apidog

- Scenario `1971050`: **Refresh và đăng xuất - 36 case chạy tuần tự**.
- Tham chiếu 21 case refresh và 15 case logout hiện có; chọn đủ 36 bước, Iterations=1, Threads=1, Local Development Server, không dùng dataset lặp.
- Đã thay preprocessor của 17 case bên dưới bằng fixture HTTP. Giữ nguyên body đặc biệt, oracle và postprocessor v3.
- Tài khoản cố định B9900001; mỗi case cần phiên hợp lệ tự login lấy refresh cookie/access token mới, không lưu token cố định vào environment hoặc log.
- Chỉ sau khi chuẩn bị xong điều kiện của case, script mới gán authFixtureId ở scope local. Không đặt authFixtureId chung cho cả nhóm.
- `session-fixture.pre-request.js` là nguồn chức năng fixture; thêm `const SESSION_CASE_CODE = "TC-...";` trước script theo từng case trong danh sách hỗ trợ.

## 17 case đã có fixture HTTP

| Điều kiện | Case |
| --- | --- |
| Phiên mới hợp lệ | TC-REF-001, TC-OUT-001 |
| Không có refresh cookie | TC-REF-003, TC-OUT-003 |
| Cookie sai định dạng | TC-REF-004, TC-OUT-012 |
| Phiên đã logout trước request chính | TC-REF-007, TC-OUT-002 |
| Dùng access JWT thay refresh token | TC-REF-015 |
| Body object injection, giữ payload gốc | TC-REF-017 |
| Origin khác | TC-REF-018, TC-OUT-009 |
| Thiếu Origin | TC-REF-019, TC-OUT-014 |
| Origin null | TC-REF-022, TC-OUT-015 |
| Body field lạ, giữ payload gốc | TC-OUT-013 |

## 19 case còn cần fixture chuyên biệt

- Refresh: TC-REF-002, 005, 006, 008, 009, 010, 011, 012, 013, 014, 020, 021.
- Logout: TC-OUT-004, 005, 006, 007, 008, 010, 011.
- Các điều kiện gồm JWT hết hạn nhưng phiên còn sống, token ký hợp lệ nhưng không có DB record, clock boundary, khóa/xóa/đổi role account sau login, nhiều phiên, rotation/replay, concurrency và lỗi ghi DB. Fixture tài khoản hoặc một cookie mới không đủ chứng minh các điều kiện này.
- Các gate và test basis cũ vẫn giữ. Không đánh Passed chỉ vì HTTP giống kỳ vọng khi chưa có bằng chứng điều kiện và hậu điều kiện tương ứng.

## Cookie jar và thứ tự chạy

Apidog ghép cookie jar vào request. Trong lần kiểm tra, TC-REF-003 chạy riêng trả 401 nhưng chạy Run All cùng các case login có thể bị cookie phiên khác chen vào và trả 200. Script xóa cookie jar của domain request ngay trước khi gửi request chính. Việc này không thu hồi phiên DB hoặc xóa cookie browser.

Dùng scenario tuần tự và không chạy nhóm localhost khác đồng thời. Không coi `Run All` có chia sẻ cookie jar là bằng chứng cô lập cookie cho các case thiếu cookie. Không xóa toàn bộ cookie của các domain khác.

## Khác biệt backend đã quan sát, không sửa oracle để làm xanh

- TC-OUT-001 với phiên mới đã trả 200; lỗi fixture gate đã hết. Assertion v3 vẫn Failed vì yêu cầu Max-Age=0 trong khi clearCookie hiện dùng Expires.
- TC-REF-001 với phiên mới trả 200, expiresIn=1800; oracle v3 yêu cầu 900, no-store và refresh cookie mới. Backend hiện chưa rotate refresh token.
- TC-REF-004, 007, 015 đã trả 401 đúng loại lỗi, nhưng oracle v3 còn yêu cầu xóa cookie khi từ chối; backend chưa trả Set-Cookie xóa ở các nhánh này.
- TC-REF-017 gửi cookie hợp lệ cùng payload object injection trả 200 thay vì 400; route refresh chưa validate body.
- TC-REF-018, 019, 022 với cookie hợp lệ trả 200 thay vì 403 theo oracle Origin guard.

Các kết quả này phân biệt dữ liệu đầu vào đã chuẩn bị đúng với hành vi chưa đạt hợp đồng v3; không chứng minh toàn bộ API không có lỗi. Chưa sửa backend trong đợt chuẩn bị fixture này.
