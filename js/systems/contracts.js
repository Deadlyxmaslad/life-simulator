/* =========================================================================
 * 系统 · 人生合约 (contracts) —— v1.6.0 玩法层 ①
 * -------------------------------------------------------------------------
 * 中期目标层：每 period 年为一期，自动下发 offerCount 张候选合约，
 * 玩家**主动认领 1 张**（或放弃这一期），到期由本系统只读评估是否达标。
 *
 * 设计要点（遵守本项目红线）：
 *   - 独立 config 节 `config.contracts` / 独立 state 子树 `state.contracts`
 *   - 奖励一律**单项收益**（属性 / 现金 / 徽章），**不发任何跨模块通用货币**
 *   - 违约不扣分，只写一条日志 —— "人生不惩罚你，只是错过"
 *   - **不引用金手指三模块的任何字段**（唯二例外见 'clean' 合约：只读各自旗标，
 *     与「纯净向」成就同源，不做共享货币、不订阅对方事件）
 *   - 删掉本文件，引擎行为逐位不变
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const K = C.contracts;

  if (!K) return;

  const EDU_RANK = ['—', '小学', '初中', '高中', '中专', '大专', '本科', '硕士', '博士'];

  Game.systems
    .create('contracts', 85)   // achievements(80) 之后、score(90) 之前：结算前把账结清
    .on('state:reset', init)
    .on('year', onYear)
    .on('month', sample)
    .on('death', finish);

  /* --------------------------- 状态 --------------------------- */
  function freshState() {
    return {
      period: 0,          // 当前第几期（从 1 开始）
      offer: null,        // 本期候选 [{id,tag,emoji,name,desc}]
      active: null,       // 已认领：{id,startYear,startAge,track:{...}}
      history: [],        // [{id,name,tag,ok,age}] 逐期结果
      kept: 0, failed: 0, // 达成 / 未达成计数
      badges: {},         // 拿到的合约徽章 {badgeName:true}
    };
  }
  function init() { st.s.contracts = freshState(); }
  function S() {
    if (!st.s.contracts) st.s.contracts = freshState();
    return st.s.contracts;
  }

  /* --------------------------- 工具 --------------------------- */
  function pool() { return K.pool || []; }
  function def(id) { return pool().find((c) => c.id === id) || null; }
  function curYear() { return (st.s.clock && st.s.clock.year) || 0; }
  function curAge() { return (st.s.clock && st.s.clock.age) || 0; }

  // 采样"极值类"指标：minHealth / maxStress 这类必须逐月跟踪，否则到期无法回溯
  function sample() {
    const p = st.s.person;
    const s = S();
    if (!p || !p.alive || !s.active || !s.active.track) return;
    const t = s.active.track;
    const health = p.health || 0;
    const immunity = p.immunity || 0;
    const stress = p.mental ? p.mental.stress || 0 : 0;
    const friends = p.social ? p.social.friends.length : 0;

    t.minHealth = Math.min(t.minHealth == null ? health : t.minHealth, health);
    t.minImmunity = Math.min(t.minImmunity == null ? immunity : t.minImmunity, immunity);
    t.maxStress = Math.max(t.maxStress == null ? stress : t.maxStress, stress);
    t.maxFriends = Math.max(t.maxFriends || 0, friends);
    if (p.career) {
      if (p.career.reachedManagement || p.career.phase === 'management') t.reachedManagement = true;
      if (p.career.rank && /管理|经理|主管|总监|VP|总裁/i.test(String(p.career.rank))) t.reachedManagement = true;
    }
  }

  // 认领时给合约提供一份"可自证的上下文"，让 config 里的 test 写得干净
  function trackCtx(p) {
    const s = S();
    const t = s.active ? s.active.track : {};
    const used = p.flags || {};
    const sm = (Game.consume && typeof Game.consume.summary === 'function') ? Game.consume.summary() : null;
    return {
      // 极值类（逐月采样）
      minHealth: t.minHealth == null ? 100 : t.minHealth,
      minImmunity: t.minImmunity == null ? 100 : t.minImmunity,
      maxStress: t.maxStress == null ? 0 : t.maxStress,
      maxFriends: t.maxFriends || 0,
      reachedManagement: !!t.reachedManagement,
      // 起始/当前类（认领快照 vs 现值）
      wealthStart: t.wealthStart || 0,
      wealthEnd: p.wealth || 0,
      // 谓词助手：学历判定（避免 config 里写长表达式）
      eduAtLeast: function (names) {
        const lv = p.education ? p.education.level : '—';
        return names.indexOf(lv) >= 0;
      },
      // 只读金手指各自旗标（与加成纯净徽章同源，不合并、不引入共享货币）
      used: {
        hex: !!used.used_hex,
        tycoon: !!used.used_tycoon,
        datalize: !!used.used_datalize,
      },
      // 消费（只读消费系统自己的账；消费系统缺失则为 0）
      consumeSpent: sm ? sm.spent || 0 : 0,
    };
  }

  /* --------------------------- 下发 / 认领 --------------------------- */
  function rollOffer() {
    const p = st.s.person;
    const s = S();
    // 从未完成过的合约里随机抽取，尽量不重复
    const done = {};
    for (const h of s.history) if (h.ok) done[h.id] = true;
    let cand = pool().filter((c) => !done[c.id]);
    if (cand.length < (K.offerCount || 3)) cand = pool().slice();
    // Fisher-Yates 洗牌后取前 N
    for (let i = cand.length - 1; i > 0; i--) {
      const j = u.randInt(0, i);
      const tmp = cand[i]; cand[i] = cand[j]; cand[j] = tmp;
    }
    const picked = cand.slice(0, K.offerCount || 3);
    s.offer = picked.map((c) => ({ id: c.id, tag: c.tag, emoji: c.emoji, name: c.name, desc: c.desc }));
    s.active = null;
    if (s.offer.length) {
      st.log('📜 新的人生合约已下发（第 ' + s.period + ' 期）——认领一张，5 年后验收。', 'info', '📜');
      bus.emit('contract:offer', { period: s.period, offer: s.offer.slice() });
    }
  }

  function claim(id) {
    const p = st.s.person;
    const s = S();
    if (!p || !p.alive) return false;
    if (s.active) return false;
    const d = def(id);
    if (!d) return false;
    if (!s.offer || !s.offer.some((o) => o.id === id)) return false;

    s.active = {
      id: d.id,
      startYear: curYear(),
      startAge: curAge(),
      dueYear: curYear() + (K.period || 5),
      track: {
        wealthStart: p.wealth || 0,
        wealthEnd: p.wealth || 0,
        minHealth: p.health || 0,
        minImmunity: p.immunity || 0,
        maxStress: p.mental ? p.mental.stress || 0 : 0,
        maxFriends: p.social ? p.social.friends.length : 0,
        reachedManagement: false,
      },
    };
    sample();
    st.log('📜 你认领了合约「' + d.emoji + ' ' + d.name + '」：' + d.desc + '（' + (K.period || 5) + ' 年后验收）', 'good', '📜');
    bus.emit('contract:claimed', { id: d.id, def: d });
    return true;
  }

  function skip() {
    const s = S();
    if (s.active) return false;
    if (!s.offer || !s.offer.length) return false;
    st.log('📜 这一期的合约，你一张也没认领。', 'info', '📜');
    s.offer = [];
    bus.emit('contract:skipped', { period: s.period });
    return true;
  }

  /* --------------------------- 到期结算 --------------------------- */
  function settleActive() {
    const p = st.s.person;
    const s = S();
    if (!s.active) return null;
    const d = def(s.active.id);
    const act = s.active;
    s.active = null;
    if (!d) return null;

    let ok = false;
    try { ok = !!d.test(trackCtx(p)); } catch (e) { ok = false; }

    s.history.push({ id: d.id, name: d.name, tag: d.tag, ok: ok, age: curAge() });

    if (ok) {
      s.kept += 1;
      if (d.reward) st.applyEffects(Object.assign({ source: '合约·' + d.name }, d.reward));
      if (d.badge) {
        s.badges[d.badgeName || d.name] = true;
        st.log('📜 合约达成 · 「' + d.badge + ' ' + (d.badgeName || d.name) + '」——' + d.name + '，说到做到。', 'good', d.badge);
      } else {
        st.log('📜 合约达成 · ' + d.name + '，说到做到。', 'good', '📜');
      }
      bus.emit('contract:kept', { id: d.id, def: d });
    } else {
      s.failed += 1;
      st.log('📜 合约「' + d.name + '」到期未达成 —— 人生不惩罚你，只是错过了。', 'info', '📜');
      bus.emit('contract:failed', { id: d.id, def: d });
    }
    void act;
    return ok;
  }

  function onYear() {
    const p = st.s.person;
    const s = S();
    if (!p || !p.alive) return;
    const age = curAge();

    // 先结算到期的
    if (s.active && curYear() >= s.active.dueYear) settleActive();

    // 成年后、未超龄时，按 period 年一期内下发
    if (age < (K.minAge || 18) || age > (K.maxAge || 70)) return;
    if (!s.startYear) s.startYear = curYear();
    // 本期还没下发过，且距上一期下发已满 period 年（首期立即下发）
    const idle = !s.offer || !s.offer.length;
    if (idle && !s.active && (s.lastRollYear == null || (curYear() - s.lastRollYear) >= (K.period || 5))) {
      s.period = (s.period || 0) + 1;
      s.lastRollYear = curYear();
      rollOffer();
    }
  }

  function finish() {
    // 死亡时把在手的合约按现状结算（体面收尾）
    const s = S();
    if (s.active) settleActive();
  }

  /* --------------------------- 对外 API --------------------------- */
  Game.contracts = {
    state() {
      const s = S();
      const d = s.active ? def(s.active.id) : null;
      return {
        period: s.period,
        offer: s.offer ? s.offer.slice() : [],
        active: s.active ? {
          id: s.active.id,
          name: d ? d.name : '',
          emoji: d ? d.emoji : '',
          desc: d ? d.desc : '',
          dueYear: s.active.dueYear,
          leftYears: Math.max(0, s.active.dueYear - curYear()),
        } : null,
        history: s.history.slice(),
        kept: s.kept,
        failed: s.failed,
        badges: Object.keys(s.badges),
      };
    },
    claim, skip,
    offer() { return (S().offer || []).slice(); },
    active() { return S().active ? def(S().active.id) : null; },
    kept() { return S().kept; },
    failed() { return S().failed; },
    badges() { return Object.keys(S().badges); },
    def, pool: () => pool().length,
    snapshot() { const s = S(); return JSON.parse(JSON.stringify({ period: s.period, offer: s.offer, active: s.active, history: s.history, kept: s.kept, failed: s.failed, badges: s.badges, lastRollYear: s.lastRollYear, startYear: s.startYear })); },
    hydrate(m) {
      if (!m) { st.s.contracts = freshState(); return; }
      const s = freshState();
      s.period = m.period || 0;
      s.offer = m.offer || null;
      s.active = m.active || null;
      s.history = m.history || [];
      s.kept = m.kept || 0;
      s.failed = m.failed || 0;
      s.badges = m.badges || {};
      s.lastRollYear = m.lastRollYear;
      s.startYear = m.startYear;
      st.s.contracts = s;
    },
    _settle: settleActive,
  };
})();
