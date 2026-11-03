# Thiết lập staging authentication

## Trạng thái đã xác minh

- Render hiện có service `Bao_Cao_CTULib`, nhánh `main`, môi trường Production. Chưa có staging trong dự án này.
- `render.staging.yaml` là cấu hình đề xuất, chưa push hoặc triển khai. Chọn đường dẫn Blueprint này khi tạo staging từ repository.
- Nhập trực tiếp trên Render: `MONGODB_URI` của database staging riêng và `CLIENT_URL` là origin dùng khi test (không kèm path). Không chép database hoặc khóa production.
- Blueprint yêu cầu gói `free`, Dockerfile backend, nhánh `staging`, endpoint `/health`; khóa access token được Render sinh riêng. `NODE_ENV=production` giữ secure cookie cho HTTPS staging.
- Đã tạo database `ctulib_staging` trên cluster Atlas `VanDat` của dự án CTULib; collection khởi tạo `accounts` rỗng. Database `test` hiện có được giữ nguyên. Backend hiện dùng model tên `Acount`, nên collection tài khoản thực tế do Mongoose quản lý có thể khác collection khởi tạo này.
- Đã xác minh người dùng tạo tài khoản `vandat_Staging`, quyền `readWrite` trên `ctulib_staging`. Không đọc hoặc lưu mật khẩu.
- Đã chuẩn bị form Render New Web Service: `ctulib-api-staging`, nhánh `staging`, runtime Docker, Dockerfile `apps/backend/Dockerfile`, build context `.`, Virginia, Free, health `/health`, `CLIENT_URL=https://staging.bao-cao-ctulib.pages.dev`. Hai trường `MONGODB_URI` và `ACCESS_TOKEN_SECRET_KEY` còn trống để người dùng nhập trực tiếp; chưa submit tạo service.
- Chưa chạy test thật; chưa có báo cáo pass/fail.

## Frontend staging trên Cloudflare

Cloudflare Pages hỗ trợ preview nhánh `staging` và custom domain cho nhánh đó. Frontend Vue/Vite hiện có thể build thành static assets. Cần xác minh project và tên miền Cloudflare thực tế trước khi cấu hình.

Đã xác minh dashboard: project `bao-cao-ctulib` liên kết repository CTULib, production nhánh `main`; preview nhánh `staging` đã có commit `e69172e`. URL gốc `https://bao-cao-ctulib.pages.dev` hiện hiển thị trang mẫu Vue/Vite.

Đã chuẩn bị Pages Function `apps/frontend/functions/api/[[path]].js` chuyển tiếp `/api/*` tới biến runtime `API_ORIGIN` (origin HTTPS backend staging). Proxy giữ nguyên Origin, Cookie, Set-Cookie; không cache response. Đây là mã local, chưa deploy.

Đã xác minh Pages root directory là `apps/frontend`, build command `pnpm run build`, output `dist`; Functions nằm đúng thư mục `functions/` tại root app. Dashboard production đang có biến `NODE_VESION` (sai tên `NODE_VERSION`) và `VITE_API_URL` (frontend hiện đọc `VITE_API_BASE_URL`). Chưa chỉnh các biến trên dashboard.

Kiểm tra proxy bằng upstream mô phỏng đã đạt: giữ route/query, Origin, Cookie, Set-Cookie, redirect manual, no-store; cấu hình thiếu/sai trả 503, lỗi upstream trả 502. Không phải kết quả test trên staging thật.

Frontend staging dự kiến dùng alias `https://staging.bao-cao-ctulib.pages.dev` sau khi xác minh alias trên deployment. Để `VITE_API_BASE_URL` trống (same origin), đặt `API_ORIGIN` trong Preview environment thành origin Render staging, backend `CLIENT_URL` khớp chính xác frontend staging. Không dùng origin production cho staging.

Backend hiện đặt refresh cookie `SameSite=strict`; không dùng trực tiếp frontend `pages.dev` gọi API `onrender.com` để đánh giá phiên đăng nhập trong trình duyệt. Dùng hai HTTPS subdomain cùng tên miền (ví dụ `staging.example.com` và `api-staging.example.com`) hoặc proxy `/api` cùng origin. Đặt `CLIENT_URL` đúng origin frontend; `VITE_API_BASE_URL` đúng origin API nếu chọn subdomain riêng.

Tài liệu: https://developers.cloudflare.com/pages/how-to/custom-branch-aliases/

## Trình tự triển khai và kiểm thử

1. Đưa Blueprint lên repository; tạo service `ctulib-api-staging` với nhánh `staging`, nhập hai giá trị còn thiếu trực tiếp trên Render. Auto deploy tắt để tránh chạy song song với pipeline.
2. Tách webhook staging (`RENDER_STAGING_DEPLOY_HOOK_URL`) khỏi webhook production. Workflow hiện tại dùng chung `RENDER_DEPLOY_HOOK_URL` cho cả hai nhánh; cần sửa trước lần push staging tiếp theo.
3. Trigger staging deploy, chờ Render báo Live đúng commit. `/health` hiện chỉ báo tiến trình HTTP hoạt động, không kiểm tra MongoDB; cần kiểm chứng DB bằng request authentication.
4. Tạo/chọn environment Apidog riêng; xác minh URL server trỏ service staging, auth prefix `/api/v1/auth`, và header `Origin` khớp `CLIENT_URL`. Environment `6926376` trong workflow chưa được xác minh.
5. Chuẩn bị fixture theo suite 7294 trên DB staging. Không chạy nguyên script `seed-login-test-accounts.ts`: script hiện khóa vào localhost, route `/auth/login` cũ và từ chối NODE_ENV=production.
6. Chạy CLI với token lấy từ secret store và ID environment staging đã xác minh:

   ```sh
   apidog run --access-token "$APIDOG_TOKEN" --test-suite 7294 \
     -e "$APIDOG_STAGING_ENV_ID" -r cli,html,json
   ```

7. Workflow phải chạy suite sau khi deploy thành công, bỏ `continue-on-error: true`, lưu báo cáo kể cả khi test thất bại. Không coi script `pnpm test` hiện tại là kiểm thử thực tế.

Tham chiếu cấu hình: https://render.com/docs/blueprint-spec
