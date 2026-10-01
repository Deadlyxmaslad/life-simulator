/* =========================================================================
 * 系统 · 抉择 / 人生岔路 (decisions)  —— 按月触发
 * -------------------------------------------------------------------------
 * 参与感来源：世界按"月"推进时，较频繁地（但非每月强制）弹出情境抉择；
 * 里程碑（升学/就业/婚育/退休…）优先且一次性，生活流小事件按人生阶段与
 * 上下文（是否在职/已婚/有钱…）从池中加权抽取，可重复的带各自冷却。
 * 暂停：设置 st.s.pendingDecision，主循环据此冻结；玩家选完自动继续。
 *
 * 事件字段（config.decisions.events）：
 *   id title desc minAge maxAge
 *   random?        true=进入随机池；缺省=一次性里程碑
 *   once(默认)/repeatable? + minMonths?  重复事件的最小间隔（月）
 *   stages?:[...]  限定人生阶段（child/school/work/retired/other）
 *   condition(p)?  事件级门槛；weight? 抽取权重
 *   choices:[{label, effects|risk, condition?, log}]
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const u = Game.util;
  const D = C.decisions;

  Game.systems
    .create('decisions', 75)
    .on('state:reset', init)
    .on('month', onMonth);

  function init() {
    const p = st.s.person;
    p.flags = {};
    p.decisions = { seen: [], lastBy: {}, lastMonth: -99, count: 0, history: [] };
  }

  function monthIndex() {
    return st.s.clock.year * 12 + st.s.clock.month;
  }

  // 当前人生阶段（供事件筛选）
  function stageOf(p) {
    if (st.s.clock.age < 6) return 'child';
    if (p.education && p.education.inSchool) return 'school';
    if (p.career && p.career.phase === 'employed') return 'work';
    if (p.career && p.career.phase === 'retired') return 'retired';
    return 'other';
  }

  function stageMatch(ev, p) {
    if (!ev.stages || !ev.stages.length) return true;
    return ev.stages.indexOf(stageOf(p)) >= 0;
  }

  function eligible(ev, age, p) {
    if (ev.hidden) return false; // 后续回收事件只由 consequences 排队触发，不进随机池
    // 场景过滤（v2.2.0）：事件声明 scenario 时只在对应场景下可用；无 scenario 则全场景通用
    if (ev.scenario && Game.scenario && Game.scenario.key() !== ev.scenario) return false;
    const d = p.decisions;
    if (age < (ev.minAge || 0) || age > (ev.maxAge || 150)) return false;
    // 时代事件：只在真实年份窗口内可触发
    if (ev.yearMin != null && st.s.clock.year < ev.yearMin) return false;
    if (ev.yearMax != null && st.s.clock.year > ev.yearMax) return false;
    if (!ev.repeatable && d.seen.indexOf(ev.id) >= 0) return false;
    if (ev.repeatable && ev.minMonths) {
      const last = d.lastBy[ev.id] == null ? -999 : d.lastBy[ev.id];
      if (monthIndex() - last < ev.minMonths) return false;
    }
    if (!stageMatch(ev, p)) return false;
    if (ev.requiresSeed && !Game.consequences.has(ev.requiresSeed)) return false;
    if (ev.requiresNotSeed && Game.consequences.has(ev.requiresNotSeed)) return false;
    if (ev.condition && !safeCall(ev.condition, p)) return false;
    return true;
  }

  function onMonth() {
    const p = st.s.person;
    if (!p.decisions || !p.alive || st.s.pendingDecision) return;
    const age = st.s.clock.age;

    // 0) 优先兑现"到期的后续事件"（伏笔回收/连锁后果）
    for (const id of Game.consequences.drainReady()) {
      const ev = D.events.find((e) => e.id === id);
      if (ev && (!ev.condition || safeCall(ev.condition, p))) return ask(ev);
    }
    // 1) 一次性里程碑优先
    for (const ev of D.events) {
      if (ev.random || ev.repeatable || ev.hidden) continue;
      if (eligible(ev, age, p)) return ask(ev);
    }
    // 2) 随机生活流（受全局最小间隔 + 每月概率约束）
    const d = p.decisions;
    if (monthIndex() - d.lastMonth >= (D.minGapMonths || 0) && u.chance(D.monthlyChance * Game.scenario.eventRate())) {
      const pool = D.events.filter((ev) => (ev.random || ev.repeatable) && eligible(ev, age, p));
      if (pool.length) {
        const pick = u.weighted(pool.map((ev) => ({ item: ev, weight: ev.weight || 1 })));
        return ask(pick);
      }
    }
  }

  function ask(ev) {
    const d = st.s.person.decisions;
    d.seen.push(ev.id);
    d.lastBy[ev.id] = monthIndex();
    d.lastMonth = monthIndex();
    d.count += 1;
    if (ev.consumesSeed) Game.consequences.consume(ev.consumesSeed);
    st.s.pendingDecision = { ev, age: st.s.clock.age };
    bus.emit('decision:ask', { ev, age: st.s.clock.age });
  }

  /* ------------------------- 玩家做出选择 ------------------------- */
  function choose(index) {
    var pd = st.s.pendingDecision;
    if (!pd) return;
    var ch = pd.ev.choices[index];
    if (!ch || !choiceEnabled(ch)) return;
    resolve(pd.ev, ch);
    st.s.pendingDecision = null;
    bus.emit('decision:answered', { ev: pd.ev, choice: ch });
  }

  function resolve(ev, ch) {
    var p = st.s.person;
    var eff = ch.effects || {};
    var line = ch.log || ch.label;
    var risky = false;
    var outcome = null;
    if (ch.risk) {
      risky = true;
      var luck = Game.scenario.luck(); // 剧本运气：调高风险事件的成功率
      var bonus = Game.hex && typeof Game.hex.riskBonus === 'function' ? Game.hex.riskBonus() : 1;
      var win = u.chance(u.clamp((ch.risk.chance + (luck - 1) * 0.15) * bonus, 0.03, 0.97));
      outcome = win ? ch.risk.success || {} : ch.risk.failure || {};
      eff = outcome;
      line = win ? ch.risk.goodLog || '你赌对了。' : ch.risk.badLog || '事与愿违。';
    }
    // 资产指令（B6）：把"买房 / 买车 / 卖房 / 卖车"委托给 assets 系统做真实结算
    if (ch.asset && Game.assets) {
      var acts = ch.asset.act || 'buy';
      var res = acts === 'sell'
        ? Game.assets.sell(ch.asset.kind, ch.asset.index == null ? null : ch.asset.index, { relief: !!ch.asset.relief })
        : Game.assets.buy(ch.asset.kind, ch.asset.key, {});
      if (res && res.ok === false) {
        line = '这件事没能办成：' + (res.reason || '条件不满足');
        eff = {};
      } else if (res && res.ok === true) {
        eff = {};
      }
    }
    // 投资指令（v1.7.1）：把"开通某市场账户"委托给 invest 系统（成年开户自选市场）
    // 只转发开户，不改写效果对象 —— 开户本身不动现金
    if (ch.openMarket && Game.invest && typeof Game.invest.openMarket === 'function') {
      Game.invest.openMarket(ch.openMarket);
    }
    // 班级指令（v2.4.0）：把"调班"委托给 education 系统；风险选项的成败分支也可携带
    var reclassTo = (outcome && outcome.reclass) || ch.reclass;
    if (reclassTo && Game.education && typeof Game.education.moveClass === 'function') {
      Game.education.moveClass(reclassTo);
    }
    var title = ev.fromAction
      ? '行动·' + String(ev.title).replace(/^\S+\s+/, '')
      : '抉择·' + String(ev.title).replace(/^\S+\s+/, '');
    var tagged = Object.assign({}, eff, { source: title });
    delete tagged.plants; delete tagged.delayed;
    st.applyEffects(tagged);
    // 登记延迟伏笔 / 回响（选择本身 + 风险结果分支都可携带）
    Game.consequences.onChoose(ch);
    if (outcome) Game.consequences.onChoose(outcome);
    // 行动类抉择：行动定义本身携带的 plants/delayed 也要登记（如捐助→善有善报伏笔）
    if (ev.actionDef && Game.consequences && (ev.actionDef.plants || ev.actionDef.delayed)) {
      Game.consequences.onChoose({ plants: ev.actionDef.plants, delayed: ev.actionDef.delayed });
    }
    var prefix = ev.fromAction ? '🎯' : '🧭';
    st.log(prefix + ' ' + String(ev.title).replace(/^\S+\s+/, '') + ' → ' + line, risky ? 'warn' : 'info', prefix);
    p.decisions.history.push({ age: st.s.clock.age, id: ev.id || ev.fromAction, choice: ch.label });
  }

  function choiceEnabled(ch) {
    return !ch.condition || safeCall(ch.condition, st.s.person);
  }
  function safeCall(fn, p) {
    try {
      return !!fn(p);
    } catch (e) {
      return false;
    }
  }

  /* --------------------- 行动抉择化（G8） --------------------- */
  // action 类型的行动点击后调用此入口：用行动定义组装一个伪事件，
  // 挂在 pendingDecision 上冻结主循环，复用 HUD 弹窗让玩家选择。
  // 行动的 plants/delayed 在选择结清时一并登记。
  function openActionChoice(actionDef) {
    var p = st.s.person;
    if (!p.decisions) return; // 未初始化
    // 筛掉不满足条件的选项（如财富门槛、智力门槛）
    var eligible = (actionDef.choices || []).filter(function (ch) {
      return !ch.condition || safeCall(ch.condition, p);
    });
    if (!eligible.length) {
      // 全部选项都不可选：不弹窗，走默认效果（fallback 由 actions 已处理）
      return;
    }
    var ev = {
      title: actionDef.emoji + ' ' + actionDef.name,
      desc: actionDef.prompt || '',
      choices: eligible,
      fromAction: actionDef.id,
      actionDef: actionDef,
    };
    st.s.pendingDecision = { ev: ev, age: st.s.clock.age };
    bus.emit('decision:ask', { ev: ev, age: st.s.clock.age });
  }

  // 契约：供 HUD 与未来系统（成就/回放）读取
  Game.decisions = {
    pending() {
      return st.s.pendingDecision;
    },
    choose,
    choiceEnabled,
    stageOf,
    openActionChoice,
    // 外部模块专用：撤回当前岔路并重抽一次（回滚本次抽取记录，避免污染 seen 表）
    reroll() {
      const pd = st.s.pendingDecision;
      if (!pd) return false;
      const d = st.s.person.decisions;
      if (d) {
        d.seen = (d.seen || []).filter((id) => id !== pd.ev.id);
        if (d.lastBy) delete d.lastBy[pd.ev.id];
        d.count = Math.max(0, d.count - 1);
      }
      st.s.pendingDecision = null;
      bus.emit('decision:reroll', { ev: pd.ev, age: st.s.clock.age });
      onMonth();                       // 重新走一遍本月抽取
      if (!st.s.pendingDecision) ask(pd.ev); // 极端情况（池为空）：把原事件放回来
      return true;
    },
    count() {
      const d = st.s.person.decisions;
      return d ? d.count : 0;
    },
  };
})();
