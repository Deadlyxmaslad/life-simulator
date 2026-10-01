'use strict';
/* =========================================================================
 * 倾向标签（v1.6.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 空态：开局 persona 子树为空、无副作用
 *  - 评估：纯只读，tags 数量不超过 maxTags；标签来自配置池
 *  - 独立性：每条 tag 只看自己关心的字段（改一个字段只影响对应 tag）
 *  - 纯净标签：三个模块任一使用过则不出现「凭自己」
 *  - 死亡时自动评估并写入 state；重复评估幂等
 *  - 评分「底色」行存在；成就谓词可判定
 *  - 隔离性：不触碰金手指三模块的开关
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('倾向标签', () => {
  const g = h.build({ quiet: true });

  const PP = () => g.Game.config.persona;
  const PS = () => g.Game.persona;

  function fresh(seed) { g.reset(seed == null ? 20260922 : seed); }

  /* -------------------------------- 空态 -------------------------------- */
  it('开局标签为空、无副作用', () => {
    fresh();
    const s = g.state.persona;
    assert.ok(s, 'persona 子树应存在');
    assert.equal(s.tags.length, 0, '起始无标签');
    assert.equal(PS().count(), 0);
  });

  /* -------------------------------- 评估 -------------------------------- */
  it('评估返回的标签全部来自配置池，且不超过上限', () => {
    fresh();
    const tags = PS().evaluate(g.person);
    assert.ok(tags.length <= (PP().maxTags || 5), '标签数不应超过 maxTags');
    for (const t of tags) {
      assert.ok(PP().tags.some((d) => d.id === t.id), '标签应来自配置池：' + t.id);
    }
  });

  it('评估是纯只读：不改变任何关键状态', () => {
    fresh();
    const before = {
      wealth: g.person.wealth, mood: g.person.mood, health: g.person.health,
      stress: g.person.mental ? g.person.mental.stress : 0,
      ach: Object.keys(g.person.achievements || {}).length,
    };
    PS().evaluate(g.person);
    assert.equal(g.person.wealth, before.wealth, '不应改财富');
    assert.equal(g.person.mood, before.mood, '不应改心情');
    assert.equal(g.person.health, before.health, '不应改健康');
    assert.equal(g.person.mental ? g.person.mental.stress : 0, before.stress, '不应改压力');
    assert.equal(Object.keys(g.person.achievements || {}).length, before.ach, '不应改成就');
  });

  /* ------------------------------ 标签独立性 ------------------------------ */
  it('「行善者」只看善行旗标', () => {
    fresh();
    const tag = PP().tags.find((t) => t.id === 'giver');
    assert.ok(tag, '应存在行善者标签');
    assert.equal(tag.test({ deeds: 3 }), true, '3 项善行应满足');
    assert.equal(tag.test({ deeds: 0 }), false, '0 项善行不应满足');
  });

  it('「求知者」只看学历序', () => {
    fresh();
    const tag = PP().tags.find((t) => t.id === 'seeker');
    assert.equal(tag.test({ eduRank: 7 }), true, '本科(6)/硕士(7) 以上应满足');
    assert.equal(tag.test({ eduRank: 3 }), false, '低学历不应满足');
  });

  it('「远行者」看留学旗标或旅行熟练度', () => {
    fresh();
    const tag = PP().tags.find((t) => t.id === 'wanderer');
    assert.equal(tag.test({ studyAbroad: true, travelMastery: 0 }), true, '留过学应满足');
    assert.equal(tag.test({ studyAbroad: false, travelMastery: 30 }), true, '旅行熟练度够也应满足');
    assert.equal(tag.test({ studyAbroad: false, travelMastery: 0 }), false, '都没有不应满足');
  });

  /* ------------------------------ 纯净标签 ------------------------------ */
  it('「凭自己」要求三个模块一次都没用过', () => {
    fresh();
    const tag = PP().tags.find((t) => t.id === 'purist');
    assert.ok(tag, '应存在凭自己标签');
    assert.equal(tag.test({ pure: true }), true, '全未使用应满足');
    assert.equal(tag.test({ pure: false }), false, '用过任一模块不应满足');
  });

  it('实际跑一局：用过 hex 后不再打「凭自己」', () => {
    fresh();
    g.state.clock.age = 30;
    const tags0 = PS().evaluate(g.person);
    assert.ok(tags0.some((t) => t.id === 'purist'), '未用时应有「凭自己」');
    // 直接在 flags 上记一笔（与金手指模块的记账同源），再评估
    g.person.flags.used_hex = true;
    const tags1 = PS().evaluate(g.person);
    assert.ok(!tags1.some((t) => t.id === 'purist'), '用过 hex 后不应再有「凭自己」');
  });

  /* -------------------------------- 死亡评估 -------------------------------- */
  it('死亡时自动评估并写入 state，重复调用幂等', () => {
    fresh();
    g.state.clock.age = 30;
    g.person.flags.kind = true;
    g.person.flags.filial = true;
    g.person.flags.familyFirst = true;
    const first = PS().run();
    const c1 = PS().count();
    assert.equal(c1, first.length, 'run 后 count 应等于标签数');
    const again = PS().run();
    assert.equal(again.length, c1, '重复评估应幂等');
    assert.ok(c1 >= 1, '至少应有「行善者」');
    assert.ok(PS().has('giver'), '3 项善行应打上行善者');
  });

  /* ------------------------------ 评分与成就 ------------------------------ */
  it('评分 breakdown 含「底色」行', () => {
    fresh();
    const rows = g.Game.score.breakdown(g.state);
    assert.ok(rows.some((r) => r.label === '底色'), 'breakdown 应包含「底色」行');
  });

  it('标签成就谓词可判定', () => {
    fresh();
    const d3 = g.Game.config.achievements.find((a) => a.id === 'shaped_life');
    const d5 = g.Game.config.achievements.find((a) => a.id === 'many_faces');
    assert.ok(d3 && d5, '应存在标签相关成就');
    assert.equal(d3.test({ personaTags: ['a', 'b', 'c'] }), true, '3 枚标签应满足有棱有角');
    assert.equal(d3.test({ personaTags: ['a'] }), false, '1 枚不应满足');
    assert.equal(d5.test({ personaTags: ['a', 'b', 'c', 'd', 'e'] }), true, '5 枚应满足多面人生');
  });

  /* -------------------------------- 隔离性 -------------------------------- */
  it('标签系统不触碰金手指三模块开关', () => {
    fresh();
    g.state.clock.age = 30;
    PS().run();
    const hx = g.state.hex, ty = g.state.tycoon, dl = g.state.datalize;
    if (hx) assert.equal(hx.on, false, 'hex 应仍关闭');
    if (ty) assert.equal(ty.on, false, 'tycoon 应仍关闭');
    if (dl) assert.equal(dl.on, false, 'datalize 应仍关闭');
  });
});
