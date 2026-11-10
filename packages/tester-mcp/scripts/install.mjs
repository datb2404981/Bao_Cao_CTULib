#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const serverFile = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const skillsRoot = fileURLToPath(new URL('../skills/', import.meta.url));
const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1] : 'both';
const dryRun = process.argv.includes('--dry-run');
const serverName = 'tester-agent';
const previousServerName = 'ctulib-tester';
const skillNames = [
  'qa-tester-exploration', 'qa-loan-lifecycle',
  'qa-test-triage', 'qa-responsive-accessibility'
];

if (!['both', 'codex', 'antigravity'].includes(only)) {
  throw new Error('Dùng --only=codex hoặc --only=antigravity hoặc bỏ qua để cài cả hai.');
}

const executable = (name) => {
  const found = spawnSync('/usr/bin/which', [name], { encoding: 'utf8' });
  if (found.status !== 0) throw new Error('Không tìm thấy lệnh ' + name + ' trong PATH.');
  return found.stdout.trim();
};

const nodeBin = executable('node');
const pnpmBin = executable('pnpm');

const ensureSkills = async (destination) => {
  for (const name of skillNames) {
    const source = await readFile(join(skillsRoot, name, 'SKILL.md'), 'utf8');
    const target = join(destination, name, 'SKILL.md');
    let current;
    try {
      current = await readFile(target, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (current && current !== source && !current.includes('Nguồn: bộ công cụ ctulib-tester-mcp.')) {
      throw new Error('Skill hiện có không thuộc bộ này: ' + target);
    }
    if (!dryRun && current !== source) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source, 'utf8');
    }
    console.log((dryRun ? '[xem trước] ' : '') + 'Skill ' + name + ' -> ' + target);
  }
};

const ensureCodex = async () => {
  const codex = executable('codex');
  const isManaged = (config) => config.command === nodeBin &&
    config.args?.[0] === serverFile &&
    config.env?.TESTER_PROJECT_ROOT === root &&
    config.env?.TESTER_PNPM_BIN === pnpmBin;
  const existing = spawnSync(codex, ['mcp', 'get', '--json', serverName], { encoding: 'utf8' });
  if (existing.status === 0) {
    const config = JSON.parse(existing.stdout).transport;
    if (!isManaged(config)) {
      throw new Error('Codex đã có MCP ' + serverName + ' với cấu hình khác. Không tự ghi đè.');
    }
    console.log('Codex đã cấu hình MCP ' + serverName + '.');
  } else if (!/not found|không tìm thấy|no MCP server/i.test(existing.stderr)) {
    throw new Error('Không kiểm tra được MCP Codex hiện có: ' + existing.stderr.trim());
  } else if (dryRun) {
    console.log('[xem trước] Thêm MCP ' + serverName + ' vào Codex.');
  } else {
    const added = spawnSync(codex, [
      'mcp', 'add', serverName,
      '--env', 'TESTER_PROJECT_ROOT=' + root,
      '--env', 'TESTER_PNPM_BIN=' + pnpmBin,
      '--', nodeBin, serverFile
    ], { encoding: 'utf8' });
    if (added.status !== 0) throw new Error('Không thêm được Codex MCP: ' + added.stderr.trim());
    console.log('Đã thêm MCP ' + serverName + ' vào Codex.');
  }

  const previous = spawnSync(codex, ['mcp', 'get', '--json', previousServerName], { encoding: 'utf8' });
  if (previous.status === 0 && isManaged(JSON.parse(previous.stdout).transport)) {
    if (dryRun) {
      console.log('[xem trước] Đổi tên MCP ' + previousServerName + ' thành ' + serverName + '.');
    } else {
      const removed = spawnSync(codex, ['mcp', 'remove', previousServerName], { encoding: 'utf8' });
      if (removed.status !== 0) throw new Error('Không xóa được tên MCP cũ: ' + removed.stderr.trim());
      console.log('Đã thay thế tên MCP cũ ' + previousServerName + ' trong Codex.');
    }
  }
};

const ensureAntigravity = async () => {
  const path = join(homedir(), '.gemini', 'config', 'mcp_config.json');
  let current;
  try {
    current = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    current = {};
  }
  if (!current.mcpServers) current.mcpServers = {};
  const configured = current.mcpServers[serverName];
  const expected = {
    command: nodeBin,
    args: [serverFile],
    env: { TESTER_PROJECT_ROOT: root, TESTER_PNPM_BIN: pnpmBin },
    timeoutSeconds: 900
  };
  if (configured) {
    if (configured.command !== expected.command ||
      configured.args?.[0] !== expected.args[0] ||
      configured.env?.TESTER_PROJECT_ROOT !== root ||
      configured.env?.TESTER_PNPM_BIN !== pnpmBin) {
      throw new Error('Antigravity đã có MCP ' + serverName + ' với cấu hình khác. Không tự ghi đè.');
    }
    console.log('Antigravity đã cấu hình MCP ' + serverName + '.');
  } else if (dryRun) {
    console.log('[xem trước] Thêm MCP ' + serverName + ' vào ' + path);
  } else {
    current.mcpServers[serverName] = expected;
  }

  const previous = current.mcpServers[previousServerName];
  const previousManaged = previous?.command === nodeBin &&
    previous.args?.[0] === serverFile &&
    previous.env?.TESTER_PROJECT_ROOT === root &&
    previous.env?.TESTER_PNPM_BIN === pnpmBin;
  if (previousManaged) {
    if (dryRun) console.log('[xem trước] Đổi tên MCP ' + previousServerName + ' trong Antigravity.');
    else delete current.mcpServers[previousServerName];
  }
  if (dryRun || (configured && !previousManaged)) return;
  const tempfile = path + '.tester-mcp-tmp-' + process.pid;
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(tempfile, JSON.stringify(current, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(tempfile, path);
  } catch (error) {
    const { unlink } = await import('node:fs/promises');
    await unlink(tempfile).catch(() => {});
    throw error;
  }
  console.log('Đã thêm MCP ' + serverName + ' vào Antigravity.');
};

await access(serverFile);
if (only === 'both' || only === 'codex') {
  await ensureSkills(join(homedir(), '.agents', 'skills'));
  await ensureCodex();
}
if (only === 'both' || only === 'antigravity') {
  await ensureSkills(join(homedir(), '.gemini', 'config', 'skills'));
  await ensureAntigravity();
}
console.log('Đã hoàn tất cấu hình. Mở lại Codex và tải lại MCP trong Antigravity để nhận công cụ mới.');
