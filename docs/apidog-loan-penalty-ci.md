# Kiểm thử mượn–trả và thu phạt bằng Apidog CLI

## Kết quả mới nhất ngày 10/11/2026 — suite 7413

- Project Apidog `1405851`, suite `7413`: kiểm tra **đủ 157 test case** bằng runner cục bộ `apps/backend/scripts/loan-apidog-suite-qa.ts`, dùng **assertion gốc** từ các case Apidog và **fixture riêng từng case** trên MongoDB replica set QA ở loopback.
- Kết quả thực tế lần chạy lại đầy đủ ngày 10/11/2026: **140 PASS, 0 FAIL, 17 BLOCKED**. Báo cáo mới nhất đã đọc và đối chiếu: `apidog-reports/loan-local-suite-7413/summary-nov10d.json` (cùng số liệu với `summary-nov10c.json`). Runner trả mã `1` **theo thiết kế** vì còn `BLOCKED`; **không được ghi nhận suite 157/157 PASS**.
- Các case `BLOCKED`: `LOAN-LIST-011`, `RESERVE-004/005/006/016/017/018/019/020`, `CANCEL-009`, `HANDOVER-008`, `RETURN-026/029/031`, `PENALTY-LIST-007`, `COLLECT-026/027`. Đây là trạng thái chặn có chủ đích trong nguồn case/fixture, chưa được thực thi như một phép thử Apidog độc lập.
- Kiểm thử tích hợp backend trên DB QA riêng: **29/29 PASS** (chạy lại ngày 10/11/2026). Đã chạy HTTP cho `RESERVE-004/005/006/016/017/018/019/020`, `CANCEL-009`, `HANDOVER-008`, `RETURN-026/029/031`, `COLLECT-026/027`, `LOAN-LIST-011`, `PENALTY-LIST-007`; các kiểm thử kiểm tra mã phản hồi, trạng thái phiếu, tồn kho, chống vượt hạn mức/trùng phiếu, xử lý cạnh tranh và phân trang ổn định. `COLLECT-027` xác nhận khi server đã commit nhưng client mất phản hồi, request lại nhận `409`, DB chỉ thu và hoàn kho một lần. Các bài tích hợp này **hỗ trợ kiểm chứng nghiệp vụ**, không chuyển trạng thái các Apidog case `BLOCKED` thành `PASS`.
- `pnpm --filter @ctulib/backend build`: **PASS** khi chạy lại (lỗi type từng quan sát ở `account.service.ts` không còn tái hiện). `test:standalone`: **23/23 PASS**. `lint`: **0 error, 9 warning** ở mã nguồn khác. Mongo QA thử nghiệm dùng tên database `ctulib_qa_*`, tuyệt đối không trỏ vào production.
- `apidog` CLI **2.2.12 đã cài** tại máy phát triển; xác minh shell ngày 10/11 cho thấy **chưa có** `APIDOG_TOKEN` và `APIDOG_LOAN_QA_ENV_ID`. **Chưa chạy thành công suite chính thức trên Apidog CLI/cloud environment**. GitHub variable `APIDOG_LOAN_QA_READY` phải giữ chưa bật cho đến khi 17 case được giải quyết và một lần chạy CLI chính thức PASS.

Lần chạy `nov10d` đã hoàn tất tất cả 157 case. `0 FAIL` chỉ áp dụng với những case đã có assertion HTTP được chốt; 17 case còn thiếu expected / kịch bản đồng thời vẫn `BLOCKED` dù các invariant tương ứng đã được xác minh riêng qua kiểm thử tích hợp HTTP/backend. Không tự chuyển các case này sang `PASS` khi đồng bộ CI.

Ưu tiên xử lý 17 case còn chặn theo hợp đồng API: quyền xem của nhân viên (`LOAN-LIST-011`), tình huống cấm đặt/quá hạn, mã lỗi và validation (`RESERVE-004/005/006/016/017`, `RETURN-026/029`), và bài thử nhiều request song song / mất phản hồi (`RESERVE-018/019/020`, `CANCEL-009`, `HANDOVER-008`, `RETURN-031`, `PENALTY-LIST-007`, `COLLECT-026/027`). Khi đã chốt `expected` cùng fixture/pre-request trong Apidog, chạy lại đúng case và toàn suite, không chỉnh assertion chỉ để ép PASS.

### Phân loại các case Apidog còn chặn

| Case | Kết quả backend QA đã xác nhận | Công việc còn thiếu trong Apidog |
| --- | --- | --- |
| `RESERVE-004/005/006` | HTTP lần lượt `400/400/403`, không trừ tồn kho | Chốt expected theo nguyên nhân; cung cấp fixture quá hạn, phạt chưa trả và khóa thủ công. |
| `RESERVE-016/017` | HTTP `404` (ObjectId hợp lệ, sách không tồn tại), `400` (body chứa trường tự gán) | Chốt D14 (404) và quy tắc strict body; sửa expected đang TBD. |
| `RETURN-026/029` | HTTP `409` (chưa bàn giao), `400` (body chứa trường do server quản lý); phiếu và kho không đổi | Chốt D14 (409) và expected validation. |
| `RESERVE-018/019/020`, `CANCEL-009`, `HANDOVER-008`, `RETURN-031`, `COLLECT-026/027` | Các invariant cạnh tranh, idempotency và mất phản hồi có test tích hợp riêng; **chưa chạy thành test case gốc trong Apidog** | Viết pre-request và assertion chạy song song, đối chiếu trạng thái DB/hậu điều kiện; quyết định mã request thất bại theo contract. |
| `PENALTY-LIST-007` | HTTP đã xác nhận `200`, sắp xếp `issuedDate` giảm dần rồi `_id` tăng dần khi trùng ngày; 4 bản ghi (3 cùng timestamp), chia 2 trang và gọi lại trang đầu không lặp/đổi thứ tự | Dựng fixture và assertion tương ứng trong Apidog; case gốc vẫn `qa.blocked=true`. |
| `LOAN-LIST-011` | HTTP nhân viên thiếu `MANAGE_LOANS` trả `403`; nhân viên có quyền trả `200` | Chốt D10 với nhóm: cho phép vai trò xem riêng hay giữ `403`; hiện case gốc đang `qa.blocked=true` và `QA_EXPECTED.http=null`. Không đổi RBAC/expected trước khi thống nhất. |

Các mã HTTP trong bảng là **hành vi backend đã quan sát qua kiểm thử HTTP**, chưa phải sự phê duyệt chính thức cho những hợp đồng Apidog đang đánh dấu TBD. Chỉ đồng bộ expected sau khi thống nhất quy tắc nghiệp vụ và xác nhận test fixture.

Lệnh chạy kiểm thử tích hợp nội bộ (cần replica set QA đang chạy ở loopback):

```sh
CTULIB_TEST_MONGODB_URI='mongodb://127.0.0.1:27055/ctulib_qa_loans?replicaSet=ctulibqa' \
  pnpm --filter @ctulib/backend test:integration
```

Để chạy lại **case gốc đã xuất từ Apidog** bằng CLI trên Express và MongoDB QA cô lập, cần có bản xuất 157 case trong `APIDOG_CASES_DIR` và báo cáo collection mẫu mà script tham chiếu. Mỗi case chạy trên dữ liệu QA mới; runner giữ nguyên assertion Apidog và đánh dấu các case gốc chưa chốt là `BLOCKED`:

```sh
APIDOG_CASES_DIR='/tmp/ctulib-apidog-7413-cases' \
APIDOG_QA_RUN='manual' \
CTULIB_TEST_MONGODB_URI='mongodb://127.0.0.1:27055/ctulib_qa_loan_apidog_manual?replicaSet=ctulibqa' \
  pnpm --filter @ctulib/backend exec tsx scripts/loan-apidog-suite-qa.ts
```

File kết quả: `apidog-reports/loan-local-suite-7413/summary-manual.json`. Đây là phép thử **cục bộ từ bản xuất**; CLI chính thức qua Apidog project/suite/environment vẫn yêu cầu token, QA environment và fixture đã đồng bộ.

> Các phần dưới ghi lại trạng thái và hành động ở những ngày trước; dùng kết quả 10/11/2026 bên trên để đánh giá hiện tại.

## Xác minh tại máy phát triển ngày 09/11/2026

- `pnpm --filter @ctulib/backend build`: PASS; `pnpm --filter @ctulib/backend lint`: PASS (9 cảnh báo tồn tại ở các file khác).
- 12/12 kiểm thử tích hợp HTTP + nghiệp vụ mượn–trả và thu phạt PASS trên MongoDB QA replica set. Test HTTP xác nhận gọi thu phạt lần hai trả `409 Conflict`.
- Bổ sung kiểm thử đồng thời cho việc hủy một phiếu, trả một phiếu và thu phạt một phiếu. Mỗi trường hợp chỉ có một yêu cầu thành công; tồn kho và thanh toán không bị cộng/trừ hai lần. Hủy giữ chỗ dùng `withTransaction` và điều kiện trạng thái để xử lý xung đột an toàn.
- 23/23 kiểm thử backend độc lập (`test:standalone`), 2/2 Vitest backend; 200/200 Vitest frontend, frontend build PASS.
- Hai tệp kiểm thử tích hợp chạy tuần tự (`--test-concurrency=1`) vì có các tác vụ quét quá hạn áp dụng cho toàn bộ database QA.
- Workflow chạy kiểm tra khi push hoặc mở PR tới `main`, `staging`, `develop`; chỉ job deploy trên push vào `main`.
- **Chưa có kết quả Apidog CLI PASS:** phiên shell không có `APIDOG_TOKEN` hoặc `APIDOG_LOAN_QA_ENV_ID`; môi trường Apidog và bộ fixture cho suite `7413` vẫn chưa sẵn sàng. Không bật `APIDOG_LOAN_QA_READY` khi chưa chạy thành công toàn bộ suite.

## Cập nhật ngày 09/11/2026: kiểm thử tích hợp nội bộ

- Bài test `apps/backend/tests/loan-concurrency.integration.ts` đã chạy **10/10 PASS** trên MongoDB QA replica set `ctulibqa` (`127.0.0.1:27055`). Đã kiểm tra hạn mức 3 cuốn dưới tải đồng thời, chống đặt trùng, hai yêu cầu hủy/trả/thu phạt đồng thời, từ chối do `dueDate` quá hạn, trả và thu phạt, hoàn kho phiếu hết hạn khi chạy song song, khóa do quá hạn và không mở khóa nếu còn phiếu quá hạn khác.
- Mỗi lần chạy tự xóa độc giả, sách, phiếu mượn và phiếu phạt **do chính lần chạy tạo ra**. Test từ chối MongoDB ngoài loopback, DB không có tiền tố `ctulib_qa_` hoặc MongoDB không khai báo `replicaSet`.
- `quality-check` trong `.github/workflows/ci-cd.yml` nay tự dựng MongoDB replica set QA riêng trên runner Ubuntu, chạy Vitest backend, kiểm thử tích hợp, test backend độc lập và test frontend. Thất bại sẽ chặn job deploy thông qua `needs: quality-check`.
- Đây là kiểm thử code trực tiếp trên QA DB; **không phải kết quả Apidog PASS**. Suite Apidog `7413` vẫn cần fixture theo từng case, đồng bộ endpoint/payload và môi trường QA truy cập được. Không bật `APIDOG_LOAN_QA_READY` chỉ vì các bài test tích hợp nội bộ đã PASS.

Chạy riêng tại máy phát triển khi đã có MongoDB QA replica set ở loopback:

```sh
CTULIB_TEST_MONGODB_URI='mongodb://127.0.0.1:27055/ctulib_qa_loans?replicaSet=ctulibqa' \
  pnpm --filter @ctulib/backend test:integration
```

## Trạng thái ngày 08/11/2026

- Apidog project: `1405851` (CTULib API).
- Suite hồi quy: `7413` — gồm 102 test case từ suite `7342` và 55 test case từ suite `7343`.
- Case được chạy thử: `62588591` (`AUTH-010`, GET `/loans`) trên environment `6934714`: **FAILED / chưa thể đánh giá nghiệp vụ**. Pre-request script báo thiếu fixture `ctulib-business-v1` đã reset riêng cho case; request đến `http://localhost:8080/api/v1/loans` báo `ECONNREFUSED`.
- Chưa chạy hết suite, chưa có kết quả PASS của 157 case. Các case hiện hữu không tự cấp dữ liệu và nhiều case bị guard chặn nếu chưa seed/reset đúng.

## Điều kiện trước khi bật Apidog CI gate (cập nhật 10/11/2026)

1. Dựng backend + MongoDB replica set trên **môi trường QA riêng**; xác minh có thể truy cập từ runner GitHub Actions. Không sử dụng database production.
2. Tạo môi trường Apidog trỏ tới backend QA, lưu environment ID vào GitHub Actions variable `APIDOG_LOAN_QA_ENV_ID`. Đảm bảo URL trong pre-request script và fixture policy chấp nhận host QA được chọn; nhiều case cũ hiện khóa cứng `localhost:8080`.
3. Chuyển fixture QA **theo từng case** đã dựng trong runner cục bộ thành dữ liệu và pre-request tương thích với environment Apidog chính thức; cung cấp `qaPreparedCaseId`, `qaFixtureVersion=ctulib-business-v1` theo guard của suite. Không đặt credentials trong repo.
4. Đối chiếu tất cả 17 case `BLOCKED` với hợp đồng và triển khai backend, chốt kỳ vọng về mã HTTP/permission/schema và cách kiểm thử đồng thời; cập nhật riêng các case Apidog được chấp thuận sau khi có bằng chứng. Backend hiện có các route `/loans/{loanId}`, `/penalties/{penaltyId}/collect` cùng các route lịch sử; cần kiểm tra **theo phiên bản spec đang được sử dụng**.
5. Chạy suite bằng CLI từ máy truy cập được QA, xem báo cáo và sửa mọi case sai; chỉ sau khi tất cả case cần thiết PASS mới bật GitHub variable `APIDOG_LOAN_QA_READY=true`.

```sh
apidog run --access-token "$APIDOG_TOKEN" --test-suite 7413 -e "$APIDOG_LOAN_QA_ENV_ID" \
  -r cli,junit --out-dir apidog-reports/loan-penalty --on-error end
```

Workflow `.github/workflows/ci-cd.yml` dùng GitHub secret `APIDOG_TOKEN`. Khi `APIDOG_LOAN_QA_READY=true`, bước này không có `continue-on-error`, vì vậy test thất bại sẽ ngăn bước kích hoạt Render deploy. Khi chưa bật variable, kiểm thử loan/penalty được bỏ qua và **không được xem là đã PASS**.

**Còn thiếu để hoàn thành yêu cầu:** xử lý 17 case `BLOCKED` trong Apidog, đưa fixture theo case vào môi trường QA mà CLI chính thức truy cập được, xác minh cấu hình/mã thông báo CI an toàn và một lần chạy CLI chính thức **157/157 PASS**. Kiểm thử tích hợp 29/29 PASS hiện có đã nằm trong đường chạy `quality-check` của CI.
