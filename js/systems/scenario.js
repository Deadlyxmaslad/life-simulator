/* =========================================================================
 * 剧本 · 难度/人生剧本 (scenario) —— 非事件系统，纯配置持有者
 * -------------------------------------------------------------------------
 * 保存当前所选剧本，暴露一组"倍率/偏移"给各系统在运行时读取：
 *   disease / mortality / luck / eventRate / originShift / iqBonus / persBonus
 * 切换即生效（emit scenario:change），既作开局选择也作难度开关。
 * 剧本数据在 config.scenarios；这里是唯一的读写入口。
 * ========================================================================= */
(function () {
  const S = Game.config.scenarios;

  Game.scenario = {
    _key: Game.config.scenarioDefault || 'normal',
    key() {
      return this._key;
    },
    cur() {
      return S[this._key] || S.normal;
    },
    disease() { return this.cur().disease; },
    mortality() { return this.cur().mortality; },
    luck() { return this.cur().luck; },
    eventRate() { return this.cur().eventRate; },
    originShift() { return this.cur().originShift || 0; },
    iqBonus() { return this.cur().iqBonus || 0; },
    persBonus() { return this.cur().persBonus || 0; },
    assetDrift() { return this.cur().assetDrift || 0; },
    set(k) {
      if (!S[k] || k === this._key) return;
      this._key = k;
      Game.bus.emit('scenario:change', { key: k, scenario: S[k] });
    },
    list() {
      return Object.keys(S).map((k) => Object.assign({ key: k }, S[k]));
    },
  };
})();
