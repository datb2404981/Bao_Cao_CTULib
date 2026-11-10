# Kiểm thử API Dashboard với Apidog CLI

Tài sản trên Apidog thuộc project `1405851`:

| Loại | ID | Nội dung |
| --- | --- | --- |
| Endpoint | `46771585` | `GET /api/v1/dashboard/stats` |
| Dataset | `3680747` | Mô tả dữ liệu kiểm thử Dashboard |
| Test suite | `7423` | Năm test case `DASH-001` đến `DASH-005` |
| Environment | `6970109` | Base URL `http://127.0.0.1:8080` |

Test suite kiểm tra nhân viên có quyền `MANAGE_LOANS` nhận HTTP 200 và các chỉ số về sách, độc giả, phiếu mượn, tiền phạt; không đăng nhập hoặc dùng token sai nhận 401; độc giả và nhân viên không có quyền nhận 403. Các giá trị kỳ vọng nằm trong `iterations.json`.

Script `apps/backend/scripts/dashboard-apidog-qa.ts` tự tạo dữ liệu trong một MongoDB QA riêng, khởi động API trên cổng 8080, chạy suite bằng Apidog CLI, ghi JUnit XML vào `apidog-reports/dashboard/` và xóa database QA sau khi kết thúc. Database phải **trống**, dùng replica set chạy trên `127.0.0.1`, và có tên bắt đầu bằng `ctulib_qa_dashboard_`. Script từ chối database đã có collection để tránh xóa nhầm dữ liệu.

Để chạy ở máy phát triển, cài dependencies bằng `pnpm install`, đăng nhập Apidog CLI, chuẩn bị MongoDB replica set cục bộ rồi chạy từ thư mục gốc:

```bash
CTULIB_TEST_MONGODB_URI='mongodb://127.0.0.1:27055/ctulib_qa_dashboard_manual?replicaSet=ctulibqa' \
APIDOG_DASHBOARD_SUITE_ID=7423 \
pnpm --filter @ctulib/backend exec tsx scripts/dashboard-apidog-qa.ts
```

Không tái sử dụng tên database đang có collection. Script tự phát hành JWT tạm thời cho dữ liệu mẫu, đưa chúng vào file iteration tạm có quyền `0600`, và xóa file sau kiểm thử. Không cần lưu JWT trong kho mã nguồn.

Trong GitHub Actions, workflow `.github/workflows/ci-cd.yml` tự khởi động MongoDB replica set, seed dữ liệu, chạy suite và tải lên báo cáo JUnit. **Phải cấu hình repository secret `APIDOG_TOKEN`** có quyền thực thi suite trong Apidog project `1405851`. Lỗi của bất kỳ case nào khiến job `quality-check` thất bại và chặn bước deploy cần job này. Các lần chạy ở máy phát triển không chứng minh workflow đã chạy thành công trên GitHub.
