'use strict';
/* =========================================================================
 * J7 反馈强化收尾（v1.9.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 三模块 panel() 描述符自带 balance（text + ok），UI 无需懂业务
 *  - 资源充足 ok=true；耗尽/不足 ok=false（置灰依据）
 *  - balance 只读自己模块的账（隔离性）
 *  - 高分榜条目带 mods 模块标记（本局开过哪些金手指）
 *  - 纯净局 mods 为空数组
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('J7 反馈强化 · 余额角标与结算三本账', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260923 : seed); }

  /* ------------------------------ hex ------------------------------ */

  it('hex.panel().balance：HE 余额与充足性', () => {
    fresh(5001);
    const S = g.Game.state.s;
    S.hex.on = true;
    S.hex.he = 50;
    const p = g.Game.hex.panel();
    assert.ok(p.balance, 'hex 描述符应带 balance');
    assert.ok(p.balance.text.indexOf('HE') >= 0, '角标文本应含 HE：' + p.balance.text);
    assert.equal(p.balance.ok, true, 'HE 充足时应为 ok');
    S.hex.he = 0;
    assert.equal(g.Game.hex.panel().balance.ok, false, 'HE 归零应置灰');
  });

  /* ----------------------------- tycoon ----------------------------- */

  it('tycoon.panel().balance：本月额度余量', () => {
    fresh(5002);
    const S = g.Game.state.s;
    S.tycoon.on = true;
    const p = g.Game.tycoon.panel();
    assert.ok(p.balance, 'tycoon 描述符应带 balance');
    assert.ok(p.balance.text.indexOf('额度') >= 0, '角标文本应含 额度：' + p.balance.text);
    assert.equal(p.balance.ok, true, '初始额度应充足');
    // 把额度耗光：quotaUsed 设为 quotaTotal 使 remaining()=0
    const total = g.Game.tycoon.quota();
    S.tycoon.quotaUsed = total;
    assert.equal(g.Game.tycoon.panel().balance.ok, false, '额度耗尽应置灰');
  });

  /* ---------------------------- datalize ---------------------------- */

  it('datalize.panel().balance：观测点 DP', () => {
    fresh(5003);
    const S = g.Game.state.s;
    S.datalize.on = true;
    S.datalize.dp = 30;
    const p = g.Game.datalize.panel();
    assert.ok(p.balance, 'datalize 描述符应带 balance');
    assert.ok(p.balance.text.indexOf('DP') >= 0, '角标文本应含 DP：' + p.balance.text);
    assert.equal(p.balance.ok, true, 'DP 充足时应为 ok');
    S.datalize.dp = 0;
    assert.equal(g.Game.datalize.panel().balance.ok, false, 'DP 归零应置灰');
  });

  /* ----------------------------- 隔离性 ----------------------------- */

  it('隔离性：balance 只读自己模块的账', () => {
    fresh(5004);
    const S = g.Game.state.s;
    const before = g.Game.tycoon.panel().balance.text + '|' + g.Game.datalize.panel().balance.text;
    S.hex.he = 999; // 动海克斯的账
    const after = g.Game.tycoon.panel().balance.text + '|' + g.Game.datalize.panel().balance.text;
    assert.equal(after, before, 'hex 的余额变化不应影响 tycoon/datalize 角标');
  });

  it('缺模块守卫：摘除任一模块，其余角标照常', () => {
    fresh(5005);
    const hexBak = g.Game.hex;
    g.Game.hex = undefined; // 模拟脚本被删
    assert.ok(g.Game.tycoon.panel().balance, 'tycoon 角标应照常');
    assert.ok(g.Game.datalize.panel().balance, 'datalize 角标应照常');
    g.Game.hex = hexBak; // 完整还原（含 rebate/pack 等方法）
  });

  /* --------------------------- 高分榜 mods --------------------------- */

  it('高分榜条目带 mods 标记：开过谁就标谁（消耗足够导致 scoreRebate < 1 才入账）', () => {
    fresh(5006);
    // 直接操作 Game.state.s（与 usedModules 内部的 st.s 是同一个引用），
    // 避免 g.state getter 与 Game.state.s 之间的任何 timing 差异
    const S = g.Game.state.s;
    S.person.flags = { used_hex: true, used_datalize: true };
    S.hex.spent = 50;
    S.datalize.spent = 50;
    // 验证状态真的到位了
    assert.ok(S.hex.spent > 0, 'hex spent 应已设置');
    assert.ok(g.Game.hex.rebate() < 1, 'hex rebate 应 < 1，实际 ' + g.Game.hex.rebate());
    const mods = g.Game.score.usedModules(S.person);
    assert.ok(mods.indexOf('hex') >= 0, 'mods 应含 hex：' + JSON.stringify(mods));
    assert.ok(mods.indexOf('datalize') >= 0, 'mods 应含 datalize：' + JSON.stringify(mods));
    assert.ok(mods.indexOf('tycoon') < 0, 'mods 不应含未使用的 tycoon');
  });

  it('纯净局：无旗标 + 零消耗 → mods 为空', () => {
    fresh(5007);
    const S = g.Game.state.s;
    S.person.flags = {};
    const mods = g.Game.score.usedModules(S.person);
    assert.equal(mods.length, 0, '纯净局 mods 为空：' + JSON.stringify(mods));
  });
});
