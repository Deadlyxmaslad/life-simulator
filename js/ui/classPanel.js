/* =========================================================================
 * 界面 · 班级面板 (classPanel) —— v2.5.0
 * -------------------------------------------------------------------------
 * 独立 UI 模块：自己找容器 #classBox、自己跑 rAF，不侵入 hud.js 主渲染循环。
 * 展示"我的班级"名册：点击同学名字选中，弹出可开展的互动活动
 * （一起学习 / 闲聊 / 运动 / 请教 / 送礼 / 结为好友），冷却与好感一目了然。
 * 不在可分班的在校阶段（或 Game.education 缺失）时整个模块静默隐藏。
 * ========================================================================= */
(function () {
  const el = {};
  let last = 0;
  let sig = '';
  let sel = -1; // 当前选中的同学下标

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function build() {
    const host = document.getElementById('classBox');
    if (!host) return;
    if (!Game.education || typeof Game.education.classView !== 'function') { host.style.display = 'none'; return; }
    host.style.display = '';
    host.innerHTML =
      '<div class="cls-head">🏫 我的班级 <span class="cls-note" id="clsNote"></span></div>' +
      '<div class="cls-body" id="clsBody"></div>';
    el.note = document.getElementById('clsNote');
    el.body = document.getElementById('clsBody');
    host.addEventListener('click', onClick);
    requestAnimationFrame(loop);
  }

  function render() {
    if (!el.body || !Game.education) return;
    const v = Game.education.classView();
    if (!v) {
      if (sig !== 'hidden') { host.style.display = 'none'; sig = 'hidden'; }
      return;
    }
    host.style.display = '';
    if (sel >= v.size) sel = -1; // 换班后名册重建，选中失效

    const selMate = sel >= 0 ? v.classmates[sel] : null;
    const actSig = selMate ? selMate.acts.map((a) => a.id + (a.ready ? 1 : 0)).join(',') : '';
    const next = v.tier.key + ':' + v.size + ':' + sel +
      ':' + v.classmates.map((m) => m.aff + (m.friend ? 1 : 0)).join('.') + ':' + actSig;
    if (next === sig) return;
    sig = next;

    el.note.textContent = v.tier.emoji + ' ' + v.tier.name + ' · 全班 ' + v.size + ' 人 · 点同学名字开展互动';

    const mates = v.classmates.map(function (m) {
      const cls = 'cls-mate' + (m.idx === sel ? ' cur' : '') + (m.friend ? ' friend' : '');
      const tip = m.name + '（' + m.gender + '）· 成绩 ' + m.grade + ' · 好感 ' + m.aff + (m.friend ? ' · 好友' : '');
      return '<button class="' + cls + '" data-act="pick" data-idx="' + m.idx + '" title="' + esc(tip) + '">' +
        (m.friend ? '✦' : m.gender === '女' ? '<i class="cls-g f">女</i>' : '<i class="cls-g m">男</i>') +
        esc(m.name) + '</button>';
    }).join('');

    let detail = '<div class="cls-hint">点击上排同学的名字，看看能一起做点什么。</div>';
    if (selMate) {
      const acts = selMate.acts.map(function (a) {
        return '<button class="cls-act' + (a.ready ? '' : ' off') + '" data-act="do" data-id="' + esc(a.id) + '"' +
          (a.ready ? '' : ' disabled') + ' title="' + esc(a.tip) + '">' + esc(a.emoji) + ' ' + esc(a.name) + '</button>';
      }).join('');
      detail =
        '<div class="cls-detail">' +
        '<div class="cls-row"><b>' + (selMate.friend ? '✦ ' : '') + esc(selMate.name) + '</b>' +
        '<span class="cls-meta">' + esc(selMate.gender) + ' · 成绩 ' + selMate.grade +
        ' · 好感 ' + selMate.aff + '</span></div>' +
        '<div class="cls-bar"><i style="width:' + selMate.aff + '%"></i></div>' +
        '<div class="cls-acts">' + acts + '</div>' +
        '</div>';
    }

    el.body.innerHTML = '<div class="cls-roster">' + mates + '</div>' + detail;
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled || !Game.education) return;
    if (b.dataset.act === 'pick') {
      sel = +b.dataset.idx;
      sig = '';
    } else if (b.dataset.act === 'do') {
      const r = Game.education.interact(sel, b.dataset.id);
      if (!r.ok && r.reason && Game.state && Game.state.log) {
        Game.state.log('🏫 这次没能成行：' + r.reason, 'info', '🏫');
      }
      sig = '';
    }
    render();
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 250) return; // ~4fps 足够（同学好感变化很慢）
    last = ts;
    render();
  }

  function boot() {
    try { build(); } catch (err) { console.error('[classPanel] init failed', err); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { render: render };
})();
