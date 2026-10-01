/* =========================================================================
 * 系统 · 因果 / 伏笔 (consequences)
 * -------------------------------------------------------------------------
 * 让选择产生"延迟后果"，把孤立的事件串成故事线。两种机制：
 *   1) 伏笔标记 seed：某选择埋下一个 flag（可带存活期），之后带 requiresSeed 的
 *      事件才会出现（可 consumesSeed 回收）——"因果"式解锁。
 *   2) 延时回响 timer：某选择登记"若干月后"自动结算的效果 / 追加伏笔 / 排入一个
 *      专属后续事件（drainReady 交回抉择引擎，优先弹出）——"回旋镖"式回收。
 *
 * 被 decisions 调用：onChoose(ch) 登记；eligible 用 has() 做门槛；ask 用 consume()。
 * 自身只碰 person.seeds / person.timers，不改其它系统。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;

  function monthIdx() {
    const c = st.s.clock;
    return c.year * 12 + c.month;
  }
  function q() {
    const p = st.s.person;
    return (p.readyQueue = p.readyQueue || []);
  }

  Game.systems
    .create('consequences', 74)
    .on('state:reset', function () {
      const p = st.s.person;
      p.seeds = {};
      p.timers = [];
      p.readyQueue = [];
    })
    .on('month', tick);

  /* --------------------------- 伏笔标记 --------------------------- */
  function plant(seed) {
    if (!seed) return;
    const p = st.s.person;
    p.seeds = p.seeds || {};
    if (typeof seed === 'string') p.seeds[seed] = Infinity;
    else p.seeds[seed.seed] = seed.ttl ? monthIdx() + seed.ttl : Infinity;
  }
  function has(name) {
    const p = st.s.person;
    if (!p.seeds || !p.seeds[name]) return false;
    if (p.seeds[name] === Infinity) return true;
    if (monthIdx() > p.seeds[name]) {
      delete p.seeds[name];
      return false;
    }
    return true;
  }
  function consume(name) {
    if (st.s.person.seeds) delete st.s.person.seeds[name];
  }

  /* --------------------------- 延时回响 --------------------------- */
  function schedule(delayMonths, payload) {
    if (!delayMonths || delayMonths <= 0) {
      resolveNow(payload);
      return;
    }
    st.s.person.timers.push(Object.assign({ due: monthIdx() + delayMonths }, payload));
  }

  function resolveNow(t) {
    const p = st.s.person;
    if (t.effects) st.applyEffects(Object.assign({}, t.effects, { source: '伏笔' }));
    if (t.plants) (Array.isArray(t.plants) ? t.plants : [t.plants]).forEach(plant);
    if (t.event && !q().includes(t.event)) q().push(t.event); // 去重：同一后续事件不叠加排队
    if (t.log) st.log('🕓 ' + t.log, t.logLevel || 'warn', '🕓');
  }

  function tick() {
    const p = st.s.person;
    if (!p || !p.timers || !p.alive) return;
    const now = monthIdx();
    const keep = [];
    for (const t of p.timers) {
      if (t.due <= now) resolveNow(t);
      else keep.push(t);
    }
    p.timers = keep;
  }

  // 由 decisions 在玩家做出选择后调用
  function onChoose(ch) {
    if (!ch) return;
    if (ch.plants) (Array.isArray(ch.plants) ? ch.plants : [ch.plants]).forEach(plant);
    if (ch.delayed) for (const d of ch.delayed) schedule(d.inMonths || 0, d);
  }

  Game.consequences = {
    plant,
    has,
    consume,
    onChoose,
    schedule,
    drainReady() {
      const arr = q();
      const r = arr.slice();
      arr.length = 0;
      return r;
    },
    seedCount() {
      const p = st.s.person;
      return p && p.seeds ? Object.keys(p.seeds).length : 0;
    },
  };
})();
