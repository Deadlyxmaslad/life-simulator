/* =========================================================================
 * 系统 · 未竟之事 / 人生留白 (roads) —— v1.3.0
 * -------------------------------------------------------------------------
 * 记录"这辈子从没做过"的维度（从未恋爱成家 / 从未生育 / 从未置业 / 从未远行 /
 * 从未孤注一掷），生命尽头以温柔的方式呈现"你错过了……"，制造回味与重开动机。
 * 只读、不改写任何状态；predicate 在 death 时评估。删掉本文件引擎行为逐位不变。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const R = C.roads;

  function paths() { return (R && R.paths) || []; }

  function evaluate(p) {
    const out = [];
    for (const r of paths()) {
      let missed = false;
      try { missed = !!r.miss(p); } catch (e) { missed = false; }
      if (missed) out.push({ id: r.id, name: r.name, desc: r.desc });
    }
    return out;
  }

  function run() {
    const p = st.s.person;
    if (!p) return [];
    const missed = evaluate(p);
    st.s.roads = { missed: missed, total: paths().length };
    if (missed.length) {
      st.log('🕯️ 未竟之事：' + missed.map((m) => m.name).join('、') +
        ' —— 有些路，这辈子没来得及走。', 'info', '🕯️');
    }
    bus.emit('roads:done', { missed: missed });
    return missed;
  }

  function count() {
    return (st.s.roads && st.s.roads.missed) ? st.s.roads.missed.length : 0;
  }
  function missed() {
    return (st.s.roads && st.s.roads.missed) ? st.s.roads.missed.slice() : [];
  }

  Game.systems.create('roads', 92).on('death', run);

  Game.roads = { run, evaluate, count, missed, paths };
})();
