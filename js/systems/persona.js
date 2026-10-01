/* =========================================================================
 * 系统 · 倾向标签 (persona) —— v1.6.0 玩法层 ②
 * -------------------------------------------------------------------------
 * "缺身份感"的补丁：不做硬性流派（那会逼模块之间产生耦合），只在**死亡结算时**
 * 按各自的使用量 / 风格，给这一生打上几枚身份标签（结算页展示）。
 *
 * 设计要点：
 *   - 独立 config 节 `config.persona` / 独立 state 子树 `state.persona`
 *   - 每条 tag 的 test(ctx) **只看自己关心的字段**，彼此独立判定
 *   - ctx 由本系统自己组装：读其它模块一律走 `Game.x && typeof ... === 'function'` 守卫
 *   - 纯只读：不修改任何状态；删掉本文件，引擎行为逐位不变
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const P = C.persona;

  if (!P) return;

  const EDU_RANK = ['—', '小学', '初中', '高中', '中专', '大专', '本科', '硕士', '博士'];

  Game.systems
    .create('persona', 86)     // contracts(85) 之后、score(90) 之前：death 时先打标签
    .on('state:reset', init)
    .on('death', run);

  function init() { st.s.persona = { tags: [] }; }
  function S() {
    if (!st.s.persona) st.s.persona = { tags: [] };
    return st.s.persona;
  }

  function safe(fn, d) {
    try { return !!fn(d); } catch (e) { return false; }
  }

  // 组装判定上下文：每个字段都来自"只读 + 守卫"，缺模块即取中性值，绝不报错
  function buildCtx(p) {
    const flags = p.flags || {};
    const mental = p.mental || {};
    const sm = (Game.consume && typeof Game.consume.summary === 'function') ? Game.consume.summary() : null;
    const eduRank = EDU_RANK.indexOf(p.education ? p.education.level : '—');
    const rank = sm
      ? (sm.peakTier === 'luxury' ? 3 : sm.peakTier === 'affluent' ? 2 : sm.peakTier === 'comfort' ? 1 : 0)
      : 0;

    return {
      // 金手指用量（只读各自账，不合并、不引入共享货币）
      hexSpent: (Game.hex && typeof Game.hex.spent === 'function') ? Game.hex.spent() : 0,
      tycoonInjected: (Game.tycoon && typeof Game.tycoon.injected === 'function') ? Game.tycoon.injected() : 0,
      dpSpent: (Game.datalize && typeof Game.datalize.spent === 'function') ? Game.datalize.spent() : 0,
      pure: !flags.used_hex && !flags.used_tycoon && !flags.used_datalize,
      // 学业 / 资产
      eduRank: eduRank < 0 ? 0 : eduRank,
      ownedHouses: p.assets ? (p.assets.houses ? p.assets.houses.length : 0) : 0,
      ownedCars: p.assets ? (p.assets.cars ? p.assets.cars.length : 0) : 0,
      assetTrades: p.assets ? (p.assets.buys || 0) + (p.assets.sells || 0) : 0,
      deeds: (function () {
        const list = (C.score && C.score.deedFlags) || ['kind', 'filial', 'familyFirst', 'honest'];
        return list.reduce((n, k) => n + (flags[k] ? 1 : 0), 0);
      })(),
      // 远行：行动"出门旅行"用满 6 次会攒够熟练度（G4），这里直接读该行动的熟练度
      studyAbroad: !!flags.studyAbroad,
      travelMastery: (p.actions && p.actions.mastery && p.actions.mastery.travel) || 0,
      // 心境的"从低谷爬出"
      peakStress: mental.peakStress || 0,
      stress: mental.stress || 0,
      // 生活品质 / 习惯
      consumeTierRank: rank,
      masteredHabits: (Game.habit && typeof Game.habit.masteredCount === 'function') ? Game.habit.masteredCount() : 0,
    };
  }

  function evaluate(p) {
    const ctx = buildCtx(p);
    const out = [];
    for (const tag of (P.tags || [])) {
      if (safe(tag.test, ctx)) out.push({ id: tag.id, emoji: tag.emoji, name: tag.name, desc: tag.desc });
    }
    return out.slice(0, P.maxTags || 5);
  }

  function run() {
    const p = st.s.person;
    if (!p) return [];
    const tags = evaluate(p);
    S().tags = tags;
    if (tags.length) {
      st.log('🏷️ 这一生的底色：' + tags.map((t) => t.emoji + t.name).join(' · '), 'info', '🏷️');
    }
    bus.emit('persona:done', { tags: tags });
    return tags;
  }

  Game.persona = {
    run, evaluate,
    tags() { return (S().tags || []).slice(); },
    count() { return (S().tags || []).length; },
    has(id) { return (S().tags || []).some((t) => t.id === id); },
    def(id) { return (P.tags || []).find((t) => t.id === id) || null; },
    pool() { return (P.tags || []).length; },
  };
})();
