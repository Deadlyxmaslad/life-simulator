'use strict';
/* =========================================================================
 * 资产系统测试（B6 · 房产 / 车辆）
 * -------------------------------------------------------------------------
 * 覆盖：买入（首付 / 按揭 / 登记 / 事件广播）、等额本息月供公式、
 *       年度摊销与维护费、净值口径、卖出结清房贷、资产上限与门槛拒绝、
 *       房价指数与车辆折旧、还清最后一笔房贷。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

describe('资产 · 房产与车辆（B6）', () => {
  const g = h.build({ quiet: true });

  it('买入房产：按比例扣首付、按揭入负债、登记资产并广播事件', () => {
    g.reset(8801);
    const p = g.person;
    const A = g.Game.config.assets;
    const GA = g.Game.assets;
    p.wealth = 800;
    p.career = { income: 60 };

    const pl = GA.plan('house', 'two_room');
    assert.ok(pl, '未取得购置方案');
    assert.equal(pl.price, 140, '现价口径不符（起始价格指数应为 1）');
    assert.equal(pl.down, r1(140 * A.downRatio.house), '首付比例不符');
    assert.equal(pl.loan, r1(140 - pl.down), '贷款额口径不符');
    assert.ok(pl.monthly > 0, '按揭月供应大于 0');
    assert.equal(pl.ok, true, '有稳定收入时应能通过银行审核');

    let bought = null;
    let changes = 0;
    const off1 = g.Game.bus.on('asset:bought', (e) => { bought = e; });
    const off2 = g.Game.bus.on('asset:change', () => { changes++; });
    const res = GA.buy('house', 'two_room');
    off1();
    off2();

    assert.equal(res.ok, true, '买入失败：' + res.reason);
    assert.equal(p.wealth, r1(800 - pl.down), '首付未从现金扣除');
    assert.equal(p.assets.houses.length, 1, '资产未登记');
    assert.equal(GA.list('house')[0].key, 'two_room', '登记资产类型不符');
    assert.equal(p.assets.mortgage, pl.loan, '按揭未计入负债');
    assert.equal(p.assets.installment, pl.monthly, '月供未记录');
    assert.equal(p.assets.buys, 1, '买入次数未累计');
    assert.equal(p.flags.homeowner, true, '未打上 homeowner 标记');
    assert.equal(p.flags.leveraged, true, '按揭未打上 leveraged 标记');
    assert.ok(bought && bought.kind === 'house', 'asset:bought 未广播');
    assert.ok(changes >= 1, 'asset:change 未广播');
  });

  it('等额本息月供公式：零贷款为 0，正常利率与手工核算一致', () => {
    g.reset(8809);
    const A = g.Game.config.assets;
    const GA = g.Game.assets;

    assert.equal(GA.installmentOf(0, 20), 0, '零贷款月供应为 0');

    const loan = 100;
    const n = 120;
    const r = A.mortgageRate / 12;
    const exp = r2((loan * r) / (1 - Math.pow(1 + r, -n)));
    assert.equal(GA.installmentOf(loan, 10), exp, '等额本息月供公式不符');
    assert.ok(GA.installmentOf(loan, 10) > loan / n, '含息月供应高于本金均摊');
  });

  it('房贷摊销：年度按等额本息还本付息，本金递减、利息累计', () => {
    g.reset(8802);
    const p = g.person;
    const A = g.Game.config.assets;
    const GA = g.Game.assets;
    p.wealth = 300;

    const res = GA.buy('house', 'two_room', { force: true });
    assert.equal(res.ok, true, 'force 买入失败：' + res.reason);

    const a = p.assets;
    const m0 = a.mortgage;
    const annual = r1(a.installment * 12);
    const interest = r1(m0 * A.mortgageRate);
    const principal = Math.max(0, r1(annual - interest));
    assert.ok(principal > 0, '首年偿还本金应大于 0');

    g.runYears(1);

    assert.equal(a.interestPaid, interest, '利息累计口径不符');
    assert.equal(a.principalPaid, principal, '本金累计口径不符');
    assert.equal(a.mortgage, Math.max(0, r1(m0 - principal)), '贷款余额递减口径不符');
    assert.ok(a.upkeepPaid > 0, '未计提维护费');
    assert.equal(a.cleared, false, '首年不应结清');
    assert.equal(GA.mortgageInfo().paid, principal, 'mortgageInfo 本金口径不符');
  });

  it('净值 = 现金 + 资产现价 − 剩余贷款', () => {
    g.reset(8803);
    const p = g.person;
    const GA = g.Game.assets;
    p.wealth = 500;
    p.career = { income: 80 };

    assert.equal(GA.buy('house', 'studio').ok, true, '买入单身公寓失败');
    assert.equal(GA.buy('car', 'scooter').ok, true, '买入代步车失败');
    p.wealth = 100;

    assert.equal(GA.value(), r1(60 + 12), '资产现价合计不符');
    assert.ok(p.assets.mortgage > 0, '应存在按揭负债');
    assert.equal(GA.netWorth(), r1(100 + 72 - p.assets.mortgage), '净值口径不符');
    assert.equal(GA.summary().net, GA.netWorth(), 'summary.net 与 netWorth 不一致');
    assert.equal(GA.summary().count, 2, '资产件数不符');
  });

  it('卖房：成交款先结清按揭，余额进现金并计税费', () => {
    g.reset(8804);
    const p = g.person;
    const A = g.Game.config.assets;
    const GA = g.Game.assets;
    p.wealth = 500;
    p.career = { income: 80 };

    const buy = GA.buy('house', 'three_room');
    assert.equal(buy.ok, true, '买入三居室失败：' + buy.reason);

    const a = p.assets;
    const item = a.houses[0];
    const fee = r1(item.value * A.sellFee);
    const gross = r1(item.value - fee);
    const m0 = a.mortgage;
    const wealthBefore = p.wealth;

    let sold = null;
    const off = g.Game.bus.on('asset:sold', (e) => { sold = e; });
    const res = GA.sell('house', 0);
    off();

    const payoff = r1(Math.min(m0, gross));
    const cashIn = r1(gross - payoff);

    assert.equal(res.ok, true, '卖出失败：' + res.reason);
    assert.equal(res.payoff, payoff, '还款额口径不符');
    assert.equal(res.cashIn, cashIn, '到手现金口径不符');
    assert.equal(a.mortgage, r1(m0 - payoff), '贷款未按成交款抵扣');
    assert.equal(a.installment, 0, '结清后月供未清零');
    assert.equal(p.wealth, r1(wealthBefore + cashIn), '成交款未入现金');
    assert.equal(a.houses.length, 0, '资产未从名下移除');
    assert.equal(p.flags.sold_house, true, '未标记 sold_house');
    assert.equal(res.gain, r1(cashIn - item.downPaid), '盈亏口径不符');
    assert.ok(sold && sold.kind === 'house', 'asset:sold 未广播');
  });

  it('资产上限：房产 3 套 / 车辆 2 辆，超限拒绝', () => {
    g.reset(8805);
    const p = g.person;
    const A = g.Game.config.assets;
    const GA = g.Game.assets;
    p.wealth = 5000;
    p.career = { income: 500 };

    for (let i = 0; i < A.houseLimit; i++) {
      const r = GA.buy('house', 'studio');
      assert.equal(r.ok, true, '第 ' + (i + 1) + ' 套买入失败：' + r.reason);
    }
    const pl = GA.plan('house', 'studio');
    assert.equal(pl.ok, false, '超出房产上限仍判定可买');
    assert.ok(pl.reasons.join(' ').indexOf('名下已有 ' + A.houseLimit + ' 套房') >= 0, '未给出超限原因');
    assert.equal(GA.buy('house', 'studio').ok, false, '超限买入未被拒绝');
    assert.equal(GA.buy('house', 'studio', { force: true }).ok, true, 'force 应可越过门槛');
    assert.equal(p.assets.houses.length, A.houseLimit + 1, 'force 买入未生效');

    for (let i = 0; i < A.carLimit; i++) {
      assert.equal(GA.buy('car', 'scooter').ok, true, '第 ' + (i + 1) + ' 辆车买入失败');
    }
    assert.equal(GA.plan('car', 'scooter').ok, false, '超出车辆上限仍判定可买');
  });

  it('门槛：首付不足 / 月供超月收入 60% 时拒绝并给出原因', () => {
    g.reset(8806);
    const p = g.person;
    const A = g.Game.config.assets;
    const GA = g.Game.assets;

    // ① 首付不足
    p.wealth = 10;
    p.career = { income: 60 };
    let pl = GA.plan('house', 'two_room');
    assert.equal(pl.ok, false, '首付不足仍判定可买');
    assert.ok(pl.reasons.join(' ').indexOf('首付需') >= 0, '未指出首付不足');
    const r = GA.buy('house', 'two_room');
    assert.equal(r.ok, false, '首付不足仍买入成功');
    assert.ok(String(r.reason).indexOf('首付需') >= 0, '拒绝原因缺失');

    // ② 月供超过月收入上限
    p.wealth = 3000;
    p.career = { income: 1 };
    pl = GA.plan('house', 'villa');
    assert.equal(pl.ok, false, '负债率超限仍判定可买');
    assert.ok(pl.reasons.join(' ').indexOf('月供') >= 0, '未指出月供超限');
    assert.ok(pl.monthly > (1 / 12) * A.maxDebtRatio, '月供应超过月收入上限');

    // ③ 无稳定收入（月收入为 0）不可按揭
    p.wealth = 1000;
    p.career = { income: 0 };
    assert.equal(GA.plan('house', 'studio').ok, false, '无收入仍判定可按揭');
  });

  it('年度重估：房价指数浮动、车辆折旧、维护费计提、峰值刷新', () => {
    g.reset(8807);
    const p = g.person;
    const A = g.Game.config.assets;
    const GA = g.Game.assets;
    p.wealth = 800;
    p.career = { income: 200 };

    assert.equal(GA.buy('house', 'two_room').ok, true, '买入房产失败');
    assert.equal(GA.buy('car', 'sedan').ok, true, '买入车辆失败');

    const a = p.assets;
    const house = a.houses[0];
    const car = a.cars[0];
    const hv0 = house.value;
    const cv0 = car.value;
    const idx0 = a.priceIndex;

    g.runYears(1);

    // 指数 = 起点 × (1 + 年增长 + 随机漂移 + 剧本修正)，用宽松区间避免依赖随机符号
    assert.range(a.priceIndex, 0.9, 1.15, '房价指数越界（起点 ' + idx0 + '）');

    assert.equal(car.value, r1(Math.max(car.buyPrice * 0.08, cv0 * (1 - A.carDepreciation))), '车辆折旧口径不符');
    assert.ok(car.value < cv0, '车辆未折旧');
    assert.range(house.value, r1(hv0 * 0.9), r1(hv0 * 1.15), '房产重估越界');
    assert.equal(house.years, 1, '持有年限未推进');
    assert.ok(a.upkeepPaid > 0, '未计提维护费');
    assert.equal(a.peakValue, GA.value(), '峰值资产应记录当前总现价');
    assert.ok(a.peakNet > 0, '峰值净值未刷新');
  });

  it('还清最后一笔房贷：清零负债与月供、标记 debt_free', () => {
    g.reset(8808);
    const p = g.person;
    const GA = g.Game.assets;
    p.wealth = 300;

    assert.equal(GA.plan('house', 'studio').ok, false, '无收入时不应通过按揭审核');
    p.career = { income: 60 };
    assert.equal(GA.buy('house', 'studio').ok, true, '买入单身公寓失败');

    const a = p.assets;
    a.mortgage = 1;      // 压到极小，验证"最后一笔"路径
    a.installment = 1;
    a.cleared = false;

    g.runYears(1);

    assert.equal(a.mortgage, 0, '贷款未结清');
    assert.equal(a.installment, 0, '结清后月供未清零');
    assert.equal(a.cleared, true, '未标记 cleared');
    assert.equal(p.flags.debt_free, true, '未标记 debt_free');
    assert.equal(GA.mortgageInfo().cleared, true, 'mortgageInfo 未同步结清状态');
    assert.equal(GA.mortgageInfo().left, 0, '剩余贷款应为 0');
  });
});
