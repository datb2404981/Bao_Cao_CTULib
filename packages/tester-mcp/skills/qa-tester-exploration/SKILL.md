---
name: qa-tester-exploration
description: Dùng Explorbot AI khảo sát website, lập kế hoạch và chạy kiểm thử khám phá trên môi trường QA.
---

# Skill tester khám phá bằng Explorbot

Nguồn: bộ công cụ ctulib-tester-mcp. Áp dụng khi cần kiểm tra các màn hình như một tester thủ công.

1. Gọi tester_status để xác minh frontend, backend và model AI sẵn sàng.
2. Xác định trang cụ thể, đối tượng người dùng và phạm vi cho tester_plan. Bắt đầu tối đa 3 test mỗi lần.
3. Dùng tester_read_artifact để đọc kế hoạch vừa tạo. Kiểm tra bước test và kết quả kỳ vọng, tránh test không có dữ liệu hoặc tài khoản QA.
4. Dùng tester_explore để AI tự điều hướng, nhập form, kiểm tra luồng và lập báo cáo. Chỉ chạy trên môi trường thử nghiệm cho phép ghi dữ liệu.
5. Gọi tester_list_artifacts và tester_read_artifact để đối chiếu báo cáo. Exit code 0 hoặc có test plan không đồng nghĩa mọi bài test đã PASS.
6. Test ổn định nên được chạy lại bằng tester_run_plan hoặc chuyển sang test cố định để hồi quy.

Ưu tiên kiểm tra form bắt buộc, dữ liệu sai, quyền truy cập, tìm kiếm, phân trang, trạng thái tải và lỗi hiển thị. Dùng bằng chứng DOM/HTTP/console để phân loại lỗi. Nếu model Ollama không gọi tool đúng, báo giới hạn AI và dùng Playwright smoke/regression làm bằng chứng thay thế.

Bảo vệ tài khoản và dữ liệu. Không ghi mật khẩu, token, cookie phiên vào báo cáo hoặc prompt. Tránh thử nghiệp vụ có ghi dữ liệu trên database ngoài QA.
