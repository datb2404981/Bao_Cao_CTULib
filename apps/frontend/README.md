# CTULib frontend

Vue 3 + TypeScript + Vite. Module authentication tích hợp backend hiện tại:

- Đăng nhập bằng `ctuIdentifier` và `password`.
- Đăng ký bằng `ctuIdentifier`, `email`, `password`; xác nhận mật khẩu chỉ kiểm tra trên frontend.
- Khôi phục phiên khi tải trang, tự làm mới access token, đăng xuất.
- Access token chỉ giữ trong bộ nhớ; refresh token do backend quản lý bằng cookie HttpOnly. Không lưu mật khẩu hoặc token trong localStorage.
- Backend chưa có API quên mật khẩu hay lấy hồ sơ; màn hình tài khoản chỉ hiển thị dữ liệu hiện có. Sau khi tải lại trang, refresh không trả email nên trường email được ẩn.

## Chạy tại máy

Từ thư mục gốc repository:

```sh
pnpm install
pnpm --filter @ctulib/frontend dev
```

Mở `http://localhost:5173`. Backend mặc định ở `http://localhost:8080`; đặt `CLIENT_URL` phía backend đúng `http://localhost:5173` để đáp ứng kiểm tra Origin. Vite chuyển tiếp `/api` và `/book` đến backend và giữ Origin gốc.

Nếu backend dùng cổng khác, đặt `VITE_API_PROXY_TARGET` khi khởi chạy Vite. Frontend cũng hỗ trợ `VITE_API_BASE_URL` là origin API (không kèm `/api/v1/auth`); mặc định dùng cùng origin.

```sh
pnpm --filter @ctulib/frontend build
```

## Triển khai

Proxy Vite chỉ hoạt động trong chế độ dev. Khi triển khai, cấu hình reverse proxy `/api/*`, `/book` và `/book/*` đến backend trước SPA fallback, hoặc đặt `VITE_API_BASE_URL` lúc build. Cloudflare Pages có Functions chuyển tiếp `/api/*` và `/book/*`. `vercel.json` hiện chỉ cung cấp SPA fallback, chưa có đích backend để cấu hình rewrite API.

Backend dùng cookie `SameSite=strict`, `Secure` trong production: dùng HTTPS và triển khai frontend/API cùng site (hoặc reverse proxy cùng origin). Hai tên miền khác site sẽ không duy trì phiên bằng cấu hình backend hiện tại. CORS và `CLIENT_URL` phải khớp origin frontend.

## Logo

Logo gốc từ [bộ nhận diện Đại học Cần Thơ](https://www.ctu.edu.vn/branding), lưu tại `public/ctu-logo.png` và dùng cho header/favicon.
