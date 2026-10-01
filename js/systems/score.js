/* =========================================================================
 * 系统 · 人生评分 & 高分榜 (score)
 * -------------------------------------------------------------------------
 * 死亡时把一生量化为一个分数（寿命/学历/成就/家庭/事业/善行/净资产峰值/
 * 投资盈亏），写入 localStorage 高分榜，并记录本局名次与分项，供结算页与
 * "高分榜"面板展示。priority 90 → 在成就评估之后运行，成就计数才完整。
 * 各权重在 config.score，随时可调。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const SC = C.score;
  const W = SC.weights;
  const KEY = 'lifesim_leaderboard';
  let idSeq = 1;

  function eduIndex(level) {
    const order = (Game.education && Game.education.levelOrder) || [];
    const i = order.indexOf(level);
    return i < 0 ? 0 : i;
  }
  function deedsOf(p) {
    const f = p.flags || {};
    return SC.deedFlags.reduce((n, k) => n + (f[k] ? 1 : 0), 0);
  }
  // 财富峰值：现金持仓峰值与资产净值峰值取高（含房产/车辆，B6）
  function peakNet(p) {
    let v = p.invest ? p.invest.peakNet || 0 : p.wealth || 0;
    if (p.assets && p.assets.peakNet) v = Math.max(v, p.assets.peakNet);
    return v;
  }

  // 故事五维均值（E3/G5）：0-100，量化"这一生过得有多厚"
  function storyAvg(p) {
    if (!Game.story) return 0;
    try {
      const sc = Game.story.score();
      const keys = Object.keys(sc.blended || {});
      if (!keys.length) return 0;
      return keys.reduce((n, k) => n + sc.blended[k], 0) / keys.length;
    } catch (e) {
      return 0;
    }
  }

  function endingName(p) {
    if (p.story && p.story.ending) return p.story.ending.emoji + ' ' + p.story.ending.name;
    return '—';
  }

  // —— 金手指三模块的结算折损（v1.2.0）——
  // 三个模块**各自独立记账**：这里只是分别读各自的 rebate()，
  // 不做统一管理、不引入共享货币。任一份缺失则那一 Mul 视为 1（即不折损）。
  function rebateList(p) {
    const f = p.flags || {};
    const out = [];
    if (Game.hex && typeof Game.hex.rebate === 'function' && f.used_hex) {
      const mul = Game.hex.rebate();
      if (mul < 1) out.push({ id: 'hex', label: '🧬 海克斯', sub: '算力消耗 ' + Math.round(Game.hex.spent()) + ' HE', mul: mul });
    }
    if (Game.tycoon && typeof Game.tycoon.rebate === 'function' && f.used_tycoon) {
      const mul = Game.tycoon.rebate();
      if (mul < 1) out.push({ id: 'tycoon', label: '💰 神壕', sub: '资金注入 ' + Math.round(Game.tycoon.injected()) + ' 万', mul: mul });
    }
    if (Game.datalize && typeof Game.datalize.rebate === 'function' && f.used_datalize) {
      const mul = Game.datalize.rebate();
      if (mul < 1) out.push({ id: 'datalize', label: '📊 数据化', sub: '观测点消耗 ' + Math.round(Game.datalize.spent()) + ' DP', mul: mul });
    }
    return out;
  }
  function usedModules(p) {
    return rebateList(p).map((x) => x.id);
  }

  function baseRows(s) {
    const p = s.person;
    const age = s.clock.age || 0;
    const edu = eduIndex(p.education ? p.education.level : '—');
    const ach = p.achievements ? Object.keys(p.achievements).length : 0;
    const r = p.relationship;
    const everMarried = r && (r.married || r.widowed || r.divorced);
    const kids = r ? r.children.length : 0;
    const work = p.career ? p.career.workYears || 0 : 0;
    const deeds = deedsOf(p);
    const wealthPts = Math.round(Math.log10(1 + Math.max(0, peakNet(p))) * SC.netWorthLog);
    const invPts = Math.round((p.invest && p.invest.realized ? p.invest.realized * W.investRealized : 0));
    return [
      { label: '享年', sub: age + ' 岁', pts: age * W.age },
      { label: '学历', sub: p.education ? p.education.level : '—', pts: edu * W.eduRank },
      { label: '成就', sub: ach + ' 枚', pts: ach * W.achievements },
      { label: '家庭', sub: (everMarried ? '已婚' : '未婚') + ' · ' + kids + ' 子女', pts: (everMarried ? W.married : 0) + kids * W.children },
      { label: '事业', sub: work + ' 年工龄', pts: work * W.workYears },
      { label: '善行', sub: deeds + ' 项', pts: deeds * W.deeds },
      { label: '财富', sub: '净值峰值 ' + Math.round(peakNet(p)) + ' 万', pts: wealthPts },
      { label: '投资', sub: '盈亏 ' + (p.invest ? Math.round(p.invest.realized || 0) : 0) + ' 万', pts: invPts },
      { label: '故事', sub: endingName(p) + ' · 五维均值 ' + Math.round(storyAvg(p)), pts: Math.round(storyAvg(p) * W.story) },
      (function () {
        const n = Game.habit ? Game.habit.masteredCount() : 0;
        return { label: '习惯', sub: '内化 ' + n + ' 个', pts: n * (W.habit || 0) };
      })(),
      // 生活品质（v1.5.0）：累计消费 + 达到过的最高消费档。会花钱、会享受，也是一种成就。
      (function () {
        const sm = Game.consume && typeof Game.consume.summary === 'function' ? Game.consume.summary() : null;
        if (!sm) return { label: '品质', sub: '—', pts: 0 };
        const tierPts = (sm.peakTier === 'luxury' ? 3 : sm.peakTier === 'affluent' ? 2 : sm.peakTier === 'comfort' ? 1 : 0) * (W.consumeTier || 0);
        const spentPts = Math.min(W.consumeCap || 0, Math.round((sm.spent || 0) * (W.consumeSpent || 0)));
        const tierName = (Game.consume.tierOf(sm.peakTier) || {}).name || '温饱';
        return { label: '品质', sub: tierName + ' · 累计消费 ' + Math.round(sm.spent || 0) + ' 万', pts: tierPts + spentPts };
      })(),
      // 契约精神（v1.6.0）：人生合约的达成数。说到做到，也是一种分量。
      (function () {
        const n = (Game.contracts && typeof Game.contracts.kept === 'function') ? Game.contracts.kept() : 0;
        if (!Game.contracts || typeof Game.contracts.kept !== 'function') return { label: '合约', sub: '—', pts: 0 };
        const f = Game.contracts.failed ? Game.contracts.failed() : 0;
        return { label: '合约', sub: '达成 ' + n + ' 期' + (f ? ' · 未达成 ' + f + ' 期' : ''), pts: n * (W.contract || 0) };
      })(),
      // 底色（v1.6.0）：结算页倾向标签数。活得有辨识度，本身就是一种成就。
      (function () {
        const n = (Game.persona && typeof Game.persona.count === 'function') ? Game.persona.count() : 0;
        if (!Game.persona || typeof Game.persona.count !== 'function') return { label: '底色', sub: '—', pts: 0 };
        return { label: '底色', sub: n + ' 枚标签', pts: n * (W.persona || 0) };
      })(),
    ];
  }

  // 折损行：把每个用过的模块各自扣多少明写出来（互不共享、各自可配）
  function breakdown(s) {
    const rows = baseRows(s);
    const raw = Math.max(0, rows.reduce((sum, b) => sum + b.pts, 0));
    for (const m of rebateList(s.person)) {
      rows.push({
        label: m.label,
        sub: m.sub + ' · ×' + Math.round(m.mul * 100) / 100,
        pts: Math.round(raw * (m.mul - 1)),
      });
    }
    return rows;
  }

  function compute(s) {
    return Math.max(0, Math.round(breakdown(s).reduce((sum, b) => sum + b.pts, 0)));
  }

  function loadBoard() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  }
  function saveBoard(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, SC.leaderboardSize)));
    } catch (e) {}
  }

  Game.systems.create('score', 90).on('death', function () {
    const s = st.s;
    const p = s.person;
    const score = compute(s);
    const entry = {
      id: (s.currentSeed || 0) + '-' + Date.now() + '-' + idSeq++,
      name: p.name,
      gender: p.gender,
      score: score,
      age: s.clock.age,
      yearEnd: s.clock.year,
      origin: p.family ? p.family.origin : '—',
      level: p.education ? p.education.level : '—',
      ach: p.achievements ? Object.keys(p.achievements).length : 0,
      net: Math.round(peakNet(p)),
      realized: p.invest ? Math.round(p.invest.realized || 0) : 0,
      seed: s.currentSeed,
      ts: Date.now(),
      mods: usedModules(p),   // 本局开过哪些金手指（只做标注，不分榜）
    };
    const board = loadBoard();
    board.push(entry);
    board.sort((a, b) => b.score - a.score);
    saveBoard(board);
    const top = loadBoard();
    const rank = top.findIndex((e) => e.id === entry.id) + 1;
    s.lastScore = { score: score, breakdown: breakdown(s), rank: rank || 0, total: top.length, entryId: entry.id };
    st.log('🏆 人生盖棺定论：' + score + ' 分' + (rank ? ' · 高分榜第 ' + rank + ' 名' : ''), 'good', '🏆');
    bus.emit('score:done', s.lastScore);
  });

  Game.score = {
    compute,
    breakdown,
    loadBoard,
    rebates: rebateList,
    usedModules,
    clearBoard() {
      saveBoard([]);
      bus.emit('board:change', {});
    },
  };
})();
