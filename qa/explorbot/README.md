# Bot kiểm thử khám phá giao diện CTULib

Bot dùng [Explorbot](https://github.com/testomatio/explorbot) để đóng vai tester thủ công: khảo sát giao diện, đề xuất test case, tự thao tác trình duyệt và ghi lại lỗi. Không cần tự viết Playwright test script.

## Chuẩn bị

1. Dùng Node.js 24+ và chạy `pnpm install` tại thư mục gốc CTULib.
2. Cài Chromium cho Playwright bằng `pnpm exec playwright install chromium`.
3. Chạy backend QA bằng `pnpm dev:api` (database thử nghiệm), sau đó chạy frontend tại cổng riêng bằng `pnpm qa:web`. Cổng 5174 tránh xung đột với ứng dụng khác đang chạy trên 5173.
4. Để chạy Explorbot qua dịch vụ AI, thiết lập API key bằng biến môi trường, ví dụ `OPENROUTER_API_KEY`. Chọn nhà cung cấp qua `EXPLORBOT_AI_PROVIDER` (mặc định `openrouter`). Không lưu key trong Git hoặc đưa key vào lệnh hiển thị công khai. Có thể dùng Ollama trên máy theo hướng dẫn bên dưới.

Với nhà cung cấp AI cloud, Explorbot cần **API key riêng**. Gói ChatGPT/Codex Plus không cấp quyền gọi API. Những cuộc kiểm thử có thể tạo/sửa dữ liệu nên chỉ chạy với database thử nghiệm.

## Kiểm thử giao diện không cần AI key

Khi frontend đang chạy bằng `pnpm qa:web`, mở terminal khác để chạy:

```bash
pnpm qa:smoke
```

Lệnh này tự kiểm tra danh mục sách, biểu mẫu đăng nhập, xác thực trường trống, ngăn khách truy cập màn hình nội bộ, lỗi JavaScript và tràn ngang ở 1366 px / 390 px. Báo cáo lần chạy gần nhất nằm tại `qa/explorbot/output/reports/ctulib-guest-smoke-latest.md` và `.json` cùng tên. HTTP 5xx do API chưa sẵn sàng được đánh dấu `BLOCKED` để kiểm tra riêng, không tự kết luận là lỗi frontend. Lệnh chỉ đọc dữ liệu và dùng một lần gửi biểu mẫu đăng nhập trống.

## Chạy Explorbot với Ollama local

Chế độ này không cần API key. Explorbot dùng `qwen2.5-coder:14b` để đọc trang/lập kế hoạch và `qwen2.5vl:3b` để phân tích hình ảnh. Hai model cần được cài trong Ollama trước khi chạy bài khám phá đầy đủ.

```bash
ollama pull qwen2.5-coder:14b
ollama pull qwen2.5vl:3b
OLLAMA_CONTEXT_LENGTH=16384 ollama serve
```

Nếu Ollama đã chạy, hãy chỉnh giới hạn ngữ cảnh ở tiến trình server hiện có và khởi động lại, thay vì khởi chạy thêm server trùng cổng. Giới hạn mặc định 4096 có thể làm Explorbot cắt mất chỉ dẫn và dữ liệu trang. Để lập test plan, chạy:

```bash
EXPLORBOT_AI_PROVIDER=ollama pnpm qa:plan '/#/auth' --focus 'xác thực biểu mẫu đăng nhập'
```

Chạy khám phá trên dữ liệu QA khi model thị giác và backend đã sẵn sàng:

```bash
EXPLORBOT_AI_PROVIDER=ollama pnpm qa:explore '/#/catalog' --max-tests 3 --max-duration 10
```

Có thể đổi model qua `EXPLORBOT_OLLAMA_MODEL`, `EXPLORBOT_OLLAMA_AGENT_MODEL`, `EXPLORBOT_OLLAMA_VISION_MODEL` và địa chỉ Ollama qua `OLLAMA_BASE_URL`. Model local có thể không tuân thủ đủ các yêu cầu gọi tool/JSON của Explorbot. Hãy đối chiếu kết quả sinh ra với báo cáo thực tế trước khi kết luận PASS.

## Chạy bot

Từ thư mục gốc dự án, ví dụ kiểm thử chức năng tra cứu sách:

```bash
pnpm qa:context '/#/catalog'
pnpm qa:plan '/#/catalog' --focus 'tìm kiếm, bộ lọc, phân trang, xem chi tiết sách'
pnpm qa:explore '/#/catalog' --max-tests 5 --max-duration 15 --focus 'tra cứu sách'
```

Để quan sát bot thao tác trực tiếp trong trình duyệt:

```bash
pnpm qa:start '/#/catalog' --show
```

Trong giao diện tương tác nhập `/explore` để bot tự khảo sát, lên kế hoạch rồi chạy test. Nhập `/plan` nếu chỉ muốn sinh test case.

Để chọn màn hình khác, thay `/#/catalog` bằng `/#/auth`, `/#/my-loans`, `/#/manage`, `/#/dashboard`, `/#/loans`, `/#/penalties` hoặc `/#/accounts`. Các màn hình được bảo vệ cần tài khoản QA có quyền tương ứng.

Ví dụ với một bản staging:

```bash
EXPLORBOT_URL='https://staging.example.com' pnpm qa:explore '/#/catalog' --max-tests 5
```

Với bài test đăng nhập, hãy sử dụng tài khoản giả được cấp riêng cho QA. Có thể cung cấp thông tin đăng nhập bằng `--auth` hoặc `EXPLORBOT_AUTH` như hướng dẫn chính thức của Explorbot, tránh đưa mật khẩu vào file được commit.

## Kết quả kiểm thử

- `qa/explorbot/output/plans/` chứa test case có thể giữ lại và chạy lại.
- `qa/explorbot/output/reports/` chứa báo cáo lỗi và kết quả kiểm thử.
- `qa/explorbot/output/tests/` chứa test tự động được bot sinh ra từ những luồng chạy thành công.
- `qa/explorbot/output/` cũng lưu các bằng chứng khác do Explorbot tạo. `qa/explorbot/experience/` chứa kinh nghiệm cho những lần chạy sau.

Hai thư mục kết quả và kinh nghiệm được loại khỏi Git để tránh commit nhầm dữ liệu nhạy cảm. Chỉ sao chép các test case đã xem xét và dữ liệu thử nghiệm thích hợp vào bộ test cố định của nhóm.

Lệnh `qa:explore` có thể trả exit code `0` ngay cả khi kịch bản thất bại. Hãy đọc báo cáo trong `output/reports/` để đánh giá số test PASS/FAIL và lỗi phát hiện. Khi đổi độ rộng trình duyệt, có thể đặt `CTULIB_QA_VIEWPORT=390x844` để kiểm tra ở kích thước điện thoại.
