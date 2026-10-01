/* =========================================================================
 * 界面 · 月行动点 (apPanel) —— v1.6.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：自己找容器 #apBox、自己跑 rAF，不侵入 hud.js。
 * **默认不显示**（config.ap.enabled === false 时整个面板隐藏），开启后才出现。
 * Game.ap 不存在时同样静默不渲染。
 * ========================================================================= */
(function () {
  const el = {};
  let last = 0;
  let sig = '';

  function build() {
    const host = document.getElementById('apBox');
    if (!host) return;
    host.style.display = 'none';   // 默认隐藏，等 render 决定
    el.host = host;
    host.innerHTML =
      '<span class="ap-label">⚡ 本月行动点</span>' +
      '<span class="ap-dots" id="apDots"></span>' +
      '<span class="ap-num" id="apNum"></span>' +
      '<span class="ap-mode" id="apMode"></span>';
    el.dots = document.getElementById('apDots');
    el.num = document.getElementById('apNum');
    el.mode = document.getElementById('apMode');
    requestAnimationFrame(loop);
  }

  function render() {
    if (!el.host || !Game.ap || typeof Game.ap.state !== 'function') return;
    const s = Game.ap.state();
    if (!s.enabled) { el.host.style.display = 'none'; return; }   // 关闭 ⇒ 整块不显示
    el.host.style.display = '';
    const next = s.ap + '|' + s.cap + '|' + s.mode + '|' + s.blocked;
    if (next === sig) return;
    sig = next;

    let dots = '';
    for (let i = 0; i < s.cap; i++) dots += '<i class="ap-dot' + (i < s.ap ? ' on' : '') + '"></i>';
    el.dots.innerHTML = dots;
    el.num.textContent = s.ap + ' / ' + s.cap;
    el.mode.textContent = (s.mode === 'hard' ? '硬性限制' : '软提示') +
      (s.blocked ? ' · 曾告罄 ' + s.blocked + ' 次' : '');
    el.mode.className = 'ap-mode' + (s.mode === 'hard' ? ' hard' : '');
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 400) return;   // ~2.5fps：点数变化很慢
    last = ts;
    render();
  }

  function boot() {
    try { build(); render(); } catch (err) { console.error('[apPanel] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { render: render };
})();
