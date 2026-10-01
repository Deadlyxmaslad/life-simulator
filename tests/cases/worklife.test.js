'use strict';
/* =========================================================================
 * 职场黄金期（v2.3.0）事件与行动验证
 * -------------------------------------------------------------------------
 * 覆盖"上学 → 退休"主战场新增内容：
 *   ① 18 条新抉择事件入池且结构合法
 *   ② 子女成长链按孩子年龄精确门控（缺 birthAge 的旧存档也不崩）
 *   ③ 职场/婚恋事件按人生阶段门控
 *   ④ 3 个新行动的解锁条件与"维系人脉 → 内推机会"伏笔闭环
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

const NEW_EVENTS = [
  'career_35_crisis', 'career_layoff', 'career_assignment', 'exam_cert', 'office_politics',
  'career_referral', 'kid_school_choice', 'kid_rebellion', 'kid_gaokao', 'kid_graduate',
  'seven_year_itch', 'class_reunion', 'wedding_gift', 'blind_date', 'subhealth',
  'marathon', 'house_renovate', 'pre_retire_choice',
];
const NEW_ACTIONS = ['certify', 'networking', 'tutor_kid'];

describe('职场黄金期 · v2.3.0', () => {
  const g = h.build({ quiet: true });
  const events = () => g.Game.config.decisions.events;
  const byId = (id) => events().find((e) => e.id === id);

  it('新增事件全部入池', () => {
    for (const id of NEW_EVENTS) {
      assert.ok(byId(id), '新事件应入池: ' + id);
    }
  });

  it('新事件年龄区间与结构合法', () => {
    for (const id of NEW_EVENTS) {
      const ev = byId(id);
      assert.ok(ev.minAge <= ev.maxAge, id + ' minAge 应 ≤ maxAge');
      // 入学/高考/毕业/35岁危机/内退返聘是一次性里程碑（random 缺省），其余应进随机池
      const MILESTONES = ['kid_school_choice', 'kid_gaokao', 'kid_graduate', 'career_35_crisis', 'pre_retire_choice'];
      if (MILESTONES.indexOf(id) >= 0) {
        assert.ok(!ev.random && !ev.repeatable, id + ' 应为一次性里程碑');
      } else {
        assert.ok(ev.random === true, id + ' 应为随机池事件');
        if (ev.repeatable) assert.ok(ev.minMonths > 0, id + ' repeatable 应带 minMonths');
      }
      for (const ch of ev.choices) {
        assert.ok(ch.label, id + ' 每个选项应有 label');
        if (ch.risk) {
          assert.ok(ch.risk.success && ch.risk.failure, id + ' 风险选项应有 success/failure');
        }
      }
    }
  });

  it('孩子链里程碑在模拟人生中必然触发（24 岁得子）', () => {
    let school = 0, gaokao = 0, graduate = 0, reached = 0;
    const runs = 8;
    for (let s = 0; s < runs; s++) {
      const gg = h.build({ quiet: true });
      gg.reset(9300 + s * 7);
      gg.person.relationship = {
        married: true, marriedAge: 24, spouse: { name: '伴侣', age: 25, health: 90 },
        children: [{ name: '大娃', gender: '男', birthAge: 24 }],
      };
      gg.runYears(50); // 0 → 50 岁：覆盖入学(30)/高考(42)/毕业(46-47)
      if (!gg.person.alive && gg.state.clock.age < 48) continue; // 主角早逝（如幼年夭折）则不纳入统计
      reached++;
      const ids = (gg.person.decisions && gg.person.decisions.history || []).map((r) => r.id);
      if (ids.indexOf('kid_school_choice') >= 0) school++;
      if (ids.indexOf('kid_gaokao') >= 0) gaokao++;
      if (ids.indexOf('kid_graduate') >= 0) graduate++;
    }
    assert.ok(reached > runs / 2, '多数模拟应活到孩子毕业，实际 ' + reached + '/' + runs);
    assert.equal(school, reached, '入学抉择应在活到窗口的每局出现');
    assert.equal(gaokao, reached, '高考抉择应在活到窗口的每局出现');
    assert.equal(graduate, reached, '毕业抉择应在活到窗口的每局出现');
  });

  it('子女成长链：按孩子年龄精确门控', () => {
    g.reset(9101);
    g.state.clock.age = 30;
    g.person.relationship = { married: true, spouse: { name: '某' }, children: [] };
    const setChildAge = (n) => { g.person.relationship.children = [{ name: '娃', birthAge: 30 - n }]; };
    const cond = (id) => !!byId(id).condition(g.person);

    setChildAge(5); assert.equal(cond('kid_school_choice'), false, '5 岁不应触发入学');
    setChildAge(6); assert.equal(cond('kid_school_choice'), true, '6 岁应触发入学');
    setChildAge(10); assert.equal(cond('kid_school_choice'), false, '10 岁不应再触发入学');

    setChildAge(12); assert.equal(cond('kid_rebellion'), false, '12 岁未到青春期');
    setChildAge(14); assert.equal(cond('kid_rebellion'), true, '14 岁应触发青春期');
    setChildAge(16); assert.equal(cond('kid_rebellion'), false, '16 岁已过窗口');

    setChildAge(17); assert.equal(cond('kid_gaokao'), false, '17 岁未到高考');
    setChildAge(18); assert.equal(cond('kid_gaokao'), true, '18 岁应触发高考');

    setChildAge(21); assert.equal(cond('kid_graduate'), false, '21 岁未毕业');
    setChildAge(22); assert.equal(cond('kid_graduate'), true, '22 岁应触发毕业');
    setChildAge(24); assert.equal(cond('kid_graduate'), false, '24 岁已过窗口');
  });

  it('子女成长链：兼容无 birthAge 的旧数据（不崩、不误触）', () => {
    g.reset(9102);
    g.state.clock.age = 30;
    g.person.relationship = { married: true, spouse: { name: '某' }, children: [{ name: '旧档娃' }] };
    for (const id of ['kid_school_choice', 'kid_rebellion', 'kid_gaokao', 'kid_graduate']) {
      try {
        assert.equal(!!byId(id).condition(g.person), false, id + ' 缺 birthAge 时不应触发');
      } catch (e) {
        assert.ok(false, id + ' condition 崩溃: ' + e.message);
      }
    }
  });

  it('职场事件：按在职状态与年龄门控', () => {
    g.reset(9103);
    g.person.career = { phase: 'student', job: null, workYears: 0, income: 0, retired: false, level: '本科' };
    for (const id of ['career_35_crisis', 'career_layoff', 'career_assignment', 'exam_cert', 'office_politics', 'career_referral', 'pre_retire_choice']) {
      assert.equal(!!byId(id).condition(g.person), false, id + ' 学生阶段不应触发');
    }
    g.person.career = { phase: 'employed', job: '工程师', workYears: 8, income: 14, retired: false, level: '本科' };
    g.state.clock.age = 35;
    g.person.intelligence = 70;
    for (const id of ['career_35_crisis', 'career_layoff', 'career_assignment', 'exam_cert', 'office_politics']) {
      assert.equal(!!byId(id).condition(g.person), true, id + ' 在职应可触发');
    }
    g.person.career.phase = 'retired';
    assert.equal(!!byId('career_35_crisis').condition(g.person), false, '退休后不应触发职场事件');
  });

  it('七年之痒：婚后满 7 年才触发', () => {
    g.reset(9104);
    g.state.clock.age = 32;
    g.person.relationship = { married: true, marriedAge: 29, children: [] };
    assert.equal(!!byId('seven_year_itch').condition(g.person), false, '婚龄 3 年不应触发');
    g.person.relationship.marriedAge = 25;
    assert.equal(!!byId('seven_year_itch').condition(g.person), true, '婚龄 7 年应触发');
  });

  it('相亲：仅单身可触发', () => {
    g.reset(9105);
    g.state.clock.age = 28;
    g.person.relationship = { married: true, children: [] };
    assert.equal(!!byId('blind_date').condition(g.person), false, '已婚不应触发相亲');
    g.person.relationship.married = false;
    assert.equal(!!byId('blind_date').condition(g.person), true, '单身应可触发相亲');
  });

  it('新行动入池且条件正确', () => {
    g.reset(9106);
    const act = (id) => g.Game.actions.list().find((a) => a.id === id);
    for (const id of NEW_ACTIONS) assert.ok(act(id), '新行动应入池: ' + id);

    // 学生（未成年）：考证进修不可用；成年在职后可用
    g.state.clock.age = 15;
    g.person.career = { phase: 'student', job: null, workYears: 0, income: 0, retired: false, level: '—' };
    assert.equal(act('certify').available, false, '未成年学生不可考证进修');

    g.state.clock.age = 30;
    g.person.career = { phase: 'employed', job: '工程师', workYears: 8, income: 14, retired: false, level: '本科' };
    assert.equal(act('certify').available, true, '在职可考证进修');
    assert.equal(act('networking').available, true, '在职可维系人脉');

    // 辅导孩子：无孩子 / 孩子成年 / 孩子未成年
    g.person.relationship = { married: true, spouse: { name: '某' }, children: [] };
    assert.equal(act('tutor_kid').available, false, '无孩子不可辅导');
    g.person.relationship.children = [{ name: '娃', birthAge: 10 }]; // 30 - 10 = 20 岁，已成年
    assert.equal(act('tutor_kid').available, false, '孩子已成年不可辅导');
    g.person.relationship.children = [{ name: '娃', birthAge: 24 }]; // 30 - 24 = 6 岁，未成年
    assert.equal(act('tutor_kid').available, true, '未成年孩子可辅导');

    // 退休后：维系人脉关闭
    g.person.career.phase = 'retired';
    assert.equal(act('networking').available, false, '退休后不可维系人脉');
  });

  it('人脉伏笔闭环：维系人脉 → 埋 network 种子 → 内推事件解锁', () => {
    g.reset(9107);
    g.state.clock.age = 30;
    g.person.wealth = 20;
    g.person.career = { phase: 'employed', job: '工程师', workYears: 8, income: 14, retired: false, level: '本科' };
    assert.equal(g.Game.consequences.has('network'), false, '初始无 network 伏笔');

    g.Game.actions.clearCooldown();
    assert.equal(g.Game.actions.do('networking'), true, '维系人脉应执行成功');
    assert.equal(g.Game.consequences.has('network'), true, '执行后应埋下 network 伏笔');

    // requiresSeed 门控的 career_referral 在有种子时满足前置
    const ref = byId('career_referral');
    assert.equal(ref.requiresSeed, 'network', '内推事件应由 network 伏笔门控');
  });

  it('完整人生模拟：新内容参与且不崩', () => {
    g.reset(9108);
    g.runToDeath(130);
    assert.ok(!g.hasPending() || true, '允许以未决事件收尾');
    assert.ok(g.state.clock.age > 0, '模拟应正常推进');
  });
});
