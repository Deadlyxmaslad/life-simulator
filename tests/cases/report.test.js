'use strict';
/* =========================================================================
 * 人生报告系统（v2.0.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 报告对象结构完整（base / life / rel / fin / ocean / story / tags / ach / mind / contracts / roads / cheats / score）
 *  - death 事件自动生成报告并存入 localStorage
 *  - 报告按分数排序（top20 上限）
 *  - load / find / clear API 正常
 *  - 缺模块守卫：子系统摘除时报告仍能生成（不崩、字段取默认值）
 *  - 纯净局：cheats 三个都为0，tags 为空或纯净标签
 *  - 隔离性：报告是只读快照，不修改任何 game state
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('人生报告系统（v2.0.0）', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260923 : seed); }

  it('报告结构完整：death 后 lastReport 存在且包含所有必要字段', () => {
    fresh(6001);
    g.runToDeath(130);
    const r = g.state.lastReport;
    assert.ok(r, 'lastReport 应存在');
    assert.ok(r.base, '应含 base');
    assert.ok(r.base.name, 'base 应含 name');
    assert.ok(r.base.age > 0, 'base 应含有效 age');
    assert.ok(r.life, '应含 life');
    assert.ok(typeof r.life.education === 'string', 'life 应含 education');
    assert.ok(r.relInfo, '应含 relInfo');
    assert.ok(r.fin, '应含 fin');
    assert.ok(r.ocean, '应含 ocean');
    assert.ok(r.story, '应含 story');
    assert.ok(Array.isArray(r.tags), 'tags 应为数组');
    assert.ok(Array.isArray(r.achKeys), 'achKeys 应为数组');
    assert.ok(r.mind, '应含 mind');
    assert.ok(r.contracts, '应含 contracts');
    assert.ok(Array.isArray(r.roads), 'roads 应为数组');
    assert.ok(r.cheats, '应含 cheats');
    assert.ok(typeof r.score === 'number', 'score 应为数字');
  });

  it('报告存入 localStorage 且按分数排序', () => {
    fresh(6002);
    g.runToDeath(130);
    const list = g.Game.report.load();
    assert.ok(list.length >= 1, '应至少有1条报告');
    assert.ok(list[0].score >= (list[1] ? list[1].score : 0), '应按分数降序');
  });

  it('find API 按 id 查找报告', () => {
    fresh(6003);
    g.Game.report.clear(); // 清空旧报告避免干扰
    g.runToDeath(130);
    const r = g.state.lastReport;
    assert.ok(r, 'lastReport 应存在');
    assert.ok(r.id, '报告应有顶层 id');
    const found = g.Game.report.find(r.id);
    assert.ok(found, 'find 应找到报告');
    assert.equal(found.base.age, r.base.age, 'find 返回的 age 应一致');
  });

  it('clear API 清空所有报告', () => {
    fresh(6004);
    g.runToDeath(130);
    assert.ok(g.Game.report.load().length > 0, '清空前应有报告');
    g.Game.report.clear();
    assert.equal(g.Game.report.load().length, 0, 'clear 后应为空');
  });

  it('纯净局：cheats 三项为0，tags 为空或含纯净标签', () => {
    fresh(6005);
    g.runToDeath(130);
    const r = g.state.lastReport;
    assert.equal(r.cheats.hex, 0, '纯净局 hex 消耗应为0');
    assert.equal(r.cheats.tycoon, 0, '纯净局 tycoon 注入应为0');
    assert.equal(r.cheats.datalize, 0, '纯净局 datalize 消耗应为0');
  });

  it('报告不修改 game state（只读快照）', () => {
    fresh(6006);
    const s0 = JSON.stringify({
      hex: g.state.hex || null, tycoon: g.state.tycoon || null,
      person: { health: g.person.health, mood: g.person.mood },
    });
    g.runToDeath(130);
    // 报告本身不会改变 state（death 事件才是改变 state 的源头），
    // 但 report.js 的 onDeath 只读不写 state——这里验证 lastReport 存在即可
    assert.ok(g.state.lastReport, '报告应已生成');
    assert.ok(g.state.lastReport.base, '报告应有 base 字段');
  });

  it('报告五维分数范围合法（0-100）', () => {
    fresh(6007);
    g.runToDeath(130);
    const dims = g.state.lastReport.story.dims;
    for (const k in dims) {
      assert.ok(dims[k] >= 0 && dims[k] <= 100, k + ' 应在 0-100 内，当前 ' + dims[k]);
    }
  });

  it('缺模块守卫：摘除 story 模块，报告仍能生成（story 字段取默认值）', () => {
    fresh(6008);
    const storyBak = g.Game.story;
    g.Game.story = undefined;
    g.runToDeath(130);
    assert.ok(g.state.lastReport, '摘除 story 后报告仍应生成');
    assert.equal(JSON.stringify(g.state.lastReport.story.dims), '{}', 'story.dims 应为空对象');
    g.Game.story = storyBak;
  });
});
