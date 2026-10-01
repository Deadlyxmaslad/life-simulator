/* =========================================================================
 * 界面 · 办公室面板 (officePanel) —— v2.6.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：自己找容器 #officeBox、自己跑 rAF，不侵入 hud.js 主渲染循环。
 * 比照班级面板（classPanel）的模式：展示"我的办公室"同事名册，
 * 点击同事名字选中，弹出可开展的职场互动（午饭/八卦/请教/协作/奶茶/
 * 托引荐/结为好友），冷却与好感一目了然。样式复用 .cls-*（班级面板那套）。
 * 不在职（或 Game.career 缺失）时整个模块静默隐藏。
 * ========================================================================= */
(function () {
  const el = {};
  let host = null; // 容器在 build() 里取一次，render/onClick 共用
  let last = 0;
  let sig = '';
  let sel = -1; // 当前选中的同事下标

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build() {
    host = document.getElementById('officeBox');
    if (!host) return;
    if (!Game.career || typeof Game.career.officeView !== 'function') { host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML =
      '<div class="cls-head">🏢 我的办公室 <span class="cls-note" id="ofcNote"></span></div>' +
      '<div class="cls-body" id="ofcBody"></div>';
    el.note = document.getElementById('ofcNote');
    el.body = document.getElementById('ofcBody');
    host.addEventListener('click', onClick);
    requestAnimationFrame(loop);
  }

  function render() {
    if (!el.body || !Game.career) return;
    const v = Game.career.officeView();
    if (!v) {
      if (sig !== 'hidden') { host.style.display = 'none'; sig = 'hidden'; }
      return;
    }
    host.style.display = '';
    if (sel >= v.size) sel = -1; // 换工作后名册重建，选中失效

    const selCol = sel >= 0 ? v.colleagues[sel] : null;
    const actSig = selCol ? selCol.acts.map((a) => a.id + (a.ready ? 1 : 0)).join(',') : '';
    const next = v.job + ':' + v.size + ':' + sel +
      ':' + v.colleagues.map((m) => m.aff + (m.friend ? 1 : 0)).join('.') + ':' + actSig;
    if (next === sig) return;
    sig = next;

    el.note.textContent = '💼 ' + v.job + ' · 同事 ' + v.size + ' 人 · 点同事名字开展互动';

    const cols = v.colleagues.map(function (m) {
      const cls = 'cls-mate' + (m.idx === sel ? ' cur' : '') + (m.friend ? ' friend' : '');
      const tip = m.name + '（' + m.gender + '）· 能力 ' + m.skill + ' · 工龄 ' + m.years + ' 年 · 好感 ' + m.aff + (m.friend ? ' · 好友' : '');
      return '<button class="' + cls + '" data-act="pick" data-idx="' + m.idx + '" title="' + esc(tip) + '">' +
        (m.friend ? '✦' : m.gender === '女' ? '<i class="cls-g f">女</i>' : '<i class="cls-g m">男</i>') +
        esc(m.name) + '</button>';
    }).join('');

    let detail = '<div class="cls-hint">点击上排同事的名字，看看能一起做点什么。</div>';
    if (selCol) {
      const acts = selCol.acts.map(function (a) {
        return '<button class="cls-act' + (a.ready ? '' : ' off') + '" data-act="do" data-id="' + esc(a.id) + '"' +
          (a.ready ? '' : ' disabled') + ' title="' + esc(a.tip) + '">' + esc(a.emoji) + ' ' + esc(a.name) + '</button>';
      }).join('');
      detail =
        '<div class="cls-detail">' +
        '<div class="cls-row"><b>' + (selCol.friend ? '✦ ' : '') + esc(selCol.name) + '</b>' +
        '<span class="cls-meta">' + esc(selCol.gender) + ' · 能力 ' + selCol.skill +
        ' · 工龄 ' + selCol.years + ' 年 · 好感 ' + selCol.aff + '</span></div>' +
        '<div class="cls-bar"><i style="width:' + selCol.aff + '%"></i></div>' +
        '<div class="cls-acts">' + acts + '</div>' +
        '</div>';
    }

    el.body.innerHTML = '<div class="cls-roster">' + cols + '</div>' + detail;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled || !Game.career) return;
    if (b.dataset.act === 'pick') {
      sel = +b.dataset.idx;
      sig = '';
    } else if (b.dataset.act === 'do') {
      const r = Game.career.officeInteract(sel, b.dataset.id);
      if (!r.ok && r.reason && Game.state && Game.state.log) {
        Game.state.log('🏢 这次没能成行：' + r.reason, 'info', '🏢');
      }
      sig = '';
    }
    render();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 250) return; // ~4fps 足够（同事好感变化很慢）
    last = ts;
    render();
  }

  function boot() {
    try { build(); } catch (err) { console.error('[officePanel] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { render: render };
})();
