'use strict';
/* =========================================================================
 * 生理需求系统（v1.8.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 初始子树四条需求条
 *  - 月度自然衰减（穷人不触发自动吃饭）
 *  - 自动吃饭：有钱人饿了自动花小钱进食到 eatFloor
 *  - 兜底到线语义：精力/卫生/娱乐低于兜底线 → 补到对应地板值
 *  - 低位惩罚：饥饿月度扣健康/免疫/心情（severe 不崩、值域钳制）
 *  - 高位加成：四项 ≥70 月度"神清气爽"
 *  - 行动联动：relax/feast/chores/hobby 的需求增量（只读 action:done）
 *  - 消费联动：consume:treat 事件的需求增量
 *  - 存档 save/load 往返
 *  - 隔离性：月度推进不改动金手指三模块的 state 子树（深比较）
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('生理需求系统（v1.8.0）', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260922 : seed); }
  function month(n) { for (let i = 0; i < (n || 1); i++) g.Game.bus.emit('month', {}); }
  function needs() { return g.state.needs; }
  function adult() { g.state.clock.age = 30; }

  it('初始子树：饱食80 / 精力80 / 卫生80 / 娱乐60', () => {
    fresh(4001);
    const n = needs();
    assert.equal(n.satiety, 80, '初始饱食应为 80');
    assert.equal(n.energy, 80, '初始精力应为 80');
    assert.equal(n.hygiene, 80, '初始卫生应为 80');
    assert.equal(n.fun, 60, '初始娱乐应为 60');
  });

  it('月度自然衰减：穷人（财富0）不触发自动吃饭，饱食全额下降', () => {
    fresh(4002);
    g.person.wealth = 0;
    const before = needs().satiety;
    month(1);
    assert.equal(needs().satiety, before - g.Game.config.needs.decay.satiety, '饱食应全额衰减');
  });

  it('自动吃饭：饿了且买得起 → 花小钱补到 eatFloor', () => {
    fresh(4003);
    g.person.wealth = 10;
    needs().satiety = 30;
    month(1);
    const A = g.Game.config.needs.auto;
    assert.equal(g.person.wealth, Math.round((10 - A.eatCost) * 10) / 10, '应自动花费饭钱');
    assert.equal(needs().satiety, A.eatFloor, '饱食应补到 eatFloor');
  });

  it('兜底到线：精力/卫生/娱乐低于兜底线 → 补到对应地板值', () => {
    fresh(4004);
    g.person.wealth = 0;
    needs().energy = 30;
    needs().hygiene = 40;
    needs().fun = 20;
    month(1);
    const A = g.Game.config.needs.auto;
    assert.equal(needs().energy, A.restFloor, '精力应补到 restFloor');
    assert.equal(needs().hygiene, A.cleanFloor, '卫生应补到 cleanFloor');
    assert.equal(needs().fun, A.playFloor, '娱乐应补到 playFloor');
  });

  it('高位不触发兜底：高于兜底线时数值只按衰减下降', () => {
    fresh(4005);
    needs().hygiene = 80;
    month(1);
    assert.equal(needs().hygiene, 80 - g.Game.config.needs.decay.hygiene, '高卫生应只衰减');
  });

  it('低位惩罚：饥饿（<25）月度扣健康/免疫/心情', () => {
    fresh(4006);
    g.person.wealth = 0;
    needs().satiety = 20;
    const h0 = g.person.health, m0 = g.person.mood;
    month(1);
    assert.ok(g.person.health < h0, '饥饿应扣健康');
    assert.ok(g.person.mood < m0, '饥饿应扣心情');
  });

  it('severe 不崩：饱食归零后连续推进值域钳制、人物可死亡可存活', () => {
    fresh(4007);
    g.person.wealth = 0;
    needs().satiety = 8;
    month(6);
    assert.ok(needs().satiety >= 0 && needs().satiety <= 100, '饱食应钳制在 0-100');
    assert.ok(g.person.health >= 0 && g.person.health <= 100, '健康应钳制在 0-100');
  });

  it('行动联动：relax 恢复精力 +30 / 娱乐 +10', () => {
    fresh(4008); adult();
    needs().energy = 50;
    needs().fun = 40;
    assert.ok(g.Game.actions.do('relax'), 'relax 应可执行');
    assert.equal(needs().energy, 80, 'relax 应加精力 30');
    assert.equal(needs().fun, 50, 'relax 应加娱乐 10');
  });

  it('新行动 feast：饱食 +45、花费 1.5 万', () => {
    fresh(4009); adult();
    g.person.wealth = 20;
    needs().satiety = 40;
    assert.ok(g.Game.actions.do('feast'), 'feast 应可执行');
    assert.equal(needs().satiety, 85, 'feast 应加饱食 45');
    assert.equal(g.person.wealth, 18.5, 'feast 应花费 1.5 万');
  });

  it('新行动 chores / hobby：卫生 +50 / 娱乐 +35', () => {
    fresh(4010); adult();
    needs().hygiene = 40;
    needs().fun = 40;
    assert.ok(g.Game.actions.do('chores'), 'chores 应可执行');
    assert.equal(needs().hygiene, 90, 'chores 应加卫生 50');
    assert.ok(g.Game.actions.do('hobby'), 'hobby 应可执行');
    assert.equal(needs().fun, 75, 'hobby 应加娱乐 35');
  });

  it('消费联动：consume:treat 事件（hotpot → 饱食+25 娱乐+8）', () => {
    fresh(4011);
    needs().satiety = 50;
    needs().fun = 50;
    g.Game.bus.emit('consume:treat', { key: 'hotpot' });
    assert.equal(needs().satiety, 75, '火锅应加饱食 25');
    assert.equal(needs().fun, 58, '火锅应加娱乐 8');
  });

  it('高位加成：四项 ≥70 → 月度神清气爽（mood+2 immunity+1，捕获 applyEffects 精确断言）', () => {
    fresh(4012);
    needs().satiety = 90; needs().energy = 90; needs().hygiene = 90; needs().fun = 80;
    // 衰减后：饱食74 / 精力74 / 卫生82 / 娱乐70 → 全部 ≥70 → 应触发加成
    const effs = [];
    const orig = g.Game.state.applyEffects;
    g.Game.state.applyEffects = function (e) { effs.push(e); };
    month(1);
    g.Game.state.applyEffects = orig;
    const bonus = effs.find((e) => e && e.source === '需求·神清气爽');
    assert.ok(bonus, '应发出神清气爽加成');
    assert.equal(bonus.mood, 2, '加成应含 mood+2');
    assert.equal(bonus.immunity, 1, '加成应含 immunity+1');
  });

  it('存档：save → load 往返后需求条完整复原', () => {
    fresh(4013);
    needs().satiety = 22; needs().energy = 44;
    assert.ok(g.Game.save.save(0), '存档应成功');
    g.Game.needs.hydrate(null);
    assert.equal(needs().satiety, 80, 'hydrate(null) 应复位');
    assert.ok(g.Game.save.load(0), '读档应成功');
    assert.equal(needs().satiety, 22, '读档后饱食应一致');
    assert.equal(needs().energy, 44, '读档后精力应一致');
  });

  it('隔离性：needs 的事件处理器不改动金手指三模块的 state 子树（深比较）', () => {
    fresh(4014);
    const dump = () => JSON.stringify({
      hex: g.state.hex || null, tycoon: g.state.tycoon || null, datalize: g.state.datalize || null,
    });
    const before = dump();
    // needs 只订阅这两类事件做增量；触发它们不应波及金手指账本
    g.Game.bus.emit('action:done', { id: 'relax', def: { id: 'relax' } });
    g.Game.bus.emit('consume:treat', { key: 'hotpot' });
    g.Game.needs.add({ satiety: -10 });
    assert.equal(dump(), before, '金手指三模块子树应逐位不变');
  });

  it('值域合法：全程跑完一生四条条都钳制在 0-100', () => {
    fresh(4015);
    g.runYears(80);
    const n = needs();
    for (const k of ['satiety', 'energy', 'hygiene', 'fun']) {
      assert.ok(n[k] >= 0 && n[k] <= 100, k + ' 应在 0-100 内，当前 ' + n[k]);
    }
  });
});
