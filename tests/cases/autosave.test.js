'use strict';
/* =========================================================================
 * 自动存档 / 自动续上（v1.2.0）测试：让"读档"开箱即用
 * -------------------------------------------------------------------------
 * 约束：
 *  - 人生推进中（tick>0 且存活）才会写"自动续档"；刚开局的 0 帧与已故人生不写
 *  - 开局若检测到未完成进度则自动续上（main.js boot 调用 autoLoad）
 *  - 开新局（state:reset）/ 已故（death）会清掉自动续档，下次就是全新命运
 *  - 金手指三模块的开关与账随自动续档一起还原（正交性不被破坏）
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('自动存档 / 自动续上', () => {
  const g = h.build({ quiet: true });

  function fresh(seed) {
    g.reset(seed == null ? 20260920 : seed); // 触发 state:reset → 清掉自动续档
  }

  it('开局（全新、tick=0）没有自动续档', () => {
    fresh();
    assert.equal(g.Game.save.hasAuto(), false, '全新开局不应有自动续档');
    assert.equal(g.Game.save.autoLoad(), false, 'autoLoad 应返回 false');
  });

  it('人生推进中（tick>0 且存活）→ 自动存档成功，可被读回', () => {
    fresh();
    g.state.clock.tick = 24;
    g.state.clock.age = 2;
    g.state.clock.year = 1992;
    assert.equal(g.Game.save.autoSave(), true, '应成功自动存档');
    assert.equal(g.Game.save.hasAuto(), true, 'hasAuto 应为真');
    // 篡改当前状态，读档应还原
    g.state.clock.tick = 999;
    assert.equal(g.Game.save.autoLoad(), true, 'autoLoad 应返回 true');
    assert.equal(g.state.clock.tick, 24, '读档应还原 tick');
    assert.equal(g.state.running, false, '读档后应保持暂停态');
  });

  it('tick=0 的刚开局帧不写入自动续档（避免覆盖上次进度）', () => {
    fresh();
    g.state.clock.tick = 0;
    assert.equal(g.Game.save.autoSave(), false, 'tick=0 不应写入');
    assert.equal(g.Game.save.hasAuto(), false, '不应产生自动续档');
  });

  it('已故人生不自动存档、也不应被续上', () => {
    fresh();
    g.state.clock.tick = 50;
    g.state.person.alive = false;
    assert.equal(g.Game.save.autoSave(), false, '已故不应写入');
    assert.equal(g.Game.save.hasAuto(), false, '已故不应有续档');
  });

  it('clearAuto 清空自动续档', () => {
    fresh();
    g.state.clock.tick = 24;
    g.Game.save.autoSave();
    assert.equal(g.Game.save.hasAuto(), true);
    g.Game.save.clearAuto();
    assert.equal(g.Game.save.hasAuto(), false, 'clearAuto 后应无续档');
  });

  it('开新局（state:reset）会清掉自动续档', () => {
    fresh();
    g.state.clock.tick = 24;
    g.Game.save.autoSave();
    assert.equal(g.Game.save.hasAuto(), true);
    g.reset(12345); // 再次开局 → state:reset → 清自动续档
    assert.equal(g.Game.save.hasAuto(), false, '重开后自动续档应被清掉');
  });

  it('自动续档一并还原金手指模块的开关与账', () => {
    fresh();
    g.state.clock.tick = 30;
    // 直接写入三模块的运行态（state:reset 后这些子树已存在）
    g.state.hex.on = true;
    g.state.hex.he = 123;
    g.state.tycoon.on = true;
    g.state.datalize.on = true;
    g.Game.save.autoSave();
    // 破坏后再读回
    g.state.hex.on = false; g.state.hex.he = 0;
    g.state.tycoon.on = false; g.state.datalize.on = false;
    g.Game.save.autoLoad();
    assert.equal(g.state.hex.on, true, 'hex.on 应还原');
    assert.equal(g.state.hex.he, 123, 'hex.he 应还原');
    assert.equal(g.state.tycoon.on, true, 'tycoon.on 应还原');
    assert.equal(g.state.datalize.on, true, 'datalize.on 应还原');
  });
});
