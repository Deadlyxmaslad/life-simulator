/* =========================================================================
 * 系统 · 婚恋 / 家庭 (marriage)
 * -------------------------------------------------------------------------
 * 成年后择偶 → 结婚 → 生育 → 养儿；也含感情破裂的离婚、丧偶。
 * 婚恋/生育概率受心情、收入、智力加成（呼应"成家立业"），孩子会增加
 * 家庭开销（由事业系统结算）并影响心情。配偶随年龄老化，可能先一步离世。
 *
 * 想加恋爱/相亲/二婚/子女成才事件：照本文件在 year 里加阶段即可。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const M = C.marriage;

  Game.systems
    .create('marriage', 65)
    .on('state:reset', initFamily)
    .on('year', yearly);

  function initFamily() {
    const p = st.s.person;
    p.relationship = {
      married: false, spouse: null, children: [],
      widowed: false, divorced: false, marriedAge: 0, deceasedSpouseName: '',
    };
  }

  function yearly(e) {
    const p = st.s.person;
    const r = p.relationship;
    if (!r || !p.alive) return;
    const age = e.age;

    if (r.married) {
      maybeChild(age);
      if (!tickSpouse(age)) return; // 配偶若离世则本轮结束
      maybeDivorce();
    } else {
      maybeMarry(age);
    }
  }

  /* --------------------- 求偶 / 结婚 --------------------- */
  function maybeMarry(age) {
    const p = st.s.person;
    const w = M.window;
    if (age < w.min || age > w.max) return;
    const income = (p.career && p.career.income) || 0;
    const moodF = u.clamp(0.5 + p.mood / 120, 0.4, 1.5);
    const incomeF = u.clamp(0.5 + income / 25, 0.35, 1.5);
    const iqF = u.clamp(0.8 + (p.intelligence - 55) * 0.004, 0.7, 1.25);
    if (u.chance(u.clamp(M.baseSeek * moodF * incomeF * iqF, 0.02, 0.6))) {
      marry(age);
    }
  }

  function marry(age) {
    const p = st.s.person;
    const r = p.relationship;
    const other = p.gender === '男' ? '女' : '男';
    const sp = {
      name: st.rollFullName(other),
      gender: other,
      age: Math.max(18, age + Math.round(u.gauss(0, M.spouse.ageGap / 2))),
      iq: Math.round(u.clamp(u.gauss(M.spouse.iqMean, M.spouse.iqSd), 20, 99)),
      health: Math.round(u.clamp(u.gauss(85, 10), 60, 100)),
    };
    // 📊 人数数据化（可选模块）：给配偶挂一张隐藏的数据卡
    if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(sp, 'spouse');
    r.spouse = sp;
    r.married = true;
    r.marriedAge = age;
    r.widowed = false;
    r.divorced = false;
    st.changeVital('mood', M.joy.marry, '喜结连理');
    st.changeVital('health', +1, '家庭美满');
    st.log('💑 ' + age + ' 岁，与' + sp.name + '（' + sp.age + ' 岁）喜结连理', 'good', '💑');
    bus.emit('family:marry', { spouse: sp });
  }

  /* --------------------- 生育 --------------------- */
  function maybeChild(age) {
    const p = st.s.person;
    const r = p.relationship;
    const w = M.child.window;
    if (age < w.min || age > w.max || r.children.length >= M.child.maxChildren) return;
    const moodF = u.clamp(0.6 + p.mood / 140, 0.5, 1.3);
    const wealthF = u.clamp(0.6 + (p.wealth || 0) / 140, 0.35, 1.2);
    // 孩子越多，再生一个的意愿越低
    const spacing = Math.max(0.15, 1 - 0.3 * r.children.length);
    if (u.chance(M.child.baseChance * moodF * wealthF * spacing)) {
      const g = u.pick(['男', '女']);
      const name = p.surname + st.rollGiven(g);
      const child = { name, gender: g, birthAge: age };
      // 📊 人数数据化（可选模块）：给孩子挂一张隐藏的数据卡
      if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(child, 'child');
      r.children.push(child);
      st.changeVital('mood', M.joy.child, '喜得' + (g === '男' ? '贵子' : '千金'));
      st.log('👶 ' + age + ' 岁，喜得' + (g === '男' ? '儿子' : '女儿') + '「' + name + '」', 'good', '👶');
      bus.emit('family:birth', { child });
    }
  }

  /* --------------------- 配偶老化 / 离世（返回是否仍存续） --------------------- */
  function tickSpouse(age) {
    const r = st.s.person.relationship;
    const sp = r.spouse;
    if (!sp) return true;
    sp.age += 1;
    sp.health = Math.max(0, sp.health - (sp.age > 60 ? 0.6 : 0.1));
    const deathP = M.spouseDeathBase * u.clamp(1 + Math.max(0, sp.age - 60) * 0.06, 1, 12);
    if (u.chance(deathP)) {
      spouseDied();
      return false;
    }
    return true;
  }

  function spouseDied() {
    const p = st.s.person;
    const r = p.relationship;
    const name = r.spouse ? r.spouse.name : '伴侣';
    r.married = false;
    r.widowed = true;
    r.deceasedSpouseName = name;
    r.spouse = null;
    st.changeVital('mood', M.joy.widow, '丧偶之痛');
    st.log('🕯️ 相伴多年的' + name + '离世，独自面对余生', 'danger', '🕯️');
    bus.emit('family:widow', {});
  }

  /* --------------------- 离婚 --------------------- */
  function maybeDivorce() {
    const p = st.s.person;
    if (p.mood >= M.divorce.moodBelow) return;
    if (!u.chance(M.divorce.chance)) return;
    const r = p.relationship;
    const name = r.spouse ? r.spouse.name : '伴侣';
    r.married = false;
    r.divorced = true;
    r.spouse = null;
    p.wealth = Math.round(p.wealth * 0.6 * 10) / 10; // 财产分割
    st.changeVital('mood', M.joy.divorce, '婚姻破裂');
    st.log('💔 与' + name + '离婚，家产一分为二', 'warn', '💔');
    bus.emit('family:divorce', {});
  }

  // 契约
  Game.family = {
    isMarried() {
      const r = st.s.person.relationship;
      return !!(r && r.married);
    },
    children() {
      const r = st.s.person.relationship;
      return r ? r.children : [];
    },
    current() {
      return st.s.person.relationship;
    },
  };
})();
