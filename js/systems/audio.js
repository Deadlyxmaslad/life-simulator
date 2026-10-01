/* =========================================================================
 * 系统 · 音效与氛围音乐 (audio) —— priority 96
 * -------------------------------------------------------------------------
 * 路线图 B13：为人生各阶段配上音效与背景音乐。三条硬约束：
 *   1) 零外部资源 —— 全部用 Web Audio 振荡器实时合成（无 mp3/网络请求），
 *      保持 `file://` 双击可运行的纯前端形态；
 *   2) 默认静音 —— 尊重用户，首次点击才创建 AudioContext 并解锁播放；
 *   3) 可开关 —— 顶栏 🔇/🔊 按钮随时切换，偏好写入 localStorage。
 * BGM 按人生阶段切换（童年/校园/职场/退休），SFX 挂在既有事件上。
 * 页面不可用时（无头测试）整体降级为 no-op，绝不抛异常。
 * ========================================================================= */
(function () {
  const bus = Game.bus;
  const st = Game.state;
  const C = Game.config;
  const A = C.audio || { sfx: {}, bgm: {} };
  const KEY = 'lifesim_audio_pref';

  let ctx = null;
  let master = null;   // 总音量（静音即 0）
  let musicGain = null; // BGM 分支增益
  let sfxGain = null;
  let bgmTimer = null;
  let trackKey = null;
  let enabled = !!A.enabledDefault;
  let volume = A.volume == null ? 0.4 : A.volume;
  let bgmOn = A.bgmOn !== false;
  let failures = 0;
  let unlocked = false;

  loadPref();

  function loadPref() {
    try {
      const raw = (typeof localStorage !== 'undefined') && localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d) {
          enabled = !!d.enabled;
          if (typeof d.volume === 'number') volume = d.volume;
          if (typeof d.bgmOn === 'boolean') bgmOn = d.bgmOn;
        }
      }
    } catch (e) { /* 隐私模式等，忽略 */ }
  }

  function savePref() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(KEY, JSON.stringify({ enabled, volume, bgmOn }));
      }
    } catch (e) { /* 忽略 */ }
  }

  function AC() {
    return typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  }

  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    const Ctor = AC();
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = enabled ? volume : 0;
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1;
      musicGain = ctx.createGain();
      musicGain.gain.value = A.bgmVolume == null ? 0.35 : A.bgmVolume;
      sfxGain.connect(master);
      musicGain.connect(master);
      master.connect(ctx.destination);
      return ctx;
    } catch (e) {
      ctx = null;
      return null;
    }
  }

  /* --------------------------------- 基础音 --------------------------------- */
  function tone(freq, dur, delay, type, vol, bus_) {
    const c = ensureCtx();
    if (!c || !enabled) return;
    try {
      const t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      const peak = Math.max(0.0002, (vol == null ? 0.5 : vol) * 0.6);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.05, dur));
      o.connect(g);
      g.connect(bus_ || sfxGain);
      o.start(t0);
      o.stop(t0 + Math.max(0.06, dur) + 0.03);
    } catch (e) {
      failures++;
    }
  }

  function playSfx(key) {
    const seq = (A.sfx || {})[key];
    if (!seq || !enabled) return;
    for (const n of seq) tone(n[0], n[1], n[2] || 0, n[3] || 'triangle', n[4] == null ? 0.5 : n[4]);
  }

  /* ---------------------------------- BGM ---------------------------------- */
  function stageKey() {
    const p = st.s.person;
    const age = st.s.clock.age;
    if (p && p.career && p.career.phase === 'retired') return 'retired';
    if (age < 7) return 'child';
    if (age < 22) return 'school';
    if (age < 60) return 'work';
    return 'retired';
  }

  function stopBgm() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    trackKey = null;
  }

  function playTrack(key) {
    const tr = (A.bgm || {})[key];
    if (!tr || !enabled || !bgmOn) return;
    if (trackKey === key && bgmTimer) return;
    stopBgm();
    trackKey = key;
    const c = ensureCtx();
    if (!c) return;
    let i = 0;
    const beat = Math.max(160, tr.beat || 520);
    bgmTimer = setInterval(function () {
      if (!enabled || !bgmOn) { stopBgm(); return; }
      if (typeof document !== 'undefined' && document.hidden) return; // 后台不发声
      if (st.s.running === false && A.pauseWhenIdle !== false) return; // 暂停时不吵
      try {
        const notes = tr.notes || [];
        const n = notes[i % notes.length];
        if (n) tone(n, (beat / 1000) * 1.6, 0, tr.wave || 'sine', 0.5, musicGain);
        if (tr.bass && i % (tr.bassEvery || 4) === 0) {
          const b = tr.bass[Math.floor(i / (tr.bassEvery || 4)) % tr.bass.length];
          if (b) tone(b, (beat / 1000) * 3, 0, 'triangle', 0.4, musicGain);
        }
        i++;
      } catch (e) { stopBgm(); }
    }, beat);
  }

  function refreshBgm() {
    if (!enabled || !bgmOn) { stopBgm(); return; }
    playTrack(stageKey());
  }

  /* --------------------------------- 对外 API --------------------------------- */
  function setEnabled(v, silent) {
    enabled = !!v;
    if (enabled) {
      ensureCtx();
      if (master) master.gain.value = volume;
      refreshBgm();
      if (!silent) playSfx('on');
    } else {
      stopBgm();
      if (master) master.gain.value = 0;
    }
    savePref();
    bus.emit('audio:change', { enabled, volume, bgmOn });
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master && enabled) master.gain.value = volume;
    savePref();
    bus.emit('audio:change', { enabled, volume, bgmOn });
  }

  function setBgm(v) {
    bgmOn = !!v;
    if (bgmOn) refreshBgm();
    else stopBgm();
    savePref();
    bus.emit('audio:change', { enabled, volume, bgmOn });
  }

  /* ------------------------------- 事件挂钩 ------------------------------- */
  Game.systems
    .create('audio', 96)
    .on('state:reset', () => {
      stopBgm();
      if (enabled) refreshBgm();
    })
    .on('run:change', (e) => {
      if (enabled && e && e.running) refreshBgm();
      else stopBgm();
    })
    .on('year', () => { if (enabled) refreshBgm(); })
    .on('decision:ask', () => playSfx('ask'))
    .on('decision:answered', () => playSfx('click'))
    .on('action:done', () => playSfx('act'))
    .on('achievement:unlock', () => playSfx('ach'))
    .on('education:graduated', () => playSfx('ach'))
    .on('career:work', () => playSfx('up'))
    .on('career:retire', () => playSfx('retire'))
    .on('family:marry', () => playSfx('wed'))
    .on('family:birth', () => playSfx('birth'))
    .on('family:divorce', () => playSfx('sad'))
    .on('family:widow', () => playSfx('sad'))
    .on('natfamily:death', () => playSfx('sad'))
    .on('disease:new', () => playSfx('sick'))
    .on('asset:bought', () => playSfx('buy'))
    .on('asset:sold', () => playSfx('coin'))
    .on('story:ending', () => playSfx('end'))
    .on('death', () => { stopBgm(); playSfx('death'); })
    // —— 金手指三模块（J7 反馈强化：各补 1~2 个合成 SFX）——
    .on('hex:cast', () => playSfx('hex'))
    .on('hex:shield', () => playSfx('shield'))
    .on('tycoon:cast', () => playSfx('gold'))
    .on('tycoon:backlash', () => playSfx('backlash'))
    .on('datalize:cast', () => playSfx('data'))
    .on('datalize:earn', () => playSfx('dataUp'));

  // 首次用户手势解锁（浏览器自动播放策略）；此后静音/播放按钮才真正出声
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function once() {
      unlocked = true;
      if (enabled) { ensureCtx(); refreshBgm(); }
      document.removeEventListener('click', once);
    });
  }

  Game.audio = {
    isEnabled: () => enabled,
    isBgmOn: () => bgmOn,
    volume: () => volume,
    unlocked: () => unlocked,
    toggle() { setEnabled(!enabled); return enabled; },
    setEnabled, setVolume, setBgm,
    sfx: playSfx,
    track: () => trackKey,
    stageKey,
    // 供无头测试观测
    stats: () => ({ failures, ctx: !!ctx, track: trackKey, enabled }),
  };
})();
