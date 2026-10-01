'use strict';
/* =========================================================================
 * 投资开户自选（v1.8.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 未开户时任何市场都不可交易
 *  - openMarket 按市场开通 + 幂等 + 补种 investor 种子
 *  - canTrade 仍受年龄 / 财富门槛约束
 *  - invest_open 抉择三选一各自只开对应市场
 *  - 币圈时代事件参与即开币户
 *  - 旧档兼容：无 openedMarkets 字段时按旧语义视为双开
 *  - snapshot 只展示已开户市场
 *  - 补开户事件的 condition 判定
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('投资开户自选（v1.8.0）', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260921 : seed); }
  function adult() { g.state.clock.age = 30; g.person.wealth = 100; }

  function askEvent(id) {
    const ev = g.Game.config.decisions.events.find((e) => e.id === id);
    assert.ok(ev, '事件应存在：' + id);
    g.state.pendingDecision = { ev: ev, age: g.state.clock.age };
    return ev;
  }

  it('初始状态：未开户，任何市场都不可交易', () => {
    fresh(3001); adult();
    assert.equal(g.Game.invest.isOpen('stock'), false, 'A股默认未开户');
    assert.equal(g.Game.invest.isOpen('crypto'), false, '虚拟币默认未开户');
    assert.equal(g.Game.invest.canTrade('stock'), false, '未开户不可交易A股');
    assert.equal(g.Game.invest.canTrade('crypto'), false, '未开户不可交易虚拟币');
  });

  it('openMarket 按市场开通，并补种 investor 种子', () => {
    fresh(3002); adult();
    assert.ok(g.Game.invest.openMarket('stock'), '开户应成功');
    assert.equal(g.Game.invest.isOpen('stock'), true, 'A股已开户');
    assert.equal(g.Game.invest.isOpen('crypto'), false, '虚拟币仍未开户');
    assert.ok(g.Game.consequences.has('investor'), '开户应补种 investor 种子');
    assert.equal(g.Game.invest.openMarket('stock'), false, '重复开户应幂等返回 false');
  });

  it('canTrade 仍受年龄与财富门槛约束', () => {
    fresh(3003);
    g.Game.invest.openMarket('stock');
    g.state.clock.age = 15; g.person.wealth = 100;
    assert.equal(g.Game.invest.canTrade('stock'), false, '未成年不可交易');
    g.state.clock.age = 30; g.person.wealth = 1;
    assert.equal(g.Game.invest.canTrade('stock'), false, '财富不足不可交易');
    g.person.wealth = 100;
    assert.equal(g.Game.invest.canTrade('stock'), true, '成年且有财富应可交易');
  });

  it('开户抉择三选一：只开A股', () => {
    fresh(3004); adult();
    const ev = askEvent('invest_open');
    g.Game.decisions.choose(0); // 只开A股
    assert.ok(!g.hasPending(), '选后弹窗应清除');
    assert.equal(g.Game.invest.isOpen('stock'), true, 'A股应开户');
    assert.equal(g.Game.invest.isOpen('crypto'), false, '虚拟币不应被连带开户');
    assert.ok(g.person.flags.investor, 'investor 旗标应置位');
  });

  it('开户抉择三选一：直奔虚拟币', () => {
    fresh(3005); adult();
    askEvent('invest_open');
    g.Game.decisions.choose(1); // 直奔虚拟币
    assert.equal(g.Game.invest.isOpen('crypto'), true, '虚拟币应开户');
    assert.equal(g.Game.invest.isOpen('stock'), false, 'A股不应被连带开户');
  });

  it('开户抉择三选一：双开', () => {
    fresh(3006); adult();
    askEvent('invest_open');
    g.Game.decisions.choose(2); // 都开
    assert.equal(g.Game.invest.isOpen('stock'), true, 'A股应开户');
    assert.equal(g.Game.invest.isOpen('crypto'), true, '虚拟币应开户');
  });

  it('币圈时代事件参与即开币户（2017 全仓杀入）', () => {
    fresh(3007); adult();
    g.Game.invest.openMarket('stock'); // 只开了A股的玩家
    const ev = askEvent('era_2017_crypto');
    g.Game.decisions.choose(0); // 全仓杀入
    assert.equal(g.Game.invest.isOpen('crypto'), true, '参与币圈应自动开币户');
    assert.equal(g.Game.invest.isOpen('stock'), true, '原A股户保持');
  });

  it('旧档兼容：无 openedMarkets 字段但入过市 → 两市场视为已开通', () => {
    fresh(3008); adult();
    // 模拟 v1.7.x 老档：只有 opened/investor 痕迹，没有 openedMarkets
    delete g.person.invest.openedMarkets;
    g.person.invest.opened = true;
    g.person.flags.investor = true;
    assert.equal(g.Game.invest.isOpen('stock'), true, '旧档 A股应视为已开');
    assert.equal(g.Game.invest.isOpen('crypto'), true, '旧档 虚拟币应视为已开');
  });

  it('snapshot 只展示已开户市场', () => {
    fresh(3009); adult();
    let snap = g.Game.invest.snapshot();
    assert.equal(snap.length, 0, '未开户时面板无行');
    g.Game.invest.openMarket('stock');
    snap = g.Game.invest.snapshot();
    assert.equal(snap.length, 1, '只开A股时面板 1 行');
    assert.equal(snap[0].key, 'stock', '展示的应是 A股');
  });

  it('补开户事件 condition：已开币户时 crypto_open 不再满足', () => {
    fresh(3010); adult();
    g.Game.invest.openMarket('both');
    const ev = g.Game.config.decisions.events.find((e) => e.id === 'crypto_open');
    assert.ok(ev, 'crypto_open 应存在');
    assert.equal(ev.condition(g.person), false, '双开后不应再满足开户条件');
    const ev2 = g.Game.config.decisions.events.find((e) => e.id === 'stock_open');
    assert.equal(ev2.condition(g.person), false, '双开后 stock_open 也不应满足');
  });

  it('单市场玩家满足对应补开户条件', () => {
    fresh(3011); adult();
    g.Game.invest.openMarket('stock');
    const ev = g.Game.config.decisions.events.find((e) => e.id === 'crypto_open');
    assert.equal(ev.condition(g.person), true, '只开A股时应满足币圈开户条件');
    const ev2 = g.Game.config.decisions.events.find((e) => e.id === 'stock_open');
    assert.equal(ev2.condition(g.person), false, '已开A股时 stock_open 不满足');
  });
});
