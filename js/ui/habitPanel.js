/* =========================================================================
 * 界面 · 习惯面板 (habitPanel) —— v1.3.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：自己找容器 #habitBox、自己跑 rAF，不侵入 hud.js 主渲染循环。
 * 显示"当前习惯 / 连续进度 / 内化徽章"，并允许立习惯与放弃。
 * Game.habit 不存在时整个模块静默不渲染（删掉系统文件界面也不报错）。
 * ========================================================================= */
(function () {
  const el = {};
  let last = 0;
  let sig = '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build() {
    const host = document.getElementById('habitBox');
    if (!host) return;
    if (!Game.habit || typeof Game.habit.state !== 'function') { host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML =
      '<div class="hb-head">🌱 习惯 <span class="hb-note">坚持成性 · 塑造自己</span></div>' +
      '<div class="hb-body" id="hbBody"></div>';
    el.body = document.getElementById('hbBody');
    host.addEventListener('click', onClick);
    requestAnimationFrame(loop);
  }

  function render() {
    if (!el.body || !Game.habit) return;
    const s = Game.habit.state();
    if (!s) return;
    const list = Game.habit.defs().map(function (d) {
      return d.id + ':' + (s.mastered.indexOf(d.id) >= 0 ? 1 : 0);
    }).join(',');
    const next = s.active + ':' + s.streak + ':' + s.persist + ':' + s.mastered.length + ':' + list + ':' + (s.canStart ? 1 : 0);
    if (next === sig) return;
    sig = next;

    let cur;
    if (!s.active) {
      cur = '<div class="hb-empty">' + (s.canStart
        ? '还没有立下习惯。从下面挑一个，开始塑造自己。'
        : '（12 岁起可立习惯）') + '</div>';
    } else {
      const pct = Math.round(s.progress * 100);
      cur =
        '<div class="hb-cur">' +
        '<span class="hb-emoji">' + esc(s.emoji) + '</span>' +
        '<span class="hb-name">' + esc(s.name) + '</span>' +
        '<span class="hb-streak">连续 ' + s.streak + ' / ' + s.persist + ' 个月</span>' +
        '<button class="hb-btn hb-abandon" data-act="abandon" title="放弃当前习惯（只断连击，不惩罚）">放弃</button>' +
        '</div>' +
        '<div class="hb-bar"><i style="width:' + pct + '%"></i></div>';
    }

    const chips = Game.habit.defs().map(function (d) {
      const done = s.mastered.indexOf(d.id) >= 0;
      const isActive = s.active === d.id;
      const cls = 'hb-chip' + (done ? ' done' : '') + (isActive ? ' cur' : '');
      const dis = (!s.canStart || isActive) ? ' disabled' : '';
      const tip = d.name + ' · 坚持 ' + d.persist + ' 个月可内化：' + d.desc;
      return '<button class="' + cls + '" data-act="start" data-id="' + esc(d.id) + '"' + dis +
        ' title="' + esc(tip) + '">' + esc(d.emoji) + (done ? ' ✔' : '') + '</button>';
    }).join('');

    const badges = s.mastered.length
      ? '<div class="hb-badges">已内化 ' + s.mastered.length + ' 个：' +
        s.mastered.map(function (id) {
          const d = Game.habit.def(id);
          return d ? esc(d.emoji + d.name) : esc(id);
        }).join(' · ') + '</div>'
      : '';

    el.body.innerHTML = cur + '<div class="hb-chips">' + chips + '</div>' + badges;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled || !Game.habit) return;
    if (b.dataset.act === 'start') Game.habit.start(b.dataset.id);
    else if (b.dataset.act === 'abandon') Game.habit.abandon();
    sig = '';
    render();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 250) return; // ~4fps 足够（习惯变化很慢）
    last = ts;
    render();
  }

  function boot() {
    try { build(); } catch (err) { console.error('[habitPanel] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { render: render };
})();
