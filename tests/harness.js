'use strict';
/* =========================================================================
 * 无头测试装置 (tests/harness.js)
 * -------------------------------------------------------------------------
 * 在 Node 里"假装"一个浏览器：按 index.html 的 <script> 顺序把核心与系统
 * 载入 vm 沙箱，shim 掉 window / document / localStorage / requestAnimationFrame，
 * 于是可以脱离浏览器手动推进 loop.step()，跑出完整人生用于回归测试。
 *
 * 约定：不加载 js/ui/*（它们依赖真实 DOM）；Game.hud 用空壳替代。
 * 用法：
 *   const h = require('./harness');
 *   const g = h.build({ seed: 12345 });
 *   g.runYears(80);           // 推进到 80 岁，自动替玩家点掉抉择弹窗
 *   g.state.person.wealth ... // 读最终状态做断言
 * ========================================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ------------------------------ 脚本顺序 ------------------------------ */
function htmlScripts() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="([^"]+)"\s*><\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function headlessScripts() {
  return htmlScripts().filter((p) => p.indexOf('js/ui/') !== 0);
}

/* -------------------------------- shims -------------------------------- */
function makeStorage() {
  const map = new Map();
  return {
    getItem(k) { k = String(k); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
    key(i) { return Array.from(map.keys())[i] || null; },
    get length() { return map.size; },
    _dump() { const o = {}; map.forEach((v, k) => { o[k] = v; }); return o; },
  };
}

/* ------------------------------ 构建一局 ------------------------------ */
function build(opts) {
  opts = opts || {};
  const sandbox = {};
  const quiet = !!opts.quiet;
  const logs = [];
  const listeners = {};
  const timers = { seq: 1, pending: new Map() };

  const documentShim = {
    readyState: 'loading',
    hidden: false,
    body: { appendChild() {} },
    documentElement: { style: {} },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      const arr = listeners[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    createElement() {
      return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    _fire(type) { (listeners[type] || []).slice().forEach((fn) => fn({ type })); },
  };

  const storage = makeStorage();

  Object.assign(sandbox, {
    document: documentShim,
    navigator: { userAgent: 'node-headless', onLine: true },
    localStorage: storage,
    location: { protocol: 'file:', href: 'file:///game/index.html' },
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    performance: { now: () => Date.now() },
    setTimeout(fn, ms) { const id = timers.seq++; timers.pending.set(id, fn); return id; },
    setInterval(fn) { const id = timers.seq++; timers.pending.set(id, fn); return id; },
    clearTimeout(id) { timers.pending.delete(id); },
    clearInterval(id) { timers.pending.delete(id); },
    console: quiet
      ? { log() {}, warn(...a) { logs.push(['warn', a.join(' ')]); }, error(...a) { logs.push(['error', a.join(' ')]); } }
      : console,
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  const files = opts.scripts || headlessScripts();
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    vm.runInContext(fs.readFileSync(abs, 'utf8'), context, { filename: abs });
  }

  const Game = sandbox.Game;
  Game.hud = { init() {}, updateStatusPill() {}, refresh() {} };
  documentShim._fire('DOMContentLoaded'); // 触发 main.js 的 boot()

  const api = {
    Game,
    sandbox,
    storage,
    logs,
    document: documentShim,
    get state() { return Game.state.s; },
    get person() { return Game.state.s.person; },
    reset(seed) { Game.reset(seed); return Game.state.s; },
    /* 推进一天；遇到待处理抉择先替玩家选掉 */
    tick(chooser) {
      const s = Game.state.s;
      if (s.pendingDecision) return api.answer(chooser);
      if (!s.person.alive) return null;
      Game.loop.step();
      return null;
    },
    /* 替玩家点掉抉择弹窗；chooser(ev, choices, game) 返回选项下标 */
    answer(chooser) {
      const s = Game.state.s;
      const pd = s.pendingDecision;
      if (!pd) return null;
      const chs = pd.ev.choices || [];
      let idx = chooser ? chooser(pd.ev, chs, api) : -1;
      if (idx == null || idx < 0 || !chs[idx] || !Game.decisions.choiceEnabled(chs[idx])) {
        idx = chs.findIndex((c) => Game.decisions.choiceEnabled(c));
      }
      if (idx < 0) { s.pendingDecision = null; return null; }
      const label = chs[idx].label;
      Game.decisions.choose(idx);
      return { id: pd.ev.id, label, index: idx };
    },
    runDays(n, chooser) {
      for (let i = 0; i < n; i++) api.tick(chooser);
      return Game.state.s;
    },
    runYears(n, chooser) {
      const target = Game.state.s.clock.age + n;
      let guard = 0;
      while (Game.state.s.person.alive && Game.state.s.clock.age < target && guard < 250000) {
        api.tick(chooser);
        guard++;
      }
      return Game.state.s;
    },
    runToDeath(maxYears, chooser) {
      const target = Game.state.s.clock.age + (maxYears || 130);
      let guard = 0;
      while (Game.state.s.person.alive && Game.state.s.clock.age < target && guard < 500000) {
        api.tick(chooser);
        guard++;
      }
      return Game.state.s;
    },
    flushTimers() {
      const fns = Array.from(timers.pending.values());
      timers.pending.clear();
      fns.forEach((fn) => { try { fn(); } catch (e) { logs.push(['timer-error', String(e)]); } });
    },
    hasPending() { return !!Game.state.s.pendingDecision; },
  };
  return api;
}

module.exports = { build, htmlScripts, headlessScripts, ROOT };
