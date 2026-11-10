# CTULib Frontend - Module Conventions

- **Tech Stack**: Vue 3 (Composition API `<script setup lang="ts">`), Vite 8, TypeScript 5.7, Vitest, Happy-DOM, Scoped CSS.
- **Routing & Views (Hash-based Routing)**:
  - Quản lý view qua hash (`#/catalog`, `#/manage`, `#/faculty`, `#/author`, `#/reader`, `#/employee`, `#/permission`, `#/my-loans`, `#/loans`, `#/auth`).
  - Middleware bảo vệ điều hướng: `src/middlewares/access.ts` (`canAccess`, `guardView`).
  - Views chính (`src/views/`):
    - Khách / Độc giả: `BookCatalogView` (tìm kiếm/đặt sách), `MyLoansView` (lịch sử mượn cá nhân).
    - Quản lý / Thủ thư: `BookManagementView` (sách), `FacultyManagementView` (khoa), `AuthorManagementView` (tác giả), `PeopleManagementView` (độc giả/nhân viên/quyền), `LoansManagementView` (lưu thông mượn-trả toàn viện).
- **Paradigm & State**:
  - Không dùng Pinia/Vuex; dùng module-level reactive primitives (`ref`, `reactive`, `computed`).
  - `src/services/`: Bọc REST API qua helper `request()` (`auth`, `book`, `faculty`, `author`, `loan`, `people`), tự động đính kèm Bearer token và refresh session.
- **Ràng buộc quan trọng (Strict Constraints)**:
  - **API Contract**: Luôn unwrap `{ status: "success", data: T }`; bắt `AuthError` khi lỗi.
  - **CORS / Credentials**: `credentials: 'include'` cho toàn bộ fetch requests.
  - **Env**: Dùng `import.meta.env.VITE_API_BASE_URL` (mặc định proxy `/api/v1` qua Vite dev server).
- **Lệnh thực thi**:
  - Dev server: `pnpm --filter @ctulib/frontend dev`
  - Test: `pnpm --filter @ctulib/frontend test`
  - Build & Typecheck: `pnpm --filter @ctulib/frontend build` (`vue-tsc -b && vite build`)
