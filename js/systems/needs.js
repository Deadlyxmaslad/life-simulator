/* =========================================================================
 * 系统 · 生理需求 (needs) —— v1.8.0
 * -------------------------------------------------------------------------
 * 模拟现实生活的底层生理节律：🍚饱食 / 😴精力 / 🚿卫生 / 🎉娱乐 四条需求条。
 * 设计取向（贴合本项目"人生模拟"定位）：
 *   1) **不制造打卡 chore**：有钱人过普通日子，月末自动兜底把需求稳在
 *      "凑合线"以上（自动吃饭 / 补觉到线 / 洗漱 / 刷手机）；需求的意义在
 *      **质量**——想拿"神清气爽"的月度加成，得主动用行动与消费推上 70+。
 *      兜底语义是"补到线"（max(现值, 地板)）而不是"加固定值"——否则
 *      衰减 > 回复时均衡点会钉在低位（实测导致过劳死亡螺旋）。
 *   2) **穷才是硬伤**：财富付不起饭钱时饱食会跌穿 25，进入营养不良
 *      （health/immunity/mood 月度流失）——把"负债→身体垮"的现实链条接上。
 *   3) **只读联动**：通过 bus 监听 action:done / consume:treat 给需求增量
 *      （delta 表在 config.needs），不修改 actions/consumption 任何代码；
 *      删掉本文件，引擎行为逐位不变。惩罚/加成一律走 st.applyEffects 通道。
 *   4) **零 RNG**： tick 全程不用随机数（哭诉日志走"穿越阈值"触发），
 *      不扰动全局种子流—— solvent 人生轨迹与无此系统逐位一致。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const N = C.needs;

  if (!N) return;

  Game.systems
    .create('needs', 62)   // career(60)/invest(61) 之后：先发工资再吃饭
    .on('state:reset', init)
    .on('month', tick)
    .on('action:done', onAction)
    .on('consume:treat', onTreat);

  function freshState() {
    return { satiety: 80, energy: 80, hygiene: 80, fun: 60, cried: {} };
  }
  function init() { st.s.needs = freshState(); }
  function S() {
    if (!st.s.needs) st.s.needs = freshState();
    return st.s.needs;
  }
  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function set(k, v) { S()[k] = clamp(v); }
  function person() { return st.s.person; }

  /* --------------------------- 月度推进 --------------------------- */
  function tick() {
    const p = person();
    if (!p || !p.alive) return;
    const s = S();
    const inDebt = (p.wealth || 0) < 0;
    const employed = !!(p.career && p.career.phase === 'employed');

    // 1) 自然衰减（负债吃得差、上班耗神，各有额外衰减）
    set('satiety', s.satiety - (N.decay.satiety + (inDebt ? N.debtExtraSatiety : 0)));
    set('energy', s.energy - (N.decay.energy + (employed ? N.workExtraEnergy : 0)));
    set('hygiene', s.hygiene - N.decay.hygiene);
    set('fun', s.fun - N.decay.fun);

    // 2) 生存兜底（普通人不经意就维持住的"凑合线"，语义是"补到线"）
    autoLive(p, s);

    // 3) 低位惩罚 / 高位加成（走 applyEffects 统一通道）
    applyLowPenalties(p, s);
    applyWellBonus(p, s);
  }

  function autoLive(p, s) {
    const A = N.auto;
    // 吃饭：饿了且买得起 → 自动花一小笔进食到"吃得饱"线（这就是日常饭钱，与生活开销并行）
    if (s.satiety < A.eatBelow && (p.wealth || 0) >= A.eatCost + 1) {
      p.wealth = Math.round(((p.wealth || 0) - A.eatCost) * 10) / 10;
      set('satiety', Math.max(s.satiety, A.eatFloor));
    }
    // 补觉：精力跌穿线 → 周末睡回"还行"（免费）
    if (s.energy < A.restBelow) set('energy', Math.max(s.energy, A.restFloor));
    // 洗漱打扫：日常卫生免费维持底线
    if (s.hygiene < A.cleanBelow) set('hygiene', Math.max(s.hygiene, A.cleanFloor));
    // 刷手机：最廉价的娱乐兜底
    if (s.fun < A.playBelow) set('fun', Math.max(s.fun, A.playFloor));
  }

  function applyLowPenalties(p, s) {
    const T = N.lowThreshold, ST = N.severeThreshold;
    for (const k in N.lowPenalty) {
      if (s[k] >= T) { s.cried[k] = false; continue; } // 回到线上：重置哭诉标记
      const eff = Object.assign({}, N.lowPenalty[k]);
      if (s[k] < ST && N.severeExtra[k]) Object.assign(eff, N.severeExtra[k]);
      eff.source = '需求·' + N.labels[k];
      st.applyEffects(eff);
      // 哭诉只在"跌穿严重线"那一刻说一次，不刷屏、不消耗随机流
      if (s[k] <= ST && !s.cried[k]) {
        s.cried[k] = true;
        st.log(N.cries[k], 'warn', '🥣');
      }
    }
  }

  function applyWellBonus(p, s) {
    const keys = ['satiety', 'energy', 'hygiene', 'fun'];
    const allWell = keys.every((k) => s[k] >= N.wellThreshold);
    if (!allWell) return;
    const eff = Object.assign({}, N.wellBonus);
    if (keys.every((k) => s[k] >= N.idealThreshold)) Object.assign(eff, N.idealBonus);
    eff.source = '需求·神清气爽';
    st.applyEffects(eff);
  }

  /* --------------------- 联动：行动与消费（只读事件） --------------------- */
  function onAction(e) {
    if (!e || !e.id || !person() || !person().alive) return;
    const delta = N.actionNeeds && N.actionNeeds[e.id];
    if (!delta) return;
    applyDelta(delta);
  }

  function onTreat(e) {
    if (!e || !person() || !person().alive) return;
    const map = N.treatNeeds || {};
    const delta = map[e.key] || map['default'];
    if (!delta) return;
    applyDelta(delta);
  }

  function applyDelta(delta) {
    const s = S();
    for (const k in delta) {
      if (k in s) set(k, s[k] + delta[k]);
    }
  }

  /* --------------------------- 对外 API --------------------------- */
  Game.needs = {
    state() {
      const s = S();
      const lowest = ['satiety', 'energy', 'hygiene', 'fun'].reduce((a, b) => (s[a] <= s[b] ? a : b));
      return {
        satiety: s.satiety, energy: s.energy, hygiene: s.hygiene, fun: s.fun,
        lowest,
      };
    },
    add: applyDelta, // 供未来模块只通过增量表互动（不直接改四条条）
    snapshot() { const s = S(); return JSON.parse(JSON.stringify(s)); },
    hydrate(m) { st.s.needs = m ? Object.assign(freshState(), m) : freshState(); },
  };
})();
