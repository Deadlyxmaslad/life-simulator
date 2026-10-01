/* =========================================================================
 * 系统 · 天气 (weather)
 * -------------------------------------------------------------------------
 * 每天根据季节天气谱随机生成天气，产出对健康/免疫/心情的"环境因子"。
 * 天气是疾病系统的重要输入（infection 感染风险倍率），也直接影响心情。
 *
 * 可扩展点：
 *  - 换城市/气候带 → 加更多 seasonProfile 或按 person.location 选择。
 *  - 极端天气事件 → 在此按概率注入 heatwave/cold/typhoon 等。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;

  let lastType = null;
  const PERSIST_CHANCE = 0.42; // 与昨天同性质的概率，制造连续性

  Game.systems
    .create('weather', 20)
    .on('day', function () {
      generateWeather();
      applyMoodEffect();
    })
    .on('state:reset', function () {
      lastType = null; // 新的一局，天气记忆清零
      generateWeather(); // 立即生成开局首帧天气，避免空窗
    });

  function currentProfile() {
    const seasonKey = C.seasonMeta[st.s.clock.season].key;
    return C.weatherProfiles[seasonKey];
  }

  function generateWeather() {
    const profile = currentProfile();
    const entries = Object.keys(profile).map((k) => ({ item: k, weight: profile[k].w }));

    let type;
    if (lastType && profile[lastType] && u.chance(PERSIST_CHANCE)) {
      type = lastType; // 延续昨天的天气
    } else {
      type = u.weighted(entries);
    }
    lastType = type;

    const p = profile[type];
    const baseTemp = C.seasonMeta[st.s.clock.season].baseTemp;
    const tempC = Math.round(u.gauss(baseTemp + p.temp, 3));

    const weather = {
      type,
      name: C.weatherNames[type] || type,
      emoji: emojiFor(type, st.s.clock.season),
      tempC,
      infection: p.infection, // 感染风险倍率 → 疾病系统读取
      mood: p.mood,           // 每日心情影响
      desc: p.desc,
      season: st.s.clock.season,
    };
    st.s.world.weather = weather;
    bus.emit('weather:change', { weather });
  }

  function emojiFor(type, season) {
    const map = {
      sunny: '☀️', cloudy: '☁️', rain: '🌧️', shower: '🌦️', storm: '⛈️',
      fog: '🌫️', haze: '😷', heatwave: '🔥', cold: '🥶', snow: '❄️',
    };
    return map[type] || '🌤️';
  }

  // 把天气的心情影响落到体征上（很轻微，长期阴冷/雾霾会明显压心情）
  function applyMoodEffect() {
    const w = st.s.world.weather;
    if (!w) return;
    st.changeVital('mood', w.mood * 0.4, '天气·' + w.name);
  }
})();
