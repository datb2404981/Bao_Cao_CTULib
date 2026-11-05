# Kiểm thử HTTP faculty ngày 04/11/2026

- Môi trường: http://localhost:8080, gọi trực tiếp bằng curl; không chạy bằng Apidog.
- Connector Apidog thất bại hai lần với MCP SSE probe returned 429; giao diện bị chặn do Accessibility denied.
- Đã đọc route/controller/service/schema/model và middleware hiện tại.
- 30 ca dự kiến: 29 request đã chạy, 1 ca bị từ chối quyền. 25 request khớp mã HTTP mong đợi, 4 không khớp.
- Khớp mã HTTP không đồng nghĩa toàn bộ response/nghiệp vụ đều đạt. Chưa có hợp đồng faculty trên Apidog để xác minh; mã mong đợi là tiêu chí review (ID sai 400, không tồn tại 404, trùng 409).
- Ba bản ghi QA riêng đã được tạo rồi xóa, cả ba DELETE trả 200. Không sửa code ứng dụng.

## Các ca đã chạy

| Ca | Method | Path | Mã mong đợi | Thực tế | Kết quả mã HTTP |
| --- | --- | --- | --- | --- | --- |
| LIST | GET | /faculty | 200 | 200 | Khớp |
| GET_BAD_ID | GET | /faculty/invalid | 400 | 500 | Không khớp |
| GET_MISSING | GET | /faculty/000000000000000000000001 | 404 | 404 | Khớp |
| DELETE_BAD_ID | DELETE | /faculty/invalid | 400 | 500 | Không khớp |
| DELETE_MISSING | DELETE | /faculty/000000000000000000000001 | 404 | 400 | Không khớp |
| POST_EMPTY_BODY | POST | /faculty | 400 | 400 | Khớp |
| POST_MISSING_NAME | POST | /faculty | 400 | 400 | Khớp |
| POST_NULL_NAME | POST | /faculty | 400 | 400 | Khớp |
| POST_NUMBER_NAME | POST | /faculty | 400 | 400 | Khớp |
| POST_ARRAY_NAME | POST | /faculty | 400 | Không chạy | BLOCKED |
| POST_OBJECT_NAME | POST | /faculty | 400 | 400 | Khớp |
| POST_EMPTY_NAME | POST | /faculty | 400 | 400 | Khớp |
| POST_SPACE_NAME | POST | /faculty | 400 | 400 | Khớp |
| POST_NAME_101 | POST | /faculty | 400 | 400 | Khớp |
| POST_DESC_1001 | POST | /faculty | 400 | 400 | Khớp |
| POST_NULL_DESC | POST | /faculty | 400 | 400 | Khớp |
| POST_NUMBER_DESC | POST | /faculty | 400 | 400 | Khớp |
| POST_EXTRA_FIELD | POST | /faculty | 400 | 400 | Khớp |
| PUT_ID_REJECTED | PUT | /faculty | 400 | 400 | Khớp |
| PUT_NO_ID | PUT | /faculty | 400 | 400 | Khớp |
| CREATE_VALID | POST | /faculty | 201 | 201 | Khớp |
| CREATE_NAME_100 | POST | /faculty | 201 | 201 | Khớp |
| CREATE_DESC_1000 | POST | /faculty | 201 | 201 | Khớp |
| GET_EXISTING | GET | /faculty/6aeb5118b44c27ca449f0b1d | 200 | 200 | Khớp |
| CREATE_DUPLICATE | POST | /faculty | 409 | 409 | Khớp |
| PUT_EXISTING_WITH_BODY_ID | PUT | /faculty | 200 | 400 | Không khớp |
| PUT_EXISTING_PATH_ID | PUT | /faculty/6aeb5118b44c27ca449f0b1d | 404 | 404 | Khớp |
| DELETE_CREATE_VALID | DELETE | /faculty/6aeb5118b44c27ca449f0b1d | 200 | 200 | Khớp |
| DELETE_CREATE_NAME_100 | DELETE | /faculty/6aeb5119b44c27ca449f0b20 | 200 | 200 | Khớp |
| DELETE_CREATE_DESC_1000 | DELETE | /faculty/6aeb511bb44c27ca449f0b23 | 200 | 200 | Khớp |

## Lỗi đã tái hiện

1. GET /faculty/invalid và DELETE /faculty/invalid trả 500 với message "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau."; cần kiểm tra ID đầu vào và trả 400.
2. DELETE với ID hợp lệ không tồn tại trả 400 "Khoa không tồn tại"; tiêu chí đề xuất là 404, như GET.
3. PUT /faculty với facultyId của khoa vừa tạo trả 400 "Dữ liệu gửi lên không hợp lệ". facultySchema.strict() không cho facultyId; bỏ ID thì service không tìm được khoa. PUT /faculty/:id chưa có route (404). Chưa thể cập nhật thành công qua route hiện có.
4. Validation không trả errors từng trường dù middleware có tính errors. Các ca sai đều nhận message chung.

## Quan sát tĩnh cần sửa

- faculty.controller.ts:20 dùng status: "succes" thay vì "success"; nhánh cập nhật thành công chưa tới được khi test HTTP.
- faculty.model.ts dùng require thay vì required.
- Route faculty không gắn middleware xác thực/phân quyền. Chưa có hợp đồng quyền khoa để chấm đạt/trượt, nhưng các ca tạo/xóa đã chạy không có Authorization.
- Chưa xử lý MongoDB 11000 cho hai request trùng đồng thời.
- Chưa chặn xóa khoa được sách tham chiếu.

## Message đã xác minh

- Trùng tên: 409, "Khoa đã tồn tại".
- GET không tồn tại: 404, "Khoa không tồn tại".
- DELETE không tồn tại: 400, "Khoa không tồn tại".
- Body sai: 400, "Dữ liệu gửi lên không hợp lệ".
- ID sai ở GET/DELETE: 500, "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.".

## Giới hạn

Chưa chạy trong Apidog, chưa test race condition, xóa khoa có sách, quyền truy cập theo vai trò, tải lớn hoặc nhánh cập nhật thành công. Không chạy lại ca tên dạng mảng đã bị từ chối. Dữ liệu phản hồi chi tiết có trong faculty-http-results-2026-11-04.json; GET danh sách chỉ giữ số lượng, không lưu nội dung khoa sẵn có.

