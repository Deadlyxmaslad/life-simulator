/* =========================================================================
 * 系统 · 疾病 (disease)
 * -------------------------------------------------------------------------
 * 与天气、年龄、免疫力、健康耦合最紧密的一块，也是人生模拟"意外"的主要来源。
 * 每天：1) 推进已有病程  2) 结算健康/免疫/心情  3) 判定新发感染  4) 免疫恢复。
 *
 * 疾病阶段：潜伏 incubation → 发作 acute → (好转 recovery → 痊愈) 或 (慢性 chronic)
 * 新增疾病：往 config.diseases 加一条即可，这里自动生效（数据驱动）。
 * 新增机制（如受伤、瘟疫季）：照本文件的订阅方式再加即可。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;

  const MAX_CONCURRENT_ACUTE = 2; // 同时存在的急性病上限，避免叠加爆炸

  Game.systems
    .create('disease', 30)
    .on('day', function () {
      progressAll();
      immunityAndRecovery();
      rollNewInfection();
    });

  /* ------------------------- 病程推进与结算 ------------------------- */
  function progressAll() {
    const done = [];
    for (const d of st.s.diseases) {
      tickDisease(d);
      if (d.removed) done.push(d);
    }
  }

  function tickDisease(d) {
    const cfg = d.cfg;
    const p = st.s.person;
    // 免疫力越强，同样的病造成的健康损耗越小（免疫缓冲伤害）
    const mitigation = u.clamp(1 - p.immunity / 220, 0.5, 1);

    // —— 各阶段对体征的每日影响 ——
    if (d.stage === 'acute') {
      st.changeVital('health', -cfg.healthDrain * mitigation, cfg.name);
      st.changeVital('immunity', -cfg.immunityCost * 0.3, cfg.name);
      st.changeVital('mood', -cfg.severity * 0.02, '患病·' + cfg.name);
      st.s.stats.peakSeverity = Math.max(st.s.stats.peakSeverity, cfg.severity);
    } else if (d.stage === 'recovery') {
      st.changeVital('health', 0.9 * mitigation, '康复·' + cfg.name);
      st.changeVital('mood', +0.3, '好转·' + cfg.name);
    } else if (d.stage === 'chronic') {
      st.changeVital('health', -cfg.healthDrain, '慢性·' + cfg.name);
      st.changeVital('immunity', -cfg.immunityCost * 0.3, '慢性·' + cfg.name);
      st.changeVital('mood', -0.15, '慢性·' + cfg.name);
    }

    if (d.stage === 'chronic') return; // 慢性病不带计时

    d.daysLeft -= 1;
    if (d.daysLeft > 0) return;

    // —— 阶段切换 ——
    if (d.stage === 'incubation') {
      d.stage = 'acute';
      d.daysLeft = cfg.acute;
      st.log(cfg.emoji + ' ' + cfg.name + '发作：' + cfg.desc, 'warn', cfg.emoji);
      bus.emit('disease:symptom', { disease: d });
    } else if (d.stage === 'acute') {
      maybeComplication(d);
      if (d.removed) return; // 可能已被替换
      const goChronic = cfg.chronicChance > 0 && u.chance(cfg.chronicChance);
      if (goChronic) {
        d.stage = 'chronic';
        st.log('😞 ' + cfg.name + '迁延不愈，转为慢性', 'warn', '🩺');
        bus.emit('disease:end', { disease: d, outcome: 'chronic' });
      } else {
        d.stage = 'recovery';
        d.daysLeft = cfg.recovery;
      }
    } else if (d.stage === 'recovery') {
      finishDisease(d, '康复');
    }
  }

  function finishDisease(d, word) {
    d.removed = true;
    st.removeDisease(d.uid);
    st.log('✅ 从' + d.cfg.name + '中' + word + '，恢复健康', 'good', '✅');
    st.changeVital('mood', +1.5, '康复·' + d.cfg.name);
    bus.emit('disease:end', { disease: d, outcome: word });
  }

  // 急性期在低免疫/低健康时可能恶化为更严重的并发症
  function maybeComplication(d) {
    const p = st.s.person;
    if (p.immunity < 38 && p.health < 42) {
      if ((d.key === 'cold' || d.key === 'flu') && !st.hasDisease('fever') && u.chance(0.05)) {
        escalate(d, 'fever');
      }
      if ((d.key === 'fever' || d.key === 'bronchitis') && !st.hasDisease('pneumonia') && u.chance(0.06)) {
        escalate(d, 'pneumonia');
      }
    }
  }

  function escalate(from, toKey) {
    st.removeDisease(from.uid);
    from.removed = true;
    st.log('⚠️ ' + from.cfg.name + '恶化为' + C.diseases[toKey].name + '！', 'danger', C.diseases[toKey].emoji);
    contract(toKey, '并发症');
  }

  /* ------------------------- 免疫与自愈恢复 ------------------------- */
  function immunityAndRecovery() {
    const p = st.s.person;
    const c = st.s.clock;
    const activeAcute = st.s.diseases.filter((d) => d.stage === 'acute' || d.stage === 'incubation');

    // 免疫随年龄下滑的自然基线（老年免疫力更低）
    const ageImmunityPenalty = c.age > 50 ? (c.age - 50) * 0.15 : 0;
    const target = Math.max(20, C.vitals.immunityBaseline - ageImmunityPenalty - st.s.diseases.filter((d) => d.stage === 'chronic').length * 8);

    if (activeAcute.length === 0) {
      // 无急性病：免疫向基线回升，健康缓慢恢复
      if (p.immunity < target) st.changeVital('immunity', C.vitals.immunityRegen, '休养');
      if (p.health < 100) {
        const regen = C.vitals.healthRegen * (p.immunity > 50 ? 1.4 : 0.7);
        st.changeVital('health', regen, '静养');
      }
    }
  }

  /* ------------------------- 新发感染判定 ------------------------- */
  function rollNewInfection() {
    const p = st.s.person;
    const c = st.s.clock;
    const w = st.s.world.weather;
    if (!w) return;

    // 高温 → 中暑（天气触发的特异疾病）
    if (w.type === 'heatwave' && !st.hasDisease('heatstroke') && u.chance(0.06 * ageFactor(c.age))) {
      contract('heatstroke', '热浪');
    }

    const acuteCount = st.s.diseases.filter((d) => d.stage !== 'chronic').length;
    if (acuteCount >= MAX_CONCURRENT_ACUTE) return;

    const immunityFactor = u.clamp(1 - p.immunity / 100, 0.05, 1);
    const healthFactor = 1 + (100 - p.health) / 150;
    const af = ageFactor(c.age);

    // 每日总感染风险：天气 × 年龄易感 × 免疫缺口 × 健康缺口 ×（剧本）疾病难度
    let risk = 0.0032 * w.infection * af * immunityFactor * healthFactor * Game.scenario.disease();
    risk *= Math.max(0.1, 1 - 0.35 * acuteCount); // 已生病时降低叠加
    // 慢性病年龄风险：不通过上式，单独判定
    if (u.chance(risk)) {
      const pick = chooseRespiratory(w);
      if (pick && !st.hasDisease(pick)) contract(pick, '感染·' + w.name);
    }

    // 慢性病（年老体衰）随年龄累积
    const chronicRisk = C.lifespan.chronicAgeRisk(c.age) * (p.health < 60 ? 1.5 : 1);
    if (c.age > 45 && !st.hasDisease('chronic') && u.chance(chronicRisk)) {
      contract('chronic', '年老');
    }
  }

  function chooseRespiratory(w) {
    const c = st.s.clock;
    const pool = [];
    // 呼吸道感染：传染性 × 当前天气适宜度
    for (const key of ['cold', 'flu', 'bronchitis', 'pneumonia']) {
      const cfg = C.diseases[key];
      if (!cfg.contagious) continue;
      let weight = cfg.contagious;
      // 老人更易得流感/肺炎（幼儿靠免疫缓冲与降频保护）
      if ((key === 'flu' || key === 'pneumonia') && c.age > 60) weight *= 1.5;
      if (key === 'cold') weight *= 1.3; // 感冒最常见
      pool.push({ item: key, weight });
    }
    return u.weighted(pool);
  }

  // 年龄对易感性的放大：幼童与老人更高（婴幼儿适度提高，避免过量）
  function ageFactor(age) {
    if (age < 5) return 1.35;
    if (age < 12) return 1.1;
    if (age <= 45) return 1.0;
    return u.clamp(1.0 + (age - 45) * 0.03, 1.0, 3.0);
  }

  /* ------------------------- 感染落地 ------------------------- */
  function contract(key, reason) {
    const cfg = C.diseases[key];
    if (!cfg) return null;
    const stage = cfg.incubation > 0 ? 'incubation' : cfg.isChronic ? 'chronic' : 'acute';
    const d = {
      uid: u.uid('dis'),
      key,
      cfg,
      stage,
      daysLeft: cfg.incubation > 0 ? cfg.incubation : cfg.acute,
      reason: reason || '',
      removed: false,
    };
    st.addDisease(d);
    bus.emit('disease:new', { disease: d, reason });
    if (stage === 'acute') {
      st.log(cfg.emoji + ' 患上了' + cfg.name + '（' + (reason || '不明') + '）', 'warn', cfg.emoji);
    } else if (stage === 'chronic') {
      st.log('🩺 确诊' + cfg.name + '：' + cfg.desc, 'warn', '🩺');
    } else {
      st.log('🤒 有' + cfg.name + '的潜伏迹象，尚未发作', 'info', '🤒');
    }
    return d;
  }

  // 暴露一个契约，方便以后"医疗/锻炼/疫苗"等系统减少疾病风险
  Game.disease = { contract, ageFactor };
})();
