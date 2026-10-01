/* =========================================================================
 * 界面 · 人生合约面板 (contractPanel) —— v1.6.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：自己找容器 #contractBox、自己跑 rAF，不侵入 hud.js。
 * 显示"本期候选合约 / 在手合约与剩余年限 / 已达成徽章"，并允许认领与放弃。
 * Game.contracts 不存在时整个模块静默不渲染。
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
    const host = document.getElementById('contractBox');
    if (!host) return;
    if (!Game.contracts || typeof Game.contracts.state !== 'function') { host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML =
      '<div class="ct-head">📜 人生合约 <span class="ct-note">五年一期 · 认领一张，到期验收</span></div>' +
      '<div class="ct-body" id="ctBody"></div>';
    el.body = document.getElementById('ctBody');
    host.addEventListener('click', onClick);
    requestAnimationFrame(loop);
  }

  function render() {
    if (!el.body || !Game.contracts) return;
    const s = Game.contracts.state();
    if (!s) return;

    const offerSig = (s.offer || []).map(function (o) { return o.id; }).join(',');
    const actSig = s.active ? (s.active.id + ':' + s.active.leftYears) : '-';
    const next = s.period + '|' + offerSig + '|' + actSig + '|' + s.kept + '|' + s.failed + '|' + (s.badges || []).join(',');
    if (next === sig) return;
    sig = next;

    let top = '';
    if (s.active) {
      top =
        '<div class="ct-active">' +
        '<span class="ct-emoji">' + esc(s.active.emoji) + '</span>' +
        '<span class="ct-name">' + esc(s.active.name) + '</span>' +
        '<span class="ct-left">还剩 ' + s.active.leftYears + ' 年验收</span>' +
        '</div>' +
        '<div class="ct-desc">' + esc(s.active.desc) + '</div>';
    } else if ((s.offer || []).length) {
      top = '<div class="ct-empty">第 ' + s.period + ' 期合约已下发，从下面认领一张（也可不认领）：</div>';
    } else {
      top = '<div class="ct-empty">暂无在手合约，等下一期下发。</div>';
    }

    let cards = '';
    if (!s.active && (s.offer || []).length) {
      cards = '<div class="ct-cards">' + s.offer.map(function (o) {
        return '<button class="ct-card" data-act="claim" data-id="' + esc(o.id) + '" title="认领：' + esc(o.desc) + '">' +
          '<span class="ct-tag">' + esc(o.tag) + '</span>' +
          '<span class="ct-cemoji">' + esc(o.emoji) + '</span>' +
          '<span class="ct-cname">' + esc(o.name) + '</span>' +
          '<span class="ct-cdesc">' + esc(o.desc) + '</span>' +
          '</button>';
      }).join('') +
      '<button class="ct-skip" data-act="skip" title="本期不认领任何合约">本期不认领</button>' +
      '</div>';
    }

    const stats = '<div class="ct-stats">已达成 <b>' + s.kept + '</b> · 未达成 <b>' + s.failed + '</b>' +
      ((s.badges || []).length ? ' · 徽章 ' + s.badges.map(function (b) { return esc(b); }).join('') : '') + '</div>';

    el.body.innerHTML = top + cards + stats;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || !Game.contracts) return;
    const act = b.dataset.act;
    if (act === 'claim') Game.contracts.claim(b.dataset.id);
    else if (act === 'skip') Game.contracts.skip();
    sig = '';
    render();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 300) return; // ~3fps：合约变化极慢
    last = ts;
    render();
  }

  function boot() {
    try { build(); } catch (err) { console.error('[contractPanel] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { render: render };
})();
