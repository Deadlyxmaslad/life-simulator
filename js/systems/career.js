/* =========================================================================
 * 系统 · 事业 / 工作 / 财务 (career)
 * -------------------------------------------------------------------------
 * 承接教育的 graduation：以最高学历入行 → 在职领薪、随年景晋升加薪、
 * 60 岁退休领养老金；同时打理"钱包"：生活开销（随物价指数逐年上涨）、
 * 个税、年终奖、养娃成本、看病支出，入不敷出会打击心情与免疫。
 * 金钱是连接疾病/家庭系统的枢纽。
 *
 * 想加失业/跳槽/创业：再订阅或新增 year 分支即可，无需改本文件其它部分。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const CAR = C.career;
  const FIN = C.finance;

  Game.systems
    .create('career', 60)
    .on('state:reset', initCareer)
    .on('education:graduated', enterWorkforce)
    .on('year', yearly)
    .on('disease:new', onDisease);

  function initCareer() {
    const p = st.s.person;
    // 出生财富优先由"原生家庭"决定（family 系统 priority 12 先于此运行）；
    // 若无家庭系统提供，则回退到 config.finance 的默认家境。
    if (p.wealth == null) {
      p.wealth = Math.max(0.5, Math.round(u.gauss(FIN.startWealth, FIN.startSpread) * 10) / 10);
    }
    p.career = { phase: 'student', job: null, income: 0, workYears: 0, retired: false, level: '—' };
    p.econ = { priceLevel: 1, notes: [] }; // 物价指数挂在经济侧：学生/退休后仍在演化，开销随之放大
  }

  /* --------------------- 毕业 → 进入职场 --------------------- */
  function enterWorkforce(e) {
    const p = st.s.person;
    const c = p.career;
    c.phase = 'employed';
    c.retired = false;
    c.workYears = 0;
    assignJob(e.level || (p.education && p.education.level) || '—');
    st.log('💼 以「' + (e.level || '—') + '」学历踏入社会，成了一名' + c.job + '，年薪约 ' + c.income.toFixed(1) + ' 万元', 'info', '💼');
    bus.emit('career:work', { job: c.job, income: c.income, level: c.level });
  }

  function assignJob(level) {
    const p = st.s.person;
    const list = CAR.ladder[level] || CAR.ladder['—'];
    const pick = u.pick(list);
    p.career.job = pick[0];
    p.career.income = pick[1] * u.range(0.85, 1.15);
    p.career.level = level;
    generateColleagues(); // 新工作 = 新同事（v2.6.0 职场名册）
  }

  /* --------------------- 每年：收支 / 通胀 / 个税 / 晋升 / 退休 --------------------- */
  function yearly(e) {
    const p = st.s.person;
    const c = p.career;
    if (!c || !p.alive) return;
    if (!p.econ) p.econ = { priceLevel: 1, notes: [] }; // 兼容 v1.0 存档
    const econ = p.econ;
    const kids = p.relationship ? p.relationship.children : [];

    // —— 通胀：物价指数逐年爬升（±随机漂移），所有生活开销随之放大 ——
    const INF = FIN.inflation || { rate: 0, drift: 0 };
    econ.priceLevel = Math.round(econ.priceLevel * (1 + INF.rate + u.range(-INF.drift, INF.drift)) * 1000) / 1000;
    for (const mark of FIN.priceNotes || []) {
      if (econ.priceLevel >= mark && econ.notes.indexOf(mark) < 0) {
        econ.notes.push(mark);
        st.log('📈 物价悄悄涨了：如今 ' + Math.round(econ.priceLevel * 100) + ' 元才当得上你小时候的 100 元', 'warn', '📈');
      }
    }

    if (c.phase === 'employed') {
      c.workYears += 1;
      // 旧存档 / 异常路径兜底：在职却没同事名册（或为空）时补生成
      if (!Array.isArray(c.colleagues) || !c.colleagues.length) generateColleagues();
      // 年度例行调薪：略高于/低于通胀波动，晋升另有跳涨
      const AR = CAR.annualRaise;
      if (AR && (AR.base || AR.sd)) c.income *= Math.max(0, 1 + u.gauss(AR.base, AR.sd));
      const tax = incomeTaxOf(c.income);
      p.wealth += c.income - tax - livingCost(kids) * econ.priceLevel;
      yearEndBonus(c.income);
      tryPromote();
      st.changeVital('health', -CAR.stress.healthDrain, '工作劳累');
      st.changeVital('mood', -CAR.stress.moodDrain, '工作压力');
      if (e.age >= CAR.retirementAge) retire();
    } else if (c.phase === 'retired') {
      // 养老金按通胀部分指数化（pensionIndexRatio），跟上物价但跟不上全部
      const idx = CAR.pensionIndexRatio != null ? CAR.pensionIndexRatio : 0;
      c.income *= 1 + (INF.rate + u.range(-INF.drift, INF.drift)) * idx;
      p.wealth += c.income - livingCost(kids.filter((k) => e.age - k.birthAge < 18)) * econ.priceLevel; // 养老金 + 未独立子女开销
      if (c.workYears > 0 && u.chance(0.05)) st.changeVital('health', +0.5, '颐养天年');
    } else if (e.age >= 18) {
      // 成年但仍在学（读研读博）：无收入，靠家底补贴
      p.wealth -= FIN.livingCostBase * 0.6 * econ.priceLevel;
    }

    // 负债压力：按负债深度分级递增（越深越痛），tiers 取不到时退回 debtStress 基础档
    if (p.wealth < 0) {
      const tier = debtTierOf(p.wealth);
      st.changeVital('mood', -tier.mood, tier.label || '入不敷出');
      st.changeVital('immunity', -tier.immunity, '生活拮据');
      // 心理压力住在 p.mental 下（mental 系统未初始化时跳过），越深的负债越压得人喘不过气
      if (tier.stress && p.mental) p.mental.stress = Math.round(u.clamp(p.mental.stress + tier.stress, 0, 100));
    }
  }

  // 取当前负债深度对应的档位；tiers 按 below 降序（0 → -5 → -25 …），取第一个 wealth >= below 的档
  function debtTierOf(wealth) {
    const tiers = FIN.debtTiers;
    if (Array.isArray(tiers) && tiers.length) {
      for (const t of tiers) {
        if (wealth >= t.below) return t;
      }
      return tiers[tiers.length - 1];
    }
    return { mood: FIN.debtStress.mood, immunity: FIN.debtStress.immunity, stress: 0, label: '入不敷出' };
  }

  // 个税：超过起征额的部分按比例缴纳（返还在职者年薪口径，万元）
  function incomeTaxOf(income) {
    const T = FIN.incomeTax;
    if (!T || income <= T.deduction) return 0;
    return (income - T.deduction) * T.rate;
  }

  // 年终奖：在职者每年有一定概率拿到年薪的一定比例
  function yearEndBonus(income) {
    const B = FIN.yearBonus;
    if (!B || !u.chance(B.chance)) return;
    const bonus = income * u.range(B.min, B.max);
    const p = st.s.person;
    p.wealth = Math.round((p.wealth + bonus) * 10) / 10;
    if (B.mood) st.changeVital('mood', B.mood, '年终奖');
    st.log('🧧 年终奖到账 ' + bonus.toFixed(1) + ' 万元，这一年辛苦值了', 'good', '🧧');
  }

  function livingCost(kids) {
    return FIN.livingCostBase + kids.length * FIN.childCost;
  }

  function tryPromote() {
    const p = st.s.person;
    const c = p.career;
    const promoP = u.clamp(CAR.promote.baseChance + (p.intelligence - 55) * CAR.promote.iqGain, 0.02, 0.4);
    if (!u.chance(promoP)) return;
    c.income *= 1 + CAR.promote.salaryGrowth;
    if (u.chance(0.35)) {
      const list = CAR.ladder[c.level] || CAR.ladder['—'];
      const best = list.reduce((a, b) => (b[1] > a[1] ? b : a));
      if (best[0] !== c.job) {
        c.job = best[0];
        generateColleagues(); // 岗位变动 = 换了一批共事的人
        st.log('📈 事业上升，晋升为' + c.job + '，年薪约 ' + c.income.toFixed(1) + ' 万元', 'good', '📈');
      } else {
        st.log('📈 获得加薪，年薪涨到约 ' + c.income.toFixed(1) + ' 万元', 'good', '📈');
      }
    } else {
      st.log('📈 获得加薪，年薪涨到约 ' + c.income.toFixed(1) + ' 万元', 'good', '📈');
    }
    st.changeVital('mood', +1.5, '升职加薪');
  }

  function retire() {
    const p = st.s.person;
    const c = p.career;
    c.phase = 'retired';
    c.retired = true;
    c.income = c.income * CAR.pensionRatio;
    c.colleagues = []; // 退休散伙，办公室名册清空
    st.log('🏖️ 光荣退休，开始领取退休金（约 ' + c.income.toFixed(1) + ' 万元/年）', 'info', '🏖️');
    st.changeVital('mood', -1, '退休落差');
    bus.emit('career:retire', { pension: c.income });
  }

  /* --------------------- 职场同事名册 / 互动（v2.6.0） --------------------- */
  // 比照班级名册（education.classmates）的模式：入职/晋升换工作生成名册，
  // 点同事开展职场活动，好感达标可引荐机会或结为好友。
  function monthIdx() {
    const c = st.s.clock;
    return c.year * 12 + c.month;
  }
  function generateColleagues() {
    const p = st.s.person;
    const c = p.career;
    if (!c) return;
    const size = CAR.officeSize || [12, 28];
    const ck = CAR.colleague || {};
    const skill = ck.skillRange || [35, 95];
    const years = ck.yearsRange || [0, 20];
    const n = u.randInt(size[0], size[1]);
    const list = [];
    for (let i = 0; i < n; i++) {
      const g = u.pick(['男', '女']);
      const col = {
        name: st.rollFullName(g),
        gender: g,
        skill: u.randInt(skill[0], skill[1]),
        years: u.randInt(years[0], years[1]),
        aff: u.randInt(20, 60),
        friend: false,
        cd: {},
      };
      // 📊 人数数据化（可选模块）：同事也挂一张隐藏的数据卡
      if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(col, 'friend');
      list.push(col);
    }
    c.colleagues = list;
  }
  function actById(id) {
    return (CAR.officeActivities || []).find((a) => a.id === id) || null;
  }
  function activityBlocker(act, p, col) {
    const last = col.cd[act.id];
    if (last != null && monthIdx() - last < (act.cd || 1)) return '冷却中（还差 ' + ((act.cd || 1) - (monthIdx() - last)) + ' 个月）';
    if (act.cond) {
      try { if (!act.cond(p, col)) return act.condTip || '条件未满足'; } catch (e) { return '条件未满足'; }
    }
    return null;
  }
  // 与同事开展互动：effects 走 applyEffects（source: '职场·活动名'，命中事业线关键词）
  function officeInteract(colIdx, activityId) {
    const p = st.s.person;
    const c = p.career;
    if (!p.alive || !c || c.phase !== 'employed' || !Array.isArray(c.colleagues) || !c.colleagues.length) {
      return { ok: false, reason: '不在职或没有共事的同事' };
    }
    const col = c.colleagues[colIdx];
    const act = actById(activityId);
    if (!col || !act) return { ok: false, reason: '找不到这位同事或该活动' };
    if (act.special === 'refer') return askRefer(col);
    if (act.special === 'befriend') return befriendColleague(col);
    const blocker = activityBlocker(act, p, col);
    if (blocker) return { ok: false, reason: blocker };
    col.cd[act.id] = monthIdx();
    if (act.effects) st.applyEffects(Object.assign({}, act.effects, { source: '职场·' + act.name }));
    const before = col.aff;
    col.aff = u.clamp(col.aff + (act.affinity || 0), 0, 100);
    st.log('🏢 ' + act.emoji + ' 你和同事「' + col.name + '」' + act.name + '（好感 +' + (col.aff - before) + '）', 'info', act.emoji);
    bus.emit('career:colleague', { colleague: col, act: act });
    return { ok: true, colleague: col, act: act };
  }
  // 托同事引荐：好感到位后埋 network 伏笔 → 与「📨 老熟人递来机会」内推事件闭环
  function askRefer(col) {
    const p = st.s.person;
    const need = (CAR.colleague || {}).friendAffinity != null ? CAR.colleague.friendAffinity : 65;
    if (col.cd.refer != null && monthIdx() - col.cd.refer < 12) {
      return { ok: false, reason: '冷却中（还差 ' + (12 - (monthIdx() - col.cd.refer)) + ' 个月）' };
    }
    if (col.aff < need) return { ok: false, reason: '交情还不够（' + col.aff + ' / ' + need + '）' };
    col.cd.refer = monthIdx();
    if (Game.consequences) Game.consequences.plant('network');
    p.knowledge = (p.knowledge || 0) + 1; // 打听行情本身也是见识
    st.log('📨 你托同事「' + col.name + '」帮忙留意机会，他答应有合适的想着你', 'info', '📨');
    bus.emit('career:colleague', { colleague: col, act: actById('refer') });
    return { ok: true, colleague: col };
  }
  // 好感到位 → 结识为朋友（tag 同事，进入既有社交系统）
  function befriendColleague(col) {
    const p = st.s.person;
    const soc = p.social;
    const need = (CAR.colleague || {}).friendAffinity != null ? CAR.colleague.friendAffinity : 65;
    if (col.friend || (soc.friends || []).some((f) => f.name === col.name)) {
      return { ok: false, reason: '你们已经是朋友了' };
    }
    if (col.aff < need) return { ok: false, reason: '交情还不够（' + col.aff + ' / ' + need + '）' };
    const pers = p.personality;
    const cap = C.social.friendCapBase + Math.floor((pers ? pers.E : 50) / C.social.friendCapPerE);
    if (soc.friends.length >= cap) return { ok: false, reason: '朋友圈已经满了（上限 ' + cap + '）' };
    const friend = {
      name: col.name, gender: col.gender, tag: '同事',
      since: st.s.clock.age, quality: u.clamp(col.aff, 40, 92), best: false,
    };
    // 📊 人数数据化（可选模块）：真正的朋友挂正式数据卡
    if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(friend, 'friend');
    soc.friends.push(friend);
    soc.met = (soc.met || 0) + 1;
    col.friend = true;
    st.log('🤝 和同事「' + col.name + '」成了朋友，工位之间的距离更近了', 'good', '🤝');
    st.changeVital('mood', 3, '结交好友');
    bus.emit('social:new', { friend: friend });
    bus.emit('career:colleague', { colleague: col, act: actById('befriend') });
    return { ok: true, colleague: col };
  }
  // 供 UI 渲染：名册 + 每位同事当前各活动的可用性
  function officeView() {
    const p = st.s.person;
    const c = p.career;
    if (!c || c.phase !== 'employed' || !Array.isArray(c.colleagues) || !c.colleagues.length) return null;
    return {
      job: c.job,
      size: c.colleagues.length,
      colleagues: c.colleagues.map((m, i) => ({
        idx: i, name: m.name, gender: m.gender, skill: m.skill, years: m.years, aff: m.aff, friend: m.friend,
        acts: (CAR.officeActivities || []).map((a) => {
          let blocker;
          if (a.special === 'refer') {
            const need = (CAR.colleague || {}).friendAffinity != null ? CAR.colleague.friendAffinity : 65;
            blocker = m.aff < need ? '交情还不够' : null;
          } else if (a.special === 'befriend') {
            blocker = m.aff < ((CAR.colleague || {}).friendAffinity != null ? CAR.colleague.friendAffinity : 65)
              ? '交情还不够' : (m.friend ? '已是朋友' : null);
          } else {
            blocker = activityBlocker(a, p, m);
          }
          return { id: a.id, emoji: a.emoji, name: a.name, ready: !blocker, tip: blocker || a.name };
        }),
      })),
    };
  }

  /* --------------------- 看病花钱（与疾病系统联动） --------------------- */
  function onDisease(e) {
    const p = st.s.person;
    if (!p.career) return;
    const cost = FIN.medicalCost[e.disease.key] || 0;
    if (cost > 0) {
      p.wealth = Math.round((p.wealth - cost) * 10) / 10;
      st.changeVital('mood', -Math.min(3, cost * 0.4), '医疗开销');
    }
  }

  // 契约：供 HUD 与未来系统读取
  Game.career = {
    isWorking() {
      const c = st.s.person.career;
      return !!(c && c.phase === 'employed');
    },
    current() {
      return st.s.person.career;
    },
    phaseText: { student: '求学中', employed: '在职', retired: '已退休' },
    // 物价指数（v1.1.0）：UI 显示与测试用
    priceLevel() {
      const e = st.s.person.econ;
      return e ? e.priceLevel : 1;
    },
    // 职场同事名册与互动（v2.6.0）：供办公室面板与测试
    colleagues() {
      const c = st.s.person.career;
      return c && Array.isArray(c.colleagues) ? c.colleagues : [];
    },
    officeInteract,
    colleagueBefriend: befriendColleague,
    officeView,
    regenerateColleagues() {
      const c = st.s.person.career;
      if (c && c.phase === 'employed') { generateColleagues(); return true; }
      return false;
    },
  };
})();
