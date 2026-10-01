/* =========================================================================
 * 系统 · 📊 人数数据化 (datalize) —— 关系类外挂
 * -------------------------------------------------------------------------
 * 不引入外部力量，只是把"人"变成可见可算的数：给每个关系人挂一张隐藏的
 * 卡（好感 / 价值 / 真诚度 / 标签 / 人情 / 波动性），玩家可以花观测点 DP
 * 去解析、拉近、支取、割席。
 *
 * 独立性约定：与 🧬海克斯、💰神壕 **没有任何关系**——不读它们的 state、
 * 不订阅它们的事件、不共享资源。删掉本文件，引擎行为完全不变。
 *
 * 零副作用保证：模块默认关闭；关闭时 attach() 直接返回，不消耗随机数、
 * 不写任何字段，因此"关着模块的一局"与"没有这个模块的一局"逐位一致。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const D = C.datalize;
  if (!D) return; // 配置缺失 = 模块不存在

  function freshState() {
    return {
      on: D.enabled === true,
      dp: D.dpStart,
      spent: 0,     // 累计消耗 DP（本模块自己的账）
      cd: {},
      once: {},     // 终身限次类能力已用次数（只属于本模块）
      radar: 0,     // 全图雷达剩余月
      favorPool: 0, // 累计支取的人情
      sel: 0,       // 当前选中的关系人下标
      log: [],
    };
  }

  Game.systems
    // priority 11 < family(12)：state:reset 要早于原生家庭系统的初始化，
    // 这样出生时就存在的父母 / 手足也能立刻挂上数据卡（见 K3）。
    .create('datalize', 11)
    .on('state:reset', function () {
      st.s.datalize = freshState();
    })
    .on('month', onMonth)
    // 正向往来回一点观测点（不消耗随机数，纯记账）
    .on('social:new', function () { if (ready()) earn(1, '结识新友'); })
    .on('family:marry', function () { if (ready()) earn(2, '成家'); })
    .on('family:birth', function () { if (ready()) earn(2, '添丁'); });

  function s() { return st.s.datalize; }
  function ready() { const x = s(); return !!(x && x.on && st.s.person.alive); }
  function def(id) { return (D.powers || []).filter((p) => p.id === id)[0] || null; }
  function cdOf(id) { const x = s(); return (x && x.cd && x.cd[id]) || 0; }
  function onceOf(id) { const x = s(); return (x && x.once && x.once[id]) || 0; }
  function record(row) {
    const x = s();
    x.log.push(row);
    if (x.log.length > 40) x.log.splice(0, x.log.length - 40);
  }
  function earn(n, reason) {
    const x = s();
    const before = x.dp;
    x.dp = Math.min(D.dpMax, x.dp + n);
    if (x.dp !== before) bus.emit('datalize:earn', { amount: x.dp - before, reason: reason, dp: x.dp });
    return x.dp;
  }
  function pay(n) {
    const x = s();
    if (x.dp < n) return false;
    x.dp -= n;
    x.spent += n;
    st.s.person.flags = st.s.person.flags || {};
    st.s.person.flags.used_datalize = true;
    return true;
  }

  /* ------------------------- 关系人名册 ------------------------- */
  function people() {
    const p = st.s.person;
    const out = [];
    const f = p.family;
    if (f) {
      if (f.father && f.father.alive) out.push({ kind: 'parent', tag: '父亲', obj: f.father, cut: false });
      if (f.mother && f.mother.alive) out.push({ kind: 'parent', tag: '母亲', obj: f.mother, cut: false });
      (f.siblings || []).forEach(function (x) {
        out.push({ kind: 'sibling', tag: '手足', obj: x, cut: false });
      });
    }
    const r = p.relationship;
    if (r) {
      if (r.spouse) out.push({ kind: 'spouse', tag: '配偶', obj: r.spouse, cut: false });
      (r.children || []).forEach(function (x) {
        out.push({ kind: 'child', tag: x.gender === '男' ? '儿子' : '女儿', obj: x, cut: false });
      });
    }
    const soc = p.social;
    if (soc) {
      soc.friends.forEach(function (x) {
        out.push({ kind: 'friend', tag: x.tag || '朋友', obj: x, cut: true });
      });
    }
    return out;
  }
  function pick(i) {
    const list = people();
    const idx = i == null ? (s() ? s().sel : 0) : i;
    return list[idx] || null;
  }

  /* ------------------------- 卡牌的生成与演进 ------------------------- */
  // kind: 'parent' | 'spouse' | 'child' | 'sibling' | 'friend'
  // 幂等：已有卡的绝不重置
  function attach(obj, kind) {
    if (!obj) return null;
    if (obj.d) return obj.d;        // 已有卡 → 原样返回
    if (!ready()) return null;      // 关闭 / 未开局 → 完全不介入
    return makeCard(obj, kind);
  }

  function seedOf(obj, kind) {
    // 用各系统已有的"亲密度"字段作为好感起点，让数据化读出来是合理的
    if (kind === 'friend') return typeof obj.quality === 'number' ? obj.quality : 50;
    if (kind === 'parent' || kind === 'sibling') return typeof obj.bond === 'number' ? obj.bond : 55;
    return 55;
  }

  function makeCard(obj, kind) {
    const seed = seedOf(obj, kind);
    const tags = [];
    const pool = D.tags || [];
    const n = Math.min(2, pool.length);
    for (let i = 0; i < n; i++) {
      let t = pool.length ? u.pick(pool) : '';
      let guard = 0;
      while (t && tags.indexOf(t) >= 0 && guard < 8) { t = u.pick(pool); guard += 1; }
      if (t) tags.push(t);
    }
    obj.d = {
      k: kind || 'other',
      affinity: Math.round(u.clamp(seed + u.gauss(0, 8), 0, 100)),
      value: Math.round(u.clamp(u.gauss(45, 20), 5, 95)),
      trust: Math.round(u.clamp(u.gauss(58, 18), 10, 95)),
      tags: tags,
      favor: 0,
      volatility: Math.round(u.range(0.6, 1.6) * 100) / 100,
      revealed: false,
    };
    return obj.d;
  }

  // 读卡（不生成）：用于在 UI 上显示"未解析"
  function card(obj) { return obj && obj.d ? obj.d : null; }
  function visible(obj) {
    const x = s();
    if (!x || !x.on) return false;
    const c = card(obj);
    if (!c) return false;
    return !!c.revealed || x.radar > 0;
  }

  function onMonth() {
    const x = s();
    if (!x) return;
    for (const k in x.cd) if (x.cd[k] > 0) x.cd[k] -= 1;
    if (x.radar > 0) x.radar -= 1;
    if (!x.on || !st.s.person.alive) return;
    earn(D.dpPerMonth, '每月回充');
    // 自然漂移：好感向 50 回落，人情按真诚与好感缓慢积累
    const dr = D.drift || { perMonth: 1, toward: 50 };
    for (const it of people()) {
      const c = card(it.obj);
      if (!c) continue;
      c.affinity = Math.round(u.clamp(c.affinity + (dr.toward - c.affinity) * 0.02 - dr.perMonth * 0.1, 0, 100));
      const gain = (c.affinity / 100) * (0.4 + (c.trust / 100) * 0.6);
      c.favor = Math.round(Math.min(D.favorCap || 30, c.favor + gain) * 10) / 10;
    }
  }

  /* ------------------------------ 能力 ------------------------------ */
  function usable(id) {
    const x = s();
    const d = def(id);
    if (!ready() || !d) return false;
    if (x.dp < d.cost) return false;
    if (cdOf(id) > 0) return false;
    if (d.maxUse != null && onceOf(id) >= d.maxUse) return false;   // 终身限次
    if (id === 'radar') return x.radar <= 0;
    return !!pick(); // 其余能力都需要一个目标
  }
  function usableOn(id, idx) {
    if (!usable(id)) return false;
    const it = pick(idx);
    if (!it) return false;
    if (id === 'cut') return !!it.cut;          // 只有朋友可割席
    if (id === 'reveal') { const cc = card(it.obj); return !(cc && cc.revealed); }
    if (id === 'draw') return (card(it.obj) ? card(it.obj).favor : 0) >= (D.draw.favorCost || 10);
    return true;
  }

  function cast(id, idx) {
    const x = s();
    const d = def(id);
    if (!d) return false;
    const targetOK = id === 'radar' ? usable(id) : usableOn(id, idx);
    if (!targetOK) return false;
    if (!pay(d.cost)) return false;
    const ok = run(id, d, idx);
    if (!ok) {
      x.dp += d.cost;                       // 失败全额退还
      x.spent = Math.max(0, x.spent - d.cost);
      return false;
    }
    if (d.cd) x.cd[id] = d.cd;
    if (d.maxUse != null) x.once[id] = onceOf(id) + 1;
    record({ age: st.s.clock.age, id: id, name: d.name, cost: d.cost });
    bus.emit('datalize:cast', { id: id, dp: x.dp });
    bus.emit('ui:refresh', {});
    return true;
  }

  function run(id, d, idx) {
    if (id === 'radar') return radarCast();
    const it = pick(idx);
    if (!it) return false;
    const c = attach(it.obj, it.kind) || card(it.obj); // 解析时顺带补卡（首次使用才掷点）
    if (!c) return false;
    switch (id) {
      case 'reveal': return reveal(it, c);
      case 'gift': return gift(it, c);
      case 'draw': return draw(it, c);
      case 'cut': return cut(it, c);
      case 'relabel': return relabel(it, c);
      default: return false;
    }
  }

  function bar(v) {
    const n = Math.round(u.clamp(v, 0, 100) / 10);
    return '▮'.repeat(n) + '▯'.repeat(10 - n);
  }

  function reveal(it, c) {
    if (c.revealed) return false;
    c.revealed = true;
    st.log('👁️ ' + it.tag + '「' + it.obj.name + '」的数据浮出水面：好感 ' + c.affinity + ' · 价值 ' + c.value + ' · 真诚 ' + c.trust + ' · ' + (c.tags.join('/') || '无标签'), 'info', '👁️');
    return true;
  }

  function gift(it, c) {
    const G = D.gift;
    const base = u.randInt(G.affinity[0], G.affinity[1]);
    const swing = Math.max(1, Math.round(base * c.volatility));
    if (u.chance(G.failChance)) {
      c.affinity = Math.round(u.clamp(c.affinity - Math.round(swing * 0.6), 0, 100));
      st.applyEffects({ mood: -G.moodCost, source: '数据化·热脸贴冷屁股' });
      st.log('🎁 你刻意示好，' + it.obj.name + '却似乎并不领情（好感 ' + c.affinity + '）', 'warn', '🎁');
    } else {
      c.affinity = Math.round(u.clamp(c.affinity + swing, 0, 100));
      c.favor = Math.round(Math.min(D.favorCap || 30, c.favor + swing * 0.4) * 10) / 10;
      st.log('🎁 一番走动之后，' + it.obj.name + '对你的好感涨到 ' + c.affinity + '（人情 ' + c.favor + '）', 'good', '🎁');
    }
    return true;
  }

  function draw(it, c) {
    const W = D.draw;
    if (c.favor < W.favorCost) return false;
    c.favor = Math.round((c.favor - W.favorCost) * 10) / 10;
    const x = s();
    x.favorPool = Math.round((x.favorPool + W.favorCost) * 10) / 10;
    const betrayP = c.trust < 50 ? W.betrayalChance : W.betrayalChance * 0.3;
    if (u.chance(betrayP)) {
      st.applyEffects(Object.assign({}, W.betrayal.effects || {}, { source: '数据化·人情落空' }));
      st.log('🪝 ' + W.betrayal.log + '（' + it.obj.name + '）', 'warn', '🪝');
      return true;
    }
    const prize = u.pick(W.payouts || []);
    if (!prize) return false;
    st.applyEffects(Object.assign({}, prize.effects || {}, { source: '数据化·人情兑现' }));
    st.log('🪝 找' + it.obj.name + '支取人情：' + prize.label, 'good', '🪝');
    return true;
  }

  function cut(it, c) {
    if (!it.cut) return false;
    const p = st.s.person;
    const list = p.social && p.social.friends;
    const i = list ? list.indexOf(it.obj) : -1;
    if (i < 0) return false;
    list.splice(i, 1);
    st.applyEffects({ mood: D.cut.mood, source: '数据化·割席' });
    st.log('✂️ 你和' + it.tag + '「' + it.obj.name + '」断了往来（心情 ' + D.cut.mood + '）', 'info', '✂️');
    const x = s();
    if (x.sel >= people().length) x.sel = 0;
    bus.emit('social:change', {});
    return true;
  }

  function relabel(it, c) {
    const pool = D.tags || [];
    const gain = (D.relabel && D.relabel.affinity) || 6;
    if (!pool.length) return false;
    const slot = c.tags.length ? 0 : -1;
    let next = u.pick(pool);
    let guard = 0;
    while (c.tags.indexOf(next) >= 0 && guard < 12) { next = u.pick(pool); guard += 1; }
    if (slot >= 0) c.tags[slot] = next; else c.tags.push(next);
    c.affinity = Math.round(u.clamp(c.affinity + gain, 0, 100));
    c.revealed = true; // 改写必然看得见
    st.log('🖋️ 你重新塑造了自己在' + it.obj.name + '心里的样子：' + c.tags.join('/') + '（好感 ' + c.affinity + '）', 'info', '🖋️');
    return true;
  }

  function radarCast() {
    const x = s();
    x.radar = 2; // 本月起 2 个月内所有关系人面板可见
    const list = people();
    st.log('🔍 全图雷达启动：' + list.length + ' 位关系人的数据在视野里排开（2 个月）', 'info', '🔍');
    return true;
  }

  /* ---------------------- 结算与存档（本模块自己管） ---------------------- */
  function rebate() {
    const x = s();
    if (!x || !x.spent) return 1;
    const r = D.scoreRebate;
    return u.clamp(1 - x.spent / r.per, r.min, 1);
  }

  function targetOptions() {
    const list = people();
    const x = s();
    return list.map(function (it, i) {
      const c = card(it.obj);
      let label = it.obj.name + '（' + it.tag + '）';
      if (c && visible(it.obj)) label += ' · 好感 ' + c.affinity;
      else label += ' · 未解析';
      return { value: String(i), label: label, selected: x && x.sel === i };
    });
  }

  function panel() {
    const x = s();
    if (!x) return null;
    const list = people();
    return {
      key: 'datalize',
      name: '📊 数据化',
      note: '观测点 DP ' + x.dp + ' / ' + D.dpMax + ' · 累计消耗 ' + x.spent + ' · 关系人 ' + list.length + ' 位',
      rows: (D.powers || []).map(function (d) {
        const need = d.target ? '目标' : '自身';
        return {
          id: d.id,
          label: d.emoji + ' ' + d.name,
          sub: d.cost + ' DP · ' + need + (d.cd ? ' · CD ' + d.cd + '月' : '')
            + (d.maxUse != null ? ' · 终身余 ' + Math.max(0, d.maxUse - onceOf(d.id)) + '/' + d.maxUse : ''),
          ready: d.target ? usableOn(d.id, x.sel) : usable(d.id),
          tip: d.desc,
          target: !!d.target,
        };
      }),
      extras: [
        {
          id: 'target',
          kind: 'select',
          label: '🎯 目标',
          value: String(Math.min(x.sel, Math.max(0, list.length - 1))),
          options: targetOptions(),
        },
      ],
      // J7 余额角标：观测点 DP（低于最便宜能力置灰）
      balance: (function () {
        let minCost = Infinity;
        for (const d of D.powers || []) if (d.cost < minCost) minCost = d.cost;
        if (minCost === Infinity) minCost = 1;
        return { text: 'DP ' + x.dp, ok: x.dp >= minCost };
      })(),
    };
  }

  function select(idx) {
    const x = s();
    if (!x) return false;
    x.sel = Math.max(0, idx | 0);
    return true;
  }

  Game.datalize = {
    enable() { const x = s(); if (x) x.on = true; return true; },
    disable() { const x = s(); if (x) x.on = false; return true; },
    toggle() { return st.s.datalize && st.s.datalize.on ? Game.datalize.disable() : Game.datalize.enable(); },
    isOn() { return !!(st.s.datalize && st.s.datalize.on); },
    dp() { return st.s.datalize ? st.s.datalize.dp : 0; },
    spent() { return st.s.datalize ? st.s.datalize.spent : 0; },
    attach: attach,
    people, card, visible, select,
    usable, usableOn, cast,
    reveal(i) { return cast('reveal', i); },
    gift(i) { return cast('gift', i); },
    draw(i) { return cast('draw', i); },
    cut(i) { return cast('cut', i); },
    radar() { return cast('radar'); },
    rebate,
    panel,
    castExtra(id, idx) { return cast(String(id), idx); },
    snapshot() {
      const x = s();
      return x ? { on: x.on, dp: x.dp, spent: x.spent, cd: x.cd, once: x.once, radar: x.radar, favorPool: x.favorPool, log: x.log } : null;
    },
    hydrate(d) {
      st.s.datalize = Object.assign(freshState(), d || {}, { sel: 0 });
    },
  };
})();
