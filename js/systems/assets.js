/* =========================================================================
 * 系统 · 资产（房产 / 车辆）(assets) —— priority 66
 * -------------------------------------------------------------------------
 * Phase 2 唯一缺失的核心环节（路线图 B6）。把"买房/买车"从一句 flags 变成
 * 真实的资产负债：
 *   购入：现金付首付（house 30% / car 20%），余款转为按揭贷款（等额本息月供）
 *   持有：每年扣月供（利息 + 本金）、按现价扣维护费（通胀后现价上涨）
 *   估值：房价随指数（通胀 + 漂移）浮动，车辆逐年折旧
 *   卖出：45 岁后的卖出决策；卖房所得先还清贷款，剩余才进现金
 *   净资产：现金 + 资产现价 − 剩余贷款（并入人生评分的"财富峰值"）
 * 所有数值口径在 js/config.js 的 assets 节；本系统只负责逻辑。
 * 事件：asset:change（HUD 刷新）/ asset:bought / asset:sold
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const A = C.assets;

  Game.systems
    .create('assets', 66)
    .on('state:reset', init)
    .on('year', yearly);

  function r1(v) { return Math.round(v * 10) / 10; }
  function r2(v) { return Math.round(v * 100) / 100; }

  function ensure() {
    const p = st.s.person;
    if (!p.assets) {
      p.assets = {
        houses: [], cars: [],
        mortgage: 0, installment: 0,
        principalPaid: 0, interestPaid: 0, upkeepPaid: 0, downPaid: 0,
        spent: 0, realized: 0, interestIncome: 0,
        buys: 0, sells: 0,
        peakValue: 0, peakNet: p.wealth || 0,
        priceIndex: A.priceIndex.start,
        cleared: false,
      };
    }
    return p.assets;
  }

  function init() {
    const p = st.s.person;
    p.assets = {
      houses: [], cars: [],
      mortgage: 0, installment: 0,
      principalPaid: 0, interestPaid: 0, upkeepPaid: 0, downPaid: 0,
      spent: 0, realized: 0, interestIncome: 0,
      buys: 0, sells: 0,
      peakValue: 0, peakNet: p.wealth || 0,
      priceIndex: A.priceIndex.start,
      cleared: false,
    };
    p.flags = p.flags || {};
    bus.emit('asset:change', {});
  }

  /* ------------------------------ 基础工具 ------------------------------ */
  function defs(kind) { return kind === 'car' ? A.cars : A.houses; }
  function def(kind, key) { return defs(kind).filter((d) => d.key === key)[0] || null; }
  function owned(kind) {
    const a = ensure();
    return kind === 'car' ? a.cars : a.houses;
  }
  function list(kind, key) { return owned(kind).filter((it) => !key || it.key === key); }
  function has(kind, key) { return list(kind, key).length > 0; }

  function priceOf(kind, key) {
    const d = def(kind, key);
    if (!d) return 0;
    return r1(d.price * ensure().priceIndex);
  }

  function monthlyIncome() {
    const c = st.s.person.career;
    return c && c.income ? c.income / 12 : 0;
  }

  // 等额本息月供
  function installmentOf(loan, years) {
    const n = Math.max(1, Math.round(years * 12));
    if (loan <= 0) return 0;
    const r = A.mortgageRate / 12;
    const m = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
    return r2(m);
  }

  /* ------------------------------ 购置方案 ------------------------------ */
  // 返回一份"买得起吗"的完整方案（供抉择事件展示与门槛判断）
  function plan(kind, key) {
    const d = def(kind, key);
    if (!d) return null;
    const a = ensure();
    const p = st.s.person;
    const price = priceOf(kind, key);
    const downRatio = kind === 'car' ? A.downRatio.car : A.downRatio.house;
    const down = r1(price * downRatio);
    const loan = r1(price - down);
    const years = kind === 'car' ? A.loanYears.car : (d.years || A.loanYears.house);
    const monthly = installmentOf(loan, years);
    const limit = kind === 'car' ? A.carLimit : A.houseLimit;
    const hold = (kind === 'car' ? a.cars : a.houses).length;
    const income = monthlyIncome();
    const maxMonthly = income * A.maxDebtRatio;
    const reasons = [];
    if (hold >= limit) reasons.push('名下已有 ' + hold + ' ' + (kind === 'car' ? '辆车' : '套房') + '，暂不重复购置');
    if ((p.wealth || 0) < down) reasons.push('首付需 ' + down + ' 万，手头现金仅 ' + r1(p.wealth || 0) + ' 万');
    if (monthly > maxMonthly) reasons.push('月供 ' + monthly.toFixed(2) + ' 万已超过月收入（' + r1(income) + ' 万）的 ' + Math.round(A.maxDebtRatio * 100) + '%');
    return {
      kind, key, def: d, price, down, loan, years, monthly,
      upkeepYear: r1(price * A.upkeepRate), own: hold, ok: reasons.length === 0, reasons,
    };
  }

  function check(kind, key) { return plan(kind, key); }
  function canBuy(kind, key) { const pl = plan(kind, key); return !!(pl && pl.ok); }

  /* -------------------------------- 买入 -------------------------------- */
  function buy(kind, key, opt) {
    opt = opt || {};
    const p = st.s.person;
    const a = ensure();
    const pl = plan(kind, key);
    if (!pl) return { ok: false, reason: '未知资产：' + kind + ':' + key };
    if (!pl.ok && !opt.force) return { ok: false, reason: pl.reasons.join('；'), plan: pl };

    p.wealth = r1((p.wealth || 0) - pl.down);
    a.downPaid = r1(a.downPaid + pl.down);
    a.spent = r1(a.spent + pl.price);
    a.buys += 1;
    let monthly = 0;
    if (pl.loan > 0) {
      a.mortgage = r1(a.mortgage + pl.loan);
      monthly = pl.monthly;
      a.installment = r2(a.installment + monthly);
    }
    const item = {
      kind, key, name: pl.def.name, emoji: pl.def.emoji,
      buyPrice: pl.price, buyAge: st.s.clock.age, years: 0,
      value: pl.price, monthly, loanYears: pl.years,
      downPaid: kind === 'car' ? pl.price : pl.down,
    };
    owned(kind).push(item);
    if (kind === 'house') p.flags.homeowner = true;
    if (pl.loan > 0) p.flags.leveraged = true;

    st.applyEffects({ mood: pl.def.mood || 0, source: '资产·购置' });
    st.log(
      (kind === 'car' ? '🚗' : '🏠') + ' 你买下了 ' + pl.def.emoji + ' ' + pl.def.name +
      '（' + pl.price + ' 万，首付 ' + pl.down + ' 万' +
      (pl.loan > 0 ? '，按揭 ' + pl.loan + ' 万 · 月供 ' + monthly.toFixed(2) + ' 万' : '，一次付清') + '）',
      'good', pl.def.emoji
    );
    bus.emit('asset:bought', { kind, item, plan: pl });
    bus.emit('asset:change', {});
    return { ok: true, plan: pl, item };
  }

  /* -------------------------------- 卖出 -------------------------------- */
  function sell(kind, index, opt) {
    opt = opt || {};
    const p = st.s.person;
    const a = ensure();
    const arr = owned(kind);
    const i = index == null ? arr.length - 1 : index;
    const item = arr[i];
    if (!item) return { ok: false, reason: '名下没有可卖出的' + (kind === 'car' ? '车辆' : '房产') };

    const fee = r1(item.value * A.sellFee);
    const gross = r1(item.value - fee);
    // 卖房所得优先偿还剩余贷款
    let payoff = 0;
    if (kind === 'house' && a.mortgage > 0) {
      payoff = r1(Math.min(a.mortgage, gross));
      a.mortgage = r1(a.mortgage - payoff);
      if (a.mortgage <= 0.05) {
        a.mortgage = 0;
        a.installment = 0;
      } else {
        // 剩余贷款重算月供（按剩余本金/剩余年限粗算）
        a.installment = installmentOf(a.mortgage, Math.max(1, item.loanYears - item.years));
      }
    }
    const cashIn = r1(gross - payoff);
    p.wealth = r1((p.wealth || 0) + cashIn);
    const cost = item.downPaid == null ? item.buyPrice : item.downPaid;
    const gain = r1(cashIn - cost);
    a.realized = r1(a.realized + gain);
    a.sells += 1;
    arr.splice(i, 1);

    // 卖房（且名下再无房产）会失去"家"的归属感；资金紧张时卖车则是解脱
    let mood = kind === 'car' ? -2 : -5;
    if (opt.relief || (p.wealth < 0)) mood = kind === 'car' ? 2 : 0;
    st.applyEffects({ mood, source: '资产·处置' });
    // 注：flags.homeowner 采用"曾经拥有"语义（与既有成就口径一致），卖出后不回收；
    //     卖出最后一套房另记 sold_house，供 HUD 区分"已售出"状态。
    if (kind === 'house' && a.houses.length === 0) p.flags.sold_house = true;

    st.log(
      '💸 你卖掉了 ' + item.emoji + ' ' + item.name + '：成交 ' + r1(item.value) + ' 万，扣税费 ' + fee + ' 万' +
      (payoff ? '，还贷 ' + payoff + ' 万' : '') + '，到手 ' + cashIn + ' 万（较投入' + (gain >= 0 ? '赚 ' : '亏 ') + Math.abs(gain) + ' 万）',
      gain >= 0 ? 'info' : 'warn', '💸'
    );
    bus.emit('asset:sold', { kind, item, cashIn, gain, payoff });
    bus.emit('asset:change', {});
    return { ok: true, item, cashIn, gain, payoff };
  }

  /* ------------------------------- 估值口径 ------------------------------- */
  function valueOf(it) { return it.value || 0; }
  function totalValue() {
    const a = ensure();
    return r1(a.houses.concat(a.cars).reduce((s, it) => s + valueOf(it), 0));
  }
  function netWorth() {
    const p = st.s.person;
    const a = ensure();
    return r1((p.wealth || 0) + totalValue() - a.mortgage);
  }
  function summary() {
    const a = ensure();
    return {
      houses: a.houses, cars: a.cars,
      mortgage: a.mortgage, installment: a.installment,
      value: totalValue(), net: netWorth(),
      realized: a.realized, upkeepPaid: a.upkeepPaid, interestPaid: a.interestPaid,
      principalPaid: a.principalPaid, priceIndex: a.priceIndex,
      peakValue: a.peakValue, peakNet: a.peakNet, count: a.houses.length + a.cars.length,
    };
  }

  // 一次性结清剩余按揭（供外部系统如"💰神壕"调用；本身不产生心情/日志，
  // 由调用方决定怎么记账，避免资产系统被外挂逻辑污染）
  function clearMortgage() {
    const a = ensure();
    const p = st.s.person;
    const left = a.mortgage;
    if (!(left > 0)) return { ok: false, left: 0 };
    a.mortgage = 0;
    a.installment = 0;
    a.principalPaid = r1(a.principalPaid + left);
    a.cleared = true;
    p.flags = p.flags || {};
    p.flags.debt_free = true;
    bus.emit('asset:change', {});
    return { ok: true, left: left };
  }

  /* -------------------------------- 年度结算 -------------------------------- */
  function yearly() {
    const p = st.s.person;
    if (!p || !p.alive) return;
    const a = ensure();

    // 1) 房价指数随通胀演化（含随机漂移，剧本"艰难"更易下探）
    const drift = (u.chance(0.6) ? 1 : -1) * A.priceIndex.drift;
    const sc = Game.scenario ? Game.scenario.cur() : null;
    const scAdj = sc && sc.assetDrift ? sc.assetDrift : 0;
    a.priceIndex = Math.max(0.5, Math.round(a.priceIndex * (1 + A.priceIndex.growth + drift + scAdj) * 1000) / 1000);

    // 2) 资产重估 + 维护费（物业/保险/保养，按现价计）
    let upkeep = 0;
    for (const it of a.houses.concat(a.cars)) {
      it.years += 1;
      if (it.kind === 'car') {
        const v = it.value * (1 - A.carDepreciation);
        it.value = r1(Math.max(it.buyPrice * 0.08, v)); // 残值下限
      } else {
        it.value = r1(it.value * (1 + A.priceIndex.growth + drift));
      }
      upkeep = r1(upkeep + (it.kind === 'car' ? A.carUpkeep : it.value * A.upkeepRate));
    }
    if (upkeep) {
      p.wealth = r1((p.wealth || 0) - upkeep);
      a.upkeepPaid = r1(a.upkeepPaid + upkeep);
    }

    // 3) 按揭月供：本息拆分，本金额度内偿还本金
    if (a.mortgage > 0) {
      const annual = r1(a.installment * 12);
      const interest = r1(a.mortgage * A.mortgageRate);
      const principal = Math.max(0, r1(annual - interest));
      p.wealth = r1((p.wealth || 0) - annual);
      a.interestPaid = r1(a.interestPaid + interest);
      a.principalPaid = r1(a.principalPaid + principal);
      a.mortgage = Math.max(0, r1(a.mortgage - principal));
      if (a.mortgage <= 0.05) {
        a.mortgage = 0;
        a.installment = 0;
        if (!a.cleared) {
          a.cleared = true;
          p.flags.debt_free = true;
          st.applyEffects({ mood: 12, stress: -8, source: '资产·还清' });
          st.log('🎉 最后一笔房贷还清了——房子终于是你自己的了。', 'good', '🎉');
        }
      } else if (p.wealth < 0) {
        st.log('🏦 月供照扣，账上已是负数（剩 ' + a.mortgage + ' 万贷款）——杠杆在咬人。', 'warn', '🏦');
        if (p.mental) p.mental.stress = Math.min(100, Math.round(p.mental.stress + 3));
      }
    }

    // 4) 现金利息（正存款才有）
    if (A.savingRate > 0 && p.wealth > 0) {
      const int = r1(Math.min(p.wealth, A.savingCap) * A.savingRate);
      if (int > 0) {
        p.wealth = r1(p.wealth + int);
        a.interestIncome = r1(a.interestIncome + int);
      }
    }

    // 5) 峰值与净值（并入人生评分）
    a.peakValue = Math.max(a.peakValue, totalValue());
    a.peakNet = Math.max(a.peakNet, netWorth());
    if (a.peakNet >= A.richMark) p.flags.mansion_owner = a.houses.length > 0;
    bus.emit('asset:change', {});
  }

  Game.assets = {
    init, plan, check, canBuy, buy, sell,
    list: (kind) => owned(kind).map((it) => Object.assign({}, it)),
    defs: (kind) => defs(kind).map((d) => Object.assign({}, d)),
    def, has, priceOf, installmentOf,
    value: totalValue, netWorth, summary,
    clearMortgage,
    monthlyIncome,
    mortgageInfo() {
      const a = ensure();
      return {
        left: a.mortgage, installment: a.installment, yearsLeft: a.installment > 0 ? Math.ceil(a.mortgage / (a.installment * 12)) : 0,
        paid: a.principalPaid, cleared: a.cleared,
      };
    },
    // 供抉择事件 condition 使用
    canSell(kind) { return owned(kind).length > 0; },
  };
})();
