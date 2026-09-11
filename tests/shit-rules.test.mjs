import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCode, levelOf, COMMIT_THRESHOLD, LEVELS } from '../dist/modules/shit-detector/rules.js';

const CLEAN = `export function sum(numbers) {
  // 累加一组价格，空数组返回 0
  return numbers.reduce((total, value) => total + value, 0);
}

export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}`;

const MESS = `function doIt(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v) {
  var tmp = a; var temp2 = b; console.log(tmp, temp2);
  try { risky(); } catch (e) {}
  // TODO: 先这样，以后再改
  if (a) { if (b) { if (c) { if (d) { if (e) { return a > 1 ? b > 2 ? c : d : e; } } } } }
  var x: any = window.config.app.user.session.token.value.raw;
  if (x == 12345678) { console.log('magic'); }
}`;

test('clean code stays cool, messy code goes red', () => {
  const clean = analyzeCode(CLEAN);
  const mess = analyzeCode(MESS);
  assert.ok(clean.score < 35, `clean scored ${clean.score}`);
  assert.ok(mess.score >= COMMIT_THRESHOLD, `mess scored ${mess.score}`);
  assert.ok(mess.score > clean.score);
});

test('no input never triggers the alarm', () => {
  for (const value of ['', '   \n\n  ', null, undefined, 42, {}]) {
    const result = analyzeCode(value);
    assert.equal(result.score, 0);
    assert.deepEqual(result.signals, []);
  }
  assert.equal(analyzeCode('// 只是一句注释').score, 0);
});

test('score is a bounded integer and always carries a level', () => {
  for (const source of [CLEAN, MESS, MESS.repeat(20), 'x'.repeat(5000), '{'.repeat(500)]) {
    const result = analyzeCode(source);
    assert.ok(Number.isInteger(result.score) && result.score >= 0 && result.score <= 100);
    assert.ok(LEVELS.includes(result.level));
    assert.equal(result.level, levelOf(result.score));
  }
});

test('concentration, not size: padding clean lines does not raise the alarm', () => {
  const padded = `${MESS}\n${CLEAN.repeat(12)}`;
  assert.ok(analyzeCode(padded).score < analyzeCode(MESS).score);
});

test('signals name the offending line and stay deduplicated', () => {
  const result = analyzeCode(MESS);
  const ids = result.signals.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('swallow-error'));
  assert.ok(ids.includes('debug-print'));
  assert.equal(result.signals.find((item) => item.id === 'debug-print').line, 2);
  assert.ok(result.signals.every((item) => item.counted <= item.cap));
});

test('strings and comments do not fake a magic number', () => {
  assert.equal(analyzeCode('const label = "订单 20240101 已完成";').signals.length, 0);
  assert.ok(analyzeCode('const retry = 86400;').signals.every((item) => item.id !== 'magic-number'));
});

test('everyday numbers are not magic numbers', () => {
  const magic = (source) => analyzeCode(source).signals.some((item) => item.id === 'magic-number');
  for (const source of ['return (cents / 100).toFixed(2);', 'if (res.code === 404) { retry(); }', 'setTimeout(run, 1000);']) assert.equal(magic(source), false, source);
  for (const source of ['if (x == 16777215) { go(); }', 'wait(73219);']) assert.equal(magic(source), true, source);
});
