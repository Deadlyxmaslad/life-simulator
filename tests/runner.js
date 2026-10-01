'use strict';
/* =========================================================================
 * 迷你测试运行器 (tests/runner.js) —— 零依赖
 * -------------------------------------------------------------------------
 * 因为项目约束"不得引入外部依赖"，这里自带一个极简 describe/it/assert，
 * 用法与 Jest 神似但完全自研：
 *
 *   const { describe, it, assert } = require('./runner');
 *   describe('disease', () => {
 *     it('感染会扣血', () => { assert.ok(x); });
 *   });
 *
 * 断言失败抛 AssertionError，由 run() 捕获并统计。
 * ========================================================================= */

const cases = [];
let cur = null;

function describe(name, fn) {
  const prev = cur;
  cur = prev ? prev + ' › ' + name : name;
  fn();
  cur = prev;
}

function it(name, fn) {
  cases.push({ name: cur ? cur + ' › ' + name : name, fn });
}

class AssertionError extends Error {}

function fail(msg) { throw new AssertionError(msg); }

const assert = {
  ok(v, msg) {
    if (!v) fail(msg || '期望为真，实际为 ' + JSON.stringify(v));
  },
  notOk(v, msg) {
    if (v) fail(msg || '期望为假，实际为 ' + JSON.stringify(v));
  },
  equal(a, b, msg) {
    if (a !== b) fail((msg || '值不相等') + '：期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a));
  },
  notEqual(a, b, msg) {
    if (a === b) fail((msg || '期望值不同') + '：两边都是 ' + JSON.stringify(a));
  },
  near(a, b, tol, msg) {
    const t = tol == null ? 1e-6 : tol;
    if (!(Math.abs(a - b) <= t)) fail((msg || '数值不接近') + '：期望 ' + b + ' ± ' + t + '，实际 ' + a);
  },
  range(v, lo, hi, msg) {
    if (!(v >= lo && v <= hi)) fail((msg || '超出范围') + '：' + v + ' 不在 [' + lo + ', ' + hi + ']');
  },
  finite(v, msg) {
    if (typeof v !== 'number' || !isFinite(v)) fail((msg || '不是有限数字') + '：' + JSON.stringify(v));
  },
  throws(fn, msg) {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) fail(msg || '期望抛出异常但没有');
  },
};

function run(opts) {
  opts = opts || {};
  const verbose = opts.verbose !== false;
  let pass = 0;
  const fails = [];
  for (const t of cases) {
    try {
      t.fn();
      pass++;
      if (verbose) console.log('  \u2713 ' + t.name);
    } catch (e) {
      fails.push({ name: t.name, err: e });
      if (verbose) {
        console.log('  \u2717 ' + t.name);
        console.log('      ' + (e && e.message ? e.message : String(e)));
      }
    }
  }
  console.log('');
  console.log('用例总数 ' + cases.length + ' \u00b7 通过 ' + pass + ' \u00b7 失败 ' + fails.length);
  return { total: cases.length, pass, fail: fails.length, fails };
}

module.exports = { describe, it, assert, run, cases, AssertionError };
