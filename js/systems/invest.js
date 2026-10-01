/* =========================================================================
 * 系统 · 金融投资 (invest)
 * -------------------------------------------------------------------------
 * 一个随年演化的市场 + 人物持仓。行情按随机游走推进（含崩盘风险，难度剧本
 * 用 investDrift/investCrash 调节）。玩家通过"行动栏"的买入/卖出，按现价真实
 * 结算盈亏（盈亏改写现金 wealth，并冲击心情/压力/创伤）。与因果系统联动：
 * 先"入市"埋下 investor 种子，才解锁交易与本链的牛熊/币圈时代事件。
 *
 * 资产/价格存于 st.s.market 与 person.invest（可随存档序列化）。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const IV = C.invest;
  const ASSETS = IV.assets;

  Game.systems
    .create('invest', 61)
    .on('state:reset', init)
    .on('year', stepMarket);

  function init() {
    st.s.market = {};
    for (const k in ASSETS) st.s.market[k] = ASSETS[k].start;
    const p = st.s.person;
    const holdings = {};
    for (const k in ASSETS) holdings[k] = { units: 0, cost: 0 };
    p.invest = { opened: false, openedMarkets: { stock: false, crypto: false }, holdings, trades: 0, realized: 0, peakNet: p.wealth || 0 };
  }

  function price(k) { return st.s.market[k]; }

  function stepMarket() {
    const sc = Game.scenario.cur();
    const dMul = sc.investDrift == null ? 1 : sc.investDrift;
    const cMul = sc.investCrash == null ? 1 : sc.investCrash;
    for (const k in ASSETS) {
      const a = ASSETS[k];
      let r;
      if (u.chance(a.crashChance * cMul)) {
        r = -a.crashDip * u.range(0.6, 1.0); // 崩盘：断崖式下跌
      } else {
        r = u.gauss(a.drift * dMul, a.vol);
      }
      st.s.market[k] = Math.max(1, +(st.s.market[k] * (1 + r)).toFixed(2));
    }
    const p = st.s.person;
    if (p.invest) p.invest.peakNet = Math.max(p.invest.peakNet || 0, netWorth());
  }

  function marketValue() {
    const h = st.s.person.invest.holdings;
    let v = 0;
    for (const k in h) v += h[k].units * price(k);
    return v;
  }
  function netWorth() {
    return (st.s.person.wealth || 0) + marketValue();
  }

  /* --------------------- 买入 / 卖出（供行动栏调用） --------------------- */
  function buy(k, frac) {
    const p = st.s.person;
    const avail = p.wealth || 0;
    let amt = Math.round(avail * frac * 10) / 10;
    if (amt < IV.minBuy || avail < IV.minBuy) return null;
    const units = amt / price(k);
    const h = p.invest.holdings[k];
    h.units = +(h.units + units).toFixed(4);
    h.cost = Math.round((h.cost + amt) * 10) / 10;
    p.wealth = Math.round((avail - amt) * 10) / 10;
    p.invest.opened = true;
    p.invest.trades += 1;
    if (!Game.consequences.has('investor')) Game.consequences.plant('investor');
    st.log(ASSETS[k].emoji + ' 以 ' + price(k).toFixed(1) + ' 价买入' + ASSETS[k].name + '，投入 ' + amt + ' 万元', 'info', ASSETS[k].emoji);
    return {}; // 现金/持仓已在函数内结算，返回空心理效果
  }

  function sell(k) {
    const p = st.s.person;
    const h = p.invest.holdings[k];
    if (h.units <= 0) return null;
    const val = Math.round(h.units * price(k) * 10) / 10;
    const pnl = Math.round((val - h.cost) * 10) / 10;
    const win = pnl >= 0;
    p.wealth = Math.round((p.wealth + val) * 10) / 10;
    h.units = 0;
    h.cost = 0;
    p.invest.trades += 1;
    p.invest.realized = Math.round(((p.invest.realized || 0) + pnl) * 10) / 10;
    const lossPct = h.cost > 0 ? -pnl / h.cost : 0;
    st.log(
      (win ? '🎉 ' : '💥 ') + '清仓' + ASSETS[k].name + '，收回 ' + val + ' 万元，' + (win ? '盈利 ' : '亏损 ') + Math.abs(pnl).toFixed(1) + ' 万',
      win ? 'good' : 'danger', ASSETS[k].emoji
    );
    const eff = { mood: win ? IV.winMood : IV.lossMood, source: '投资·' + ASSETS[k].name };
    if (win) { eff.stress = -2; }
    else {
      eff.stress = 6; eff.depression = pnl < -30 ? 8 : 4;
      if (pnl < -50) eff.trauma = 6; // 巨亏留下心理阴影
    }
    return eff;
  }

  /* --------------------- 开户（v1.7.1：按市场自选） --------------------- */
  // 某市场是否已开户。旧存档没有 openedMarkets 字段：只要入过市
  // （traded 过或带 investor 旗标），视为两市场都已开通，行为不回退。
  function isOpen(k) {
    const p = st.s.person;
    if (!p.invest) return false;
    if (!p.invest.openedMarkets) {
      const wasIn = !!p.invest.opened || !!(p.flags && p.flags.investor);
      p.invest.openedMarkets = { stock: wasIn, crypto: wasIn };
    }
    return !!p.invest.openedMarkets[k];
  }

  // 开通市场账户（'stock' | 'crypto' | 'both'）。幂等：已开户的不再重复记。
  // 开户即视为"入过市"——补种 investor 种子，牛熊/币圈事件链照常串联。
  function openMarket(k) {
    const p = st.s.person;
    if (!p.invest || !p.alive) return false;
    const keys = k === 'both' ? Object.keys(ASSETS) : [k];
    let changed = false;
    for (const key of keys) {
      if (!ASSETS[key]) continue;
      if (isOpen(key)) continue;
      if (!p.invest.openedMarkets) p.invest.openedMarkets = {}; // isOpen 已兜底，这里只为类型完整
      p.invest.openedMarkets[key] = true;
      changed = true;
      st.log('🧾 你开通了' + ASSETS[key].name + '账户，可以开始交易了。', 'good', ASSETS[key].emoji);
      bus.emit('invest:open', { key: key, name: ASSETS[key].name });
    }
    if (changed && !Game.consequences.has('investor')) Game.consequences.plant('investor');
    return changed;
  }

  Game.invest = {
    price,
    netWorth,
    marketValue,
    buy,
    sell,
    openMarket,
    holdings: () => st.s.person.invest.holdings,
    canTrade(k) {
      const p = st.s.person;
      return !!(p.invest && p.alive && st.s.clock.age >= IV.minAge && p.wealth >= IV.minBuy && isOpen(k));
    },
    isOpen(k) { return isOpen(k); },
    has(k) {
      const p = st.s.person;
      return p.invest && p.invest.holdings[k].units > 0;
    },
    assets: () => ASSETS,
    snapshot() {
      const p = st.s.person;
      const out = [];
      for (const k in ASSETS) {
        const h = p.invest.holdings[k];
        // 未开户且无持仓的市场不进面板（开了哪个户，才看到哪个市场）
        if (!isOpen(k) && h.units <= 0) continue;
        const mv = h.units * price(k);
        out.push({ key: k, name: ASSETS[k].name, emoji: ASSETS[k].emoji, price: price(k), units: h.units, value: mv, cost: h.cost, pnl: mv - h.cost });
      }
      return out;
    },
  };
})();
