/* =========================================================================
 * 核心 · 系统基类与注册表 (systems)
 * -------------------------------------------------------------------------
 * 一个"系统"= 一组订阅事件、读写全局状态的自治模块。
 * 新增玩法（职业、婚恋、教育、社交、财务…）= 新建一个系统文件并注册。
 *
 * 用法：
 *   Game.systems.create('weather', 20).on('day', handler).build()
 * priority 小的先注册，其事件回调也先执行（用于保证因果顺序）。
 * ========================================================================= */
Game.systems = (function () {
  const list = [];
  const byName = Object.create(null);

  function create(name, priority) {
    const sys = {
      name,
      priority: priority || 100,
      _subs: [],
      // 在 init 阶段订阅事件；返回的取消函数会被统一收集
      on(event, fn) {
        this._subs.push({ event, fn });
        return this;
      },
      // 可选：每 tick 主动更新（多数系统用事件驱动即可）
      update(fn) {
        this.updateFn = fn;
        return this;
      },
      // create 已自动登记；保留 build() 作为语义收尾/链式终点（幂等）。
      build() {
        return this;
      },
    };
    list.push(sys);
    byName[name] = sys;
    return sys;
  }

  // 初始化：按优先级排序，绑定订阅到总线
  function initAll() {
    list.sort((a, b) => a.priority - b.priority);
    for (const sys of list) {
      for (const sub of sys._subs) {
        Game.bus.on(sub.event, sub.fn, sys);
      }
    }
  }

  // 每 tick 依次调用系统的 update（已按优先级排序）
  function updateAll(ctx) {
    for (const sys of list) {
      if (sys.updateFn) {
        try {
          sys.updateFn.call(sys, ctx);
        } catch (err) {
          console.error('[system:' + sys.name + '] update error', err);
        }
      }
    }
  }

  function get(name) {
    return byName[name];
  }

  return { create, initAll, updateAll, get, list };
})();
