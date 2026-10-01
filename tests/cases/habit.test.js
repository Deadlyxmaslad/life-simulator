'use strict';
/* =========================================================================
 * 习惯养成闭环（v1.3.0）测试
 * -------------------------------------------------------------------------
 * 约束：
 *  - 默认空习惯态；未立习惯时每月推进零副作用
 *  - 立习惯 → 每月 streak+1 并给小额增益；达到 persist 月"内化"（一次性）
 *  - 放弃只断 streak、不惩罚、不丢已内化徽章
 *  - 内化写入 person.flags？不写——完全活在自己的 s.habit 子树（保持正交）
 *  - snapshot↔hydrate 往返；hydrate(null) 回到空习惯态
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('习惯养成闭环', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) {
    g.reset(seed == null ? 20260920 : seed);
  }
  // 推进 n 个"月"（每月约 30 天），跳过抉择弹窗干扰
  function months(n, chooser) {
    g.runDays(n * 30, chooser);
  }

  it('开局为空习惯态，无副作用', () => {
    fresh();
    const st = g.state.habit;
    assert.ok(st, 'habit 子树应存在');
    assert.equal(st.active, null, '未立习惯 active 应为 null');
    assert.equal(st.streak, 0, 'streak 应为 0');
    assert.equal(st.mastered.length, 0, 'mastered 应为空');
  });

  it('未立习惯时推进数月不改动 habit', () => {
    fresh();
    months(24);
    assert.equal(g.state.habit.active, null);
    assert.equal(g.state.habit.streak, 0);
  });

  it('立习惯后每月 streak 递增', () => {
    fresh();
    assert.equal(g.Game.habit.start('meditate'), true, '应能立下习惯');
    assert.equal(g.state.habit.active, 'meditate');
    months(3);
    assert.ok(g.state.habit.streak >= 3, 'streak 应随月份累加（实际 ' + g.state.habit.streak + '）');
  });

  it('坚持满 persist 个月会内化：记录徽章 + 一次性性格漂移', () => {
    fresh();
    g.Game.habit.start('meditate'); // persist 10，unlock pers { N:-3, A:1 }
    const n0 = g.person.personality ? g.person.personality.N : null;
    months(40); // 远超 persist
    const st = g.state.habit;
    assert.ok(st.mastered.indexOf('meditate') >= 0, '应记录内化徽章');
    if (n0 != null) {
      assert.ok(g.person.personality.N < n0, '内化应让神经质 N 下降（性格漂移）');
    }
    assert.equal(st.mastered.filter((x) => x === 'meditate').length, 1, '内化只记一次');
  });

  it('内化后再推月不重复触发（幂等）', () => {
    fresh(777);
    g.Game.habit.start('cooking'); // persist 10
    months(30);
    const cnt = g.state.habit.mastered.length;
    months(30);
    assert.equal(g.state.habit.mastered.length, cnt, '不应重复内化');
  });

  it('放弃只断 streak，不惩罚、保留已内化徽章', () => {
    fresh();
    g.Game.habit.start('reading');
    months(20);
    const mastered = g.state.habit.mastered.slice();
    assert.equal(g.Game.habit.abandon(), true, 'abandon 应成功');
    assert.equal(g.state.habit.active, null, '放弃后 active 为 null');
    assert.equal(g.state.habit.streak, 0, '放弃后 streak 归零');
    assert.equal(g.state.habit.mastered.length, mastered.length, '已内化徽章应保留');
  });

  it('改立新习惯会重置 streak 但不丢徽章', () => {
    fresh();
    g.Game.habit.start('exercise');
    months(4);
    assert.ok(g.state.habit.streak > 0);
    g.Game.habit.start('saving');
    assert.equal(g.state.habit.active, 'saving');
    assert.equal(g.state.habit.streak, 0, '改立后 streak 应重置');
  });

  it('不能重复立同一个正在坚持的习惯', () => {
    fresh();
    g.Game.habit.start('writing');
    assert.equal(g.Game.habit.start('writing'), false, '重复立同一习惯应失败');
  });

  it('snapshot↔hydrate 往返一致；hydrate(null) 回到空态', () => {
    fresh();
    g.Game.habit.start('volunteer');
    months(6);
    const snap = g.Game.habit.snapshot();
    assert.equal(snap.active, 'volunteer');
    g.state.habit.active = 'ZZZ';
    g.state.habit.streak = 999;
    g.Game.habit.hydrate(snap);
    assert.equal(g.state.habit.active, 'volunteer', '往返应还原 active');
    assert.equal(g.state.habit.streak, snap.streak, '往返应还原 streak');
    g.Game.habit.hydrate(null);
    assert.equal(g.state.habit.active, null, 'hydrate(null) 应回到空态');
    assert.equal(g.state.habit.mastered.length, 0);
  });

  it('masteredCount 与 state() 视图正确', () => {
    fresh();
    g.Game.habit.start('social');
    const v = g.Game.habit.state();
    assert.equal(v.active, 'social');
    assert.ok(v.persist > 0, '应给出 persist');
    assert.ok(v.progress >= 0 && v.progress <= 1, 'progress 应在 [0,1]');
  });

  it('习惯不引用 / 不写入金手指模块，隔离性保持', () => {
    fresh();
    g.Game.habit.start('meditate');
    months(12);
    const hx = g.state.hex, ty = g.state.tycoon, dl = g.state.datalize;
    if (hx) assert.equal(hx.on, false, 'hex 应仍关闭');
    if (ty) assert.equal(ty.on, false, 'tycoon 应仍关闭');
    if (dl) assert.equal(dl.on, false, 'datalize 应仍关闭');
  });
});
