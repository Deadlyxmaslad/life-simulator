'use strict';
/* =========================================================================
 * 经济与成长测试（v1.1.0 · Phase 2 收尾 + G4 熟练度 + B17 长寿里程碑）
 * -------------------------------------------------------------------------
 * 覆盖：通胀物价指数与开销放大、个税起征与比例、年终奖、养老金指数化、
 *       随机财务事件（彩票/意外开销/借钱/负债求助）、
 *       行动熟练度成长 / 档位效果增强 / 成就联动 / 存档持久化、
 *       长寿里程碑（80 岁祝福 / 90 岁寿宴 / 100 岁百岁庆典）。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('经济 · 通胀 / 个税 / 年终奖（Phase 2 收尾）', () => {
  // 直接广播 year 事件做闭式解验证：绕开 month/day 派生流（随机抉择、疾病医疗费
  // 都会改写财富）。50 岁高于婚育窗口、低于退休线，marriage/assets 侧为空操作。
  // 固定随机项后的单年收支闭式解：wealthΔ = 年薪 − 个税 − 生活开销 × 物价指数 (+ 年终奖)
  function isolate(g) {
    const FIN = g.Game.config.finance;
    FIN.inflation = { rate: 0.025, drift: 0 };             // 物价指数单年恰为 1.025
    g.Game.config.career.annualRaise = { base: 0, sd: 0 }; // 无例行调薪
    g.Game.config.career.promote.baseChance = 0;           // 关掉随机晋升
    g.Game.config.career.promote.salaryGrowth = 0;         // 即使晋升也不改 salary
    g.Game.config.career.stress.healthDrain = 0;           // 关闭在职健康/心情损耗
    g.Game.config.career.stress.moodDrain = 0;
    g.Game.config.career.retirementAge = 999;              // 防止 50 岁时退休
    FIN.yearBonus = { chance: 0, min: 0, max: 0, mood: 0 }; // 关闭年终奖
    g.Game.config.assets.savingRate = 0;                   // 关闭存款利息
    g.Game.config.lifespan.gompertzA = 0;                  // 关闭自然死亡判定
    g.Game.config.marriage.window.max = 0;                 // 关闭窗口，不让 player 突然结婚改写 wealth
    const p = g.person;
    p.family.father.alive = false;                         // 隔离父母医疗/遗产干扰
    p.family.mother.alive = false;
    p.family.siblings = [];
  }
  function emitYear(g, age) {
    g.Game.bus.emit('year', { age, year: g.Game.config.time.startYear + age });
  }

  it('通胀：物价指数逐年爬升，生活开销按指数放大', () => {
    const g = h.build({ quiet: true });
    g.reset(9101);
    isolate(g);
    const p = g.person;
    p.career = { phase: 'employed', job: '工程师', income: 60, workYears: 0, level: '本科', retired: false };
    p.wealth = 100;

    emitYear(g, 50);

    assert.equal(g.Game.career.priceLevel(), 1.025, '物价指数应为 1 × (1 + 通胀率 2.5%)');
    const tax = (60 - 6) * 0.12; // 个税：(60 − 起征 6) × 12%
    const exp = 100 + 60 - tax - 4.5 * 1.025;
    assert.near(p.wealth, exp, 0.02, '收支未按 个税 + 物价指数 结算：' + p.wealth);
    assert.equal(p.career.workYears, 1, '工龄未推进');
  });

  it('个税：不超过起征额免税，只对超出部分征收', () => {
    const g = h.build({ quiet: true });
    g.reset(9102);
    isolate(g);
    const p = g.person;
    p.career = { phase: 'employed', job: '临时零工', income: 6, workYears: 0, level: '—', retired: false };
    p.wealth = 100;

    emitYear(g, 50);

    const exp = 100 + 6 - 0 - 4.5 * 1.025; // 年薪恰为起征额 → 零税
    assert.near(p.wealth, exp, 0.02, '起征额内不应缴税：' + p.wealth);
  });

  it('年终奖：按年薪比例发放并入账、写日志', () => {
    const g = h.build({ quiet: true });
    g.reset(9103);
    isolate(g);
    const FIN = g.Game.config.finance;
    FIN.yearBonus = { chance: 1, min: 0.1, max: 0.1, mood: 2 }; // 必发，恰好 10%
    const p = g.person;
    p.career = { phase: 'employed', job: '工程师', income: 40, workYears: 0, level: '本科', retired: false };
    p.wealth = 100;

    emitYear(g, 50);

    const tax = (40 - 6) * 0.12;
    const exp = 100 + 40 - tax - 4.5 * 1.025 + 40 * 0.1;
    assert.near(p.wealth, exp, 0.05, '年终奖未入账：' + p.wealth);
    const joined = g.state.logLines.map((l) => l.msg).join('\n');
    assert.ok(joined.indexOf('年终奖') >= 0, '年终奖应写入日志');
  });

  it('养老金按通胀部分指数化，退休后开销仍随物价上涨', () => {
    const g = h.build({ quiet: true });
    g.reset(9104);
    isolate(g);
    const p = g.person;
    const idx = g.Game.config.career.pensionIndexRatio;
    p.career = { phase: 'retired', job: null, income: 20, workYears: 38, level: '本科', retired: true };
    p.wealth = 100;

    emitYear(g, 50);

    assert.near(p.career.income, 20 * (1 + 0.025 * idx), 0.02, '养老金应按比例指数化：' + p.career.income);
    const exp = 100 + p.career.income - 4.5 * 1.025;
    assert.near(p.wealth, exp, 0.05, '退休收支未按物价指数结算：' + p.wealth);
  });

  it('物价提醒：指数首次越过关口时提示一次', () => {
    const g = h.build({ quiet: true });
    g.reset(9105);
    isolate(g);
    g.Game.config.finance.inflation = { rate: 0.6, drift: 0 }; // 一年即越过 1.5 关口
    const p = g.person;
    p.career = { phase: 'employed', job: '工程师', income: 60, workYears: 0, level: '本科', retired: false };
    p.wealth = 100;

    emitYear(g, 50);

    const notes = g.state.logLines.filter((l) => l.msg.indexOf('物价悄悄涨了') >= 0);
    assert.equal(notes.length, 1, '越过 1.5 关口应恰好提醒一次：' + notes.length);
  });
});

describe('财务事件 · 彩票 / 意外开销 / 借钱 / 负债求助（v1.1.0）', () => {
  it('新事件已进入抉择事件池，借钱带延时回响', () => {
    const g = h.build({ quiet: true });
    g.reset(9111);
    const ids = g.Game.config.decisions.events.map((e) => e.id);
    for (const id of ['finance_lottery', 'finance_accident', 'finance_lend', 'debt_rescue', 'birthday_90']) {
      assert.ok(ids.indexOf(id) >= 0, '缺少事件 ' + id);
    }
    const lend = g.Game.config.decisions.events.find((e) => e.id === 'finance_lend');
    assert.ok(lend.choices[0].delayed && lend.choices[0].delayed[0].inMonths > 0, '借出应登记延时回响（还钱）');
    assert.ok(g.Game.config.decisions.events.find((e) => e.id === 'finance_lottery').repeatable, '彩票应为可重复事件');
  });

  it('深度负债：选择"求助父母"获资助、留标记、登记 18 个月后回响', () => {
    const g = h.build({ quiet: true });
    g.reset(9112);
    const p = g.person;
    assert.ok(p.family.father.alive || p.family.mother.alive, '前置：父母应健在');

    const ev = g.Game.config.decisions.events.find((e) => e.id === 'debt_rescue');
    g.state.pendingDecision = { ev, age: 30 };
    p.wealth = -40;
    g.Game.decisions.choose(0); // 向父母开口求助

    assert.equal(p.flags.bailout, true, '未标记 bailout');
    assert.near(p.wealth, -10, 0.01, '资助 30 万未入账：' + p.wealth);
    assert.equal(p.timers.length, 1, '18 个月后的回响未登记');
    const joined = g.state.logLines.map((l) => l.msg).join('\n');
    assert.ok(joined.indexOf('债务压顶') >= 0, '抉择应写日志');
  });

  it('深度负债：选择"咬牙自己扛"留 self_redeem 标记（成就挂钩）', () => {
    const g = h.build({ quiet: true });
    g.reset(9113);
    const p = g.person;
    const ev = g.Game.config.decisions.events.find((e) => e.id === 'debt_rescue');
    g.state.pendingDecision = { ev, age: 30 };
    g.Game.decisions.choose(1);
    assert.equal(p.flags.self_redeem, true, '未标记 self_redeem');
  });

  it('负债求助条件：只有财富跌破阈值时事件才满足条件', () => {
    const g = h.build({ quiet: true });
    g.reset(9114);
    const ev = g.Game.config.decisions.events.find((e) => e.id === 'debt_rescue');
    g.person.wealth = -10; // 阈值 -25 之上
    assert.notOk(ev.condition(g.person), '浅度负债不应触发求助事件');
    g.person.wealth = -30;
    assert.ok(ev.condition(g.person), '深度负债应触发求助事件');
  });
});

describe('行动熟练度（G4）', () => {
  function readyStudy(g) {
    g.state.clock.age = 20; // 读书学习的年龄门槛
    const p = g.person;
    if (!p.actions.mastery) p.actions.mastery = {};
    p.actions.cd.study = 0;
  }

  it('使用行动累计熟练度，落在配置区间内', () => {
    const g = h.build({ quiet: true });
    g.reset(9121);
    readyStudy(g);
    const M = g.Game.config.actionMastery;

    assert.equal(g.Game.actions.mastery('study'), 0, '初始熟练度应为 0');
    g.Game.actions.do('study');
    const m = g.Game.actions.mastery('study');
    assert.range(m, M.gainMin, M.gainMax, '单次熟练度增长越界：' + m);
  });

  it('档位效果增强：基准 100% → 熟练 150% → 宗师 260%', () => {
    const g = h.build({ quiet: true });
    g.reset(9122);
    readyStudy(g);
    const p = g.person;

    const k0 = p.knowledge;
    g.Game.actions.do('study');
    assert.equal(p.knowledge - k0, 2, '未熟练时效果应为基准值 2');

    p.actions.mastery.study = 59; // 已在"熟练"档（30+）
    p.actions.cd.study = 0;
    const k1 = p.knowledge;
    g.Game.actions.do('study');
    assert.equal(p.knowledge - k1, 3, '熟练档效果应为 2 × 1.5 = 3');

    p.actions.mastery.study = 85; // "宗师"档（85+）
    p.actions.cd.study = 0;
    const k2 = p.knowledge;
    g.Game.actions.do('study');
    assert.near(p.knowledge - k2, 5.2, 1e-9, '宗师档效果应为 2 × 2.6 = 5.2');

    // 跨档提醒写入日志（59 → 60+ 应提示"精通"）
    const joined = g.state.logLines.map((l) => l.msg).join('\n');
    assert.ok(joined.indexOf('精通') >= 0, '跨档时应有晋档日志');
  });

  it('档位标签：list() 返回 tier，交易类行动不参与熟练度', () => {
    const g = h.build({ quiet: true });
    g.reset(9123);
    readyStudy(g);
    g.person.actions.mastery.study = 62;
    const row = g.Game.actions.list().find((a) => a.id === 'study');
    assert.equal(row.tier, '精通', '62 分应显示"精通"档');
    assert.equal(row.mastery, 62, '熟练度数值未返回');

    g.Game.actions.do('buy_stock'); // apply 型行动
    assert.equal(g.Game.actions.mastery('buy_stock'), 0, '交易类行动不应累计熟练度');
  });

  it('熟练度成就：年度评估解锁 熟能生巧 / 百炼成钢', () => {
    const g = h.build({ quiet: true });
    g.reset(9124);
    readyStudy(g);
    g.person.actions.mastery.study = 60;
    g.runYears(1); // 触发生日评估
    assert.ok(g.person.achievements.practiced, '熟能生巧（30）应解锁');
    assert.ok(g.person.achievements.mastered, '百炼成钢（60）应解锁');
  });

  it('熟练度与物价随存档保存恢复', () => {
    const g = h.build({ quiet: true });
    g.reset(9125);
    readyStudy(g);
    g.person.actions.mastery.study = 42;
    g.person.econ.priceLevel = 1.234;

    g.Game.save.save(1);
    g.reset(9999); // 用另一局覆盖状态
    assert.notEqual(g.Game.actions.mastery('study'), 42, '重置后熟练度应清零');
    g.Game.save.load(1);
    assert.equal(g.Game.actions.mastery('study'), 42, '熟练度未随存档恢复');
    assert.equal(g.Game.career.priceLevel(), 1.234, '物价指数未随存档恢复');
  });
});

describe('长寿里程碑（B17）', () => {
  // 关闭自然死亡、每年满血复活，专注验证里程碑本身
  function reach(g, targetAge) {
    const p = g.person;
    while (p.alive && g.state.clock.age < targetAge) {
      g.runYears(1);
      p.health = 100;
      p.immunity = 100;
      p.mood = 60;
      g.state.diseases.length = 0;
    }
    return p.alive;
  }

  it('80 岁祝福 / 90 岁寿宴 / 100 岁百岁庆典按岁触发', () => {
    const g = h.build({ quiet: true });
    g.reset(9131);
    g.Game.config.lifespan.gompertzA = 0; // 关闭自然死亡判定
    g.Game.config.log.maxLines = 1e6;     // 保留全部日志供断言

    assert.ok(reach(g, 80), '应平安活到 80 岁');
    const p80 = g.state.logLines.filter((l) => l.msg.indexOf('八十大寿') >= 0);
    assert.equal(p80.length, 1, '80 岁应有一次祝福日志');

    assert.ok(reach(g, 91), '应平安活到 91 岁');
    assert.ok(g.person.decisions.seen.indexOf('birthday_90') >= 0, '90 岁寿宴里程碑未触发');

    assert.ok(reach(g, 101), '应平安活到 101 岁');
    assert.equal(g.person.flags.centenarian, true, '未标记 centenarian');
    const p100 = g.state.logLines.filter((l) => l.msg.indexOf('百岁') >= 0);
    assert.ok(p100.length >= 1, '百岁庆典应写日志');
    assert.ok(g.person.achievements.centenarian, '期颐之寿成就应解锁');
  });
});
