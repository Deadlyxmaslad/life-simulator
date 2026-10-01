'use strict';
/* =========================================================================
 * 自动暂停（参与感）测试：每年交界 / 每次事件弹出自动置暂停态
 * -------------------------------------------------------------------------
 * 约束：
 *  - 仅在本就"自动播放(running=true)"时生效；手动单步与测试驱动(advanceMonths/step)不受影响
 *  - 年交界暂停按 config.time.autoPause.year（默认 true）触发：每跨一次年（生日/新年）暂停
 *  - 关闭 autoPause 后即便 running 也不会自动暂停
 *  - 任何情况下自动暂停都不会把"未开始/已暂停"的游戏自动开始
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('自动暂停（参与感）', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) {
    g.reset(seed == null ? 20260920 : seed);
    g.state.pendingDecision = null;
    g.state.running = false;
    g.state.autoPause = true;
  }

  // 连续广播 n 个 month 事件（模拟自动播放中时间推进，不应触发暂停）
  function runMonths(n) {
    for (let i = 0; i < n; i++) g.Game.bus.emit('month', {});
  }
  // 广播一次 year 事件（跨年交界）
  function runYear() {
    g.Game.bus.emit('year', { age: g.state.clock.age, year: g.state.clock.year });
  }

  it('默认配置：每年交界 / 事件自动暂停均开启', () => {
    const ap = g.Game.config.time.autoPause;
    assert.ok(ap && ap.year === true && ap.event === true, 'autoPause 默认应每年开启');
  });

  it('running 时推进数月不暂停，跨年交界才暂停，并广播 loop:autopause(year)', () => {
    fresh();
    g.state.running = true;
    const seen = [];
    const off = g.Game.bus.on('loop:autopause', (e) => seen.push(e.reason));
    runMonths(11); // 快满一年：都不应暂停
    assert.equal(g.state.running, true, '年内不应暂停');
    runYear(); // 跨年交界 → 暂停
    off();
    assert.equal(g.state.running, false, '跨年未自动暂停');
    assert.ok(seen.indexOf('year') >= 0, '未广播 loop:autopause(year)');
  });

  it('次年继续自动暂停（每一年一次）', () => {
    fresh();
    g.state.running = true;
    const seen = [];
    const off = g.Game.bus.on('loop:autopause', (e) => seen.push(e.reason));
    runYear();
    assert.equal(g.state.running, false, '第1年应暂停');
    g.state.running = true; // 玩家手动继续
    runMonths(6);
    assert.equal(g.state.running, true, '年内不应再次暂停');
    runYear();
    off();
    assert.equal(g.state.running, false, '第2年未自动暂停');
    assert.equal(seen.filter((r) => r === 'year').length, 2, '应恰好暂停两次');
  });

  it('running 时收到 decision:ask → 自动置暂停，并广播 loop:autopause(event)', () => {
    fresh();
    g.state.running = true;
    const seen = [];
    const off = g.Game.bus.on('loop:autopause', (e) => seen.push(e.reason));
    g.Game.bus.emit('decision:ask', { ev: { id: 'probe', choices: [] }, age: 5 });
    off();
    assert.equal(g.state.running, false, '事件未自动暂停');
    assert.ok(seen.indexOf('event') >= 0, '未广播 loop:autopause(event)');
  });

  it('autoPause 关闭时，running 跨年也不暂停', () => {
    fresh();
    g.state.autoPause = false;
    g.state.running = true;
    runYear();
    assert.equal(g.state.running, true, '关闭后不应自动暂停');
  });

  it('未 running（手动单步 / 测试驱动）时，year 事件不会把游戏"自动开始"', () => {
    fresh();
    g.state.running = false; // 未自动播放
    runYear();
    assert.equal(g.state.running, false, '不应因自动暂停逻辑而自动开始');
  });

  it('headless advanceMonths（running 始终为 false）不触发自动暂停副作用', () => {
    fresh();
    g.Game.loop.advanceMonths(18); // 内部会广播多个 month/year 事件
    assert.equal(g.state.running, false, '驱动推进不应改变运行态');
    assert.ok(g.state.clock.year > 1990, '应确实推进了年份');
  });
});
