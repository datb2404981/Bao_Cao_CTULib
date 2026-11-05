# Đồng bộ test xác thực v3 lên Apidog

## Tách bộ login hiện tại khỏi yêu cầu v3 chưa triển khai

- Suite `7295` — **Đăng nhập hiện tại — JWT 30 phút**: 15 case hiện có theo backend hiện tại; không yêu cầu authFixtureId. Giữ kiểm tra sai mật khẩu, account không tồn tại, khóa account, role, NoSQL validation, JWT/account consistency, cookie HttpOnly/Lax/Path=/, JWT refresh và Max-Age=604800.
- Suite `7296` — **Đăng nhập — v3 và kiểm thử thủ công**: 6 case cũ cần DB/fault/multiple-session/Origin guard, cộng `62526787` (hợp đồng v3 15 phút/opaque/no-store/Strict) và `62526788` (browser/preflight). Giữ Not Run và fixture gate; không biến hành vi chưa triển khai thành Passed.
- Bỏ 6 case chờ khỏi các tham chiếu trong Module Authentication `7294` và Full System Test `7293`; giữ các case khác và các bước không liên quan. Các case chờ vẫn hiện trên endpoint với tên [chờ fixture/v3], category Other, để không mất test basis.
- TC-SES-010 hiện kiểm tra CORS response headers qua HTTP; yêu cầu browser đầy đủ giữ ở TC-SES-010B. TC-SES-004 kiểm tra không cấp token/cookie qua HTTP; không suy ra trạng thái DB.
- Cập nhật debug login Success và các bước login trong ba scenario `1969071`, `1969075`, `1969076`; giữ extractor access token và đổi extractor refresh token sang JWT. Không thay hợp đồng refresh/logout của những bước khác trong scenario v3.
- Reader dùng loginIdentifier/loginPassword; EMPLOYEE/ADMIN/account khóa cần fixture riêng đúng trạng thái và vai trò. Không tự cấp quyền hoặc sửa DB để làm test xanh. `clientOrigin` local mặc định http://localhost:5173, có thể ghi đè bằng environment.
- Endpoint login: Origin không còn là header bắt buộc của Origin guard; response 400 hỗ trợ cả ErrorResponse và ValidationErrorResponse. Không đưa no-store vào oracle hiện tại, giữ ở yêu cầu v3 chờ triển khai.
- Script nguồn `docs/qa/apidog/login-current.post-response.js`; hợp đồng chi tiết `LOGIN_CURRENT_CONTRACT.md`; ID mapping `APIDOG_LOGIN_CURRENT.json`. Kiểm tra 15 oracle bằng response tổng hợp và sáu tình huống sai; validate CLI và đọc lại sau lưu. Không gọi backend; không đánh Passed các case chưa thực thi.

## Sửa lỗi schema login bắt buộc fullName

- Response thực tế HTTP 200 trả token, tokenType=Bearer, expiresIn=1800 và user={accountId,ctuIdentifier,email,role}. Schema LoginSuccessResponse (`18528656`) trên Apidog còn bắt buộc fullName, gây lỗi contract testing dù đăng nhập thành công.
- Bỏ fullName khỏi schema account; yêu cầu bốn trường account nêu trên, isActive chỉ tùy chọn. Cập nhật metadata và example của endpoint login `46212848` theo response hiện tại; không thêm fullName giả vào backend.
- Sửa 10 post-processor liên quan metadata/account: expiresIn=1800, không yêu cầu isActive khi không được trả. Giữ nguyên kiểm tra JWT issuer/audience/jti/lifetime và cookie v3; các yêu cầu bảo mật chưa triển khai vẫn phải được báo lỗi, không bị tắt để làm xanh suite.
- Đồng bộ schema/example trong YAML và JSON OpenAPI; đọc lại trên Apidog sau lưu. Không gọi backend, không dùng token thật từ debug context.

## Khôi phục endpoint refresh và liên kết hiển thị test

- Endpoint refresh cũ `46310205` trả Not found và không có trong danh sách endpoint, trong khi 21 test TC-REF vẫn tồn tại và suite Module Authentication vẫn tham chiếu đủ các test này. Vì vậy không thể mở test từ cây API như hướng dẫn trước đó.
- Khôi phục `POST /auth/refresh` tại endpoint mới `46326811`, trong folder Authentication `11293404`, module `1504230`; trạng thái designing. Giữ hợp đồng v3 từ OpenAPI, không thay đổi backend.
- Apidog bỏ qua thay đổi apiDetailId của test cũ dù update trả success; đọc lại vẫn liên kết endpoint đã mất. Vì vậy tạo 21 case mới dưới endpoint khôi phục, giữ tên/mã TC-REF, fixture và pre/post processors; thay tham chiếu suite sang ID mới. Bảng ánh xạ được lưu trong APIDOG_REFRESH_RESTORED_CASES.json. Các bản cũ không bị xóa.
- Ánh xạ responseId sang response định nghĩa ở endpoint mới; ca race chấp nhận 200/401 dùng responseId=0 để không ép một mã duy nhất.
- Gắn lại hai bước refresh của smoke scenario `1969071`. Kiểm tra danh sách endpoint chỉ có một `/auth/refresh` và đọc lại liên kết sau lưu. Không chạy test trên backend.

## Đăng ký trả access token và account ngay sau khi tạo

- Quyết định mới thay phản hồi đăng ký data=null: HTTP 201; message chính xác `Đăng ký tài khoản thành công, trả về Token và Thông tin user`; data gồm token, tokenType=Bearer, expiresIn=1800 và user={accountId,ctuIdentifier,email,role=READER}. Thời hạn metadata lấy theo registerController hiện tại; không sửa hợp đồng login/refresh v3 trong lần này.
- Tạo schema riêng RegisterSuccessResponse (`18575673`), gắn response 201 của endpoint register (`46212847`) và cập nhật example đầy đủ. Không sửa SuccessResponse dùng chung, không làm ảnh hưởng response logout hoặc các endpoint khác.
- Sửa 5 test đăng ký thành công (TC-REG-001, 002, 004D, 006C, 006D), debug Success (`62344458`), bước register trong smoke (`1969071`) và contract drift (`1969075`). Giữ nguyên pre-request và dữ liệu động. Bỏ assertion data=null; khớp message mới; kiểm tra token JWT có ba phần, metadata, role và dữ liệu account khớp request.
- Chỉ cho phép access token ở data.token; vẫn từ chối password/passwordHash/tokenHash/refreshToken ở mọi cấp JSON. Script nguồn: `docs/qa/apidog/register-success.post-response.js`.
- Đồng bộ YAML, JSON OpenAPI, Markdown, CSV và tài liệu Apidog `2503772`. Kiểm tra assertion bằng response giả lập: chấp nhận mẫu thành công, từ chối data=null, message cũ, thiếu token, sai account và lộ mật khẩu/refresh token. Đọc lại tài nguyên sau lưu. Không chạy backend, không xác minh chữ ký JWT qua script này; trạng thái thực thi backend vẫn Not Run.

## Bổ sung dữ liệu động cho debug case và request mặc định

- Rà soát lại 34 test đăng ký và toàn bộ 11 scenario: dữ liệu hợp lệ trong 33 test đã dùng biến; TC-REG-010 (`62448355`) còn dữ liệu tĩnh/thiếu pre-request, đã khôi phục script tạo seed riêng và body `caseIdentifier`/`duplicateEmail`.
- Request mẫu và Pre Processor trên endpoint register (`46212847`) đã đổi sang `caseIdentifier`/`caseEmail`. Debug case mặc định (`62344458`) đổi tên thành “Success — tự sinh MSSV và email mỗi lần chạy”, chỉ gửi ba trường tài khoản và có script riêng, không phụ thuộc chạy test case.
- Smoke scenario `1969071`: bỏ trường profile, sinh MSSV/email mới mỗi execution và chia sẻ smokeIdentifier/smokeEmail cho các bước tiếp theo. Các scenario đăng ký khác đã có biến động; giữ nguyên dữ liệu cố ý sai để kiểm thử validation.
- Nếu tab Apidog đang giữ request chỉnh sửa cũ, tải lại và mở bản case đã lưu; không Save body tĩnh cũ đè lên bản động. cURL đã xuất chứa giá trị cụ thể của một lần gửi và không mang theo Pre Processor.
- Đọc lại endpoint/debug/test/scenario sau lưu; không thực thi request trên backend.

## Dữ liệu đăng ký tự sinh theo schema ngày 31/10/2026

- Cập nhật pre-request và payload của 34 test đăng ký: `{{caseIdentifier}}` là `B` + 7 chữ số, `{{caseEmail}}` là email mới cho mỗi execution. Giữ nguyên dữ liệu cố ý sai, kiểu object/number, field bị thiếu và mật khẩu tại biên để không đổi mục tiêu validation. Không random tài khoản trong test login độc lập.
- TC-REG-009/010 tự tạo account seed bằng cùng URL đăng ký, yêu cầu HTTP 201 rồi chỉ lặp đúng MSSV hoặc email. Seed gặp 409 thử lại tối đa 5 lần; lỗi khác làm fixture thất bại. Seed tạo dữ liệu trong DB test và không tự dọn. Không chạy script này trên production.
- Scenario 1969075 sinh account mới và chia sẻ contractIdentifier/contractEmail cho bước login sau; 1969076/1969247 dùng MSSV/email mới cho test payload không hợp lệ; 1969246 sinh một MSSV ngẫu nhiên và hai email khác nhau cho race.
- Khi đọc lại, RegisterRequest trên Apidog còn năm trường bắt buộc; đã sửa về ba trường, strict schema và định dạng ctuIdentifier/maxLength=10 theo auth.schema.ts để scenario không tự chèn profile rỗng.
- Script nguồn: `docs/qa/apidog/register-data.pre-request.js`. Mã MSSV có không gian hữu hạn nên random không cam kết duy nhất tuyệt đối với DB; 409 bất ngờ trong ca thành công cần được phân tích, không tự coi là thành công. Không thay HTTP expected để che lỗi backend.
- Kiểm tra 1.700 payload bằng VM với response giả lập, định dạng, fixture trùng đúng một trường, retry và nhánh fixture lỗi. Đọc lại trên Apidog sau lưu. Không gửi request đến backend; toàn bộ test vẫn Not Run.

## Cập nhật đăng ký tối giản ngày 31/10/2026

- Quyết định mới: `POST /auth/register` chỉ nhận ba trường bắt buộc `ctuIdentifier`, `email`, `password`. Thông tin cá nhân được cập nhật qua profile sau đăng ký; không thiết kế hoặc xác nhận API profile trong lần cập nhật này.
- Cập nhật schema `RegisterRequest` (`18528652`): bỏ trường profile, `additionalProperties: false`, mật khẩu tối thiểu 8 ký tự. Endpoint `46212847` cập nhật example ba trường, response 409 cho dữ liệu trùng và trạng thái `designing`.
- Cập nhật 34 test đăng ký tại ID hiện có, bảo toàn tham chiếu suite. Các mã `TC-REG-003D/E` đổi sang kiểm tra sai kiểu dữ liệu; `TC-REG-007`, `TC-REG-008`, `TC-REG-011`, `TC-REG-012A` đổi sang từ chối trường profile ngoài hợp đồng, không còn kiểm tra quy tắc phone/date/faculty trong đăng ký. `TC-REG-013` bắt buộc 400 khi gửi role.
- Cập nhật scenario contract drift (`1969075`), mass assignment (`1969076`), đăng ký đồng thời (`1969246`) và XSS (`1969247`). Scenario XSS giờ kiểm tra từ chối fullName chứa script, bỏ bước login đọc fullName vì request đăng ký bị từ chối. Kiểm thử stored XSS qua profile cần thiết kế riêng khi có hợp đồng profile.
- Đồng bộ tài liệu Apidog `2503772`, Markdown và CSV cục bộ. Kiểm tra JSON schema CLI, cú pháp script và đọc lại tài nguyên sau lưu. Không chạy test trên backend; trạng thái **Not Run**. Hậu điều kiện băm mật khẩu, role mặc định, không tạo account khi lỗi và tính nguyên tử khi đăng ký đồng thời cần bằng chứng DB/runner riêng.

- Dự án: CTULib API, project ID `1405851`, module ID `1504230`.
- Login/logout cập nhật tại ID cũ; thêm `POST /auth/refresh` (ID `46310205`). Cả ba endpoint ở trạng thái `designing`, chưa xác nhận backend đã triển khai.
- Cập nhật 17 test cũ (11 login, 6 logout), thêm 48 test mới. Giữ ID test cũ để bảo toàn liên kết.
- `Module Authentication` (ID `7294`) có 84 test case được tham chiếu. `Full System Test` (ID `7293`) đã thêm nhóm test xác thực v3 và giữ nội dung trước đó.
- Smoke scenario `1969071`: 7 bước, có refresh thành công và refresh bị từ chối sau logout. Cập nhật Origin cho các scenario liên quan và đổi logout trong contract-drift scenario sang refresh cookie.
- Tài liệu đầy đủ trên Apidog: Markdown document ID `2503772`.
- Đã kiểm tra cấu trúc JSON, schema CLI, cú pháp script; đọc lại endpoint/test/suite/scenario/tài liệu sau khi lưu. Không chạy test trên backend, không tạo token thật.
- Trạng thái thực thi: **Not Run**. Cần fixture theo từng `authFixtureId`; các ca DB, race, clock, lỗi hạ tầng và browser chưa có automation runner hoàn chỉnh. HTTP assertion xanh không chứng minh các hậu điều kiện đó.

## Ánh xạ test mới hoặc cập nhật luồng phiên

| Mã test | Apidog case ID |
| --- | --- |
| `TC-JWT-001` | `62499527` |
| `TC-JWT-002` | `62499528` |
| `TC-JWT-003` | `62499529` |
| `TC-JWT-004` | `62499530` |
| `TC-JWT-005` | `62499531` |
| `TC-JWT-006` | `62499532` |
| `TC-OUT-001` | `62448368` |
| `TC-OUT-002` | `62448369` |
| `TC-OUT-003` | `62448370` |
| `TC-OUT-004` | `62448371` |
| `TC-OUT-005` | `62448372` |
| `TC-OUT-006` | `62448373` |
| `TC-OUT-007` | `62499322` |
| `TC-OUT-008` | `62499337` |
| `TC-OUT-009` | `62499339` |
| `TC-OUT-010` | `62499340` |
| `TC-OUT-011` | `62499341` |
| `TC-OUT-012` | `62499342` |
| `TC-OUT-013` | `62499343` |
| `TC-OUT-014` | `62499344` |
| `TC-OUT-015` | `62499345` |
| `TC-REF-001` | `62526502` |
| `TC-REF-002` | `62526489` |
| `TC-REF-003` | `62526505` |
| `TC-REF-004` | `62526488` |
| `TC-REF-005` | `62526483` |
| `TC-REF-006` | `62526480` |
| `TC-REF-007` | `62526478` |
| `TC-REF-008` | `62526504` |
| `TC-REF-009` | `62526487` |
| `TC-REF-010` | `62526503` |
| `TC-REF-011` | `62526486` |
| `TC-REF-012` | `62526477` |
| `TC-REF-013` | `62526475` |
| `TC-REF-014` | `62526485` |
| `TC-REF-015` | `62526474` |
| `TC-REF-016` | `62499362` |
| `TC-REF-017` | `62526484` |
| `TC-REF-018` | `62526481` |
| `TC-REF-019` | `62526479` |
| `TC-REF-020` | `62526471` |
| `TC-REF-021` | `62526482` |
| `TC-REF-022` | `62526476` |
| `TC-REF-023` | `62499370` |
| `TC-SES-001` | `62499371` |
| `TC-SES-002` | `62499372` |
| `TC-SES-003` | `62499373` |
| `TC-SES-004` | `62499374` |
| `TC-SES-005` | `62499376` |
| `TC-SES-006` | `62499377` |
| `TC-SES-007` | `62499476` |
| `TC-SES-008` | `62499477` |
| `TC-SES-009` | `62499494` |
| `TC-SES-010` | `62499495` |

## Chuẩn hóa phản hồi đăng nhập có token và account ngày 31/10/2026

- `POST /auth/login` (`46212848`) trả 200 với `data: {token, tokenType: "Bearer", expiresIn: 900, user: {accountId, ctuIdentifier, email, role, isActive}}`. LoginSuccessResponse (`18528656`) yêu cầu đầy đủ năm trường account, không còn fullName hoặc dữ liệu profile. Không trả password/passwordHash; refresh token chỉ qua cookie HttpOnly.
- Cập nhật schema, response example, tài liệu Apidog `2503772`, YAML/JSON OpenAPI và 10 test đăng nhập thành công. Giữ các assertion token/cookie hiện có, bổ sung kiểm tra dữ liệu account. Các phản hồi lỗi vẫn có data=null.
- Kiểm tra cú pháp YAML/JSON/script và đọc lại trên Apidog sau lưu. Chưa chạy backend; Not Run. Thay đổi hợp đồng và testware, không sửa mã backend.
