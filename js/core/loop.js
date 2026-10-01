/* =========================================================================
 * 核心 · 主循环 (loop)
 * -------------------------------------------------------------------------
 * 用 requestAnimationFrame + 时间累加器，把"速度(tps:每秒 tick 数)"
 * 转换成离散的时间推进。每个 tick 广播 'tick' 事件，并跑一次系统 update。
 * 时钟系统监听 'tick' 推进日期，再由日期派生 day/month/year 等事件。
 * ========================================================================= */
Game.loop = (function () {
  const bus = Game.bus;
  const st = Game.state;

  let rafId = null;
  let lastTs = 0;
  let acc = 0;
  const MAX_TICKS_PER_FRAME = 500; // 防止高速度时单帧卡死（最多补这么多 tick）

  function doTick() {
    const tick = { tick: st.s.clock.tick + 1 };
    bus.emit('tick', tick);
    Game.systems.updateAll(tick);
  }

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    // 有待处理的抉择弹窗时冻结推进（running 保持不变，待玩家选择后自动继续）
    if (st.s.pendingDecision || !st.s.running || !st.s.person.alive) {
      lastTs = ts;
      return;
    }
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.25) dt = 0.25; // 切后台回来不要瞬间推进一大堆

    acc += dt * st.s.tps;
    let n = 0;
    while (acc >= 1 && n < MAX_TICKS_PER_FRAME && st.s.running && !st.s.pendingDecision) {
      acc -= 1;
      doTick();
      n++;
      if (!st.s.person.alive) {
        acc = 0;
        break;
      }
    }
    if (n >= MAX_TICKS_PER_FRAME) acc = 0;
  }

  function start() {
    if (rafId == null) {
      lastTs = 0;
      acc = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function play() {
    if (!st.s.person.alive) return;
    st.s.running = true;
    bus.emit('run:change', { running: true });
  }

  function pause() {
    st.s.running = false;
    bus.emit('run:change', { running: false });
  }

  function toggle() {
    st.s.running ? pause() : play();
  }

  // 单步：手动推进一天（暂停状态下用）
  function step() {
    if (st.s.pendingDecision || !st.s.person.alive) return;
    doTick();
  }

  function setSpeed(index) {
    const speeds = Game.config.time.speeds;
    st.s.speedIndex = Game.util.clamp(index, 0, speeds.length - 1);
    st.s.tps = speeds[st.s.speedIndex].tps;
    bus.emit('speed:change', { index: st.s.speedIndex, tps: st.s.tps });
  }

  // 外部模块专用：一次性推进若干个月（受 pendingDecision 与死亡中断）
  function monthIndex() {
    const c = st.s.clock;
    return c.year * 12 + c.month;
  }
  function advanceMonths(n) {
    const months = Math.max(0, Math.floor(n) || 0);
    if (!months) return 0;
    const target = monthIndex() + months;
    let ticks = 0;
    const maxTicks = months * 40;
    while (ticks < maxTicks && st.s.person.alive && !st.s.pendingDecision && monthIndex() < target) {
      doTick();
      ticks++;
    }
    return ticks;
  }

  // —— 自动暂停（参与感）——
  // 仅在"自动播放(running=true)"时生效；手动单步与测试驱动(advanceMonths/step)不受影响。
  // 每次跨年交界（生日/新年）与每次事件弹出都会把游戏置为暂停态，让玩家有时间停留、
  // 阅读、做选择，避免一路快进失去"人生参与感"。可在 UI 或 config.time.autoPause 中关闭。
  bus.on('year', function () {
    const ap = Game.config.time.autoPause;
    if (!(ap && ap.year && st.s.autoPause)) return;
    if (!st.s.running) return; // 仅自动播放时生效（手动单步/驱动推进不打断）
    pause();
    bus.emit('loop:autopause', { reason: 'year' });
  });
  bus.on('decision:ask', function () {
    const ap = Game.config.time.autoPause;
    if (ap && ap.event && st.s.autoPause && st.s.running) {
      pause();
      bus.emit('loop:autopause', { reason: 'event' });
    }
  });

  return { start, play, pause, toggle, step, setSpeed, advanceMonths };
})();
