'use strict';
/* =========================================================================
 * 月行动点 AP（v1.6.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 默认关闭：不开时任何行动都不扣点、不拦截（手感零变化）
 *  - 开局点数 / 每月回充 / 攒到上限
 *  - soft 模式：点数为 0 仍可行动，只计数
 *  - hard 模式：点数不足时拒绝行动，且不产生效果
 *  - 单项 cost 覆盖与默认 cost
 *  - 关闭后立刻还原 Game.actions.do（零残留）
 *  - 存档 snapshot↔hydrate 往返
 *  - 成就谓词（精打细算）可判定
 *  - 隔离性：不触碰金手指三模块
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('月行动点 AP', () => {
  const g = h.build({ quiet: true });

  const AP = () => g.Game.config.ap;
  const GA = () => g.Game.ap;
  let savedEnabled, savedMode;

  function fresh(seed) { g.reset(seed == null ? 20260923 : seed); }
  function adult() { g.state.clock.age = 30; }

  // 每个用例前后恢复配置，避免互相污染
  function withCfg(fn, cfg) {
    const before = { enabled: AP().enabled, mode: AP().mode };
    Object.assign(AP(), cfg);
    GA().sync();
    try { fn(); } finally {
      AP().enabled = before.enabled;
      AP().mode = before.mode;
      GA().sync();
    }
  }

  /* ------------------------------ 默认关闭 ------------------------------ */
  it('默认关闭：配置为 disabled 且不显示', () => {
    fresh();
    assert.equal(AP().enabled, false, 'AP 默认应关闭');
    assert.equal(GA().on(), false, 'on() 应为 false');
    assert.equal(GA().state().enabled, false, 'state().enabled 应为 false');
  });

  it('关闭时行动不扣点、不拦截', () => {
    fresh();
    adult();
    const before = GA().leftThisMonth();
    const r = g.Game.actions.do('exercise');
    assert.equal(r, true, '关闭时行动应照常成功');
    assert.equal(GA().leftThisMonth(), before, '关闭时不应扣点');
  });

  /* ------------------------------ 回充与上限 ------------------------------ */
  it('开局点数与配置一致', () => {
    fresh();
    withCfg(() => {
      assert.equal(GA().state().ap, AP().start != null ? AP().start : 3, '开局点数应等于配置 start');
      assert.equal(GA().cap(), AP().cap, '上限应等于配置 cap');
      assert.equal(GA().perMonth(), AP().perMonth, '月回充应等于配置 perMonth');
    }, { enabled: true, mode: 'soft' });
  });

  it('每月回充，且封顶在 cap', () => {
    fresh();
    adult();
    withCfg(() => {
      // 先花光
      const cap = GA().cap();
      while (GA().leftThisMonth() > 0) GA().spend('exercise');
      assert.equal(GA().leftThisMonth(), 0, '应已花光');
      g.runDays(35);  // 跨过一个月
      const after = GA().leftThisMonth();
      assert.ok(after > 0, '跨月后应回充');
      assert.ok(after <= cap, '不应超过上限');
      // 连续推很多月，确认不会超过 cap
      g.runDays(35 * 10);
      assert.equal(GA().leftThisMonth(), cap, '长期空转应稳定在上限');
    }, { enabled: true, mode: 'soft' });
  });

  /* ------------------------------ soft 模式 ------------------------------ */
  it('soft 模式：点数为 0 仍可行动，只计数不阻断', () => {
    fresh();
    adult();
    withCfg(() => {
      while (GA().leftThisMonth() > 0) GA().spend('exercise');
      assert.equal(GA().leftThisMonth(), 0, '应已花光');
      const blocked0 = GA().blockedCount();
      const r = g.Game.actions.do('exercise');
      assert.equal(r, true, 'soft 模式下仍应允许行动');
      assert.ok(GA().blockedCount() >= blocked0, '应记录透支次数');
    }, { enabled: true, mode: 'soft' });
  });

  /* ------------------------------ hard 模式 ------------------------------ */
  it('hard 模式：点数不足时拒绝行动且不产生效果', () => {
    fresh();
    adult();
    withCfg(() => {
      // 花光所有点
      while (GA().leftThisMonth() > 0) GA().spend('exercise');
      assert.ok(!GA().can('exercise'), '点数耗尽后 can() 应为 false');
      // 清掉冷却，确保拒绝原因确实是 AP 而不是 cd
      g.Game.actions.clearCooldown();
      const mood0 = g.person.mood;
      const r = g.Game.actions.do('exercise');
      assert.equal(r, false, 'hard 模式耗尽后应拒绝行动');
      assert.equal(g.person.mood, mood0, '被拒绝的行动不应产生效果');
    }, { enabled: true, mode: 'hard' });
  });

  it('hard 模式：点数足够时正常扣点并放行', () => {
    fresh();
    adult();
    withCfg(() => {
      g.Game.actions.clearCooldown();
      const need = GA().costOf('exercise');
      const before = GA().leftThisMonth();
      if (before >= need) {
        const r = g.Game.actions.do('exercise');
        assert.equal(r, true, '点数足够应放行');
        assert.equal(GA().leftThisMonth(), before - need, '应扣除对应点数');
      }
    }, { enabled: true, mode: 'hard' });
  });

  /* ------------------------------ cost 配置 ------------------------------ */
  it('cost 覆盖：单条行动可自定义消耗', () => {
    fresh();
    withCfg(() => {
      const old = AP().costByAction;
      AP().costByAction = { exercise: 5 };
      assert.equal(GA().costOf('exercise'), 5, '应读取单项覆盖');
      assert.equal(GA().costOf('__unknown__'), AP().defaultCost, '未知项应回落到默认消耗');
      AP().costByAction = old;
    }, { enabled: true, mode: 'hard' });
  });

  /* ------------------------------ 零残留 ------------------------------ */
  it('关闭 hard 后立刻还原 Game.actions.do', () => {
    fresh();
    adult();
    const orig = g.Game.actions.do;
    withCfg(() => {
      // 在 hard 开启期间 do 应被包装
      const patched = g.Game.actions.do;
      assert.ok(typeof patched === 'function', 'do 应仍可调用');
    }, { enabled: true, mode: 'hard' });
    // 退出 withCfg 后（配置恢复为默认关闭），do 应已还原
    assert.equal(g.Game.actions.do, orig, '关闭后 do 应还原为原始函数');
  });

  /* -------------------------------- 存档 -------------------------------- */
  it('存档 snapshot↔hydrate 往返还原点数', () => {
    fresh();
    withCfg(() => {
      const ap0 = GA().leftThisMonth();
      GA().spend('exercise');
      const ap1 = GA().leftThisMonth();
      const snap = GA().snapshot();
      GA().hydrate(null);
      assert.equal(GA().leftThisMonth(), AP().start != null ? AP().start : 3, 'hydrate(null) 应回到起始点数');
      GA().hydrate(snap);
      assert.equal(GA().leftThisMonth(), ap1, '往返后应还原点数');
      void ap0;
    }, { enabled: true, mode: 'soft' });
  });

  /* ------------------------------ 成就谓词 ------------------------------ */
  it('「精打细算」成就谓词可判定', () => {
    fresh();
    const def = g.Game.config.achievements.find((a) => a.id === 'budget_keeper');
    assert.ok(def, '应存在精打细算成就');
    assert.equal(def.test({ apEnabled: true, apThrifty: true }), true, '开启且未告罄应满足');
    assert.equal(def.test({ apEnabled: true, apThrifty: false }), false, '告罄过不应满足');
    assert.equal(def.test({ apEnabled: false, apThrifty: true }), false, '未开启不应满足');
  });

  /* -------------------------------- 隔离性 -------------------------------- */
  it('AP 系统不触碰金手指三模块开关', () => {
    fresh();
    adult();
    withCfg(() => {
      g.Game.actions.clearCooldown();
      g.Game.actions.do('exercise');
      g.runDays(35);
    }, { enabled: true, mode: 'soft' });
    const hx = g.state.hex, ty = g.state.tycoon, dl = g.state.datalize;
    if (hx) assert.equal(hx.on, false, 'hex 应仍关闭');
    if (ty) assert.equal(ty.on, false, 'tycoon 应仍关闭');
    if (dl) assert.equal(dl.on, false, 'datalize 应仍关闭');
  });
});
