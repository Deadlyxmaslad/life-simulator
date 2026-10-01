'use strict';
/* =========================================================================
 * 🧬 海克斯（hex）测试
 * -------------------------------------------------------------------------
 * 覆盖：默认关闭时不得改变死亡行为、氪命换算、概率倾斜到期复位（禁止污染
 *       随机流）、冷却期内施放无效且不退不扣、死亡豁免一次性、结算折损。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

function giveHE(G, n) { G.state.s.hex.he = n; }

// 把主角推到必然死亡的位置：重病 + 极低血量（健康每日会自愈，光置 0 不够）
function kill(g) {
  const p = g.person;
  g.Game.disease.contract('pneumonia');
  g.Game.state.setVital('health', 1, '测试');
  for (let i = 0; i < 80 && p.alive; i++) g.Game.loop.step();
  return p.alive;
}

describe('🧬 海克斯（hex）· 规则类外挂', () => {
  const g = h.build({ quiet: true });
  const G = g.Game;
  const HEX = G.config.hex;

  it('默认关闭：isOn() 为 false，且 health 归零时死亡不被拦截', () => {
    g.reset(6601);
    assert.notOk(G.hex.isOn(), '默认应处于关闭态');
    assert.equal(G.util.luckMul(), 1, '关闭时概率倍率应为 1');
    const alive = kill(g);
    assert.notOk(alive, '未开启模块时应照常死亡');
    assert.equal(G.hex.rebate(), 1, '未使用外挂时不应有结算折损');
  });

  it('氪命：按配置扣减体征，HE 按比例入账', () => {
    g.reset(6602);
    G.hex.enable();
    giveHE(G, 0);
    const p = g.person;
    const s = G.state.s.hex;
    G.state.setVital('health', 80, '测试');
    G.state.setVital('immunity', 80, '测试');
    G.state.setVital('mood', 80, '测试');

    const h0 = p.health, i0 = p.immunity, m0 = p.mood;
    assert.ok(G.hex.burn('health'), '氪命（健康）应成功');
    assert.near(p.health, h0 - HEX.burn.health.per, 1e-6, '健康扣减不符');
    assert.near(s.he, HEX.burn.health.he, 1e-6, 'HE 入账不符');

    const he1 = s.he;
    assert.ok(G.hex.burn('immunity'), '氪命（免疫）应成功');
    assert.near(p.immunity, i0 - HEX.burn.immunity.per, 1e-6, '免疫扣减不符');
    assert.near(s.he, he1 + HEX.burn.immunity.he, 1e-6, 'HE 累计不符');

    const he2 = s.he;
    assert.ok(G.hex.burn('mood'), '氪命（心情）应成功');
    assert.near(p.mood, m0 - HEX.burn.mood.per, 1e-6, '心情扣减不符');
    assert.near(s.he, he2 + HEX.burn.mood.he, 1e-6, 'HE 累计不符');
  });

  it('血量不足时氪命被拒绝（不许把自己氪死）', () => {
    g.reset(6603);
    G.hex.enable();
    giveHE(G, 0);
    G.state.setVital('health', 2, '测试');
    assert.notOk(G.hex.burn('health'), '血量低于扣减量时应拒绝');
    assert.equal(G.state.s.hex.he, 0, '失败的氪命不应入账 HE');
  });

  it('概率倾斜：施放后倍率提升，到期自动复位到 1（随机流不被永久污染）', () => {
    g.reset(6604);
    G.hex.enable();
    giveHE(G, 200);
    const s = G.state.s.hex;
    assert.ok(G.hex.cast('luck'), '概率倾斜应施放成功');
    assert.equal(G.util.luckMul(), HEX.luck.mul, '倾斜期倍率应为配置值');
    assert.ok(G.hex.riskBonus() > 1, '抉择成功率加成应生效');
    g.runDays(120); // 跑过 3 个月以上
    assert.equal(s.luckLeft, 0, '倾斜应已过期');
    assert.equal(G.util.luckMul(), 1, '过期后随机流必须复位为 1');
    assert.equal(G.hex.riskBonus(), 1, '过期后抉择加成应回到 1');
  });

  it('冷却期内不可重复施放，且不产生任何副作用', () => {
    g.reset(6605);
    G.hex.enable();
    giveHE(G, 200);
    const s = G.state.s.hex;
    assert.ok(G.hex.cast('nocd'), '首次施放应成功');
    const heAfter = s.he;
    const spentAfter = s.spent;
    assert.notOk(G.hex.usable('nocd'), '冷却期内不应可用');
    assert.notOk(G.hex.cast('nocd'), '冷却期内施放应失败');
    assert.equal(s.he, heAfter, '失败的施放不得扣算力');
    assert.equal(s.spent, spentAfter, '失败的施放不得计入消耗');
  });

  it('HE 不足时不扣库存也不留痕；只有真正用掉才打 used_hex 标记', () => {
    g.reset(6606);
    G.hex.enable();
    giveHE(G, 5);
    const p = g.person;
    assert.notOk(G.hex.cast('nocd'), '算力不足应失败');
    assert.equal(G.state.s.hex.he, 5, 'HE 不应变化');
    assert.notOk(p.flags.used_hex, '未成功使用前不应打标记');
    giveHE(G, 100);
    assert.ok(G.hex.cast('nocd'), '算力充足应成功');
    assert.ok(p.flags.used_hex, '用过之后应打标记');
  });

  it('死亡豁免：拦下一次死亡并回到配置血量，第二次必定放行', () => {
    g.reset(6607);
    G.hex.enable();
    giveHE(G, 1000);
    const p = g.person;
    assert.ok(G.hex.cast('shield'), '死亡豁免应购买成功');
    assert.equal(G.state.s.hex.shield, true, '护盾未就绪');

    let healthAtShield = -1;
    const off = G.bus.on('hex:shield', function (e) { healthAtShield = e.health; });
    G.disease.contract('pneumonia');
    G.state.setVital('health', 1, '测试');
    for (let i = 0; i < 80 && G.state.s.hex.shield; i++) G.loop.step();
    off();
    assert.ok(p.alive, '第一次死亡应被豁免');
    assert.equal(healthAtShield, HEX.shieldHealth, '应恢复到配置的血量');
    assert.equal(G.state.s.hex.shield, false, '豁免后应消耗掉');

    kill(g);
    assert.notOk(p.alive, '第二次应正常死亡');
  });

  it('结算折损：随累计消耗下降并停在配置下限', () => {
    g.reset(6608);
    G.hex.enable();
    G.state.s.hex.spent = 0;
    assert.equal(G.hex.rebate(), 1, '零消耗不折损');
    G.state.s.hex.spent = HEX.scoreRebate.per / 2;
    assert.near(G.hex.rebate(), 0.5, 1e-6, '半程应折损一半');
    G.state.s.hex.spent = HEX.scoreRebate.per * 10;
    assert.equal(G.hex.rebate(), HEX.scoreRebate.min, '应停在配置下限');
  });

  it('panel() 返回 UI 描述符，HE 与冷却状态可读', () => {
    g.reset(6609);
    G.hex.enable();
    giveHE(G, 42);
    const p = G.hex.panel();
    assert.equal(p.key, 'hex', '面板 key 不符');
    assert.ok(p.rows.length >= 6, '能力行过少');
    assert.ok(p.extras.length >= 3, '氪命按钮缺失');
    assert.ok(p.note.indexOf('HE') >= 0, '面板摘要应包含算力口径');
    assert.ok(typeof p.rows[0].ready === 'boolean', '每行应给出 ready');
  });

  it('存档：snapshot 不含回溯快照，hydrate 可复原且会清掉 memo', () => {
    g.reset(6610);
    G.hex.enable();
    giveHE(G, 77);
    G.state.s.hex.memo = { fake: true };
    const snap = G.hex.snapshot();
    assert.equal(snap.he, 77, '快照应记录 HE');
    assert.notOk('memo' in snap, '回溯内存快照绝不能被序列化');
    G.hex.hydrate(snap);
    assert.equal(G.state.s.hex.he, 77, '复原后 HE 应一致');
    assert.equal(G.state.s.hex.memo, null, '复原后应清空回溯快照');
  });
});
