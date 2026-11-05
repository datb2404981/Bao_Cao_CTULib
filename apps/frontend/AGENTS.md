# CTULib Frontend - Module Conventions

- **Tech Stack**: Vue 3 (Composition API `<script setup lang="ts">`), Vite 8, TypeScript 6, Vitest, Happy-DOM, CSS Modules / scoped CSS.
- **Paradigm & State**:
  - Không dùng Vuex/Pinia phức tạp; quản lý reactive state bằng module-level reactive primitives (`ref`, `reactive`, `readonly`).
  - `src/services/`: Chứa các hàm gọi REST API qua `fetch` (bọc trong `request()` helper), quản lý session JWT (`accessToken`), xử lý timer refresh token.
  - `src/components/` & `src/views/`: UI presentation, binding dữ liệu và bắt sự kiện.
- **Ràng buộc quan trọng (Strict Constraints)**:
  - **API Contract Handling**: Bắt buộc kiểm tra `result?.status === 'success'` và unwrap trường `.data`.
  - **Error Class**: Ném `AuthError(message, status, fields)` khi server trả lỗi hoặc mất mạng.
  - **CORS / Credentials**: Gọi API luôn bật `credentials: 'include'` phục vụ xác thực cookie và Bearer header.
  - **Environment**: Dùng `import.meta.env.VITE_API_BASE_URL` cho base URL.
- **Lệnh thực thi**:
  - Dev server: `pnpm --filter @ctulib/frontend dev`
  - Unit/Component Test: `pnpm --filter @ctulib/frontend test`
  - Build & Typecheck: `pnpm --filter @ctulib/frontend build` (`vue-tsc -b && vite build`)

