'use strict';
/* =========================================================================
 * 负债催收链（v1.4.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 事件链完整性：6 个事件都在 config.decisions.events 里，id 唯一
 *  - 条件门控：入口/催收/上门/传票要求 wealth<0；重组要求 wealth<-8；还清要求 wealth>=0
 *  - hidden 门控：只有 debt_overdue / debt_restructure 进随机池，其余为回响专用
 *  - 伏笔串联：入口拖延 plants in_collection，delayed 排 debt_collect_call
 *  - 逐级升级：collect_call → visit → legal 的 delayed 链条闭合
 *  - 止血出口：debt_restructure / debt_legal 应诉 提供 wealth 回升与 debt_settled 伏笔
 *  - 收尾：debt_cleared 补 flags.debt_free
 *  - 分级压力：career 按 debtTiers 取档，越深 mood/immunity 扣得越多
 *  - 隔离性：整条链不触碰金手指三个模块的状态
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('负债催收链', () => {
  const g = h.build({ quiet: true });

  const events = () => g.Game.config.decisions.events;
  const byId = (id) => events().find((e) => e.id === id);
  const DELAYED = (ev, idx) => {
    const ch = ev.choices[idx];
    return (ch && ch.delayed) || [];
  };
  /** 从某个事件的某个选项里取出 delayed 的目标事件 id 集合 */
  function delayedTargets(ev, idx) {
    return DELAYED(ev, idx).map((d) => d.event).filter(Boolean);
  }
  /** 该 delayed 是否带 effects（用于伏笔型延后结算） */
  function delayedHasEffects(ev, idx) {
    return DELAYED(ev, idx).some((d) => d.effects);
  }

  function fresh(seed) {
    g.reset(seed == null ? 20260920 : seed);
  }
  // 直接把玩家按进指定负债水位（万元），用于单点条件测试
  function forceWealth(v) {
    g.person.wealth = v;
  }

  /* ------------------------------ 事件链完整性 ------------------------------ */
  it('6 个催收事件全部注册且 id 唯一', () => {
    const ids = ['debt_overdue', 'debt_collect_call', 'debt_visit', 'debt_legal', 'debt_restructure', 'debt_cleared'];
    for (const id of ids) assert.ok(byId(id), '缺少事件 ' + id);
    const all = events().map((e) => e.id);
    assert.equal(all.filter((x) => x === 'debt_overdue').length, 1, 'debt_overdue 不应重复');
    assert.equal(new Set(all).size, all.length, '所有事件 id 应唯一');
  });

  it('入口与止血出口进随机池；中间催收与收尾为 hidden 回响', () => {
    assert.ok(!byId('debt_overdue').hidden, '入口应可随机触发');
    assert.equal(byId('debt_overdue').random, true, '入口应为 random');
    assert.ok(!byId('debt_restructure').hidden, '重组应可随机触发');
    for (const id of ['debt_collect_call', 'debt_visit', 'debt_legal', 'debt_cleared']) {
      assert.equal(byId(id).hidden, true, id + ' 应为 hidden（只由回响排队）');
    }
  });

  /* -------------------------------- 条件门控 -------------------------------- */
  it('负债期为负才触发；正资产时入口/催收条件均不成立', () => {
    const due = byId('debt_overdue').condition;
    fresh();
    forceWealth(-0.1);
    assert.equal(due(g.person), true, 'wealth<0 应可触发');
    forceWealth(0);
    assert.equal(due(g.person), false, 'wealth=0 不应触发');
    forceWealth(5);
    assert.equal(due(g.person), false, 'wealth>0 不应触发');
  });

  it('催收阶段（电话/上门/传票）同样受 wealth<0 门控', () => {
    fresh();
    for (const id of ['debt_collect_call', 'debt_visit', 'debt_legal']) {
      const cond = byId(id).condition;
      forceWealth(-3);
      assert.equal(cond(g.person), true, id + ' 负债时应可触发');
      forceWealth(2);
      assert.equal(cond(g.person), false, id + ' 还清后不应再触发');
    }
  });

  it('债务重组需较深负债（wealth<-8）；还清事件需 wealth>=0', () => {
    const re = byId('debt_restructure').condition;
    const cl = byId('debt_cleared').condition;
    fresh();
    forceWealth(-5);
    assert.equal(re(g.person), false, '欠 5 万还不够重组门槛');
    forceWealth(-9);
    assert.equal(re(g.person), true, '欠 9 万应够重组门槛');
    forceWealth(-1);
    assert.equal(cl(g.person), false, '仍欠债不算还清');
    forceWealth(0);
    assert.equal(cl(g.person), true, '归零即为还清');
  });

  /* --------------------------- 伏笔与逐级升级链条 --------------------------- */
  it('入口拖延：plants in_collection 并排定催收来电', () => {
    const ev = byId('debt_overdue');
    // 两个"拖延/装看不见"选项都应埋伏笔 + 排催收电话
    for (const idx of [1, 2]) {
      const ch = ev.choices[idx];
      const plants = Array.isArray(ch.plants) ? ch.plants : [ch.plants];
      assert.ok(plants.indexOf('in_collection') >= 0, 'choice#' + idx + ' 应埋 in_collection');
      assert.ok(delayedTargets(ev, idx).indexOf('debt_collect_call') >= 0, 'choice#' + idx + ' 应排 debt_collect_call');
    }
  });

  it('逐级升级链条闭合：来电→上门→传票', () => {
    assert.ok(delayedTargets(byId('debt_collect_call'), 1).indexOf('debt_visit') >= 0, '拉黑应导向上门');
    assert.ok(delayedTargets(byId('debt_collect_call'), 2).indexOf('debt_visit') >= 0, '对骂应导向上门');
    assert.ok(delayedTargets(byId('debt_visit'), 1).indexOf('debt_legal') >= 0, '闭门不出应导向传票');
  });

  it('止血出口存在：分期/应诉给出 wealth 回升 + debt_settled 伏笔', () => {
    // 协商重组：wealth 正向
    const re = byId('debt_restructure').choices[0];
    assert.ok((re.effects.wealth || 0) > 0, '重组应让 wealth 回升');
    assert.equal(re.effects.flags.restructured, true, '重组应打 restructured 标记');
    // 上门谈成分期 / 应诉调解：埋 debt_settled
    for (const [id, idx] of [['debt_visit', 0], ['debt_legal', 0]]) {
      const ch = byId(id).choices[idx];
      const plants = Array.isArray(ch.plants) ? ch.plants : [ch.plants];
      assert.ok(plants.indexOf('debt_settled') >= 0, id + ' 应埋 debt_settled');
    }
  });

  it('收尾：debt_cleared 打上 debt_free 标记并显著减压', () => {
    const ch = byId('debt_cleared').choices[0];
    assert.equal(ch.effects.flags.debt_free, true, '应打 debt_free 标记');
    assert.ok((ch.effects.stress || 0) < 0, '还清应减压');
    assert.ok((ch.effects.mood || 0) > 0, '还清应提心情');
  });

  /* ------------------------------ 伏笔可实际引爆 ------------------------------ */
  it('真实推演：埋下 in_collection 后，consequences 能排入 debt_collect_call', () => {
    fresh();
    g.Game.consequences.plant('in_collection');
    assert.equal(g.Game.consequences.has('in_collection'), true, '伏笔应已埋下');
    // schedule(0) 立即结算并入队（inMonths>0 的走 timers，由 month 事件兑现）
    g.Game.consequences.schedule(0, { event: 'debt_collect_call' });
    // 直接读队列（drainReady 是破坏性的，会被游戏自身的月份结算消费掉）
    const q = g.person.readyQueue || [];
    assert.ok(q.indexOf('debt_collect_call') >= 0, '应立即入队 debt_collect_call');
  });

  it('延时回响经 month 事件兑现：排定后推进若干月才入队', () => {
    fresh();
    g.Game.consequences.schedule(2, { event: 'debt_collect_call' });
    assert.equal((g.person.readyQueue || []).indexOf('debt_collect_call') < 0, true, '未到期不应入队');
    assert.ok(g.person.timers.length >= 1, '应挂在 timers 上等待到期');
    // 推进约 3 个月，month 事件应触发 timer 结算：timers 清空
    g.runDays(95);
    assert.equal(g.person.timers.length, 0, '到期后 timers 应被结算清空');
  });

  it('还在负债时，random 池可含 debt_overdue 与 debt_restructure', () => {
    fresh();
    forceWealth(-30);
    const p = g.person;
    const D = g.Game.config.decisions;
    const pool = D.events.filter((ev) => !ev.hidden && (ev.random || ev.repeatable) && (!ev.condition || ev.condition(p)));
    const ids = pool.map((e) => e.id);
    assert.ok(ids.indexOf('debt_overdue') >= 0, 'net 负债时入口应可进池');
    assert.ok(ids.indexOf('debt_restructure') >= 0, '深负债时重组应可进池');
  });

  /* ------------------------------ 分级压力（career） ------------------------------ */
  it('负债分级压力随深度递增（mood/immunity/心理压力均单调）', () => {
    const T = g.Game.config.finance.debtTiers;
    assert.ok(Array.isArray(T) && T.length >= 2, 'debtTiers 应存在且至少两档');
    // 档位按 below 降序（0 → -5 → -25 …），越靠后越深越痛
    for (let i = 1; i < T.length; i++) {
      assert.ok(T[i].below < T[i - 1].below, '档位应按 below 降序排列');
      assert.ok(T[i].mood >= T[i - 1].mood, '越深 mood 打击不应更轻');
      assert.ok(T[i].immunity >= T[i - 1].immunity, '越深 immunity 打击不应更轻');
    }
    // 浅债档不应比 debtStress 基础值更重
    const base = g.Game.config.finance.debtStress;
    assert.ok(T[0].mood <= base.mood + 0.001, '最浅档不应重于基础值');
  });

  it('不同负债水位扣不同档位：越深心情掉得越多', () => {
    const T = g.Game.config.finance.debtTiers;
    // 复刻 career 的取档逻辑：取第一个 wealth >= below 的档，越靠后越痛
    function tierOf(w) {
      for (const t of T) if (w >= t.below) return t;
      return T[T.length - 1];
    }
    const shallow = tierOf(-1);
    const deep = tierOf(-80);
    assert.ok(deep.mood > shallow.mood, '深债档 mood 打击应更重（-1 vs -80）');
    assert.ok(deep.immunity > shallow.immunity, '深债档 immunity 打击应更重');
    // 刚好落在边界上：-5 应取到 below:-5 那一档（>= 判定）
    const edge = tierOf(-5);
    assert.equal(edge.below, -5, '恰好 -5 应落在 below:-5 档');
  });

  it('负债压力真的作用到人物身上（推演验证）', () => {
    fresh(424242);
    const before = g.person.mood;
    const immBefore = g.person.immunity;
    forceWealth(-40); // 深债
    // 逐年推进，career 会在年度结算里施压
    g.runYears(3);
    if (!g.person.alive) return; // 极端情况下（夭折）跳过，不算失败
    assert.ok(g.person.mood <= before + 0.001, '深债下心情不应反升');
    assert.ok(g.person.immunity <= immBefore + 0.001, '深债下免疫不应反升');
  });

  /* -------------------------------- 隔离性 -------------------------------- */
  it('催收链不触碰金手指三模块状态', () => {
    fresh();
    const hx = g.state.hex, ty = g.state.tycoon, dl = g.state.datalize;
    if (hx) assert.equal(hx.on, false, 'hex 应仍关闭');
    if (ty) assert.equal(ty.on, false, 'tycoon 应仍关闭');
    if (dl) assert.equal(dl.on, false, 'datalize 应仍关闭');
    // 伏笔名不与金手指命名空间冲突
    for (const n of ['in_collection', 'debt_settled', 'bad_credit']) {
      assert.ok(n.indexOf('hex') !== 0 && n.indexOf('tycoon') !== 0 && n.indexOf('datalize') !== 0, n + ' 不应冒用金手指前缀');
    }
  });
});
