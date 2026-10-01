'use strict';
/* =========================================================================
 * 成就 · 金手指三模块的纯净性与互斥性（v1.2.0 · K4）
 * -------------------------------------------------------------------------
 * 路线图 K4 约定：作弊局照常解锁普通成就（不惩罚），但"凭自己""白手起家"
 * 等纯净向徽章要求三个标记全为 false。本文件把这条约定钉成断言：
 *   ① 规则层：直接用 ctx 评估每个新增徽章的 test() —— 阈值与互斥关系
 *   ② 端到端：真跑一局并施放一次外挂，确认只点亮**自己那枚**发起徽章
 *   ③ 缺失层：删掉某个模块脚本后，成就层不得报错、也不得解锁它的徽章
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

// 取某枚徽章的定义（只构建一次环境，避免重复加载脚本）
let _list = null;
function badge(id) {
  if (!_list) _list = h.build({ quiet: true }).Game.config.achievements;
  return _list.filter((a) => a.id === id)[0];
}

// 造一个"够用"的 ctx，再按用例覆盖其中几项
function ctx(extra) {
  const base = {
    alive: false,
    age: 70,
    flags: {},
    used: { hex: false, tycoon: false, datalize: false },
    pure: true,
    hexSpent: 0,
    tycoonInjected: 0,
    dpSpent: 0,
    origin: '温饱',
    maxWealth: 200,
    peakNet: 200,
    pers: {},
    persDelta: {},
    dims: null,
    storyLines: [],
  };
  const c = Object.assign(base, extra || {});
  // 与 achievements.js 里 buildCtx 的口径保持一致：used 由 flags 推导
  const f = c.flags;
  c.used = { hex: !!f.used_hex, tycoon: !!f.used_tycoon, datalize: !!f.used_datalize };
  c.pure = !f.used_hex && !f.used_tycoon && !f.used_datalize;
  return c;
}

describe('成就 · 金手指纯净性', () => {
  it('① 纯净 ctx：凭自己 / 素手而为 / 白手起家 同时成立', () => {
    const c = ctx();
    assert.ok(badge('pure_life').test(c), '未动用任何金手指应解锁「凭自己」');
    assert.ok(badge('clean_strength').test(c), '未动用且净资产达标应解锁「素手而为」');
    assert.ok(badge('self_made').test(c), '贫寒出身 + 净资产百万 + 纯净 应解锁「白手起家」');
  });

  it('① 任一模块留痕，三枚纯净徽章全部失效', () => {
    for (const flag of ['used_hex', 'used_tycoon', 'used_datalize']) {
      const f = {};
      f[flag] = true;
      const c = ctx({ flags: f });
      assert.notOk(badge('pure_life').test(c), flag + ' 为真时不应解锁「凭自己」');
      assert.notOk(badge('clean_strength').test(c), flag + ' 为真时不应解锁「素手而为」');
      assert.notOk(badge('self_made').test(c), flag + ' 为真时不应解锁「白手起家」');
    }
  });

  it('① 发起徽章各自只认自己的标记（互不越界）', () => {
    const cases = [
      ['hex_initiate', 'used_hex'],
      ['tycoon_initiate', 'used_tycoon'],
      ['datalize_initiate', 'used_datalize'],
    ];
    for (const [id, own] of cases) {
      for (const other of ['used_hex', 'used_tycoon', 'used_datalize']) {
        const f = {};
        f[other] = true;
        assert.equal(badge(id).test(ctx({ flags: f })), other === own, id + ' 对 ' + other + ' 的判定不符预期');
      }
    }
  });

  it('① 重度使用徽章只统计自己的那一本账', () => {
    const clean = ctx();
    assert.notOk(badge('hex_addict').test(clean), '0 HE 不应解锁「逆天改命」');
    assert.notOk(badge('tycoon_spree').test(clean), '0 万注入不应解锁「挥金如土」');
    assert.notOk(badge('datalize_addict').test(clean), '0 DP 不应解锁「八面玲珑」');

    assert.ok(badge('hex_addict').test(ctx({ hexSpent: 300 })), 'HE 达 300 应解锁「逆天改命」');
    assert.notOk(badge('tycoon_spree').test(ctx({ hexSpent: 300 })), '海克斯消耗不应点亮神壕徽章');
    assert.ok(badge('tycoon_spree').test(ctx({ tycoonInjected: 2000 })), '注入达 2000 万应解锁「挥金如土」');
    assert.notOk(badge('datalize_addict').test(ctx({ tycoonInjected: 2000 })), '神壕注入不应点亮数据化徽章');
    assert.ok(badge('datalize_addict').test(ctx({ dpSpent: 200 })), 'DP 达 200 应解锁「八面玲珑」');
    assert.notOk(badge('hex_addict').test(ctx({ dpSpent: 200 })), '数据化消耗不应点亮海克斯徽章');
  });

  it('① 「三扇门」要求三个模块都用过', () => {
    assert.notOk(badge('all_three').test(ctx()), '纯净局不应解锁「三扇门」');
    assert.notOk(badge('all_three').test(ctx({ flags: { used_hex: true, used_tycoon: true } })), '只开两个不应解锁');
    assert.ok(
      badge('all_three').test(ctx({ flags: { used_hex: true, used_tycoon: true, used_datalize: true } })),
      '三个都用过应解锁「三扇门」'
    );
  });

  it('② 端到端：施放一次海克斯 → 只点亮 🧬 那一枚徽章', () => {
    const g = h.build({ quiet: true });
    g.reset(20260919);
    g.runYears(20);
    const Game = g.Game;
    Game.hex.enable();
    Game.state.s.hex.he = 100;
    const ok = Game.hex.cast('nocd');
    if (!ok) {
      // 冷却等限制可能挡下这一次施放，换一个必定可用的外挂
      Game.state.s.hex.cd = {};
      assert.ok(Game.hex.cast('nocd'), '清冷却后应能施放「无冷却」');
    }
    g.runToDeath(130);
    const A = g.person.achievements;
    assert.ok(g.person.flags.used_hex, '施放后应留下 used_hex 标记');
    assert.ok(A.hex_initiate, '应解锁「改写规则」');
    assert.notOk(A.tycoon_initiate, '不应解锁神壕的发起徽章');
    assert.notOk(A.datalize_initiate, '不应解锁数据化的发起徽章');
    assert.notOk(A.pure_life, '用过金手指的一生不应拿到「凭自己」');
  });

  it('② 端到端：纯净跑完一生 → 拿到「凭自己」，且三枚使用徽章都不亮', () => {
    const g = h.build({ quiet: true });
    g.reset(424242);
    g.runToDeath(130);
    const A = g.person.achievements;
    assert.notOk(g.person.flags.used_hex, '未开启模块不该留 used_hex');
    assert.notOk(g.person.flags.used_tycoon, '未开启模块不该留 used_tycoon');
    assert.notOk(g.person.flags.used_datalize, '未开启模块不该留 used_datalize');
    assert.notOk(A.hex_initiate || A.tycoon_initiate || A.datalize_initiate, '纯净局不应点亮任何使用徽章');
    if (g.state.clock.age >= 60) assert.ok(A.pure_life, '活到花甲以上应拿到「凭自己」');
  });

  it('③ 缺模块：删掉三个模块脚本，成就层照常评估且不解锁它们的徽章', () => {
    const scripts = h.headlessScripts().filter((p) => p.indexOf('js/systems/hex.js') < 0
      && p.indexOf('js/systems/tycoon.js') < 0
      && p.indexOf('js/systems/datalize.js') < 0);
    const g = h.build({ quiet: true, scripts });
    g.reset(777001);
    g.runToDeath(130);
    const A = g.person.achievements;
    assert.equal(typeof g.Game.hex, 'undefined', '未加载时不应存在 Game.hex');
    assert.notOk(A.hex_initiate, '模块缺失不应解锁 🧬 徽章');
    assert.notOk(A.tycoon_initiate, '模块缺失不应解锁 💰 徽章');
    assert.notOk(A.datalize_initiate, '模块缺失不应解锁 📊 徽章');
    assert.equal(g.Game.score.usedModules(g.person).length, 0, '缺模块时 usedModules 应为空');
  });
});
