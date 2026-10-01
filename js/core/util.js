/* =========================================================================
 * 核心 · 工具 & 随机数 (util)
 * -------------------------------------------------------------------------
 * 提供可复现的随机数（种子），方便调试与回放一局人生。
 * 其它通用数学/集合工具也放这里，供各系统共享。
 * ========================================================================= */
Game.util = (function () {
  let _seed = 1;

  // mulberry32：小巧、足够均匀的 32 位 PRNG
  function setSeed(s) {
    _seed = (s >>> 0) || 1;
  }

  function rand() {
    _seed |= 0;
    _seed = (_seed + 0x6d2b79f5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // 概率修正系数（默认 1）：仅供外部模块临时改写偶然判定的成功率。
  // 保持 1 时 chance 行为与历史完全一致，保证无头测试可复现。
  let _luckMul = 1;

  function setLuckMul(m) {
    _luckMul = (typeof m === 'number' && isFinite(m) && m > 0) ? m : 1;
  }
  function luckMul() {
    return _luckMul;
  }

  function randInt(min, max) {
    return min + Math.floor(rand() * (max - min + 1));
  }

  function range(min, max) {
    return min + rand() * (max - min);
  }

  function chance(p) {
    return rand() < Math.min(p * _luckMul, 0.995);
  }

  function pick(arr) {
    return arr[Math.floor(rand() * arr.length)];
  }

  // 从 [{item, weight}] 中按权重抽取；也接受 {key:weight} 对象
  function weighted(entries) {
    let list = entries;
    if (!Array.isArray(entries)) {
      list = Object.keys(entries).map((k) => ({ item: k, weight: entries[k] }));
    }
    let total = 0;
    for (const e of list) total += Math.max(0, e.weight);
    if (total <= 0) return list.length ? list[0].item : null;
    let r = rand() * total;
    for (const e of list) {
      r -= Math.max(0, e.weight);
      if (r <= 0) return e.item;
    }
    return list[list.length - 1].item;
  }

  // 近似正态分布（Irwin–Hall），用于温度/寿命等"围绕均值波动"的量
  function gauss(mean, sd) {
    const u = rand() + rand() + rand() + rand() + rand() + rand();
    return mean + ((u - 3) / 3) * (sd || 1) * 1.732;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.floor(rand() * 1e9).toString(36);
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  return {
    setSeed, rand, randInt, range, chance, pick, weighted,
    setLuckMul, luckMul,
    gauss, clamp, lerp, uid, pad2,
  };
})();
