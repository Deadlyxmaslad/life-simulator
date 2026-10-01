'use strict';
/* =========================================================================
 * 未竟之事 / 人生留白（v1.3.0）测试
 * -------------------------------------------------------------------------
 * 约束：
 *  - 只读、不改写任何人物状态（跑一次 evaluate 人物快照逐位不变）
 *  - 满足"走过"的条件时，对应路径不计入 missed
 *  - death 时会写入 s.roads.missed 并广播 roads:done
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('未竟之事 / 人生留白', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260920 : seed); }

  it('paths 表结构完整（id/name/desc/miss）', () => {
    const paths = g.Game.roads.paths();
    assert.ok(paths.length >= 5, '至少 5 条路径');
    for (const p of paths) {
      assert.ok(p.id && p.name && p.desc, '每条应有 id/name/desc');
      assert.equal(typeof p.miss, 'function', '每条应有 miss 谓词');
    }
  });

  it('evaluate 只读：不改变人物快照', () => {
    fresh();
    const before = JSON.stringify(g.person);
    g.Game.roads.evaluate(g.person);
    const after = JSON.stringify(g.person);
    assert.equal(after, before, 'evaluate 不应改动 person');
  });

  it('全空人生：亲密/子女/置业/远行/风险 均计入未竟', () => {
    fresh();
    const p = g.person;
    p.relationship = null;
    p.flags = p.flags || {};
    delete p.flags.studyAbroad;
    delete p.flags.tookRisk;
    const miss = g.Game.roads.evaluate(p).map((m) => m.id);
    assert.ok(miss.indexOf('love') >= 0, '应含亲密羁绊');
    assert.ok(miss.indexOf('children') >= 0, '应含膝下承欢');
    assert.ok(miss.indexOf('abroad') >= 0, '应含远行求学');
    assert.ok(miss.indexOf('risk') >= 0, '应含孤注一掷');
  });

  it('已恋爱成家 → love 不再计入；已生育 → children 不计入', () => {
    fresh();
    const p = g.person;
    p.relationship = { married: true, widowed: false, divorced: false, children: [] };
    let miss = g.Game.roads.evaluate(p).map((m) => m.id);
    assert.ok(miss.indexOf('love') < 0, '已婚则 love 应满足');

    p.relationship.children = [{ name: '小宝' }];
    miss = g.Game.roads.evaluate(p).map((m) => m.id);
    assert.ok(miss.indexOf('children') < 0, '有子女则 children 应满足');
  });

  it('flags.studyAbroad / tookRisk 满足时对应路径不计入', () => {
    fresh();
    const p = g.person;
    p.flags = p.flags || {};
    p.flags.studyAbroad = true;
    p.flags.tookRisk = true;
    const miss = g.Game.roads.evaluate(p).map((m) => m.id);
    assert.ok(miss.indexOf('abroad') < 0, 'studyAbroad 置真则 abroad 满足');
    assert.ok(miss.indexOf('risk') < 0, 'tookRisk 置真则 risk 满足');
  });

  it('死亡时写入 s.roads 并广播 roads:done', () => {
    fresh();
    let fired = null;
    g.Game.bus.on('roads:done', (e) => { fired = e; });
    g.state.person.alive = false;
    g.Game.bus.emit('death', { cause: '测试', age: g.state.clock.age });
    assert.ok(g.state.roads, '应写入 s.roads');
    assert.ok(Array.isArray(g.state.roads.missed), 'missed 应为数组');
    assert.ok(fired && Array.isArray(fired.missed), '应广播 roads:done');
    assert.equal(g.Game.roads.count(), g.state.roads.missed.length, 'count 与 missed 长度一致');
  });

  it('predicate 抛错时安全降级（不计入未竟，不崩）', () => {
    fresh();
    const bad = { id: 'boom', name: '坏路径', desc: 'x', miss: () => { throw new Error('boom'); } };
    const saved = g.Game.config.roads.paths;
    g.Game.config.roads.paths = [bad].concat(saved);
    let out;
    try {
      out = g.Game.roads.evaluate(g.person).map((m) => m.id);
    } finally {
      g.Game.config.roads.paths = saved;
    }
    assert.ok(out.indexOf('boom') < 0, '抛错路径不应计入');
  });
});
