/* =========================================================================
 * 系统 · 元进度解锁 (meta) —— v1.6.0 玩法层 ③
 * -------------------------------------------------------------------------
 * 跨周目钩子：把"这一局的成果"沉淀到 localStorage，用来**分别解锁**三个金手指模块。
 * 高分榜只有分数，这里补上"越玩越开"的长期动机。
 *
 * 设计要点：
 *   - 独立存储键 `config.meta.key`（默认 lifesim_meta），**不与存档 / 榜单混用**
 *   - 三个模块**各自独立解锁**：锁着的那一个不得影响其它任意模块的行为
 *   - **不改金手指模块的任何代码**：只在这里读它们的 config.gates + 在 `month`/`state:reset`
 *     时把"未解锁模块"的运行态开关（`state.<mod>.on`）关回去；模块自己照常跑
 *   - `state.meta` 只是本周目的镜像（用于 UI 展示），删掉本文件引擎行为逐位不变
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const M = C.meta;

  if (!M) return;

  const LS = (function () {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  })();

  Game.systems
    .create('meta', 5)          // 最早：先决定"哪些模块可用"，再让其它的跑
    .on('state:reset', onReset)
    .on('month', enforce)
    .on('death', onDeath);

  function freshState() {
    return { deaths: 0, achievements: 0, endings: [], unlocked: {}, lastCheck: 0 };
  }
  function S() {
    if (!st.s.meta) st.s.meta = freshState();
    return st.s.meta;
  }

  /* --------------------------- 持久化（独立键） --------------------------- */
  function loadStore() {
    if (!LS) return { deaths: 0, achievements: 0, endings: [] };
    try {
      const raw = LS.getItem(M.key || 'lifesim_meta');
      if (!raw) return { deaths: 0, achievements: 0, endings: [] };
      const d = JSON.parse(raw);
      return {
        deaths: d.deaths || 0,
        achievements: d.achievements || 0,
        endings: Array.isArray(d.endings) ? d.endings : [],
      };
    } catch (e) { return { deaths: 0, achievements: 0, endings: [] }; }
  }
  function saveStore(d) {
    if (!LS) return false;
    try { LS.setItem(M.key || 'lifesim_meta', JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  function gateOf(mod) {
    for (const g of (M.gates || [])) if (g.module === mod) return g;
    return null;
  }

  // 逐条评估解锁条件。三个模块各自判定，互不影响。
  function evaluateUnlocked(store) {
    const out = {};
    for (const g of (M.gates || [])) {
      const u = g.unlock;
      if (!u) { out[g.module] = true; continue; }   // 无门槛 ⇒ 默认可用
      let ok = false;
      if (u.mode === 'or') {
        ok = (u.deaths != null && store.deaths >= u.deaths) ||
             (u.achievements != null && store.achievements >= u.achievements) ||
             (u.endings != null && (store.endings || []).length >= u.endings);
      } else {
        ok = true;
        if (u.deaths != null && store.deaths < u.deaths) ok = false;
        if (u.achievements != null && store.achievements < u.achievements) ok = false;
        if (u.endings != null && (store.endings || []).length < u.endings) ok = false;
      }
      out[g.module] = ok;
    }
    return out;
  }

  /* --------------------------- 把锁定落到实处 --------------------------- */
  // 只在 **hardLock** 时把锁定落到实处；soft（默认）只算状态、供 UI 标注，不动玩家的开关。
  function hardLock() { return M.hardLock === true; }

  function forceOff(mod) {
    const s = st.s[mod];
    if (s && s.on) s.on = false;
    if (mod === 'hex' && Game.util && typeof Game.util.setLuckMul === 'function') {
      try { Game.util.setLuckMul(1); } catch (err) { /* 忽略 */ }
    }
  }

  function enforce() {
    if (!hardLock()) return;              // soft：不拦截
    const s = S();
    if (!s || !s.unlocked) return;
    for (const mod of ['hex', 'tycoon', 'datalize']) {
      if (s.unlocked[mod] === false) forceOff(mod);
    }
  }

  function refresh(fromReset) {
    const store = loadStore();
    const s = S();
    s.deaths = store.deaths;
    s.achievements = store.achievements;
    s.endings = (store.endings || []).slice();
    s.unlocked = evaluateUnlocked(store);
    enforce();
    bus.emit('meta:refreshed', { unlocked: Object.assign({}, s.unlocked) });
    void fromReset;
    return s.unlocked;
  }

  function onReset() {
    st.s.meta = freshState();
    refresh(true);
  }

  /* --------------------------- 生命周期：死亡时把成果写回去 --------------------------- */
  function onDeath() {
    const p = st.s.person;
    if (!p) return;
    const store = loadStore();

    store.deaths = (store.deaths || 0) + 1;

    const ach = p.achievements ? Object.keys(p.achievements).length : 0;
    if (ach > (store.achievements || 0)) store.achievements = ach;

    // 结局：从 story 系统或 person.flags 里读（守卫式，缺了就当没有）
    let ending = null;
    if (Game.story && typeof Game.story.ending === 'function') {
      try {
        const e = Game.story.ending();     // {id,name,emoji,desc} | null
        if (e && e.id) ending = e.id;
      } catch (err) { ending = null; }
    }
    if (!ending && p.flags) {
      for (const k in p.flags) {
        if (/^ending_/.test(k) && p.flags[k]) { ending = k.replace(/^ending_/, ''); break; }
      }
    }
    if (ending) {
      if (!Array.isArray(store.endings)) store.endings = [];
      if (store.endings.indexOf(ending) < 0) store.endings.push(ending);
    }

    saveStore(store);

    // 立刻按新数据刷新解锁表（本次结算页即可显示"新解锁了什么"）
    const before = Object.assign({}, S().unlocked);
    refresh(false);
    const after = S().unlocked;
    const justOpened = [];
    for (const k in after) if (after[k] && before[k] === false) justOpened.push(k);
    if (justOpened.length) {
      const names = { hex: '🧬 海克斯', tycoon: '💰 神壕', datalize: '📊 人数数据化' };
      st.log('🔓 元进度解锁：' + justOpened.map((k) => names[k] || k).join('、') +
        ' —— 下一局可用。', 'good', '🔓');
      bus.emit('meta:unlocked', { modules: justOpened.slice() });
    }
  }

  /* --------------------------- 对外 API --------------------------- */
  Game.meta = {
    // 三个模块各自的解锁状态。
    // 注意：`!== false` 的写法只在 unlocked 表"已评估过"时安全；这里补一层
    // 兜底 —— 表里没有该键时回落到 gate 的静态默认（无 unlock ⇒ 可用）。
    unlocked(mod) {
      const u = S().unlocked || {};
      if (mod) {
        if (u[mod] === true) return true;
        if (u[mod] === false) return false;
        const g = gateOf(mod);
        return !g || !g.unlock;
      }
      const out = Object.assign({}, u);
      for (const g of (M.gates || [])) {
        if (out[g.module] == null) out[g.module] = !g.unlock;
      }
      return out;
    },
    isLocked(mod) { return !Game.meta.unlocked(mod); },
    gates() { return (M.gates || []).slice(); },
    gateOf,
    stats() {
      const s = S();
      return { deaths: s.deaths, achievements: s.achievements, endings: (s.endings || []).slice() };
    },
    refresh,
    enforce,
    // 进度提示：距离解锁还差多少
    progress(mod) {
      const g = gateOf(mod);
      if (!g || !g.unlock) return { unlocked: true, note: '' };
      const s = S();
      const u = g.unlock;
      if (u.mode === 'or') {
        const parts = [];
        if (u.deaths != null) parts.push('通关 ' + s.deaths + '/' + u.deaths + ' 局');
        if (u.achievements != null) parts.push('成就 ' + s.achievements + '/' + u.achievements);
        if (u.endings != null) parts.push('结局 ' + (s.endings || []).length + '/' + u.endings);
        return { unlocked: Game.meta.unlocked(mod), note: parts.join(' · ') + '（任一达成）' };
      }
      const parts = [];
      if (u.deaths != null) parts.push('通关 ' + s.deaths + '/' + u.deaths);
      if (u.achievements != null) parts.push('成就 ' + s.achievements + '/' + u.achievements);
      if (u.endings != null) parts.push('结局 ' + (s.endings || []).length + '/' + u.endings);
      return { unlocked: Game.meta.unlocked(mod), note: parts.join(' · ') };
    },
    // 仅供调试 / 测试：直接改写解锁结果（不落盘）
    _setUnlocked(mod, on) {
      const s = S();
      if (!s.unlocked) s.unlocked = {};
      s.unlocked[mod] = !!on;
      enforce();
    },
    // 仅供测试：清空持久化
    _clearStore() { if (LS) { try { LS.removeItem(M.key || 'lifesim_meta'); } catch (e) { /* 忽略 */ } } },
    snapshot() { const s = S(); return JSON.parse(JSON.stringify(s)); },
    hydrate(m) {
      const s = freshState();
      if (m) {
        s.deaths = m.deaths || 0;
        s.achievements = m.achievements || 0;
        s.endings = m.endings || [];
        s.unlocked = m.unlocked || {};
        s.lastCheck = m.lastCheck || 0;
      } else {
        // hydrate(null) ⇒ 回到"按持久化数据重新评估"的初始态，
        // 不能留空 unlocked（否则 unlocked(mod) 会因 `!== false` 误判为已解锁）
        s.unlocked = evaluateUnlocked(loadStore());
      }
      st.s.meta = s;
      enforce();
    },
  };
})();
