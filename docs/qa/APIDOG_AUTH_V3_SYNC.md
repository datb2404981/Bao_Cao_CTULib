# Đồng bộ test xác thực v3 lên Apidog

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
| `TC-REF-001` | `62499346` |
| `TC-REF-002` | `62499347` |
| `TC-REF-003` | `62499348` |
| `TC-REF-004` | `62499350` |
| `TC-REF-005` | `62499351` |
| `TC-REF-006` | `62499352` |
| `TC-REF-007` | `62499353` |
| `TC-REF-008` | `62499354` |
| `TC-REF-009` | `62499355` |
| `TC-REF-010` | `62499356` |
| `TC-REF-011` | `62499357` |
| `TC-REF-012` | `62499358` |
| `TC-REF-013` | `62499359` |
| `TC-REF-014` | `62499360` |
| `TC-REF-015` | `62499361` |
| `TC-REF-016` | `62499362` |
| `TC-REF-017` | `62499363` |
| `TC-REF-018` | `62499364` |
| `TC-REF-019` | `62499365` |
| `TC-REF-020` | `62499366` |
| `TC-REF-021` | `62499367` |
| `TC-REF-022` | `62499369` |
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
