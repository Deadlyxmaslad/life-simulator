/* =========================================================================
 * 系统 · 性格 (personality)
 * -------------------------------------------------------------------------
 * 大五人格（OCEAN）：外向 E / 宜人 A / 尽责 C / 神经质 N / 开放 O，
 * 出生即掷定，之后基本不变——它是一个人一生的"底色"。
 *
 * 本系统自身产生的直接影响：
 *   · 心情设定点：外向者基调更高、神经质者更低，每天都在向设定点靠拢；
 *   · 情绪波动：神经质高的人更常有情绪起伏；
 *   · 尽责者生活习惯略好，健康有极轻微加成。
 * 更关键的是它作为一份"能力契约"被社交系统读取（外向→更容易交友）。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const PS = C.personality;

  Game.systems
    .create('personality', 15)
    .on('state:reset', rollPersonality)
    .on('year', yearlyPlasticity)
    .on('day', dailyInfluence);

  function rollPersonality() {
    const p = st.s.person;
    const r = PS.roll;
    const pb = Game.scenario.persBonus(); // 剧本：正向性格偏移（天选之人 E/A/C/O↑、N↓）
    const roll = (sign) => Math.round(u.clamp(u.gauss(r.mean, r.sd) + sign * pb, r.min, r.max));
    p.personality = { E: roll(1), A: roll(1), C: roll(1), N: roll(-1), O: roll(1) };
    p.personality0 = Object.assign({}, p.personality); // 出厂设定（可塑的回弹锚点）
    bus.emit('personality:roll', { personality: p.personality });
  }

  // 每年：性格向出厂设定缓慢回弹，并把偏离限制在 ±maxShift 内（"江山易改本性难移"）
  function yearlyPlasticity() {
    const p = st.s.person;
    const pers = p.personality, base = p.personality0;
    if (!pers || !base || !p.alive) return;
    const P = PS.plasticity;
    for (const k in pers) {
      let v = pers[k] + (base[k] - pers[k]) * P.rebound; // 向本性回归
      v = u.clamp(v, base[k] - P.maxShift, base[k] + P.maxShift); // 可塑封顶
      pers[k] = Math.round(u.clamp(v, 3, 99));
    }
  }

  function setpoint(pers) {
    const m = PS.moodSetpoint;
    return m.base + (pers.E - 50) * m.eCoef - (pers.N - 50) * m.nCoef;
  }

  function dailyInfluence() {
    const p = st.s.person;
    const pers = p.personality;
    if (!pers || !p.alive) return;

    // 心情向性格设定点缓慢回归
    const target = u.clamp(setpoint(pers), 20, 92);
    st.changeVital('mood', (target - p.mood) * PS.moodSetpoint.pull, '性情');

    // 神经质：偶发情绪波动
    if (u.chance(PS.volatility.chance * (pers.N / 50))) {
      const dir = u.chance(0.6) ? -1 : 1; // 更易往下
      st.changeVital('mood', dir * u.range(2, PS.volatility.amp) * (pers.N / 60), '情绪波动');
    }

    // 尽责性：自律带来一点健康自律红利
    if (pers.C > 50) {
      st.changeVital('health', PS.conscientiousHealth.coef * (pers.C - 50) / 50, '自律');
    }
  }

  function label(key, v) {
    const arr = PS.labels[key] || [];
    const idx = u.clamp(Math.floor(v / 20), 0, arr.length - 1);
    return arr[idx] || '';
  }

  // 契约：社交系统与其它玩法据此判断性格
  Game.personality = {
    dims: PS.dims,
    current() {
      return st.s.person.personality;
    },
    base() {
      return st.s.person.personality0;
    },
    // 相对出厂设定的偏移 {E,A,C,N,O}
    delta() {
      const p = st.s.person;
      const cur = p.personality, base = p.personality0;
      const d = {};
      if (cur && base) for (const k in cur) d[k] = cur[k] - base[k];
      return d;
    },
    maxDelta() {
      const d = this.delta();
      let best = { key: null, v: 0 };
      for (const k in d) if (Math.abs(d[k]) > Math.abs(best.v)) best = { key: k, v: d[k] };
      return best;
    },
    label,
    get(key) {
      const p = st.s.person.personality;
      return p ? p[key] : 50;
    },
    // 一句话性格画像（取最强/最弱维度）
    summary() {
      const p = st.s.person.personality;
      if (!p) return '';
      let hi = PS.dims[0], lo = PS.dims[0];
      for (const d of PS.dims) {
        if (p[d.key] > p[hi.key]) hi = d;
        if (p[d.key] < p[lo.key]) lo = d;
      }
      return '最' + label(hi.key, p[hi.key]) + '，偏' + label(lo.key, p[lo.key]);
    },
  };
})();
