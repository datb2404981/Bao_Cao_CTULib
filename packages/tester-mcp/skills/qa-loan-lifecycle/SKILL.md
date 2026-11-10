---
name: qa-loan-lifecycle
description: Kiểm thử E2E nghiệp vụ mượn, bàn giao, trả sách và tồn kho của CTULib.
---

# Skill kiểm thử vòng đời mượn sách CTULib

Nguồn: bộ công cụ ctulib-tester-mcp. Dùng tester_loan_lifecycle sau khi tester_status cho thấy frontend 5174, API 8080 và MongoDB QA 27029 hoạt động.

Trình tự nghiệp vụ cần có bằng chứng:
1. Đăng nhập độc giả QA, tìm sách và xem chi tiết.
2. Đặt mượn. Phiếu ở trạng thái Đặt lịch mượn, số bản khả dụng giảm đúng 1.
3. Đăng nhập thủ thư QA, mở đúng phiếu và xác nhận bàn giao. Phiếu ở trạng thái Đang mượn, tồn kho không thay đổi.
4. Tiếp nhận trả. Phiếu chuyển Đã trả, số bản khả dụng trở lại ban đầu.
5. Độc giả làm mới lịch sử, thấy trạng thái Đã trả. Kiểm tra desktop và mobile.
6. Ghi nhận JavaScript pageerror, request thất bại và HTTP 5xx.

Runner đã có bước xác minh MongoDB QA độc lập, sinh tài khoản thử ngẫu nhiên và ghi lại phiếu test. Chỉ kết luận PASS nếu báo cáo latest có PASS 11, FAIL 0, BLOCKED 0. Không tự reset tồn kho hoặc xóa phiếu, tài khoản để dọn dữ liệu. Những run bị ngắt có thể để lại phiếu giữ tồn kho, hãy điều tra theo ID trước khi quyết định khôi phục.

Sau E2E, gọi tester_regression để kiểm tra frontend unit tests, backend loan tests, build và guest smoke. Báo cáo rõ database QA, trạng thái và số bản trước/sau.
