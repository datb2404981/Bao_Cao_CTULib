#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getStatus, listArtifacts, readArtifact, runAction
} from './runner.mjs';

const server = new McpServer({
  name: 'tester-agent',
  version: '0.1.0'
});

const resultText = (value, isError = false) => ({
  isError,
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }]
});

const safe = (handler) => async (params = {}) => {
  try {
    const data = await handler(params);
    return resultText(data, data?.ok === false);
  } catch (error) {
    return resultText({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, true);
  }
};

server.registerTool('tester_status', {
  title: 'Trạng thái môi trường QA',
  description: 'Kiểm tra frontend, backend, MongoDB QA, Ollama và các model local. Không thay đổi dữ liệu.',
  inputSchema: z.object({})
}, safe(() => getStatus()));

server.registerTool('tester_smoke', {
  title: 'Kiểm thử giao diện khách',
  description: 'Chạy Playwright smoke test trên 1366px và 390px, xác thực form, quyền truy cập, lỗi console và HTTP 5xx.',
  inputSchema: z.object({})
}, safe(() => runAction('smoke')));

server.registerTool('tester_loan_lifecycle', {
  title: 'Kiểm thử mượn và trả sách',
  description: 'Chạy E2E 11 bước từ đăng nhập độc giả, tìm sách, đặt mượn, bàn giao, nhận trả đến kiểm tra tồn kho. Chỉ dùng MongoDB QA độc lập, tạo tài khoản thử nghiệm.',
  inputSchema: z.object({})
}, safe(() => runAction('loan')));

server.registerTool('tester_regression', {
  title: 'Kiểm thử hồi quy CTULib',
  description: 'Chạy frontend unit test, backend loan test với MongoDB QA, build cả hai ứng dụng và guest smoke.',
  inputSchema: z.object({})
}, safe(() => runAction('regression')));

server.registerTool('tester_plan', {
  title: 'Sinh kế hoạch kiểm thử khám phá',
  description: 'Dùng Explorbot AI tạo test plan dựa trên URL và mục tiêu. Chưa thực thi test plan.',
  inputSchema: z.object({
    page: z.string().default('/#/auth').describe('Đường dẫn trang như /#/auth hay /#/catalog.'),
    focus: z.string().min(5).max(240).describe('Mục tiêu, phạm vi và kỳ vọng kiểm thử bằng tiếng Việt.'),
    maxTests: z.number().int().min(1).max(10).default(3)
  })
}, safe((args) => runAction('plan', args)));

server.registerTool('tester_explore', {
  title: 'Explorbot tự khám phá và kiểm thử',
  description: 'AI tự điều hướng trang, thực thi kịch bản, lưu báo cáo Explorbot. Chạy trên môi trường QA được cấu hình, có thể ghi dữ liệu thử nghiệm.',
  inputSchema: z.object({
    page: z.string().default('/#/catalog'),
    focus: z.string().min(5).max(240),
    maxTests: z.number().int().min(1).max(10).default(3),
    durationMinutes: z.number().int().min(1).max(15).default(5)
  })
}, safe((args) => runAction('explore', args)));

server.registerTool('tester_run_plan', {
  title: 'Chạy lại kế hoạch kiểm thử',
  description: 'Thực thi test đã sinh trong qa/explorbot/output/plans. Chỉ chấp nhận tên file .md trong thư mục này.',
  inputSchema: z.object({
    name: z.string().describe('Tên file kế hoạch, không chứa thư mục.'),
    index: z.string().default('1').describe('Chỉ số test, ví dụ 1, 1-3 hoặc 1,3.')
  })
}, safe((args) => runAction('run_plan', args)));

server.registerTool('tester_context', {
  title: 'Khảo sát ngữ cảnh trang',
  description: 'Thu thập ngữ cảnh cho Explorbot trước khi lập test plan.',
  inputSchema: z.object({
    page: z.string().default('/#/catalog')
  })
}, safe((args) => runAction('context', args)));

server.registerTool('tester_list_artifacts', {
  title: 'Danh sách báo cáo và kịch bản',
  description: 'Liệt kê báo cáo, kế hoạch và test được Explorbot xuất ra.',
  inputSchema: z.object({
    kind: z.enum(['reports', 'plans', 'tests']).default('reports')
  })
}, safe(({ kind }) => listArtifacts(kind)));

server.registerTool('tester_read_artifact', {
  title: 'Đọc báo cáo hoặc kế hoạch',
  description: 'Đọc nội dung file output QA để kiểm chứng kết quả. Chỉ đọc file trong thư mục được cho phép.',
  inputSchema: z.object({
    kind: z.enum(['reports', 'plans', 'tests']),
    name: z.string()
  })
}, safe(({ kind, name }) => readArtifact(kind, name)));

const skills = [
  { name: 'qa_tester_exploration', folder: 'qa-tester-exploration', title: 'Tester khám phá tự động' },
  { name: 'qa_loan_lifecycle', folder: 'qa-loan-lifecycle', title: 'Kiểm tra mượn trả và tồn kho' },
  { name: 'qa_test_triage', folder: 'qa-test-triage', title: 'Phân loại lỗi từ bằng chứng QA' },
  { name: 'qa_responsive_accessibility', folder: 'qa-responsive-accessibility', title: 'Responsive và accessibility' }
];
for (const skill of skills) {
  const skillUrl = new URL('../skills/' + skill.folder + '/SKILL.md', import.meta.url);
  server.registerPrompt(skill.name, {
    title: skill.title,
    description: 'Hướng dẫn QA bằng MCP ' + skill.title
  }, async () => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: await readFile(skillUrl, 'utf8') }
    }]
  }));
  const resourceUri = 'tester://skills/' + skill.folder;
  server.registerResource(skill.name, resourceUri, {
    title: skill.title,
    description: 'Skill QA có thể dùng bởi Codex và Antigravity.',
    mimeType: 'text/markdown'
  }, async () => ({
    contents: [{
      uri: resourceUri,
      mimeType: 'text/markdown',
      text: await readFile(skillUrl, 'utf8')
    }]
  }));
}

const transport = new StdioServerTransport();
await server.connect(transport);
