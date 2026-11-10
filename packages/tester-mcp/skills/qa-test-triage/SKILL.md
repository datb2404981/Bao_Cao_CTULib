---
name: qa-test-triage
description: Phân tích báo cáo kiểm thử, tái hiện lỗi và phân loại đúng frontend, backend, test automation hoặc môi trường.
---

# Skill phân tích và phân loại lỗi QA

Nguồn: bộ công cụ ctulib-tester-mcp.

1. Gọi tester_list_artifacts với reports để biết báo cáo mới nhất, rồi tester_read_artifact để đọc đúng file.
2. Đối chiếu thời điểm chạy, môi trường, dữ liệu QA, trạng thái PASS/FAIL/BLOCKED. Không gộp kết quả từ các lần chạy khác nhau.
3. Với lỗi UI, xem tương tác, locator, trạng thái SPA, request API và DOM mới nhất. Với lỗi nghiệp vụ, kiểm tra trạng thái API/DB và bất biến số lượng.
4. Chỉ đánh dấu defect đã tái hiện nếu có bước tái hiện và expected/actual cụ thể. Test runner sai locator hoặc không làm mới dữ liệu được phân loại test automation.
5. Báo cáo lỗi gồm tiêu đề, mức độ, môi trường, tiền điều kiện, các bước, expected, actual, bằng chứng, trạng thái xác minh.
6. Sửa lỗi trong phạm vi tối thiểu, chạy bài test liên quan và hồi quy nếu cần.

Không kết luận Explorbot đã chạy độc lập chỉ từ kịch bản Playwright có sẵn. Không dùng exit code 0 thay cho nội dung báo cáo. Không in thông tin đăng nhập thử nghiệm hoặc secret.
