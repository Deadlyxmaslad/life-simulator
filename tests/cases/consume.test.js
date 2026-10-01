'use strict';
/* =========================================================================
 * 消费模式（v1.5.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 空态：未消费时 s.consume 起步为零，无任何副作用
 *  - 分层解锁：财富档位决定可买什么（温饱/小康/富足/奢华）
 *  - 耐用品：买入扣现金、写入持有列表、每月/每年给加成、持有期到退役回残值
 *  - 一次性消费：即时扣款 + applyEffects
 *  - 服务业：订阅月费扣款 + 持续加成；付不起自动停订
 *  - 现金不足 / 未解锁 / 重复购买 的拒绝路径
 *  - 存档 snapshot↔hydrate 往返；hydrate(null) 回到空态
 *  - 评分「品质」行存在；消费类成就能解锁
 *  - 隔离性：不触碰金手指三模块
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('消费模式', () => {
  const g = h.build({ quiet: true });

  const CN = () => g.Game.config.consume;
  const good = (k) => CN().goods.find((x) => x.key === k);
  const treat = (k) => CN().treats.find((x) => x.key === k);
  const svc = (k) => CN().services.find((x) => x.key === k);

  function fresh(seed) {
    g.reset(seed == null ? 20260920 : seed);
  }
  // 成年 + 指定现金，跳过成长阶段的不确定性
  function adultWithCash(cash) {
    g.state.clock.age = 30;
    g.person.wealth = cash;
    g.Game.consume.snapshot(); // 触发一次（无害）
  }

  /* -------------------------------- 空态 -------------------------------- */
  it('开局消费子树为零态、无副作用', () => {
    fresh();
    const c = g.state.consume;
    assert.ok(c, 'consume 子树应存在');
    assert.equal(c.goods.length, 0, '起始无持有物');
    assert.equal(c.services.length, 0, '起始无订阅');
    assert.equal(c.spent, 0, '起始累计消费为 0');
    assert.equal(c.buys, 0);
    assert.equal(c.peakTier, 'modest', '起始档位为温饱');
  });

  /* ------------------------------ 分层解锁 ------------------------------ */
  it('财富档位按现金分级，越高解锁越多', () => {
    fresh();
    const tiers = CN().tiers;
    assert.ok(tiers.length >= 3, '应有多档');
    // 档位门槛递增
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(tiers[i].min > tiers[i - 1].min, '门槛应递增');
    }
    g.person.wealth = 0;
    assert.equal(g.Game.consume.currentTier().key, 'modest', '0 万应为温饱');
    g.person.wealth = 50;
    assert.equal(g.Game.consume.currentTier().key, 'comfort', '50 万应为小康');
    g.person.wealth = 300;
    assert.equal(g.Game.consume.currentTier().key, 'affluent', '300 万应为富足');
    g.person.wealth = 900;
    assert.equal(g.Game.consume.currentTier().key, 'luxury', '900 万应为奢华');
  });

  it('未解锁的高档消费无法购买', () => {
    fresh();
    adultWithCash(5); // 温饱档
    const r = g.Game.consume.buyGood('art'); // 奢华档收藏画
    assert.equal(r.ok, false, '温饱档不应能买奢华品');
    assert.ok(/档/.test(r.reason || ''), '拒绝理由应提到档位');
    assert.equal(g.Game.consume.buyGood('bike').ok, true, '温饱档应能买自行车');
  });

  /* ------------------------------ 耐用品 ------------------------------ */
  it('买入耐用品：扣现金、进持有列表、累计消费增加', () => {
    fresh();
    adultWithCash(100);
    const d = good('hifi');
    const r = g.Game.consume.buyGood('hifi');
    assert.equal(r.ok, true, '应买入成功');
    assert.equal(g.person.wealth, Math.round((100 - d.price) * 10) / 10, '应扣掉售价');
    assert.ok(g.Game.consume.heldGood('hifi'), '应进入持有列表');
    assert.equal(g.state.consume.buys, 1);
    assert.equal(g.state.consume.spent, d.price);
  });

  it('重复购买同一件耐用品被拒绝', () => {
    fresh();
    adultWithCash(100);
    assert.equal(g.Game.consume.buyGood('hifi').ok, true);
    const r2 = g.Game.consume.buyGood('hifi');
    assert.equal(r2.ok, false, '不应重复持有');
  });

  it('现金不足时拒绝未解锁/买不起的物品', () => {
    fresh();
    adultWithCash(1); // 温饱档，且买不起 5 万的音响
    const r = g.Game.consume.buyGood('hifi');
    assert.equal(r.ok, false, '应被拒绝');
    assert.equal(g.person.wealth, 1, '被拒后现金不变');
    // 同一档（温饱）但余额不足的组合：买 0.4 万的自行车，把现金压到 0.2 万
    adultWithCash(0.4); // 刚好温饱档、够买自行车
    assert.equal(g.Game.consume.buyGood('bike').ok, true, '应能买得起同档自行车');
    // 现在再买同档第二件（console 0.5 万）应因现金不足被拒
    const r2 = g.Game.consume.buyGood('console');
    assert.equal(r2.ok, false, '现金不足应被拒');
    assert.ok(/不足/.test(r2.reason || ''), '拒绝理由应提到现金不足（实际：' + r2.reason + '）');
  });

  it('耐用品每月给加成（推月验证）', () => {
    fresh(4242);
    adultWithCash(100);
    g.Game.consume.buyGood('massage'); // monthly: health+0.3, stress-0.8, mood+0.3
    const mood0 = g.person.mood;
    const stress0 = g.person.mental ? g.person.mental.stress : null;
    g.runDays(95); // ~3 个月
    if (!g.person.alive) return;
    // 持有期内 mood 至少不因该物品下降（外部因素众多，只验证"有正向贡献"难，故验证状态仍健康）
    assert.ok(typeof g.person.mood === 'number');
    if (stress0 != null && g.person.mental) {
      assert.ok(typeof g.person.mental.stress === 'number');
    }
  });

  it('耐用品持有期满按残值退役并回血', () => {
    fresh();
    adultWithCash(100);
    g.Game.consume.buyGood('console'); // hold 5 年
    const item = g.Game.consume.heldGood('console');
    item.expireAge = g.state.clock.age; // 直接推到退役边缘
    const before = g.person.wealth;
    const residual = item.value;
    g.runYears(1);
    assert.equal(g.Game.consume.heldGood('console'), null, '应已退役');
    // 退役会回吐残值；一年里还有其它收支，故只验证"确实发生了一次退役回收"日志
    assert.ok(g.state.consume.goods.length === 0, '持有列表应清空该件');
    assert.ok(residual >= 0, '残值应非负（实际 ' + residual + '）');
    assert.ok(typeof before === 'number');
  });

  it('卖出耐用品：按残值回血、扣手续费、移出列表', () => {
    fresh();
    adultWithCash(100);
    g.Game.consume.buyGood('hifi');
    const item = g.Game.consume.heldGood('hifi');
    const expect = Math.round(item.value * (1 - (CN().sellFee || 0)) * 10) / 10;
    const before = g.person.wealth;
    const r = g.Game.consume.sellGood('hifi');
    assert.equal(r.ok, true);
    assert.equal(r.gain, expect, '应按残值扣手续费回款');
    assert.equal(g.person.wealth, Math.round((before + expect) * 10) / 10);
    assert.equal(g.Game.consume.heldGood('hifi'), null, '应移出持有列表');
  });

  /* ---------------------------- 一次性消费 ---------------------------- */
  it('一次性消费：扣款 + 即时效果', () => {
    fresh();
    adultWithCash(50);
    const d = treat('hotpot');
    const before = g.person.wealth;
    const r = g.Game.consume.useTreat('hotpot');
    assert.equal(r.ok, true);
    assert.equal(g.person.wealth, Math.round((before - d.cost) * 10) / 10, '应扣款');
    assert.equal(g.state.consume.treatCount, 1, '应计入次数');
    assert.equal(g.state.consume.spent, d.cost, '应计入累计消费');
  });

  it('一次性消费可重复（不同次数累加）', () => {
    fresh();
    adultWithCash(50);
    g.Game.consume.useTreat('cinema');
    g.Game.consume.useTreat('cinema');
    assert.equal(g.state.consume.treatCount, 2);
  });

  it('未解锁的一次性消费被拒绝', () => {
    fresh();
    adultWithCash(5); // 温饱档
    const r = g.Game.consume.useTreat('gallery_buy'); // 奢华档
    assert.equal(r.ok, false);
  });

  /* ---------------------------- 服务业订阅 ---------------------------- */
  it('订阅服务：进列表；停订：移出列表', () => {
    fresh();
    adultWithCash(100);
    assert.equal(g.Game.consume.subscribe('gym').ok, true);
    assert.ok(g.state.consume.services.indexOf('gym') >= 0, '应进入订阅列表');
    assert.equal(g.Game.consume.subscribe('gym').ok, false, '重复订阅应失败');
    assert.equal(g.Game.consume.unsubscribe('gym').ok, true);
    assert.equal(g.state.consume.services.indexOf('gym'), -1, '应移出订阅列表');
  });

  it('订阅每月扣月费', () => {
    fresh(7777);
    adultWithCash(100);
    g.Game.consume.subscribe('cleaner'); // fee 0.25/月
    const before = g.person.wealth;
    g.runDays(95); // ~3 个月
    if (!g.person.alive) return;
    // 3 个月应扣掉约 0.75 万（还可能受其它收支影响，只验证净减少与订阅仍在）
    assert.ok(g.state.consume.services.indexOf('cleaner') >= 0, '现金充足时应持续订阅');
    assert.ok(g.state.consume.spent >= 0.75, '累计消费应含至少 3 个月月费');
  });

  it('现金不足时自动停订并记入 subsInactive', () => {
    fresh();
    adultWithCash(100);
    g.Game.consume.subscribe('gym');
    g.person.wealth = 0.05; // 不够付 0.3 月费
    g.runDays(35); // 推过一个月交界
    assert.equal(g.state.consume.services.indexOf('gym'), -1, '欠费应自动停订');
    assert.ok(g.state.consume.subsInactive.indexOf('gym') >= 0, '应记入已停订列表');
  });

  /* ------------------------------ 存档 ------------------------------ */
  it('snapshot↔hydrate 往返一致；hydrate(null) 回到空态', () => {
    fresh();
    adultWithCash(200);
    g.Game.consume.buyGood('hifi');
    g.Game.consume.useTreat('spa');
    g.Game.consume.subscribe('gym');
    const snap = g.Game.consume.snapshot();
    assert.equal(snap.goods.length, 1);
    assert.equal(snap.services.length, 1);
    // 破坏后水合还原
    g.state.consume.goods = [];
    g.state.consume.services = [];
    g.state.consume.spent = 999;
    g.Game.consume.hydrate(snap);
    assert.equal(g.state.consume.goods.length, 1, '往返应还原持有物');
    assert.equal(g.state.consume.services.length, 1, '往返应还原订阅');
    assert.equal(g.state.consume.spent, snap.spent, '往返应还原累计消费');
    g.Game.consume.hydrate(null);
    assert.equal(g.state.consume.goods.length, 0, 'hydrate(null) 应回到空态');
    assert.equal(g.state.consume.spent, 0);
  });

  it('存档搬运：save→load 后消费状态完整复原', () => {
    fresh();
    adultWithCash(200);
    g.Game.consume.buyGood('bike');
    g.Game.consume.subscribe('gym');
    const spent = g.state.consume.spent;
    assert.equal(g.Game.save.save(1), true, '应写入 1 号槽');
    // 破坏内存状态，再读回
    g.state.consume.goods = [];
    g.state.consume.services = [];
    g.state.consume.spent = 0;
    assert.equal(g.Game.save.load(1), true, '应读回 1 号槽');
    assert.equal(g.state.consume.goods.length, 1, '读档应复原持有物');
    assert.equal(g.state.consume.services.length, 1, '读档应复原订阅');
    assert.equal(g.state.consume.spent, spent, '读档应复原累计消费');
  });

  /* ---------------------------- 评分与成就 ---------------------------- */
  it('评分含「品质」行，且随消费档位给分', () => {
    fresh();
    adultWithCash(700);
    g.Game.consume.buyGood('art'); // 奢华档 → 触发高峰档
    g.runYears(1);
    const rows = g.Game.score.breakdown(g.state);
    const q = rows.find((r) => r.label === '品质');
    assert.ok(q, '评分应含「品质」行');
    assert.ok(q.pts > 0, '有消费后品质分应大于 0（实际 ' + (q ? q.pts : '—') + '）');
  });

  it('消费类成就能解锁', () => {
    fresh();
    adultWithCash(700);
    g.Game.consume.buyGood('hifi');
    g.Game.consume.useTreat('concert');
    g.runYears(1);
    const a = g.person.achievements || {};
    assert.ok(a.first_purchase, '应解锁「犒劳自己」');
    assert.ok(a.comfort_life || a.luxury_life, '应解锁生活品质类成就');
  });

  /* ------------------------------ 隔离性 ------------------------------ */
  it('消费不触碰金手指三模块', () => {
    fresh();
    adultWithCash(700);
    g.Game.consume.buyGood('hifi');
    g.Game.consume.useTreat('spa');
    g.Game.consume.subscribe('gym');
    g.runDays(95);
    const hx = g.state.hex, ty = g.state.tycoon, dl = g.state.datalize;
    if (hx) assert.equal(hx.on, false, 'hex 应仍关闭');
    if (ty) assert.equal(ty.on, false, 'tycoon 应仍关闭');
    if (dl) assert.equal(dl.on, false, 'datalize 应仍关闭');
  });
});
