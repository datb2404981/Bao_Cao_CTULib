# CTULib - Hệ Thống Quản Lý Thư Viện

Hệ thống quản lý thư viện hiện đại, toàn diện và phân quyền theo vai trò (Độc giả, Nhân viên thư viện, Quản trị viên). Dự án được thiết kế theo mô hình Monorepo hiệu năng cao với kiến trúc hàm chức năng (Functional Architecture), đảm bảo tính module hóa, bảo mật và khả năng mở rộng.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

* **Kiến trúc**: Monorepo quản lý bằng `pnpm workspace`.
* **Backend (`apps/backend`)**:
  * Node.js, Express, TypeScript.
  * Cơ sở dữ liệu: MongoDB với Mongoose ODM.
  * Xác thực & Phân quyền: JWT (Access Token, Refresh Token), Cookie HttpOnly, RBAC.
  * Xác thực dữ liệu: Zod schema validation.
* **Frontend (`apps/frontend`)**:
  * Vue 3 (Composition API), TypeScript, Vite.
  * Styling: Tailwind CSS, CSS Custom Properties responsive.
  * Quản lý trạng thái: Pinia / Vue Reactive Stores.
  * Kiểm thử UI: Vitest, Vue Test Utils.
* **Hạ tầng & Đóng gói**:
  * Docker, Docker Compose.
  * CI/CD: GitHub Actions tự động kiểm thử và kiểm tra chất lượng mã nguồn.
  * Đặc tả API: Chuẩn OpenAPI 3.0 (`docs/CTULib_API.openapi.yaml`).

---

## 📁 Cấu Trúc Dự Án

```text
CTULib/
├── apps/
│   ├── backend/            # REST API Service (Express + MongoDB)
│   │   ├── src/
│   │   │   ├── config/     # Kết nối Database, cấu hình ứng dụng
│   │   │   ├── controllers/# Xử lý Request/Response (Pure Async Functions)
│   │   │   ├── middlewares/# Auth, Error handler, Validation, RBAC
│   │   │   ├── models/     # Mongoose Schemas & Models
│   │   │   ├── routes/     # Định tuyến API
│   │   │   ├── schemas/    # Zod Schemas
│   │   │   ├── scripts/    # Scripts seed dữ liệu khởi tạo (Admin, Sách)
│   │   │   └── services/   # Business Logic độc lập
│   │   └── tests/          # Unit & Integration Tests
│   └── frontend/           # Single Page Application (Vue 3 + Vite)
│       ├── src/
│       │   ├── assets/     # Style & hình ảnh tĩnh
│       │   ├── components/ # UI Components tái sử dụng
│       │   ├── router/     # Vue Router cấu hình phân quyền
│       │   ├── services/   # Axios API client services
│       │   └── views/      # Giao diện chính (Catalog, Loans, Quản trị)
│       └── tests/          # UI Component & Store Tests
├── docs/                   # Tài liệu kỹ thuật & Đặc tả OpenAPI
├── infra/                  # Cấu hình hạ tầng & Docker Compose
├── package.json            # Cấu hình workspace gốc
├── pnpm-workspace.yaml     # Định nghĩa workspace monorepo
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Local

### Yêu Cầu Môi Trường
* **Node.js**: Phiên bản 18+ (khuyên dùng Node 20 LTS)
* **pnpm**: Phiên bản 9.x (`npm install -g pnpm`)
* **MongoDB**: Phiên bản 6.0+ (Local hoặc MongoDB Atlas URI)

### 1. Cài đặt Dependencies
Tại thư mục gốc của dự án:
```bash
pnpm install
```

### 2. Cấu hình Biến Môi Trường (.env)

Tạo file `.env` bên trong thư mục `apps/backend/`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/ctulib
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

*(Lưu ý: Không bao giờ commit file `.env` lên GitHub).*

### 3. Khởi tạo Dữ liệu Ban Đầu (Seeding)
Chạy các script tạo tài khoản Quản trị và danh mục sách mẫu:
```bash
# Tạo tài khoản Quản trị viên mặc định
pnpm --filter @ctulib/backend run seed:admin

# Tạo dữ liệu sách mẫu
pnpm --filter @ctulib/backend run seed:books
```

### 4. Khởi chạy Ứng Dụng ở Môi Trường Dev

* **Chạy đồng thời cả Backend và Frontend**:
  ```bash
  pnpm dev
  ```
* Hoặc chạy riêng biệt từng dịch vụ:
  * Backend API: `pnpm dev:api` (mặc định tại `http://localhost:5000`)
  * Frontend Web: `pnpm dev:web` (mặc định tại `http://localhost:5173`)

---

## 🧪 Kiểm Thử & Kiểm Tra Mã Nguồn

```bash
# Kiểm tra định dạng và quy chuẩn code (Lint)
pnpm lint

# Chạy toàn bộ Unit / Integration Tests
pnpm test

# Biên dịch toàn bộ dự án (Type Check + Build Production)
pnpm build
```

---

## 📦 Triển Khai Lên Production (Deployment)

1. **Backend**:
   * Chạy lệnh `pnpm --filter @ctulib/backend build` để biên dịch TypeScript ra thư mục `dist/`.
   * Cấu hình các biến môi trường production (`NODE_ENV=production`, `MONGODB_URI`, `CORS_ORIGIN` trỏ đến domain web thật).
   * Khởi chạy với lệnh `node apps/backend/dist/server.js` hoặc triển khai bằng `Dockerfile` có sẵn tại `apps/backend/Dockerfile`.
2. **Frontend**:
   * Chạy lệnh `pnpm --filter @ctulib/frontend build` để xuất gói static bundle vào `apps/frontend/dist/`.
   * Đưa thư mục `dist/` lên Vercel, Netlify hoặc Nginx Web Server.
