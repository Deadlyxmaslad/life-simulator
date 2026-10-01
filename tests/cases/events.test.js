'use strict';
/* =========================================================================
 * 事件池结构验证（v2.1.0）
 * -------------------------------------------------------------------------
 * 纯 config 层验证：确保所有抉择事件结构合法（id 唯一、字段完整、
 * 条件函数不崩），不依赖运行时状态。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('事件池结构验证', () => {
  const g = h.build({ quiet: true });

  it('所有事件 id 唯一', () => {
    const events = g.Game.config.decisions.events;
    const ids = events.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.equal(dupes.length, 0, '重复 id: ' + dupes.join(', '));
  });

  it('所有事件有 title + choices', () => {
    const events = g.Game.config.decisions.events;
    for (const ev of events) {
      assert.ok(ev.title, ev.id + ' 应有 title');
      assert.ok(Array.isArray(ev.choices) && ev.choices.length > 0, ev.id + ' 应有 choices 数组');
    }
  });

  it('v2.1.0 新增暖事件已入池', () => {
    const ids = g.Game.config.decisions.events.map((e) => e.id);
    const newEvents = ['warm_cook', 'warm_sunrise', 'warm_rain', 'warm_letter', 'warm_music',
      'warm_plant', 'warm_walk', 'warm_stray', 'empty_nest', 'midlife_passion',
      'reconnect_old', 'career_mentor', 'retire_travel', 'retire_garden', 'retire_class',
      'grandparent', 'elder_legacy', 'elder_oldphoto', 'elder_visit', 'elder_neighbor',
      'elder_sunshine', 'side_gig_idea', 'unexpected_gift', 'weekend_market',
      'power_outage', 'lost_wallet'];
    for (const id of newEvents) {
      assert.ok(ids.indexOf(id) >= 0, '新事件应入池: ' + id);
    }
  });

  it('暖事件均为 repeatable（可多次触发）', () => {
    const events = g.Game.config.decisions.events;
    const warm = events.filter((e) => e.id.indexOf('warm_') === 0);
    for (const ev of warm) {
      assert.ok(ev.repeatable, ev.id + ' 暖事件应为 repeatable');
      assert.ok(ev.random, ev.id + ' 暖事件应为 random');
    }
  });

  it('条件函数全部可安全执行（不崩）', () => {
    g.reset(7001);
    g.state.clock.age = 30;
    g.person.career = { phase: 'employed', job: '工程师' };
    g.person.wealth = 50;
    g.person.relationship = { children: [{ name: '小明' }] };
    const events = g.Game.config.decisions.events;
    for (const ev of events) {
      if (ev.condition) {
        try { ev.condition(g.person); } catch (e) {
          assert.ok(false, ev.id + ' condition 崩溃: ' + e.message);
        }
      }
      for (const ch of (ev.choices || [])) {
        if (ch.condition) {
          try { ch.condition(g.person); } catch (e) {
            assert.ok(false, ev.id + ' choice condition 崩溃: ' + e.message);
          }
        }
      }
    }
  });

  it('事件池规模：≥100 条事件', () => {
    const count = g.Game.config.decisions.events.length;
    assert.ok(count >= 100, '事件池应 ≥100 条，当前 ' + count);
  });

  it('runYears 全程不卡死（新事件参与人生模拟）', () => {
    g.reset(7002);
    g.runYears(80);
    assert.ok(g.state.clock.age >= 40, '应推进到中年以上或合理身故，当前 ' + g.state.clock.age);
  });
});
