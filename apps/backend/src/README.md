# Cấu trúc backend

- `server.ts`: chạy server và gọi kết nối MongoDB.
- `app.ts`: cấu hình Express, đăng ký routes và middleware.
- `config/`: cấu hình database, logger.
- `routes/`: khai báo đường dẫn API.
- `controllers/`: nhận request, gọi service và trả response.
- `services/`: xử lý nghiệp vụ.
- `models/`: khai báo schema và model Mongoose.
- `middlewares/`: xử lý chung như lỗi, xác thực sau này.

Luồng xử lý: route → controller → service → model.

Ví dụ khi thêm chức năng sách: tạo `models/book.model.ts`,
`services/book.service.ts`, `controllers/book.controller.ts`,
`routes/book.routes.ts`, rồi đăng ký route trong `routes/index.ts`.
Chỉ tạo những file cần dùng cho chức năng đang làm.

Chạy từ thư mục gốc:

```sh
pnpm --filter @ctulib/backend dev
pnpm --filter @ctulib/backend build
```

API kiểm tra hiện có: `GET /health`.
