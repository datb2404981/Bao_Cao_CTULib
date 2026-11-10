import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { acquireWorkflowLock, buildArgs, projectRoot, validatePage, validatePlanName, readArtifact } from '../src/runner.mjs';

test('chỉ cho phép route QA và file test plan hợp lệ', () => {
  assert.equal(validatePage('/#/auth'), '/#/auth');
  assert.equal(validatePage('/#/my-loans'), '/#/my-loans');
  assert.throws(() => validatePage('https://example.com'));
  assert.throws(() => validatePage('/#/auth?token=x'));
  assert.equal(validatePlanName('sample-plan.md'), 'sample-plan.md');
  assert.throws(() => validatePlanName('../../private.md'));
  assert.throws(() => buildArgs('run_plan', { name: '../../outside.md', index: '1' }));
  assert.throws(() => buildArgs('run_plan', { name: 'ok.md', index: '1; rm -rf ~' }));
  assert.deepEqual(buildArgs('smoke'), ['qa:smoke']);
});

test('không đọc file ngoài output QA', async () => {
  await assert.rejects(readArtifact('reports', '../../private.md'));
  await assert.rejects(readArtifact('plans', 'secrets.json'));
});

test('đọc được báo cáo QA hợp lệ', async () => {
  const folder = join(projectRoot, 'qa', 'explorbot', 'output', 'reports');
  const name = `tester-mcp-read-${process.pid}.md`;
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, name), '# Kiểm thử đọc báo cáo\n', { flag: 'wx' });
  try {
    const artifact = await readArtifact('reports', name);
    assert.match(artifact.text, /Kiểm thử đọc báo cáo/);
  } finally {
    await unlink(join(folder, name));
  }
});

test('khóa QA ngăn hai tiến trình MCP chạy đồng thời và được giải phóng sau lượt chạy', async () => {
  const runnerUrl = new URL('../src/runner.mjs', import.meta.url).href;
  const script = `import { acquireWorkflowLock } from ${JSON.stringify(runnerUrl)}; ` +
    `try { const release = await acquireWorkflowLock('child'); await release(); } ` +
    `catch (error) { console.error(error.message); process.exitCode = 2; }`;
  const attempt = () => spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', cwd: projectRoot
  });
  const release = await acquireWorkflowLock('parent');
  try {
    const blocked = attempt();
    assert.equal(blocked.status, 2);
    assert.match(blocked.stderr, /QA đang có lượt kiểm thử khác/);
  } finally {
    await release();
  }
  const admitted = attempt();
  assert.equal(admitted.status, 0, admitted.stderr);
});

test('MCP có thể initialize, liệt kê tool, prompt, resource và gọi tool', async () => {
  const server = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
  const client = new Client({ name: 'tester-mcp-smoke-client', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [server],
    env: { ...process.env }
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 10);
    for (const name of [
      'tester_status', 'tester_loan_lifecycle', 'tester_smoke',
      'tester_regression', 'tester_explore', 'tester_plan',
      'tester_run_plan', 'tester_list_artifacts', 'tester_read_artifact'
    ]) {
      assert.ok(tools.some((tool) => tool.name === name), name);
    }
    const prompts = (await client.listPrompts()).prompts;
    const resources = (await client.listResources()).resources;
    assert.equal(prompts.length, 4);
    assert.equal(resources.length, 4);
    const status = await client.callTool({ name: 'tester_status', arguments: {} });
    assert.equal(status.isError, false);
    const data = JSON.parse(status.content[0].text);
    assert.equal(typeof data.projectRoot, 'string');
    assert.equal(typeof data.frontend.reachable, 'boolean');

    const invalid = await client.callTool({
      name: 'tester_read_artifact', arguments: { kind: 'plans', name: '../../secret.md' }
    });
    assert.equal(invalid.isError, true);
    const prompt = await client.getPrompt({ name: 'qa_loan_lifecycle' });
    assert.match(prompt.messages[0].content.text, /Đặt lịch mượn/);
  } finally {
    await client.close();
  }
});
