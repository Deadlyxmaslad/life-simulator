/* =========================================================================
 * 系统 · 寿命 / 衰老 / 死亡 (lifespan)
 * -------------------------------------------------------------------------
 * 掌握"生老病死"里的"老"和"死"：
 *   · 每日：心情向基线回归；体检健康是否归零 → 死亡
 *   · 每年(生日)：年龄增长、衰老扣减、按 Gompertz 死亡率判定自然死亡
 * 疾病系统把健康扣到 0 时，这里负责"收口"宣告死亡并停止运行。
 *
 * 后续接"人生事件系统"(上学/工作/结婚/生育…)时，只要订阅 year/season 事件，
 * 按 stageOf(age) 在对应年龄段投放事件即可，无需改动本系统。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;

  Game.systems
    .create('lifespan', 40)
    .on('day', function () {
      moodHomeostasis();
      if (st.s.person.health <= 0) {
        die(deathByHealth());
      }
    })
    .on('year', function (e) {
      onBirthday(e.age);
    });

  /* ------------------------- 每日 ------------------------- */
  function moodHomeostasis() {
    // 心态自然平复：向 60 缓慢回归，抵消天气/疾病的持续累积
    const m = st.s.person.mood;
    st.changeVital('mood', (60 - m) * 0.02, '心态调节');
  }

  /* ------------------------- 生日 ------------------------- */
  function onBirthday(age) {
    const p = st.s.person;
    const stage = stageOf(age);

    // —— 衰老：中年后身体机能逐年下滑，健康与免疫上限下降 ——
    if (age > 40) {
      const decline = 0.15 + (age - 40) * 0.02;
      st.changeVital('health', -decline, '岁月·衰老');
      st.changeVital('immunity', -Math.min(0.4, decline * 0.6), '岁月·免疫下降');
    } else if (age > 18) {
      // 成年后基本稳定，略有损耗
      if (p.health > 75) st.changeVital('health', -0.05, '成年');
    }

    st.log('🎂 ' + age + ' 岁生日 · ' + stage, 'info', '🎂');
    bus.emit('birthday', { age, stage });

    // —— 长寿里程碑（B17）：给高寿一点仪式感（90 岁寿宴见 decisions 里程碑） ——
    if (age === 80) {
      st.changeVital('mood', 3, '耄耋之年的祝福');
      st.log('🥂 八十大寿：儿孙绕膝，故旧盈门。岁月终于对你温柔起来', 'good', '🥂');
    } else if (age === 100) {
      p.flags = p.flags || {};
      p.flags.centenarian = true;
      p.wealth = Math.round((p.wealth + 10) * 10) / 10; // 各界贺礼
      st.changeVital('mood', 10, '百岁庆典');
      st.log('🎊 百岁！你成了十里八乡最年长的人，贺信与祝福堆满了屋子', 'good', '🎊');
      bus.emit('birthday:century', { age });
    }

    // —— 死亡率判定（Gompertz 曲线 + 健康/疾病修正）——
    const hazard = annualHazard(age);
    if (u.chance(hazard)) {
      die('自然衰老（' + age + ' 岁）');
    }
    // 极端长寿硬上限
    if (age >= C.lifespan.maxAge) {
      die('寿终正寝（' + age + ' 岁）');
    }
  }

  function annualHazard(age) {
    const L = C.lifespan;
    // 随年龄指数增长的基础风险
    let h = L.gompertzA * Math.exp(L.gompertzB * (age - L.hazardAgeRef));
    // 健康越差越危险
    const hm = L.healthMortality;
    const healthFactor = hm.hi - (st.s.person.health / 100) * (hm.hi - hm.lo);
    h *= healthFactor;
    // 慢性病与急性病加重
    const chronic = st.s.diseases.filter((d) => d.stage === 'chronic').length;
    h *= 1 + chronic * 0.12;
    h *= Game.scenario.mortality(); // 剧本死亡难度
    return u.clamp(h, 0, 0.85);
  }

  /* ------------------------- 死亡收口 ------------------------- */
  function deathByHealth() {
    const active = st.s.diseases.map((d) => d.cfg.name);
    const main = st.s.diseases.sort((a, b) => b.cfg.severity - a.cfg.severity)[0];
    return (main ? main.cfg.name : '身体机能衰竭') + '（' + st.s.clock.age + ' 岁）';
  }

  function die(cause) {
    const p = st.s.person;
    if (!p.alive) return;
    // 唯一的死亡拦截点：外部模块（🦾 海克斯·死亡豁免）可请求豁免一次
    if (Game.hex && typeof Game.hex.onDeath === 'function' && Game.hex.onDeath(cause)) return;
    p.alive = false;
    p.deathCause = cause;
    st.s.running = false;
    p.health = Math.max(0, p.health);
    st.log('💀 一生落幕：' + cause, 'danger', '💀');
    bus.emit('death', { cause, age: st.s.clock.age });
  }

  function stageOf(age) {
    if (age <= 2) return '襁褓幼儿';
    if (age <= 6) return '学龄前';
    if (age <= 12) return '少年';
    if (age <= 17) return '青春期的少年';
    if (age <= 22) return '青年';
    if (age <= 35) return '而立之年';
    if (age <= 55) return '中年';
    if (age <= 70) return '花甲';
    if (age <= 85) return '古稀耄耋';
    return '期颐高龄';
  }

  // 暴露给 UI / 未来系统：当前预估剩余寿命、生命阶段
  Game.lifespan = {
    stageOf,
    // 显示用的粗略预期寿命（求 hazard 累积到 50% 的年龄）
    lifeExpectancy() {
      let surv = 1;
      for (let age = st.s.clock.age + 1; age <= C.lifespan.maxAge; age++) {
        surv *= 1 - annualHazard(age);
        if (surv < 0.5) return age;
      }
      return C.lifespan.maxAge;
    },
  };
})();
