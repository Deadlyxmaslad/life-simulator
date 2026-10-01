'use strict';
/* =========================================================================
 * 💰 神壕（tycoon）测试
 * -------------------------------------------------------------------------
 * 覆盖：默认关闭、提款随年份缩放、月额度与冷却约束、钞能力兑换的边际递减、
 *       清债走真实按揭通道、树大招风延时反噬、结算折损与存档。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

function clearQuota(G) {
  const s = G.state.s.tycoon;
  s.quotaUsed = 0;
  s.times = {};
  s.cd = {};
}

describe('💰 神壕（tycoon）· 财富类外挂', () => {
  const g = h.build({ quiet: true });
  const G = g.Game;
  const T = G.config.tycoon;

  it('默认关闭：关闭时任何操作都被拒绝且不入账', () => {
    g.reset(6701);
    assert.notOk(G.tycoon.isOn(), '默认应处于关闭态');
    const w = g.person.wealth;
    assert.notOk(G.tycoon.withdraw(), '关闭时不应允许提款');
    assert.notOk(G.tycoon.convert('hire_tutor'), '关闭时不应允许兑换');
    assert.equal(g.person.wealth, w, '关闭时任何操作都不得改动现金');
    assert.equal(G.tycoon.rebate(), 1, '未使用不应有折损');
  });

  it('提款：金额随真实年份缩放，入账并占用本月额度', () => {
    g.reset(6702);
    G.tycoon.enable();
    clearQuota(G);
    const s = G.state.s.tycoon;
    const p = g.person;
    p.wealth = 100;
    const amount = G.tycoon.withdrawAmount ? G.tycoon.withdrawAmount() : null;
    const before = p.wealth;
    assert.ok(G.tycoon.withdraw(), '提款应成功');
    const expect = Math.round(T.withdraw.base * Math.pow(T.withdraw.perYear, G.state.s.clock.year - T.withdraw.refYear) * 10) / 10;
    assert.equal(s.injected, expect, '注入金额应等于按年份缩放后的基数');
    assert.equal(p.wealth, Math.round((before + expect) * 10) / 10, '现金未正确入账');
    assert.equal(s.quotaUsed, 1, '应占用一次月额度');
    assert.equal(s.cd.withdraw, T.withdraw.cdMonth, '应进入冷却');
    assert.ok(p.flags.used_tycoon, '应打上本模块自己的标记');
    if (typeof amount === 'number') assert.equal(amount, expect, 'withdrawAmount 与入账口径应一致');
  });

  it('月额度耗尽后再提款被拒绝，且现金不变化', () => {
    g.reset(6703);
    G.tycoon.enable();
    clearQuota(G);
    const p = g.person;
    p.wealth = 50;
    assert.ok(G.tycoon.withdraw(), '首次提款应成功');
    const after = p.wealth;
    assert.notOk(G.tycoon.usable('withdraw'), '额度用尽后不应可用');
    assert.notOk(G.tycoon.withdraw(), '额度用尽应拒绝');
    assert.equal(p.wealth, after, '被拒绝的提款不得入账');
    clearQuota(G);
    assert.ok(G.tycoon.usable('withdraw'), '次月额度恢复后应可用');
  });

  it('钞能力兑换：同一条目本月第二次效果边际递减，并带来性格漂移', () => {
    g.reset(6704);
    G.tycoon.enable();
    clearQuota(G);
    const p = g.person;
    p.wealth = 500;
    const kn0 = p.knowledge || 0;
    const C0 = p.personality.C;
    assert.ok(G.tycoon.convert('hire_tutor'), '首次兑换应成功');
    const gain1 = (p.knowledge || 0) - kn0;
    assert.ok(gain1 > 0, '兑换应带来学识增长');
    const cost = T.convert.filter((x) => x.id === 'hire_tutor')[0].cost;
    assert.equal(p.wealth, 500 - cost, '应扣除对应金额');
    assert.ok(p.personality.C < C0, '大额消费应带来性格漂移（C 下降）');

    // 只放开额度，不动本月次数 → 才是"同月第二次"
    G.state.s.tycoon.quotaUsed = 0;
    const kn1 = p.knowledge;
    assert.ok(G.tycoon.convert('hire_tutor'), '同月第二次兑换应成功');
    const gain2 = p.knowledge - kn1;
    assert.equal(gain2, Math.round(gain1 * 0.6 * 10) / 10, '第二次效果应按 decay 递减');
  });

  it('清债：按剩余按揭收手续费，结清真实负债而不仅是改一个字段', () => {
    g.reset(6705);
    G.tycoon.enable();
    clearQuota(G);
    const p = g.person;
    const a = G.assets;
    p.career = { income: 60, phase: 'employed' };
    p.wealth = 800;
    const bought = a.buy('house', 'two_room');
    assert.ok(bought && bought.ok, '测试前置：买房应成功（' + (bought.reason || '') + '）');
    const debt = p.assets.mortgage;
    assert.ok(debt > 0, '测试前置：应产生按揭');
    const w0 = p.wealth;
    assert.ok(G.tycoon.usable('clear_debt'), '有负债时应可用');
    assert.ok(G.tycoon.clearDebt(), '清债应成功');
    assert.equal(p.assets.mortgage, 0, '剩余按揭应归零');
    assert.equal(p.assets.installment, 0, '月供应归零');
    assert.equal(p.assets.cleared, true, '应标记为已结清');
    assert.ok(p.flags.debt_free, '应打上无债标记');
    const fee = Math.round(debt * T.clearDebt.feeRatio * 100) / 100;
    assert.equal(p.wealth, Math.round((w0 - fee) * 10) / 10, '手续费扣减不符');
  });

  it('越过阈值后会触发一次"树大招风"延时反噬', () => {
    g.reset(6706);
    G.tycoon.enable();
    const s = G.state.s.tycoon;
    const p = g.person;
    let fired = 0;
    const off = G.bus.on('tycoon:backlash', function () { fired++; });
    let guard = 0;
    while (!fired && guard < 200) {
      clearQuota(G);
      s.backlashDone = false;
      p.wealth = T.backlash.threshold + 500;
      G.tycoon.withdraw();
      guard++;
    }
    off();
    assert.ok(fired > 0, '净资产越过阈值后应至少触发一次反噬');
    assert.ok(s.backlashDone, '触发后应记录，避免重复触发');
  });

  it('注入资金不被 career 年度个税吃掉（个税只对收入征收）', () => {
    g.reset(6720);
    g.runYears(24);
    // 本测试验证"注入的钱不被按净资产比例抽税"。班级系统的考试加成可能改变该种子下的
    // 升学路径（24 岁仍在读研/复读），与断言无关——强制在职以聚焦真正要验证的行为。
    g.person.career = { phase: 'employed', job: '工程师', income: 14, workYears: 2, retired: false, level: '本科' };
    assert.ok(G.career.isWorking(), '此阶段应在职');
    const balance = 3000;
    g.person.wealth = balance;
    const before = g.person.wealth;
    g.runDays(400); // 必定跨过一个生日（年度结算节点）
    const delta = g.person.wealth - before;
    assert.ok(delta >= -balance * 0.03, '余额不应被按财富比例抽税（实测变化 ' + delta.toFixed(1) + ' 万）');
  });

  it('结算折损：按累计注入金额折算并停在配置下限', () => {
    g.reset(6707);
    G.tycoon.enable();
    G.state.s.tycoon.injected = 0;
    assert.equal(G.tycoon.rebate(), 1, '零注入不折损');
    G.state.s.tycoon.injected = T.scoreRebate.per / 2;
    assert.near(G.tycoon.rebate(), 0.5, 1e-6, '半程应折损一半');
    G.state.s.tycoon.injected = T.scoreRebate.per * 20;
    assert.equal(G.tycoon.rebate(), T.scoreRebate.min, '应停在配置下限');
  });

  it('存档：只序列化本模块自己的账，hydrate 可复原', () => {
    g.reset(6708);
    G.tycoon.enable();
    G.state.s.tycoon.injected = 123.4;
    const snap = G.tycoon.snapshot();
    assert.equal(snap.injected, 123.4, '应记录累计注入');
    G.tycoon.hydrate(snap);
    assert.equal(G.state.s.tycoon.injected, 123.4, '复原后应一致');
    G.tycoon.hydrate(null);
    assert.equal(G.state.s.tycoon.injected, 0, '旧存档（无此字段）应复位到默认值');
  });
});
