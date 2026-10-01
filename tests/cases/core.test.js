'use strict';
/* =========================================================================
 * 核心框架测试：bus / util / system / state / loop
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('核心 · 事件总线', () => {
  const g = h.build({ quiet: true });

  it('on → emit 能收到 payload', () => {
    let got = null;
    const off = g.Game.bus.on('t:one', (p) => { got = p; });
    g.Game.bus.emit('t:one', { a: 1 });
    off();
    assert.equal(got.a, 1, 'payload 未送达');
  });

  it('on 返回的取消函数能解绑', () => {
    let n = 0;
    const off = g.Game.bus.on('t:off', () => { n++; });
    g.Game.bus.emit('t:off');
    off();
    g.Game.bus.emit('t:off');
    assert.equal(n, 1, '取消订阅后仍被调用');
  });

  it('once 只触发一次', () => {
    let n = 0;
    g.Game.bus.once('t:once', () => { n++; });
    g.Game.bus.emit('t:once');
    g.Game.bus.emit('t:once');
    assert.equal(n, 1, 'once 被多次触发');
  });

  it('通配 * 能收到 {event, payload}', () => {
    const seen = [];
    const off = g.Game.bus.on('*', (e) => { seen.push(e.event); });
    g.Game.bus.emit('t:any', { x: 1 });
    off();
    assert.ok(seen.indexOf('t:any') >= 0, '通配订阅未收到事件');
  });

  it('单个 handler 抛错不影响其它 handler（错误被隔离）', () => {
    const before = g.logs.length;
    let ok = false;
    const off1 = g.Game.bus.on('t:err', () => { throw new Error('boom'); });
    const off2 = g.Game.bus.on('t:err', () => { ok = true; });
    g.Game.bus.emit('t:err');
    off1(); off2();
    assert.ok(ok, '异常 handler 阻断了后续 handler');
    assert.ok(g.logs.length > before, '异常未被 console.error 兜住');
  });
});

describe('核心 · 随机与数学工具', () => {
  const g = h.build({ quiet: true });
  const u = g.Game.util;

  it('同种子 → 同序列（可复现）', () => {
    u.setSeed(20260918);
    const a = [u.rand(), u.rand(), u.rand()];
    u.setSeed(20260918);
    const b = [u.rand(), u.rand(), u.rand()];
    assert.equal(a.join(','), b.join(','), '同种子结果不一致');
  });

  it('rand 落在 [0,1)', () => {
    u.setSeed(7);
    for (let i = 0; i < 500; i++) {
      const v = u.rand();
      assert.ok(v >= 0 && v < 1, 'rand 越界：' + v);
    }
  });

  it('clamp / lerp / pad2 行为正确', () => {
    assert.equal(u.clamp(5, 0, 3), 3, 'clamp 上界失效');
    assert.equal(u.clamp(-5, 0, 3), 0, 'clamp 下界失效');
    assert.equal(u.lerp(0, 10, 0.25), 2.5, 'lerp 错误');
    assert.equal(u.pad2(3), '03', 'pad2 错误');
    assert.equal(u.pad2(12), '12', 'pad2 错误');
  });

  it('chance(0) 永假 / chance(1) 永真', () => {
    u.setSeed(99);
    for (let i = 0; i < 200; i++) {
      assert.equal(u.chance(0), false, 'chance(0) 命中');
      assert.equal(u.chance(1), true, 'chance(1) 未命中');
    }
  });

  it('weighted 只返回被登记项，且权重为 0 的项不出现', () => {
    u.setSeed(31);
    const seen = {};
    for (let i = 0; i < 800; i++) {
      const v = u.weighted([{ item: 'a', weight: 80 }, { item: 'b', weight: 20 }, { item: 'zero', weight: 0 }]);
      seen[v] = (seen[v] || 0) + 1;
    }
    assert.ok(!seen.zero, '零权重项被抽中');
    assert.ok(seen.a > seen.b, '高权重项未被更频繁抽中：' + JSON.stringify(seen));
  });

  it('gauss 均值接近传入均值（±1.5 以内）', () => {
    u.setSeed(4242);
    let sum = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) sum += u.gauss(50, 10);
    const mean = sum / N;
    assert.range(mean, 48.5, 51.5, 'gauss 均值偏差过大：' + mean.toFixed(2));
  });

  it('randInt 落于闭区间内', () => {
    u.setSeed(5);
    for (let i = 0; i < 300; i++) {
      const v = u.randInt(3, 7);
      assert.ok(v >= 3 && v <= 7 && Number.isInteger(v), 'randInt 越界：' + v);
    }
  });
});

describe('核心 · 状态与共享效果通道', () => {
  const g = h.build({ quiet: true });
  const S = () => g.Game.state;

  it('changeVital 触发 <key>:change 且钳制 0-100', () => {
    g.reset(101);
    let ev = null;
    const off = g.Game.bus.on('health:change', (e) => { ev = e; });
    S().changeVital('health', 999, 'test');
    off();
    assert.equal(g.state.person.health, 100, '体征未封顶');
    assert.ok(ev && ev.delta > 0, '未广播 health:change');
    S().changeVital('health', -999, 'test');
    assert.equal(g.state.person.health, 0, '体征未触底');
  });

  it('applyEffects 支持 wealth / flags / intelligence / knowledge', () => {
    g.reset(102);
    const p = g.state.person;
    p.wealth = 10;
    S().applyEffects({ wealth: 3.14159, flags: { probe: true }, intelligence: 5, knowledge: 7 });
    assert.equal(p.wealth, 13.1, 'wealth 精度或写入错误：' + p.wealth);
    assert.equal(p.flags.probe, true, 'flags 未写入');
    assert.ok(p.knowledge >= 7, 'knowledge 未累加');
  });

  it('applyEffects 的 pers 钳制在 3-99（性格不可越界）', () => {
    g.reset(103);
    const p = g.state.person;
    assert.ok(p.personality, 'personality 未初始化');
    const E0 = p.personality.E;
    S().applyEffects({ pers: { E: 1000 }, source: 'test' });
    assert.equal(p.personality.E, 99, '性格上界失控：' + p.personality.E);
    S().applyEffects({ pers: { E: -1000 }, source: 'test' });
    assert.equal(p.personality.E, 3, '性格下界失控：' + p.personality.E);
    assert.ok(E0 >= 3 && E0 <= 99, '初始性格越界');
  });

  it('applyEffects 的 stress / depression / trauma 落在 0-100', () => {
    g.reset(104);
    const p = g.state.person;
    S().applyEffects({ stress: 1000, depression: -1000, trauma: 50 });
    assert.equal(p.mental.stress, 100, '压力上界失控');
    assert.equal(p.mental.depression, 0, '抑郁下界失控');
    assert.equal(p.mental.trauma, 50, '创伤写入错误');
  });

  it('日志按 config.log.maxLines 截断（保留最新）', () => {
    g.reset(105);
    const max = g.Game.config.log.maxLines;
    for (let i = 0; i < max + 40; i++) S().log('探针日志 ' + i, 'info');
    assert.equal(g.state.logLines.length, max, '日志长度未按上限截断：' + g.state.logLines.length);
    assert.ok(/探针日志/.test(g.state.logLines[g.state.logLines.length - 1].msg), '尾部不是最新日志');
  });

  it('reset 复位时钟与人物存活状态', () => {
    g.reset(106);
    g.runYears(30);
    g.reset(106);
    const s = g.state;
    assert.equal(s.clock.age, 0, '年龄未复位');
    assert.equal(s.clock.year, g.Game.config.time.startYear, '年份未复位');
    assert.equal(s.person.alive, true, '存活状态未复位');
    assert.equal(s.diseases.length, 0, '疾病未清空');
  });
});

describe('核心 · 系统注册表', () => {
  const g = h.build({ quiet: true });

  it('系统按 priority 升序注册（事件因果顺序）', () => {
    const list = g.Game.systems.list;
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].priority <= list[i].priority,
        '顺序错误：' + list[i - 1].name + '(' + list[i - 1].priority + ') 在 ' + list[i].name + '(' + list[i].priority + ') 之前');
    }
  });

  it('18 个既有系统 + 新增系统全部在册', () => {
    const names = g.Game.systems.list.map((s) => s.name);
    const must = ['clock', 'family', 'personality', 'mental', 'weather', 'disease', 'lifespan', 'education',
      'career', 'invest', 'marriage', 'social', 'consequences', 'decisions', 'actions', 'history',
      'achievements', 'score', 'assets', 'story', 'audio'];
    for (const n of must) assert.ok(names.indexOf(n) >= 0, '缺少系统：' + n);
  });

  it('create 返回可链式 on/update 的对象，updateAll 会调用 updateFn', () => {
    let n = 0;
    const sys = g.Game.systems.create('probe-system', 999).on('t:probe', () => {}).update(() => { n++; });
    assert.equal(sys.build(), sys, 'build 非幂等链式终点');
    g.Game.systems.updateAll({ tick: 0 });
    assert.ok(n > 0, 'updateAll 未调用系统 update');
  });
});

describe('核心 · 主循环', () => {
  const g = h.build({ quiet: true });

  it('setSpeed 钳制索引并同步 tps', () => {
    g.Game.loop.setSpeed(999);
    assert.equal(g.state.speedIndex, g.Game.config.time.speeds.length - 1, '速度索引未钳制');
    assert.equal(g.state.tps, g.Game.config.time.speeds[g.state.speedIndex].tps, 'tps 未同步');
    g.Game.loop.setSpeed(0);
    assert.equal(g.state.speedIndex, 0, '速度索引未设回 0');
  });

  it('play / pause 广播 run:change；死亡后不可 play', () => {
    g.reset(107);
    const seen = [];
    const off = g.Game.bus.on('run:change', (e) => seen.push(e.running));
    g.Game.loop.play();
    assert.equal(g.state.running, true, 'play 未置运行态');
    g.Game.loop.pause();
    assert.equal(g.state.running, false, 'pause 未置暂停态');
    g.state.person.alive = false;
    g.Game.loop.play();
    assert.equal(g.state.running, false, '死亡后仍可 play');
    g.state.person.alive = true;
    off();
    assert.ok(seen.length >= 2, 'run:change 广播不足：' + seen.length);
  });

  it('pendingDecision 存在时 step 冻结推进（不推进时间）', () => {
    g.reset(108);
    g.runYears(20);
    const before = g.state.clock.tick;
    g.state.pendingDecision = { ev: { id: 'probe', choices: [] }, age: g.state.clock.age };
    g.Game.loop.step();
    assert.equal(g.state.clock.tick, before, '抉择待处理时时间仍在推进');
    g.state.pendingDecision = null;
    g.Game.loop.step();
    assert.equal(g.state.clock.tick, before + 1, '恢复后未能推进');
  });

  it('死亡后 step 不再推进', () => {
    g.reset(109);
    g.runToDeath(130);
    const t = g.state.clock.tick;
    g.Game.loop.step();
    assert.equal(g.state.clock.tick, t, '死亡后仍在推进时间');
  });
});
