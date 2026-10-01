/* =========================================================================
 * 系统 · 💰 神壕 (tycoon) —— 财富类外挂
 * -------------------------------------------------------------------------
 * 不引入任何新货币：**钱本身就是它的资源**。为防止无限刷，用
 * ① 月额度（随净资产提升）② 冷却 ③ 钞能力兑换边际递减 三重约束；
 * 越过阈值还会触发"树大招风"延时反噬，由既有 consequences 系统兑现。
 *
 * 独立性约定：与 🧬海克斯、📊人数数据化 **没有任何关系**——不读它们的
 * state、不订阅它们的事件、不共享资源。删掉本文件，引擎行为完全不变。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const T = C.tycoon;

  function freshState() {
    return {
      on: T.enabled === true,
      injected: 0,        // 累计注入金额
      quota: 0,           // 本月额度（每月重算）
      quotaUsed: 0,
      cd: {},             // 条目级冷却（月）
      times: {},          // 本月各条目使用次数（用于边际递减）
      backlashDone: false,
      log: [],
    };
  }

  Game.systems
    .create('tycoon', 68)
    .on('state:reset', function () {
      st.s.tycoon = freshState();
    })
    .on('month', onMonth);

  function defConvert(id) {
    return (T.convert || []).find((x) => x.id === id);
  }
  function timesOf(id) {
    const s = st.s.tycoon;
    return (s && s.times && s.times[id]) || 0;
  }
  function cdOf(id) {
    const s = st.s.tycoon;
    return (s && s.cd && s.cd[id]) || 0;
  }
  function netWorth() {
    // 优先复用资产系统的口径：现金 + 资产现价 − 剩余按揭
    if (Game.assets && typeof Game.assets.netWorth === 'function') return Game.assets.netWorth();
    const p = st.s.person;
    return Math.round((p.wealth || 0) * 10) / 10;
  }
  // 当前剩余负债（按揭贷款）
  function debtLeft() {
    if (Game.assets && typeof Game.assets.mortgageInfo === 'function') {
      const m = Game.assets.mortgageInfo();
      return Math.max(0, (m && m.left) || 0);
    }
    const p = st.s.person;
    return Math.max(0, (p.assets && p.assets.mortgage) || 0);
  }
  function quotaTotal() {
    let q = T.quota.base;
    const net = netWorth();
    for (const row of T.quota.byWealth) if (net >= row.net) q += row.add;
    return q;
  }
  function remaining() {
    const s = st.s.tycoon;
    return Math.max(0, quotaTotal() - (s ? s.quotaUsed : 0));
  }
  function record(row) {
    const s = st.s.tycoon;
    s.log.push(row);
    if (s.log.length > 40) s.log.splice(0, s.log.length - 40);
  }
  function markUsed() {
    const p = st.s.person;
    p.flags = p.flags || {};
    p.flags.used_tycoon = true;
  }
  function addWealth(n, source) {
    st.applyEffects({ wealth: Math.round(n * 10) / 10, source: source });
  }

  function onMonth() {
    const s = st.s.tycoon;
    if (!s) return;
    for (const k in s.cd) if (s.cd[k] > 0) s.cd[k] -= 1;
    s.quotaUsed = 0;
    s.times = {};
    s.quota = quotaTotal();
  }

  /* ------------------------------ 提款 ------------------------------ */
  function withdrawAmount() {
    const w = T.withdraw;
    const years = st.s.clock.year - w.refYear;
    return Math.round(w.base * Math.pow(w.perYear, years) * 10) / 10;
  }
  function usable(id) {
    const s = st.s.tycoon;
    if (!s || !s.on || !st.s.person.alive) return false;
    if (id === 'withdraw') return remaining() > 0 && cdOf('withdraw') <= 0;
    if (id === 'clear_debt') return remaining() > 0 && debtLeft() > 0;
    const d = defConvert(id);
    if (!d) return false;
    return remaining() > 0 && (st.s.person.wealth || 0) >= d.cost;
  }

  function withdraw() {
    const s = st.s.tycoon;
    if (!usable('withdraw')) return false;
    const amount = withdrawAmount();
    addWealth(amount, '神壕·提款');
    s.injected = Math.round((s.injected + amount) * 10) / 10;
    s.quotaUsed += 1;
    s.cd.withdraw = T.withdraw.cdMonth;
    markUsed();
    st.log('💰 神壕系统到账 ' + amount + ' 万元（本月额度剩 ' + remaining() + ' 次）', 'good', '💰');
    record({ age: st.s.clock.age, id: 'withdraw', name: '提款', amount: amount });
    maybeBacklash();
    bus.emit('tycoon:cast', { id: 'withdraw', amount: amount });
    bus.emit('ui:refresh', {});
    return true;
  }

  /* --------------------------- 钞能力兑换 --------------------------- */
  function convert(id) {
    const d = defConvert(id);
    const s = st.s.tycoon;
    if (!d || !usable(id)) return false;
    const n = timesOf(id);
    const factor = Math.pow(d.decay || 1, n); // 本月第 n 次：效果递减
    const eff = {};
    for (const k in d.effects) {
      if (k === 'flags') continue;
      eff[k] = Math.round(d.effects[k] * factor * 10) / 10;
    }
    if (!Object.keys(eff).length) return false;
    addWealth(-d.cost, '神壕·消费');
    st.applyEffects(Object.assign({}, eff, { source: '神壕·' + d.name }));
    s.times[id] = n + 1;
    s.quotaUsed += 1;
    markUsed();
    if (d.cost >= T.driftMinWealthCost) {
      st.applyEffects({ pers: T.persDrift, source: '神壕·性情变化' });
    }
    st.log(d.emoji + ' ' + d.name + '：花掉 ' + d.cost + ' 万' + (n ? '（本月第 ' + (n + 1) + ' 次，效果打 ' + Math.round(factor * 100) + '%）' : ''), 'info', d.emoji);
    record({ age: st.s.clock.age, id: d.id, name: d.name, cost: d.cost });
    maybeBacklash();
    bus.emit('tycoon:cast', { id: d.id, cost: d.cost, effect: eff });
    return true;
  }

  /* ------------------------------ 清债 ------------------------------ */
  function clearDebt() {
    const s = st.s.tycoon;
    const p = st.s.person;
    if (!usable('clear_debt')) return false;
    const debt = debtLeft();
    if (debt <= 0) return false;
    const fee = Math.round(debt * T.clearDebt.feeRatio * 100) / 100;
    if ((p.wealth || 0) < fee) return false;
    if (!Game.assets || typeof Game.assets.clearMortgage !== 'function') return false;
    addWealth(-fee, '神壕·清债手续费');
    const res = Game.assets.clearMortgage();
    if (!res || !res.ok) {
      addWealth(fee, '神壕·清债回滚'); // 兑换失败：钱原路退回
      return false;
    }
    st.applyEffects({ mood: 6, stress: -5, source: '神壕·清债' });
    s.quotaUsed += 1;
    markUsed();
    st.log('🧾 神壕出手：剩余房贷 ' + debt + ' 万一笔勾销（手续费 ' + fee + ' 万）', 'good', '🧾');
    record({ age: st.s.clock.age, id: 'clear_debt', name: '清债', cost: fee });
    bus.emit('tycoon:cast', { id: 'clear_debt', fee: fee });
    return true;
  }

  /* --------------------------- 树大招风（反噬） --------------------------- */
  function maybeBacklash() {
    const s = st.s.tycoon;
    const b = T.backlash;
    if (!Game.consequences || !b) return;
    if (s.backlashDone && b.once) return;
    if (netWorth() < b.threshold) return;
    if (!u.chance(b.chance)) return;
    s.backlashDone = true;
    const delay = u.randInt(b.delay[0], b.delay[1]);
    Game.consequences.schedule(delay, {
      effects: b.effects,
      log: b.log,
      logLevel: 'danger',
    });
    bus.emit('tycoon:backlash', { delay: delay });
  }

  /* ---------------------- 结算与存档（本模块自己管） ---------------------- */
  function rebate() {
    const s = st.s.tycoon;
    if (!s || !s.injected) return 1;
    const r = T.scoreRebate;
    return u.clamp(1 - s.injected / r.per, r.min, 1);
  }

  function panel() {
    const s = st.s.tycoon;
    if (!s) return null;
    const rows = [
      { id: 'withdraw', label: '💰 提款', sub: withdrawAmount() + ' 万 · CD ' + T.withdraw.cdMonth + '月', ready: usable('withdraw'), tip: '金额随真实年份放大' },
      { id: 'clear_debt', label: '🧾 清空负债', sub: '剩余 ' + debtLeft() + ' 万 · ' + T.clearDebt.note, ready: usable('clear_debt'), tip: '一次性还清剩余房贷' },
    ];
    for (const d of T.convert || []) {
      rows.push({
        id: d.id,
        label: d.emoji + ' ' + d.name,
        sub: d.cost + ' 万 · 本月已用 ' + timesOf(d.id) + ' 次',
        ready: usable(d.id),
        tip: d.cost >= T.driftMinWealthCost ? '大额消费：带来心情，也磨掉一点自律' : '钱能买到的东西',
      });
    }
    return {
      key: 'tycoon',
      name: '💰 神壕',
      note: '本月额度 ' + remaining() + ' / ' + quotaTotal() + ' · 累计注入 ' + Math.round(s.injected) + ' 万',
      rows: rows,
      extras: [],
      // J7 余额角标：本月剩余额度（花光置灰）
      balance: { text: '额度 ' + remaining(), ok: remaining() >= 1 },
    };
  }

  Game.tycoon = {
    enable() { const s = st.s.tycoon; if (s) s.on = true; return true; },
    disable() { const s = st.s.tycoon; if (s) s.on = false; return true; },
    toggle() { return st.s.tycoon && st.s.tycoon.on ? Game.tycoon.disable() : Game.tycoon.enable(); },
    isOn() { return !!(st.s.tycoon && st.s.tycoon.on); },
    injected() { return st.s.tycoon ? st.s.tycoon.injected : 0; },
    quota: remaining,
    usable,
    withdraw,
    convert,
    clearDebt,
    rebate,
    panel,
    cast(id) {
      if (id === 'withdraw') return withdraw();
      if (id === 'clear_debt') return clearDebt();
      return convert(id);
    },
    snapshot() {
      const s = st.s.tycoon;
      if (!s) return null;
      return { on: s.on, injected: s.injected, cd: s.cd, backlashDone: s.backlashDone, log: s.log };
    },
    hydrate(d) {
      st.s.tycoon = Object.assign(freshState(), d || {});
    },
  };
})();
