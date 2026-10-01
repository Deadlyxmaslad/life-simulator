'use strict';
/* =========================================================================
 * 三模块正交性 / 隔离性测试（v1.2.0）
 * -------------------------------------------------------------------------
 * 设计约束：🧬海克斯 / 💰神壕 / 📊人数数据化 **三者之间没有任何关系**。
 * 本文件用四种手段把这条约束钉成可执行断言：
 *   ① 静态：三份源码互不引用对方的 Game.xxx
 *   ② 结构：三份 state 子树互不嵌套对方字段
 *   ③ 行为：全部关闭时，同种子的一生与"删掉这三份脚本"逐位一致
 *   ④ 组合：只开其一 / 全开，都能跑完一生且只在自己的账上留痕
 * ========================================================================= */
const fs = require('fs');
const path = require('path');
const { describe, it, assert } = require('../runner');
const h = require('../harness');

const ROOT = h.ROOT;
const BASE = h.headlessScripts();
const MODS = {
  hex: 'js/systems/hex.js',
  tycoon: 'js/systems/tycoon.js',
  datalize: 'js/systems/datalize.js',
};

// names: 要剔除的模块脚本路径
function without(names) {
  return BASE.filter((p) => names.indexOf(p) < 0);
}

function snapshot(g) {
  const s = g.Game.state.s;
  return JSON.stringify({
    clock: s.clock,
    person: s.person,
  });
}

function runLife(scripts, seed) {
  const g = h.build({ quiet: true, scripts });
  g.reset(seed);
  g.runToDeath(130);
  return { g, json: snapshot(g), age: g.state.clock.age, cause: g.person.deathCause };
}

describe('正交性 · 金手指三模块互不依赖', () => {
  it('① 静态：三份源码互不引用对方的模块对象', () => {
    const pairs = [
      ['hex', ['tycoon', 'datalize']],
      ['tycoon', ['hex', 'datalize']],
      ['datalize', ['hex', 'tycoon']],
    ];
    for (const [self, others] of pairs) {
      const src = fs.readFileSync(path.join(ROOT, MODS[self]), 'utf8');
      for (const o of others) {
        const re = new RegExp('Game\\.' + o + '\\b', 'g');
        const hit = src.match(re);
        assert.notOk(hit, MODS[self] + ' 不应引用 Game.' + o);
      }
    }
  });

  it('② 结构：三个 state 子树各自为政，互不嵌套对方字段', () => {
    const g = h.build({ quiet: true });
    g.reset(1001);
    g.runYears(25);
    const s = g.Game.state.s;
    const own = {
      hex: 'Game.state.s.hex', tycoon: 'Game.state.s.tycoon', datalize: 'Game.state.s.datalize',
    };
    const others = Object.keys(own);
    for (const k of others) {
      const json = JSON.stringify(s[k] || {});
      for (const o of others) {
        if (o === k) continue;
        assert.notOk(json.indexOf('"' + o + '"') >= 0, own[k] + ' 不应包含 "' + o + '" 子结构');
      }
    }
  });

  it('③ 行为：三模块全关时，同种子的一生与"删掉这三份脚本"逐位一致', () => {
    const seeds = [4242, 8191, 20260918];
    for (const seed of seeds) {
      const withMods = runLife(BASE, seed);
      const withoutMods = runLife(without(Object.values(MODS)), seed);
      assert.equal(withMods.age, withoutMods.age, '种子 ' + seed + '：寿命应一致');
      assert.equal(withMods.cause, withoutMods.cause, '种子 ' + seed + '：死因应一致');
      assert.equal(withMods.json, withoutMods.json, '种子 ' + seed + '：最终状态应逐位一致（模块关闭 = 模块不存在）');
    }
  });

  it('③ 行为：只删掉其中一个模块，其余仍能加载并注册', () => {
    for (const target of Object.keys(MODS)) {
      const scripts = without([MODS[target]]);
      const g = h.build({ quiet: true, scripts });
      g.reset(2001);
      const names = g.Game.systems.list.map((s) => s.name);
      const expect = Object.keys(MODS).filter((k) => k !== target);
      for (const k of expect) assert.ok(names.indexOf(k) >= 0, '删掉 ' + target + ' 后，' + k + ' 仍应在册');
      assert.equal(names.indexOf(target) < 0, true, '被删的模块不应在册');
      g.runToDeath(130);
      assert.notOk(g.person.alive, '删掉 ' + target + ' 后仍能跑完一生');
      assert.ok(g.state.clock.age > 0, '应正常推进');
    }
  });

  it('④ 组合：全开并各自用一次，只在自己的账上留痕', () => {
    const g = h.build({ quiet: true });
    const G = g.Game;
    g.reset(3001);
    G.hex.enable();
    G.tycoon.enable();
    G.datalize.enable();
    g.runYears(24);

    // 三个模块各自消费一次（氪命只是"充值"，不算用过）
    G.state.s.hex.he = 100;
    G.state.s.hex.cd = {};
    assert.ok(G.hex.burn('mood'), '海克斯：氪命应将体征换成算力');
    assert.notOk(g.person.flags.used_hex, '氪命本身不计入"用过外挂"（只有真正施放才算）');
    assert.ok(G.hex.cast('nocd'), '海克斯：施放应成功');

    G.state.s.tycoon.quotaUsed = 0;
    G.state.s.tycoon.cd = {};
    assert.ok(G.tycoon.withdraw(), '神壕：提款应成功');

    const list = G.datalize.people();
    assert.ok(list.length > 0, '应存在关系人');
    G.state.s.datalize.dp = 60;
    assert.ok(G.datalize.reveal(0), '数据化：读取应成功');

    const p = g.person;
    assert.ok(p.flags.used_hex, '应打上海克斯标记');
    assert.ok(p.flags.used_tycoon, '应打上神壕标记');
    assert.ok(p.flags.used_datalize, '应打上数据化标记');

    // 折损各自独立：把海克斯的账拉满，其余两个的折损数字必须分毫不动
    const beforeT = G.tycoon.rebate();
    const beforeD = G.datalize.rebate();
    G.state.s.hex.spent = G.config.hex.scoreRebate.per;
    assert.equal(G.hex.rebate(), G.config.hex.scoreRebate.min, '海克斯应折到自己的下限');
    assert.equal(G.tycoon.rebate(), beforeT, '海克斯的消耗不应影响神壕折损');
    assert.equal(G.datalize.rebate(), beforeD, '海克斯的消耗不应影响数据化折损');
    assert.ok(beforeD < 1, '前置：数据化自己那份消耗应已产生折损');

    const mods = G.score.usedModules(p);
    assert.ok(mods.indexOf('hex') >= 0, '榜单标注应包含 hex');
    assert.ok(mods.indexOf('datalize') >= 0, '榜单标注应包含 datalize');
  });

  it('④ 组合：评分层把三个模块的折损分行列出并压低总分', () => {
    const g = h.build({ quiet: true });
    const G = g.Game;
    g.reset(3002);
    g.runYears(30);
    const p = g.person;
    p.flags.used_hex = true;
    p.flags.used_tycoon = true;
    p.flags.used_datalize = true;
    G.state.s.hex.spent = G.config.hex.scoreRebate.per;
    G.state.s.tycoon.injected = G.config.tycoon.scoreRebate.per;
    G.state.s.datalize.spent = G.config.datalize.scoreRebate.per;

    const rows = G.score.breakdown(G.state.s);
    const labels = rows.map((r) => r.label).join('|');
    assert.ok(labels.indexOf('海克斯') >= 0, '应列出海克斯折损行');
    assert.ok(labels.indexOf('神壕') >= 0, '应列出神壕折损行');
    assert.ok(labels.indexOf('数据化') >= 0, '应列出数据化折损行');

    const total = rows.reduce((n, r) => n + r.pts, 0);
    const raw = rows.filter((r) => r.pts > 0).reduce((n, r) => n + r.pts, 0);
    assert.ok(total < raw, '折损行应压低总分');
    for (const r of rows.slice(-3)) assert.ok(r.pts < 0, '折损行应为负分');
  });

  it('④ 存档：旧版存档（无 modules 字段）读档后三模块各自复位', () => {
    const g = h.build({ quiet: true });
    const G = g.Game;
    g.reset(3003);
    g.runYears(20);
    // 先把三个模块的账弄脏，再读一份 v1.1.0 的老存档
    G.state.s.hex.he = 88;
    G.state.s.tycoon.injected = 999;
    G.state.s.datalize.dp = 33;
    const legacy = {
      version: '1.1.0', ts: Date.now(), seed: 3003,
      clock: JSON.parse(JSON.stringify(G.state.s.clock)),
      world: JSON.parse(JSON.stringify(G.state.s.world)),
      person: JSON.parse(JSON.stringify(G.state.s.person)),
      diseases: [], logLines: [], stats: JSON.parse(JSON.stringify(G.state.s.stats)),
      timeline: [], curve: [], market: G.state.s.market, speedIndex: 1,
      pendingId: null, pendingAge: null,
    };
    g.storage.setItem(G.save.keyPrefix + '1', JSON.stringify(legacy));
    assert.ok(G.save.load(1), '旧存档应能正常读档');
    assert.equal(G.state.s.hex.he, 0, '旧存档读档后 HE 应复位');
    assert.equal(G.state.s.tycoon.injected, 0, '旧存档读档后注入金额应复位');
    assert.equal(G.state.s.datalize.dp, 0, '旧存档读档后 DP 应复位');
  });

  it('④ 存档：新版存档带上三份各自的账，读档可完整还原', () => {
    const g = h.build({ quiet: true });
    const G = g.Game;
    g.reset(3004);
    g.runYears(20);
    G.hex.enable();
    G.state.s.hex.he = 55;
    G.state.s.tycoon.injected = 77;
    G.state.s.datalize.dp = 19;
    assert.ok(G.save.save(1), '存档应成功');
    G.state.s.hex.he = 0;
    G.state.s.tycoon.injected = 0;
    G.state.s.datalize.dp = 0;
    assert.ok(G.save.load(1), '读档应成功');
    assert.equal(G.state.s.hex.he, 55, 'HE 应随存档还原');
    assert.equal(G.state.s.tycoon.injected, 77, '注入金额应随存档还原');
    assert.equal(G.state.s.datalize.dp, 19, 'DP 应随存档还原');
  });
});
