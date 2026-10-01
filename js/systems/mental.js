/* =========================================================================
 * 系统 · 心理状态 (mental) —— 压力 / 抑郁 / 创伤
 * -------------------------------------------------------------------------
 * 让主角"有内心戏"：压力随处境累积、随行动缓解；长期高压催生抑郁；丧亲/大病/
 * 破产等留下创伤。心理反过来侵蚀心情与免疫，并把"burnout"伏笔交给因果系统回收。
 *
 * 与性格耦合：神经质(N)让压力涨得快、消得慢；宜人性(A)帮助释放。
 * 与其它系统：读 career/health/wealth/mood 施加压力，读家庭/婚恋/疾病事件施加创伤，
 * 行动栏的锻炼/冥想/社交/旅行/陪伴通过 applyEffects 直接降压（config.actions）。
 * 数值全在 config.mental。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const CF = C.mental;

  function clamp(v) { return u.clamp(v, 0, 100); }

  Game.systems
    .create('mental', 16)
    .on('state:reset', init)
    .on('month', monthly)
    .on('natfamily:death', () => addTrauma(CF.trauma.parentDeath))
    .on('family:widow', () => addTrauma(CF.trauma.spouseDeath))
    .on('family:divorce', () => addTrauma(CF.trauma.divorce))
    .on('disease:new', (e) => { if (e.disease.cfg.severity >= 40) addTrauma(CF.trauma.severeIllness); });

  function init() {
    const p = st.s.person;
    p.mental = {
      stress: CF.start.stress, depression: CF.start.depression, trauma: CF.start.trauma,
      peakStress: CF.start.stress, peakDepression: 0, peakTrauma: 0, _prevWealth: p.wealth || 0,
    };
  }

  function addTrauma(n) {
    const m = st.s.person.mental;
    if (!m) return;
    m.trauma = clamp(m.trauma + n);
    m.peakTrauma = Math.max(m.peakTrauma, m.trauma);
  }

  function monthly() {
    const p = st.s.person;
    const m = p.mental;
    if (!m || !p.alive) return;
    const pers = p.personality || { N: 50, A: 50 };
    const cfg = CF;

    // —— 压力：处境累加，性格调节，行动/时间缓解 ——
    let gain = cfg.stress.baseline;
    if (p.career && p.career.phase === 'employed') gain += cfg.stress.work;
    if (p.health < 50) gain += cfg.stress.lowHealth;
    if (st.s.diseases.some((d) => d.stage === 'acute' || d.stage === 'incubation')) gain += cfg.stress.sick;
    if ((p.wealth || 0) < 0) gain += cfg.stress.debt;
    if (p.mood < 40) gain += cfg.stress.lowMood;
    gain *= 1 + (pers.N - 50) * cfg.stress.nCoef;
    let decay = cfg.stress.decay * (1 + (pers.A - 50) * cfg.stress.aCoef) * (1 - (pers.N - 50) * cfg.stress.nDecay);
    if (decay < 0) decay = 0;
    m.stress = clamp(m.stress + gain - decay);

    // —— 破产是一次心理重创 ——
    if (m._prevWealth >= 0 && (p.wealth || 0) < 0) addTrauma(cfg.trauma.bankruptcy);
    m._prevWealth = p.wealth || 0;

    // —— 抑郁：长期高压 + 创伤累积；低压时自愈 ——
    if (m.stress > cfg.depression.stressThreshold) {
      m.depression += (m.stress - cfg.depression.stressThreshold) * cfg.depression.fromStress;
    }
    m.depression += m.trauma * cfg.depression.fromTrauma * 0.1;
    if (m.stress < cfg.depression.healStressBelow) m.depression -= cfg.depression.heal;
    m.depression = clamp(m.depression);

    // —— 创伤极缓慢平复 ——
    if (m.trauma > 0) m.trauma = Math.max(0, m.trauma - cfg.trauma.heal);

    // —— 心理 → 体征：长期压力/抑郁侵蚀心情与免疫 ——
    const dMood = -(cfg.carry.stressToMood * (m.stress / 100) + cfg.carry.depressionToMood * (m.depression / 100));
    const dImm = -(cfg.carry.stressToImmunity * (m.stress / 100) + cfg.carry.depressionToImmunity * (m.depression / 100));
    if (dMood) st.changeVital('mood', dMood, '心理');
    if (dImm) st.changeVital('immunity', dImm, '心理');

    // —— 压力爆表：向因果系统埋 burnout 伏笔（后续会弹"身心透支"）——
    if (m.stress >= cfg.burnoutStress && Game.consequences && !Game.consequences.has('burnout')) {
      Game.consequences.plant('burnout');
    }

    // —— 峰值记录（供成就/结算）——
    m.peakStress = Math.max(m.peakStress, m.stress);
    m.peakDepression = Math.max(m.peakDepression, m.depression);
    m.peakTrauma = Math.max(m.peakTrauma, m.trauma);
  }

  function state() {
    const m = st.s.person.mental;
    if (!m) return null;
    const level = (v) => (v >= 75 ? '严重' : v >= 50 ? '偏高' : v >= 25 ? '中等' : '平稳');
    return {
      stress: Math.round(m.stress),
      depression: Math.round(m.depression),
      trauma: Math.round(m.trauma),
      stressLevel: level(m.stress),
    };
  }

  Game.mental = {
    raw: () => st.s.person.mental,
    state,
    addTrauma,
  };
})();
