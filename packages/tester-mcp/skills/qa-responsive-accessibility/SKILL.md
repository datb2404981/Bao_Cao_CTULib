---
name: qa-responsive-accessibility
description: Khảo sát responsive, kiểm tra biểu mẫu, tương tác bàn phím và dấu hiệu lỗi trợ năng.
---

# Skill responsive và accessibility

Nguồn: bộ công cụ ctulib-tester-mcp.

1. Gọi tester_smoke để kiểm tra desktop 1366px và mobile 390px, tràn ngang, form trống, route bảo vệ, pageerror và HTTP 5xx.
2. Dùng tester_plan với chủ đề responsive hoặc keyboard accessibility, tập trung một màn hình mỗi lượt.
3. Với tester_explore, kiểm tra tên truy cập được của control, label, thứ tự tab, trạng thái focus, thông báo lỗi, menu và vùng có thể cuộn.
4. Báo cáo theo viewport và tên trang. Với vấn đề layout, ghi rõ bước và chiều rộng. Với accessibility, mô tả thao tác bàn phím và cây ngữ nghĩa quan sát được.
5. Kiểm tra báo cáo và chỉ xác nhận PASS với kịch bản đã thực thi. Kiểm thử tự động ở hai kích thước không chứng minh tuân thủ WCAG đầy đủ.

Không tự sửa giao diện khi yêu cầu chỉ là kiểm thử. Khi có lỗi, đề xuất thay đổi tối thiểu theo design system đang dùng.
