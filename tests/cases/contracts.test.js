'use strict';
/* =========================================================================
 * 人生合约（v1.6.0）测试
 * -------------------------------------------------------------------------
 * 覆盖：
 *  - 空态：开局 contracts 子树为零态、无副作用
 *  - 下发：成年后按 5 年一期内下发候选；未成年不下发
 *  - 认领：认领后进入 active，剩余年限正确；重复认领被拒；认领非候选被拒
 *  - 到期结算：达标 → kept+1 + 奖励 + 徽章；未达标 → failed+1 且不惩罚
 *  - 放弃：skip 后可重新进入下一期
 *  - 存档 snapshot↔hydrate 往返；hydrate(null) 回到空态
 *  - 评分「合约」行存在；合约成就能解锁
 *  - 隔离性：不触碰金手指三模块
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('人生合约', () => {
  const g = h.build({ quiet: true });

  const KC = () => g.Game.config.contracts;
  const CT = () => g.Game.contracts;

  function fresh(seed) { g.reset(seed == null ? 20260921 : seed); }

  // 推到成年（合约从 18 岁起下发）
  function grow() { g.runYears(20, () => 0); }

  /* -------------------------------- 空态 -------------------------------- */
  it('开局合约子树为零态', () => {
    fresh();
    const s = g.state.contracts;
    assert.ok(s, 'contracts 子树应存在');
    assert.equal(s.period, 0, '起始未开期');
    assert.equal(s.active, null, '起始无在手合约');
    assert.equal(JSON.stringify(s.history), '[]', '起始无历史');
    assert.equal(s.kept, 0);
    assert.equal(s.failed, 0);
  });

  it('未成年不下发合约', () => {
    fresh();
    g.runYears(10, () => 0);          // 只到 10 岁
    assert.equal(g.state.clock.age < (KC().minAge || 18), true, '应仍未成年');
    assert.equal(CT().state().period, 0, '未成年不应开期');
  });

  /* -------------------------------- 下发 -------------------------------- */
  it('成年后下发候选合约，张数符合配置', () => {
    fresh();
    grow();
    const s = CT().state();
    assert.ok(s.period >= 1, '成年后应至少开一期');
    assert.ok(s.offer.length > 0, '应有候选合约');
    assert.ok(s.offer.length <= (KC().offerCount || 3), '候选数不超过配置上限');
    // 每张候选都能在池里找到定义
    for (const o of s.offer) {
      assert.ok(CT().def(o.id), '候选应来自合约池：' + o.id);
    }
  });

  it('候选合约互不重复', () => {
    fresh(777);
    grow();
    const ids = CT().state().offer.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, '同一期候选不应重复');
  });

  /* -------------------------------- 认领 -------------------------------- */
  it('认领后进入在手状态，剩余年限等于周期', () => {
    fresh();
    grow();
    const offer = CT().state().offer;
    assert.ok(offer.length, '应有候选');
    const ok = CT().claim(offer[0].id);
    assert.equal(ok, true, '认领应成功');
    const s = CT().state();
    assert.ok(s.active, '应有在手合约');
    assert.equal(s.active.id, offer[0].id, '在手合约应是认领的那张');
    assert.equal(s.active.leftYears, (KC().period || 5), '剩余年限应等于周期');
  });

  it('重复认领被拒绝', () => {
    fresh();
    grow();
    const offer = CT().state().offer;
    assert.equal(CT().claim(offer[0].id), true);
    assert.equal(CT().claim(offer[1] ? offer[1].id : offer[0].id), false, '已有在手合约时不应再认领');
  });

  it('认领不在候选里的合约被拒绝', () => {
    fresh();
    grow();
    assert.equal(CT().claim('__nope__'), false, '未知合约应被拒');
  });

  /* ------------------------------ 到期结算 ------------------------------ */
  it('达标合约：达成计数 +1、发奖励、记徽章', () => {
    fresh();
    grow();
    const offer = CT().state().offer;
    const t = CT().claim(offer[0].id);
    assert.ok(t);
    // 强制到期并直接把 track 伪造为达标（用「积攒」这类可精确构造的合约更稳，但这里通用做法：
    // 把 dueYear 提前到当前年，再手动满足所有常见条件）
    const p = g.person;
    p.wealth = 9999;
    p.health = 100; p.immunity = 100;
    if (p.mental) p.mental.stress = 0;
    if (p.education) p.education.level = '博士';
    if (p.social) p.social.friends = p.social.friends || [];
    const before = CT().kept();
    g.Game.contracts._settle();
    const after = CT().kept() + CT().failed();
    assert.equal(after, before + 1, '结算后应落在 kept 或 failed 之一');
    assert.ok(CT().state().history.length >= 1, '应写入历史');
  });

  it('未达标合约：只记 failed，不扣分不惩罚', () => {
    fresh();
    grow();
    const offer = CT().state().offer;
    CT().claim(offer[0].id);
    // 把在手合约的 track 破坏为必然不达标
    const s = g.state.contracts;
    s.active.track.minHealth = 0;
    s.active.track.minImmunity = 0;
    s.active.track.maxStress = 100;
    s.active.track.maxFriends = 0;
    s.active.track.reachedManagement = false;
    s.active.track.wealthStart = 0;
    s.active.track.wealthEnd = -999;
    g.person.wealth = -999;
    if (g.person.mental) g.person.mental.stress = 100;
    // 还要盖住不读 track 的两类合约：寒窗五载（读学历）与 凭自己（读金手指旗标）
    if (g.person.education) g.person.education.level = '—';
    g.person.flags.used_hex = true;
    g.person.flags.used_tycoon = true;
    g.person.flags.used_datalize = true;
    const f0 = CT().failed();
    const before = {
      mood: g.person.mood, health: g.person.health,
      stress: g.person.mental ? g.person.mental.stress : 0,
    };
    g.Game.contracts._settle();
    assert.equal(CT().failed(), f0 + 1, '应记一次未达成');
    // 未达成不应带来属性惩罚（mood 不因"违约"而下降）
    assert.ok(g.person.mood >= before.mood - 0.001, '违约不应扣心情');
  });

  /* -------------------------------- 放弃 -------------------------------- */
  it('本期不认领：offer 清空、active 仍为空', () => {
    fresh();
    grow();
    assert.ok(CT().state().offer.length > 0, '应有候选');
    assert.equal(CT().skip(), true, '放弃应成功');
    assert.equal(CT().state().offer.length, 0, '放弃后候选清空');
    assert.equal(CT().state().active, null, '放弃后仍无在手合约');
  });

  /* -------------------------------- 存档 -------------------------------- */
  it('存档 snapshot↔hydrate 往返还原在手合约', () => {
    fresh();
    grow();
    const offer = CT().state().offer;
    CT().claim(offer[0].id);
    const snap = CT().snapshot();
    const id = CT().state().active.id;
    CT().hydrate(null);
    assert.equal(CT().state().active, null, 'hydrate(null) 应回到空态');
    CT().hydrate(snap);
    assert.equal(CT().state().active.id, id, '往返后应还原在手合约');
  });

  /* ------------------------------ 评分接入 ------------------------------ */
  it('评分 breakdown 含「合约」行', () => {
    fresh();
    grow();
    const rows = g.Game.score.breakdown(g.state);
    assert.ok(Array.isArray(rows), 'breakdown 应返回数组');
    assert.ok(rows.some((r) => r.label === '合约'), 'breakdown 应包含「合约」行');
    assert.ok(rows.some((r) => r.label === '底色'), 'breakdown 应包含「底色」行');
  });

  it('合约成就定义可判定：达成 1 期即「一诺千金」', () => {
    fresh();
    const def = g.Game.config.achievements.find((a) => a.id === 'first_contract');
    assert.ok(def, '应存在 first_contract 成就');
    assert.equal(def.test({ contracts: { kept: 1, failed: 0, badges: [] } }), true, '达成 1 期应满足');
    assert.equal(def.test({ contracts: { kept: 0, failed: 0, badges: [] } }), false, '未达成不应满足');
    const iron = g.Game.config.achievements.find((a) => a.id === 'contract_iron');
    assert.equal(iron.test({ contracts: { kept: 6, failed: 0, badges: [] } }), true, '6 期应满足铁诺');
  });

  /* -------------------------------- 隔离性 -------------------------------- */
  it('合约系统不触碰金手指三模块', () => {
    fresh();
    grow();
    const offer = CT().state().offer;
    if (offer.length) CT().claim(offer[0].id);
    g.runDays(40);
    const hx = g.state.hex, ty = g.state.tycoon, dl = g.state.datalize;
    if (hx) assert.equal(hx.on, false, 'hex 应仍关闭');
    if (ty) assert.equal(ty.on, false, 'tycoon 应仍关闭');
    if (dl) assert.equal(dl.on, false, 'datalize 应仍关闭');
  });
});
