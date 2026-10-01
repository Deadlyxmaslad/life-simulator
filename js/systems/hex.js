/* =========================================================================
 * 系统 · 🧬 海克斯 (hex) —— 规则类外挂
 * -------------------------------------------------------------------------
 * 改写的是"世界运行方式"：概率、时间、身体规则、死亡判定。
 *
 * 独立性约定（重要）：本模块与 💰神壕、📊人数数据化 **没有任何关系**——
 * 不读它们的 state、不订阅它们的事件、不与它们共享任何资源。
 * 它只做三件事：① 持有自己的 s.hex 与算力 HE；② 调用引擎已开放的
 * 带守卫钩子（util.luckMul / lifespan.die / decisions.reroll / actions.*）；
 * ③ 通过 Game.state.applyEffects 落地数值。删掉本文件，引擎行为完全不变。
 *
 * 算力 HE：每月回充 + 氪命兑换（健康 / 免疫 / 心情）。外挂越强，人生越薄。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const HEX = C.hex;

  function freshState() {
    return {
      on: HEX.enabled === true,
      he: HEX.heStart,
      spent: 0,
      cd: {},        // 各外挂剩余冷却（月）
      used: {},      // 终身限次类计数
      once: {},      // 一次性是否已购买
      luckLeft: 0,   // 概率倾斜剩余月
      cyber: false,
      shield: false,
      memo: null,    // 上个月初快照（仅本模块持有，不落 localStorage）
      prevMemo: null,
      log: [],
    };
  }

  Game.systems
    .create('hex', 8)
    .on('state:reset', function () {
      u.setLuckMul(1); // 开局复位：随机流绝不跨局污染
      st.s.hex = freshState();
    })
    .on('month', onMonth)
    .on('achievement:unlock', function () {
      const s = st.s.hex;
      if (!s || !s.on) return;
      earn(HEX.regenPerAchievement, '成就解锁');
    });

  function def(id) {
    return (HEX.powers || []).find((p) => p.id === id);
  }
  function cdOf(id) {
    const s = st.s.hex;
    return (s && s.cd && s.cd[id]) || 0;
  }
  function usedOf(id) {
    const s = st.s.hex;
    return (s && s.used && s.used[id]) || 0;
  }
  function usedOnce(id) {
    const s = st.s.hex;
    return !!(s && s.once && s.once[id]);
  }

  function record(row) {
    const s = st.s.hex;
    s.log.push(row);
    if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
  }

  function earn(n, reason) {
    const s = st.s.hex;
    s.he = Math.min(HEX.heMax, Math.round((s.he + n) * 10) / 10);
    if (n) bus.emit('hex:earn', { amount: n, reason, he: s.he });
    return s.he;
  }

  function pay(n) {
    const s = st.s.hex;
    if (s.he < n) return false;
    s.he = Math.round((s.he - n) * 10) / 10;
    s.spent = Math.round((s.spent + n) * 10) / 10;
    st.s.person.flags = st.s.person.flags || {};
    st.s.person.flags.used_hex = true;
    return true;
  }

  function onMonth() {
    const p = st.s.person;
    const s = st.s.hex;
    if (!s || !p.alive) return;
    for (const k in s.cd) if (s.cd[k] > 0) s.cd[k] -= 1;
    if (s.luckLeft > 0) {
      s.luckLeft -= 1;
      if (s.luckLeft === 0) u.setLuckMul(1); // 到期必须复位，禁止永久污染随机流
    }
    if (!s.on) return;
    if (st.s.clock.age >= 18) earn(HEX.regenPerMonth, '每月回充');
    if (s.cyber) {
      const cy = HEX.cyber;
      p.wealth = Math.round((p.wealth - cy.yearlyFee / 12) * 10) / 10; // 义体年费摊到月
      st.changeVital('mood', -cy.moodDrain / 12, '义体维护');
    }
    // 为"回溯"保留上个月初的内存快照（仅本模块自己持有，不落 localStorage）
    if (Game.save && typeof Game.save.snapshot === 'function') {
      const cur = Game.save.snapshot();
      s.memo = s.prevMemo || null; // prevMemo 即上个月的开头
      s.prevMemo = cur;
      delete s.lastMemo;
      delete s.pendingMemo;
    }
  }

  /* ------------------------------ 氪命 ------------------------------ */
  function burn(kind) {
    const rule = HEX.burn && HEX.burn[kind];
    const s = st.s.hex;
    if (!s || !s.on || !rule) return false;
    const p = st.s.person;
    const own = kind === 'mood' ? p.mood : kind === 'immunity' ? p.immunity : p.health;
    if (own <= rule.per) return false;
    st.changeVital(kind, -rule.per, '海克斯·氪命');
    earn(rule.he, '氪命·' + kind);
    st.log('🧬 你透支了自己的' + vitalsName(kind) + '，置换出 ' + rule.he + ' 点算力', 'warn', '🧬');
    record({ id: 'burn_' + kind, note: '氪命 ' + kind, he: rule.he });
    return true;
  }
  function vitalsName(kind) {
    return { health: '健康', immunity: '免疫力', mood: '心情' }[kind] || kind;
  }

  /* ------------------------------ 施放 ------------------------------ */
  function usable(id) {
    const s = st.s.hex;
    const d = def(id);
    if (!s || !s.on || !d || !st.s.person.alive) return false;
    if (s.he < d.cost) return false;
    if (cdOf(id) > 0) return false;
    if (d.maxUse != null && usedOf(id) >= d.maxUse) return false;
    if (d.once && usedOnce(id)) return false;
    if (id === 'luck' && s.luckLeft > 0) return false;
    if (id === 'reroll' && !st.s.pendingDecision) return false; // 只有在岔路口才有意义
    if (id === 'rewind' && !(st.s.hex && st.s.hex.memo)) return false;
    return true;
  }

  function cast(id, arg) {
    const s = st.s.hex;
    const d = def(id);
    if (!usable(id)) return false;
    if (!pay(d.cost)) return false;

    const ok = run(id, d, arg);
    if (!ok) {
      // 施放失败（前置不满足）：退还算力，不留下痕迹
      s.he = Math.round((s.he + d.cost) * 10) / 10;
      s.spent = Math.round(Math.max(0, s.spent - d.cost) * 10) / 10;
      return false;
    }
    s.used[id] = usedOf(id) + 1;
    if (d.cd) s.cd[id] = d.cd;
    record({ age: st.s.clock.age, id: d.id, name: d.name, cost: d.cost });
    bus.emit('hex:cast', { id: d.id, name: d.name, cost: d.cost, he: s.he });
    bus.emit('ui:refresh', {});
    return true;
  }

  function run(id, d, arg) {
    const p = st.s.person;
    const s = st.s.hex;
    switch (id) {
      case 'reroll':
        if (!(Game.decisions && Game.decisions.reroll())) return false;
        st.log('🎲 命运重掷：这个岔路的路牌被你换掉了', 'warn', '🎲');
        return true;

      case 'luck':
        s.luckLeft = HEX.luck.months;
        u.setLuckMul(HEX.luck.mul);
        st.log('🍀 概率倾斜：未来 ' + HEX.luck.months + ' 个月，风似乎都顺着你吹', 'good', '🍀');
        return true;

      case 'fastforward': {
        const n = HEX.fastForwardMonths;
        const ticks = Game.loop && Game.loop.advanceMonths ? Game.loop.advanceMonths(n) : 0;
        st.log('⏩ 时序快进：' + n + ' 个月在指缝间滑过（' + ticks + ' 次推进）', 'warn', '⏩');
        return true;
      }

      case 'rewind': {
        if (!Game.save || typeof Game.save.snapshot !== 'function') return false;
        restoreMemo();
        return true;
      }

      case 'cyber':
        s.cyber = true;
        s.once.cyber = true;
        st.changeVital('immunity', +HEX.cyber.immunityUp, '海克斯·义体');
        st.log('🦾 义体改造完成：免疫力上限提升，但从此每年要付维护费', 'warn', '🦾');
        return true;

      case 'shield':
        s.shield = true;
        st.log('🛡️ 死亡豁免已就绪：下一次死亡会被那只机械手拽回来', 'good', '🛡️');
        return true;

      case 'neuro': {
        if (!Game.actions || typeof Game.actions.grantMastery !== 'function') return false;
        const list = (Game.actions.list ? Game.actions.list() : []).filter((a) => a.available);
        if (!list.length) return false;
        // 未指定则优先拉满熟练度最高的那一项
        const target = arg || list.slice().sort((a, b) => b.mastery - a.mastery)[0].id;
        const v = Game.actions.grantMastery(target, 100);
        if (!v) return false;
        st.log('🧠 神经加速：「' + target + '」的熟练度被直接写到尽头（' + v + '）', 'good', '🧠');
        return true;
      }

      case 'nocd':
        if (!Game.actions || typeof Game.actions.clearCooldown !== 'function') return false;
        Game.actions.clearCooldown();
        st.log('♾️ 无冷却：所有行动的冷却归零', 'good', '♾️');
        return true;

      default:
        return false;
    }
  }

  // 回溯：用 save 的内存版快照回到上个月初
  function restoreMemo() {
    const memo = st.s.hex.memo;
    if (!memo) return false;
    Game.save.restore(memo);
    st.log('⏪ 回溯：时间退回到上个月初，一切重来', 'warn', '⏪');
    return true;
  }

  /* ---------------------- 引擎钩子（被调用，不主动 Hook） ---------------------- */
  // lifespan.die() 前调用：true = 拦下这次死亡
  function onDeath() {
    const s = st.s.hex;
    if (!s || !s.on || !s.shield) return false;
    s.shield = false;
    st.setVital('health', HEX.shieldHealth, '海克斯·死亡豁免');
    st.log('🛡️ 本该就此收场——义体的备用心脏把你从鬼门关推了回来（健康回到 ' + HEX.shieldHealth + '）', 'good', '🛡️');
    record({ age: st.s.clock.age, id: 'shield', name: '死亡豁免触发', cost: 0 });
    bus.emit('hex:shield', { health: HEX.shieldHealth });
    return true;
  }

  // decisions 解算 risk 时的成功率倍率
  function riskBonus() {
    const s = st.s.hex;
    if (!s || !s.on || s.luckLeft <= 0) return 1;
    return HEX.luck.mul;
  }

  /* ---------------------- 结算与存档（本模块自己管） ---------------------- */
  function rebate() {
    const s = st.s.hex;
    if (!s || !s.spent) return 1;
    const r = HEX.scoreRebate;
    return u.clamp(1 - s.spent / r.per, r.min, 1);
  }

  // 面板 descriptor：UI 层照它渲染，本模块不认识 UI 细节
  function panel() {
    const s = st.s.hex;
    if (!s) return null;
    return {
      key: 'hex',
      name: '🧬 海克斯',
      note: '算力 HE ' + Math.round(s.he) + ' / ' + HEX.heMax + ' · 累计消耗 ' + Math.round(s.spent),
      rows: (HEX.powers || []).map((d) => ({
        id: d.id,
        label: d.emoji + ' ' + d.name,
        sub: d.cost + ' HE' + (d.maxUse != null ? ' · 限 ' + d.maxUse + ' 次' : '') + (d.cd ? ' · CD ' + d.cd + '月' : ''),
        ready: usable(d.id),
        tip: d.desc,
      })),
      extras: [
        { id: 'burn_health', label: '🔥 氪命 · 健康', sub: '-5 健康 → +14 HE', ready: !!s.on && st.s.person.health > HEX.burn.health.per, tip: '用寿命换力量' },
        { id: 'burn_immunity', label: '🔥 氪命 · 免疫', sub: '-5 免疫 → +10 HE', ready: !!s.on && st.s.person.immunity > HEX.burn.immunity.per, tip: '用底子换力量' },
        { id: 'burn_mood', label: '🔥 氪命 · 心情', sub: '-10 心情 → +5 HE', ready: !!s.on && st.s.person.mood > HEX.burn.mood.per, tip: '用快乐换力量' },
      ],
      // J7 余额角标：顶栏按钮显示的己方资源（UI 不懂业务，只渲染描述符）
      balance: (function () {
        let minCost = Infinity;
        for (const d of HEX.powers || []) if (d.cost < minCost) minCost = d.cost;
        if (minCost === Infinity) minCost = 1;
        return { text: 'HE ' + Math.round(s.he), ok: s.he >= minCost };
      })(),
    };
  }

  Game.hex = {
    enable() { const s = st.s.hex; if (s) s.on = true; return true; },
    disable() {
      const s = st.s.hex;
      if (s) s.on = false;
      u.setLuckMul(1);
      return true;
    },
    toggle() { return st.s.hex && st.s.hex.on ? Game.hex.disable() : Game.hex.enable(); },
    isOn() { return !!(st.s.hex && st.s.hex.on); },
    he() { return st.s.hex ? st.s.hex.he : 0; },
    spent() { return st.s.hex ? st.s.hex.spent : 0; },
    cd: cdOf,
    usable,
    cast,
    burn,
    onDeath,
    riskBonus,
    rebate,
    panel,
    castExtra(id) {
      const kind = String(id).replace('burn_', '');
      return burn(kind);
    },
    // 注意：memo / prevMemo 是回溯用的内存快照，绝不能序列化
    snapshot() {
      const s = st.s.hex;
      if (!s) return null;
      return {
        on: s.on, he: s.he, spent: s.spent, cd: s.cd, used: s.used, once: s.once,
        luckLeft: s.luckLeft, cyber: s.cyber, shield: s.shield, log: s.log,
      };
    },
    hydrate(d) {
      const base = freshState();
      st.s.hex = Object.assign(base, d || {}, { memo: null, prevMemo: null });
      if (!st.s.hex.on) u.setLuckMul(1);
    },
  };
})();
