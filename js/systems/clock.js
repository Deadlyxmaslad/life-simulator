/* =========================================================================
 * 系统 · 时钟 / 历法 (clock)
 * -------------------------------------------------------------------------
 * 负责推进时间：day → month → year(生日) → season(季节)。
 * 它是"事件源头"，多数系统都订阅它派生出的 day / season / year 事件。
 * priority 最小（10），保证在一个 tick 内它最先执行。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;

  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function isLeap(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }
  function daysInMonth(year, month) {
    if (month === 2 && isLeap(year)) return 29;
    return DAYS_IN_MONTH[month - 1];
  }

  function seasonOf(month) {
    return C.seasonOfYear[(month - 1) % 12];
  }

  Game.systems
    .create('clock', 10)
    .update(function () {
      const c = st.s.clock;
      c.tick += 1;
      const steps = C.time.daysPerTick;

      for (let i = 0; i < steps; i++) {
        advanceOneDay();
      }
    });

  function advanceOneDay() {
    const c = st.s.clock;
    const prevSeason = c.season;

    c.day += 1;
    if (c.day > daysInMonth(c.year, c.month)) {
      c.day = 1;
      c.month += 1;
      let newYear = false;
      if (c.month > 12) {
        c.month = 1;
        c.year += 1;
        c.age = c.year - C.time.startYear; // 周岁 = 真实年份 − 出生年
        newYear = true;
      }
      bus.emit('month', { month: c.month, year: c.year });
      if (newYear) bus.emit('year', { age: c.age, year: c.year });
    }

    c.season = seasonOf(c.month);
    if (c.season !== prevSeason) {
      const meta = C.seasonMeta[c.season];
      bus.emit('season', { season: c.season, meta });
    }

    st.s.stats.daysAlive += 1;
    bus.emit('day', { date: { y: c.year, m: c.month, d: c.day, age: c.age, season: c.season } });
  }
})();
