# Bộ API, test case và dataset faculty

Trạng thái: **Đã nhập thành công vào dự án CTULib API (ID: 1405851)**. Đã tạo Test Suite `Module Faculty - 54 ca kiểm thử API` (ID: 7398) và Test Data `Faculty Dataset - Đối chiếu 54 ca kiểm thử` (ID: 3680043). Toàn bộ 54 test case đã chạy đạt 100% trên môi trường `http://localhost:8080` (ID: 6954558) và đồng bộ báo cáo lên Apidog Cloud.

Kết quả kiểm thử chính thức: **54/54 đạt (100% PASS)** sau khi hoàn tất 4 sửa đổi backend:

1. `faculty.service.ts`, đầu hàm `updateFaculaty`: kiểm tra ID 24 ký tự hex và ném `AppError("Mã khoa không hợp lệ", 400)` như hàm GET/DELETE; hiện PUT ID sai trả 500.
2. `faculty.service.ts`, nhánh không tìm thấy trong `updateFaculaty`: đổi 400 thành 404.
3. `faculty.service.ts`, nhánh không tìm thấy trong `deleteFaculaty`: đổi 400 thành 404.
4. `faculty.controller.ts`, `updateFacultyController`: đổi `status: "succes"` thành `status: "success"`; lỗi này làm 7 ca cập nhật thất bại dù dữ liệu đã được cập nhật.

Tất cả kiểm tra dọn fixture trong runner đều đạt. Lần chạy bổ sung 63 kiểm tra trong `../faculty-http-retest-results.json` cũng xác nhận lỗi tương tự và ca tạo trùng đồng thời trả một 201, một 409. Số 63 bao gồm kiểm tra dọn/xác minh xóa; không cộng hai lượt chạy thành số test case độc lập.

## File dùng để import

- `faculty.apidog.json`: 5 endpoint và 54 test case có pre/post script, assertion và fixture riêng.
- `faculty.openapi.json`: cùng 5 endpoint, schema request/response để đọc hoặc import OpenAPI; **không dùng file này thay file Apidog nếu cần test case**.
- 5 file `*.dataset.csv`: tổng 54 dòng, chia theo endpoint; nhập vào Test Data nếu cần dùng dạng bảng.
- `cases.json`: danh mục đầu vào tạo bộ test.
- `execution-results.json`: kết quả chạy chính script của bộ import bằng HTTP + môi trường pm mô phỏng, không phải kết quả của Apidog.

| Method | Path | Dataset |
| --- | --- | --- |
| GET | /faculty | GET_faculty.dataset.csv |
| GET | /faculty/{id} | GET_faculty_id.dataset.csv |
| POST | /faculty | POST_faculty.dataset.csv |
| PUT | /faculty/{id} | PUT_faculty_id.dataset.csv |
| DELETE | /faculty/{id} | DELETE_faculty_id.dataset.csv |

## Cách dùng

1. Chọn Import > Apidog trong dự án CTULib, chọn `faculty.apidog.json`.
2. Xem preview: chỉ thư mục Faculty, 5 API và 54 test case. Chưa kiểm tra import bằng ứng dụng nên cần kiểm tra preview trước khi xác nhận; không chọn ghi đè API khác.
3. Chọn môi trường có Base URL `http://localhost:8080`, hoặc `http://127.0.0.1:8080`.
4. Chạy các test case trong Faculty. Pre-script chỉ cho phép hai URL local trên. Script tạo fixture có tiền tố `QA_FAC_`, giữ ID trong biến cục bộ, và post-script dọn đúng các fixture đó.
5. CSV là bảng đối chiếu dữ liệu cho từng case, không phải seed DB. Case đã có body riêng; không lặp mỗi case với toàn bộ dòng dataset. Các biến `qaName`, `qaName100`, `qaFacultyId` được pre-script tạo lúc chạy; CSV không chứa ID cũ của database.

Các case độc lập, có thể chạy riêng. Nếu hủy request/ứng dụng giữa chừng, post-script không được bảo đảm chạy; xem log/fixture của lượt đó để dọn, không xóa khoa sẵn có. Pre-script lỗi tạo fixture sẽ báo BLOCKED. Dùng thao tác Run test case để có script; gửi trực tiếp API mặc định không tự tạo fixture.

## Tiêu chí và phạm vi

- GET danh sách; GET tồn tại, ID sai, không tồn tại.
- POST và PUT: thiếu trường, null, sai kiểu, rỗng/khoảng trắng, tên 100/101 ký tự, mô tả 1000/1001 ký tự, mô tả tùy chọn/rỗng, trường dư, trim, tên trùng.
- PUT cùng tên hiện tại; DELETE tồn tại, ID sai, không tồn tại.
- Kiểm tra mã HTTP, `status`, `_id`, dữ liệu trả về, message chung và `errors` từng trường. Success không bắt buộc `message` vì controller hiện không trả trường này.
- Tiêu chí đề xuất từ review: ID sai 400, không tồn tại 404, trùng 409; không đổi tiêu chí theo lỗi backend để làm test xanh.
- Backend hiện chưa gắn auth cho faculty. Chưa có yêu cầu quyền để khẳng định đây là thiết kế đúng; bộ này không giả lập hợp đồng quyền chưa được chốt.
- Test chạy đồng thời nằm trong `../faculty-http-retest.mjs`, không được tính vào 54 case import. Chưa bao phủ xóa khoa có sách, kiểm thử tải và các bất biến DB khác.
- Post-script gửi DELETE để dọn fixture; runner HTTP có thêm GET xác minh fixture đã mất. Chưa xác minh độ tương thích script và import trong ứng dụng Apidog thật.

## Chạy lại bằng CLI

Từ gốc repository, với backend test đang chạy ở cổng 8080:

```sh
node docs/qa/run-faculty-apidog-bundle.mjs
node docs/qa/faculty-http-retest.mjs
```

Tạo lại JSON/CSV từ nguồn:

```sh
python3 docs/qa/build-faculty-apidog.py
```

Không sửa code backend khi tạo hoặc chạy bộ test.
