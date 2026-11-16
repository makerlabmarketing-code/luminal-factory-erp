import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const child = spawn('bash', ['scripts/qa/bootstrap-agent-browser-mcp.sh'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    AGENT_BROWSER_ALLOWED_DOMAINS: 'erp.luminalfactory.com,kwfmfmpgpbfewpiizesv.supabase.co',
    AGENT_BROWSER_SESSION: 'luminal-ci-guest',
    AGENT_BROWSER_CONTENT_BOUNDARIES: '1',
    AGENT_BROWSER_CONFIRM_ACTIONS: 'eval,download',
  },
});
let stderr = '';
child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-1500); });
const pending = new Map();
let nextId = 0;
let stopped = false;
const finish = error => {
  if (stopped) return;
  stopped = true;
  for (const item of pending.values()) { clearTimeout(item.timeout); item.reject(error); }
  pending.clear();
};
child.on('error', error => finish(error));
child.on('exit', (code, signal) => finish(new Error('MCP process exited: ' + code + ' / ' + signal + '\n' + stderr)));
createInterface({ input: child.stdout }).on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const entry = pending.get(message.id);
  if (!entry) return;
  clearTimeout(entry.timeout);
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
});
function request(method, params = {}, timeoutMs = 180000) {
  if (stopped) return Promise.reject(new Error('MCP already closed'));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(method + ' timed out. ' + stderr.slice(-500)));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timeout });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
async function main() {
  try {
    const init = await request('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'luminal-ci-qa', version: '1.0.0' },
    });
    assert.ok(init.serverInfo, 'MCP initialization did not return server info');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const discovered = await request('tools/list', {});
    assert.ok(Array.isArray(discovered.tools), 'No MCP tool list');
    const names = discovered.tools.map(tool => tool.name);
    assert.ok(names.includes('agent_browser_open'), 'Browser open MCP tool is missing');
    assert.ok(names.includes('agent_browser_snapshot'), 'Browser snapshot MCP tool is missing');
    const result = await request('tools/call', {
      name: 'agent_browser_open',
      arguments: { url: 'https://erp.luminalfactory.com/login' },
    }, 45000);
    assert.ok(!result.isError, 'MCP browser open failed');
    console.log('Codex project MCP: initialized; browser tools discovered; guest ERP login opened.');
    await request('tools/call', { name: 'agent_browser_close', arguments: {} }, 15000).catch(() => {});
  } finally {
    child.kill('SIGTERM');
  }
}
await main().catch(error => {
  console.error('Project MCP validation failed:', String(error.message).slice(0, 700));
  process.exitCode = 1;
}).finally(() => finish(new Error('MCP verifier closed')));
