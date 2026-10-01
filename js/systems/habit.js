/* =========================================================================
 * 系统 · 习惯养成闭环 (habit) —— v1.3.0
 * -------------------------------------------------------------------------
 * 把"性格可塑"从被动变主动：玩家在习惯面板立一个习惯，每月坚持累加 streak，
 * 达到 persist 个月即"内化"，一次性获得性格漂移与属性增益；之后仍持续小额增益。
 * 失败（放弃/改立其它）只断 streak，不惩罚。状态完全独立（s.habit 子树），
 * 不引用任何其它系统，删掉本文件引擎行为与评分逐位不变。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const H = C.habit;
  const u = Game.util;

  function defs() { return (H && H.defs) || []; }
  function def(id) { return defs().find((d) => d.id === id); }

  Game.systems
    .create('habit', 17)
    .on('state:reset', init)
    .on('month', onMonth);

  function init() {
    st.s.habit = { active: null, startedMonth: 0, streak: 0, mastered: [] };
  }

  // 立一个习惯（面板按钮调用）。返回是否成功启动。
  function start(id) {
    const d = def(id);
    if (!d) return false;
    const h = st.s.habit;
    if (h.active === id) return false; // 已经在坚持这个
    if (h.active && def(h.active)) {
      st.log('🔁 你放下了「' + def(h.active).name + '」，改立新习惯。', 'info', '🔁');
    }
    h.active = id;
    h.startedMonth = st.s.clock.year * 12 + st.s.clock.month;
    h.streak = 0;
    st.log('🌱 你立下习惯：「' + d.emoji + ' ' + d.name + '」——' + d.desc, 'good', '🌱');
    bus.emit('habit:start', { id: id });
    return true;
  }

  // 放弃当前习惯：仅断 streak，不惩罚。
  function abandon() {
    const h = st.s.habit;
    if (!h.active) return false;
    const name = def(h.active) ? def(h.active).name : h.active;
    st.log('🛑 你放下了习惯：「' + name + '」（连续 ' + h.streak + ' 个月）。', 'info', '🛑');
    h.active = null;
    h.streak = 0;
    bus.emit('habit:abandon', {});
    return true;
  }

  function onMonth() {
    const h = st.s.habit;
    const p = st.s.person;
    if (!h || !p || !p.alive) return;
    if (!h.active) return;
    const d = def(h.active);
    if (!d) { h.active = null; return; }

    h.streak += 1;

    // 坚持期间每月小额增益（内化后仍持续，作为长期好习惯的红利）
    if (d.monthly) {
      const mEff = Object.assign({}, d.monthly, { source: '习惯·' + d.name });
      st.applyEffects(mEff);
    }

    // 达成"内化"：一次性性格漂移 + 属性增益；随后把连击封顶在 persist，不再虚增
    if (h.streak >= d.persist) {
      if (h.mastered.indexOf(d.id) < 0) {
        h.mastered.push(d.id);
        const un = d.unlock || {};
        const stats = un.stats || {};
        const eff = Object.assign({}, stats);
        if (un.pers) eff.pers = un.pers;
        if (eff.mood == null) eff.mood = 3;
        eff.source = '习惯内化·' + d.name;
        st.applyEffects(eff);
        st.log('🏅 习惯内化：「' + d.emoji + ' ' + d.name + '」坚持满 ' + d.persist +
          ' 个月，成为你的一部分。' + (un.note || ''), 'good', '🏅');
        bus.emit('habit:mastered', { id: d.id });
      }
      if (h.streak > d.persist) h.streak = d.persist; // 封顶，避免展示上无限累加
    }
  }

  // 给 UI / 结算用的只读视图
  function state() {
    const h = st.s.habit;
    if (!h) return null;
    const d = h.active ? def(h.active) : null;
    return {
      active: h.active,
      name: d ? d.name : null,
      emoji: d ? d.emoji : null,
      desc: d ? d.desc : null,
      streak: h.streak,
      persist: d ? d.persist : 0,
      progress: d ? Math.min(1, h.streak / d.persist) : 0,
      mastered: h.mastered.slice(),
      canStart: st.s.clock.age >= 12,
    };
  }

  function masteredCount() {
    return (st.s.habit && st.s.habit.mastered) ? st.s.habit.mastered.length : 0;
  }

  // —— 存档：独立快照 / 水合（hydrate(null) 回到空习惯态）——
  function snapshot() {
    const h = st.s.habit || { active: null, startedMonth: 0, streak: 0, mastered: [] };
    return JSON.parse(JSON.stringify(h));
  }
  function hydrate(m) {
    st.s.habit = m
      ? JSON.parse(JSON.stringify(m))
      : { active: null, startedMonth: 0, streak: 0, mastered: [] };
  }

  Game.habit = {
    start, abandon, state, def, defs, masteredCount,
    snapshot, hydrate,
  };
})();
