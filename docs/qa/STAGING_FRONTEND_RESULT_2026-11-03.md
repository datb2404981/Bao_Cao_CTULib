# Kiểm thử frontend staging — 03/11/2026

## Kết quả thực tế trên Chrome

Địa chỉ: https://staging.bao-cao-ctulib.pages.dev/

**8 nhóm đạt, 3 nhóm thất bại, 2 luồng bị chặn.** Thao tác trực tiếp qua giao diện Chrome, không mock backend. Các nhóm này là checklist frontend độc lập, không phải suite Apidog đã chạy.

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| Tải trang và hiển thị form đăng nhập/đăng ký | PASS | Đúng tiêu đề CTULib, nhãn trường và nút chuyển mode |
| Submit login rỗng | PASS | Hai lỗi mã định danh/mật khẩu; focus về mã định danh |
| Chuyển sang đăng ký | PASS | Có email/xác nhận mật khẩu, xóa lỗi cũ |
| Submit đăng ký rỗng | PASS | Cả bốn trường hiển thị lỗi |
| Mã/email sai, password 7 ký tự, xác nhận khác | PASS | Bốn thông báo lỗi tương ứng |
| Hiện/ẩn mật khẩu | PASS | Cả password và confirmation đổi giữa text và masked |
| Trạng thái đang gửi | PASS | Nút Đang xử lý; field và nút chuyển mode bị khóa, sau lỗi mở lại |
| Đổi từ đăng ký về login | PASS | Xóa password và thông báo lỗi, giữ identifier |
| Đăng ký dữ liệu hợp lệ qua frontend | FAIL | Hiện Yêu cầu không thành công. Vui lòng thử lại. |
| Đăng nhập tài khoản QA hợp lệ bằng Enter | FAIL | Backend trực tiếp login 200; frontend vẫn báo lỗi chung |
| Tải lại trang khi chưa đăng nhập | FAIL | Ngay khi vào form có lỗi chung do bootstrap refresh thất bại |
| Giữ phiên đã đăng nhập khi reload | BLOCKED | Không đăng nhập được qua frontend |
| Đăng xuất qua frontend | BLOCKED | Không vào được trạng thái đã đăng nhập |

## Lỗi chặn tích hợp

POST qua Cloudflare tới cả `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh` đều trả **405**, không có Content-Type JSON. Kiểm tra HTTP bổ sung dùng body rỗng, không tạo account.

Để loại trừ sai thông tin đăng nhập, đã tạo fixture READER `B4656358` qua backend staging (201), login trực tiếp (200), logout cả phiên register/login (200). Sau đó cùng fixture được nhập vào trình duyệt; frontend login thất bại. Không lưu password, JWT hay cookie trong báo cáo. Account QA vẫn còn trong staging DB.

Nguyên nhân triển khai đã xác định: frontend gọi API cùng origin; Pages Function proxy nằm trong working tree nhưng chưa triển khai. Cần deploy proxy `/api/*` và cấu hình runtime API_ORIGIN tới backend staging, sau đó chạy lại các luồng thành công. Không kết luận luồng browser cookie/refresh/logout đạt từ kết quả HTTP trực tiếp của backend.

## Giới hạn

Chưa kiểm tra responsive mobile, trình duyệt khác, accessibility toàn diện, keyboard-only toàn bộ trang, tải cao hoặc hiệu năng. Screenshot công cụ không đủ rõ để chấm chính xác bố cục; không kết luận visual regression đạt. Không sửa backend, Cloudflare hoặc deploy trong lượt kiểm thử frontend này.
