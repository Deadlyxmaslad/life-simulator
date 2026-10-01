/* =========================================================================
 * 入口 · 组装 & 启动 (main)
 * -------------------------------------------------------------------------
 * 顺序：初始化总线订阅(注册所有系统) → 复位一局状态 → 启动渲染循环 → 绑定 UI。
 * 想接新的系统：新建 js/systems/xxx.js 并在这里 <script> 引入即可自动注册。
 * ========================================================================= */
(function () {
  // 复位一局人生：传入 seed 可复现；不传则随机取一个全新命运种子。
  Game.reset = function (seed) {
    if (seed == null) {
      seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    }
    Game.state.reset(seed);
    Game.state.s.currentSeed = seed;
    Game.bus.emit('run:change', { running: false });
    const p = Game.state.s.person;
    const by = Game.state.s.clock.year;
    const era = Game.era ? Game.era.of(by) : null;
    // 复位后立刻补开场日志（首帧天气由 weather 系统响应 state:reset 生成）
    Game.state.log('👶 ' + by + ' 年，一个新生命诞生了——' + p.gender + '婴「' + p.name + '」' + (era ? '，生于「' + era.name + '」。' : '。') + ' 命运种子 #' + seed + '。', 'good', '👶');
    if (Game.scenario) {
      const sc = Game.scenario.cur();
      Game.state.log('🎬 本局剧本：' + sc.label + ' —— ' + sc.desc + '（可随时在顶部切换）', 'info', '🎬');
    }
    Game.state.log('提示：点击「开始一生」让时间流动起来。', 'info', '💡');
    if (Game.hud && Game.hud.updateStatusPill) Game.hud.updateStatusPill();
  };

  function boot() {
    // 1) 绑定所有已注册系统的事件订阅
    Game.systems.initAll();
    // 2) 启动 rAF 主循环（处于暂停态，等待玩家点击）
    Game.loop.start();
    // 3) 初始化界面
    Game.hud.init();
    // 3.5) 单屏布局优化（纯表现层；窗口太小时自动交还自然滚动）
    if (Game.layout) Game.layout.init();
    // 4) 优先自动续上上次未完成的人生；否则开新局
    if (!Game.save.autoLoad()) {
      Game.reset();
    }
    // 5) 设置默认速度
    Game.loop.setSpeed(Game.state.s.speedIndex);

    console.log('[LifeSim] v' + Game.version + ' 已启动。系统：',
      Game.systems.list.map((s) => s.name).join(', '));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
