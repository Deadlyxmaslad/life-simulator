/* =========================================================================
 * 系统 · 学业 / 教育 (education)
 * -------------------------------------------------------------------------
 * 把"上学"这条人生主线接进来：入园 → 幼升小 → 小升初 → 中考 → 高考
 * → 考研/考博，或分流到 中职 / 大专 / 提前步入社会。
 *
 * 设计要点：
 *  - 纯事件驱动，不侵入其它系统。订阅 state:reset 初始化，订阅 year(生日) 结算升学。
 *  - 升学成功率由 智力 + 学识 + 健康 共同决定（config.education.study），
 *    因此"读得越久 → 学识越高 → 更容易升学"，且重病会拖后腿——与疾病/寿命系统自然联动。
 *  - 毕业(进入 work 阶段)时广播 education:graduated，供未来的"职业系统"接管。
 *
 * 想加新学制（如 国际学校 / 留学 / 成人教育）：往 config.education 的
 * stages 与 progress 里加条目即可，本系统无需改动。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;

  const ED = C.education;

  Game.systems
    .create('education', 50)
    .on('state:reset', function () {
      initEducation();
    })
    .on('year', function (e) {
      onBirthday(e.age);
    });

  /* ------------------------- 出生时初始化 ------------------------- */
  function initEducation() {
    const p = st.s.person;
    // 智力 = 自身天赋 + 父母遗传（若有原生家庭）。家境/父母智力越高，起点略高。
    let iq = u.gauss(ED.iq.mean, ED.iq.sd);
    if (p.family && p.family.father && p.family.mother) {
      const famIq = (p.family.father.iq + p.family.mother.iq) / 2;
      iq = iq * 0.72 + (famIq + u.gauss(0, 12)) * 0.28;
    }
    iq += Game.scenario.iqBonus(); // 剧本天赋加成（如"天选之人"）
    p.intelligence = Math.round(u.clamp(iq, ED.iq.min, ED.iq.max));
    p.knowledge = 0;
    p.education = {
      stage: 'none',
      level: ED.stages.none.level,
      grade: 0,
      stageStartAge: 0,
      inSchool: false,
      retake: 0,
      nextExam: describeNext('none'),
    };
  }

  /* ------------------------- 每年（生日）结算 ------------------------- */
  function onBirthday(age) {
    const p = st.s.person;
    if (!p.alive || !p.education) return;
    const ed = p.education;

    // 罕见联动：久病缠身的学童可能被迫退学
    if (ed.inSchool && p.health < 18 && u.chance(0.03)) {
      st.log('🏥 因久病不愈，遗憾中断学业、退学回家', 'danger', '🏥');
      st.changeVital('mood', -6, '因病退学');
      setStage('work', age);
      return;
    }

    if (ed.stage === 'work') return; // 已步入社会，交由未来职业系统

    // 在学者：每年积累学识，并推进年级
    if (ed.inSchool) {
      const tier = currentClass();
      p.knowledge += ED.study.knowledgePerYear * (tier && tier.knowledgeMul ? tier.knowledgeMul : 1);
      ed.grade = age - ed.stageStartAge + 1;
      // 高档班的代价：节奏快、同辈卷（mood 小幅侵蚀，压力缓慢累积）
      if (tier && tier.yearlyMood) st.changeVital('mood', tier.yearlyMood, tier.name + '节奏快');
      if (tier && tier.yearlyStress && p.mental) {
        p.mental.stress = Math.round(u.clamp(p.mental.stress + tier.yearlyStress, 0, 100));
      }
      annualClassReview(age);
    }

    const prog = ED.progress[ed.stage];
    if (prog && age >= prog.age) {
      advance(ed.stage, prog, age);
    }
  }

  /* ------------------------- 升学推进 ------------------------- */
  function advance(stage, prog, age) {
    if (prog.gaokao) {
      gaokao(age);
      return;
    }

    // 直接升级（入园 / 义务教育）
    if (prog.to && !prog.pass) {
      const toName = ED.stages[prog.to].name;
      const label = prog.exam ? prog.exam + '，升入' + toName : '进入' + toName;
      st.log('🎈 ' + label, 'good', ED.stages[prog.to].emoji);
      setStage(prog.to, age);
      st.changeVital('mood', +1.5, '升学');
      return;
    }

    // 一场升学考试：成功 / 失利分流（先播报，再落地，保证日志顺序自然）
    if (prog.pass) {
      const pass = examPass(prog.pass.p);
      const target = pass ? prog.pass.to : prog.fail;
      const toName = ED.stages[target].name;
      if (pass) {
        st.log('🎉 ' + prog.exam + '顺利过关，升入' + toName, 'good', ED.stages[target].emoji);
        setStage(target, age);
        st.changeVital('mood', +3, prog.exam + '成功');
      } else {
        if (target === 'work') {
          st.log('😔 ' + prog.exam + '失利，提前步入社会', 'warn', '💼');
        } else {
          st.log('😞 ' + prog.exam + '失利，去了' + toName, 'warn', ED.stages[target].emoji);
        }
        setStage(target, age);
        st.changeVital('mood', -2.5, prog.exam + '失利');
      }
    }
  }

  /* ------------------------- 高考（三档分流）------------------------- */
  function gaokao(age) {
    const p = st.s.person;
    const ed = p.education;
    const g = ED.gaokao;
    const tier = currentClass(); // 毕业班的班级档次直接影响高考发挥（见 classTiers.gaokaoBonus）
    const score = Math.round(p.intelligence + p.knowledge * 0.5 + (tier && tier.gaokaoBonus ? tier.gaokaoBonus : 0) + u.gauss(0, ED.study.noise));

    if (score >= g.bachelorLine) {
      setStage('college', age);
      st.log('🏛️ 高考 ' + score + ' 分，达本科线，考入大学本科', 'good', '🏛️');
      st.changeVital('mood', +4, '金榜题名');
    } else if (score >= g.collegeLine) {
      setStage('associate', age);
      st.log('🏫 高考 ' + score + ' 分，被大学专科录取', 'good', '🏫');
      st.changeVital('mood', +2, '高考录取');
    } else if (ed.retake < g.maxRetake) {
      ed.retake += 1;
      ed.grade += 1;
      st.log('📖 高考 ' + score + ' 分未达线，选择复读再战（第 ' + ed.retake + ' 次）', 'warn', '📖');
      st.changeVital('mood', -3, '高考复读');
    } else {
      st.log('💼 高考 ' + score + ' 分，多次失利，决定步入社会', 'info', '💼');
      setStage('work', age);
    }
  }

  /* ------------------------- 通用升学判定 ------------------------- */
  // 成功率受智力、健康、学识加成；返回是否通过（班级档次额外加分）
  function examPass(baseP) {
    const p = st.s.person;
    const s = ED.study;
    const tier = currentClass();
    const boost =
      (p.intelligence - 55) * 0.006 * s.iqWeight +
      (p.health - 60) * 0.002 * s.healthWeight +
      (p.knowledge - 30) * 0.0006 +
      (tier && tier.examBonus ? tier.examBonus : 0);
    return u.chance(u.clamp(baseP + boost, 0.03, 0.96));
  }

  /* ------------------------- 状态落地 ------------------------- */
  function setStage(key, age) {
    const p = st.s.person;
    const meta = ED.stages[key];
    const ed = p.education;
    ed.stage = key;
    ed.level = meta.level !== '—' ? meta.level : ed.level; // work 保留最高学历
    ed.stageStartAge = age != null ? age : st.s.clock.age;
    ed.grade = 1;
    ed.retake = 0;
    ed.inSchool = key !== 'work';
    ed.nextExam = describeNext(key);

    if (key === 'work') {
      // 毕业/进入社会：为未来的职业系统留出接入点
      bus.emit('education:graduated', { age: st.s.clock.age, level: highestLevel(p) });
    }
    // 班级（v2.4.0）：进入可分班阶段时按成绩分班；升入不分班阶段（大学以上）则清空
    if (ed.inSchool && (ED.classStages || []).indexOf(key) >= 0) {
      assignClass(ED.stages[key].name + '入学分班');
    } else {
      ed.classKey = null;
      ed.classScore = null;
      ed.classmates = [];
    }
    bus.emit('education:change', { stage: key });
  }

  /* ------------------------- 班级档次（v2.4.0） ------------------------- */
  const CL = ED.classPlacement || { iqWeight: 1, knowledgeWeight: 0.6, healthWeight: 0.15, noise: 6 };
  function tiers() { return ED.classTiers || []; }
  function tierByKey(key) {
    return tiers().find((t) => t.key === key) || null;
  }
  // 分班成绩：智力为主，健康微调，学识按"相对同时长普通学生的进步度"计 ±有界加成
  function placementScore() {
    const p = st.s.person;
    const expected = (st.s.clock.age - 3) * (ED.study.knowledgePerYear || 4);
    const effort = expected > 0
      ? u.clamp((p.knowledge || 0) / expected - 1, -1, 1) * (CL.knowledgeBonus != null ? CL.knowledgeBonus : 15)
      : 0;
    return Math.round((
      p.intelligence * (CL.iqWeight != null ? CL.iqWeight : 1) +
      ((p.health || 60) - 60) * (CL.healthWeight != null ? CL.healthWeight : 0.15) +
      effort +
      u.gauss(0, CL.noise != null ? CL.noise : 6)
    ) * 10) / 10;
  }
  function tierOfScore(score) {
    const list = tiers();
    if (!list.length) return null;
    for (const t of list) if (score >= (t.minScore || 0)) return t;
    return list[list.length - 1];
  }
  function assignClass(reason) {
    const p = st.s.person;
    const ed = p.education;
    if (!ed || !ed.inSchool || !tiers().length) return false;
    const score = placementScore();
    const tier = tierOfScore(score);
    ed.classKey = tier.key;
    ed.classScore = score;
    generateClassmates(tier);
    st.log('🏫 ' + (reason || '分班结果') + '：分班成绩 ' + score + '，进入「' + tier.name + '」（全班 ' + ed.classmates.length + ' 人）', 'info', tier.emoji);
    bus.emit('education:class', { from: null, to: tier.key, score: score });
    return true;
  }
  // 调班：target 可为绝对 key 或 '+1'（升一档）/ '-1'（降一档）；why 为日志原因
  function moveClass(target, why) {
    const p = st.s.person;
    const ed = p.education;
    const list = tiers();
    if (!ed || !ed.inSchool || !list.length) return false;
    const cur = currentClass();
    const curIdx = cur ? list.indexOf(cur) : list.length - 1;
    let idx;
    if (target === '+1') idx = curIdx - 1;
    else if (target === '-1') idx = curIdx + 1;
    else idx = list.findIndex((t) => t.key === target);
    idx = u.clamp(idx, 0, list.length - 1);
    if (idx === curIdx) return false;
    const tier = list[idx];
    const promoted = idx < curIdx; // list 按 minScore 降序，下标越小档次越高
    ed.classKey = tier.key;
    ed.classScore = placementScore();
    generateClassmates(tier); // 调班即换集体：重新认识一批新同学
    st.log(
      (promoted ? '📈 ' : '📉 ') + (why || '调班') + '：「' + (cur ? cur.name : '—') + '」→「' + tier.name + '」，认识了新同学',
      promoted ? 'good' : 'warn', tier.emoji
    );
    st.changeVital('mood', promoted ? 3 : -2, promoted ? '升入' + tier.name : '转入' + tier.name);
    bus.emit('education:class', { from: cur ? cur.key : null, to: tier.key });
    return true;
  }
  // 年度复核：兼容旧存档（无 classKey 则补分班；有名册缺失则补生成）；成绩冒尖可升档、跌破门槛可能掉档
  function annualClassReview() {
    const ed = st.s.person.education;
    if (!ed.inSchool || (ED.classStages || []).indexOf(ed.stage) < 0) return;
    if (!ed.classKey) { assignClass('插班分班'); return; }
    if (!ed.classmates || !ed.classmates.length) generateClassmates(tierByKey(ed.classKey)); // 旧存档补名册
    const cur = currentClass();
    const list = tiers();
    const idx = cur ? list.indexOf(cur) : list.length - 1;
    const score = placementScore();
    ed.classScore = score;
    if (idx > 0 && score >= (list[idx - 1].minScore || 0) && u.chance(CL.promoteChance != null ? CL.promoteChance : 0.08)) {
      moveClass(list[idx - 1].key, '成绩冒尖');
    } else if (score < (cur.minScore || 0) && u.chance(CL.demoteChance != null ? CL.demoteChance : 0.05)) {
      moveClass(list[Math.min(idx + 1, list.length - 1)].key, '成绩滑落');
    }
  }
  function currentClass() {
    const ed = st.s.person.education;
    if (!ed || !ed.classKey) return null;
    return tierByKey(ed.classKey);
  }

  /* --------------------- 班级名册 / 同学互动（v2.5.0） --------------------- */
  function monthIdx() {
    const c = st.s.clock;
    return c.year * 12 + c.month;
  }
  // 按档次班额生成同学名册：姓名/性别/成绩/初始好感，调班或转段时重生成
  function generateClassmates(tier) {
    const ed = st.s.person.education;
    if (!ed || !tier) return;
    const sizeC = (ED.classSize || {})[tier.key] || [40, 50];
    const gradeC = ((ED.classmate || {}).gradeBias || {})[tier.key] || [30, 90];
    const n = u.randInt(sizeC[0], sizeC[1]);
    const list = [];
    for (let i = 0; i < n; i++) {
      const g = u.chance((ED.classmate || {}).genderFemaleRatio != null ? ED.classmate.genderFemaleRatio : 0.5) ? '女' : '男';
      const mate = {
        name: st.rollFullName(g),
        gender: g,
        grade: u.randInt(gradeC[0], gradeC[1]),
        aff: u.randInt(20, 60),   // 初始好感
        friend: false,
        cd: {},                    // 活动 → 上次互动的月份序号
      };
      // 📊 人数数据化（可选模块）：同学也挂一张隐藏的数据卡
      if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(mate, 'friend');
      list.push(mate);
    }
    ed.classmates = list;
  }
  function classStageOk() {
    const ed = st.s.person.education;
    return !!(ed && ed.inSchool && (ED.classStages || []).indexOf(ed.stage) >= 0 && ed.classmates && ed.classmates.length);
  }
  function actById(id) {
    return (ED.classActivities || []).find((a) => a.id === id) || null;
  }
  // 活动当前是否可做（冷却 + cond）；返回 null 表示可用，否则返回不可用原因
  function activityBlocker(act, p, mate) {
    const last = mate.cd[act.id];
    if (last != null && monthIdx() - last < (act.cd || 1)) return '冷却中（还差 ' + ((act.cd || 1) - (monthIdx() - last)) + ' 个月）';
    if (act.cond) {
      try { if (!act.cond(p, mate)) return act.condTip || '条件未满足'; } catch (e) { return '条件未满足'; }
    }
    return null;
  }
  // 与同学开展互动：effects 走 applyEffects（进故事线关键词），好感达标可结为好友
  function interact(mateIdx, activityId) {
    const p = st.s.person;
    if (!p.alive || !classStageOk()) return { ok: false, reason: '不在可分班的在校阶段' };
    const mate = st.s.person.education.classmates[mateIdx];
    const act = actById(activityId);
    if (!mate || !act) return { ok: false, reason: '找不到这位同学或该活动' };
    if (act.special === 'befriend') return befriend(mate);
    const blocker = activityBlocker(act, p, mate);
    if (blocker) return { ok: false, reason: blocker };
    mate.cd[act.id] = monthIdx();
    if (act.effects) st.applyEffects(Object.assign({}, act.effects, { source: '班级·' + act.name }));
    const gain = act.affinity || 0;
    const before = mate.aff;
    mate.aff = u.clamp(mate.aff + gain, 0, 100);
    const line = (act.affLine || ('你和' + mate.name + act.name + '了。'));
    st.log('🏫 ' + line + (gain ? '（好感 +' + (mate.aff - before) + '）' : ''), 'info', act.emoji);
    bus.emit('education:classmate', { mate: mate, act: act });
    return { ok: true, mate: mate, act: act };
  }
  // 好感到位 → 结识为朋友（进入既有 social 系统，享受维系/挚友/社交支持全套规则）
  function befriend(mate) {
    const p = st.s.person;
    const soc = p.social;
    const cm = ED.classmate || {};
    const need = cm.friendAffinity != null ? cm.friendAffinity : 65;
    if (mate.friend || (soc.friends || []).some((f) => f.name === mate.name)) {
      return { ok: false, reason: '你们已经是朋友了' };
    }
    if (mate.aff < need) return { ok: false, reason: '好感还不够（' + mate.aff + ' / ' + need + '）' };
    const pers = p.personality;
    const cap = C.social.friendCapBase + Math.floor((pers ? pers.E : 50) / C.social.friendCapPerE);
    if (soc.friends.length >= cap) return { ok: false, reason: '朋友圈已经满了（上限 ' + cap + '）' };
    const friend = {
      name: mate.name, gender: mate.gender, tag: '同学',
      since: st.s.clock.age, quality: u.clamp(mate.aff, 40, 92), best: false,
    };
    // 📊 人数数据化（可选模块）：真正的朋友挂正式数据卡
    if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(friend, 'friend');
    soc.friends.push(friend);
    soc.met = (soc.met || 0) + 1;
    mate.friend = true;
    st.log('🤝 和同学「' + mate.name + '」成了朋友，课桌之间的距离更近了', 'good', '🤝');
    st.changeVital('mood', 3, '结交好友');
    bus.emit('social:new', { friend: friend });
    bus.emit('education:classmate', { mate: mate, act: actById('befriend') });
    return { ok: true, mate: mate };
  }
  // 供 UI 渲染：名册 + 每位同学当前各活动的可用性
  function classView() {
    const ed = st.s.person.education;
    if (!classStageOk()) return null;
    const p = st.s.person;
    const tier = currentClass();
    return {
      tier: tier,
      size: ed.classmates.length,
      classmates: ed.classmates.map((m, i) => ({
        idx: i, name: m.name, gender: m.gender, grade: m.grade, aff: m.aff, friend: m.friend,
        acts: (ED.classActivities || []).map((a) => {
          const blocker = a.special === 'befriend'
            ? (m.aff < ((ED.classmate || {}).friendAffinity != null ? ED.classmate.friendAffinity : 65)
              ? '好感还不够' : (m.friend ? '已是朋友' : null))
            : activityBlocker(a, p, m);
          return { id: a.id, emoji: a.emoji, name: a.name, ready: !blocker, tip: blocker || a.name };
        }),
      })),
    };
  }

  function describeNext(stageKey) {
    const pr = ED.progress[stageKey];
    if (!pr) return '—';
    if (pr.gaokao) return '高考（' + pr.age + '岁）';
    if (pr.exam) return pr.exam + '（' + pr.age + '岁）';
    if (pr.to) return ED.stages[pr.to].name + '（' + pr.age + '岁）';
    return '—';
  }

  // 学历排序，方便"最高学历"展示与未来职业门槛判定
  const LEVEL_ORDER = ['—', '学前教育', '小学', '初中', '中职', '高中', '大专', '本科', '硕士', '博士'];
  function highestLevel(p) {
    // 以当前/最终 stage 的 level 为准；work 阶段保留毕业时写入的 level
    return p.education.level;
  }

  // 暴露契约：供 HUD、未来职业系统读取
  Game.education = {
    stages: ED.stages,
    levelOrder: LEVEL_ORDER,
    isStudent() {
      const e = st.s.person.education;
      return !!(e && e.inSchool);
    },
    current() {
      return st.s.person.education;
    },
    highestLevel,
    // 班级档次（v2.4.0）：供 HUD 展示、抉择事件调班与测试
    currentClass,
    classify: tierOfScore,
    placementScore,
    moveClass,
    // 班级名册与同学互动（v2.5.0）：供班级面板与测试
    classmates() {
      const ed = st.s.person.education;
      return ed && ed.classmates ? ed.classmates : [];
    },
    interact,
    befriend,
    classView,
    activityBlocker,
  };
})();
