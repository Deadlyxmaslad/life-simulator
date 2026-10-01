/* =========================================================================
 * 系统 · 主动行动 (actions)
 * -------------------------------------------------------------------------
 * 常驻"行动栏"：在两次抉择事件之间，给玩家持续可做的操作（学习/锻炼/社交/
 * 就医/加班/陪伴家人/旅行/捐助…），每项带按月冷却与情境门槛，点击即时生效。
 * 这是"参与感"的主动侧；与 decisions 的被动事件流互补。
 * 效果统一走 Game.state.applyEffects，复用事件同一套数值通道。
 *
 * 熟练度（G4）：带 effects 的行动每次使用累计熟练度，跨过档位阈值后
 * 效果按档位 bonus 放大（pers 性格漂移与随机 gain 不放大），行动栏显示档位徽章。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const A = C.actions;
  const M = C.actionMastery;
  // 熟练度放大的数值字段（flags/pers 保持原样）
  const SCALABLE = ['health', 'immunity', 'mood', 'intelligence', 'knowledge', 'wealth', 'stress', 'depression', 'trauma'];

  Game.systems
    .create('actions', 76)
    .on('state:reset', init)
    .on('month', tickCooldown);

  function init() {
    const p = st.s.person;
    p.actions = { cd: {}, used: 0, mastery: {} };
  }

  function tickCooldown() {
    const p = st.s.person;
    if (!p.actions) return;
    for (const k in p.actions.cd) {
      if (p.actions.cd[k] > 0) p.actions.cd[k] -= 1;
    }
  }

  function def(id) {
    return A.find((a) => a.id === id);
  }
  function cooldownLeft(id) {
    const p = st.s.person;
    return (p.actions && p.actions.cd[id]) || 0;
  }
  function condOk(d, p) {
    return !d.cond || safeCall(d.cond, p);
  }
  // 行业专属：若行动声明了 jobs，则仅当在职且当前职业在列表中时才解锁
  function jobOk(d, p) {
    if (!d.jobs) return true;
    const c = p.career;
    return !!(c && c.phase === 'employed' && d.jobs.indexOf(c.job) >= 0);
  }
  function available(id) {
    const p = st.s.person;
    const d = def(id);
    if (!d || !p.alive || !p.actions) return false;
    return cooldownLeft(id) <= 0 && jobOk(d, p) && condOk(d, p);
  }

  /* --------------------- 熟练度（G4） --------------------- */
  function tierOf(m) {
    if (!M) return null;
    let hit = null;
    for (const t of M.tiers) if (m >= t.at) hit = t;
    return hit;
  }
  function masteryOf(id) {
    const p = st.s.person;
    return (p.actions && p.actions.mastery && p.actions.mastery[id]) || 0;
  }
  // 按倍率放大数值字段（wealth 等保留 1 位小数）
  function scaleEffects(eff, factor) {
    const out = {};
    for (const k in eff) {
      if (SCALABLE.indexOf(k) >= 0 && typeof eff[k] === 'number') {
        out[k] = Math.round(eff[k] * factor * 10) / 10;
      } else {
        out[k] = eff[k];
      }
    }
    return out;
  }

  function doAction(id) {
    const p = st.s.person;
    const d = def(id);
    if (!d || !available(id)) return false;
    if (!p.actions.mastery) p.actions.mastery = {}; // 兼容 v1.0 存档

    // —— 行动抉择化（G8）：type:'decision' 的行动不直接生效，
    //      而是通过 decisions 系统弹出选择窗，冷却与熟练度在此处先行扣减。
    //      守卫回退：若 openActionChoice 不可用（加载顺序/模块摘除），
    //      退回原有直接生效路径，保证游戏不会卡死。
    if (d.type === 'decision' && Game.decisions && typeof Game.decisions.openActionChoice === 'function') {
      advanceMastery(id, d);
      p.actions.cd[id] = d.cd;
      p.actions.used += 1;
      st.log('🎯 你选择了：' + d.emoji + ' ' + d.name, 'info', d.emoji);
      bus.emit('action:done', { id, def: d });
      Game.decisions.openActionChoice(d);
      bus.emit('ui:refresh', {});
      return true;
    }

    advanceMastery(id, d);

    let eff = d.apply ? d.apply(p) : d.effects || {};
    const canMaster = !!d.effects && !!M;
    const tier0 = canMaster ? tierOf(masteryOf(id) - u.randInt(M.gainMin, M.gainMax)) : null;
    if (tier0) eff = scaleEffects(eff, 1 + tier0.bonus);
    const tagged = Object.assign({}, eff, { source: '行动·' + d.name });
    st.applyEffects(tagged);

    // 小概率增益（如学习开窍）
    if (d.gain && u.chance(d.gain.chance)) {
      const g = Object.assign({}, d.gain, { source: '行动·' + d.name });
      delete g.chance;
      st.applyEffects(g);
    }
    // 亲情加成（陪伴家人）
    if (d.bond) applyBond(d.bond);
    // 行动也能埋下伏笔 / 登记延时回响（如坚持锻炼→体能红利、捐助→善有善报）
    if (Game.consequences && (d.plants || d.delayed)) Game.consequences.onChoose({ plants: d.plants, delayed: d.delayed });

    p.actions.cd[id] = d.cd;
    p.actions.used += 1;
    st.log('🎯 你选择了：' + d.emoji + ' ' + d.name, 'info', d.emoji);
    bus.emit('action:done', { id, def: d });
    bus.emit('ui:refresh', {});
    return true;
  }

  // 熟练度成长与晋档提醒（抽取为独立函数，供 decision 路由与直接路径共用）
  function advanceMastery(id, d) {
    const p = st.s.person;
    const canMaster = !!d.effects && !!M;
    if (!canMaster) return;
    const m0 = masteryOf(id);
    const tier0 = tierOf(m0);
    const m1 = Math.min(M.cap, m0 + u.randInt(M.gainMin, M.gainMax));
    p.actions.mastery[id] = m1;
    const t1 = tierOf(m1);
    if (t1 && (!tier0 || t1.label !== tier0.label)) {
      st.log('🏆 行动精进 · 「' + d.name + '」已臻' + t1.label + '，效果更上一层', 'good', '🏆');
      bus.emit('action:mastery', { id, name: d.name, mastery: m1, tier: t1.label });
    }
  }

  function applyBond(amount) {
    const p = st.s.person;
    const bump = (o) => { if (o) o.bond = u.clamp((o.bond || 0) + amount, 0, 100); };
    if (p.family) { if (p.family.father.alive) bump(p.family.father); if (p.family.mother.alive) bump(p.family.mother); (p.family.siblings || []).forEach(bump); }
    if (p.relationship) { if (p.relationship.spouse) bump(p.relationship.spouse); (p.relationship.children || []).forEach(bump); }
  }

  function safeCall(fn, p) {
    try {
      return !!fn(p);
    } catch (e) {
      return false;
    }
  }

  Game.actions = {
    list() {
      const p = st.s.person;
      return A.map((d) => {
        const m = masteryOf(d.id);
        const t = tierOf(m);
        return {
          id: d.id, emoji: d.emoji, name: d.name,
          cd: cooldownLeft(d.id),
          ready: available(d.id),
          available: !!(p.alive && jobOk(d, p) && condOk(d, p)), // 是否满足门槛（不含冷却）
          mastery: m,
          tier: t ? t.label : '',
        };
      });
    },
    do: doAction,
    mastery: masteryOf,
    tierOf,
    // 外部模块专用：清空全部行动冷却 / 直接赋予熟练度
    clearCooldown() {
      const p = st.s.person;
      if (!p.actions) return;
      for (const k in p.actions.cd) p.actions.cd[k] = 0;
    },
    grantMastery(id, value) {
      const p = st.s.person;
      if (!p.actions) return 0;
      if (!p.actions.mastery) p.actions.mastery = {}; // 兼容 v1.0 存档
      const owner = def(id);
      if (!owner) return 0;
      const cap = (C.actionMastery && C.actionMastery.cap) || 100;
      const cur = p.actions.mastery[id] || 0;
      const next = u.clamp(Math.max(cur, value), 0, cap);
      p.actions.mastery[id] = next;
      return next;
    },
  };
})();
