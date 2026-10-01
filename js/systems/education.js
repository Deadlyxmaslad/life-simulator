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
      p.knowledge += ED.study.knowledgePerYear;
      ed.grade = age - ed.stageStartAge + 1;
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
    const score = Math.round(p.intelligence + p.knowledge * 0.5 + u.gauss(0, ED.study.noise));

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
  // 成功率受智力、健康、学识加成；返回是否通过
  function examPass(baseP) {
    const p = st.s.person;
    const s = ED.study;
    const boost =
      (p.intelligence - 55) * 0.006 * s.iqWeight +
      (p.health - 60) * 0.002 * s.healthWeight +
      (p.knowledge - 30) * 0.0006;
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
    bus.emit('education:change', { stage: key });
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
  };
})();
