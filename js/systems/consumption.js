/* =========================================================================
 * 系统 · 消费模式 (consumption) —— v1.5.0
 * -------------------------------------------------------------------------
 * 「钱多了，日子就该过得不一样」——把财富从账面数字变成能兑换的生活体验。
 *
 * 三块独立结构（共用同一套 tiers 财富分层门槛）：
 *   ① 耐用品 goods     一次性买入 → 持有 hold 年，期间每月给加成；到期按 residual 残值退役
 *   ② 一次性消费 treats 即时兑换 mood/health/knowledge…，不留持有物
 *   ③ 服务业订阅 services 每月扣月费、持续加成；wealth 不足以支付时自动停订
 *
 * 解锁按财富分层（tiers）：钱越多，能解锁的档次越高。
 * 状态完全活在独立的 s.consume 子树里；不引用任何其它系统（含金手指三模块），
 * 删掉本文件引擎与评分逐位不变。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const CN = C.consume;
  const u = Game.util;

  function tiers() { return (CN && CN.tiers) || []; }
  function goods() { return (CN && CN.goods) || []; }
  function treats() { return (CN && CN.treats) || []; }
  function services() { return (CN && CN.services) || []; }

  function tierOf(key) { return tiers().find((t) => t.key === key); }
  function goodDef(key) { return goods().find((g) => g.key === key); }
  function treatDef(key) { return treats().find((t) => t.key === key); }
  function serviceDef(key) { return services().find((s) => s.key === key); }

  // 消费能力口径：现金（万元）。不读 assets 系统的净资产——保持本模块对其它系统零依赖，
  // 删掉 assets.js 也能正常工作（有房的人账上现金未必多，这也更符合"手头有没有余钱"的直觉）。
  function netWorth() {
    return st.s.person.wealth || 0;
  }

  // 当前解锁到哪一档（返回档位对象）；钱越多档越高
  function currentTier() {
    const nw = netWorth();
    let cur = tiers()[0] || { key: 'modest', name: '温饱', min: 0, note: '' };
    for (const t of tiers()) if (nw >= t.min) cur = t;
    return cur;
  }
  function tierIndex(key) {
    const arr = tiers();
    for (let i = 0; i < arr.length; i++) if (arr[i].key === key) return i;
    return 0;
  }
  // 某条目是否已解锁
  function unlocked(def) {
    if (!def) return false;
    return tierIndex(def.tier) <= tierIndex(currentTier().key);
  }

  Game.systems
    .create('consume', 67)   // assets(66) 之后（净资产口径）、tycoon(68) 之前
    .on('state:reset', init)
    .on('month', onMonth)
    .on('year', onYear);

  function init() {
    st.s.consume = {
      goods: [],      // [{key, name, emoji, buyAge, buyPrice, value, expireAge}]
      services: [],   // 已订阅的 service key 列表
      spent: 0,       // 累计消费总额（万元，含耐用品/一次性/服务月费）
      buys: 0,        // 累计买入件数
      treatCount: 0,  // 累计一次性消费次数
      peakTier: 'modest', // 一生达到过的最高消费档
      subsInactive: [],   // 因欠费自动停订的服务（仅供展示）
    };
  }

  /* ------------------------------ 耐用品 ------------------------------ */
  // 买入耐用品：扣现金，进入持有列表
  function buyGood(key) {
    const d = goodDef(key);
    const p = st.s.person;
    const c = st.s.consume;
    if (!d || !c || !p.alive) return { ok: false, reason: '无此物品' };
    if (!unlocked(d)) return { ok: false, reason: '财富未达「' + (tierOf(d.tier) || {}).name + '」档' };
    if (heldGood(key)) return { ok: false, reason: '已经拥有' };
    if ((p.wealth || 0) < d.price) return { ok: false, reason: '现金不足' };

    p.wealth = Math.round((p.wealth - d.price) * 10) / 10;
    c.spent = Math.round((c.spent + d.price) * 10) / 10;
    c.buys += 1;
    const age = st.s.clock.age;
    c.goods.push({
      key: d.key, name: d.name, emoji: d.emoji,
      buyAge: age, buyPrice: d.price,
      value: Math.round(d.price * (d.residual == null ? 0.2 : d.residual) * 10) / 10,
      expireAge: age + (d.hold || 5),
    });
    st.log('🛍️ 你买下「' + d.emoji + ' ' + d.name + '」（' + d.price + ' 万）——' + d.note, 'good', '🛍️');
    bus.emit('consume:buy', { kind: 'good', key: d.key });
    refreshTier();
    return { ok: true };
  }

  function heldGood(key) {
    const c = st.s.consume;
    if (!c) return null;
    return c.goods.find((g) => g.key === key) || null;
  }

  // 卖出耐用品：按当前残值回血，扣手续费
  function sellGood(key) {
    const c = st.s.consume;
    const p = st.s.person;
    if (!c) return { ok: false, reason: '无此物品' };
    const i = c.goods.findIndex((g) => g.key === key);
    if (i < 0) return { ok: false, reason: '未曾拥有' };
    const item = c.goods[i];
    const fee = CN.sellFee || 0;
    const gain = Math.round(item.value * (1 - fee) * 10) / 10;
    p.wealth = Math.round((p.wealth + gain) * 10) / 10;
    c.goods.splice(i, 1);
    st.log('💱 你转手了「' + item.emoji + ' ' + item.name + '」，收回 ' + gain + ' 万。', 'info', '💱');
    bus.emit('consume:sell', { kind: 'good', key: key, gain: gain });
    return { ok: true, gain: gain };
  }

  /* ---------------------------- 一次性消费 ---------------------------- */
  function useTreat(key) {
    const d = treatDef(key);
    const p = st.s.person;
    const c = st.s.consume;
    if (!d || !c || !p.alive) return { ok: false, reason: '无此消费' };
    if (!unlocked(d)) return { ok: false, reason: '财富未达「' + (tierOf(d.tier) || {}).name + '」档' };
    if ((p.wealth || 0) < d.cost) return { ok: false, reason: '现金不足' };

    p.wealth = Math.round((p.wealth - d.cost) * 10) / 10;
    c.spent = Math.round((c.spent + d.cost) * 10) / 10;
    c.treatCount += 1;
    st.applyEffects(Object.assign({}, d.effects, { source: '消费·' + d.name }));
    st.log('✨ 「' + d.emoji + ' ' + d.name + '」' + (d.note || ''), 'good', '✨');
    bus.emit('consume:treat', { key: d.key });
    refreshTier();
    return { ok: true };
  }

  /* ---------------------------- 服务业订阅 ---------------------------- */
  function subscribe(key) {
    const d = serviceDef(key);
    const p = st.s.person;
    const c = st.s.consume;
    if (!d || !c || !p.alive) return { ok: false, reason: '无此服务' };
    if (!unlocked(d)) return { ok: false, reason: '财富未达「' + (tierOf(d.tier) || {}).name + '」档' };
    if (c.services.indexOf(key) >= 0) return { ok: false, reason: '已订阅' };
    if ((p.wealth || 0) < d.fee) return { ok: false, reason: '现金不足首月费用' };

    c.services.push(key);
    c.subsInactive = c.subsInactive.filter((k) => k !== key);
    st.log('📞 你订阅了「' + d.emoji + ' ' + d.name + '」，每月 ' + d.fee + ' 万。', 'info', '📞');
    bus.emit('consume:subscribe', { key: key });
    refreshTier();
    return { ok: true };
  }

  function unsubscribe(key) {
    const c = st.s.consume;
    if (!c) return { ok: false, reason: '无此服务' };
    const i = c.services.indexOf(key);
    if (i < 0) return { ok: false, reason: '未订阅' };
    c.services.splice(i, 1);
    const d = serviceDef(key);
    st.log('📴 你停订了「' + (d ? d.emoji + ' ' + d.name : key) + '」。', 'info', '📴');
    bus.emit('consume:unsubscribe', { key: key });
    return { ok: true };
  }

  /* ------------------------------ 时间推进 ------------------------------ */
  function onMonth() {
    const p = st.s.person;
    const c = st.s.consume;
    if (!c || !p || !p.alive) return;

    // ① 耐用品：持有期内每月给加成
    for (const item of c.goods) {
      const d = goodDef(item.key);
      if (!d) continue;
      if (d.monthly) {
        st.applyEffects(Object.assign({}, d.monthly, { source: '消费·' + d.name }));
      }
    }

    // ② 服务业订阅：每月扣月费 + 持续加成；付不起则自动停订
    if (c.services.length) {
      const keep = [];
      for (const key of c.services) {
        const d = serviceDef(key);
        if (!d) continue;
        const fee = d.fee || 0;
        if ((p.wealth || 0) < fee) {
          // 欠费自动停订（不产生负债，只是断供）
          c.subsInactive = c.subsInactive || [];
          if (c.subsInactive.indexOf(key) < 0) c.subsInactive.push(key);
          st.log('⚠️ 手头吃紧，你停掉了「' + d.emoji + ' ' + d.name + '」的订阅。', 'warn', '⚠️');
          bus.emit('consume:subscribe_lapsed', { key: key });
          continue; // 不再续订
        }
        p.wealth = Math.round((p.wealth - fee) * 10) / 10;
        c.spent = Math.round((c.spent + fee) * 10) / 10;
        if (d.monthly) st.applyEffects(Object.assign({}, d.monthly, { source: '服务·' + d.name }));
        keep.push(key);
      }
      c.services = keep;
    }
  }

  function onYear() {
    const c = st.s.consume;
    const p = st.s.person;
    if (!c || !p || !p.alive) return;
    const age = st.s.clock.age;

    // 耐用品：年度一次性加成 + 折旧估值 + 到退役
    const keep = [];
    for (const item of c.goods) {
      const d = goodDef(item.key);
      if (!d) continue;
      // 持有期满 → 退役（残值回收进现金，视作二手变卖）
      if (age >= item.expireAge) {
        if (item.value > 0) {
          p.wealth = Math.round((p.wealth + item.value) * 10) / 10;
          st.log('📦 「' + item.emoji + ' ' + item.name + '」用旧了，你折价处理，收回 ' + item.value + ' 万。', 'info', '📦');
        } else {
          st.log('📦 「' + item.emoji + ' ' + item.name + '」寿终正寝。', 'info', '📦');
        }
        bus.emit('consume:retire', { key: item.key });
        continue;
      }
      if (d.yearly) st.applyEffects(Object.assign({}, d.yearly, { source: '消费·' + d.name }));
      // 逐年折旧到残值底线（奢侈品保值，消费品掉得快）
      const floor = item.buyPrice * ((d.residual == null ? 0.2 : d.residual) * 0.5);
      item.value = Math.max(floor, Math.round(item.value * 0.9 * 10) / 10);
      keep.push(item);
    }
    c.goods = keep;

    refreshTier();
  }

  // 记录一生达到过的最高消费档
  function refreshTier() {
    const c = st.s.consume;
    if (!c) return;
    const cur = currentTier().key;
    if (tierIndex(cur) > tierIndex(c.peakTier)) c.peakTier = cur;
  }

  /* ------------------------------ 只读视图 ------------------------------ */
  function state() {
    const c = st.s.consume;
    const p = st.s.person;
    if (!c) return null;
    const cur = currentTier();
    return {
      tier: cur.key,
      tierName: cur.name,
      tierNote: cur.note,
      netWorth: Math.round(netWorth() * 10) / 10,
      age: st.s.clock.age,
      canConsume: st.s.clock.age >= 18,
      // 三块内容，各带 unlocked 标记供 UI 灰显
      goods: goods().map((d) => Object.assign({}, d, {
        unlocked: unlocked(d),
        held: !!heldGood(d.key),
        tierName: (tierOf(d.tier) || {}).name,
        afford: (p.wealth || 0) >= d.price,
      })),
      treats: treats().map((d) => Object.assign({}, d, {
        unlocked: unlocked(d),
        tierName: (tierOf(d.tier) || {}).name,
        afford: (p.wealth || 0) >= d.cost,
      })),
      services: services().map((d) => Object.assign({}, d, {
        unlocked: unlocked(d),
        subscribed: c.services.indexOf(d.key) >= 0,
        lapsed: (c.subsInactive || []).indexOf(d.key) >= 0,
        tierName: (tierOf(d.tier) || {}).name,
      })),
      owned: c.goods.slice(),
      subscribed: c.services.slice(),
      spent: c.spent,
      buys: c.buys,
      treatCount: c.treatCount,
      peakTier: c.peakTier,
      peakTierName: (tierOf(c.peakTier) || {}).name,
    };
  }

  // 给结算/成就用的摘要
  function summary() {
    const c = st.s.consume;
    if (!c) return { spent: 0, buys: 0, treatCount: 0, peakTier: 'modest' };
    return {
      spent: c.spent,
      buys: c.buys,
      treatCount: c.treatCount,
      peakTier: c.peakTier,
      highSpender: c.spent >= (CN.highSpendMark || 200),
    };
  }

  function unlockedCount() {
    const s = state();
    if (!s) return 0;
    return s.goods.filter((g) => g.unlocked).length
      + s.treats.filter((t) => t.unlocked).length
      + s.services.filter((v) => v.unlocked).length;
  }

  /* ------------------------------ 存档 ------------------------------ */
  function snapshot() {
    const c = st.s.consume;
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }
  function hydrate(m) {
    if (m && typeof m === 'object') {
      st.s.consume = {
        goods: m.goods || [],
        services: m.services || [],
        spent: m.spent || 0,
        buys: m.buys || 0,
        treatCount: m.treatCount || 0,
        peakTier: m.peakTier || 'modest',
        subsInactive: m.subsInactive || [],
      };
    } else {
      init();
    }
  }

  Game.consume = {
    buyGood, sellGood, useTreat, subscribe, unsubscribe,
    heldGood, tierOf, currentTier, unlocked, netWorth,
    state, summary, unlockedCount,
    snapshot, hydrate,
  };
})();
