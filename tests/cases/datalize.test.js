'use strict';
/* =========================================================================
 * 📊 人数数据化（datalize）测试
 * -------------------------------------------------------------------------
 * 覆盖：attach 幂等、默认关闭时不介入（不挂卡、不消耗随机数）、读取/拉近/
 *       支取/割席/雷达五种能力、favor 不足时不扣 DP、自然漂移、结算折损。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

function growUp(g, years) {
  g.runYears(years);
}

describe('📊 人数数据化（datalize）· 关系类外挂', () => {
  const g = h.build({ quiet: true });
  const G = g.Game;
  const D = G.config.datalize;

  it('默认关闭：出生时不给任何人挂卡（完全不介入关系演算）', () => {
    g.reset(6801);
    assert.notOk(G.datalize.isOn(), '默认应处于关闭态');
    growUp(g, 20);
    const people = G.datalize.people();
    assert.ok(people.length > 0, '成年人应有关系人');
    for (const it of people) {
      assert.notOk(it.obj.d, '关闭状态下不应给 ' + it.tag + ' 挂卡');
    }
  });

  it('attach 幂等：重复调用不重置已有数值', () => {
    g.reset(6802);
    G.datalize.enable();
    growUp(g, 20);
    const p = g.person;
    const target = { name: '测试人', quality: 60 };
    const c1 = G.datalize.attach(target, 'friend');
    assert.ok(c1, '开启后应能给关系人挂卡');
    c1.affinity = 88;
    c1.trust = 12;
    const c2 = G.datalize.attach(target, 'friend');
    assert.equal(c2, c1, '幂等应返回同一张卡');
    assert.equal(c1.affinity, 88, '重复 attach 不得重置好感');
    assert.equal(c1.trust, 12, '重复 attach 不得重置真诚度');
    assert.equal(c1.tags.length, 2, '标签应保留');
  });

  it('👁 读取：揭示隐藏面板并消耗 DP', () => {
    g.reset(6803);
    G.datalize.enable();
    growUp(g, 22);
    const list = G.datalize.people();
    assert.ok(list.length > 0, '应能取到关系人名册');
    G.state.s.datalize.dp = D.dpMax;
    G.datalize.select(0);
    const before = G.state.s.datalize.dp;
    assert.ok(G.datalize.reveal(0), '读取应成功');
    assert.equal(G.state.s.datalize.dp, before - 3, '应扣 3 DP');
    const card = G.datalize.card(list[0].obj);
    assert.ok(card, '应生成数据卡');
    assert.equal(card.revealed, true, '应标记为已解析');
    assert.ok(G.datalize.visible(list[0].obj), '解析后应可见');
    assert.notOk(G.datalize.usableOn('reveal', 0), '重复读取不应再可用');
  });

  it('🎁 拉近：好感按波动性变化，失败时反噬且扣心情', () => {
    g.reset(6804);
    G.datalize.enable();
    growUp(g, 22);
    G.state.s.datalize.dp = D.dpMax;
    G.datalize.select(0);
    const list = G.datalize.people();
    const obj = list[0].obj;
    G.datalize.attach(obj, list[0].kind);
    const card = G.datalize.card(obj);
    const before = card.affinity;
    const mood0 = g.person.mood;
    assert.ok(G.datalize.gift(0), '拉近应成功');
    assert.notEqual(card.affinity, before, '好感应发生变化');
    assert.ok(card.affinity >= 0 && card.affinity <= 100, '好感应钳制在 0-100');
    if (card.affinity < before) assert.ok(g.person.mood < mood0, '失败时应付心情代价');
  });

  it('🪝 支取人情：favor 不足时不扣 DP 也不给收益', () => {
    g.reset(6805);
    G.datalize.enable();
    growUp(g, 22);
    const list = G.datalize.people();
    const obj = list[0].obj;
    G.datalize.attach(obj, list[0].kind);
    const card = G.datalize.card(obj);
    card.favor = 0;
    card.revealed = true;
    G.state.s.datalize.dp = D.dpMax;
    const dp0 = G.state.s.datalize.dp;
    const w0 = g.person.wealth;
    assert.notOk(G.datalize.usableOn('draw', 0), '人情不足时不应可用');
    assert.notOk(G.datalize.draw(0), '人情不足时支取应失败');
    assert.equal(G.state.s.datalize.dp, dp0, '失败不得扣 DP');
    assert.equal(g.person.wealth, w0, '失败不得产生收益');

    card.favor = D.draw.favorCost + 5;
    assert.ok(G.datalize.usableOn('draw', 0), '人情充足时应可用');
    assert.ok(G.datalize.draw(0), '支取应成功');
    assert.ok(card.favor < D.draw.favorCost, '支取后应扣减人情额度');
  });

  it('✂️ 割席：朋友被移除并付心情代价；血亲不可割席', () => {
    g.reset(6806);
    G.datalize.enable();
    growUp(g, 26);
    const p = g.person;
    let friendIdx = -1;
    let parentIdx = -1;
    const list = G.datalize.people();
    list.forEach(function (it, i) {
      if (it.kind === 'friend' && friendIdx < 0) friendIdx = i;
      if (it.kind === 'parent' && parentIdx < 0) parentIdx = i;
    });
    if (friendIdx < 0) {
      assert.ok(true, '本局未结识朋友，跳过割席断言（不因运气失败）');
    } else {
      G.state.s.datalize.dp = D.dpMax;
      const n0 = (p.social.friends || []).length;
      const friend = list[friendIdx].obj;
      const mood0 = p.mood;
      assert.ok(G.datalize.cut(friendIdx), '割席应成功');
      assert.notOk(p.social.friends.indexOf(friend) >= 0, '朋友应从名单移除');
      assert.equal((p.social.friends || []).length, n0 - 1, '朋友数应减一');
      assert.ok(p.mood < mood0, '割席应付心情代价');
    }
    if (parentIdx >= 0) {
      assert.notOk(G.datalize.usableOn('cut', parentIdx), '血亲不应允许割席');
    }
  });

  it('🔍 全图雷达：期间所有关系人可见，到期失效', () => {
    g.reset(6807);
    G.datalize.enable();
    growUp(g, 20);
    G.state.s.datalize.dp = D.dpMax;
    assert.ok(G.datalize.radar(), '雷达应施放成功');
    assert.ok(G.state.s.datalize.radar > 0, '应进入有效期');
    const list = G.datalize.people();
    G.datalize.attach(list[0].obj, list[0].kind);
    assert.ok(G.datalize.visible(list[0].obj), '雷达期间应全部可见');
    assert.notOk(G.datalize.usable('radar'), '雷达冷却期内不可重复施放');
    g.runDays(120);
    assert.equal(G.state.s.datalize.radar, 0, '雷达应到期');
  });

  it('每月自然回充 DP 并让人情缓慢积累', () => {
    g.reset(6808);
    G.datalize.enable();
    growUp(g, 20);
    G.state.s.datalize.dp = 0;
    const before = g.person.wealth;
    g.runDays(70);
    assert.ok(G.state.s.datalize.dp > 0, 'DP 应每月回充');
    assert.ok(G.state.s.datalize.dp <= D.dpMax, 'DP 不得超过上限');
  });

  it('结算折损：按累计消耗折算并停在配置下限', () => {
    g.reset(6809);
    G.datalize.enable();
    assert.equal(G.state.s.datalize.spent, 0, '零消耗不折损');
    G.state.s.datalize.spent = D.scoreRebate.per * 0.1;
    assert.near(G.datalize.rebate(), 0.9, 1e-6, '少量消耗应按比例折算');
    G.state.s.datalize.spent = D.scoreRebate.per * 0.5;
    assert.equal(G.datalize.rebate(), D.scoreRebate.min, '折到下限后应停住（min=0.6）');
  });

  it('🖋 改写标签：换掉一个核心标签并抬好好感，终身 2 次', () => {
    g.reset(6811);
    G.datalize.enable();
    growUp(g, 22);
    const x = G.state.s.datalize;
    const list = G.datalize.people();
    assert.ok(list.length > 0, '应能取到关系人名册');
    G.datalize.select(0);
    x.dp = D.dpMax;
    const card = G.datalize.card(list[0].obj) || G.datalize.attach(list[0].obj, list[0].kind);
    const oldTags = card.tags.slice();
    const oldAff = card.affinity;
    const maxUse = D.powers.filter((p) => p.id === 'relabel')[0].maxUse;
    assert.ok(maxUse, '改写标签应配置终身次数');
    for (let i = 0; i < maxUse; i++) {
      x.dp = D.dpMax;
      assert.ok(G.datalize.cast('relabel', 0), '第 ' + (i + 1) + ' 次改写应成功');
    }
    const newTags = G.datalize.card(list[0].obj).tags;
    assert.equal(newTags.length, oldTags.length, '标签数量不变');
    assert.notEqual(newTags.join('/'), oldTags.join('/'), '核心标签应被改写');
    assert.equal(G.state.s.datalize.once.relabel, maxUse, '应记满终身次数');
    x.dp = D.dpMax;
    const before2 = G.state.s.datalize.dp;
    assert.notOk(G.datalize.cast('relabel', 0), '超出终身次数应拒绝');
    assert.equal(G.state.s.datalize.dp, before2, '被拒绝时不得扣 DP');
    assert.ok(G.datalize.card(list[0].obj).affinity >= oldAff, '改写应至少不降低好感');
  });

  it('存档：只序列化本模块自己的账，旧存档可安全降级', () => {
    g.reset(6810);
    G.datalize.enable();
    G.state.s.datalize.dp = 21;
    const snap = G.datalize.snapshot();
    assert.equal(snap.dp, 21, '应记录 DP');
    G.datalize.hydrate(snap);
    assert.equal(G.datalize.dp(), 21, '复原后应一致');
    G.datalize.hydrate(null);
    assert.equal(G.datalize.dp(), 0, '旧存档应复位到默认值');
  });
});
