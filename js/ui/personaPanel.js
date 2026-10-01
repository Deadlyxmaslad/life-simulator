/* =========================================================================
 * 界面 · 倾向标签 (personaPanel) —— v1.6.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：监听 death，把 Game.persona 给出的"这一生的底色"渲染进结算页。
 * 不侵入 hud.js。Game.persona 不存在则静默不渲染。
 * ========================================================================= */
(function () {
  const bus = Game.bus;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render() {
    const box = document.getElementById('sumPersona');
    if (!box) return;
    if (!Game.persona || typeof Game.persona.tags !== 'function') { box.innerHTML = ''; return; }
    const tags = Game.persona.tags();
    if (!tags.length) {
      box.innerHTML = '<div class="persona-note">这一生过得平稳，没有留下太鲜明的底色。</div>';
      return;
    }
    box.innerHTML =
      '<div class="persona-note">这一生，你是这样的人：</div>' +
      '<div class="persona-tags">' +
      tags.map(function (t) {
        return '<div class="persona-tag"><span class="pt-emoji">' + esc(t.emoji) + '</span>' +
          '<span class="pt-name">' + esc(t.name) + '</span>' +
          '<span class="pt-desc">' + esc(t.desc) + '</span></div>';
      }).join('') +
      '</div>';
  }

  bus.on('death', function () { setTimeout(render, 0); });
  bus.on('persona:done', function () { setTimeout(render, 0); });
  bus.on('score:done', function () { setTimeout(render, 0); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  return { render: render };
})();
