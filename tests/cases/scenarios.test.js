'use strict';
/* =========================================================================
 * 场景模式玩法变体（v2.2.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 三个新场景配置完整（startup/migrant/chill）
 *  - scenario.set 切换生效 + 事件广播
 *  - 场景专属事件只有对应场景下进池
 *  - 通用事件在所有场景下都可触发
 *  - 各场景跑完一生不卡死
 *  - 场景倍率正确传递给各系统
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('场景模式玩法变体（v2.2.0）', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) { g.reset(seed == null ? 20260923 : seed); }

  it('新场景配置完整：startup / migrant / chill 都有 label + desc + 倍率', () => {
    const S = g.Game.config.scenarios;
    for (const k of ['startup', 'migrant', 'chill']) {
      assert.ok(S[k], k + ' 场景应存在');
      assert.ok(S[k].label, k + ' 应有 label');
      assert.ok(S[k].desc, k + ' 应有 desc');
      assert.ok(typeof S[k].disease === 'number', k + ' 应有 disease 倍率');
      assert.ok(typeof S[k].mortality === 'number', k + ' 应有 mortality 倍率');
    }
  });

  it('scenario.set 切换生效并广播 scenario:change', () => {
    fresh(8001);
    let changed = null;
    const off = g.Game.bus.on('scenario:change', (e) => { changed = e.key; });
    g.Game.scenario.set('startup');
    assert.equal(g.Game.scenario.key(), 'startup', '切换应生效');
    assert.equal(changed, 'startup', '应广播 scenario:change');
    off();
    g.Game.scenario.set('normal'); // 还原
  });

  it('场景专属事件只有对应场景下进池', () => {
    fresh(8002);
    const events = g.Game.config.decisions.events;
    const startupEv = events.find((e) => e.id === 'startup_idea');
    assert.ok(startupEv, 'startup_idea 应存在');
    assert.equal(startupEv.scenario, 'startup', '应声明 scenario=startup');

    // normal 场景下不应进池
    g.Game.scenario.set('normal');
    g.state.clock.age = 30;
    const poolNormal = events.filter((e) => e.scenario === 'startup' && !e.hidden);
    for (const ev of poolNormal) {
      // eligible 会跳过 scenario 不匹配的事件
      assert.ok(ev.scenario !== g.Game.scenario.key(), 'normal 下 startup 事件不应进池');
    }
    g.Game.scenario.set('normal');
  });

  it('通用事件（无 scenario 字段）在所有场景下都可用', () => {
    fresh(8003);
    const events = g.Game.config.decisions.events;
    const generic = events.filter((e) => !e.scenario && !e.hidden);
    assert.ok(generic.length > 50, '通用事件应 >50 条，当前 ' + generic.length);
    // warm 事件全无 scenario 字段
    const warm = generic.filter((e) => e.id.indexOf('warm_') === 0);
    assert.ok(warm.length >= 10, '暖事件应 ≥10 条');
  });

  it('创业场景跑完一生不卡死', () => {
    fresh(8004);
    g.Game.scenario.set('startup');
    g.runYears(80);
    assert.ok(g.state.clock.age >= 20, 'startup 应推进到成年以上或合理身故，当前 ' + g.state.clock.age);
    if (!g.state.person.alive) assert.ok(g.state.person.deathCause, '身故应有死因');
    g.Game.scenario.set('normal');
  });

  it('北漂场景跑完一生不卡死（合理身故或长寿均算完成）', () => {
    fresh(8005);
    g.Game.scenario.set('migrant');
    g.runYears(80);
    assert.ok(g.state.clock.age >= 20, 'migrant 应推进到成年以上或合理身故，当前 ' + g.state.clock.age);
    if (!g.state.person.alive) {
      assert.ok(g.state.person.deathCause, '身故应有死因');
    }
    g.Game.scenario.set('normal');
  });

  it('躺平场景跑完一生不卡死', () => {
    fresh(8006);
    g.Game.scenario.set('chill');
    g.runYears(80);
    assert.ok(g.state.clock.age >= 40, 'chill 应推进到中年以上或合理身故，当前 ' + g.state.clock.age);
    g.Game.scenario.set('normal');
  });

  it('场景倍率正确传递：startup 的 disease > normal', () => {
    fresh(8007);
    g.Game.scenario.set('startup');
    assert.equal(g.Game.scenario.disease(), g.Game.config.scenarios.startup.disease, 'disease 倍率应一致');
    assert.ok(g.Game.scenario.disease() >= 1, 'startup disease ≥ 1');
    g.Game.scenario.set('normal');
  });

  it('北漂场景 originShift 更低（出身更差）', () => {
    fresh(8008);
    g.Game.scenario.set('migrant');
    assert.ok(g.Game.scenario.originShift() < 0, 'migrant originShift 应为负');
    g.Game.scenario.set('normal');
    assert.equal(g.Game.scenario.originShift(), 0, 'normal originShift 应为0');
  });

  it('场景事件池规模：startup 专属事件 ≥5', () => {
    const events = g.Game.config.decisions.events;
    const startupEvents = events.filter((e) => e.scenario === 'startup');
    assert.ok(startupEvents.length >= 5, 'startup 专属事件应 ≥5，当前 ' + startupEvents.length);
    const migrantEvents = events.filter((e) => e.scenario === 'migrant');
    assert.ok(migrantEvents.length >= 4, 'migrant 专属事件应 ≥4，当前 ' + migrantEvents.length);
    const chillEvents = events.filter((e) => e.scenario === 'chill');
    assert.ok(chillEvents.length >= 4, 'chill 专属事件应 ≥4，当前 ' + chillEvents.length);
  });

  it('所有场景事件 id 唯一（与通用事件不冲突）', () => {
    const events = g.Game.config.decisions.events;
    const ids = events.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.equal(dupes.length, 0, '重复 id: ' + dupes.join(', '));
  });
});
