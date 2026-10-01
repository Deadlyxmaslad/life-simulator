/* =========================================================================
 * 系统 · 人生报告 (report) —— v2.0.0
 * -------------------------------------------------------------------------
 * 死亡时聚合所有子系统的终态数据，生成一份「人生报告卡」存入 localStorage。
 * 报告是纯只读快照，不修改任何状态；报告可从高分榜回放。
 *
 * 报告存储：独立 localStorage 键 lifesim_reports（top20），与高分榜(lifesim_leaderboard)
 * 分开存——榜单只有分数，报告有完整人生数据。
 *
 * 设计红线：
 *   - 独立系统，priority 95（score 之后、audio 之前）
 *   - 读其它子系统一律走守卫：Game.x && typeof Game.x.y === 'function'
 *   - 报告对象是纯数据（JSON 可序列化），不含函数引用
 *   - 删掉本文件，引擎行为逐位不变
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;

  const KEY = 'lifesim_reports';
  const MAX = 20;

  Game.systems
    .create('report', 95)
    .on('death', onDeath);

  function onDeath() {
    try {
      const r = buildReport();
      saveReport(r);
      st.s.lastReport = r;
      bus.emit('report:ready', r);
    } catch (e) {
      // 报告失败不应阻断结算流程
      console.error('[report] build failed', e);
    }
  }

  /* ---------------------------- 聚合报告 ---------------------------- */
  function buildReport() {
    const s = st.s;
    const p = s.person;
    const ck = s.clock || {};

    // 1) 基础信息
    const base = {
      id: (s.currentSeed || 0) + '-' + Date.now(),
      seed: s.currentSeed,
      ts: Date.now(),
      name: p.name || '—',
      gender: p.gender || '—',
      age: ck.age || 0,
      yearStart: ck.yearStart || 1990,
      yearEnd: ck.year || 1990,
      cause: p.deathCause || '—',
      origin: p.family ? p.family.origin : '—',
    };

    // 2) 学业 / 事业
    const edu = p.education || {};
    const career = p.career || {};
    const life = {
      education: edu.level || '—',
      iq: Math.round(p.intelligence || 0),
      job: career.job || '—',
      retired: career.phase === 'retired',
      workYears: career.workYears || 0,
    };

    // 3) 家庭 / 社交
    const rel = p.relationship || {};
    const fam = p.family || {};
    const soc = p.social || {};
    const relInfo = {
      married: !!(rel.married || rel.spouse),
      divorced: !!rel.divorced,
      widowed: !!rel.widowed,
      children: (rel.children || []).length,
      spouse: rel.spouse || '—',
      friends: (soc.friends || []).length,
      met: soc.met || 0,
    };

    // 4) 财务 / 投资
    const inv = p.invest || {};
    const assets = p.assets || {};
    const fin = {
      wealth: Math.round((p.wealth || 0) * 10) / 10,
      houses: (assets.houses || []).length,
      cars: (assets.cars || []).length,
      investOpened: !!inv.opened,
      realized: Math.round(inv.realized || 0),
      trades: inv.trades || 0,
    };

    // 5) 性格（大五）
    const pers = p.personality || {};
    const ocean = {
      O: Math.round(pers.O || 50),
      C: Math.round(pers.C || 50),
      E: Math.round(pers.E || 50),
      A: Math.round(pers.A || 50),
      N: Math.round(pers.N || 50),
    };

    // 6) 故事（五维 + 结局）
    let story = { dims: {}, ending: '—' };
    if (Game.story && typeof Game.story.score === 'function') {
      try {
        const sc = Game.story.score();
        story.dims = sc.blended || {};
        // 找结局
        const flags = p.flags || {};
        for (const k in flags) {
          if (k.indexOf('ending_') === 0) { story.ending = k.replace('ending_', ''); break; }
        }
      } catch (e) {}
    }

    // 7) 标签
    let tags = [];
    if (Game.persona && typeof Game.persona.tags === 'function') {
      try { tags = Game.persona.tags(); } catch (e) {}
    }

    // 8) 成就
    const achKeys = p.achievements ? Object.keys(p.achievements) : [];

    // 9) 心境
    const mental = p.mental || {};
    const mind = {
      peakStress: Math.round(mental.peakStress || 0),
      peakDepression: Math.round(mental.peakDepression || 0),
    };

    // 10) 合约
    const ct = s.contracts || {};
    const contracts = {
      kept: ct.kept || 0,
      failed: ct.failed || 0,
      badges: ct.badges ? Object.keys(ct.badges) : [],
    };

    // 11) 未竟之事
    let roads = [];
    if (Game.roads && typeof Game.roads.missed === 'function') {
      try { roads = Game.roads.missed(); } catch (e) {}
    } else if (s.roads && s.roads.missed) {
      roads = s.roads.missed;
    }

    // 12) 金手指用量
    const hexS = s.hex || {};
    const tycoonS = s.tycoon || {};
    const datalizeS = s.datalize || {};
    const cheats = {
      hex: hexS.on ? Math.round(hexS.spent || 0) : 0,
      tycoon: tycoonS.on ? Math.round(tycoonS.injected || 0) : 0,
      datalize: datalizeS.on ? Math.round(datalizeS.spent || 0) : 0,
    };

    // 13) 评分
    let score = 0;
    if (s.lastScore) score = s.lastScore.score;

    return {
      id: base.id, // 顶层 id 供 find() 按 id 查找
      v: 1, // 报告格式版本号，便于未来升级
      base, life, relInfo, fin, ocean,
      story, tags, achKeys, mind, contracts,
      roads, cheats, score,
    };
  }

  /* ---------------------------- 存储 ---------------------------- */
  function loadReports() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function saveReports(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
  }
  function saveReport(r) {
    const list = loadReports();
    list.push(r);
    list.sort((a, b) => (b.score || 0) - (a.score || 0));
    saveReports(list);
  }

  /* ---------------------------- 对外 API ---------------------------- */
  Game.report = {
    build: buildReport, // 供测试或外部直接调用
    load: loadReports,
    clear() { saveReports([]); },
    // 按 id 查找报告（供高分榜回放）
    find(id) { return loadReports().find((r) => r.id === id) || null; },
  };
})();
