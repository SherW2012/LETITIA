import test from 'node:test';
import assert from 'node:assert/strict';
import { roastCode, validateCodeInput, validateCodeReport } from '../worker/index.js';

const request = (body, headers = {}) => new Request('https://letitia.test/api/roast-code', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const report = { valid: true, level: '生化危机', verdict: '这段代码三个月后你自己也不认识。', score: 88, issues: [{ line: 3, quote: 'catch (e) {}', comment: '异常被你原地埋了。' }], commit_question: '你确定这玩意要提交？', limitations: '' };

test('reject invalid input before spending model calls', async () => {
  let called = false;
  for (const body of [{}, { code: '   ' }, { code: 'x'.repeat(20001) }, { code: 'ok', language: 'javascript; drop' }, { code: 'ok', signals: ['../etc'] }, { code: 'ok', signals: Array(17).fill('todo') }, { code: ['a'] }]) {
    assert.equal((await roastCode(request(body), { MOONSHOT_API_KEY: 'test' }, () => { called = true; })).status, 400, JSON.stringify(body));
  }
  assert.equal(called, false);
});

test('reject cross-origin model spending', async () => {
  assert.equal((await roastCode(request({ code: 'let a = 1;' }, { Origin: 'https://other.test' }), { MOONSHOT_API_KEY: 'test' })).status, 403);
});

test('missing secret is a configuration error', async () => {
  assert.equal((await roastCode(request({ code: 'let a = 1;' }), {})).status, 503);
});

test('accept a clean verdict with no issues', () => {
  assert.deepEqual(validateCodeReport({ ...report, score: 6, issues: [] }).issues, []);
  assert.equal(validateCodeReport({ valid: false, message: '请贴一段完整点的代码' }).valid, false);
});

test('reject malformed verdicts instead of inventing scores', () => {
  for (const patch of [{ score: 101 }, { score: -1 }, { score: '80' }, { score: null }, { verdict: '' }, { commit_question: '' }, { level: '' }, { issues: [{ line: 0, quote: 'a', comment: 'b' }] }, { issues: [{ line: 1, quote: '', comment: 'b' }] }, { issues: Array(4).fill({ line: 1, quote: 'a', comment: 'b' }) }, { limitations: 5 }]) {
    assert.throws(() => validateCodeReport({ ...report, ...patch }), JSON.stringify(patch));
  }
});

test('send numbered code, keep the key upstream, return the verdict', async () => {
  const response = await roastCode(request({ code: 'let a = 1;\ncatch (e) {}', language: 'javascript', signals: ['swallow-error'] }), { MOONSHOT_API_KEY: 'test-secret' }, async (url, options) => {
    assert.equal(url, 'https://api.moonshot.cn/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const sent = JSON.parse(options.body);
    assert.match(sent.messages[1].content[0].text, /1\tlet a = 1;/);
    assert.match(sent.messages[1].content[0].text, /swallow-error/);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(report) } }] });
  });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(!body.includes('test-secret'));
  assert.ok(body.includes('生化危机'));
});

test('sanitize provider errors and truncated output', async () => {
  const unauthorized = await roastCode(request({ code: 'let a = 1;' }), { MOONSHOT_API_KEY: 'test' }, async () => new Response('private upstream details', { status: 401 }));
  assert.equal(unauthorized.status, 502);
  assert.ok(!(await unauthorized.text()).includes('private upstream details'));
  const truncated = await roastCode(request({ code: 'let a = 1;' }), { MOONSHOT_API_KEY: 'test' }, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{' } }] }));
  assert.equal(truncated.status, 502);
});

test('code input keeps its own limits', () => {
  assert.equal(validateCodeInput({ code: '  let a = 1;  ' }).code, 'let a = 1;');
  assert.deepEqual(validateCodeInput({ code: 'a', signals: ['todo', 'bad-name'] }).signals, ['todo', 'bad-name']);
  assert.equal(validateCodeInput({ code: 'a' }).language, '');
});
