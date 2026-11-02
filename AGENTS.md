# Hướng dẫn làm việc với CTULib

Luôn trả lời bằng tiếng Việt. Giữ nguyên tên biến, API và thông báo lỗi khi trích dẫn.

## Bản đồ dự án

- Monorepo dùng pnpm; xem package.json tại gốc và tại từng app để xác minh lệnh trước khi chạy.
- apps/backend: Express, TypeScript, Mongoose và Zod. Điểm vào: src/server.ts và src/app.ts.
- apps/backend/src/routes: đăng ký endpoint; controllers: xử lý HTTP; services: nghiệp vụ; models: dữ liệu; schemas: validation; middlewares: kiểm tra request và lỗi; utils: tiện ích.
- Luồng auth hiện có: routes/index.ts → routes/auth.route.ts → controllers/user.controller.ts → services/user.service.ts. Đối chiếu schemas/auth.schema.ts, models/user.model.ts, utils/jwt.util.ts và middlewares khi câu hỏi có liên quan. Xác minh lại import trong code vì cấu trúc có thể thay đổi.
- apps/frontend: Vue 3, Vite và TypeScript; bắt đầu từ src/main.ts, src/App.vue và src/components.
- docs/CTULib_API.openapi.yaml và docs/qa: hợp đồng API và tài liệu kiểm thử. Đối chiếu với code hiện tại, không mặc định tài liệu luôn đúng.

## Cách kiểm tra code

Trước khi kết luận về chức năng, tìm symbol và đọc file triển khai cùng nơi gọi/phụ thuộc trực tiếp. Với API, kiểm tra route, validation, controller, service và dữ liệu liên quan; với giao diện, kiểm tra component và luồng gọi API thực tế. Dẫn đường dẫn file làm bằng chứng. Không nạp toàn bộ repository hoặc danh sách skills không cần thiết. Không tuyên bố hiểu toàn dự án chỉ từ bản đồ này.

Không đọc .env, credentials hoặc secrets. Giữ nguyên thay đổi đang có của người dùng. Chế độ ask chỉ đọc/phân tích; chỉ chỉnh sửa hoặc chạy lệnh khi chế độ và quyền cho phép.

Script test của backend hiện chỉ in thông báo; không coi chạy thành công script đó là bằng chứng code đã được kiểm thử.
