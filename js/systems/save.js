/* =========================================================================
 * 系统 · 存档 / 读档 (save)
 * -------------------------------------------------------------------------
 * 把整局状态快照进 localStorage（3 个槽位）。state 本身即纯数据，可直接序列化；
 * 只把两处"活引用"处理掉：疾病实例的 cfg（按 key 重建）与待处理抉择的 ev（按 id
 * 从 config 重建），避免函数丢失。读档后由 UI 负责刷新画面与恢复弹窗。
 * ========================================================================= */
(function () {
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const bus = Game.bus;
  const KEY = 'lifesim_slot_';

  // —— 金手指三模块（v1.2.0）——
  // 三者互不依赖，这里也**逐个独立搬运**：任一份缺失/被删，其余照常存取。
  // 旧版（v1.1.0 及更早）存档没有 modules 字段 → hydrate(null) 会各自复位到默认值。
  function moduleSnapshot() {
    const m = {};
    if (Game.hex && typeof Game.hex.snapshot === 'function') m.hex = Game.hex.snapshot();
    if (Game.tycoon && typeof Game.tycoon.snapshot === 'function') m.tycoon = Game.tycoon.snapshot();
    if (Game.datalize && typeof Game.datalize.snapshot === 'function') m.datalize = Game.datalize.snapshot();
    if (Game.habit && typeof Game.habit.snapshot === 'function') m.habit = Game.habit.snapshot();
    if (Game.consume && typeof Game.consume.snapshot === 'function') m.consume = Game.consume.snapshot();
    if (Game.needs && typeof Game.needs.snapshot === 'function') m.needs = Game.needs.snapshot();
    // —— 玩法层（v1.6.0）：各自独立一格，缺哪个就跳过哪个 ——
    if (Game.ap && typeof Game.ap.snapshot === 'function') m.ap = Game.ap.snapshot();
    if (Game.contracts && typeof Game.contracts.snapshot === 'function') m.contracts = Game.contracts.snapshot();
    if (Game.persona && typeof Game.persona.tags === 'function') m.persona = { tags: Game.persona.tags() };
    if (Game.meta && typeof Game.meta.snapshot === 'function') m.meta = Game.meta.snapshot();
    return m;
  }
  function moduleHydrate(m) {
    m = m || {};
    if (Game.hex && typeof Game.hex.hydrate === 'function') Game.hex.hydrate(m.hex || null);
    if (Game.tycoon && typeof Game.tycoon.hydrate === 'function') Game.tycoon.hydrate(m.tycoon || null);
    if (Game.datalize && typeof Game.datalize.hydrate === 'function') Game.datalize.hydrate(m.datalize || null);
    if (Game.habit && typeof Game.habit.hydrate === 'function') Game.habit.hydrate(m.habit || null);
    if (Game.consume && typeof Game.consume.hydrate === 'function') Game.consume.hydrate(m.consume || null);
    if (Game.needs && typeof Game.needs.hydrate === 'function') Game.needs.hydrate(m.needs || null);
    // —— 玩法层（v1.6.0）——
    if (Game.ap && typeof Game.ap.hydrate === 'function') Game.ap.hydrate(m.ap || null);
    if (Game.contracts && typeof Game.contracts.hydrate === 'function') Game.contracts.hydrate(m.contracts || null);
    if (Game.persona && typeof Game.persona === 'object' && m.persona) {
      // persona 是纯只读结果，只需把标签回填进 state（无 hydrate 时的兜底）
      if (!Game.state.s.persona) Game.state.s.persona = { tags: [] };
      Game.state.s.persona.tags = m.persona.tags || [];
    }
    if (Game.meta && typeof Game.meta.hydrate === 'function') Game.meta.hydrate(m.meta || null);
  }

  // —— 自动存档 / 自动续上（v1.2.0 补强）——
  // 让"读档"开箱即用：玩家不必记得先手动存档。关闭页面 / 刷新（beforeunload）与每跨一个
  // 游戏年度都会把"进行中"的人生写进一个独立"自动续档"槽；开局若检测到未完成进度则自动续上。
  const AUTO_KEY = 'lifesim_autosave';
  let lastAutoTs = 0;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function autoMeta(d) {
    if (!d || !d.person || !d.person.alive) return null;
    return {
      ts: d.ts, age: d.clock.age, name: d.person.name, gender: d.person.gender,
      level: d.person.education ? d.person.education.level : '—', version: d.version,
    };
  }
  function autoSave(force) {
    const s = st.s;
    if (!s || !s.person || !s.person.alive) return false;
    if (!s.clock || s.clock.tick <= 0) return false; // 刚开局的 0 帧不覆盖上次进度
    const now = Date.now();
    if (!force && now - lastAutoTs < 3000) return false; // 节流，避免极快速度下狂写
    try {
      localStorage.setItem(AUTO_KEY, JSON.stringify(snapshot()));
      lastAutoTs = now;
      return true;
    } catch (e) { return false; }
  }
  function autoLoad() {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!autoMeta(d)) { clearAuto(); return false; }
      restore(d);
      const w = new Date(d.ts);
      Game.state.log('📂 已自动续上上次的人生（存档于 ' + w.getFullYear() + '-' +
        (w.getMonth() + 1) + '-' + w.getDate() + ' ' + pad2(w.getHours()) + ':' +
        pad2(w.getMinutes()) + '，' + d.clock.age + ' 岁）。点击「开始一生」继续。', 'info', '📂');
      return true;
    } catch (e) { return false; }
  }
  function autoInfo() {
    try { const raw = localStorage.getItem(AUTO_KEY); if (!raw) return null; return autoMeta(JSON.parse(raw)); }
    catch (e) { return null; }
  }
  function hasAuto() { return !!autoInfo(); }
  function clearAuto() { lastAutoTs = 0; try { localStorage.removeItem(AUTO_KEY); } catch (e) {} }

  // 自动续档写入时机：每跨一个游戏年度（崩溃保险）+ 读档后续档也纳入自动续档
  bus.on('year', () => autoSave(false));
  bus.on('state:loaded', () => autoSave(false));
  // 已故人生与开新局（重开）不再自动续：清掉自动续档，下次开局就是全新命运
  bus.on('death', () => clearAuto());
  bus.on('state:reset', () => clearAuto());
  // 关闭 / 刷新页面时兜底保存（浏览器才有 beforeunload；无头测试里 window 无此 API，自动跳过）
  if (typeof window !== 'undefined' && window.addEventListener) {
    const onHide = () => autoSave(true);
    window.addEventListener('beforeunload', onHide);
    window.addEventListener('pagehide', onHide);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') autoSave(true);
      });
    }
  }

  function snapshot() {
    const s = st.s;
    return {
      version: Game.version,
      ts: Date.now(),
      seed: s.currentSeed,
      clock: s.clock,
      world: s.world,
      person: s.person,
      diseases: s.diseases.map((d) => ({
        uid: d.uid, key: d.key, stage: d.stage,
        daysLeft: d.daysLeft, reason: d.reason, removed: d.removed,
      })),
      logLines: s.logLines || [],
      stats: s.stats,
      timeline: s.timeline || [],
      curve: s.curve || [],
      market: s.market || null,
      speedIndex: s.speedIndex,
      pendingId: s.pendingDecision && s.pendingDecision.ev ? s.pendingDecision.ev.id : null,
      pendingAge: s.pendingDecision ? s.pendingDecision.age : null,
      modules: moduleSnapshot(),
    };
  }

  function restore(d) {
    const s = st.s;
    s.clock = d.clock;
    s.world = d.world || { weather: null };
    s.person = d.person;
    s.diseases = (d.diseases || []).map((x) => Object.assign({}, x, { cfg: C.diseases[x.key] }));
    s.logLines = d.logLines || [];
    s.stats = d.stats;
    s.timeline = d.timeline || [];
    s.curve = d.curve || [];
    s.market = d.market || s.market;
    s.speedIndex = d.speedIndex != null ? d.speedIndex : s.speedIndex;
    s.tps = C.time.speeds[s.speedIndex].tps;
    s.running = false;
    s.currentSeed = d.seed;
    moduleHydrate(d.modules);

    // 让随机流继续但不同于开局
    u.setSeed((((d.seed || 1) >>> 0) + d.clock.age * 366 + d.clock.tick) >>> 0);

    // 重新水合"待处理抉择"（若存档时正停在岔路口）
    s.pendingDecision = null;
    if (d.pendingId) {
      const ev = C.decisions.events.find((e) => e.id === d.pendingId);
      if (ev) s.pendingDecision = { ev, age: d.pendingAge };
    }
    Game.bus.emit('state:loaded', { version: d.version });
  }

  function info(slot) {
    try {
      const raw = localStorage.getItem(KEY + slot);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return {
        ts: d.ts, age: d.clock.age, name: d.person.name, gender: d.person.gender,
        level: d.person.education ? d.person.education.level : '—',
        seed: d.seed, version: d.version,
      };
    } catch (e) {
      return null;
    }
  }

  Game.save = {
    SLOTS: 3,
    keyPrefix: KEY,
    save(slot) {
      try {
        localStorage.setItem(KEY + slot, JSON.stringify(snapshot()));
        return true;
      } catch (e) {
        console.error('存档失败（localStorage 不可用？）', e);
        return false;
      }
    },
    load(slot) {
      try {
        const raw = localStorage.getItem(KEY + slot);
        if (!raw) return false;
        restore(JSON.parse(raw));
        return true;
      } catch (e) {
        console.error('读档失败', e);
        return false;
      }
    },
    remove(slot) {
      try {
        localStorage.removeItem(KEY + slot);
      } catch (e) {}
    },
    info,
    autoSave, autoLoad, autoInfo, hasAuto, clearAuto,
    AUTO_KEY,
    hasAny() {
      for (let i = 1; i <= Game.save.SLOTS; i++) if (info(i)) return true;
      return false;
    },
  };
})();
