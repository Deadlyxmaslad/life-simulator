/* =========================================================================
 * 界面 · 未竟之事 (roadsPanel) —— v1.3.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：监听 death，把 Game.roads 给出的"从没走过的路"渲染进结算页。
 * 不侵入 hud.js。Game.roads 不存在则静默不渲染。
 * ========================================================================= */
(function () {
  const bus = Game.bus;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render() {
    const box = document.getElementById('sumRoads');
    if (!box) return;
    if (!Game.roads || typeof Game.roads.missed !== 'function') { box.innerHTML = ''; return; }
    const miss = Game.roads.missed();
    const total = (Game.roads.paths() || []).length;
    if (!miss.length) {
      box.innerHTML = '<div class="roads-note good">这一生，没有留下明显的遗憾。</div>';
      return;
    }
    box.innerHTML =
      '<div class="roads-note">你错过了 ' + miss.length + ' / ' + total + ' 条路：</div>' +
      miss.map(function (m) {
        return '<div class="road-row"><span class="road-name">' + esc(m.name) + '</span>' +
          '<span class="road-desc">' + esc(m.desc) + '</span></div>';
      }).join('');
  }

  bus.on('death', function () { setTimeout(render, 0); });
  bus.on('score:done', function () { setTimeout(render, 0); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  return { render: render };
})();
