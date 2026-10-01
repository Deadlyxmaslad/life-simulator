/* =========================================================================
 * 核心 · 事件总线 (EventBus)
 * -------------------------------------------------------------------------
 * 所有子系统之间不直接互相调用，而是通过事件解耦。
 * 这是"可扩展"的关键：新增一个系统只需要订阅它关心的事件即可。
 *
 * 常用事件约定（见 config.EVENTS）：
 *   day         每过一天         {}
 *   month       每过一月         { month }
 *   year        每过生日/新年     { age, year }
 *   season      季节切换         { season }
 *   weather:change 天气变化      { weather }
 *   health:change  健康变化       { delta, value, source }
 *   immunity:change 免疫变化      { delta, value, source }
 *   mood:change    心情变化       { delta, value, source }
 *   disease:new    感染疾病       { disease }
 *   disease:end    疾病结束       { disease, outcome }
 *   death          死亡           { cause, age }
 *   log          日志            { level, msg, time }
 * ========================================================================= */
Game.bus = (function () {
  const handlers = Object.create(null);

  function on(event, fn, ctx) {
    (handlers[event] || (handlers[event] = [])).push({ fn, ctx: ctx || null });
    return () => off(event, fn);
  }

  function once(event, fn, ctx) {
    const wrap = function (payload) {
      off(event, wrap);
      fn.call(ctx || null, payload);
    };
    return on(event, wrap);
  }

  function off(event, fn) {
    const list = handlers[event];
    if (!list) return;
    const i = list.findIndex((h) => h.fn === fn);
    if (i >= 0) list.splice(i, 1);
  }

  // emit 会先通知具体事件订阅者，再通知通配 '*' 订阅者（用于日志/调试）。
  function emit(event, payload) {
    const list = handlers[event];
    if (list) {
      // 拷贝一份，避免处理过程中订阅关系变化导致的错位
      for (const h of list.slice()) {
        try {
          h.fn.call(h.ctx, payload || EMPTY);
        } catch (err) {
          console.error('[bus] handler error on "' + event + '"', err);
        }
      }
    }
    const wild = handlers['*'];
    if (wild) {
      for (const h of wild.slice()) {
        try {
          h.fn.call(h.ctx, { event, payload: payload || EMPTY });
        } catch (err) {
          console.error('[bus] wildcard handler error', err);
        }
      }
    }
  }

  const EMPTY = {};

  return { on, once, off, emit };
})();
