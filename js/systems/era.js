/* =========================================================================
 * 系统 · 时代 (era) —— 非事件系统，按真实公历年给出所处年代标签
 * -------------------------------------------------------------------------
 * 供 HUD 显示"时代"。年代划分在 config.eras。年份窗口决定主角会经历哪些
 * "时代特色事件"（那些事件是 decisions 里带 yearMin/yearMax 的条目）。
 * ========================================================================= */
(function () {
  const C = Game.config;
  Game.era = {
    of(year) {
      const list = C.eras;
      for (const e of list) if (year >= e.from && year <= e.to) return e;
      return list[list.length - 1];
    },
    current() {
      return this.of(Game.state.s.clock.year);
    },
  };
})();
