/* =========================================================================
 * 系统 · 成就 (achievements)
 * -------------------------------------------------------------------------
 * 每年生日与死亡时，用一组 test(ctx) 评估是否解锁徽章；解锁即时写入日志、
 * 广播 achievement:unlock，并在死亡结算页展示"已获 / 全部"。
 * ctx 汇总人物一生信息；数值阈值全部来自 config.achievements，便于调整。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const A = C.achievements;

  Game.systems
    .create('achievements', 80)
    .on('state:reset', init)
    .on('year', () => {
      if (!st.s.person.alive) return;
      sample();
      evaluate(false);
    })
    .on('death', () => evaluate(true));

  function init() {
    const p = st.s.person;
    p.achievements = {};
    p._ast = { maxWealth: 0, maxFriends: 0 };
  }

  function buildCtx() {
    const p = st.s.person;
    const wealth = p.wealth || 0;
    const c = {
      alive: p.alive,
      age: st.s.clock.age,
      p,
      level: p.education ? p.education.level : '—',
      wealth,
      maxWealth: Math.max(p._ast.maxWealth || 0, wealth),
      income: p.career ? p.career.income || 0 : 0,
      job: p.career ? p.career.job : null,
      retired: p.career ? !!p.career.retired : false,
      workYears: p.career ? p.career.workYears || 0 : 0,
      children: p.relationship ? p.relationship.children.length : 0,
      married: !!(p.relationship && (p.relationship.married || p.relationship.widowed || p.relationship.divorced)),
      friends: p.social ? p.social.friends.length : 0,
      maxFriends: Math.max(p._ast.maxFriends || 0, p.social ? p.social.friends.length : 0),
      met: p.social ? p.social.met || 0 : 0,
      decisions: p.decisions ? p.decisions.count || 0 : 0,
      flags: p.flags || {},
      pers: p.personality || {},
      persDelta: Game.personality ? Game.personality.delta() : {},
      persMax: Game.personality ? Game.personality.maxDelta().v || 0 : 0,
      diseaseCount: st.s.stats.diseaseCount,
      origin: p.family ? p.family.origin : '—',
      fatherAlive: !!(p.family && p.family.father && p.family.father.alive),
      motherAlive: !!(p.family && p.family.mother && p.family.mother.alive),
      stress: p.mental ? p.mental.stress : 0,
      depression: p.mental ? p.mental.depression : 0,
      trauma: p.mental ? p.mental.trauma : 0,
      peakStress: p.mental ? p.mental.peakStress : 0,
      peakDepression: p.mental ? p.mental.peakDepression : 0,
      peakTrauma: p.mental ? p.mental.peakTrauma : 0,
      investOpened: !!(p.invest && p.invest.opened),
      investRealized: p.invest ? p.invest.realized || 0 : 0,
      peakNet: p.invest ? p.invest.peakNet || 0 : c.wealth,
      // —— v1.0 新增：资产（B6）与故事叙事（E1 / E3）维度 ——
      assets: p.assets || null,
      houses: p.assets ? p.assets.houses.length : 0,
      cars: p.assets ? p.assets.cars.length : 0,
      mortgage: p.assets ? p.assets.mortgage || 0 : 0,
      assetTrades: p.assets ? (p.assets.buys || 0) + (p.assets.sells || 0) : 0,
      assetPeakNet: p.assets ? p.assets.peakNet || 0 : 0,
      storyLines: Game.story ? Game.story.groups() : [],
      dims: Game.story ? Game.story.score().blended : null,
      ending: endingId(p),
      // —— v1.1 新增：行动熟练度（G4）——
      masteryMax: p.actions && p.actions.mastery
        ? Object.keys(p.actions.mastery).reduce((m, k) => Math.max(m, p.actions.mastery[k] || 0), 0)
        : 0,
      // —— v1.2 新增：金手指纯度（K4）——
      // 三个模块各自在自己的 flags 上记账，这里只是"分别读"，不合并、不引入共享货币。
      // 任一模块缺失或未使用 ⇒ 对应项视为未使用（纯局不受影响）。
      used: {
        hex: !!(p.flags || {}).used_hex,
        tycoon: !!(p.flags || {}).used_tycoon,
        datalize: !!(p.flags || {}).used_datalize,
      },
      pure: !(p.flags || {}).used_hex && !(p.flags || {}).used_tycoon && !(p.flags || {}).used_datalize,
      hexSpent: Game.hex && typeof Game.hex.spent === 'function' ? Game.hex.spent() : 0,
      tycoonInjected: Game.tycoon && typeof Game.tycoon.injected === 'function' ? Game.tycoon.injected() : 0,
      dpSpent: Game.datalize && typeof Game.datalize.spent === 'function' ? Game.datalize.spent() : 0,
      // —— v1.5 新增：消费模式（生活品质）——
      // 只读消费系统自己的账：累计消费、买入件数、一次性消费次数、达到过的最高档。
      consume: (function () {
        if (!Game.consume || typeof Game.consume.summary !== 'function') {
          return { spent: 0, buys: 0, treatCount: 0, peakTier: null, tierRank: 0 };
        }
        const sm = Game.consume.summary();
        const rank = sm.peakTier === 'luxury' ? 3 : sm.peakTier === 'affluent' ? 2 : sm.peakTier === 'comfort' ? 1 : 0;
        return { spent: sm.spent, buys: sm.buys, treatCount: sm.treatCount, peakTier: sm.peakTier, tierRank: rank };
      })(),
      ownedGoods: (function () {
        if (!Game.consume || typeof Game.consume.state !== 'function') return 0;
        const vs = Game.consume.state();
        return vs ? vs.owned.length : 0;
      })(),
      subsCount: (function () {
        if (!Game.consume || typeof Game.consume.state !== 'function') return 0;
        const vs = Game.consume.state();
        return vs ? vs.subscribed.length : 0;
      })(),
      // —— v1.6 新增：玩法层（合约 / 倾向标签 / 元进度 / 行动点）——
      // 各模块只读各自的账，任何一项缺失都取中性值，不影响其它判定。
      contracts: (function () {
        if (!Game.contracts || typeof Game.contracts.kept !== 'function') {
          return { kept: 0, failed: 0, badges: [] };
        }
        return {
          kept: Game.contracts.kept(),
          failed: Game.contracts.failed ? Game.contracts.failed() : 0,
          badges: (typeof Game.contracts.badges === 'function') ? Game.contracts.badges() : [],
        };
      })(),
      personaTags: (function () {
        if (!Game.persona || typeof Game.persona.tags !== 'function') return [];
        return Game.persona.tags().map(function (t) { return t.id; });
      })(),
      apEnabled: !!(Game.ap && typeof Game.ap.on === 'function' && Game.ap.on()),
      apThrifty: !!(Game.ap && typeof Game.ap.blockedCount === 'function' && Game.ap.blockedCount() === 0),
      metaUnlocked: (function () {
        if (!Game.meta || typeof Game.meta.unlocked !== 'function') return {};
        return Game.meta.unlocked();
      })(),
    };
    return c;
  }

  // 结局标识：优先取 story 系统的判定结果，其次回落到 flags.ending_*
  function endingId(p) {
    if (p.story && p.story.ending) return p.story.ending.id;
    const f = p.flags || {};
    for (const k in f) {
      if (k.indexOf('ending_') === 0) return k.slice(7);
    }
    return null;
  }

  function sample() {
    const p = st.s.person;
    const w = p.wealth || 0;
    const f = p.social ? p.social.friends.length : 0;
    p._ast.maxWealth = Math.max(p._ast.maxWealth || 0, w);
    p._ast.maxFriends = Math.max(p._ast.maxFriends || 0, f);
  }

  function evaluate(isDeath) {
    sample();
    const c = buildCtx();
    if (isDeath) c.alive = false;
    const p = st.s.person;
    for (const a of A) {
      if (p.achievements[a.id]) continue;
      let ok = false;
      try {
        ok = !!a.test(c);
      } catch (e) {
        ok = false;
      }
      if (ok) {
        p.achievements[a.id] = true;
        st.log('🏅 达成成就 · ' + a.emoji + ' ' + a.title + '（' + a.desc + '）', 'good', '🏅');
        bus.emit('achievement:unlock', { a });
      }
    }
  }

  Game.achievements = {
    all() {
      return A;
    },
    unlocked() {
      const p = st.s.person;
      const got = p.achievements || {};
      return A.filter((a) => got[a.id]);
    },
    has(id) {
      return !!((st.s.person.achievements || {})[id]);
    },
  };
})();
