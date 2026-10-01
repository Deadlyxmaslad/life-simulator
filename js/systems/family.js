/* =========================================================================
 * 系统 · 原生家庭 (family / 出身)
 * -------------------------------------------------------------------------
 * 补上"人不是孤立出生"的一环：出生时生成家境、父母（姓名/年龄/健康/亲情/智力）
 * 与兄弟姐妹；父母随玩家年龄一起变老，会生病、会离世；离世时按家产与手足数分配
 * 遗产。家境同时决定出生财富，并（经教育系统）以遗传方式影响玩家智力起点。
 *
 * 依赖顺序：本系统 priority 12，最早初始化，供 career(60) 读取 wealth、
 * education(50) 读取父母智力。只写自己负责的 person.family 字段。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const F = C.family;

  Game.systems
    .create('family', 12)
    .on('state:reset', initFamily)
    .on('year', yearly);

  function r1(v) {
    return Math.round(v * 10) / 10;
  }
  function mkParent(role, name, iqMean) {
    return {
      role,
      name,
      iq: Math.round(u.clamp(u.gauss(iqMean, 12), 18, 95)),
      age: u.randInt(F.parentAge.min, F.parentAge.max),
      health: Math.round(u.clamp(u.gauss(F.parentHealth.mean, F.parentHealth.sd), 55, 100)),
      bond: Math.round(u.clamp(u.gauss(F.bondStart.mean, F.bondStart.sd), 30, 98)),
      alive: true,
      deathAge: 0,
    };
  }

  function initFamily() {
    const p = st.s.person;
    let oi = F.origins.indexOf(u.weighted(F.origins.map((o) => ({ item: o, weight: o.w }))));
    oi = u.clamp(oi + Game.scenario.originShift(), 0, F.origins.length - 1); // 剧本调整家境
    const origin = F.origins[oi];
    const fam = {
      origin: origin.key,
      estate: r1(u.range(origin.estate[0], origin.estate[1])), // 父母可继承积蓄池
      inherited: 0,
      father: mkParent('父亲', p.surname + st.rollGiven('男'), origin.iq),
      mother: mkParent('母亲', st.rollFullName('女'), origin.iq),
      siblings: [],
    };
    if (!u.chance(F.siblings.noneChance)) {
      const n = u.randInt(1, F.siblings.maxNum);
      for (let i = 0; i < n; i++) {
        const g = u.pick(['男', '女']);
        fam.siblings.push({
          name: p.surname + st.rollGiven(g),
          gender: g,
          age: u.randInt(-4, 6), // 相对玩家的长幼
          bond: Math.round(u.clamp(u.gauss(60, 14), 25, 95)),
        });
      }
    }
    p.family = fam;
    // 📊 人数数据化（可选模块）：父母与手足各自挂一张隐藏的数据卡
    if (Game.datalize && typeof Game.datalize.attach === 'function') {
      Game.datalize.attach(fam.father, 'parent');
      Game.datalize.attach(fam.mother, 'parent');
      fam.siblings.forEach(function (x) { Game.datalize.attach(x, 'sibling'); });
    }
    // 出生财富由家境决定（career 系统会尊重此值不再覆盖）
    p.wealth = r1(u.range(origin.wealth[0], origin.wealth[1]));
  }

  /* --------------------- 每年：父母变老 / 生病 / 离世 --------------------- */
  function yearly(e) {
    const p = st.s.person;
    const f = p.family;
    if (!f || !p.alive) return;

    for (const par of [f.father, f.mother]) {
      if (!par.alive) continue;
      par.age += 1;
      par.health = Math.max(0, par.health - (par.age > 72 ? 0.9 : 0.2));
      par.bond += (55 - par.bond) * F.bondDrift; // 亲情缓慢回落

      const illP = F.illness.base * (1 + Math.max(0, par.age - 68) * 0.03);
      if (par.health > 25 && u.chance(illP)) parentIllness(par);

      if (par.age >= F.death.age0) {
        const dp = u.clamp(F.death.base + (par.age - F.death.age0) * F.death.perYear + (par.health < 40 ? 0.03 : 0), 0, F.death.max);
        if (par.alive && u.chance(dp)) parentDeath(par, f);
      }
    }
    for (const s of f.siblings) s.age += 1;
  }

  function parentIllness(par) {
    const p = st.s.person;
    const cost = Math.round(u.range(F.illness.cost[0], F.illness.cost[1]));
    p.wealth = r1(p.wealth - cost);
    st.changeVital('mood', -F.illness.moodHit, '照护' + par.role);
    par.bond = Math.min(100, par.bond + F.illness.bondUp);
    st.log('🤒 ' + par.role + '病了一场，你奔波照护（花销约 ' + cost + ' 万），亲情更浓了', 'info', '🤒');
    bus.emit('natfamily:illness', { role: par.role });
  }

  function parentDeath(par, f) {
    const p = st.s.person;
    par.alive = false;
    par.deathAge = par.age;
    const grief = Math.round(6 + par.bond / 12); // 亲情越深，打击越大
    st.changeVital('mood', -grief, '痛失' + par.role);
    st.log('💔 ' + par.role + '在 ' + par.age + ' 岁离世', 'danger', '💔');
    bus.emit('natfamily:death', { role: par.role, age: par.age });

    // 遗产分配：家产池的一半按（玩家 + 兄弟姐妹）均分
    const heirs = f.siblings.length + 1;
    const portion = r1((f.estate * F.inherit.share) / heirs);
    if (portion > 0) {
      p.wealth = r1(p.wealth + portion);
      f.inherited = r1(f.inherited + portion);
      f.estate = r1(Math.max(0, f.estate - portion));
      st.log('⚖️ 你从' + par.role + '的遗产中继承了约 ' + portion + ' 万', 'good', '⚖️');
      bus.emit('natfamily:inherit', { amount: portion });
    }
  }

  Game.homeFamily = {
    current() {
      return st.s.person.family;
    },
    origin() {
      const f = st.s.person.family;
      return f ? f.origin : '—';
    },
  };
})();
