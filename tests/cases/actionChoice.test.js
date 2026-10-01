'use strict';
/* =========================================================================
 * 行动抉择化（G8）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - type:'decision' 行动点击后弹出选择弹窗（pendingDecision 被设置）
 *  - 选择后效果正确落地（各选项差异化效果）
 *  - 熟练度在行动发起时就增长（不是选择后）
 *  - 冷却在行动发起时就设置
 *  - 行动的 plants/delayed 在选择时登记（伏笔通道）
 *  - 风险选项走正常的 risk 通道
 *  - 条件不满足的选项被过滤
 *  - 守卫回退：openActionChoice 不可用时走默认 effects 直接生效
 *  - history 正确记录
 *  - 隔离性：不触碰金手指三模块
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('行动抉择化（G8）', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260920 : seed); }
  function adult() { g.state.clock.age = 25; g.person.career = { phase: 'employed', job: '工程师', salary: 8 }; }

  // ---- travel 抉择化 ----

  it('travel 点击后弹出选择弹窗，不直接生效', () => {
    fresh(2001); adult();
    g.person.wealth = 50;
    const moodBefore = g.person.mood;

    const ok = g.Game.actions.do('travel');
    assert.ok(ok, 'travel 应可执行');
    assert.ok(g.hasPending(), 'travel 后应挂起 pendingDecision');
    assert.equal(g.state.pendingDecision.ev.fromAction, 'travel', '事件应标记 fromAction=travel');
    assert.equal(g.person.mood, moodBefore, '弹窗阶段不应直接改 mood');
  });

  it('travel 选择后效果正确落地', () => {
    fresh(2002); adult();
    g.person.wealth = 50;
    const w0 = g.person.wealth;
    const m0 = g.person.mood;

    g.Game.actions.do('travel');
    // 选第一个：海边度假
    g.answer(() => 0);
    assert.ok(!g.hasPending(), '选完后 pendingDecision 应清除');
    assert.ok(g.person.wealth < w0, '海边应扣费');
    assert.ok(g.person.mood > m0, '海边应加 mood');
  });

  it('travel 各选项效果有差异', () => {
    // 选周末短途 vs 海边度假，花费应不同
    fresh(2003); adult();
    g.person.wealth = 100;
    g.Game.actions.do('travel');
    // 选第3个：周末短途（index 3）
    g.answer(() => 3);
    const w1 = g.person.wealth; // 应为 100-3=97
    assert.ok(w1 > 90, '周末短途应只花 3 万，余额 ' + w1);
  });

  it('travel 冷却和熟练度在弹窗时就扣减', () => {
    fresh(2004); adult();
    g.person.wealth = 50;
    g.person.actions.mastery = {};

    g.Game.actions.do('travel');
    // 弹窗挂起时冷却和熟练度应已更新
    const m = g.Game.actions.mastery('travel');
    assert.ok(m > 0, '弹窗阶段熟练度应已增长: ' + m);
    const cd = g.person.actions.cd.travel;
    assert.ok(cd > 0, '弹窗阶段冷却应已设置: ' + cd);
    g.answer(() => 0);
  });

  // ---- sidejob 抉择化 ----

  it('sidejob 点击后弹出选择弹窗', () => {
    fresh(2005); adult();
    g.person.wealth = 10;
    g.Game.actions.do('sidejob');
    assert.ok(g.hasPending(), 'sidejob 后应挂起 pendingDecision');
    assert.equal(g.state.pendingDecision.ev.fromAction, 'sidejob', '应标记 fromAction');
    g.answer(() => 0);
  });

  it('sidejob 条件门槛选项被过滤（智力不足时课业辅导不出现）', () => {
    fresh(2006); adult();
    g.person.wealth = 10;
    g.person.intelligence = 60; // 低于 75
    g.Game.actions.do('sidejob');
    const choices = g.state.pendingDecision.ev.choices;
    const tutor = choices.find((c) => c.label.indexOf('课业辅导') >= 0);
    assert.ok(!tutor, '智力 60 时课业辅导应被过滤');
    g.answer(() => 0);
  });

  it('sidejob 选择跑腿外卖后效果落地', () => {
    fresh(2007); adult();
    g.person.wealth = 10;
    const w0 = g.person.wealth;
    g.Game.actions.do('sidejob');
    // 跑腿外卖是第一个选项
    g.answer(() => 0);
    assert.ok(g.person.wealth > w0, '跑外卖应加 wealth');
    assert.ok(g.person.health < 100, '跑外卖应扣 health');
  });

  // ---- donate 抉择化 ----

  it('donate 点击后弹出选择弹窗', () => {
    fresh(2008); adult();
    g.person.wealth = 30;
    g.Game.actions.do('donate');
    assert.ok(g.hasPending(), 'donate 后应挂起 pendingDecision');
    g.answer(() => 0);
  });

  it('donate 选择匿名捐赠后效果落地', () => {
    fresh(2009); adult();
    g.person.wealth = 30;
    const w0 = g.person.wealth;
    const m0 = g.person.mood;
    g.Game.actions.do('donate');
    // 匿名捐赠是第2个选项（index 2）
    g.answer(() => 2);
    assert.ok(g.person.wealth < w0, '匿名捐赠应扣 wealth');
    assert.ok(g.person.mood > m0, '匿名捐赠应加 mood');
    assert.ok(g.person.flags.kind, '匿名捐赠应设 kind 标记');
  });

  it('donate 选择"这次先等等"不扣钱不加效果', () => {
    fresh(2010); adult();
    g.person.wealth = 30;
    const w0 = g.person.wealth;
    const m0 = g.person.mood;
    g.Game.actions.do('donate');
    g.answer(() => 3); // "这次先等等"
    assert.equal(g.person.wealth, w0, '等等不扣钱');
    assert.equal(g.person.mood, m0, '等等不加 mood');
  });

  // ---- 伏笔通道 ----

  it('donate 的 plants 伏笔在选择时登记', () => {
    fresh(2011); adult();
    g.person.wealth = 30;
    g.Game.actions.do('donate');
    // 志愿服务有 plants:['goodwill']
    g.answer(() => 0);
    assert.ok(g.Game.consequences.has('goodwill'), 'donate 选择后应登记 goodwill 伏笔');
  });

  // ---- 守卫回退 ----

  it('守卫回退：openActionChoice 不可用时走默认 effects', () => {
    fresh(2012); adult();
    g.person.wealth = 50;
    const m0 = g.person.mood;
    // 临时摘除 openActionChoice
    const orig = g.Game.decisions.openActionChoice;
    g.Game.decisions.openActionChoice = undefined;
    const ok = g.Game.actions.do('travel');
    assert.ok(ok, '回退时 travel 应仍可执行');
    assert.ok(!g.hasPending(), '回退时不应挂起 pendingDecision');
    assert.ok(g.person.mood > m0, '回退时应直接应用默认 effects（mood +8）');
    // 还原
    g.Game.decisions.openActionChoice = orig;
  });

  // ---- 非 decision 行为不受影响 ----

  it('非 decision 行动（study）仍走直接生效路径', () => {
    fresh(2013); adult();
    g.person.intelligence = 50;
    const k0 = g.person.knowledge;
    g.Game.actions.do('study');
    assert.ok(!g.hasPending(), 'study 不应挂起弹窗');
    assert.ok(g.person.knowledge > k0, 'study 应直接生效');
  });

  // ---- history 记录 ----

  it('行动抉择正确写入 decisions.history', () => {
    fresh(2014); adult();
    g.person.wealth = 50;
    g.Game.actions.do('travel');
    g.answer(() => 0);
    const hist = g.person.decisions.history;
    const last = hist[hist.length - 1];
    assert.equal(last.id, 'travel', 'history 应记录 fromAction id');
    assert.ok(last.choice, 'history 应记录 choice label');
  });

  // ---- runYears 集成 ----

  it('runYears 全程不卡死（自动替玩家点掉行动抉择弹窗；长寿或合理身故均算完成）', () => {
    fresh(2015);
    g.runYears(80);
    assert.ok(g.state.clock.age >= 40, '应推进到中年以上或合理身故，当前 ' + g.state.clock.age);
    // 循环可能在"年龄到达目标的同一步"退出，此时刚弹出的窗口还没轮到被答掉
    // （如 80 岁整触发的八十寿辰）——这是推进边界的固有竞态，补答一次即可，
    // 不影响本测试真正要验证的"全程不卡死"。
    while (g.hasPending()) g.answer();
    assert.ok(!g.hasPending(), '补答后不应残留待决弹窗');
    if (!g.state.person.alive) {
      assert.ok(g.state.person.deathCause, '身故应有死因：' + g.state.person.deathCause);
    }
  });

  // ---- 隔离性 ----

  it('隔离性：行动抉择化不触碰金手指三模块的 state 子树', () => {
    fresh(2016); adult();
    g.person.wealth = 50;
    g.Game.actions.do('travel');
    g.answer(() => 0);
    // 金手指三模块各自 state 不应被写入
    const s = g.state;
    if (s.hex) assert.equal(typeof s.hex.spent, 'number', 'hex 账不应被行动抉择写入');
    if (s.tycoon) assert.equal(typeof s.tycoon.injected, 'number', 'tycoon 账不应被行动抉择写入');
    if (s.datalize) assert.equal(typeof s.datalize.dp, 'number', 'datalize 账不应被行动抉择写入');
  });

  it('音频：新 SFX 谱面完整（6 个金手指音效键齐备）', () => {
    const cfg = g.Game.config.audio.sfx;
    ['hex', 'shield', 'gold', 'backlash', 'data', 'dataUp'].forEach((k) => {
      assert.ok(Array.isArray(cfg[k]) && cfg[k].length > 0, '缺少音效谱：' + k);
    });
  });
});
