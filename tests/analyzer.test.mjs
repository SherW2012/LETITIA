import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, validateInput, validateReport } from '../worker/index.js';
const request = (body, headers = {}) => new Request('https://letitia.test/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const report = { valid: true, summary: '普通分享', roast: '今天只是吃了一顿饭。', metrics: Object.fromEntries(['flex', 'humblebrag', 'ai', 'eyeroll'].map(key => [key, { score: key === 'ai' ? null : 5, reason: '没有足够文字。' }])), evidence: [{ source: 'image', detail: '一盘食物。' }], limitations: '' };
test('reject invalid input before calling model', async () => {
  let called = false;
  for (const body of [{ text: '' }, { text: 'a'.repeat(5001) }, { image: 'https://example.com/photo.png' }, { text: ['bad'] }]) {
    assert.equal((await analyze(request(body), { MOONSHOT_API_KEY: 'test' }, () => { called = true; })).status, 400);
  }
  assert.equal(called, false);
});
test('accept image-only input and nullable AI score', () => {
  assert.ok(validateInput({ image: 'data:image/png;base64,aGVsbG8=' }).image);
  assert.equal(validateReport(report).metrics.ai.score, null);
});
test('reject cross-origin model spending', async () => {
  assert.equal((await analyze(request({ text: 'hi' }, { Origin: 'https://other.test' }), { MOONSHOT_API_KEY: 'test' })).status, 403);
});
test('reject malformed scores', () => {
  for (const value of [101, -1, '50', null]) { const bad = structuredClone(report); bad.metrics.flex.score = value; assert.throws(() => validateReport(bad)); }
});
test('forward visual input and keep authentication upstream', async () => {
  const image = 'data:image/png;base64,aGVsbG8=';
  const response = await analyze(request({ text: '今天吃饭', image }), { MOONSHOT_API_KEY: 'test-secret' }, async (url, options) => {
    assert.equal(url, 'https://api.moonshot.cn/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.equal(JSON.parse(options.body).messages[1].content[1].image_url.url, image);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(report) } }] });
  });
  assert.equal(response.status, 200); const content = await response.text(); assert.ok(!content.includes('test-secret')); assert.ok(content.includes('普通分享'));
});
test('sanitize provider errors', async () => {
  const response = await analyze(request({ text: 'test' }), { MOONSHOT_API_KEY: 'test' }, async () => new Response('private upstream details', { status: 401 }));
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('private upstream details'));
});
test('reject truncated output', async () => {
  const response = await analyze(request({ text: 'test' }), { MOONSHOT_API_KEY: 'test' }, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{' } }] }));
  assert.equal(response.status, 502);
});
test('missing secret is a configuration error', async () => { assert.equal((await analyze(request({ text: 'test' }), {})).status, 503); });
