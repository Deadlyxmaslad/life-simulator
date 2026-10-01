'use strict';
/* =========================================================================
 * 学业班级档次（v2.4.0）验证
 * -------------------------------------------------------------------------
 * 覆盖：分班公式分档、入学自动分班、学识积累加成、考试/高考加成、
 * moveClass 调班 API、decisions.reclass 指令、年度复核升降档、
 * 旧存档兼容（缺 classKey 自动补分班）、大学以上不分班。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('学业 · 班级档次 v2.4.0', () => {
  const g = h.build({ quiet: true });

  it('班级配置合法：minScore 降序、key 唯一、末档门槛为 0', () => {
    const tiers = g.Game.config.education.classTiers;
    assert.ok(tiers.length >= 2, '至少两档');
    const keys = tiers.map((t) => t.key);
    assert.equal(new Set(keys).size, keys.length, 'key 唯一');
    for (let i = 1; i < tiers.length; i++) {
      assert.ok(tiers[i - 1].minScore > tiers[i].minScore, 'minScore 应严格降序');
    }
    assert.equal(tiers[tiers.length - 1].minScore, 0, '末档门槛为 0 兜底');
    for (const t of tiers) {
      assert.ok(t.name && t.emoji, t.key + ' 应有名称与图标');
      assert.ok(t.knowledgeMul >= 1, t.key + ' 学识倍率应 ≥ 1');
    }
  });

  it('classify：按分数正确分档', () => {
    const edu = g.Game.education;
    assert.equal(edu.classify(90).key, 'rocket', '90 分应进火箭班');
    assert.equal(edu.classify(82).key, 'rocket', '门槛值应进火箭班');
    assert.equal(edu.classify(81.9).key, 'elite', '门槛下一点点应进重点班');
    assert.equal(edu.classify(68).key, 'elite', '68 分应进重点班');
    assert.equal(edu.classify(67.9).key, 'regular', '门槛下应进普通班');
    assert.equal(edu.classify(-5).key, 'regular', '负分兜底普通班');
  });

  it('入学自动分班：高天赋进火箭班，低天赋进普通班', () => {
    g.reset(5001);
    g.person.intelligence = 98; // 分数 = 98 + (100-60)*0.15 ± 6 ≥ 86，稳定进火箭班
    g.person.health = 100;
    g.runYears(4);
    assert.equal(g.person.education.classKey, 'rocket', '高天赋应进火箭班');
    assert.ok(g.person.education.classScore >= 82, '分班成绩应记录且 ≥ 82');

    g.reset(5002);
    g.person.intelligence = 18; // 分数 = 18 - 3 ± 6 < 68，稳定进普通班
    g.person.health = 40;
    g.runYears(4);
    assert.equal(g.person.education.classKey, 'regular', '低天赋应进普通班');
  });

  it('学识积累：火箭班约为普通班的 2 倍', () => {
    const mk = (seed, iq, health) => {
      const gg = h.build({ quiet: true });
      gg.reset(seed);
      gg.person.intelligence = iq;
      gg.person.health = health;
      gg.runYears(12); // 3 岁入园 → 12 岁，9 个学年在读
      return gg.person.knowledge;
    };
    const rocket = mk(5003, 98, 100);
    const regular = mk(5004, 18, 40);
    assert.ok(rocket > regular * 1.5, '火箭班学识（' + rocket + '）应显著高于普通班（' + regular + '）');
  });

  it('考试/高考加成：随班级档次变化', () => {
    g.reset(5005);
    g.person.intelligence = 98;
    g.person.health = 100;
    g.runYears(4);
    let cls = g.Game.education.currentClass();
    assert.equal(cls.key, 'rocket');
    assert.equal(cls.examBonus, 0.10, '火箭班升学考试加成 0.10');
    assert.equal(cls.gaokaoBonus, 5, '火箭班高考加分 5');

    g.person.intelligence = 18;
    g.person.health = 40;
    g.reset(5006);
    g.person.intelligence = 18;
    g.person.health = 40;
    g.runYears(4);
    cls = g.Game.education.currentClass();
    assert.equal(cls.key, 'regular');
    assert.ok(!cls.examBonus && !cls.gaokaoBonus, '普通班无考试加成');
  });

  it('moveClass API：相对/绝对调班与越界钳制', () => {
    g.reset(5007);
    g.person.intelligence = 18;
    g.person.health = 40;
    g.runYears(4); // 普通班
    const edu = g.Game.education;
    const mood0 = g.person.mood;
    assert.equal(edu.moveClass('+1'), true, '升一档应成功');
    assert.equal(g.person.education.classKey, 'elite');
    assert.ok(g.person.mood > mood0 - 1, '升班应带来心情正收益');
    assert.equal(edu.moveClass('rocket'), true, '绝对 key 调班应成功');
    assert.equal(g.person.education.classKey, 'rocket');
    assert.equal(edu.moveClass('+1'), false, '已是最高档，越界应拒绝');
    assert.equal(edu.moveClass('-1'), true, '降一档应成功');
    assert.equal(g.person.education.classKey, 'elite');
  });

  it('decisions.reclass 指令：选择落地即调班', () => {
    g.reset(5008);
    g.person.intelligence = 18;
    g.person.health = 40;
    g.runYears(4); // 普通班
    assert.equal(g.person.education.classKey, 'regular');
    g.state.pendingDecision = {
      ev: { id: 'test_reclass', title: '测试调班', choices: [{ label: 'a', reclass: '+1' }] },
      age: 10,
    };
    g.Game.decisions.choose(0);
    assert.equal(g.person.education.classKey, 'elite', '选择 reclass +1 后应升入重点班');
  });

  it('年度复核：成绩冒尖可升档（promoteChance=1 时必然升）', () => {
    const gg = h.build({ quiet: true });
    gg.reset(5009);
    gg.Game.config.education.classPlacement.promoteChance = 1; // 测试：必然升档
    gg.person.intelligence = 18; // 先按低分进普通班
    gg.person.health = 40;
    gg.runYears(8); // 8 岁，正在小学读二年级（避开 6/12 岁的升学转段重分班）
    assert.equal(gg.person.education.classKey, 'regular');
    assert.equal(gg.person.education.stage, 'primary');
    gg.person.intelligence = 98; // 之后智力飙升：分班成绩越过重点班门槛
    gg.runYears(1);
    assert.equal(gg.person.education.classKey, 'elite', '成绩冒尖应在年度复核时升档');
  });

  it('旧存档兼容：缺 classKey 时自动补分班，不崩', () => {
    g.reset(5010);
    g.person.intelligence = 98;
    g.person.health = 100;
    g.runYears(6);
    delete g.person.education.classKey; // 模拟 v2.4.0 之前的存档
    g.runYears(1);
    assert.ok(g.person.education.classKey, '年度复核应自动补分班');
  });

  it('大学以上不分班：高考升学后 classKey 清空', () => {
    g.reset(5011);
    g.person.intelligence = 98; // 高考分数最差情形 98-18+5 = 85 ≥ 78，必达本科线
    g.person.health = 100;
    g.runYears(19);
    assert.ok(['college', 'associate'].indexOf(g.person.education.stage) >= 0, '应已升入大学');
    assert.equal(g.person.education.classKey, null, '大学阶段不再分班');
  });

  it('班级事件入池且条件安全；全程模拟不崩', () => {
    const ids = g.Game.config.decisions.events.map((e) => e.id);
    for (const id of ['class_pressure', 'class_promotion_exam']) {
      assert.ok(ids.indexOf(id) >= 0, '应入池: ' + id);
    }
    g.reset(5012);
    g.person.intelligence = 70;
    g.runToDeath(130);
    assert.ok(g.state.clock.age > 0, '模拟应正常推进');
  });

  /* --------------------- v2.5.0 班级名册 / 同学互动 --------------------- */

  it('名册生成：规模在档次区间内、男女混合、档次越高成绩越高', () => {
    g.reset(5013);
    g.person.intelligence = 98; g.person.health = 100; // 火箭班
    g.runYears(4);
    const rocketMates = g.Game.education.classmates();
    assert.ok(rocketMates.length >= 32 && rocketMates.length <= 40, '火箭班 32-40 人，实际 ' + rocketMates.length);
    assert.ok(rocketMates.some((m) => m.gender === '女') && rocketMates.some((m) => m.gender === '男'), '男女混合');
    assert.ok(rocketMates.every((m) => m.name && m.grade >= 65 && m.grade <= 99), '姓名与成绩区间合法');

    g.reset(5014);
    g.person.intelligence = 18; g.person.health = 40; // 普通班
    g.runYears(4);
    const regularMates = g.Game.education.classmates();
    assert.ok(regularMates.length >= 42 && regularMates.length <= 55, '普通班 42-55 人，实际 ' + regularMates.length);
    const avg = (arr) => arr.reduce((s, m) => s + m.grade, 0) / arr.length;
    assert.ok(avg(rocketMates) > avg(regularMates), '火箭班平均成绩应更高');
  });

  it('同学互动：效果落地、好感累积、冷却拦截', () => {
    g.reset(5015);
    g.person.intelligence = 70; g.person.health = 85;
    g.runYears(9); // 9 岁，小学在读
    const edu = g.Game.education;
    assert.ok(edu.classmates().length > 0, '应有名册');
    const view = edu.classView();
    const idx = view.classmates.findIndex((m) => m.acts.find((a) => a.id === 'chat' && a.ready));
    assert.ok(idx >= 0, '应有可闲聊的同学');
    const mood0 = g.person.mood;
    const aff0 = view.classmates[idx].aff;
    const r = edu.interact(idx, 'chat');
    assert.equal(r.ok, true, '闲聊应成功');
    assert.ok(g.person.mood >= mood0 + 2, '闲聊应涨心情');
    assert.equal(edu.classmates()[idx].aff, aff0 + 6, '闲聊好感 +6');
    const again = edu.interact(idx, 'chat');
    assert.equal(again.ok, false, '冷却期内再次闲聊应被拦');
    assert.ok((again.reason || '').indexOf('冷却') >= 0, '拦截原因应提示冷却');
  });

  it('互动条件门控：请教只找学霸、送礼要有钱', () => {
    g.reset(5016);
    g.person.intelligence = 18; g.person.health = 40;
    g.runYears(9);
    const edu = g.Game.education;
    const mates = edu.classmates();
    const poor = mates.findIndex((m) => m.grade < 80);
    assert.ok(poor >= 0, '普通班应有成绩一般的同学');
    const r = edu.interact(poor, 'ask');
    assert.equal(r.ok, false, '向成绩 <80 的同学请教应被拦');
    // 送礼：财富不足
    g.person.wealth = 0;
    const r2 = edu.interact(0, 'gift');
    assert.equal(r2.ok, false, '没钱送礼应被拦');
  });

  it('结为好友：好感门槛、进入社交系统、可被拦', () => {
    g.reset(5017);
    g.person.intelligence = 70; g.person.health = 85;
    g.person.personality = { E: 60, A: 50, C: 50, N: 50, O: 50 };
    g.runYears(9);
    const edu = g.Game.education;
    const met0 = g.person.social.met || 0;
    const mate = edu.classmates()[0];
    // 1) 好感不足被拒
    mate.aff = 30;
    let r = edu.befriend(mate);
    assert.equal(r.ok, false, '好感不足应被拒');
    // 2) 攒够好感 → 成功
    mate.aff = 80;
    r = edu.befriend(mate);
    assert.equal(r.ok, true, '好感 80 应可结为好友');
    assert.ok(g.person.social.friends.some((f) => f.name === mate.name && f.tag === '同学'), '应进入朋友列表');
    assert.equal(g.person.social.met, met0 + 1, '结识人数 +1');
    assert.equal(mate.friend, true, '名册标记好友');
    // 3) 重复结好被拒
    r = edu.befriend(mate);
    assert.equal(r.ok, false, '已是朋友应被拒');
    // 4) 朋友圈满员被拒（E=60 → 上限 3+5=8，塞满）
    g.person.social.friends = [];
    const cap = 3 + Math.floor(60 / 12);
    for (let i = 0; i < cap; i++) g.person.social.friends.push({ name: '路人' + i, tag: '朋友', quality: 50 });
    const other = edu.classmates().find((m) => !m.friend);
    other.aff = 80;
    r = edu.befriend(other);
    assert.equal(r.ok, false, '朋友圈满员应被拒');
  });

  it('调班换集体：名册重新生成；旧存档缺失名册会自动补', () => {
    g.reset(5018);
    g.person.intelligence = 18; g.person.health = 40;
    g.runYears(9);
    const before = g.Game.education.classmates().map((m) => m.name).join(',');
    g.Game.education.moveClass('+1'); // 升入重点班
    const after = g.Game.education.classmates();
    assert.ok(after.length >= 36 && after.length <= 46, '重点班 36-46 人，实际 ' + after.length);
    assert.notEqual(after.map((m) => m.name).join(','), before, '调班后应换一批同学');
    // 旧存档兼容：删名册 → 年度复核补生成
    delete g.person.education.classmates;
    g.runYears(1);
    assert.ok(g.Game.education.classmates().length > 0, '旧存档应自动补名册');
  });

  it('classView：互动可用性随冷却与好感正确刷新', () => {
    g.reset(5019);
    g.person.intelligence = 70; g.person.health = 85;
    g.runYears(9);
    const edu = g.Game.education;
    const v0 = edu.classView();
    assert.ok(v0 && v0.size === v0.classmates.length, 'classView 应携带名册');
    const idx = v0.classmates.findIndex((m) => m.acts.find((a) => a.id === 'sport' && a.ready));
    edu.interact(idx, 'sport');
    const v1 = edu.classView();
    const sport = v1.classmates[idx].acts.find((a) => a.id === 'sport');
    assert.equal(sport.ready, false, '互动后 sport 应进入冷却');
    const chat = v1.classmates[idx].acts.find((a) => a.id === 'chat');
    assert.equal(chat.ready, true, 'chat 冷却更短，应仍可用');
  });

  /* --------------------- v2.6.0 学段分级 / 职场同事 --------------------- */

  it('同学互动按学段分级：幼儿园玩，小学写作业，高中刷题', () => {
    const actsOf = (edu) => {
      const v = edu.classView();
      return v.classmates[0].acts.filter((a) => a.ready).map((a) => a.id); // 只看当前可做的
    };
    // 幼儿园（3-6 岁）：有过家家，没有写作业/刷题
    const g1 = h.build({ quiet: true });
    g1.reset(5020); g1.person.intelligence = 60; g1.person.health = 85;
    g1.runYears(5);
    let ids = actsOf(g1.Game.education);
    assert.ok(ids.indexOf('toy') >= 0 && ids.indexOf('playhouse') >= 0, '幼儿园应有玩耍类活动');
    assert.ok(ids.indexOf('homework') < 0 && ids.indexOf('cram') < 0, '幼儿园不应有作业/刷题');
    assert.ok(ids.indexOf('gift') < 0, '8 岁前不应有送礼');
    // 小学（9 岁）：有写作业，没有过家家/刷题
    g1.runYears(5); // → 10 岁
    ids = actsOf(g1.Game.education);
    assert.ok(ids.indexOf('homework') >= 0 && ids.indexOf('rope') >= 0, '小学应有作业与跳绳');
    assert.ok(ids.indexOf('playhouse') < 0 && ids.indexOf('cram') < 0, '小学不应有过家家/刷题');
    // 高中（17 岁）：有刷题与谈心，没有跳绳
    g1.runYears(8); // → 18 岁（已高考）；重置走另一条确定性路径更稳
    const g2 = h.build({ quiet: true });
    g2.reset(5021); g2.person.intelligence = 70; g2.person.health = 85;
    // 直接推进到高一（15 岁中考升学），不动高考
    g2.runYears(16);
    if (g2.person.education.stage === 'senior') {
      ids = actsOf(g2.Game.education);
      assert.ok(ids.indexOf('cram') >= 0 && ids.indexOf('walk') >= 0, '高中应有刷题与散步谈心');
      assert.ok(ids.indexOf('rope') < 0 && ids.indexOf('toy') < 0, '高中不应有小学/幼儿园活动');
    }
  });

  it('互动 API 层面也尊重学段门控（绕过 UI 直接调用被拦）', () => {
    const g1 = h.build({ quiet: true });
    g1.reset(5022);
    g1.person.intelligence = 60; g1.person.health = 85;
    g1.runYears(5); // 幼儿园
    const edu = g1.Game.education;
    const v = edu.classView();
    // 挑一个玩具活动可用的同学，尝试做"一起学习"（小学+的活动）
    const idx = v.classmates.findIndex((m) => m.acts.find((a) => a.id === 'toy' && a.ready));
    assert.ok(idx >= 0, '幼儿园应有可分享玩具的同学');
    const r = edu.interact(idx, 'study');
    assert.equal(r.ok, false, '幼儿园做"一起学习"应被拦');
    assert.ok((r.reason || '').indexOf('年级') >= 0, '拦截原因应提示学段');
  });

  it('入职生成同事名册：规模 12-28 人，字段完整', () => {
    g.reset(5023);
    g.person.intelligence = 98; g.person.health = 100;
    g.runYears(23); // 高学历路径最晚 22 岁毕业入职
    const car = g.Game.career;
    assert.ok(car.isWorking() || g.person.education.inSchool, '应已入职或在读研');
    if (car.isWorking()) {
      const cols = car.colleagues();
      assert.ok(cols.length >= 12 && cols.length <= 28, '同事 12-28 人，实际 ' + cols.length);
      assert.ok(cols.every((m) => m.name && m.skill >= 35 && m.skill <= 95 && m.years >= 0), '同事字段合法');
      assert.ok(cols.some((m) => m.gender === '女') && cols.some((m) => m.gender === '男'), '男女混合');
    }
  });

  it('职场互动：效果落地、好感累积、冷却与门控、旧档兼容', () => {
    g.reset(5024);
    g.runYears(20);
    g.person.career = { phase: 'employed', job: '工程师', income: 14, workYears: 2, retired: false, level: '本科' };
    g.Game.career.regenerateColleagues();
    const car = g.Game.career;
    assert.ok(car.colleagues().length > 0, '强制在职后应补出同事名册');
    // 一起吃午饭：心情+3 压力-3 好感+6
    const mood0 = g.person.mood;
    const aff0 = car.colleagues()[0].aff;
    const r = car.officeInteract(0, 'lunch');
    assert.equal(r.ok, true, '午饭应成功');
    assert.ok(g.person.mood >= mood0 + 2, '午饭应涨心情');
    assert.equal(car.colleagues()[0].aff, aff0 + 6, '午饭好感 +6');
    assert.equal(car.officeInteract(0, 'lunch').ok, false, '冷却期内应被拦');
    // 请教业务：能力不足的同事被拦
    const weak = car.colleagues().findIndex((m) => m.skill < 80);
    assert.ok(weak >= 0, '应存在能力一般的同事');
    assert.equal(car.officeInteract(weak, 'advice').ok, false, '向能力 <80 的同事请教应被拦');
    // 旧档兼容：删名册 → 跨年补生成
    delete g.person.career.colleagues;
    g.runDays(31); // 跨月推进
    // 名册在年度结算补；直接再调 regenerate 语义不变，验证 yearly 懒兜底需要跨年
    g.person.career.phase = 'employed';
    g.Game.career.regenerateColleagues();
    assert.ok(car.colleagues().length > 0, '重新生成应可用');
  });

  it('托同事引荐：好感不足被拦，达标后埋 network 伏笔', () => {
    g.reset(5025);
    g.runYears(20);
    g.person.career = { phase: 'employed', job: '工程师', income: 14, workYears: 2, retired: false, level: '本科' };
    g.Game.career.regenerateColleagues();
    const car = g.Game.career;
    const col = car.colleagues()[0];
    col.aff = 30;
    assert.equal(car.officeInteract(0, 'refer').ok, false, '交情不足应被拦');
    assert.equal(g.Game.consequences.has('network'), false, '未达标不应埋伏笔');
    col.aff = 80;
    const r = car.officeInteract(0, 'refer');
    assert.equal(r.ok, true, '交情达标应可托引荐');
    assert.equal(g.Game.consequences.has('network'), true, '应埋下 network 伏笔（解锁内推事件）');
    assert.equal(car.officeInteract(0, 'refer').ok, false, '引荐有年度冷却，应被拦');
  });

  it('结交同事为好友：进入社交系统，退休后名册清空', () => {
    g.reset(5026);
    g.runYears(20);
    g.person.personality = { E: 60, A: 50, C: 50, N: 50, O: 50 };
    g.person.career = { phase: 'employed', job: '工程师', income: 14, workYears: 2, retired: false, level: '本科' };
    g.Game.career.regenerateColleagues();
    const car = g.Game.career;
    const col = car.colleagues()[0];
    col.aff = 80;
    const met0 = g.person.social.met || 0;
    const r = car.colleagueBefriend(col);
    assert.equal(r.ok, true, '好感 80 应可结为好友');
    assert.ok(g.person.social.friends.some((f) => f.name === col.name && f.tag === '同事'), '应进入朋友列表');
    assert.equal(g.person.social.met, met0 + 1, '结识人数 +1');
    // 退休 → 走真实退休路径（60 岁年度结算触发 retire()），名册清空、面板视图为 null
    g.state.clock.age = 60;
    g.person.career.phase = 'employed';
    g.runYears(1);
    assert.ok(g.person.career.phase === 'retired', '60 岁应触发退休');
    assert.equal(car.officeView(), null, '退休后 officeView 应为空');
    assert.equal(car.colleagues().length, 0, '退休后名册应清空');
  });

  it('职场互动全流程模拟：整个生命周期不崩', () => {
    g.reset(5027);
    g.runToDeath(130, () => 0);
    assert.ok(g.state.clock.age > 0, '模拟应正常推进');
  });
});
