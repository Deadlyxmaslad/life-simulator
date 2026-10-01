/* =========================================================================
 * 系统 · 故事积分 / 因果链叙事化 (story) —— priority 77
 * -------------------------------------------------------------------------
 * 一并落地路线图里的两件事：
 *   E1 因果链叙事化：把 consequences 埋下的伏笔按"故事线"(storyline)归类
 *      （事业/财富/情感/健康/心境/家庭），把每次触发记成一条"故事弧"，
 *      提供 HUD 进度与死亡结算页的完整链路回放。
 *   E3/G5 故事积分：把玩家的每一次抉择、行动、伏笔量化为五维（雄心/善心/
 *      冒险/智识/活力），结算页渲染 SVG 雷达图，并与出生即定的大五人格
 *      OCEAN 映射出的"先天气质"叠加对比；五维组合决定特殊结局。
 * 纯"记账"系统：只读事件与伏笔，不改任何其它系统（唯一的写入是特殊结局的
 * flags.ending_*，供 achievements 在评估时识别）。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const S = C.story;

  const DIM_KEYS = S.dims.map((d) => d.key);

  Game.systems
    .create('story', 77)
    .on('state:reset', init)
    .on('state:reset', snapshotInnate) // priority 77 > personality(15)：此时大五人格已就绪
    .on('decision:answered', onDecision)
    .on('action:done', onAction)
    .on('asset:bought', () => record('购置 房产 汽车 投资 置业 财富', S.gain.event))
    .on('asset:sold', () => record('卖出 资产 变现 现金 决策', S.gain.event))
    .on('year', onYear)
    .on('death', finalize);

  /* --------------------------------- 初始化 --------------------------------- */
  function init() {
    const p = st.s.person;
    const dims = {};
    DIM_KEYS.forEach((k) => { dims[k] = S.startValue; });
    const groups = {};
    S.groups.forEach((g) => { groups[g.key] = { hits: 0, seeds: [], progress: S.groupBase }; });
    p.story = {
      dims,
      groups,
      arcs: [],      // [{age, key, name, emoji, label}]
      counts: { decisions: 0, actions: 0, seeds: 0, risky: 0, kind: 0 },
      stats: { peakStress: 0, lowPoint: null, rebound: false, bestNet: 0 },
      ending: null,
      innate: null,  // 出生时的 OCEAN（"先天气质"），用于雷达图对比
    };
  }

  function ensure() {
    const p = st.s.person;
    if (!p.story) init();
    return p.story;
  }

  // 出生时锁定"先天气质"快照（性格可塑会漂移，雷达图需要对比出厂值）
  function snapshotInnate() {
    const p = st.s.person;
    if (p && p.personality) ensure().innate = Object.assign({}, p.personality);
  }

  /* ------------------------------- 关键词记账 ------------------------------- */
  function bumpDim(key, amount) {
    const st_ = ensure();
    st_.dims[key] = u.clamp(Math.round((st_.dims[key] || 0) + amount), 0, 100);
  }

  function hitGroup(text) {
    const s = ensure();
    for (const g of S.groups) {
      const kws = g.keywords || [];
      for (const k of kws) {
        if (text.indexOf(k) >= 0) {
          const rec = s.groups[g.key];
          rec.hits += 1;
          rec.progress = clampProgress(S.groupBase + rec.hits * S.groupStep);
          return g;
        }
      }
    }
    return null;
  }

  function clampProgress(v) { return u.clamp(Math.round(v), 0, 100); }

  // 核心：把一段"行为文本"折算成五维积分与故事线命中
  function record(text, weight) {
    const s = ensure();
    const t = String(text || '');
    if (!t) return;
    for (const d of S.dims) {
      const kws = S.keywords[d.key] || [];
      let hit = 0;
      for (const k of kws) if (t.indexOf(k) >= 0) hit++;
      if (hit) {
        bumpDim(d.key, hit * (weight || S.gain.event));
      }
    }
    hitGroup(t);
  }

  /* ------------------------------ 事件 → 积分 ------------------------------ */
  function onDecision(e) {
    const s = ensure();
    const ch = e.choice || {};
    const ev = e.ev || {};
    const parts = [ev.id, ev.title, ch.label, ch.log];
    if (ch.risk) {
      parts.push(ch.risk.goodLog, ch.risk.badLog, '风险');
      s.counts.risky += 1;
    }
    // 效果里携带的 flags 也是"行为标签"（如 kind / filial / homeowner）
    const collectFlags = (o) => { if (o && o.flags) parts.push(Object.keys(o.flags).join(' ')); };
    collectFlags(ch.effects);
    if (ch.risk) { collectFlags(ch.risk.success); collectFlags(ch.risk.failure); }

    s.counts.decisions += 1;
    record(parts.filter(Boolean).join(' '), S.gain.event);
    recordSeedNames(ch.plants, '抉择');
  }

  function onAction(e) {
    const s = ensure();
    const d = e.def || {};
    s.counts.actions += 1;
    record((e.id || '') + ' ' + (d.name || '') + ' ' + (d.desc || ''), S.gain.action);
  }

  function recordSeedNames(plants, from) {
    if (!plants) return;
    const arr = Array.isArray(plants) ? plants : [plants];
    for (const s0 of arr) {
      const name = typeof s0 === 'string' ? s0 : s0.seed;
      if (!name) continue;
      const g = groupOfSeed(name);
      if (g) addArc(g, '🧩', from + '埋下伏笔「' + name + '」');
    }
  }

  function groupOfSeed(seed) {
    const s = ensure();
    for (const g of S.groups) {
      if ((g.seeds || []).indexOf(seed) >= 0) {
        const rec = s.groups[g.key];
        if (rec.seeds.indexOf(seed) < 0) rec.seeds.push(seed);
        rec.progress = clampProgress(Math.max(rec.progress, S.groupBase + rec.seeds.length * S.seedStep));
        return g;
      }
    }
    // 未登记在册的伏笔也归到"心境线"，避免故事线看不见
    return S.groups[S.fallbackGroup] || null;
  }

  function addArc(group, emoji, label) {
    const s = ensure();
    s.arcs.push({ age: st.s.clock.age, key: group.key, name: group.name, emoji: emoji || group.emoji, label });
    if (s.arcs.length > 120) s.arcs.shift();
  }

  /* -------------------------------- 年度巡检 -------------------------------- */
  function onYear() {
    const p = st.s.person;
    if (!p || !p.alive) return;
    const s = ensure();

    // 1) 伏笔 → 故事线（伏笔被回收/过期都会自然消失，这里只登记"当下活跃"）
    if (Game.consequences) {
      const seeds = p.seeds ? Object.keys(p.seeds) : [];
      s.counts.seeds = seeds.length;
      for (const name of seeds) {
        const g = groupOfSeed(name);
        if (g && !s.arcs.some((a) => a.label.indexOf('活跃') >= 0 && a.label.indexOf(name) >= 0)) {
          addArc(g, '🧵', '故事线「' + name + '」持续活跃');
        }
      }
    }

    // 2) 心智低点与反弹（"凤凰涅槃"结局的依据）
    if (p.mental) {
      s.stats.peakStress = Math.max(s.stats.peakStress, p.mental.stress || 0);
      if ((p.mental.stress || 0) >= S.rebound.stress || (p.wealth || 0) < -S.rebound.debt) {
        if (!s.stats.lowPoint) s.stats.lowPoint = st.s.clock.age;
      }
    }
    const net = Game.assets ? Game.assets.netWorth() : p.wealth || 0;
    s.stats.bestNet = Math.max(s.stats.bestNet, net);
    if (s.stats.lowPoint && !s.stats.rebound && net >= S.rebound.net && (p.mental ? p.mental.stress : 0) < S.rebound.calm) {
      s.stats.rebound = true;
      p.flags.rebound = true;
      st.log('🔥 你从人生低谷里爬了出来——这一次，是你自己站起来的。', 'good', '🔥');
    }
  }

  /* --------------------------------- 结局 --------------------------------- */
  function innateDims() {
    const p = st.s.person;
    const pers = p.personality || {};
    const src = (ensure().innate) || pers;
    const out = {};
    for (const d of S.dims) {
      const map = S.oceanMap[d.key] || {};
      let v = 0;
      for (const k in map) v += (src[k] || 50) * map[k];
      out[d.key] = Math.round(u.clamp(v, 0, 100));
    }
    return out;
  }

  function score() {
    const s = ensure();
    const dims = Object.assign({}, s.dims);
    // 先天基线的"影子分"：人格底色会轻微牵引五维（最多 ±6）
    const inna = innateDims();
    const blended = {};
    for (const k of DIM_KEYS) blended[k] = u.clamp(Math.round(dims[k] + (inna[k] - 50) * 0.12), 0, 100);
    return { dims, blended, innate: inna, top: topDim(blended), counts: s.counts, stats: s.stats };
  }

  function topDim(dims) {
    let best = null;
    for (const d of S.dims) {
      if (!best || dims[d.key] > dims[best.key]) best = d;
    }
    return best;
  }

  function evaluateEnding() {
    const sc = score();
    const p = st.s.person;
    const ctx = {
      dims: sc.blended, raw: sc.dims, innate: sc.innate,
      flags: p.flags || {}, counts: sc.counts, stats: sc.stats,
      age: st.s.clock.age, wealth: p.wealth || 0,
      net: Game.assets ? Game.assets.netWorth() : p.wealth || 0,
    };
    let found = null;
    for (const e of S.endings) {
      let ok = false;
      try { ok = !!e.test(ctx); } catch (err) { ok = false; }
      if (ok) { found = e; break; }
    }
    return { ending: found, ctx: sc };
  }

  function finalize() {
    const s = ensure();
    if (s.ending) return s.ending;
    const res = evaluateEnding();
    const e = res.ending;
    s.scoreCtx = res.ctx;
    if (e) {
      s.ending = { id: e.id, name: e.name, emoji: e.emoji, desc: e.desc };
      st.s.person.flags['ending_' + e.id] = true;
      st.log(e.emoji + ' 结局判定：' + e.name + ' —— ' + e.desc, e.id === 'wasted' ? 'warn' : 'good', e.emoji);
      bus.emit('story:ending', s.ending);
    }
    return s.ending;
  }

  // 出生快照由系统自身的 state:reset 订阅完成（见上方 snapshotInnate）

  Game.story = {
    dims() { return Object.assign({}, ensure().dims); },
    score,
    innate: innateDims,
    groups() {
      const s = ensure();
      return S.groups.map((g) => {
        const rec = s.groups[g.key];
        const active = (g.seeds || []).filter((sd) => Game.consequences && Game.consequences.has(sd));
        return {
          key: g.key, name: g.name, emoji: g.emoji, hint: g.hint,
          progress: clampProgress(Math.max(rec.progress, active.length ? S.groupBase + active.length * S.seedStep : 0)),
          hits: rec.hits,
          seeds: rec.seeds.slice(),
          activeSeeds: active,
          active: rec.hits > 0 || active.length > 0,
        };
      });
    },
    arcs() { return ensure().arcs.slice(); },
    counts() { return Object.assign({}, ensure().counts); },
    ending() { return ensure().ending; },
    evaluate: evaluateEnding,
    finalize,
    record,
  };
})();
