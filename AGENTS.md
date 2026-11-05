# CTULib - Architecture & Conventions

- **Tech Stack**: Monorepo (pnpm workspace), TypeScript, Express, Mongoose, Zod, Vue 3, Vite, Vitest.
- **Coding Paradigm**: Functional Architecture. 100% async arrow functions/pure functions cho controllers và services (KHÔNG dùng Class cho services/controllers).
- **Workspace Layout**:
  - `apps/backend/`: REST API service (xem chi tiết tại `apps/backend/AGENTS.md`).
  - `apps/frontend/`: SPA client Vue 3 (xem chi tiết tại `apps/frontend/AGENTS.md`).
  - `docs/`: OpenAPI spec (`CTULib_API.openapi.yaml`) & tài liệu QA.
- **Global Rules**:
  - Luôn trả lời và viết tài liệu bằng tiếng Việt; giữ nguyên symbol, API, biến.
  - Package Manager: `pnpm` (`pnpm dev`, `pnpm build`, `pnpm test`).
  - Response Contract: Thành công `{ status: "success", data: T }`, Lỗi `{ status: "error", message: string, data: null }`.
  - Error Contract: Ném `AppError(message, statusCode)` để middleware tập trung xử lý.
  - TypeScript: Cấm `any`, dùng strict types / `unknown` với type narrowing.
  - Bảo mật: Không đọc/ghi file `.env` hoặc credentials.
- **Common Commands**:
  - Chạy dev: `pnpm dev` (hoặc `pnpm dev:api`, `pnpm dev:web`)
  - Build toàn bộ: `pnpm build`
  - Lint: `pnpm lint`
