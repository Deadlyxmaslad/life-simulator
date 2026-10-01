/* =========================================================================
 * 系统 · 社交 / 朋友 (social)
 * -------------------------------------------------------------------------
 * 朋友是"经营"出来的：不同人生阶段（校园 / 职场 / 生活）会结识不同的人，
 * 性格外向(E)、开放(O)的人更容易交友、也更能维系关系；不联系就会冷却、
 * 渐行渐远。挚友与陪伴能提升心情、增强免疫（社交支持），而老来无友会孤独。
 *
 * 读取性格系统：Game.personality.get('E'/'O'/'A')；与学业/事业系统共享"人生阶段"上下文。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const S = C.social;

  Game.systems
    .create('social', 70)
    .on('state:reset', initSocial)
    .on('year', yearly);

  function initSocial() {
    const p = st.s.person;
    p.social = { friends: [], met: 0 };
  }

  // 当前人生阶段：校园 / 职场 / 生活
  function context() {
    const p = st.s.person;
    if (p.education && p.education.inSchool) return 'school';
    if (p.career && p.career.phase === 'employed') return 'work';
    return 'other';
  }

  function yearly(e) {
    const p = st.s.person;
    const soc = p.social;
    const pers = p.personality;
    if (!soc || !pers || !p.alive) return;
    const age = e.age;
    if (age < S.startAge) return;

    const E = pers.E;
    const cap = S.friendCapBase + Math.floor(E / S.friendCapPerE);
    const ctxKey = context();
    const tags = S.contextByStage[ctxKey];

    // —— 1) 每年有机会结识新朋友 ——
    const lifeBoost = ctxKey === 'school' ? 1.3 : ctxKey === 'work' ? 1.15 : (p.career && p.career.phase === 'retired' ? 0.7 : 0.9);
    const ageF = age < 12 ? 1.0 : age < 26 ? 1.25 : age < 45 ? 1.0 : age < 65 ? 0.8 : 0.55;
    const meetP = S.meetChanceBase * (0.4 + (E / 100) * 1.4) * lifeBoost * ageF;
    if (soc.friends.length < cap && u.chance(meetP)) {
      addFriend(ctxKey, u.pick(tags), age);
    }

    // —— 2) 维系或冷却现有友情 ——
    for (const f of soc.friends) {
      const maintain = u.clamp(S.maintainBase + ((E - 50) / 100) * 0.35 + (f.best ? 0.1 : 0), 0.15, 0.92);
      if (u.chance(maintain)) {
        f.quality = u.clamp(f.quality + u.randInt(2, 6), 0, 100);
        if (!f.best && f.quality >= S.goodQuality && u.chance(0.3)) {
          f.best = true;
          st.log('🤝 与' + f.name + '成了无话不谈的至交', 'good', '🤝');
          st.changeVital('mood', +2, '知己');
        }
      } else {
        f.quality = u.clamp(f.quality - S.decay * u.range(0.5, 1.5), 0, 100);
      }
    }

    // —— 3) 冷却过度则渐行渐远 ——
    soc.friends = soc.friends.filter((f) => {
      if (f.quality < S.fadeQuality && u.chance(0.5)) {
        st.log('🍂 与' + f.tag + '「' + f.name + '」渐渐疏远了', 'info', '🍂');
        return false;
      }
      return true;
    });

    // —— 4) 朋友也可能离世（罕见，随年龄上升）——
    for (const f of soc.friends.slice()) {
      const dp = S.friendDeathBase * (1 + Math.max(0, age - 55) * 0.02);
      if (u.chance(dp)) {
        soc.friends = soc.friends.filter((x) => x !== f);
        const close = f.quality >= S.goodQuality;
        st.log('🕯️ 听闻' + f.name + '离世', close ? 'danger' : 'info', '🕯️');
        st.changeVital('mood', close ? -S.friendDeathMoodHit : -1, close ? '痛失好友' : '故人');
      }
    }

    // —— 5) 社交支持 / 孤独 ——
    const weighted = soc.friends.reduce((s, f) => s + f.quality / 100, 0);
    if (soc.friends.length) {
      st.changeVital('mood', Math.min(S.moodCap, weighted * S.moodPerFriend), '朋友陪伴');
      st.changeVital('immunity', Math.min(2, weighted * S.immunityPerFriend), '社交支持');
    } else if (age >= 18) {
      st.changeVital('mood', -S.lonelyPenalty, '孤独');
    }
  }

  function addFriend(ctxKey, tag, age) {
    const p = st.s.person;
    const soc = p.social;
    const g = u.pick(['男', '女']);
    const name = st.rollFullName(g);
    const friend = { name, gender: g, tag, since: age, quality: u.randInt(40, 70), best: false };
    // 📊 人数数据化（可选模块）：给这位新朋友挂一张隐藏的数据卡
    if (Game.datalize && typeof Game.datalize.attach === 'function') Game.datalize.attach(friend, 'friend');
    soc.friends.push(friend);
    soc.met += 1;
    const where = { school: '校园里', work: '职场上', other: '生活中' }[ctxKey] || '人生路上';
    st.log('👋 在' + where + '结识了' + tag + '「' + name + '」', 'info', '👋');
    bus.emit('social:new', { friend });
  }

  // 契约
  Game.social = {
    current() {
      return st.s.person.social;
    },
    count() {
      const s = st.s.person.social;
      return s ? s.friends.length : 0;
    },
  };
})();
