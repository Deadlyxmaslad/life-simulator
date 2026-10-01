'use strict';
/* =========================================================================
 * 音效系统测试（B13 · Web Audio 实时合成）
 * -------------------------------------------------------------------------
 * 覆盖：默认静音、开关与 toggle、音量 / BGM 开关持久化、无头环境降级为
 *       no-op、首次手势解锁、BGM 随人生阶段切轨、谱面完整性、静音短路。
 * 说明：沙箱内不存在 AudioContext，所有播放路径都应静默降级：既不能抛错，
 *       也不能把"未出声"误记为 failures。
 * ========================================================================= */
const { describe, it, assert } = require('../runner');
const h = require('../harness');

describe('音效 · 开关与合成（B13）', () => {
  const g = h.build({ quiet: true });
  const AUD = () => g.Game.audio;
  const A = () => g.Game.config.audio;

  it('默认静音：初始不发声，音量口径合法', () => {
    g.reset(9301);
    AUD().setEnabled(false, true); // 静默复位，保证用例互相独立
    assert.equal(A().enabledDefault, false, '配置应显式声明默认静音');
    assert.equal(AUD().isEnabled(), false, '初始状态应为静音');
    assert.range(AUD().volume(), 0, 1, '默认音量越界');
    assert.equal(AUD().stats().failures, 0, '初始化不应产生音频异常');
    assert.equal(AUD().stats().ctx, false, '静音时不应创建 AudioContext');
  });

  it('开关：setEnabled / toggle 切换状态并广播 audio:change', () => {
    g.reset(9302);
    let changes = 0;
    const off = g.Game.bus.on('audio:change', () => { changes++; });

    AUD().setEnabled(false, true);
    AUD().setEnabled(true);
    assert.equal(AUD().isEnabled(), true, '开启失败');
    assert.equal(AUD().stats().enabled, true, 'stats 未同步开启状态');

    const after = AUD().toggle();
    assert.equal(after, false, 'toggle 应返回切换后的状态');
    assert.equal(AUD().isEnabled(), false, 'toggle 未关闭声音');
    off();
    assert.ok(changes >= 2, 'audio:change 未广播');
  });

  it('偏好持久化：音量与 BGM 开关写入 localStorage', () => {
    g.reset(9303);
    AUD().setEnabled(true, true);
    AUD().setVolume(0.7);
    AUD().setBgm(false);

    assert.equal(AUD().volume(), 0.7, 'setVolume 未生效');
    assert.equal(AUD().isBgmOn(), false, 'setBgm 未生效');

    const raw = g.storage.getItem('lifesim_audio_pref');
    assert.ok(raw, '未写入音频偏好');
    const pref = JSON.parse(raw);
    assert.equal(pref.volume, 0.7, '音量未持久化');
    assert.equal(pref.bgmOn, false, 'BGM 开关未持久化');
    assert.range(pref.volume, 0, 1, '持久化音量越界');
  });

  it('无头降级：无 AudioContext 时播放为 no-op，不计失败也不抛错', () => {
    g.reset(9304);
    assert.equal(typeof g.sandbox.AudioContext, 'undefined', '本环境不应存在 Web Audio');
    AUD().setEnabled(true, true);
    const before = AUD().stats().failures;

    ['on', 'click', 'ask', 'act', 'ach', 'up', 'buy', 'coin', 'wed',
      'birth', 'sick', 'sad', 'retire', 'end', 'death'].forEach((k) => AUD().sfx(k));
    AUD().sfx('__not_exist__'); // 未登记的音效键

    assert.equal(AUD().stats().failures, before, '无音频环境下不应计入失败');
    assert.equal(AUD().stats().ctx, false, '未创建 AudioContext');
    AUD().setEnabled(false, true);
  });

  it('首次手势解锁：点击后标记解锁，BGM 随人生阶段切轨', () => {
    g.reset(9305);
    assert.equal(AUD().unlocked(), false, '初始应为未解锁');
    try { g.document._fire('click'); } catch (e) { /* 其它模块的 DOM 监听器可忽略 */ }
    assert.equal(AUD().unlocked(), true, '首次点击未解锁音频');

    g.state.clock.age = 3;
    assert.equal(AUD().stageKey(), 'child', '童年阶段轨道不符');
    g.state.clock.age = 15;
    assert.equal(AUD().stageKey(), 'school', '校园阶段轨道不符');
    g.state.clock.age = 40;
    assert.equal(AUD().stageKey(), 'work', '职场阶段轨道不符');
    g.state.clock.age = 70;
    assert.equal(AUD().stageKey(), 'retired', '退休阶段轨道不符');
  });

  it('谱面完整：关键 SFX 与四段 BGM 齐备，音量与暂停策略合法', () => {
    const cfg = A();
    ['on', 'click', 'death', 'birth', 'buy', 'coin', 'end'].forEach((k) => {
      assert.ok(Array.isArray(cfg.sfx[k]) && cfg.sfx[k].length > 0, '缺少音效谱：' + k);
    });
    ['child', 'school', 'work', 'retired'].forEach((k) => {
      assert.ok(cfg.bgm[k] && Array.isArray(cfg.bgm[k].notes) && cfg.bgm[k].notes.length > 0, '缺少 BGM 轨道：' + k);
    });
    assert.range(cfg.volume, 0, 1, '默认音量越界');
    assert.range(cfg.bgmVolume, 0, 1, 'BGM 音量越界');
    assert.equal(cfg.pauseWhenIdle, true, '暂停时应压低 BGM');
  });

  it('静音短路：关闭后任何事件都不触发音频输出', () => {
    g.reset(9306);
    AUD().setEnabled(false, true);
    const before = AUD().stats().failures;

    AUD().sfx('death');
    g.Game.bus.emit('decision:ask', { ev: {} });
    g.Game.bus.emit('asset:bought', { kind: 'house', item: {} });

    assert.equal(AUD().stats().failures, before, '静音时不应尝试输出音频');
    assert.equal(AUD().isEnabled(), false, '静音状态被破坏');
    assert.equal(AUD().stats().ctx, false, '静音时不应创建 AudioContext');
  });
});
