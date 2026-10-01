'use strict';
/* =========================================================================
 * 性能基准测试（tests/cases/perf.test.js · 路线图发布清单「性能测试」项）
 * -------------------------------------------------------------------------
 * 无头基准，全部基于 tests/harness.js 的 vm 沙箱（Game.hud 为空壳），
 * 因此测量的是**纯游戏逻辑**开销，不含浏览器渲染与 DOM：
 *
 *   ① 全量脚本加载（vm 编译 + 执行 + boot）耗时  < 2000ms    —— 首屏预算
 *   ② 单次 loop.step 平均 / p95 耗时              < 5ms       —— 100fps 帧预算
 *   ③ 完整一生模拟（含死亡结算）耗时               < 5000ms
 *   ④ tick 吞吐                                    ≥ 1000/s
 *
 * 阈值取向：取"宽松上限"，实测通常有 40~600 倍余量。目的是捕捉数量级回归
 * （例如新增系统误放大 O(n²) 计算），而不是绑定具体机器的绝对速度。
 * 每次运行都会打印实测值，便于人工核验基准趋势。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

const now = () => Number(process.hrtime.bigint()) / 1e6; // 毫秒
const fmt = (v, d) => v.toFixed(d == null ? 2 : d);

describe('性能 · 无头基准（发布清单「性能测试」）', () => {
  it('① 全量脚本加载（vm 编译 + 执行 + boot）耗时 < 2s', () => {
    // 连续构建 3 次取最优，规避首次磁盘 / JIT 冷启动抖动
    let best = Infinity;
    let g = null;
    for (let i = 0; i < 3; i++) {
      const t0 = now();
      const built = h.build({ quiet: true });
      const cost = now() - t0;
      if (cost < best) { best = cost; g = built; }
    }
    assert.ok(best < 2000, '脚本加载耗时超出首屏预算：' + fmt(best) + 'ms ≥ 2000ms');
    // 防止"加载失败所以很快"的假通过
    assert.ok(g && g.Game, '沙箱构建失败：Game 未挂载');
    assert.ok(g.Game.systems && g.Game.systems.list.length >= 21,
      '系统未全量加载，实际 ' + (g.Game.systems ? g.Game.systems.list.length : 'n/a') + ' 个');
    ['clock', 'career', 'assets', 'invest', 'story', 'audio', 'score', 'lifespan'].forEach((n) => {
      assert.ok(!!g.Game.systems.get(n), '缺少系统：' + n);
    });
    console.log('    · 脚本加载最优耗时 ' + fmt(best) + 'ms（含 ' +
      g.Game.systems.list.length + ' 个系统）');
  });

  it('② 单次 loop.step 平均与 p95 耗时 < 5ms（100fps 帧预算）', () => {
    const g = h.build({ quiet: true });
    const N = 6000;
    const costs = new Array(N);
    g.reset(20260919);
    for (let i = 0; i < N; i++) {
      const a = now();
      g.tick(); // 自动替玩家点掉抉择弹窗，避免主循环被冻结
      costs[i] = now() - a;
      if (!g.person.alive) g.reset(20260919 + i); // 死亡则换世续测
    }
    const sorted = costs.slice().sort((x, y) => x - y);
    const avg = sorted.reduce((a, b) => a + b, 0) / N;
    const p95 = sorted[Math.min(N - 1, Math.floor(N * 0.95))];
    assert.ok(avg < 5, '单步平均耗时超阈值：' + fmt(avg, 4) + 'ms ≥ 5ms');
    assert.ok(p95 < 5, '单步 p95 耗时超阈值：' + fmt(p95, 4) + 'ms ≥ 5ms');
    console.log('    · 单步平均 ' + fmt(avg, 4) + 'ms / p95 ' + fmt(p95, 4) +
      'ms / 最坏 ' + fmt(sorted[N - 1], 3) + 'ms（' + N + ' 步）');
  });

  it('③ 完整一生模拟（含死亡结算）耗时 < 5s', () => {
    const g = h.build({ quiet: true });
    g.reset(2026);
    const t0 = now();
    g.runToDeath(130);
    const ms = now() - t0;
    assert.equal(g.person.alive, false, '130 岁上限内未走到死亡');
    assert.ok(g.state.clock.age >= 30, '享年异常：' + g.state.clock.age);
    assert.ok(ms < 5000, '完整一生耗时超阈值：' + fmt(ms) + 'ms ≥ 5000ms');
    console.log('    · 一生耗时 ' + fmt(ms) + 'ms（享年 ' + g.state.clock.age + '）');
  });

  it('④ tick 吞吐 ≥ 1000 tick/s（引擎逻辑预算）', () => {
    const g = h.build({ quiet: true });
    const N = 20000;
    let ticks = 0;
    let seed = 5150;
    g.reset(seed);
    const t0 = now();
    while (ticks < N) {
      if (!g.state.person.alive) { seed++; g.reset(seed); continue; }
      g.tick();
      ticks++;
    }
    const sec = (now() - t0) / 1000;
    const tps = ticks / sec;
    assert.ok(tps >= 1000, '吞吐不足：' + tps.toFixed(0) + ' tick/s < 1000 tick/s');
    console.log('    · 吞吐 ' + tps.toFixed(0) + ' tick/s（' + ticks +
      ' 步 / ' + fmt(sec * 1000) + 'ms）');
  });
});
