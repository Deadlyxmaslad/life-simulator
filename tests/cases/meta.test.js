'use strict';
/* =========================================================================
 * 元进度解锁（v1.6.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 默认状态：tycoon 无门槛（默认可用）；hex/datalize 未解锁
 *  - 独立判定：三个模块各自解锁互不影响
 *  - or 语义：achievements / endings 任一达成即解锁
 *  - 死亡时把 deaths / achievements / endings 写回独立存储键
 *  - soft 模式（默认）：不强制关闭模块运行态开关
 *  - hardLock 模式：未解锁模块的运行态开关被关回去
 *  - 存储键独立：不污染存档 / 榜单
 *  - 隔离性：不触碰模块自身字段（除运行态开关）
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('元进度解锁', () => {
  const g = h.build({ quiet: true });

  const MC = () => g.Game.config.meta;
  const ME = () => g.Game.meta;

  function fresh(seed) { g.reset(seed == null ? 20260924 : seed); }

  function withMeta(fn, patch) {
    const before = { hardLock: MC().hardLock };
    Object.assign(MC(), patch);
    try { fn(); } finally {
      MC().hardLock = before.hardLock;
    }
  }

  /* ------------------------------ 默认状态 ------------------------------ */
  it('开局解锁表存在；tycoon 无门槛默认可用', () => {
    fresh();
    const u = ME().unlocked();
    assert.equal(typeof u, 'object', '解锁表应为对象');
    assert.equal(ME().unlocked('tycoon'), true, '神壕无门槛应默认可用');
  });

  it('hex / datalize 有门槛，新档默认未解锁', () => {
    fresh();
    ME()._clearStore();
    ME().refresh();
    assert.equal(ME().unlocked('hex'), false, 'hex 需要通关 1 局，新档应未解锁');
    assert.equal(ME().unlocked('datalize'), false, 'datalize 需要成就/结局，新档应未解锁');
  });

  /* ------------------------------ 独立判定 ------------------------------ */
  it('三模块解锁彼此独立：只解锁一个不影响其它', () => {
    fresh();
    ME()._setUnlocked('hex', true);
    assert.equal(ME().unlocked('hex'), true, 'hex 应已解锁');
    assert.equal(ME().unlocked('datalize'), false, 'datalize 不应随之解锁');
    assert.equal(ME().unlocked('tycoon'), true, 'tycoon 不受影响');
  });

  /* -------------------------------- or 语义 -------------------------------- */
  it('datalize 的 or 语义：条件任一达成即解锁', () => {
    fresh();
    const gate = ME().gateOf('datalize');
    assert.ok(gate, '应存在 datalize 门槛');
    assert.equal(gate.unlock.mode, 'or', '应为 or 语义');
    assert.ok(gate.unlock.achievements != null && gate.unlock.endings != null, '应声明两个可选条件');
    const pr = ME().progress('datalize');
    assert.ok(typeof pr.note === 'string' && pr.note.length > 0, '应能生成进度提示');
    assert.ok(/任一/.test(pr.note), 'or 语义提示应含「任一达成」：' + pr.note);
  });

  it('progress 给出「还差多少」的提示', () => {
    fresh();
    ME()._clearStore();
    ME().refresh();
    const p = ME().progress('hex');
    assert.equal(p.unlocked, false, 'hex 应未解锁');
    assert.ok(/通关\s*\d+\/\d+/.test(p.note), '应提示通关进度：' + p.note);
  });

  /* ------------------------------ 死亡写回 ------------------------------ */
  it('死亡时把通关数 / 成就数 / 结局写回元进度', () => {
    fresh();
    ME()._clearStore();
    ME().refresh();
    const before = ME().stats();
    assert.equal(before.deaths, 0, '初始通关数应为 0');

    // 伪造一局结束：给成就 + 一个结局旗标
    g.state.clock.age = 80;
    g.person.achievements = g.person.achievements || {};
    g.person.achievements['grow_up'] = true;
    g.person.achievements['come_first'] = true;
    g.person.flags.ending_rich = true;

    // 触发死亡结算路径（meta 订阅了 death）
    g.Game.bus.emit('death', {});

    const after = ME().stats();
    assert.equal(after.deaths >= 1, true, '通关数应 +1');
    assert.equal(after.achievements >= 2, true, '成就数应被记录：' + after.achievements);
    assert.equal(after.endings.indexOf('rich') >= 0, true, '结局应被记录：' + JSON.stringify(after.endings));
  });

  /* ------------------------------ 持久化生效 ------------------------------ */
  it('通关 1 局后 hex 应解锁（写回的数据被重新评估）', () => {
    fresh();
    ME()._clearStore();
    ME().refresh();
    assert.equal(ME().unlocked('hex'), false, '先确认未解锁');
    g.state.clock.age = 80;
    g.person.achievements = g.person.achievements || {};
    g.person.achievements['grow_up'] = true;
    g.Game.bus.emit('death', {});
    assert.equal(ME().unlocked('hex'), true, '通关 1 局后 hex 应解锁');
  });

  /* ------------------------------ soft 不拦 ------------------------------ */
  it('默认 soft：未解锁模块的运行态开关不被强制关闭', () => {
    fresh();
    const g2 = g;
    void g2;
    withMeta(() => {
      ME()._setUnlocked('hex', false);
      // 手动把 hex 打开
      g.Game.hex.enable();
      const on0 = g.Game.hex.isOn();
      ME().enforce();
      assert.equal(g.Game.hex.isOn(), on0, 'soft 模式不应关闭已开启的模块');
      g.Game.hex.disable();
    }, { hardLock: false });
  });

  /* ------------------------------ hardLock 拦截 ------------------------------ */
  it('hardLock：未解锁模块的运行态开关被关回去', () => {
    fresh();
    withMeta(() => {
      ME()._setUnlocked('hex', false);
      g.Game.hex.enable();
      assert.equal(g.Game.hex.isOn(), true, '先打开');
      ME().enforce();
      assert.equal(g.Game.hex.isOn(), false, 'hardLock 应关回未解锁模块');
    }, { hardLock: true });
  });

  /* ------------------------------ 存储键独立 ------------------------------ */
  it('元进度使用独立存储键，不与存档/榜单混用', () => {
    fresh();
    const key = MC().key || 'lifesim_meta';
    assert.equal(key, 'lifesim_meta', '键名应为 lifesim_meta');
    assert.equal(/autosave|save|score|board|leaderboard/i.test(key), false, '键名不应与存档/榜单混用');
    // 榜单键应另有其名
    fresh();
    g.Game.score.submit ? g.Game.score.submit(1) : null;
    assert.notEqual(key, 'lifesim_board', '不应与榜单键同名');
  });

  /* ------------------------------ 存档往返 ------------------------------ */
  it('snapshot↔hydrate 往返还原解锁表', () => {
    fresh();
    ME()._clearStore();      // 先清掉前序用例写下的元进度，保证基线是"全未解锁"
    ME().refresh();
    ME()._setUnlocked('hex', true);
    const snap = ME().snapshot();
    ME().hydrate(null);
    assert.equal(ME().unlocked('hex'), false, 'hydrate(null) 应回到未解锁基线');
    ME().hydrate(snap);
    assert.equal(ME().unlocked('hex'), true, '往返后应还原解锁表');
  });

  /* ------------------------------ 成就谓词 ------------------------------ */
  it('「越玩越开」成就谓词可判定', () => {
    fresh();
    const def = g.Game.config.achievements.find((a) => a.id === 'gate_opener');
    assert.ok(def, '应存在越玩越开成就');
    assert.equal(def.test({ metaUnlocked: { hex: true, tycoon: true, datalize: false } }), true, '解锁 hex 应满足');
    assert.equal(def.test({ metaUnlocked: { tycoon: true, hex: false, datalize: false } }), false, '只默认可用不应满足');
  });

  /* -------------------------------- 隔离性 -------------------------------- */
  it('元进度不触碰金手指模块自身的账（除运行态开关）', () => {
    fresh();
    withMeta(() => {
      const he0 = g.Game.hex.he();
      const spent0 = g.Game.hex.spent();
      ME()._setUnlocked('hex', false);
      ME().enforce();
      assert.equal(g.Game.hex.he(), he0, '不应改动 HE 余额');
      assert.equal(g.Game.hex.spent(), spent0, '不应改动已消耗 HE');
    }, { hardLock: true });
  });
});
