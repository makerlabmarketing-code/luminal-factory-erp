import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.dirname(fileURLToPath(import.meta.url));
const temp = mkdtempSync(path.join(os.tmpdir(), 'luminal-browser-contract-'));
const mockPath = path.join(temp, 'playwright.mjs');
writeFileSync(mockPath, `
const newPage = () => ({
  on() {},
  async goto(url) { this.current = new URL(url); return {status: () => process.env.QA_MOCK_FAIL === '1' && this.current.pathname === '/admin/capital' ? 503 : 200}; },
  async waitForTimeout() {},
  url() { return this.current.href; },
  locator(selector) { return {innerText: async () => 'Đăng nhập ERP · nội dung hợp lệ và rõ ràng', count: async () => process.env.QA_MOCK_GUEST_LEAK === '1' && this.current.pathname === '/admin/capital' ? 0 : (selector === 'input[type="password"]' || selector === 'input[type="email"]' ? 1 : 0)}; },
  getByRole(role) { return {count: async () => process.env.QA_MOCK_GUEST_LEAK === '1' && this.current.pathname === '/admin/capital' ? 0 : (role === 'heading' || role === 'button' ? 1 : 0)}; },
  async evaluate() { return process.env.QA_MOCK_OVERFLOW === '1' ? 32 : 0; },
  async close() {},
  async screenshot() {},
});
const newContext = async () => ({async route() {}, newPage: async () => newPage(), async close() {}});
export const chromium = {launch: async () => ({newContext, async close() {}})};
`);
function runCase(name, extras = {}) {
  const output = path.join(temp, name);
  const result = spawnSync(process.execPath, [path.join(root, 'erp-browser-smoke.mjs')], {
    cwd: path.join(root, '..', '..'), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, GITHUB_ACTIONS: 'false', QA_BASE_URL: 'https://erp.luminalfactory.com', QA_PLAYWRIGHT_MODULE: mockPath, QA_OUTPUT_DIR: output, ...extras },
  });
  return { result, output };
}

test('read-only guest smoke inspects four viewports and six ERP routes', () => {
  const { result, output } = runCase('guest');
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const report = JSON.parse(readFileSync(path.join(output, 'report.json'), 'utf8'));
  assert.equal(report.checks, 24);
  assert.ok(report.observations.every(item => item.mode === 'login-gated'));
  assert.equal(report.problems.length, 0);
  assert.equal(report.mode, 'public-guest-readonly');
});

test('HTTP 503 on an ERP page fails and records reproducible route/viewport', () => {
  const { result, output } = runCase('server-error', { QA_MOCK_FAIL: '1' });
  assert.equal(result.status, 1, result.stderr + result.stdout);
  const report = JSON.parse(readFileSync(path.join(output, 'report.json'), 'utf8'));
  assert.equal(report.problems.length, 4);
  assert.ok(report.problems.every(issue => issue.route === '/admin/capital' && issue.message.includes('503')));
});

test('authenticated session is explicitly rejected on public GitHub Actions', () => {
  const { result } = runCase('no-auth-ci', { GITHUB_ACTIONS: 'true', QA_STORAGE_STATE_PATH: path.join(temp, 'private.json') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Authenticated QA is forbidden/);
});

test('only the allowed HTTPS ERP production origin is accepted', () => {
  const { result } = runCase('no-foreign-origin', { QA_BASE_URL: 'https://example.org/' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /QA_BASE_URL must be/);
});

test('unauthenticated ERP content must be blocked by a complete login gate', () => {
  const { result, output } = runCase('guest-leak', { QA_MOCK_GUEST_LEAK: '1' });
  assert.equal(result.status, 1, result.stderr + result.stdout);
  const report = JSON.parse(readFileSync(path.join(output, 'report.json'), 'utf8'));
  assert.equal(report.problems.length, 4);
  assert.ok(report.problems.every(issue => issue.route === '/admin/capital' && issue.message.includes('login gate')));
});

test('login viewport overflow is a regression failure on all viewports', () => {
  const { result, output } = runCase('horizontal-overflow', { QA_MOCK_OVERFLOW: '1' });
  assert.equal(result.status, 1, result.stderr + result.stdout);
  const report = JSON.parse(readFileSync(path.join(output, 'report.json'), 'utf8'));
  assert.equal(report.problems.length, 24);
  assert.ok(report.problems.every(issue => issue.message.includes('horizontal viewport overflow')));
});

test.after(() => rmSync(temp, { recursive: true, force: true }));
