# CTULib Backend - Module Conventions

- **Tech Stack**: Node.js ESM (`"type": "module"`), Express 4, TypeScript 5, Mongoose 8, Zod 3, Winston.
- **Paradigm & Flow**:
  - Functional Only: Export từng async arrow function cho controller & service.
  - Luồng: `routes/` (đăng ký router + validation middleware) → `controllers/` (trích xuất req/res, gọi service, bọc `try/catch(next)`) → `services/` (nghiệp vụ, query DB) → `models/` (Mongoose schema).
- **Ràng buộc quan trọng (Strict Constraints)**:
  - **ESM Relative Imports**: Mọi local import BẮT BUỘC có đuôi `.js` (ví dụ: `import { userModel } from "../models/user.model.js"`).
  - **Validation**: Dùng Zod schema qua middleware validate body/query/params; không validate thủ công trong controller.
  - **Error Handling**: Ném `AppError(msg, status)` trong service. Controller chuyển qua `next(error)`. Không tự gửi response lỗi tùy tiện.
  - **Auth & RBAC**: JWT Bearer token qua header `Authorization` hoặc cookie; dùng auth/role middlewares.
- **Lệnh thực thi**:
  - Dev: `pnpm --filter @ctulib/backend dev` (chạy qua `tsx watch src/server.ts`)
  - Build: `pnpm --filter @ctulib/backend build` (`tsc`)
  - Typecheck file: `pnpm --filter @ctulib/backend exec tsc --noEmit`

