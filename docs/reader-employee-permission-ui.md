# Quản lý hồ sơ và quyền trong giao diện CTULib

Giao diện Vue sử dụng bố cục danh sách và hồ sơ của prototype SC23–SC24: danh sách có tìm kiếm, lọc, phân trang; hộp thoại xem chi tiết và thêm/sửa. Các thao tác lưu gọi API thật. Không có nút xóa vì API hiện tại của ba tài nguyên chưa hỗ trợ xóa.

| Đường dẫn | Chức năng | Điều kiện truy cập |
| --- | --- | --- |
| `#/reader` | Danh sách, thêm, xem và sửa độc giả | ADMIN |
| `#/employee` | Hồ sơ nhân viên và cấp/thu hồi quyền | ADMIN |
| `#/permission` | Danh mục quyền, thêm và sửa quyền | ADMIN |
| `#/manage` | Quản lý sách | EMPLOYEE hoặc ADMIN có `MANAGE_BOOKS` |
| `#/faculty` | Quản lý khoa/viện | EMPLOYEE hoặc ADMIN có `MANAGE_FACULTIES` |
| `#/author` | Quản lý tác giả | EMPLOYEE hoặc ADMIN có `MANAGE_AUTHORS` |

Các đường dẫn số nhiều `#/readers`, `#/employees`, `#/permissions` cũng được nhận diện.

## Tạo hồ sơ và cấp quyền

1. Đăng nhập tài khoản ADMIN và mở Độc giả hoặc Nhân viên.
2. Khi thêm hồ sơ, nhập ID của tài khoản đã tồn tại. Hồ sơ độc giả yêu cầu tài khoản READER; hồ sơ nhân viên yêu cầu EMPLOYEE hoặc ADMIN. Đây là ID MongoDB 24 ký tự, khác mã định danh CTU. API hiện tại chưa có danh sách tài khoản để chọn và không tạo tài khoản qua biểu mẫu hồ sơ.
3. Chọn khoa/viện khi tạo hồ sơ độc giả. Trạng thái chặn quyền mượn chỉ được hiển thị; biểu mẫu không gửi trường nghiệp vụ này.
4. Trong Quyền chức năng, tạo mã quyền chính xác theo bảng trên, kèm mô tả. Mã tùy chỉnh chỉ có tác dụng khi được nối vào chính sách frontend và backend.
5. Trong hồ sơ nhân viên, bấm Chỉnh sửa và chọn quyền cần cấp. Bỏ chọn để thu hồi; bỏ chọn tất cả gửi `permissionIds: []`. Hồ sơ nhân viên của tài khoản ADMIN cũng cần các quyền chức năng nếu muốn quản lý sách, khoa/viện hoặc tác giả.

## Luồng kiểm tra truy cập

`GET /api/v1/auth/me` trả thông tin tài khoản và tên quyền đang có trong DB, theo contract `{ status: "success", data: { accountId, ctuIdentifier, email, role, permissions } }`. Endpoint yêu cầu Bearer token và trả `Cache-Control: no-store`.

Frontend lấy thông tin này khi đăng nhập, khôi phục phiên và trước mỗi lần mở màn hình được bảo vệ. Trong lúc chờ, màn hình nội bộ chưa được mount. Khách được chuyển sang đăng nhập; tài khoản thiếu quyền hoặc không kiểm tra được quyền sẽ không được hiển thị màn hình. Khi đăng nhập thành công, ứng dụng quay lại màn hình đã yêu cầu.

Middleware backend tiếp tục là nơi quyết định quyền: `requireAdmin` đọc role/tình trạng hoạt động hiện tại; `requirePermission` đọc quyền từ hồ sơ nhân viên và danh mục quyền. Không suy ra quyền từ mã tài khoản cố định. Role ADMIN không thay thế quyền chức năng. Việc thu hồi quyền hoặc khóa tài khoản có hiệu lực ở yêu cầu API tiếp theo; khi người dùng điều hướng hoặc làm mới phiên, menu được cập nhật.

Danh sách hiện được tìm kiếm, lọc và phân trang trong trình duyệt vì API trả toàn bộ danh sách. Cần bổ sung phân trang phía API khi dữ liệu lớn.

## Kiểm tra

- `pnpm build`
- `pnpm --filter @ctulib/frontend test`
- `pnpm --filter @ctulib/backend exec tsx --test tests/access-control.test.ts tests/profile-modules.test.ts tests/book-create.test.ts`

Kiểm thử tự động dùng DOM và model giả lập, không kết nối DB thật. Kiểm thử bao gồm chặn mount trước khi xác thực, role/quyền, phản hồi đến muộn, thu hồi hết quyền, lỗi lưu dữ liệu và kiểm tra API không thể bỏ qua middleware.
