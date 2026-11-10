# Tester Agent — CTULib QA MCP

Bộ MCP kết nối Codex và Google Antigravity với các bài kiểm thử CTULib đang hoạt động, gồm Playwright E2E mượn–trả sách, guest smoke, Vitest regression và Explorbot AI. Được đóng gói thành package riêng trong monorepo, dùng Node.js và giao thức MCP stdio. Bốn skill có cả bản SKILL.md và MCP prompts/resources.

## Yêu cầu

- Node.js 20+, pnpm 9+, dependencies đã cài bằng pnpm install tại CTULib.
- Frontend QA ở http://127.0.0.1:5174 và API QA ở http://127.0.0.1:8080.
- Với E2E mượn–trả, MongoDB QA replica set ở 127.0.0.1:27029, database ctulib_explorbot_e2e đã seed theo tài liệu qa/explorbot/README.md.
- Với Explorbot AI, Ollama ở 127.0.0.1:11434, model qwen2.5-coder:14b. Test khám phá có tương tác ảnh còn cần model thị giác qwen2.5vl:3b và cấu hình phù hợp.

## Cài MCP vào Codex và Antigravity

Tại thư mục gốc CTULib chạy các lệnh sau.

    pnpm install
    pnpm --filter @ctulib/tester-mcp test
    pnpm --filter @ctulib/tester-mcp install:agents

Script installer thêm MCP tên `tester-agent` vào Codex qua lệnh codex mcp add và Antigravity qua ~/.gemini/config/mcp_config.json. Nếu tìm thấy bản `ctulib-tester` do cùng package quản lý, installer sẽ chuyển sang tên mới. Bốn skill được cài vào ~/.agents/skills và ~/.gemini/config/skills. Các cấu hình và skill khác được giữ nguyên.

Chạy thử mà chưa ghi cấu hình.

    pnpm --filter @ctulib/tester-mcp exec node scripts/install.mjs --dry-run

Chỉ cài một trong hai.

    pnpm --filter @ctulib/tester-mcp exec node scripts/install.mjs --only=codex
    pnpm --filter @ctulib/tester-mcp exec node scripts/install.mjs --only=antigravity

Sau khi cài, mở lại Codex. Trong Antigravity chọn reload/restart MCP servers hoặc khởi động lại IDE. Cả hai ứng dụng sử dụng một MCP server chạy tại local. Khi chuyển máy, cài dependency và chạy lại installer tại máy mới.

## Công cụ MCP

| Tool | Công dụng |
| --- | --- |
| tester_status | Kiểm tra dịch vụ, MongoDB QA và Ollama |
| tester_smoke | 20 kiểm tra guest desktop/mobile |
| tester_loan_lifecycle | 11 bước E2E từ đăng nhập, đặt mượn, bàn giao tới trả và kiểm tra tồn kho |
| tester_regression | Unit frontend, backend loan, build và guest smoke |
| tester_context | Lấy ngữ cảnh website cho Explorbot |
| tester_plan | Sinh test plan AI |
| tester_explore | AI tự điều hướng và kiểm thử khám phá |
| tester_run_plan | Chạy lại test đã sinh |
| tester_list_artifacts | Liệt kê báo cáo, kế hoạch và test |
| tester_read_artifact | Đọc nội dung báo cáo, kế hoạch và test |

Lệnh QA chỉ được tạo từ danh sách cố định, không thực thi shell do model sinh ra. Đường dẫn test plan phải nằm trong thư mục output/plans. Mọi workflow kiểm thử dùng khóa liên tiến trình `qa/explorbot/output/.tester-mcp.lock`, vì vậy Codex và Antigravity không thể chạy hai workflow đồng thời trên cùng workspace. Nếu một tiến trình bị dừng đột ngột và để lại khóa, cần xác minh mọi browser/QA process đã kết thúc trước khi xóa thư mục khóa.

Các workflow tương tác chỉ chạy trên frontend `http://127.0.0.1:5174` và API `http://127.0.0.1:8080`. Trước khi chạy `tester_loan_lifecycle`, `tester_explore` hoặc `tester_run_plan`, bot kiểm tra MongoDB QA riêng và đối chiếu sách/tồn kho đã seed với API đi trực tiếp và qua frontend proxy. Khi dữ liệu không khớp, workflow bị từ chối trước khi ghi dữ liệu.

## Cách yêu cầu agent

- “Dùng Tester Agent (`tester-agent`) để chạy tester_status rồi tester_smoke, đọc báo cáo và chỉ ra lỗi.”
- “Chạy tester_loan_lifecycle, xác minh trạng thái Đã trả và số bản khả dụng ban đầu/cuối.”
- “Sinh 3 test case đăng nhập bằng tester_plan cho /#/auth, đọc bản kế hoạch và chạy test số 1.”
- “Dùng tester_explore kiểm tra tra cứu sách với tối đa 3 test trong 5 phút, rồi phân tích báo cáo.”
- “Chạy tester_regression và tổng hợp kết quả PASS/FAIL/BLOCKED.”

Bốn skill được tích hợp là qa-tester-exploration, qa-loan-lifecycle, qa-test-triage và qa-responsive-accessibility.

## Kết quả, an toàn và giới hạn

Báo cáo nằm ở qa/explorbot/output/reports, test plan tại output/plans và test do AI sinh tại output/tests. Không đưa mật khẩu/token vào prompt hoặc tài liệu. E2E sinh tài khoản QA và phiếu thử mới mỗi lần, không tự xóa hay khôi phục tồn kho khi một lượt test bị ngắt.

Kịch bản Playwright đã kiểm chứng được tách khỏi kịch bản do Explorbot AI thực thi. Kiểm tra số PASS/FAIL/BLOCKED trong báo cáo, không kết luận thành công chỉ từ exit code 0. Test khám phá AI phụ thuộc khả năng sử dụng công cụ và model thị giác của Ollama.

Lượt Explorbot AI gần nhất ở `test-WeeklyKite187.md` chỉ ghi nhận timeout khi xác minh trường bắt buộc. Chưa có assertion đạt. Cần chạy lại khi model local và trình duyệt ổn định.

Khi dùng Ollama `qwen2.5-coder:14b`, việc sinh kế hoạch đôi khi tạo sai định dạng Explorbot và `tester_plan` sẽ báo lỗi. `tester_run_plan` có thể gặp timeout trong bước AI điều khiển trình duyệt. Những lượt này được đánh dấu `FAILED` hoặc `BLOCKED`, không được coi là kiểm thử thành công.

Các biến cấu hình tùy chọn gồm TESTER_PROJECT_ROOT, TESTER_PNPM_BIN, TESTER_OLLAMA_URL và TESTER_AI_PROVIDER. Mặc định provider là ollama. Frontend, API và database QA được cố định cho các workflow tương tác. Gói MCP hiện gắn với script và workspace CTULib. Để hỗ trợ project khác cần bổ sung adapter QA riêng và cơ chế xác minh môi trường tương ứng.

Để tạo file package local, chạy pnpm --filter @ctulib/tester-mcp pack:local. Gói này phân phối MCP, skill và installer; các script nghiệp vụ CTULib vẫn được sử dụng từ TESTER_PROJECT_ROOT.
