/* =========================================================================
 * 系统 · 月行动点 AP (ap) —— v1.6.0 玩法层 ④
 * -------------------------------------------------------------------------
 * "主动手段少"的补丁：给每月的行动栏加一份预算，让"这个月先做什么"成为选择。
 *
 * ⚠️ AP 涉及 actions.js 全部行动项，属**全局改动** —— 因此：
 *   - **默认关闭**（`config.ap.enabled === false`）：不开就完全不存在，手感不变
 *   - 默认 **soft 模式**：只做计数 + 提示，**不硬性阻断**（进度条见底也不拦你）
 *   - `mode: 'hard'` 时才在耗尽后拒绝行动（此时才包装 `Game.actions.do`）
 *   - AP 是**玩法层的通用规则**，不属于任何一个金手指模块
 *   - 删掉本文件，引擎行为逐位不变
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const A = C.ap;

  if (!A) return;

  let patched = false;      // 是否已包装 Game.actions.do
  let origDo = null;
  let softHooked = false;   // soft 模式是否已挂 action:done 监听
  let softCb = null;

  Game.systems
    .create('ap', 75)       // decisions(75) 同层；actions 是 76，这里要在其"之前"准备预算
    .on('state:reset', init)
    .on('month', onMonth);

  function freshState() {
    return { ap: A.start != null ? A.start : 3, spent: 0, blocked: 0, month: 0 };
  }
  function init() {
    st.s.ap = freshState();
    syncPatch();
  }
  function S() {
    if (!st.s.ap) st.s.ap = freshState();
    return st.s.ap;
  }

  function on() { return A.enabled === true; }
  function cap() { return A.cap != null ? A.cap : 6; }
  function perMonth() { return A.perMonth != null ? A.perMonth : 3; }
  function hard() { return A.mode === 'hard'; }

  function costOf(id) {
    const map = A.costByAction || {};
    if (map[id] != null) return map[id];
    return A.defaultCost != null ? A.defaultCost : 1;
  }

  function ap() { return S().ap; }
  function can(id) {
    if (!on()) return true;                    // 关着 ⇒ 永不拦截
    if (!hard()) return true;                  // 软模式 ⇒ 只提示
    return S().ap >= costOf(id);
  }

  /* --------------------------- 扣点 --------------------------- */
  function charge(id) {
    if (!on()) return true;
    const s = S();
    const c = costOf(id);
    if (s.ap < c) {
      s.blocked += 1;
      if (hard()) {
        st.log('⚡ 这个月的行动点用完了（' + s.ap + '/' + cap() + '）——先歇一歇，下个月再战。', 'info', '⚡');
        bus.emit('ap:blocked', { id: id, want: c, left: s.ap });
        return false;
      }
      // 软模式：照常执行，但记一笔"透支"
      st.log('⚡ 行动点见底了（' + s.ap + '/' + cap() + '），本月仍继续。', 'info', '⚡');
    }
    s.ap = Math.max(0, s.ap - c);
    s.spent += c;
    bus.emit('ap:spent', { id: id, cost: c, left: s.ap });
    return true;
  }

  function onMonth() {
    const s = S();
    s.month += 1;
    if (!on()) return;
    const before = s.ap;
    s.ap = Math.min(cap(), s.ap + perMonth());
    if (s.ap !== before) bus.emit('ap:refilled', { from: before, to: s.ap });
  }

  /* --------------------------- hard 模式的拦截 --------------------------- */
  // 只在 hard 且开启时包装 Game.actions.do；soft 只挂 action:done 事后扣点。
  // **两者必须互斥**：同时存在会导致一次行动扣两次点。
  function syncPatch() {
    if (!Game.actions || typeof Game.actions.do !== 'function') return;
    const hardOn = on() && hard();

    // 1) hard 包装：需要时包，不需要时还原
    if (hardOn && !patched) {
      origDo = Game.actions.do;
      Game.actions.do = function (id) {
        if (!can(id)) { charge(id); return false; }   // 触发一次 blocked 计数与提示
        const r = origDo.apply(this, arguments);
        if (r) charge(id);
        return r;
      };
      patched = true;
    } else if (!hardOn && patched) {
      Game.actions.do = origDo;
      patched = false;
      origDo = null;
    }

    // 2) soft 监听：只在"开启且非 hard"时存在，且与 hard 包装互斥
    const softOn = on() && !hard();
    if (softOn && !softHooked) {
      softCb = function (ev) { if (ev && ev.id) charge(ev.id); };
      bus.on('action:done', softCb);
      softHooked = true;
    } else if (!softOn && softHooked) {
      if (softCb) bus.off('action:done', softCb);
      softHooked = false;
      softCb = null;
    }
  }

  /* --------------------------- 对外 API --------------------------- */
  Game.ap = {
    on,
    mode() { return A.mode || 'soft'; },
    ap, cap, perMonth, costOf, can,
    spend(id) { return charge(id); },
    leftThisMonth() { return S().ap; },
    spent() { return S().spent; },
    blockedCount() { return S().blocked; },
    // 给 UI 的快照
    state() {
      const s = S();
      return {
        enabled: on(),
        mode: A.mode || 'soft',
        ap: s.ap,
        cap: cap(),
        perMonth: perMonth(),
        spent: s.spent,
        blocked: s.blocked,
        ratio: cap() ? Math.max(0, Math.min(1, s.ap / cap())) : 0,
      };
    },
    snapshot() { const s = S(); return JSON.parse(JSON.stringify(s)); },
    hydrate(m) {
      const s = freshState();
      if (m) {
        s.ap = m.ap != null ? m.ap : s.ap;
        s.spent = m.spent || 0;
        s.blocked = m.blocked || 0;
        s.month = m.month || 0;
      }
      st.s.ap = s;
      syncPatch();
    },
    // 供设置项切换后立即生效
    sync: syncPatch,
    _unpatch() { if (patched && origDo) { Game.actions.do = origDo; patched = false; } },
  };

  // 启动时同步一次（module 加载晚于 actions.js，此时可以直接尝试）
  try { syncPatch(); } catch (e) { /* 忽略 */ }
})();
