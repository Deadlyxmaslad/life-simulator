'use strict';
/* =========================================================================
 * 故事系统测试（E1 因果链叙事化 / E3·G5 故事积分与特殊结局）
 * -------------------------------------------------------------------------
 * 覆盖：五维起点与故事线初始化、抉择/行动的关键词积分、故事线命中与进度、
 *       伏笔种子归档（含兜底）、特殊结局判定矩阵、finalize 落盘与广播、
 *       先天 OCEAN 映射、积分钳制与风险抉择计数。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

function groupOf(g, key) {
  return g.Game.story.groups().filter((x) => x.key === key)[0];
}

describe('故事 · 五维积分与结局（E1 / E3 / G5）', () => {
  const g = h.build({ quiet: true });
  const CFG = () => g.Game.config.story;

  /* 把先天气质快照固定为中性，消除 OCEAN 对五维的牵引，便于精确断言 */
  function pinInnate() {
    g.person.story.innate = { O: 50, C: 50, E: 50, A: 50, N: 50 };
  }

  /* 直接设定五维与年龄，返回结局判定结果 */
  function judge(dims, age) {
    pinInnate();
    const cfg = CFG();
    const s = g.person.story;
    cfg.dims.forEach((d) => { s.dims[d.key] = d.key in dims ? dims[d.key] : 30; });
    if (age != null) g.state.clock.age = age;
    return g.Game.story.evaluate().ending;
  }

  it('初始化：五维起点一致、六条故事线就绪、气质快照可用', () => {
    g.reset(9101);
    const cfg = CFG();
    const st = g.Game.story;

    const d = st.dims();
    cfg.dims.forEach((x) => assert.equal(d[x.key], cfg.startValue, x.name + ' 起点不符'));

    const gs = st.groups();
    assert.equal(gs.length, cfg.groups.length, '故事线数量不符');
    cfg.groups.forEach((x) => assert.ok(groupOf(g, x.key), '缺少故事线：' + x.name));
    gs.forEach((x) => assert.ok(x.progress >= cfg.groupBase, x.name + ' 起步进度不足'));

    const s = g.person.story;
    assert.ok(s.innate, '未锁定出生气质快照');
    assert.finite(s.innate.O, '先天气质快照非法');
    assert.equal(st.counts().decisions, 0, '抉择计数未清零');
    assert.equal(st.counts().actions, 0, '行动计数未清零');
    assert.equal(st.ending(), null, '结局初始应为空');
  });

  it('抉择与行动：命中关键词累积五维，并分别计数', () => {
    g.reset(9102);
    const st = g.Game.story;
    const d0 = st.dims();

    g.Game.bus.emit('decision:answered', {
      ev: { id: 'probe_ev', title: '🧭 探针抉择' },
      choice: { label: '辞掉工作去创业', effects: {}, log: '你决定自己当老板' },
    });
    const d1 = st.dims();
    assert.ok(d1.ambition > d0.ambition, '抉择未累积"雄心"');
    assert.equal(st.counts().decisions, 1, '抉择计数不符');

    const v0 = st.dims().vitality;
    g.Game.bus.emit('action:done', { id: 'exercise', def: { name: '健身锻炼', desc: '去健身房跑步' } });
    assert.ok(st.dims().vitality > v0, '行动未累积"活力"');
    assert.equal(st.counts().actions, 1, '行动计数不符');
  });

  it('资产事件：登记"财富"故事线并推高"雄心 / 冒险"', () => {
    g.reset(9103);
    const st = g.Game.story;
    const cfg = CFG();
    const before = groupOf(g, 'wealth');
    const d0 = st.dims();

    g.Game.bus.emit('asset:bought', { kind: 'house', item: { key: 'studio' } });

    const after = groupOf(g, 'wealth');
    assert.equal(after.hits, before.hits + 1, '财富线未记录命中');
    assert.equal(after.progress, before.progress + cfg.groupStep, '财富线进度提升不符');
    assert.equal(after.active, true, '财富线未标记激活');

    const d1 = st.dims();
    assert.equal(d1.ambition, d0.ambition + 4 * cfg.gain.event, '豪宅/置业关键词的雄心加成口径不符');
    assert.equal(d1.risk, d0.risk + cfg.gain.event, '"投资"关键词的冒险加成口径不符');
  });

  it('伏笔种子：归入对应故事线，未登记种子兜底到"心境"', () => {
    g.reset(9104);
    const st = g.Game.story;
    const cfg = CFG();

    g.Game.bus.emit('decision:answered', {
      ev: { id: 'probe_seed', title: '🧭 伏笔探针' },
      choice: { label: '谨慎行事', effects: {}, log: '', plants: ['investor'] },
    });
    const w = groupOf(g, 'wealth');
    assert.ok(w.seeds.indexOf('investor') >= 0, '已登记种子未归入财富线');
    assert.ok(w.progress >= cfg.groupBase + cfg.seedStep, '埋种子未提升故事线进度');

    const fallbackKey = cfg.groups[cfg.fallbackGroup].key;
    g.Game.bus.emit('decision:answered', {
      ev: { id: 'probe_seed2', title: '🧭 伏笔探针' },
      choice: { label: '另辟蹊径', effects: {}, log: '', plants: ['probe_unknown_seed'] },
    });
    // 未登记在册的种子：groupOfSeed 兜底返回"心境"线，并以故事弧留痕（不写入 seeds 数组）
    assert.ok(groupOf(g, fallbackKey), '缺少兜底故事线');
    const arcs = st.arcs();
    assert.ok(
      arcs.some((a) => a.key === fallbackKey && a.label.indexOf('probe_unknown_seed') >= 0),
      '未登记种子未兜底归档到"心境"线'
    );
    assert.ok(st.arcs().length >= 2, '未记录故事弧');
    assert.ok(st.arcs().some((a) => a.label.indexOf('investor') >= 0), '缺少伏笔弧记录');
  });

  it('特殊结局：赌神 / 大儒 / 完满 / 虚度 / 涅槃 / 逍遥 / 静好 / 兜底', () => {
    g.reset(9105);

    assert.equal(judge({ ambition: 100, risk: 100 }, 50).id, 'gambler', '赌神判定不符');
    assert.equal(judge({ benevolence: 95, intellect: 95 }, 50).id, 'sage', '大儒判定不符');
    assert.equal(
      judge({ ambition: 85, benevolence: 85, risk: 85, intellect: 85, vitality: 85 }, 50).id,
      'complete', '完满人生判定不符'
    );

    const low = { ambition: 15, benevolence: 15, risk: 15, intellect: 15, vitality: 15 };
    assert.equal(judge(low, 15).id, 'plain', '年龄过小不应判"虚度光阴"');
    assert.equal(judge(low, 40).id, 'wasted', '虚度光阴判定不符');

    g.person.flags.rebound = true;
    assert.equal(judge({ ambition: 30, benevolence: 30, risk: 30, intellect: 30, vitality: 30 }, 45).id,
      'phoenix', '涅槃重生判定不符');
    g.person.flags.rebound = false;

    assert.equal(judge({ vitality: 90 }, 75).id, 'wanderer', '逍遥旅人判定不符');
    assert.equal(judge({ ambition: 60, benevolence: 60, risk: 60, intellect: 60, vitality: 60 }, 75).id,
      'settled', '岁月静好判定不符');
    assert.equal(judge({ ambition: 40, benevolence: 40, risk: 40, intellect: 40, vitality: 40 }, 45).id,
      'plain', '兜底结局判定不符');
  });

  it('finalize：写入 flags.ending_* 并广播 story:ending（幂等）', () => {
    g.reset(9106);
    const st = g.Game.story;

    pinInnate();
    CFG().dims.forEach((d) => { g.person.story.dims[d.key] = 40; });
    g.person.story.dims.ambition = 100;
    g.person.story.dims.risk = 100;
    g.state.clock.age = 50;

    let hits = 0;
    const off = g.Game.bus.on('story:ending', () => { hits++; });
    const e1 = st.finalize();
    const e2 = st.finalize();
    off();

    assert.equal(e1.id, 'gambler', '结局判定不符');
    assert.equal(e2.id, 'gambler', '重复 finalize 结果应一致');
    assert.equal(hits, 1, 'story:ending 应只广播一次');
    assert.equal(g.person.flags.ending_gambler, true, '未写入结局标记');
    assert.equal(st.ending().id, 'gambler', 'ending() 未缓存结局');
  });

  it('先天 OCEAN 映射：气质折算五维基线并钳制在 0-100', () => {
    g.reset(9107);
    const st = g.Game.story;
    g.person.story.innate = { O: 100, C: 100, E: 100, A: 100, N: 20 };

    const inna = st.innate();
    assert.equal(inna.ambition, 100, '雄心基线不符');
    assert.equal(inna.benevolence, 100, '善心基线不符');
    assert.equal(inna.intellect, 100, '智识基线不符');
    assert.equal(inna.vitality, 76, '活力基线不符');
    assert.equal(inna.risk, 68, '冒险基线不符');

    const sc = st.score();
    assert.range(sc.blended.vitality, 0, 100, '混合分越界');
    assert.ok(sc.blended.vitality >= st.dims().vitality, '先天高活力应对五维形成正向牵引');
    assert.ok(sc.top && sc.top.key, '未给出五维之最');
  });

  it('积分边界：五维钳制在 0-100，风险抉择计入 risky', () => {
    g.reset(9108);
    const st = g.Game.story;

    g.Game.bus.emit('decision:answered', {
      ev: { id: 'probe_risk', title: '🎲 风险探针' },
      choice: {
        label: '全仓押上', effects: {}, log: '风险越大，回报越大',
        risk: {
          goodLog: '赌赢了', badLog: '赌输了',
          success: { flags: { gambler_win: true } }, failure: {},
        },
      },
    });
    assert.equal(st.counts().risky, 1, '风险抉择未计数');

    for (let i = 0; i < 60; i++) st.record('创业 升职 事业 资产 购置 置业 房产 汽车', 4);
    const d = st.dims();
    assert.range(d.ambition, 0, 100, '雄心未钳制在 0-100');
    assert.equal(d.ambition, 100, '多次命中应顶到 100');
  });
});
