/* =========================================================================
 * 核心 · 全局状态 (state)
 * -------------------------------------------------------------------------
 * 唯一的数据源（Single Source of Truth）。系统读它、经 setter 改它，
 * setter 内部通过事件总线广播变化，UI 只读不算，避免逻辑分散。
 * ========================================================================= */
Game.state = (function () {
  const C = Game.config;
  const u = Game.util;
  const bus = Game.bus;

  const s = {
    // 时间轴
    clock: {
      tick: 0,
      year: C.time.startYear, // 出生年 = 真实公历年（默认 1990）
      month: 1,  // 1..12
      day: 1,    // 1..31
      season: 0, // 季节索引
      age: 0,    // 周岁
    },
    // 世界/环境
    world: {
      weather: null, // { type, name, emoji, tempC, desc, infection, mood }
    },
    // 人物
    person: {
      name: '阿生',
      gender: '男',
      surname: '',
      health: C.vitals.health0,
      immunity: C.vitals.immunity0,
      mood: C.vitals.mood0,
      alive: true,
      deathCause: '',
    },
    // 活跃疾病列表：[{key,cfg,stage,daysLeft,uid}]
    diseases: [],
    // 运行控制
    running: false,
    autoPause: true, // 自动暂停（参与感）：每月交界 / 每次事件弹出时自动置暂停（可在 UI 关闭）
    tps: C.time.speeds[1].tps,
    speedIndex: 1,
    // 统计
    stats: { daysAlive: 0, diseaseCount: 0, peakSeverity: 0 },
  };

  function clampVital(v) {
    return u.clamp(v, 0, 100);
  }

  // 通用体征修改：走事件，便于其它系统（心情/寿命/教育…）挂钩
  function changeVital(key, delta, source) {
    if (!delta) return s.person[key];
    const before = s.person[key];
    s.person[key] = clampVital(before + delta);
    bus.emit(key + ':change', {
      delta: s.person[key] - before,
      value: s.person[key],
      source: source || 'system',
      key,
    });
    return s.person[key];
  }

  function setVital(key, value, source) {
    return changeVital(key, value - s.person[key], source);
  }

  function addDisease(d) {
    s.diseases.push(d);
    s.stats.diseaseCount++;
  }

  function removeDisease(uid) {
    const i = s.diseases.findIndex((d) => d.uid === uid);
    if (i >= 0) return s.diseases.splice(i, 1)[0];
    return null;
  }

  function hasDisease(key) {
    return s.diseases.some((d) => d.key === key);
  }

  // 日志：附带当前年月日，UI 与导出都用它
  function log(msg, level, icon) {
    const c = s.clock;
    const time = c.year + '年' + c.month + '月' + c.day + '日';
    const entry = { time, msg, level: level || 'info', icon: icon || '' };
    (s.logLines || (s.logLines = [])).push(entry);
    if (s.logLines.length > C.log.maxLines) {
      s.logLines.splice(0, s.logLines.length - C.log.maxLines);
    }
    bus.emit('log', entry);
  }

  // —— 姓名/性别生成（供人物创建与婚恋系统复用）——
  function rollGender() {
    return u.pick(['男', '女']);
  }
  function rollSurname() {
    return u.pick(C.names.surname);
  }
  function rollGiven(gender) {
    return u.pick(gender === '男' ? C.names.male : C.names.female);
  }
  function rollFullName(gender) {
    return rollSurname() + rollGiven(gender);
  }

  // —— 共享"效果应用"：事件与主动行动都复用它来改写人物 ——
  // e: { health, immunity, mood, intelligence, knowledge, wealth, flags, source }
  function applyEffects(e) {
    if (!e) return;
    const p = s.person;
    const src = e.source || '事件';
    if (e.health) changeVital('health', e.health, src);
    if (e.immunity) changeVital('immunity', e.immunity, src);
    if (e.mood) changeVital('mood', e.mood, src);
    if (e.intelligence) p.intelligence = Math.round(u.clamp(p.intelligence + e.intelligence, 1, 99));
    if (e.knowledge) p.knowledge = Math.max(0, (p.knowledge || 0) + e.knowledge);
    if (e.wealth) p.wealth = Math.round((p.wealth + e.wealth) * 10) / 10;
    if (e.flags) Object.assign(p.flags, e.flags);
    // 心理状态（仅当 mental 系统已初始化 person.mental 时生效）
    if (p.mental) {
      if (e.stress) p.mental.stress = Math.round(u.clamp(p.mental.stress + e.stress, 0, 100));
      if (e.depression) p.mental.depression = Math.round(u.clamp(p.mental.depression + e.depression, 0, 100));
      if (e.trauma) p.mental.trauma = Math.round(u.clamp(p.mental.trauma + e.trauma, 0, 100));
    }
    // 性格可塑：e.pers = { E,A,C,N,O } 增量，改动当前人格（personality 系统负责回弹/封顶）
    if (e.pers && p.personality) {
      for (const k in e.pers) {
        if (k in p.personality) p.personality[k] = u.clamp(p.personality[k] + e.pers[k], 3, 99);
      }
      bus.emit('personality:shift', { pers: e.pers, source: src });
    }
  }

  function reset(newSeed) {
    if (newSeed != null) u.setSeed(newSeed);
    else u.setSeed(C.seed);
    Object.assign(s.clock, {
      tick: 0, year: C.time.startYear, month: 1, day: 1, season: C.seasonOfYear[0], age: 0,
    });
    // 人物身份：性别、姓名
    const gender = rollGender();
    const surname = rollSurname();
    Object.assign(s.person, {
      health: C.vitals.health0, immunity: C.vitals.immunity0,
      mood: C.vitals.mood0, alive: true, deathCause: '',
      gender: gender, surname: surname, name: surname + rollGiven(gender),
    });
    s.diseases = [];
    s.logLines = [];
    s.world.weather = null;
    s.stats = { daysAlive: 0, diseaseCount: 0, peakSeverity: 0 };
    s.running = false;
    bus.emit('state:reset', {});
  }

  return {
    s, changeVital, setVital, addDisease, removeDisease, hasDisease, log, reset,
    rollGender, rollSurname, rollGiven, rollFullName, applyEffects,
  };
})();
