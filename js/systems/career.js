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
    st.log('🏖️ 光荣退休，开始领取退休金（约 ' + c.income.toFixed(1) + ' 万元/年）', 'info', '🏖️');
    st.changeVital('mood', -1, '退休落差');
    bus.emit('career:retire', { pension: c.income });
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
  };
})();
